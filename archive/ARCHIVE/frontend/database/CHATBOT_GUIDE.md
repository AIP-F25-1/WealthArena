# AI Chatbot & Feedback System - Guide

## 📋 Overview

This add-on provides complete database support for the WealthArena AI chatbot feature, including:
- ✅ Chat session management
- ✅ Message storage and retrieval
- ✅ User feedback collection
- ✅ AI response analytics
- ✅ Conversation history

---

## 🗄️ Database Tables

### 1. ChatSessions
Manages chat conversations between users and AI.

**Key Fields:**
- `SessionID` - Unique session identifier
- `UserID` - User who owns the session
- `SessionType` - Type: general, trading, learning, support
- `MessageCount` - Number of messages in session
- `IsActive` - Whether session is currently active
- `StartedAt`, `EndedAt`, `LastMessageAt` - Timestamps

### 2. ChatMessages
Stores individual messages in conversations.

**Key Fields:**
- `MessageID` - Unique message identifier
- `SessionID` - Parent session
- `SenderType` - 'user' or 'bot'
- `MessageType` - text, signal, chart, strategy, news, system
- `MessageText` - Actual message content
- `MessageData` - JSON for structured data (signals, charts)
- `AIConfidence` - AI confidence score
- `ResponseTime` - AI response time in ms
- `UserIntent` - Detected user intent
- `IsStarred` - User marked as important

### 3. ChatFeedback
Captures user feedback on AI responses.

**Key Fields:**
- `FeedbackID` - Unique feedback identifier
- `MessageID` - Message being rated
- `FeedbackType` - thumbs_up, thumbs_down, rating, detailed
- `Rating` - 1-5 star rating
- `ThumbsUp/ThumbsDown` - Quick feedback
- `WasHelpful`, `WasAccurate`, `WasClear` - Quality metrics
- `FeedbackText` - Detailed user comments

---

## 🚀 Setup Instructions

### Step 1: Run the Add-on Script

After running the main `AzureSQL_CreateTables.sql`, execute:

```sql
-- In Azure Data Studio or SSMS
-- Open: CHATBOT_TABLES_ADDON.sql
-- Execute the entire script
```

### Step 2: Verify Installation

```sql
-- Check tables created
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME LIKE 'Chat%'
ORDER BY TABLE_NAME;

-- Expected output:
-- ChatFeedback
-- ChatMessages
-- ChatSessions
```

### Step 3: Test with Sample Data

```sql
-- Create a test chat session
DECLARE @SessionID INT;
EXEC @SessionID = sp_GetOrCreateChatSession 
    @UserID = 1, 
    @SessionType = 'general';

-- Save a user message
DECLARE @MessageID BIGINT;
EXEC sp_SaveChatMessage
    @SessionID = @SessionID,
    @UserID = 1,
    @SenderType = 'user',
    @MessageText = 'What are the top trading signals today?';

-- Save AI response
EXEC sp_SaveChatMessage
    @SessionID = @SessionID,
    @UserID = 1,
    @SenderType = 'bot',
    @MessageText = 'Here are the top 3 signals...',
    @AIConfidence = 0.92,
    @ResponseTime = 1200,
    @UserIntent = 'get_signals';
```

---

## 💻 Integration Examples

### Using TypeScript Helper

```typescript
import chatbot from './database/chatbot-helper';

// Start a chat session
const sessionId = await chatbot.getOrCreateChatSession(userId, 'trading');

// Save user message
const userMsgId = await chatbot.saveChatMessage({
  sessionId,
  userId,
  senderType: 'user',
  messageText: 'Show me BTC signals'
});

// Save AI response
const botMsgId = await chatbot.saveChatMessage({
  sessionId,
  userId,
  senderType: 'bot',
  messageText: 'Here are the Bitcoin signals...',
  messageData: { signals: [...] }, // JSON data
  aiModelVersion: 'gpt-4',
  aiConfidence: 0.95,
  responseTime: 1500,
  userIntent: 'get_crypto_signals'
});

// Get conversation history
const messages = await chatbot.getChatHistory(userId, sessionId);

// Submit feedback
await chatbot.thumbsUp(botMsgId, userId);
// or
await chatbot.submitChatFeedback({
  messageId: botMsgId,
  userId,
  feedbackType: 'rating',
  rating: 5,
  wasHelpful: true,
  wasAccurate: true,
  wasClear: true,
  feedbackText: 'Great explanation!'
});
```

