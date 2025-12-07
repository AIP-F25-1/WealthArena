-- =============================================
-- WealthArena - Complete Azure SQL Database Schema
-- =============================================
-- Created: October 10, 2025
-- Database: Azure SQL Database
-- Description: Comprehensive schema for WealthArena trading gamification platform
-- =============================================

-- Drop existing tables in correct order (foreign keys first)
IF OBJECT_ID('UserAchievements', 'U') IS NOT NULL DROP TABLE UserAchievements;
IF OBJECT_ID('UserStrategies', 'U') IS NOT NULL DROP TABLE UserStrategies;
IF OBJECT_ID('UserLearningProgress', 'U') IS NOT NULL DROP TABLE UserLearningProgress;
IF OBJECT_ID('LearningLessons', 'U') IS NOT NULL DROP TABLE LearningLessons;
IF OBJECT_ID('UserQuests', 'U') IS NOT NULL DROP TABLE UserQuests;
IF OBJECT_ID('TakeProfitLevels', 'U') IS NOT NULL DROP TABLE TakeProfitLevels;
IF OBJECT_ID('TradeEvents', 'U') IS NOT NULL DROP TABLE TradeEvents;
IF OBJECT_ID('Positions', 'U') IS NOT NULL DROP TABLE Positions;
IF OBJECT_ID('Trades', 'U') IS NOT NULL DROP TABLE Trades;
IF OBJECT_ID('PortfolioItems', 'U') IS NOT NULL DROP TABLE PortfolioItems;
IF OBJECT_ID('Portfolios', 'U') IS NOT NULL DROP TABLE Portfolios;
IF OBJECT_ID('Notifications', 'U') IS NOT NULL DROP TABLE Notifications;
IF OBJECT_ID('LeaderboardEntries', 'U') IS NOT NULL DROP TABLE LeaderboardEntries;
IF OBJECT_ID('CandleData', 'U') IS NOT NULL DROP TABLE CandleData;
IF OBJECT_ID('MarketData', 'U') IS NOT NULL DROP TABLE MarketData;
IF OBJECT_ID('NewsArticles', 'U') IS NOT NULL DROP TABLE NewsArticles;
IF OBJECT_ID('TradingSignals', 'U') IS NOT NULL DROP TABLE TradingSignals;
IF OBJECT_ID('DataFeeds', 'U') IS NOT NULL DROP TABLE DataFeeds;
IF OBJECT_ID('SystemLogs', 'U') IS NOT NULL DROP TABLE SystemLogs;
IF OBJECT_ID('LearningTopics', 'U') IS NOT NULL DROP TABLE LearningTopics;
IF OBJECT_ID('Quests', 'U') IS NOT NULL DROP TABLE Quests;
IF OBJECT_ID('Strategies', 'U') IS NOT NULL DROP TABLE Strategies;
IF OBJECT_ID('Achievements', 'U') IS NOT NULL DROP TABLE Achievements;
IF OBJECT_ID('UserProfiles', 'U') IS NOT NULL DROP TABLE UserProfiles;
IF OBJECT_ID('Users', 'U') IS NOT NULL DROP TABLE Users;

-- Drop existing views
IF OBJECT_ID('vw_UserDashboard', 'V') IS NOT NULL DROP VIEW vw_UserDashboard;
IF OBJECT_ID('vw_TopTradingSignals', 'V') IS NOT NULL DROP VIEW vw_TopTradingSignals;
IF OBJECT_ID('vw_Leaderboard', 'V') IS NOT NULL DROP VIEW vw_Leaderboard;
IF OBJECT_ID('vw_PortfolioPerformance', 'V') IS NOT NULL DROP VIEW vw_PortfolioPerformance;

