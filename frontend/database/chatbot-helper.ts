/**
 * AI Chatbot Helper Functions
 * WealthArena - Chatbot Database Operations
 */

import { executeQuery, executeProcedure } from './db-connection';

// =============================================
// INTERFACES
// =============================================

export interface ChatSession {
  SessionID: number;
  UserID: number;
  SessionTitle: string;
  SessionType: 'general' | 'trading' | 'learning' | 'support';
  IsActive: boolean;
  StartedAt: Date;
  EndedAt?: Date;
  LastMessageAt?: Date;
  MessageCount: number;
}

export interface ChatMessage {
  MessageID: number;
  SessionID: number;
  UserID: number;
  MessageType: 'text' | 'signal' | 'chart' | 'strategy' | 'news' | 'system';
  SenderType: 'user' | 'bot';
  MessageText: string;
  MessageData?: any; // JSON data
  AIModelVersion?: string;
  AIConfidence?: number;
  ResponseTime?: number;
  TokensUsed?: number;
  RelatedSignalID?: number;
  RelatedStrategyID?: number;
  RelatedNewsID?: number;
  UserIntent?: string;
  DetectedEntities?: any; // JSON
  IsRead: boolean;
  ReadAt?: Date;
  IsStarred: boolean;
  CreatedAt: Date;
}

export interface ChatFeedback {
  FeedbackID: number;
  MessageID: number;
  SessionID: number;
  UserID: number;
  FeedbackType: 'thumbs_up' | 'thumbs_down' | 'rating' | 'detailed';
  Rating?: number; // 1-5
  ThumbsUp?: boolean;
  ThumbsDown?: boolean;
  FeedbackCategory?: string;
  FeedbackText?: string;
  WasHelpful?: boolean;
  WasAccurate?: boolean;
  WasClear?: boolean;
  IssueType?: string;
  IssueDescription?: string;
  CreatedAt: Date;
}

// =============================================
// CHAT SESSION OPERATIONS
// =============================================

/**
 * Get or create an active chat session for user
 */
export async function getOrCreateChatSession(
  userId: number,
  sessionType: 'general' | 'trading' | 'learning' | 'support' = 'general'
): Promise<number> {
  const result = await executeProcedure('sp_GetOrCreateChatSession', {
    UserID: userId,
    SessionType: sessionType,
  });
  
  return result.recordset[0].SessionID;
}

/**
 * Get user's chat sessions
 */
export async function getUserChatSessions(
  userId: number,
  limit: number = 20
): Promise<ChatSession[]> {
  const query = `
    SELECT TOP (@limit) *
    FROM ChatSessions
    WHERE UserID = @userId
    ORDER BY LastMessageAt DESC
  `;
  
  const result = await executeQuery(query, { userId, limit });
  return result.recordset;
}

/**
 * End/close a chat session
 */
export async function endChatSession(sessionId: number): Promise<void> {
  const query = `
    UPDATE ChatSessions
    SET IsActive = 0,
        EndedAt = GETUTCDATE(),
        UpdatedAt = GETUTCDATE()
    WHERE SessionID = @sessionId
  `;
  
  await executeQuery(query, { sessionId });
}

// =============================================
// CHAT MESSAGE OPERATIONS
// =============================================

/**
 * Save a chat message
 */
