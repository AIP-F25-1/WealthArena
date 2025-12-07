# Phase 10: Learning, Onboarding, News & Notifications Testing Guide

## Prerequisites
- Backend API running on localhost:3000
- Chatbot service running on localhost:5001
- Database tables created (Notifications, NotificationPreferences, OnboardingAnalytics)
- Frontend running with Expo
- Test user account with varying XP levels

## Test Suite 1: Learning Page Integration

### Test 1.1: Knowledge Topics Loading
1. Navigate to Learning page
2. **Expected:**
   - GET /context/knowledge/topics called (chatbot)
   - 15 topics display (not 7 mock topics)
   - Topics show: Technical Analysis, Risk Management, Portfolio Management, Market Analysis, etc.
   - Each topic shows lesson count and progress
   - Overall progress bar displays

### Test 1.2: Topic Navigation to AI Chat
1. Tap "Technical Analysis" topic
2. **Expected:**
   - Navigate to /ai-chat?topic=technical_analysis_basics&mode=learning
   - AI chat loads in learning mode
   - GET /context/knowledge/topics/technical_analysis_basics called
   - Welcome message shows topic title and description
   - Chat ready for questions

### Test 1.3: Learning Progress Tracking
1. Complete a lesson in AI chat
2. Return to learning page
3. **Expected:**
   - Topic progress updates (if backend supports)
   - Lessons completed count increments
   - Overall progress bar updates

## Test Suite 2: AI Chat Learning Mode

### Test 2.1: Topic-Based Learning
1. Open AI chat from learning page with topic
2. Ask question: "What is RSI?"
3. **Expected:**
   - POST /v1/chat with learning context
   - Chatbot provides educational response about RSI
   - Response tailored to topic (Technical Analysis)

### Test 2.2: Lesson Completion
1. In learning mode, type "I'm done with this lesson"
2. **Expected:**
   - POST /api/user/complete-lesson called
   - XP awarded (20-50 based on difficulty)
   - Coins awarded (100)
   - Success message shows rewards

### Test 2.3: General Chat Mode
1. Open AI chat without topic parameter
2. Ask general question
3. **Expected:**
   - POST /v1/chat without learning context
   - Chatbot provides general trading assistance
   - Can request AI signals with "Show me top 3 AI signals"

## Test Suite 3: Progressive Onboarding

### Test 3.1: Onboarding Flow
1. Create new user account
2. Complete onboarding questions
3. Select avatar
4. **Expected:**
   - Conversational flow works
   - Progress bar updates
   - Avatar selection screen appears
   - Completion screen shows rewards: +50 XP, +500 Coins

### Test 3.2: XP Award on Completion
1. Tap "Get Started" on completion screen
2. **Expected:**
   - POST /api/user/xp {xpAmount: 50}
   - POST /api/user/coins {coinsAmount: 500}
   - POST /api/user/complete-onboarding
   - UserProfiles updated: TotalXP = 50, TotalCoins = 500, HasCompletedOnboarding = 1
   - Navigate to dashboard

### Test 3.3: Feature Unlock Display
1. On completion screen, check unlocked features
2. **Expected:**
   - Shows "Features Unlocked" section
   - Lists: Dashboard, Learning, Game (unlocked at 0 XP)
   - Shows next unlock: "Earn 50 more XP to unlock Portfolio Builder (100 XP)"

### Test 3.4: Progressive Access
1. With 50 XP, try to access Portfolio Builder
2. **Expected:**
   - Shows "Unlock at 100 XP" badge or message
   - Doesn't block access completely (user can view but limited features)
   - Shows progress: "50/100 XP - 50% to unlock"
3. Earn 50 more XP (complete lessons)
4. Try Portfolio Builder again
5. **Expected:**
   - Full access granted
   - No unlock message
   - All features available

## Test Suite 4: News Integration

### Test 4.1: Unified News Feed
1. Navigate to News page
2. **Expected:**
   - Parallel fetches from 3 sources:
     - newsService.getHighImpactNews() (RSS)
     - GET /api/market-data/trending (Backend)
     - GET /v1/search?q=stock market news (Chatbot)
   - All news articles display in unified feed
   - Each article shows source badge (RSS, Market, AI)
   - Articles sorted by timestamp (newest first)

### Test 4.2: Source Filtering
1. Tap "Market" filter tab
2. **Expected:**
   - Only market trending news displays
   - Other sources hidden
3. Tap "All" filter
4. **Expected:**
   - All sources display again

### Test 4.3: Pull-to-Refresh
1. Pull down on news page
2. **Expected:**
   - All three sources refresh
   - Loading indicator shows
   - News updates with latest articles

### Test 4.4: Offline Behavior
1. Stop backend and chatbot services
2. Navigate to news page
3. **Expected:**
   - RSS news still loads (external service)
   - Market and AI news show errors (logged to console)
   - Page remains functional with RSS news only

## Test Suite 5: Notifications System

### Test 5.1: Notifications Loading
1. Navigate to Notifications page
2. **Expected:**
   - GET /api/notifications?limit=50 called
   - Real notifications display from database
   - Unread notifications highlighted (blue left border)
   - Unread count shows in header