### React Native Integration

```typescript
import chatbot from './database/chatbot-helper';

export default function AIChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    // Get or create session
    const id = await chatbot.getOrCreateChatSession(userId, 'general');
    setSessionId(id);
    
    // Load history
    const history = await chatbot.getChatHistory(userId, id);
    setMessages(history);
  };

  const sendMessage = async (text: string) => {
    // Save user message
    const msgId = await chatbot.saveChatMessage({
      sessionId: sessionId!,
      userId,
      senderType: 'user',
      messageText: text
    });

    // Call AI API (your backend)
    const aiResponse = await callAIApi(text);

    // Save AI response
    await chatbot.saveChatMessage({
      sessionId: sessionId!,
      userId,
      senderType: 'bot',
      messageText: aiResponse.text,
      messageData: aiResponse.data,
      aiConfidence: aiResponse.confidence,
      responseTime: aiResponse.responseTime,
      userIntent: aiResponse.intent
    });

    // Reload messages
    const updated = await chatbot.getChatHistory(userId, sessionId!);
    setMessages(updated);
  };

  const handleFeedback = async (messageId: number, isPositive: boolean) => {
    if (isPositive) {
      await chatbot.thumbsUp(messageId, userId);
    } else {
      await chatbot.thumbsDown(messageId, userId);
    }
  };

  // ... render chat UI
}
```

---

## 📊 Analytics & Insights

### Get AI Performance Metrics

```typescript
// Overall AI quality
const metrics = await chatbot.getAIMetricsSummary();
console.log({
  avgConfidence: metrics.avgConfidence, // 0.87
  avgResponseTime: metrics.avgResponseTime, // 1200ms
  avgRating: metrics.avgRating, // 4.2/5
  positiveFeedback: metrics.positiveFeedback,
  negativeFeedback: metrics.negativeFeedback
});

// Popular user intents
const intents = await chatbot.getPopularIntents(10);
// [
//   { UserIntent: 'get_signals', Count: 145, AvgConfidence: 0.91 },
//   { UserIntent: 'explain_strategy', Count: 89, AvgConfidence: 0.88 },
//   ...
// ]

// Session summaries
const sessions = await chatbot.getChatSessionSummary(userId);
```

### SQL Analytics Queries

```sql
-- Messages per day
SELECT 
  CAST(CreatedAt AS DATE) AS Date,
  COUNT(*) AS TotalMessages,
  AVG(CASE WHEN SenderType = 'bot' THEN ResponseTime END) AS AvgResponseTime
FROM ChatMessages
WHERE CreatedAt >= DATEADD(day, -30, GETUTCDATE())
GROUP BY CAST(CreatedAt AS DATE)
ORDER BY Date DESC;

-- Feedback distribution
SELECT 
  FeedbackType,
  COUNT(*) AS Count,
  AVG(CAST(Rating AS FLOAT)) AS AvgRating
FROM ChatFeedback
GROUP BY FeedbackType;

-- Most helpful AI responses
SELECT TOP 10
  cm.MessageText,
  cm.AIConfidence,
  cf.Rating,
  cf.FeedbackText
FROM ChatMessages cm
INNER JOIN ChatFeedback cf ON cm.MessageID = cf.MessageID
WHERE cm.SenderType = 'bot'
  AND cf.WasHelpful = 1
  AND cf.Rating >= 4
ORDER BY cf.Rating DESC, cm.AIConfidence DESC;
```

---

## 🎯 Use Cases

### 1. Conversation History
```typescript
// Get user's recent chats
const sessions = await chatbot.getUserChatSessions(userId, 20);

// Get specific session
const messages = await chatbot.getChatHistory(userId, sessionId);

// Search through messages
const results = await chatbot.searchMessages(userId, 'bitcoin');
```

### 2. Starred/Important Messages
```typescript
// Star a message
await chatbot.toggleMessageStar(messageId, true);

// Get all starred messages
const starred = await chatbot.getStarredMessages(userId);
```

### 3. Feedback Collection
```typescript
// Quick feedback
await chatbot.thumbsUp(messageId, userId);

// Detailed feedback
await chatbot.submitChatFeedback({
  messageId,
  userId,
  feedbackType: 'detailed',
  rating: 4,
  wasHelpful: true,
  wasAccurate: true,
  wasClear: false,
  feedbackText: 'Helpful but could be clearer'
});
```

