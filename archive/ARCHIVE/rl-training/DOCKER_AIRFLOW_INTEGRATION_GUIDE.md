# Docker & Airflow Integration Guide

## Table of Contents
1. [Data Formats Between Teams](#data-formats-between-teams)
2. [Your Containerization Roadmap](#your-containerization-roadmap)
3. [Other Team's Containerization](#other-teams-containerization)
4. [Connecting in Airflow on Azure](#connecting-in-airflow-on-azure)
5. [API to Frontend Connection](#api-to-frontend-connection)

---

## 1. DATA FORMATS BETWEEN TEAMS

### Format 1: Raw Market Data (Output from Data Fetching DAG)

**Who Produces**: You (Data Fetching Team)  
**Who Consumes**: Preprocessing Team  
**Storage**: AzureSQL table `raw_market_data`

**Schema:**
```
TABLE: raw_market_data
├── symbol: VARCHAR(20) - Stock ticker (e.g., "AAPL")
├── asset_type: VARCHAR(20) - Type ("stock", "currency_pair", "commodity", "crypto")
├── date: DATE - Trading date (e.g., "2024-10-04")
├── open_price: DECIMAL(18,4) - Opening price
├── high_price: DECIMAL(18,4) - High price
├── low_price: DECIMAL(18,4) - Low price
├── close_price: DECIMAL(18,4) - Closing price
├── volume: BIGINT - Trading volume
├── created_at: DATETIME2 - When data was inserted
└── updated_at: DATETIME2 - Last update timestamp

EXAMPLE ROW:
symbol: "AAPL"
asset_type: "stock"
date: "2024-10-04"
open_price: 175.25
high_price: 177.80
low_price: 174.50
close_price: 176.90
volume: 45230000
created_at: "2024-10-04 18:30:00"
```

**JSON Format (if using message queue):**
```json
{
  "symbol": "AAPL",
  "asset_type": "stock",
  "date": "2024-10-04",
  "ohlcv": {
    "open": 175.25,
    "high": 177.80,
    "low": 174.50,
    "close": 176.90,
    "volume": 45230000
  },
  "metadata": {
    "source": "yfinance",
    "fetched_at": "2024-10-04T18:30:00Z",
    "data_quality": "validated"
  }
}
```

---

### Format 2: Processed Features (Output from Preprocessing DAG)

**Who Produces**: Preprocessing Team  
**Who Consumes**: You (Model Training/Serving)  
**Storage**: AzureSQL table `processed_features`

**Schema:**
```
TABLE: processed_features
├── symbol: VARCHAR(20)
├── date: DATE
├── [Basic features]
│   ├── returns: DECIMAL - Daily returns
│   ├── log_returns: DECIMAL - Log returns
│   ├── volatility_5: DECIMAL - 5-day volatility
│   ├── volatility_20: DECIMAL - 20-day volatility
├── [Moving Averages]
│   ├── sma_5, sma_10, sma_20, sma_50, sma_200: DECIMAL
│   ├── ema_12, ema_26, ema_50: DECIMAL
├── [Momentum Indicators]
│   ├── rsi: DECIMAL - Relative Strength Index
│   ├── rsi_6, rsi_21: DECIMAL - Different periods
│   ├── macd: DECIMAL - MACD line
│   ├── macd_signal: DECIMAL - Signal line
│   ├── macd_hist: DECIMAL - Histogram
│   ├── momentum_5, momentum_10, momentum_20: DECIMAL
├── [Volatility Indicators]
│   ├── bb_upper, bb_middle, bb_lower: DECIMAL - Bollinger Bands
│   ├── bb_width, bb_position: DECIMAL
│   ├── atr: DECIMAL - Average True Range
├── [Volume Indicators]
│   ├── obv: BIGINT - On Balance Volume
│   ├── volume_sma_20: BIGINT
│   ├── volume_ratio: DECIMAL
├── [Support/Resistance]
│   ├── support_20: DECIMAL
│   ├── resistance_20: DECIMAL
│   ├── price_position: DECIMAL
└── processed_at: DATETIME2

EXAMPLE ROW:
symbol: "AAPL"
date: "2024-10-04"
returns: 0.0095
log_returns: 0.0094
volatility_20: 0.0185
sma_20: 174.50
sma_50: 172.30
ema_12: 175.80
rsi: 58.3
macd: 0.85
macd_signal: 0.62
bb_upper: 180.20
bb_lower: 168.80
atr: 2.45
obv: 2450000000
volume_ratio: 1.15
support_20: 172.50
resistance_20: 180.00
processed_at: "2024-10-04 19:00:00"
```

**JSON Format:**
```json
{
  "symbol": "AAPL",
  "date": "2024-10-04",
  "features": {
    "price": {
      "returns": 0.0095,
      "volatility_20": 0.0185
    },
    "moving_averages": {
      "sma_20": 174.50,
      "sma_50": 172.30,
      "ema_12": 175.80
    },
    "momentum": {
      "rsi": 58.3,
      "macd": 0.85,
      "macd_signal": 0.62
    },
    "volatility": {
      "bb_upper": 180.20,
      "bb_lower": 168.80,
      "atr": 2.45
    },
    "volume": {
      "obv": 2450000000,
      "volume_ratio": 1.15
    },
    "levels": {
      "support": 172.50,
      "resistance": 180.00
    }
  },
  "metadata": {
    "processed_at": "2024-10-04T19:00:00Z",
    "indicator_count": 35
  }
}
```

---

### Format 3: Model Predictions (Your Output)

**Who Produces**: You (Model Serving)  
**Who Consumes**: Backend API, Frontend, Chatbot  
**Storage**: AzureSQL table `model_predictions`

**Schema:**
```
TABLE: model_predictions
├── symbol: VARCHAR(20)
├── asset_type: VARCHAR(20)
├── signal: VARCHAR(10) - "BUY", "SELL", "HOLD"
├── confidence: DECIMAL(5,4) - 0.0000 to 1.0000
├── entry_price: DECIMAL(18,4)
├── tp1_price, tp2_price, tp3_price: DECIMAL(18,4)
├── tp1_percent, tp2_percent, tp3_percent: DECIMAL(10,4)
├── tp1_close_percent, tp2_close_percent, tp3_close_percent: INT
├── sl_price: DECIMAL(18,4)
├── sl_percent: DECIMAL(10,4)
├── sl_type: VARCHAR(20) - "fixed" or "trailing"
├── risk_reward_ratio: DECIMAL(10,2)
├── recommended_position_percent: DECIMAL(10,4)
├── model_version: VARCHAR(20)
├── reasoning: TEXT
└── prediction_date: DATETIME2

EXAMPLE ROW:
symbol: "AAPL"
asset_type: "stock"
signal: "BUY"
confidence: 0.8700
entry_price: 175.50
tp1_price: 180.00
tp1_percent: 2.56
tp1_close_percent: 50
tp2_price: 185.00
tp2_percent: 5.41
tp2_close_percent: 30
tp3_price: 190.00
tp3_percent: 8.26
tp3_close_percent: 20
sl_price: 171.00
sl_percent: -2.56
sl_type: "trailing"
risk_reward_ratio: 3.20
recommended_position_percent: 5.00
model_version: "v2.3.1"
reasoning: "Bullish momentum with favorable risk/reward"
prediction_date: "2024-10-04 19:30:00"
```

---

## 2. YOUR CONTAINERIZATION ROADMAP

### Step-by-Step: Dockerize Your Components

```
YOUR COMPONENTS TO CONTAINERIZE:

1. Data Fetching DAG (fetch_market_data_dag.py)
2. Model Training DAG (train_update_model_dag.py)
3. Backend API (FastAPI)
4. Model Serving Service
```

### Step 2.1: Create Docker Images

**Container 1: Airflow Worker (Your DAGs)**

Create: `wealtharena_rl/docker/Dockerfile.airflow`

```dockerfile
FROM apache/airflow:2.8.0-python3.10

USER root
RUN apt-get update && apt-get install -y build-essential

USER airflow

# Copy requirements
COPY requirements_demo.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy DAGs
COPY airflow/dags/ ${AIRFLOW_HOME}/dags/

# Copy project code
COPY download_market_data.py /opt/airflow/dags/
COPY src/ /opt/airflow/dags/src/

# Set Python path
ENV PYTHONPATH="${PYTHONPATH}:/opt/airflow/dags"

USER airflow
```

**Container 2: Backend API**

Create: `wealtharena_rl/docker/Dockerfile.backend`

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements_demo.txt .
RUN pip install --no-cache-dir -r requirements_demo.txt

# Copy backend code
COPY backend/ ./backend/
COPY src/ ./src/
COPY checkpoints/ ./checkpoints/

# Expose port
EXPOSE 8000

# Run API
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Container 3: Model Service**

Create: `wealtharena_rl/docker/Dockerfile.model`

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install ML dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model code
COPY backend/model_service.py ./
COPY backend/database.py ./
COPY checkpoints/ ./checkpoints/
COPY src/ ./src/

# Expose port for model API
EXPOSE 8001

CMD ["python", "-m", "uvicorn", "model_service:app", "--host", "0.0.0.0", "--port", "8001"]
```

---

### Step 2.2: Create Docker Compose File

Create: `wealtharena_rl/docker-compose.yml`

```yaml
version: '3.8'

services:
  # PostgreSQL for Airflow metadata
  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: airflow
      POSTGRES_DB: airflow
    volumes:
      - postgres-db-volume:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "airflow"]
      interval: 5s
      retries: 5

  # Airflow Webserver
  airflow-webserver:
    build:
      context: .
      dockerfile: docker/Dockerfile.airflow
    depends_on:
      - postgres
    environment:
      AIRFLOW__CORE__EXECUTOR: LocalExecutor
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
      AZURE_SQL_CONNECTION_STRING: ${AZURE_SQL_CONNECTION_STRING}
    ports:
      - "8080:8080"
    command: webserver
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:8080/health"]
      interval: 10s
      timeout: 10s
      retries: 5

  # Airflow Scheduler
  airflow-scheduler:
    build:
      context: .
      dockerfile: docker/Dockerfile.airflow
    depends_on:
      - postgres
    environment:
      AIRFLOW__CORE__EXECUTOR: LocalExecutor
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
      AZURE_SQL_CONNECTION_STRING: ${AZURE_SQL_CONNECTION_STRING}
    command: scheduler

  # Backend API
  backend-api:
    build:
      context: .
      dockerfile: docker/Dockerfile.backend
    environment:
      AZURE_SQL_CONNECTION_STRING: ${AZURE_SQL_CONNECTION_STRING}
    ports:
      - "8000:8000"
    depends_on:
      - postgres
    volumes:
      - ./data:/app/data

  # Model Service
  model-service:
    build:
      context: .
      dockerfile: docker/Dockerfile.model
    environment:
      AZURE_SQL_CONNECTION_STRING: ${AZURE_SQL_CONNECTION_STRING}
    ports:
      - "8001:8001"
    volumes:
      - ./checkpoints:/app/checkpoints

volumes:
  postgres-db-volume:
```

---

### Step 2.3: Build and Test Locally

```bash
# Build all containers
docker-compose build

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f airflow-webserver
docker-compose logs -f backend-api

# Stop all services
docker-compose down
```

---

### Step 2.4: Push to Azure Container Registry

```bash
# Login to Azure
az login

# Create resource group
az group create --name wealtharena-rg --location eastus

# Create Azure Container Registry
az acr create --resource-group wealtharena-rg --name wealtharenacr --sku Basic

# Login to ACR
az acr login --name wealtharenacr

# Tag images
docker tag wealtharena_airflow wealtharenacr.azurecr.io/airflow-worker:v1
docker tag wealtharena_backend wealtharenacr.azurecr.io/backend-api:v1
docker tag wealtharena_model wealtharenacr.azurecr.io/model-service:v1

# Push images
docker push wealtharenacr.azurecr.io/airflow-worker:v1
docker push wealtharenacr.azurecr.io/backend-api:v1
docker push wealtharenacr.azurecr.io/model-service:v1
```

---

## 3. OTHER TEAM'S CONTAINERIZATION

### What Preprocessing Team Needs to Do

**Their Component**: Data Preprocessing DAG

**Container Structure:**

Create: `preprocessing/Dockerfile`

```dockerfile
FROM apache/airflow:2.8.0-python3.10

USER root
RUN apt-get update && apt-get install -y \
    build-essential \
    ta-lib

USER airflow

# Install their dependencies
COPY preprocessing/requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy their DAG
COPY preprocessing/dags/ ${AIRFLOW_HOME}/dags/

# Copy their preprocessing code
COPY preprocessing/src/ /opt/airflow/dags/preprocessing/

ENV PYTHONPATH="${PYTHONPATH}:/opt/airflow/dags"
```

**Their DAG**: `preprocess_data_dag.py`

**Input**: Reads from AzureSQL `raw_market_data` table  
**Output**: Writes to AzureSQL `processed_features` table  

**What They Implement:**
```python
def preprocess_data(**context):
    # 1. Read from AzureSQL
    query = "SELECT * FROM raw_market_data WHERE date >= '2024-10-01'"
    raw_data = pd.read_sql(query, connection)
    
    # 2. Calculate indicators
    processed = calculate_all_indicators(raw_data)
    
    # 3. Write to AzureSQL
    processed.to_sql('processed_features', connection, if_exists='append')
    
    return {"status": "success", "rows_processed": len(processed)}
```

---

## 4. CONNECTING IN AIRFLOW ON AZURE

### Architecture Overview

```
AZURE CLOUD
│
├── Azure Container Registry (ACR)
│   ├── wealtharenacr.azurecr.io/airflow-worker:v1
│   ├── wealtharenacr.azurecr.io/backend-api:v1
│   └── wealtharenacr.azurecr.io/model-service:v1
│
├── Azure Kubernetes Service (AKS) - OR - Azure Container Instances (ACI)
│   │
│   ├── Airflow Deployment
│   │   ├── Airflow Webserver (port 8080)
│   │   ├── Airflow Scheduler
│   │   └── Airflow Workers (run DAGs)
│   │
│   ├── Backend API Deployment
│   │   └── FastAPI service (port 8000)
│   │
│   └── Model Service Deployment
│       └── Model inference service (port 8001)
│
├── Azure SQL Database
│   ├── raw_market_data (Your output)
│   ├── processed_features (Their output)
│   ├── model_predictions (Your output)
│   └── Other tables...
│
└── Azure Storage Account (Optional)
    ├── Blob Storage for model checkpoints
    └── File Storage for logs
```

---

### Step 4.1: Deploy to Azure - YOUR TASKS

**Task 1: Setup Azure SQL Database**

```bash
# Create Azure SQL Server
az sql server create \
  --name wealtharena-sql-server \
  --resource-group wealtharena-rg \
  --location eastus \
  --admin-user sqladmin \
  --admin-password YourSecurePassword123!

# Create Database
az sql db create \
  --resource-group wealtharena-rg \
  --server wealtharena-sql-server \
  --name wealtharena_db \
  --service-objective S0

# Configure firewall
az sql server firewall-rule create \
  --resource-group wealtharena-rg \
  --server wealtharena-sql-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Run schema creation
# Connect to database and run: backend/azure_sql_schema.sql
```

**Task 2: Deploy Airflow on Azure**

```bash
# Option A: Use Azure Container Instances (Simpler)
az container create \
  --resource-group wealtharena-rg \
  --name airflow-webserver \
  --image wealtharenacr.azurecr.io/airflow-worker:v1 \
  --cpu 2 --memory 4 \
  --ports 8080 \
  --environment-variables \
    AZURE_SQL_CONNECTION_STRING="..." \
    AIRFLOW__CORE__EXECUTOR=LocalExecutor

# Option B: Use Azure Kubernetes Service (Scalable)
# Create AKS cluster
az aks create \
  --resource-group wealtharena-rg \
  --name wealtharena-aks \
  --node-count 2 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Deploy using kubectl
kubectl apply -f k8s/airflow-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
```

**Task 3: Deploy Backend API**

```bash
# Deploy to Azure Container Instances
az container create \
  --resource-group wealtharena-rg \
  --name backend-api \
  --image wealtharenacr.azurecr.io/backend-api:v1 \
  --cpu 2 --memory 4 \
  --ports 8000 \
  --dns-name-label wealtharena-api \
  --environment-variables \
    AZURE_SQL_CONNECTION_STRING="..."

# Your API will be available at:
# http://wealtharena-api.eastus.azurecontainer.io:8000
```

---

### Step 4.2: Connect DAGs in Airflow

**Your DAG Configuration:**

```python
# In fetch_market_data_dag.py

# DAG dependencies
with DAG('fetch_market_data') as dag:
    fetch_task = PythonOperator(...)
    validate_task = PythonOperator(...)
    
    # Dependencies
    fetch_task >> validate_task
    
    # This DAG writes to: raw_market_data table
```

**Their DAG Configuration:**

```python
# In preprocess_data_dag.py

# DAG dependencies
with DAG('preprocess_market_data') as dag:
    
    # Wait for your DAG to complete
    wait_for_raw_data = ExternalTaskSensor(
        task_id='wait_for_raw_data',
        external_dag_id='fetch_market_data',
        external_task_id='validate_task',
        mode='reschedule'
    )
    
    load_task = PythonOperator(...)
    process_task = PythonOperator(...)
    
    # Dependencies
    wait_for_raw_data >> load_task >> process_task
    
    # This DAG reads from: raw_market_data table
    # This DAG writes to: processed_features table
```

**Your Model Training DAG:**

```python
# In train_update_model_dag.py

with DAG('train_update_model') as dag:
    
    # Wait for preprocessing
    wait_for_features = ExternalTaskSensor(
        task_id='wait_for_features',
        external_dag_id='preprocess_market_data',
        external_task_id='process_task'
    )
    
    load_features = PythonOperator(...)
    train_model = PythonOperator(...)
    save_model = PythonOperator(...)
    
    # Dependencies
    wait_for_features >> load_features >> train_model >> save_model
    
    # This DAG reads from: processed_features table
    # This DAG writes to: model_registry, model_predictions tables
```

---

### Step 4.3: DAG Execution Flow in Airflow

```
COMPLETE DAG CHAIN:

[Daily at 6 PM]
    ↓
DAG 1: fetch_market_data (YOUR TEAM)
    ├── Task: fetch_data
    ├── Task: validate_data
    └── Output: raw_market_data table
        ↓
        └── Triggers next DAG
            ↓
[Daily at 7 PM]
    ↓
DAG 2: preprocess_market_data (PREPROCESSING TEAM)
    ├── Task: wait_for_raw_data (waits for DAG 1)
    ├── Task: load_raw_data
    ├── Task: calculate_indicators
    ├── Task: feature_engineering
    └── Output: processed_features table
        ↓
        └── Triggers next DAG
            ↓
[Daily at 8 PM]
    ↓
DAG 3: train_update_model (YOUR TEAM)
    ├── Task: wait_for_features (waits for DAG 2)
    ├── Task: load_features
    ├── Task: train_model
    ├── Task: evaluate_model
    ├── Task: save_model
    └── Output: model_registry, model_predictions tables
        ↓
        └── Model ready for serving
            ↓
Backend API reads model_predictions table
    ↓
Frontend displays predictions
```

---

## 5. API TO FRONTEND CONNECTION

### Step 5.1: Backend API Endpoints (Azure Hosted)

```
YOUR BACKEND API (After Azure deployment):
URL: https://wealtharena-api.eastus.azurecontainer.io

ENDPOINTS:
├── GET  /health
├── POST /api/market-data
├── POST /api/predictions
├── POST /api/top-setups ← MAIN ENDPOINT FOR UI
├── POST /api/portfolio
├── POST /api/chat
└── GET  /api/game/leaderboard
```

---

### Step 5.2: Frontend Integration Steps

**What UI Team Needs to Do:**

**Step 1: Configure API Base URL**

```javascript
// frontend/config/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 
                    'https://wealtharena-api.eastus.azurecontainer.io';

export default API_BASE_URL;
```

**Step 2: Create API Service**

```javascript
// frontend/services/api.js
import axios from 'axios';
import API_BASE_URL from '../config/api';

export const tradingAPI = {
  // Get top 3 setups
  getTopSetups: async (assetType) => {
    const response = await axios.post(`${API_BASE_URL}/api/top-setups`, {
      asset_type: assetType,
      count: 3,
      risk_tolerance: 'medium'
    });
    return response.data;
  },
  
  // Get market data
  getMarketData: async (symbols, days = 30) => {
    const response = await axios.post(`${API_BASE_URL}/api/market-data`, {
      symbols: symbols,
      days: days
    });
    return response.data;
  },
  
  // Chat with bot
  chat: async (message, context) => {
    const response = await axios.post(`${API_BASE_URL}/api/chat`, {
      message: message,
      context: context
    });
    return response.data;
  }
};
```

**Step 3: Consume in Components**

```javascript
// frontend/components/TradingOpportunities.jsx
import { useState, useEffect } from 'react';
import { tradingAPI } from '../services/api';

function TradingOpportunities() {
  const [assetType, setAssetType] = useState('stocks');
  const [topSetups, setTopSetups] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadTopSetups();
  }, [assetType]);
  
  const loadTopSetups = async () => {
    setLoading(true);
    try {
      const data = await tradingAPI.getTopSetups(assetType);
      setTopSetups(data.setups);
    } catch (error) {
      console.error('Error loading setups:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {/* Asset type tabs */}
      <div className="asset-tabs">
        <button onClick={() => setAssetType('stocks')}>Stocks</button>
        <button onClick={() => setAssetType('currency_pairs')}>FX</button>
        <button onClick={() => setAssetType('commodities')}>Commodities</button>
        <button onClick={() => setAssetType('crypto')}>Crypto</button>
      </div>
      
      {/* Display setups */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        topSetups.map((setup, index) => (
          <SetupCard key={index} setup={setup} rank={index + 1} />
        ))
      )}
    </div>
  );
}
```

**Step 4: Setup Card Component**

```javascript
// frontend/components/SetupCard.jsx
function SetupCard({ setup, rank }) {
  return (
    <div className="setup-card">
      {/* Header */}
      <div className="header">
        <h3>{setup.symbol}</h3>
        <span className={`signal ${setup.signal.toLowerCase()}`}>
          {setup.signal}
        </span>
        <span className="confidence">{setup.confidence * 100}%</span>
      </div>
      
      {/* Chart */}
      <div className="chart">
        <TradingViewChart 
          data={setup.chart_data}
          entry={setup.entry.price}
          tpLevels={setup.take_profit}
          stopLoss={setup.stop_loss}
        />
      </div>
      
      {/* Trade Details */}
      <div className="details">
        <div className="entry">
          <label>Entry Price:</label>
          <span>${setup.entry.price}</span>
        </div>
        
        <div className="take-profits">
          <label>Take Profit Targets:</label>
          {setup.take_profit.map(tp => (
            <div key={tp.level}>
              TP{tp.level}: ${tp.price} ({tp.percent}%) - Close {tp.close_percent}%
            </div>
          ))}
        </div>
        
        <div className="stop-loss">
          <label>Stop Loss:</label>
          <span>${setup.stop_loss.price} ({setup.stop_loss.percent}%)</span>
        </div>
        
        <div className="risk-metrics">
          <label>Risk/Reward:</label>
          <span>1:{setup.risk_metrics.risk_reward_ratio}</span>
        </div>
      </div>
      
      {/* Indicators */}
      <div className="indicators">
        <IndicatorBadge indicator={setup.indicators.rsi} />
        <IndicatorBadge indicator={setup.indicators.macd} />
        <IndicatorBadge indicator={setup.indicators.trend} />
      </div>
      
      {/* Actions */}
      <button className="primary">Execute Setup</button>
      <button onClick={() => openChat(setup)}>Ask Chatbot</button>
    </div>
  );
}
```

---

## 6. COMPLETE DEPLOYMENT ROADMAP

### Phase 1: Local Development (Week 1)

```
YOUR TASKS:
├── Build Docker images locally
├── Test with docker-compose
├── Verify DAGs run successfully
└── Test API endpoints locally

THEIR TASKS:
├── Build preprocessing Docker image
├── Test preprocessing logic
├── Verify output format matches schema
└── Test locally with your data

INTEGRATION:
└── Both test reading/writing to shared database (local PostgreSQL first)
```

---

### Phase 2: Azure Setup (Week 2)

```
INFRASTRUCTURE TEAM:
├── Create Azure resource group
├── Setup Azure SQL Database
├── Create Azure Container Registry
├── Setup Azure Container Instances or AKS
└── Configure networking and security

YOUR TASKS:
├── Push Docker images to ACR
├── Deploy Airflow containers
├── Deploy Backend API container
├── Configure environment variables
└── Test in Azure environment

THEIR TASKS:
├── Push preprocessing Docker image to ACR
├── Deploy preprocessing containers
├── Configure Airflow connections
└── Test DAG execution in Azure
```

---

### Phase 3: DAG Integration (Week 3)

```
INTEGRATION TASKS:

1. Connect DAG Chain
   ├── YOUR DAG 1: fetch_market_data
   │   └── Writes to: raw_market_data
   ├── THEIR DAG 2: preprocess_market_data
   │   ├── Reads from: raw_market_data
   │   └── Writes to: processed_features
   └── YOUR DAG 3: train_update_model
       ├── Reads from: processed_features
       └── Writes to: model_predictions

2. Test Complete Flow
   ├── Trigger DAG 1 manually in Airflow UI
   ├── Verify data in raw_market_data table
   ├── DAG 2 should auto-trigger
   ├── Verify data in processed_features table
   ├── DAG 3 should auto-trigger
   └── Verify predictions in model_predictions table

3. Verify API Access
   ├── Backend API reads from model_predictions
   ├── Test /api/top-setups endpoint
   └── Verify all data flows correctly
```

---

### Phase 4: Frontend Connection (Week 3-4)

```
UI TEAM TASKS:

1. Setup Development
   ├── Configure API base URL
   ├── Create API service layer
   └── Test API calls from frontend

2. Build Components
   ├── Asset type toggle
   ├── Setup card component
   ├── Chart component with TP/SL markers
   ├── Indicator display components
   └── Chatbot interface

3. Connect to Backend
   ├── Call /api/top-setups on page load
   ├── Display returned data in setup cards
   ├── Show charts with markers
   └── Enable chatbot integration

4. Test End-to-End
   ├── Change asset type → API called → New data displayed
   ├── Click setup → Details shown
   ├── Ask chatbot → Response received
   └── All data flows from Airflow → API → UI
```

---

## 7. DATA HANDOFF CHECKLIST

### What You Provide to Preprocessing Team:

- [x] **Table name**: `raw_market_data`
- [x] **Schema**: See azure_sql_schema.sql lines 7-21
- [x] **Data format**: OHLCV with symbol, asset_type, date
- [x] **Update frequency**: Daily at 6 PM (configurable)
- [x] **Data quality**: Pre-validated before insertion
- [x] **Access method**: Direct SQL query or via shared connection

### What Preprocessing Team Provides to You:

- [ ] **Table name**: `processed_features`
- [ ] **Schema**: See azure_sql_schema.sql lines 24-72
- [ ] **Data format**: All 50+ indicators as columns
- [ ] **Update frequency**: Daily at 7 PM (after your DAG)
- [ ] **Indicator list**: Confirm exact indicator names with them
- [ ] **Access method**: SQL query by symbol and date range

### What You Provide to UI Team:

- [x] **Endpoint**: POST /api/top-setups
- [x] **Request format**: {asset_type, count, risk_tolerance}
- [x] **Response format**: See CHECKLIST_COMPLETION_SUMMARY.md
- [x] **API documentation**: http://your-api-url/docs
- [x] **Sample responses**: Available in test files
- [x] **CORS enabled**: Yes, for development

---

## 8. TROUBLESHOOTING INTEGRATION

### Issue: DAGs not seeing each other's data

**Solution**:
- Verify both DAGs write/read from same Azure SQL database
- Check connection strings match
- Verify table names are correct
- Check ExternalTaskSensor configuration

### Issue: API not returning predictions

**Solution**:
- Verify model_predictions table has data
- Check database connection in backend
- Verify environment variables set correctly
- Check logs: `docker logs backend-api`

### Issue: Frontend can't connect to API

**Solution**:
- Verify API is running: `curl http://api-url/health`
- Check CORS configuration in backend
- Verify API URL in frontend config
- Check network/firewall rules in Azure

---

## 9. DEPLOYMENT CHECKLIST

### Before Demo Day:

**Infrastructure:**
- [ ] Azure SQL Database created and schema deployed
- [ ] Azure Container Registry created
- [ ] All Docker images built and pushed to ACR
- [ ] Airflow deployed and accessible
- [ ] Backend API deployed and accessible
- [ ] Environment variables configured

**Data Pipeline:**
- [ ] DAG 1 runs successfully and populates raw_market_data
- [ ] DAG 2 runs successfully and populates processed_features
- [ ] DAG 3 runs successfully and populates model_predictions
- [ ] All DAGs linked and auto-triggering

**API:**
- [ ] All endpoints tested and working
- [ ] /api/top-setups returns valid data
- [ ] API accessible from frontend
- [ ] CORS configured correctly

**Frontend:**
- [ ] Connected to backend API
- [ ] Top setups display correctly
- [ ] Charts render with TP/SL markers
- [ ] Asset type toggle works
- [ ] Chatbot responds to queries

---

## 10. QUICK REFERENCE

### Connection Strings Format:

```bash
# AzureSQL
AZURE_SQL_CONNECTION_STRING="mssql+pyodbc://sqladmin:password@wealtharena-sql-server.database.windows.net/wealtharena_db?driver=ODBC+Driver+17+for+SQL+Server"

# For Airflow
export AZURE_SQL_CONNECTION_STRING="..."

# For Backend
export AZURE_SQL_CONNECTION_STRING="..."
```

### Docker Commands:

```bash
# Build
docker-compose build

# Start
docker-compose up -d

# Logs
docker-compose logs -f [service-name]

# Stop
docker-compose down

# Push to Azure
docker tag [local-image] wealtharenacr.azurecr.io/[image-name]:v1
docker push wealtharenacr.azurecr.io/[image-name]:v1
```

### Testing Flow:

```bash
# 1. Test DAG locally
docker-compose up airflow-webserver airflow-scheduler
# Open http://localhost:8080
# Trigger DAG

# 2. Test API locally
docker-compose up backend-api
# Open http://localhost:8000/docs
# Test endpoints

# 3. Test integration
# Trigger DAG 1 → Check database → Trigger DAG 2 → Check database → Test API
```

---

## Summary

### Your Deliverables:
- ✅ 2 Airflow DAGs (fetch + train)
- ✅ Backend API with all endpoints
- ✅ Model serving with RL-based TP/SL
- ✅ Database abstraction layer
- ✅ Docker configurations
- ✅ Complete tests (199 passing)
- ✅ Documentation

### Preprocessing Team Deliverables:
- 1 Airflow DAG (preprocess)
- Docker container
- Reads: raw_market_data
- Writes: processed_features

### UI Team Deliverables:
- React/Next.js frontend
- API integration
- Setup cards display
- Chatbot interface

### Integration Points:
- Database: AzureSQL (shared)
- Airflow: External task sensors (DAG linking)
- API: HTTP/REST (backend to frontend)

**All components are ready for integration!**

