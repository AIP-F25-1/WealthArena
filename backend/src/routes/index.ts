/**
 * Routes Index
 * Aggregates all API routes
 */

import express from 'express';
// Use mock auth routes for local development (in-memory database)
// For production, switch to './auth' for real database
import authRoutes from './auth-mock';
import signalsRoutes from './signals';
import portfolioRoutes from './portfolio';
import userRoutes from './user';
import chatRoutes from './chat';
import chatbotRoutes from './chatbot';
import rlAgentRoutes from './rl-agent';
import marketDataRoutes from './market-data';
import leaderboardRoutes from './leaderboard';
import strategiesRoutes from './strategies';
import notificationsRoutes from './notifications';
import analyticsRoutes from './analytics';
import gameRoutes from './game';
import learningRoutes from './learning';
import metricsRoutes from './metrics';

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/signals', signalsRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/user', userRoutes);
router.use('/chat', chatRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/rl-agent', rlAgentRoutes);
router.use('/market-data', marketDataRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/strategies', strategiesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/game', gameRoutes);
router.use('/learning', learningRoutes);
router.use('/metrics', metricsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WealthArena API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;

