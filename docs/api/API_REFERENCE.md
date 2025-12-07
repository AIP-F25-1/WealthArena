Authorization: Bearer <jwt_token>
```

### Response Format
All responses follow this standard format:
```json
{
  "success": boolean,
  "data": any,
  "message": string
}
```

### Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 1. Authentication Endpoints (`auth.ts`)

### POST /api/auth/signup
Create a new user account.

**Authentication:** None required

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "name": "string",
  "avatar": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "email": "string",
      "name": "string",
      "avatar": "string",
      "xp": 0,
      "coins": 0,
      "createdAt": "string"
    },
    "token": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"John Doe"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": null,
      "xp": 0,
      "coins": 0,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Codes:**
- `400` - Invalid email format or password too short
- `409` - Email already exists

### POST /api/auth/login
Authenticate user with email and password.

**Authentication:** None required

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "email": "string",
      "name": "string",
      "avatar": "string",
      "xp": "number",
      "coins": "number"
    },
    "token": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "avatar1.png",
      "xp": 150,
      "coins": 500
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Codes:**
- `401` - Invalid credentials
- `400` - Missing email or password

### POST /api/auth/google
Authenticate user with Google OAuth token.

**Authentication:** None required

**Request Body:**
```json
{
  "googleToken": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "email": "string",
      "name": "string",
      "avatar": "string",
      "xp": "number",
      "coins": "number"
    },
    "token": "string",
    "isNewUser": "boolean"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"googleToken":"ya29.a0AfH6SMC..."}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "email": "john@gmail.com",
      "name": "John Smith",
      "avatar": "https://lh3.googleusercontent.com/...",
      "xp": 0,
      "coins": 0
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": true
  }
}
```

**Error Codes:**
- `401` - Invalid Google token
- `400` - Missing Google token

---

## 2. User Management Endpoints (`user.ts`)

### GET /api/user/profile
Get current user profile information.

**Authentication:** Required

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "email": "string",
    "name": "string",
    "avatar": "string",
    "xp": "number",
    "coins": "number",
    "level": "number",
    "achievements": ["string"],
    "createdAt": "string",
    "lastLogin": "string"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "avatar1.png",
    "xp": 150,
    "coins": 500,
    "level": 2,
    "achievements": ["First Login", "First Trade"],
    "createdAt": "2024-01-15T10:00:00Z",
    "lastLogin": "2024-01-15T14:30:00Z"
  }
}
```

**Error Codes:**
- `401` - Invalid or expired token
- `404` - User not found

### PUT /api/user/profile
Update user profile information.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string (optional)",
  "avatar": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "email": "string",
    "name": "string",
    "avatar": "string"
  }
}
```

**Example Request:**
```bash
curl -X PUT https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Smith",
    "avatar": "avatar1.png"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `400` - Invalid data

### POST /api/user/xp
Award XP to user (admin/internal use).

**Authentication:** Required

**Request Body:**
```json
{
  "amount": "number",
  "reason": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "newXp": "number",
    "newLevel": "number"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/xp \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"amount":50,"reason":"Completed lesson"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "newXp": 200,
    "newLevel": 3
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `400` - Invalid amount

### POST /api/user/coins
Award coins to user (admin/internal use).

**Authentication:** Required

**Request Body:**
```json
{
  "amount": "number",
  "reason": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "newCoins": "number"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/coins \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"reason":"Daily bonus"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "newCoins": 600
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `400` - Invalid amount

### GET /api/user/achievements
Get user achievements.

**Authentication:** Required

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "name": "string",
      "description": "string",
      "icon": "string",
      "unlockedAt": "string",
      "xpReward": "number"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/achievements \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "First Login",
      "description": "Logged in for the first time",
      "icon": "login.png",
      "unlockedAt": "2024-01-15T10:00:00Z",
      "xpReward": 10
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/user/quests
Get active user quests.

**Authentication:** Required

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "title": "string",
      "description": "string",
      "progress": "number",
      "target": "number",
      "reward": {
        "xp": "number",
        "coins": "number"
      },
      "deadline": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/quests \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Complete 5 Trades",
      "description": "Make 5 successful trades in the game",
      "progress": 2,
      "target": 5,
      "reward": {
        "xp": 50,
        "coins": 100
      },
      "deadline": "2024-02-15T00:00:00Z"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### POST /api/user/complete-onboarding
Mark user onboarding as complete.

**Authentication:** Required

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "onboardingComplete": true
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/complete-onboarding \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "onboardingComplete": true
  }
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/user/learning-progress
Get user learning progress.

