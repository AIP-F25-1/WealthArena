/**
 * User Profile Routes
 * User profile, XP, achievements, and leaderboard
 */

import express from 'express';
import { executeQuery, executeProcedure, isMockMode } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';
import mockDatabase from '../config/mock-database';

const router = express.Router();

/**
 * GET /api/user/profile
 * Get user profile and dashboard data
 */
router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    if (!userId || typeof userId !== 'number') {
      console.error('Profile request with invalid userId:', {
        userId,
        userIdType: typeof userId,
        hasUserId: 'userId' in req,
        authHeader: req.headers['authorization'] ? 'present' : 'missing'
      });
      return errorResponse(res, `User ID not found in token (received: ${userId})`, 401);
    }

    // Handle mock mode - return actual user data from mock database
    if (isMockMode()) {
      const mockUser = await mockDatabase.getUserById(userId);
      
      if (!mockUser) {
        console.warn(`User not found in mock database: userId=${userId}`);
        return errorResponse(res, `User not found (ID: ${userId})`, 404);
      }

      const mockProfile = {
        user_id: mockUser.UserID,
        username: mockUser.Username,
        email: mockUser.Email,
        firstName: mockUser.FirstName || null,
        lastName: mockUser.LastName || null,
        full_name: mockUser.FirstName && mockUser.LastName
          ? `${mockUser.FirstName} ${mockUser.LastName}`.trim()
          : mockUser.DisplayName || mockUser.Username,
        displayName: mockUser.DisplayName || mockUser.Username,
        tier_level: mockUser.Tier || 'Bronze',
        xp_points: mockUser.TotalXP || 0,
        current_level: mockUser.CurrentLevel || 1,
        total_coins: 0,
        win_rate: 0,
        total_trades: 0,
        current_streak: 0,
        avatar_url: null,
        avatar_type: 'mascot',
        avatar_variant: 'excited',
        bio: null,
        total_balance: 100000
      };
      return successResponse(res, mockProfile);
    }

    const query = `
      SELECT 
        u.UserID as user_id,
        u.Username as username,
        u.Email as email,
        u.FirstName as firstName,
        u.LastName as lastName,
        CONCAT(u.FirstName, ' ', u.LastName) as full_name,
        up.DisplayName as displayName,
        up.Tier as tier_level,
        up.TotalXP as xp_points,
        up.CurrentLevel as current_level,
        up.TotalCoins as total_coins,
        up.WinRate as win_rate,
        up.TotalTrades as total_trades,
        up.CurrentStreak as current_streak,
        up.AvatarURL as avatar_url,
        up.AvatarType as avatar_type,
        up.AvatarVariant as avatar_variant,
        up.Bio as bio,
        100000 as total_balance
      FROM Users u
      INNER JOIN UserProfiles up ON u.UserID = up.UserID
      WHERE u.UserID = @userId
    `;

    const result = await executeQuery(query, { userId });

    if (result.recordset.length === 0) {
      console.warn(`User not found in database: userId=${userId}`);
      return errorResponse(res, `User not found (ID: ${userId})`, 404);
    }

    return successResponse(res, result.recordset[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch user profile', 500, error);
  }
});

/**
 * POST /api/user/upload-avatar
 * Upload custom avatar image
 */
