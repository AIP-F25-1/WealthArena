# WealthArena Chatbot Service Testing Guide

## Prerequisites
- Chatbot service running on `http://localhost:5001`
- GROQ_API_KEY configured in `.env`
- Knowledge base setup completed (optional for basic testing)
- Postman or curl for API testing

## Testing Strategy

### Phase 1: Health Check & Service Verification
### Phase 2: Chat Endpoints (LLM Integration)
### Phase 3: Knowledge Base & Learning Endpoints
### Phase 4: Search Functionality (Vector DB)
### Phase 5: Backend Proxy Integration

---

## Phase 1: Health Check & Service Verification

### 1.1 Health Check
**Endpoint:** `GET /healthz`
**Auth Required:** No

**curl:**
```bash
curl http://localhost:5001/healthz
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "wealtharena-mobile-api",
  "version": "1.0.0"
}
```

### 1.2 Root Endpoint
**Endpoint:** `GET /`
**Auth Required:** No

**curl:**
```bash
curl http://localhost:5001/
```

**Expected Response:**
```json
{
  "message": "WealthArena Mobile API",
  "version": "1.0.0",
  "status": "running"
}
```

### 1.3 API Documentation
**Endpoint:** `GET /docs`
**Auth Required:** No

**Browser:** Open `http://localhost:5001/docs`

This opens the interactive Swagger UI with all endpoint documentation.

---

## Phase 2: Chat Endpoints

### 2.1 Basic Chat (LLM Integration)
**Endpoint:** `POST /v1/chat`
**Auth Required:** No

**Postman:**
- Method: POST
- URL: `http://localhost:5001/v1/chat`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "message": "What is RSI?",
  "user_id": "test_user_123",
  "context": null
}
```

**curl:**
```bash
curl -X POST http://localhost:5001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is RSI?",
    "user_id": "test_user_123"
  }'
```

**Expected Response:**
```json
{
  "reply": "RSI (Relative Strength Index) is a momentum oscillator that measures the speed and change of price movements on a scale of 0-100. RSI values below 30 indicate oversold conditions (potential buying opportunity), while values above 70 indicate overbought conditions (potential selling opportunity). Remember, this is educational content only - always practice with paper trading first!",
  "tools_used": ["llm_client"],
  "trace_id": "run-12345",
  "card": null
}
```

### 2.2 Price Lookup
**Endpoint:** `POST /v1/chat`
**Message Pattern:** "price {TICKER}"

**curl:**
```bash
curl -X POST http://localhost:5001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "price AAPL",
    "user_id": "test_user_123"
  }'
```

**Expected Response:**
```json
{
  "reply": "The current price of AAPL is $154.23",
  "tools_used": ["get_price"],
  "trace_id": "run-23456",
  "card": null
}
```

### 2.3 Sentiment Analysis
**Endpoint:** `POST /v1/chat`
**Message Pattern:** "analyze: {text}"

**curl:**
```bash
curl -X POST http://localhost:5001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "analyze: The stock market is performing exceptionally well today with strong gains across all sectors",
    "user_id": "test_user_123"
  }'
```

**Expected Response:**
```json
{
  "reply": "📊 **Sentiment Analysis Results**\n\n**Text:** \"The stock market is performing exceptionally well today with strong gains across all sectors\"\n\n**Predicted Sentiment:** POSITIVE\n**Confidence:** 92.3%\n\n**Probability Breakdown:**\n• Negative: 2.1%\n• Neutral: 5.6%\n• Positive: 92.3%\n\nThis analysis is based on a fine-tuned DistilBERT model trained on financial text data.",
  "tools_used": ["sentiment"],
  "trace_id": "run-34567",
  "card": null
}
```

### 2.4 Trade Setup Card
**Endpoint:** `POST /v1/chat`
**Message Pattern:** "/setup for {SYMBOL}"

**curl:**
```bash
curl -X POST http://localhost:5001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "/setup for AAPL",
    "user_id": "test_user_123"
  }'
