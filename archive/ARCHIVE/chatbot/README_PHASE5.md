# Phase 5: Chatbot Service Setup & RAG Integration

## Overview
This phase sets up the WealthArena chatbot service to run locally without Docker, integrating a RAG (Retrieval-Augmented Generation) pipeline with GROQ LLM API, optional Chroma vector database, and educational knowledge base. The chatbot provides AI-powered chat, sentiment analysis, trade setup generation, and learning content for the frontend.

## Prerequisites
- ✅ Python 3.8+ installed
- ✅ pip package manager
- ✅ Internet connectivity (for GROQ API and model downloads)
- ✅ GROQ API key (already in .env.example)

## Architecture

```
WealthArena Chatbot Service
├── FastAPI 0.104.1 (Web Framework)
├── Uvicorn (ASGI Server)
├── GROQ API (LLM Provider - llama3-8b-8192)
├── Sentence Transformers (Embeddings - all-MiniLM-L6-v2)
├── Chroma Vector DB (Optional - graceful fallback)
├── DistilBERT (Sentiment Analysis)
└── 11 API Routers
    ├── /v1/chat (AI chat with LLM)
    ├── /v1/search (News search with vector DB)
    ├── /v1/knowledge/topics (Learning content)
    ├── /v1/game (Game integration)
    ├── /v1/market (Market data)
    └── /healthz (Health check)
```

## Step-by-Step Setup

### Step 1: Update Dependencies

**File:** `wealtharena_chatbot/requirements.txt`

**Add missing packages:**
```
chromadb==0.4.22
sentence-transformers==2.2.2
beautifulsoup4==4.12.2
lxml==4.9.3
requests==2.31.0
```

**Install all dependencies:**
```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/wealtharena_chatbot"
pip install -r requirements.txt
```

**Expected Output:**
```
Collecting fastapi==0.104.1
Collecting uvicorn[standard]==0.24.0
Collecting chromadb==0.4.22
Collecting sentence-transformers==2.2.2
...
Successfully installed 21 packages
```

**Verification:**
```bash
pip list | grep -E "fastapi|groq|chromadb|sentence-transformers"
```

Should show:
```
chromadb              0.4.22
fastapi               0.104.1
groq                  0.4.1
sentence-transformers 2.2.2
```

**Estimated Duration:** 2-3 minutes (first-time installation)

---

### Step 2: Create Environment Configuration

**File:** `wealtharena_chatbot/.env`

**Create .env file:**
```bash
cd wealtharena_chatbot
copy .env.example .env
```

**Update PORT value:**
Open `.env` and change:
```bash
PORT=5001
```

**Verify GROQ_API_KEY:**
Ensure this line exists:
```bash
GROQ_API_KEY=your_groq_api_key_here
```

**Complete .env configuration:**
```bash
# LLM Configuration
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama3-8b-8192
LLM_PROVIDER=groq

# Model Configuration
SENTIMENT_MODEL_DIR=models/sentiment-finetuned

# Vector Database
CHROMA_PERSIST_DIR=data/chroma_db

# Application Configuration
APP_HOST=0.0.0.0
PORT=5001
```

**Verification:**
```bash
cat .env | grep PORT
# Should show: PORT=5001
```

---

### Step 3: Run Knowledge Base Setup Scripts

**Step 3A: Scrape Investopedia**

```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/chatbot_setup"
python 01_scrape_investopedia.py
```

**What it does:**
- Scrapes 80+ financial terms from Investopedia
- Creates `investopedia_raw_data.json` (raw scraped data)
- Creates `financial_knowledge_base.json` (structured knowledge base)

**Expected Duration:** 2-3 minutes (80 terms × 1 second + processing)

**Expected Output:**
```
✅ Knowledge base created successfully!
📁 Files created:
  - investopedia_raw_data.json
  - financial_knowledge_base.json
```

**Step 3B: Create Embeddings**

```bash
python 02_create_embeddings.py
```

**What it does:**
- Loads `financial_knowledge_base.json`
- Downloads `all-MiniLM-L6-v2` model (~90MB, first run only)
- Creates vector embeddings for all terms and categories
- Creates search index for similarity search

**Expected Duration:** 1-2 minutes (model download on first run adds ~30 seconds)

**Expected Output:**
```
✅ Embeddings creation completed successfully!
🎯 Ready for RAG chatbot integration!
📁 Files created:
  - financial_embeddings.json
  - category_embeddings.json
  - search_index.json
  - embeddings_summary.json
```

**Verification:**
```bash
ls chatbot_setup/*.json
# Should show 6 JSON files total
```

**Note:** These embeddings are created for future use. To load them into Chroma, run the ingestion script (see Step 3C below). Without Chroma ingestion, the chatbot works using static knowledge topics from `app/api/knowledge.py` and `app/api/context.py`, and search falls back to in-memory search over RSS news feeds.

**Step 3C: Load Embeddings into Chroma (Optional)**

```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/wealtharena_chatbot"
python create_chroma_collection.py
```

