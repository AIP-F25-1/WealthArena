/**
 * Database Module Index
 * Re-exports database functions based on DB_TYPE environment variable
 * Supports both SQL Server and PostgreSQL implementations
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import sql from 'mssql';

dotenv.config();

// Normalize DB_TYPE to canonical values
// Accepts: 'postgres', 'postgresql', 'pg' -> maps to 'postgres'
// Everything else -> maps to 'sqlserver'
function normalizeDbType(dbType: string | undefined): 'postgres' | 'sqlserver' {
  if (!dbType) {
    return 'sqlserver';
  }
  const normalized = dbType.toLowerCase().trim();
  if (normalized === 'postgres' || normalized === 'postgresql' || normalized === 'pg') {
    return 'postgres';
  }
  return 'sqlserver';
}

// Conditionally import based on DB_TYPE
const dbType = normalizeDbType(process.env.DB_TYPE);

// Common return type for both database implementations
export type QueryResult<T = unknown> = 
  | sql.IResult<T> 
  | { recordset: T[]; rowsAffected: number[] };

interface DatabaseModule {
  getPool: () => Promise<Pool | sql.ConnectionPool>;
  executeQuery: <T = unknown>(query: string, params?: Record<string, unknown>) => Promise<QueryResult<T>>;
  executeProcedure: <T = unknown>(procedureName: string, params?: Record<string, unknown>) => Promise<QueryResult<T>>;
  closePool: () => Promise<void>;
  executeTransaction?: (queries: Array<{ query: string; params?: unknown[] }>) => Promise<unknown>;
  isGCPDeployment?: () => boolean;
  isMockMode?: () => boolean;
}

let dbModule: DatabaseModule;

if (dbType === 'postgres') {
  dbModule = require('./database-postgres');
} else {
  dbModule = require('./database');
}

// Re-export all database functions
export const getPool = dbModule.getPool;
export const executeQuery = dbModule.executeQuery;
export const executeProcedure = dbModule.executeProcedure;
export const closePool = dbModule.closePool;

// Export optional functions if available
export const executeTransaction = dbModule.executeTransaction;
export const isGCPDeployment = dbModule.isGCPDeployment;
export const isMockMode = dbModule.isMockMode || (() => process.env.USE_MOCK_DB === 'true');

export default dbModule;

