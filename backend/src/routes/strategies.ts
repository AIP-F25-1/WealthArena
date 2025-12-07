/**
 * Trading Strategies Routes
 * Strategy management, backtesting, and optimization
 */

import express from 'express';
import { executeQuery, executeProcedure } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

/**
 * GET /api/strategies
 * Get available trading strategies
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { 
      category, 
      risk_level, 
      asset_type, 
      is_public = 'true',
      limit = 50,
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        s.StrategyID,
        s.StrategyName,
        s.Description,
        s.Category,
        s.RiskLevel,
        s.AssetType,
        s.IsPublic,
        s.CreatedBy,
        s.CreatedAt,
        s.UpdatedAt,
        s.BacktestSharpe,
        s.BacktestReturns,
        s.BacktestMaxDrawdown,
        s.BacktestWinRate,
        s.BacktestTotalTrades,
        s.Parameters,
        u.Username as CreatedByUsername,
        up.DisplayName as CreatedByDisplayName,
        COUNT(us.UserID) as UserCount
      FROM Strategies s
      LEFT JOIN Users u ON s.CreatedBy = u.UserID
      LEFT JOIN UserProfiles up ON s.CreatedBy = up.UserID
      LEFT JOIN UserStrategies us ON s.StrategyID = us.StrategyID
      WHERE 1=1
    `;

    const params: any = {};

    if (category) {
      query += ` AND s.Category = @category`;
      params.category = category;
    }

    if (risk_level) {
      query += ` AND s.RiskLevel = @riskLevel`;
      params.riskLevel = risk_level;
    }

    if (asset_type) {
      query += ` AND s.AssetType = @assetType`;
      params.assetType = asset_type;
    }

    if (is_public === 'true') {
      query += ` AND s.IsPublic = 1`;
    } else if (is_public === 'false') {
      query += ` AND s.CreatedBy = @userId`;
      params.userId = req.userId!;
    }

    query += ` GROUP BY s.StrategyID, s.StrategyName, s.Description, s.Category, s.RiskLevel, s.AssetType, s.IsPublic, s.CreatedBy, s.CreatedAt, s.UpdatedAt, s.BacktestSharpe, s.BacktestReturns, s.BacktestMaxDrawdown, s.BacktestWinRate, s.BacktestTotalTrades, s.Parameters, u.Username, up.DisplayName`;

    query += ` ORDER BY s.CreatedAt DESC`;

    query = `SELECT * FROM (${query}) as strategies ORDER BY UserCount DESC, CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    params.offset = Number.parseInt(offset as string, 10);
    params.limit = Number.parseInt(limit as string, 10);

    const result = await executeQuery(query, params);

    return successResponse(res, {
      strategies: result.recordset,
      pagination: {
        limit: Number.parseInt(limit as string, 10),
        offset: Number.parseInt(offset as string, 10),
        total: result.recordset.length
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch strategies', 500, error);
  }
});

/**
 * GET /api/strategies/:strategyId
 * Get specific strategy details
 */
router.get('/:strategyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { strategyId } = req.params;

    const query = `
      SELECT 
        s.*,
        u.Username as CreatedByUsername,
        up.DisplayName as CreatedByDisplayName,
        up.AvatarURL as CreatedByAvatar
      FROM Strategies s
      LEFT JOIN Users u ON s.CreatedBy = u.UserID
      LEFT JOIN UserProfiles up ON s.CreatedBy = up.UserID
      WHERE s.StrategyID = @strategyId
    `;

    const result = await executeQuery(query, { strategyId: Number.parseInt(strategyId, 10) });

    if (result.recordset.length === 0) {
      return errorResponse(res, 'Strategy not found', 404);
    }

    const strategy = result.recordset[0];

    // Check if user is following this strategy
    const userStrategyQuery = `
      SELECT * FROM UserStrategies 
      WHERE StrategyID = @strategyId AND UserID = @userId
    `;

    const userStrategyResult = await executeQuery(userStrategyQuery, {
      strategyId: Number.parseInt(strategyId, 10),
      userId: req.userId!
    });

    const strategyTyped = strategy as Record<string, any>;
    return successResponse(res, {
      ...strategyTyped,
      isFollowing: userStrategyResult.recordset.length > 0
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch strategy details', 500, error);
  }
});

