# WealthArena - Azure SQL Database Setup Guide

## 📋 Overview

This guide provides comprehensive instructions for setting up and connecting to your WealthArena Azure SQL database.

## 🗄️ Database Schema Summary

### Total Database Objects
- **29 Tables** - Complete data model for all features
- **4 Views** - Pre-built queries for common operations
- **4 Stored Procedures** - Business logic operations
- **3 Triggers** - Automated data management
- **Indexes** - Optimized for performance

---

## 📊 Table Categories

### 1. **Users & Authentication** (2 tables)
- `Users` - Core authentication and user accounts
- `UserProfiles` - Extended user information, XP, levels, tiers

### 2. **Trading Signals & AI** (2 tables)
- `TradingSignals` - AI-generated trading signals with full metadata
- `TakeProfitLevels` - Multiple take-profit targets per signal

### 3. **Portfolio Management** (2 tables)
- `Portfolios` - User portfolio containers
- `PortfolioItems` - Individual assets in portfolios

### 4. **Trading & Execution** (4 tables)
- `Trades` - All executed trades (simulated and real)
- `Positions` - Currently open positions
- `TradeEvents` - Trade simulation event logs
- `MarketData` - Current market prices

### 5. **Market Data** (2 tables)
- `MarketData` - Real-time price data
- `CandleData` - Historical OHLCV candlestick data

### 6. **News & Content** (1 table)
- `NewsArticles` - Financial news with sentiment analysis

### 7. **Gamification** (4 tables)
- `LeaderboardEntries` - Global, seasonal, and weekly rankings
- `Achievements` - Available achievements
- `UserAchievements` - User's unlocked achievements
- `Quests` - Daily, weekly, monthly quests

### 8. **User Quests Progress** (1 table)
- `UserQuests` - User progress on quests

### 9. **Learning & Education** (3 tables)
- `LearningTopics` - Learning path categories
- `LearningLessons` - Individual lessons
- `UserLearningProgress` - User progress tracking

### 10. **Strategies** (2 tables)
- `Strategies` - Trading strategy library
- `UserStrategies` - User's saved/favorite strategies

### 11. **Notifications** (1 table)
- `Notifications` - In-app notifications

### 12. **Admin & System** (2 tables)
- `DataFeeds` - Data feed monitoring
- `SystemLogs` - Application logs

---

## 🚀 Azure SQL Setup Instructions

### Step 1: Create Azure SQL Database

1. **Login to Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)

2. **Create SQL Database**
   ```
   Resource Type: Azure SQL Database
   Database Name: WealthArenaDB
   Server: Create new or select existing
   Pricing Tier: Basic/Standard/Premium (based on needs)
   ```

3. **Configure Firewall Rules**
   - Add your IP address to allow connections
   - Enable "Allow Azure services and resources to access this server" if needed

### Step 2: Run the Schema Script

1. **Connect using Azure Data Studio or SSMS**
   ```
   Server: your-server-name.database.windows.net
   Database: WealthArenaDB
   Authentication: SQL Login or Azure AD
   ```

2. **Execute the Script**
   - Open `AzureSQL_CreateTables.sql`
   - Run the entire script
   - Verify success message at the end

### Step 3: Verify Installation

Run this query to verify all tables were created:
```sql
SELECT 
    TABLE_SCHEMA,
    TABLE_NAME,
    TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
```

You should see **29 tables**.

---

## 🔗 Connection Strings

### .NET / C# Connection String
```csharp
Server=tcp:your-server.database.windows.net,1433;
Initial Catalog=WealthArenaDB;
Persist Security Info=False;
User ID=your-username;
Password=your-password;
MultipleActiveResultSets=False;
Encrypt=True;
TrustServerCertificate=False;
Connection Timeout=30;
```

### Node.js (mssql package) Connection
```javascript
const config = {
    user: 'your-username',
    password: 'your-password',
    server: 'your-server.database.windows.net',
    database: 'WealthArenaDB',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};
```

### Python (pyodbc) Connection
```python
import pyodbc

connection_string = (
    'DRIVER={ODBC Driver 18 for SQL Server};'
    'SERVER=your-server.database.windows.net;'
    'DATABASE=WealthArenaDB;'
    'UID=your-username;'
    'PWD=your-password'
)
```

### Environment Variables (Recommended)
```env
DB_HOST=your-server.database.windows.net
DB_NAME=WealthArenaDB
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433
DB_ENCRYPT=true
```

---

## 📝 Key Features & Design Patterns

### 1. **Cascading Deletes**
- When a user is deleted, all related data is automatically removed
- Portfolio items update portfolio totals automatically

### 2. **Timestamps**
- All tables have `CreatedAt` and `UpdatedAt` (where applicable)
- Automatic timestamp updates via triggers

### 3. **Soft Deletes**
- Most entities use `IsActive` flag instead of hard deletes
- Preserves historical data

