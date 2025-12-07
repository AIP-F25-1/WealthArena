# WealthArena Database Schema Diagram

Visual representation of the database structure and relationships.

## 📊 Database Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEALTHARENA DATABASE                         │
│                       29 TABLES TOTAL                           │
└─────────────────────────────────────────────────────────────────┘
        │
        ├── 👤 Users & Authentication (2 tables)
        ├── 📈 Trading Signals & AI (2 tables)
        ├── 💼 Portfolio Management (2 tables)
        ├── 💹 Trading & Execution (4 tables)
        ├── 📊 Market Data (2 tables)
        ├── 📰 News & Content (1 table)
        ├── 🏆 Gamification (4 tables)
        ├── ✅ User Quests (1 table)
        ├── 📚 Learning & Education (3 tables)
        ├── 🎯 Strategies (2 tables)
        ├── 🔔 Notifications (1 table)
        └── ⚙️  Admin & System (2 tables)
```

---

## 🔗 Entity Relationships

### Core User Flow

```
┌─────────────┐
│   Users     │ (1)
│  [UserID]   │
└──────┬──────┘
       │ 1:1
       ▼
┌─────────────────┐
│  UserProfiles   │
│   [ProfileID]   │
│   - Tier        │
│   - TotalXP     │
│   - WinRate     │
└──────┬──────────┘
       │ 1:N
       ├──────────────────┬──────────────────┬──────────────────┐
       ▼                  ▼                  ▼                  ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Portfolios  │  │   Trades     │  │Achievements  │  │Notifications │
│[PortfolioID]│  │  [TradeID]   │  │   (User)     │  │              │
└─────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Trading & Signals Flow

```
┌──────────────────┐
│ TradingSignals   │ (Main AI Signal)
│   [SignalID]     │
│   - Symbol       │
│   - Confidence   │
│   - Entry        │
│   - StopLoss     │
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────┐
│TakeProfitLevels │
│[TakeProfitID]   │
│   - Level (1,2,3)│
│   - Price        │
│   - Probability  │
└──────────────────┘
```

### Portfolio Structure

```
┌────────────────┐
│   Portfolios   │
│  [PortfolioID] │
│   - UserID     │
│   - TotalValue │
└───────┬────────┘
        │ 1:N
        ▼
┌────────────────┐
│PortfolioItems │
│[ItemID]        │
│   - Symbol     │
│   - Shares     │
│   - Value      │
│   - PnL        │
└────────────────┘
```

### Trading Execution

```
┌────────────┐
│   Trades   │
│ [TradeID]  │
│  - UserID  │
│  - Symbol  │
│  - Status  │
└──────┬─────┘
       │ 1:N
       ▼
┌─────────────┐
│TradeEvents │
│ [EventID]   │
│  - Type     │
│  - Message  │
│  - Price    │
└─────────────┘

┌────────────┐
│ Positions  │ (Current Open)
│[PositionID]│
│  - UserID  │
│  - Symbol  │
│  - Side    │
│  - PnL     │
└────────────┘
```

### Gamification System

```
┌──────────────┐
│Achievements  │ (Available)
│[AchievementID]
└──────┬───────┘
       │ N:M
       ▼
┌──────────────────┐
│UserAchievements  │
│[UserAchievementID]
│   - UserID       │
│   - UnlockedAt   │
└──────────────────┘

┌──────────────┐
│   Quests     │ (Available)
│  [QuestID]   │
└──────┬───────┘
       │ N:M
       ▼
┌──────────────┐
│ UserQuests   │
│[UserQuestID] │
│  - Progress  │
│  - Completed │
└──────────────┘

┌──────────────────┐
│LeaderboardEntries│
│[LeaderboardID]   │
│   - UserID       │
│   - Rank         │
│   - TotalXP      │
│   - WinRate      │
└──────────────────┘
```

### Learning System

```
┌──────────────────┐
│ LearningTopics   │
│   [TopicID]      │
│   - Title        │
│   - IconName     │
└────────┬─────────┘
         │ 1:N
         ▼
┌──────────────────┐
│ LearningLessons  │
│   [LessonID]     │
│   - TopicID      │
│   - Content      │
│   - XPReward     │
└────────┬─────────┘
         │ N:M
         ▼
┌──────────────────────┐
│UserLearningProgress  │
│    [ProgressID]      │
│   - UserID           │
│   - LessonID         │
│   - IsCompleted      │
│   - ProgressPercent  │
└──────────────────────┘
```

---

## 📋 Complete Table List

### 👤 Users & Authentication

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `Users` | UserID | Core user accounts |
| `UserProfiles` | ProfileID | Extended user data, XP, levels |

### 📈 Trading & AI

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `TradingSignals` | SignalID | AI-generated trading signals |
| `TakeProfitLevels` | TakeProfitID | Multiple TP levels per signal |

### 💼 Portfolio

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `Portfolios` | PortfolioID | User portfolio containers |
| `PortfolioItems` | PortfolioItemID | Individual assets |

