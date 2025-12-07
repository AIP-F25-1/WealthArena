# Phase 13: End-to-End Integration Testing & Deployment Verification

## Overview
Systematic testing of all WealthArena components across local, Azure, and GCP deployments to ensure complete functionality before demo. Tests infrastructure, services, integrations, user flows, and data persistence.

## Testing Environments

### Environment 1: Local Development
- Backend: http://localhost:3000
- Chatbot: http://localhost:5001
- RL Service: http://localhost:5002
- Database: Azure SQL (cloud) or PostgreSQL (local Docker)
- **Use for:** Rapid iteration, debugging, feature testing

### Environment 2: Azure Cloud
- Backend: https://wealtharena-backend.azurewebsites.net
- Chatbot: https://wealtharena-chatbot.azurewebsites.net
- RL Service: https://wealtharena-rl.azurewebsites.net
- Database: Azure SQL (sql-wealtharena-dev.database.windows.net)
- **Use for:** Primary demo deployment, production-like testing

### Environment 3: GCP Cloud
- Backend: https://wealtharena-prod.appspot.com
- Chatbot: https://chatbot-dot-wealtharena-prod.appspot.com
- RL Service: https://rl-service-dot-wealtharena-prod.appspot.com
- Database: Cloud SQL PostgreSQL
- **Use for:** Backup deployment, Azure fallback

## Testing Layers

### Layer 1: Infrastructure Verification (30 minutes)

**Test 1.1: Azure Infrastructure**
- Run: `azure_infrastructure/verify_resources.ps1`
- Verify: Resource Group, Storage Account, SQL Database, Key Vault exist
- Test: `scripts/azure_deployment/test_sql_connectivity.ps1`
- Verify: Database accessible from local machine
- Test: `scripts/azure_deployment/verify_storage_containers.ps1`
- Verify: All 5 containers exist (raw-market-data, processed-features, rl-models, chatbot-vectors, user-uploads)
- Check: Key Vault secrets accessible: `az keyvault secret list --vault-name kv-wealtharena-dev`

**Test 1.2: GCP Infrastructure (if deployed)**
- Verify: GCP project exists: `gcloud projects describe wealtharena-prod`
- Verify: Cloud SQL instance running: `gcloud sql instances describe wealtharena-db`
- Verify: Cloud Storage bucket exists: `gsutil ls gs://wealtharena-models`
- Test: Database connectivity via Cloud SQL Proxy
- Check: Secret Manager secrets: `gcloud secrets list`

**Test 1.3: Network Connectivity**
- Test: Azure SQL from local: `sqlcmd -S sql-wealtharena-dev.database.windows.net -U wealtharena_admin -Q "SELECT 1"`
- Test: Azure Blob Storage: `az storage blob list --container-name rl-models --account-name stwealtharenadev --auth-mode login`
- Test: Cloud SQL from local: `psql -h <cloud-sql-ip> -U wealtharena_admin -d wealtharena_db -c "SELECT 1"`
- Test: Cloud Storage: `gsutil ls gs://wealtharena-models/latest/`

**Expected Results:**
- ✅ All infrastructure resources accessible
- ✅ Database connections successful
- ✅ Storage containers readable/writable
- ✅ Secrets retrievable from Key Vault/Secret Manager

---

### Layer 2: Service Health Checks (20 minutes)

**Test 2.1: Backend API Health**
- Local: `curl http://localhost:3000/api/health`
- Azure: `curl https://wealtharena-backend.azurewebsites.net/api/health`
- GCP: `curl https://wealtharena-prod.appspot.com/api/health`
- Expected: `{"success": true, "message": "WealthArena API is running"}`
- Verify: All 14 route modules loaded (check root endpoint `/` for API documentation)

**Test 2.2: Chatbot Service Health**
- Local: `curl http://localhost:5001/healthz`
- Azure: `curl https://wealtharena-chatbot.azurewebsites.net/healthz`
- GCP: `curl https://chatbot-dot-wealtharena-prod.appspot.com/healthz`
- Expected: `{"status": "healthy", "service": "wealtharena-mobile-api"}`
- Test: Knowledge topics endpoint: `curl <url>/context/knowledge/topics`
- Expected: Array of 15 topics

**Test 2.3: RL Service Health**
- Local: `curl http://localhost:5002/health`
- Azure: `curl https://wealtharena-rl.azurewebsites.net/health`
- GCP: `curl https://rl-service-dot-wealtharena-prod.appspot.com/health`
- Expected: `{"status": "healthy", "model_loaded": true}` (or false if mock mode)
- Test: Prediction endpoint with sample data
- Expected: Comprehensive prediction with TP/SL levels