**Authentication:** Required

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "completedLessons": ["number"],
    "currentStreak": "number",
    "totalXpEarned": "number",
    "topics": [
      {
        "id": "number",
        "name": "string",
        "progress": "number",
        "totalLessons": "number"
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/learning-progress \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "completedLessons": [1, 2, 3],
    "currentStreak": 3,
    "totalXpEarned": 150,
    "topics": [
      {
        "id": 1,
        "name": "Basic Investing",
        "progress": 3,
        "totalLessons": 5
      }
    ]
  }
}
```

**Error Codes:**
- `401` - Invalid token

### POST /api/user/complete-lesson
Mark a lesson as completed.

**Authentication:** Required

**Request Body:**
```json
{
  "lessonId": "number"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "xpEarned": "number",
    "newTotalXp": "number"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/complete-lesson \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"lessonId":4}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "xpEarned": 25,
    "newTotalXp": 175
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `400` - Invalid lesson ID

### POST /api/user/upload-avatar
Upload custom avatar image.

**Authentication:** Required

**Request Body:** Form data with file

**Response:**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/user/upload-avatar \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "avatar=@avatar.jpg"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "avatars/user_1_1234567890.jpg"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `400` - Invalid file format

---

## 3. Trading Signals Endpoints (`signals.ts`)

### GET /api/signals/top
Get top trading signals.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): number, default 10
- `assetClass` (optional): string (stocks, crypto, forex, commodities)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "symbol": "string",
      "signal": "string (BUY/SELL/HOLD)",
      "confidence": "number",
      "price": "number",
      "targetPrice": "number",
      "stopLoss": "number",
      "timestamp": "string",
      "agent": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/signals/top?limit=5" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "symbol": "AAPL",
      "signal": "BUY",
      "confidence": 0.85,
      "price": 150.25,
      "targetPrice": 165.00,
      "stopLoss": 140.00,
      "timestamp": "2024-01-15T14:30:00Z",
      "agent": "Momentum Agent"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/signals/:signalId
Get signal by ID.

**Authentication:** Required

**Path Parameters:**
- `signalId`: number

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "symbol": "string",
    "signal": "string",
    "confidence": "number",
    "price": "number",
    "targetPrice": "number",
    "stopLoss": "number",
    "timestamp": "string",
    "agent": "string",
    "analysis": "string"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/signals/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "symbol": "AAPL",
    "signal": "BUY",
    "confidence": 0.85,
    "price": 150.25,
    "targetPrice": 165.00,
    "stopLoss": 140.00,
    "timestamp": "2024-01-15T14:30:00Z",
    "agent": "Momentum Agent",
    "analysis": "Strong upward momentum detected..."
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Signal not found

### GET /api/signals/symbol/:symbol
Get signals for specific symbol.

**Authentication:** Required

**Path Parameters:**
- `symbol`: string

**Query Parameters:**
- `limit` (optional): number, default 20

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "signal": "string",
      "confidence": "number",
      "price": "number",
      "targetPrice": "number",
      "stopLoss": "number",
      "timestamp": "string",
      "agent": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/signals/symbol/AAPL \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "signal": "BUY",
      "confidence": 0.85,
      "price": 150.25,
      "targetPrice": 165.00,
      "stopLoss": 140.00,
      "timestamp": "2024-01-15T14:30:00Z",
      "agent": "Momentum Agent"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Symbol not found

### GET /api/signals/historical
Get historical signals with outcomes.

**Authentication:** Required

**Query Parameters:**
- `days` (optional): number, default 30
- `symbol` (optional): string

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "symbol": "string",
      "signal": "string",
      "confidence": "number",
      "entryPrice": "number",
      "exitPrice": "number",
      "outcome": "string (WIN/LOSS)",
      "pnl": "number",
      "timestamp": "string",
      "agent": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/signals/historical?days=7" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "symbol": "AAPL",
      "signal": "BUY",
      "confidence": 0.85,
      "entryPrice": 150.25,
      "exitPrice": 165.50,
      "outcome": "WIN",
      "pnl": 15.25,
      "timestamp": "2024-01-08T14:30:00Z",
      "agent": "Momentum Agent"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

---

## 4. Portfolio Endpoints (`portfolio.ts`)