### 💹 Trading

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `Trades` | TradeID | All executed trades |
| `Positions` | PositionID | Current open positions |
| `TradeEvents` | EventID | Trade simulation logs |

### 📊 Market Data

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `MarketData` | MarketDataID | Current market prices |
| `CandleData` | CandleID | Historical OHLCV data |

### 📰 Content

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `NewsArticles` | ArticleID | Financial news with sentiment |

### 🏆 Gamification

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `Achievements` | AchievementID | Available achievements |
| `UserAchievements` | UserAchievementID | Unlocked achievements |
| `Quests` | QuestID | Daily/weekly/monthly quests |
| `UserQuests` | UserQuestID | Quest progress tracking |
| `LeaderboardEntries` | LeaderboardID | Rankings & leaderboard |

### 📚 Learning

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `LearningTopics` | TopicID | Learning path categories |
| `LearningLessons` | LessonID | Individual lessons |
| `UserLearningProgress` | ProgressID | User progress tracking |

### 🎯 Strategies

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `Strategies` | StrategyID | Trading strategy library |
| `UserStrategies` | UserStrategyID | User's saved strategies |

### 🔔 System

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `Notifications` | NotificationID | In-app notifications |
| `DataFeeds` | FeedID | Data feed monitoring |
| `SystemLogs` | LogID | Application logs |

---

## 🔑 Key Relationships

### Foreign Key Constraints

```
Users (1) ────────< UserProfiles (N)
Users (1) ────────< Portfolios (N)
Users (1) ────────< Trades (N)
Users (1) ────────< Positions (N)
Users (1) ────────< Notifications (N)
Users (1) ────────< UserAchievements (N)
Users (1) ────────< UserQuests (N)
Users (1) ────────< UserLearningProgress (N)
Users (1) ────────< UserStrategies (N)
Users (1) ────────< LeaderboardEntries (N)

Portfolios (1) ────< PortfolioItems (N)
Portfolios (1) ────< Trades (N)
Portfolios (1) ────< Positions (N)

TradingSignals (1) ────< TakeProfitLevels (N)
TradingSignals (1) ────< Trades (N) [optional link]

Trades (1) ────────< TradeEvents (N)

Achievements (1) ──< UserAchievements (N)
Quests (1) ────────< UserQuests (N)

LearningTopics (1) ──< LearningLessons (N)
LearningLessons (1) ─< UserLearningProgress (N)

Strategies (1) ────< UserStrategies (N)
```

### Cascade Deletes

- When **User** is deleted → All related records cascade delete
- When **Portfolio** is deleted → All items cascade delete
- When **Trade** is deleted → All events cascade delete
- When **Signal** is deleted → All take-profit levels cascade delete

---

## 📊 Pre-Built Views

### vw_UserDashboard
Complete user dashboard in one query
```
Users + UserProfiles + Aggregates
├── Total Achievements
├── Total Portfolio Value
└── Unread Notifications
```

### vw_TopTradingSignals
Top 100 signals sorted by quality
```
TradingSignals
├── Filter: IsActive = 1
├── Sort: IsTopPick DESC
└── Sort: Confidence DESC
```

### vw_Leaderboard
All-time rankings
```
LeaderboardEntries + Users + UserProfiles
├── Filter: IsAllTime = 1
└── Sort: Rank ASC
```

### vw_PortfolioPerformance
Portfolio metrics and statistics
```
Portfolios + PortfolioItems + Aggregates
├── Total Positions
├── Winning/Losing Positions
└── Total Unrealized PnL
```

---

## ⚙️ Stored Procedures

### sp_CreateUser
Creates user + profile + default portfolio
```
INPUT:
  @Email, @PasswordHash, @Username, @FirstName, @LastName, @DisplayName

OUTPUT:
  UserID

CREATES:
  ├── Users record
  ├── UserProfiles record
  └── Default Portfolio
```

### sp_UpdateUserXP
Awards XP and updates level
```
INPUT:
  @UserID, @XPToAdd

OUTPUT:
  NewXP, NewLevel

UPDATES:
  ├── TotalXP
  └── CurrentLevel (auto-calculated)
```

### sp_CompleteQuest
Marks quest complete and awards rewards
```
INPUT:
  @UserID, @QuestID

OUTPUT:
  XPEarned, CoinsEarned

UPDATES:
  ├── UserQuests.IsCompleted
  ├── UserProfiles.TotalXP
  ├── UserProfiles.TotalCoins
  └── UserProfiles.CompletedChallenges
```

### sp_UpdateLeaderboard
Recalculates all rankings
```
INPUT:
  None

OUTPUT:
  None

UPDATES:
  ├── Deletes old all-time entries
  └── Inserts new rankings based on TotalXP
```

---

## 🔄 Auto-Update Triggers

### tr_UpdatePortfolioValue
Auto-updates portfolio total when items change
```
TRIGGER ON: PortfolioItems (INSERT, UPDATE, DELETE)
UPDATES: Portfolios.TotalValue
```