**What it does:**
- Loads `financial_embeddings.json` from `chatbot_setup/` directory
- Creates a `financial_knowledge` collection in Chroma
- Stores embeddings, metadata, and documents in `data/chroma_db/`
- Enables vector similarity search for the search endpoint

**Expected Duration:** 1-2 minutes (depends on number of embeddings)

**Expected Output:**
```
Loading embeddings from: ../chatbot_setup/financial_embeddings.json
Loaded 80 terms
Initializing Chroma client at: data/chroma_db
Creating collection: financial_knowledge
Adding 80 items to Chroma in 1 batches...
  Batch 1/1 added (80 items)

✅ Successfully loaded 80 items into Chroma collection 'financial_knowledge'
📁 Chroma database persisted at: data/chroma_db

🎯 Collection is ready for use by the chatbot search endpoint!
   The search endpoint will automatically use Chroma if available.
```

**Verification:**
```bash
ls data/chroma_db/
# Should show Chroma database files
```

---

### Step 4: Create Data Directories

**Create required directories:**
```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/wealtharena_chatbot"
mkdir data\chroma_db
mkdir data\chat_history
```

**Verification:**
```bash
ls -la data/
# Should show:
# drwxr-xr-x  chroma_db/
# drwxr-xr-x  chat_history/
```

**Purpose:**
- `data/chroma_db/`: Chroma vector database persistent storage
- `data/chat_history/`: User chat history JSON files

**Note:** These directories will be populated automatically when the service runs:
- Chroma creates internal database files in `chroma_db/`
- Chat history creates `{user_id}.json` files in `chat_history/`

---

### Step 5: Start Chatbot Service

**Method 1: Direct Python Execution**
```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/wealtharena_chatbot"
python main.py
```

**Method 2: Uvicorn with Hot-Reload**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 5001 --reload
```

The `--reload` flag enables automatic restart on code changes (useful for development).

**Expected Output:**
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
Chroma client initialized successfully
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:5001 (Press CTRL+C to quit)
```

**If Chroma fails to initialize:**
```
Failed to initialize Chroma: No module named 'chromadb'
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:5001 (Press CTRL+C to quit)
```

This is acceptable - service will use in-memory search fallback.

**Service is now running!** ✅

---

### Step 6: Test Chatbot Endpoints

**Test 1: Health Check**
```bash
curl http://localhost:5001/healthz
```

**Expected:** `{"status": "healthy", ...}`

**Test 2: Basic Chat**
```bash
curl -X POST http://localhost:5001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is RSI?", "user_id": "test"}'
```

**Expected:** Educational response about RSI

**Test 3: Knowledge Topics**
```bash
curl http://localhost:5001/v1/knowledge/topics
```

**Expected:** Object with topics array and metadata

**Test 4: Search**
```bash
curl "http://localhost:5001/v1/search?q=stock%20market&k=5"
```

**Expected:** Search results (may be empty if no news data)

**Test 5: Trade Setup**
```bash
curl -X POST http://localhost:5001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "/setup for AAPL", "user_id": "test"}'
```

**Expected:** Response with trade setup card

---

### Step 7: Update Backend Proxy Configuration

**File:** `WealthArena_Backend/.env`

**Add chatbot url:**
```bash
CHATBOT_API_URL=http://localhost:5001
```

**Restart backend server:**
```bash
cd WealthArena_Backend
npm run dev
```

**Backend will now proxy requests to chatbot on port 5001.**

---

### Step 8: Test Backend Proxy Integration

**Ensure both services are running:**
1. Backend: `http://localhost:3000` (npm run dev)
2. Chatbot: `http://localhost:5001` (python main.py)

**Test proxy health check:**
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

**Test proxy chat:**
```bash
curl -X POST http://localhost:3000/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is MACD?", "user_id": "test"}'
```

**Expected:** Backend forwards to chatbot and returns wrapped response

---

## Frontend Integration

### Learning Page Integration

**Endpoint to use:** `GET /api/chatbot/knowledge/topics` (via backend proxy)

Or directly: `GET http://localhost:5001/v1/knowledge/topics`

**Frontend code example (React Native):**
```typescript
// In WealthArena/app/learning-topics.tsx
import { apiService } from '../services/apiService';

const fetchLearningTopics = async () => {
  try {
    // Option 1: Via backend proxy
    const response = await fetch('http://localhost:3000/api/chatbot/knowledge/topics');
    
    // Option 2: Direct to chatbot
    const response = await fetch('http://localhost:5001/v1/knowledge/topics');
    
    const topics = await response.json();
    setTopics(topics);
  } catch (error) {
    console.error('Failed to fetch topics:', error);
  }
};
```

### Chat Integration

**Endpoint to use:** `POST /api/chatbot/chat` (via backend proxy)