### GET /api/portfolio
Get portfolio overview.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "totalValue": "number",
    "totalGainLoss": "number",
    "totalGainLossPercent": "number",
    "portfolios": [
      {
        "id": "number",
        "name": "string",
        "value": "number",
        "gainLoss": "number",
        "gainLossPercent": "number",
        "positions": "number"
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalValue": 12500.75,
    "totalGainLoss": 1250.75,
    "totalGainLossPercent": 11.12,
    "portfolios": [
      {
        "id": 1,
        "name": "Tech Stocks",
        "value": 7500.50,
        "gainLoss": 750.50,
        "gainLossPercent": 11.12,
        "positions": 5
      }
    ]
  }
}
```

**Error Codes:**
- `401` - Invalid token

### POST /api/portfolio
Create new portfolio.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string",
  "description": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "name": "string",
    "description": "string",
    "createdAt": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Growth Portfolio","description":"High growth stocks"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Growth Portfolio",
    "description": "High growth stocks",
    "createdAt": "2024-01-15T15:00:00Z"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `400` - Invalid name

### PUT /api/portfolio/:portfolioId
Update portfolio.

**Authentication:** Required

**Path Parameters:**
- `portfolioId`: number

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "name": "string",
    "description": "string",
    "updatedAt": "string"
  }
}
```

**Example Request:**
```bash
curl -X PUT https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Tech Portfolio"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Tech Portfolio",
    "description": "Technology stocks",
    "updatedAt": "2024-01-15T15:30:00Z"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Portfolio not found
- `403` - Not portfolio owner

### DELETE /api/portfolio/:portfolioId
Delete portfolio.

**Authentication:** Required

**Path Parameters:**
- `portfolioId`: number

**Response:**
```json
{
  "success": true,
  "message": "Portfolio deleted successfully"
}
```

**Example Request:**
```bash
curl -X DELETE https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio/2 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "message": "Portfolio deleted successfully"
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Portfolio not found
- `403` - Not portfolio owner

### GET /api/portfolio/items
Get portfolio items (positions).

**Authentication:** Required

**Query Parameters:**
- `portfolioId` (optional): number

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "portfolioId": "number",
      "symbol": "string",
      "quantity": "number",
      "avgPrice": "number",
      "currentPrice": "number",
      "value": "number",
      "gainLoss": "number",
      "gainLossPercent": "number"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio/items?portfolioId=1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "portfolioId": 1,
      "symbol": "AAPL",
      "quantity": 10,
      "avgPrice": 145.50,
      "currentPrice": 150.25,
      "value": 1502.50,
      "gainLoss": 47.50,
      "gainLossPercent": 3.26
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Portfolio not found

### GET /api/portfolio/trades
Get trade history.

**Authentication:** Required

**Query Parameters:**
- `portfolioId` (optional): number
- `limit` (optional): number, default 50

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "portfolioId": "number",
      "symbol": "string",
      "type": "string (BUY/SELL)",
      "quantity": "number",
      "price": "number",
      "total": "number",
      "timestamp": "string",
      "notes": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio/trades?portfolioId=1&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "portfolioId": 1,
      "symbol": "AAPL",
      "type": "BUY",
      "quantity": 10,
      "price": 145.50,
      "total": 1455.00,
      "timestamp": "2024-01-10T10:00:00Z",
      "notes": "Initial position"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/portfolio/positions
Get current positions.

**Authentication:** Required

**Query Parameters:**
- `portfolioId` (optional): number

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "string",
      "quantity": "number",
      "avgPrice": "number",
      "currentPrice": "number",
      "value": "number",
      "gainLoss": "number",
      "gainLossPercent": "number",
      "portfolioId": "number"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio/positions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "quantity": 10,
      "avgPrice": 145.50,
      "currentPrice": 150.25,
      "value": 1502.50,
      "gainLoss": 47.50,
      "gainLossPercent": 3.26,
      "portfolioId": 1
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### POST /api/portfolio/from-signal
Create portfolio from signal.

**Authentication:** Required