**Test 2.4: Database Query Tests**
- Test: `SELECT COUNT(*) FROM processed_prices` (should have ~300K-400K rows from Phase 2)
- Test: `SELECT COUNT(*) FROM rl_signals` (should have signals from Phase 3 or 7)
- Test: `SELECT COUNT(*) FROM Users` (should have test users from Phase 4)
- Test: `SELECT * FROM vw_Leaderboard` (should return leaderboard view)
- Test: `EXEC CalculatePortfolioPerformance @PortfolioID=1` (stored procedure)

**Expected Results:**
- ✅ All services return healthy status
- ✅ Database queries execute successfully
- ✅ API documentation accessible
- ✅ No 500 errors in service logs

---

### Layer 3: Service Integration Testing (30 minutes)

**Test 3.1: Backend → Chatbot Proxy**
- Endpoint: `POST /api/chatbot/chat`
- Test: `curl -X POST <backend-url>/api/chatbot/chat -H "Content-Type: application/json" -d '{"message": "What is RSI?", "user_id": "test"}'`
- Verify: Backend forwards to chatbot /v1/chat endpoint
- Verify: Response wrapped in `{success: true, data: {...}}` format
- Expected: Educational response about RSI from GROQ LLM

**Test 3.2: Backend → RL Service Proxy**
- Endpoint: `POST /api/rl-agent/predictions`
- Test: `curl -X POST <backend-url>/api/rl-agent/predictions -H "Content-Type: application/json" -d '{"symbol": "BHP.AX", "horizon": 1}'`
- Verify: Backend forwards to RL service /predict endpoint
- Verify: Response includes entry, take_profit, stop_loss, risk_metrics
- Expected: Comprehensive trading signal prediction

**Test 3.3: Backend → Database Integration**
- Test: Signup creates user: `POST /api/auth/signup`
- Verify: User inserted into Users and UserProfiles tables
- Test: Get user profile: `GET /api/user/profile` (with JWT token)
- Verify: Data retrieved from database matches inserted data
- Test: Update profile: `PUT /api/user/profile`
- Verify: Database updated, changes reflected in subsequent GET requests

**Test 3.4: RL Service → Database Integration**
- Test: Top setups endpoint: `POST /api/top-setups {"asset_type": "stocks", "count": 3}`
- Verify: RL service queries processed_prices table for market data
- Verify: Returns ranked signals based on database data
- Expected: 3 trading setups with real symbol data

**Test 3.5: Chatbot → GROQ API Integration**
- Test: Chat endpoint: `POST /v1/chat {"message": "Explain MACD"}`
- Verify: Chatbot calls GROQ API with llama3-8b-8192 model
- Verify: Response contains educational content
- Check: GROQ_API_KEY environment variable set correctly
- Expected: Detailed explanation of MACD indicator

**Expected Results:**
- ✅ All proxy endpoints forward requests correctly
- ✅ Services communicate without errors
- ✅ Database operations (CRUD) work end-to-end
- ✅ External API integrations (GROQ) functional

---

### Layer 4: Frontend-Backend Integration (45 minutes)

**Test 4.1: API Configuration Validation**
- Check: `WealthArena/config/apiConfig.ts` reads environment variables correctly
- Verify: EXPO_PUBLIC_BACKEND_URL, EXPO_PUBLIC_CHATBOT_URL, EXPO_PUBLIC_RL_SERVICE_URL set in .env
- Test: Switch between .env (local), .env.azure (Azure), .env.gcp (GCP)
- Verify: API calls go to correct endpoints based on environment
- Check: ENDPOINTS object has all required endpoints (auth, user, portfolio, signals, game, leaderboard, chat, notifications, analytics, learning)

**Test 4.2: Authentication Flow**
- Test: Email/password signup via mobile app
- Verify: POST /api/auth/signup called with user data
- Verify: JWT token returned and saved to AsyncStorage
- Verify: User data saved to AsyncStorage
- Verify: Navigation to onboarding or dashboard
- Test: Login with created account
- Verify: POST /api/auth/login called
- Verify: Token and user data retrieved
- Test: Google OAuth (if implemented)
- Verify: OAuth flow completes, backend /api/auth/google called

