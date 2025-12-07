# Phase 3C: End-to-End Pipeline Testing Guide

## Overview

This guide covers testing the complete WealthArena data pipeline:
1. **Airflow Pipeline**: Local orchestration (PostgreSQL)
2. **Databricks Pipeline**: Production data processing (Azure SQL)
3. **Integration Points**: Data sync and service communication

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AIRFLOW PIPELINE (Local)                  │
├─────────────────────────────────────────────────────────────┤
│ 01_ingest_market_data → PostgreSQL (market_data, candle_data)│
│ 02_feature_engineering → PostgreSQL (processed_features)     │
│ 03_train_rl_models → /shared/models/latest/                 │
│ 04_generate_signals → RL Service → PostgreSQL (trading_signals)│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 DATABRICKS PIPELINE (Azure)                  │
├─────────────────────────────────────────────────────────────┤
│ 01_market_data_ingestion → ADLS + Azure SQL (market_data_ohlcv)│
│ 02_feature_engineering → Azure SQL (technical_indicators)    │
│ 05_rl_agent_training → ADLS (models/) + MLflow              │
│ 06_rl_inference → Azure SQL (rl_signals)                    │
│ 07_portfolio_optimization → Azure SQL (portfolios)           │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

✅ Airflow services running (`docker-compose up -d`)
✅ Databricks jobs created and accessible
✅ RL Service running (`docker-compose ps rl-service`)
✅ PostgreSQL database initialized
✅ Azure SQL Database accessible

## Test 1: Airflow DAG Execution

### 1.1 Test Data Ingestion DAG

**Objective:** Verify market data is downloaded and stored in PostgreSQL.

```bash
# Trigger DAG
docker-compose exec airflow-webserver airflow dags trigger 01_ingest_market_data

# Monitor execution
docker-compose logs -f airflow-scheduler
```

**Expected Tasks:**
1. `download_stock_data` - Downloads 10 stock symbols
2. `download_crypto_data` - Downloads 5 crypto symbols
3. `validate_data_quality` - Validates data integrity

**In Airflow UI:**
1. Go to DAGs page
2. Click `01_ingest_market_data`
3. Click on the latest run
4. All tasks should be **green** (success)

**Verify Data in PostgreSQL:**
```bash
docker-compose exec postgres psql -U wealtharena -d wealtharena -c \
  "SELECT symbol, asset_type, COUNT(*) as record_count FROM market_data GROUP BY symbol, asset_type ORDER BY asset_type, symbol;"

docker-compose exec postgres psql -U wealtharena -d wealtharena -c \
  "SELECT symbol, time_frame, COUNT(*) as candle_count FROM candle_data GROUP BY symbol, time_frame ORDER BY symbol;"
```

**Expected Results:**
- ✅ DAG completes successfully (all tasks green)
- ✅ `market_data` table has **15 symbols** (10 stocks + 5 crypto)
- ✅ `candle_data` table has **5 days of data** per symbol
- ✅ No errors in scheduler logs

### 1.2 Test Feature Engineering DAG

**Objective:** Verify technical indicators are computed from candle data.

```bash
# Trigger DAG
docker-compose exec airflow-webserver airflow dags trigger 02_feature_engineering

# Monitor execution
docker-compose logs -f airflow-scheduler
```

**Expected Tasks:**
1. `wait_for_data_ingestion` - ExternalTaskSensor (waits for previous DAG)
2. `compute_features` - Computes SMA indicators

**Verify Features in PostgreSQL:**
```bash
docker-compose exec postgres psql -U wealtharena -d wealtharena -c \
  "SELECT symbol, as_of, sma_20, sma_50 FROM processed_features ORDER BY as_of DESC LIMIT 10;"
```

**Expected Results:**
- ✅ DAG completes successfully
- ✅ `processed_features` table has entries for **AAPL, MSFT, GOOGL**
- ✅ SMA values are **non-null** and reasonable
- ✅ ExternalTaskSensor correctly waits for ingestion to complete

### 1.3 Test Signal Generation DAG

**Objective:** Verify RL service generates trading signals.

```bash
# Ensure RL service is running
curl http://localhost:5002/health

# Trigger DAG
docker-compose exec airflow-webserver airflow dags trigger 04_generate_signals

# Monitor execution
docker-compose logs -f airflow-scheduler
```

**Expected Tasks:**
1. `wait_for_feature_engineering` - ExternalTaskSensor (waits for features)
2. `check_rl_service_health` - Health check
3. `generate_signals` - Signal generation

**Verify Signals in PostgreSQL:**
```bash
docker-compose exec postgres psql -U wealtharena -d wealtharena -c \
  "SELECT signal_id, symbol, signal, confidence, entry_price FROM trading_signals ORDER BY signal_id DESC LIMIT 10;"

docker-compose exec postgres psql -U wealtharena -d wealtharena -c \
  "SELECT tpl.signal_id, tpl.level, tpl.price, tpl.percent_gain FROM take_profit_levels tpl ORDER BY tpl.signal_id DESC LIMIT 10;"
```