**Request Body:**
```json
{
  "signalId": "number",
  "quantity": "number",
  "portfolioName": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolioId": "number",
    "tradeId": "number",
    "message": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio/from-signal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"signalId":1,"quantity":5,"portfolioName":"Signal Portfolio"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "portfolioId": 3,
    "tradeId": 2,
    "message": "Portfolio created and position opened"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Signal not found
- `400` - Insufficient funds

### GET /api/portfolio/:portfolioId/performance
Get performance metrics.

**Authentication:** Required

**Path Parameters:**
- `portfolioId`: number

**Query Parameters:**
- `period` (optional): string (1d, 1w, 1m, 3m, 1y), default 1m

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolioId": "number",
    "period": "string",
    "startValue": "number",
    "endValue": "number",
    "gainLoss": "number",
    "gainLossPercent": "number",
    "volatility": "number",
    "sharpeRatio": "number",
    "maxDrawdown": "number",
    "winRate": "number"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/portfolio/1/performance \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "portfolioId": 1,
    "period": "1m",
    "startValue": 10000.00,
    "endValue": 11250.75,
    "gainLoss": 1250.75,
    "gainLossPercent": 12.51,
    "volatility": 0.15,
    "sharpeRatio": 1.2,
    "maxDrawdown": -5.2,
    "winRate": 0.65
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Portfolio not found
- `403` - Not portfolio owner

---

## 5. Game Endpoints (`game.ts`)

### POST /api/game/create-session
Create game session.

**Authentication:** Required

**Request Body:**
```json
{
  "gameMode": "string (fast-forward, real-time)",
  "startDate": "string (ISO date)",
  "endDate": "string (ISO date)",
  "initialCapital": "number (optional, default 10000)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "gameMode": "string",
    "startDate": "string",
    "endDate": "string",
    "initialCapital": "number",
    "currentCapital": "number",
    "status": "string (active)"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/game/create-session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"gameMode":"fast-forward","startDate":"2020-01-01","endDate":"2024-01-01","initialCapital":10000}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123456",
    "gameMode": "fast-forward",
    "startDate": "2020-01-01T00:00:00Z",
    "endDate": "2024-01-01T00:00:00Z",
    "initialCapital": 10000,
    "currentCapital": 10000,
    "status": "active"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `400` - Invalid dates or parameters

### POST /api/game/save-session
Save game state.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "string",
  "currentDate": "string",
  "portfolio": "object",
  "cash": "number"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "savedAt": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/game/save-session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_123456","currentDate":"2022-01-01","portfolio":{},"cash":9500}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123456",
    "savedAt": "2024-01-15T16:00:00Z"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Session not found

### GET /api/game/resume-session/:sessionId
Resume session.

**Authentication:** Required

**Path Parameters:**
- `sessionId`: string

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "gameMode": "string",
    "currentDate": "string",
    "startDate": "string",
    "endDate": "string",
    "initialCapital": "number",
    "currentCapital": "number",
    "portfolio": "object",
    "status": "string"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/game/resume-session/sess_123456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123456",
    "gameMode": "fast-forward",
    "currentDate": "2022-01-01T00:00:00Z",
    "startDate": "2020-01-01T00:00:00Z",
    "endDate": "2024-01-01T00:00:00Z",
    "initialCapital": 10000,
    "currentCapital": 9500,
    "portfolio": {},
    "status": "active"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Session not found

### POST /api/game/complete-session
Complete session.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "string",
  "finalPortfolio": "object",
  "finalCash": "number"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "finalValue": "number",
    "gainLoss": "number",
    "gainLossPercent": "number",
    "completedAt": "string",
    "rank": "number"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/game/complete-session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_123456","finalPortfolio":{},"finalCash":12500}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123456",
    "finalValue": 12500,
    "gainLoss": 2500,
    "gainLossPercent": 25.0,
    "completedAt": "2024-01-15T17:00:00Z",
    "rank": 15
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Session not found

### DELETE /api/game/discard-session
Discard session.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session discarded successfully"
}
```

**Example Request:**
```bash
curl -X DELETE https://wealtharena-backend-jg1ve2.azurewebsites.net/api/game/discard-session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_123456"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Session discarded successfully"
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Session not found

### GET /api/game/sessions
Get active sessions.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "string",
      "gameMode": "string",
      "currentDate": "string",
      "startDate": "string",
      "endDate": "string",
      "initialCapital": "number",
      "currentCapital": "number",
      "status": "string",
      "createdAt": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/game/sessions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "sess_123456",
      "gameMode": "fast-forward",
      "currentDate": "2022-01-01T00:00:00Z",
      "startDate": "2020-01-01T00:00:00Z",
      "endDate": "2024-01-01T00:00:00Z",
      "initialCapital": 10000,
      "currentCapital": 9500,
      "status": "active",
      "createdAt": "2024-01-15T14:00:00Z"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/game/history
