# WealthArena Overnight Training Pipeline Guide

## Overview

Automated pipeline that downloads 3 years of market data for all asset classes and trains 5 specialized RL agents targeting 70%+ win rate. Designed to run overnight on local PC without cloud credits.

## Prerequisites

- ✅ Azure infrastructure provisioned (Phase 1 complete)
- ✅ Database schema deployed (azure_sql_schema.sql)
- ✅ Python 3.8+ installed with all dependencies
- ✅ Minimum 8GB RAM, 4+ CPU cores
- ✅ 10GB free disk space
- ✅ Stable internet connection (for data download)

## Pipeline Phases

### Phase 1: Market Data Download (2-4 hours)

**What Happens:**

1. Downloads ASX stocks (50 symbols, 3 years) → ~20 minutes
2. Downloads crypto (20 symbols, 3 years) → ~5 minutes
3. Downloads forex (7 pairs, 3 years) → ~3 minutes
4. Downloads commodities (17 symbols, 3 years) → ~5 minutes
5. Processes all data with technical indicators → ~20 minutes
6. Loads into Azure SQL processed_prices table → ~15 minutes
7. Exports to CSV for RL training → ~10 minutes

**Total: 80-90 minutes**

**Output:**

- Raw CSVs: `Financial_Assets_Pipeline/data/raw/` (94 files)
- ADLS uploads: `raw/asxStocks/`, `raw/crypto/`, `raw/forex/`, `raw/commodities/`
- Azure SQL: ~70K rows in processed_prices table
- Training CSVs: `wealtharena_rl/data/processed/` organized by asset class

### Phase 2: RL Model Training (4-8 hours)

**What Happens:**

1. Loads processed CSVs from Phase 1
2. Initializes Ray with 4 workers
3. For each asset class (5 total):
   - Creates trading environment with real data
   - Trains PPO agent for 500 iterations (~30-60 min per agent)
   - Tracks metrics with MLflow
   - Saves checkpoint every 25 iterations
   - Early stops if target reward achieved
4. Generates comparison report
5. Saves results to `results/master_comparison/`

**Total: 2.5-5 hours**

**Output:**

- Checkpoints: `wealtharena_rl/checkpoints/{asset_class}/` (5 directories)
- Results: `results/master_comparison/comparison_report.json`
- Logs: `logs/master_training.log`
- MLflow: Experiment tracking at http://localhost:5000 (if running)

### Phase 3: Validation (30 minutes)

**What Happens:**

1. Runs comprehensive backtesting on trained models
2. Calculates win rate, Sharpe ratio, max drawdown for each agent
3. Validates win rate ≥70% requirement
4. Generates validation report

**Output:**

- Validation report: `results/master_comparison/validation_report.json`
- Pass/fail status for each agent

### Phase 4: Checkpoint Deployment (5 minutes)

**What Happens:**

1. Copies best checkpoints from `wealtharena_rl/checkpoints/`
2. Deploys to `services/rl-service/models/latest/`
3. Verifies all 5 checkpoints deployed

**Output:**

- Deployed checkpoints: `services/rl-service/models/latest/` (5 directories)
- Deployment summary: `CHECKPOINT_DEPLOYMENT_SUMMARY.txt`

## Execution Instructions

### Before Starting (5 minutes)

**1. Verify Prerequisites:**

```bash
# Check Python version
python --version  # Should be 3.8+

# Check dependencies installed
pip list | grep -E "ray|torch|pandas|yfinance"

# Check disk space
dir  # Ensure 10GB+ free

# Check Azure connection
az account show  # Verify logged in
```

**2. Verify Azure Resources:**

```bash
cd azure_infrastructure
.\verify_resources.ps1

# Expected: All resources exist
```

**3. Check Environment Files:**

- Verify `Financial_Assets_Pipeline/azureCred.env` has Azure Storage connection string
- Verify `Financial_Assets_Pipeline/sqlDB.env` has Azure SQL credentials
- Verify `wealtharena_rl/config/quick_training.yaml` exists

### Starting the Pipeline (1 minute)

**Execute:**

```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI"
run_full_training_pipeline.bat
```

**Confirm Execution:**

- Press any key when prompted
- Pipeline starts automatically
- Multiple terminal windows open (one per phase)
- Leave PC running overnight

### Monitoring Progress (Optional)

**Check Logs:**

- Data download: `tail -f Financial_Assets_Pipeline/logs/data_download.log`
- Training: `tail -f wealtharena_rl/logs/master_training.log`
- Pipeline: `tail -f logs/pipeline_execution.log`

**Check MLflow UI (Optional):**

- Start MLflow: `cd wealtharena_rl && mlflow ui --port 5000`
- Open browser: http://localhost:5000
- View real-time training metrics

### Morning Verification (10 minutes)

**1. Check Pipeline Summary:**

- Open: `OVERNIGHT_PIPELINE_SUMMARY.txt`
- Verify: All phases completed successfully
- Check: Total execution time (should be 6-10 hours)

**2. Verify Data Downloaded:**

```bash
# Check raw CSVs
dir Financial_Assets_Pipeline\data\raw\*.csv

# Expected: 94 files (50 ASX + 20 crypto + 7 forex + 17 commodities)

# Check Azure SQL
sqlcmd -S sql-wealtharena-jg1ve2.database.windows.net -d wealtharena_db -U wealtharena_admin -Q "SELECT COUNT(*) FROM processed_prices"

# Expected: ~70,000 rows
```

**3. Verify Models Trained:**