### 4. **JSON Storage**
- Complex data structures stored as JSON strings
- Examples: `AgentsUsed`, `FeatureImportance`, `RelatedStocks`

### 5. **Enumerations**
- CHECK constraints enforce valid values
- Examples: Signal types, Asset types, User tiers

### 6. **Indexes**
- Optimized for common query patterns
- Composite indexes for multi-column queries
- Covering indexes for frequently accessed data

---

## 🔧 Stored Procedures

### 1. `sp_CreateUser`
Creates a new user with profile and default portfolio.

```sql
EXEC sp_CreateUser 
    @Email = 'user@example.com',
    @PasswordHash = 'hashed_password',
    @Username = 'traderpro',
    @FirstName = 'John',
    @LastName = 'Doe',
    @DisplayName = 'Trading Pro';
```

### 2. `sp_UpdateUserXP`
Awards XP to user and updates level automatically.

```sql
EXEC sp_UpdateUserXP
    @UserID = 1,
    @XPToAdd = 50;
```

### 3. `sp_CompleteQuest`
Marks quest complete and awards rewards.

```sql
EXEC sp_CompleteQuest
    @UserID = 1,
    @QuestID = 1;
```

### 4. `sp_UpdateLeaderboard`
Recalculates all leaderboard rankings.

```sql
EXEC sp_UpdateLeaderboard;
```

---

## 📊 Pre-Built Views

### 1. `vw_UserDashboard`
Complete user dashboard data in one query.

```sql
SELECT * FROM vw_UserDashboard WHERE UserID = 1;
```

Returns:
- User info
- XP, level, coins
- Total achievements
- Portfolio value
- Unread notifications

### 2. `vw_TopTradingSignals`
Top 100 trading signals sorted by quality.

```sql
SELECT TOP 10 * FROM vw_TopTradingSignals 
WHERE AssetType = 'stock';
```

### 3. `vw_Leaderboard`
Current all-time leaderboard rankings.

```sql
SELECT TOP 10 * FROM vw_Leaderboard;
```

### 4. `vw_PortfolioPerformance`
Portfolio performance metrics.

```sql
SELECT * FROM vw_PortfolioPerformance WHERE UserID = 1;
```

---

## 🎯 Common Query Examples

### Get User Profile with Stats
```sql
SELECT 
    u.Username,
    up.Tier,
    up.TotalXP,
    up.CurrentLevel,
    up.WinRate,
    up.TotalTrades
FROM Users u
INNER JOIN UserProfiles up ON u.UserID = up.UserID
WHERE u.UserID = 1;
```

### Get Active Trading Signals for a Symbol
```sql
SELECT 
    Symbol,
    Signal,
    Confidence,
    EntryPrice,
    StopLossPrice,
    RiskRewardRatio
FROM TradingSignals
WHERE Symbol = 'AAPL' 
    AND IsActive = 1
ORDER BY PredictionDate DESC;
```

### Get User's Portfolio with Current Value
```sql
SELECT 
    p.PortfolioName,
    p.TotalValue,
    p.CashBalance,
    pi.Symbol,
    pi.Shares,
    pi.CurrentPrice,
    pi.UnrealizedPnL,
    pi.UnrealizedPnLPercent
FROM Portfolios p
LEFT JOIN PortfolioItems pi ON p.PortfolioID = pi.PortfolioID
WHERE p.UserID = 1 AND p.IsDefault = 1;
```

### Get User's Recent Notifications
```sql
SELECT 
    Type,
    Title,
    Message,
    CreatedAt,
    IsRead
FROM Notifications
WHERE UserID = 1
ORDER BY CreatedAt DESC;
```

### Get Learning Progress
```sql
SELECT 
    lt.Title AS TopicTitle,
    ll.Title AS LessonTitle,
    ulp.ProgressPercent,
    ulp.IsCompleted,
    ulp.CompletedAt
FROM UserLearningProgress ulp
INNER JOIN LearningLessons ll ON ulp.LessonID = ll.LessonID
INNER JOIN LearningTopics lt ON ulp.TopicID = lt.TopicID
WHERE ulp.UserID = 1
ORDER BY lt.DisplayOrder, ll.DisplayOrder;
```

---

## 🔐 Security Best Practices

### 1. **Password Hashing**
```sql
-- Never store plain passwords
-- Use bcrypt, Argon2, or PBKDF2 before inserting
INSERT INTO Users (Email, PasswordHash, Username)
VALUES ('user@example.com', 'bcrypt_hashed_password', 'username');
```

### 2. **Parameterized Queries**
Always use parameterized queries to prevent SQL injection:
```javascript
// ✅ GOOD
const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query('SELECT * FROM Users WHERE UserID = @userId');

// ❌ BAD
const result = await pool.query(`SELECT * FROM Users WHERE UserID = ${userId}`);
```

### 3. **Least Privilege Access**
Create separate database users for different purposes:
- **App User**: Read/Write on application tables only
- **Admin User**: Full access for maintenance
- **Read-Only User**: For analytics/reporting

