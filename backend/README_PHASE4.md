# Phase 4: Backend API Setup & Database Integration

> **Note**: This document contains Phase 4-specific setup instructions and historical details. For current backend setup and usage, see [backend/README.md](README.md). This file is preserved for reference to Phase 4 implementation details.

## Overview
This phase sets up the WealthArena backend API to run locally without Docker, connecting to the Azure SQL Database provisioned in Phase 1. The backend provides RESTful API endpoints for authentication, user management, trading signals, portfolios, game sessions, leaderboards, and more.

## Prerequisites
- ✅ Phase 1 completed: Azure SQL Database schema deployed
- ✅ Phase 2 completed: Market data loaded into database
- ✅ Node.js 18+ installed
- ✅ npm or yarn package manager
- ✅ Azure SQL Database accessible (firewall rules configured)

## Architecture

```
WealthArena Backend API
├── Express 5.1.0 (Web Framework)
├── TypeScript 5.9.3 (Type Safety)
├── mssql 12.0.0 (Azure SQL Driver)
├── JWT Authentication (jsonwebtoken)
├── CORS Middleware (development: allow all)
└── 14 Route Modules
    ├── /api/auth (signup, login)
    ├── /api/user (profile, xp, achievements, quests)
    ├── /api/signals (top signals, by symbol)
    ├── /api/portfolio (overview, positions, trades)
    ├── /api/game (create, save, resume, complete sessions)
    ├── /api/leaderboard (global, friends, competitions)
    ├── /api/chat (sessions, messages, feedback)
    ├── /api/chatbot (proxy to chatbot service)
    ├── /api/rl-agent (proxy to RL inference service)
    ├── /api/market-data (trending, historical)
    ├── /api/strategies (list, details)
    ├── /api/notifications (user notifications)
    ├── /api/analytics (performance metrics)
    └── /api/learning (topics, progress)
```

## Step-by-Step Setup

### Step 1: Update Environment Configuration

**File:** `WealthArena_Backend/.env`

**Note:** The `.env` file is protected from version control. Create it from the template:

```bash
cd WealthArena_Backend
cp env.example .env
```

**Update database credentials in `.env`:**
```bash
# Azure SQL Database Configuration (Phase 1 credentials)
DB_HOST=sql-wealtharena-dev.database.windows.net
DB_NAME=wealtharena_db
DB_USER=wealtharena_admin
DB_PASSWORD=WealthArena2024!@#$%
DB_PORT=1433
DB_ENCRYPT=true

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret (change in production)
JWT_SECRET=wealtharena-jwt-secret-change-this-in-production-12345
JWT_EXPIRES_IN=7d

# CORS - Allowed Origins
ALLOWED_ORIGINS=http://localhost:5001,http://localhost:8081,http://localhost:3000

# API Configuration
API_VERSION=v1
```

**Verification:**
```bash
cat WealthArena_Backend/.env | grep DB_HOST
# Should show: DB_HOST=sql-wealtharena-dev.database.windows.net
```

### Step 2: Deploy Missing Database Tables

**File:** `database_schemas/users_tables.sql`

The backend references `Users` and `UserProfiles` tables that are NOT in `azure_sql_schema.sql`. Deploy these tables first.

**Deployment Options:**

**Option A: Azure Data Studio**
1. Open Azure Data Studio
2. Connect to `sql-wealtharena-dev.database.windows.net`
3. Open `database_schemas/users_tables.sql`
4. Execute script (F5)
5. Verify tables created:
   ```sql
   SELECT name FROM sys.tables WHERE name IN ('Users', 'UserProfiles', 'Achievements', 'UserAchievements', 'Quests', 'UserQuests', 'UserFriends', 'Competitions', 'CompetitionParticipants', 'GameSessions');
   ```

**Option B: sqlcmd (Command Line)**
```bash
sqlcmd -S sql-wealtharena-dev.database.windows.net -d wealtharena_db -U wealtharena_admin -P "WealthArena2024!@#$%" -i database_schemas/users_tables.sql
```

**Option C: Python Script (Recommended)**
```bash
python deploy_schema.py --schema database_schemas/users_tables.sql
```

