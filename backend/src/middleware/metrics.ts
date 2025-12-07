/**
 * Prometheus Metrics Middleware
 * Collects HTTP and database metrics for monitoring
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create a metrics registry
export const register = new Registry();

// Collect default Node.js process metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

// HTTP Metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const httpRequestsInProgress = new Gauge({
  name: 'http_requests_in_progress',
  help: 'Number of HTTP requests currently in progress',
  registers: [register],
});

// Database Metrics
export const dbQueryDurationSeconds = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const dbQueryErrorsTotal = new Counter({
  name: 'db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['query_type'],
  registers: [register],
});

/**
 * Middleware to instrument HTTP requests
 */
/**
 * Sanitize route path to reduce cardinality
 * Replaces UUIDs and IDs with placeholders
 */
function sanitizeRoute(route: string): string {
  if (!route) return 'unknown';
  
  // Replace UUIDs (8-4-4-4-12 format)
  route = route.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
  
  // Replace numeric IDs
  route = route.replace(/\/\d+/g, '/:id');
  
  // Replace long alphanumeric IDs
  route = route.replace(/\/[a-z0-9]{20,}/gi, '/:id');
  
  return route;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  // Use matched route pattern if available, otherwise sanitize the path
  const route = req.route?.path || sanitizeRoute(req.path) || 'unknown';
  const method = req.method;

  // Increment in-progress requests
  httpRequestsInProgress.inc();

  // Track response finish
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, duration);
    httpRequestsInProgress.dec();
  });

  next();
}

/**
 * Record database query duration
 */
export function recordDbQuery(duration: number, queryType: 'query' | 'procedure' | 'transaction'): void {
  dbQueryDurationSeconds.observe({ query_type: queryType }, duration);
}

/**
 * Record database query error
 */
export function recordDbError(queryType: 'query' | 'procedure' | 'transaction'): void {
  dbQueryErrorsTotal.inc({ query_type: queryType });
}

