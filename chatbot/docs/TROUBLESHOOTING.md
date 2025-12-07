# WealthArena Troubleshooting Guide

This guide provides detailed solutions for common issues encountered when setting up and running WealthArena.

## Table of Contents

1. [General Troubleshooting](#section-1-general-troubleshooting)
2. [Server Not Running Issues](#section-2-server-not-running-issues)
3. [Port Conflicts](#section-3-port-conflicts)
4. [Dependency Issues](#section-4-dependency-issues)
5. [ChromaDB / Vector Store Issues](#section-5-chromadb--vector-store-issues)
6. [Testing Issues](#section-6-testing-issues)
7. [Data Pipeline Issues](#section-7-data-pipeline-issues)
8. [API and Connection Issues](#section-8-api-and-connection-issues)
9. [Azure App Service - Module Import Errors](#section-9-azure-app-service-module-import-errors)

---

## Section 1: General Troubleshooting

### Quick Diagnostics

Before diving into specific issues, run these diagnostic commands:

```powershell
# Check server health and prerequisites
python scripts/check_server.py

# Check if API is running
curl http://localhost:8000/healthz

# Check metrics
curl http://localhost:8000/metrics
```

### Common First Steps

1. **Verify Environment Setup**
   - Ensure Python 3.11+ is installed
   - Check that virtual environment (`.venv`) exists
   - Verify `.env` file is configured with `GROQ_API_KEY`

2. **Check Logs**
   - Review console output when starting the server
   - Check for error messages in terminal
   - Look for import errors or missing dependencies

---

## Section 2: Server Not Running Issues

### Symptoms

- Connection refused errors
- `curl http://localhost:8000/healthz` fails
- API endpoints return connection errors
- Server process not found

### Solutions

#### Solution 1: Start the Server

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1
```

**macOS/Linux:**
```bash
bash scripts/dev_up.sh
```

**Manual Start:**
```bash
# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Start server
python -m uvicorn app.main:app --reload
```

#### Solution 2: Verify Server Started Successfully

Wait for the message: `"Server started successfully!"` or `"Application startup complete"`

Check the console output for:
- ✅ Server running on port 8000
- ✅ No import errors
- ✅ Vector store initialized

#### Solution 3: Check Environment Variables

Ensure `.env` file exists and contains required variables:

```env
GROQ_API_KEY=gsk_your_actual_key_here
CHROMA_PERSIST_DIR=data/vectorstore
APP_HOST=0.0.0.0
APP_PORT=8000
```

#### Solution 4: Verify Dependencies

```powershell
# Check if dependencies are installed
python -c "import fastapi, uvicorn, pydantic, httpx; print('✅ All imports successful')"

# If imports fail, reinstall dependencies
pip install -r requirements.txt
```

#### Solution 5: Check for Port Conflicts

If port 8000 is already in use, see [Section 3: Port Conflicts](#section-3-port-conflicts).

---

## Section 3: Port Conflicts

### Symptoms

- `Address already in use` error
- `Port 8000 is already in use`
- Server fails to start with port binding errors

### Solutions

#### Solution 1: Find and Stop Process Using Port 8000

**Windows (PowerShell):**
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

#### Solution 2: Use a Different Port

**Option A: Change in .env file**
```env
APP_PORT=8001
```

**Option B: Specify port when starting server**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Option C: Use environment variable**
```powershell
# Windows PowerShell
$env:APP_PORT=8001
python -m uvicorn app.main:app --reload

# macOS/Linux
export APP_PORT=8001
python -m uvicorn app.main:app --reload
```

#### Solution 3: Check for Multiple Server Instances

```powershell
# Windows
Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*uvicorn*"}

# macOS/Linux
ps aux | grep -E "python|uvicorn"
```

Stop any duplicate server processes before starting a new one.

---

## Section 4: Dependency Issues

### Symptoms

- `ModuleNotFoundError` or `ImportError`
- `No module named 'fastapi'` or similar
- Package installation failures
- Version conflicts

### Solutions

#### Solution 1: Reinstall Dependencies

```powershell
# Activate virtual environment first
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

#### Solution 2: Verify Virtual Environment

```powershell
# Check if virtual environment is activated
# You should see (.venv) in your prompt

# If not activated, activate it:
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Verify Python path points to venv
python -c "import sys; print(sys.executable)"
# Should show path to .venv/bin/python or .venv\Scripts\python.exe
```

#### Solution 3: Recreate Virtual Environment

If dependencies are still missing after installation:

```powershell
# Remove old virtual environment
# Windows:
Remove-Item -Recurse -Force .venv
# macOS/Linux:
rm -rf .venv

# Create new virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Solution 4: Check Python Version

WealthArena requires Python 3.11+:

```powershell
python --version
# Should show Python 3.11.x or higher
```

If you have multiple Python versions, ensure you're using the correct one:

```powershell
# Windows
py -3.11 --version

# macOS/Linux
python3.11 --version
```

#### Solution 5: Install Specific Missing Packages

If a specific package fails to install:

```powershell
# Try installing individually
pip install fastapi
pip install uvicorn
pip install pydantic
pip install chromadb
pip install sentence-transformers
```

#### Solution 6: Handle Version Conflicts

If you encounter version conflicts:

```powershell
# Check installed versions
pip list

# Upgrade specific packages
pip install --upgrade <package-name>

# Or install specific version
pip install <package-name>==<version>
```

---

## Section 5: ChromaDB / Vector Store Issues

### Symptoms

- `No documents in vector store`
- Vector search returns empty results
- ChromaDB initialization errors
- `CHROMA_PERSIST_DIR` path errors

### Solutions

#### Solution 1: Initialize Vector Store

```powershell
# Run initial data load
python scripts/initial_data_load.py

# Or run knowledge base ingestion
python scripts/kb_ingest.py
```

#### Solution 2: Verify Vector Store Path

Check `.env` file:

```env
CHROMA_PERSIST_DIR=data/vectorstore
```

**Important**: Use absolute paths for reliability in containers or production:

```env
# Windows (example)
CHROMA_PERSIST_DIR=C:\Users\DELL\Downloads\WealthArena\data\vectorstore

# macOS/Linux (example)
CHROMA_PERSIST_DIR=/home/user/WealthArena/data/vectorstore
```

#### Solution 3: Check Directory Permissions

Ensure the vector store directory is writable:

```powershell
# Windows
# Check if directory exists and is writable
Test-Path data\vectorstore
New-Item -ItemType Directory -Force -Path data\vectorstore

# macOS/Linux
mkdir -p data/vectorstore
chmod 755 data/vectorstore
```

#### Solution 4: Rebuild Vector Store

If the vector store is corrupted or empty:

```powershell
# Remove existing vector store
# Windows:
Remove-Item -Recurse -Force data\vectorstore
# macOS/Linux:
rm -rf data/vectorstore

# Recreate directory
mkdir data/vectorstore

# Re-run ingestion
python scripts/initial_data_load.py
python scripts/kb_ingest.py
```

#### Solution 5: Verify ChromaDB Installation

```powershell
python -c "import chromadb; print(chromadb.__version__)"
```

If ChromaDB is not installed:

```powershell
pip install chromadb
```

#### Solution 6: Check Vector Store Contents

```powershell
# Check if vector store directory has files
# Windows:
Get-ChildItem data\vectorstore -Recurse
# macOS/Linux:
ls -la data/vectorstore
```

If the directory is empty, run ingestion scripts.

---

## Section 6: Testing Issues

### Symptoms

- Tests fail with connection errors
- `0% success rate` in metrics
- API endpoints not responding during tests
- Import errors in test files

### Solutions

#### Solution 1: Ensure Server is Running

**⚠️ CRITICAL**: The server must be running before running tests!

```powershell
# Start server first
powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1

# Wait for "Server started successfully!" message

# Then run tests in a NEW terminal
python scripts/print_metrics.py --url http://127.0.0.1:8000 --runs 5
```

#### Solution 2: Verify Server Health Before Testing

```powershell
# Check server is responding
python scripts/check_server.py

# Expected output: "✅ All prerequisites met! Server is ready."
```

#### Solution 3: Check Test Configuration

Ensure tests are pointing to the correct URL:

```powershell
# Default should be http://127.0.0.1:8000
python scripts/print_metrics.py --url http://127.0.0.1:8000

# If using different port
python scripts/print_metrics.py --url http://127.0.0.1:8001
```

#### Solution 4: Run Smoke Tests

```powershell
# Comprehensive API endpoint tests (waits for server if needed)
python scripts/sanity_check.py --wait

# Or run tests immediately (server must be running)
python scripts/sanity_check.py
```

#### Solution 5: Check Test Dependencies

```powershell
# Install test dependencies
pip install pytest pytest-cov httpx

# Run pytest
pytest

# Run with coverage
pytest --cov=app --cov-report html
```

#### Solution 6: Fix Import Errors in Tests

If tests have import errors:

```powershell
# Ensure you're in the project root
cd C:\Users\DELL\Downloads\WealthArena

# Activate virtual environment
.venv\Scripts\activate  # Windows
# or
source .venv/bin/activate  # macOS/Linux

# Run tests with Python path
python -m pytest
```

#### Solution 7: Regenerate Metrics

If metrics show 0% success rate, the server was likely not running:

```powershell
# 1. Start server
powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1

# 2. Wait for server to start

# 3. In new terminal, regenerate metrics
python scripts/print_metrics.py --url http://127.0.0.1:8000 --runs 5
```

---

## Section 7: Data Pipeline Issues

### Symptoms

- No documents in vector store
- Scraper not running
- RSS feed errors
- PDF ingestion stuck or slow

### Solutions

#### Solution 1: No Documents in Vector Store

```powershell
# Run initial data load
python scripts/initial_data_load.py

# Verify data pipeline
python scripts/verify_data_pipeline.py
```

#### Solution 2: Scraper Not Running

```powershell
# Check background job status
curl http://localhost:8000/v1/background/status

# Check logs for scraper errors
# Review console output when server starts
```

#### Solution 3: PDF Ingestion Issues

**Problem**: PDF ingestion gets stuck or takes hours

**Solutions**:

1. **Use smaller batch sizes**:
   ```bash
   python scripts/pdf_ingest.py --batch-size 20 --duplicate-check-batch-size 200
   ```

2. **Enable parallel processing**:
   ```bash
   python scripts/pdf_ingest.py --parallel --max-workers 2
   ```

3. **Resume interrupted uploads**:
   ```bash
   python scripts/pdf_ingest.py --resume
   python scripts/pdf_ingest.py --resume --no-resume-partial
   ```

4. **Skip problematic PDFs**:
   ```bash
   python scripts/pdf_ingest.py --skip-on-error
   ```

**Performance Tips**:
- Typical processing time: 2-5 minutes per PDF
- First batch is slowest (model download + initialization)
- Use `--parallel` for 20+ PDFs

#### Solution 4: RSS Feed Errors

- Check network/firewall settings
- Verify RSS feed URLs are accessible
- Check logs for specific feed errors

#### Solution 5: Reddit Scraping Not Working

Reddit credentials are optional. If not configured, the pipeline will skip Reddit data with a warning.

To enable Reddit scraping:
1. Create Reddit app at https://www.reddit.com/prefs/apps
2. Add credentials to `.env`:
   ```env
   REDDIT_CLIENT_ID=your_client_id
   REDDIT_CLIENT_SECRET=your_client_secret
   REDDIT_USERNAME=your_username
   REDDIT_PASSWORD=your_password
   REDDIT_USER_AGENT=python:com.wealtharena.reddit-scraper:v1.0.0
   ```

#### Solution 6: Investopedia Scraping Issues

Ensure `INVESTOPEDIA_CATEGORIES` is configured in `.env`:

```env
INVESTOPEDIA_CATEGORIES=technical-analysis,fundamental-analysis,risk-management,trading-strategies
```

---

## Section 8: API and Connection Issues

### Symptoms

- API endpoints return errors
- Connection timeouts
- CORS errors
- Authentication failures

### Solutions

#### Solution 1: Verify API Endpoints

```powershell
# Health check
curl http://localhost:8000/healthz

# API docs
# Open in browser: http://localhost:8000/docs

# Metrics
curl http://localhost:8000/metrics
```

#### Solution 2: Check GROQ API Key

```powershell
# Verify API key is set
# Windows PowerShell:
$env:GROQ_API_KEY
# macOS/Linux:
echo $GROQ_API_KEY

# Or check .env file
# Should contain: GROQ_API_KEY=gsk_...
```

Get your API key from: https://console.groq.com/

---

## Section 10: GroQ API Troubleshooting

### Symptoms

- Chatbot not responding or returning errors
- "AI is not picking feeds from Groq API" error
- Connection refused (`ECONNREFUSED`) errors
- Timeout (`ETIMEDOUT`) errors
- 500 errors from chatbot service
- "Model decommissioned" errors

### Quick Diagnosis

When you send a message to the chatbot, check the backend logs. The improved error logging will show:

1. **Connection Refused (`ECONNREFUSED`)**: Chatbot service is not running
2. **Timeout (`ETIMEDOUT`)**: Chatbot service is running but not responding
3. **500 Error**: Chatbot service is running but GroQ API key is missing or invalid
4. **Model Decommissioned**: The model name in `.env` is no longer supported by GroQ

### Solution 1: Check if Chatbot Service is Running

The chatbot service is a Python FastAPI application that needs to be running separately.

**Check if it's running:**
```bash
# Test if the service is responding
curl http://localhost:8000/healthz
# or visit in browser: http://localhost:8000/healthz
```

**If not running, start it:**
```bash
cd chatbot
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or if using a virtual environment:
```bash
cd chatbot
source venv/bin/activate  # On Windows: venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Solution 2: Configure GroQ API Key

The chatbot service needs a GroQ API key to connect to GroQ API.

**1. Get a GroQ API Key (Free)**
- Visit: https://console.groq.com/keys
- Sign up for a free account
- Create an API key
- Copy the key

**2. Configure the Chatbot Service**

Create or update `chatbot/.env` file:

```bash
cd chatbot
cp env.example .env
```

Edit `chatbot/.env` and set:
```env
GROQ_API_KEY=your_actual_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
LLM_PROVIDER=groq
APP_PORT=8000
```

**3. Verify Configuration**

Test if the GroQ API key works:
```bash
cd chatbot
python -c "from app.llm.client import LLMClient; import asyncio; async def test(): client = LLMClient(); print('Groq API Key:', 'SET' if client.groq_api_key else 'NOT SET'); result = await client.chat([{'role': 'user', 'content': 'Hello'}]); print('Response:', result); asyncio.run(test())"
```

Or create a simple test file `test_groq.py`:
```python
import asyncio
from app.llm.client import LLMClient

async def test():
    client = LLMClient()
    print('Groq API Key:', 'SET' if client.groq_api_key else 'NOT SET')
    if client.groq_api_key:
        result = await client.chat([{'role': 'user', 'content': 'Say "Hello from Groq" if you are Groq'}])
        print('Response:', result)
    else:
        print('ERROR: GROQ_API_KEY not set in environment')

asyncio.run(test())
```

Run it:
```bash
python test_groq.py
```

### Solution 3: Fix Decommissioned Model Error

**Issue**: The model name `llama3-8b-8192` has been **decommissioned** by Groq.

**Error Message:**
```
"The model `llama3-8b-8192` has been decommissioned and is no longer supported."
```

**Solution:**

Update the `GROQ_MODEL` in your `chatbot/.env` file to use a supported model.

**Step 1: Update chatbot/.env**

Edit `chatbot/.env` and change:
```env
GROQ_MODEL=llama3-8b-8192
```

To:
```env
GROQ_MODEL=llama-3.1-8b-instant
```

**Step 2: Restart Chatbot Service**

After updating the `.env` file, you **must restart the chatbot service** for the change to take effect.

1. Stop the current chatbot service (Ctrl+C if running in terminal)
2. Start it again:
   ```bash
   cd chatbot
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

**Available Groq Models:**
- `llama-3.1-8b-instant` - Fast, efficient model (recommended)
- `llama-3.1-70b-versatile` - More powerful, slower model
- `mixtral-8x7b-32768` - Large context window model

**Verify Fix:**

After restarting, test the chatbot:
```powershell
$body = @{message = "Say hello from Groq"} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/v1/chat" -Method Post -Body $body -ContentType "application/json"
```

You should now get responses from GroQ API instead of fallback responses!

### Solution 4: Configure Backend Chatbot URL

Make sure the backend knows where to find the chatbot service.

Check `backend/.env` or `backend/.env.local`:
```env
CHATBOT_API_URL=http://localhost:8000
```

### Solution 5: Test the Full Flow

**1. Start Chatbot Service**
```bash
cd chatbot
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**2. Test Chatbot Service Directly**
```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is forex trading?"}'
```

You should get a JSON response with `reply` field containing Groq's answer.

**3. Test via Backend Proxy**
```bash
curl -X POST http://localhost:3000/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is forex trading?"}'
```

### Common GroQ Issues and Solutions

#### Issue 1: "Chatbot service is not running"
**Solution**: Start the chatbot service (see Solution 1)

#### Issue 2: "GROQ_API_KEY not configured"
**Solution**: 
1. Check `chatbot/.env` file exists and has `GROQ_API_KEY=your_key`
2. Restart the chatbot service after updating `.env`

#### Issue 3: "Connection timeout"
**Solution**:
- Check if chatbot service is on port 8000: `netstat -an | findstr 8000` (Windows) or `lsof -i :8000` (Mac/Linux)
- Verify `CHATBOT_API_URL` in backend `.env` matches the chatbot service URL

#### Issue 4: "Groq API error: 401 Unauthorized"
**Solution**: 
- Your Groq API key is invalid or expired
- Get a new key from https://console.groq.com/keys
- Update `chatbot/.env` with the new key
- Restart chatbot service

#### Issue 5: Backend shows "ECONNREFUSED"
**Solution**:
- Chatbot service is not running
- Check if it's running on the correct port (default: 8000)
- Verify firewall is not blocking the connection

#### Issue 6: "Model decommissioned" error
**Solution**: See Solution 3 above - update `GROQ_MODEL` to a supported model like `llama-3.1-8b-instant`

### Verification Checklist

- [ ] Chatbot service is running (`curl http://localhost:8000/healthz` returns OK)
- [ ] `chatbot/.env` file exists with `GROQ_API_KEY` set
- [ ] Groq API key is valid (tested with test script)
- [ ] `GROQ_MODEL` is set to a supported model (e.g., `llama-3.1-8b-instant`)
- [ ] `backend/.env` has `CHATBOT_API_URL=http://localhost:8000`
- [ ] Backend can reach chatbot service (check logs for connection errors)
- [ ] Chatbot service can reach Groq API (check chatbot service logs)

### Expected Log Output

When everything is working, you should see in backend logs:
```
[CHATBOT] Forwarding chat request to chatbot service: http://localhost:8000/v1/chat
[CHATBOT] API response received successfully
```

When there's an issue, you'll see detailed error information:
```
[CHATBOT ERROR] Error calling chatbot API:
   URL: http://localhost:8000/v1/chat
   Error Code: ECONNREFUSED
   HTTP Status: 500
   Error Message: connect ECONNREFUSED 127.0.0.1:8000
   Tip: Make sure the chatbot service is running. Run: cd chatbot && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Solution 3: Fix CORS Errors

If using a web UI, add CORS origins to `.env`:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

#### Solution 4: Connection Timeouts

- Check network connectivity
- Verify firewall settings
- Increase timeout values if needed
- Check if external APIs (Groq) are accessible

#### Solution 5: Authentication Issues

- Verify API keys are correct
- Check key format (Groq keys start with `gsk_`)
- Ensure keys are not expired
- Check rate limits on API provider

---

## Section 9: Azure App Service Module Import Errors

### Symptoms

- **HTTP 503 errors** when accessing your deployed Azure app
- Azure portal displays: **"Application container failed to start"**
- Error message: **"interpreter is unable to locate a module or package"**
- Deployment logs show: `ModuleNotFoundError`, `ImportError`, or `No module named 'uvicorn'`
- Application worked locally but fails after Azure deployment

### Common Root Causes

1. **Missing PYTHONPATH**: Relative imports (e.g., `from .api.chat import router`) require `PYTHONPATH=/home/site/wwwroot`
2. **WEBSITE_RUN_FROM_PACKAGE blocking Oryx build**: This setting prevents Azure from installing dependencies
3. **Oryx build not enabled**: Without `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, dependencies won't install
4. **Incorrect startup command**: Must properly invoke the application with correct module path
5. **Build timeout or failure**: Dependencies may have failed to install due to timeout or errors
6. **Missing GROQ_API_KEY**: Application requires this to start successfully

### Quick Fix (Recommended)

Use the automated fix script to resolve all configuration issues:

```powershell
# Navigate to project root
cd C:\Users\DELL\Downloads\WealthArena

# Run the fix script
.\scripts\azure_fix_deployment.ps1 -AppName "wealtharena-api" -ResourceGroup "rg-wealtharena"
```

The script will:
- ✅ Verify Azure CLI and login status
- ✅ Check if the web app exists
- ✅ Display current configuration
- ✅ Fix all critical settings automatically
- ✅ Remove problematic settings
- ✅ Set correct startup command
- ✅ Restart the app
- ✅ Wait for health check to pass

### Diagnostic Check

Before applying fixes, diagnose the current configuration:

```powershell
.\scripts\azure_verify_config.ps1 -AppName "wealtharena-api" -ResourceGroup "rg-wealtharena"
```

This will check:
- Azure CLI installation and login status
- Web app state and configuration
- All critical app settings
- Startup command configuration
- Python runtime version
- Health endpoint availability
- Recent deployment logs

### Manual Fix (Step-by-Step)

If you prefer to fix issues manually:

#### Step 1: Check Current App Settings

```bash
az webapp config appsettings list \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --query "[?name=='SCM_DO_BUILD_DURING_DEPLOYMENT' || name=='WEBSITE_RUN_FROM_PACKAGE' || name=='PYTHONPATH' || name=='GROQ_API_KEY']"
```

#### Step 2: Enable Oryx Build

```bash
az webapp config appsettings set \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

#### Step 3: Remove WEBSITE_RUN_FROM_PACKAGE

```bash
# Check if it exists
az webapp config appsettings list \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --query "[?name=='WEBSITE_RUN_FROM_PACKAGE']"

# Remove it (critical!)
az webapp config appsettings delete \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --setting-names WEBSITE_RUN_FROM_PACKAGE
```

#### Step 4: Set PYTHONPATH

```bash
az webapp config appsettings set \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --settings PYTHONPATH=/home/site/wwwroot
```

#### Step 5: Set Required Environment Variables

```bash
# Set GROQ_API_KEY (REQUIRED)
az webapp config appsettings set \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --settings GROQ_API_KEY="gsk_your_actual_key_here"

# Set CHROMA_PERSIST_DIR
az webapp config appsettings set \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --settings CHROMA_PERSIST_DIR="/home/data/vectorstore"
```

**Important**: Replace `gsk_your_actual_key_here` with your actual Groq API key from https://console.groq.com/

#### Step 6: Set Startup Command

```bash
# Check current startup command
az webapp config show \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --query "appCommandLine"

# Set correct startup command
az webapp config set \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --startup-file "bash startup.sh"
```

#### Step 7: Restart and Monitor

```bash
# Restart the app
az webapp restart --name wealtharena-api --resource-group rg-wealtharena

# Monitor logs (wait for startup)
az webapp log tail --name wealtharena-api --resource-group rg-wealtharena
```

Look for these indicators in logs:
- ✅ **Oryx build output**: Shows dependency installation
- ✅ **"Starting gunicorn"**: Application startup
- ✅ **No import errors**: All modules load successfully
- ❌ **"ModuleNotFoundError"**: Still has configuration issues

#### Step 8: Test Health Endpoint

```bash
# Wait 1-2 minutes after restart, then test
curl https://wealtharena-api.azurewebsites.net/healthz

# Expected response:
# {"status":"ok"}
```

### Verification Checklist

After applying fixes, verify all settings are correct:

- [ ] `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`
- [ ] `WEBSITE_RUN_FROM_PACKAGE` is **NOT** set (removed)
- [ ] `PYTHONPATH` = `/home/site/wwwroot`
- [ ] `GROQ_API_KEY` is set and starts with `gsk_`
- [ ] `CHROMA_PERSIST_DIR` = `/home/data/vectorstore`
- [ ] Startup command is `bash startup.sh` or correct gunicorn command
- [ ] Oryx build completed successfully (visible in logs)
- [ ] Health endpoint returns HTTP 200 with `{"status":"ok"}`
- [ ] API docs accessible at `/docs`
- [ ] No import errors in application logs

### Common Issues After Fix

**Issue: Health check still fails after 5 minutes**

Possible causes:
1. **Oryx build still in progress**: First deployment can take 10-15 minutes
2. **GROQ_API_KEY invalid**: Verify the key is correct and active
3. **Build failed**: Check logs for compilation errors

```bash
# Check if build completed
az webapp log tail --name wealtharena-api --resource-group rg-wealtharena | grep -i "oryx"

# Look for: "Running oryx build..." and "Done."
```

**Issue: App crashes immediately after startup**

Check logs for:
```bash
# View detailed logs
az webapp log download \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --log-file app-logs.zip

# Extract and review for errors
```

Common causes:
- Missing or invalid GROQ_API_KEY
- Import errors (PYTHONPATH still incorrect)
- Port binding issues
- Dependency installation failure

**Issue: Logs show "No module named 'app'"**

This indicates PYTHONPATH is still not set correctly:

```bash
# Verify PYTHONPATH setting
az webapp config appsettings list \
  --name wealtharena-api \
  --resource-group rg-wealtharena \
  --query "[?name=='PYTHONPATH']"

# Should return: /home/site/wwwroot
```

### Advanced Troubleshooting

#### Access Kudu Console

1. Navigate to: `https://wealtharena-api.scm.azurewebsites.net`
2. Go to **Debug Console** → **CMD** or **PowerShell**
3. Navigate to `/home/site/wwwroot`
4. Check files are deployed correctly
5. Try importing modules manually:
   ```bash
   cd /home/site/wwwroot
   python3 -c "import app.main; print('Success')"
   ```

#### Check Build Logs in Kudu

1. Go to **Kudu Console**: `https://wealtharena-api.scm.azurewebsites.net`
2. Navigate to **Tools** → **Deployment logs**
3. Look for Oryx build output
4. Verify all dependencies installed successfully

#### Export Configuration for Support

```powershell
.\scripts\azure_verify_config.ps1 `
  -AppName "wealtharena-api" `
  -ResourceGroup "rg-wealtharena" `
  -ExportConfig
```

This creates a JSON file with complete configuration for debugging.

### Prevention

To avoid these issues in future deployments:

1. **Always use the master deployment script**:
   ```powershell
   .\deploy-master.ps1 --deploy azure `
     -ResourceGroup "rg-wealtharena" `
     -AppName "wealtharena-api"
   ```

2. **Never manually set WEBSITE_RUN_FROM_PACKAGE**: This setting is incompatible with Oryx builds

3. **Verify configuration before deployment**:
   ```powershell
   .\scripts\azure_verify_config.ps1 -AppName "wealtharena-api" -ResourceGroup "rg-wealtharena"
   ```

4. **Monitor first deployment carefully**: Initial builds take longer due to dependency compilation

5. **Keep deployment logs**: Save logs for reference if issues occur

### Related Documentation

- [DEPLOYMENT.md](../DEPLOYMENT.md#module-import-errors-application-container-failed-to-start) - Detailed deployment guide
- [startup.sh](../startup.sh) - Enhanced startup script with error handling
- [deploy-master.ps1](../deploy-master.ps1) - Master deployment script

---

## Additional Resources

- **API Documentation**: Visit `http://localhost:8000/docs` when server is running
- **OpenAPI Specification**: Run `python scripts/export_openapi.py`
- **Deployment Guide**: See [DEPLOYMENT.md](../DEPLOYMENT.md)
- **RAG Pipeline Documentation**: See [docs/RAG_PIPELINE.md](RAG_PIPELINE.md)

---

## Still Having Issues?

If you've tried all the solutions above and still encounter problems:

1. **Check Logs**: Review console output and error messages carefully
2. **Verify Environment**: Ensure all environment variables are set correctly
3. **Check Versions**: Verify Python version (3.11+) and package versions
4. **Review Documentation**: Check README.md and other docs for updates
5. **Clean Install**: Try recreating virtual environment and reinstalling dependencies

For deployment-specific issues, see [DEPLOYMENT.md](../DEPLOYMENT.md).

