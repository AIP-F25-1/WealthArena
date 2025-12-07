/**
 * Authentication Routes
 * User signup, login, and profile management
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { executeQuery, executeProcedure } from '../config/db';
import { generateToken } from '../middleware/auth';
import { successResponse, errorResponse, badRequestResponse } from '../utils/responses';

const router = express.Router();

// Type definitions for database results
interface UserRecord {
  UserID: number;
  Email: string;
  Username: string;
  PasswordHash?: string;
  IsActive: boolean;
  DisplayName?: string;
  Tier?: string;
  TotalXP?: number;
  CurrentLevel?: number;
  AvatarURL?: string;
  AvatarType?: string;
  AvatarVariant?: string;
}

interface ProfileRecord {
  DisplayName?: string;
  Tier: string;
  TotalXP: number;
  CurrentLevel?: number;
}

/**
 * POST /api/auth/signup
 * Create new user account
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username, firstName, lastName, displayName, full_name } = req.body;

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
    const existingUser = await executeQuery(
      'SELECT UserID FROM Users WHERE Email = @email OR Username = @username',
      { email, username }
    );

    if (existingUser.recordset.length > 0) {
      return badRequestResponse(res, 'Email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await executeProcedure('sp_CreateUser', {
      Email: email,
      PasswordHash: passwordHash,
      Username: username,
      FirstName: parsedFirstName,
      LastName: parsedLastName,
      DisplayName: displayName || username,
    });

    const userId = (result.recordset[0] as UserRecord).UserID;

    // Get user profile data
    const userProfile = await executeQuery(
      `SELECT up.DisplayName, up.Tier, up.TotalXP, up.CurrentLevel 
       FROM UserProfiles up WHERE up.UserID = @userId`,
      { userId }
    );

    const profile = userProfile.recordset[0] as ProfileRecord;

    // Generate token
    const token = generateToken(userId, email);

    return successResponse(
      res,
      {
        token,
        user: {
          user_id: userId,
          username,
          email,
          full_name: full_name || `${parsedFirstName} ${parsedLastName}`.trim(),
          tier_level: profile.Tier,
          xp_points: profile.TotalXP,
          total_balance: 100000, // Default starting balance
        },
      },
      'User created successfully',
      201
    );
  } catch (error) {
    return errorResponse(res, 'Failed to create user', 500, error);
  }
});

/**
 * POST /api/auth/google
 * Google OAuth login
 */