router.post('/upload-avatar', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { imageData, encoding } = req.body;

    if (!imageData) {
      return errorResponse(res, 'Image data is required', 400);
    }

    // For base64 encoding (demo approach)
    if (encoding === 'base64') {
      // Store base64 directly in database for demo
      // In production, upload to Azure Storage Blob and store URL
      
      // Validate base64 format
      if (!imageData.startsWith('data:image/')) {
        return errorResponse(res, 'Invalid image format. Expected base64 data URL', 400);
      }

      // Validate size (max 5MB)
      const base64Size = imageData.length;
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (base64Size > maxSize) {
        return errorResponse(res, 'Image too large. Maximum size is 5MB', 413);
      }

      // Update user profile with base64 image
      await executeQuery(
        `UPDATE UserProfiles 
         SET avatar_url = @avatarUrl, 
             avatar_type = 'custom',
             avatar_variant = NULL,
             UpdatedAt = GETUTCDATE()
         WHERE UserID = @userId`,
        { userId, avatarUrl: imageData }
      );

      // Return updated profile
      const updatedProfile = await executeQuery(
        `SELECT up.AvatarURL as avatar_url, up.AvatarType as avatar_type
         FROM UserProfiles up
         WHERE up.UserID = @userId`,
        { userId }
      );

      return successResponse(res, updatedProfile.recordset[0], 'Avatar uploaded successfully');
    } else {
      // For multipart/form-data (production approach)
      // This would require multer middleware
      return errorResponse(res, 'Multipart upload not yet implemented. Use base64 encoding.', 501);
    }
  } catch (error) {
    return errorResponse(res, 'Failed to upload avatar', 500, error);
  }
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { firstName, lastName, username, displayName, bio, avatarUrl, avatar_type, avatar_variant } = req.body;

    // Update Users table
    if (firstName || lastName || username) {
      const updateFields = [];
      const params: any = { userId };

      if (firstName) {
        updateFields.push('FirstName = @firstName');
        params.firstName = firstName;
      }
      if (lastName) {
        updateFields.push('LastName = @lastName');
        params.lastName = lastName;
      }
      if (username) {
        // Check if username is already taken
        const existingUser = await executeQuery(
          'SELECT UserID FROM Users WHERE Username = @username AND UserID != @userId',
          { username, userId }
        );
        
        if (existingUser.recordset.length > 0) {
          return errorResponse(res, 'Username already taken', 400);
        }
        
        updateFields.push('Username = @username');
        params.username = username;
      }

      if (updateFields.length > 0) {
        const query = `UPDATE Users SET ${updateFields.join(', ')}, UpdatedAt = GETUTCDATE() WHERE UserID = @userId`;
        await executeQuery(query, params);
      }
    }

    // Update UserProfiles table
    if (displayName || bio !== undefined || avatarUrl !== undefined || avatar_type !== undefined || avatar_variant !== undefined) {
      const updateFields = [];
      const params: any = { userId };

      if (displayName) {
        updateFields.push('DisplayName = @displayName');
        params.displayName = displayName;
      }
      if (bio !== undefined) {
        updateFields.push('Bio = @bio');
        params.bio = bio;
      }
      if (avatarUrl !== undefined) {
        updateFields.push('AvatarURL = @avatarUrl');
        params.avatarUrl = avatarUrl;
      }
      if (avatar_type !== undefined) {
        updateFields.push('AvatarType = @avatarType');
        params.avatarType = avatar_type;
      }
      if (avatar_variant !== undefined) {
        updateFields.push('AvatarVariant = @avatarVariant');
        params.avatarVariant = avatar_variant;
      }

      if (updateFields.length > 0) {
        const query = `UPDATE UserProfiles SET ${updateFields.join(', ')}, UpdatedAt = GETUTCDATE() WHERE UserID = @userId`;
        await executeQuery(query, params);
      }
    }

    // Return updated profile
    const updatedProfile = await executeQuery(
      `SELECT 
        u.UserID as user_id,
        u.Username as username,
        u.Email as email,
        u.FirstName as firstName,
        u.LastName as lastName,
        CONCAT(u.FirstName, ' ', u.LastName) as full_name,
        up.DisplayName as displayName,
        up.Tier as tier_level,
        up.TotalXP as xp_points,
        up.AvatarURL as avatar_url,
        up.AvatarType as avatar_type,
        up.AvatarVariant as avatar_variant,
        up.Bio as bio
      FROM Users u
      INNER JOIN UserProfiles up ON u.UserID = up.UserID
      WHERE u.UserID = @userId`,
      { userId }
    );

    return successResponse(res, updatedProfile.recordset[0], 'Profile updated successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to update profile', 500, error);
  }
});