**Test 4.3: Account Page Data Fetching**
- Navigate: Account tab in mobile app
- Verify: GET /api/user/profile called on mount
- Verify: Profile data displays (avatar, bio, tier, XP, coins, win rate, trades, streak)
- Verify: Pull-to-refresh triggers new API call
- Verify: Data updates in UI after refresh
- Test: Edit profile (change avatar, bio)
- Verify: PUT /api/user/profile called
- Verify: Database updated, changes persist after app restart

**Test 4.4: Dashboard Data Loading**
- Navigate: Dashboard tab
- Verify: Parallel API calls to /api/portfolio and /api/signals/top
- Verify: Portfolio value displays from backend (not mock data)
- Verify: Daily P&L calculates correctly
- Verify: Trading signals display (3 cards)
- Verify: Market data loads (candlestick chart)
- Verify: News feed displays (RSS + backend + chatbot sources)
- Test: Pull-to-refresh reloads all data

**Test 4.5: Signals Page Integration**
- Navigate: Signals page
- Test: AI mode - verify POST /api/rl-agent/top-setups called
- Verify: AI signal cards display with comprehensive details (entry, TP1/TP2/TP3, SL, risk metrics, position sizing)
- Test: Legacy mode - verify GET /api/signals/top called
- Verify: Backend signals display from vw_TopTradingSignals view
- Test: "Create Portfolio from Signal" button
- Verify: POST /api/portfolio/from-signal called
- Verify: Portfolio created in database
- Verify: Navigation to portfolio page shows new portfolio

**Test 4.6: Portfolio Page Integration**
- Navigate: Portfolio Builder page
- Verify: GET /api/portfolio called
- Verify: Portfolio overview displays
- Verify: GET /api/portfolio/positions called
- Verify: Positions display with unrealized P&L
- Verify: GET /api/portfolio/trades called
- Verify: Trade history displays with realized P&L
- Test: Create new portfolio
- Verify: POST /api/portfolio called with assets and allocations
- Verify: Portfolio and positions created in database

**Test 4.7: Game Pages Integration**
- Navigate: Game tab
- Verify: GET /api/game/sessions called (active sessions)
- Verify: GET /api/game/history called (completed games)
- Test: Start new game from game-setup
- Verify: POST /api/game/create-session called
- Verify: Navigation to game-play with sessionId
- Test: Save game during play
- Verify: POST /api/game/save-session called
- Verify: Game state persisted to database
- Test: Resume saved game
- Verify: GET /api/game/resume-session/:sessionId called
- Verify: Game loads with saved state
- Test: Complete game
- Verify: POST /api/game/complete-session called
- Verify: XP and coins awarded
- Verify: sp_UpdateLeaderboard called by backend

**Test 4.8: Leaderboard Integration**
- Navigate: Chat tab (leaderboard display)
- Verify: GET /api/leaderboard/global called
- Verify: Rankings display with usernames, avatars, XP, win rates
- Verify: Current user's entry highlighted
- Wait: 30 seconds for auto-refresh
- Verify: GET /api/leaderboard/global called again (auto-refresh)
- Test: Complete a game
- Wait: 30 seconds
- Verify: User's rank updates in leaderboard

**Test 4.9: Learning Page Integration**
- Navigate: Learning page
- Verify: GET /context/knowledge/topics called (chatbot)
- Verify: 15 topics display (not 7 mock topics)
- Test: Tap topic to open AI chat
- Verify: GET /context/knowledge/topics/{id} called
- Verify: AI chat initializes in learning mode
- Test: Ask questions in chat
- Verify: POST /v1/chat called with learning context
- Verify: Educational responses from GROQ
- Test: Complete lesson
- Verify: POST /api/user/complete-lesson called (if endpoint exists)
- Verify: XP awarded (20-50 based on difficulty)

**Test 4.10: Notifications Integration**
- Navigate: Notifications page
- Verify: GET /api/notifications called
- Verify: Real notifications display (not mock data)
- Test: Tap notification
- Verify: PUT /api/notifications/{id}/read called
- Verify: Notification marked as read in UI and database
- Test: "Mark all read" button
- Verify: PUT /api/notifications/read-all called
- Wait: 30 seconds
- Verify: GET /api/notifications/unread-count called (polling)

**Test 4.11: Analytics Page Integration**
- Navigate: Analytics page with user having 200+ XP
- Verify: GET /api/analytics/performance called
- Verify: Real portfolio data displays (not mock)
- Verify: Performance chart shows actual equity curve
- Verify: Metrics accurate (total return, Sharpe ratio, max drawdown, win rate)
- Test: Change timeframe (1D, 1W, 1M)
- Verify: API called with timeframe parameter
- Verify: Chart and metrics update

