# WealthArena Standalone Data Pipeline

Standalone Python scripts for daily market data ingestion, technical indicator computation, and RL signal generation. These scripts run without Docker/Airflow/Databricks and can be executed manually or scheduled via Windows Task Scheduler.

## Overview

The data pipeline consists of 3 scripts that run in sequence:

1. **01_daily_market_data_refresh.py** - Downloads latest market data (last 7 days) for all asset classes
2. **02_compute_technical_indicators.py** - Processes raw data and computes 20+ technical indicators
3. **03_generate_rl_signals.py** - Generates trading signals using RL model inference

## Prerequisites

### Python Environment
- Python 3.8 or higher
- Required packages (install via `pip install -r requirements.txt`):
  ```
  yfinance
  pandas
  polars
  numpy
  pyodbc
  fsspec
  python-dotenv
  azure-storage-file-datalake
  requests
  ```

### Azure Resources
- Azure SQL Database: `wealtharena_db` (configured in Phase 1)
- Azure Data Lake Storage Gen2: `aipwealtharena2025lake` (configured in Phase 2)
- Connection credentials in `Financial_Assets_Pipeline/sqlDB.env` and `azureCred.env`

### ODBC Driver
- ODBC Driver 18 for SQL Server (required for Azure SQL connection)
- Download: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

## Quick Start

### Manual Execution

**Option 1: Run Full Pipeline (Recommended for Demo)**
```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/scripts/data_pipeline"
run_full_pipeline.bat
```
This executes all 3 scripts in sequence (~20-30 minutes total).

**Option 2: Run Individual Scripts**
```bash
# Step 1: Download market data
run_data_refresh.bat

# Step 2: Compute technical indicators
python 02_compute_technical_indicators.py

# Step 3: Generate signals
run_signal_generation.bat
```

### Scheduled Execution (Windows Task Scheduler)

1. Open Task Scheduler (taskschd.msc)
2. Create Basic Task
3. Name: "WealthArena Full Pipeline"
4. Trigger: Daily at 6:00 AM
5. Action: Start a program
6. Program/script: `C:\Users\PC\Desktop\AIP Project Folder\WealthArena_UI\scripts\data_pipeline\run_full_pipeline.bat`
7. Start in: `C:\Users\PC\Desktop\AIP Project Folder\WealthArena_UI\scripts\data_pipeline`

## Script Details

### 01_daily_market_data_refresh.py

**Purpose:** Downloads latest market data (last 7 days) for all asset classes.

**Asset Classes:**
- ASX Stocks: 312 symbols (e.g., BHP.AX, CBA.AX)
- Cryptocurrencies: 20 symbols (e.g., BTC-USD, ETH-USD)
- Forex Pairs: 7 major pairs (e.g., EURUSD=X, GBPUSD=X)
- Commodities: 17 futures (e.g., GC=F, SI=F, CL=F)
- ETFs: 87 symbols (e.g., SPY, QQQ, STW.AX)

**Execution Time:** 10-15 minutes

**Output:**
- Raw CSV files uploaded to ADLS Gen2 `raw/` container
- Local copies in `Financial_Assets_Pipeline/data/raw/`
- Summary JSON: `raw_download_summary.json`
- Log file: `logs/01_market_data_refresh_YYYYMMDD_HHMMSS.log`

**Configuration:**
- Date range: Last 7 days (incremental updates)
- Batch size: 50 symbols per batch
- Sleep between batches: 1.0 seconds
- ADLS upload: Enabled (append mode, no deletion)

### 02_compute_technical_indicators.py

**Purpose:** Processes raw CSV files from ADLS and computes technical indicators.

**Technical Indicators (20+):**
- Moving Averages: SMA (5, 10, 20, 50, 200), EMA (12, 26)
- Momentum: RSI(14), MACD, MACD Signal, MACD Histogram
- Volatility: Bollinger Bands (upper, middle, lower), 20-day volatility
- Returns: Simple returns, log returns, 20-day momentum
- Volume: 20-day SMA, volume ratio

**Execution Time:** 5-8 minutes

**Output:**
- Data loaded into Azure SQL `processed_prices` table
- MERGE operation: INSERT new rows, UPDATE existing rows
- Log file: `logs/02_technical_indicators_YYYYMMDD_HHMMSS.log`

**Configuration:**
- Incremental mode: Process only files modified in last 7 days
- Batch size: 75,000 rows per stage insertion
- MERGE frequency: Every 200,000 rows
- Parallel processing: 8 workers

### 03_generate_rl_signals.py

**Purpose:** Generates trading signals using RL model inference (or mock predictions).

**Signal Types:**
- BUY: Bullish signal with entry price, stop loss, and 3 take-profit levels
- SELL: Bearish signal with entry price, stop loss, and 3 take-profit levels
- HOLD: Neutral signal (no action recommended)

**Execution Time:** 3-5 minutes

