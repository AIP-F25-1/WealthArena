# WealthArena Backend API Testing Guide

## Prerequisites
- Backend server running on `http://localhost:3000`
- Postman installed (or use curl commands)
- Azure SQL Database with schema and stored procedures deployed

## Testing Strategy

### Phase 1: Health Check & Documentation
### Phase 2: Authentication (Signup & Login)
### Phase 3: Protected Endpoints (User Profile, Signals, Portfolio)
### Phase 4: Game & Leaderboard
### Phase 5: Advanced Features (Chat, Analytics, Learning)

---

## Phase 1: Health Check & Documentation

### 1.1 Health Check
**Endpoint:** `GET /api/health`
**Auth Required:** No

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

### 1.2 API Documentation
**Endpoint:** `GET /`
**Auth Required:** No

**curl:**
```bash
curl http://localhost:3000/
```

**Expected Response:** JSON object with all endpoint listings

---

## Phase 2: Authentication

### 2.1 User Signup
**Endpoint:** `POST /api/auth/signup`
**Auth Required:** No

**Postman:**
- Method: POST
- URL: `http://localhost:3000/api/auth/signup`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "email": "testuser@example.com",
  "password": "SecurePassword123!",
  "username": "testuser",
  "firstName": "Test",
  "lastName": "User",
  "displayName": "Test User"
}
```

**curl:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePassword123!",
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User",
    "displayName": "Test User"
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
      "email": "testuser@example.com",
      "full_name": "Test User",
      "tier_level": "beginner",
      "xp_points": 0,
      "total_balance": 100000
    }
  }
}
```

**Save the token** for subsequent requests!

### 2.2 User Login
**Endpoint:** `POST /api/auth/login`
**Auth Required:** No

**Postman:**
- Method: POST
- URL: `http://localhost:3000/api/auth/login`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "email": "testuser@example.com",
  "password": "SecurePassword123!"
}
```

**curl:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePassword123!"
  }'
```

**Expected Response:** Same as signup (token + user object)

---

## Phase 3: Protected Endpoints

**Important:** All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your-token-here>
```

### 3.1 Get User Profile
**Endpoint:** `GET /api/user/profile`
**Auth Required:** Yes

**Postman:**
- Method: GET
- URL: `http://localhost:3000/api/user/profile`
- Headers:
  - `Authorization: Bearer <your-token>`

**curl:**
```bash
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer <your-token>"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "username": "testuser",
    "email": "testuser@example.com",
    "firstName": "Test",
    "lastName": "User",
    "full_name": "Test User",
    "displayName": "Test User",
    "tier_level": "beginner",
    "xp_points": 0,
    "current_level": 1,
    "total_coins": 0,
    "win_rate": 0,
    "total_trades": 0,
    "current_streak": 0,
    "avatar_url": null,
    "bio": null,
    "total_balance": 100000
  }
}
```

### 3.2 Update User Profile
**Endpoint:** `PUT /api/user/profile`
**Auth Required:** Yes

**Postman:**
- Method: PUT
- URL: `http://localhost:3000/api/user/profile`
- Headers:
  - `Authorization: Bearer <your-token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "displayName": "Updated Name",
  "bio": "I love trading!",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**curl:**
```bash
curl -X PUT http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Updated Name",
    "bio": "I love trading!",
    "avatarUrl": "https://example.com/avatar.png"
  }'
```

### 3.3 Award XP to User
**Endpoint:** `POST /api/user/xp`
**Auth Required:** Yes

**Postman:**
- Method: POST
- URL: `http://localhost:3000/api/user/xp`
- Headers:
  - `Authorization: Bearer <your-token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "xpAmount": 50
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "TotalXP": 50,
    "CurrentLevel": 1,
    "LevelUp": 0
  }
}
```

### 3.4 Get Top Trading Signals
**Endpoint:** `GET /api/signals/top`
**Auth Required:** Yes

**Postman:**
- Method: GET
- URL: `http://localhost:3000/api/signals/top?limit=5&asset_class=stocks`
- Headers:
  - `Authorization: Bearer <your-token>`

**curl:**
```bash
curl "http://localhost:3000/api/signals/top?limit=5&asset_class=stocks" \
  -H "Authorization: Bearer <your-token>"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "symbol": "AAPL",
      "signal_type": "BUY",
      "confidence_score": 0.85,
      "entry_price": 154.00,
      "take_profit_1": 160.00,
      "take_profit_2": 165.00,
      "take_profit_3": 170.00,
      "stop_loss": 150.00,
      "risk_reward_ratio": 1.5,
      "expected_return": 3.9,
      "model_reasoning": "Strong uptrend with RSI confirmation"
    }
  ]
}
```

### 3.5 Get Portfolio Overview
**Endpoint:** `GET /api/portfolio`
**Auth Required:** Yes

**curl:**
```bash
curl http://localhost:3000/api/portfolio \
  -H "Authorization: Bearer <your-token>"
```

---

## Phase 4: Game & Leaderboard

### 4.1 Create Game Session
**Endpoint:** `POST /api/game/create-session`
**Auth Required:** Yes

**Postman:**
- Method: POST
- URL: `http://localhost:3000/api/game/create-session`
- Headers:
  - `Authorization: Bearer <your-token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "gameType": "historical"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "game_1_1705315200000",
    "gameType": "historical",
    "initialBalance": 10000,
    "message": "Game session created successfully"
  }
}
```

### 4.2 Complete Game Session
**Endpoint:** `POST /api/game/complete-session`
**Auth Required:** Yes