### tr_Users_UpdateTimestamp
Auto-updates modified timestamp
```
TRIGGER ON: Users (UPDATE)
UPDATES: Users.UpdatedAt
```

### tr_UserProfiles_UpdateTimestamp
Auto-updates modified timestamp
```
TRIGGER ON: UserProfiles (UPDATE)
UPDATES: UserProfiles.UpdatedAt
```

---

## 📈 Index Strategy

### Primary Indexes (Clustered)
- Every table has `PRIMARY KEY` clustered index

### Foreign Key Indexes
- All `UserID` columns indexed
- All relationship columns indexed

### Query Optimization Indexes
```
TradingSignals:
  ├── IX_Symbol
  ├── IX_PredictionDate
  ├── IX_Signal
  ├── IX_AssetType
  └── IX_IsTopPick

Trades:
  ├── IX_UserID_Status_EntryDate (Composite)
  ├── IX_Symbol
  └── IX_EntryDate

Notifications:
  ├── IX_UserID_IsRead_CreatedAt (Composite)
  └── IX_CreatedAt

NewsArticles:
  ├── IX_PublishedAt
  ├── IX_Category
  └── IX_Impact
```

---

## 💾 Data Size Estimates

### Initial Database (Empty + Seed Data)
- ~2 MB

### With 1,000 Active Users
- ~500 MB - 1 GB

### With 10,000 Active Users
- ~5 GB - 10 GB

### With 100,000 Active Users
- ~50 GB - 100 GB

### Largest Tables (Expected Growth)
1. **CandleData** - Historical market data (grows fastest)
2. **TradeEvents** - Trade simulation logs
3. **Trades** - All executed trades
4. **SystemLogs** - Application logs
5. **Notifications** - User notifications

---

## 🔒 Security Features

### Authentication
- Password hashing (bcrypt recommended)
- Email verification flag
- Account active/inactive status

### Data Protection
- Parameterized queries prevent SQL injection
- Stored procedures encapsulate logic
- Views restrict data access
- Row-level security can be added

### Audit Trail
- CreatedAt timestamps on all tables
- UpdatedAt timestamps track modifications
- SystemLogs table for application logs
- TradeEvents for complete trade history

---

## 🎯 Performance Optimization

### Already Implemented
✅ Proper indexing on all foreign keys  
✅ Composite indexes for common queries  
✅ Views for complex repeated queries  
✅ Stored procedures for business logic  
✅ Triggers for automatic updates  
✅ Appropriate data types for storage efficiency  

### Future Optimizations
- Partitioning for CandleData (by date)
- Archiving old SystemLogs
- Caching frequently accessed data
- Read replicas for analytics
- Compression for historical data

---

## 🔄 Data Flow Examples

### New User Registration
```
1. INSERT INTO Users
2. TRIGGER: Creates UserProfiles automatically (sp_CreateUser)
3. TRIGGER: Creates Default Portfolio
4. RETURN: UserID
```

### Execute Trade
```
1. INSERT INTO Trades (status='open')
2. INSERT INTO Positions (if new)
3. INSERT INTO TradeEvents (log entry)
4. UPDATE Portfolio (cash balance)
5. TRIGGER: Update Portfolio.TotalValue
```

### Complete Quest
```
1. UPDATE UserQuests (IsCompleted=1)
2. EXEC sp_CompleteQuest
3. UPDATE UserProfiles (XP, Coins)
4. INSERT Notification (quest complete)
5. CHECK: Trigger any new achievements
```

### Award Achievement
```
1. INSERT INTO UserAchievements
2. UPDATE UserProfiles (XP, Coins)
3. INSERT Notification (achievement unlocked)
4. EXEC sp_UpdateUserXP
5. UPDATE UserProfiles.CurrentLevel (auto-calculated)
```

---

## 📊 Summary Statistics

| Category | Count |
|----------|-------|
| **Total Tables** | 29 |
| **Total Views** | 4 |
| **Stored Procedures** | 4 |
| **Triggers** | 3 |
| **Foreign Keys** | ~20 |
| **Indexes** | 50+ |
| **Seed Records** | 27 |

---

## ✅ Checklist for New Features

When adding new features, consider:

- [ ] Create table with appropriate data types
- [ ] Add primary key (IDENTITY)
- [ ] Add foreign keys with ON DELETE CASCADE
- [ ] Add CreatedAt, UpdatedAt timestamps
- [ ] Create indexes on foreign keys
- [ ] Create indexes on frequently queried columns
- [ ] Add view if complex queries expected
- [ ] Add stored procedure if business logic needed
- [ ] Add trigger if automatic updates needed
- [ ] Update this documentation
- [ ] Add to SQL_QUERIES_REFERENCE.md
- [ ] Add example usage in db-connection.ts

---

**Database Version**: 1.0.0  
**Schema Complexity**: Enterprise-Level  
**Total Objects**: 86+ (Tables, Views, Procedures, Triggers, Indexes)  
**Last Updated**: October 10, 2025

