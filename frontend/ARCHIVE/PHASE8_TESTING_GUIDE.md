# Phase 8: Frontend Core Pages Testing Guide

## Prerequisites

- Backend API running on localhost:3000 (Phase 4)
- Chatbot service running on localhost:5001 (Phase 5)
- RL service running on localhost:5002 (Phase 6)
- Expo development server running
- Test device/emulator connected

## Testing Strategy

### Test Suite 1: API Configuration

### Test Suite 2: Authentication Flow

### Test Suite 3: Account Page Integration

### Test Suite 4: Dashboard Data Loading

### Test Suite 5: Avatar Management

### Test Suite 6: Token Persistence

---

## Test Suite 1: API Configuration

### Test 1.1: Environment Variables

**Verify .env file exists and has correct values**

```bash
cat WealthArena/.env
```

**Expected:**

- EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
- EXPO_PUBLIC_CHATBOT_URL=http://localhost:5001
- EXPO_PUBLIC_RL_SERVICE_URL=http://localhost:5002

### Test 1.2: API Config Loading

**Verify apiConfig.ts loads environment variables correctly**

1. Add console.log in apiConfig.ts to print URLs
2. Start Expo: `npm start`
3. Check console output
4. Verify URLs match .env values

### Test 1.3: Backend Connectivity

**Test each service is reachable**

```bash
# Backend health check
curl http://localhost:3000/api/health

# Chatbot health check
curl http://localhost:5001/healthz

# RL service health check
curl http://localhost:5002/health
```

**All should return 200 OK**

---

## Test Suite 2: Authentication Flow

### Test 2.1: Email/Password Login

**Test existing login functionality**

1. Launch app on device/emulator
2. Navigate to login screen
3. Enter email: `test@example.com`
4. Enter password: `Test123!`
5. Tap "Sign In" button
6. **Expected:**
   - Loading indicator shows
   - Success alert appears
   - Navigates to dashboard
   - User data saved to AsyncStorage
   - Token saved to AsyncStorage

### Test 2.2: Google OAuth Login

**Test new Google OAuth implementation**

1. Tap "Continue with Google" button
2. **Expected:**
   - Browser opens with Google consent screen
   - User selects Google account
   - Grants permissions (email, profile)
   - Browser redirects back to app
3. **Expected in app:**
   - Loading indicator shows
   - Backend validates Google token
   - User created/found in database
   - JWT token returned
   - Success alert appears
   - Navigates to dashboard
   - User data and token saved to AsyncStorage

**Test with existing user:**

1. Login with Google (user already exists)
2. Verify existing user data loaded
3. Verify no duplicate user created

**Test error cases:**

1. Cancel Google consent screen
2. Verify app handles cancellation gracefully
3. Test with network offline
4. Verify error message shown

### Test 2.3: Token Persistence

**Test token survives app restart**

1. Login successfully
2. Close app completely
3. Reopen app
4. **Expected:**
   - User automatically logged in
   - Dashboard shows immediately
   - No login screen shown
   - User data loaded from AsyncStorage

### Test 2.4: Token Expiry

**Test expired token handling**

1. Manually set expired token in AsyncStorage
2. Try to access protected endpoint
3. **Expected:**
   - 401 Unauthorized error
   - User logged out automatically
   - Redirected to login screen
   - Alert: "Session expired. Please login again."

---

## Test Suite 3: Account Page Integration

### Test 3.1: Profile Data Fetch

**Test account page loads fresh data from backend**

1. Login to app
2. Navigate to Account tab
3. **Expected:**
   - Loading indicator shows briefly
   - Profile data fetches from /api/user/profile
   - Avatar displays (mascot or custom)
   - Bio displays (or "No bio yet")
   - Tier displays (beginner/intermediate/advanced/expert)
   - XP displays with real value
   - Coins display with real value
   - Win rate displays with real value
   - Total trades displays with real value
   - Current streak displays with real value

### Test 3.2: Pull-to-Refresh

**Test manual refresh functionality**

1. On account page, pull down to refresh
2. **Expected:**
   - Refresh indicator shows
   - API call to /api/user/profile
   - Data updates in UI
   - Refresh indicator hides

### Test 3.3: Profile Data Sync

**Test data consistency across pages**

1. Update profile in user-profile page (change name, bio)
2. Navigate back to account page
3. **Expected:**
   - Account page shows updated data
   - No manual refresh needed (UserContext updated)

### Test 3.4: Offline Behavior

**Test graceful degradation when backend unavailable**

1. Stop backend server
2. Navigate to account page
3. **Expected:**
   - Shows cached data from UserContext
   - Error banner appears: "Unable to refresh profile"
   - Retry button available
   - App remains functional

---

## Test Suite 4: Dashboard Data Loading

### Test 4.1: Portfolio Data Display

**Test portfolio value loads from backend**

1. Navigate to dashboard
2. **Expected:**
   - Loading indicator shows
   - API call to /api/portfolio
   - Portfolio value displays: "$24,580"
   - Daily P&L displays: "+$842" (green if positive)
   - Percentage change displays: "+3.55%"

### Test 4.2: Trading Signals Display

**Test signals load and display correctly**