/**
 * POST /api/strategies
 * Create a new strategy
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      strategyName,
      description,
      category,
      riskLevel,
      assetType,
      parameters,
      isPublic = false
    } = req.body;

    if (!strategyName || !description || !category || !riskLevel || !assetType) {
      return errorResponse(res, 'Missing required fields', 400);
    }

    const result = await executeProcedure('sp_CreateStrategy', {
      StrategyName: strategyName,
      Description: description,
      Category: category,
      RiskLevel: riskLevel,
      AssetType: assetType,
      Parameters: JSON.stringify(parameters || {}),
      IsPublic: isPublic ? 1 : 0,
      CreatedBy: userId
    });

    const strategyId = (result.recordset[0] as { StrategyID?: number })?.StrategyID;
    return successResponse(res, {
      strategyId: strategyId,
      message: 'Strategy created successfully'
    }, 'Strategy created successfully', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create strategy', 500, error);
  }
});

/**
 * PUT /api/strategies/:strategyId
 * Update a strategy
 */
router.put('/:strategyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { strategyId } = req.params;
    const userId = req.userId!;
    const {
      strategyName,
      description,
      category,
      riskLevel,
      assetType,
      parameters,
      isPublic
    } = req.body;

    // Check if user owns this strategy
    const ownershipQuery = `
      SELECT CreatedBy FROM Strategies WHERE StrategyID = @strategyId
    `;

    const ownershipResult = await executeQuery(ownershipQuery, { strategyId: Number.parseInt(strategyId, 10) });

    if (ownershipResult.recordset.length === 0) {
      return errorResponse(res, 'Strategy not found', 404);
    }

    const ownership = ownershipResult.recordset[0] as { CreatedBy?: number };
    if (ownership.CreatedBy !== userId) {
      return errorResponse(res, 'Unauthorized to update this strategy', 403);
    }

    const updateFields = [];
    const params: any = { strategyId: Number.parseInt(strategyId, 10) };

    if (strategyName) {
      updateFields.push('StrategyName = @strategyName');
      params.strategyName = strategyName;
    }

    if (description) {
      updateFields.push('Description = @description');
      params.description = description;
    }

    if (category) {
      updateFields.push('Category = @category');
      params.category = category;
    }

    if (riskLevel) {
      updateFields.push('RiskLevel = @riskLevel');
      params.riskLevel = riskLevel;
    }

    if (assetType) {
      updateFields.push('AssetType = @assetType');
      params.assetType = assetType;
    }

    if (parameters) {
      updateFields.push('Parameters = @parameters');
      params.parameters = JSON.stringify(parameters);
    }

    if (isPublic !== undefined) {
      updateFields.push('IsPublic = @isPublic');
      params.isPublic = isPublic ? 1 : 0;
    }

    if (updateFields.length === 0) {
      return errorResponse(res, 'No fields to update', 400);
    }

    updateFields.push('UpdatedAt = GETUTCDATE()');

    const query = `UPDATE Strategies SET ${updateFields.join(', ')} WHERE StrategyID = @strategyId`;

    await executeQuery(query, params);

    return successResponse(res, { message: 'Strategy updated successfully' });
  } catch (error) {
    return errorResponse(res, 'Failed to update strategy', 500, error);
  }
});

/**
 * DELETE /api/strategies/:strategyId
 * Delete a strategy
 */
router.delete('/:strategyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { strategyId } = req.params;
    const userId = req.userId!;

    // Check if user owns this strategy
    const ownershipQuery = `
      SELECT CreatedBy FROM Strategies WHERE StrategyID = @strategyId
    `;

    const ownershipResult = await executeQuery(ownershipQuery, { strategyId: Number.parseInt(strategyId, 10) });

    if (ownershipResult.recordset.length === 0) {
      return errorResponse(res, 'Strategy not found', 404);
    }

    const ownership = ownershipResult.recordset[0] as { CreatedBy?: number };
    if (ownership.CreatedBy !== userId) {
      return errorResponse(res, 'Unauthorized to delete this strategy', 403);
    }

    await executeQuery('DELETE FROM Strategies WHERE StrategyID = @strategyId', {
      strategyId: Number.parseInt(strategyId, 10)
    });

    return successResponse(res, { message: 'Strategy deleted successfully' });
  } catch (error) {
    return errorResponse(res, 'Failed to delete strategy', 500, error);
  }
});

