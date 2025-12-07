# WealthArena Deployment Guide

This guide covers deploying WealthArena using the **master deployment script** (`deploy-master.ps1`).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Master Deployment Script](#master-deployment-script)
3. [Docker Deployment](#docker-deployment)
4. [Azure App Service Deployment](#azure-app-service-deployment)
5. [Data Pipeline](#data-pipeline)
6. [Production Configuration](#production-configuration)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Environment Variables

**⚠️ Security Warning:** Never commit your `.env` file to version control. The `.env` file is already included in `.gitignore`. If you have accidentally committed a `.env` file containing a real `GROQ_API_KEY`, you must:
1. Rotate the exposed API key immediately in the Groq console (https://console.groq.com/)
2. Remove the real key from your `.env` file and replace it with a placeholder
3. Ensure `.env` remains in `.gitignore` to prevent future commits

**⚠️ Important:** Even with `.gitignore` protection, local `.env` files with real secrets pose security risks:
- Files can be accidentally shared via project folders, backups, or screenshots
- Use placeholders in `.env` files; real keys should only exist in:
  - Azure App Settings (for production)
  - Environment variables (for local development)
  - Secure vaults (Azure Key Vault recommended for production)

**For Azure deployments:** The `.env` file is used locally by deployment scripts to read the key and set it in Azure App Settings. After deployment, the real key exists only in Azure, not in your local `.env` file.

Create a `.env` file with the following variables (use placeholder values, not real keys):

```env
# Required
GROQ_API_KEY=gsk_your_actual_key_here  # Replace with your actual key from https://console.groq.com/
CHROMA_PERSIST_DIR=/app/data/vectorstore  # Use absolute path in containers (Docker)
# For Azure: CHROMA_PERSIST_DIR=/home/data/vectorstore (auto-set by deploy-master.ps1)

# Optional
GROQ_MODEL=llama3-8b-8192
LLM_PROVIDER=groq
APP_HOST=0.0.0.0
APP_PORT=8000
PORT=8000  # For cloud platforms

# CORS (comma-separated origins)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### System Requirements

- **Python**: 3.12 (recommended)
- **Memory**: 2GB+ (4GB recommended for production)
- **Disk**: 5GB+ for vector store and dependencies
- **Network**: Outbound HTTPS for API calls

---

## Master Deployment Script

All deployment operations are handled by a single master script: `deploy-master.ps1`

### Usage Overview

```powershell
# Data Pipeline (default)
.\deploy-master.ps1
.\deploy-master.ps1 --skip-pdf-ingest
.\deploy-master.ps1 --full-refresh

# Docker Deployment
.\deploy-master.ps1 --deploy docker
.\deploy-master.ps1 --deploy docker -Build -Run
.\deploy-master.ps1 --deploy docker -Stop
.\deploy-master.ps1 --deploy docker -Logs

# Azure Deployment
.\deploy-master.ps1 --deploy azure -ResourceGroup "rg-wealtharena" -AppName "wealtharena-api"
.\deploy-master.ps1 --deploy azure -ResourceGroup "rg-wealtharena" -AppName "wealtharena-api" -Location "eastus" -Sku "B1"
```

---

## Docker Deployment

### Quick Start

**Using master deployment script:**
```powershell
# Full deployment (build + run)
.\deploy-master.ps1 --deploy docker

# Build only
.\deploy-master.ps1 --deploy docker -Build

# Run only (assumes image exists)
.\deploy-master.ps1 --deploy docker -Run

# Stop container
.\deploy-master.ps1 --deploy docker -Stop

# View logs
.\deploy-master.ps1 --deploy docker -Logs
```

**Using docker-compose:**
```bash
# Build and run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Docker Commands

```bash
# Build image
docker build -t wealtharena-api:latest .

# Run container
docker run -d \
  --name wealtharena-api \
  -p 8000:8000 \
  --env-file .env \
  -v $(pwd)/data/vectorstore:/app/data/vectorstore \
  -v $(pwd)/data/chat_history.db:/app/data/chat_history.db \
  wealtharena-api:latest

# View logs
docker logs -f wealtharena-api

# Stop container
docker stop wealtharena-api
```

### Production Docker Deployment

For production, use environment variables instead of `.env` file:

```bash
docker run -d \
  --name wealtharena-api \
  -p 8000:8000 \
  -e GROQ_API_KEY=your_key_here \
  -e CHROMA_PERSIST_DIR=/app/data/vectorstore \
  -e PORT=8000 \
  -v wealtharena-data:/app/data \
  --restart unless-stopped \
  wealtharena-api:latest
```

---

## Azure App Service Deployment

### Quick Start for Azure Deployment

**Prerequisites Checklist:**
- [ ] Azure CLI installed and verified: `az --version`
- [ ] Logged in to Azure: `az login`
- [ ] `.env` file configured with `GROQ_API_KEY` and `CORS_ALLOWED_ORIGINS` for your frontend domain

**Single-Command Deployment:**
```powershell
.\deploy-master.ps1 --deploy azure -ResourceGroup rg-wealtharena -AppName your-unique-app-name -Location eastus -Sku B1
```

**Important Notes:**
- `AppName` must be globally unique and becomes part of your URL: `https://your-app-name.azurewebsites.net`
- Initial deployment takes 15-20 minutes due to chromadb dependency compilation. Subsequent deployments will be faster (3-5 minutes).
- The script preserves all working functionality and doesn't modify application code

**Troubleshooting:**
- Verify Azure CLI login status: `az account show`
- Ensure app name is globally unique (try adding numbers or your name)
- Check that `.env` file exists and contains required variables (`GROQ_API_KEY`, `CORS_ALLOWED_ORIGINS`)

### Prerequisites

1. **Azure CLI** installed and logged in:
   ```bash
   az login
   ```

2. **Resource Group** (will be created if it doesn't exist)

3. **.env file** with all required variables

### Automated Deployment

Use the master deployment script:

```powershell
# Windows PowerShell
.\deploy-master.ps1 --deploy azure `
  -ResourceGroup "rg-wealtharena" `
  -AppName "wealtharena-api" `
  -Location "eastus" `
  -Sku "B1" `
  -PythonVersion "3.12"
```

**Parameters:**
- `-ResourceGroup`: Azure resource group name
- `-AppName`: Web app name (must be globally unique)
- `-Location`: Azure region (default: "eastus")
- `-Sku`: App Service plan SKU (default: "B1")
- `-PythonVersion`: Python version (default: "3.12")

### Manual Azure Deployment

#### 1. Create Resource Group

```bash
az group create --name rg-wealtharena --location eastus
```

#### 2. Create App Service Plan

```bash
az appservice plan create \
  --name wealtharena-plan \
  --resource-group rg-wealtharena \
  --location eastus \
  --sku B1 \
  --is-linux
```

#### 3. Create Web App

```bash
az webapp create \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --plan wealtharena-plan \
  --runtime "PYTHON|3.12"
```

#### 4. Configure App Settings

**Critical: Remove WEBSITE_RUN_FROM_PACKAGE**

```bash
az webapp config appsettings delete \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --setting-names WEBSITE_RUN_FROM_PACKAGE
```

**Enable Oryx Build:**

```bash
az webapp config appsettings set \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

**Set Environment Variables:**

**Note:** If using the master deployment script (`deploy-master.ps1`), `CHROMA_PERSIST_DIR` is automatically set to `/home/data/vectorstore` for Azure deployments. The script ignores the `CHROMA_PERSIST_DIR` value from your local `.env` file to prevent Windows paths from being propagated. This ensures consistency with Azure Files mount paths.

For manual deployment:

```bash
az webapp config appsettings set \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --settings \
    GROQ_API_KEY="your_key_here" \
    CHROMA_PERSIST_DIR="/home/data/vectorstore" \
    PORT=8000
```

**Set Startup Command:**

```bash
az webapp config set \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --startup-file "gunicorn --bind 0.0.0.0:8000 --workers 2 --worker-class uvicorn.workers.UvicornWorker --timeout 120 app.main:app"
```

#### 5. Deploy Application

The master script automatically creates and deploys a ZIP package. For manual deployment:

```bash
# Create zip excluding dev files
zip -r deploy.zip . \
  -x "*.pyc" "__pycache__/*" ".venv/*" "*.log" \
  ".git/*" "tests/*" "examples/*" "ml/notebooks/*" \
  "app-logs/*" "data/raw/*" "data/processed/*" ".env"

# Deploy to Azure
az webapp deployment source config-zip \
  --resource-group rg-wealtharena \
  --name wealtharena-api \
  --src deploy.zip
```

**Note on `.deployment` file:** The repository includes a `.deployment` file, which is primarily used for **Kudu-based deployments** (Git-based deployments via Azure DevOps or GitHub Actions). This file is **not required** for the ZIP deployment path used by `deploy-master.ps1`. The master script handles Python runtime configuration directly via Azure CLI (`--runtime "PYTHON|3.12"`), so the `.deployment` file is not used during ZIP deployments. If you're using Git-based deployments with Kudu, the `.deployment` file may be helpful, but for the standard ZIP deployment workflow, it can be safely ignored.

#### 6. Verify Deployment

```bash
# Check health endpoint
curl https://wealtharena-api.azurewebsites.net/healthz

# View logs
az webapp log tail --name wealtharena-api --resource-group rg-wealtharena
```

---

## Data Pipeline

The master script also handles data pipeline operations (default mode):

```powershell
# Run full pipeline (environment setup + PDF ingestion + API verification)
.\deploy-master.ps1

# Skip PDF ingestion
.\deploy-master.ps1 --skip-pdf-ingest

# Full refresh (update existing PDF chunks)
.\deploy-master.ps1 --full-refresh
```

**Pipeline Phases:**
1. **Phase 0**: Environment setup (Python, venv, packages, directories)
2. **Phase 1**: PDF ingestion into vector database
3. **Phase 2**: API verification (tests endpoints if server is running)
4. **Phase 3**: Summary and next steps

---

## Production Configuration

### Gunicorn Configuration

For production, use gunicorn with uvicorn workers:

```bash
gunicorn \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --worker-class uvicorn.workers.UvicornWorker \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  app.main:app
```

**Recommended Workers:**
- `workers = (2 * CPU cores) + 1`
- For Azure B1 (1 core): `--workers 2`
- For Azure B2 (2 cores): `--workers 4`

### Environment Variables for Production

```env
# Server
PORT=8000
APP_HOST=0.0.0.0

# CORS (comma-separated)
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Logging
LOG_LEVEL=INFO

# Performance
WORKERS=2
TIMEOUT=120
```

### Health Checks

The application exposes a health check endpoint:

```bash
GET /healthz
```

**Response:**
```json
{
  "status": "ok"
}
```

### Monitoring

**Prometheus Metrics:**
```bash
GET /metrics
```

**JSON Metrics:**
```bash
GET /v1/metrics/basic
```

---

## Persistent Storage for Vector Store

**Important**: Azure App Service has ephemeral storage. For production, use Azure Files or Azure Blob Storage.

**Path Standardization**: All Azure deployments use `/home/data/vectorstore` as the `CHROMA_PERSIST_DIR` path. This path is:
- Automatically set by `deploy-master.ps1` during Azure deployment
- Consistent with the Azure Files mount path (if configured)
- Different from Docker deployments which use `/app/data/vectorstore`

### Option A: Azure Files (Recommended for App Service)

```powershell
# Create storage account
az storage account create `
  --name wealtharenastorage `
  --resource-group rg-wealtharena `
  --location eastus `
  --sku Standard_LRS

# Create file share
az storage share create `
  --name vectorstore `
  --account-name wealtharenastorage

# Mount to App Service
az webapp config storage-account add `
  --name wealtharena-api `
  --resource-group rg-wealtharena `
  --custom-id vectorstore `
  --storage-type AzureFiles `
  --share-name vectorstore `
  --account-name wealtharenastorage `
  --access-key (az storage account keys list --account-name wealtharenastorage --resource-group rg-wealtharena --query [0].value -o tsv) `
  --mount-path /home/data/vectorstore
```

**Update App Setting:**
```powershell
az webapp config appsettings set `
  --name wealtharena-api `
  --resource-group rg-wealtharena `
  --settings CHROMA_PERSIST_DIR="/home/data/vectorstore"
```

### Option B: Azure Blob Storage (Alternative)

For blob storage integration, you'll need to modify the vector store initialization to use Azure Blob Storage instead of local filesystem. This requires code changes.

---

## UI Integration

### React Native Integration

The codebase includes React Native components in `packages/wealtharena-rn/`:

**1. Install Dependencies:**
```bash
cd packages/wealtharena-rn
npm install
```

**2. Update API URL:**
Edit `examples/rn-demo/App.tsx`:
```typescript
const wealthArenaClient = createWealthArenaClient(
  'https://wealtharena-api.azurewebsites.net', // Your Azure API URL
  undefined // Auth token if needed
);
```

**3. Build & Deploy:**
```bash
# For iOS
cd examples/rn-demo
npx react-native run-ios

# For Android
npx react-native run-android
```

### Web UI Integration

**1. Create Frontend Project** (if not exists):
```bash
npx create-react-app wealtharena-web
cd wealtharena-web
npm install axios
```

**2. Create API Client:**
```typescript
// src/api/wealtharena.ts
import axios from 'axios';

const API_URL = 'https://wealtharena-api.azurewebsites.net';

export const wealthArenaAPI = {
  search: async (query: string, k: number = 5) => {
    const response = await axios.get(`${API_URL}/v1/search`, {
      params: { q: query, k }
    });
    return response.data;
  },
  
  chat: async (message: string, userId: string) => {
    const response = await axios.post(`${API_URL}/v1/chat`, {
      message,
      user_id: userId
    });
    return response.data;
  },
  
  getState: async () => {
    const response = await axios.get(`${API_URL}/v1/state`);
    return response.data;
  }
};
```

**3. Deploy Web UI to Azure Static Web Apps:**
```powershell
# Create Static Web App
az staticwebapp create `
  --name wealtharena-web `
  --resource-group rg-wealtharena `
  --location eastus2 `
  --sku Free

# Deploy from GitHub Actions or manually
```

---

## Continuous Deployment

### GitHub Actions Workflow

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Deploy to Azure
        uses: azure/webapps-deploy@v2
        with:
          app-name: 'wealtharena-api'
          package: '.'
```

---

## Monitoring & Logging

### Application Insights

```powershell
# Create Application Insights
az monitor app-insights component create `
  --app wealtharena-insights `
  --location eastus `
  --resource-group rg-wealtharena

# Get instrumentation key
$instrumentationKey = (az monitor app-insights component show --app wealtharena-insights --resource-group rg-wealtharena --query instrumentationKey -o tsv)

# Add to app settings
az webapp config appsettings set `
  --name wealtharena-api `
  --resource-group rg-wealtharena `
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$instrumentationKey
```

### View Logs

```powershell
# Stream logs
az webapp log tail --name wealtharena-api --resource-group rg-wealtharena

# Download logs
az webapp log download --name wealtharena-api --resource-group rg-wealtharena --log-file app-logs.zip
```

---

## Troubleshooting

### Docker Issues

**Container exits immediately:**
```bash
# Check logs
docker logs wealtharena-api

# Common causes:
# - Missing GROQ_API_KEY
# - Port conflict
# - Volume mount issues
```

**Vector store not persisting:**
- Ensure volume mount: `-v $(pwd)/data/vectorstore:/app/data/vectorstore`
- Check permissions on host directory

### Azure Issues

#### Module Import Errors (Application container failed to start)

**Symptoms:**
- HTTP 503 errors when accessing the app
- Azure portal shows: "Application container failed to start"
- Error message: "interpreter is unable to locate a module or package"
- Logs show: `ModuleNotFoundError` or `ImportError`

**Root Causes:**
1. **Missing or incorrect PYTHONPATH**: Relative imports require PYTHONPATH to be set to `/home/site/wwwroot`
2. **WEBSITE_RUN_FROM_PACKAGE blocking Oryx build**: This setting prevents dependency installation
3. **Oryx build not enabled**: `SCM_DO_BUILD_DURING_DEPLOYMENT` must be set to `true`
4. **Incorrect startup command**: Must use `startup.sh` or proper gunicorn command
5. **Build timeout or failure**: Dependencies may not have been installed successfully

**Quick Fix (Automated):**
Use the automatic fix script to resolve all configuration issues:
```powershell
# Standard usage (reads GROQ_API_KEY from .env file)
.\scripts\azure_fix_deployment.ps1 -AppName "wealtharena-api" -ResourceGroup "rg-wealtharena"

# Skip automatic restart after applying fixes
.\scripts\azure_fix_deployment.ps1 -AppName "wealtharena-api" -ResourceGroup "rg-wealtharena" -SkipRestart
```

**Note:** The script automatically reads `GROQ_API_KEY` from the `.env` file in the project root. Ensure your `.env` file contains a valid `GROQ_API_KEY` before running the script.

For the master deployment script, use the `-AutoFixOnFailure` parameter to automatically run the fix script when configuration issues are detected:
```powershell
.\deploy-master.ps1 --deploy azure `
  -ResourceGroup "rg-wealtharena" `
  -AppName "wealtharena-api" `
  -AutoFixOnFailure
```

**Diagnostic Check:**
Verify your current configuration:
```powershell
.\scripts\azure_verify_config.ps1 -AppName "wealtharena-api" -ResourceGroup "rg-wealtharena"
```

**Manual Fix (Step by Step):**

1. **Verify SCM_DO_BUILD_DURING_DEPLOYMENT is enabled:**
   ```bash
   # Check current setting
   az webapp config appsettings list --name wealtharena-api --resource-group rg-wealtharena --query "[?name=='SCM_DO_BUILD_DURING_DEPLOYMENT']"
   
   # Set if missing or false
   az webapp config appsettings set \
     --name wealtharena-api \
     --resource-group rg-wealtharena \
     --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
   ```

2. **Remove WEBSITE_RUN_FROM_PACKAGE (if present):**
   ```bash
   # Check if it exists
   az webapp config appsettings list --name wealtharena-api --resource-group rg-wealtharena --query "[?name=='WEBSITE_RUN_FROM_PACKAGE']"
   
   # Remove it
   az webapp config appsettings delete \
     --name wealtharena-api \
     --resource-group rg-wealtharena \
     --setting-names WEBSITE_RUN_FROM_PACKAGE
   ```

3. **Set PYTHONPATH:**
   ```bash
   az webapp config appsettings set \
     --name wealtharena-api \
     --resource-group rg-wealtharena \
     --settings PYTHONPATH=/home/site/wwwroot
   ```

4. **Verify startup command:**
   ```bash
   # Check current startup command
   az webapp config show --name wealtharena-api --resource-group rg-wealtharena --query "appCommandLine"
   
   # Set correct startup command
   az webapp config set \
     --name wealtharena-api \
     --resource-group rg-wealtharena \
     --startup-file "bash startup.sh"
   ```

5. **Verify required environment variables:**
   ```bash
   # Check GROQ_API_KEY
   az webapp config appsettings list --name wealtharena-api --resource-group rg-wealtharena --query "[?name=='GROQ_API_KEY']"
   
   # Set if missing (REQUIRED)
   az webapp config appsettings set \
     --name wealtharena-api \
     --resource-group rg-wealtharena \
     --settings GROQ_API_KEY="gsk_your_actual_key_here"
   ```

6. **Restart the app:**
   ```bash
   az webapp restart --name wealtharena-api --resource-group rg-wealtharena
   ```

7. **Monitor deployment logs:**
   ```bash
   az webapp log tail --name wealtharena-api --resource-group rg-wealtharena
   ```
   
   Look for:
   - ✅ Oryx build output showing dependency installation
   - ✅ "Starting gunicorn" or startup script output
   - ✅ No import errors
   
8. **Test the health endpoint:**
   ```bash
   curl https://wealtharena-api.azurewebsites.net/healthz
   # Expected: {"status":"ok"}
   ```

**Verification Checklist:**
- [ ] `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`
- [ ] `WEBSITE_RUN_FROM_PACKAGE` is NOT set
- [ ] `PYTHONPATH` = `/home/site/wwwroot`
- [ ] `GROQ_API_KEY` is set and starts with `gsk_`
- [ ] `CHROMA_PERSIST_DIR` = `/home/data/vectorstore`
- [ ] Startup command uses `startup.sh` or correct gunicorn command
- [ ] Oryx build completed successfully (check logs)
- [ ] Health endpoint returns 200 OK

**Still Having Issues?**
See the comprehensive troubleshooting guide: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#section-9-azure-app-service-module-import-errors)

#### Other Azure Issues

**"No module named uvicorn":**
- Ensure `WEBSITE_RUN_FROM_PACKAGE` is removed
- Verify `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- Check deployment logs for Oryx build output

**Deployment hangs during Oryx build:**
- The `chromadb` dependency has heavy native extensions that can take 10-15 minutes to compile on Azure's B1 tier
- The `SCM_BUILD_TIMEOUT` setting extends the build timeout to 30 minutes to accommodate this
- First deployment will be slower; subsequent deployments are faster due to Azure's build caching
- Consider temporarily upgrading to B2 or S1 tier for faster initial deployment
- Monitor build progress using: `az webapp log tail --name wealtharena-api --resource-group rg-wealtharena`
- The deployment is progressing normally if you see Oryx build output in the logs, even if it appears stuck

**Application not starting:**
```bash
# Check logs
az webapp log tail --name wealtharena-api --resource-group rg-wealtharena

# Check startup command
az webapp config show --name wealtharena-api --resource-group rg-wealtharena
```

**Environment variables not loading:**
```bash
# List app settings
az webapp config appsettings list \
  --name wealtharena-api \
  --resource-group rg-wealtharena

# Verify .env was loaded during deployment
```

**Vector Store Not Persisting:**
- Verify Azure Files mount is configured (see Persistent Storage section)
- Check `CHROMA_PERSIST_DIR` path matches mount path (should be `/home/data/vectorstore` for Azure)
- If using `deploy-master.ps1`, the path is automatically set correctly
- Ensure storage account has correct permissions

**CORS Errors in UI:**
- Add UI domain to `CORS_ALLOWED_ORIGINS` in app settings
- Restart app after changing CORS settings

**API Timeouts:**
- Increase worker timeout in startup command
- Consider upgrading to higher SKU (S1 or P1V2)

### Performance Issues

**Slow API responses:**
- Increase worker count
- Check vector store size (may need optimization)
- Monitor external API calls (Groq)

**Memory issues:**
- Reduce worker count
- Upgrade App Service plan
- Check for memory leaks in logs

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] `.env` file created (for local) or secrets configured (for cloud)
- [ ] Vector store initialized (run pipeline or `python scripts/kb_ingest.py`)
- [ ] Dependencies installed and tested locally
- [ ] Health check endpoint working (`/healthz`)

### Docker Deployment

- [ ] Docker image builds successfully
- [ ] Container starts and health check passes
- [ ] Volume mounts configured correctly
- [ ] Environment variables loaded
- [ ] Logs show no errors

### Azure Deployment

- [ ] Resource group and App Service plan created
- [ ] `WEBSITE_RUN_FROM_PACKAGE` removed
- [ ] `SCM_DO_BUILD_DURING_DEPLOYMENT=true` set
- [ ] Environment variables configured in Azure
- [ ] Startup command set correctly
- [ ] Deployment ZIP created (excludes dev files)
- [ ] Health check passes after deployment
- [ ] Logs show application started successfully
- [ ] Persistent storage configured (Azure Files or Blob Storage)
- [ ] Vector store path updated in app settings

### Post-Deployment

- [ ] Health check: `GET /healthz` returns 200
- [ ] API docs accessible: `GET /docs`
- [ ] Chat endpoint working: `POST /v1/chat`
- [ ] Search endpoint working: `GET /v1/search?q=test`
- [ ] Metrics endpoint working: `GET /metrics`
- [ ] Monitor logs for errors
- [ ] Set up monitoring/alerts (optional)
- [ ] Application Insights configured (optional)
- [ ] UI integration tested (if applicable)
- [ ] CORS settings configured (if using web UI)

---

## Quick Reference

### Master Script Commands

```powershell
# Data Pipeline
.\deploy-master.ps1
.\deploy-master.ps1 --skip-pdf-ingest
.\deploy-master.ps1 --full-refresh

# Docker
.\deploy-master.ps1 --deploy docker
.\deploy-master.ps1 --deploy docker -Build -Run
.\deploy-master.ps1 --deploy docker -Stop
.\deploy-master.ps1 --deploy docker -Logs

# Azure
.\deploy-master.ps1 --deploy azure -ResourceGroup rg-wealtharena -AppName wealtharena-api
```

### Docker Commands

```bash
# Build
docker build -t wealtharena-api .

# Run
docker-compose up -d

# Logs
docker-compose logs -f

# Stop
docker-compose down
```

### Azure Commands

```bash
# Deploy (use master script)
.\deploy-master.ps1 --deploy azure -ResourceGroup rg-wealtharena -AppName wealtharena-api

# Logs
az webapp log tail --name wealtharena-api --resource-group rg-wealtharena

# Restart
az webapp restart --name wealtharena-api --resource-group rg-wealtharena

# Settings
az webapp config appsettings list --name wealtharena-api --resource-group rg-wealtharena
```

---

## Support

For issues or questions:
1. Check logs: `docker logs` or `az webapp log tail`
2. Verify environment variables
3. Test health endpoint: `/healthz`
4. Review [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
