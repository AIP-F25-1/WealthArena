# Phase 8: Frontend Core Pages & Authentication Integration

## Overview

This phase connects the WealthArena mobile frontend (React Native/Expo) to the backend APIs deployed in Phases 4-6, implementing Google OAuth authentication, real-time data fetching for account and dashboard pages, and avatar management with database persistence.

## Prerequisites

- ✅ Phase 4 completed: Backend API running on localhost:3000
- ✅ Phase 5 completed: Chatbot service running on localhost:5001
- ✅ Phase 6 completed: RL inference service running on localhost:5002
- ✅ Phase 7 completed: RL models trained (optional for Phase 8)
- ✅ Expo CLI installed
- ✅ iOS Simulator or Android Emulator or physical device

## Architecture

```
Frontend (Expo/React Native)
├── Authentication
│   ├── Email/Password Login ✅
│   ├── Google OAuth (NEW)
│   └── Token Persistence ✅
├── API Integration
│   ├── apiConfig.ts (environment-driven URLs)
│   ├── apiService.ts (30+ API functions)
│   └── UserContext (state management)
├── Core Pages
│   ├── login.tsx (Google OAuth integration)
│   ├── account.tsx (backend data fetch)
│   ├── dashboard.tsx (portfolio & signals)
│   └── user-profile.tsx (avatar selection)
└── Components
    ├── UserAvatar (display)
    └── AvatarSelector (selection UI)
```

## Step-by-Step Implementation

### Step 1: Create Environment Configuration

**File:** `WealthArena/.env`

**Create .env file:**

```bash
cd WealthArena
touch .env
```

**Add configuration:**

```bash
# Deployment Environment
EXPO_PUBLIC_DEPLOYMENT_ENV=local

# Backend API URLs
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
EXPO_PUBLIC_CHATBOT_URL=http://localhost:5001
EXPO_PUBLIC_RL_SERVICE_URL=http://localhost:5002

# Feature Flags
EXPO_PUBLIC_ENABLE_CHATBOT=true
EXPO_PUBLIC_ENABLE_REAL_TIME_SIGNALS=true
EXPO_PUBLIC_ENABLE_PORTFOLIO_ANALYTICS=true

# Google OAuth (get from Google Cloud Console)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=https://auth.expo.io/@your-username/WealthArena
```

**For Azure deployment, create `.env.azure`:**

```bash
EXPO_PUBLIC_DEPLOYMENT_ENV=azure
EXPO_PUBLIC_BACKEND_URL=https://wealtharena-backend.azurewebsites.net
EXPO_PUBLIC_CHATBOT_URL=https://wealtharena-chatbot.azurewebsites.net
EXPO_PUBLIC_RL_SERVICE_URL=https://wealtharena-rl.azurewebsites.net
```

---

### Step 2: Update API Configuration

**File:** `WealthArena/config/apiConfig.ts`

**Changes:**

1. Add environment variable reading for deployment URLs
2. Add missing endpoints to ENDPOINTS object
3. Add deployment environment detection
4. Support Azure and GCP URL patterns

**Verification:**

```bash
# Start Expo
cd WealthArena
npm start

# Check console for API URLs
# Should show localhost URLs in development
```

---

### Step 3: Implement Google OAuth in Login Page

**File:** `WealthArena/app/login.tsx`

**Changes:**

1. Add expo-auth-session imports
2. Configure Google.useAuthRequest() hook
3. Add useEffect to handle OAuth response
4. Update handleGoogleSignIn() to call promptAsync()
5. Add loading state for Google login

**Google OAuth Setup:**

**A. Create OAuth Credentials:**

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://auth.expo.io/@your-username/WealthArena`
6. Copy Client ID

**B. Configure Expo:**

1. Update `app.json` with Google Client ID (if needed)
2. For Expo Go: Use Expo's auth proxy (automatic)
3. For standalone builds: Configure native OAuth

**Testing:**

1. Tap "Continue with Google"
2. Verify browser opens
3. Select Google account
4. Verify redirect back to app
5. Verify login successful

---

### Step 4: Connect Account Page to Backend

**File:** `WealthArena/app/(tabs)/account.tsx`

**Changes:**

1. Add useEffect to call refreshUser() on mount
2. Add pull-to-refresh functionality
3. Update stats display to use real values (no fallbacks)
4. Add bio display section
5. Add win rate stat card
6. Add error handling UI

**Testing:**

1. Navigate to account page
2. Verify profile data loads
3. Pull down to refresh
4. Verify data updates
5. Test offline mode

