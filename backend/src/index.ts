/**
 * Backend Entrypoint - selects real or mock server based on USE_MOCK
 * Orchestrates DB connection, automatic data loading, and server startup
 */

// Load environment variables first
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const backendDir = path.join(__dirname, '..');
const envLocalPath = path.join(backendDir, '.env.local');
const envPath = path.join(backendDir, '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Check for mock mode - only USE_MOCK triggers server-mock.ts
// USE_MOCK_DB is handled by server.ts internally for full API with mock database
const useMock = String(process.env.USE_MOCK || '').toLowerCase() === 'true';

if (useMock) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./server-mock');
} else {
  // Real server - handle DB connection and auto-loading before starting
  (async () => {
    try {
      // Dynamically import server module to avoid circular dependencies
      const serverModule = await import('./server');
      const { app, PORT, startServer } = serverModule;
      const { getPool } = await import('./config/db');
      
      // Check if using mock database
      const useMockDb = process.env.USE_MOCK_DB === 'true';
      
      // Connect to database first (if not using mock)
      let dbConnected = false;
      if (!useMockDb) {
        // eslint-disable-next-line no-console
        console.log('Attempting database connection...');
        try {
          await getPool();
          dbConnected = true;
          // eslint-disable-next-line no-console
          console.log('Database connection established');
          
          // Automatic data loading on startup (after DB connection, before app.listen)
          // Run asynchronously to avoid blocking server startup
          const skipAutoLoad = process.env.SKIP_AUTO_LOAD === 'true';
          const autoLoadData = process.env.AUTO_LOAD_DATA !== 'false';
          
          if (!skipAutoLoad && autoLoadData) {
            // Check for cluster worker - only run on primary/master process
            // Support both cluster.isWorker and NODE_APP_INSTANCE for different deployment scenarios
            let isClusterWorker = false;
            try {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const cluster = require('cluster');
              if (cluster && cluster.isWorker) {
                isClusterWorker = true;
              }
            } catch {
              // Cluster module not available, check NODE_APP_INSTANCE instead
              if (typeof process.env.NODE_APP_INSTANCE !== 'undefined' && 
                  process.env.NODE_APP_INSTANCE !== '0') {
                isClusterWorker = true;
              }
            }
            
            if (!isClusterWorker) {
              // Load data asynchronously (fire-and-forget, non-blocking)
              (async () => {
                try {
                  // Small delay to ensure database is fully ready
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  // Dynamically import to avoid circular deps
                  const { getDataPipelineService } = await import('./services/dataPipelineService');
                  const pipeline = getDataPipelineService();
                  
                  // Check if data needs updating (checks for empty DB <10 records or stale data >24h)
                  if (await pipeline.shouldUpdate()) {
                    try {
                      const result = await pipeline.updateDatabaseFromRawFiles();
                      // eslint-disable-next-line no-console
                      console.log(`✓ Automatic data load: ${result.symbolsProcessed} symbols, ${result.totalRecords} records`);
                      
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
                      console.warn('Auto data load failed:', e?.message || String(e));
                      // Continue startup - data can be loaded manually later
                    }
                  } else {
                    const availableSymbols = await pipeline.getAvailableSymbols();
                    // eslint-disable-next-line no-console
                    console.log(`✓ Market data is up to date (${availableSymbols.length} symbols available)`);
                  }
                } catch (error: any) {
                  // eslint-disable-next-line no-console
                  console.warn('Auto data load failed:', error?.message || String(error));
                  // Don't crash server - data can be loaded manually later
                }
              })();
            } else {
              // eslint-disable-next-line no-console
              console.log('Skipping automatic data load (cluster worker instance)');
            }
          } else if (skipAutoLoad) {
            // eslint-disable-next-line no-console
            console.log('Skipping automatic data load (SKIP_AUTO_LOAD=true)');
          } else if (!autoLoadData) {
            // eslint-disable-next-line no-console
            console.log('Skipping automatic data load (AUTO_LOAD_DATA=false)');
          }
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
      } else {
        dbConnected = true; // Mock database is always "connected"
      }
      
      // Start server after DB connection (and auto-loading triggered)
      await startServer(dbConnected);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('ERROR: Failed to start server:', error);
      process.exit(1);
    }
  })();
}

