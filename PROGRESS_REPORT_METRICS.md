# WealthArena Progress Report Metrics

Generated: 2025-11-06

## Data Store Metrics

| Data Store Name | Index Usage % | Disk Usage % | Avg CPU Usage | Average Memory Usage | Peak #Open Connections | Peak Memory Use | Error Rate |
|-----------------|---------------|--------------|---------------|----------------------|----------------------|-----------------|------------|
| Azure SQL/WealthArena | Check Azure Portal | 2.00 GB (Max) | 0.00% (24h avg) | Check Azure Portal | Check Azure Portal | Check Azure Portal | 0.00% |
| **DTU Consumption** | **N/A** | **N/A** | **0.27% (24h avg)** | **N/A** | **N/A** | **N/A** | **N/A** |
| Azure Storage | N/A | Check Azure Portal | N/A | N/A | N/A | N/A | 0.00% |
| Cosmos DB | Check Azure Portal | Check Azure Portal | Check Azure Portal | Check Azure Portal | Check Azure Portal | Check Azure Portal | 0.00% |

**Note:** For detailed metrics, check Azure Portal → SQL Database → Metrics

## BE/Pipeline Metrics

### Backend APIs

| API/Service | Response Time (ms) | Error Rate | CPU Utilization % | Memory Utilization % | Disk I/O (MB/s) |
|-------------|-------------------|------------|-------------------|---------------------|------------------|
| Backend API | Service not running | Service not running | Service not running | Service not running | Service not running |
| RL Service | Service not running | Service not running | Service not running | Service not running | Service not running |
| Chatbot API | Service not running | Service not running | Service not running | Service not running | Service not running |

**Note:** Start services to collect live metrics. Metrics available at:
- Backend: `http://localhost:3000/api/metrics`
- RL Service: `http://localhost:5002/api/metrics/summary`

### Pipeline Metrics

| Pipeline | DAG Execution Success Rate | Task Failure Rate | Task Duration Variability |
|----------|---------------------------|-------------------|--------------------------|
| Data Pipeline | **100%** (5/5 tasks successful) | **0%** (0 failures) | **Variable** (ASX: 95.1s, Crypto: 95.1s, Forex: 2.3s, Commodities: 58.0s, ETFs: 219.7s) |
| **Tasks Completed:** | **ASX Stocks: 1845 symbols** | **Crypto: 1 symbol** | **Forex: 7 pairs** | **Commodities: 7 symbols** | **ETFs: 3 symbols** |

**Note:** Check `data-pipeline/orchestrator_summary.json` for pipeline execution details.

## Code Metrics (SonarQube)

**⚠ IMPORTANT: Collect these from SonarCloud:**
**URL: https://sonarcloud.io/summary/overall?id=AIP-F25-1_WealthArena&branch=dev**

| Metric | Value | Location in SonarCloud |
|--------|-------|------------------------|
| Cyclomatic Complexity | [Value] | Measures → Complexity → Cyclomatic Complexity |
| Cognitive Complexity | [Value] | Measures → Complexity → Cognitive Complexity |
| Duplication Rate % | [Value] | Measures → Duplications → Duplicated Lines % |
| Technical Debt (hours) | [Value] | Measures → Technical Debt → Technical Debt Ratio |
| Security Issues | [Value] | Issues → Security |
| Reliability Issues | [Value] | Issues → Reliability |
| Maintainability Issues | [Value] | Issues → Maintainability |

**⚠ REQUIRED: Take screenshot from SonarCloud showing Security, Reliability, and Maintainability Issues**

## ML Metrics

