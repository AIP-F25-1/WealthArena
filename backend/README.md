# WealthArena Backend API

Complete backend API for the WealthArena trading gamification platform.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
npm install --save-dev typescript @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/mssql ts-node nodemon
```

### 2. Configure Environment

Copy `env.example` to `.env` and add your Azure SQL credentials:

```env
DB_HOST=your-server.database.windows.net
DB_NAME=WealthArenaDB
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433
DB_ENCRYPT=true

PORT=3000
NODE_ENV=development

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

ALLOWED_ORIGINS=http://localhost:5001,http://localhost:8081
```

### 3. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 📋 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user
- `POST /api/auth/login` - User login

### Trading Signals
- `GET /api/signals/top` - Get top signals
- `GET /api/signals/:signalId` - Get specific signal
- `GET /api/signals/symbol/:symbol` - Get signals for symbol

### Portfolio
- `GET /api/portfolio` - Get user portfolio
- `GET /api/portfolio/items` - Get portfolio items
- `GET /api/portfolio/trades` - Get trade history
- `GET /api/portfolio/positions` - Get open positions

### User
- `GET /api/user/profile` - Get user profile
- `POST /api/user/xp` - Award XP
- `GET /api/user/achievements` - Get achievements
- `GET /api/user/quests` - Get active quests
- `GET /api/user/leaderboard` - Get leaderboard

### AI Chat
- `POST /api/chat/session` - Create/get chat session
- `POST /api/chat/message` - Save chat message
- `GET /api/chat/history` - Get chat history
- `POST /api/chat/feedback` - Submit feedback
- `GET /api/chat/sessions` - Get all sessions

---

## 🔒 Authentication

All endpoints (except `/auth/signup` and `/auth/login`) require JWT token:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📊 Example Requests

### Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "username": "trader1",
    "displayName": "Pro Trader"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Get Top Signals
```bash
curl -X GET http://localhost:3000/api/signals/top?limit=5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🛠️ Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build TypeScript
- `npm start` - Start production server

### Project Structure
```
src/
├── config/
│   └── database.ts      # Database connection
├── middleware/
│   └── auth.ts          # JWT authentication
├── routes/
│   ├── auth.ts          # Auth routes
│   ├── signals.ts       # Trading signals
│   ├── portfolio.ts     # Portfolio management
│   ├── user.ts          # User profile
│   ├── chat.ts          # AI chat
│   └── index.ts         # Route aggregator
├── utils/
│   └── responses.ts     # API responses
└── server.ts            # Main server
```

---

## 🔧 Troubleshooting

### Database Connection Issues
- Verify Azure SQL firewall rules
- Check credentials in `.env`
- Ensure database exists

### Port Already in Use
Change `PORT` in `.env` or:
```bash
PORT=3001 npm run dev
```

---

## 📝 License

ISC

---

## Additional Notes

### Phase History

- **[README_PHASE4.md](README_PHASE4.md)** - Phase 4 backend setup guide with detailed database integration steps, stored procedures deployment, and phase-specific architecture details. Preserved for historical reference.