---

### Step 5: Connect Dashboard to Backend

**File:** `WealthArena/app/(tabs)/dashboard.tsx`

**Changes:**

1. Fix portfolio data display (use portfolioData.data.total_value)
2. Fix daily P&L calculation
3. Add trading signals display section
4. Update portfolio value display
5. Add win rate stat card
6. Fix API response handling
7. Add pull-to-refresh

**Testing:**

1. Navigate to dashboard
2. Verify portfolio value loads
3. Verify signals display
4. Pull down to refresh
5. Verify all data updates

---

### Step 6: Enhance Avatar Selection

**File:** `WealthArena/components/AvatarSelector.tsx`

**Changes:**

- Option 1: Keep as presentation component (recommended)

- Option 2: Add direct API integration

**File:** `WealthArena/app/user-profile.tsx`

**Changes:**

1. Update handleAvatarSelect() to call updateUserProfile() API
2. Add loading state during save
3. Add success/error alerts
4. Add custom avatar upload function (optional)

**Testing:**

1. Open avatar selector
2. Select mascot
3. Confirm
4. Verify API call
5. Verify avatar updates
6. Verify persistence

---

### Step 7: Add Backend Endpoints (if needed)

**File:** `WealthArena_Backend/src/routes/auth.ts`

**Add Google OAuth endpoint:**

- Route: `POST /api/auth/google`
- Validates Google token
- Creates/finds user
- Returns JWT token

**File:** `WealthArena_Backend/src/routes/user.ts`

**Add avatar upload endpoint (optional):**

- Route: `POST /api/user/upload-avatar`
- Accepts base64 or multipart/form-data
- Stores in Azure Blob or database
- Returns avatar URL

---

### Step 8: End-to-End Testing

**Complete User Flow:**

1. Launch app
2. Tap "Continue with Google"
3. Authenticate with Google
4. Land on dashboard
5. Verify portfolio value shows
6. Verify signals display
7. Navigate to account page
8. Verify profile data shows
9. Tap "Edit Profile"
10. Change avatar
11. Update bio
12. Save changes
13. Navigate back to account
14. Verify changes persisted
15. Close app
16. Reopen app
17. Verify user still logged in
18. Verify all data persists

---

## Troubleshooting

### Issue: Environment variables not loading

**Solution:**

```bash
# Restart Expo with cache clear
expo start -c
```

### Issue: Google OAuth browser doesn't open

**Solution:**

- Verify expo-web-browser installed: `npm list expo-web-browser`
- Check Google Client ID in .env
- Verify redirect URI matches Google Console

### Issue: Backend connection refused

**Solution:**

```bash
# Verify backend running
curl http://localhost:3000/api/health

# Check firewall/network settings
# For Android emulator, use 10.0.2.2 instead of localhost
```

### Issue: Avatar doesn't update

**Solution:**

- Check API call in network tab
- Verify updateUserProfile() called
- Check database - verify avatar_type and avatar_variant saved
- Clear AsyncStorage and re-login

### Issue: Dashboard shows mock data

**Solution:**

- Verify API calls in console logs
- Check response structure matches expected format
- Verify portfolioData.data.total_value path is correct
- Check backend returns success: true

---

## Next Steps

After completing Phase 8:

1. ✅ Verify all core pages connected to backend
2. ✅ Test authentication flow end-to-end
3. ✅ Verify data persistence across app restarts
4. ✅ Test offline behavior
5. ➡️ Proceed to Phase 9: Game, Leaderboard, Signals Pages
6. ➡️ Proceed to Phase 10: Learning, Onboarding, News Pages
7. ➡️ Proceed to Phase 11: Cloud Deployment (Azure/GCP)

## Success Criteria

✅ **API Configuration:**

- Environment variables loaded
- URLs resolve correctly
- All services reachable

✅ **Authentication:**

- Email/password login works
- Google OAuth works (or documented as future enhancement)
- Token persists across restarts
- Logout clears data

✅ **Account Page:**

- Profile data fetches from backend
- Avatar displays correctly
- Bio displays
- All stats show real values
- Pull-to-refresh works

✅ **Dashboard:**

- Portfolio value loads from backend
- Daily P&L displays
- Trading signals display
- Market data displays
- Pull-to-refresh works

✅ **Avatar Management:**

- Mascot selection works
- Avatar saves to database
- Avatar persists
- Avatar displays in all pages

**Phase 8 Status:** ✅ Ready for Advanced Pages Integration

**Estimated Implementation Time:** 4-6 hours