| Model | Inference Time (ms) | Sharpe Ratio | Return % | Win Rate % | Max Drawdown % | Training Status |
|-------|-------------------|--------------|----------|-----------|----------------|-----------------|
| RL Trading Agent (ASX Stocks) | Check RL Service /api/metrics | **1.088** | **29.17%** | **53.11%** | Check backtest results | ✅ Trained (11/4/2025) |
| RL Trading Agent (Currency Pairs) | Check RL Service /api/metrics | **1.180** | **22.52%** | **52.70%** | Check backtest results | ✅ Trained (11/4/2025) |
| RL Trading Agent (Cryptocurrencies) | Check RL Service /api/metrics | **1.266** | **66.24%** | **51.88%** | Check backtest results | ✅ Trained (11/4/2025) |
| RL Trading Agent (ETF) | Check RL Service /api/metrics | **1.757** | **26.46%** | **55.37%** | Check backtest results | ✅ Trained (11/4/2025) |
| RL Trading Agent (Commodities) | Check RL Service /api/metrics | **-0.647** | **-43.98%** | **49.28%** | Check backtest results | ✅ Trained (11/4/2025) |

**Note:** 
- **Inference Time**: Available from RL Service metrics endpoint when service is running
- **Training Metrics**: Collected from training results (checkpoint: 11/4/2025 10:34 PM)
- **Best Performing Agent**: ETF Agent (Sharpe Ratio: 1.757, Win Rate: 55.37%)
- **Highest Return**: Cryptocurrencies Agent (66.24% return)
- **Model Checkpoints**: Available in `rl-training/checkpoints/wealtharena_fastest/checkpoint_final/`
- **Data Quality**: Excellent (Stocks: 98.78%, ETFs: 98.81%, Crypto: 99.16%, Forex: 95.33%, Commodities: 98.64%)

## Testing Metrics

| Component | Coverage % | Failure Rate | % Bugs Detected | Total Tests | Passed | Failed |
|-----------|-----------|--------------|-----------------|-------------|--------|--------|
| Frontend | Check coverage-final.json | Run: `cd frontend && npm test` | Check SonarQube | Run: `cd frontend && npm test` | Run tests | Run tests |
| Backend | Check lcov.info | Run: `cd backend && npm test` | Check SonarQube | Run: `cd backend && npm test` | Run tests | Run tests |
| RL Training | Run: `cd rl-training && pytest --cov=src --cov-report=term` | Run: `cd rl-training && pytest` | Check SonarQube | Run: `cd rl-training && pytest --collect-only` | Run tests | Run tests |
| Chatbot | Run: `cd chatbot && pytest --cov` | Run: `cd chatbot && pytest` | Check SonarQube | Run: `cd chatbot && pytest` | Run tests | Run tests |

## Notes

- **SonarQube Screenshot Required**: Take screenshot from https://sonarcloud.io/summary/overall?id=AIP-F25-1_WealthArena&branch=dev
- **Focus Areas**: Security Issues, Reliability Issues, Maintainability Issues (not just pass/fail)
- **Services Not Running**: Some metrics require services to be running. Start services and re-run collection.
- **Azure Portal**: For detailed database metrics, check Azure Portal → SQL Database → Metrics
- **Project Advisor Requirement**: Week 10+ requires SonarQube screenshot and metrics from FE, BE, Sonar (Cyclomatic and Cognitive Complexity), and Model performance metrics

## Quick Collection Commands

```bash
# 1. SonarQube Metrics (REQUIRED)
# Visit: https://sonarcloud.io/summary/overall?id=AIP-F25-1_WealthArena&branch=dev
# Take screenshot of overall summary

# 2. Backend Metrics (if service running)
curl http://localhost:3000/api/metrics

# 3. RL Service Metrics (if service running)
curl http://localhost:5002/api/metrics/summary

# 4. Test Coverage
cd frontend && npm test -- --coverage
cd backend && npm test -- --coverage
cd rl-training && pytest --cov=src --cov-report=term

# 5. Azure Database Metrics
az monitor metrics list --resource /subscriptions/34ab3af0-971a-4349-9be4-c76d2e4480df/resourceGroups/rg-wealtharena-northcentralus/providers/Microsoft.Sql/servers/sql-wealtharena-jg1ve2/databases/wealtharena_db --metric "cpu_percent" --start-time (Get-Date).AddHours(-24).ToString("yyyy-MM-ddTHH:mm:ssZ") --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ") --aggregation Average
```

