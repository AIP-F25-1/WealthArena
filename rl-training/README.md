# Agentic Multi-Agent RL Trading System

A production-grade, multi-asset, multi-agent reinforcement learning (RL) platform that orchestrates hierarchical trading strategies across equities, ETFs, commodities, options, forex, and cryptocurrencies. The system integrates Bronze→Silver→Gold data engineering pipelines, specialized PPO asset agents, a SAC-based meta-controller, and BentoML-powered serving with LangGraph orchestration.

## Important: Recent Updates (2025)

**Yahoo Finance Authentication Changes**: Yahoo Finance implemented stricter authentication requirements in 2025, requiring browser impersonation via `curl_cffi`. The following updates are required:

1. **Update Dependencies**:
   ```bash
   pip install --upgrade yfinance>=0.2.58 curl-cffi>=0.6.0
   # or
   conda env update -f environment.yml
   ```

2. **Verify `.env` File Format**: The `.env` file must use `KEY=value` format, not JSON format. See [Troubleshooting Guide](docs/troubleshooting.md#environment-file-format) for details.

3. **Check Troubleshooting Guide**: If you encounter 401 Unauthorized errors, see the [Yahoo Finance 401 Errors](docs/troubleshooting.md#yahoo-finance-401-unauthorized-errors) section for solutions.

## Architecture Overview

```
[ Bronze Data ] → [ Silver Data ] → [ Gold Features ]
        ↓                ↓               ↓
  Collectors      Bronze→Silver     Feature Pipelines
        ↓                ↓               ↓
    PPO Agents (per asset class) → SAC Meta-Controller → Execution Layer
```

- **Bronze Layer**: Immutable raw market, news, social, and macro data.
- **Silver Layer**: Cleaned, schema-enforced Parquet datasets with quality flags.
- **Gold Layer**: Feature-engineered, normalized datasets for ML training.
- **Asset Agents**: PPO agents tailored per asset class with CQL offline pretraining.
- **Meta-Controller**: SAC allocator leveraging covariance-aware risk management and regime detection.
- **Serving & Orchestration**: LangGraph workflows, Ray distributed training, BentoML APIs, and paper trading connectors.

## Technology Stack

- Python 3.10+
- PyTorch (CUDA-capable when available)
- Stable-Baselines3 (PPO, SAC) & Ray RLlib/Tune
- FinRL, Gym/Gymnasium environments
- PyPortfolioOpt, cvxpy for portfolio optimization
- LangGraph, LangChain, LangSmith for orchestration and tracing
- Backtrader, vectorbt for backtesting
- BentoML for model serving
- W&B, TensorBoard for experiment tracking
- Transformers (FinBERT, BERTweet) for sentiment analysis

## Directory Structure

```
├─ config/                # YAML configs (data, features, agents, backtesting, etc.)
├─ data/                  # Bronze/Silver/Gold medallion layers + catalog/audit
├─ docs/                  # Architecture, pipeline, troubleshooting documentation
├─ experiments/           # Versioned experiment artifacts
├─ models/                # Trained models (PPO agents, SAC controller, Bento bundles)
├─ notebooks/             # Exploratory & analytical notebooks
├─ paper/                 # LaTeX research paper, figures, references
├─ results/               # Backtests, walk-forward, Monte Carlo outputs
├─ scripts/               # CLI workflows for data, training, backtesting, serving
├─ src/                   # Source modules (data, features, agents, orchestration, etc.)
├─ tests/                 # Pytest suites per subsystem
└─ IMPLEMENTATION_GUIDE.md
```

## Installation (Windows 10/11)

1. **Install Miniconda**: https://docs.conda.io/en/latest/miniconda.html
2. **Clone Repository**: `git clone <repo-url>`
3. **Create Environment**:
   ```powershell
   conda env create -f environment.yml
   conda activate agentic-rl-trading
   ```
   **Note**: The environment now includes `yfinance>=0.2.58` and `curl-cffi>=0.6.0` for Yahoo Finance authentication support.
4. **GPU Optionality**:
   - The default `environment.yml` targets CPU installs. If you have a CUDA-capable Linux box, uncomment the `pytorch-cuda` and `cudatoolkit` lines before creating the environment.
   - On Windows, leave those lines commented; the PyTorch channel will install CPU binaries automatically.
5. **Handle Binary Dependencies**:
   - `TA-Lib`: `conda install -c conda-forge ta-lib`
   - `cvxpy`: `conda install -c conda-forge cvxpy`
   - Ensure Microsoft Build Tools (Visual Studio Build Tools) are present for optional native extensions.
6. **Install Additional Tools** (optional):
   - MiKTeX or TeX Live for LaTeX compilation on Windows.
7. **Verify Installation**:
   ```bash
   python -c "import yfinance; import curl_cffi; print('Dependencies OK')"
   ```

## Quick Start

1. **Configure Environment**:
   - Copy `.env.example` → `.env` and populate secrets (or create `.env` with `KEY=value` format, not JSON).
   - **Important**: Verify your `.env` file uses `KEY=value` format (not JSON). See [Troubleshooting Guide](docs/troubleshooting.md#environment-file-format).
   - **Verify parsing**: Run `python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.getenv('ALPHA_VANTAGE_API_KEY'))"` to ensure the file parses correctly.
   - Review `config/*.yaml` for data, features, agents, backtests.

### API Keys (All Optional - Can Be Added Later)

All API keys are optional and can be added later as needed. The system will skip collection for data sources that require keys you don't have, and continue with available data sources.

- **Alpha Vantage API Key**: For news and fundamental data. Get at https://www.alphavantage.co/support/#api-key. If not configured, news collection will be skipped.
- **FRED API Key**: For macroeconomic indicators. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html. If not configured, macro data collection will be skipped.
- **CCXT Exchange Keys** (`CCXT_EXCHANGE_API_KEY`, `CCXT_EXCHANGE_SECRET`): For cryptocurrency exchange data. If not configured, crypto data will be collected via Yahoo Finance only.
- **Alpaca API Keys** (`ALPACA_API_KEY`, `ALPACA_SECRET_KEY`): Required only for paper trading in Phase 7+ (Execution & Market Simulation). Not needed for data collection (Phase 1). Alpaca paper trading keys are available at https://app.alpaca.markets/paper/dashboard/overview.
- **Reddit API Credentials** (`PRAW_CLIENT_ID`, `PRAW_CLIENT_SECRET`, `PRAW_USER_AGENT`): The system can collect social sentiment data without credentials using a fallback mode. Full Reddit API access requires creating a script app at https://www.reddit.com/prefs/apps. Note: The code also supports `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` as fallback for backward compatibility.
- **WANDB API Key**: For experiment tracking and visualization. Optional but recommended for training phases. Get at https://wandb.ai/settings.
- **LANGSMITH API Key**: For LangGraph workflow tracing. Optional but recommended for orchestration phases. Get at https://smith.langchain.com/settings.
- **Twitter/X Bearer Token**: Currently not implemented; reserved for future use.

### Data Collection Notes

- **Options Data**: Yahoo Finance heavily rate-limits options requests. The system can function without options data, focusing on stocks, forex, crypto, ETFs, and commodities.
- **Social Media Data**: Limited social sentiment data is available without Reddit credentials via unauthenticated API access.

### Optional Data Sources

Some data sources (e.g., options chains) are marked as optional due to API reliability issues. If collection fails:

- The pipeline continues automatically
- Affected features/agents are skipped
- Detailed failure information is logged
- You can retry collection manually later

See `PROGRESS_TRACKER.md` for details on optional steps and how to retry them.

2. **New Step 1.5: Generate Stock Catalogs**:
   - Create sector catalog CSVs before collecting stocks.
   - ```powershell
     python scripts/generate_stock_catalog.py --config config/data_config.yaml
     ```
   - Produces 50 random tickers per sector under `data/catalog/stocks/`.
   - Run again whenever you want to refresh the stock universe; otherwise reuse the generated files.
   - Skipping this step forces `collect_stocks.py` to fall back to a 5-ticker safety list.
3. **Collect Data**:
   ```powershell
   python scripts/collect_all_data.py --config config/data_config.yaml
   ```
   - The system will continue even if options or social media data collection fails. See `docs/troubleshooting.md` for details.
4. **Process Data Pipeline**:
   ```powershell
   python scripts/process_data_pipeline.py --stage all
   ```
   - Automatically processes only available asset types from the Bronze layer.
5. **Train Agents & Meta-Controller**:
   ```powershell
   python scripts/train_all_agents.py --config config/agent_config.yaml --stage all
   ```
   - Automatically validates Gold layer data availability and trains agents only for available asset classes.
6. **Run Comprehensive Backtest**:
   ```powershell
   python scripts/run_comprehensive_backtest.py --config config/backtest_config.yaml --backtest-type all
   ```
7. **Serve & Paper Trade**:
   ```powershell
   python scripts/serve_and_trade.py --config config/agent_config.yaml --platform alpaca
   ```

## Master Automation System

**Author**: Clifford Addison  
**Year**: 2025  
**Company**: WealthArena

This project includes a comprehensive PowerShell automation system that orchestrates the entire RL trading pipeline from data collection to deployment.

### Running the Master Automation

```powershell
# Run the complete automation (interactive mode)
.\master_automation.ps1

# Run with specific options
.\master_automation.ps1 -SkipPhase 1,2 -ForceRerun -DryRun

# Resume from checkpoint
.\master_automation.ps1 -Resume
```

### Features

- **Checkpoint System**: Automatically tracks completed phases and steps, allowing safe resumption
- **Interactive Setup**: Guided prompts for API keys with instructions
- **Git Integration**: Automated commits and pushes after each successful step
- **Metrics Collection**: Comprehensive metrics for advisor reporting (data store, pipeline, ML, testing, scraping)
- **SonarQube Integration**: Automated code quality analysis
- **Progress Reports**: Detailed Markdown reports with all required metrics and tables
- **Error Handling**: Robust retry logic with manual intervention options
- **Notebook Execution**: Automated or interactive Jupyter notebook execution

### Automation Structure

```
automation/
├── modules/                    # PowerShell modules
│   ├── CheckpointManager.ps1   # Checkpoint management
│   ├── GitManager.ps1          # Git operations
│   ├── InteractivePrompts.ps1  # User prompts
│   ├── MetricsCollector.ps1    # Metrics collection
│   └── ReportGenerator.ps1     # Report generation
├── helpers/                    # Python helper scripts
│   ├── collect_datastore_metrics.py
│   ├── collect_pipeline_metrics.py
│   ├── collect_ml_metrics.py
│   ├── collect_test_metrics.py
│   ├── collect_scraping_metrics.py
│   └── execute_notebooks.py
├── config/
│   └── automation_config.json  # Automation configuration
├── phase_definitions.json      # Phase and step definitions
├── checkpoints/                # Checkpoint state files (auto-generated)
├── logs/                       # Automation logs (auto-generated)
├── metrics/                    # Collected metrics (auto-generated)
└── reports/                    # Progress reports (auto-generated)
```

### Configuration

Customize automation behavior by editing `automation/config/automation_config.json`. Key settings:

- Git repository and branch configuration
- Checkpoint retention policy
- Logging levels and rotation
- Metrics collection frequency
- Phase enablement and time estimates
- SonarQube integration settings

### Checkpoints

The automation system maintains checkpoints in JSON format, tracking:

- Completed phases and steps with timestamps
- Git commit history
- Configured API keys
- Collected metrics
- Error history

Checkpoints are automatically cleaned up (keeping the latest 5 by default) to prevent clutter.

### Reports

Progress reports are generated in Markdown format and include:

- Project board items (tasks with completion status)
- Git repository status
- Features developed (completed vs pending)
- Test cases summary (fixed, failing, new failures)
- Comprehensive metrics tables (data store, pipeline, ML, testing, scraping)
- Code quality metrics from SonarQube
- Time tracking (estimated vs actual)
- Documentation coverage
- Deployment readiness

Reports are saved to `automation/reports/progress_report_YYYYMMDD.md` and can be shared directly with advisors.

### Troubleshooting

If the automation encounters errors:

1. Check `automation/logs/automation_log.txt` for detailed logs
2. Review `automation/logs/automation_errors.txt` for error stack traces
3. Use `-DryRun` flag to test without executing commands
4. Use `-Resume` flag to continue from last checkpoint
5. Manually complete failed steps and mark them complete when prompted

#### Options Data Collection Failures

If options data collection fails due to Yahoo Finance rate limiting:

1. The pipeline will continue automatically (options are optional)
2. Options agent training will be skipped
3. Retry later: `python scripts/collect_options.py --config config/data_config.yaml`
4. Check metrics: `automation/metrics/phase_phase1_metrics.json`

For more details, see `docs/troubleshooting.md`.

## Documentation & Paper

- **Documentation Index**: [docs/README.md](docs/README.md) - Overview of documentation structure and how to build/update docs
- Detailed design docs in `docs/`
- Experiment logs in `experiments/`
- LaTeX paper under `paper/` with IEEE/ACM compliant structure
- Figures and tables exported to `results/`

## License & Citation

This project consolidates research and open-source frameworks referenced in `EXISTING IMPLEMENTATION & RESOURCES.txt`. Cite foundational works (PPO, SAC, CQL, FinRL, PyPortfolioOpt, Backtrader, BentoML, LangGraph, etc.) using provided BibTeX entries in `paper/references.bib`.

## Acknowledgments

- Core frameworks: Stable-Baselines3, Ray RLlib, FinRL, PyPortfolioOpt, LangGraph, Backtrader, BentoML.
- Data providers: Yahoo Finance, Alpha Vantage, FRED, CCXT exchanges, Reddit, Twitter.
- NLP models: ProsusAI/FinBERT, finiteautomata/BERTweet.
- Research inspirations and implementation guidance consolidated from `EXISTING IMPLEMENTATION & RESOURCES.txt`.
