/**
 * Database Connection Configuration
 * Azure SQL Database Connection Pool
 */

import sql from 'mssql';
import dotenv from 'dotenv';
import { recordDbQuery, recordDbError } from '../middleware/metrics';

dotenv.config();

const config: sql.config = {
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_HOST || '',
  database: process.env.DB_NAME || 'WealthArenaDB',
  port: Number.parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

/**
 * Get database connection pool
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  // Check if using mock database - don't attempt connection
  const useMockDb = process.env.USE_MOCK_DB === 'true';
  if (useMockDb) {
    throw new Error('Database operations not available in mock mode. Use mock database functions instead.');
  }

  if (!pool) {
    try {
      pool = await new sql.ConnectionPool(config).connect();
      console.log('✅ Connected to Azure SQL Database');
      
      pool.on('error', (err) => {
        console.error('❌ Database pool error:', err);
        pool = null;
      });
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }
  return pool;
}

/**
 * Check if mock database mode is enabled
 */
export function isMockMode(): boolean {
  return process.env.USE_MOCK_DB === 'true';
}

/**
 * Execute a query with parameters
 */
export async function executeQuery<T = unknown>(
  query: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  const startTime = Date.now();
  
  // Check if using mock database
  const useMockDb = process.env.USE_MOCK_DB === 'true';
  if (useMockDb) {
    // Return mock empty result set in mock mode
    // Routes should check for mock mode themselves and provide mock data
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'query');
    
    // Return empty result set structure that matches sql.IResult<T>
    return {
      recordset: [] as T[],
      rowsAffected: [0],
    } as sql.IResult<T>;
  }
  
  try {
    const pool = await getPool();
    const request = pool.request();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    const result = await request.query<T>(query);
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'query');
    return result;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'query');
    recordDbError('query');
    console.error('❌ Query execution error:', error);
    throw error;
  }
}

/**
 * Execute a stored procedure
 */
export async function executeProcedure<T = unknown>(
  procedureName: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  const startTime = Date.now();
  try {
    const pool = await getPool();
    const request = pool.request();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    const result = await request.execute<T>(procedureName);
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'procedure');
    return result;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'procedure');
    recordDbError('procedure');
    console.error('❌ Procedure execution error:', error);
    throw error;
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      console.log('✅ Database connection pool closed');
    } catch (error) {
      console.error('❌ Error closing pool:', error);
      throw error;
    }
  }
}

export default {
  getPool,
  executeQuery,
  executeProcedure,
  closePool,
};

