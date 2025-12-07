# Google OAuth Setup Guide

This guide explains how to configure Google OAuth authentication for WealthArena, enabling users to sign in or sign up using their Google account.

## Overview

Google OAuth is **optional** - the app works fine without it. If Google OAuth is not configured, the Google sign-in button will be hidden on both the login and signup screens.

## Configuration Steps

### Step 1: Create Google OAuth Credentials (Manual - Outside IDE)

You need to create OAuth credentials in Google Cloud Console **first** before you can configure them in the IDE:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click "Select a project" → "New Project" (or select existing)
   - Name it: `WealthArena` (or your preferred name)
   - Click "Create"

3. **Enable Google+ API**
   - In the left sidebar, go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click on it and press "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure OAuth consent screen first:
     - User Type: External (for public use)
     - App name: `WealthArena`
     - User support email: Your email
     - Developer contact: Your email
     - Click "Save and Continue" through the steps
   - Application type: Select the platform(s) you need:
     - **Web application** (for Expo web)
     - **iOS** (if building iOS standalone app)
     - **Android** (if building Android standalone app)

5. **Configure Authorized Redirect URIs**
   For **Expo Go** (development), use:
   ```
   https://auth.expo.io/@your-username/WealthArena
   ```
   Or let Expo generate it automatically (use `useProxy: true` in code).

   For **standalone builds**, you'll need platform-specific URIs:
   - iOS: `com.yourapp.wealtharena:/oauth`
   - Android: `com.yourapp.wealtharena:/oauth`
   - Web: `http://localhost:5001` (or your web URL)

6. **Copy Your Client IDs**
   - After creating, you'll get Client IDs for each platform
   - Copy them - you'll need them in the next step

### Step 2: Configure Environment Variables (In IDE)

After you have the Client IDs from Step 1, configure them in your project:

#### Option A: Create `.env` file (Recommended for local development)

**File:** `frontend/.env`

Create this file in the `frontend` directory:

```bash
# Google OAuth Configuration
# Get these from Google Cloud Console (see Step 1)

# Basic client ID (works for most cases)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Optional: Platform-specific client IDs (for better compatibility)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# Optional: Custom redirect URI (defaults to Expo's proxy if not set)
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=https://auth.expo.io/@your-username/WealthArena
```

**Important Notes:**
- Replace `your-client-id.apps.googleusercontent.com` with your actual Client ID from Google Cloud Console
- The `.env` file is already in `.gitignore` (don't commit it!)
- At minimum, set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` - the others are optional for platform-specific optimization

#### Option B: Set in `app.json` (Alternative for standalone builds)

For production builds, you can also set them in `app.json`:

```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com"
    }
  }
}
```

### Step 3: Install Dependencies (If Not Already Installed)

The `expo-auth-session` package should already be installed (it's in `package.json`). If not, run:

```bash
cd frontend
npm install expo-auth-session
# Or if you have dependency conflicts:
npm install --legacy-peer-deps expo-auth-session
```

### Step 4: Restart Development Server

After adding environment variables, **restart Expo**:

```bash
# Stop the current Expo server (Ctrl+C)
# Then restart:
cd frontend
npm run start-expo
# Or:
npx expo start --port 5001
```

**Why restart?** Environment variables are loaded when Expo starts, so changes won't take effect until you restart.

## Verification

1. **Check if Google button appears:**
   - Open the app
   - Go to Login or Signup screen
   - If `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set, you should see the "Continue with Google" button
   - If it's missing, the button will be hidden (no errors)

2. **Test Google Sign-In:**
   - Tap "Continue with Google"
   - Browser should open with Google sign-in
   - After signing in, you should be redirected back to the app
   - On success, you should be logged in and see a welcome message

## Troubleshooting

### Button Not Showing

**Problem:** Google sign-in button is hidden

**Solution:**
- Check that `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set in `.env`
- Verify the `.env` file is in the `frontend` directory
- Restart Expo development server
- Check console for warnings (should only warn in `__DEV__` mode)

### "Invalid Client" Error

**Problem:** Getting "Invalid client" error when trying to sign in

**Solution:**
- Verify the Client ID is correct (copy-paste from Google Cloud Console)
- Check that the redirect URI in Google Cloud Console matches:
  - For Expo Go: `https://auth.expo.io/@your-username/WealthArena`
  - Or use the auto-generated URI (if using `useProxy: true`)

### Redirect URI Mismatch

**Problem:** "redirect_uri_mismatch" error

**Solution:**
1. In Google Cloud Console, go to your OAuth 2.0 credentials
2. Check "Authorized redirect URIs"
3. Add the exact URI from the error message
4. Save and wait a few minutes for changes to propagate
5. Try again

### Package Not Found Error

**Problem:** "Unable to resolve expo-auth-session/providers/google"

**Solution:**
```bash
cd frontend
npm install expo-auth-session
# Or if you have peer dependency issues:
npm install --legacy-peer-deps expo-auth-session
```

## Current Implementation Details

### How It Works

1. **Conditional Loading:** The app checks if `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set
2. **Graceful Degradation:** If not configured, the Google button is hidden (no errors)
3. **Hook Compliance:** The React hook (`Google.useAuthRequest`) is always called to satisfy React rules, but with a dummy config if not configured
4. **Platform Support:** Supports iOS, Android, and Web with platform-specific client IDs

### Files Modified

- `frontend/app/login.tsx` - Google OAuth login implementation
- `frontend/app/signup.tsx` - Google OAuth signup implementation
- `frontend/services/apiService.ts` - Added `googleLogin` and `googleSignup` functions

## Backend Integration

The frontend calls the backend endpoint `/api/auth/google` with the Google access token. The backend:
- Verifies the token with Google
- Creates a new user if email doesn't exist (signup)
- Logs in existing user if email exists (login)
- Returns user data and JWT token

Make sure your backend has the Google OAuth endpoint implemented!

## Summary

**Can you configure it from the IDE?**
- **Partially** - You can create the `.env` file and set environment variables in the IDE
- **But first** - You must create the OAuth credentials in Google Cloud Console (manual step outside IDE)

**Steps:**
1. ✅ **Manual (outside IDE):** Create Google OAuth credentials in Google Cloud Console
2. ✅ **In IDE:** Create `frontend/.env` file with `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
3. ✅ **In IDE:** Restart Expo development server
4. ✅ **Done!** Google button should appear and work

**The app works fine without Google OAuth** - it's completely optional. Users can still sign up and log in with email/password.