**Expected Results:**
- ✅ RL service responds with **200 OK**
- ✅ DAG completes successfully
- ✅ `trading_signals` table has entries for **AAPL, MSFT, GOOGL**
- ✅ `take_profit_levels` table has **3 levels per signal**

## Test 2: Databricks Job Execution

### 2.1 Test Quick Data Load Job

**Objective:** Verify data ingestion to Azure SQL and ADLS.

```bash
# Get job ID
databricks jobs list --output JSON | grep -A 5 "WealthArena-Quick-Data-Load"

# Trigger job
databricks jobs run-now --job-id <job-id>

# Monitor execution
databricks runs list --job-id <job-id> --output JSON
```

**Alternative via UI:**
1. Go to Databricks → Workflows
2. Select `WealthArena-Quick-Data-Load`
3. Click **Run now**
4. Monitor in **Runs** tab

**Verify in Azure SQL:**
```sql
-- Connect to Azure SQL
sqlcmd -S sql-wealtharena-dev.database.windows.net -d wealtharena_db -U wealtharena_admin -P "WealthArena2024!@#$%"

-- Check market data
SELECT COUNT(*) as total_records FROM market_data_ohlcv;

SELECT symbol, COUNT(*) as record_count 
FROM market_data_ohlcv 
GROUP BY symbol 
ORDER BY record_count DESC;

SELECT MIN(date_time) as earliest, MAX(date_time) as latest 
FROM market_data_ohlcv;

-- Exit
EXIT
```

**Expected Results:**
- ✅ Job completes successfully in Databricks UI
- ✅ `market_data_ohlcv` table has data for **multiple symbols**
- ✅ Date range covers **at least 6-12 months** (quick mode)
- ✅ No errors in job logs

### 2.2 Test Feature Engineering Job

**Objective:** Verify technical indicators are computed.

```bash
# Trigger job
databricks jobs run-now --job-id <feature-engineering-job-id>
```

**Verify in Azure SQL:**
```sql
-- Check technical indicators
SELECT COUNT(*) as total_indicators FROM technical_indicators;

SELECT symbol, COUNT(*) as indicator_count 
FROM technical_indicators 
GROUP BY symbol 
ORDER BY indicator_count DESC;

SELECT TOP 10 symbol, date_time, sma_20, rsi_14, macd_line 
FROM technical_indicators 
ORDER BY date_time DESC;

EXIT
```

**Expected Results:**
- ✅ Job completes successfully
- ✅ `technical_indicators` table has **50+ indicators** per symbol
- ✅ Indicator values are **non-null** and within expected ranges
  - RSI: 0-100
  - SMA: positive values
  - MACD: reasonable values

### 2.3 Test RL Training Job

**Objective:** Verify RL agents are trained and saved.

```bash
# Trigger job (this may take 30-60 minutes)
databricks jobs run-now --job-id <rl-training-job-id>

# Monitor progress
databricks runs get --run-id <run-id>
```

**Verify in ADLS:**
```bash
# List models in ADLS
az storage blob list \
  --account-name stwealtharenadev \
  --container-name rl-models \
  --prefix models/latest/ \
  --output table
```

**Expected Results:**
- ✅ Job completes successfully (may take 30-60 minutes)
- ✅ Models saved to ADLS `models/latest/` directory
- ✅ MLflow tracking shows training metrics
- ✅ Model files exist for each agent type (asx_stocks, crypto, forex, commodities, etfs)

### 2.4 Test RL Inference Job

**Objective:** Verify trading signals are generated.

```bash
# Trigger job
databricks jobs run-now --job-id <rl-inference-job-id>
```

**Verify in Azure SQL:**
```sql
-- Check RL signals
SELECT COUNT(*) as total_signals FROM rl_signals;

SELECT symbol, signal_type, confidence_score, entry_price 
FROM rl_signals 
ORDER BY date_time DESC;

SELECT signal_type, COUNT(*) as count 
FROM rl_signals 
GROUP BY signal_type;

EXIT
```

**Expected Results:**
- ✅ Job completes successfully
- ✅ `rl_signals` table has trading signals
- ✅ Signals have **BUY/SELL/HOLD** types
- ✅ Confidence scores are **between 0 and 1**

## Test 3: Integration Testing

### 3.1 Test Airflow → RL Service Communication

**Objective:** Verify Airflow DAGs can call RL service.

```bash
# Test RL service endpoint directly
curl -X POST http://localhost:5002/predict \
  -H "Content-Type: application/json" \
  -d '{"market_state": [[0.1, 0.2, 0.3]], "symbol": "AAPL", "asset_type": "stock"}'
```