```bash
# Check checkpoints
dir wealtharena_rl\checkpoints\asx_stocks
dir wealtharena_rl\checkpoints\cryptocurrencies
dir wealtharena_rl\checkpoints\currency_pairs
dir wealtharena_rl\checkpoints\commodities
dir wealtharena_rl\checkpoints\etf

# Expected: Each directory has checkpoint files

# Check results
type results\master_comparison\comparison_report.json

# Expected: JSON with win rates for all 5 agents
```

**4. Verify Win Rates:**

```bash
python scripts/training_verification.py

# Expected: "✅ All agents meet 70%+ win rate requirement!"
```

**5. Verify Checkpoints Deployed:**

```bash
dir services\rl-service\models\latest

# Expected: 5 checkpoint directories
```

## Troubleshooting

### Issue: Data download fails

**Symptoms:** No CSV files in data/raw/, download logs show errors

**Solutions:**

1. Check internet connection
2. Verify Yahoo Finance API accessible: `curl https://query1.finance.yahoo.com/v8/finance/chart/AAPL`
3. Increase sleep time between batches (reduce rate limiting)
4. Retry failed symbols: Check `logs/failed_symbols.txt` and re-run specific downloader

### Issue: Azure SQL connection timeout

**Symptoms:** processAndStore.py fails with connection errors

**Solutions:**

1. Verify firewall rules: `az sql server firewall-rule list --server sql-wealtharena-jg1ve2`
2. Add your IP: Run `scripts/azure_deployment/configure_sql_firewall.ps1`
3. Test connection: `sqlcmd -S sql-wealtharena-jg1ve2.database.windows.net -U wealtharena_admin -Q "SELECT 1"`

### Issue: Training fails to start

**Symptoms:** Ray initialization errors, import errors

**Solutions:**

1. Verify dependencies: `pip install -r wealtharena_rl/requirements.txt`
2. Check Ray version: `pip show ray` (should be 2.9.0)
3. Verify data exists: `dir wealtharena_rl\data\processed\stocks\*.csv`
4. Check logs: `type wealtharena_rl\logs\master_training.log`

### Issue: Out of memory during training

**Symptoms:** Training crashes, "MemoryError" in logs

**Solutions:**

1. Reduce workers: Edit `quick_training.yaml`, change `num_workers: 4` to `num_workers: 2`
2. Reduce batch size: Change `train_batch_size: 4000` to `train_batch_size: 2000`
3. Close other applications to free RAM
4. Restart PC and try again

### Issue: Win rate below 70%

**Symptoms:** Validation shows agents with <70% win rate

**Solutions:**

1. Review training logs for convergence issues
2. Adjust reward weights in `quick_training.yaml`:
   - Increase `trend_reversal: 3.0`
   - Increase `win_rate_bonus: 3.0`
   - Decrease `profit: 2.0` (focus on consistency over max profit)
3. Retrain specific agent: `python src/training/master_trainer.py --mode=train --local --asset-class asx_stocks`
4. Increase training iterations: Change `max_iterations: 500` to `max_iterations: 1000`

### Issue: Checkpoint deployment fails

**Symptoms:** No checkpoints in services/rl-service/models/latest/

**Solutions:**

1. Verify checkpoints exist: `dir wealtharena_rl\checkpoints\asx_stocks`
2. Check permissions: Ensure write access to services/rl-service/models/
3. Manually copy: `xcopy /E /I wealtharena_rl\checkpoints\asx_stocks services\rl-service\models\latest\asx_stocks_checkpoint`

## Success Criteria

**Pipeline Successful If:**

- ✅ All 4 asset class downloaders completed (ASX, crypto, forex, commodities)
- ✅ processAndStore.py loaded data into Azure SQL
- ✅ All 5 RL agents trained without errors
- ✅ All 5 agents have win rate ≥70%
- ✅ All 5 checkpoints deployed to inference service
- ✅ Total execution time 6-10 hours

**Partial Success (Acceptable for Demo):**

- ⚠️ 3-4 agents meet 70% win rate (retrain failing agents)
- ⚠️ Some symbols failed to download (acceptable if >80% success rate)
- ⚠️ Training took longer than expected (acceptable if completed)

**Failure (Requires Investigation):**

- ❌ No data downloaded (check internet, Yahoo Finance API)
- ❌ Training didn't start (check dependencies, data availability)
- ❌ All agents below 70% win rate (review reward configuration)
- ❌ Pipeline crashed (check logs, system resources)

## Next Steps After Successful Pipeline

**Immediate (Same Morning):**

1. Review `OVERNIGHT_PIPELINE_SUMMARY.txt`
2. Check win rates in `comparison_report.json`
3. Verify checkpoints deployed
4. Test RL service locally: `cd services/rl-service && python api/inference_server.py`
5. Test prediction endpoint: `curl -X POST http://localhost:5002/predict -d '{"symbol": "BHP.AX"}'`

**Next Phase (Phase: Start All Local Services):**

1. Run `start_all_services.bat` to start backend, chatbot, RL service
2. Test all services healthy
3. Test frontend with local backend
4. Verify signals display from trained models

**Subsequent Phases:**

1. Deploy to Azure Web Apps (Phase: Deploy All Services)
2. Update frontend config with Azure URLs
3. Build Android APK
4. Final testing and demo preparation

---

**Pipeline Status:** Ready for overnight execution

**Estimated Completion:** 6-10 hours (start at 10 PM, complete by 6-8 AM)

**Recommended:** Start on Friday night, check Saturday morning, have weekend for fixes if needed