### Test 5.2: Mark as Read
1. Tap an unread notification
2. **Expected:**
   - PUT /api/notifications/{id}/read called
   - Notification marked as read in UI
   - Blue border removed
   - Unread count decrements
   - Database updated: IsRead = 1, ReadAt = GETUTCDATE()

### Test 5.3: Mark All Read
1. Tap "Mark all read" button
2. **Expected:**
   - PUT /api/notifications/read-all called
   - All notifications marked as read in UI
   - Unread count becomes 0
   - Database updated for all notifications

### Test 5.4: Real-Time Polling
1. Stay on notifications page for 30+ seconds
2. In another device/browser, create a notification for the user
3. **Expected:**
   - After 30 seconds, GET /api/notifications/unread-count called
   - New notification appears in list
   - Unread count updates

### Test 5.5: Notification Types
1. Verify different notification types display correctly:
   - Market alerts (blue icon)
   - Portfolio updates (purple icon)
   - Achievement unlocks (yellow icon)
   - System notifications (gray icon)
   - Game invites (green icon)
2. Each type shows appropriate icon and color

## Test Suite 6: Analytics Performance

### Test 6.1: Analytics Data Loading
1. Ensure user has 200+ XP
2. Navigate to Analytics page
3. **Expected:**
   - GET /api/analytics/performance?timeframe=1M called
   - Real portfolio data displays (not mock)
   - Performance chart shows actual equity curve
   - Metrics display: Total Value, Daily P&L, Sharpe Ratio, Max Drawdown
   - Risk metrics display: Volatility, Beta, Alpha, Win Rate
   - Trading metrics display: Avg Win, Avg Loss, Profit Factor, Total Trades

### Test 6.2: Timeframe Selection
1. Tap different timeframe buttons (1D, 1W, 1M, 3M, 1Y, ALL)
2. **Expected:**
   - GET /api/analytics/performance?timeframe={selected} called
   - Chart updates with new timeframe data
   - Metrics recalculate for selected period
   - Loading indicator shows during fetch

### Test 6.3: Allocation Breakdown
1. Scroll to allocation section
2. **Expected:**
   - Real allocation percentages from backend
   - Bars show correct widths (35% stocks, 25% ETFs, etc.)
   - Colors match asset types
   - Percentages sum to 100%

### Test 6.4: Advanced Metrics Toggle
1. Tap eye icon in header
2. **Expected:**
   - Trading metrics section appears
   - Shows avg win, avg loss, profit factor, total trades
3. Tap eye icon again
4. **Expected:**
   - Trading metrics section hides

## Test Suite 7: End-to-End Integration

### Test 7.1: Complete Learning Journey
1. New user completes onboarding (50 XP)
2. Navigate to learning page
3. Complete 2 lessons (60 XP total = 110 XP)
4. **Expected:**
   - Portfolio Builder unlocks (100 XP threshold)
   - Notification appears: "Feature Unlocked: Portfolio Builder"
5. Complete 3 more lessons (90 XP total = 200 XP)
6. **Expected:**
   - Analytics unlocks (200 XP threshold)
   - Notification appears: "Feature Unlocked: Analytics"
7. Navigate to analytics
8. **Expected:**
   - Full access granted
   - Real data displays

### Test 7.2: Notification Flow
1. Complete a game
2. **Expected:**
   - Backend creates achievement notification
   - Notification appears in notifications page
   - Unread badge shows in tab bar
3. Tap notification
4. **Expected:**
   - Marked as read
   - Badge count decrements
5. Navigate to achievement page (if exists)

### Test 7.3: News to Chat Flow
1. On news page, tap interesting article
2. **Expected:**
   - Article details show (or open in browser)
   - Option to "Ask AI about this" button
3. Tap "Ask AI"
4. **Expected:**
   - Navigate to AI chat
   - Pre-filled question about article
   - Chatbot provides analysis

## Success Criteria

✅ **Learning Page:**
- Topics load from chatbot (15 topics)
- Navigation to AI chat works
- Progress tracking works (if backend supports)
- Pull-to-refresh works

✅ **AI Chat:**
- Learning mode initializes with topic
- Chatbot provides educational responses
- Lesson completion awards XP/coins
- General chat mode works

✅ **Onboarding:**
- Conversational flow works
- XP and coins awarded on completion
- Backend syncs profile data
- Progressive unlock system active

✅ **News:**
- Unified feed from 3 sources
- Source filtering works
- Pull-to-refresh works
- Offline graceful degradation

✅ **Notifications:**
- Real notifications load from backend
- Mark as read works
- Mark all read works
- Real-time polling works (30s)
- Unread count accurate

✅ **Analytics:**
- XP-based unlocking (not tier-based)
- Real data loads from backend
- Timeframe selection works
- Metrics accurate
- Allocation breakdown correct

**Phase 10 Status:** ✅ Ready for Cloud Deployment (Phase 11)

**Estimated Implementation Time:** 6-8 hours
**Estimated Testing Time:** 2-3 hours

