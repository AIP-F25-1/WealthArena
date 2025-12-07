# Phase 7: RL Model Training (Local PC - 70%+ Win Rate Target)

## Overview

This phase trains 5 specialized RL trading agents locally on your PC using Ray RLlib PPO algorithm with real market data from Phase 2. The training targets 70%+ win rate through sophisticated reward shaping, comprehensive backtesting validation, and signal tracking integration with Azure SQL Database.

## Prerequisites

- ✅ Phase 2 completed: Market data loaded in `wealtharena_rl/data/processed/`
- ✅ Phase 4 completed: Backend API with Azure SQL Database
- ✅ Python 3.8+ installed
- ✅ Minimum 8GB RAM (16GB recommended)
- ✅ 4+ CPU cores
- ✅ 10GB free disk space (for checkpoints and logs)

## Architecture

```
RL Training Pipeline (Local PC)

├── Data: Phase 2 CSVs (80+ symbols, 3 years)
├── Ray RLlib PPO (4 workers, 100K timesteps)
│   ├── ASX Stocks Agent (30 symbols)
│   ├── Crypto Agent (10 symbols)
│   ├── Forex Agent (7 pairs)
│   ├── Commodities Agent (7 symbols)
│   └── ETF Agent (3 symbols)
├── Custom Environment (WealthArenaTradingEnv)
│   ├── 8-Component Reward Function
│   ├── Trend Reversal Rewards
│   ├── Risk Management Constraints
│   └── Win Rate Tracking
├── MLflow Tracking (Local Server)
├── Backtesting Validation (≥70% Win Rate)
└── Checkpoint Deployment
```

## Step-by-Step Setup

### Step 1: Install Dependencies

**Update requirements.txt with complete dependencies:**

The current `requirements.txt` only has 3 packages. Update it with 23 packages including Ray, PyTorch, gymnasium, pandas, stable-baselines3, talib, mlflow, etc.

**Install all dependencies:**

```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/wealtharena_rl"
pip install -r requirements.txt
```

**Expected Duration:** 10-15 minutes (Ray and PyTorch are large packages ~2GB total)

**Special Note on TA-Lib:**

TA-Lib requires binary installation on Windows:

1. Download wheel from https://www.lfd.uci.edu/~gohlke/pythonlibs/#ta-lib
2. Install: `pip install TA_Lib-0.4.28-cp39-cp39-win_amd64.whl`
3. Or skip TA-Lib (environment will use pandas-based indicators)

**Verification:**

```bash
pip list | grep -E "ray|torch|gymnasium|mlflow|pandas"
```

Should show:

```
gymnasium          0.29.1
mlflow             2.9.0
pandas             2.1.0
ray                2.9.0
torch              2.1.0
```

---

### Step 2: Start MLflow Tracking Server (Optional but Recommended)

**Start MLflow UI:**

```bash
cd wealtharena_rl
mlflow ui --host 0.0.0.0 --port 5000
```

**Access MLflow UI:**

Open browser: `http://localhost:5000`

This allows you to monitor training progress in real-time.

**Note:** MLflow is optional. Training will work without it, but you won't have web UI for monitoring.

---

### Step 3: Configure Quick Training

**File:** `wealtharena_rl/config/quick_training_config.yaml`

This config is optimized for fast local training:

- 4 workers (parallel training)
- 500 iterations (≈100K timesteps)
- Reduced batch sizes for speed
- Win rate optimization
- Early stopping enabled

**Key Settings:**

```yaml
training:
  algorithm: PPO
  max_iterations: 500
  learning_rate: 0.0003
  target_win_rate: 0.70

resources:
  num_workers: 4
  num_cpus_per_worker: 1
  num_gpus: 0

reward_weights:
  profit: 3.0
  risk: 1.0
  trend_reversal: 2.5
  win_rate_bonus: 2.0
```

**No manual editing needed** - file is created with optimal settings.

---

### Step 4: Verify Data Availability

**Check processed data exists:**

```bash
dir wealtharena_rl\data\processed\stocks\*.csv
dir wealtharena_rl\data\processed\crypto\*.csv
dir wealtharena_rl\data\processed\forex\*.csv
dir wealtharena_rl\data\processed\commodities\*.csv
dir wealtharena_rl\data\processed\etfs\*.csv
```

**Expected:** 80+ CSV files total across all asset classes

**If data missing:** Run Phase 2 data pipeline first:

```bash
cd Financial_Assets_Pipeline
python run_all_downloaders.py
python processAndStore.py
python export_to_rl_training.py
```

---

### Step 5: Run RL Model Training

**Method 1: Using Batch File (Recommended)**

```bash
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI/scripts/rl_training"
run_training.bat
```

**Method 2: Direct Python Execution**

```bash
cd wealtharena_rl
python src/training/master_trainer.py --mode=train --local --config config/quick_training_config.yaml
```

**What Happens:**

1. Ray initializes with 4 workers
2. For each asset class (5 total):
   - Loads processed CSVs from Phase 2
   - Creates trading environment with real data
   - Trains PPO agent for 500 iterations (~30-60 min)
   - Tracks metrics with MLflow
   - Saves checkpoint to `checkpoints/{asset_class}/`