**Postman:**
- Method: POST
- URL: `http://localhost:3000/api/game/complete-session`
- Headers:
  - `Authorization: Bearer <your-token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "sessionId": "game_1_1705315200000",
  "results": {
    "finalBalance": 12500
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "message": "Game session completed successfully",
    "rewards": {
      "xp": 35,
      "coins": 125
    },
    "performance": {
      "finalBalance": 12500,
      "profitLoss": 2500,
      "profitPercentage": 25
    }
  }
}
```

### 4.3 Join Competition
**Endpoint:** `POST /api/leaderboard/competition/:competitionId/join`
**Auth Required:** Yes

**Postman:**
- Method: POST
- URL: `http://localhost:3000/api/leaderboard/competition/1/join`
- Headers:
  - `Authorization: Bearer <your-token>`
  - `Content-Type: application/json`

**curl:**
```bash
curl -X POST http://localhost:3000/api/leaderboard/competition/1/join \
  -H "Authorization: Bearer <your-token>"
```

**Expected Response (Success - ResultCode 0):**
```json
{
  "success": true,
  "data": {
    "message": "Successfully joined competition",
    "competitionId": 1,
    "maxParticipants": 100,
    "currentParticipants": 1
  }
}
```

**Expected Response (Error - ResultCode -1):**
```json
{
  "success": false,
  "message": "Competition not found or not active"
}
```

**Expected Response (Error - ResultCode -2):**
```json
{
  "success": false,
  "message": "Competition is full"
}
```

**Expected Response (Error - ResultCode -3):**
```json
{
  "success": false,
  "message": "User is already participating in this competition"
}
```

**Expected Response (Error - ResultCode -4):**
```json
{
  "success": false,
  "message": "Insufficient coins for entry fee"
}
```

**Test Cases:**
1. Join active competition → Should return ResultCode 0
2. Join non-existent competition → Should return ResultCode -1 (404)
3. Join full competition → Should return ResultCode -2 (409)
4. Join already joined competition → Should return ResultCode -3 (409)
5. Join with insufficient coins → Should return ResultCode -4 (402)

### 4.4 Get Global Leaderboard
**Endpoint:** `GET /api/leaderboard/global`
**Auth Required:** Yes

**curl:**
```bash
curl "http://localhost:3000/api/leaderboard/global?limit=10&category=total_returns" \
  -H "Authorization: Bearer <your-token>"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "Rank": 1,
        "UserID": 1,
        "Username": "testuser",
        "DisplayName": "Test User",
        "TotalReturns": 25.5,
        "WinRate": 65.0,
        "TotalTrades": 20,
        "Tier": "beginner"
      }
    ],
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 1
    }
  }
}
```

---

## Phase 5: Advanced Features

### 5.1 Create Chat Session
**Endpoint:** `POST /api/chat/session`
**Auth Required:** Yes

**Postman:**
- Method: POST
- URL: `http://localhost:3000/api/chat/session`
- Headers:
  - `Authorization: Bearer <your-token>`
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "sessionType": "general",
  "contextData": {}
}
```

### 5.2 Get User Achievements
**Endpoint:** `GET /api/user/achievements`
**Auth Required:** Yes

**curl:**
```bash
curl http://localhost:3000/api/user/achievements \
  -H "Authorization: Bearer <your-token>"
```

### 5.3 Get Active Quests
**Endpoint:** `GET /api/user/quests`
**Auth Required:** Yes

**curl:**
```bash
curl http://localhost:3000/api/user/quests \
  -H "Authorization: Bearer <your-token>"
```

---

## Common Testing Scenarios

### Scenario 1: New User Onboarding Flow
1. Signup → Get token
2. Get profile → Verify default values
3. Complete onboarding → Award welcome XP/coins
4. Get profile → Verify updated values

### Scenario 2: Game Play Flow
1. Create game session → Get session ID
2. Save game state (optional)
3. Complete game session → Award XP/coins
4. Check leaderboard → Verify ranking updated

### Scenario 3: Trading Signal Flow
1. Get top signals → Select signal
2. Create portfolio from signal
3. View portfolio → Check positions
4. Get portfolio performance

---

## Error Testing

### Test Invalid Token
```bash
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer invalid-token"
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### Test Missing Token
```bash
curl http://localhost:3000/api/user/profile
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Access token required"
}
```

### Test Invalid Credentials
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "WrongPassword"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

## Postman Collection Setup

### Environment Variables
Create a Postman environment with:
- `base_url`: `http://localhost:3000`
- `token`: `<your-jwt-token>` (set after login)

### Pre-request Script for Auth
Add to collection-level pre-request script:
```javascript
if (pm.environment.get('token')) {
  pm.request.headers.add({
    key: 'Authorization',
    value: 'Bearer ' + pm.environment.get('token')
  });
}
```

### Test Script for Login
Add to login request test script:
```javascript
if (pm.response.code === 200) {
  const response = pm.response.json();
  pm.environment.set('token', response.data.token);
  console.log('Token saved:', response.data.token);
}
```

---

## Troubleshooting

### Issue: Connection refused
**Solution:** Ensure backend server is running (`npm run dev`)

### Issue: Database connection error
**Solution:** Verify `.env` credentials and Azure firewall rules

### Issue: 401 Unauthorized
**Solution:** Check token is valid and not expired (7-day expiry)

### Issue: 500 Internal Server Error
**Solution:** Check backend logs for detailed error message

### Issue: CORS error (browser only)
**Solution:** Verify `ALLOWED_ORIGINS` in `.env` includes your origin

---

## Success Criteria

✅ **Phase 1:** Health check returns 200 OK
✅ **Phase 2:** Signup and login return valid JWT tokens
✅ **Phase 3:** All protected endpoints return data with valid token
✅ **Phase 4:** Game session creation and completion work correctly
✅ **Phase 5:** Advanced features (chat, achievements, quests) return data

**All endpoints tested successfully = Backend ready for frontend integration!**

