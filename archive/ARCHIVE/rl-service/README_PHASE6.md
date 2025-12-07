# Phase 6: RL Inference Service Setup & Integration

## Overview
This phase sets up the WealthArena RL inference service to run locally without Docker, integrating the production-ready `RLModelService` class for sophisticated trading signal generation. The service provides REST API endpoints for predictions, top setups, and portfolio analysis, using mock predictions until models are trained in Phase 7.

## Prerequisites
- ✅ Phase 1 completed: Azure SQL Database with schema
- ✅ Phase 2 completed: Market data loaded into `processed_prices` table
- ✅ Phase 4 completed: Backend API running on port 3000
- ✅ Python 3.8+ installed
- ✅ ODBC Driver 18 for SQL Server installed

## Architecture

```
RL Inference Service (Port 5002)
├── Flask 3.0.0 (Web Framework)
├── RLModelService (Multi-Agent Architecture)
│   ├── Trading Agent (Signal Generation)
│   ├── Risk Management Agent (TP/SL Calculation)
│   └── Portfolio Manager Agent (Position Sizing)
├── Azure SQL Database Integration
│   └── Query processed_prices for features
└── 6 API Endpoints
    ├── GET /health
    ├── GET /model/info
    ├── POST /predict
    ├── POST /api/top-setups (NEW)
    ├── POST /api/portfolio (NEW)
    └── POST /api/market-data (NEW)
```

## Step-by-Step Setup

### Step 1: Install Python Dependencies

**Navigate to RL service directory:**
```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/services/rl-service"
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Expected Output:**
```
Collecting Flask==3.0.0
Collecting gunicorn==21.2.0
Collecting flask-cors==4.0.0
Collecting numpy==1.24.0
Collecting pandas==2.1.0
Collecting scikit-learn==1.3.0
Collecting ray[rllib]==2.9.0
Collecting torch==2.1.0
Collecting requests==2.31.0
Collecting pyodbc==4.0.39
Collecting python-dotenv==1.0.0
...
Successfully installed 12 packages
```

**Verification:**
```bash
pip list | grep -E "Flask|pandas|ray|torch|pyodbc"
```

Should show:
```
Flask                 3.0.0
pandas                2.1.0
pyodbc                4.0.39
ray                   2.9.0
torch                 2.1.0
```

**Estimated Duration:** 3-5 minutes (Ray and PyTorch are large packages)

---

### Step 2: Create Environment Configuration

**File:** `services/rl-service/.env`

**Create .env file with configuration:**
```bash
# Application Configuration
PORT=5002
HOST=0.0.0.0

# Model Configuration
MODEL_PATH=../../wealtharena_rl/checkpoints/latest
MODEL_MODE=mock

# Azure SQL Database (for market data queries)
DB_HOST=sql-wealtharena-dev.database.windows.net
DB_NAME=wealtharena_db
DB_USER=wealtharena_admin
DB_PASSWORD=WealthArena2024!@#$%
DB_PORT=1433
DB_ENCRYPT=true

