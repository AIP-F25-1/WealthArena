-- =============================================
-- WealthArena - AI Chatbot & Feedback Tables
-- =============================================
-- Add-on script for chat functionality
-- Run this AFTER the main AzureSQL_CreateTables.sql
-- =============================================

-- Drop existing tables if they exist
IF OBJECT_ID('ChatFeedback', 'U') IS NOT NULL DROP TABLE ChatFeedback;
IF OBJECT_ID('ChatMessages', 'U') IS NOT NULL DROP TABLE ChatMessages;
IF OBJECT_ID('ChatSessions', 'U') IS NOT NULL DROP TABLE ChatSessions;

GO

-- =============================================
-- CHATBOT TABLES
-- =============================================

-- Chat Sessions Table
CREATE TABLE ChatSessions (
    SessionID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    SessionTitle NVARCHAR(200),
    SessionType NVARCHAR(30) CHECK (SessionType IN ('general', 'trading', 'learning', 'support')) DEFAULT 'general',
    IsActive BIT DEFAULT 1,
    StartedAt DATETIME2 DEFAULT GETUTCDATE(),
    EndedAt DATETIME2,
    LastMessageAt DATETIME2,
    MessageCount INT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    INDEX IX_ChatSessions_UserID (UserID),
    INDEX IX_ChatSessions_IsActive (IsActive),
    INDEX IX_ChatSessions_StartedAt (StartedAt DESC)
);

-- Chat Messages Table
CREATE TABLE ChatMessages (
    MessageID BIGINT IDENTITY(1,1) PRIMARY KEY,
    SessionID INT NOT NULL,
    UserID INT NOT NULL,
    MessageType NVARCHAR(20) CHECK (MessageType IN ('text', 'signal', 'chart', 'strategy', 'news', 'system')) DEFAULT 'text',
    SenderType NVARCHAR(10) CHECK (SenderType IN ('user', 'bot')) NOT NULL,
    MessageText NVARCHAR(MAX),
    MessageData NVARCHAR(MAX), -- JSON for structured data (signals, charts, etc.)
    
    -- AI Response Metadata
    AIModelVersion NVARCHAR(50),
    AIConfidence DECIMAL(5,4),
    ResponseTime INT, -- milliseconds
    TokensUsed INT,
    
    -- Related Entities (optional links)
    RelatedSignalID INT,
    RelatedStrategyID INT,
    RelatedNewsID INT,
    
    -- Context & Intent
    UserIntent NVARCHAR(100), -- e.g., 'get_signals', 'learn_strategy', 'ask_question'
    DetectedEntities NVARCHAR(MAX), -- JSON array of detected entities (symbols, dates, etc.)
    
    -- Message Status
    IsRead BIT DEFAULT 0,
    ReadAt DATETIME2,
    IsStarred BIT DEFAULT 0,
    
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (SessionID) REFERENCES ChatSessions(SessionID) ON DELETE CASCADE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (RelatedSignalID) REFERENCES TradingSignals(SignalID),
    FOREIGN KEY (RelatedStrategyID) REFERENCES Strategies(StrategyID),
    FOREIGN KEY (RelatedNewsID) REFERENCES NewsArticles(ArticleID),
    INDEX IX_ChatMessages_SessionID (SessionID),
    INDEX IX_ChatMessages_UserID (UserID),
    INDEX IX_ChatMessages_CreatedAt (CreatedAt DESC),
    INDEX IX_ChatMessages_SenderType (SenderType)
);

