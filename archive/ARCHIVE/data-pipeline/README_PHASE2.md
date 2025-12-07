# Phase 2: Market Data Ingestion Pipeline

## Overview
This phase downloads 3 years of historical market data for all asset classes (ASX stocks, crypto, forex, commodities, ETFs), processes the data with technical indicators, loads into Azure SQL Database, and exports to CSV files for RL training.

## Prerequisites
- ✅ Phase 1 completed: Azure SQL Database schema deployed
- ✅ Python 3.8+ installed with required packages
- ✅ Azure Storage Account with ADLS Gen2 enabled
- ✅ Environment files configured: `azureCred.env`, `sqlDB.env`

> 📘 **New to the data pipeline?** See `SETUP_INSTRUCTIONS.md` for a comprehensive step-by-step setup guide, including detailed ODBC driver installation instructions.

### Install ODBC Driver for SQL Server

**⚠️ REQUIRED**: Before running `processAndStore.py` or any database operations, you must install the Microsoft ODBC Driver 18 for SQL Server on your system.

**Windows Installation (Primary Method):**
```bash
winget install --id Microsoft.msodbcsql.18 -e
```

**Alternative Download:**
- Official download page: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
- Download the appropriate installer (x64 for 64-bit Python, x86 for 32-bit Python)

**Verification:**
1. Open ODBC Data Source Administrator: Run `odbcad32.exe` from Run dialog (Win+R)
2. Navigate to the "Drivers" tab
3. Verify "ODBC Driver 18 for SQL Server" appears in the list

**⚠️ Important Notes:**
- The driver bitness (32-bit/64-bit) must match your Python installation
- If you're using 64-bit Python, you need the 64-bit ODBC driver
- Check Python bitness: `python -c "import platform; print(platform.architecture()[0])"`
- After installation, restart your terminal/PowerShell session

**Troubleshooting:**
- If verification fails, ensure you downloaded the correct architecture (x64 vs x86)
- If you have both 32-bit and 64-bit Python installed, you may need both drivers
- Windows may require administrator privileges for installation

## Required Python Packages
```bash
# Install from requirements.txt (recommended)
cd data-pipeline
pip install -r requirements.txt

# Or install individually
pip install yfinance pandas polars pyodbc azure-storage-file-datalake fsspec requests python-dotenv
```

## Directory Structure
```
Financial_Assets_Pipeline/
├── azureCred.env                    # Azure Storage credentials
├── sqlDB.env                        # Azure SQL Database credentials
├── dbConnection.py                  # Database connection module
├── asx_market_data_adls.py         # ASX stocks downloader
├── crypto_market_data_adls.py      # Crypto downloader
├── forex_market_data_adls.py       # Forex downloader
├── commodities_market_data_adls.py # Commodities downloader
├── etf_market_data_adls.py         # ETF downloader
├── run_all_downloaders.py          # Orchestration script
├── processAndStore.py              # Processing & SQL loading
├── export_to_rl_training.py        # CSV export for RL training
├── validate_data_quality.py        # Data quality validation
├── data/
│   ├── raw/                        # Local raw CSV cache
│   └── reference/                  # Reference data (ASX companies list)
└── logs/
    ├── data_download.log           # Download logs
    └── orchestrator.log            # Orchestration logs
```

## Step-by-Step Execution Guide

### Step 1: Configure Environment Files

**⚠️ SECURITY: Never commit real secrets to version control!**

**Setup `sqlDB.env`:**
1. Copy from the example file: `cp sqlDB.env.example sqlDB.env`
2. Fill in your actual values:
   ```bash
   # Azure SQL Database (Phase 1 setup)
   SQL_SERVER=your-sql-server.database.windows.net
   SQL_DB=your_database_name
   SQL_UID=your_username
   SQL_PWD=your_actual_password
   
   # ADLS Gen2
   # Option 1: Use connection string (recommended)
   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your_account_name;AccountKey=your_account_key;EndpointSuffix=core.windows.net
   
   # Option 2: Use account name and key separately
   # AZURE_STORAGE_ACCOUNT=your_account_name
   # AZURE_STORAGE_KEY=your_account_key
   
   ADLS_CONTAINER=raw
   ADLS_RAW_PREFIX=asxStocks
   BATCH_ROWS=75000
   MERGE_EVERY_ROWS=200000
   TRUNCATE_PRICES_BEFORE=false
   # ⚠️ SAFETY: Deletion is opt-in only. Set to true only after verifying MERGE results.
   ADLS_DELETE_SOURCE=false
   ```