# Service Configuration
LOG_LEVEL=INFO
WORKERS=2
TIMEOUT=120
```

**Verification:**
```bash
cat .env | grep PORT
# Should show: PORT=5002
```

---

### Step 3: Create Database Connection Module

**File:** `services/rl-service/api/db_connector.py`

This module provides database connectivity to query Azure SQL `processed_prices` table for market data features.

**Key Functions:**
1. `get_connection()` - Create pyodbc connection to Azure SQL
2. `get_market_data(symbol, days)` - Query market data with technical indicators
3. `get_symbols_by_asset_type(asset_type, limit)` - Get symbol list for asset class
4. `close_connection(conn)` - Safely close connection

**Reference:** Reuse connection logic from `Financial_Assets_Pipeline/dbConnection.py` (get_conn function).

---

### Step 4: Enhance Inference Server

**File:** `services/rl-service/api/inference_server.py`

**Enhancements Required:**

**A. Add Imports (after line 24):**
- Import `RLModelService` and `get_model_service` from `wealtharena_rl.backend.model_service`
- Import database functions from `db_connector`
- Add path manipulation to import from parent directories

**B. Initialize Model Service (replace lines 38-39):**
- Replace global `model_manager` with `model_service = get_model_service()`
- Initialize with model_dir from environment: `Path(os.getenv('MODEL_PATH'))`

**C. Enhance /predict Endpoint (lines 110-166):**
- Query market data from Azure SQL using `get_market_data(symbol, days=60)`
- Call `model_service.generate_prediction(symbol, data_df, asset_type)`
- Return comprehensive prediction with entry, TP/SL, risk metrics, position sizing, indicators, chart data
- Remove simple `generate_mock_prediction()` function (lines 168-222)

**D. Add /api/top-setups Endpoint (NEW):**
- Request: `{"asset_type": "stocks", "count": 3, "risk_tolerance": "medium"}`
- Query top 100 symbols for asset_type from database
- Fetch market data for each symbol
- Call `model_service.generate_top_setups(asset_type, data_dict, count)`
- Return ranked setups with composite scores

**E. Add /api/portfolio Endpoint (NEW):**
- Request: `{"symbols": [...], "weights": [...]}`
- Validate symbols and weights arrays have equal length
- Fetch market data for each symbol
- Generate individual predictions
- Calculate portfolio-level metrics (weighted confidence, combined risk/reward)
- Return portfolio analysis with recommendations

**F. Add /api/market-data Endpoint (NEW):**
- Request: `{"symbols": [...], "days": 30}`
- Query database for each symbol
- Return OHLCV + technical indicators as JSON

**G. Update Initialization (lines 225-230):**
- Replace deprecated `@app.before_first_request` with initialization in `if __name__ == '__main__'` block
- Initialize model service and database connection before starting Flask app

---

### Step 5: Update Backend Proxy Configuration

**File:** `WealthArena_Backend/.env`

**Add RL service URL:**
```bash
RL_API_URL=http://localhost:5002
```

**Restart backend server:**
```bash
cd WealthArena_Backend
npm run dev
```

---

### Step 6: Start RL Inference Service

**Method 1: Using Batch File (Recommended)**
```bash
cd services/rl-service
run_rl_service.bat
```

**Method 2: Direct Python Execution**
```bash
cd services/rl-service/api
python inference_server.py
```

**Method 3: Using Gunicorn (Production Mode)**
```bash
cd services/rl-service
gunicorn --bind 0.0.0.0:5002 --workers 2 --timeout 120 api.inference_server:app
```

**Expected Output:**
```
INFO:__main__:Initializing RL inference server...
INFO:model_service:Initializing Model Service with model_dir: ../../wealtharena_rl/checkpoints/latest
WARNING:model_service:Model directory not found: ../../wealtharena_rl/checkpoints/latest
INFO:model_service:Operating in mock mode until models are trained
INFO:__main__:RL inference server initialized
INFO:__main__:Starting RL inference server on 0.0.0.0:5002
 * Serving Flask app 'inference_server'
 * Debug mode: off
WARNING: This is a development server. Do not use it in a production deployment.
 * Running on http://0.0.0.0:5002
Press CTRL+C to quit
```

**Service is now running!** ✅

---

### Step 7: Test RL Service Endpoints

**Test 1: Health Check**
```bash
curl http://localhost:5002/health
```

**Expected:** `{"status": "healthy", "model_loaded": true}`

**Test 2: Model Info**
```bash
curl http://localhost:5002/model/info
```

**Expected:** Model metadata with path and type

**Test 3: Prediction**
```bash
curl -X POST http://localhost:5002/predict \
  -H "Content-Type: application/json" \
  -d '{"market_state": [[0.1, 0.2]], "symbol": "BHP.AX", "asset_type": "stock"}'
```

**Expected:** Comprehensive prediction with TP/SL levels

**Test 4: Top Setups**
```bash
curl -X POST http://localhost:5002/api/top-setups \
  -H "Content-Type: application/json" \
  -d '{"asset_type": "stocks", "count": 3}'
```

**Expected:** Ranked list of top 3 trading setups

---

### Step 8: Test Backend Proxy Integration

**Ensure both services are running:**
1. Backend: `http://localhost:3000` (npm run dev)
2. RL Service: `http://localhost:5002` (python api/inference_server.py)

**Test proxy health check:**
```bash
curl http://localhost:3000/api/rl-agent/health
```

**Expected Response:**
```json
{
  "success": true,
  "status": "healthy",
  "rl_api": {
    "status": "healthy",
    "model_loaded": true
  }
}
```

**Test proxy predictions:**
```bash
curl -X POST http://localhost:3000/api/rl-agent/predictions \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BHP.AX", "horizon": 1}'
```

**Expected:** Backend forwards to RL service and returns wrapped response

---

## Troubleshooting

### Issue: Port 5002 already in use
**Solution:**
```bash
# Find process using port 5002
netstat -ano | findstr :5002

# Kill process or change port in .env
PORT=5003
```
Also update `RL_API_URL` in backend `.env`.

### Issue: Database connection failed
**Solution:**
- Verify credentials in `.env` match Phase 1 setup
- Check Azure SQL firewall rules (add your IP)
- Test connection: `python -c "from api.db_connector import get_connection; conn = get_connection(); print('✅ Connected')"`

### Issue: Import error - "No module named 'model_service'"
**Solution:**
- Verify path manipulation in inference_server.py adds wealtharena_rl to sys.path
- Check that `wealtharena_rl/backend/model_service.py` exists