router.post('/google', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return badRequestResponse(res, 'Google access token is required');
    }

    // Verify Google access token and get user info
    // Note: In production, use google-auth-library to verify token
    // For demo, we'll accept token and fetch user info from Google API
    try {
      const googleResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
      
      if (!googleResponse.ok) {
        return errorResponse(res, 'Invalid Google token', 401);
      }

      const googleUser = await googleResponse.json() as { email?: string; name?: string; picture?: string };
      const { email, name, picture } = googleUser;

      if (!email) {
        return badRequestResponse(res, 'Email not provided by Google');
      }

      // Find or create user
      const existingUser = await executeQuery(
        `SELECT u.UserID, u.Email, u.Username, u.IsActive,
                up.DisplayName, up.Tier, up.TotalXP, up.CurrentLevel, up.AvatarURL, up.AvatarType, up.AvatarVariant
         FROM Users u
         INNER JOIN UserProfiles up ON u.UserID = up.UserID
         WHERE u.Email = @email`,
        { email }
      );

      let user;
      let userId;

      if (existingUser.recordset.length > 0) {
        // User exists, update last login
        user = existingUser.recordset[0] as UserRecord;
        userId = user.UserID;

        await executeQuery(
          'UPDATE Users SET LastLogin = GETUTCDATE() WHERE UserID = @userId',
          { userId }
        );

        // Update avatar URL if Google picture is different
        if (picture && picture !== user.AvatarURL) {
          await executeQuery(
            'UPDATE UserProfiles SET AvatarURL = @avatarUrl, AvatarType = @avatarType, UpdatedAt = GETUTCDATE() WHERE UserID = @userId',
            { userId, avatarUrl: picture, avatarType: 'custom' }
          );
        }
      } else {
        // Create new user
        const nameParts = name ? name.trim().split(' ') : [''];
        const firstName = nameParts[0] || email.split('@')[0];
        const lastName = nameParts.slice(1).join(' ') || '';
        const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

        // Generate random password hash (user won't use it for Google login)
        const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);

        const result = await executeProcedure('sp_CreateUser', {
          Email: email,
          PasswordHash: passwordHash,
          Username: username,
          FirstName: firstName,
          LastName: lastName,
          DisplayName: name || username,
        });

        userId = (result.recordset[0] as UserRecord).UserID;

        // Update avatar and type
        if (picture) {
          await executeQuery(
            'UPDATE UserProfiles SET AvatarURL = @avatarUrl, AvatarType = @avatarType, UpdatedAt = GETUTCDATE() WHERE UserID = @userId',
            { userId, avatarUrl: picture, avatarType: 'custom' }
          );
        }

        // Get created user profile
        const newUserQuery = await executeQuery(
          `SELECT u.UserID, u.Email, u.Username,
                  up.DisplayName, up.Tier, up.TotalXP, up.CurrentLevel, up.AvatarURL, up.AvatarType, up.AvatarVariant
           FROM Users u
           INNER JOIN UserProfiles up ON u.UserID = up.UserID
           WHERE u.UserID = @userId`,
          { userId }
        );

        user = newUserQuery.recordset[0] as UserRecord;
      }

      // Generate token
      const token = generateToken(userId, email);

      return successResponse(res, {
        token,
        user: {
          user_id: user.UserID,
          username: user.Username,
          email: user.Email,
          full_name: user.DisplayName || name || email,
          tier_level: user.Tier,
          xp_points: user.TotalXP,
          total_balance: 100000,
          avatar_url: user.AvatarURL || picture,
          avatar_type: user.AvatarType || 'custom',
        },
      }, 'Google login successful');
    } catch (googleError: unknown) {
      const errorMessage = googleError instanceof Error ? googleError.message : String(googleError);
      // eslint-disable-next-line no-console
      console.error('Google API error:', errorMessage);
      return errorResponse(res, 'Failed to verify Google token', 503, googleError);
    }
  } catch (error) {
    return errorResponse(res, 'Google login failed', 500, error);
  }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return badRequestResponse(res, 'Email and password are required');
    }

    // Get user
    const result = await executeQuery(
      `SELECT u.UserID, u.Email, u.Username, u.PasswordHash, u.IsActive,
              up.DisplayName, up.Tier, up.TotalXP, up.CurrentLevel
       FROM Users u
       INNER JOIN UserProfiles up ON u.UserID = up.UserID
       WHERE u.Email = @email OR u.Username = @email`,
      { email }
    );

    if (result.recordset.length === 0) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const user = result.recordset[0] as UserRecord;

    if (!user.IsActive) {
      return errorResponse(res, 'Account is inactive', 401);
    }

    // Verify password
    if (!user.PasswordHash) {
      return errorResponse(res, 'Invalid credentials', 401);
    }
    const isValidPassword = await bcrypt.compare(password, user.PasswordHash);

    if (!isValidPassword) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Update last login
    await executeQuery(
      'UPDATE Users SET LastLogin = GETUTCDATE() WHERE UserID = @userId',
      { userId: user.UserID }
    );

    // Generate token
    const token = generateToken(user.UserID, user.Email);

    return successResponse(res, {
      token,
      user: {
        user_id: user.UserID,
        username: user.Username,
        email: user.Email,
        full_name: user.DisplayName,
        tier_level: user.Tier,
        xp_points: user.TotalXP,
        total_balance: 100000, // This should be fetched from portfolio in production
      },
    });
  } catch (error) {
    return errorResponse(res, 'Login failed', 500, error);
  }
});

export default router;