**Output:**
- Signals stored in Azure SQL `rl_signals` table
- Only signals with confidence ≥ 60% are stored
- Log file: `logs/03_rl_signals_YYYYMMDD_HHMMSS.log`

**Configuration:**
- Lookback window: 60 days of historical data
- Batch size: 100 symbols per batch
- Confidence threshold: 0.6 (60%)
- Model: Mock predictions until Phase 7 (RL training)

**Note on Mock Predictions:**
Until RL models are trained in Phase 7, this script uses simple heuristics:
- Average feature value > 0.5 → BUY signal
- Average feature value < -0.5 → SELL signal
- Otherwise → HOLD signal

Once models are trained, the script will automatically use actual model inference.

## Logs

All scripts generate detailed logs in `logs/` directory:

**Log Files:**
- `01_market_data_refresh_YYYYMMDD_HHMMSS.log`
- `02_technical_indicators_YYYYMMDD_HHMMSS.log`
- `03_rl_signals_YYYYMMDD_HHMMSS.log`

**Log Rotation:**
- Logs are kept for 30 days
- Older logs are automatically deleted
- Failed symbols/files are saved to separate files for review

**Log Format:**
```
[2025-01-15 06:00:00] INFO: Starting daily market data refresh...
[2025-01-15 06:00:05] INFO: Downloading ASX Stocks: 312 symbols
[2025-01-15 06:05:23] INFO: ✅ ASX Stocks: 310/312 downloaded
[2025-01-15 06:09:47] INFO: ✅ Daily market data refresh completed
```

## Troubleshooting

### Issue: Python not found
**Solution:** Add Python to PATH or specify full path in batch files
```batch
set PYTHON_EXE=C:\Python39\python.exe
```

### Issue: ODBC Driver not found
**Solution:** Install ODBC Driver 18 for SQL Server
- Download: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
- Verify installation: Check "ODBC Data Sources" in Windows

### Issue: Azure SQL connection timeout
**Solution:** Check firewall rules in Azure Portal
- Add your IP address to allowed IPs
- Verify connection string in `Financial_Assets_Pipeline/sqlDB.env`

### Issue: ADLS upload fails
**Solution:** Verify credentials in `Financial_Assets_Pipeline/azureCred.env`
- Check `AZURE_STORAGE_CONNECTION_STRING`
- Verify storage account access keys in Azure Portal

### Issue: Yahoo Finance rate limiting
**Solution:** Increase sleep time between batches
- Edit script: Change `sleep_between=1.0` to `sleep_between=3.0`

### Issue: Script hangs or freezes
**Solution:** Check logs for specific error
- Look for last successful operation
- Check network connectivity
- Verify Azure resources are accessible

## Verification

### Verify Data Download
```sql
-- Connect to Azure SQL Database
-- Check latest data in processed_prices
SELECT 
    symbol,
    MAX(date_utc) AS latest_date,
    COUNT(*) AS row_count
FROM dbo.processed_prices
GROUP BY symbol
ORDER BY latest_date DESC;
```

### Verify Technical Indicators
```sql
-- Check technical indicators for a specific symbol
SELECT TOP 10
    symbol, date_utc, [close],
    sma_20, rsi_14, macd,
    bb_upper, bb_lower
FROM dbo.processed_prices
WHERE symbol = 'BHP.AX'
ORDER BY date_utc DESC;
```

### Verify Signals
```sql
-- Check latest signals
SELECT 
    signal_type,
    COUNT(*) AS signal_count,
    AVG(confidence_score) AS avg_confidence
FROM dbo.rl_signals
WHERE date_time >= DATEADD(day, -1, GETDATE())
GROUP BY signal_type;
```

## Performance Optimization

### For Faster Execution
1. **Reduce lookback window**: Change from 7 days to 3 days in script configuration
2. **Increase batch size**: Change from 50 to 100 symbols per batch
3. **Reduce sleep time**: Change from 1.0 to 0.5 seconds (risk of rate limiting)
4. **Parallel processing**: Increase workers from 8 to 12 (if CPU allows)

### For Lower Resource Usage
1. **Decrease batch size**: Change from 50 to 25 symbols per batch
2. **Increase sleep time**: Change from 1.0 to 2.0 seconds
3. **Reduce parallel workers**: Change from 8 to 4 workers
4. **Process one asset class at a time**: Comment out other asset classes in script

## Next Steps

After completing Phase 3A-Alt:
1. ✅ Verify all 3 scripts execute successfully
2. ✅ Check logs for any errors or warnings
3. ✅ Verify data in Azure SQL Database
4. ➡️ Proceed to Phase 4: Backend API Setup
5. ➡️ Proceed to Phase 7: RL Model Training (to replace mock predictions)

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review troubleshooting section above
3. Verify Azure resources are accessible
4. Check environment files have correct credentials

---

**Phase 3A-Alt Status:** ✅ Ready for Execution

**Estimated Total Time:** 20-30 minutes for full pipeline

**Next Phase:** Phase 4 - Backend API Setup