**Test 4.12: News Page Integration**
- Navigate: News page
- Verify: Three parallel API calls:
  - newsService.getHighImpactNews() (external RSS)
  - GET /api/market-data/trending (backend)
  - GET /v1/search?q=stock market news (chatbot)
- Verify: Unified news feed displays with source badges (RSS, Market, AI)
- Test: Source filter tabs
- Verify: Filtering works correctly

**Expected Results:**
- ✅ All pages connect to correct backend endpoints
- ✅ API calls succeed with 200 OK responses
- ✅ Data displays correctly in UI (no mock data)
- ✅ User interactions trigger appropriate API calls
- ✅ Loading states and error handling work

---

### Layer 5: Complete User Journey Testing (90 minutes)

**Journey 1: New User Onboarding (15 minutes)**

**Steps:**
1. Launch app (fresh install or cleared AsyncStorage)
2. Tap "Sign Up" on landing page
3. Enter email, password, username, name
4. Submit signup form
5. Complete onboarding questions (conversational flow)
6. Select avatar (mascot variant)
7. Tap "Get Started" on completion screen
8. Land on dashboard

**Verifications:**
- ✅ POST /api/auth/signup creates user in database
- ✅ JWT token saved to AsyncStorage
- ✅ Onboarding awards 50 XP and 500 coins
- ✅ POST /api/user/complete-onboarding called
- ✅ UserProfiles.HasCompletedOnboarding = 1 in database
- ✅ Avatar saved to database (avatar_type, avatar_variant)
- ✅ Dashboard displays user data (name, XP, coins)
- ✅ App restart shows dashboard (not login) - token persisted

**Journey 2: Learning & XP Progression (20 minutes)**

**Steps:**
1. Navigate to Learning page
2. Tap "Technical Analysis" topic
3. AI chat opens in learning mode
4. Ask 3-5 questions about technical analysis
5. Type "I completed this lesson"
6. Return to learning page
7. Repeat for 2 more topics
8. Check account page for XP updates

**Verifications:**
- ✅ Topics load from chatbot (15 topics)
- ✅ AI chat provides educational responses
- ✅ Lesson completion awards XP (20-50 per lesson)
- ✅ POST /api/user/xp called for each lesson
- ✅ UserProfiles.TotalXP increments in database
- ✅ Account page shows updated XP (e.g., 50 → 110 → 170)
- ✅ Feature unlocks at thresholds (Portfolio Builder at 100 XP, Analytics at 200 XP)
- ✅ Unlock notifications appear

**Journey 3: Trading Signals → Portfolio Creation (15 minutes)**

**Steps:**
1. Navigate to Signals page
2. Switch to AI mode
3. View top 3 AI signals
4. Tap "Create Portfolio" on BHP.AX BUY signal
5. Enter investment amount: $10,000
6. Enter portfolio name: "BHP Signal Portfolio"
7. Confirm creation
8. Navigate to Portfolio page
9. View created portfolio

**Verifications:**
- ✅ POST /api/rl-agent/top-setups returns ranked signals
- ✅ Signal cards display with entry, TP1/TP2/TP3, SL, confidence, risk metrics
- ✅ POST /api/portfolio/from-signal creates portfolio
- ✅ Portfolio inserted into portfolios table
- ✅ Position created in positions table with signal parameters
- ✅ Portfolio displays in portfolio page
- ✅ Position shows: symbol, quantity, entry price, TP/SL levels
- ✅ Signal_id linked to position for tracking

**Journey 4: Game Session Flow (25 minutes)**

**Steps:**
1. Navigate to Game tab
2. Tap "Start Learning" (Beginner mode)
3. Configure: Select 3 symbols, set difficulty
4. Tap "Start Game"
5. Game loads with initial balance $10,000
6. Make 3-5 trades (buy/sell)
7. Tap "Save & Exit"
8. Navigate back to Game tab
9. Verify "Active Sessions" card shows saved game
10. Tap "Resume Game"
11. Game loads with saved state
12. Make 2-3 more trades
13. Tap "Complete Game"
14. View rewards screen (XP, coins)
15. Navigate to leaderboard
16. Wait 30 seconds for auto-refresh
17. Verify rank updated