```

**Expected Response:**
```json
{
  "reply": "📊 **Trade Setup for AAPL**\n\nI've analyzed AAPL and created a trade setup card with technical indicators, entry/exit levels, and risk management parameters. This is educational content only - always practice with paper trading first!",
  "tools_used": ["llm_client", "trade_setup_card"],
  "trace_id": "run-45678",
  "card": {
    "symbol": "AAPL",
    "name": "AAPL Stock",
    "signal": "BUY",
    "confidence": 0.8,
    "price": 154.23,
    "entry": 154.23,
    "tp": [161.94, 169.65],
    "sl": 146.52,
    "indicators": {
      "rsi": 45.3,
      "sma_20": 156.78,
      "sma_50": 148.92,
      "volume": 5234567,
      "macd": 1.234,
      "bollinger_upper": 157.31,
      "bollinger_lower": 151.15
    },
    "reasoning": "Based on technical analysis: RSI at 45.3, moving averages showing bullish trend. This is educational content only - always practice with paper trading first!",
    "updated_at": "2025-01-15T10:30:00Z"
  }
}
```

---

## Phase 3: Knowledge Base & Learning Endpoints

### 3.1 Get All Knowledge Topics
**Endpoint:** `GET /v1/knowledge/topics`
**Auth Required:** No

**curl:**
```bash
curl "http://localhost:5001/v1/knowledge/topics"
```

**Expected Response:**
```json
{
  "topics": [
    {
      "id": "trading_basics",
      "name": "Trading Basics",
      "description": "Learn the fundamental concepts of trading...",
      "category": "Fundamentals",
      "difficulty": "Beginner",
      "estimated_time": "10 minutes",
      "prerequisites": [],
      "learning_objectives": [...]
    }
  ],
  "total": 8,
  "categories": ["Fundamentals", "Analysis", "Strategy", "Advanced", "Psychology"]
}
```

### 3.2 Get Topic by ID
**Endpoint:** `GET /v1/knowledge/topics/{topic_id}`
**Auth Required:** No

**curl:**
```bash
curl http://localhost:5001/v1/knowledge/topics/trading_basics
```

**Expected Response:**
```json
{
  "id": "trading_basics",
  "name": "Trading Basics",
  "description": "Learn the fundamental concepts of trading...",
  "category": "Fundamentals",
  "difficulty": "Beginner",
  "estimated_time": "10 minutes",
  "prerequisites": [],
  "learning_objectives": [...]
}
```

### 3.3 Get Knowledge Categories
**Endpoint:** `GET /v1/knowledge/categories`
**Auth Required:** No

**curl:**
```bash
curl http://localhost:5001/v1/knowledge/categories
```

### 3.4 Get Recommended Topics
**Endpoint:** `GET /v1/knowledge/recommended`
**Auth Required:** No

**curl:**
```bash
curl "http://localhost:5001/v1/knowledge/recommended?user_level=Beginner&limit=5"
```

### 3.5 Alternative Context Endpoints
**Endpoint:** `GET /v1/context/knowledge/topics`
**Auth Required:** No

**curl:**
```bash
curl http://localhost:5001/v1/context/knowledge/topics
```

This endpoint is from `app/api/context.py` and provides static knowledge topics with a different schema.

---

## Phase 4: Search Functionality

### 4.1 Search News Articles
**Endpoint:** `GET /v1/search` or `GET /search` (alias)
**Auth Required:** No

**curl:**
```bash
curl "http://localhost:5001/v1/search?q=stock%20market&k=5"
# Or using the alias:
curl "http://localhost:5001/search?q=stock%20market&k=5"
```

**Expected Response (In-Memory Search):**
```json
{
  "query": "stock market",
  "results": [
    {
      "id": "in_memory_0",
      "score": 2.5,
      "title": "Stock Market Rallies on Strong Earnings",
      "url": "https://example.com/article",
      "source": "Financial News",
      "ts": "2025-01-15T10:00:00Z",
      "tickers": ["AAPL", "MSFT", "GOOGL"],
      "event_tags": ["earnings"]
    }
  ]
}
```

**Note:** 
- If Chroma is not installed or initialized, the service uses in-memory search over latest RSS news feeds. This is acceptable for demo purposes.
- To enable Chroma search with financial embeddings, run `python create_chroma_collection.py` after running `02_create_embeddings.py`.

---

## Phase 5: Backend Proxy Integration

### 5.1 Test Backend Proxy - Health Check
**Endpoint:** `GET /api/chatbot/health`
**Auth Required:** No
**Backend Port:** 3000

**curl:**
```bash
curl http://localhost:3000/api/chatbot/health
```

**Expected Response:**
```json
{
  "success": true,
  "status": "healthy",
  "chatbot_api": {
    "status": "healthy",
    "service": "wealtharena-mobile-api",
    "version": "1.0.0"
  }
}
```

### 5.2 Test Backend Proxy - Chat
**Endpoint:** `POST /api/chatbot/chat`
**Auth Required:** No (for testing, add JWT auth in production)
**Backend Port:** 3000

**curl:**
```bash
curl -X POST http://localhost:3000/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain moving averages",
    "user_id": "test_user_123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "reply": "Moving averages help smooth out price data to identify trends. SMA (Simple Moving Average) calculates the average price over a specific period, while EMA (Exponential Moving Average) gives more weight to recent prices...",
    "tools_used": ["llm_client"],
    "trace_id": "run-56789",
    "card": null
  }
}
```

**This confirms:**
- ✅ Backend can reach chatbot service on port 5001
- ✅ Proxy correctly forwards requests
- ✅ Proxy wraps response in standard format
- ✅ GROQ API is working

---

## Common Testing Scenarios

### Scenario 1: Educational Chat Flow
1. Ask about RSI → Get educational explanation
2. Ask about moving averages → Get SMA/EMA explanation
3. Ask about risk management → Get position sizing guidance
4. Ask about trading → Get disclaimer about paper trading

### Scenario 2: Trade Setup Flow
1. Request setup for AAPL → Get trade setup card with indicators
2. Request setup for BTC-USD → Get crypto trade setup
3. Request setup for EURUSD=X → Get forex trade setup

### Scenario 3: Learning Page Integration
1. Get all topics → Display in learning page
2. Filter by category → Show Technical Analysis topics
3. Filter by difficulty → Show Beginner topics
4. Get topic details → Display full topic information

---

## Error Testing

### Test Missing GROQ API Key
```bash
# Temporarily remove GROQ_API_KEY from .env
# Restart chatbot service
# Send chat request

