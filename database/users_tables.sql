-- WealthArena Users and User-Related Tables
-- Tables referenced by backend routes but missing from azure_sql_schema.sql
-- Execute this script BEFORE stored_procedures.sql

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- 1. Users Table
-- Core user authentication table
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'Users') AND type in (N'U'))
BEGIN
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FirstName NVARCHAR(100),
    LastName NVARCHAR(100),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    LastLogin DATETIME2,
    INDEX IX_Users_Email (Email),
    INDEX IX_Users_Username (Username)
);
END
GO

-- =============================================
-- 2. UserProfiles Table
-- Extended user profile information
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'UserProfiles') AND type in (N'U'))
BEGIN
CREATE TABLE UserProfiles (
    UserID INT PRIMARY KEY,
    DisplayName NVARCHAR(100),
    Tier NVARCHAR(20) DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced', 'expert'
    TotalXP INT DEFAULT 0,
    CurrentLevel INT DEFAULT 1,
    TotalCoins INT DEFAULT 0,
    WinRate DECIMAL(18,6) DEFAULT 0.0,
    TotalTrades INT DEFAULT 0,
    CurrentStreak INT DEFAULT 0,
    Bio NVARCHAR(500),
    AvatarURL NVARCHAR(500),
    AvatarType NVARCHAR(50), -- 'mascot', 'custom'
    AvatarVariant NVARCHAR(50), -- 'excited', 'confident', 'focused', etc.
    RiskProfile NVARCHAR(20), -- 'conservative', 'moderate', 'aggressive'
    InvestmentGoals NVARCHAR(MAX), -- JSON array
    TimeHorizon NVARCHAR(20), -- 'short', 'medium', 'long'
    LearningStyle NVARCHAR(20), -- 'visual', 'reading', 'interactive', 'structured'
    InterestAreas NVARCHAR(MAX), -- JSON array
    HasCompletedOnboarding BIT DEFAULT 0,
    OnboardingCompletedAt DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    INDEX IX_UserProfiles_Tier (Tier),
    INDEX IX_UserProfiles_TotalXP (TotalXP),
    INDEX IX_UserProfiles_WinRate (WinRate)
);
END
GO

