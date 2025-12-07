# 🗺️ **WEALTHARENA INTEGRATION ROADMAP**

**Your Complete Guide from Data → Model → Backend → Frontend → Game**

---

## 📋 **TABLE OF CONTENTS**

1. [System Overview](#system-overview)
2. [What You Have vs What You Need](#what-you-have-vs-what-you-need)
3. [Step-by-Step Integration Path](#step-by-step-integration-path)
4. [Component Connections](#component-connections)
5. [Demo Implementation](#demo-implementation)
6. [Next Steps](#next-steps)

---

## 🎯 **SYSTEM OVERVIEW**

```
📊 DATA FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DATA COLLECTION (Airflow DAG)
   ├─ Yahoo Finance API → Raw market data
   ├─ Store in data/raw/*.csv
   └─ Validate data quality

2. PREPROCESSING (Airflow DAG)
   ├─ Load raw data
   ├─ Calculate 50+ technical indicators
   ├─ Feature engineering
   └─ Store in data/features/*.csv

3. MODEL SERVING (Python/FastAPI)
   ├─ Load trained RL model from checkpoints/
   ├─ Generate predictions & recommendations
   └─ Expose via REST API endpoints

4. BACKEND API (FastAPI)
   ├─ /api/market-data → Latest prices & indicators
   ├─ /api/predictions → Buy/Sell/Hold signals
   ├─ /api/portfolio → Performance metrics
   ├─ /api/chat → RAG chatbot
   └─ /api/game → Game state & leaderboard

5. CHATBOT (RAG Model)
   ├─ Vector database (Chroma) with financial knowledge
   ├─ Model predictions → Chatbot context
   ├─ Explain "Why buy AAPL?"
   └─ Educational content for users

6. GAME ENGINE (Historical Replay)
   ├─ Load historical data
   ├─ User trades vs RL agent
   ├─ Calculate performance
   └─ Update leaderboard

7. FRONTEND (React/Next.js)
   ├─ Dashboard: Portfolio view + charts
   ├─ Predictions: Model recommendations
   ├─ Game: Historical trading challenge
   └─ Chat: RAG chatbot interface
```

---

## ✅ **WHAT YOU HAVE vs WHAT YOU NEED**

### **✅ What You Already Have:**

| Component | Status | Location |
|-----------|--------|----------|
| Data Fetching Code | ✅ Complete | `download_market_data.py` |
| Preprocessing Code | ✅ Complete | `src/data/market_data.py` |
| RL Models | ✅ Trained | `checkpoints/*` |
| Test Suite | ✅ 84.67% coverage | `test_*.py` |

### **🔧 What You Need to Add:**

| Component | Priority | What To Do |
|-----------|----------|------------|
| Airflow DAGs | **HIGH** | ✅ Created for you |
| Backend API | **HIGH** | ✅ Created for you |
| Database | MEDIUM | Use SQLite or PostgreSQL |
| Frontend UI | MEDIUM | Use existing or create simple React app |
| Chatbot Integration | LOW | Add RAG model later |
| Game Engine | LOW | Build after core demo works |

---

## 🚀 **STEP-BY-STEP INTEGRATION PATH**

### **PHASE 1: Core Data Pipeline (Week 1)**

```
GOAL: Get data flowing from yfinance → processed features

├─ Step 1.1: Install Airflow
│  └─ Run: pip install apache-airflow
│  └─ Initialize: airflow db init
│
├─ Step 1.2: Copy DAGs to Airflow
│  └─ Copy airflow/dags/*.py to AIRFLOW_HOME/dags/
│
├─ Step 1.3: Start Airflow
│  └─ Terminal 1: airflow webserver
│  └─ Terminal 2: airflow scheduler
│
├─ Step 1.4: Trigger DAGs
│  └─ Go to http://localhost:8080
│  └─ Enable & trigger "fetch_market_data" DAG
│  └─ Enable & trigger "preprocess_market_data" DAG
│
└─ Step 1.5: Verify Data
   └─ Check data/processed/ has CSV files
   └─ Check data/features/ has feature files
```

### **PHASE 2: Backend API (Week 1-2)**

```
GOAL: Serve data & predictions via REST API

├─ Step 2.1: Install FastAPI
│  └─ Run: pip install fastapi uvicorn
│
├─ Step 2.2: Start Backend
│  └─ Run: python backend/main.py
│  └─ API runs on http://localhost:8000
│
├─ Step 2.3: Test Endpoints
│  └─ Go to http://localhost:8000/docs
│  └─ Try /api/market-data endpoint
│  └─ Try /api/predictions endpoint
│
└─ Step 2.4: Connect to Frontend
   └─ Frontend makes HTTP requests to API
```

### **PHASE 3: Model Integration (Week 2)**

```
GOAL: Load RL model & generate real predictions

├─ Step 3.1: Load Model
│  └─ Load from checkpoints/ directory
│  └─ Use RLlib or your training framework
│
├─ Step 3.2: Create Model Service
│  └─ backend/model_service.py
│  └─ Load model, generate predictions
│
├─ Step 3.3: Update API
│  └─ Replace mock predictions with real model
│  └─ Add explanation/rationale
│
└─ Step 3.4: Test Predictions
   └─ Verify predictions make sense
   └─ Check confidence scores
```

### **PHASE 4: Frontend UI (Week 2-3)**

```
GOAL: Display data & predictions in user interface

├─ Step 4.1: Setup Frontend Project
│  └─ Use existing UI or create new React app
│  └─ npx create-next-app wealtharena-ui
│
├─ Step 4.2: Connect to Backend
│  └─ Use fetch() or axios to call API
│  └─ Display market data in charts
│
├─ Step 4.3: Add Components
│  ├─ Dashboard: Portfolio overview
│  ├─ Predictions: Model recommendations
│  ├─ Charts: Price & indicator charts
│  └─ Metrics: Performance stats
│
└─ Step 4.4: Style & Polish
   └─ Add CSS/Tailwind for modern UI
   └─ Make responsive for mobile
```

### **PHASE 5: Chatbot Integration (Week 3-4)**

```
GOAL: RAG chatbot explains model decisions

├─ Step 5.1: Setup Vector Database
│  └─ Install Chroma: pip install chromadb
│  └─ Create embeddings of financial docs
│
├─ Step 5.2: Add Model Context
│  └─ When model makes prediction:
│     ├─ Extract key features used
│     ├─ Get indicator values
│     └─ Send to chatbot as context
│
├─ Step 5.3: Implement RAG Pipeline
│  └─ User asks: "Why buy AAPL?"
│  └─ Retrieve: Model prediction context
│  └─ LLM generates: Explanation
│
└─ Step 5.4: Add Chat UI
   └─ Chat component in frontend
   └─ Connect to /api/chat endpoint
```

### **PHASE 6: Game Mode (Week 4-5)**

```
GOAL: Historical trading game

├─ Step 6.1: Create Game Engine
│  └─ backend/game_engine.py
│  └─ Load historical data
│  └─ Track user trades
│
├─ Step 6.2: Add Game Endpoints
│  ├─ /api/game/start → Start new game
│  ├─ /api/game/trade → Execute trade
│  ├─ /api/game/status → Get current state
│  └─ /api/game/leaderboard → Rankings
│
├─ Step 6.3: Game UI
│  ├─ Historical data replay
│  ├─ Trade interface
│  ├─ Performance comparison
│  └─ Leaderboard
│
└─ Step 6.4: Scoring System
   └─ Calculate returns, Sharpe ratio
   └─ Compare user vs RL agent
   └─ Update leaderboard
```

---

## 🔗 **COMPONENT CONNECTIONS**

### **Connection 1: Airflow → Data Storage**

```python
# In fetch_market_data_dag.py
downloader = DataDownloader(config)
all_data = downloader.download_all_data()
# Saves to: data/processed/*.csv
```

### **Connection 2: Data Storage → Backend API**

```python
# In backend/main.py
def load_symbol_data(symbol):
    df = pd.read_csv(f"data/features/{symbol}_features.csv")
    return df

@app.post("/api/market-data")
async def get_market_data(request):
    df = load_symbol_data(request.symbol)
    return df.to_dict('records')
```

### **Connection 3: Backend API → Frontend**

```javascript
// In frontend (React)
const fetchMarketData = async (symbol) => {
  const response = await fetch('http://localhost:8000/api/market-data', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({symbols: [symbol], days: 30})
  });
  const data = await response.json();
  return data;
};
```

### **Connection 4: Model → Chatbot Context**

```python
# In backend/main.py
@app.post("/api/predictions")
async def get_predictions(request):
    prediction = model.predict(data)
    
    # Extract context for chatbot
    context = {
        'signal': prediction['signal'],
        'features': prediction['top_features'],
        'indicators': {
            'rsi': data['RSI'][-1],
            'macd': data['MACD'][-1]
        }
    }
    
    # Store for chatbot
    chatbot_context[symbol] = context
    return prediction

@app.post("/api/chat")
async def chat(request):
    # Get context
    context = chatbot_context.get(request.context['symbol'])
    
    # Generate answer using context
    answer = rag_model.generate(
        query=request.message,
        context=context
    )
    return answer
```

---

## 🎬 **DEMO IMPLEMENTATION**

### **Quick Start (15 minutes)**

```bash
# 1. Install dependencies
pip install -r requirements_demo.txt

# 2. Start all services
./scripts/start_demo.sh  # Mac/Linux
scripts\start_demo.bat   # Windows

# 3. Open browser
# - Airflow: http://localhost:8080 (admin/admin)
# - API: http://localhost:8000/docs

# 4. Trigger DAGs in Airflow
# - Enable "fetch_market_data" → Click trigger
# - Wait 2-3 minutes for completion
# - Enable "preprocess_market_data" → Click trigger

# 5. Test API
curl http://localhost:8000/api/market-data \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL"], "days": 30}'

# 6. Check predictions
curl http://localhost:8000/api/predictions \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "horizon": 1}'
```

---

## 📚 **NEXT STEPS**

### **Immediate (This Week)**
1. ✅ Run `./scripts/start_demo.sh`
2. ✅ Trigger Airflow DAGs
3. ✅ Test API endpoints
4. ⏳ Connect your existing frontend to API
5. ⏳ Display one chart with real data

### **Short-term (Next 2 Weeks)**
1. ⏳ Replace mock predictions with real RL model
2. ⏳ Add database (SQLite is fine for demo)
3. ⏳ Create simple game mode UI
4. ⏳ Add basic chatbot (can use OpenAI API)

### **Medium-term (Next Month)**
1. ⏳ Implement full RAG chatbot with vector DB
2. ⏳ Add historical replay game engine
3. ⏳ Create leaderboard & user profiles
4. ⏳ Deploy to cloud (AWS/GCP/Azure)

### **Long-term (Next 2-3 Months)**
1. ⏳ Add more data sources
2. ⏳ Train better RL models
3. ⏳ Add more instruments (options, crypto)
4. ⏳ Build mobile app (PWA)
5. ⏳ Add user authentication & payments

---

## 🆘 **TROUBLESHOOTING**

### **Issue: Airflow won't start**
```bash
# Check if port 8080 is in use
netstat -an | grep 8080  # Mac/Linux
netstat -an | findstr 8080  # Windows

# Reset Airflow
airflow db reset
airflow db init
```

### **Issue: Backend API errors**
```bash
# Check logs
tail -f logs/backend.log

# Verify data exists
ls data/processed/
ls data/features/
```

### **Issue: No data in database**
```bash
# Manually trigger data fetch
cd wealtharena_rl
python download_market_data.py
```

---

## 📞 **GETTING HELP**

1. **Check logs first**: All services log to `logs/` directory
2. **API Documentation**: http://localhost:8000/docs
3. **Airflow UI**: http://localhost:8080
4. **Test endpoints**: Use Postman or curl

---

## ✅ **SUCCESS CRITERIA**

You'll know the demo is working when:

✅ Airflow DAGs run successfully  
✅ Data files appear in data/features/  
✅ API returns market data at /api/market-data  
✅ API returns predictions at /api/predictions  
✅ Frontend displays charts with real data  
✅ Chatbot responds to questions  
✅ Game mode loads historical data  

---

**🎉 You're ready to build WealthArena!**

Start with `./scripts/start_demo.sh` and follow the steps above.