**Expected Response:**
```json
{
  "signal": "BUY",
  "confidence": 0.75,
  "entry_price": 150.0,
  "stop_loss": 142.5,
  "take_profit_levels": [
    {
      "level": 1,
      "price": 165.0,
      "percent_gain": 10.0,
      "close_percent": 50
    }
  ]
}
```

**Verify from within Airflow container:**
```bash
docker-compose exec airflow-webserver curl http://rl-service:5002/health

docker-compose exec airflow-webserver curl -X POST http://rl-service:5002/predict \
  -H "Content-Type: application/json" \
  -d '{"market_state": [[0.1, 0.2, 0.3]], "symbol": "AAPL", "asset_type": "stock"}'
```

### 3.2 Test Data Consistency

**Objective:** Verify data between PostgreSQL and Azure SQL is consistent.

```bash
# Compare symbol counts
# PostgreSQL (Airflow)
docker-compose exec postgres psql -U wealtharena -d wealtharena -c \
  "SELECT COUNT(DISTINCT symbol) as symbol_count FROM market_data;"

# Azure SQL (Databricks)
sqlcmd -S sql-wealtharena-dev.database.windows.net -d wealtharena_db -U wealtharena_admin -P "WealthArena2024!@#$%" -Q \
  "SELECT COUNT(DISTINCT symbol) as symbol_count FROM market_data_ohlcv;"
```

**Note:** These databases serve different purposes:
- **PostgreSQL**: Airflow development/testing (local)
- **Azure SQL**: Production data storage (Databricks)

They may have different symbol counts initially. This is expected.

### 3.3 Test Job Dependencies

**Objective:** Verify Databricks jobs wait for dependencies.

```bash
# Trigger Data Load job
databricks jobs run-now --job-id <data-load-job-id>

# Immediately trigger Feature Engineering
databricks jobs run-now --job-id <feature-engineering-job-id>

# Check run status
databricks runs get --run-id <feature-engineering-run-id>
```

**Expected Behavior:**
- Feature Engineering run status should be **PENDING** initially
- Once Data Load completes, Feature Engineering starts
- Check job dependencies are configured in `setup_databricks_jobs.ps1`

**Note:** Job dependencies are configured in the PowerShell script. Verify they're set correctly.

## Test 4: Schedule Verification

### 4.1 Verify Airflow Schedules

```bash
# List DAG schedules
docker-compose exec airflow-webserver airflow dags list

# Check next run times
docker-compose exec airflow-webserver airflow dags next-execution 01_ingest_market_data
docker-compose exec airflow-webserver airflow dags next-execution 02_feature_engineering
docker-compose exec airflow-webserver airflow dags next-execution 04_generate_signals
```

**Expected Schedules:**
| DAG | Schedule | Description |
|-----|----------|-------------|
| 01_ingest_market_data | `0 6 * * *` | Daily at 6 AM UTC |
| 02_feature_engineering | `0 7 * * *` | Daily at 7 AM UTC |
| 03_train_rl_models | `0 0 * * 0` | Weekly Sunday at 2 AM UTC |
| 04_generate_signals | `0 8 * * *` | Daily at 8 AM UTC |

### 4.2 Verify Databricks Schedules

```bash
# List jobs with schedules
databricks jobs list --output JSON | grep -A 5 "settings"
```

**Expected Schedules:**
| Job | Schedule | Cron |
|-----|----------|------|
| Full Data Load | Daily at 6 AM UTC | `0 6 * * *` |
| Feature Engineering | Daily at 8 AM UTC | `0 8 * * *` |
| News Sentiment | Every 6 hours | `0 */6 * * *` |
| RL Training | Weekly Sunday | `0 0 * * 0` |
| RL Inference | Daily at 9 AM UTC | `0 9 * * *` |
| Portfolio Optimization | Daily at 9:30 AM UTC | `0 9:30 * * *` |

## Test 5: Error Handling

### 5.1 Test DAG Retry Logic

**Objective:** Verify DAGs retry on failure.

```bash
# Temporarily stop RL service
docker-compose stop rl-service

# Trigger signal generation DAG (should fail and retry)
docker-compose exec airflow-webserver airflow dags trigger 04_generate_signals

# Monitor retries
docker-compose logs -f airflow-scheduler
```

**Expected Behavior:**
- Task `check_rl_service_health` fails
- Airflow retries up to 3 times (`retries: 3`)
- Each retry waits 5 minutes (`retry_delay: timedelta(minutes=5)`)

**Recovery:**
```bash
# Restart RL service
docker-compose start rl-service

# DAG should eventually succeed after retries
```

### 5.2 Test Databricks Job Failure Handling

**Objective:** Verify jobs fail gracefully.

```bash
# Trigger job with invalid parameters
databricks jobs run-now --job-id <job-id> --notebook-params '{"invalid_param": "value"}'

# Check job status
databricks runs get --run-id <run-id>
```

