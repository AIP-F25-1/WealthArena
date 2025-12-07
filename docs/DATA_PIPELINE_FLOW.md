# Data Pipeline Flow: CSV → Local Storage → App → Trade Signals

This document explains how your downloaded CSV data flows through the system to be rendered in the app and used for generating trade signals.

**⚠️ IMPORTANT: This system is designed for LOCAL-FIRST development.**
- When `USE_MOCK_DB=true` (default in simplified setup): Data stored in local JSON files
- When `USE_MOCK_DB=false`: Data stored in Azure SQL/PostgreSQL database
- **For local testing, always use `USE_MOCK_DB=true`** (no Azure account needed!)

## 📊 Complete Data Flow (Local Mode)

```
CSV Files (data-pipeline/data/raw/ or root-level folders)
    ↓
DataPipelineService (backend/src/services/dataPipelineService.ts)
    ↓
Local JSON File Storage (backend/data/local-market-data.json)
    ↓
    ├─→ Frontend App (Charts & Display)
    └─→ RL Training Service (Signal Generation)
```

## 📊 Complete Data Flow (Cloud Mode - Optional)

```
CSV Files (data-pipeline/data/raw/)
    ↓
DataPipelineService (backend/src/services/dataPipelineService.ts)
    ↓
Azure SQL / PostgreSQL Database (CandleData table)
    ↓
    ├─→ Frontend App (Charts & Display)
    └─→ RL Training Service (Signal Generation)
```

---

## 1️⃣ **CSV Data Processing** (Data Pipeline)

### **Location of CSV Files**
Your CSV files are stored in:
- `data-pipeline/data/raw/stocks/` - Stock data (e.g., `AAPL_raw.csv`)
- `data-pipeline/data/raw/crypto/` - Crypto data (e.g., `BTC-USD_raw.csv`)
- `data-pipeline/data/raw/forex/` - Forex data (e.g., `AUDUSD=X_raw.csv`)
- `data-pipeline/data/raw/commodities/` - Commodities (e.g., `GC=F_raw.csv`)
- `forexData/` - Root-level forex folder (e.g., `aud_fx_download_summary.json`)
- `cryptoData/`, `stockDataRaw&Processed/`, `commoditiesData/` - Root-level folders

### **CSV Format Expected**
Each CSV file should have columns:
```csv
Date,Open,High,Low,Close,Volume
2022-11-01,150.25,152.30,149.80,151.50,1000000
2022-11-02,151.50,153.20,150.90,152.75,1200000
...
```

### **Processing Steps** (`dataPipelineService.ts`)

1. **File Discovery** (Lines 275-342)
   - Scans all data folders (both legacy and root-level)
   - Finds all `.csv` files
   - Extracts symbol from filename (e.g., `AAPL_raw.csv` → `AAPL`)

2. **CSV Parsing** (Lines 98-134)
   - Reads CSV file using `csv-parse`
   - Handles different date formats (ISO, YYYY-MM-DD)
   - Converts numeric values (Open, High, Low, Close, Volume)
   - Filters invalid rows (missing dates or zero close prices)

3. **Data Transformation** (Lines 139-260)
   - Maps CSV columns to database schema
   - Parses dates to JavaScript Date objects
   - Determines asset type from folder name
   - Handles special symbol formats:
     - Forex: `AUDUSD` → `AUDUSD=X`
     - Commodities: `GC` → `GC=F`

4. **Data Storage** (Lines 184-274)
   - **Local Mode** (`USE_MOCK_DB=true`): Stores in `backend/data/local-market-data.json`
   - **Cloud Mode** (`USE_MOCK_DB=false`): Inserts into `CandleData` table
   - Uses batch processing (100 records at a time for cloud mode)
   - Checks for existing records (upsert logic)
   - Stores: Symbol, Date, Open, High, Low, Close, Volume, AssetType

---

## 2️⃣ **Data Storage** (Local or Cloud)

### **Local Storage Mode** (`USE_MOCK_DB=true` - Default for Testing)

**Storage Location:** `backend/data/local-market-data.json`

