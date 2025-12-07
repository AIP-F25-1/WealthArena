# Phase 11: Azure Cloud Deployment Guide (No Docker)

## Overview

Deploy all three WealthArena services (Backend, Chatbot, RL Service) to Azure Web Apps using native runtimes (Node.js 20, Python 3.11) via `az webapp up` command. This approach bypasses Docker entirely and leverages Azure's Oryx build service.

## Prerequisites

- ✅ Azure CLI installed (version 2.50+)
- ✅ Azure account with active subscription (student account acceptable)
- ✅ Phases 1-10 completed (database, data pipeline, local services tested)
- ✅ Azure infrastructure provisioned (setup_master.ps1 executed)
- ✅ Trained RL models (optional, can use mock mode)

## Architecture

```
Azure Cloud Deployment

├── App Service Plan 1: wealtharena-plan (Linux B1)
│   ├── Web App 1: wealtharena-backend (Node.js 20)
│   │   ├── Runtime: NODE:20-lts
│   │   ├── Port: 8080
│   │   └── Connects to: Azure SQL Database
│   └── Web App 2: wealtharena-chatbot (Python 3.11)
│       ├── Runtime: PYTHON:3.11
│       ├── Port: 8000
│       └── Uses: GROQ API, Chroma DB
├── App Service Plan 2: wealtharena-rl-plan (Linux B2)
│   └── Web App 3: wealtharena-rl (Python 3.11)
│       ├── Runtime: PYTHON:3.11
│       ├── Port: 8000
│       └── Connects to: Azure SQL, Azure Blob (models)
└── Azure Storage Blob: rl-models container
    └── Model checkpoints from Phase 7

Note: RL service uses separate B2 plan due to memory requirements (Ray, PyTorch).
Backend and Chatbot share B1 plan for cost optimization.
```

## Step-by-Step Deployment

### Step 1: Verify Azure Resources

**Check if infrastructure exists:**

```powershell
cd azure_infrastructure
.\verify_resources.ps1 -ResourceGroupName "rg-wealtharena-northcentralus" -Environment "dev"
```

**Expected Output:**

- ✅ Resource Group: rg-wealtharena-northcentralus
- ✅ Storage Account: stwealtharenadev
- ✅ SQL Server: sql-wealtharena-dev
- ✅ SQL Database: wealtharena_db
- ✅ SQL Firewall Rule: AllowAzureServices (allows Azure services to connect)

**Note:** The verification script automatically checks and creates the `AllowAzureServices` firewall rule if it doesn't exist. This rule allows Azure services (like Web Apps) to connect to the SQL database.

**If resources missing:**

```powershell
.\setup_master.ps1 -ResourceGroupName "rg-wealtharena-northcentralus" -Location "northcentralus" -Environment "dev"
```

**If firewall rule missing (manual creation):**

```powershell
az sql server firewall-rule create `
  --name AllowAzureServices `
  --server sql-wealtharena-dev `
  --resource-group rg-wealtharena-northcentralus `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

---

### Step 2: Deploy Backend Service

**Navigate to project root:**

```powershell
cd "c:/Users/PC/Desktop/AIP Project Folder/WealthArena_UI"
```

**Deploy using deployment script:**

```powershell
cd scripts/azure_deployment
.\deploy_backend.ps1 -ResourceGroup "rg-wealtharena-northcentralus" -Location "northcentralus"
```

**What happens:**

1. Azure detects package.json and identifies Node.js project
2. Creates App Service Plan (if doesn't exist)
3. Creates Web App with Node.js 20 runtime
4. Zips source code and uploads
5. Oryx build service runs `npm install` and `npm run build`
6. Starts application with `npm start`
7. Returns deployment URL

**Expected Duration:** 5-8 minutes

**Manual Deployment (if script doesn't work):**

```powershell
# Create shared App Service Plan first (if it doesn't exist)
az appservice plan create `
  --name wealtharena-plan `
  --resource-group rg-wealtharena-northcentralus `
  --location northcentralus `
  --sku B1 `
  --is-linux

cd WealthArena_Backend
az webapp up `
  --name wealtharena-backend `
  --resource-group rg-wealtharena-northcentralus `
  --plan wealtharena-plan `
  --runtime "NODE:20-lts" `
  --sku B1 `
  --location northcentralus
```

