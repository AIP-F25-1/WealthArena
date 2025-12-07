# Phase 3B: Databricks Setup Guide

## Prerequisites
- Azure Databricks workspace provisioned: `adb-4421559972268830.10.azuredatabricks.net`
- Azure CLI installed and logged in
- Python 3.8+ installed
- Databricks personal access token (to be generated)
- Access to Azure SQL Database credentials

## Step 1: Install Databricks CLI

```bash
# Install via pip
pip install databricks-cli

# Verify installation
databricks --version
```

**Expected output:** `databricks-cli, version 0.XX.X`

**Note for Windows PowerShell:**
```powershell
# If command not found, add Python Scripts to PATH
$env:Path += ";$env:USERPROFILE\AppData\Local\Programs\Python\Python3X\Scripts"

# Verify
databricks --version
```

## Step 2: Generate Databricks Personal Access Token

1. Navigate to Databricks workspace: https://adb-4421559972268830.10.azuredatabricks.net
2. Click on your **user profile** (top right corner)
3. Go to **User Settings**
4. Navigate to **Access Tokens** tab
5. Click **Generate New Token**
6. Enter description: `WealthArena CLI Access`
7. Set lifetime: **90 days** (or as needed)
8. Click **Generate**
9. **Copy the token immediately** - it won't be shown again!

**Example token format:** `dapi1234567890abcdefghijklmnopqrstuvwxyz`

## Step 3: Configure Databricks CLI

```bash
# Configure CLI with token
databricks configure --token
```

**When prompted, enter:**
- **Databricks Host**: `https://adb-4421559972268830.10.azuredatabricks.net`
- **Token**: `<paste-your-token-from-step-2>`

**Verify configuration:**
```bash
databricks workspace ls /
```

**Expected output:** You should see Databricks workspace contents without errors.

## Step 4: Create Workspace Directory

```bash
# Create WealthArena directory in Shared workspace
databricks workspace mkdirs /Workspace/Shared/WealthArena

# Verify directory exists
databricks workspace ls /Workspace/Shared
```

**Expected output:** You should see `WealthArena` directory listed.

## Step 5: Upload Notebooks

Navigate to the project root and upload all 7 notebooks:

```bash
# Navigate to project root
cd "C:\Users\PC\Desktop\AIP Project Folder\WealthArena_UI"

# Upload all 7 notebooks
databricks workspace import databricks_notebooks/01_market_data_ingestion.py \
  /Workspace/Shared/WealthArena/01_market_data_ingestion \
  --language PYTHON --format SOURCE --overwrite

databricks workspace import databricks_notebooks/02_feature_engineering.py \
  /Workspace/Shared/WealthArena/02_feature_engineering \
  --language PYTHON --format SOURCE --overwrite

databricks workspace import databricks_notebooks/03_news_sentiment.py \
  /Workspace/Shared/WealthArena/03_news_sentiment \
  --language PYTHON --format SOURCE --overwrite

databricks workspace import databricks_notebooks/04_rl_environment.py \
  /Workspace/Shared/WealthArena/04_rl_environment \
  --language PYTHON --format SOURCE --overwrite

databricks workspace import databricks_notebooks/05_rl_agent_training.py \
  /Workspace/Shared/WealthArena/05_rl_agent_training \
  --language PYTHON --format SOURCE --overwrite

databricks workspace import databricks_notebooks/06_rl_inference.py \
  /Workspace/Shared/WealthArena/06_rl_inference \
  --language PYTHON --format SOURCE --overwrite

databricks workspace import databricks_notebooks/07_portfolio_optimization.py \
  /Workspace/Shared/WealthArena/07_portfolio_optimization \
  --language PYTHON --format SOURCE --overwrite

# Verify uploads
databricks workspace ls /Workspace/Shared/WealthArena
```

**Expected output:** All 7 notebooks listed with success.

**Alternative (Batch Upload):**
If you prefer to upload all at once:

```powershell
# PowerShell script
$notebooks = @(
    "01_market_data_ingestion",
    "02_feature_engineering",
    "03_news_sentiment",
    "04_rl_environment",
    "05_rl_agent_training",
    "06_rl_inference",
    "07_portfolio_optimization"
)

foreach ($notebook in $notebooks) {
    Write-Host "Uploading $notebook..." -ForegroundColor Cyan
    databricks workspace import "databricks_notebooks/$notebook.py" `
        "/Workspace/Shared/WealthArena/$notebook" `
        --language PYTHON --format SOURCE --overwrite
}
```

## Step 6: Create Databricks Secret Scope

```bash
# Create secret scope for Azure credentials
databricks secrets create-scope --scope wealtharena

# Verify scope created
databricks secrets list-scopes
```

**Note:** If scope already exists, you'll get an error. Just verify it's listed.

## Step 7: Add Azure Credentials to Secrets

Add all Azure credentials to the secret scope:

```bash
# Add Azure Storage Account credentials
databricks secrets put --scope wealtharena --key storage-account-name --string-value "stwealtharenadev"

databricks secrets put --scope wealtharena --key storage-account-key --string-value "YOUR_STORAGE_ACCOUNT_KEY"

# Add Azure SQL Database credentials
databricks secrets put --scope wealtharena --key sql-server --string-value "sql-wealtharena-dev"

databricks secrets put --scope wealtharena --key sql-database --string-value "wealtharena_db"

databricks secrets put --scope wealtharena --key sql-username --string-value "wealtharena_admin"

databricks secrets put --scope wealtharena --key sql-password --string-value "WealthArena2024!@#$%"
```

**Verify secrets:**
```bash
databricks secrets list --scope wealtharena
```

**Expected output:**
- storage-account-name
- storage-account-key
- sql-server
- sql-database
- sql-username
- sql-password

**Note:** Secret values are not displayed for security reasons.

## Step 8: Update Notebooks to Use Secrets

**Important:** The notebooks currently have hardcoded credentials. For production, they should use Databricks secrets.

### Manual Update (Recommended for Production)

For each notebook that accesses Azure resources (01, 02, 05, 06, 07), you'll need to:

1. Open the notebook in Databricks UI
2. Find hardcoded credentials (usually around lines 138-172)
3. Replace with secret retrieval code:

**Before:**
```python
storage_account_name = "stwealtharenadev"
storage_account_key = "YOUR_STORAGE_ACCOUNT_KEY"
```

**After:**
```python
try:
    storage_account_name = dbutils.secrets.get("wealtharena", "storage-account-name")
    storage_account_key = dbutils.secrets.get("wealtharena", "storage-account-key")
    sql_server = dbutils.secrets.get("wealtharena", "sql-server")
    sql_database = dbutils.secrets.get("wealtharena", "sql-database")
    sql_username = dbutils.secrets.get("wealtharena", "sql-username")
    sql_password = dbutils.secrets.get("wealtharena", "sql-password")
    print("✅ Azure configuration loaded successfully")
except Exception as e:
    print(f"❌ Error loading Azure configuration: {e}")
    raise
```

**Notebooks to update:**
- `01_market_data_ingestion.py` (lines 138-172)
- `02_feature_engineering.py` (if it has credentials)
- `05_rl_agent_training.py`
- `06_rl_inference.py`
- `07_portfolio_optimization.py`

**For now (development):** Hardcoded credentials work fine. Update for production deployment.

## Step 9: Create Databricks Jobs

```bash
# Navigate to azure_infrastructure directory
cd azure_infrastructure

# Run job creation script
powershell -ExecutionPolicy Bypass -File .\setup_databricks_jobs.ps1
```

**Expected output:**
```
✅ Job 'WealthArena-Quick-Data-Load' created successfully
✅ Job 'WealthArena-Full-Data-Load' created successfully
✅ Job 'WealthArena-Feature-Engineering' created successfully
✅ Job 'WealthArena-News-Sentiment' created successfully
✅ Job 'WealthArena-RL-Training' created successfully
✅ Job 'WealthArena-RL-Inference' created successfully
✅ Job 'WealthArena-Portfolio-Optimization' created successfully
```

**Note:** The script output will include job IDs - save these for reference!

