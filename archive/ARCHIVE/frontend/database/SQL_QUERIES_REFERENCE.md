# WealthArena - SQL Query Reference Guide

Quick reference for common database queries and operations.

## 📊 Table of Contents

1. [User Queries](#user-queries)
2. [Trading Signals](#trading-signals)
3. [Portfolio Queries](#portfolio-queries)
4. [Trades & Positions](#trades--positions)
5. [Gamification](#gamification)
6. [Learning & Education](#learning--education)
7. [News & Notifications](#news--notifications)
8. [Analytics & Reports](#analytics--reports)
9. [Admin Queries](#admin-queries)

---

## 👤 User Queries

### Get User Profile with Stats
```sql
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
    up.LongestStreak
FROM Users u
INNER JOIN UserProfiles up ON u.UserID = up.UserID
WHERE u.UserID = @userId;
```

### Create New User (Use Stored Procedure)
```sql
EXEC sp_CreateUser
    @Email = 'user@example.com',
    @PasswordHash = 'bcrypt_hashed_password',
    @Username = 'traderpro',
    @FirstName = 'John',
    @LastName = 'Doe',
    @DisplayName = 'Trading Pro';
```

### Update User Tier
```sql
UPDATE UserProfiles
SET Tier = 'intermediate',
    UpdatedAt = GETUTCDATE()
WHERE UserID = @userId;
```

### Get User Dashboard (Use View)
```sql
SELECT * FROM vw_UserDashboard
WHERE UserID = @userId;
```

### Login User (Validate Credentials)
```sql
SELECT u.UserID, u.PasswordHash, u.IsActive
FROM Users u
WHERE u.Email = @email OR u.Username = @username;

-- Then verify password hash in application code
```

### Update Last Login
```sql
UPDATE Users
SET LastLogin = GETUTCDATE()
WHERE UserID = @userId;
```

---

## 📈 Trading Signals

### Get Top Trading Signals
```sql
SELECT TOP 10 *
FROM vw_TopTradingSignals
WHERE AssetType = 'stock';
```

### Get Signal by Symbol
```sql
SELECT *
FROM TradingSignals
WHERE Symbol = @symbol
    AND IsActive = 1
ORDER BY PredictionDate DESC;
```

### Get Top Picks
```sql
SELECT *
FROM TradingSignals
WHERE IsTopPick = 1
    AND IsActive = 1
ORDER BY Confidence DESC;
```

### Get Signal with Take Profit Levels
```sql
SELECT 
    ts.*,
    tp.Level,
    tp.Price AS TakeProfitPrice,
    tp.PercentGain,
    tp.ClosePercent,
    tp.Probability
FROM TradingSignals ts
LEFT JOIN TakeProfitLevels tp ON ts.SignalID = tp.SignalID
WHERE ts.SignalID = @signalId
ORDER BY tp.Level;
```

### Insert New Trading Signal
```sql
INSERT INTO TradingSignals (
    Symbol, PredictionDate, AssetType, Signal, Confidence, ModelVersion,
    EntryPrice, StopLossPrice, StopLossPercent, RiskRewardRatio, 
    WinProbability, ExpectedValue, IsTopPick
)
VALUES (
    @Symbol, GETUTCDATE(), @AssetType, @Signal, @Confidence, @ModelVersion,
    @EntryPrice, @StopLossPrice, @StopLossPercent, @RiskRewardRatio,
    @WinProbability, @ExpectedValue, @IsTopPick
);

SELECT SCOPE_IDENTITY() AS SignalID;
```

### Get Signals by Asset Type
```sql
SELECT *
FROM TradingSignals
WHERE AssetType = @assetType
    AND IsActive = 1
    AND PredictionDate >= DATEADD(day, -7, GETUTCDATE())
ORDER BY Confidence DESC;
```

### Get High Confidence Signals
```sql
SELECT *
FROM TradingSignals
WHERE Confidence >= 0.75
    AND IsActive = 1
    AND Signal IN ('BUY', 'SELL')
ORDER BY ExpectedValue DESC;
```

---

## 💼 Portfolio Queries

### Get User's Default Portfolio
```sql
SELECT * FROM vw_PortfolioPerformance
WHERE UserID = @userId AND IsDefault = 1;
```

### Get Portfolio Items
```sql
SELECT 
    p.PortfolioName,
    pi.Symbol,
    pi.AssetName,
    pi.Shares,
    pi.AverageCost,
    pi.CurrentPrice,
    pi.CurrentValue,
    pi.UnrealizedPnL,
    pi.UnrealizedPnLPercent
FROM Portfolios p
INNER JOIN PortfolioItems pi ON p.PortfolioID = pi.PortfolioID
WHERE p.UserID = @userId AND p.IsDefault = 1
ORDER BY pi.CurrentValue DESC;
```

### Add Item to Portfolio
```sql
INSERT INTO PortfolioItems (
    PortfolioID, Symbol, AssetName, AssetType, Shares, 
    AverageCost, CurrentPrice, CurrentValue, TotalCost
)
VALUES (
    @PortfolioID, @Symbol, @AssetName, @AssetType, @Shares,
    @AverageCost, @CurrentPrice, @CurrentValue, @TotalCost
);
```

### Update Portfolio Item Price
```sql
UPDATE PortfolioItems
SET CurrentPrice = @newPrice,
    CurrentValue = Shares * @newPrice,
    UnrealizedPnL = (Shares * @newPrice) - TotalCost,
    UnrealizedPnLPercent = (((Shares * @newPrice) - TotalCost) / TotalCost) * 100,
    UpdatedAt = GETUTCDATE()
WHERE PortfolioItemID = @itemId;

-- Portfolio total will auto-update via trigger
```

### Get Portfolio Performance Summary
```sql
SELECT 
    PortfolioName,
    TotalValue,
    CashBalance,
    TotalChange,
    TotalChangePercent,
    COUNT(PortfolioItemID) AS TotalPositions,
    SUM(CASE WHEN UnrealizedPnL > 0 THEN 1 ELSE 0 END) AS WinningPositions,
    SUM(UnrealizedPnL) AS TotalUnrealizedPnL
FROM vw_PortfolioPerformance
WHERE UserID = @userId
GROUP BY PortfolioName, TotalValue, CashBalance, TotalChange, TotalChangePercent;
```

---

## 💹 Trades & Positions

### Get User's Active Positions
```sql
SELECT 
    p.Symbol,
    p.Side,
    p.Quantity,
    p.EntryPrice,
    p.CurrentPrice,
    p.UnrealizedPnL,
    p.UnrealizedPnLPercent,
    p.OpenedAt
FROM Positions p
WHERE p.UserID = @userId
ORDER BY p.UnrealizedPnL DESC;
```

### Get User's Trade History
```sql
SELECT 
    t.Symbol,
    t.TradeType,
    t.Quantity,
    t.EntryPrice,
    t.ExitPrice,
    t.RealizedPnL,
    t.RealizedPnLPercent,
    t.Status,
    t.EntryDate,
    t.ExitDate
FROM Trades t
WHERE t.UserID = @userId
ORDER BY t.EntryDate DESC;
```

### Execute New Trade
```sql
INSERT INTO Trades (
    UserID, PortfolioID, Symbol, AssetType, TradeType, Quantity,
    EntryPrice, StopLoss, TakeProfit, Status, IsSimulated
)
VALUES (
    @UserID, @PortfolioID, @Symbol, @AssetType, @TradeType, @Quantity,
    @EntryPrice, @StopLoss, @TakeProfit, 'open', 1
);

SELECT SCOPE_IDENTITY() AS TradeID;
```

### Close Trade
```sql
UPDATE Trades
SET ExitPrice = @exitPrice,
    ExitDate = GETUTCDATE(),
    Status = 'closed',
    RealizedPnL = (@exitPrice - EntryPrice) * Quantity,
    RealizedPnLPercent = ((@exitPrice - EntryPrice) / EntryPrice) * 100
WHERE TradeID = @tradeId;
```

### Get Trade Events/Log
```sql
SELECT 
    EventType,
    Trader,
    Message,
    Price,
    Quantity,
    EventTimestamp
FROM TradeEvents
WHERE TradeID = @tradeId
ORDER BY EventTimestamp ASC;
```

### Get Win Rate
```sql
SELECT 
    COUNT(*) AS TotalTrades,
    SUM(CASE WHEN RealizedPnL > 0 THEN 1 ELSE 0 END) AS WinningTrades,
    SUM(CASE WHEN RealizedPnL < 0 THEN 1 ELSE 0 END) AS LosingTrades,
    (SUM(CASE WHEN RealizedPnL > 0 THEN 1.0 ELSE 0 END) / COUNT(*)) * 100 AS WinRate
FROM Trades
WHERE UserID = @userId AND Status = 'closed';
```

---

## 🏆 Gamification

### Get Leaderboard
```sql
SELECT TOP 100 * 
FROM vw_Leaderboard
ORDER BY Rank;
```

### Get User Rank
```sql
SELECT * FROM vw_Leaderboard
WHERE UserID = @userId;
```

### Award XP (Use Stored Procedure)
```sql
EXEC sp_UpdateUserXP
    @UserID = @userId,
    @XPToAdd = 50;
```

### Get User Achievements
```sql
SELECT 
    a.Title,
    a.Description,
    a.BadgeType,
    a.XPReward,
    ua.UnlockedAt
FROM UserAchievements ua
INNER JOIN Achievements a ON ua.AchievementID = a.AchievementID
WHERE ua.UserID = @userId
ORDER BY ua.UnlockedAt DESC;
```

### Unlock Achievement
```sql
-- Check if not already unlocked
IF NOT EXISTS (
    SELECT 1 FROM UserAchievements 
    WHERE UserID = @userId AND AchievementID = @achievementId
)
BEGIN
    INSERT INTO UserAchievements (UserID, AchievementID)
    VALUES (@userId, @achievementId);
    
    -- Award XP and Coins
    DECLARE @xpReward INT, @coinReward INT;
    SELECT @xpReward = XPReward, @coinReward = CoinReward
    FROM Achievements WHERE AchievementID = @achievementId;
    
    UPDATE UserProfiles
    SET TotalXP = TotalXP + @xpReward,
        TotalCoins = TotalCoins + @coinReward
    WHERE UserID = @userId;
END
```

### Get Active Quests
```sql
SELECT 
    q.Title,
    q.Subtitle,
    q.IconName,
    q.TargetValue,
    q.XPReward,
    q.CoinReward,
    uq.CurrentProgress,
    uq.IsCompleted
FROM UserQuests uq
INNER JOIN Quests q ON uq.QuestID = q.QuestID
WHERE uq.UserID = @userId
    AND q.IsActive = 1
    AND (q.EndDate IS NULL OR q.EndDate >= GETUTCDATE())
ORDER BY uq.IsCompleted, q.QuestType;
```

### Update Quest Progress
```sql
UPDATE UserQuests
SET CurrentProgress = CurrentProgress + 1
WHERE UserID = @userId AND QuestID = @questId;

-- Check if completed
IF EXISTS (
    SELECT 1 FROM UserQuests
    WHERE UserID = @userId 
        AND QuestID = @questId 
        AND CurrentProgress >= TargetValue
        AND IsCompleted = 0
)
BEGIN
    EXEC sp_CompleteQuest @UserID = @userId, @QuestID = @questId;
END
```

### Update Leaderboard Rankings
```sql
EXEC sp_UpdateLeaderboard;
```

---

## 📚 Learning & Education

### Get Learning Topics
```sql
SELECT * FROM LearningTopics
WHERE IsActive = 1
ORDER BY DisplayOrder;
```

### Get Lessons for Topic
```sql
SELECT * FROM LearningLessons
WHERE TopicID = @topicId AND IsActive = 1
ORDER BY DisplayOrder;
```

### Get User Learning Progress
```sql
SELECT 
    lt.Title AS TopicTitle,
    lt.IconName,
    ll.Title AS LessonTitle,
    ulp.ProgressPercent,
    ulp.IsCompleted,
    ulp.TimeSpent,
    ulp.CompletedAt
FROM UserLearningProgress ulp
INNER JOIN LearningLessons ll ON ulp.LessonID = ll.LessonID
INNER JOIN LearningTopics lt ON ulp.TopicID = lt.TopicID
WHERE ulp.UserID = @userId
ORDER BY lt.DisplayOrder, ll.DisplayOrder;
```

### Start Lesson
```sql
INSERT INTO UserLearningProgress (UserID, LessonID, TopicID, ProgressPercent)
VALUES (@userId, @lessonId, @topicId, 0);
```

### Complete Lesson
```sql
UPDATE UserLearningProgress
SET IsCompleted = 1,
    ProgressPercent = 100,
    CompletedAt = GETUTCDATE()
WHERE UserID = @userId AND LessonID = @lessonId;

-- Award XP
DECLARE @xpReward INT;
SELECT @xpReward = XPReward FROM LearningLessons WHERE LessonID = @lessonId;

EXEC sp_UpdateUserXP @UserID = @userId, @XPToAdd = @xpReward;
```

### Get Topic Completion %
```sql
SELECT 
    lt.Title,
    lt.TotalLessons,
    COUNT(ulp.LessonID) AS CompletedLessons,
    (COUNT(ulp.LessonID) * 100.0 / lt.TotalLessons) AS CompletionPercent
FROM LearningTopics lt
LEFT JOIN LearningLessons ll ON lt.TopicID = ll.TopicID
LEFT JOIN UserLearningProgress ulp ON ll.LessonID = ulp.LessonID 
    AND ulp.UserID = @userId AND ulp.IsCompleted = 1
WHERE lt.IsActive = 1
GROUP BY lt.Title, lt.TotalLessons, lt.DisplayOrder
ORDER BY lt.DisplayOrder;
```

---

## 📰 News & Notifications

### Get Recent News
```sql
SELECT TOP 20 *
FROM NewsArticles
WHERE IsActive = 1
ORDER BY PublishedAt DESC;
```

### Get News by Category
```sql
SELECT *
FROM NewsArticles
WHERE Category = @category
    AND IsActive = 1
ORDER BY PublishedAt DESC;
```

### Get High Impact News
```sql
SELECT *
FROM NewsArticles
WHERE Impact = 'high'
    AND IsActive = 1
    AND PublishedAt >= DATEADD(day, -7, GETUTCDATE())
ORDER BY PublishedAt DESC;
```

### Get User Notifications
```sql
SELECT *
FROM Notifications
WHERE UserID = @userId
ORDER BY CreatedAt DESC;
```

### Get Unread Notifications
```sql
SELECT *
FROM Notifications
WHERE UserID = @userId AND IsRead = 0
ORDER BY Priority DESC, CreatedAt DESC;
```

### Mark Notification as Read
```sql
UPDATE Notifications
SET IsRead = 1,
    ReadAt = GETUTCDATE()
WHERE NotificationID = @notificationId;
```

### Create Notification
```sql
INSERT INTO Notifications (
    UserID, Type, Title, Message, Priority
)
VALUES (
    @userId, @type, @title, @message, @priority
);
```

### Mark All as Read
```sql
UPDATE Notifications
SET IsRead = 1,
    ReadAt = GETUTCDATE()
WHERE UserID = @userId AND IsRead = 0;
```

---

## 📊 Analytics & Reports

### User Activity Report
```sql
SELECT 
    u.Username,
    up.TotalXP,
    up.TotalTrades,
    up.WinRate,
    up.CurrentStreak,
    COUNT(DISTINCT t.TradeID) AS TradesThisMonth,
    SUM(CASE WHEN t.RealizedPnL > 0 THEN 1 ELSE 0 END) AS WinningTrades,
    AVG(t.RealizedPnL) AS AvgPnL
FROM Users u
INNER JOIN UserProfiles up ON u.UserID = up.UserID
LEFT JOIN Trades t ON u.UserID = t.UserID 
    AND t.EntryDate >= DATEADD(month, -1, GETUTCDATE())
WHERE u.IsActive = 1
GROUP BY u.Username, up.TotalXP, up.TotalTrades, up.WinRate, up.CurrentStreak
ORDER BY up.TotalXP DESC;
```

### Trading Performance by Symbol
```sql
SELECT 
    Symbol,
    COUNT(*) AS TotalTrades,
    SUM(CASE WHEN RealizedPnL > 0 THEN 1 ELSE 0 END) AS WinningTrades,
    AVG(RealizedPnL) AS AvgPnL,
    SUM(RealizedPnL) AS TotalPnL,
    (SUM(CASE WHEN RealizedPnL > 0 THEN 1.0 ELSE 0 END) / COUNT(*)) * 100 AS WinRate
FROM Trades
WHERE UserID = @userId AND Status = 'closed'
GROUP BY Symbol
ORDER BY TotalPnL DESC;
```

### Monthly Trading Summary
```sql
SELECT 
    FORMAT(EntryDate, 'yyyy-MM') AS Month,
    COUNT(*) AS TotalTrades,
    SUM(CASE WHEN RealizedPnL > 0 THEN 1 ELSE 0 END) AS WinningTrades,
    SUM(RealizedPnL) AS TotalPnL,
    AVG(RealizedPnL) AS AvgPnL
FROM Trades
WHERE UserID = @userId 
    AND Status = 'closed'
    AND EntryDate >= DATEADD(year, -1, GETUTCDATE())
GROUP BY FORMAT(EntryDate, 'yyyy-MM')
ORDER BY Month DESC;
```

### Top Performers (Users)
```sql
SELECT TOP 10
    u.Username,
    up.DisplayName,
    up.TotalXP,
    up.WinRate,
    up.TotalTrades,
    up.CurrentStreak
FROM UserProfiles up
INNER JOIN Users u ON up.UserID = u.UserID
WHERE u.IsActive = 1
ORDER BY up.TotalXP DESC;
```

---

## 🔧 Admin Queries

### System Statistics
```sql
SELECT 
    (SELECT COUNT(*) FROM Users WHERE IsActive = 1) AS ActiveUsers,
    (SELECT COUNT(*) FROM Trades WHERE EntryDate >= DATEADD(day, -1, GETUTCDATE())) AS TradesToday,
    (SELECT COUNT(*) FROM TradingSignals WHERE IsActive = 1) AS ActiveSignals,
    (SELECT COUNT(*) FROM NewsArticles WHERE PublishedAt >= DATEADD(day, -1, GETUTCDATE())) AS NewsToday,
    (SELECT AVG(WinRate) FROM UserProfiles WHERE TotalTrades > 10) AS AvgWinRate;
```

### Data Feed Status
```sql
SELECT * FROM DataFeeds
ORDER BY Status, FeedName;
```

### Recent System Logs
```sql
SELECT TOP 100 *
FROM SystemLogs
WHERE LogLevel IN ('ERROR', 'WARNING')
ORDER BY CreatedAt DESC;
```

### Database Health Check
```sql
-- Table row counts
SELECT 
    t.NAME AS TableName,
    p.rows AS RowCount
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0, 1)
ORDER BY p.rows DESC;

-- Database size
SELECT 
    DB_NAME() AS DatabaseName,
    SUM(size * 8 / 1024) AS SizeMB
FROM sys.database_files;
```

### Clean Old Data
```sql
-- Delete old notifications (30+ days, read)
DELETE FROM Notifications
WHERE IsRead = 1
    AND CreatedAt < DATEADD(day, -30, GETUTCDATE());

-- Archive old logs (90+ days)
DELETE FROM SystemLogs
WHERE CreatedAt < DATEADD(day, -90, GETUTCDATE());
```

---

## 💡 Tips & Best Practices

### 1. Always Use Parameters
```sql
-- ✅ GOOD (prevents SQL injection)
WHERE UserID = @userId

-- ❌ BAD (vulnerable to SQL injection)
WHERE UserID = ' + userId + '
```

### 2. Use Transactions for Multi-Step Operations
```sql
BEGIN TRANSACTION;
BEGIN TRY
    -- Multiple operations
    INSERT INTO ...;
    UPDATE ...;
    
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
END CATCH
```

### 3. Use Views for Complex Queries
```sql
-- Instead of repeating complex JOINs
SELECT * FROM vw_UserDashboard WHERE UserID = @userId;
```

### 4. Use Stored Procedures for Business Logic
```sql
-- Encapsulates logic, better security, better performance
EXEC sp_CreateUser @Email, @PasswordHash, @Username;
```

### 5. Index Common Query Columns
```sql
-- Already done in schema, but if you add queries on new columns:
CREATE INDEX IX_YourTable_YourColumn ON YourTable(YourColumn);
```

---

## 🔍 Quick Search Guide

- **User Operations**: Section 1
- **AI Signals**: Section 2
- **Portfolio Management**: Section 3
- **Trading**: Section 4
- **Gamification (XP, Achievements)**: Section 5
- **Learning Modules**: Section 6
- **Content (News, Notifications)**: Section 7
- **Reporting**: Section 8
- **Admin Tools**: Section 9

---

**Version**: 1.0.0  
**Last Updated**: October 10, 2025

