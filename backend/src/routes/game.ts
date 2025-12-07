/**
 * Game Routes
 * Handles game session management, persistence, and completion
 */

import express from 'express';
import { executeQuery, executeProcedure } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

// In-memory storage for game sessions (in production, use Redis or database)
const gameSessions = new Map<string, any>();

/**
 * POST /api/game/create-session
 * Start a new game session
 */
router.post('/create-session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { gameType, symbols, difficulty, startingCash } = req.body;

    if (!gameType) {
      return errorResponse(res, 'Game type is required', 400);
    }

    // Generate session ID
    const sessionId = `game_${userId}_${Date.now()}`;
    
    // Extract symbols and format for storage
    const symbolsList = symbols ? (Array.isArray(symbols) ? symbols.join(',') : symbols) : '';
    const finalDifficulty = difficulty || 'easy';
    const finalStartingCash = startingCash || 10000;

    // Create session data
    const sessionData = {
      sessionId,
      userId,
      gameType,
      difficulty: finalDifficulty,
      symbols: symbolsList,
      currentBalance: finalStartingCash,
      positions: [],
      trades: [],
      currentStep: 0,
      timestamp: new Date(),
      portfolioName: `${gameType} Session`,
      isActive: true,
    };

    // Store session
    gameSessions.set(sessionId, sessionData);

    // Log session creation
    // Use game_sessions table (standardized table name)
    // Convert userId INT to NVARCHAR for game_sessions.user_id
    // Store sessionId in game_name for reference
    // Store symbols in game_name, difficulty in market_conditions
    const userIdStr = String(userId);
    const insertResult = await executeQuery(
      `INSERT INTO game_sessions (user_id, game_type, game_name, start_date, end_date, initial_capital, max_positions, historical_start_date, historical_end_date, market_conditions, status, created_at)
       OUTPUT INSERTED.id
       VALUES (@userId, @gameType, @gameName, GETUTCDATE(), DATEADD(day, 30, GETUTCDATE()), @initialCapital, 10, @historicalStartDate, @historicalEndDate, @marketConditions, 'active', GETUTCDATE())`,
      {
        userId: userIdStr,
        gameType,
        gameName: symbolsList || sessionId, // Store symbols in game_name, fallback to sessionId
        initialCapital: finalStartingCash,
        historicalStartDate: '2020-01-01',
        historicalEndDate: '2023-12-31',
        marketConditions: JSON.stringify({ difficulty: finalDifficulty })
      }
    );
    
    // Store database id in session data for future lookups
    if (insertResult.recordset.length > 0) {
      const insertRecord = insertResult.recordset[0] as { id: number };
      (sessionData as any).dbId = insertRecord.id;
    }

    return successResponse(res, {
      sessionId,
      gameType,
      initialBalance: finalStartingCash,
      message: 'Game session created successfully',
    });
  } catch (error) {
    return errorResponse(res, 'Failed to create game session', 500, error);
  }
});

/**
 * POST /api/game/save-session
 * Save current game state
 */
router.post('/save-session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sessionId, state } = req.body;

    if (!sessionId || !state) {
      return errorResponse(res, 'Session ID and state are required', 400);
    }

    // Get existing session
    const sessionData = gameSessions.get(sessionId);
    if (!sessionData || sessionData.userId !== userId) {
      return errorResponse(res, 'Game session not found', 404);
    }

    // Update session with new state
    const updatedSession = {
      ...sessionData,
      ...state,
      lastSaved: new Date(),
    };

    gameSessions.set(sessionId, updatedSession);

    // Update database
    // Use game_sessions table with id lookup
    const userIdStr = String(userId);
    await executeQuery(
      `UPDATE game_sessions SET status = 'active', updated_at = GETUTCDATE()
       WHERE id IN (
         SELECT TOP 1 id FROM game_sessions 
         WHERE user_id = @userId AND game_type = @gameType AND status = 'active'
         ORDER BY created_at DESC
       )`,
      {
        userId: userIdStr,
        gameType: sessionData.gameType,
      }
    );

    return successResponse(res, {
      message: 'Game session saved successfully',
      lastSaved: updatedSession.lastSaved,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to save game session', 500, error);
  }
});

/**
 * GET /api/game/resume-session/:sessionId
 * Load saved game session
 */
router.get('/resume-session/:sessionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.params;

    // Get session from memory
    const sessionData = gameSessions.get(sessionId);
    if (!sessionData || sessionData.userId !== userId) {
      return errorResponse(res, 'Game session not found', 404);
    }

    // Also try to load from database as backup
    // Use game_sessions table
    const userIdStr = String(userId);
    const dbSession = await executeQuery(
      `SELECT * FROM game_sessions 
       WHERE user_id = @userId AND status = 'active'
       ORDER BY created_at DESC`,
      { userId: userIdStr }
    );

    if (dbSession.recordset.length === 0) {
      return errorResponse(res, 'Game session not found in database', 404);
    }

    return successResponse(res, {
      sessionId,
      gameType: sessionData.gameType,
      currentBalance: sessionData.currentBalance,
      positions: sessionData.positions,
      trades: sessionData.trades,
      currentStep: sessionData.currentStep,
      portfolioName: sessionData.portfolioName,
      lastSaved: sessionData.lastSaved,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to resume game session', 500, error);
  }
});

