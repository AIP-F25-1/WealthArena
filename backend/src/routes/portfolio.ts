/**
 * Portfolio Routes
 * User portfolio management and performance
 */

import express from 'express';
import { executeQuery } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

/**
 * GET /api/portfolio
 * Get user's default portfolio
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT * FROM vw_PortfolioPerformance
      WHERE UserID = @userId
    `;

    const result = await executeQuery(query, { userId });

    if (result.recordset.length === 0) {
      // Create default portfolio if doesn't exist
      await executeQuery(
        `INSERT INTO portfolios (user_id, portfolio_name, portfolio_type, initial_capital, current_value, cash_balance, total_invested, risk_tolerance, is_active, created_at, updated_at)
         VALUES (@userId, 'Default Portfolio', 'paper', 100000, 100000, 100000, 0, 'moderate', 1, GETUTCDATE(), GETUTCDATE())`,
        { userId }
      );

      return successResponse(res, {
        PortfolioID: null,
        TotalValue: 0,
        CashBalance: 100000,
        TotalPositions: 0,
      });
    }

    return successResponse(res, result.recordset[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch portfolio', 500, error);
  }
});

/**
 * GET /api/portfolio/items
 * Get portfolio items
 */
router.get('/items', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT *
      FROM positions
      WHERE portfolio_id IN (
        SELECT id FROM portfolios WHERE user_id = @userId
      )
      ORDER BY unrealized_pnl DESC
    `;

    const result = await executeQuery(query, { userId });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch portfolio items', 500, error);
  }
});

/**
 * GET /api/portfolio/trades
 * Get user's trade history
 */
router.get('/trades', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const limit = Number.parseInt(req.query.limit as string) || 50;

    const query = `
      SELECT TOP (@limit) *
      FROM trades
      WHERE portfolio_id IN (
        SELECT id FROM portfolios WHERE user_id = @userId
      )
      ORDER BY trade_date DESC
    `;

    const result = await executeQuery(query, { userId, limit });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch trades', 500, error);
  }
});

/**
 * GET /api/portfolio/positions
 * Get user's open positions
 */
router.get('/positions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const query = `
      SELECT *
      FROM positions
      WHERE portfolio_id IN (
        SELECT id FROM portfolios WHERE user_id = @userId
      )
      ORDER BY unrealized_pnl DESC
    `;

    const result = await executeQuery(query, { userId });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch positions', 500, error);
  }
});

/**
 * POST /api/portfolio
 * Create a new portfolio
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, description, riskLevel, assets, initialCapital } = req.body;

    // Validation
    if (!name || !assets || !Array.isArray(assets) || assets.length === 0) {
      return errorResponse(res, 'Portfolio name and assets are required', 400);
    }

    // Validate allocations sum to 100%
    const totalAllocation = assets.reduce((sum: number, asset: any) => sum + (asset.allocation || 0), 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      return errorResponse(res, 'Asset allocations must sum to 100%', 400);
    }

    // Create portfolio
    const portfolioQuery = `
      INSERT INTO portfolios (user_id, portfolio_name, portfolio_type, initial_capital, risk_tolerance, created_at, updated_at)
      OUTPUT INSERTED.id
      VALUES (@userId, @name, 'custom', @initialCapital, @riskLevel, GETUTCDATE(), GETUTCDATE())
    `;

    const portfolioResult = await executeQuery(portfolioQuery, {
      userId,
      name,
      initialCapital: initialCapital || 100000,
      riskLevel: riskLevel || 'Moderate',
    });

    const portfolioId = (portfolioResult.recordset[0] as { id: number }).id;

    // Create positions for each asset
    const positions = [];
    for (const asset of assets) {
      const positionQuery = `
        INSERT INTO positions (portfolio_id, symbol, quantity, average_price, current_price, position_type, entry_date, last_updated)
        VALUES (@portfolioId, @symbol, @quantity, @averagePrice, @averagePrice, 'long', GETUTCDATE(), GETUTCDATE())
      `;

      const positionSize = (initialCapital || 100000) * (asset.allocation / 100);
      const quantity = Math.floor(positionSize / (asset.currentPrice || 100)); // Assume current price if not provided

      await executeQuery(positionQuery, {
        portfolioId,
        symbol: asset.symbol,
        quantity,
        averagePrice: asset.currentPrice || 100,
      });

      positions.push({ symbol: asset.symbol, quantity, entryPrice: asset.currentPrice || 100 });
    }

    // Get created portfolio with positions
    const createdPortfolioQuery = `
      SELECT * FROM vw_PortfolioPerformance WHERE PortfolioID = @portfolioId
    `;
    const portfolioData = await executeQuery(createdPortfolioQuery, { portfolioId });

    return successResponse(res, {
      portfolio: portfolioData.recordset[0],
      positions,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to create portfolio', 500, error);
  }
});

/**
 * POST /api/portfolio/from-signal
 * Create portfolio from trading signal
 */
router.post('/from-signal', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { signalId, portfolioName, investmentAmount } = req.body;

    // Validation
    if (!signalId || !portfolioName || !investmentAmount) {
      return errorResponse(res, 'Signal ID, portfolio name, and investment amount are required', 400);
    }

    // Get signal details
    const signalQuery = `
      SELECT * FROM rl_signals WHERE id = @signalId
    `;
    const signalResult = await executeQuery(signalQuery, { signalId });

    if (signalResult.recordset.length === 0) {
      return errorResponse(res, 'Signal not found', 404);
    }

    const signal = signalResult.recordset[0] as {
      entry_price?: number;
      stop_loss_price?: number;
      take_profit_1?: number;
      take_profit_2?: number;
      take_profit_3?: number;
      symbol: string;
    };

    // Validate and set defaults for signal fields with null-safety
    const entryPrice = signal.entry_price || 0;
    const stopLossPrice = signal.stop_loss_price;
    
    // Validate entry price
    if (!entryPrice || entryPrice <= 0 || isNaN(entryPrice)) {
      return errorResponse(res, 'Invalid entry price in signal', 400);
    }

    // Set stop loss if missing or equal to entry (fallback to 2% below entry)
    let finalStopLoss = stopLossPrice;
    if (!finalStopLoss || finalStopLoss <= 0 || finalStopLoss === entryPrice) {
      finalStopLoss = entryPrice * 0.98; // 2% below entry
    }
    
    const takeProfit1 = signal.take_profit_1 || 0;
    const takeProfit2 = signal.take_profit_2 || 0;
    const takeProfit3 = signal.take_profit_3 || 0;

    // Validate investment amount
    if (!investmentAmount || investmentAmount <= 0 || isNaN(investmentAmount)) {
      return errorResponse(res, 'Invalid investment amount', 400);
    }

    // Calculate position size with risk management (max 2% risk per trade)
    const riskPercent = 0.02; // 2% max risk
    const maxLoss = investmentAmount * riskPercent;
    const stopLossDistance = Math.abs(entryPrice - finalStopLoss);
    const riskPerShare = stopLossDistance || entryPrice * 0.02; // Fallback to 2% of entry price
    
    // Ensure we have a valid risk per share
    if (riskPerShare <= 0 || isNaN(riskPerShare)) {
      return errorResponse(res, 'Cannot calculate position size from invalid risk parameters', 400);
    }
    
    const maxShares = Math.floor(maxLoss / riskPerShare);
    const positionSize = Math.min(maxShares * entryPrice, investmentAmount);

    // Create portfolio
    const portfolioQuery = `
      INSERT INTO portfolios (user_id, portfolio_name, portfolio_type, initial_capital, current_value, cash_balance, total_invested, risk_tolerance, is_active, created_at, updated_at)
      OUTPUT INSERTED.id
      VALUES (@userId, @portfolioName, 'signal', @investmentAmount, @investmentAmount, 0, @investmentAmount, 'moderate', 1, GETUTCDATE(), GETUTCDATE())
    `;

    const portfolioResult = await executeQuery(portfolioQuery, {
      userId,
      portfolioName,
      investmentAmount,
    });

    const portfolioId = (portfolioResult.recordset[0] as { id: number }).id;

    // Calculate quantity ensuring minimum of 1 if investment allows
    let quantity = Math.floor(positionSize / entryPrice);
    if (quantity <= 0) {
      // If calculated quantity is 0 or negative, check if investment is sufficient for at least 1 share
      if (investmentAmount >= entryPrice) {
        quantity = 1;
      } else {
        return errorResponse(res, 'Investment amount is too small to purchase even 1 share', 400);
      }
    }
    
    // Validate quantity before insert
    if (!quantity || quantity <= 0 || isNaN(quantity)) {
      return errorResponse(res, 'Cannot calculate valid position quantity', 400);
    }

    // Create position based on signal (positions table schema)
    const positionQuery = `
      INSERT INTO positions (portfolio_id, symbol, quantity, average_price, current_price, position_type, entry_date, last_updated)
      VALUES (@portfolioId, @symbol, @quantity, @averagePrice, @averagePrice, 'long', GETUTCDATE(), GETUTCDATE())
    `;

    await executeQuery(positionQuery, {
      portfolioId,
      symbol: signal.symbol,
      quantity,
      averagePrice: entryPrice,
    });

    // Get created portfolio
    const portfolioDataQuery = `
      SELECT * FROM vw_PortfolioPerformance WHERE PortfolioID = @portfolioId
    `;
    const portfolioData = await executeQuery(portfolioDataQuery, { portfolioId });

    return successResponse(res, {
      portfolio: portfolioData.recordset[0],
      position: {
        symbol: signal.symbol,
        quantity,
        entryPrice: entryPrice,
        takeProfit1: takeProfit1,
        stopLoss: finalStopLoss,
      },
    });
  } catch (error) {
    return errorResponse(res, 'Failed to create portfolio from signal', 500, error);
  }
});

/**
 * PUT /api/portfolio/:portfolioId
 * Update portfolio
 */
router.put('/:portfolioId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const portfolioId = req.params.portfolioId;
    const { name, description, riskLevel } = req.body;

    // Verify portfolio belongs to user
    const verifyQuery = `
      SELECT id FROM portfolios WHERE id = @portfolioId AND user_id = @userId
    `;
    const verifyResult = await executeQuery(verifyQuery, { portfolioId, userId });

    if (verifyResult.recordset.length === 0) {
      return errorResponse(res, 'Portfolio not found or access denied', 404);
    }

    // Update portfolio
    const updateQuery = `
      UPDATE portfolios 
      SET portfolio_name = @name,
          risk_tolerance = @riskLevel,
          updated_at = GETUTCDATE()
      WHERE id = @portfolioId
    `;

    await executeQuery(updateQuery, {
      portfolioId,
      name: name || '',
      riskLevel: riskLevel || 'Moderate',
    });

    // Get updated portfolio
    const portfolioQuery = `
      SELECT * FROM vw_PortfolioPerformance WHERE PortfolioID = @portfolioId
    `;
    const portfolioData = await executeQuery(portfolioQuery, { portfolioId });

    return successResponse(res, portfolioData.recordset[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to update portfolio', 500, error);
  }
});

/**
 * DELETE /api/portfolio/:portfolioId
 * Delete portfolio (soft delete)
 */
router.delete('/:portfolioId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const portfolioId = req.params.portfolioId;

    // Verify portfolio belongs to user
    const verifyQuery = `
      SELECT id FROM portfolios WHERE id = @portfolioId AND user_id = @userId
    `;
    const verifyResult = await executeQuery(verifyQuery, { portfolioId, userId });

    if (verifyResult.recordset.length === 0) {
      return errorResponse(res, 'Portfolio not found or access denied', 404);
    }

    // Soft delete portfolio
    const deleteQuery = `
      UPDATE portfolios 
      SET is_active = 0, updated_at = GETUTCDATE()
      WHERE id = @portfolioId
    `;

    await executeQuery(deleteQuery, { portfolioId });

    return successResponse(res, { message: 'Portfolio deleted successfully' });
  } catch (error) {
    return errorResponse(res, 'Failed to delete portfolio', 500, error);
  }
});

/**
 * GET /api/portfolio/:portfolioId/performance
 * Get portfolio performance metrics
 */
router.get('/:portfolioId/performance', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const portfolioId = req.params.portfolioId;

    // Verify portfolio belongs to user
    const verifyQuery = `
      SELECT id FROM portfolios WHERE id = @portfolioId AND user_id = @userId
    `;
    const verifyResult = await executeQuery(verifyQuery, { portfolioId, userId });

    if (verifyResult.recordset.length === 0) {
      return errorResponse(res, 'Portfolio not found or access denied', 404);
    }

    // Get performance metrics from view
    const performanceQuery = `
      SELECT * FROM vw_PortfolioPerformance WHERE PortfolioID = @portfolioId
    `;
    const performanceResult = await executeQuery(performanceQuery, { portfolioId });

    if (performanceResult.recordset.length === 0) {
      return errorResponse(res, 'Performance data not found', 404);
    }

    const performance = performanceResult.recordset[0] as Record<string, any>;

    // Calculate additional metrics (daily, weekly, monthly returns)
    const additionalMetricsQuery = `
      SELECT 
        AVG(CASE WHEN DATEDIFF(day, t.entry_date, GETUTCDATE()) <= 1 THEN t.realized_pnl ELSE NULL END) as DailyReturn,
        AVG(CASE WHEN DATEDIFF(day, t.entry_date, GETUTCDATE()) <= 7 THEN t.realized_pnl ELSE NULL END) as WeeklyReturn,
        AVG(CASE WHEN DATEDIFF(day, t.entry_date, GETUTCDATE()) <= 30 THEN t.realized_pnl ELSE NULL END) as MonthlyReturn
      FROM trades t
      WHERE t.portfolio_id = @portfolioId AND t.realized_pnl IS NOT NULL
    `;
    const additionalMetrics = await executeQuery(additionalMetricsQuery, { portfolioId });
    const metrics = additionalMetrics.recordset[0] as { DailyReturn?: number; WeeklyReturn?: number; MonthlyReturn?: number } | undefined;

    return successResponse(res, {
      ...performance,
      dailyReturn: metrics?.DailyReturn || 0,
      weeklyReturn: metrics?.WeeklyReturn || 0,
      monthlyReturn: metrics?.MonthlyReturn || 0,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch portfolio performance', 500, error);
  }
});

export default router;