### 4. Intent Tracking
```typescript
// Save message with intent
await chatbot.saveChatMessage({
  sessionId,
  userId,
  senderType: 'bot',
  messageText: response,
  userIntent: 'get_portfolio_advice',
  messageData: { recommendations: [...] }
});

// Analyze intents
const popularIntents = await chatbot.getPopularIntents();
```

---

## 🔍 Query Reference

### Get Chat History
```sql
EXEC sp_GetChatHistory 
    @UserID = 1, 
    @SessionID = NULL,  -- NULL = latest session
    @Limit = 50;
```

### Create/Get Session
```sql
EXEC sp_GetOrCreateChatSession 
    @UserID = 1, 
    @SessionType = 'trading';
```

### Save Message
```sql
EXEC sp_SaveChatMessage
    @SessionID = 1,
    @UserID = 1,
    @SenderType = 'bot',
    @MessageText = 'Here are the signals...',
    @AIConfidence = 0.92,
    @UserIntent = 'get_signals';
```

### Submit Feedback
```sql
EXEC sp_SubmitChatFeedback
    @MessageID = 123,
    @UserID = 1,
    @FeedbackType = 'thumbs_up',
    @ThumbsUp = 1,
    @WasHelpful = 1;
```

---

## 📈 Performance Considerations

### Indexes
All tables have optimized indexes for:
- ✅ User lookups (`UserID`)
- ✅ Session queries (`SessionID`)
- ✅ Date-based queries (`CreatedAt`)
- ✅ Feedback analysis (`FeedbackType`, `Rating`)

### Cleanup Recommendations

```sql
-- Archive old sessions (older than 90 days, inactive)
DELETE FROM ChatSessions
WHERE IsActive = 0
  AND EndedAt < DATEADD(day, -90, GETUTCDATE());

-- Archive old messages (keeps recent 6 months)
DELETE FROM ChatMessages
WHERE CreatedAt < DATEADD(month, -6, GETUTCDATE())
  AND SessionID NOT IN (
    SELECT SessionID FROM ChatSessions WHERE IsActive = 1
  );
```

---

## 🔧 Maintenance

### Regular Tasks

```sql
-- Weekly: Update statistics
UPDATE STATISTICS ChatMessages;
UPDATE STATISTICS ChatFeedback;

-- Monthly: Rebuild indexes
ALTER INDEX ALL ON ChatMessages REBUILD;
ALTER INDEX ALL ON ChatSessions REBUILD;

-- Quarterly: Archive old data
-- (See cleanup queries above)
```

---

## 📊 Schema Summary

```
ChatSessions (1)
    ├── ChatMessages (N)
    │   └── ChatFeedback (0-1)
    │
    └── User relationship
        └── Links to Users table
```

### Foreign Keys
- `ChatSessions.UserID` → `Users.UserID` (CASCADE DELETE)
- `ChatMessages.SessionID` → `ChatSessions.SessionID` (CASCADE DELETE)
- `ChatMessages.UserID` → `Users.UserID`
- `ChatFeedback.MessageID` → `ChatMessages.MessageID` (CASCADE DELETE)
- `ChatFeedback.SessionID` → `ChatSessions.SessionID`
- `ChatFeedback.UserID` → `Users.UserID`

---

## ✅ Checklist

After installation:

- [ ] Run `CHATBOT_TABLES_ADDON.sql`
- [ ] Verify 3 tables created
- [ ] Verify 2 views created
- [ ] Verify 4 stored procedures created
- [ ] Test with sample data
- [ ] Import `chatbot-helper.ts` in your app
- [ ] Integrate with AI chat screen
- [ ] Test feedback collection
- [ ] Monitor analytics

---

## 🎉 You're Ready!

Your AI chatbot now has complete database support for:
- ✅ Persistent conversation history
- ✅ Multi-session management
- ✅ User feedback collection
- ✅ AI performance tracking
- ✅ Intent analysis
- ✅ Quality metrics

**Start building your AI chat experience!** 🚀

---

**Version**: 1.0.0  
**Created**: October 10, 2025  
**Integrates With**: WealthArena Database v1.0.0