/**
 * POST /api/strategies/:strategyId/follow
 * Follow a strategy
 */
router.post('/:strategyId/follow', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { strategyId } = req.params;
    const userId = req.userId!;

    // Check if strategy exists and is public
    const strategyQuery = `
      SELECT IsPublic FROM Strategies WHERE StrategyID = @strategyId
    `;

    const strategyResult = await executeQuery(strategyQuery, { strategyId: Number.parseInt(strategyId, 10) });

    if (strategyResult.recordset.length === 0) {
      return errorResponse(res, 'Strategy not found', 404);
    }

    const strategy = strategyResult.recordset[0] as { IsPublic?: number | boolean };
    if (!strategy.IsPublic) {
      return errorResponse(res, 'Cannot follow private strategy', 403);
    }

    // Check if already following
    const followQuery = `
      SELECT UserID FROM UserStrategies 
      WHERE StrategyID = @strategyId AND UserID = @userId
    `;

    const followResult = await executeQuery(followQuery, {
      strategyId: Number.parseInt(strategyId, 10),
      userId
    });

    if (followResult.recordset.length > 0) {
      return errorResponse(res, 'Already following this strategy', 400);
    }

    await executeQuery(
      'INSERT INTO UserStrategies (StrategyID, UserID, FollowedAt) VALUES (@strategyId, @userId, GETUTCDATE())',
      { strategyId: Number.parseInt(strategyId, 10), userId }
    );

    return successResponse(res, { message: 'Strategy followed successfully' });
  } catch (error) {
    return errorResponse(res, 'Failed to follow strategy', 500, error);
  }
});

/**
 * DELETE /api/strategies/:strategyId/follow
 * Unfollow a strategy
 */
router.delete('/:strategyId/follow', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { strategyId } = req.params;
    const userId = req.userId!;

    await executeQuery(
      'DELETE FROM UserStrategies WHERE StrategyID = @strategyId AND UserID = @userId',
      { strategyId: Number.parseInt(strategyId, 10), userId }
    );

    return successResponse(res, { message: 'Strategy unfollowed successfully' });
  } catch (error) {
    return errorResponse(res, 'Failed to unfollow strategy', 500, error);
  }
});

/**
 * POST /api/strategies/:strategyId/backtest
 * Run backtest for a strategy
 */
router.post('/:strategyId/backtest', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { strategyId } = req.params;
    const {
      startDate,
      endDate,
      initialCapital = 100000,
      symbols = []
    } = req.body;

    if (!startDate || !endDate) {
      return errorResponse(res, 'Start date and end date are required', 400);
    }

    // This would typically call the RL system's backtesting API
    // For now, return a placeholder response
    const backtestResult = {
      strategyId: Number.parseInt(strategyId, 10),
      startDate,
      endDate,
      initialCapital,
      symbols,
      totalReturns: 0,
      annualizedReturns: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: 0,
      profitFactor: 0,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    return successResponse(res, backtestResult);
  } catch (error) {
    return errorResponse(res, 'Failed to run backtest', 500, error);
  }
});

/**
 * GET /api/strategies/user/:userId
 * Get user's strategies
 */
router.get('/user/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const query = `
      SELECT 
        s.*,
        COUNT(us.UserID) as FollowerCount
      FROM Strategies s
      LEFT JOIN UserStrategies us ON s.StrategyID = us.StrategyID
      WHERE s.CreatedBy = @userId
      GROUP BY s.StrategyID, s.StrategyName, s.Description, s.Category, s.RiskLevel, s.AssetType, s.IsPublic, s.CreatedBy, s.CreatedAt, s.UpdatedAt, s.BacktestSharpe, s.BacktestReturns, s.BacktestMaxDrawdown, s.BacktestWinRate, s.BacktestTotalTrades, s.Parameters
      ORDER BY s.CreatedAt DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const result = await executeQuery(query, {
      userId: Number.parseInt(userId, 10),
      limit: Number.parseInt(limit as string, 10),
      offset: Number.parseInt(offset as string, 10)
    });

    return successResponse(res, {
      strategies: result.recordset,
      pagination: {
        limit: Number.parseInt(limit as string, 10),
        offset: Number.parseInt(offset as string, 10),
        total: result.recordset.length
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch user strategies', 500, error);
  }
});

export default router;
