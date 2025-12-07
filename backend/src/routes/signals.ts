/**
 * Trading Signals Routes
 * AI trading signals and recommendations
 */

import express from 'express';
import { executeQuery } from '../config/db';
import { authenticateToken } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

/**
 * GET /api/signals/top
 * Get top trading signals
 */
router.get('/top', authenticateToken, async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit as string, 10) || 10;
    const assetType = req.query.assetType as string;

    let query = `
      SELECT TOP (@limit) *
      FROM vw_TopTradingSignals
    `;

    const params: any = { limit };

    if (assetType) {
      query += ` WHERE AssetType = @assetType`;
      params.assetType = assetType;
    }

    query += ` ORDER BY Confidence DESC, RiskRewardRatio DESC`;

    const result = await executeQuery(query, params);

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch trading signals', 500, error);
  }
});

/**
 * GET /api/signals/:signalId
 * Get specific signal with take-profit levels
 */
router.get('/:signalId', authenticateToken, async (req, res) => {
  try {
    const signalId = Number.parseInt(req.params.signalId, 10);

    const signalQuery = `
      SELECT * FROM TradingSignals WHERE SignalID = @signalId
    `;

    const tpQuery = `
      SELECT * FROM TakeProfitLevels 
      WHERE SignalID = @signalId 
      ORDER BY Level
    `;

    const [signalResult, tpResult] = await Promise.all([
      executeQuery(signalQuery, { signalId }),
      executeQuery(tpQuery, { signalId }),
    ]);

    if (signalResult.recordset.length === 0) {
      return errorResponse(res, 'Signal not found', 404);
    }

    const signal = signalResult.recordset[0] as Record<string, any>;
    const takeProfitLevels = tpResult.recordset;

    return successResponse(res, {
      ...signal,
      takeProfitLevels,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch signal', 500, error);
  }
});

/**
 * GET /api/signals/symbol/:symbol
 * Get signals for a specific symbol
 */
router.get('/symbol/:symbol', authenticateToken, async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const query = `
      SELECT *
      FROM TradingSignals
      WHERE Symbol = @symbol AND IsActive = 1
      ORDER BY PredictionDate DESC
    `;

    const result = await executeQuery(query, { symbol });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch signals for symbol', 500, error);
  }
});

/**
 * GET /api/signals/historical
 * Get historical signals with actual trade outcomes
 */
router.get('/historical', authenticateToken, async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit as string, 10) || 20;
    const offset = Number.parseInt(req.query.offset as string, 10) || 0;
    const assetType = req.query.assetType as string;
    const outcome = req.query.outcome as string; // 'win' | 'loss' | 'pending' | 'all'

    let query = `
      SELECT 
        SignalID, Symbol, AssetType, Signal, Confidence, PredictionDate,
        EntryPrice, TakeProfit1, TakeProfit2, TakeProfit3, StopLoss,
        RiskRewardRatio, ExpectedReturn, ModelVersion, Reasoning,
        ActualEntryPrice, ActualExitPrice, ActualPnL, ActualReturn,
        DaysHeld, Outcome, TradeID
      FROM vw_HistoricalSignals
      WHERE 1=1
    `;

    const params: any = { limit, offset };

    if (assetType) {
      query += ` AND AssetType = @assetType`;
      params.assetType = assetType;
    }

    if (outcome && outcome !== 'all') {
      query += ` AND Outcome = @outcome`;
      params.outcome = outcome;
    }

    query += ` ORDER BY PredictionDate DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY`;

    const result = await executeQuery(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as Total
      FROM vw_HistoricalSignals
      WHERE 1=1
    `;
    const countParams: any = {};
    
    if (assetType) {
      countQuery += ` AND AssetType = @assetType`;
      countParams.assetType = assetType;
    }

    if (outcome && outcome !== 'all') {
      countQuery += ` AND Outcome = @outcome`;
      countParams.outcome = outcome;
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = (countResult.recordset[0] as { Total?: number })?.Total || 0;

    return successResponse(res, {
      data: result.recordset,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch historical signals', 500, error);
  }
});

export default router;