-- =============================================
-- 3. Achievements Tables
-- User achievements and unlocks
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'Achievements') AND type in (N'U'))
BEGIN
CREATE TABLE Achievements (
    AchievementID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    Icon NVARCHAR(100),
    XPReward INT DEFAULT 0,
    CoinReward INT DEFAULT 0,
    Rarity NVARCHAR(20), -- 'common', 'rare', 'epic', 'legendary'
    Category NVARCHAR(50), -- 'trading', 'learning', 'social', 'competition'
    CreatedAt DATETIME2 DEFAULT GETUTCDATE()
);
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'UserAchievements') AND type in (N'U'))
BEGIN
CREATE TABLE UserAchievements (
    UserID INT NOT NULL,
    AchievementID INT NOT NULL,
    UnlockedAt DATETIME2 DEFAULT GETUTCDATE(),
    PRIMARY KEY (UserID, AchievementID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (AchievementID) REFERENCES Achievements(AchievementID) ON DELETE CASCADE,
    INDEX IX_UserAchievements_UnlockedAt (UnlockedAt)
);
END
GO

-- =============================================
-- 4. Quests Tables
-- User quests and progress tracking
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'Quests') AND type in (N'U'))
BEGIN
CREATE TABLE Quests (
    QuestID INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    QuestType NVARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'special'
    TargetValue INT NOT NULL, -- Target to complete quest
    XPReward INT DEFAULT 0,
    CoinReward INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE()
);
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'UserQuests') AND type in (N'U'))
BEGIN
CREATE TABLE UserQuests (
    UserID INT NOT NULL,
    QuestID INT NOT NULL,
    CurrentProgress INT DEFAULT 0,
    IsCompleted BIT DEFAULT 0,
    AssignedAt DATETIME2 DEFAULT GETUTCDATE(),
    CompletedAt DATETIME2,
    PRIMARY KEY (UserID, QuestID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (QuestID) REFERENCES Quests(QuestID) ON DELETE CASCADE,
    INDEX IX_UserQuests_IsCompleted (IsCompleted)
);
END
GO

-- =============================================
-- 5. UserFriends Table
-- User friendship/social connections
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'UserFriends') AND type in (N'U'))
BEGIN
CREATE TABLE UserFriends (
    UserID INT NOT NULL,
    FriendID INT NOT NULL,
    Status NVARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    PRIMARY KEY (UserID, FriendID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (FriendID) REFERENCES Users(UserID),
    INDEX IX_UserFriends_Status (Status)
);
END
GO

-- =============================================
-- 6. Competitions Tables
-- Trading competitions and participants
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'Competitions') AND type in (N'U'))
BEGIN
CREATE TABLE Competitions (
    CompetitionID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    StartDate DATETIME2 NOT NULL,
    EndDate DATETIME2 NOT NULL,
    EntryFee INT DEFAULT 0, -- In coins
    PrizePool INT DEFAULT 0, -- In coins
    MaxParticipants INT DEFAULT 100,
    CurrentParticipants INT DEFAULT 0,
    CompetitionType NVARCHAR(20) NOT NULL, -- 'tournament', 'challenge', 'league'
    Rules NVARCHAR(MAX), -- JSON rules
    Status NVARCHAR(20) DEFAULT 'upcoming', -- 'upcoming', 'active', 'completed'
    CreatedBy INT,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (CreatedBy) REFERENCES Users(UserID),
    INDEX IX_Competitions_Status (Status),
    INDEX IX_Competitions_StartDate (StartDate)
);
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'CompetitionParticipants') AND type in (N'U'))
BEGIN
CREATE TABLE CompetitionParticipants (
    CompetitionID INT NOT NULL,
    UserID INT NOT NULL,
    TotalReturns DECIMAL(18,6) DEFAULT 0,
    WinRate DECIMAL(18,6) DEFAULT 0,
    TotalTrades INT DEFAULT 0,
    ProfitFactor DECIMAL(18,6) DEFAULT 0,
    SharpeRatio DECIMAL(18,6) DEFAULT 0,
    MaxDrawdown DECIMAL(18,6) DEFAULT 0,
    CurrentStreak INT DEFAULT 0,
    TotalXP INT DEFAULT 0,
    LastUpdated DATETIME2 DEFAULT GETUTCDATE(),
    PRIMARY KEY (CompetitionID, UserID),
    FOREIGN KEY (CompetitionID) REFERENCES Competitions(CompetitionID) ON DELETE CASCADE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    INDEX IX_CompetitionParticipants_TotalReturns (TotalReturns)
);
END
GO

-- =============================================
-- 8. Leaderboard View
-- View for leaderboard queries
-- =============================================
IF OBJECT_ID('vw_Leaderboard', 'V') IS NOT NULL
    DROP VIEW vw_Leaderboard;
GO

CREATE VIEW vw_Leaderboard AS
SELECT 
    u.UserID,
    u.Username,
    up.DisplayName,
    up.AvatarURL,
    up.Tier,
    up.TotalXP,
    up.WinRate,
    up.TotalTrades,
    up.CurrentStreak,
    COALESCE(p.total_return, 0) as TotalReturns,
    COALESCE(p.sharpe_ratio, 0) as SharpeRatio,
    COALESCE(p.max_drawdown_actual, 0) as MaxDrawdown,
    COALESCE(p.profit_factor, 0) as ProfitFactor,
    COALESCE(p.updated_at, u.CreatedAt) as LastUpdated
FROM Users u
INNER JOIN UserProfiles up ON u.UserID = up.UserID
LEFT JOIN portfolios p ON u.UserID = CAST(p.user_id AS INT) AND p.is_active = 1
WHERE u.IsActive = 1;
GO

PRINT 'WealthArena users tables created successfully!';
PRINT 'Tables created: Users, UserProfiles, Achievements, UserAchievements, Quests, UserQuests, UserFriends, Competitions, CompetitionParticipants';
PRINT 'View created: vw_Leaderboard';
PRINT 'Note: game_sessions table is defined in azure_sql_schema.sql (standardized snake_case naming)';