**Setup `azureCred.env`:**
1. Copy from the example file: `cp azureCred.env.example azureCred.env`
2. Fill in your actual Azure Storage connection string:
   ```bash
   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your_account_name;AccountKey=your_account_key;EndpointSuffix=core.windows.net
   AZURE_UPLOAD=true
   AZURE_STORAGE_FILESYSTEM=raw
   AZURE_PREFIX=asxStocks
   ```

**Note:** The actual `*.env` files are excluded from version control via `.gitignore`. Store your real secrets in:
- Azure Key Vault (for production)
- CI/CD pipeline secrets (for automated deployments)
- Local environment files (for development - not in git)

### Step 2: Test Database Connectivity

**Prerequisite Check:** Before testing connectivity, verify ODBC driver installation (see "Install ODBC Driver for SQL Server" section above).

**Note:** If the connection test fails with error `pyodbc.InterfaceError: ('IM002', '[IM002] [Microsoft][ODBC Driver Manager] Data source name not found')`, this indicates the ODBC driver is missing. Refer to the "Install ODBC Driver for SQL Server" section in Prerequisites for installation steps.

```bash
python -c "from dbConnection import get_conn; conn = get_conn(); print('✅ Connected to:', conn.execute('SELECT DB_NAME()').fetchone()[0])"
```

### Step 3: Download Market Data (All Asset Classes)

**Option A: Run All Downloaders (Recommended)**
```bash
python run_all_downloaders.py
```
This will download ASX stocks, crypto, forex, commodities, and ETFs sequentially.

**Folder Organization:**
All downloaded raw data is organized by asset type in subdirectories:
- `data/raw/stocks/` - ASX stocks (e.g., `BHP.AX_raw.csv`)
- `data/raw/forex/` - Forex pairs (e.g., `EURUSD=X_raw.csv`)
- `data/raw/crypto/` - Cryptocurrencies (e.g., `BTC-USD_raw.csv`)
- `data/raw/commodities/` - Commodities (e.g., `GC=F_raw.csv`)
- `data/raw/etfs/` - ETFs (e.g., `SPY_raw.csv`)

This organization allows each model to train on its specific asset type without mixing data.

**Option B: Run Individual Downloaders**
```bash
# ASX Stocks (312 symbols, ~45 minutes)
python asx_market_data_adls.py --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 80 --sleep-between 2.0

# Cryptocurrencies (20 symbols, ~5 minutes)
python crypto_market_data_adls.py --category Major --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 20

# Forex Pairs (7 symbols, ~2 minutes)
python forex_market_data_adls.py --category Major --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 10

# Commodities (17 symbols, ~4 minutes)
python commodities_market_data_adls.py --category All --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 10

# ETFs (87 symbols, ~8 minutes)
python etf_market_data_adls.py --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 20
```

**Expected Duration:** 60-90 minutes for all asset classes

### Step 4: Process Data & Load into Azure SQL

**Option A: Process All Asset Classes at Once (Recommended)**

Set `ADLS_RAW_PREFIX_LIST` in `sqlDB.env` or as environment variable to process multiple classes in one run:

```bash
# In sqlDB.env, set:
ADLS_RAW_PREFIX_LIST=asxStocks,crypto,forex,commodities,etfs

# Then run once:
python processAndStore.py
```

**Option B: Process Individual Asset Classes**

Run `processAndStore.py` for each asset class separately:

```bash
# Process ASX Stocks (~20 minutes)
set ADLS_RAW_PREFIX=asxStocks
python processAndStore.py

# Process Crypto (~3 minutes)
set ADLS_RAW_PREFIX=crypto
python processAndStore.py

# Process Forex (~2 minutes)
set ADLS_RAW_PREFIX=forex
python processAndStore.py

# Process Commodities (~3 minutes)
set ADLS_RAW_PREFIX=commodities
python processAndStore.py

# Process ETFs (~8 minutes)
set ADLS_RAW_PREFIX=etfs
python processAndStore.py
```

**Expected Duration:** 35-40 minutes total (Option A) or 35-40 minutes total (Option B)

**Note:** `ADLS_RAW_PREFIX_LIST` is a comma-separated list of prefixes. When set, `processAndStore.py` will process all specified asset classes in a single run, which is more efficient than running multiple times.

### Step 5: Export to RL Training Directory

```bash
python export_to_rl_training.py --output-dir ../wealtharena_rl/data/processed
```