## Step 10: Verify Jobs in Databricks UI

1. Navigate to Databricks workspace: https://adb-4421559972268830.10.azuredatabricks.net
2. Click **Workflows** in left sidebar
3. Verify 7 jobs are listed:
   - WealthArena-Quick-Data-Load
   - WealthArena-Full-Data-Load
   - WealthArena-Feature-Engineering
   - WealthArena-News-Sentiment
   - WealthArena-RL-Training
   - WealthArena-RL-Inference
   - WealthArena-Portfolio-Optimization
4. Click on each job to verify configuration

## Step 11: Verify Job Schedules

In the Databricks UI, check job schedules:

| Job Name | Schedule | Description |
|----------|----------|-------------|
| Quick-Data-Load | Manual only | Test/demo runs |
| Full-Data-Load | Daily at 6 AM UTC | `0 6 * * *` |
| Feature-Engineering | Daily at 8 AM UTC | `0 8 * * *` |
| News-Sentiment | Every 6 hours | `0 */6 * * *` |
| RL-Training | Weekly Sunday | `0 0 * * 0` |
| RL-Inference | Daily at 9 AM UTC | `0 9 * * *` |
| Portfolio-Optimization | Daily at 9:30 AM UTC | `0 9:30 * * *` |

## Step 12: Test Job Execution

### Option A: Via Databricks CLI

```bash
# Get job ID
databricks jobs list --output JSON | grep -A 5 "WealthArena-Quick-Data-Load"

# Trigger job manually
databricks jobs run-now --job-id <job-id>

# Monitor execution
databricks runs list --job-id <job-id> --output JSON

# Get detailed run info
databricks runs get --run-id <run-id>
```

### Option B: Via Databricks UI (Recommended)

1. Go to **Workflows** → Select job
2. Click **Run now**
3. Monitor execution in **Runs** tab
4. Click on the run to see:
   - **Run details** (duration, status)
   - **Logs** (click on each task to see logs)
   - **Output** (if any)

**Expected durations:**
- Quick Data Load: 10-15 minutes
- Feature Engineering: 5-10 minutes
- RL Training: 30-60 minutes (quick mode)
- RL Inference: 5-10 minutes

## Step 13: Verify Data in Azure SQL

After running data ingestion, verify data is loaded:

```bash
# Connect to Azure SQL Database
sqlcmd -S sql-wealtharena-dev.database.windows.net -d wealtharena_db -U wealtharena_admin -P "WealthArena2024!@#$%"

# Check market data
SELECT COUNT(*) as total_records FROM market_data_ohlcv;

SELECT symbol, COUNT(*) as record_count 
FROM market_data_ohlcv 
GROUP BY symbol 
ORDER BY record_count DESC;

SELECT MIN(date_time) as earliest, MAX(date_time) as latest 
FROM market_data_ohlcv;

# Check technical indicators (after feature engineering)
SELECT COUNT(*) as total_indicators FROM technical_indicators;

SELECT TOP 10 symbol, date_time, sma_20, rsi_14, macd_line 
FROM technical_indicators 
ORDER BY date_time DESC;

# Check RL signals (after inference)
SELECT COUNT(*) as total_signals FROM rl_signals;

SELECT signal_type, COUNT(*) as count 
FROM rl_signals 
GROUP BY signal_type;

# Exit
GO
EXIT
```

## Troubleshooting

### Issue: Databricks CLI not found

**Solution:**
```bash
# Add Python Scripts to PATH
$env:Path += ";$env:USERPROFILE\AppData\Local\Programs\Python\Python3X\Scripts"

# Verify
databricks --version
```

### Issue: Token authentication failed

**Solution:**
```bash
# Reconfigure CLI
databricks configure --token

# Generate new token in Databricks UI if needed
```

### Issue: Notebook upload fails

**Check:**
1. Path exists in workspace: `databricks workspace ls /Workspace/Shared/WealthArena`
2. Notebook file exists locally: `ls databricks_notebooks/`
3. Valid Python syntax