Get game history.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): number, default 20

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "string",
      "gameMode": "string",
      "startDate": "string",
      "endDate": "string",
      "initialCapital": "number",
      "finalValue": "number",
      "gainLoss": "number",
      "gainLossPercent": "number",
      "rank": "number",
      "completedAt": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/game/history \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "sess_123456",
      "gameMode": "fast-forward",
      "startDate": "2020-01-01T00:00:00Z",
      "endDate": "2024-01-01T00:00:00Z",
      "initialCapital": 10000,
      "finalValue": 12500,
      "gainLoss": 2500,
      "gainLossPercent": 25.0,
      "rank": 15,
      "completedAt": "2024-01-15T17:00:00Z"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

---

## 6. Leaderboard Endpoints (`leaderboard.ts`)

### GET /api/leaderboard/global
Get global leaderboard.

**Authentication:** Required

**Query Parameters:**
- `period` (optional): string (daily, weekly, monthly, all-time), default all-time
- `limit` (optional): number, default 50

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": "number",
      "userId": "number",
      "username": "string",
      "avatar": "string",
      "score": "number",
      "gainLossPercent": "number",
      "period": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/leaderboard/global?period=weekly&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userId": 1,
      "username": "trader_pro",
      "avatar": "avatar1.png",
      "score": 2500,
      "gainLossPercent": 25.0,
      "period": "weekly"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/leaderboard/friends
Get friends leaderboard.

**Authentication:** Required

**Query Parameters:**
- `period` (optional): string, default all-time

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": "number",
      "userId": "number",
      "username": "string",
      "avatar": "string",
      "score": "number",
      "gainLossPercent": "number",
      "isFriend": true
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/leaderboard/friends \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userId": 2,
      "username": "friend_trader",
      "avatar": "avatar2.png",
      "score": 1800,
      "gainLossPercent": 18.0,
      "isFriend": true
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/leaderboard/user/:userId
Get user rank.

**Authentication:** Required

**Path Parameters:**
- `userId`: number

**Query Parameters:**
- `period` (optional): string, default all-time

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "number",
    "username": "string",
    "rank": "number",
    "score": "number",
    "gainLossPercent": "number",
    "totalPlayers": "number",
    "percentile": "number"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/leaderboard/user/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "username": "trader_pro",
    "rank": 15,
    "score": 2500,
    "gainLossPercent": 25.0,
    "totalPlayers": 1000,
    "percentile": 98.5
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - User not found

### GET /api/leaderboard/competitions
Get active competitions.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "name": "string",
      "description": "string",
      "startDate": "string",
      "endDate": "string",
      "prizePool": "number",
      "participants": "number",
      "status": "string (upcoming, active, completed)"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/leaderboard/competitions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Monthly Trading Challenge",
      "description": "Best performer this month wins $1000",
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-01-31T23:59:59Z",
      "prizePool": 1000,
      "participants": 150,
      "status": "active"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/leaderboard/competition/:id
Get competition leaderboard.

**Authentication:** Required

**Path Parameters:**
- `id`: number

**Response:**
```json
{
  "success": true,
  "data": {
    "competition": {
      "id": "number",
      "name": "string",
      "description": "string",
      "startDate": "string",
      "endDate": "string",
      "status": "string"
    },
    "leaderboard": [
      {
        "rank": "number",
        "userId": "number",
        "username": "string",
        "score": "number",
        "gainLossPercent": "number"
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/leaderboard/competition/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "competition": {
      "id": 1,
      "name": "Monthly Trading Challenge",
      "description": "Best performer this month wins $1000",
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-01-31T23:59:59Z",
      "status": "active"
    },
    "leaderboard": [
      {
        "rank": 1,
        "userId": 1,
        "username": "trader_pro",
        "score": 2500,
        "gainLossPercent": 25.0
      }
    ]
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Competition not found

### POST /api/leaderboard/competition/:id/join
Join competition.

**Authentication:** Required

**Path Parameters:**
- `id`: number

**Response:**
```json
{
  "success": true,
  "data": {
    "competitionId": "number",
    "joinedAt": "string",
    "message": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/leaderboard/competition/1/join \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "competitionId": 1,
    "joinedAt": "2024-01-15T18:00:00Z",
    "message": "Successfully joined competition"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Competition not found
- `409` - Already joined

### GET /api/leaderboard/stats
Get leaderboard statistics.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPlayers": "number",
    "activeCompetitions": "number",
    "totalPrizePool": "number",
    "userRank": "number",
    "userPercentile": "number"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/leaderboard/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalPlayers": 15420,
    "activeCompetitions": 3,
    "totalPrizePool": 5000,
    "userRank": 125,
    "userPercentile": 99.2
  }
}
```

**Error Codes:**
- `401` - Invalid token

---

## 7. Chat Endpoints (`chat.ts`)

### POST /api/chat/session
Create chat session.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "title": "string",
    "createdAt": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/chat/session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"title":"Investment Questions"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "chat_123456",
    "title": "Investment Questions",
    "createdAt": "2024-01-15T18:30:00Z"
  }
}
```

