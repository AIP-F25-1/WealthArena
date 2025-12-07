/**
 * Database Connection Configuration
 * PostgreSQL Connection Pool for GCP Cloud SQL
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import { recordDbQuery, recordDbError } from '../middleware/metrics';

dotenv.config();

let pool: Pool | null = null;

/**
 * Check if running on GCP (using Unix socket)
 */
function isGCP(): boolean {
  return process.env.DB_HOST?.startsWith('/cloudsql/') ?? false;
}

/**
 * Get database connection pool
 */
export async function getPool(): Promise<Pool> {
  if (!pool) {
    try {
      const isUnixSocket = isGCP();
      
      const config = isUnixSocket
        ? {
            // Unix socket connection (GCP App Engine)
            host: process.env.DB_HOST, // /cloudsql/wealtharena-prod:us-central1:wealtharena-db
            database: process.env.DB_NAME || 'wealtharena_db',
            user: process.env.DB_USER || '',
            password: process.env.DB_PASSWORD || '',
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 30000,
          }
        : {
            // TCP connection (local development)
            host: process.env.DB_HOST || 'localhost',
            port: Number.parseInt(process.env.DB_PORT || '5432', 10),
            database: process.env.DB_NAME || 'wealtharena_db',
            user: process.env.DB_USER || '',
            password: process.env.DB_PASSWORD || '',
            ssl: process.env.DB_ENCRYPT === 'true' ? { rejectUnauthorized: false } : false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 30000,
          };

      pool = new Pool(config);
      
      pool.on('error', (err) => {
        console.error('ERROR: Database pool error:', err);
        pool = null;
      });
      
      // Validate password is not a placeholder
      const password = process.env.DB_PASSWORD || '';
      if (password === 'your-postgres-password' || password === 'your-sql-password' || !password) {
        console.warn('WARNING: DB_PASSWORD appears to be a placeholder. Database connection may fail.');
        console.warn('Please update backend/.env.local with your actual PostgreSQL password.');
      }
      
      // Verify connectivity with a test query before logging success
      await pool.query('SELECT 1');
      console.log('Connected to PostgreSQL Database');
    } catch (error) {
      console.error('ERROR: Failed to connect to database:', error);
      throw error;
    }
  }
  return pool;
}

/**
 * Execute a query with parameters
 * Returns results in compatible format with mssql library
 * Supports both SQL Server (@paramName) and PostgreSQL ($1) parameter syntax
 */
export async function executeQuery<T extends QueryResultRow = any>(
  query: string,
  params?: Record<string, any> | any[]
): Promise<{ recordset: T[]; rowsAffected: number[] }> {
  const startTime = Date.now();
  try {
    const pool = await getPool();
    
    // Convert SQL Server parameter syntax (@paramName) to PostgreSQL ($1, $2, ...)
    let postgresQuery = query;
    let paramValues: any[] = [];
    
    if (params) {
      if (Array.isArray(params)) {
        // Already in positional format
        paramValues = params;
      } else {
        // Convert named parameters to positional
        const paramEntries = Object.entries(params);
        paramValues = paramEntries.map(([_, value]) => value);
        
        // Replace @paramName with $1, $2, etc.
        for (let index = 0; index < paramEntries.length; index++) {
          const [key] = paramEntries[index];
          const regex = new RegExp(String.raw`@${key}\b`, 'g');
          postgresQuery = postgresQuery.replace(regex, `$${index + 1}`);
        }
      }
    }
    
    const result: QueryResult<T> = await pool.query<T>(postgresQuery, paramValues);
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'query');
    
    return {
      recordset: result.rows,
      rowsAffected: [result.rowCount || 0],
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'query');
    recordDbError('query');
    console.error('ERROR: Query execution error:', error);
    throw error;
  }
}

/**
 * Execute a stored procedure (PostgreSQL function)
 * Supports both named (Record) and positional (array) parameters
 */
export async function executeProcedure<T extends QueryResultRow = any>(
  procedureName: string,
  params?: Record<string, any> | any[]
): Promise<{ recordset: T[]; rowsAffected: number[] }> {
  const startTime = Date.now();
  try {
    const pool = await getPool();
    
    let paramValues: any[] = [];
    
    if (params) {
      if (Array.isArray(params)) {
        paramValues = params;
      } else {
        // Convert named parameters to positional array
        paramValues = Object.values(params);
      }
    }
    
    // Build function call query with positional parameters
    const paramPlaceholders = paramValues.map((_, i) => `$${i + 1}`).join(', ');
    const query = `SELECT * FROM ${procedureName}(${paramPlaceholders})`;
    
    const result: QueryResult<T> = await pool.query<T>(query, paramValues);
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'procedure');
    
    return {
      recordset: result.rows,
      rowsAffected: [result.rowCount || 0],
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'procedure');
    recordDbError('procedure');
    console.error('ERROR: Procedure execution error:', error);
    throw error;
  }
}

/**
 * Execute a transaction with multiple queries
 */
export async function executeTransaction(
  queries: Array<{ query: string; params?: any[] }>
): Promise<void> {
  const startTime = Date.now();
  const pool = await getPool();
  const client: PoolClient = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const { query, params } of queries) {
      await client.query(query, params);
    }
    
    await client.query('COMMIT');
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'transaction');
  } catch (error) {
    await client.query('ROLLBACK');
    const duration = (Date.now() - startTime) / 1000;
    recordDbQuery(duration, 'transaction');
    recordDbError('transaction');
    console.error('ERROR: Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('Database connection pool closed');
    } catch (error) {
      console.error('ERROR: Error closing pool:', error);
      throw error;
    }
  }
}

/**
 * Check if running on GCP
 */
export function isGCPDeployment(): boolean {
  return isGCP();
}

export default {
  getPool,
  executeQuery,
  executeProcedure,
  executeTransaction,
  closePool,
  isGCPDeployment,
};