**Solution:**
```bash
# Create directory if missing
databricks workspace mkdirs /Workspace/Shared/WealthArena

# Try again with --overwrite flag
```

### Issue: Secret scope creation fails

**Check if scope exists:**
```bash
databricks secrets list-scopes
```

**Solution:**
If scope already exists, you're good to go. Otherwise:
```bash
# Delete and recreate
databricks secrets delete-scope --scope wealtharena

# Create again
databricks secrets create-scope --scope wealtharena
```

### Issue: Job creation fails

**Check:**
1. Notebooks are uploaded: `databricks workspace ls /Workspace/Shared/WealthArena`
2. Cluster configuration is valid
3. Parameters are correct

**Solution:**
Review error message in PowerShell output. Common issues:
- Invalid notebook path
- Missing parameters
- Cluster configuration errors

### Issue: Job execution fails with "No module named 'yfinance'"

**Solution:**
Install required libraries on cluster. In Databricks UI:
1. Go to **Compute** → Select cluster
2. Click **Libraries** tab
3. Click **Install New**
4. Install:
   - `yfinance`
   - `pandas`
   - `numpy`
   - `azure-storage-file-datalake`
   - `stable-baselines3`
   - `gymnasium`
5. Restart cluster

**Alternative:**
Create cluster init script to auto-install packages. See `init_databricks.sh`.

### Issue: Job fails to access Azure SQL

**Check:**
1. Databricks cluster is in the same VNet as Azure SQL (or firewall allows access)
2. SQL credentials are correct in secrets
3. SQL Server firewall rules allow Databricks IPs

**Solution:**
```bash
# Verify credentials
databricks secrets list --scope wealtharena

# Check SQL connectivity from Databricks notebook
%python
import pyodbc

server = dbutils.secrets.get("wealtharena", "sql-server")
database = dbutils.secrets.get("wealtharena", "sql-database")
username = dbutils.secrets.get("wealtharena", "sql-username")
password = dbutils.secrets.get("wealtharena", "sql-password")

conn_str = f"Driver={{ODBC Driver 18 for SQL Server}};Server=tcp:{server}.database.windows.net,1433;Database={database};Uid={username};Pwd={password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"

try:
    conn = pyodbc.connect(conn_str)
    print("✅ Successfully connected to Azure SQL")
    conn.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")
```

## Next Steps

✅ **Databricks Setup Complete!**

Proceed to:
- **Phase 3C: End-to-End Pipeline Testing** (see `PHASE3_PIPELINE_TESTING_GUIDE.md`)

## Useful Commands

```bash
# List all jobs
databricks jobs list

# Get job details
databricks jobs get --job-id <job-id>

# Get job runs
databricks runs list --job-id <job-id>

# Get run details
databricks runs get --run-id <run-id>

# Cancel running job
databricks runs cancel --run-id <run-id>

# Delete job
databricks jobs delete --job-id <job-id>

# Export job configuration
databricks jobs get --job-id <job-id> --output JSON > job_config.json

# List notebooks
databricks workspace ls /Workspace/Shared/WealthArena

# Delete notebook
databricks workspace delete /Workspace/Shared/WealthArena/<notebook-name>

# List secrets
databricks secrets list --scope wealtharena

# Delete secret
databricks secrets delete --scope wealtharena --key <key-name>
```

## Production Considerations

1. **Cluster Configuration:**
   - Use appropriate cluster size for production workloads
   - Enable auto-scaling
   - Configure spot instances for cost optimization
   - Set appropriate timeout values

2. **Security:**
   - Use Databricks secrets for all credentials
   - Enable VNet injection for network isolation
   - Configure IP access lists
   - Use Azure Key Vault integration

3. **Monitoring:**
   - Set up job failure alerts
   - Monitor cluster usage and costs
   - Track job execution times
   - Log all errors to centralized storage

4. **Cost Optimization:**
   - Use spot instances for non-critical jobs
   - Right-size clusters
   - Terminate idle clusters
   - Monitor and optimize schedules

5. **Disaster Recovery:**
   - Backup job configurations
   - Document manual recovery procedures
   - Test failover scenarios
   - Implement data retention policies

