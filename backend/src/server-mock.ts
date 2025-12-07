/**
 * WealthArena Backend Server - Mock Mode
 * Runs without database connection for testing
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth-mock';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
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
      callback(null, true); // Allow all for testing
    }
  },
  credentials: true,
}));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Mount API routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'WealthArena API is running (MOCK MODE)',
    timestamp: new Date().toISOString(),
    database: 'Mock (In-Memory)',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to WealthArena API - Mock Mode',
    version: '1.0.0',
    mode: 'MOCK - No database required',
    endpoints: {
      health: '/api/health',
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
      },
    },
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

// Start server (No database connection needed!)
const startServer = async () => {
  try {
    console.log('');
    console.log('⚠️  ========================================');
    console.log('⚠️   MOCK MODE - No Database Connection');
    console.log('⚠️  ========================================');
    console.log('');
    
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log('🚀 ========================================');
      console.log('🚀  WealthArena Backend Server Started');
      console.log('🚀 ========================================');
      console.log(`🚀  Port: ${PORT}`);
      console.log(`🚀  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀  Database: MOCK (In-Memory)`);
      console.log('🚀 ========================================');
      console.log(`🚀  API Documentation: http://localhost:${PORT}/`);
      console.log(`🚀  Health Check: http://localhost:${PORT}/api/health`);
      console.log('🚀 ========================================');
      console.log('');
      console.log('✅ Ready to accept requests!');
      console.log('📝 Users will be stored in memory only');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;