**Verifications:**
- ✅ POST /api/game/create-session creates session in game_sessions table
- ✅ SessionId passed to game-play page
- ✅ Game initializes with session data
- ✅ POST /api/game/save-session persists state to database
- ✅ GET /api/game/sessions returns active session
- ✅ GET /api/game/resume-session/:sessionId loads saved state
- ✅ Trades, positions, balance restored correctly
- ✅ POST /api/game/complete-session awards XP/coins
- ✅ sp_UpdateUserXP and sp_UpdateUserCoins called
- ✅ sp_UpdateLeaderboard called
- ✅ vw_Leaderboard view updates with new rank
- ✅ LeaderboardContext auto-refreshes (30s interval)
- ✅ User's rank increases in leaderboard display

**Journey 5: Historical Signals Tracking (15 minutes)**

**Steps:**
1. Navigate to Signals page
2. Toggle "View Historical Signals"
3. View past signals with outcomes
4. Find a WIN signal
5. Review actual entry/exit prices and P&L
6. Find a LOSS signal
7. Review actual outcome

**Verifications:**
- ✅ GET /api/signals/historical called
- ✅ vw_HistoricalSignals view returns signals with trade outcomes
- ✅ Historical signal cards display:
  - Original signal (entry, TP, SL, confidence)
  - Actual outcome (actual entry, actual exit, realized P&L)
  - Days held
  - Outcome badge (WIN/LOSS/PENDING)
  - "What if" text showing potential profit/loss
- ✅ WIN signals show in green with positive P&L
- ✅ LOSS signals show in red with negative P&L
- ✅ PENDING signals show in yellow (trade not closed)

**Expected Results:**
- ✅ All 5 user journeys complete without errors
- ✅ Data persists across app restarts
- ✅ Database updates reflect in UI
- ✅ XP progression unlocks features
- ✅ Game completion updates leaderboard

---

### Layer 6: Data Persistence & Accuracy Validation (30 minutes)

**Test 6.1: Game Session Persistence**
- Create game session, make trades, save
- Query database: `SELECT * FROM game_sessions WHERE SessionID = '<session-id>'`
- Verify: GameState column contains JSON with positions, trades, balance
- Resume game in app
- Verify: All positions, trades, balance restored exactly
- Make more trades
- Complete game
- Query database: `SELECT * FROM game_sessions WHERE SessionID = '<session-id>'`
- Verify: IsActive = 0, CompletedAt timestamp set, FinalBalance recorded, XPAwarded and CoinsAwarded set

**Test 6.2: Portfolio Accuracy**
- Create portfolio with 3 assets (60% AAPL, 25% MSFT, 15% GOOGL)
- Query database: `SELECT * FROM portfolios WHERE user_id = <user-id>`
- Verify: Portfolio record exists with correct initial_capital
- Query: `SELECT * FROM positions WHERE portfolio_id = <portfolio-id>`
- Verify: 3 positions created with correct quantities based on allocations
- Verify: Entry prices match current market prices
- Check app portfolio page
- Verify: Total value = sum of (quantity × current_price) + cash_balance
- Verify: Unrealized P&L = sum of (current_price - entry_price) × quantity

**Test 6.3: Leaderboard Ranking Accuracy**
- Query database: `SELECT * FROM vw_Leaderboard ORDER BY TotalReturns DESC`
- Note top 3 users and their stats
- Check leaderboard in app
- Verify: Rankings match database query results
- Verify: User stats (XP, win rate, total trades) match database
- Complete a game with good performance
- Wait for sp_UpdateLeaderboard execution
- Query database again
- Verify: User's TotalReturns, WinRate, TotalTrades updated
- Verify: Rank recalculated correctly

**Test 6.4: Historical Signals Outcome Tracking**
- Query database: `SELECT * FROM vw_HistoricalSignals WHERE Outcome = 'win' LIMIT 5`
- Note signal details and actual outcomes
- Check historical signals in app
- Verify: Same signals display with matching outcomes
- Verify: ActualPnL calculations correct: (ActualExitPrice - ActualEntryPrice) × Quantity
- Verify: ActualReturn percentage correct: ((ActualExitPrice - ActualEntryPrice) / ActualEntryPrice) × 100
- Cross-reference with trades table: `SELECT * FROM trades WHERE signal_id = <signal-id>`
- Verify: Trade data matches signal outcome data

**Test 6.5: User Profile Synchronization**
- Update profile in app (change bio, avatar)
- Query database: `SELECT * FROM UserProfiles WHERE UserID = <user-id>`
- Verify: Bio and avatar fields updated in database
- Close app completely
- Reopen app
- Navigate to account page
- Verify: Updated bio and avatar display (loaded from AsyncStorage)
- Pull to refresh
- Verify: Data still matches database (no drift)