**Error Codes:**
- `401` - Invalid token

### POST /api/chat/message
Send message.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "string",
  "message": "string",
  "messageType": "string (user, system)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "string",
    "response": "string",
    "timestamp": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/chat/message \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"chat_123456","message":"What is diversification?","messageType":"user"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "msg_789",
    "response": "Diversification is an investment strategy...",
    "timestamp": "2024-01-15T18:31:00Z"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Session not found

### GET /api/chat/history
Get chat history.

**Authentication:** Required

**Query Parameters:**
- `sessionId`: string (required)
- `limit` (optional): number, default 50

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "sessionId": "string",
      "message": "string",
      "response": "string",
      "timestamp": "string",
      "messageType": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/chat/history?sessionId=chat_123456" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_789",
      "sessionId": "chat_123456",
      "message": "What is diversification?",
      "response": "Diversification is an investment strategy...",
      "timestamp": "2024-01-15T18:31:00Z",
      "messageType": "user"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Session not found

### POST /api/chat/feedback
Submit feedback.

**Authentication:** Required

**Request Body:**
```json
{
  "messageId": "string",
  "rating": "number (1-5)",
  "feedback": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully"
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/chat/feedback \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"messageId":"msg_789","rating":5,"feedback":"Very helpful response"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully"
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Message not found

### GET /api/chat/sessions
Get user sessions.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): number, default 20

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "string",
      "title": "string",
      "createdAt": "string",
      "lastMessageAt": "string",
      "messageCount": "number"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/chat/sessions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "chat_123456",
      "title": "Investment Questions",
      "createdAt": "2024-01-15T18:30:00Z",
      "lastMessageAt": "2024-01-15T18:45:00Z",
      "messageCount": 5
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

---

## 8. Chatbot Proxy Endpoints (`chatbot.ts`)

### GET /api/chatbot/health
Chatbot health check.

**Authentication:** None required

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "string (healthy)",
    "version": "string",
    "uptime": "number"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/chatbot/health
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 3600
  }
}
```

**Error Codes:**
- `503` - Service unavailable

### POST /api/chatbot/chat
Chat with AI.

**Authentication:** Required

**Request Body:**
```json
{
  "message": "string",
  "context": "object (optional)",
  "sessionId": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "string",
    "confidence": "number",
    "sources": ["string"],
    "sessionId": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/chatbot/chat \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain technical analysis","context":{}}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "response": "Technical analysis is a trading discipline...",
    "confidence": 0.92,
    "sources": ["technical_analysis.pdf", "trading_guide.md"],
    "sessionId": "chat_123456"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `503` - Chatbot service unavailable

### GET /api/chatbot/knowledge/topics
Get knowledge topics.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "articleCount": "number"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/chatbot/knowledge/topics \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tech_analysis",
      "name": "Technical Analysis",
      "description": "Chart patterns, indicators, and analysis techniques",
      "articleCount": 25
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

---

## 9. RL Agent Proxy Endpoints (`rl-agent.ts`)

### GET /api/rl-agent/health
RL service health check.

**Authentication:** None required

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "string (healthy)",
    "version": "string",
    "modelsLoaded": ["string"]
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/rl-agent/health
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "modelsLoaded": ["momentum_agent", "mean_reversion_agent"]
  }
}
```

**Error Codes:**
- `503` - Service unavailable

### POST /api/rl-agent/predictions
Get predictions.

**Authentication:** Required