/**
 * POST /api/user/xp
 * Award XP to user
 */
router.post('/xp', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { xpAmount } = req.body;

    if (!xpAmount || xpAmount <= 0) {
      return errorResponse(res, 'Invalid XP amount', 400);
    }

    const result = await executeProcedure('sp_UpdateUserXP', {
      UserID: userId,
      XPToAdd: xpAmount,
    });

    return successResponse(res, result.recordset[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to award XP', 500, error);
  }
});

/**
 * POST /api/user/coins
 * Award coins to user
 */
router.post('/coins', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { coinAmount } = req.body;

    if (!coinAmount || coinAmount <= 0) {
      return errorResponse(res, 'Invalid coin amount', 400);
    }

    const result = await executeProcedure('sp_UpdateUserCoins', {
      UserID: userId,
      CoinsToAdd: coinAmount,
    });

    return successResponse(res, result.recordset[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to award coins', 500, error);
  }
});

/**
 * GET /api/user/achievements
 * Get user's achievements
 */
router.get('/achievements', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT a.*, ua.UnlockedAt
      FROM UserAchievements ua
      INNER JOIN Achievements a ON ua.AchievementID = a.AchievementID
      WHERE ua.UserID = @userId
      ORDER BY ua.UnlockedAt DESC
    `;

    const result = await executeQuery(query, { userId });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch achievements', 500, error);
  }
});

/**
 * POST /api/user/achievements/unlock
 * Unlock achievement for user
 */
router.post('/achievements/unlock', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { achievementId } = req.body;

    if (!achievementId) {
      return errorResponse(res, 'Achievement ID is required', 400);
    }

    // Check if achievement is already unlocked
    const existingAchievement = await executeQuery(
      'SELECT * FROM UserAchievements WHERE UserID = @userId AND AchievementID = @achievementId',
      { userId, achievementId }
    );

    if (existingAchievement.recordset.length > 0) {
      return errorResponse(res, 'Achievement already unlocked', 400);
    }

    // Get achievement details
    const achievementQuery = `
      SELECT * FROM Achievements WHERE AchievementID = @achievementId
    `;
    const achievementResult = await executeQuery(achievementQuery, { achievementId });

    if (achievementResult.recordset.length === 0) {
      return errorResponse(res, 'Achievement not found', 404);
    }

    const achievement = achievementResult.recordset[0] as { XPReward?: number; CoinReward?: number; [key: string]: any };

    // Unlock achievement
    await executeQuery(
      'INSERT INTO UserAchievements (UserID, AchievementID, UnlockedAt) VALUES (@userId, @achievementId, GETUTCDATE())',
      { userId, achievementId }
    );

    // Award XP and coins if specified
    if (achievement.XPReward && achievement.XPReward > 0) {
      await executeProcedure('sp_UpdateUserXP', {
        UserID: userId,
        XPToAdd: achievement.XPReward,
      });
    }

    if (achievement.CoinReward && achievement.CoinReward > 0) {
      await executeProcedure('sp_UpdateUserCoins', {
        UserID: userId,
        CoinsToAdd: achievement.CoinReward,
      });
    }

    return successResponse(res, {
      achievement,
      message: 'Achievement unlocked successfully',
    });
  } catch (error) {
    return errorResponse(res, 'Failed to unlock achievement', 500, error);
  }
});

/**
 * GET /api/user/quests
 * Get user's active quests
 */
router.get('/quests', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT q.*, uq.CurrentProgress, uq.IsCompleted
      FROM UserQuests uq
      INNER JOIN Quests q ON uq.QuestID = q.QuestID
      WHERE uq.UserID = @userId AND uq.IsCompleted = 0
      ORDER BY q.QuestType, q.Title
    `;

    const result = await executeQuery(query, { userId });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch quests', 500, error);
  }
});