-- Chat Feedback Table
CREATE TABLE ChatFeedback (
    FeedbackID INT IDENTITY(1,1) PRIMARY KEY,
    MessageID BIGINT NOT NULL,
    SessionID INT NOT NULL,
    UserID INT NOT NULL,
    
    -- Feedback Type
    FeedbackType NVARCHAR(20) CHECK (FeedbackType IN ('thumbs_up', 'thumbs_down', 'rating', 'detailed')) NOT NULL,
    
    -- Feedback Values
    Rating INT CHECK (Rating >= 1 AND Rating <= 5), -- 1-5 stars
    ThumbsUp BIT,
    ThumbsDown BIT,
    
    -- Detailed Feedback
    FeedbackCategory NVARCHAR(50), -- 'helpful', 'accurate', 'clear', 'fast', 'incorrect', 'unclear', 'slow'
    FeedbackText NVARCHAR(MAX), -- User's written feedback
    
    -- Context
    WasHelpful BIT,
    WasAccurate BIT,
    WasClear BIT,
    
    -- Issues (if negative feedback)
    IssueType NVARCHAR(50), -- 'wrong_info', 'not_relevant', 'too_slow', 'confusing', 'offensive'
    IssueDescription NVARCHAR(500),
    
    -- Metadata
    FeedbackData NVARCHAR(MAX), -- JSON for additional structured feedback
    
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (MessageID) REFERENCES ChatMessages(MessageID) ON DELETE CASCADE,
    FOREIGN KEY (SessionID) REFERENCES ChatSessions(SessionID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    INDEX IX_ChatFeedback_MessageID (MessageID),
    INDEX IX_ChatFeedback_UserID (UserID),
    INDEX IX_ChatFeedback_FeedbackType (FeedbackType),
    INDEX IX_ChatFeedback_Rating (Rating),
    INDEX IX_ChatFeedback_CreatedAt (CreatedAt DESC)
);

GO

-- =============================================
-- VIEWS FOR CHAT ANALYTICS
-- =============================================

-- Chat Session Summary View
CREATE VIEW vw_ChatSessionSummary AS
SELECT TOP 10000
    cs.SessionID,
    cs.UserID,
    u.Username,
    cs.SessionTitle,
    cs.SessionType,
    cs.MessageCount,
    cs.StartedAt,
    cs.EndedAt,
    cs.LastMessageAt,
    DATEDIFF(MINUTE, cs.StartedAt, ISNULL(cs.EndedAt, GETUTCDATE())) AS DurationMinutes,
    (SELECT COUNT(*) FROM ChatFeedback cf 
     WHERE cf.SessionID = cs.SessionID AND cf.ThumbsUp = 1) AS PositiveFeedbackCount,
    (SELECT COUNT(*) FROM ChatFeedback cf 
     WHERE cf.SessionID = cs.SessionID AND cf.ThumbsDown = 1) AS NegativeFeedbackCount
FROM ChatSessions cs
INNER JOIN Users u ON cs.UserID = u.UserID
ORDER BY cs.StartedAt DESC;

GO

-- AI Response Quality Metrics
CREATE VIEW vw_AIResponseQuality AS
SELECT TOP 1000
    cm.MessageID,
    cm.SessionID,
    cm.UserID,
    cm.AIModelVersion,
    cm.AIConfidence,
    cm.ResponseTime,
    cm.UserIntent,
    cf.Rating,
    cf.WasHelpful,
    cf.WasAccurate,
    cf.WasClear,
    cf.FeedbackType,
    cm.CreatedAt
FROM ChatMessages cm
LEFT JOIN ChatFeedback cf ON cm.MessageID = cf.MessageID
WHERE cm.SenderType = 'bot'
    AND cm.CreatedAt >= DATEADD(day, -30, GETUTCDATE())
ORDER BY cm.CreatedAt DESC;

GO

-- =============================================
-- STORED PROCEDURES FOR CHAT
-- =============================================

-- Create or Get Active Chat Session
CREATE PROCEDURE sp_GetOrCreateChatSession
    @UserID INT,
    @SessionType NVARCHAR(30) = 'general'
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @SessionID INT;
    
    -- Check for active session in last 30 minutes
    SELECT TOP 1 @SessionID = SessionID
    FROM ChatSessions
    WHERE UserID = @UserID 
        AND IsActive = 1
        AND LastMessageAt >= DATEADD(minute, -30, GETUTCDATE())
    ORDER BY LastMessageAt DESC;
    
    -- Create new session if none found
    IF @SessionID IS NULL
    BEGIN
        INSERT INTO ChatSessions (UserID, SessionType, SessionTitle)
        VALUES (@UserID, @SessionType, 'Chat ' + FORMAT(GETUTCDATE(), 'yyyy-MM-dd HH:mm'));
        
        SET @SessionID = SCOPE_IDENTITY();
    END
    
    SELECT @SessionID AS SessionID;
END;

GO

-- Save Chat Message
CREATE PROCEDURE sp_SaveChatMessage
    @SessionID INT,
    @UserID INT,
    @SenderType NVARCHAR(10),
    @MessageType NVARCHAR(20) = 'text',
    @MessageText NVARCHAR(MAX),
    @MessageData NVARCHAR(MAX) = NULL,
    @AIModelVersion NVARCHAR(50) = NULL,
    @AIConfidence DECIMAL(5,4) = NULL,
    @ResponseTime INT = NULL,
    @UserIntent NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @MessageID BIGINT;
    
    -- Insert message
    INSERT INTO ChatMessages (
        SessionID, UserID, SenderType, MessageType, MessageText, MessageData,
        AIModelVersion, AIConfidence, ResponseTime, UserIntent
    )
    VALUES (
        @SessionID, @UserID, @SenderType, @MessageType, @MessageText, @MessageData,
        @AIModelVersion, @AIConfidence, @ResponseTime, @UserIntent
    );
    
    SET @MessageID = SCOPE_IDENTITY();
    
    -- Update session
    UPDATE ChatSessions
    SET MessageCount = MessageCount + 1,
        LastMessageAt = GETUTCDATE(),
        UpdatedAt = GETUTCDATE()
    WHERE SessionID = @SessionID;
    
    SELECT @MessageID AS MessageID;
END;

GO

-- Submit Chat Feedback
CREATE PROCEDURE sp_SubmitChatFeedback
    @MessageID BIGINT,
    @UserID INT,
    @FeedbackType NVARCHAR(20),
    @Rating INT = NULL,
    @ThumbsUp BIT = NULL,
    @ThumbsDown BIT = NULL,
    @FeedbackText NVARCHAR(MAX) = NULL,
    @WasHelpful BIT = NULL,
    @WasAccurate BIT = NULL,
    @WasClear BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @SessionID INT;
    
    -- Get SessionID from MessageID
    SELECT @SessionID = SessionID FROM ChatMessages WHERE MessageID = @MessageID;
    
    -- Insert or update feedback
    IF EXISTS (SELECT 1 FROM ChatFeedback WHERE MessageID = @MessageID AND UserID = @UserID)
    BEGIN
        UPDATE ChatFeedback
        SET FeedbackType = @FeedbackType,
            Rating = @Rating,
            ThumbsUp = @ThumbsUp,
            ThumbsDown = @ThumbsDown,
            FeedbackText = @FeedbackText,
            WasHelpful = @WasHelpful,
            WasAccurate = @WasAccurate,
            WasClear = @WasClear,
            UpdatedAt = GETUTCDATE()
        WHERE MessageID = @MessageID AND UserID = @UserID;
    END
    ELSE
    BEGIN
        INSERT INTO ChatFeedback (
            MessageID, SessionID, UserID, FeedbackType, Rating,
            ThumbsUp, ThumbsDown, FeedbackText, WasHelpful, WasAccurate, WasClear
        )
        VALUES (
            @MessageID, @SessionID, @UserID, @FeedbackType, @Rating,
            @ThumbsUp, @ThumbsDown, @FeedbackText, @WasHelpful, @WasAccurate, @WasClear
        );
    END
    
    SELECT 'Feedback submitted successfully' AS Result;
END;

GO

-- Get Chat History
CREATE PROCEDURE sp_GetChatHistory
    @UserID INT,
    @SessionID INT = NULL,
    @Limit INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @SessionID IS NULL
    BEGIN
        -- Get latest session
        SELECT TOP 1 @SessionID = SessionID
        FROM ChatSessions
        WHERE UserID = @UserID
        ORDER BY LastMessageAt DESC;
    END
    
    -- Return messages
    SELECT TOP (@Limit)
        MessageID,
        SessionID,
        MessageType,
        SenderType,
        MessageText,
        MessageData,
        AIConfidence,
        UserIntent,
        CreatedAt,
        IsStarred
    FROM ChatMessages
    WHERE SessionID = @SessionID
    ORDER BY CreatedAt ASC;
END;

GO

-- =============================================
-- TRIGGERS FOR CHAT
-- =============================================

-- Update session timestamp on new message
CREATE TRIGGER tr_ChatMessages_UpdateSession
ON ChatMessages
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE ChatSessions
    SET LastMessageAt = GETUTCDATE(),
        UpdatedAt = GETUTCDATE()
    WHERE SessionID IN (SELECT DISTINCT SessionID FROM inserted);
END;

GO

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Additional composite indexes
CREATE INDEX IX_ChatMessages_SessionID_CreatedAt ON ChatMessages(SessionID, CreatedAt DESC);
CREATE INDEX IX_ChatMessages_UserID_SenderType ON ChatMessages(UserID, SenderType);
CREATE INDEX IX_ChatFeedback_MessageID_FeedbackType ON ChatFeedback(MessageID, FeedbackType);

GO

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

PRINT '=============================================';
PRINT 'AI Chatbot & Feedback Tables Created!';
PRINT '=============================================';
PRINT '';
PRINT 'Tables Created: 3';
PRINT '  - ChatSessions';
PRINT '  - ChatMessages';
PRINT '  - ChatFeedback';
PRINT '';
PRINT 'Views Created: 2';
PRINT '  - vw_ChatSessionSummary';
PRINT '  - vw_AIResponseQuality';
PRINT '';
PRINT 'Stored Procedures Created: 4';
PRINT '  - sp_GetOrCreateChatSession';
PRINT '  - sp_SaveChatMessage';
PRINT '  - sp_SubmitChatFeedback';
PRINT '  - sp_GetChatHistory';
PRINT '';
PRINT 'Triggers Created: 1';
PRINT '  - tr_ChatMessages_UpdateSession';
PRINT '';
PRINT 'Chatbot functionality ready!';
PRINT '=============================================';

