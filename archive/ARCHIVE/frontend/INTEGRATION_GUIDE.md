# WealthArena - Chatbot & RL Agent Integration Guide

This guide explains how to set up and use the newly integrated AI Chatbot and RL Agent features in the WealthArena platform.

## 📋 Table of Contents

1. [Overview](#overview)
2. [New Features](#new-features)
3. [Architecture](#architecture)
4. [Setup Instructions](#setup-instructions)
5. [API Endpoints](#api-endpoints)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## 🎯 Overview

WealthArena now includes:
- **AI Chatbot** - Financial assistant powered by LLM with sentiment analysis and price lookup tools
- **RL Agent Dashboard** - View and monitor reinforcement learning trading agents' performance
- **Historical Trading Game** - Compete against RL agents using historical market data

## ✨ New Features

### 1. AI Assistant (`/ai-assistant`)
- Interactive chat interface with financial AI
- Real-time stock price lookups
- Sentiment analysis of market news
- Educational trading content
- Tool usage tracking

### 2. RL Dashboard (`/rl-dashboard`)
- Real-time RL agent performance metrics
- Top trading setups across multiple asset types (stocks, forex, crypto, commodities)
- System status and model information
- Agent comparison and analytics

### 3. Historical Trading Game (`/trading-game`)
- Compete against RL agents in historical market episodes
- Real-time portfolio tracking
- Leaderboard system
- Multi-player support (human vs AI vs benchmark)

## 🏗️ Architecture

### Frontend (React Native/Expo)
```
WealthArena/
├── app/
│   ├── ai-assistant.tsx          # AI chatbot page
│   ├── rl-dashboard.tsx          # RL agent dashboard
│   ├── trading-game.tsx          # Historical trading game
│   └── (tabs)/
│       └── dashboard.tsx         # Updated with AI features section
├── services/
│   ├── chatbotService.ts         # Chatbot API client
│   └── rlAgentService.ts         # RL agent API client
```

### Backend (Node.js/Express)
```
WealthArena_Backend/
└── src/
    └── routes/
        ├── chatbot.ts            # Chatbot API proxy
        ├── rl-agent.ts           # RL agent API proxy
        └── index.ts              # Routes aggregation
```

### External Services
```
wealtharena_chatbot/              # Python FastAPI chatbot service
└── app/
    ├── main.py                   # Chatbot API server
    └── api/
        └── chat.py               # Chat endpoints

wealtharena_rl/                   # Python RL backend service
└── backend/
    ├── main.py                   # RL API server
    └── src/
        └── game/
            └── historical_game.py # Trading game logic
```

## 🚀 Setup Instructions

### 1. Start Chatbot API (Port 8000)

```bash
cd wealtharena_chatbot

# Create virtual environment (first time only)
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API keys
# Copy env.example to .env and add:
# GROQ_API_KEY=your_groq_api_key_here

# Start the chatbot server
python -m uvicorn app.main:app --reload --port 8000
```

The chatbot API will be available at: `http://localhost:8000`

### 2. Start RL Agent Backend (Port 8001)

```bash
cd wealtharena_rl

# Create virtual environment (first time only)
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the RL backend server on a different port
python -m uvicorn backend.main:app --reload --port 8001
```

The RL API will be available at: `http://localhost:8001`

### 3. Configure Backend Proxy

Update `WealthArena_Backend/.env`:

```env
# Chatbot API URL
CHATBOT_API_URL=http://localhost:8000

# RL Agent API URL
RL_API_URL=http://localhost:8001

# Other existing variables...
PORT=3000
```

### 4. Install Backend Dependencies

```bash
cd WealthArena_Backend

# Install axios (if not already installed)
npm install axios

# Or using yarn
yarn add axios
```

### 5. Start Backend Server (Port 3000)

```bash
cd WealthArena_Backend

# Development mode
npm run dev

# Or production build
npm run build
npm start
```

The backend API will be available at: `http://localhost:3000`

### 6. Configure Frontend

Update `WealthArena/.env` (create if doesn't exist):

```env
# Backend API URL
EXPO_PUBLIC_API_URL=http://localhost:3000

# Optional: Direct API URLs for development
EXPO_PUBLIC_CHATBOT_API_URL=http://localhost:8000
EXPO_PUBLIC_RL_API_URL=http://localhost:8001
```

### 7. Start Frontend

```bash
cd WealthArena

# Install dependencies (if not already done)
npm install

# Start Expo development server
npm start

# Or start with web
npm run start-web
```

## 📡 API Endpoints

### Chatbot API (via Backend Proxy)

#### POST `/api/chatbot/chat`
Send a message to the AI assistant

**Request:**
```json
{
  "message": "What is a P/E ratio?",
  "user_id": "optional_user_id",
  "context": "optional_context"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reply": "AI response here...",
    "tools_used": ["llm_client"],
    "trace_id": "run-12345"
  }
}
```

#### Price Lookup
```json
{
  "message": "price AAPL"
}
```

#### Sentiment Analysis
```json
{
  "message": "analyze: The stock market is performing well today"
}
```

### RL Agent API (via Backend Proxy)

#### POST `/api/rl-agent/predictions`
Get trading prediction for a symbol

**Request:**
```json
{
  "symbol": "AAPL",
  "horizon": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "signal": "BUY",
    "confidence": 0.85,
    "current_price": 175.43,
    "target_price": 180.25,
    "stop_loss": 172.50,
    "risk_reward_ratio": 2.5,
    "reasoning": "Model confidence: 85%. Bullish signals detected..."
  }
}
```

#### POST `/api/rl-agent/top-setups`
Get top trading setups

**Request:**
```json
{
  "asset_type": "stocks",
  "count": 3,
  "risk_tolerance": "medium"
}
```

#### GET `/api/rl-agent/metrics/summary`
Get system metrics and status

#### GET `/api/rl-agent/game/leaderboard`
Get trading game leaderboard

## 🧪 Testing

### 1. Test Chatbot Integration

#### Using the UI:
1. Navigate to Dashboard
2. Click "AI Assistant" in the AI & RL Features section
3. Try these test messages:
   - "What is a stop loss?"
   - "price AAPL"
   - "analyze: The market is bullish today"

#### Using curl:
```bash
# Chat request
curl -X POST http://localhost:3000/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is a P/E ratio?"}'

# Price lookup
curl -X POST http://localhost:3000/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "price AAPL"}'
```

### 2. Test RL Dashboard

#### Using the UI:
1. Navigate to Dashboard
2. Click "RL Dashboard" in the AI & RL Features section
3. View agent performance metrics
4. Switch between asset types (Stocks, Forex, Crypto, Commodities)
5. View top trading setups

#### Using curl:
```bash
# Get top setups
curl -X POST http://localhost:3000/api/rl-agent/top-setups \
  -H "Content-Type: application/json" \
  -d '{
    "asset_type": "stocks",
    "count": 3,
    "risk_tolerance": "medium"
  }'

# Get system metrics
curl http://localhost:3000/api/rl-agent/metrics/summary
```

### 3. Test Trading Game

#### Using the UI:
1. Navigate to Dashboard
2. Click "Trading Game" in the AI & RL Features section
3. Click "Start New Game"
4. Select instruments and quantities
5. Add buy/sell actions
6. Execute turn
7. View leaderboard

### 4. Health Checks

```bash
# Check all services
curl http://localhost:8000/healthz     # Chatbot
curl http://localhost:8001/health      # RL Agent
curl http://localhost:3000/api/health  # Backend

# Check proxy health
curl http://localhost:3000/api/chatbot/health
curl http://localhost:3000/api/rl-agent/health
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "Chatbot API is not available"
**Solution:**
- Ensure chatbot server is running on port 8000
- Check CHATBOT_API_URL in backend .env
- Verify no firewall blocking port 8000

```bash
# Check if chatbot is running
curl http://localhost:8000/healthz
```

#### 2. "RL API is not available"
**Solution:**
- Ensure RL backend is running on port 8001
- Check RL_API_URL in backend .env
- Verify Python dependencies are installed

```bash
# Check if RL API is running
curl http://localhost:8001/health
```

#### 3. CORS Errors
**Solution:**
- Backend already configured to allow all origins in development
- For production, update ALLOWED_ORIGINS in backend .env

#### 4. Module Import Errors (Python)
**Solution:**
```bash
# Reinstall dependencies
pip install --upgrade -r requirements.txt

# For chatbot
cd wealtharena_chatbot
pip install -r requirements.txt

# For RL agent
cd wealtharena_rl
pip install -r requirements.txt
```

#### 5. Port Already in Use
**Solution:**
```bash
# Find process using port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:8000 | xargs kill -9

# Or use different ports
python -m uvicorn app.main:app --port 8002
```

#### 6. Frontend API Connection Issues
**Solution:**
- Check service URLs in frontend .env
- For mobile testing, use your computer's IP address:
  ```env
  EXPO_PUBLIC_API_URL=http://192.168.1.xxx:3000
  ```
- Ensure all services are accessible from the mobile device's network

### Logs and Debugging

#### View Chatbot Logs:
```bash
cd wealtharena_chatbot
python -m uvicorn app.main:app --reload --log-level debug
```

#### View RL Agent Logs:
```bash
cd wealtharena_rl
python -m uvicorn backend.main:app --reload --port 8001 --log-level debug
```

#### View Backend Logs:
```bash
cd WealthArena_Backend
npm run dev  # Logs appear in console
```

## 📊 Service Architecture

```
┌─────────────────┐
│  Mobile App     │
│  (Expo/RN)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend API    │
│  (Express)      │
│  Port: 3000     │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────────┐ ┌──────────┐
│ Chatbot │ │ RL Agent │
│  API    │ │   API    │
│ :8000   │ │  :8001   │
└─────────┘ └──────────┘
```

## 🎮 Navigation Flow

```
Dashboard
  ├── AI & RL Features Section
  │   ├── AI Assistant → /ai-assistant
  │   ├── RL Dashboard → /rl-dashboard
  │   └── Trading Game → /trading-game
  │
  └── Quick Actions
      └── (Existing features)
```

## 📝 Next Steps

1. **Production Deployment:**
   - Deploy chatbot API to cloud service
   - Deploy RL backend to cloud service
   - Update environment variables with production URLs
   - Configure proper CORS settings

2. **Enhancements:**
   - Add user authentication to chatbot
   - Implement chat history persistence
   - Add more RL agent types
   - Expand trading game features
   - Add real-time agent training visualization

3. **Monitoring:**
   - Set up logging and monitoring
   - Track API usage metrics
   - Monitor model performance
   - Add error tracking (e.g., Sentry)

## 🤝 Support

For issues or questions:
1. Check the logs for error messages
2. Verify all services are running
3. Check network connectivity
4. Review environment variables
5. Ensure all dependencies are installed

## 📄 License

This integration guide is part of the WealthArena project.