export async function saveChatMessage(params: {
  sessionId: number;
  userId: number;
  senderType: 'user' | 'bot';
  messageType?: 'text' | 'signal' | 'chart' | 'strategy' | 'news' | 'system';
  messageText: string;
  messageData?: any;
  aiModelVersion?: string;
  aiConfidence?: number;
  responseTime?: number;
  userIntent?: string;
}): Promise<number> {
  const result = await executeProcedure('sp_SaveChatMessage', {
    SessionID: params.sessionId,
    UserID: params.userId,
    SenderType: params.senderType,
    MessageType: params.messageType || 'text',
    MessageText: params.messageText,
    MessageData: params.messageData ? JSON.stringify(params.messageData) : null,
    AIModelVersion: params.aiModelVersion,
    AIConfidence: params.aiConfidence,
    ResponseTime: params.responseTime,
    UserIntent: params.userIntent,
  });
  
  return result.recordset[0].MessageID;
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(
  userId: number,
  sessionId?: number,
  limit: number = 50
): Promise<ChatMessage[]> {
  const result = await executeProcedure('sp_GetChatHistory', {
    UserID: userId,
    SessionID: sessionId,
    Limit: limit,
  });
  
  return result.recordset.map((msg: any) => ({
    ...msg,
    MessageData: msg.MessageData ? JSON.parse(msg.MessageData) : null,
  }));
}

/**
 * Get recent messages across all sessions
 */
export async function getRecentMessages(
  userId: number,
  limit: number = 100
): Promise<ChatMessage[]> {
  const query = `
    SELECT TOP (@limit)
      cm.*,
      cs.SessionTitle
    FROM ChatMessages cm
    INNER JOIN ChatSessions cs ON cm.SessionID = cs.SessionID
    WHERE cm.UserID = @userId
    ORDER BY cm.CreatedAt DESC
  `;
  
  const result = await executeQuery(query, { userId, limit });
  return result.recordset;
}

/**
 * Star/unstar a message
 */
export async function toggleMessageStar(
  messageId: number,
  isStarred: boolean
): Promise<void> {
  const query = `
    UPDATE ChatMessages
    SET IsStarred = @isStarred
    WHERE MessageID = @messageId
  `;
  
  await executeQuery(query, { messageId, isStarred });
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(messageId: number): Promise<void> {
  const query = `
    UPDATE ChatMessages
    SET IsRead = 1,
        ReadAt = GETUTCDATE()
    WHERE MessageID = @messageId
  `;
  
  await executeQuery(query, { messageId });
}

/**
 * Get starred messages
 */
export async function getStarredMessages(userId: number): Promise<ChatMessage[]> {
  const query = `
    SELECT *
    FROM ChatMessages
    WHERE UserID = @userId AND IsStarred = 1
    ORDER BY CreatedAt DESC
  `;
  
  const result = await executeQuery(query, { userId });
  return result.recordset;
}

// =============================================
// FEEDBACK OPERATIONS
// =============================================

/**
 * Submit feedback for a message
 */
export async function submitChatFeedback(params: {
  messageId: number;
  userId: number;
  feedbackType: 'thumbs_up' | 'thumbs_down' | 'rating' | 'detailed';
  rating?: number;
  thumbsUp?: boolean;
  thumbsDown?: boolean;
  feedbackText?: string;
  wasHelpful?: boolean;
  wasAccurate?: boolean;
  wasClear?: boolean;
}): Promise<void> {
  await executeProcedure('sp_SubmitChatFeedback', {
    MessageID: params.messageId,
    UserID: params.userId,
    FeedbackType: params.feedbackType,
    Rating: params.rating,
    ThumbsUp: params.thumbsUp,
    ThumbsDown: params.thumbsDown,
    FeedbackText: params.feedbackText,
    WasHelpful: params.wasHelpful,
    WasAccurate: params.wasAccurate,
    WasClear: params.wasClear,
  });
}

/**
 * Quick thumbs up
 */
export async function thumbsUp(messageId: number, userId: number): Promise<void> {
  await submitChatFeedback({
    messageId,
    userId,
    feedbackType: 'thumbs_up',
    thumbsUp: true,
    wasHelpful: true,
  });
}

/**
 * Quick thumbs down
 */
export async function thumbsDown(messageId: number, userId: number): Promise<void> {
  await submitChatFeedback({
    messageId,
    userId,
    feedbackType: 'thumbs_down',
    thumbsDown: true,
    wasHelpful: false,
  });
}

/**
 * Get feedback for a message
 */
export async function getMessageFeedback(messageId: number): Promise<ChatFeedback | null> {
  const query = `
    SELECT *
    FROM ChatFeedback
    WHERE MessageID = @messageId
  `;
  
  const result = await executeQuery(query, { messageId });
  return result.recordset[0] || null;
}

/**
 * Get user's feedback history
 */
export async function getUserFeedbackHistory(userId: number): Promise<ChatFeedback[]> {
  const query = `
    SELECT *
    FROM ChatFeedback
    WHERE UserID = @userId
    ORDER BY CreatedAt DESC
  `;
  
  const result = await executeQuery(query, { userId });
  return result.recordset;
}

// =============================================
// ANALYTICS & INSIGHTS
// =============================================

/**
 * Get chat session summary
 */
export async function getChatSessionSummary(
  userId?: number,
  limit: number = 50
): Promise<any[]> {
  const query = userId
    ? `
      SELECT TOP (@limit) *
      FROM vw_ChatSessionSummary
      WHERE UserID = @userId
      ORDER BY StartedAt DESC
    `
    : `
      SELECT TOP (@limit) *
      FROM vw_ChatSessionSummary
      ORDER BY StartedAt DESC
    `;
  
  const result = await executeQuery(query, { userId, limit });
  return result.recordset;
}

/**
 * Get AI response quality metrics
 */
export async function getAIResponseQuality(days: number = 7): Promise<any[]> {
  const query = `
    SELECT *
    FROM vw_AIResponseQuality
    WHERE CreatedAt >= DATEADD(day, -@days, GETUTCDATE())
    ORDER BY CreatedAt DESC
  `;
  
  const result = await executeQuery(query, { days });
  return result.recordset;
}

/**
 * Get average AI response metrics
 */
export async function getAIMetricsSummary(): Promise<{
  avgConfidence: number;
  avgResponseTime: number;
  avgRating: number;
  totalMessages: number;
  positiveFeedback: number;
  negativeFeedback: number;
}> {
  const query = `
    SELECT 
      AVG(AIConfidence) AS avgConfidence,
      AVG(ResponseTime) AS avgResponseTime,
      (SELECT AVG(CAST(Rating AS FLOAT)) FROM ChatFeedback WHERE Rating IS NOT NULL) AS avgRating,
      COUNT(*) AS totalMessages,
      (SELECT COUNT(*) FROM ChatFeedback WHERE ThumbsUp = 1) AS positiveFeedback,
      (SELECT COUNT(*) FROM ChatFeedback WHERE ThumbsDown = 1) AS negativeFeedback
    FROM ChatMessages
    WHERE SenderType = 'bot'
      AND CreatedAt >= DATEADD(day, -7, GETUTCDATE())
  `;
  
  const result = await executeQuery(query);
  return result.recordset[0];
}

/**
 * Get popular user intents
 */
export async function getPopularIntents(limit: number = 10): Promise<any[]> {
  const query = `
    SELECT TOP (@limit)
      UserIntent,
      COUNT(*) AS Count,
      AVG(AIConfidence) AS AvgConfidence
    FROM ChatMessages
    WHERE UserIntent IS NOT NULL
      AND CreatedAt >= DATEADD(day, -30, GETUTCDATE())
    GROUP BY UserIntent
    ORDER BY COUNT(*) DESC
  `;
  
  const result = await executeQuery(query, { limit });
  return result.recordset;
}

// =============================================
// SEARCH & FILTER
// =============================================

/**
 * Search messages by text
 */
export async function searchMessages(
  userId: number,
  searchTerm: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const query = `
    SELECT TOP (@limit) *
    FROM ChatMessages
    WHERE UserID = @userId
      AND MessageText LIKE '%' + @searchTerm + '%'
    ORDER BY CreatedAt DESC
  `;
  
  const result = await executeQuery(query, { userId, searchTerm, limit });
  return result.recordset;
}

/**
 * Get messages by intent
 */
export async function getMessagesByIntent(
  userId: number,
  intent: string
): Promise<ChatMessage[]> {
  const query = `
    SELECT *
    FROM ChatMessages
    WHERE UserID = @userId
      AND UserIntent = @intent
    ORDER BY CreatedAt DESC
  `;
  
  const result = await executeQuery(query, { userId, intent });
  return result.recordset;
}

// Export all functions
export default {
  // Sessions
  getOrCreateChatSession,
  getUserChatSessions,
  endChatSession,
  
  // Messages
  saveChatMessage,
  getChatHistory,
  getRecentMessages,
  toggleMessageStar,
  markMessageAsRead,
  getStarredMessages,
  
  // Feedback
  submitChatFeedback,
  thumbsUp,
  thumbsDown,
  getMessageFeedback,
  getUserFeedbackHistory,
  
  // Analytics
  getChatSessionSummary,
  getAIResponseQuality,
  getAIMetricsSummary,
  getPopularIntents,
  
  // Search
  searchMessages,
  getMessagesByIntent,
};

