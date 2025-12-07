/**
 * Analytics Routes
 * Track user behavior, onboarding completion, and engagement metrics
 */

import express from 'express';
import { executeQuery } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

// Type definitions for analytics results
interface PortfolioData {
  id?: number;
  TotalInvested?: number;
  TotalValue?: number;
  TotalReturn?: number;
  SharpeRatio?: number;
  MaxDrawdown?: number;
}

interface TradingMetrics {
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  avg_win?: number;
  avg_loss?: number;
  total_wins?: number;
  total_losses?: number;
}

/**
 * POST /api/analytics/onboarding
 * Track onboarding analytics events
 */
router.post('/onboarding', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      event,
      sessionId,
      stage,
      questionCount,
      answerCount,
      questionId,
      questionType,
      answerLength,
      timeSpent,
      totalTime,
      totalQuestions,
      totalAnswers,
      rewards,
      mode,
      estimatedQuestions,
    } = req.body;

    // Insert analytics event
    const query = `
      INSERT INTO OnboardingAnalytics (
        UserID, Event, SessionID, Stage, QuestionCount, AnswerCount,
        QuestionID, QuestionType, AnswerLength, TimeSpent, TotalTime,
        TotalQuestions, TotalAnswers, Rewards, Mode, EstimatedQuestions,
        Timestamp
      ) VALUES (
        @userId, @event, @sessionId, @stage, @questionCount, @answerCount,
        @questionId, @questionType, @answerLength, @timeSpent, @totalTime,
        @totalQuestions, @totalAnswers, @rewards, @mode, @estimatedQuestions,
        GETUTCDATE()
      )
    `;

    await executeQuery(query, {
      userId,
      event,
      sessionId: sessionId || null,
      stage: stage || null,
      questionCount: questionCount || 0,
      answerCount: answerCount || 0,
      questionId: questionId || null,
      questionType: questionType || null,
      answerLength: answerLength || 0,
      timeSpent: timeSpent || 0,
      totalTime: totalTime || 0,
      totalQuestions: totalQuestions || 0,
      totalAnswers: totalAnswers || 0,
      rewards: rewards ? JSON.stringify(rewards) : null,
      mode: mode || 'unknown',
      estimatedQuestions: estimatedQuestions || 0,
    });

    return successResponse(res, { message: 'Analytics event tracked successfully' });
  } catch (error) {
    return errorResponse(res, 'Failed to track analytics event', 500, error);
  }
});

/**
 * GET /api/analytics/onboarding/summary
 * Get onboarding analytics summary
 */
router.get('/onboarding/summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Get user's onboarding analytics
    const userAnalyticsQuery = `
      SELECT 
        Event,
        COUNT(*) as count,
        AVG(TimeSpent) as avgTimeSpent,
        AVG(TotalTime) as avgTotalTime,
        AVG(QuestionCount) as avgQuestionCount,
        AVG(AnswerCount) as avgAnswerCount
      FROM OnboardingAnalytics 
      WHERE UserID = @userId
      GROUP BY Event
    `;

    const userResult = await executeQuery(userAnalyticsQuery, { userId });

    // Get global onboarding metrics
    const globalMetricsQuery = `
      SELECT 
        COUNT(DISTINCT UserID) as totalUsers,
        COUNT(CASE WHEN Event = 'onboarding_started' THEN 1 END) as startedCount,
        COUNT(CASE WHEN Event = 'onboarding_completed' THEN 1 END) as completedCount,
        AVG(CASE WHEN Event = 'onboarding_completed' THEN TotalTime END) as avgCompletionTime,
        AVG(CASE WHEN Event = 'onboarding_completed' THEN TotalQuestions END) as avgQuestionsCompleted
      FROM OnboardingAnalytics
    `;

    const globalResult = await executeQuery(globalMetricsQuery, {});

    return successResponse(res, {
      userAnalytics: userResult.recordset,
      globalMetrics: globalResult.recordset[0],
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch analytics summary', 500, error);
  }
});

/**
 * GET /api/analytics/onboarding/dropoff
 * Analyze onboarding drop-off points
 */
