# Data Flow Explanation: CSV Data vs Mock Data

## 🔍 Quick Answer

**YES, the system uses REAL CSV data, NOT mock data!**

The "mock database" mode just means data is stored in a JSON file instead of a database. The data itself comes from **real CSV files** downloaded from market data sources (yfinance, etc.).

---

## 📊 Complete Data Flow

### 1. **Data Download (Phase 3.5)**
```
Data-Pipeline Scripts (run_all_downloaders.py)
    ↓
Downloads REAL market data via yfinance/APIs
    ↓
Saves to CSV files:
  - stockDataRaw&Processed/*.csv
  - cryptoData/*.csv
  - forexData/*.csv
  - commoditiesData/*.csv
```

### 2. **Backend Data Loading (Automatic on Startup)**

**When `USE_MOCK_DB=true` (Current Setup):**
```
Backend Startup
    ↓
dataPipelineService.updateDatabaseFromRawFiles()
    ↓
Reads CSV files from folders above
    ↓
Parses and processes CSV data
    ↓
Stores in: backend/data/local-market-data.json
    (This is REAL data from CSV files!)
```

**When `USE_MOCK_DB=false` (Production):**
```
Backend Startup
    ↓
dataPipelineService.updateDatabaseFromRawFiles()
    ↓
Reads CSV files from folders
    ↓
Parses and processes CSV data
    ↓
Stores in: Azure SQL / PostgreSQL Database
```

### 3. **Frontend Data Fetching**

```
Frontend App
    ↓
Calls: GET /api/market-data/history/:symbol
    ↓
Backend API Route (market-data.ts)
    ↓
dataPipelineService.getMarketData()
    ↓
Returns data from:
  - local-market-data.json (mock mode) OR
  - Database (production mode)
    ↓
Frontend displays REAL data from CSV files
```

---

## 🔄 Data Storage Comparison

### Mock Database Mode (`USE_MOCK_DB=true`)
- **Storage**: `backend/data/local-market-data.json`
- **Data Source**: Real CSV files from data-pipeline
- **Format**: JSON file with all market data
- **Data Quality**: ✅ **REAL data** from market sources
- **Use Case**: Local development, faster testing

### Real Database Mode (`USE_MOCK_DB=false`)
- **Storage**: Azure SQL / PostgreSQL database
- **Data Source**: Same CSV files from data-pipeline
- **Format**: Database tables (CandleData, MarketData, etc.)
- **Data Quality**: ✅ **REAL data** from market sources
- **Use Case**: Production deployment

---

## ✅ Verification: Your System is Using Real CSV Data

### Evidence:

1. **CSV Files Exist** (from Phase 3.5):
   - Files in `stockDataRaw&Processed/`, `cryptoData/`, etc.
   - Downloaded via `run_all_downloaders.py`
   - Contains real historical price data

2. **Backend Loads CSV Files**:
   ```typescript
   // backend/src/services/dataPipelineService.ts:284
   async updateDatabaseFromRawFiles() {
     // Reads CSV files from folders
     // Processes them
     // Stores in local-market-data.json (mock mode)
   }
   ```

3. **Backend Serves Real Data**:
   ```typescript
   // backend/src/routes/market-data.ts:89
   const dbData = await dataPipelineService.getMarketData(symbol, daysToFetch);
   // Returns data from local-market-data.json or database
   ```

4. **Frontend Receives Real Data**:
   ```typescript
   // frontend/services/marketDataService.ts:42
   const response = await fetch(`${backendUrl}/api/market-data/history/${symbol}`);
   // Gets REAL data from backend
   ```

---

## 🎯 What "Mock Database" Actually Means

**"Mock Database" = Storage Method, NOT Data Type**

- ❌ Does NOT mean: Fake/simulated data
- ✅ DOES mean: Uses JSON file storage instead of database
- ✅ Data is still: Real market data from CSV files

Think of it like this:
- **Mock DB**: Storing your files in a folder instead of a filing cabinet
- **Real DB**: Storing your files in a proper filing cabinet
- **Both contain**: The same real files (CSV data)!

---

## 🔍 How to Verify Your Data is Real

### 1. Check CSV Files Exist:
```powershell
# Count CSV files in data folders
Get-ChildItem -Path "stockDataRaw&Processed" -Filter "*.csv" | Measure-Object
Get-ChildItem -Path "cryptoData" -Filter "*.csv" | Measure-Object
```

### 2. Check Backend Storage:
```powershell
# Check if local-market-data.json exists and has data
Get-Content "backend/data/local-market-data.json" | Select-Object -First 50
```

### 3. Check Backend Logs:
```
Look for: "✓ Market data loaded: X symbols, Y records"
This confirms CSV files were loaded into storage
```

### 4. Test API Endpoint:
```powershell
# Get a token first (login)
$token = "YOUR_TOKEN"
# Then fetch real data
Invoke-WebRequest -Uri "http://localhost:3000/api/market-data/history/AAPL?period=1mo" `
  -Headers @{ "Authorization" = "Bearer $token" }
```

---

## 📈 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES (Real APIs)                  │
│  - yfinance (Yahoo Finance)                                  │
│  - Market data providers                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            CSV FILES (Real Market Data)                      │
│  stockDataRaw&Processed/AAPL_raw.csv                        │
│  cryptoData/BTC_raw.csv                                      │
│  forexData/AUDUSD_raw.csv                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          BACKEND DATA PIPELINE SERVICE                       │
│  Reads CSV files → Parses → Stores                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│  Mock DB Mode    │      │  Real DB Mode    │
│  (USE_MOCK_DB=   │      │  (USE_MOCK_DB=   │
│   true)          │      │   false)         │
│                  │      │                  │
│  Stores in:      │      │  Stores in:      │
│  local-market-   │      │  Azure SQL /     │
│  data.json       │      │  PostgreSQL      │
│                  │      │                  │
│  ✅ REAL DATA    │      │  ✅ REAL DATA    │
└────────┬─────────┘      └────────┬─────────┘
         │                         │
         └─────────────┬───────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API ENDPOINT                            │
│  GET /api/market-data/history/:symbol                       │
│  Returns REAL data from storage                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND APP                              │
│  Displays REAL market data in charts, games, etc.           │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Summary

**Your system IS using real CSV data!**

- ✅ CSV files contain real market data (downloaded via data-pipeline)
- ✅ Backend loads CSV files into storage on startup
- ✅ Frontend fetches and displays this real data
- ✅ "Mock database" only means JSON file storage (not fake data)
- ✅ Data quality is the same whether using mock DB or real DB

The only difference between mock DB and real DB is **where** the data is stored, not **what** data is stored. Both use the same real CSV files!