**Expected Behavior:**
- Job status should be **FAILED**
- Error logs show why job failed
- Check error logs in Databricks UI

**View Logs:**
1. Go to Workflows → Job → Run
2. Click on failed task
3. View **Stderr** and **Stdout** logs

## Test 6: Performance Validation

### 6.1 Measure DAG Execution Times

```bash
# Get DAG run durations
docker-compose exec airflow-webserver airflow dags list-runs -d 01_ingest_market_data --output json | jq '.[] | {start: .start_date, end: .end_date, duration: .duration}'
```

**Expected Durations:**
| DAG | Expected Duration |
|-----|------------------|
| 01_ingest_market_data | < 5 minutes |
| 02_feature_engineering | < 2 minutes |
| 04_generate_signals | < 3 minutes |

### 6.2 Measure Databricks Job Execution Times

```bash
# Get job run durations
databricks runs list --job-id <job-id> --output JSON | jq '.runs[] | {start: .start_time, end: .end_time, duration: (.end_time - .start_time)}'
```

**Expected Durations:**
| Job | Expected Duration (Quick Mode) |
|-----|--------------------------------|
| Quick Data Load | 10-15 minutes |
| Feature Engineering | 5-10 minutes |
| RL Training | 30-60 minutes |
| RL Inference | 5-10 minutes |

**Note:** Full production runs may take longer.

## Troubleshooting Common Issues

### Issue: Airflow DAG fails with "Connection not found"

**Solution:**
```bash
docker-compose exec airflow-webserver airflow connections add postgres_default \
  --conn-uri postgresql+psycopg2://wealtharena:wealtharena123@postgres:5432/wealtharena
```

### Issue: Databricks job fails with "Secret not found"

**Solution:**
```bash
# Verify secrets exist
databricks secrets list --scope wealtharena

# Recreate missing secrets
databricks secrets put --scope wealtharena --key <key-name> --string-value "<value>"
```

### Issue: RL service not reachable from Airflow

**Solution:**
```bash
# Check service status
docker-compose ps rl-service

# Check network connectivity
docker-compose exec airflow-webserver curl http://rl-service:5002/health

# Restart service if needed
docker-compose restart rl-service
```

### Issue: Data not syncing between PostgreSQL and Azure SQL

**Note:** This is expected. The two databases serve different purposes:
- **PostgreSQL**: Airflow development/testing
- **Azure SQL**: Production data storage

For production, consider:
1. Modifying Airflow DAGs to write directly to Azure SQL
2. Creating a sync job to copy data from PostgreSQL to Azure SQL
3. Using Databricks as the primary data pipeline and Airflow for orchestration only

## Success Criteria

✅ **Airflow Pipeline:**
- [ ] All 4 DAGs execute successfully
- [ ] Data appears in PostgreSQL tables
- [ ] RL service responds to signal generation requests
- [ ] Schedules are configured correctly
- [ ] Dependencies between DAGs work correctly

✅ **Databricks Pipeline:**
- [ ] All 7 jobs execute successfully
- [ ] Data appears in Azure SQL tables
- [ ] Models are saved to ADLS
- [ ] MLflow tracking shows training metrics
- [ ] Job dependencies work correctly
- [ ] Schedules are configured correctly

✅ **Integration:**
- [ ] Airflow can communicate with RL service
- [ ] Databricks can access Azure SQL and ADLS
- [ ] Schedules don't conflict
- [ ] Error handling and retries work as expected
- [ ] Performance is within acceptable ranges

## Next Steps

✅ **Phase 3 Complete!**

Proceed to:
- **Phase 4: Backend API Deployment**
- **Monitor pipeline execution for 1 week**
- **Set up alerting for job failures**
- **Optimize cluster configurations**
- **Configure production schedules**

## Test Checklist

Print this checklist and mark items as completed:

### Airflow DAGs
- [ ] 01_ingest_market_data runs successfully
- [ ] 02_feature_engineering runs successfully
- [ ] 04_generate_signals runs successfully
- [ ] DAG dependencies work correctly
- [ ] Schedules are configured
- [ ] Retry logic works

### Databricks Jobs
- [ ] Quick Data Load runs successfully
- [ ] Feature Engineering runs successfully
- [ ] RL Training runs successfully
- [ ] RL Inference runs successfully
- [ ] Jobs save data to Azure SQL
- [ ] Jobs save models to ADLS
- [ ] Schedules are configured

### Integration
- [ ] Airflow → RL Service works
- [ ] Databricks → Azure SQL works
- [ ] Databricks → ADLS works
- [ ] Schedules don't conflict
- [ ] Error handling works

### Performance
- [ ] DAG execution times acceptable
- [ ] Job execution times acceptable
- [ ] No memory issues
- [ ] No timeout issues