**Expected Output:**
```
✅ Table 'Users' created successfully
✅ Table 'UserProfiles' created successfully
✅ Table 'Achievements' created successfully
✅ Table 'UserAchievements' created successfully
✅ Table 'Quests' created successfully
✅ Table 'UserQuests' created successfully
✅ Table 'UserFriends' created successfully
✅ Table 'Competitions' created successfully
✅ Table 'CompetitionParticipants' created successfully
✅ Table 'GameSessions' created successfully
✅ View 'vw_Leaderboard' created successfully
```

### Step 3: Deploy Stored Procedures

**File:** `database_schemas/stored_procedures.sql`

Deploy 5 stored procedures referenced by backend routes.

**Deployment:**
```bash
sqlcmd -S sql-wealtharena-dev.database.windows.net -d wealtharena_db -U wealtharena_admin -P "WealthArena2024!@#$%" -i database_schemas/stored_procedures.sql
```

**Verification:**
```sql
SELECT name, type_desc, create_date 
FROM sys.objects 
WHERE type = 'P' AND name LIKE 'sp_%'
ORDER BY name;
```

**Expected Output:**
```
name                    type_desc           create_date
----------------------- ------------------- -------------------
sp_CreateUser           SQL_STORED_PROCEDURE 2025-01-15 10:30:00
sp_JoinCompetition      SQL_STORED_PROCEDURE 2025-01-15 10:30:00
sp_UpdateLeaderboard    SQL_STORED_PROCEDURE 2025-01-15 10:30:00
sp_UpdateUserCoins       SQL_STORED_PROCEDURE 2025-01-15 10:30:00
sp_UpdateUserXP         SQL_STORED_PROCEDURE 2025-01-15 10:30:00
```

### Step 4: Install Node.js Dependencies

```bash
cd WealthArena_Backend
npm install
```

**Expected Output:**
```
added 150 packages, and audited 151 packages in 15s

20 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**Verify key packages:**
```bash
npm list express mssql cors jsonwebtoken bcryptjs dotenv
```

**Expected Output:**
```
wealtharena_backend@1.0.0
├── bcryptjs@3.0.2
├── cors@2.8.5
├── dotenv@17.2.3
├── express@5.1.0
├── jsonwebtoken@9.0.2
└── mssql@12.0.0
```

### Step 5: Test Database Connection

**Quick Test:**
```bash
node -e "require('dotenv').config(); const db = require('./src/config/database'); db.getPool().then(() => console.log('✅ Connection successful')).catch(err => console.error('❌ Connection failed:', err));"
```

**Expected Output:**
```
✅ Connected to Azure SQL Database
✅ Connection successful
```

**If connection fails:**
1. Verify `.env` credentials are correct
2. Check Azure SQL firewall rules (add your IP)
3. Test network connectivity: `ping sql-wealtharena-dev.database.windows.net`

### Step 6: Start Backend Server

```bash
npm run dev
```

**Expected Output:**
```
🔌 Connecting to database...
✅ Connected to Azure SQL Database

🚀 ========================================
🚀  WealthArena Backend Server Started
🚀 ========================================
🚀  Port: 3000
🚀  Environment: development
🚀  Database: wealtharena_db
🚀 ========================================
🚀  API Documentation: http://localhost:3000/
🚀  Health Check: http://localhost:3000/api/health
🚀 ========================================

[nodemon] watching path(s): src/**/*
[nodemon] watching extensions: ts
[nodemon] starting `ts-node src/server.ts`
```

**Server is now running!** ✅

### Step 7: Test Health Check

**Browser:**
Open `http://localhost:3000/api/health`

**curl:**
```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "WealthArena API is running",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Step 8: Test API Documentation

**Browser:**
Open `http://localhost:3000/`

**Expected Response:** JSON object with all endpoint listings

### Step 9: Test Authentication Endpoints

**Signup:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "full_name": "Test User",
      "tier_level": "beginner",
      "xp_points": 0,
      "total_balance": 100000
    }
  }
}
```

**Save the token** for testing protected endpoints!

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### Step 10: Test Protected Endpoints

**Get User Profile:**
```bash
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer <your-token-from-signup>"
```

**Get Top Signals:**
```bash
curl "http://localhost:3000/api/signals/top?limit=5" \
  -H "Authorization: Bearer <your-token>"
```

**Get Leaderboard:**
```bash
curl http://localhost:3000/api/leaderboard/global \
  -H "Authorization: Bearer <your-token>"