3. Generates comparison report
4. Saves results to `results/master_comparison/`

**Expected Output:**

```
🚀 Starting Master Training Pipeline...
============================================================

📚 STEP 1: Training All Agents

🚀 Training ASX Stocks Agent...
Loading real data for 30 symbols from data/processed/stocks/...
✅ Loaded 756 days of data (2022-01-01 to 2025-01-01)
Initializing Ray RLlib PPO with 4 workers...

Training Progress:
+---------------------+------------+----------------+-------------+----------+
| Trial name          | iter       | reward_mean    | win_rate    | time_s   |
+=====================+============+================+=============+==========+
| PPO_asx_stocks      | 50         | 123.45         | 0.65        | 180.2    |
| PPO_asx_stocks      | 100        | 187.32         | 0.71        | 360.5    |
| PPO_asx_stocks      | 150        | 234.56         | 0.73        | 540.8    |
+---------------------+------------+----------------+-------------+----------+

✅ ASX Stocks training completed. Final reward: 245.67, Win rate: 73.2%
Checkpoint saved: checkpoints/asx_stocks/asx_stocks/asx_stocks_20250115_103045

🚀 Training Crypto Agent...
[Similar output for crypto...]

🚀 Training Forex Agent...
[Similar output for forex...]

🚀 Training Commodities Agent...
[Similar output for commodities...]

🚀 Training ETF Agent...
[Similar output for etfs...]

📊 STEP 2: Backtesting All Agents
[Backtesting output...]

📈 STEP 3: Generating Comparison Report

📋 STEP 4: Results Summary

================================================================================
MASTER AGENT COMPARISON RESULTS
================================================================================

📊 SUMMARY:
  Total Agents: 5
  Successful: 5
  Failed: 0

🏆 AGENT RANKINGS (by composite score):
  1. Forex Pairs: 8.45
  2. Crypto: 7.92
  3. ASX Stocks: 7.68
  4. ETF: 7.23
  5. Commodities: 6.89

📈 PERFORMANCE COMPARISON:
Agent                Return     Sharpe   Drawdown   Win Rate  
----------------------------------------------------------------------
ASX Stocks           18.50%     1.85     -12.30%    73.20%    
Crypto               22.30%     2.12     -15.60%    71.80%    
Forex Pairs          19.80%     1.92     -10.50%    73.50%    
Commodities          16.20%     1.67     -14.20%    70.20%    
ETF                  20.10%     2.05     -11.80%    74.10%    

🥇 BEST PERFORMING AGENT: Forex Pairs

💾 STEP 5: Saving Results
✅ All results saved to: results/master_comparison

✅ Master Training Pipeline Completed!
📁 Results saved to: results/master_comparison
```

**Estimated Duration:**

- ASX Stocks: 45-60 minutes (30 symbols)
- Crypto: 30-40 minutes (10 symbols)
- Forex: 25-35 minutes (7 pairs)
- Commodities: 25-35 minutes (7 symbols)
- ETF: 20-30 minutes (3 symbols)
- **Total: 2.5-4 hours**

---

### Step 6: Run Backtesting Validation

**Execute backtesting:**

```bash
cd scripts/rl_training
run_backtesting.bat
```

**What it validates:**

- Win rate ≥70% for each agent
- Sharpe ratio ≥1.5
- Max drawdown ≤15%
- Profit factor ≥1.5

**If validation fails:**

1. Review training logs in `wealtharena_rl/logs/training.log`
2. Check MLflow UI for metric trends
3. Adjust reward weights in `quick_training_config.yaml`
4. Retrain specific agent: `python src/training/master_trainer.py --mode=train --local --asset-class asx_stocks`

---

### Step 7: Store Top Signals in Azure SQL

**Execute signal storage:**

```bash
cd scripts/rl_training
python store_top_signals.py --top-n 10 --min-confidence 0.6
```

**What it does:**

- Loads all 5 trained models
- Queries latest market data from Azure SQL
- Generates predictions for all symbols
- Ranks signals by composite score
- Stores top 50 signals (10 per asset class) in `rl_signals` table

**Verification:**

```sql
-- Connect to Azure SQL
SELECT 
    asset_class,
    signal_type,
    COUNT(*) as signal_count,
    AVG(confidence_score) as avg_confidence,
    AVG(risk_reward_ratio) as avg_risk_reward
FROM dbo.rl_signals
WHERE date_time >= DATEADD(day, -1, GETDATE())
GROUP BY asset_class, signal_type;
```

---

### Step 8: Deploy Checkpoints to Inference Service

**Execute deployment:**

```bash
cd scripts/rl_training
deploy_checkpoints.bat
```

**What it does:**

- Copies best checkpoint for each asset class
- Deploys to `services/rl-service/models/latest/`
- Creates standardized filenames (asx_stocks_model.pt, crypto_model.pt, etc.)

**Restart inference service:**

```bash
cd services/rl-service
run_rl_service.bat
```

The service will now use trained models instead of mock predictions!

---

## Monitoring Training Progress

