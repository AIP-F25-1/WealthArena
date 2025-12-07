# WealthArena Database

Complete Azure SQL database setup for the WealthArena trading gamification platform.

## 📁 Files

- **`AzureSQL_CreateTables.sql`** - Complete database schema (29 tables, 4 views, 4 stored procedures, 3 triggers)
- **`DATABASE_SETUP_GUIDE.md`** - Comprehensive setup and usage documentation
- **`db-connection.ts`** - TypeScript database connection helper with examples
- **`test-connection.ts`** - Connection test script
- **`.env.example`** - Environment variables template
- **`package.json`** - Node.js dependencies for database utilities
- **`tsconfig.json`** - TypeScript configuration

## 🚀 Quick Start

### 1. Setup Database in Azure

1. Create Azure SQL Database
2. Configure firewall rules
3. Run `AzureSQL_CreateTables.sql` script
4. Verify all tables are created (should be 29 tables)

### 2. Configure Connection

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Azure SQL credentials
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Test Connection

```bash
npm test
```

You should see:
```
✅ Database connection successful!
✅ Found 29 tables in database
✅ Found 4 views in database
✅ Found 4 stored procedures
✅ Seed data loaded successfully
🎉 All Tests Passed Successfully!
```

## 📊 Database Schema

### Core Tables (29 total)

**Users & Authentication**
- Users
- UserProfiles

**Trading & Signals**
- TradingSignals
- TakeProfitLevels
- Trades
- Positions
- TradeEvents

**Portfolio**
- Portfolios
- PortfolioItems

**Market Data**
- MarketData
- CandleData

**Content**
- NewsArticles

**Gamification**
- LeaderboardEntries
- Achievements
- UserAchievements
- Quests
- UserQuests

**Learning**
- LearningTopics
- LearningLessons
- UserLearningProgress

**Strategies**
- Strategies
- UserStrategies

**System**
- Notifications
- DataFeeds
- SystemLogs

## 💻 Usage Examples

### Import in Your Project

```typescript
import db from './database/db-connection';

// Get user
const user = await db.getUserById(1);

// Create user
const newUser = await db.createUser(
  'user@example.com',
  'hashed_password',
  'username'
);

// Get trading signals
const signals = await db.getTopTradingSignals(10);

// Get leaderboard
const leaderboard = await db.getLeaderboard(100);

// Update user XP
await db.updateUserXP(userId, 50);
```

### Raw Queries

```typescript
import { executeQuery } from './database/db-connection';

const result = await executeQuery(
  'SELECT * FROM Users WHERE Email = @email',
  { email: 'user@example.com' }
);
```

### Stored Procedures

```typescript
import { executeProcedure } from './database/db-connection';

const result = await executeProcedure('sp_CreateUser', {
  Email: 'user@example.com',
  PasswordHash: 'hash',
  Username: 'username'
});
```

## 📚 Documentation

See **`DATABASE_SETUP_GUIDE.md`** for:
- Complete table documentation
- Connection string examples
- Query examples
- Security best practices
- Performance optimization
- Maintenance tasks
- Troubleshooting

## 🔧 Maintenance

### Update Leaderboard

```sql
EXEC sp_UpdateLeaderboard;
```

### Clean Old Data

```sql
-- Clean old notifications (30+ days)
DELETE FROM Notifications 
WHERE CreatedAt < DATEADD(day, -30, GETUTCDATE()) 
  AND IsRead = 1;

-- Clean old logs (90+ days)
DELETE FROM SystemLogs
WHERE CreatedAt < DATEADD(day, -90, GETUTCDATE());
```

## 🔐 Security

- ✅ All passwords should be bcrypt hashed
- ✅ Use parameterized queries (prevents SQL injection)
- ✅ Enable Azure SQL encryption
- ✅ Configure firewall rules properly
- ✅ Use least-privilege database users
- ✅ Rotate credentials regularly

## 📈 Performance

The database includes:
- ✅ Primary key indexes on all tables
- ✅ Foreign key indexes for relationships
- ✅ Composite indexes for common queries
- ✅ Views for complex repeated queries
- ✅ Stored procedures for business logic
- ✅ Triggers for automated updates

## 🐛 Troubleshooting

### Connection Issues

```bash
# Test connection
npm test

# Check environment variables
cat .env

# Verify Azure firewall rules
# Check Azure Portal > SQL Database > Firewalls and virtual networks
```

### Common Errors

1. **ELOGIN** - Wrong username/password
2. **ETIMEOUT** - Firewall blocking connection
3. **ENOTFOUND** - Wrong server name
4. **SSL error** - Enable encryption in config

## 📞 Support

- Review `DATABASE_SETUP_GUIDE.md` for detailed documentation
- Check Azure SQL logs in portal
- Run `npm test` to diagnose issues
- Verify all environment variables are set

## ✅ Checklist

- [ ] Azure SQL Database created
- [ ] Firewall configured
- [ ] Schema script executed
- [ ] 29 tables created
- [ ] Seed data inserted
- [ ] `.env` configured
- [ ] Dependencies installed
- [ ] Connection test passed
- [ ] Application connected

## 📊 Database Statistics

After setup, you should have:
- 29 Tables
- 4 Views
- 4 Stored Procedures
- 3 Triggers
- 6 Achievements (seed data)
- 5 Quests (seed data)
- 7 Learning Topics (seed data)
- 6 Strategies (seed data)
- 3 Data Feeds (seed data)

## 🎉 Ready!

Your WealthArena database is now set up and ready to use. Start building your trading platform!

---

**Version**: 1.0.0  
**Last Updated**: October 10, 2025