-- Drop existing stored procedures
IF OBJECT_ID('sp_CreateUser', 'P') IS NOT NULL DROP PROCEDURE sp_CreateUser;
IF OBJECT_ID('sp_UpdateUserXP', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateUserXP;
IF OBJECT_ID('sp_CompleteQuest', 'P') IS NOT NULL DROP PROCEDURE sp_CompleteQuest;
IF OBJECT_ID('sp_UpdateLeaderboard', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateLeaderboard;

-- Drop existing triggers
IF OBJECT_ID('tr_UpdatePortfolioValue', 'TR') IS NOT NULL DROP TRIGGER tr_UpdatePortfolioValue;
IF OBJECT_ID('tr_Users_UpdateTimestamp', 'TR') IS NOT NULL DROP TRIGGER tr_Users_UpdateTimestamp;
IF OBJECT_ID('tr_UserProfiles_UpdateTimestamp', 'TR') IS NOT NULL DROP TRIGGER tr_UserProfiles_UpdateTimestamp;

GO

-- =============================================
-- USERS & AUTHENTICATION
-- =============================================

-- Users Table
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    FirstName NVARCHAR(100),
    LastName NVARCHAR(100),
    PhoneNumber NVARCHAR(20),
    IsEmailVerified BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    LastLogin DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_Users_Email (Email),
    INDEX IX_Users_Username (Username)
);

-- User Profiles Table (Extended user information)
CREATE TABLE UserProfiles (
    ProfileID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL UNIQUE,
    Tier NVARCHAR(20) CHECK (Tier IN ('beginner', 'intermediate', 'expert')) DEFAULT 'beginner',
    DisplayName NVARCHAR(100),
    AvatarURL NVARCHAR(500),
    Bio NVARCHAR(1000),
    TotalXP INT DEFAULT 0,
    CurrentLevel INT DEFAULT 1,
    TotalCoins INT DEFAULT 0,
    WinRate DECIMAL(5,2) DEFAULT 0.00,
    TotalTrades INT DEFAULT 0,
    CompletedChallenges INT DEFAULT 0,
    TotalChallenges INT DEFAULT 10,
    CurrentStreak INT DEFAULT 0,
    LongestStreak INT DEFAULT 0,
    JoinedDate DATETIME2 DEFAULT GETUTCDATE(),
    LastActivityDate DATETIME2,
    PreferredTheme NVARCHAR(20) DEFAULT 'dark',
    NotificationsEnabled BIT DEFAULT 1,
    ShowNews BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    INDEX IX_UserProfiles_UserID (UserID),
    INDEX IX_UserProfiles_TotalXP (TotalXP DESC),
    INDEX IX_UserProfiles_Tier (Tier)
);

-- =============================================
-- TRADING SIGNALS & AI
-- =============================================

-- Trading Signals Table
CREATE TABLE TradingSignals (
    SignalID INT IDENTITY(1,1) PRIMARY KEY,
    Symbol NVARCHAR(20) NOT NULL,
    PredictionDate DATETIME2 NOT NULL,
    AssetType NVARCHAR(20) CHECK (AssetType IN ('stock', 'crypto', 'forex', 'commodity', 'etf')) NOT NULL,
    
    -- Trading Signal
    Signal NVARCHAR(10) CHECK (Signal IN ('BUY', 'SELL', 'HOLD')) NOT NULL,
    Confidence DECIMAL(5,4) NOT NULL,
    ModelVersion NVARCHAR(50) NOT NULL,
    
    -- Entry Strategy
    EntryPrice DECIMAL(18,8) NOT NULL,
    EntryPriceMin DECIMAL(18,8),
    EntryPriceMax DECIMAL(18,8),
    EntryTiming NVARCHAR(20) CHECK (EntryTiming IN ('immediate', 'limit', 'market_open', 'market_close')),
    EntryReasoning NVARCHAR(MAX),
    
    -- Stop Loss
    StopLossPrice DECIMAL(18,8) NOT NULL,
    StopLossPercent DECIMAL(5,2) NOT NULL,
    StopLossType NVARCHAR(20) CHECK (StopLossType IN ('fixed', 'trailing', 'time-based')),
    TrailAmount DECIMAL(18,8),
    StopLossReasoning NVARCHAR(MAX),
    
    -- Risk Management
    RiskRewardRatio DECIMAL(10,2),
    MaxRiskPerShare DECIMAL(18,8),
    MaxRewardPerShare DECIMAL(18,8),
    WinProbability DECIMAL(5,4),
    ExpectedValue DECIMAL(18,8),
    
    -- Position Sizing
    RecommendedPercent DECIMAL(5,2),
    DollarAmount DECIMAL(18,2),
    Shares INT,
    MaxLoss DECIMAL(18,2),
    SizingMethod NVARCHAR(50) CHECK (SizingMethod IN ('Kelly Criterion', 'Fixed Percent', 'Volatility Based', 'Risk Parity')),
    KellyFraction DECIMAL(5,4),
    VolatilityAdjusted BIT DEFAULT 0,
    
    -- Model Metadata
    ModelType NVARCHAR(100),
    AgentsUsed NVARCHAR(MAX), -- JSON array
    TrainingDate DATETIME2,
    BacktestSharpe DECIMAL(10,4),
    FeatureImportance NVARCHAR(MAX), -- JSON object
    
    -- Technical Indicators
    RSI_Value DECIMAL(10,4),
    RSI_Status NVARCHAR(30),
    MACD_Value DECIMAL(10,4),
    MACD_Status NVARCHAR(30),
    ATR_Value DECIMAL(10,4),
    ATR_Status NVARCHAR(30),
    Volume_Value DECIMAL(10,4),
    Volume_Status NVARCHAR(30),
    Trend_Direction NVARCHAR(20),
    Trend_Strength NVARCHAR(20),
    
    -- Metadata
    IsActive BIT DEFAULT 1,
    IsTopPick BIT DEFAULT 0,
    MarketSession NVARCHAR(20) CHECK (MarketSession IN ('pre-market', 'market-open', 'market-close', 'after-hours')),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_TradingSignals_Symbol (Symbol),
    INDEX IX_TradingSignals_PredictionDate (PredictionDate DESC),
    INDEX IX_TradingSignals_Signal (Signal),
    INDEX IX_TradingSignals_AssetType (AssetType),
    INDEX IX_TradingSignals_IsTopPick (IsTopPick)
);

-- Take Profit Levels Table
CREATE TABLE TakeProfitLevels (
    TakeProfitID INT IDENTITY(1,1) PRIMARY KEY,
    SignalID INT NOT NULL,
    Level INT NOT NULL,
    Price DECIMAL(18,8) NOT NULL,
    PercentGain DECIMAL(5,2) NOT NULL,
    ClosePercent INT NOT NULL, -- Percentage of position to close
    Probability DECIMAL(5,4),
    Reasoning NVARCHAR(500),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (SignalID) REFERENCES TradingSignals(SignalID) ON DELETE CASCADE,
    INDEX IX_TakeProfitLevels_SignalID (SignalID),
    INDEX IX_TakeProfitLevels_Level (Level)
);

-- =============================================
-- PORTFOLIO MANAGEMENT
-- =============================================

-- Portfolios Table
CREATE TABLE Portfolios (
    PortfolioID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    PortfolioName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    TotalValue DECIMAL(18,2) DEFAULT 0.00,
    CashBalance DECIMAL(18,2) DEFAULT 100000.00, -- Starting balance
    TotalChange DECIMAL(18,2) DEFAULT 0.00,
    TotalChangePercent DECIMAL(5,2) DEFAULT 0.00,
    IsDefault BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    INDEX IX_Portfolios_UserID (UserID),
    INDEX IX_Portfolios_IsDefault (IsDefault)
);

-- Portfolio Items Table
CREATE TABLE PortfolioItems (
    PortfolioItemID INT IDENTITY(1,1) PRIMARY KEY,
    PortfolioID INT NOT NULL,
    Symbol NVARCHAR(20) NOT NULL,
    AssetName NVARCHAR(200),
    AssetType NVARCHAR(20) CHECK (AssetType IN ('stock', 'crypto', 'forex', 'commodity', 'etf')),
    Shares DECIMAL(18,8) NOT NULL,
    AverageCost DECIMAL(18,8) NOT NULL,
    CurrentPrice DECIMAL(18,8),
    CurrentValue DECIMAL(18,2),
    TotalCost DECIMAL(18,2),
    UnrealizedPnL DECIMAL(18,2),
    UnrealizedPnLPercent DECIMAL(5,2),
    DayChange DECIMAL(5,2) DEFAULT 0.00,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (PortfolioID) REFERENCES Portfolios(PortfolioID) ON DELETE CASCADE,
    INDEX IX_PortfolioItems_PortfolioID (PortfolioID),
    INDEX IX_PortfolioItems_Symbol (Symbol)
);

-- =============================================
-- TRADING & EXECUTION
-- =============================================

-- Trades Table
CREATE TABLE Trades (
    TradeID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    PortfolioID INT,
    SignalID INT, -- Optional link to AI signal
    Symbol NVARCHAR(20) NOT NULL,
    AssetType NVARCHAR(20) CHECK (AssetType IN ('stock', 'crypto', 'forex', 'commodity', 'etf')),
    TradeType NVARCHAR(10) CHECK (TradeType IN ('BUY', 'SELL')) NOT NULL,
    OrderType NVARCHAR(20) CHECK (OrderType IN ('market', 'limit', 'stop', 'stop-limit')) DEFAULT 'market',
    Quantity DECIMAL(18,8) NOT NULL,
    EntryPrice DECIMAL(18,8) NOT NULL,
    ExitPrice DECIMAL(18,8),
    StopLoss DECIMAL(18,8),
    TakeProfit DECIMAL(18,8),
    Status NVARCHAR(20) CHECK (Status IN ('open', 'closed', 'cancelled', 'pending')) DEFAULT 'pending',
    RealizedPnL DECIMAL(18,2),
    RealizedPnLPercent DECIMAL(5,2),
    Commission DECIMAL(18,2) DEFAULT 0.00,
    IsSimulated BIT DEFAULT 1, -- For gamification trades
    IsAITrade BIT DEFAULT 0, -- Was this based on AI signal?
    Notes NVARCHAR(MAX),
    EntryDate DATETIME2 DEFAULT GETUTCDATE(),
    ExitDate DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (PortfolioID) REFERENCES Portfolios(PortfolioID),
    FOREIGN KEY (SignalID) REFERENCES TradingSignals(SignalID),
    INDEX IX_Trades_UserID (UserID),
    INDEX IX_Trades_Symbol (Symbol),
    INDEX IX_Trades_Status (Status),
    INDEX IX_Trades_EntryDate (EntryDate DESC)
);

-- Positions Table (Current open positions)
CREATE TABLE Positions (
    PositionID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    PortfolioID INT NOT NULL,
    Symbol NVARCHAR(20) NOT NULL,
    Side NVARCHAR(10) CHECK (Side IN ('long', 'short')) NOT NULL,
    Quantity DECIMAL(18,8) NOT NULL,
    EntryPrice DECIMAL(18,8) NOT NULL,
    CurrentPrice DECIMAL(18,8),
    UnrealizedPnL DECIMAL(18,2),
    UnrealizedPnLPercent DECIMAL(5,2),
    StopLoss DECIMAL(18,8),
    TakeProfit DECIMAL(18,8),
    OpenedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (PortfolioID) REFERENCES Portfolios(PortfolioID),
    INDEX IX_Positions_UserID (UserID),
    INDEX IX_Positions_Symbol (Symbol),
    INDEX IX_Positions_PortfolioID (PortfolioID)
);

-- Trade Events Table (Trade simulation log)
CREATE TABLE TradeEvents (
    EventID INT IDENTITY(1,1) PRIMARY KEY,
    TradeID INT,
    UserID INT NOT NULL,
    EventType NVARCHAR(30) CHECK (EventType IN ('user_buy', 'user_sell', 'ai_buy', 'ai_sell', 'system', 'commentary')) NOT NULL,
    Trader NVARCHAR(10) CHECK (Trader IN ('user', 'ai', 'system')) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Price DECIMAL(18,8),
    Quantity DECIMAL(18,8),
    EventTimestamp DATETIME2 DEFAULT GETUTCDATE(),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (TradeID) REFERENCES Trades(TradeID) ON DELETE CASCADE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    INDEX IX_TradeEvents_TradeID (TradeID),
    INDEX IX_TradeEvents_UserID (UserID),
    INDEX IX_TradeEvents_EventTimestamp (EventTimestamp DESC)
);

-- =============================================
-- MARKET DATA
-- =============================================

-- Market Data Table (Current prices)
CREATE TABLE MarketData (
    MarketDataID INT IDENTITY(1,1) PRIMARY KEY,
    Symbol NVARCHAR(20) NOT NULL,
    AssetType NVARCHAR(20) CHECK (AssetType IN ('stock', 'crypto', 'forex', 'commodity', 'etf')),
    AssetName NVARCHAR(200),
    CurrentPrice DECIMAL(18,8) NOT NULL,
    OpenPrice DECIMAL(18,8),
    HighPrice DECIMAL(18,8),
    LowPrice DECIMAL(18,8),
    ClosePrice DECIMAL(18,8),
    Volume BIGINT,
    MarketCap DECIMAL(20,2),
    DayChange DECIMAL(5,2),
    DayChangePercent DECIMAL(5,2),
    LastUpdated DATETIME2 DEFAULT GETUTCDATE(),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_MarketData_Symbol (Symbol),
    INDEX IX_MarketData_AssetType (AssetType),
    INDEX IX_MarketData_LastUpdated (LastUpdated DESC)
);

-- Candle Data Table (Historical OHLCV data)
CREATE TABLE CandleData (
    CandleID BIGINT IDENTITY(1,1) PRIMARY KEY,
    Symbol NVARCHAR(20) NOT NULL,
    TimeFrame NVARCHAR(10) CHECK (TimeFrame IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w')) NOT NULL,
    Timestamp DATETIME2 NOT NULL,
    OpenPrice DECIMAL(18,8) NOT NULL,
    HighPrice DECIMAL(18,8) NOT NULL,
    LowPrice DECIMAL(18,8) NOT NULL,
    ClosePrice DECIMAL(18,8) NOT NULL,
    Volume BIGINT,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_CandleData_Symbol_TimeFrame (Symbol, TimeFrame),
    INDEX IX_CandleData_Timestamp (Timestamp DESC),
    UNIQUE (Symbol, TimeFrame, Timestamp)
);

-- =============================================
-- NEWS & CONTENT
-- =============================================

-- News Articles Table
CREATE TABLE NewsArticles (
    ArticleID INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(500) NOT NULL,
    Summary NVARCHAR(MAX),
    Content NVARCHAR(MAX),
    Source NVARCHAR(200),
    Author NVARCHAR(200),
    PublishedAt DATETIME2 NOT NULL,
    URL NVARCHAR(1000),
    ImageURL NVARCHAR(1000),
    Category NVARCHAR(30) CHECK (Category IN ('market', 'earnings', 'fed', 'crypto', 'forex', 'commodities')) NOT NULL,
    Impact NVARCHAR(10) CHECK (Impact IN ('high', 'medium', 'low')) DEFAULT 'medium',
    Sentiment NVARCHAR(10) CHECK (Sentiment IN ('positive', 'negative', 'neutral')) DEFAULT 'neutral',
    RelatedStocks NVARCHAR(MAX), -- JSON array
    RelatedCrypto NVARCHAR(MAX), -- JSON array
    ViewCount INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_NewsArticles_PublishedAt (PublishedAt DESC),
    INDEX IX_NewsArticles_Category (Category),
    INDEX IX_NewsArticles_Impact (Impact)
);

-- =============================================
-- GAMIFICATION
-- =============================================

-- Leaderboard Entries Table
CREATE TABLE LeaderboardEntries (
    LeaderboardID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    Rank INT NOT NULL,
    TotalXP INT NOT NULL,
    WinRate DECIMAL(5,2) NOT NULL,
    TotalTrades INT NOT NULL,
    CurrentStreak INT DEFAULT 0,
    Badge NVARCHAR(50),
    Season NVARCHAR(20), -- e.g., '2025-Q1'
    WeekNumber INT,
    MonthNumber INT,
    Year INT,
    IsAllTime BIT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    INDEX IX_LeaderboardEntries_Rank (Rank),
    INDEX IX_LeaderboardEntries_TotalXP (TotalXP DESC),
    INDEX IX_LeaderboardEntries_Season (Season),
    INDEX IX_LeaderboardEntries_UserID (UserID)
);

-- Achievements Table
CREATE TABLE Achievements (
    AchievementID INT IDENTITY(1,1) PRIMARY KEY,
    AchievementCode NVARCHAR(50) NOT NULL UNIQUE,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    IconName NVARCHAR(50),
    BadgeType NVARCHAR(50),
    XPReward INT DEFAULT 0,
    CoinReward INT DEFAULT 0,
    Tier NVARCHAR(20) CHECK (Tier IN ('beginner', 'intermediate', 'expert', 'all')) DEFAULT 'all',
    IsSecret BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_Achievements_AchievementCode (AchievementCode),
    INDEX IX_Achievements_Tier (Tier)
);

-- User Achievements Table
CREATE TABLE UserAchievements (
    UserAchievementID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    AchievementID INT NOT NULL,
    UnlockedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (AchievementID) REFERENCES Achievements(AchievementID),
    UNIQUE (UserID, AchievementID),
    INDEX IX_UserAchievements_UserID (UserID),
    INDEX IX_UserAchievements_UnlockedAt (UnlockedAt DESC)
);

-- Quests Table
CREATE TABLE Quests (
    QuestID INT IDENTITY(1,1) PRIMARY KEY,
    QuestCode NVARCHAR(50) NOT NULL UNIQUE,
    Title NVARCHAR(200) NOT NULL,
    Subtitle NVARCHAR(500),
    Description NVARCHAR(MAX),
    IconName NVARCHAR(50),
    QuestType NVARCHAR(30) CHECK (QuestType IN ('daily', 'weekly', 'monthly', 'special')) DEFAULT 'daily',
    TargetValue INT NOT NULL, -- e.g., 10 quizzes, 5 signals
    XPReward INT DEFAULT 0,
    CoinReward INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    StartDate DATETIME2,
    EndDate DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_Quests_QuestCode (QuestCode),
    INDEX IX_Quests_QuestType (QuestType),
    INDEX IX_Quests_IsActive (IsActive)
);

-- User Quests Table (Progress tracking)
CREATE TABLE UserQuests (
    UserQuestID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    QuestID INT NOT NULL,
    CurrentProgress INT DEFAULT 0,
    TargetValue INT NOT NULL,
    IsCompleted BIT DEFAULT 0,
    CompletedAt DATETIME2,
    StartedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (QuestID) REFERENCES Quests(QuestID),
    INDEX IX_UserQuests_UserID (UserID),
    INDEX IX_UserQuests_IsCompleted (IsCompleted)
);

-- =============================================
-- LEARNING & EDUCATION
-- =============================================

-- Learning Topics Table
CREATE TABLE LearningTopics (
    TopicID INT IDENTITY(1,1) PRIMARY KEY,
    TopicCode NVARCHAR(50) NOT NULL UNIQUE,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    IconName NVARCHAR(50),
    TotalLessons INT DEFAULT 0,
    RequiredTier NVARCHAR(20) CHECK (RequiredTier IN ('beginner', 'intermediate', 'expert')) DEFAULT 'beginner',
    DisplayOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_LearningTopics_TopicCode (TopicCode),
    INDEX IX_LearningTopics_DisplayOrder (DisplayOrder)
);

-- Learning Lessons Table
CREATE TABLE LearningLessons (
    LessonID INT IDENTITY(1,1) PRIMARY KEY,
    TopicID INT NOT NULL,
    LessonCode NVARCHAR(50) NOT NULL UNIQUE,
    Title NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX),
    VideoURL NVARCHAR(500),
    Duration INT, -- in minutes
    XPReward INT DEFAULT 10,
    CoinReward INT DEFAULT 5,
    DisplayOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (TopicID) REFERENCES LearningTopics(TopicID) ON DELETE CASCADE,
    INDEX IX_LearningLessons_TopicID (TopicID),
    INDEX IX_LearningLessons_LessonCode (LessonCode),
    INDEX IX_LearningLessons_DisplayOrder (DisplayOrder)
);

-- User Learning Progress Table
CREATE TABLE UserLearningProgress (
    ProgressID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    LessonID INT NOT NULL,
    TopicID INT NOT NULL,
    IsCompleted BIT DEFAULT 0,
    ProgressPercent INT DEFAULT 0,
    TimeSpent INT DEFAULT 0, -- in seconds
    QuizScore INT,
    CompletedAt DATETIME2,
    StartedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (LessonID) REFERENCES LearningLessons(LessonID),
    FOREIGN KEY (TopicID) REFERENCES LearningTopics(TopicID),
    UNIQUE (UserID, LessonID),
    INDEX IX_UserLearningProgress_UserID (UserID),
    INDEX IX_UserLearningProgress_TopicID (TopicID)
);

-- =============================================
-- STRATEGIES
-- =============================================

-- Strategies Table
CREATE TABLE Strategies (
    StrategyID INT IDENTITY(1,1) PRIMARY KEY,
    StrategyCode NVARCHAR(50) NOT NULL UNIQUE,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    FullDescription NVARCHAR(MAX),
    HowToApply NVARCHAR(MAX),
    Pros NVARCHAR(MAX), -- JSON array
    Cons NVARCHAR(MAX), -- JSON array
    Difficulty NVARCHAR(20) CHECK (Difficulty IN ('Easy', 'Medium', 'Hard', 'Expert')) DEFAULT 'Medium',
    WinRate DECIMAL(5,2),
    Profitability DECIMAL(5,2),
    RiskLevel NVARCHAR(20) CHECK (RiskLevel IN ('Very Low', 'Low', 'Medium', 'High', 'Very High')) DEFAULT 'Medium',
    TimeFrame NVARCHAR(30),
    Indicators NVARCHAR(MAX), -- JSON array
    RequiredTier NVARCHAR(20) CHECK (RequiredTier IN ('beginner', 'intermediate', 'expert')) DEFAULT 'beginner',
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_Strategies_StrategyCode (StrategyCode),
    INDEX IX_Strategies_Difficulty (Difficulty)
);

-- User Strategies Table (User's saved/favorited strategies)
CREATE TABLE UserStrategies (
    UserStrategyID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    StrategyID INT NOT NULL,
    IsFavorite BIT DEFAULT 0,
    CustomNotes NVARCHAR(MAX),
    TimesUsed INT DEFAULT 0,
    SuccessRate DECIMAL(5,2),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (StrategyID) REFERENCES Strategies(StrategyID),
    UNIQUE (UserID, StrategyID),
    INDEX IX_UserStrategies_UserID (UserID)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

-- Notifications Table
CREATE TABLE Notifications (
    NotificationID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    Type NVARCHAR(20) CHECK (Type IN ('market', 'portfolio', 'achievement', 'system', 'trade', 'social')) NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    ActionURL NVARCHAR(500),
    IconName NVARCHAR(50),
    Priority NVARCHAR(10) CHECK (Priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    IsRead BIT DEFAULT 0,
    ReadAt DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    INDEX IX_Notifications_UserID (UserID),
    INDEX IX_Notifications_IsRead (IsRead),
    INDEX IX_Notifications_CreatedAt (CreatedAt DESC)
);

-- =============================================
-- ADMIN & SYSTEM
-- =============================================

-- Data Feeds Table (For admin monitoring)
CREATE TABLE DataFeeds (
    FeedID INT IDENTITY(1,1) PRIMARY KEY,
    FeedName NVARCHAR(200) NOT NULL,
    Provider NVARCHAR(200),
    FeedType NVARCHAR(50),
    Status NVARCHAR(20) CHECK (Status IN ('active', 'inactive', 'error')) DEFAULT 'inactive',
    RecordsProcessed BIGINT DEFAULT 0,
    LastSuccessfulRun DATETIME2,
    LastError NVARCHAR(MAX),
    LastErrorAt DATETIME2,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_DataFeeds_Status (Status)
);

-- System Logs Table
CREATE TABLE SystemLogs (
    LogID BIGINT IDENTITY(1,1) PRIMARY KEY,
    LogLevel NVARCHAR(20) CHECK (LogLevel IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')) NOT NULL,
    Source NVARCHAR(200),
    Message NVARCHAR(MAX) NOT NULL,
    StackTrace NVARCHAR(MAX),
    UserID INT,
    IPAddress NVARCHAR(50),
    UserAgent NVARCHAR(500),
    AdditionalData NVARCHAR(MAX), -- JSON
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    INDEX IX_SystemLogs_LogLevel (LogLevel),
    INDEX IX_SystemLogs_CreatedAt (CreatedAt DESC),
    INDEX IX_SystemLogs_UserID (UserID)
);

GO

-- =============================================
-- SEED DATA FOR INITIAL SETUP
-- =============================================

-- Insert Default Achievements
INSERT INTO Achievements (AchievementCode, Title, Description, IconName, BadgeType, XPReward, CoinReward, Tier) VALUES
('FIRST_TRADE', 'First Trade', 'Execute your first trade', 'trophy', 'Beginner', 50, 25, 'beginner'),
('STREAK_7', '7-Day Streak', 'Complete 7 consecutive days of learning', 'check-shield', 'Streak', 100, 50, 'beginner'),
('PROFIT_FIRST', 'First Profit', 'Close your first profitable trade', 'dollar-sign', 'Trading', 75, 40, 'beginner'),
('PORTFOLIO_10K', 'Portfolio Milestone', 'Reach $10,000 in portfolio value', 'portfolio', 'Wealth', 200, 100, 'intermediate'),
('WIN_RATE_70', 'Trading Expert', 'Achieve 70% win rate over 20 trades', 'signal', 'Expert', 500, 250, 'expert'),
('AI_MASTER', 'AI Signal Master', 'Successfully execute 10 AI-recommended trades', 'agent', 'AI Trading', 300, 150, 'intermediate');

-- Insert Default Quests
INSERT INTO Quests (QuestCode, Title, Subtitle, IconName, QuestType, TargetValue, XPReward, CoinReward) VALUES
('DAILY_COINS', 'Earn 80 coins', 'Complete lessons and challenges', 'trophy', 'daily', 80, 50, 20),
('DAILY_QUIZZES', 'Answer 10 quizzes correctly', 'Every correct answer earns you a reward', 'check-shield', 'daily', 10, 100, 50),
('DAILY_SIGNALS', 'Review 5 trade signals', 'Analyze market opportunities', 'market', 'daily', 5, 75, 30),
('WEEKLY_TRADES', 'Complete 20 trades', 'Execute trades throughout the week', 'execute', 'weekly', 20, 500, 200),
('WEEKLY_LEARNING', 'Complete 10 lessons', 'Expand your trading knowledge', 'lab', 'weekly', 10, 400, 150);

-- Insert Default Learning Topics
INSERT INTO LearningTopics (TopicCode, Title, Description, IconName, TotalLessons, RequiredTier, DisplayOrder) VALUES
('START_HERE', 'Start Here', 'Begin your investment journey', 'trophy', 5, 'beginner', 1),
('INVESTING_BASICS', 'Investing Basics', 'Learn fundamental investment concepts', 'market', 8, 'beginner', 2),
('INVESTING_STRATEGIES', 'Investing Strategies', 'Master various investment approaches', 'lab', 12, 'intermediate', 3),
('PORTFOLIO_MGMT', 'Portfolio Management', 'Build and manage your portfolio', 'portfolio', 10, 'intermediate', 4),
('RISK_ANALYSIS', 'Risk Analysis', 'Understand and manage investment risk', 'shield', 7, 'intermediate', 5),
('TECHNICAL_ANALYSIS', 'Technical Analysis', 'Chart patterns and technical indicators', 'signal', 15, 'intermediate', 6),
('MARKET_PSYCHOLOGY', 'Market Psychology', 'Understand market behavior and sentiment', 'agent', 6, 'expert', 7);

-- Insert Default Strategies
INSERT INTO Strategies (StrategyCode, Name, Description, Difficulty, WinRate, Profitability, RiskLevel, TimeFrame, RequiredTier) VALUES
('MOMENTUM', 'Momentum Trading', 'Follow market trends using technical indicators', 'Medium', 68.00, 15.20, 'Medium', 'Short-term', 'beginner'),
('MEAN_REVERSION', 'Mean Reversion', 'Buy low, sell high based on statistical analysis', 'Hard', 72.00, 12.80, 'High', 'Medium-term', 'intermediate'),
('VALUE_INVESTING', 'Value Investing', 'Long-term fundamentals-based approach', 'Easy', 85.00, 18.50, 'Low', 'Long-term', 'beginner'),
('SWING_TRADING', 'Swing Trading', 'Capture price swings over days to weeks', 'Medium', 65.00, 14.30, 'Medium', 'Medium-term', 'beginner'),
('BREAKOUT', 'Breakout Trading', 'Trade price breakouts from consolidation', 'Hard', 58.00, 16.70, 'High', 'Short-term', 'intermediate'),
('SCALPING', 'Scalping', 'Quick profits from small price movements', 'Expert', 45.00, 8.90, 'Very High', 'Very Short-term', 'expert');

-- Insert Sample Data Feeds (for admin portal)
INSERT INTO DataFeeds (FeedName, Provider, FeedType, Status, RecordsProcessed) VALUES
('Market Data Feed', 'NYSE', 'Market Data', 'active', 125430),
('News Sentiment', 'Reuters', 'News', 'active', 8920),
('Crypto Prices', 'Binance', 'Market Data', 'active', 45230);

GO

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- User Dashboard Summary View
CREATE VIEW vw_UserDashboard AS
SELECT 
    u.UserID,
    u.Username,
    u.Email,
    up.DisplayName,
    up.Tier,
    up.TotalXP,
    up.CurrentLevel,
    up.TotalCoins,
    up.WinRate,
    up.TotalTrades,
    up.CurrentStreak,
    up.LongestStreak,
    (SELECT COUNT(*) FROM UserAchievements ua WHERE ua.UserID = u.UserID) AS TotalAchievements,
    (SELECT SUM(TotalValue) FROM Portfolios p WHERE p.UserID = u.UserID AND p.IsActive = 1) AS TotalPortfolioValue,
    (SELECT COUNT(*) FROM Notifications n WHERE n.UserID = u.UserID AND n.IsRead = 0) AS UnreadNotifications
FROM Users u
INNER JOIN UserProfiles up ON u.UserID = up.UserID
WHERE u.IsActive = 1;

GO

-- Top Trading Signals View
CREATE VIEW vw_TopTradingSignals AS
SELECT TOP 1000
    SignalID,
    Symbol,
    AssetType,
    Signal,
    Confidence,
    EntryPrice,
    StopLossPrice,
    RiskRewardRatio,
    WinProbability,
    ExpectedValue,
    IsTopPick,
    PredictionDate,
    CreatedAt
FROM TradingSignals
WHERE IsActive = 1
ORDER BY 
    CASE 
        WHEN IsTopPick = 1 THEN 0 
        ELSE 1 
    END,
    Confidence DESC,
    ExpectedValue DESC;

GO

-- Leaderboard View
CREATE VIEW vw_Leaderboard AS
SELECT TOP 10000
    le.Rank,
    u.Username AS Name,
    up.DisplayName,
    up.AvatarURL,
    le.TotalXP AS XP,
    le.WinRate,
    le.TotalTrades,
    le.CurrentStreak AS Streak,
    le.Badge,
    le.UpdatedAt
FROM LeaderboardEntries le
INNER JOIN Users u ON le.UserID = u.UserID
INNER JOIN UserProfiles up ON u.UserID = up.UserID
WHERE le.IsAllTime = 1
ORDER BY le.Rank;

GO

-- Portfolio Performance View
CREATE VIEW vw_PortfolioPerformance AS
SELECT 
    p.PortfolioID,
    p.UserID,
    u.Username,
    p.PortfolioName,
    p.TotalValue,
    p.CashBalance,
    p.TotalChange,
    p.TotalChangePercent,
    COUNT(pi.PortfolioItemID) AS TotalPositions,
    SUM(CASE WHEN pi.UnrealizedPnL > 0 THEN 1 ELSE 0 END) AS WinningPositions,
    SUM(CASE WHEN pi.UnrealizedPnL < 0 THEN 1 ELSE 0 END) AS LosingPositions,
    SUM(pi.UnrealizedPnL) AS TotalUnrealizedPnL
FROM Portfolios p
INNER JOIN Users u ON p.UserID = u.UserID
LEFT JOIN PortfolioItems pi ON p.PortfolioID = pi.PortfolioID
WHERE p.IsActive = 1
GROUP BY p.PortfolioID, p.UserID, u.Username, p.PortfolioName, p.TotalValue, p.CashBalance, p.TotalChange, p.TotalChangePercent;

GO

-- =============================================
-- STORED PROCEDURES
-- =============================================

-- Create User with Profile
CREATE PROCEDURE sp_CreateUser
    @Email NVARCHAR(255),
    @PasswordHash NVARCHAR(255),
    @Username NVARCHAR(100),
    @FirstName NVARCHAR(100) = NULL,
    @LastName NVARCHAR(100) = NULL,
    @DisplayName NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @UserID INT;
    
    BEGIN TRANSACTION;
    
    BEGIN TRY
        -- Insert User
        INSERT INTO Users (Email, PasswordHash, Username, FirstName, LastName)
        VALUES (@Email, @PasswordHash, @Username, @FirstName, @LastName);
        
        SET @UserID = SCOPE_IDENTITY();
        
        -- Create User Profile
        INSERT INTO UserProfiles (UserID, DisplayName)
        VALUES (@UserID, ISNULL(@DisplayName, @Username));
        
        -- Create Default Portfolio
        INSERT INTO Portfolios (UserID, PortfolioName, IsDefault)
        VALUES (@UserID, 'Default Portfolio', 1);
        
        COMMIT TRANSACTION;
        
        SELECT @UserID AS UserID;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;

GO

-- Update User XP and Level
CREATE PROCEDURE sp_UpdateUserXP
    @UserID INT,
    @XPToAdd INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @NewXP INT;
    DECLARE @NewLevel INT;
    
    -- Add XP
    UPDATE UserProfiles
    SET TotalXP = TotalXP + @XPToAdd,
        @NewXP = TotalXP + @XPToAdd
    WHERE UserID = @UserID;
    
    -- Calculate new level (100 XP per level)
    SET @NewLevel = (@NewXP / 100) + 1;
    
    -- Update level
    UPDATE UserProfiles
    SET CurrentLevel = @NewLevel
    WHERE UserID = @UserID;
    
    SELECT @NewXP AS NewXP, @NewLevel AS NewLevel;
END;

GO

-- Complete Quest
CREATE PROCEDURE sp_CompleteQuest
    @UserID INT,
    @QuestID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @XPReward INT;
    DECLARE @CoinReward INT;
    
    BEGIN TRANSACTION;
    
    BEGIN TRY
        -- Get quest rewards
        SELECT @XPReward = XPReward, @CoinReward = CoinReward
        FROM Quests
        WHERE QuestID = @QuestID;
        
        -- Mark quest as complete
        UPDATE UserQuests
        SET IsCompleted = 1,
            CompletedAt = GETUTCDATE()
        WHERE UserID = @UserID AND QuestID = @QuestID;
        
        -- Award XP and Coins
        UPDATE UserProfiles
        SET TotalXP = TotalXP + @XPReward,
            TotalCoins = TotalCoins + @CoinReward,
            CompletedChallenges = CompletedChallenges + 1
        WHERE UserID = @UserID;
        
        COMMIT TRANSACTION;
        
        SELECT @XPReward AS XPEarned, @CoinReward AS CoinsEarned;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;

GO

-- Update Leaderboard
CREATE PROCEDURE sp_UpdateLeaderboard
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Clear existing all-time leaderboard
    DELETE FROM LeaderboardEntries WHERE IsAllTime = 1;
    
    -- Insert new rankings
    INSERT INTO LeaderboardEntries (UserID, Rank, TotalXP, WinRate, TotalTrades, CurrentStreak, Badge, IsAllTime)
    SELECT 
        UserID,
        ROW_NUMBER() OVER (ORDER BY TotalXP DESC) AS Rank,
        TotalXP,
        WinRate,
        TotalTrades,
        CurrentStreak,
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY TotalXP DESC) = 1 THEN 'Champion'
            WHEN ROW_NUMBER() OVER (ORDER BY TotalXP DESC) <= 3 THEN 'Expert'
            WHEN ROW_NUMBER() OVER (ORDER BY TotalXP DESC) <= 10 THEN 'Pro'
            WHEN ROW_NUMBER() OVER (ORDER BY TotalXP DESC) <= 50 THEN 'Advanced'
            WHEN ROW_NUMBER() OVER (ORDER BY TotalXP DESC) <= 100 THEN 'Intermediate'
            ELSE 'Beginner'
        END AS Badge,
        1 AS IsAllTime
    FROM UserProfiles
    WHERE TotalXP > 0;
END;

GO

-- =============================================
-- TRIGGERS FOR AUTOMATED UPDATES
-- =============================================

-- Trigger to update Portfolio total value when items change
CREATE TRIGGER tr_UpdatePortfolioValue
ON PortfolioItems
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Update for inserted/updated records
    IF EXISTS (SELECT 1 FROM inserted)
    BEGIN
        UPDATE Portfolios
        SET TotalValue = ISNULL((SELECT SUM(CurrentValue) FROM PortfolioItems WHERE PortfolioID = Portfolios.PortfolioID), 0) + CashBalance,
            UpdatedAt = GETUTCDATE()
        WHERE PortfolioID IN (SELECT DISTINCT PortfolioID FROM inserted);
    END
    
    -- Update for deleted records
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
        UPDATE Portfolios
        SET TotalValue = ISNULL((SELECT SUM(CurrentValue) FROM PortfolioItems WHERE PortfolioID = Portfolios.PortfolioID), 0) + CashBalance,
            UpdatedAt = GETUTCDATE()
        WHERE PortfolioID IN (SELECT DISTINCT PortfolioID FROM deleted);
    END
END;

GO

-- Trigger to update UpdatedAt timestamp
CREATE TRIGGER tr_Users_UpdateTimestamp
ON Users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users
    SET UpdatedAt = GETUTCDATE()
    WHERE UserID IN (SELECT DISTINCT UserID FROM inserted);
END;

GO

CREATE TRIGGER tr_UserProfiles_UpdateTimestamp
ON UserProfiles
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE UserProfiles
    SET UpdatedAt = GETUTCDATE()
    WHERE UserID IN (SELECT DISTINCT UserID FROM inserted);
END;

GO

-- =============================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================

-- Additional composite indexes for common queries
CREATE INDEX IX_Trades_UserID_Status_EntryDate ON Trades(UserID, Status, EntryDate DESC);
CREATE INDEX IX_UserAchievements_UserID_UnlockedAt ON UserAchievements(UserID, UnlockedAt DESC);
CREATE INDEX IX_Notifications_UserID_IsRead_CreatedAt ON Notifications(UserID, IsRead, CreatedAt DESC);
CREATE INDEX IX_TradingSignals_Symbol_IsActive_IsTopPick ON TradingSignals(Symbol, IsActive, IsTopPick);

GO

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

PRINT '=============================================';
PRINT 'WealthArena Database Schema Created Successfully!';
PRINT '=============================================';
PRINT '';
PRINT 'Tables Created: 29';
PRINT 'Views Created: 4';
PRINT 'Stored Procedures Created: 4';
PRINT 'Triggers Created: 3';
PRINT '';
PRINT 'Database is ready for connection!';
PRINT '=============================================';

