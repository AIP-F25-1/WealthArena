/**
 * RL Agent API Proxy Routes
 * Proxies requests to the WealthArena RL Backend API
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// RL Agent API base URL (configurable via environment variable)
const RL_API_URL = process.env.RL_API_URL || 'http://localhost:8000';

/**
 * POST /api/rl-agent/market-data
 * Get market data for symbols
 */
router.post('/market-data', async (req: Request, res: Response) => {
  try {
    const { symbols, days = 30 } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        message: 'Symbols array is required',
      });
    }

    const response = await axios.post(`${RL_API_URL}/api/market-data`, {
      symbols,
      days,
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error getting market data:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to get market data',
      error: errorMessage,
    });
  }
});

/**
 * POST /api/rl-agent/predictions
 * Get model prediction for a symbol
 */
router.post('/predictions', async (req: Request, res: Response) => {
  try {
    const { symbol, horizon = 1 } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Symbol is required',
      });
    }

    const response = await axios.post(`${RL_API_URL}/api/predictions`, {
      symbol,
      horizon,
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error getting predictions:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to get predictions',
      error: errorMessage,
    });
  }
});

/**
 * POST /api/rl-agent/top-setups
 * Get top trading setups for an asset type
 */
router.post('/top-setups', async (req: Request, res: Response) => {
  try {
    const { asset_type, count = 3, risk_tolerance = 'medium' } = req.body;

    if (!asset_type) {
      return res.status(400).json({
        success: false,
        message: 'Asset type is required',
      });
    }

    const response = await axios.post(`${RL_API_URL}/api/top-setups`, {
      asset_type,
      count,
      risk_tolerance,
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error getting top setups:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to get top setups',
      error: errorMessage,
    });
  }
});

/**
 * POST /api/rl-agent/portfolio
 * Analyze portfolio
 */
router.post('/portfolio', async (req: Request, res: Response) => {
  try {
    const { symbols, weights } = req.body;

    if (!symbols || !weights || symbols.length !== weights.length) {
      return res.status(400).json({
        success: false,
        message: 'Symbols and weights arrays are required and must have equal length',
      });
    }

    const response = await axios.post(`${RL_API_URL}/api/portfolio`, {
      symbols,
      weights,
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error analyzing portfolio:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to analyze portfolio',
      error: errorMessage,
    });
  }
});

/**
 * POST /api/rl-agent/chat
 * Chat with RL chatbot
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const response = await axios.post(`${RL_API_URL}/api/chat`, {
      message,
      context,
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error chatting with RL bot:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to get RL chat response',
      error: errorMessage,
    });
  }
});

/**
 * GET /api/rl-agent/game/leaderboard
 * Get game leaderboard
 */
router.get('/game/leaderboard', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${RL_API_URL}/api/game/leaderboard`);

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error getting game leaderboard:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to get game leaderboard',
      error: errorMessage,
    });
  }
});

/**
 * GET /api/rl-agent/metrics/summary
 * Get system metrics
 */
router.get('/metrics/summary', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${RL_API_URL}/api/metrics/summary`);

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error getting system metrics:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to get system metrics',
      error: errorMessage,
    });
  }
});

/**
 * GET /api/rl-agent/health
 * Check RL API health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${RL_API_URL}/health`);

    res.json({
      success: true,
      status: 'healthy',
      rl_api: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('RL API health check failed:', errorMessage);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'RL API is not available',
    });
  }
});

export default router;

