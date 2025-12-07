/**
 * Authentication Routes - Mock Mode
 * Works without database connection for testing
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth';
import { successResponse, errorResponse, badRequestResponse } from '../utils/responses';
import mockDatabase from '../config/mock-database';

const router = express.Router();

/**
 * POST /api/auth/signup
 * Create new user account (Mock Mode)
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username, firstName, lastName, displayName, full_name } = req.body;

    console.log('📝 Signup request:', { email, username, firstName, lastName, full_name });

    // Validation
    if (!email || !password || !username) {
      return badRequestResponse(res, 'Email, password, and username are required');
    }

    // Parse full_name if provided (for frontend compatibility)
    let parsedFirstName = firstName;
    let parsedLastName = lastName;
    
    if (!parsedFirstName && full_name) {
      const nameParts = full_name.trim().split(' ');
      parsedFirstName = nameParts[0] || '';
      parsedLastName = nameParts.slice(1).join(' ') || '';
    }

    // Check if user exists
    const userExists = await mockDatabase.userExists(email, username);
    
    if (userExists) {
      return badRequestResponse(res, 'Email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await mockDatabase.createUser({
      Email: email,
      PasswordHash: passwordHash,
      Username: username,
      FirstName: parsedFirstName,
      LastName: parsedLastName,
      DisplayName: displayName || full_name || username,
    });

    const userId = result.UserID;

    // Generate token
    const token = generateToken(userId, email);

    console.log('✅ User created successfully:', username);

    return successResponse(
      res,
      {
        token,
        user: {
          user_id: userId,
          email,
          username,
          firstName: parsedFirstName,
          lastName: parsedLastName,
          full_name: full_name || `${parsedFirstName} ${parsedLastName}`.trim() || username,
          tier_level: 'Bronze',
          xp_points: 0,
          total_balance: 10000, // Starting balance
        },
      },
      'User created successfully',
      201
    );
  } catch (error) {
    console.error('❌ Signup error:', error);
    return errorResponse(res, 'Failed to create user', 500, error);
  }
});

/**
 * POST /api/auth/login
 * User login (Mock Mode)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login request:', email);

    if (!email || !password) {
      return badRequestResponse(res, 'Email and password are required');
    }

    // Get user
    const user = await mockDatabase.findUser(email);

    if (!user) {
      console.log('❌ User not found:', email);
      return errorResponse(res, 'Invalid credentials', 401);
    }

    if (!user.IsActive) {
      return errorResponse(res, 'Account is inactive', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.PasswordHash);

    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Generate token
    const token = generateToken(user.UserID, user.Email);

    console.log('✅ Login successful:', user.Username);

    return successResponse(res, {
      token,
      user: {
        user_id: user.UserID,
        email: user.Email,
        username: user.Username,
        firstName: user.FirstName,
        lastName: user.LastName,
        full_name: user.FirstName && user.LastName 
          ? `${user.FirstName} ${user.LastName}`.trim()
          : user.DisplayName || user.Username,
        tier_level: user.Tier,
        xp_points: user.TotalXP,
        total_balance: 10000,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    return errorResponse(res, 'Login failed', 500, error);
  }
});

export default router;