**File Structure:**
```json
{
  "AAPL": [
    {
      "Symbol": "AAPL",
      "Date": "2022-11-01",
      "Open": 150.25,
      "High": 152.30,
      "Low": 149.80,
      "Close": 151.50,
      "Volume": 1000000,
      "AssetType": "stock"
    },
    ...
  ],
  "BTC-USD": [...],
  ...
}
```

**Benefits:**
- ✅ No database installation required
- ✅ No Azure account needed
- ✅ Perfect for local testing
- ✅ Data persists between server restarts (unlike in-memory user data)
- ✅ Easy to inspect/debug (just open the JSON file)

### **Cloud Storage Mode** (`USE_MOCK_DB=false` - Production)

**Table Structure: `CandleData`** (Azure SQL / PostgreSQL)
```sql
CandleData
├── Symbol (VARCHAR) - e.g., "AAPL", "BTC-USD", "AUDUSD=X"
├── TimeFrame (VARCHAR) - "1d" for daily data
├── Timestamp (DATETIME) - Date of the candle
├── OpenPrice (DECIMAL)
├── HighPrice (DECIMAL)
├── LowPrice (DECIMAL)
├── ClosePrice (DECIMAL)
├── Volume (BIGINT)
└── CreatedAt (DATETIME)
```

### **Querying Data** (`dataPipelineService.getMarketData()`)
```typescript
// Works the same in both modes!
// Gets last N days of data for a symbol
const data = await dataPipelineService.getMarketData('AAPL', 60);
// Returns: Array of { Symbol, Date, Open, High, Low, Close, Volume, AssetType }

// The service automatically detects USE_MOCK_DB and uses the appropriate storage
```

---

## 3️⃣ **Frontend App Rendering**

### **Data Flow to Frontend**

1. **API Endpoint** (`backend/src/routes/market-data.ts`)
   ```
   GET /api/market-data/history/:symbol?period=1mo
   ```

2. **Backend Processing** (Lines 64-165)
   - Primary: Queries `CandleData` table via `dataPipelineService.getMarketData()`
   - Converts database rows to API format:
     ```typescript
     {
       time: "2022-11-01",
       open: 150.25,
       high: 152.30,
       low: 149.80,
       close: 151.50,
       volume: 1000000
     }
     ```
   - Fallback: If database empty, tries chatbot API (yfinance)

3. **Frontend Service** (`frontend/services/marketDataService.ts`)
   - Calls backend API
   - Caches data for 5 minutes
   - Converts to `MarketData` format for charts
   - Fallback chain: Database → Alpha Vantage → yfinance → Mock

4. **UI Components**
   - **Dashboard** (`frontend/app/(tabs)/dashboard.tsx`): Displays SPY chart
   - **CandlestickChart**: Renders OHLCV data
   - **Trade Detail**: Shows individual symbol charts

### **Chart Rendering**
```typescript
// Example: Dashboard fetches and displays data
const data = await marketDataService.getStockData('SPY');
// data.data contains: [{ time, open, high, low, close }, ...]
// Rendered in <CandlestickChart data={data.data} />
```

---

## 4️⃣ **Trade Signal Generation**

### **Signal Generation Flow**

#### **A. RL Training Service** (`rl-training/backend/`)

1. **Data Loading** (`main.py` - `load_symbol_data()`)
   ```python
   # Priority:
   # 1. Live data from yfinance (real-time)
   # 2. Database service (CandleData table via db_connector.py)
   # 3. Local CSV files (fallback)
   ```

2. **Database Query** (`rl-service/api/db_connector.py`)
   - Queries `processed_prices` table (or `CandleData` via adapter)
   - Returns DataFrame with technical indicators:
     ```python
     {
       'Date', 'Open', 'High', 'Low', 'Close', 'Volume',
       'SMA_20', 'SMA_50', 'RSI', 'MACD', 
       'Volume_Ratio', 'Volatility_20'
     }
     ```

3. **Feature Engineering** (`rl-training/src/data/`)
   - Calculates technical indicators (RSI, MACD, Bollinger Bands)
   - Adds momentum features
   - Creates signal features