**Frontend code example:**
```typescript
// In WealthArena/app/ai-chat.tsx
const sendMessage = async (message: string) => {
  try {
    const response = await fetch('http://localhost:3000/api/chatbot/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        user_id: currentUser.id,
        context: null
      })
    });
    
    const data = await response.json();
    if (data.success) {
      setChatMessages([...chatMessages, {
        role: 'user',
        content: message
      }, {
        role: 'assistant',
        content: data.data.reply,
        card: data.data.card  // Trade setup card if available
      }]);
    }
  } catch (error) {
    console.error('Failed to send message:', error);
  }
};
```

---

## Troubleshooting

### Issue: Service won't start - "No module named 'fastapi'"
**Solution:**
```bash
pip install -r requirements.txt
```

### Issue: "Failed to initialize Chroma"
**Solution:** This is acceptable - service uses in-memory search fallback. To fix:
```bash
pip install chromadb==0.4.22
```

### Issue: GROQ API errors - "Invalid API key"
**Solution:** Verify GROQ_API_KEY in `.env`:
```bash
cat .env | grep GROQ_API_KEY
```
Key should start with `gsk_`

### Issue: Port 5001 already in use
**Solution:**
```bash
# Find process using port 5001
netstat -ano | findstr :5001

# Kill process or change port in .env
PORT=5002
```
Also update `CHATBOT_API_URL` in backend `.env`.

### Issue: Backend proxy connection refused
**Solution:**
```bash
# Verify chatbot is running
curl http://localhost:5001/healthz

# If fails, start chatbot service
python main.py
```

### Issue: Sentiment analysis fails
**Solution:** Sentiment model is optional. Service continues without it. To enable:
```bash
# Download pre-trained model or use default
# Model directory: models/sentiment-finetuned
```

---

## Optional: Chroma Vector DB Setup

**Note:** Chroma is optional for demo. The chatbot works fine with in-memory search.

**To enable Chroma:**

1. **Ensure chromadb is installed:**
   ```bash
   pip install chromadb==0.4.22
   ```

2. **Create Chroma directory:**
   ```bash
   mkdir data\chroma_db
   ```

3. **Load knowledge base into Chroma:**
   ```bash
   python create_chroma_collection.py
   ```
   
   This script (already created in `wealtharena_chatbot/create_chroma_collection.py`) loads embeddings from `chatbot_setup/financial_embeddings.json` into Chroma. See Step 3C above for details.

**This step is OPTIONAL for demo.** The chatbot works without Chroma using in-memory search.

---

## API Endpoints Summary

### Chat & AI
- `POST /v1/chat` - Chat with AI (GROQ LLM)
- `GET /v1/chat/history` - Get chat history
- `DELETE /v1/chat/history` - Clear chat history

### Knowledge & Learning
- `GET /v1/knowledge/topics` - Get all learning topics with filtering options
- `GET /v1/knowledge/topics/{id}` - Get topic details
- `GET /v1/knowledge/categories` - Get all available categories
- `GET /v1/knowledge/recommended` - Get recommended topics based on user level
- `GET /v1/knowledge/search` - Search knowledge topics
- `GET /v1/context/knowledge/topics` - Alternative static knowledge topics endpoint

### Search & Market
- `GET /v1/search?q={query}&k={limit}` - Search news articles
- `GET /v1/market/*` - Market data endpoints

### Game
- `POST /v1/game/start` - Start game session
- `POST /v1/game/tick` - Advance game time
- `POST /v1/game/trade` - Execute trade
- `GET /v1/game/portfolio` - Get portfolio state
- `GET /v1/game/summary` - Get game summary

### Health & Monitoring
- `GET /healthz` - Health check
- `GET /metrics` - Prometheus metrics
- `GET /` - API info

---

## Next Steps

After completing Phase 5:
1. ✅ Verify chatbot service runs on port 5001
2. ✅ Test all endpoints return expected responses
3. ✅ Verify backend proxy can reach chatbot service
4. ✅ Test GROQ API integration (chat responses)
5. ➡️ Proceed to Phase 6: RL Inference Service Setup
6. ➡️ Proceed to Phase 8: Frontend Integration (connect learning page to `/context/knowledge/topics`)

## Success Criteria

✅ **Service Running:**
- Chatbot service starts on port 5001 without errors
- Health check returns 200 OK
- All 11 routers loaded successfully

✅ **Knowledge Base:**
- Investopedia scraper completed (75+ terms)
- Embeddings created (384-dimensional vectors)
- Knowledge topics accessible via API

✅ **Chat Functionality:**
- Basic chat returns LLM responses from GROQ
- Sentiment analysis works
- Price lookup works for valid tickers
- Trade setup cards generated

✅ **Backend Integration:**
- Backend proxy connects to chatbot on port 5001
- Proxy endpoints return wrapped responses
- Health check through proxy works

✅ **Optional Features:**
- Chroma vector DB initialized (or graceful fallback)
- Search functionality works (Chroma or in-memory)
- Chat history persists to JSON files

**Phase 5 Status:** ✅ Ready for Frontend Integration

**Estimated Setup Time:** 10-15 minutes (including knowledge base setup)