**Expected Results:**
- ✅ All data persists correctly to database
- ✅ App state matches database state
- ✅ Calculations accurate (P&L, returns, win rate)
- ✅ No data loss on app restart
- ✅ Synchronization between AsyncStorage and database

---

### Layer 7: Chatbot RAG & Model Validation (20 minutes)

**Test 7.1: Chatbot Knowledge Base**
- Verify: `chatbot_setup/financial_knowledge_base.json` exists (from Phase 5)
- Verify: Contains 75+ financial terms across 7 categories
- Test: Ask chatbot "What is RSI?"
- Verify: Response includes definition from knowledge base or GROQ
- Test: Ask "Explain moving averages"
- Verify: Educational response with SMA/EMA explanation

**Test 7.2: Chroma Vector DB**
- Check: Chatbot service logs for Chroma initialization
- Expected: "Chroma client initialized successfully" or "Failed to initialize Chroma" (fallback to in-memory)
- Test: Search endpoint: `GET /v1/search?q=stock market&k=5`
- Verify: Returns search results (Chroma or in-memory)
- If Chroma working: Verify results ranked by similarity score
- If in-memory fallback: Verify TF-based scoring works

**Test 7.3: Sentiment Analysis**
- Test: Chat with "analyze: The stock market is performing exceptionally well"
- Verify: Sentiment analysis response with probabilities (Negative, Neutral, Positive)
- Verify: Predicted sentiment matches text tone
- Test: Multiple texts with different sentiments
- Verify: Accuracy of sentiment classification

**Test 7.4: Trade Setup Cards**
- Test: Chat with "/setup for AAPL"
- Verify: Trade setup card generated with:
  - Symbol, name, current price
  - Signal (BUY/SELL/HOLD)
  - Confidence score
  - Entry price, TP levels (2), SL
  - Technical indicators (RSI, SMA, MACD, Bollinger Bands)
  - Reasoning text
- Verify: Indicators calculated from real market data (if available) or mock data

**Test 7.5: RL Model Predictions**
- Test: POST /predict endpoint with real market data
- Verify: If models trained (Phase 7 completed):
  - Model loads from checkpoints directory
  - Prediction uses trained policy (not mock)
  - Confidence scores realistic (0.6-0.9 range)
  - TP/SL levels calculated using ATR-based risk management
- Verify: If mock mode:
  - RLModelService generates predictions using heuristics
  - Signals based on RSI, MACD, momentum, volume
  - TP/SL levels calculated correctly
  - Position sizing uses Kelly Criterion
- Test: Multiple symbols across asset classes
- Verify: Predictions vary based on market data (not random)

**Test 7.6: Model Performance Validation (if trained)**
- Review: `wealtharena_rl/results/master_comparison/comparison_report.json`
- Verify: All 5 agents have win rate ≥ 70%
- Verify: Sharpe ratios ≥ 1.5
- Verify: Max drawdowns ≤ 15%
- Test: Generate 20 predictions from each agent
- Track: Actual outcomes over 1 week
- Calculate: Realized win rate from actual trades
- Compare: Backtested win rate vs actual win rate

**Expected Results:**
- ✅ Chatbot knowledge base accessible
- ✅ Chroma vector DB working or graceful fallback
- ✅ Sentiment analysis accurate
- ✅ Trade setup cards comprehensive
- ✅ RL predictions realistic and varied
- ✅ Model performance meets 70%+ win rate target (if trained)

---

### Layer 8: Configuration Validation (15 minutes)

**Test 8.1: Environment Variables - Local**
- Check: `WealthArena/.env` exists
- Verify: EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
- Verify: EXPO_PUBLIC_CHATBOT_URL=http://localhost:5001
- Verify: EXPO_PUBLIC_RL_SERVICE_URL=http://localhost:5002
- Check: `WealthArena_Backend/.env` exists
- Verify: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD set correctly
- Verify: JWT_SECRET set (not default value)
- Verify: CHATBOT_API_URL=http://localhost:5001
- Verify: RL_API_URL=http://localhost:5002
- Check: `wealtharena_chatbot/.env` exists
- Verify: GROQ_API_KEY set
- Verify: PORT=5001
- Check: `services/rl-service/.env` exists
- Verify: PORT=5002
- Verify: MODEL_PATH points to checkpoints directory

**Test 8.2: Environment Variables - Azure**
- Check: `WealthArena/.env.azure` exists
- Verify: All EXPO_PUBLIC_* URLs point to *.azurewebsites.net
- Check: Azure Web App settings for backend:
  - `az webapp config appsettings list --name wealtharena-backend --resource-group rg-wealtharena-northcentralus`