1. On dashboard, scroll to signals section
2. **Expected:**
   - API call to /api/signals/top?limit=3
   - 3 signal cards display
   - Each card shows: symbol, signal type, confidence, entry price
   - "View All Signals" button visible
   - Tap button navigates to /trade-signals page

### Test 4.3: Market Data Display

**Test market snapshot loads**

1. On dashboard, view market snapshot card
2. **Expected:**
   - Candlestick chart displays
   - Market status shows (open/closed/pre/post)
   - Last updated timestamp shows

### Test 4.4: Dashboard Refresh

**Test pull-to-refresh on dashboard**

1. Pull down on dashboard
2. **Expected:**
   - Refresh indicator shows
   - Parallel API calls: portfolio, signals, market data
   - All sections update with fresh data
   - Refresh indicator hides

---

## Test Suite 5: Avatar Management

### Test 5.1: Mascot Selection

**Test mascot avatar selection and persistence**

1. Navigate to account page
2. Tap avatar or "Edit Profile" button
3. Navigate to user profile page
4. Tap "Change Avatar" button
5. **Expected:**
   - AvatarSelector modal opens
   - 10 mascot variants displayed
   - Current avatar highlighted
6. Select different mascot (e.g., "Excited")
7. Tap "Confirm Selection"
8. **Expected:**
   - Loading indicator shows
   - API call: PUT /api/user/profile { avatar_type: 'mascot', avatar_variant: 'excited' }
   - Success alert appears
   - Modal closes
   - Avatar updates in UI immediately
   - Database updated with new avatar
9. Navigate to account page
10. **Expected:**
    - New avatar displays
11. Close app and reopen
12. **Expected:**
    - New avatar persists (loaded from AsyncStorage)

### Test 5.2: Custom Avatar Upload

**Test custom image upload (if implemented)**

1. In AvatarSelector, tap "Custom" tab
2. Tap upload button
3. **Expected:**
   - Permission request for camera roll
   - Image picker opens
4. Select image from gallery
5. **Expected:**
   - Image preview shows
   - Crop/resize UI appears
6. Confirm selection
7. **Expected:**
   - Loading indicator shows
   - Image uploads to Azure Storage or converts to base64
   - API call: POST /api/user/upload-avatar
   - Avatar URL returned
   - API call: PUT /api/user/profile { avatar_type: 'custom', avatar_url: url }
   - Success alert appears
   - Avatar displays in UI
8. Verify avatar persists across app restarts

### Test 5.3: Avatar Display Contexts

**Test avatar shows correctly in different pages**

1. Set avatar to "Excited" mascot
2. Navigate to dashboard
3. **Expected:** Avatar shows in header (contextual variant may differ)
4. Navigate to account page
5. **Expected:** Avatar shows in profile card
6. Navigate to user profile page
7. **Expected:** Avatar shows in edit profile card
8. Verify all instances show same avatar

---

## Test Suite 6: Token Persistence

### Test 6.1: Login Persistence

**Test user stays logged in after app restart**

1. Login with email/password or Google
2. Close app completely (force quit)
3. Reopen app
4. **Expected:**
   - Splash screen shows briefly
   - User automatically logged in
   - Dashboard loads immediately
   - No login screen shown

### Test 6.2: Logout Clears Data

**Test logout removes all stored data**

1. Login to app
2. Navigate to account page
3. Tap "Log Out" button
4. **Expected:**
   - Confirmation alert (optional)
   - User data cleared from AsyncStorage
   - Token cleared from AsyncStorage
   - Navigates to splash/login screen
5. Reopen app
6. **Expected:**
   - Login screen shows (not dashboard)
   - No cached user data

### Test 6.3: Multiple Accounts

**Test switching between accounts**

1. Login with account A
2. Logout
3. Login with account B
4. **Expected:**
   - Account A data cleared
   - Account B data loaded
   - Dashboard shows Account B portfolio
   - Account page shows Account B profile

---

## Success Criteria

✅ **API Configuration:**

- Environment variables loaded correctly
- URLs resolve to correct endpoints (localhost or deployed)
- All services reachable

✅ **Authentication:**

- Email/password login works
- Google OAuth login works (if implemented)
- Token saved to AsyncStorage
- User data saved to AsyncStorage
- Navigation to dashboard on success

✅ **Account Page:**

- Profile data fetches from backend on mount
- Avatar displays correctly (mascot or custom)
- Bio displays (or placeholder)
- All stats show real values (XP, coins, win rate, trades, streak)
- Pull-to-refresh works
- Offline mode shows cached data

✅ **Dashboard:**

- Portfolio value loads from backend
- Daily P&L displays correctly
- Trading signals display (3 cards)
- Market data displays
- Pull-to-refresh works
- All quick actions navigate correctly

✅ **Avatar Management:**

- Mascot selection works
- Avatar saves to database
- Avatar persists across app restarts
- Avatar displays in all pages
- Custom upload works (if implemented)

✅ **Token Persistence:**

- User stays logged in after app restart
- Logout clears all data
- Token expiry handled gracefully

**Phase 8 Status:** ✅ Ready for Game, Leaderboard, Signals Integration (Phase 9)

**Estimated Testing Time:** 1-2 hours for comprehensive testing