router.get('/onboarding/dropoff', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Analyze where users drop off during onboarding
    const dropoffQuery = `
      SELECT 
        Stage,
        COUNT(*) as dropoffCount,
        AVG(QuestionCount) as avgQuestionsBeforeDropoff,
        AVG(TimeSpent) as avgTimeBeforeDropoff
      FROM OnboardingAnalytics 
      WHERE Event IN ('onboarding_started', 'question_skipped', 'question_back_navigation')
      GROUP BY Stage
      ORDER BY dropoffCount DESC
    `;

    const result = await executeQuery(dropoffQuery, {});

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to analyze drop-off points', 500, error);
  }
});

/**
 * GET /api/analytics/onboarding/effectiveness
 * Analyze question effectiveness
 */
router.get('/onboarding/effectiveness', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Analyze question effectiveness
    const effectivenessQuery = `
      SELECT 
        QuestionID,
        QuestionType,
        COUNT(*) as totalAnswers,
        COUNT(CASE WHEN AnswerLength > 0 THEN 1 END) as answeredCount,
        AVG(TimeSpent) as avgTimeSpent,
        COUNT(CASE WHEN Event = 'question_skipped' THEN 1 END) as skipCount
      FROM OnboardingAnalytics 
      WHERE Event = 'question_answered' AND QuestionID IS NOT NULL
      GROUP BY QuestionID, QuestionType
      ORDER BY skipCount ASC, avgTimeSpent DESC
    `;

    const result = await executeQuery(effectivenessQuery, {});

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to analyze question effectiveness', 500, error);
  }
});

/**
 * GET /api/analytics/performance
 * Get portfolio performance analytics
 */