- Verify: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD set
- Verify: CHATBOT_API_URL and RL_API_URL point to Azure Web Apps
- Check: Azure Web App settings for chatbot:
- Verify: GROQ_API_KEY set
- Verify: PORT=8000 (Azure default)
- Check: Azure Web App settings for RL service:
- Verify: DB credentials set for market data queries
- Verify: MODEL_PATH set
- Verify: AZURE_STORAGE_CONNECTION_STRING set for model downloads

**Test 8.3: Environment Variables - GCP**
- Check: `WealthArena/.env.gcp` exists
- Verify: All EXPO_PUBLIC_* URLs point to *.appspot.com
- Check: Backend app.yaml env_variables section
- Verify: DB_HOST uses Unix socket format (/cloudsql/...)
- Verify: DB_PORT=5432 (PostgreSQL)
- Verify: Service URLs point to App Engine services
- Check: Chatbot app.yaml env_variables
- Verify: GROQ_API_KEY set
- Check: RL service app.yaml env_variables
- Verify: GCS_BUCKET set for model downloads

**Test 8.4: API Keys Validation**
- GROQ API Key: Test with curl to GROQ API
- JWT Secret: Verify not using default value
- Database Passwords: Verify meet complexity requirements
- Storage Connection Strings: Test blob upload/download

**Test 8.5: Connection Strings Validation**
- Azure SQL: Test connection from local machine
- Cloud SQL: Test connection via Cloud SQL Proxy
- Azure Blob Storage: Test upload/download operations
- Cloud Storage: Test gsutil operations

**Expected Results:**
- ✅ All .env files exist and complete
- ✅ No default/placeholder values in production configs
- ✅ API keys valid and working
- ✅ Connection strings tested and functional
- ✅ Service URLs correct for each environment

---

### Layer 9: Cross-Environment Testing (30 minutes)

**Test 9.1: Local → Azure Migration**
- Test all features on localhost
- Document working features
- Switch frontend to Azure: `copy .env.azure .env`
- Restart Expo
- Test same features on Azure backend
- Compare: Response times, data accuracy, error rates
- Document: Any features that work locally but fail on Azure

**Test 9.2: Azure → GCP Migration**
- Test all features on Azure
- Document working features
- Switch frontend to GCP: `copy .env.gcp .env`
- Restart Expo
- Test same features on GCP backend
- Compare: Response times, data accuracy, error rates
- Document: Any features that work on Azure but fail on GCP

**Test 9.3: Data Consistency Across Clouds**
- Create user on Azure deployment
- Note: User data, portfolio, trades
- Create same user on GCP deployment (different database)
- Perform same actions (create portfolio, play game)
- Compare: Data structures, calculations, behavior
- Verify: Both deployments produce consistent results

**Test 9.4: Failover Testing**
- Configure frontend with both Azure and GCP URLs
- Implement: Automatic failover logic (if Azure fails, try GCP)
- Test: Stop Azure backend
- Verify: App switches to GCP backend automatically
- Test: Restart Azure backend
- Verify: App switches back to Azure (primary)

**Expected Results:**
- ✅ All features work on all three environments
- ✅ Data consistency across deployments
- ✅ Performance acceptable on cloud deployments
- ✅ Failover mechanism works (if implemented)

---

### Layer 10: Performance & Edge Case Testing (20 minutes)

**Test 10.1: Offline Behavior**
- Enable airplane mode on device
- Navigate through app
- Verify: Cached data displays (AsyncStorage)
- Verify: Error messages show for failed API calls
- Verify: Retry buttons available
- Verify: App doesn't crash
- Disable airplane mode
- Verify: App reconnects and syncs data

**Test 10.2: Slow Network Simulation**
- Use network throttling (Chrome DevTools or Charles Proxy)
- Set: 3G speed (750 Kbps)
- Navigate through app
- Verify: Loading indicators show
- Verify: Timeouts handled gracefully (30s timeout)
- Verify: No infinite loading states

**Test 10.3: Invalid Data Handling**
- Test: Login with wrong password
- Verify: Error message shows, no crash
- Test: Create portfolio with invalid allocation (sum ≠ 100%)
- Verify: Validation error shows
- Test: Request non-existent signal
- Verify: 404 error handled gracefully

**Test 10.4: Concurrent User Scenarios**
- Create 2 test accounts
- Both users: Play game simultaneously
- Both users: Complete game at same time
- Verify: Leaderboard updates correctly for both
- Verify: No race conditions in rank calculation
- Verify: sp_UpdateLeaderboard handles concurrent calls

