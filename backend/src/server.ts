/**
 * WealthArena Backend Server
 * Main Express Application
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import routes from './routes';
import { executeQuery } from './config/db';
import { getPool } from './config/db';
import { metricsMiddleware } from './middleware/metrics';
import metricsRouter from './routes/metrics';
import { getDailyDataUpdateScheduler } from './services/dailyDataUpdateScheduler';

// Load environment variables - prefer .env.local for local development
// __dirname is backend/src (or backend/dist), so go up one level to backend directory
const backendDir = path.join(__dirname, '..');
const envLocalPath = path.join(backendDir, '.env.local');
const envPath = path.join(backendDir, '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config(); // Fallback to default .env location
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Metrics middleware must be applied early to capture all requests
app.use(metricsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration - Allow all origins in development for Expo
const isDevelopment = process.env.NODE_ENV !== 'production';

if (isDevelopment) {
  // In development, allow all origins for easier mobile testing
  app.use(cors({
    origin: true,
    credentials: true,
  }));
} else {
  // In production, use strict CORS
  // Support both CORS_ORIGINS and ALLOWED_ORIGINS for backward compatibility
  const corsOriginsEnv = process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS;
  const allowedOrigins = corsOriginsEnv 
    ? corsOriginsEnv.split(',').map(o => o.trim()).filter(o => {
        // Filter out empty strings and malformed URLs (like just "http://")
        return o && o.length > 7 && (o.startsWith('http://') || o.startsWith('https://'));
      })
    : [
        'http://localhost:5001',
        'http://localhost:8081',
        'http://localhost:3000',
      ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
}

// Request logging
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.path}`, {
      body: req.body,
      query: req.query,
    });
  }
  next();
});

// Mount metrics endpoint BEFORE generic /api routes to avoid shadowing
app.use('/api/metrics', metricsRouter);
// Mount API routes
app.use('/api', routes);

// Top-level health endpoint (standardized across all services)
app.get('/health', async (req, res) => {
  interface HealthResponse {
    status: string;
    service: string;
    timestamp: string;
    database: string;
    databaseError?: string;
  }

  const health: HealthResponse = {
    status: 'healthy',
    service: 'backend',
    timestamp: new Date().toISOString(),
    database: 'unknown',
  };
  
  // Check database connectivity (non-blocking)
  const useMockDb = process.env.USE_MOCK_DB === 'true';
  if (useMockDb) {
    health.database = 'mock (in-memory)';
  } else {
    try {
      await executeQuery('SELECT 1');
      health.database = 'connected';
    } catch (error: unknown) {
      health.database = 'disconnected';
      health.status = 'degraded';
      const errorMessage = error instanceof Error ? error.message : String(error);
      health.databaseError = process.env.NODE_ENV === 'development' ? errorMessage : undefined;
    }
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to WealthArena API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
      },
      signals: {
        top: 'GET /api/signals/top',
        byId: 'GET /api/signals/:signalId',
        bySymbol: 'GET /api/signals/symbol/:symbol',
      },
      portfolio: {
        overview: 'GET /api/portfolio',
        items: 'GET /api/portfolio/items',
        trades: 'GET /api/portfolio/trades',
        positions: 'GET /api/portfolio/positions',
      },
      user: {
        profile: 'GET /api/user/profile',
        xp: 'POST /api/user/xp',
        achievements: 'GET /api/user/achievements',
        quests: 'GET /api/user/quests',
        leaderboard: 'GET /api/user/leaderboard',
      },
      chat: {
        session: 'POST /api/chat/session',
        message: 'POST /api/chat/message',
        history: 'GET /api/chat/history',
        feedback: 'POST /api/chat/feedback',
        sessions: 'GET /api/chat/sessions',
      },
    },
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
  });
});

// Export app and PORT for use in index.ts
export { app, PORT };

// Start server (callable from index.ts after DB connection)
export const startServer = async (dbConnected: boolean = false) => {
  try {
    // Check if using mock database
    const useMockDb = process.env.USE_MOCK_DB === 'true';
    
    if (useMockDb) {
      // eslint-disable-next-line no-console
      console.log('Using Mock Database (In-Memory) - no database connection required');
      // eslint-disable-next-line no-console
      console.log('All user data will be stored in memory and cleared on server restart');
      // eslint-disable-next-line no-console
      console.log('Market data will be stored in local JSON file (backend/data/local-market-data.json)');
      dbConnected = true; // Mock database is always "connected"
      
      // Auto-load market data from CSV files in mock mode (non-blocking, runs after server starts)
      // This runs in the background and doesn't block server startup or health checks
      setImmediate(async () => {
        try {
          // Wait a bit longer to ensure server is fully ready and can respond to health checks
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const { getDataPipelineService } = await import('./services/dataPipelineService');
          const pipeline = getDataPipelineService();
          
          // Check if data needs updating (checks for empty local storage <10 records or stale data >24h)
          if (await pipeline.shouldUpdate()) {
            // eslint-disable-next-line no-console
            console.log('📊 Initializing market data from CSV files (running in background)...');
            try {
              const result = await pipeline.updateDatabaseFromRawFiles();
              // eslint-disable-next-line no-console
              console.log(`✓ Market data loaded: ${result.symbolsProcessed} symbols, ${result.totalRecords} records`);
              
              if (result.errors.length > 0) {
                // eslint-disable-next-line no-console
                console.warn(`⚠ ${result.errors.length} errors encountered during data loading:`);
                result.errors.slice(0, 5).forEach(err => {
                  // eslint-disable-next-line no-console
                  console.warn(`  - ${err}`);
                });
              }
            } catch (e: any) {
              // eslint-disable-next-line no-console
              console.warn('⚠ Auto data load failed:', e?.message || String(e));
              // Continue startup - data can be loaded manually later via POST /api/market-data/initialize
            }
          } else {
            const availableSymbols = await pipeline.getAvailableSymbols();
            // eslint-disable-next-line no-console
            console.log(`✓ Market data is up to date (${availableSymbols.length} symbols available)`);
          }
        } catch (error: any) {
          // eslint-disable-next-line no-console
          console.warn('⚠ Market data initialization check failed:', error?.message || String(error));
          // Don't crash server - data can be loaded manually later
        }
      });
    } else {
      // Validate DB_TYPE is loaded correctly
      const dbType = process.env.DB_TYPE;
      // eslint-disable-next-line no-console
      console.log(`DB_TYPE: ${dbType || 'not set'}`);
      
      // Validate database password is not a placeholder
      const dbPassword = process.env.DB_PASSWORD;
      if (dbPassword === 'your-postgres-password' || dbPassword === 'your-sql-password') {
        throw new Error(
          'DB_PASSWORD placeholder not updated. Please update backend/.env.local with your actual PostgreSQL password. ' +
          'The password should match the one in data-pipeline/sqlDB.env (SQL_PWD).'
        );
      }
      if (!dbPassword || dbPassword.trim() === '') {
        throw new Error(
          'DB_PASSWORD is not set. Please configure DB_PASSWORD in backend/.env.local with your actual PostgreSQL password.'
        );
      }
      
      // Use passed dbConnected flag (connection should be done in index.ts)
      // If not provided, connect here as fallback
      if (dbConnected === undefined || dbConnected === null || dbConnected === false) {
        // eslint-disable-next-line no-console
        console.log('Attempting database connection...');
        try {
          await getPool();
          dbConnected = true;
          // eslint-disable-next-line no-console
          console.log('Database connection established');
        } catch (dbError: unknown) {
          const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
          // eslint-disable-next-line no-console
          console.warn('WARNING: Database connection failed, but continuing startup:', errorMessage);
          // eslint-disable-next-line no-console
          console.warn('WARNING: Some features may not work until database is available');
          // eslint-disable-next-line no-console
          console.warn('WARNING: Check database configuration and credentials');
          dbConnected = false;
        }
      }
    }
    
    // Start listening even if database connection failed
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('========================================');
      // eslint-disable-next-line no-console
      console.log('WealthArena Backend Server Started');
      // eslint-disable-next-line no-console
      console.log('========================================');
      // eslint-disable-next-line no-console
      console.log(`Port: ${PORT}`);
      // eslint-disable-next-line no-console
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      if (useMockDb) {
        // eslint-disable-next-line no-console
        console.log(`Database: Mock Database (In-Memory)`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`Database: ${dbConnected ? 'Connected' : 'Disconnected'}`);
        if (process.env.DB_NAME) {
          // eslint-disable-next-line no-console
          console.log(`Database Name: ${process.env.DB_NAME}`);
        }
        if (process.env.DB_HOST) {
          // eslint-disable-next-line no-console
          console.log(`Database Host: ${process.env.DB_HOST}`);
        }
      }
      // eslint-disable-next-line no-console
      console.log('========================================');
      // eslint-disable-next-line no-console
      console.log(`API Documentation: http://localhost:${PORT}/`);
      // eslint-disable-next-line no-console
      console.log(`Health Check: http://localhost:${PORT}/health`);
      // eslint-disable-next-line no-console
      console.log('========================================');
      // eslint-disable-next-line no-console
      console.log('');

      // Start daily data update scheduler (only if not using mock DB)
      if (!useMockDb && dbConnected) {
        try {
          const scheduler = getDailyDataUpdateScheduler();
          scheduler.start();
        } catch (schedulerError) {
          // eslint-disable-next-line no-console
          console.warn('Failed to start daily data update scheduler:', schedulerError);
        }
      }

    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('ERROR: Failed to start server:', error);
    process.exit(1);
  }
};

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  // eslint-disable-next-line no-console
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Server is started from index.ts after DB connection and auto-loading

export default app;