```

## Testing with Postman

For comprehensive testing, use the provided `TESTING_GUIDE.md` which includes:
- Postman collection setup
- Environment variables configuration
- Pre-request scripts for authentication
- Test scripts for token management
- All endpoint examples with expected responses

**Import Postman Collection:**
1. Open Postman
2. Import → Link → `https://www.postman.com/collections/wealtharena-backend`
3. Create environment with `base_url=http://localhost:3000`
4. Run collection tests

## Troubleshooting

### Issue: Port 3000 already in use
**Solution:**
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or change port in .env
PORT=3001
```

### Issue: Database connection timeout
**Solution:**
1. Check Azure SQL firewall rules
2. Add your IP address to allowed IPs
3. Verify connection string in `.env`
4. Test connectivity: `telnet sql-wealtharena-dev.database.windows.net 1433`

### Issue: Stored procedure not found
**Solution:**
```sql
-- Verify procedures exist
SELECT name FROM sys.objects WHERE type = 'P' AND name LIKE 'sp_%';

-- If missing, re-run stored_procedures.sql
```

### Issue: JWT token expired
**Solution:**
Tokens expire after 7 days. Login again to get a new token.

### Issue: CORS error in browser
**Solution:**
Verify `ALLOWED_ORIGINS` in `.env` includes your frontend origin (e.g., `http://localhost:5001` for Expo).

## CORS Configuration

**Development Mode (current):**
- Allows all origins (`origin: true`)
- Perfect for Expo mobile testing with dynamic IPs
- Allows Postman/curl without CORS issues

**Production Mode:**
- Set `NODE_ENV=production` in `.env`
- Only allows origins in `ALLOWED_ORIGINS`
- More secure for deployed environments

## API Endpoints Summary

### Authentication (No Auth Required)
- `POST /api/auth/signup` - Create new user
- `POST /api/auth/login` - User login

### User Management (Auth Required)
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/xp` - Award XP
- `POST /api/user/coins` - Award coins
- `GET /api/user/achievements` - Get achievements
- `GET /api/user/quests` - Get active quests
- `POST /api/user/complete-onboarding` - Complete onboarding

### Trading Signals (Auth Required)
- `GET /api/signals/top` - Get top signals
- `GET /api/signals/:signalId` - Get signal by ID
- `GET /api/signals/symbol/:symbol` - Get signals for symbol

### Portfolio (Auth Required)
- `GET /api/portfolio` - Get portfolio overview
- `GET /api/portfolio/items` - Get portfolio items
- `GET /api/portfolio/trades` - Get trade history
- `GET /api/portfolio/positions` - Get current positions

### Game (Auth Required)
- `POST /api/game/create-session` - Create game session
- `POST /api/game/save-session` - Save game state
- `GET /api/game/resume-session/:sessionId` - Resume session
- `POST /api/game/complete-session` - Complete session
- `GET /api/game/sessions` - Get active sessions
- `GET /api/game/history` - Get game history

### Leaderboard (Auth Required)
- `GET /api/leaderboard/global` - Global leaderboard
- `GET /api/leaderboard/friends` - Friends leaderboard
- `GET /api/leaderboard/competitions` - Active competitions
- `GET /api/leaderboard/competition/:id` - Competition leaderboard
- `POST /api/leaderboard/competition/:id/join` - Join competition

### Other Endpoints
- `GET /api/health` - Health check (no auth)
- `GET /` - API documentation (no auth)
- Chat, Analytics, Learning, Market Data, Notifications, Strategies (all require auth)

## Next Steps

After completing Phase 4:
1. ✅ Verify all endpoints return expected responses
2. ✅ Test authentication flow (signup → login → protected endpoints)
3. ✅ Test game session flow (create → save → complete)
4. ✅ Test leaderboard updates after game completion
5. ➡️ Proceed to Phase 5: Chatbot Service Setup
6. ➡️ Proceed to Phase 6: RL Inference Service Setup
7. ➡️ Proceed to Phase 8: Frontend Integration

## Success Criteria

✅ **Backend server starts without errors**
✅ **Database connection successful**
✅ **Health check returns 200 OK**
✅ **Signup creates user and returns JWT token**
✅ **Login authenticates and returns JWT token**
✅ **Protected endpoints work with valid token**
✅ **Stored procedures execute successfully**
✅ **CORS allows frontend origin**
✅ **All 14 route modules accessible**
✅ **Error handling works correctly**

**Phase 4 Status:** ✅ Ready for Frontend Integration

**Estimated Setup Time:** 30-45 minutes