**Test 10.5: Large Data Sets**
- Create portfolio with 20+ positions
- Verify: Portfolio page loads without lag
- Verify: Pagination works (if implemented)
- Create 100+ trades
- Verify: Trade history loads efficiently
- Verify: Win rate calculation accurate

**Expected Results:**
- ✅ Graceful offline behavior
- ✅ Slow networks handled with timeouts
- ✅ Invalid data rejected with clear errors
- ✅ Concurrent operations don't cause conflicts
- ✅ Large data sets perform acceptably

---

## Testing Execution Plan

### Week 1: Local & Azure Testing
- **Day 1-2**: Layers 1-3 (Infrastructure, Services, Integrations)
- **Day 3-4**: Layers 4-5 (Frontend Integration, User Journeys)
- **Day 5**: Layer 6 (Data Persistence)
- **Day 6**: Layer 7 (Chatbot & Models)
- **Day 7**: Layers 8-9 (Configuration, Cross-Environment)

### Week 2: GCP Testing & Bug Fixes
- **Day 8-9**: GCP deployment and testing
- **Day 10-11**: Layer 10 (Performance & Edge Cases)
- **Day 12-13**: Bug fixes and retesting
- **Day 14**: Final verification and demo preparation

## Success Criteria

### Critical (Must Pass for Demo)
- ✅ All services healthy on at least one cloud (Azure or GCP)
- ✅ User signup and login work
- ✅ Dashboard displays real data
- ✅ Game session flow complete (create → play → save → resume → complete)
- ✅ Leaderboard updates after game completion
- ✅ Trading signals display (AI or legacy mode)
- ✅ Portfolio creation works
- ✅ AI chat provides educational responses

### Important (Should Pass for Full Demo)
- ✅ Google OAuth works
- ✅ Avatar selection and persistence
- ✅ Historical signals show outcomes
- ✅ Analytics page displays performance metrics
- ✅ Notifications system functional
- ✅ News feed from multiple sources
- ✅ Learning progress tracking

### Nice-to-Have (Enhance Demo)
- ✅ Both Azure and GCP deployments working
- ✅ RL models trained with 70%+ win rate
- ✅ Chroma vector DB working (not fallback)
- ✅ Custom avatar upload functional
- ✅ Real-time leaderboard updates
- ✅ Performance optimizations (fast load times)

## Bug Tracking Template

**For each bug found, document:**
- **ID**: BUG-001, BUG-002, etc.
- **Severity**: Critical / High / Medium / Low
- **Priority**: P0 (blocks demo) / P1 (important) / P2 (nice-to-have)
- **Component**: Frontend page, Backend route, Database, Service integration
- **Description**: Clear description of issue
- **Steps to Reproduce**: Exact steps to trigger bug
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Local / Azure / GCP
- **Workaround**: Temporary fix (if available)
- **Fix Required**: Code changes needed
- **Status**: Open / In Progress / Fixed / Deferred

## Documentation Deliverables

1. **TEST_RESULTS_SUMMARY.md**: Pass/fail for each test layer
2. **BUG_TRACKING_SHEET.xlsx**: All identified bugs with priority
3. **CONFIGURATION_CHECKLIST.md**: All .env files validated
4. **DEPLOYMENT_VERIFICATION_REPORT.md**: Azure + GCP status
5. **DEMO_PREPARATION_GUIDE.md**: What works, what to avoid, demo script
6. **KNOWN_ISSUES.md**: Documented limitations and workarounds
7. **POST_DEMO_IMPROVEMENTS.md**: Features to add after demo

## Estimated Testing Time

- **Infrastructure & Services**: 1.5 hours
- **Frontend Integration**: 2 hours
- **User Journeys**: 3 hours
- **Data Validation**: 1.5 hours
- **Model & RAG Testing**: 1 hour
- **Configuration**: 1 hour
- **Cross-Environment**: 1.5 hours
- **Performance & Edge Cases**: 1 hour
- **Documentation**: 2 hours
- **Bug Fixes**: 4-8 hours (depends on issues found)

**Total: 18-22 hours** (2.5-3 days of focused testing)

**With 2-week timeline:**
- Week 1: Complete all testing layers, document bugs
- Week 2: Fix critical bugs, retest, prepare demo

---

**Phase 13 Status:** Ready for systematic execution

**Next Phase:** Production folder structure and Git repository preparation (handled by other engineers)