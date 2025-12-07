/**
 * Chatbot API Proxy Routes
 * Proxies requests to the WealthArena Chatbot API
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Chatbot API base URL (configurable via environment variable)
const CHATBOT_API_URL = process.env.CHATBOT_API_URL || 'http://localhost:8000';

interface OnboardingSession {
  userId: number;
  firstName: string;
  email: string;
  startTime: Date;
  conversationHistory: unknown[];
  userAnswers: unknown[];
  stage: string;
}

// In-memory storage for onboarding sessions (in production, use Redis or database)
const onboardingSessions = new Map<string, OnboardingSession>();

/**
 * POST /api/chatbot/chat
 * Send a message to the AI chatbot
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, user_id, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Log the chatbot API URL being used
    // eslint-disable-next-line no-console
    console.log(`[CHATBOT] Forwarding chat request to chatbot service: ${CHATBOT_API_URL}/v1/chat`);

    // Forward request to chatbot API
    const response = await axios.post(`${CHATBOT_API_URL}/v1/chat`, {
      message,
      user_id,
      context,
    }, {
      timeout: 30000, // 30 second timeout
    });

    // eslint-disable-next-line no-console
    console.log(`[CHATBOT] API response received successfully`);
    
    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; code?: string; message?: string };
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = axiosError.response?.status || 500;
    
    // Detailed error logging
    // eslint-disable-next-line no-console
    console.error('[CHATBOT ERROR] Error calling chatbot API:');
    // eslint-disable-next-line no-console
    console.error(`   URL: ${CHATBOT_API_URL}/v1/chat`);
    // eslint-disable-next-line no-console
    console.error(`   Error Code: ${axiosError.code || 'N/A'}`);
    // eslint-disable-next-line no-console
    console.error(`   HTTP Status: ${statusCode}`);
    // eslint-disable-next-line no-console
    console.error(`   Error Message: ${errorMessage}`);
    if (axiosError.response?.data) {
      // eslint-disable-next-line no-console
      console.error(`   Response Data:`, JSON.stringify(axiosError.response.data, null, 2));
    }
    
    // Provide helpful error messages based on error type
    let userMessage = 'Failed to get chatbot response';
    if (axiosError.code === 'ECONNREFUSED') {
      userMessage = 'Chatbot service is not running. Please start the chatbot service on port 8000.';
      // eslint-disable-next-line no-console
      console.error('   Tip: Make sure the chatbot service is running. Run: cd chatbot && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000');
    } else if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
      userMessage = 'Chatbot service request timed out. The service may be overloaded or not responding.';
    } else if (statusCode === 500) {
      userMessage = 'Chatbot service encountered an error. Please check if GROQ_API_KEY is configured.';
      // eslint-disable-next-line no-console
      console.error('   Tip: Check chatbot/.env file has GROQ_API_KEY set. Get key from: https://console.groq.com/keys');
    }
    
    res.status(statusCode).json({
      success: false,
      message: userMessage,
      error: errorMessage,
    });
  }
});

/**
 * GET /api/chatbot/history
 * Get chat history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${CHATBOT_API_URL}/v1/chat/history`);

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error getting chat history:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to get chat history',
      error: errorMessage,
    });
  }
});

/**
 * DELETE /api/chatbot/history
 * Clear chat history
 */
router.delete('/history', async (req: Request, res: Response) => {
  try {
    const response = await axios.delete(`${CHATBOT_API_URL}/v1/chat/history`);

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    // eslint-disable-next-line no-console
    console.error('Error clearing chat history:', errorMessage);
    res.status(statusCode).json({
      success: false,
      message: 'Failed to clear chat history',
      error: errorMessage,
    });
  }
});

/**
 * GET /api/chatbot/health
 * Check chatbot API health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${CHATBOT_API_URL}/healthz`);

    res.json({
      success: true,
      status: 'healthy',
      chatbot_api: response.data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('Chatbot API health check failed:', errorMessage);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Chatbot API is not available',
    });
  }
});

/**
 * POST /api/chatbot/onboarding/start
 * Start onboarding session
 */