**Request Body:**
```json
{
  "symbol": "string",
  "timeframe": "string (1d, 1h, 15m)",
  "features": "object"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "string",
    "prediction": "string (BUY/SELL/HOLD)",
    "confidence": "number",
    "agent": "string",
    "timestamp": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/rl-agent/predictions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","timeframe":"1d","features":{}}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "prediction": "BUY",
    "confidence": 0.78,
    "agent": "momentum_agent",
    "timestamp": "2024-01-15T19:00:00Z"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `503` - RL service unavailable

### POST /api/rl-agent/top-setups
Get top trading setups.

**Authentication:** Required

**Request Body:**
```json
{
  "limit": "number (optional, default 10)",
  "assetClass": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "string",
      "setup": "string",
      "confidence": "number",
      "expectedReturn": "number",
      "risk": "number",
      "agent": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/rl-agent/top-setups \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"limit":5,"assetClass":"stocks"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "setup": "Bullish Momentum",
      "confidence": 0.85,
      "expectedReturn": 0.12,
      "risk": 0.08,
      "agent": "momentum_agent"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token
- `503` - RL service unavailable

### POST /api/rl-agent/portfolio
Analyze portfolio.

**Authentication:** Required

**Request Body:**
```json
{
  "portfolio": [
    {
      "symbol": "string",
      "quantity": "number",
      "avgPrice": "number"
    }
  ],
  "cash": "number"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": "string",
    "recommendations": ["string"],
    "riskScore": "number",
    "diversificationScore": "number"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/rl-agent/portfolio \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"portfolio":[{"symbol":"AAPL","quantity":10,"avgPrice":145.50}],"cash":5000}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "analysis": "Your portfolio shows good diversification...",
    "recommendations": ["Consider adding bonds for stability"],
    "riskScore": 0.7,
    "diversificationScore": 0.6
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `503` - RL service unavailable

### POST /api/rl-agent/market-data
Get market data.

**Authentication:** Required

**Request Body:**
```json
{
  "symbols": ["string"],
  "indicators": ["string"],
  "period": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "marketData": "object",
    "indicators": "object",
    "timestamp": "string"
  }
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/rl-agent/market-data \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","GOOGL"],"indicators":["RSI","MACD"],"period":"1M"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "marketData": {
      "AAPL": {"price": 150.25, "volume": 50000000},
      "GOOGL": {"price": 2800.50, "volume": 1500000}
    },
    "indicators": {
      "AAPL": {"RSI": 65.5, "MACD": 2.1},
      "GOOGL": {"RSI": 72.3, "MACD": 15.8}
    },
    "timestamp": "2024-01-15T19:30:00Z"
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `503` - RL service unavailable

---

## 10. Market Data Endpoints (`market-data.ts`)

### GET /api/market-data/trending
Get trending symbols.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): number, default 20
- `assetClass` (optional): string

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "string",
      "name": "string",
      "price": "number",
      "change": "number",
      "changePercent": "number",
      "volume": "number",
      "marketCap": "number"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/market-data/trending?limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "price": 150.25,
      "change": 2.50,
      "changePercent": 1.69,
      "volume": 50000000,
      "marketCap": 2400000000000
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/market-data/symbols
Get symbol list.

**Authentication:** Required

**Query Parameters:**
- `assetClass` (optional): string (stocks, crypto, forex, commodities)
- `search` (optional): string

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "string",
      "name": "string",
      "assetClass": "string",
      "exchange": "string",
      "currency": "string"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/market-data/symbols?assetClass=stocks&search=apple" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "assetClass": "stocks",
      "exchange": "NASDAQ",
      "currency": "USD"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/market-data/history/:symbol
Get historical data.

**Authentication:** Required

**Path Parameters:**
- `symbol`: string

**Query Parameters:**
- `period` (optional): string (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y), default 1mo
- `interval` (optional): string (1m, 5m, 15m, 1h, 1d), default 1d

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "string",
      "open": "number",
      "high": "number",
      "low": "number",
      "close": "number",
      "volume": "number"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/market-data/history/AAPL?period=1mo&interval=1d" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-15T16:00:00Z",
      "open": 148.50,
      "high": 151.00,
      "low": 147.25,
      "close": 150.25,
      "volume": 50000000
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Symbol not found

---

## 11. Notifications Endpoints (`notifications.ts`)

### GET /api/notifications
Get user notifications.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): number, default 50
- `unreadOnly` (optional): boolean, default false

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "type": "string",
      "title": "string",
      "message": "string",
      "isRead": "boolean",
      "createdAt": "string",
      "actionUrl": "string (optional)"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/notifications?unreadOnly=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "signal",
      "title": "New Trading Signal",
      "message": "AAPL signal generated with 85% confidence",
      "isRead": false,
      "createdAt": "2024-01-15T20:00:00Z",
      "actionUrl": "/signals/1"
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/notifications/unread-count
Get unread count.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": "number"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/notifications/unread-count \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 3
  }
}
```

**Error Codes:**
- `401` - Invalid token

### PUT /api/notifications/:id/read
Mark as read.

**Authentication:** Required

**Path Parameters:**
- `id`: number

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

**Example Request:**
```bash
curl -X PUT https://wealtharena-backend-jg1ve2.azurewebsites.net/api/notifications/1/read \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Notification not found

