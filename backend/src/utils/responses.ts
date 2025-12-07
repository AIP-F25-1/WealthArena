/**
 * Standard API Response Utilities
 */

import { Response } from 'express';

export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export const successResponse = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message: string,
  statusCode: number = 500,
  error?: unknown
) => {
  let errorMessage: string | undefined;
  if (error !== undefined && error !== null) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  
  if (process.env.NODE_ENV === 'development' && errorMessage) {
    // eslint-disable-next-line no-console
    console.error('Error:', message, errorMessage);
  } else if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.error('Error:', message);
  }
  
  return res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
  });
};

export const notFoundResponse = (res: Response, resource: string = 'Resource') => {
  return errorResponse(res, `${resource} not found`, 404);
};

export const unauthorizedResponse = (res: Response, message: string = 'Unauthorized') => {
  return errorResponse(res, message, 401);
};

export const badRequestResponse = (res: Response, message: string) => {
  return errorResponse(res, message, 400);
};

