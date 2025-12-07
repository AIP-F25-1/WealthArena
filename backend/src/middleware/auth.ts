/**
 * Authentication Middleware
 * JWT Token Verification
 */

import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
}

/**
 * Verify JWT token middleware
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }
    const decoded = jwt.verify(token, secret) as {
      userId?: number;
      user_id?: number; // Support alternative field name
      email?: string;
    };

    // Extract userId - support both userId and user_id field names
    const userId = decoded.userId || decoded.user_id;
    
    if (!userId || typeof userId !== 'number') {
      console.error('JWT token missing or invalid userId:', {
        decoded,
        hasUserId: !!decoded.userId,
        hasUser_id: !!decoded.user_id,
        userIdType: typeof userId
      });
      return res.status(403).json({
        success: false,
        message: 'Invalid token: missing user ID',
      });
    }

    req.userId = userId;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (userId: number, email: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(
    { userId, email },
    secret,
    { expiresIn: '7d' }
  );
};

