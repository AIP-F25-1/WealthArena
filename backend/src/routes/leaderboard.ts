/**
 * Leaderboard Routes
 * User rankings, competitions, and achievements
 */

import express from 'express';
import { executeQuery, executeProcedure, isMockMode } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

// Type definitions for leaderboard results
interface CompetitionJoinResult {
  ResultCode: number;
  Message?: string;
  CompetitionID?: number;
  MaxParticipants?: number;
  CurrentParticipants?: number;
}

/**
 * GET /api/leaderboard/global
 * Get global leaderboard
 */
router.get('/global', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Handle mock mode
    if (isMockMode()) {
      return successResponse(res, {
        leaderboard: [],
        pagination: {
          limit: Number.parseInt(req.query.limit as string, 10) || 100,
          offset: Number.parseInt(req.query.offset as string) || 0,
          total: 0
        }
      });
    }

    const { 
      timeframe = 'all', 
      category = 'total_returns', 
      limit = 100,
      offset = 0 
    } = req.query;

    let timeFilter = '';
    if (timeframe === '1d') {
      timeFilter = 'AND LastUpdated >= DATEADD(day, -1, GETUTCDATE())';
    } else if (timeframe === '1w') {
      timeFilter = 'AND LastUpdated >= DATEADD(week, -1, GETUTCDATE())';
    } else if (timeframe === '1m') {
      timeFilter = 'AND LastUpdated >= DATEADD(month, -1, GETUTCDATE())';
    } else if (timeframe === '3m') {
      timeFilter = 'AND LastUpdated >= DATEADD(month, -3, GETUTCDATE())';
    }

    let orderBy = 'TotalReturns DESC';
    if (category === 'win_rate') {
      orderBy = 'WinRate DESC, TotalTrades DESC';
    } else if (category === 'total_trades') {
      orderBy = 'TotalTrades DESC, WinRate DESC';
    } else if (category === 'profit_factor') {
      orderBy = 'ProfitFactor DESC, TotalReturns DESC';
    } else if (category === 'sharpe_ratio') {
      orderBy = 'SharpeRatio DESC, TotalReturns DESC';
    }

    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ${orderBy}) as Rank,
        UserID,
        Username,
        DisplayName,
        AvatarURL,
        TotalReturns,
        WinRate,
        TotalTrades,
        ProfitFactor,
        SharpeRatio,
        MaxDrawdown,
        CurrentStreak,
        TotalXP,
        Tier,
        LastUpdated
      FROM vw_Leaderboard
      WHERE 1=1 ${timeFilter}
      ORDER BY ${orderBy}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const result = await executeQuery(query, {
      limit: Number.parseInt(limit as string),
      offset: Number.parseInt(offset as string)
    });

    return successResponse(res, {
      leaderboard: result.recordset,
      pagination: {
        limit: Number.parseInt(limit as string),
        offset: Number.parseInt(offset as string),
        total: result.recordset.length
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch global leaderboard', 500, error);
  }
});

/**
 * GET /api/leaderboard/friends
 * Get friends leaderboard
 */