4. **Signal Generation** (`rl-training/backend/model_service.py`)
   ```python
   # RL Model determines:
   - Signal: BUY/SELL/HOLD
   - Entry Price: Current market price
   - Take Profit Levels: TP1, TP2, TP3
   - Stop Loss: Risk-based calculation
   - Position Size: Based on confidence & volatility
   - Confidence Score: 0.0 - 1.0
   ```

5. **Signal Storage**
   - Stored in `rl_signals` table (or `TradingSignals` table)
   - Includes: symbol, signal_type, confidence_score, entry_price, stop_loss, take_profit_1/2/3

#### **B. Backend Signal API** (`backend/src/routes/signals.ts`)

1. **Top Signals Endpoint**
   ```
   GET /api/signals/top?limit=5&assetType=stock
   ```
   - Queries `vw_TopTradingSignals` view
   - Returns signals ordered by confidence and risk-reward ratio

2. **Signal Details**
   ```
   GET /api/signals/:signalId
   ```
   - Returns signal with take-profit levels
   - Includes reasoning and model version

#### **C. Frontend Signal Display**

1. **Signal Fetching** (`frontend/services/apiService.ts`)
   ```typescript
   const signals = await apiService.getTopSignals('stock', 5);
   ```

2. **Signal Components**
   - Dashboard: Shows top signals
   - Signal Cards: Display entry, TP, SL levels
   - Signal Detail: Full signal information

---

## 5️⃣ **Technical Indicators for Signals**

### **Calculated Features** (from your CSV data)

1. **Price-Based**
   - SMA_20, SMA_50 (Simple Moving Averages)
   - RSI_14 (Relative Strength Index)
   - MACD (Moving Average Convergence Divergence)
   - Bollinger Bands

2. **Volume-Based**
   - Volume_Ratio (current vs average)
   - Volume trends

3. **Volatility**
   - Volatility_20 (20-day rolling volatility)
   - ATR (Average True Range)

4. **Momentum**
   - Price change over 1d, 5d, 30d
   - Rate of change

### **Signal Logic** (Simplified)
```python
# Example signal generation
if RSI < 30 and MACD > 0 and Volume_Ratio > 1.5:
    signal = "BUY"
    confidence = 0.85
    stop_loss = current_price * 0.95  # 5% stop
    take_profit_1 = current_price * 1.10  # 10% target
```

---

## 6️⃣ **Data Update Process**

### **Manual Update**
```typescript
// Backend endpoint
POST /api/market-data/update-database
// Triggers: dataPipelineService.updateDatabaseFromRawFiles()
```

### **Automatic Update**
- Scheduled daily (via cron/scheduler)
- Checks if data is stale (>24 hours old)
- Processes new CSV files

### **Automatic Initialization** (Recommended)

**The backend automatically initializes market data on startup!**

When the backend starts with `USE_MOCK_DB=true`:
1. ✅ Checks if `backend/data/local-market-data.json` exists and has data
2. ✅ If empty or stale (>24 hours old), automatically loads CSV files
3. ✅ Processes all CSV files from `data-pipeline/data/raw/` and root-level folders
4. ✅ Stores data in `backend/data/local-market-data.json`
5. ✅ Logs progress: `✓ Market data loaded: X symbols, Y records`

**No manual steps needed!** Just run `master_setup_simplified.ps1` and data loads automatically.

### **Manual Initialization** (If Needed)

If automatic loading fails or you want to reload data:
```typescript
POST /api/market-data/initialize
// Manually trigger CSV file processing
// Requires authentication token
```

---

## 7️⃣ **Current Status & Issues**

### **✅ What's Working**

**Local Mode (`USE_MOCK_DB=true`):**
- ✅ CSV files are being read from multiple folder structures
- ✅ Data is stored in `backend/data/local-market-data.json` (local file storage)
- ✅ Backend API serves data to frontend
- ✅ Fallback chain works: Local Storage → Alpha Vantage → yfinance → Mock
- ✅ No Azure account or database installation required