**Test deployment:**

```bash
curl https://wealtharena-backend.azurewebsites.net/api/health
# Expected: {"success": true, "message": "WealthArena API is running"}
```

---

### Step 3: Deploy Chatbot Service

**Deploy using deployment script:**

```powershell
cd scripts/azure_deployment
.\deploy_chatbot.ps1 -ResourceGroup "rg-wealtharena-northcentralus" -Location "northcentralus"
```

**Expected Duration:** 8-12 minutes (pip install for 21 packages)

**Manual Deployment (if script doesn't work):**

```powershell
# Create shared App Service Plan first (if it doesn't exist)
az appservice plan create `
  --name wealtharena-plan `
  --resource-group rg-wealtharena-northcentralus `
  --location northcentralus `
  --sku B1 `
  --is-linux

cd wealtharena_chatbot

# Deploy (startup command set directly, no startup.txt needed)
az webapp up `
  --name wealtharena-chatbot `
  --resource-group rg-wealtharena-northcentralus `
  --plan wealtharena-plan `
  --runtime "PYTHON:3.11" `
  --sku B1 `
  --location northcentralus

# Configure startup command
az webapp config set `
  --name wealtharena-chatbot `
  --resource-group rg-wealtharena-northcentralus `
  --startup-file "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"
```

**Test deployment:**

```bash
curl https://wealtharena-chatbot.azurewebsites.net/healthz
# Expected: {"status": "healthy", "service": "wealtharena-mobile-api", "version": "1.0.0"}
```

---

### Step 4: Deploy RL Inference Service

**Deploy using deployment script:**

```powershell
cd scripts/azure_deployment
.\deploy_rl_service.ps1 -ResourceGroup "rg-wealtharena-northcentralus" -Location "northcentralus"
```

**Note:** B2 tier (3.5GB RAM) recommended for Ray and PyTorch. B1 (1.75GB) may cause out-of-memory errors.

**Expected Duration:** 10-15 minutes (pip install for Ray, PyTorch - large packages)

**Manual Deployment (if script doesn't work):**

```powershell
# Create App Service Plan for RL service (B2 tier for Ray/PyTorch)
az appservice plan create `
  --name wealtharena-rl-plan `
  --resource-group rg-wealtharena-northcentralus `
  --location northcentralus `
  --sku B2 `
  --is-linux

cd services/rl-service

# Deploy (startup command set directly, no startup.txt needed)
az webapp up `
  --name wealtharena-rl `
  --resource-group rg-wealtharena-northcentralus `
  --plan wealtharena-rl-plan `
  --runtime "PYTHON:3.11" `
  --sku B2 `
  --location northcentralus

# Configure startup command
az webapp config set `
  --name wealtharena-rl `
  --resource-group rg-wealtharena-northcentralus `
  --startup-file "gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 --chdir api api.inference_server:app"
```

**Test deployment:**

```bash
curl https://wealtharena-rl.azurewebsites.net/health
# Expected: {"status": "healthy", "model_loaded": true}
```

---

### Step 5: Upload Model Checkpoints to Azure Blob Storage

**Upload using script:**

```powershell
cd scripts/azure_deployment
.\upload_models.ps1 -StorageAccount "stwealtharenadev" -ResourceGroup "rg-wealtharena-northcentralus"
```

**Expected Duration:** 5-10 minutes (depends on internet speed, ~250-500MB total)

**Manual Upload (if script doesn't work):**

```powershell
# Create blob container
az storage container create `
  --name rl-models `
  --account-name stwealtharenadev `
  --auth-mode login

# Upload ASX stocks model
az storage blob upload-batch `
  --source "wealtharena_rl/checkpoints/asx_stocks/asx_stocks" `
  --destination "rl-models/latest/asx_stocks" `
  --account-name stwealtharenadev `
  --auth-mode login

# Upload other asset classes similarly...
```

**Verify uploads:**

```powershell
az storage blob list `
  --container-name rl-models `
  --account-name stwealtharenadev `
  --prefix latest/ `
  --auth-mode login `
  --output table
```

**Expected:** 25 blobs (5 asset classes × 5 files: model.pt, training.pkl, optimizer.pkl, metadata.json, latest_checkpoint.json)

**If Models Not Trained:**

Skip this step. RL service will operate in mock mode (MODEL_MODE=mock in App Settings).

---

### Step 6: Configure App Settings for All Services

**Configure using script:**

```powershell
cd scripts/azure_deployment
.\configure_app_settings.ps1 -ResourceGroup "rg-wealtharena-northcentralus"
```

**Manual Configuration (if script doesn't work):**

**Backend App Settings:**

```powershell
az webapp config appsettings set `
  --name wealtharena-backend `
  --resource-group rg-wealtharena-northcentralus `
  --settings `
    DB_HOST="sql-wealtharena-dev.database.windows.net" `
    DB_NAME="wealtharena_db" `
    DB_USER="wealtharena_admin" `
    DB_PASSWORD="@Microsoft.KeyVault(SecretUri=https://kv-wealtharena-dev.vault.azure.net/secrets/sql-password/)" `
    DB_PORT="1433" `
    DB_ENCRYPT="true" `
    NODE_ENV="production" `
    PORT="8080" `
    JWT_SECRET="<generate-secure-secret>" `
    CHATBOT_API_URL="https://wealtharena-chatbot.azurewebsites.net" `
    RL_API_URL="https://wealtharena-rl.azurewebsites.net"
```

**Note:** Replace the `DB_PASSWORD` value with either:
- A value from `azure_infrastructure/.env` (for development)
- A Key Vault reference (recommended for production): `@Microsoft.KeyVault(SecretUri=https://kv-wealtharena-dev.vault.azure.net/secrets/sql-password/)`

**Chatbot App Settings:**

```powershell
az webapp config appsettings set `
  --name wealtharena-chatbot `
  --resource-group rg-wealtharena-northcentralus `
  --settings `
    GROQ_API_KEY="@Microsoft.KeyVault(SecretUri=https://kv-wealtharena-dev.vault.azure.net/secrets/groq-api-key/)" `
    GROQ_MODEL="llama3-8b-8192" `
    PORT="8000" `
    WEBSITES_PORT="8000" `
    SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

**Note:** Replace the `GROQ_API_KEY` value with either:
- A value from `azure_infrastructure/.env` (for development)
- A Key Vault reference (recommended for production): `@Microsoft.KeyVault(SecretUri=https://kv-wealtharena-dev.vault.azure.net/secrets/groq-api-key/)`

**RL Service App Settings:**

```powershell
az webapp config appsettings set `
  --name wealtharena-rl `
  --resource-group rg-wealtharena-northcentralus `
  --settings `
    DB_HOST="sql-wealtharena-dev.database.windows.net" `
    DB_NAME="wealtharena_db" `
    DB_USER="wealtharena_admin" `
    DB_PASSWORD="@Microsoft.KeyVault(SecretUri=https://kv-wealtharena-dev.vault.azure.net/secrets/sql-password/)" `
    MODEL_PATH="/home/site/models/latest" `
    MODEL_MODE="mock" `
    PORT="8000" `
    WEBSITES_PORT="8000" `
    AZURE_STORAGE_CONNECTION_STRING="@Microsoft.KeyVault(SecretUri=https://kv-wealtharena-dev.vault.azure.net/secrets/storage-connection-string/)"
```

**Note:** 
- Replace secrets with values from `azure_infrastructure/.env` or Key Vault references
- Set `MODEL_MODE=mock` if models haven't been uploaded yet
- Set `MODEL_MODE=production` after uploading models

**Restart all services:**

```powershell
az webapp restart --name wealtharena-backend --resource-group rg-wealtharena-northcentralus
az webapp restart --name wealtharena-chatbot --resource-group rg-wealtharena-northcentralus
az webapp restart --name wealtharena-rl --resource-group rg-wealtharena-northcentralus
```

---

### Step 7: Test Deployed Services

**Run comprehensive tests:**

```powershell
cd scripts/azure_deployment
.\test_deployments.ps1 -ResourceGroup "rg-wealtharena-northcentralus"
```

**Manual Testing:**

**Backend:**

```bash
# Health check
curl https://wealtharena-backend.azurewebsites.net/api/health

# API documentation
curl https://wealtharena-backend.azurewebsites.net/

# Test signup (should work)
curl -X POST https://wealtharena-backend.azurewebsites.net/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!", "username": "testuser"}'
```

**Chatbot:**

```bash
# Health check
curl https://wealtharena-chatbot.azurewebsites.net/healthz

# Test chat
curl -X POST https://wealtharena-chatbot.azurewebsites.net/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is RSI?", "user_id": "test"}'

# Test knowledge topics
curl https://wealtharena-chatbot.azurewebsites.net/context/knowledge/topics
```

**RL Service:**

```bash
# Health check
curl https://wealtharena-rl.azurewebsites.net/health

# Test prediction
curl -X POST https://wealtharena-rl.azurewebsites.net/predict \
  -H "Content-Type: application/json" \
  -d '{"market_state": [[0.1, 0.2]], "symbol": "BHP.AX", "asset_type": "stock"}'
```

---

### Step 8: Update Frontend Configuration

**Update frontend .env for Azure:**

Create or update `WealthArena/.env.azure` with deployed URLs:

```bash
# Deployment Environment
EXPO_PUBLIC_DEPLOYMENT_ENV=azure

# Backend API URLs (Update after deployment)
EXPO_PUBLIC_BACKEND_URL=https://wealtharena-backend.azurewebsites.net
EXPO_PUBLIC_CHATBOT_URL=https://wealtharena-chatbot.azurewebsites.net
EXPO_PUBLIC_RL_SERVICE_URL=https://wealtharena-rl.azurewebsites.net

# Feature Flags
EXPO_PUBLIC_ENABLE_CHATBOT=true
EXPO_PUBLIC_ENABLE_REAL_TIME_SIGNALS=true
EXPO_PUBLIC_ENABLE_PORTFOLIO_ANALYTICS=true

# Docker Mode (disabled for Azure)
EXPO_PUBLIC_DOCKER=false
```

**Copy to .env for testing:**

```powershell
cd WealthArena
copy .env.azure .env
```

**Restart Expo:**

```bash
npm start
```

**Test frontend with Azure backend:**

1. Open app on device/emulator
2. Login with test account
3. Navigate to dashboard
4. Verify data loads from Azure backend
5. Test signals page (RL service)
6. Test AI chat (chatbot service)

---

## Quick Deployment (All Services)

**Use master deployment script:**

```powershell
cd scripts/azure_deployment
.\deploy_all_services.ps1 -ResourceGroup "rg-wealtharena-northcentralus" -Location "northcentralus"
```

This script orchestrates all deployment steps:
1. Verifies Azure resources
2. Deploys backend (5-8 minutes)
3. Deploys chatbot (8-12 minutes)
4. Deploys RL service (10-15 minutes)
5. Uploads model checkpoints (if trained)
6. Configures App Settings
7. Runs health checks

**Total Time:** 30-40 minutes

---

## Troubleshooting

### Issue: Deployment timeout

**Solution:**

```powershell
az webapp up --name <app-name> --resource-group <rg> --runtime <runtime> --timeout 1800
```

### Issue: Build fails for Python services

**Solution:**

Check requirements.txt is in root directory. Oryx looks for requirements.txt to detect Python project.

### Issue: Backend can't connect to database

**Solution:**

1. Verify firewall rule (automatically checked during verification):
```powershell
az sql server firewall-rule show --name AllowAzureServices --server sql-wealtharena-dev --resource-group rg-wealtharena-northcentralus
```

2. If missing, the verification script will attempt to create it automatically. If it fails, create manually:
```powershell
az sql server firewall-rule create `
  --name AllowAzureServices `
  --server sql-wealtharena-dev `
  --resource-group rg-wealtharena-northcentralus `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

**Note:** The `AllowAzureServices` firewall rule (0.0.0.0 to 0.0.0.0) allows all Azure services to connect to the SQL database, which is required for Web Apps to access the database.

### Issue: RL service out of memory

**Solution:**

Upgrade to B2 tier:

```powershell
az appservice plan update --name <plan> --resource-group <rg> --sku B2
```

### Issue: Chatbot GROQ API errors

**Solution:**

Verify GROQ_API_KEY in App Settings:

```powershell
az webapp config appsettings list --name wealtharena-chatbot --resource-group rg-wealtharena-northcentralus --query "[?name=='GROQ_API_KEY'].value"
```

### Issue: Services not starting

**Solution:**

Check logs:

```powershell
az webapp log tail --name wealtharena-backend --resource-group rg-wealtharena-northcentralus
```

---

## Monitoring & Logs

**Enable Application Insights (optional):**

```powershell
az monitor app-insights component create `
  --app wealtharena-insights `
  --location northcentralus `
  --resource-group rg-wealtharena-northcentralus

# Link to Web Apps
az webapp config appsettings set `
  --name wealtharena-backend `
  --resource-group rg-wealtharena-northcentralus `
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="<connection-string>"
```

**View logs in real-time:**

```powershell
az webapp log tail --name wealtharena-backend --resource-group rg-wealtharena-northcentralus
```

**Download logs:**

```powershell
az webapp log download --name wealtharena-backend --resource-group rg-wealtharena-northcentralus --log-file backend-logs.zip
```

---

## Cost Optimization

**Current Configuration:**

- App Service Plan B1 (wealtharena-plan): ~$13/month (shared by backend + chatbot)
- App Service Plan B2 (wealtharena-rl-plan): ~$26/month (RL service, separate due to memory requirements)
- Azure SQL Basic: ~$5/month
- Storage Account: ~$0.50/month
- **Total: ~$44.50/month**

**For Demo (2 weeks):**

- Use Azure free credits (student account typically has $100)
- Total cost: ~$9-22 for 2 weeks
- Well within free credit limits

**After Demo:**

- Stop Web Apps:
```powershell
az webapp stop --name <app-name> --resource-group <rg>
```

- Or delete resource group:
```powershell
az group delete --name rg-wealtharena-northcentralus --yes
```

---

## Deployment Summary

**Deployed Services:**

- ✅ Backend: https://wealtharena-backend.azurewebsites.net
- ✅ Chatbot: https://wealtharena-chatbot.azurewebsites.net
- ✅ RL Service: https://wealtharena-rl.azurewebsites.net

**Database:**

- ✅ Azure SQL: sql-wealtharena-dev.database.windows.net / wealtharena_db

**Storage:**

- ✅ Blob Storage: stwealtharenadev / rl-models container

**Next Steps:**

1. ✅ Test all services via HTTPS
2. ✅ Update frontend with Azure URLs
3. ✅ Test end-to-end user flows
4. ➡️ Proceed to Phase 12: GCP Deployment (optional)
5. ➡️ Proceed to Phase 13: End-to-End Testing

**Phase 11 Status:** ✅ Azure Deployment Complete

**Total Deployment Time:** 30-40 minutes

---

## Deployment Scripts Reference

All deployment scripts are located in `scripts/azure_deployment/`:

- `deploy_backend.ps1` - Deploy backend service
- `deploy_chatbot.ps1` - Deploy chatbot service
- `deploy_rl_service.ps1` - Deploy RL inference service
- `upload_models.ps1` - Upload model checkpoints to Azure Blob
- `configure_app_settings.ps1` - Configure App Settings for all services
- `deploy_all_services.ps1` - Master orchestration script
- `test_deployments.ps1` - Test all deployed services

---

## Additional Resources

- [Azure Web Apps Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
- [Oryx Build Service](https://github.com/microsoft/Oryx)
- [Azure App Service Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)