router.get('/performance', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { timeframe = '1M', portfolioId } = req.query;

    // Get user's portfolio(s)
    const portfolioQuery = portfolioId 
      ? `SELECT id FROM portfolios WHERE id = @portfolioId AND user_id = @userId`
      : `SELECT id FROM portfolios WHERE user_id = @userId AND is_active = 1`;

    const portfolioResult = await executeQuery(portfolioQuery, { userId, portfolioId: portfolioId || null });
    
    if (portfolioResult.recordset.length === 0) {
      return errorResponse(res, 'No portfolio found', 404);
    }

    const portfolioIdValue = (portfolioResult.recordset[0] as PortfolioData).id;

    // Calculate date range based on timeframe
    let dateFilter = '';
    const now = new Date();
    switch (timeframe) {
      case '1D':
        dateFilter = `DATEADD(day, -1, GETUTCDATE())`;
        break;
      case '1W':
        dateFilter = `DATEADD(day, -7, GETUTCDATE())`;
        break;
      case '1M':
        dateFilter = `DATEADD(month, -1, GETUTCDATE())`;
        break;
      case '3M':
        dateFilter = `DATEADD(month, -3, GETUTCDATE())`;
        break;
      case '1Y':
        dateFilter = `DATEADD(year, -1, GETUTCDATE())`;
        break;
      default:
        dateFilter = `DATEADD(month, -1, GETUTCDATE())`;
    }

    // Get portfolio overview from view
    const portfolioOverviewQuery = `
      SELECT *
      FROM vw_PortfolioPerformance
      WHERE PortfolioID = @portfolioIdValue
    `;
    const portfolioOverview = await executeQuery(portfolioOverviewQuery, { portfolioIdValue });
    const portfolioData = (portfolioOverview.recordset[0] as PortfolioData) || {} as PortfolioData;

    // Get time-series performance history
    const performanceHistoryQuery = `
      SELECT 
        CAST(trade_date AS DATE) as date,
        SUM(realized_pnl) as dailyPnL,
        SUM(trade_value) as dailyVolume
      FROM trades
      WHERE portfolio_id = @portfolioIdValue
        AND trade_date >= ${dateFilter}
      GROUP BY CAST(trade_date AS DATE)
      ORDER BY date ASC
    `;
    const performanceHistoryResult = await executeQuery(performanceHistoryQuery, { portfolioIdValue });
    
    // Calculate cumulative returns for equity curve
    const performanceHistory: any[] = [];
    const baseValue = portfolioData.TotalInvested || 100000;
    let cumulativeValue = baseValue;
    
    performanceHistoryResult.recordset.forEach((row: any, index: number) => {
      const dailyReturn = row.dailyPnL || 0;
      cumulativeValue += dailyReturn;
      performanceHistory.push({
        date: row.date,
        value: cumulativeValue,
        return: dailyReturn
      });
    });

    // Get allocation breakdown
    const allocationQuery = `
      SELECT 
        asset_class,
        COUNT(*) as position_count,
        SUM(quantity * avg_price) as total_value,
        SUM(unrealized_pnl) as unrealized_pnl
      FROM positions
      WHERE portfolio_id = @portfolioIdValue
      GROUP BY asset_class
    `;
    const allocationResult = await executeQuery(allocationQuery, { portfolioIdValue });
    
    // Calculate percentages
    const totalPortfolioValue = portfolioData.TotalValue || 100000;
    const allocationBreakdown: any = {};
    allocationResult.recordset.forEach((row: any) => {
      const percentage = ((row.total_value / totalPortfolioValue) * 100).toFixed(1);
      allocationBreakdown[row.asset_class.toLowerCase()] = parseFloat(percentage);
    });

    // Get trading metrics
    const tradingMetricsQuery = `
      SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN realized_pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
        AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl ELSE NULL END) as avg_win,
        AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl ELSE NULL END) as avg_loss,
        SUM(CASE WHEN realized_pnl > 0 THEN realized_pnl ELSE 0 END) as total_wins,
        ABS(SUM(CASE WHEN realized_pnl < 0 THEN realized_pnl ELSE 0 END)) as total_losses
      FROM trades
      WHERE portfolio_id = @portfolioIdValue
        AND trade_date >= ${dateFilter}
    `;
    const tradingMetricsResult = await executeQuery(tradingMetricsQuery, { portfolioIdValue });
    const metrics = (tradingMetricsResult.recordset[0] as TradingMetrics) || {} as TradingMetrics;

    // Calculate additional metrics
    const avgWin = metrics.avg_win || 0;
    const avgLoss = metrics.avg_loss || 0;
    const totalLosses = metrics.total_losses || 0;
    const totalWins = metrics.total_wins || 0;
    const totalTrades = metrics.total_trades || 0;
    const winningTrades = metrics.winning_trades || 0;
    const profitFactor = totalLosses > 0 ? (totalWins / totalLosses) : 0;
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100) : 0;

    // Calculate portfolio-level metrics
    const totalReturn = portfolioData.TotalReturn || 0;
    const totalInvested = portfolioData.TotalInvested || 0;
    const totalReturnPercent = totalInvested > 0 
      ? ((totalReturn / totalInvested) * 100) 
      : 0;
    
    const result = {
      success: true,
      data: {
        portfolioData: {
          totalValue: portfolioData.TotalValue || 100000,
          totalReturn: totalReturn,
          totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
          sharpeRatio: portfolioData.SharpeRatio || 0,
          maxDrawdown: portfolioData.MaxDrawdown || 0,
          volatility: 12.3, // Placeholder - would need historical data for calculation
          beta: 0.95, // Placeholder
          alpha: 2.1, // Placeholder
          winRate: parseFloat(winRate.toFixed(1)),
          avgWin: parseFloat(avgWin.toFixed(2)),
          avgLoss: parseFloat(avgLoss.toFixed(2)),
          profitFactor: parseFloat(profitFactor.toFixed(2))
        },
        performanceHistory,
        allocationBreakdown: allocationBreakdown || {
          stocks: 0,
          etfs: 0,
          bonds: 0,
          crypto: 0,
          commodities: 0
        },
        tradingMetrics: {
          totalTrades: metrics.total_trades || 0,
          winningTrades: metrics.winning_trades || 0,
          losingTrades: metrics.losing_trades || 0
        }
      }
    };

    return successResponse(res, result.data);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch performance analytics', 500, error);
  }
});

export default router;