---

## 🧪 Sample Data & Testing

The script includes seed data for:
- ✅ 6 Default Achievements
- ✅ 5 Default Quests (Daily & Weekly)
- ✅ 7 Learning Topics
- ✅ 6 Trading Strategies
- ✅ 3 Data Feeds (for admin)

### Insert Test User
```sql
EXEC sp_CreateUser
    @Email = 'test@wealtharena.com',
    @PasswordHash = 'test_hash_123',
    @Username = 'testuser',
    @DisplayName = 'Test User';
```

### Insert Sample Trading Signal
```sql
INSERT INTO TradingSignals (
    Symbol, PredictionDate, AssetType, Signal, Confidence, ModelVersion,
    EntryPrice, StopLossPrice, StopLossPercent, RiskRewardRatio, WinProbability
)
VALUES (
    'AAPL', GETUTCDATE(), 'stock', 'BUY', 0.87, 'v2.0.0',
    178.45, 175.89, 1.43, 3.02, 0.74
);
```

---

## 📈 Performance Optimization

### Index Usage
All tables have appropriate indexes for:
- Primary keys (clustered)
- Foreign keys
- Common query fields (Symbol, UserID, CreatedAt, etc.)
- Composite indexes for multi-column queries

### Query Optimization Tips
1. Use views for complex repeated queries
2. Add indexes on frequently filtered columns
3. Use stored procedures for complex operations
4. Enable query execution plans in Azure Portal
5. Monitor with Azure SQL Analytics

---

## 🔄 Maintenance Tasks

### Daily
```sql
-- Update leaderboard rankings
EXEC sp_UpdateLeaderboard;

-- Clean old notifications (older than 30 days)
DELETE FROM Notifications 
WHERE CreatedAt < DATEADD(day, -30, GETUTCDATE()) 
    AND IsRead = 1;
```

### Weekly
```sql
-- Archive old system logs
-- Update market data
-- Recalculate portfolio values
```

### Monthly
```sql
-- Database maintenance
ALTER INDEX ALL ON TradingSignals REBUILD;
UPDATE STATISTICS TradingSignals;

-- Archive completed quests
-- Generate performance reports
```

---

## 📊 Monitoring Queries

### Database Size
```sql
SELECT 
    DB_NAME() AS DatabaseName,
    SUM(size * 8 / 1024) AS SizeMB
FROM sys.database_files;
```

### Table Row Counts
```sql
SELECT 
    t.NAME AS TableName,
    p.rows AS RowCount
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0, 1)
ORDER BY p.rows DESC;
```

### Active Users Count
```sql
SELECT COUNT(*) AS ActiveUsers
FROM Users
WHERE IsActive = 1
    AND LastLogin > DATEADD(day, -30, GETUTCDATE());
```

---

## 🐛 Troubleshooting

### Connection Issues
```sql
-- Check firewall rules
-- Verify credentials
-- Ensure TLS 1.2+ is enabled
-- Check if server is in allowed region
```

### Performance Issues
```sql
-- Check for missing indexes
SELECT * FROM sys.dm_db_missing_index_details;

-- Check slow queries
SELECT TOP 10 
    total_elapsed_time / execution_count AS avg_time,
    text
FROM sys.dm_exec_query_stats
CROSS APPLY sys.dm_exec_sql_text(sql_handle)
ORDER BY avg_time DESC;
```

---

## 📚 Additional Resources

### Azure SQL Documentation
- [Azure SQL Database Documentation](https://docs.microsoft.com/en-us/azure/azure-sql/)
- [Query Performance Insights](https://docs.microsoft.com/en-us/azure/azure-sql/database/query-performance-insight-use)
- [Automatic Tuning](https://docs.microsoft.com/en-us/azure/azure-sql/database/automatic-tuning-overview)

### Tools
- **Azure Data Studio**: Cross-platform database tool
- **SQL Server Management Studio (SSMS)**: Windows database management
- **Azure Portal**: Web-based management and monitoring

---

## ✅ Post-Setup Checklist

- [ ] Database created in Azure
- [ ] Firewall rules configured
- [ ] Schema script executed successfully
- [ ] All 29 tables created
- [ ] Views, procedures, and triggers verified
- [ ] Seed data inserted
- [ ] Test user created
- [ ] Connection string saved securely
- [ ] Application can connect successfully
- [ ] First test query executed

---

## 🎉 You're Ready!

Your WealthArena database is now fully set up and ready for your application to connect!

### Next Steps:
1. Configure your backend API to use the connection string
2. Implement authentication using the Users table
3. Start integrating AI trading signals
4. Build out the gamification features
5. Connect your React Native frontend

---

## 📞 Support

For issues or questions:
- Review the SQL script comments
- Check Azure SQL logs in the portal
- Verify all indexes and constraints
- Test with sample queries provided

**Database Version**: 1.0.0  
**Created**: October 10, 2025  
**Last Updated**: October 10, 2025