/**
 * POST /api/game/complete-session
 * Complete game session and award XP/coins
 */
router.post('/complete-session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sessionId, results } = req.body;

    if (!sessionId || !results) {
      return errorResponse(res, 'Session ID and results are required', 400);
    }

    // Get session data
    const sessionData = gameSessions.get(sessionId);
    if (!sessionData || sessionData.userId !== userId) {
      return errorResponse(res, 'Game session not found', 404);
    }

    // Calculate performance metrics
    const finalBalance = results.finalBalance || sessionData.currentBalance;
    const initialBalance = sessionData.currentBalance;
    const profitLoss = finalBalance - initialBalance;
    const profitPercentage = (profitLoss / initialBalance) * 100;

    // Calculate XP and coins based on performance
    let xpAward = 10; // Base XP
    let coinAward = 50; // Base coins

    // Performance bonuses
    if (profitPercentage > 0) {
      xpAward += Math.min(40, Math.floor(profitPercentage * 2)); // Up to 40 bonus XP
      coinAward += Math.min(150, Math.floor(profitPercentage * 5)); // Up to 150 bonus coins
    }

    // Difficulty bonus
    if (sessionData.difficulty === 'hard') {
      xpAward = Math.floor(xpAward * 1.5);
      coinAward = Math.floor(coinAward * 1.5);
    }

    // Award XP and coins
    await executeProcedure('sp_UpdateUserXP', {
      UserID: userId,
      XPToAdd: xpAward,
    });

    await executeProcedure('sp_UpdateUserCoins', {
      UserID: userId,
      CoinsToAdd: coinAward,
    });

    // Mark session as completed
    // Use game_sessions table
    const userIdStr = String(userId);
    await executeQuery(
      `UPDATE game_sessions 
       SET status = 'completed', completed_at = GETUTCDATE(), final_value = @finalBalance
       WHERE id IN (
         SELECT TOP 1 id FROM game_sessions 
         WHERE user_id = @userId AND game_type = @gameType AND status = 'active'
         ORDER BY created_at DESC
       )`,
      {
        userId: userIdStr,
        gameType: sessionData.gameType,
        finalBalance,
      }
    );

    // Clean up session from memory
    gameSessions.delete(sessionId);

    // Update leaderboard
    await executeProcedure('sp_UpdateLeaderboard', { UserID: userId });

    return successResponse(res, {
      message: 'Game session completed successfully',
      rewards: {
        xp: xpAward,
        coins: coinAward,
      },
      performance: {
        finalBalance,
        profitLoss,
        profitPercentage: Math.round(profitPercentage * 100) / 100,
      },
    });
  } catch (error) {
    return errorResponse(res, 'Failed to complete game session', 500, error);
  }
});

/**
 * DELETE /api/game/discard-session
 * Discard saved game session
 */
router.delete('/discard-session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sessionId } = req.body;

    if (!sessionId) {
      return errorResponse(res, 'Session ID is required', 400);
    }

    // Remove from memory
    gameSessions.delete(sessionId);

    // Mark as discarded in database
    // Use game_sessions table
    const userIdStr = String(userId);
    await executeQuery(
      `UPDATE game_sessions 
       SET status = 'paused'
       WHERE id IN (
         SELECT TOP 1 id FROM game_sessions 
         WHERE user_id = @userId AND status = 'active'
         ORDER BY created_at DESC
       )`,
      { userId: userIdStr }
    );

    return successResponse(res, {
      message: 'Game session discarded successfully',
    });
  } catch (error) {
    return errorResponse(res, 'Failed to discard game session', 500, error);
  }
});

/**
 * GET /api/game/sessions
 * Get user's active game sessions
 */
router.get('/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT 
        id as SessionID,
        game_type as GameType,
        created_at as CreatedAt,
        updated_at as LastSaved,
        initial_capital as CurrentBalance,
        CASE WHEN status = 'active' THEN 1 ELSE 0 END as IsActive
      FROM game_sessions 
      WHERE user_id = @userId AND status = 'active'
      ORDER BY updated_at DESC
    `;

    const userIdStr = String(userId);
    const result = await executeQuery(query, { userId: userIdStr });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch game sessions', 500, error);
  }
});

/**
 * GET /api/game/history
 * Get user's completed game history
 */
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const limit = Number.parseInt(req.query.limit as string, 10) || 20;

    const query = `
      SELECT TOP (@limit)
        id as SessionID,
        game_type as GameType,
        created_at as CreatedAt,
        completed_at as CompletedAt,
        final_value as FinalBalance,
        NULL as XPAwarded,
        NULL as CoinsAwarded,
        DATEDIFF(minute, created_at, completed_at) as DurationMinutes
      FROM game_sessions 
      WHERE user_id = @userId AND status = 'completed' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
    `;

    const userIdStr = String(userId);
    const result = await executeQuery(query, { userId: userIdStr, limit });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch game history', 500, error);
  }
});

export default router;