**Cloud Mode (`USE_MOCK_DB=false`):**
- ✅ CSV files are being read from multiple folder structures
- ✅ Data is stored in `CandleData` table (Azure SQL/PostgreSQL)
- ✅ Backend API serves data to frontend
- ✅ Fallback chain works: Database → Alpha Vantage → yfinance → Mock

### **⚠️ Potential Issues**

1. **Local Storage Not Populated** (when `USE_MOCK_DB=true`):
   - **Automatic**: Data loads automatically on backend startup (check backend console logs)
   - **Manual**: If automatic loading fails, run: `POST /api/market-data/initialize` (requires auth token)
   - Check the file exists and has data: `backend/data/local-market-data.json`
   - Look for console message: `✓ Market data loaded: X symbols, Y records`

2. **Cloud Database Not Populated** (when `USE_MOCK_DB=false`):
   - Run: `POST /api/market-data/initialize`
   - This reads CSV files and stores them in the `CandleData` table
   - Ensure database connection is configured in `.env.local`

3. **Symbol Mismatch**: Ensure CSV filenames match expected format
   - Stocks: `AAPL_raw.csv` → Symbol: `AAPL`
   - Forex: `AUDUSD_raw.csv` → Symbol: `AUDUSD=X`
   - Crypto: `BTC-USD_raw.csv` → Symbol: `BTC-USD`

4. **Date Format**: CSV dates must be parseable (YYYY-MM-DD or ISO format)

5. **Missing Technical Indicators**: Signals require processed features
   - May need to run feature engineering pipeline
   - Or use `processed_prices` table with pre-calculated indicators

6. **Local Storage File Location**:
   - Default: `backend/data/local-market-data.json`
   - If file doesn't exist, it will be created automatically
   - File is human-readable JSON (easy to inspect/debug)

---

## 8️⃣ **Quick Reference**

### **Check Available Symbols**
```typescript
// Backend
GET /api/market-data/available-symbols

// Or via service
const symbols = await dataPipelineService.getAvailableSymbols();
```

### **Get Market Data**
```typescript
// Frontend
const data = await marketDataService.getStockData('AAPL');

// Backend API
GET /api/market-data/history/AAPL?period=1mo
```

### **Get Signals**
```typescript
// Frontend
const signals = await apiService.getTopSignals('stock', 5);

// Backend API
GET /api/signals/top?limit=5&assetType=stock
```

---

## 📝 Summary

### **Local Development (Recommended for Testing)**

**Your CSV Data Journey (Local Mode):**
1. **CSV Files** → Stored in `data-pipeline/data/raw/` or root-level folders (`forexData/`, `cryptoData/`, etc.)
2. **DataPipelineService** → Reads, parses, and validates CSV files
3. **Local JSON Storage** → Stores OHLCV data in `backend/data/local-market-data.json` (when `USE_MOCK_DB=true`)
4. **Frontend App** → Fetches via API and renders in charts
5. **RL Service** → Queries local storage, calculates features, generates signals
6. **Signals API** → Serves signals to frontend for display

**No Azure account needed!** Everything works locally with file-based storage.

### **Cloud Production (Optional)**

**Your CSV Data Journey (Cloud Mode):**
1. **CSV Files** → Stored in `data-pipeline/data/raw/` or root-level folders
2. **DataPipelineService** → Reads, parses, and validates CSV files
3. **Database Storage** → Stores OHLCV data in Azure SQL/PostgreSQL `CandleData` table (when `USE_MOCK_DB=false`)
4. **Frontend App** → Fetches via API and renders in charts
5. **RL Service** → Queries database, calculates features, generates signals
6. **Signals API** → Serves signals to frontend for display

### **Key Points**

- ✅ **Local-first approach**: System defaults to local file storage (`USE_MOCK_DB=true`)
- ✅ **No Azure required**: Test everything locally without cloud services
- ✅ **Easy migration**: Switch to cloud by setting `USE_MOCK_DB=false` and configuring database
- ✅ **Fallback chain**: Database/Local Storage → Alpha Vantage → yfinance → Mock (last resort)
- ✅ **Your CSV data is prioritized**: System uses your downloaded data before external APIs