/**
 * POST /api/user/quest/:questId/complete
 * Complete a quest for user
 */
router.post('/quest/:questId/complete', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { questId } = req.params;

    // Get quest details
    const questQuery = `
      SELECT q.*, uq.CurrentProgress, uq.IsCompleted
      FROM Quests q
      LEFT JOIN UserQuests uq ON q.QuestID = uq.QuestID AND uq.UserID = @userId
      WHERE q.QuestID = @questId
    `;
    const questResult = await executeQuery(questQuery, { userId, questId });

    if (questResult.recordset.length === 0) {
      return errorResponse(res, 'Quest not found', 404);
    }

    const quest = questResult.recordset[0] as {
      IsCompleted?: number;
      CurrentProgress?: number;
      TargetValue?: number;
      XPReward?: number;
      CoinReward?: number;
      [key: string]: any;
    };

    if (quest.IsCompleted) {
      return errorResponse(res, 'Quest already completed', 400);
    }

    if ((quest.CurrentProgress || 0) < (quest.TargetValue || 0)) {
      return errorResponse(res, 'Quest not yet completed', 400);
    }

    // Mark quest as completed
    await executeQuery(
      'UPDATE UserQuests SET IsCompleted = 1, CompletedAt = GETUTCDATE() WHERE UserID = @userId AND QuestID = @questId',
      { userId, questId }
    );

    // Award XP and coins
    if (quest.XPReward && quest.XPReward > 0) {
      await executeProcedure('sp_UpdateUserXP', {
        UserID: userId,
        XPToAdd: quest.XPReward,
      });
    }

    if (quest.CoinReward && quest.CoinReward > 0) {
      await executeProcedure('sp_UpdateUserCoins', {
        UserID: userId,
        CoinsToAdd: quest.CoinReward,
      });
    }

    return successResponse(res, {
      quest,
      message: 'Quest completed successfully',
      rewards: {
        xp: quest.XPReward || 0,
        coins: quest.CoinReward || 0,
      },
    });
  } catch (error) {
    return errorResponse(res, 'Failed to complete quest', 500, error);
  }
});

/**
 * GET /api/user/leaderboard
 * Get leaderboard
 */
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit as string, 10) || 100;

    const query = `
      SELECT TOP (@limit) * FROM vw_Leaderboard
    `;

    const result = await executeQuery(query, { limit });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch leaderboard', 500, error);
  }
});

/**
 * POST /api/user/complete-onboarding
 * Complete onboarding and save user profile with AI-generated data
 */