curl -X POST http://localhost:5001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is RSI?"}'
```

**Expected:** Fallback response (doesn't use GROQ, uses hardcoded educational content)

### Test Invalid Endpoint
```bash
curl http://localhost:5001/api/learn
```

**Expected Response:**
```json
{
  "detail": "Not Found"
}
```

**Note:** The `/api/learn` endpoint does NOT exist. Use `/v1/knowledge/topics` or `/v1/context/knowledge/topics` instead.

### Test Chatbot Service Down
```bash
# Stop chatbot service
# Test backend proxy

curl http://localhost:3000/api/chatbot/health
```

**Expected Response:**
```json
{
  "success": false,
  "status": "unhealthy",
  "message": "Chatbot API is not available"
}
```

---

## Postman Collection Setup

### Environment Variables
Create a Postman environment with:
- `chatbot_url`: `http://localhost:5001`
- `backend_url`: `http://localhost:3000`
- `user_id`: `test_user_123`

### Collection Structure
```
WealthArena Chatbot
├── Health & Status
│   ├── GET /healthz
│   └── GET /
├── Chat
│   ├── POST /v1/chat (Basic)
│   ├── POST /v1/chat (Price Lookup)
│   ├── POST /v1/chat (Sentiment Analysis)
│   └── POST /v1/chat (Trade Setup)
├── Knowledge
│   ├── GET /v1/knowledge/topics
│   ├── GET /v1/knowledge/topics/{id}
│   ├── GET /v1/knowledge/categories
│   ├── GET /v1/knowledge/recommended
│   └── GET /v1/context/knowledge/topics (alternative)
├── Search
│   ├── GET /v1/search
│   └── GET /search (alias)
└── Backend Proxy
    ├── GET /api/chatbot/health
    └── POST /api/chatbot/chat
```

---

## Troubleshooting

### Issue: Service won't start
**Solution:** Check Python version and dependencies
```bash
python --version  # Should be 3.8+
pip list | grep fastapi
```

### Issue: GROQ API errors
**Solution:** Verify API key in `.env`
```bash
cat .env | grep GROQ_API_KEY
# Should show valid key starting with gsk_
```

### Issue: Chroma initialization fails
**Solution:** This is acceptable - service falls back to in-memory search
```
Failed to initialize Chroma: No module named 'chromadb'
```
Service continues running normally.

### Issue: Port 5001 already in use
**Solution:** Change port in `.env`
```bash
PORT=5002
```
Also update `CHATBOT_API_URL` in backend `.env`.

### Issue: Backend proxy connection refused
**Solution:** Ensure chatbot service is running
```bash
curl http://localhost:5001/healthz
# If this fails, chatbot service is not running
```

---

## Success Criteria

✅ **Service Startup:**
- Chatbot service starts on port 5001
- Health check returns 200 OK
- No critical errors in console

✅ **Chat Functionality:**
- Basic chat returns LLM responses
- Price lookup works for valid tickers
- Sentiment analysis returns probabilities
- Trade setup cards generated correctly

✅ **Knowledge Base:**
- Topics endpoint returns knowledge topics with metadata
- Topics can be filtered by category and difficulty via query parameters
- Topic details accessible by ID
- Recommended topics endpoint available

✅ **Search:**
- Search endpoint returns results (Chroma or in-memory)
- Results have proper structure (id, score, title, url)

✅ **Backend Integration:**
- Backend proxy can reach chatbot service
- Proxy endpoints return wrapped responses
- Health check through proxy works

**All tests passing = Chatbot ready for frontend integration!**