### Issue: Ray initialization fails
**Solution:**
This is acceptable - service operates in mock mode without Ray. Ray is only needed for actual model inference in Phase 7.

### Issue: Backend proxy connection refused
**Solution:**
```bash
# Verify RL service is running
curl http://localhost:5002/health

# If fails, start RL service
cd services/rl-service
python api/inference_server.py
```

---

## API Endpoints Summary

### Direct Endpoints (Port 5002)
- `GET /health` - Health check
- `GET /model/info` - Model metadata
- `POST /predict` - Generate signal for symbol
- `POST /api/top-setups` - Get top N trading setups
- `POST /api/portfolio` - Analyze portfolio
- `POST /api/market-data` - Get market data for symbols

### Backend Proxy Endpoints (Port 3000)
- `GET /api/rl-agent/health` - Health check via proxy
- `POST /api/rl-agent/predictions` - Predictions via proxy
- `POST /api/rl-agent/top-setups` - Top setups via proxy
- `POST /api/rl-agent/portfolio` - Portfolio analysis via proxy
- `POST /api/rl-agent/market-data` - Market data via proxy

---

## Mock Mode vs Production Mode

### Mock Mode (Current - Phase 6)
- Uses heuristics from `RLModelService._get_trading_signal()` method
- Signal generation based on RSI, MACD, momentum, volume
- TP/SL calculation using ATR-based risk management
- Position sizing using Kelly Criterion
- No actual RL model loaded
- Suitable for frontend integration and testing

### Production Mode (After Phase 7)
- Loads trained RL models from `wealtharena_rl/checkpoints/latest/`
- Uses Ray RLlib PPO algorithm for policy inference
- Model predicts actions based on learned policy
- 70%+ win rate target
- Requires model training completion

**Switching to Production Mode:**
1. Complete Phase 7 (RL model training)
2. Copy best checkpoint to `wealtharena_rl/checkpoints/latest/`
3. Update `.env`: `MODEL_MODE=production`
4. Restart RL service
5. Service automatically loads trained models

---

## Integration with Frontend

### Signals Page Integration

**Endpoint:** `GET /api/rl-agent/top-setups` (via backend proxy)

**Frontend code example (React Native):**
```typescript
// In WealthArena/app/trade-signals.tsx
const fetchTopSignals = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/rl-agent/top-setups', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        asset_type: 'stocks',
        count: 5,
        risk_tolerance: 'medium'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      setSignals(data.data.setups);
    }
  } catch (error) {
    console.error('Failed to fetch signals:', error);
  }
};
```

### Portfolio Builder Integration

**Endpoint:** `POST /api/rl-agent/portfolio` (via backend proxy)

**Frontend code example:**
```typescript
// In WealthArena/app/portfolio-builder.tsx
const analyzePortfolio = async (symbols: string[], weights: number[]) => {
  try {
    const response = await fetch('http://localhost:3000/api/rl-agent/portfolio', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ symbols, weights })
    });
    
    const data = await response.json();
    if (data.success) {
      setPortfolioAnalysis(data.data.portfolio_analysis);
      setIndividualSignals(data.data.individual_signals);
    }
  } catch (error) {
    console.error('Failed to analyze portfolio:', error);
  }
};
```

---

## Next Steps

After completing Phase 6:
1. ✅ Verify RL service runs on port 5002
2. ✅ Test all endpoints return expected responses
3. ✅ Verify backend proxy can reach RL service
4. ✅ Test signal generation with real market data from Azure SQL
5. ➡️ Proceed to Phase 7: RL Model Training (to replace mock predictions)
6. ➡️ Proceed to Phase 8: Frontend Integration (connect signals page to /api/rl-agent/top-setups)

## Success Criteria

✅ **Service Running:**
- RL service starts on port 5002 without errors
- Health check returns 200 OK
- Model service initializes successfully
- Database connection established

✅ **Prediction Functionality:**
- /predict returns comprehensive signals with TP/SL
- Signals include risk metrics and position sizing
- Technical indicators included in response
- Chart data prepared for frontend

✅ **Top Setups:**
- /api/top-setups returns ranked signals
- Ranking algorithm works correctly
- Only BUY/SELL signals included (no HOLD)
- Proper filtering by asset type

✅ **Portfolio Analysis:**
- /api/portfolio analyzes multiple symbols
- Weighted metrics calculated correctly
- Recommendations generated

✅ **Backend Integration:**
- Backend proxy connects to RL service on port 5002
- All proxy endpoints return wrapped responses
- Health check through proxy works
- Error handling works correctly

✅ **Database Integration:**
- Service queries Azure SQL successfully
- Market data retrieved with technical indicators
- Symbols filtered by asset type correctly

**Phase 6 Status:** ✅ Ready for Frontend Integration

**Estimated Setup Time:** 15-20 minutes