router.post('/complete-onboarding', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      userProfile,
      selectedAvatar,
    } = req.body;

    if (!userProfile) {
      return errorResponse(res, 'User profile data is required', 400);
    }

    // Check if onboarding already completed (idempotency check)
    const checkQuery = `
      SELECT HasCompletedOnboarding 
      FROM UserProfiles 
      WHERE UserID = @userId
    `;
    const checkResult = await executeQuery(checkQuery, { userId });
    
    if (checkResult.recordset.length > 0 && (checkResult.recordset[0] as { HasCompletedOnboarding?: number }).HasCompletedOnboarding === 1) {
      // Already completed - return current state
      const profileQuery = `
        SELECT 
          u.UserID as user_id,
          u.Username as username,
          u.Email as email,
          u.FirstName as firstName,
          u.LastName as lastName,
          CONCAT(u.FirstName, ' ', u.LastName) as full_name,
          up.DisplayName as displayName,
          up.Tier as tier_level,
          up.TotalXP as xp_points,
          up.CurrentLevel as current_level,
          up.TotalCoins as total_coins,
          up.WinRate as win_rate,
          up.TotalTrades as total_trades,
          up.CurrentStreak as current_streak,
          up.AvatarURL as avatar_url,
          up.AvatarType as avatar_type,
          up.AvatarVariant as avatar_variant,
          up.Bio as bio,
          100000 as total_balance
        FROM Users u
        INNER JOIN UserProfiles up ON u.UserID = up.UserID
        WHERE u.UserID = @userId
      `;
      const result = await executeQuery(profileQuery, { userId });
      return successResponse(res, {
        user: result.recordset[0],
        message: 'Onboarding already completed',
      });
    }

    // Calculate tier based on experience level
    let tier = 'beginner';
    if (userProfile.experienceLevel === 'intermediate') {
      tier = 'intermediate';
    } else if (userProfile.experienceLevel === 'advanced') {
      tier = 'advanced';
    }

    // Calculate risk profile
    const riskProfile = userProfile.riskTolerance || 'moderate';

    // Update user profile with AI-generated data (without hard-resetting XP/coins)
    const updateProfileQuery = `
      UPDATE UserProfiles 
      SET 
        Tier = @tier,
        RiskProfile = @riskProfile,
        InvestmentGoals = @investmentGoals,
        TimeHorizon = @timeHorizon,
        LearningStyle = @learningStyle,
        InterestAreas = @interestAreas,
        AvatarURL = @avatarUrl,
        AvatarType = @avatarType,
        AvatarVariant = @avatarVariant,
        HasCompletedOnboarding = 1,
        OnboardingCompletedAt = GETUTCDATE()
      WHERE UserID = @userId
    `;

    const profileParams = {
      userId,
      tier,
      riskProfile,
      investmentGoals: JSON.stringify(userProfile.investmentGoals || []),
      timeHorizon: userProfile.timeHorizon || 'medium',
      learningStyle: userProfile.learningStyle || 'structured',
      interestAreas: JSON.stringify(userProfile.interestAreas || []),
      avatarUrl: selectedAvatar?.url || null,
      avatarType: selectedAvatar?.type || 'mascot',
      avatarVariant: selectedAvatar?.variant || 'excited',
    };

    await executeQuery(updateProfileQuery, profileParams);

    // Increment XP and coins instead of hard-reset
    await executeProcedure('sp_UpdateUserXP', { 
      UserID: userId, 
      XPToAdd: 50 
    });
    await executeProcedure('sp_UpdateUserCoins', { 
      UserID: userId, 
      CoinsToAdd: 500 
    });

    // Create default portfolio based on risk profile
    // Check for existing active portfolio first (idempotency)
    const userIdStr = String(userId);
    
    // Check if portfolio already exists
    const existingPortfolioQuery = `
      SELECT portfolio_id 
      FROM portfolios 
      WHERE user_id = @userId AND is_active = 1
    `;
    const existingPortfolio = await executeQuery(existingPortfolioQuery, { userId: userIdStr });
    
    if (existingPortfolio.recordset.length === 0) {
      // No existing portfolio - create one
      const portfolioQuery = `
        INSERT INTO portfolios (user_id, portfolio_name, portfolio_type, initial_capital, current_value, cash_balance, total_invested, max_position_size, max_drawdown, risk_tolerance, is_active, created_at, updated_at)
        VALUES (@userId, @portfolioName, @portfolioType, @initialCapital, @currentValue, @cashBalance, @totalInvested, @maxPositionSize, @maxDrawdown, @riskTolerance, 1, GETUTCDATE(), GETUTCDATE())
      `;

      const portfolioParams = {
        userId: userIdStr,
        portfolioName: `${userProfile.firstName || 'User'}'s Portfolio`,
        portfolioType: 'paper',
        initialCapital: 10000, // Starting balance
        currentValue: 10000,
        cashBalance: 10000,
        totalInvested: 0,
        maxPositionSize: 25.0, // 25% max per position
        maxDrawdown: 10.0, // 10% max drawdown
        riskTolerance: riskProfile || 'moderate',
      };

      await executeQuery(portfolioQuery, portfolioParams);
    }
    // If portfolio exists, skip creation

    // Create welcome achievements
    const achievementQuery = `
      INSERT INTO UserAchievements (UserID, AchievementID, UnlockedAt)
      VALUES (@userId, 1, GETUTCDATE())
    `;

    await executeQuery(achievementQuery, { userId });

    // Create initial daily quests
    const questQuery = `
      INSERT INTO UserQuests (UserID, QuestID, AssignedAt)
      SELECT @userId, QuestID, GETUTCDATE()
      FROM Quests 
      WHERE QuestType = 'daily' AND IsActive = 1
    `;

    await executeQuery(questQuery, { userId });

    // Return updated user profile
    const profileQuery = `
      SELECT 
        u.UserID as user_id,
        u.Username as username,
        u.Email as email,
        u.FirstName as firstName,
        u.LastName as lastName,
        CONCAT(u.FirstName, ' ', u.LastName) as full_name,
        up.DisplayName as displayName,
        up.Tier as tier_level,
        up.TotalXP as xp_points,
        up.CurrentLevel as current_level,
        up.TotalCoins as total_coins,
        up.WinRate as win_rate,
        up.TotalTrades as total_trades,
        up.CurrentStreak as current_streak,
        up.AvatarURL as avatar_url,
        up.AvatarType as avatar_type,
        up.AvatarVariant as avatar_variant,
        up.Bio as bio,
        up.RiskProfile as risk_profile,
        up.InvestmentGoals as investment_goals,
        up.TimeHorizon as time_horizon,
        up.LearningStyle as learning_style,
        up.InterestAreas as interest_areas,
        100000 as total_balance
      FROM Users u
      INNER JOIN UserProfiles up ON u.UserID = up.UserID
      WHERE u.UserID = @userId
    `;

    const result = await executeQuery(profileQuery, { userId });

    return successResponse(res, {
      user: result.recordset[0],
      rewards: {
        xp: 50,
        coins: 500,
        achievements: ['Welcome to WealthArena!'],
      },
      message: 'Onboarding completed successfully!',
    });
  } catch (error) {
    return errorResponse(res, 'Failed to complete onboarding', 500, error);
  }
});

