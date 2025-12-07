# 🧪 WealthArena Testing Guide

## Current Status

### ✅ Completed
- Backend API structure created
- Frontend API service implemented
- Login/Signup pages integrated with backend
- Database connection configured

### ⚠️ Blocked
- **Backend cannot start** - Database authentication failing
- Error: `Login failed for user 'wealtharenaadmin'`

---

## 🔧 Fix Database Issue First

**See:** `WealthArena_Backend/TROUBLESHOOTING_DATABASE.md`

**Quick Fix:**
1. Go to Azure Portal
2. Find your SQL Server (wealtharenadb)
3. Settings → Authentication
4. Enable "SQL and Azure AD authentication"
5. Set SQL admin: `wealtharenaadmin` / `WealthArena@admin`
6. Save and wait 2-3 minutes

**Test it:**
\`\`\`bash
cd WealthArena_Backend
node test-db.js
\`\`\`

---

## 🚀 Once Database is Fixed

### Step 1: Start Backend

\`\`\`bash
cd WealthArena_Backend
npm run dev
\`\`\`

**Expected output:**
\`\`\`
🚀 ========================================
🚀  WealthArena Backend Server Started
🚀 ========================================
🚀  Port: 3000
🚀  Database: wealtharenadb
🚀 ========================================
\`\`\`

**Test it:**
\`\`\`bash
curl http://localhost:3000/api/health
\`\`\`

Should return:
\`\`\`json
{
  "success": true,
  "message": "WealthArena API is running",
  "timestamp": "2025-10-10T..."
}
\`\`\`

---

### Step 2: Start Frontend

**In a NEW terminal:**

\`\`\`bash
cd WealthArena
npm start
\`\`\`

**Choose an option:**
- Press `w` - Web browser
- Press `a` - Android emulator
- Press `i` - iOS simulator
- Scan QR code with Expo Go app

---

### Step 3: Test Backend Connection

**Option A: Use the Test Page**

1. In the Expo running app
2. Navigate to `/backend-test`
3. Click "Run All Tests"
4. You should see ✅ for health check

**Option B: Test from Browser**

If you chose web (`w`), open:
- http://localhost:19006/backend-test

---

### Step 4: Test Authentication Flow

#### Test Signup

1. **Open the app**
2. **Navigate to Signup page**
3. **Fill in:**
   - Username: `testuser1`
   - First Name: `Test`
   - Last Name: `User`
   - Email: `test@example.com`
   - Password: `Test123!`
   - Confirm Password: `Test123!`
4. **Click "Create Account"**

**Expected:**
- Alert: "Welcome to WealthArena, testuser1!"
- Redirects to onboarding page
- Check backend terminal for logs

#### Test Login

1. **Navigate to Login page**
2. **Enter:**
   - Email: `test@example.com`
   - Password: `Test123!`
3. **Click "Sign In"**

**Expected:**
- Alert: "Welcome back, testuser1!"
- Redirects to dashboard
- User data is loaded

---

## 🧪 API Endpoints to Test

### Health Check
\`\`\`bash
curl http://localhost:3000/api/health
\`\`\`

### Signup
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/signup \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "testuser2",
    "email": "test2@example.com",
    "password": "Pass123!",
    "full_name": "Test User Two"
  }'
\`\`\`

### Login
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test2@example.com",
    "password": "Pass123!"
  }'
\`\`\`

### Get User Profile (requires token)
\`\`\`bash
curl http://localhost:3000/api/user/profile \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
\`\`\`

---

## 📱 Frontend Testing Checklist

### Pages with Backend Integration

- [ ] **Login Page** (`app/login.tsx`)
  - [ ] Login with correct credentials
  - [ ] Login with wrong password
  - [ ] Login with non-existent email
  - [ ] Loading state shows
  - [ ] Error messages display

- [ ] **Signup Page** (`app/signup.tsx`)
  - [ ] Create new account
  - [ ] Duplicate email error
  - [ ] Duplicate username error
  - [ ] Password validation
  - [ ] Loading state shows

- [ ] **Backend Test Page** (`app/backend-test.tsx`)
  - [ ] Health check works
  - [ ] All tests button works
  - [ ] Results display properly

---

## 🐛 Common Issues

### Issue: "Unable to connect to backend"

**Solution:**
- Ensure backend is running (`npm run dev` in WealthArena_Backend)
- Check backend is on port 3000
- Verify no firewall blocking localhost:3000

### Issue: "Network request failed"

**Solution:**
- If using Android emulator, change API URL in `services/apiService.ts`:
  \`\`\`typescript
  const API_BASE_URL = __DEV__
    ? 'http://10.0.2.2:3000/api'  // Android emulator
    : 'https://your-production-url.com/api';
  \`\`\`

- If using physical device, use your computer's IP:
  \`\`\`typescript
  const API_BASE_URL = __DEV__
    ? 'http://192.168.1.XXX:3000/api'  // Your computer IP
    : 'https://your-production-url.com/api';
  \`\`\`

### Issue: "Login failed for user"

**Solution:**
- See `WealthArena_Backend/TROUBLESHOOTING_DATABASE.md`
- Verify Azure SQL authentication is enabled
- Check firewall rules

---

## 📊 Database Testing

### Run SQL Queries

Use Azure Portal Query Editor or Azure Data Studio:

\`\`\`sql
-- Check if tables exist
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES;

-- Check users
SELECT UserID, Username, Email, CreatedAt FROM Users;

-- Check user profiles
SELECT * FROM UserProfiles;

-- View AI signals
SELECT TOP 10 * FROM AISignals ORDER BY CreatedAt DESC;
\`\`\`

---

## 🎯 Next Steps After Testing

Once everything works:

1. **Implement remaining API endpoints:**
   - Signals (get top signals, by symbol)
   - Portfolio (overview, items, trades)
   - User (XP, achievements, quests)
   - Chat (AI chatbot integration)

2. **Connect more frontend pages to backend:**
   - Dashboard → Get user profile, portfolio
   - Opportunities → Get AI signals
   - Account → Get user stats, achievements

3. **Add error handling:**
   - Token expiration
   - Network errors
   - Database errors

4. **Implement proper state management:**
   - User context for logged-in user
   - Token persistence (AsyncStorage)
   - Automatic token refresh

---

## ✅ Success Criteria

You'll know everything is working when:

1. ✅ Backend starts without errors
2. ✅ Database connection successful
3. ✅ Can create a new user via Signup
4. ✅ Can login with created user
5. ✅ User data persists in database
6. ✅ Frontend receives and displays user data
7. ✅ JWT token is properly generated and stored

---

## 📞 Need Help?

1. **Check backend logs** - Look for errors in the terminal running `npm run dev`
2. **Check browser console** - Look for network errors
3. **Use the backend test page** - Navigate to `/backend-test` in the app
4. **Review the troubleshooting guide** - `WealthArena_Backend/TROUBLESHOOTING_DATABASE.md`

---

**Current Date:** October 10, 2025
**Status:** Waiting for database authentication fix

