/**
 * AI Chat Routes
 * Chatbot messages, sessions, and feedback
 */

import express from 'express';
import { executeQuery, executeProcedure } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';

const router = express.Router();

// Type definitions for chat results
interface ChatSessionResult {
  SessionID: number;
}

interface ChatMessageResult {
  MessageID: number;
}

/**
 * POST /api/chat/session
 * Get or create chat session
 */
router.post('/session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sessionType } = req.body;

    const result = await executeProcedure('sp_GetOrCreateChatSession', {
      UserID: userId,
      SessionType: sessionType || 'general',
    });

    return successResponse(res, {
      sessionId: (result.recordset[0] as ChatSessionResult).SessionID,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to create chat session', 500, error);
  }
});

/**
 * GET /api/chat/history
 * Get chat history
 */
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const sessionId = req.query.sessionId ? Number.parseInt(req.query.sessionId as string, 10) : null;
    const limit = Number.parseInt(req.query.limit as string, 10) || 50;

    const result = await executeProcedure('sp_GetChatHistory', {
      UserID: userId,
      SessionID: sessionId,
      Limit: limit,
    });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch chat history', 500, error);
  }
});

/**
 * POST /api/chat/message
 * Save chat message
 */
router.post('/message', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      sessionId,
      senderType,
      messageType,
      messageText,
      messageData,
      aiModelVersion,
      aiConfidence,
      responseTime,
      userIntent,
    } = req.body;

    const result = await executeProcedure('sp_SaveChatMessage', {
      SessionID: sessionId,
      UserID: userId,
      SenderType: senderType,
      MessageType: messageType || 'text',
      MessageText: messageText,
      MessageData: messageData ? JSON.stringify(messageData) : null,
      AIModelVersion: aiModelVersion,
      AIConfidence: aiConfidence,
      ResponseTime: responseTime,
      UserIntent: userIntent,
    });

    return successResponse(res, {
      messageId: (result.recordset[0] as ChatMessageResult).MessageID,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to save message', 500, error);
  }
});

/**
 * POST /api/chat/feedback
 * Submit feedback for a message
 */
router.post('/feedback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      messageId,
      feedbackType,
      rating,
      thumbsUp,
      thumbsDown,
      feedbackText,
      wasHelpful,
      wasAccurate,
      wasClear,
    } = req.body;

    await executeProcedure('sp_SubmitChatFeedback', {
      MessageID: messageId,
      UserID: userId,
      FeedbackType: feedbackType,
      Rating: rating,
      ThumbsUp: thumbsUp,
      ThumbsDown: thumbsDown,
      FeedbackText: feedbackText,
      WasHelpful: wasHelpful,
      WasAccurate: wasAccurate,
      WasClear: wasClear,
    });

    return successResponse(res, { message: 'Feedback submitted successfully' });
  } catch (error) {
    return errorResponse(res, 'Failed to submit feedback', 500, error);
  }
});

/**
 * GET /api/chat/sessions
 * Get user's chat sessions
 */
router.get('/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const limit = Number.parseInt(req.query.limit as string, 10) || 20;

    const query = `
      SELECT TOP (@limit) *
      FROM ChatSessions
      WHERE UserID = @userId
      ORDER BY LastMessageAt DESC
    `;

    const result = await executeQuery(query, { userId, limit });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch chat sessions', 500, error);
  }
});

export default router;

