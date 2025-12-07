# Data Pipeline Deployment Guide for Production

## Current Situation

### ✅ What IS Deployed (Phase 7):
- **Backend Service** (Node.js) - REST API
- **Chatbot Service** (Python/FastAPI) - AI chatbot
- **RL Service** (Python/Flask) - **ONLY for inference** (making predictions)
- **Model Checkpoints** - Uploaded to Azure Blob Storage

### ❌ What is NOT Deployed:
- **Data Collection Scripts** - These run **locally only**:
  - `01_daily_market_data_refresh.py` - Downloads market data
  - `02_compute_technical_indicators.py` - Computes indicators
  - `03_generate_rl_signals.py` - Generates trading signals

## The Problem

**For production, you need these scripts to run automatically on Azure, not locally.**

The RL Service deployed in Phase 7 can only **make predictions** (inference), but it **cannot collect new data**. Without fresh data:
- RL models will use stale data
- Predictions will become outdated
- No live trading signals will be generated

## Solution: Deploy Data Pipeline as Azure Functions

Deploy the 3 data pipeline scripts as **Azure Functions with Timer Triggers** to run automatically on a schedule.

### Architecture

```
Azure Functions (3 functions with timer triggers)
├── Function 1: Market Data Refresh (Daily 6:00 AM UTC)
│   └── Runs: 01_daily_market_data_refresh.py
├── Function 2: Technical Indicators (Daily 6:30 AM UTC)
│   └── Runs: 02_compute_technical_indicators.py
└── Function 3: RL Signal Generation (Daily 7:00 AM UTC)
    └── Runs: 03_generate_rl_signals.py
```

### Deployment Steps

#### Step 1: Create Azure Function App

```powershell
# Variables
$resourceGroup = "rg-wealtharena-northcentralus"
$location = "northcentralus"
$functionAppName = "wealtharena-data-pipeline"
$storageAccountName = "stwealtharenadev"  # Use existing storage

# Create Function App (consumption plan)
az functionapp create `
    --resource-group $resourceGroup `
    --consumption-plan-location $location `
    --runtime python `
    --runtime-version 3.11 `
    --functions-version 4 `
    --name $functionAppName `
    --storage-account $storageAccountName `
    --os-type Linux

# Configure app settings (SQL connection, etc.)
az functionapp config appsettings set `
    --name $functionAppName `
    --resource-group $resourceGroup `
    --settings `
        "SQL_SERVER=sql-wealtharena-jg1ve2.database.windows.net" `
        "SQL_DATABASE=wealtharena_db" `
        "SQL_USER=wealtharena_admin" `
        "SQL_PASSWORD=<your-password>" `
        "AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>"
```

#### Step 2: Deploy Functions

Create 3 Azure Functions, one for each script:

**Function 1: Market Data Refresh**
- Timer: `0 0 6 * * *` (Daily at 6:00 AM UTC)
- Trigger: Timer trigger
- Code: Wraps `01_daily_market_data_refresh.py`

**Function 2: Technical Indicators**
- Timer: `0 30 6 * * *` (Daily at 6:30 AM UTC)
- Trigger: Timer trigger (waits for Function 1 to complete)
- Code: Wraps `02_compute_technical_indicators.py`

**Function 3: RL Signal Generation**
- Timer: `0 0 7 * * *` (Daily at 7:00 AM UTC)
- Trigger: Timer trigger (waits for Function 2 to complete)
- Code: Wraps `03_generate_rl_signals.py`

#### Step 3: Deploy Code

```powershell
# Navigate to data pipeline directory
cd infrastructure/data_pipeline_standalone

# Deploy using Azure Functions Core Tools
func azure functionapp publish $functionAppName
```

## Alternative Solution: Azure Container Instances (Scheduled)

If Azure Functions don't work (e.g., timeout issues), use **Azure Container Instances with scheduled jobs**:

```powershell
# Create container instance job
az container create `
    --resource-group $resourceGroup `
    --name wealtharena-data-refresh `
    --image <your-acr>/data-pipeline:latest `
    --command "python 01_daily_market_data_refresh.py" `
    --restart-policy Never `
    --environment-variables `
        SQL_SERVER=sql-wealtharena-jg1ve2.database.windows.net `
        SQL_DATABASE=wealtharena_db `
        SQL_USER=wealtharena_admin `
        SQL_PASSWORD=<your-password>

# Schedule with Azure Logic Apps or Event Grid
```

## Recommended: Integration with Existing RL Service

**Best Option**: Add scheduled endpoints to the existing **RL Service** that call the data pipeline scripts:

1. Add `/api/data/refresh` endpoint to RL Service
2. Add `/api/data/compute-indicators` endpoint
3. Add `/api/data/generate-signals` endpoint
4. Use Azure Logic Apps or Event Grid to call these endpoints on schedule

## What Script Runs on Azure?

**Answer**: Currently, **NO data collection script runs on Azure**. You need to deploy one of the above solutions.

**Recommended Scripts to Deploy**:
- `infrastructure/data_pipeline_standalone/01_daily_market_data_refresh.py`
- `infrastructure/data_pipeline_standalone/02_compute_technical_indicators.py`
- `infrastructure/data_pipeline_standalone/03_generate_rl_signals.py`

## Quick Start (Simplest Approach)

1. **Add scheduled endpoints to RL Service** (easiest)
2. **Deploy as Azure Functions** (most scalable)
3. **Use Azure Container Instances** (if functions timeout)

## Next Steps

1. Choose deployment method (Functions, Container Instances, or RL Service endpoints)
2. Create deployment script
3. Add to `master_automation.ps1` Phase 7 or create new Phase 7.5
4. Test deployment
5. Verify scheduled execution

## Notes

- **ODBC Driver**: Azure Functions may need ODBC driver installation (use custom Docker image)
- **Timeout**: Functions have 10-minute timeout (consumption plan). Use Premium plan for longer execution
- **Dependencies**: Ensure all Python packages are in `requirements.txt`
- **Secrets**: Store SQL passwords in Azure Key Vault, not in app settings