router.post('/onboarding/start', async (req: Request, res: Response) => {
  try {
    const { firstName, email, userId } = req.body;

    if (!firstName || !email || !userId) {
      return res.status(400).json({
        success: false,
        error: 'firstName, email, and userId are required',
      });
    }

    // Generate session ID
    const sessionId = `onboarding_${userId}_${Date.now()}`;

    // Store session data
    onboardingSessions.set(sessionId, {
      userId,
      firstName,
      email,
      startTime: new Date(),
      conversationHistory: [],
      userAnswers: [],
      stage: 'welcome',
    });

    // Forward to chatbot service
    const response = await axios.post(`${CHATBOT_API_URL}/v1/onboarding/start`, {
      sessionId,
      firstName,
      email,
      userId,
    });

    res.json({
      success: true,
      sessionId,
      welcomeMessage: response.data.welcomeMessage || `Hi ${firstName}! 🎉 Welcome to WealthArena! I'm Foxy, your AI trading coach.`,
      estimatedQuestions: response.data.estimatedQuestions || 5,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('Error starting onboarding:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to start onboarding session',
    });
  }
});

/**
 * POST /api/chatbot/onboarding/respond
 * Send onboarding response and get next question
 */
router.post('/onboarding/respond', async (req: Request, res: Response) => {
  try {
    const { sessionId, answer, conversationHistory, userAnswers } = req.body;

    if (!sessionId || !answer) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and answer are required',
      });
    }

    // Get session data
    const sessionData = onboardingSessions.get(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Onboarding session not found',
      });
    }

    // Update session data
    sessionData.conversationHistory = conversationHistory || [];
    sessionData.userAnswers = userAnswers || [];
    onboardingSessions.set(sessionId, sessionData);

    // Forward to chatbot service
    const response = await axios.post(`${CHATBOT_API_URL}/v1/onboarding/respond`, {
      sessionId,
      answer,
      conversationHistory,
      userAnswers,
      userContext: {
        userId: sessionData.userId,
        firstName: sessionData.firstName,
        email: sessionData.email,
      },
    });

    res.json({
      success: true,
      nextQuestion: response.data.nextQuestion,
      estimatedRemaining: response.data.estimatedRemaining,
      profileUpdates: response.data.profileUpdates,
      complete: response.data.complete,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('Error processing onboarding response:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to process onboarding response',
    });
  }
});

/**
 * POST /api/chatbot/onboarding/complete
 * Complete onboarding and get final profile
 */
router.post('/onboarding/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId, conversationHistory, userAnswers, userProfile } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required',
      });
    }

    // Get session data
    const sessionData = onboardingSessions.get(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Onboarding session not found',
      });
    }

    // Forward to chatbot service
    const response = await axios.post(`${CHATBOT_API_URL}/v1/onboarding/complete`, {
      sessionId,
      conversationHistory,
      userAnswers,
      userProfile,
      userContext: {
        userId: sessionData.userId,
        firstName: sessionData.firstName,
        email: sessionData.email,
      },
    });

    // Clean up session data
    onboardingSessions.delete(sessionId);

    res.json({
      success: true,
      completionMessage: response.data.completionMessage || '🎉 Congratulations! Your profile is ready. Let\'s get you started!',
      finalProfile: response.data.finalProfile,
      rewards: response.data.rewards || { xp: 50, coins: 500 },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('Error completing onboarding:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to complete onboarding',
    });
  }
});

export default router;

/**
 * Game API proxies (from wealtharena_chatbot app/api/game.py)
 * Exposes the FastAPI game endpoints via our Node backend under /api/chatbot/game
 */