### Real-Time Monitoring (MLflow UI)

1. Open `http://localhost:5000`
2. Navigate to "WealthArena_Quick_Training" experiment
3. View metrics:
   - episode_reward_mean (should increase over time)
   - custom_metrics/win_rate (target: ≥0.70)
   - custom_metrics/sharpe_ratio (target: ≥1.5)
   - custom_metrics/max_drawdown (target: ≤0.15)

### Console Monitoring

Training progress is displayed in console with:

- Current iteration / total iterations
- Mean reward
- Win rate
- Time elapsed

### Log Files

- Training logs: `wealtharena_rl/logs/training.log`
- Ray logs: `wealtharena_rl/logs/ray/`
- MLflow logs: `wealtharena_rl/mlruns/`

---

## Troubleshooting

### Issue: Ray initialization fails

**Solution:**

```bash
# Check Ray version
pip show ray

# Reinstall Ray
pip uninstall ray
pip install ray[rllib]==2.9.0
```

### Issue: Out of memory during training

**Solution:**

Reduce batch sizes in `quick_training_config.yaml`:

```yaml
training:
  train_batch_size: 2000  # Reduce from 4000
  sgd_minibatch_size: 64  # Reduce from 128

resources:
  num_workers: 2  # Reduce from 4
```

### Issue: Training too slow

**Solution:**

Reduce max_iterations:

```yaml
training:
  max_iterations: 250  # Reduce from 500
```

This gives ~50K timesteps, still sufficient for basic training.

### Issue: Win rate below 70%

**Solution:**

Adjust reward weights to prioritize win rate:

```yaml
reward_weights:
  profit: 2.0  # Reduce
  trend_reversal: 3.0  # Increase
  win_rate_bonus: 3.0  # Increase
```

Retrain the specific agent.

### Issue: Data loading fails

**Solution:**

Verify processed CSVs exist:

```bash
dir wealtharena_rl\data\processed\stocks\*.csv
```

If missing, run Phase 2 data pipeline.

### Issue: MLflow connection error

**Solution:**

MLflow is optional. Disable in config:

```yaml
experiment_tracking:
  mlflow:
    enabled: false
```

---

## Training Results

### Checkpoints Location

```
wealtharena_rl/checkpoints/
├── asx_stocks/asx_stocks/
│   ├── asx_stocks_20250115_103045_model.pt
│   ├── asx_stocks_20250115_103045_training.pkl
│   ├── asx_stocks_20250115_103045_optimizer.pkl
│   ├── asx_stocks_20250115_103045_metadata.json
│   └── latest_checkpoint.json
├── cryptocurrencies/cryptocurrencies/
│   └── [similar structure]
├── currency_pairs/currency_pairs/
│   └── [similar structure]
├── commodities/commodities/
│   └── [similar structure]
└── etf/etf/
    └── [similar structure]
```

### Results Location

```
wealtharena_rl/results/master_comparison/
├── comparison_report.json
├── master_summary.json
├── asx_stocks/
│   └── evaluation_report.json
├── cryptocurrencies/
│   └── evaluation_report.json
├── currency_pairs/
│   └── evaluation_report.json
├── commodities/
│   └── evaluation_report.json
└── etf/
    └── evaluation_report.json
```

### Metrics to Review

**comparison_report.json:**

- Agent rankings by composite score
- Performance comparison table
- Best/worst performing agents

**{agent_name}/evaluation_report.json:**

- Total return, annual return, volatility
- Sharpe ratio, max drawdown
- **Win rate** (must be ≥70%)
- Profit factor
- Benchmark comparison (vs SPY/QQQ)

---

## Next Steps

After completing Phase 7:

1. ✅ Verify all 5 agents trained successfully
2. ✅ Validate win rate ≥70% for each agent
3. ✅ Review training results in MLflow UI
4. ✅ Store top signals in Azure SQL
5. ✅ Deploy checkpoints to inference service
6. ➡️ Proceed to Phase 8: Frontend Integration
7. ➡️ Test end-to-end: Frontend → Backend → RL Service → Trained Models

## Success Criteria

✅ **Dependencies Installed:**

- All 23 packages installed successfully
- Ray, PyTorch, gymnasium working

✅ **Training Completed:**

- All 5 agents trained without errors
- Checkpoints saved for each agent
- MLflow tracking shows metrics

✅ **Win Rate Target Met:**

- ASX Stocks: ≥70% win rate
- Crypto: ≥70% win rate
- Forex: ≥70% win rate
- Commodities: ≥70% win rate
- ETF: ≥70% win rate

✅ **Backtesting Validated:**

- Comprehensive backtest reports generated
- All agents meet performance targets
- No critical issues identified

✅ **Signals Stored:**

- Top 50 signals in Azure SQL `rl_signals` table
- Signals have proper TP/SL levels
- Risk metrics calculated

✅ **Checkpoints Deployed:**

- All 5 models copied to `services/rl-service/models/latest/`
- Inference service can load models
- Mock predictions replaced with real model inference

**Phase 7 Status:** ✅ Ready for Frontend Integration

**Total Time Investment:** 3-5 hours (mostly automated training)