### PUT /api/notifications/read-all
Mark all as read.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "markedCount": "number"
  }
}
```

**Example Request:**
```bash
curl -X PUT https://wealtharena-backend-jg1ve2.azurewebsites.net/api/notifications/read-all \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "markedCount": 3
  }
}
```

**Error Codes:**
- `401` - Invalid token

### DELETE /api/notifications/:id
Delete notification.

**Authentication:** Required

**Path Parameters:**
- `id`: number

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

**Example Request:**
```bash
curl -X DELETE https://wealtharena-backend-jg1ve2.azurewebsites.net/api/notifications/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Notification not found

---

## 12. Analytics Endpoints (`analytics.ts`)

### GET /api/analytics/performance
Get portfolio performance.

**Authentication:** Required

**Query Parameters:**
- `portfolioId` (optional): number
- `period` (optional): string (1d, 1w, 1m, 3m, 1y), default 1m

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolioId": "number",
    "period": "string",
    "totalReturn": "number",
    "annualizedReturn": "number",
    "volatility": "number",
    "sharpeRatio": "number",
    "maxDrawdown": "number",
    "winRate": "number",
    "avgWin": "number",
    "avgLoss": "number"
  }
}
```

**Example Request:**
```bash
curl -X GET "https://wealtharena-backend-jg1ve2.azurewebsites.net/api/analytics/performance?period=1m" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "portfolioId": 1,
    "period": "1m",
    "totalReturn": 0.125,
    "annualizedReturn": 1.5,
    "volatility": 0.18,
    "sharpeRatio": 1.8,
    "maxDrawdown": -0.08,
    "winRate": 0.65,
    "avgWin": 0.03,
    "avgLoss": -0.02
  }
}
```

**Error Codes:**
- `401` - Invalid token
- `404` - Portfolio not found

### POST /api/analytics/onboarding
Track onboarding analytics.

**Authentication:** Required

**Request Body:**
```json
{
  "step": "string",
  "action": "string",
  "metadata": "object (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Analytics event tracked"
}
```

**Example Request:**
```bash
curl -X POST https://wealtharena-backend-jg1ve2.azurewebsites.net/api/analytics/onboarding \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"step":"profile_setup","action":"completed","metadata":{"timeSpent":120}}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Analytics event tracked"
}
```

**Error Codes:**
- `401` - Invalid token

---

## 13. Learning Endpoints (`learning.ts`)

### GET /api/learning/topics
Get learning topics.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "title": "string",
      "description": "string",
      "difficulty": "string (beginner, intermediate, advanced)",
      "estimatedTime": "number",
      "lessons": "number",
      "completed": "boolean"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/learning/topics \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Introduction to Investing",
      "description": "Learn the basics of investing",
      "difficulty": "beginner",
      "estimatedTime": 30,
      "lessons": 5,
      "completed": true
    }
  ]
}
```

**Error Codes:**
- `401` - Invalid token

### GET /api/learning/progress
Get learning progress.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTopics": "number",
    "completedTopics": "number",
    "totalLessons": "number",
    "completedLessons": "number",
    "currentStreak": "number",
    "longestStreak": "number",
    "totalTimeSpent": "number",
    "averageScore": "number"
  }
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/learning/progress \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalTopics": 10,
    "completedTopics": 3,
    "totalLessons": 50,
    "completedLessons": 15,
    "currentStreak": 5,
    "longestStreak": 12,
    "totalTimeSpent": 720,
    "averageScore": 85.5
  }
}
```

**Error Codes:**
- `401` - Invalid token

---

## 14. Strategies Endpoints (`strategies.ts`)

### GET /api/strategies
Get available strategies.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "name": "string",
      "description": "string",
      "riskLevel": "string (low, medium, high)",
      "expectedReturn": "number",
      "backtestPeriod": "string",
      "sharpeRatio": "number",
      "maxDrawdown": "number"
    }
  ]
}
```

**Example Request:**
```bash
curl -X GET https://wealtharena-backend-jg1ve2.azurewebsites.net/api/strategies \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Momentum Strategy",
      "description": "Invest in stocks with strong upward momentum",
      "riskLevel": "medium",
      "expectedReturn": 0.15,
      "backtestPeriod": "5 years",
      "sharpeRatio": 1.2,
      "maxDrawdown": -0.12
    }
  ]
}