// List available episodes/scenarios
router.get('/game/episodes', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${CHATBOT_API_URL}/v1/game/episodes`);
    res.json({ success: true, data: response.data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to fetch game episodes',
      error: errorMessage,
    });
  }
});

// Start a new game session
router.post('/game/start', async (req: Request, res: Response) => {
  try {
    // Validate and sanitize CHATBOT_API_URL to prevent URL injection
    // Use allowlist of trusted domains and protocols
    const allowedProtocols = ['http:', 'https:'];
    const allowedHosts = ['localhost', '127.0.0.1', '10.0.2.2']; // Add your trusted hosts
    
    const chatbotUrl = new URL(CHATBOT_API_URL);
    
    // Validate protocol and hostname
    if (!allowedProtocols.includes(chatbotUrl.protocol)) {
      throw new Error('Invalid protocol in CHATBOT_API_URL');
    }
    
    // In development, allow localhost and local IPs. In production, restrict further.
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment) {
      // In production, you should have specific trusted domains
      // For now, we'll allow the configured URL but log a warning
      console.warn('Production environment detected. Ensure CHATBOT_API_URL points to trusted domain.');
    } else if (!allowedHosts.includes(chatbotUrl.hostname) && !chatbotUrl.hostname.match(/^192\.168\.\d+\.\d+$/)) {
      throw new Error('Invalid hostname in CHATBOT_API_URL');
    }
    
    // Construct the endpoint URL safely
    const gameStartUrl = new URL('/v1/game/start', chatbotUrl.origin);
    const response = await axios.post(gameStartUrl.toString(), req.body);
    res.json({ success: true, data: response.data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to start game',
      error: errorMessage,
    });
  }
});

// Advance game time (tick)
router.post('/game/tick', async (req: Request, res: Response) => {
  try {
    // Validate and sanitize CHATBOT_API_URL to prevent URL injection
    const allowedProtocols = ['http:', 'https:'];
    const allowedHosts = ['localhost', '127.0.0.1', '10.0.2.2'];
    
    const chatbotUrl = new URL(CHATBOT_API_URL);
    
    if (!allowedProtocols.includes(chatbotUrl.protocol)) {
      throw new Error('Invalid protocol in CHATBOT_API_URL');
    }
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment) {
      console.warn('Production environment detected. Ensure CHATBOT_API_URL points to trusted domain.');
    } else if (!allowedHosts.includes(chatbotUrl.hostname) && !chatbotUrl.hostname.match(/^192\.168\.\d+\.\d+$/)) {
      throw new Error('Invalid hostname in CHATBOT_API_URL');
    }
    
    const gameTickUrl = new URL('/v1/game/tick', chatbotUrl.origin);
    const response = await axios.post(gameTickUrl.toString(), req.body);
    res.json({ success: true, data: response.data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to tick game',
      error: errorMessage,
    });
  }
});

// Execute trades
router.post('/game/trade', async (req: Request, res: Response) => {
  try {
    // Validate and sanitize CHATBOT_API_URL to prevent URL injection
    const allowedProtocols = ['http:', 'https:'];
    const allowedHosts = ['localhost', '127.0.0.1', '10.0.2.2'];
    
    const chatbotUrl = new URL(CHATBOT_API_URL);
    
    if (!allowedProtocols.includes(chatbotUrl.protocol)) {
      throw new Error('Invalid protocol in CHATBOT_API_URL');
    }
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment) {
      console.warn('Production environment detected. Ensure CHATBOT_API_URL points to trusted domain.');
    } else if (!allowedHosts.includes(chatbotUrl.hostname) && !chatbotUrl.hostname.match(/^192\.168\.\d+\.\d+$/)) {
      throw new Error('Invalid hostname in CHATBOT_API_URL');
    }
    
    const gameTradeUrl = new URL('/v1/game/trade', chatbotUrl.origin);
    const response = await axios.post(gameTradeUrl.toString(), req.body);
    res.json({ success: true, data: response.data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to execute trade',
      error: errorMessage,
    });
  }
});

// Get portfolio state
router.get('/game/portfolio', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${CHATBOT_API_URL}/v1/game/portfolio`, { params: req.query });
    res.json({ success: true, data: response.data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to fetch portfolio',
      error: errorMessage,
    });
  }
});

// Get game summary/metrics
router.get('/game/summary', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${CHATBOT_API_URL}/v1/game/summary`, { params: req.query });
    res.json({ success: true, data: response.data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { response?: { status?: number } })?.response?.status || 500;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to fetch game summary',
      error: errorMessage,
    });
  }
});