router.get('/friends', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Handle mock mode
    if (isMockMode()) {
      return successResponse(res, []);
    }

    const userId = req.userId!;
    const { timeframe = 'all', limit = 50 } = req.query;

    let timeFilter = '';
    if (timeframe === '1d') {
      timeFilter = 'AND LastUpdated >= DATEADD(day, -1, GETUTCDATE())';
    } else if (timeframe === '1w') {
      timeFilter = 'AND LastUpdated >= DATEADD(week, -1, GETUTCDATE())';
    } else if (timeframe === '1m') {
      timeFilter = 'AND LastUpdated >= DATEADD(month, -1, GETUTCDATE())';
    }

    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY TotalReturns DESC) as Rank,
        UserID,
        Username,
        DisplayName,
        AvatarURL,
        TotalReturns,
        WinRate,
        TotalTrades,
        CurrentStreak,
        TotalXP,
        Tier,
        LastUpdated,
        CASE WHEN UserID = @userId THEN 1 ELSE 0 END as IsCurrentUser
      FROM vw_Leaderboard
      WHERE UserID IN (
        SELECT FriendID FROM UserFriends WHERE UserID = @userId
        UNION
        SELECT UserID FROM UserFriends WHERE FriendID = @userId
        UNION
        SELECT @userId
      ) ${timeFilter}
      ORDER BY TotalReturns DESC
    `;

    const result = await executeQuery(query, { 
      userId,
      limit: Number.parseInt(limit as string)
    });

    return successResponse(res, result.recordset || []);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch friends leaderboard', 500, error);
  }
});

/**
 * GET /api/leaderboard/competitions
 * Get active competitions
 */
router.get('/competitions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status = 'active', limit = 20 } = req.query;

    let statusFilter = '';
    if (status === 'active') {
      statusFilter = 'AND StartDate <= GETUTCDATE() AND EndDate >= GETUTCDATE()';
    } else if (status === 'upcoming') {
      statusFilter = 'AND StartDate > GETUTCDATE()';
    } else if (status === 'completed') {
      statusFilter = 'AND EndDate < GETUTCDATE()';
    }

    const query = `
      SELECT 
        CompetitionID,
        Name,
        Description,
        StartDate,
        EndDate,
        EntryFee,
        PrizePool,
        MaxParticipants,
        CurrentParticipants,
        CompetitionType,
        Rules,
        Status,
        CreatedBy,
        CreatedAt
      FROM Competitions
      WHERE 1=1 ${statusFilter}
      ORDER BY 
        CASE WHEN Status = 'active' THEN 1
             WHEN Status = 'upcoming' THEN 2
             ELSE 3 END,
        StartDate DESC
    `;

    const result = await executeQuery(query, { limit: Number.parseInt(limit as string) });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch competitions', 500, error);
  }
});

/**
 * GET /api/leaderboard/competition/:competitionId
 * Get leaderboard for a specific competition
 */
router.get('/competition/:competitionId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { competitionId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY TotalReturns DESC) as Rank,
        cp.UserID,
        u.Username,
        up.DisplayName,
        up.AvatarURL,
        cp.TotalReturns,
        cp.WinRate,
        cp.TotalTrades,
        cp.ProfitFactor,
        cp.SharpeRatio,
        cp.MaxDrawdown,
        cp.CurrentStreak,
        cp.TotalXP,
        up.Tier,
        cp.LastUpdated,
        CASE WHEN cp.UserID = @userId THEN 1 ELSE 0 END as IsCurrentUser
      FROM CompetitionParticipants cp
      INNER JOIN Users u ON cp.UserID = u.UserID
      INNER JOIN UserProfiles up ON cp.UserID = up.UserID
      WHERE cp.CompetitionID = @competitionId
      ORDER BY TotalReturns DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const result = await executeQuery(query, {
      competitionId: Number.parseInt(competitionId),
      userId: req.userId!,
      limit: Number.parseInt(limit as string),
      offset: Number.parseInt(offset as string)
    });

    return successResponse(res, {
      leaderboard: result.recordset,
      competitionId: Number.parseInt(competitionId),
      pagination: {
        limit: Number.parseInt(limit as string),
        offset: Number.parseInt(offset as string),
        total: result.recordset.length
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch competition leaderboard', 500, error);
  }
});

/**
 * POST /api/leaderboard/competition/:competitionId/join
 * Join a competition
 */
router.post('/competition/:competitionId/join', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { competitionId } = req.params;
    const userId = req.userId!;

    // Check if competition exists and is active
    const competitionQuery = `
      SELECT * FROM Competitions 
      WHERE CompetitionID = @competitionId 
      AND StartDate <= GETUTCDATE() 
      AND EndDate >= GETUTCDATE()
      AND CurrentParticipants < MaxParticipants
    `;

    const competitionResult = await executeQuery(competitionQuery, { competitionId: Number.parseInt(competitionId) });

    if (competitionResult.recordset.length === 0) {
      return errorResponse(res, 'Competition not available for joining', 400);
    }

    // Check if user is already participating
    const participantQuery = `
      SELECT UserID FROM CompetitionParticipants 
      WHERE CompetitionID = @competitionId AND UserID = @userId
    `;

    const participantResult = await executeQuery(participantQuery, {
      competitionId: Number.parseInt(competitionId),
      userId
    });

    if (participantResult.recordset.length > 0) {
      return errorResponse(res, 'User is already participating in this competition', 400);
    }

    // Join competition
    const joinResult = await executeProcedure('sp_JoinCompetition', {
      CompetitionID: Number.parseInt(competitionId),
      UserID: userId
    });

    // Check result code from stored procedure
    if (joinResult.recordset.length === 0) {
      return errorResponse(res, 'Failed to join competition - no result returned', 500);
    }

    const joinRecord = joinResult.recordset[0] as CompetitionJoinResult;
    if (!joinRecord.ResultCode) {
      return errorResponse(res, 'Failed to join competition - no result returned', 500);
    }

    const resultCode = joinRecord.ResultCode;
    const message = joinRecord.Message || 'Unknown error';

    // Map negative result codes to appropriate HTTP errors
    if (resultCode === 0) {
      // Success
      return successResponse(res, {
        message: message,
        competitionId: joinRecord.CompetitionID,
        maxParticipants: joinRecord.MaxParticipants,
        currentParticipants: joinRecord.CurrentParticipants
      });
    } else if (resultCode === -1) {
      return errorResponse(res, message || 'Competition not found or not active', 404);
    } else if (resultCode === -2) {
      return errorResponse(res, message || 'Competition is full', 409);
    } else if (resultCode === -3) {
      return errorResponse(res, message || 'User is already participating in this competition', 409);
    } else if (resultCode === -4) {
      return errorResponse(res, message || 'Insufficient coins for entry fee', 402);
    } else {
      // Unknown error code
      return errorResponse(res, message || 'Failed to join competition', 500);
    }
  } catch (error) {
    return errorResponse(res, 'Failed to join competition', 500, error);
  }
});

/**
 * GET /api/leaderboard/user/:userId
 * Get user's ranking and stats
 */
router.get('/user/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const userIdNum = Number.parseInt(userId);
    
    if (isNaN(userIdNum)) {
      return errorResponse(res, 'Invalid user ID', 400);
    }

    // Handle mock mode - return mock user stats
    if (isMockMode()) {
      const mockUserStats = {
        GlobalRank: 1,
        UserID: userIdNum,
        Username: `user${userIdNum}`,
        DisplayName: `User ${userIdNum}`,
        AvatarURL: null,
        TotalReturns: 0,
        WinRate: 0,
        TotalTrades: 0,
        ProfitFactor: 0,
        SharpeRatio: 0,
        MaxDrawdown: 0,
        CurrentStreak: 0,
        TotalXP: 0,
        Tier: 'Bronze',
        LastUpdated: new Date().toISOString(),
        recentAchievements: []
      };
      return successResponse(res, mockUserStats);
    }

    const { timeframe = 'all' } = req.query;

    let timeFilter = '';
    if (timeframe === '1d') {
      timeFilter = 'AND LastUpdated >= DATEADD(day, -1, GETUTCDATE())';
    } else if (timeframe === '1w') {
      timeFilter = 'AND LastUpdated >= DATEADD(week, -1, GETUTCDATE())';
    } else if (timeframe === '1m') {
      timeFilter = 'AND LastUpdated >= DATEADD(month, -1, GETUTCDATE())';
    }

    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY TotalReturns DESC) as GlobalRank,
        UserID,
        Username,
        DisplayName,
        AvatarURL,
        TotalReturns,
        WinRate,
        TotalTrades,
        ProfitFactor,
        SharpeRatio,
        MaxDrawdown,
        CurrentStreak,
        TotalXP,
        Tier,
        LastUpdated
      FROM vw_Leaderboard
      WHERE UserID = @userId ${timeFilter}
    `;

    const result = await executeQuery(query, { userId: Number.parseInt(userId) });

    if (result.recordset.length === 0) {
      return errorResponse(res, 'User not found', 404);
    }

    const userStats = result.recordset[0] as Record<string, any>;

    // Get user's recent achievements
    const achievementsQuery = `
      SELECT TOP 5 a.*, ua.UnlockedAt
      FROM UserAchievements ua
      INNER JOIN Achievements a ON ua.AchievementID = a.AchievementID
      WHERE ua.UserID = @userId
      ORDER BY ua.UnlockedAt DESC
    `;

    const achievementsResult = await executeQuery(achievementsQuery, { userId: Number.parseInt(userId) });

    return successResponse(res, {
      ...userStats,
      recentAchievements: achievementsResult.recordset
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch user stats', 500, error);
  }
});

/**
 * GET /api/leaderboard/stats
 * Get leaderboard statistics
 */
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as TotalUsers,
        AVG(TotalReturns) as AvgReturns,
        AVG(WinRate) as AvgWinRate,
        AVG(TotalTrades) as AvgTrades,
        MAX(TotalReturns) as MaxReturns,
        MIN(TotalReturns) as MinReturns,
        AVG(SharpeRatio) as AvgSharpeRatio,
        AVG(ProfitFactor) as AvgProfitFactor
      FROM vw_Leaderboard
    `;

    const result = await executeQuery(query);

    return successResponse(res, result.recordset[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch leaderboard stats', 500, error);
  }
});

export default router;