This exports processed data from Azure SQL to CSV files organized by asset class:
- `wealtharena_rl/data/processed/stocks/`
- `wealtharena_rl/data/processed/crypto/`
- `wealtharena_rl/data/processed/forex/`
- `wealtharena_rl/data/processed/commodities/`
- `wealtharena_rl/data/processed/etfs/`

**Expected Duration:** 10-15 minutes

### Step 6: Validate Data Quality

```bash
python validate_data_quality.py --output-report data_quality_report.json --verbose
```

This performs comprehensive validation:
- ADLS raw data checks
- Azure SQL database checks
- Local CSV export checks
- Cross-validation between stages
- Statistical quality checks

**Expected Duration:** 5-10 minutes

## Verification Queries

**Check total rows in Azure SQL:**
```sql
SELECT COUNT(*) AS total_rows FROM dbo.processed_prices;
-- Expected: ~300K-400K rows
```

**Check symbols by asset class:**
```sql
SELECT 
    CASE 
        WHEN symbol LIKE '%.AX' THEN 'ASX Stocks'
        WHEN symbol LIKE '%-USD' THEN 'Crypto'
        WHEN symbol LIKE '%=X' THEN 'Forex'
        WHEN symbol LIKE '%=F' THEN 'Commodities'
        ELSE 'US Stocks/ETFs'
    END AS asset_class,
    COUNT(DISTINCT symbol) AS symbol_count,
    COUNT(*) AS total_rows
FROM dbo.processed_prices
GROUP BY 
    CASE 
        WHEN symbol LIKE '%.AX' THEN 'ASX Stocks'
        WHEN symbol LIKE '%-USD' THEN 'Crypto'
        WHEN symbol LIKE '%=X' THEN 'Forex'
        WHEN symbol LIKE '%=F' THEN 'Commodities'
        ELSE 'US Stocks/ETFs'
    END;
```

**Check date range coverage:**
```sql
SELECT 
    symbol,
    MIN(date_utc) AS start_date,
    MAX(date_utc) AS end_date,
    COUNT(*) AS row_count
FROM dbo.processed_prices
GROUP BY symbol
ORDER BY symbol;
```

## Troubleshooting

### Issue: Connection timeout to Azure SQL
**Solution:** Check firewall rules in Azure Portal. Add your IP address to allowed IPs.

### Issue: ADLS upload fails
**Solution:** Verify `AZURE_STORAGE_CONNECTION_STRING` in `azureCred.env`. Check storage account access keys in Azure Portal.

### Issue: Yahoo Finance rate limiting
**Solution:** Increase `--sleep-between` parameter to 3.0 or 5.0 seconds.

### Issue: processAndStore.py fails with "Object already exists"
**Solution:** This is expected for first run. Script continues processing.

### Issue: Missing technical indicators (all null)
**Solution:** Technical indicators require minimum data points (e.g., SMA_20 needs 20 days). First 20 rows will have null SMA_20.

## Next Steps

After completing Phase 2:
1. ✅ Verify data quality report shows > 95% quality score
2. ✅ Check CSV files exist in `wealtharena_rl/data/processed/`
3. ➡️ Proceed to Phase 5: RL Model Training

## Summary

**Total Execution Time:** ~2-3 hours (including downloads, processing, export, validation)

**Data Pipeline Flow:**
```
Yahoo Finance API
       ↓
  Raw CSV Files (Local)
       ↓
  ADLS Gen2 (raw/)
       ↓
  processAndStore.py (Polars + Technical Indicators)
       ↓
  Azure SQL Database (processed_prices table)
       ↓
  export_to_rl_training.py
       ↓
  wealtharena_rl/data/processed/ (CSV files for RL training)
```

**Assets Downloaded:**
- ASX Stocks: 312 symbols
- Cryptocurrencies: 20 symbols
- Forex Pairs: 7 symbols
- Commodities: 17 symbols
- ETFs: 87 symbols
- **Total: 443 symbols × 3 years = ~330K rows**

**Technical Indicators Computed:**
- Moving Averages: SMA (5,10,20,50,200), EMA (12,26)
- Momentum: RSI(14), MACD, MACD Signal, MACD Histogram
- Volatility: Bollinger Bands (upper, middle, lower), 20-day volatility
- Returns: Simple returns, log returns, 20-day momentum
- Volume: 20-day SMA, volume ratio

---

**Phase 2 Status:** ✅ Ready for Execution

**Next Phase:** Phase 5 - RL Model Training