/**
 * GET /api/user/learning-progress
 * Get user's learning progress
 */
router.get('/learning-progress', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Get basic learning statistics from user profile
    // Note: LearningProgress table may not exist, so we return defaults with graceful degradation
    const result = {
      topicsCompleted: 0,
      lessonsCompleted: 0,
      learningXP: 0,
      streak: 0,
      lastLessonDate: null
    };

    return successResponse(res, result);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch learning progress', 500, error);
  }
});

/**
 * POST /api/user/complete-lesson
 * Complete a lesson and award XP
 */
router.post('/complete-lesson', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { lessonId, topicId, timeSpent, score } = req.body;

    // Calculate XP based on difficulty (default to intermediate)
    let xpAwarded = 30;
    const topicDifficulty = topicId?.includes('advanced') ? 'advanced' :
                           topicId?.includes('beginner') ? 'beginner' : 'intermediate';
    
    if (topicDifficulty === 'beginner') {
      xpAwarded = 20;
    } else if (topicDifficulty === 'advanced') {
      xpAwarded = 50;
    }

    // Award XP using stored procedure
    const xpResult = await executeProcedure('sp_UpdateUserXP', {
      UserID: userId,
      XPToAdd: xpAwarded,
    });

    // Award coins (100 coins per lesson)
    await executeProcedure('sp_UpdateUserCoins', {
      UserID: userId,
      CoinsToAdd: 100,
    });

    const xpData = xpResult.recordset[0] as { TotalXP?: number; LevelUp?: boolean } | undefined;
    return successResponse(res, {
      xpAwarded: xpAwarded,
      totalXP: xpData?.TotalXP || 0,
      levelUp: xpData?.LevelUp || false,
      streak: 0 // Placeholder - would track in LearningProgress table
    });
  } catch (error) {
    return errorResponse(res, 'Failed to complete lesson', 500, error);
  }
});

export default router;

