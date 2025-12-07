# Troubleshooting Guide

This guide aggregates issues discovered during development, with a focus on Windows 10/11 and WSL2 setups.

## Environment & Dependencies

### TA-Lib and cvxpy on Windows
- Prefer installing both packages via conda: `conda install -n agentic-rl-trading -c conda-forge ta-lib cvxpy`.
- When using pip, download the matching wheel from [Gohlke](https://www.lfd.uci.edu/~gohlke/pythonlibs/#ta-lib) for TA-Lib and follow the vendor instructions for cvxpy prebuilt wheels.
- If you must build from source on Windows, install Microsoft C++ Build Tools 14.3+ and ensure the correct architecture (x64) toolchain is selected.
- The setup script skips pip installation of these packages on Windows and prints reminders to install them manually or via conda.

### SSL Errors
- Corporate proxies or SSL interception can cause `CERTIFICATE_VERIFY_FAILED`.
- Configure `pip.ini`/`pip.conf` with the trusted CA bundle, or use `pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org <package>`.
- As a temporary workaround, export `REQUESTS_CA_BUNDLE` to point at your custom certificate bundle.

### Dependency Conflicts
- Pip backtracking messages such as “pip is looking at multiple versions…” indicate incompatible pins.
- Re-run `python scripts/setup_environment.py --skip-heavy` to install core packages first, then manually add the heavy packages (`ray`, `torch*`, `transformers`) once conflicts are resolved.
- If conflicts persist, review `requirements.txt` and `environment.yml` for mismatched version ranges and update them to the pinned versions listed in the repo.

### Conda Environment Conflicts
- Update conda before creating the environment: `conda update conda`.
- Recreate the environment with `conda env create -f environment.yml`.
- Validate dependencies using `python scripts/check_dependencies.py`.

## Distributed Training & RL

### Ray Initialization Errors on Windows
- Set environment variables prior to launching Ray workloads:
  ```
  set OMP_NUM_THREADS=1
  set MKL_NUM_THREADS=1
  set RAY_OBJECT_STORE_MEMORY=1500000000
  ```
- Limit `--num-workers` in `scripts/train_all_agents.py` to the number of physical cores.
- If issues persist, run distributed training inside WSL2 where epoll and shared memory support are robust.

### Stable-Baselines3 VecEnv Errors
- Errors such as `ValueError: VecEnv required` occur when environments are not wrapped. Use `PPOAgentFactory.create_<asset>_agent()` or `_wrap_env` in `src/agents/ppo_agent.py`.
- Verify Gymnasium/Gym versions; mismatches often cause interface errors. Run `pip show gymnasium gym` to confirm compatibility.

## Data Collection & Processing

### API Rate Limits (Yahoo Finance, CCXT, Alpha Vantage)
- Adjust `rate_limits` in `config/data_config.yaml` and ensure collectors use `RateLimiter`.
- Use exponential backoff provided by `BaseCollector.retry_with_backoff`; review logs in `data/audit/`.
- For hard caps, stagger jobs: `python scripts/collect_all_data.py --config config/data_config.yaml --sleep 5`.

**Yahoo Finance Rate Limiting (2025)**:
- Yahoo Finance is more aggressive with rate limiting in 2025 due to authentication changes
- Recommended settings in `config/data_config.yaml`:
  - `requests_per_second: 1` (reduced from 2 for better reliability)
  - `backoff_seconds: 5` (increased from 3)
  - `min_delay_seconds: 1.0` (increased from 0.5)
- These conservative settings reduce the likelihood of 401/429 errors but will make data collection slower
- If you encounter persistent rate limiting, increase delays further or run collection in smaller batches

### Parquet Schema Mismatches
- Run `python scripts/validate_data.py --layer silver --fix` to coerce schema and regenerate metadata.
- Ensure processors maintain the canonical schema (`timestamp_utc`, `symbol`, OHLCV columns, `metadata`). Mixing dictionaries/lists in the `metadata` field triggers Arrow errors.
- Use `src.data.processors.DataValidator.validate_schema` to assert column coverage during unit/integration tests and surface drift early.

## Serving & Paper Trading

### BentoML Port Already in Use
- Override the port: `python scripts/serve_models.py --port 8081`.
- Identify conflicting processes with `netstat -ano | findstr :8080` and terminate via Task Manager or `taskkill /PID <pid> /F`.

### Environment File Format

The `.env` file must use standard `KEY=value` format, not JSON format.

**Incorrect format (JSON)**:
```json
{
  "ALPHA_VANTAGE_API_KEY": "your_key",
  "FRED_API_KEY": "your_key"
}
```

**Correct format (KEY=value)**:
```
ALPHA_VANTAGE_API_KEY=your_key
FRED_API_KEY=your_key
```

**Symptoms of incorrect format**:
- `python-dotenv` parsing errors on lines 2-12
- Environment variables not loading correctly
- Data collection scripts failing with "API key not configured" errors even when keys are present

**Solution**: Convert your `.env` file to `KEY=value` format. Remove JSON braces `{}`, commas between entries, and quotes around keys. Keep quotes around values only if they contain spaces.

**Verification**: After fixing, verify the file parses correctly:
```bash
python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.getenv('ALPHA_VANTAGE_API_KEY'))"
```
Expected output: Your API key value (not `None` or parsing errors).

**Example - Before (Incorrect JSON format)**:
```json
{
  "ALPHA_VANTAGE_API_KEY": "your_key",
  "FRED_API_KEY": "your_key"
}
```

**Example - After (Correct KEY=value format)**:
```
ALPHA_VANTAGE_API_KEY=your_key
FRED_API_KEY=your_key
```

**Note**: Empty values are allowed (e.g., `PRAW_CLIENT_ID=`). If a value contains `=`, quote it (e.g., `KEY="value=with=equals"`).

### Missing Environment Variables

**All API keys are optional** - the system will gracefully skip data collection for sources that require keys you don't have.

- **Data Collection Keys** (Optional - collection will be skipped if not configured):
  - `ALPHA_VANTAGE_API_KEY` - For news and fundamental data. Get at https://www.alphavantage.co/support/#api-key
  - `FRED_API_KEY` - For macroeconomic indicators. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html
  - `CCXT_EXCHANGE_API_KEY`, `CCXT_EXCHANGE_SECRET` - For cryptocurrency exchange data. If not configured, crypto data will be collected via Yahoo Finance only
  - `PRAW_CLIENT_ID`, `PRAW_CLIENT_SECRET`, `PRAW_USER_AGENT` - For enhanced social sentiment data (fallback mode available without keys). Note: `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` are also supported for backward compatibility.

- **Paper Trading Keys** (Required only for Phase 7+):
  - `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` - For Alpaca paper trading. Get at https://app.alpaca.markets/paper/dashboard/overview

- **Experiment Tracking Keys** (Optional but recommended):
  - `WANDB_API_KEY` - For experiment tracking. Get at https://wandb.ai/settings
  - `LANGSMITH_API_KEY` - For LangGraph workflow tracing. Get at https://smith.langchain.com/settings

- Use `python scripts/check_dependencies.py --check-env` to check which keys are configured.

## Common Data Collection Issues

### Yahoo Finance 401 Unauthorized Errors

Yahoo Finance implemented stricter authentication requirements in 2025, requiring browser impersonation via `curl_cffi` for API access.

**Symptoms**:
- 401 Unauthorized errors when fetching data from Yahoo Finance
- "Could not extract Yahoo Finance crumb" warnings
- Options collection failing with authentication errors
- Stock/ETF/forex/crypto data collection returning empty results

**Root Cause**:
- Yahoo Finance now requires browser impersonation (Chrome user agent) and proper cookie/crumb handling
- The `fc.yahoo.com → getcrumb` authentication flow is now mandatory
- Older versions of `yfinance` (<0.2.58) don't support the new authentication requirements

**Solutions**:
1. **Update dependencies**:
   ```bash
   pip install --upgrade yfinance>=0.2.58 curl-cffi>=0.6.0
   # or
   conda env update -f environment.yml
   ```
2. **Verify installation**:
   ```bash
   python -c "import yfinance; import curl_cffi; print('Dependencies OK')"
   ```
3. **Don't pass custom sessions**: Modern yfinance (>=0.2.58) manages its own `curl_cffi` session internally. Passing custom `requests.Session` objects will break authentication.
4. **Use conservative rate limiting**: Update `config/data_config.yaml`:
   - `requests_per_second: 1` (reduced from 2)
   - `backoff_seconds: 5` (increased from 3)
   - `min_delay_seconds: 1.0` (increased from 0.5)
5. **Retry failed requests**: Yahoo sometimes returns 401 on first attempt even with valid authentication. The updated collectors include retry logic with exponential backoff.

**Reference**: The new authentication flow uses `curl_cffi` to impersonate Chrome browser, which is required for Yahoo's updated security. This is handled internally by yfinance >=0.2.58.

### Options Data Collection Failures

Yahoo Finance heavily rate-limits options data requests, especially with the 2025 authentication changes. The options collection script now uses yfinance's built-in options API (`Ticker.options` and `Ticker.option_chain()`) which handles authentication internally.

**Symptoms**:
- `collect_options.py` exits with warnings about no contracts being persisted
- Logs show repeated 401/429 errors or rate limiting errors
- Options data directory remains empty or incomplete

**Solutions**:
- The system is designed to continue without options data. Options-based features will be unavailable, but the core trading system (stocks, forex, crypto, ETFs, commodities) will function normally.
- **Ensure dependencies are updated**: `yfinance>=0.2.58` and `curl-cffi>=0.6.0` are required
- To improve options collection success rate:
  - Use conservative rate limiting in `config/data_config.yaml`:
    - `requests_per_second: 1` (reduced from 2)
    - `backoff_seconds: 5` (increased from 3)
    - `min_delay_seconds: 1.0` (increased from 0.5)
  - Reduce `max_expiries` from 3 to 2 in the options configuration
  - Run options collection separately with longer delays between runs
  - Use `--max-expiries 1` to collect fewer expiries per symbol
- Options data is not critical for the core trading system; stocks, forex, crypto, ETFs, and commodities are the primary assets.
- Options collection may require multiple runs or manual retry due to aggressive rate limiting.

### Reddit API Configuration

Reddit credentials are **optional** for the system to function. The social media collector supports an unauthenticated fallback mode.

**Symptoms**:
- Automation prompts for Reddit credentials during API key configuration
- Social media data collection yields no results or limited data
- Warnings about missing `PRAW_CLIENT_ID` or `PRAW_CLIENT_SECRET`

**Solutions**:
- **Without Reddit credentials**: The collector automatically skips social media collection with a warning. The pipeline continues without social sentiment data. Social sentiment features will be unavailable without Reddit data access.
- **With Reddit credentials**: For full data access, create a script app at https://www.reddit.com/prefs/apps and configure:
  - `PRAW_CLIENT_ID` (or `REDDIT_CLIENT_ID` for backward compatibility)
  - `PRAW_CLIENT_SECRET` (or `REDDIT_CLIENT_SECRET` for backward compatibility)
  - `PRAW_USER_AGENT` (or `REDDIT_USER_AGENT` for backward compatibility; format: "agentic-rl-collector")
- The automation no longer requires Reddit credentials as mandatory keys; they are optional. Social media collection will be skipped if credentials are not configured.

### Graceful Degradation

The system is designed to work with partial data, allowing the pipeline to proceed even if some asset types are unavailable.

**Critical Asset Classes** (required for core functionality):
- Stocks
- Forex
- Crypto
- ETFs
- Commodities

**Optional Asset Classes** (enhance functionality but not required):
- Options (heavily rate-limited by Yahoo Finance)
- Social media data (requires Reddit credentials for full access)
- News data (enhances sentiment analysis)

**How to Check Available Data**:
- **Bronze layer**: Check `data/bronze/<asset_type>/` for parquet files
- **Silver layer**: Check `data/silver/<asset_type>/` for processed datasets
- **Gold layer**: Check `data/gold/features/<asset_class>.parquet` or `data/gold/training_sets/<asset_class>.csv`

**Interpreting Warnings vs. Errors**:
- **Warnings**: Indicate missing optional data (e.g., options, social). The pipeline continues.
- **Errors**: Indicate missing critical data or configuration issues. The pipeline may halt or skip affected steps.

**Behavior**:
- Bronze-to-Silver processing automatically skips asset types with no Bronze data
- Training scripts validate Gold layer data availability before attempting to train agents
- Missing asset classes are logged as warnings, and training proceeds with available assets only

### Bronze to Silver Processing Failures

The Bronze→Silver processor now handles all asset types (stocks, forex, crypto, ETFs, commodities, options, social, news, macro) with graceful error handling.

**Symptoms**:
- Warnings about missing asset types during Bronze→Silver processing
- Some asset types processed successfully while others fail
- Silver layer missing data for certain asset types

**Solutions**:
- Check which asset types have Bronze data: `python scripts/process_bronze_to_silver.py --config config/data_config.yaml --assets all`
- The processor logs which asset types succeeded and which failed
- Missing Bronze data for an asset type will result in a warning, and processing continues with other asset types
- Critical asset types (stocks, forex, crypto) should have Bronze data before running Silver processing
- Optional asset types (options, social, news) can be missing without affecting the pipeline

## Diagnostics & Logging

- Validate data quality: `python scripts/validate_data.py --layer gold`.
- Inspect Ray status: `ray status` or `ray summary`.
- Enable verbose logging by setting `LOG_LEVEL=DEBUG` in `.env`, leveraging `src/utils.get_logger`.
- Audit logs for collectors and processors are stored under `data/audit/` and should accompany bug reports.
- Check automation logs: `automation/logs/automation_log.txt` and `automation/logs/automation_errors.txt` for detailed error information.

