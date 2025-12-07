-- WealthArena Notifications and Onboarding Analytics Tables
-- Tables referenced by backend routes but missing from azure_sql_schema.sql
-- Execute this script after users_tables.sql and before stored_procedures.sql

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- 1. Notifications Table
-- User notifications and alerts
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'Notifications') AND type in (N'U'))
BEGIN
CREATE TABLE Notifications (
    NotificationID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    Type NVARCHAR(50) NOT NULL, -- 'market', 'portfolio', 'achievement', 'system', 'game_invite', 'social'
    Title NVARCHAR(200) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Data NVARCHAR(MAX) NULL, -- JSON data for additional information
    IsRead BIT DEFAULT 0,
    Priority NVARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    ReadAt DATETIME2 NULL,
    ExpiresAt DATETIME2 NULL,
    CONSTRAINT FK_Notifications_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);
PRINT 'Created Notifications table';
END
ELSE
BEGIN
PRINT 'Notifications table already exists';
END
GO

-- Create indexes for Notifications table (after table creation)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Notifications_UserID_IsRead' AND object_id = OBJECT_ID('Notifications'))
BEGIN
CREATE INDEX IX_Notifications_UserID_IsRead ON Notifications(UserID, IsRead);
PRINT 'Created index IX_Notifications_UserID_IsRead';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Notifications_CreatedAt' AND object_id = OBJECT_ID('Notifications'))
BEGIN
CREATE INDEX IX_Notifications_CreatedAt ON Notifications(CreatedAt DESC);
PRINT 'Created index IX_Notifications_CreatedAt';
END
GO

-- =============================================
-- 2. NotificationPreferences Table
-- User notification preferences
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'NotificationPreferences') AND type in (N'U'))
BEGIN
CREATE TABLE NotificationPreferences (
    UserID INT PRIMARY KEY,
    EmailNotifications BIT DEFAULT 1,
    PushNotifications BIT DEFAULT 1,
    SMSNotifications BIT DEFAULT 0,
    TradingAlerts BIT DEFAULT 1,
    NewsAlerts BIT DEFAULT 1,
    SocialAlerts BIT DEFAULT 1,
    SystemAlerts BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_NotificationPreferences_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);
PRINT 'Created NotificationPreferences table';
END
ELSE
BEGIN
PRINT 'NotificationPreferences table already exists';
END
GO

-- =============================================
-- 3. OnboardingAnalytics Table
-- Track user onboarding behavior and analytics
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'OnboardingAnalytics') AND type in (N'U'))
BEGIN
CREATE TABLE OnboardingAnalytics (
    AnalyticsID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    Event NVARCHAR(100) NOT NULL, -- 'onboarding_started', 'question_answered', 'question_skipped', 'onboarding_completed'
    SessionID NVARCHAR(100) NULL,
    Stage NVARCHAR(50) NULL,
    QuestionCount INT DEFAULT 0,
    AnswerCount INT DEFAULT 0,
    QuestionID NVARCHAR(100) NULL,
    QuestionType NVARCHAR(50) NULL,
    AnswerLength INT DEFAULT 0,
    TimeSpent INT DEFAULT 0, -- milliseconds
    TotalTime INT DEFAULT 0, -- total time in milliseconds
    TotalQuestions INT DEFAULT 0,
    TotalAnswers INT DEFAULT 0,
    Rewards NVARCHAR(MAX) NULL, -- JSON for rewards data
    Mode NVARCHAR(20) DEFAULT 'static', -- 'ai', 'static'
    EstimatedQuestions INT DEFAULT 0,
    Timestamp DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_OnboardingAnalytics_UserID FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);
PRINT 'Created OnboardingAnalytics table';
END
ELSE
BEGIN
PRINT 'OnboardingAnalytics table already exists';
END
GO

-- Create indexes for OnboardingAnalytics table (after table creation)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OnboardingAnalytics_UserID' AND object_id = OBJECT_ID('OnboardingAnalytics'))
BEGIN
CREATE INDEX IX_OnboardingAnalytics_UserID ON OnboardingAnalytics(UserID);
PRINT 'Created index IX_OnboardingAnalytics_UserID';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OnboardingAnalytics_Event' AND object_id = OBJECT_ID('OnboardingAnalytics'))
BEGIN
CREATE INDEX IX_OnboardingAnalytics_Event ON OnboardingAnalytics(Event);
PRINT 'Created index IX_OnboardingAnalytics_Event';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OnboardingAnalytics_Timestamp' AND object_id = OBJECT_ID('OnboardingAnalytics'))
BEGIN
CREATE INDEX IX_OnboardingAnalytics_Timestamp ON OnboardingAnalytics(Timestamp DESC);
PRINT 'Created index IX_OnboardingAnalytics_Timestamp';
END
GO

PRINT 'Notifications and Onboarding Analytics tables creation completed successfully';
GO

