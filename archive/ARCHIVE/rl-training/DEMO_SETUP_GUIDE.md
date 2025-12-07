# 🚀 WealthArena Demo Setup Guide

## 📋 Prerequisites

### 1. Install Required Software
```bash
# Python 3.10+
python --version

# Docker (for Airflow)
docker --version

# Node.js 18+ (for frontend)
node --version
```

### 2. Install Python Dependencies
```bash
cd wealtharena_rl
pip install -r requirements_demo.txt
```

---

## 🔄 STEP 1: Setup Airflow (Data Pipeline)

### 1.1 Install Airflow
```bash
# Create airflow directory
mkdir -p airflow
cd airflow

# Set Airflow home
export AIRFLOW_HOME=$(pwd)

# Install Airflow
pip install apache-airflow==2.8.0
pip install apache-airflow-providers-postgres

# Initialize database
airflow db init

# Create admin user
airflow users create \
    --username admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@example.com \
    --password admin
```

### 1.2 Start Airflow
```bash
# Terminal 1: Start webserver
airflow webserver --port 8080

# Terminal 2: Start scheduler
airflow scheduler
```

### 1.3 Access Airflow UI
- URL: http://localhost:8080
- Username: admin
- Password: admin

---

## 🗄️ STEP 2: Setup Database

### 2.1 Install PostgreSQL (or use SQLite for demo)

**Option A: PostgreSQL**
```bash
# Install PostgreSQL
# Mac: brew install postgresql
# Ubuntu: sudo apt-get install postgresql
# Windows: Download from postgresql.org

# Create database
createdb wealtharena
```

**Option B: SQLite (Simpler for demo)**
```python
# Will use SQLite by default in demo
# Database file: data/wealtharena.db
```

---

## 🤖 STEP 3: Setup Model Serving

### 3.1 Load Pre-trained Model (or use mock for demo)
```bash
# Models are in checkpoints/ directory
# We'll create a simple API to serve predictions
```

---

## 🔌 STEP 4: Setup Backend API

### 4.1 Install FastAPI
```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary
```

### 4.2 Run Backend
```bash
cd wealtharena_rl
python backend/main.py

# API will run on http://localhost:8000
# Docs at http://localhost:8000/docs
```

---

## 🎨 STEP 5: Setup Frontend

### 5.1 Install Dependencies
```bash
cd frontend
npm install
```

### 5.2 Run Frontend
```bash
npm run dev

# Frontend will run on http://localhost:3000
```

---

## 🤖 STEP 6: Setup Chatbot (Optional)

### 6.1 Install RAG Dependencies
```bash
pip install langchain chromadb openai
```

### 6.2 Set OpenAI API Key (or use local model)
```bash
export OPENAI_API_KEY="your-key-here"
```

---

## 🎮 STEP 7: Run Complete Demo

### Quick Start Script
```bash
# Run all services
./scripts/start_demo.sh
```

---

## 📊 Demo Flow

1. **Data Collection** (Airflow DAG runs)
   → Fetches AAPL, GOOGL, MSFT data from yfinance
   
2. **Preprocessing** (Airflow DAG runs)
   → Calculates 50+ technical indicators
   
3. **Model Predictions** (Backend API)
   → Generates buy/sell/hold recommendations
   
4. **Display on UI** (Frontend)
   → Shows portfolio, charts, recommendations
   
5. **Chatbot Explains** (RAG)
   → "Why did the model suggest buying AAPL?"
   
6. **Game Mode** (Historical replay)
   → User tries to beat the model's performance

---

## 🔧 Troubleshooting

### Airflow not starting
```bash
# Check if port 8080 is available
lsof -i :8080

# Reset Airflow DB
airflow db reset
```

### Backend API errors
```bash
# Check logs
tail -f logs/backend.log
```

### Frontend connection issues
```bash
# Check if backend is running
curl http://localhost:8000/health
```

---

## 📚 Next Steps

After demo works:
1. Add more data sources
2. Train better models
3. Add more game modes
4. Deploy to cloud
5. Add user authentication


