# Setting Up Environment Variables

## Quick Setup (3 Steps)

### Step 1: Get Your Groq API Key (REQUIRED)

**IMPORTANT:** The application requires a valid Groq API key to function. All LLM-powered features (chat, explain, streaming) will be unavailable without it.

1. Go to https://console.groq.com/
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create API Key"
5. Copy the key (starts with `gsk_`)

**Note:** The key must start with `gsk_` to be considered valid. If your key doesn't start with this prefix, it's not a valid Groq API key.

### Step 2: Create .env File

**Windows (PowerShell):**
```powershell
# Copy the example file
Copy-Item .env.example .env

# Edit .env file and add your API key
notepad .env
```

**Linux/Mac:**
```bash
# Copy the example file
cp .env.example .env

# Edit .env file and add your API key
nano .env
# or
vim .env
```

### Step 3: Add Your API Key

Open `.env` and replace `your_groq_api_key_here` with your actual key:

```env
GROQ_API_KEY=gsk_your_actual_key_here  # REQUIRED: Application will not function without this key
```

**Or create the file manually:**
1. Create a file named `.env` in the project root (same folder as `Dockerfile`)
2. Add this content (replace `your_actual_key_here` with your real key):
```env
GROQ_API_KEY=gsk_your_actual_key_here  # REQUIRED: Replace with your actual Groq API key from https://console.groq.com/
GROQ_MODEL=llama3-8b-8192
LLM_PROVIDER=groq
CHROMA_PERSIST_DIR=data/vectorstore  # Use absolute path for reliability
APP_HOST=0.0.0.0
APP_PORT=8000
```

### Verify Setup

**Windows:**
```powershell
python scripts/check_server.py
```

**Linux/Mac:**
```bash
python scripts/check_server.py
```

You should see: `✅ .env file exists and has GROQ_API_KEY set`

---

## Detailed Setup

For more context and troubleshooting, see the sections below.

---

## For Docker Deployment

### Option 1: Use .env file (Recommended)

The deployment script will automatically use your `.env` file when running Docker locally:

```powershell
# Make sure .env exists with your API key
# Then run deployment
powershell -ExecutionPolicy Bypass -File deploy-master.ps1
```

### Option 2: Set Environment Variables in Docker

If you don't want to use a `.env` file, you can set environment variables directly:

**Windows PowerShell:**
```powershell
$env:GROQ_API_KEY="your_key_here"
docker run -d --name wealtharena-api -p 8000:8000 -e GROQ_API_KEY=$env:GROQ_API_KEY wealtharena-api:latest
```

**Linux/Mac:**
```bash
export GROQ_API_KEY="your_key_here"
docker run -d --name wealtharena-api -p 8000:8000 -e GROQ_API_KEY=$GROQ_API_KEY wealtharena-api:latest
```

### Option 3: For Azure Deployment

For Azure Container Apps, you need to set environment variables in Azure:

```powershell
# After deployment, set the environment variable
az containerapp update -g rg-wealtharena-kanika -n wealtharena-api `
  --set-env-vars GROQ_API_KEY=your_key_here
```

Or set it during deployment by modifying `deploy-master.ps1` to include:
```powershell
--env-vars APP_HOST=0.0.0.0 APP_PORT=8000 GROQ_API_KEY=your_key_here
```

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to git (it's in `.gitignore`)
- Never share your API key publicly
- Rotate your API key if it's exposed
- Use different keys for development and production
- The `.env` file should be in the project root (same folder as `Dockerfile`)
- Make sure file encoding is UTF-8
- Verify no extra spaces: `GROQ_API_KEY=key` (not `GROQ_API_KEY = key`)

## Troubleshooting

### "GROQ_API_KEY not set" or "LLM service unavailable" Error

**Problem**: The app can't find your API key or the key is invalid.

**Solutions**:
1. Check `.env` file exists: `Test-Path .env` (PowerShell) or `ls .env` (Linux/Mac)
2. Check key is set: Open `.env` and verify `GROQ_API_KEY=...` line exists
3. Verify key format: The key must start with `gsk_` (e.g., `GROQ_API_KEY=gsk_...`)
4. Check for extra spaces: Ensure no spaces around the `=` sign (correct: `GROQ_API_KEY=key`, incorrect: `GROQ_API_KEY = key`)
5. Restart the server after creating/editing `.env`
6. For Docker: Make sure `.env` file is in the same directory as `Dockerfile`
7. Get a new key if needed: Visit https://console.groq.com/ to generate a new API key

**Note:** The application will not function without a valid Groq API key. All chat, explain, and streaming features require the API key to be properly configured.

### Docker Container Can't Read .env

**Problem**: Docker container doesn't see environment variables.

**Solutions**:
1. Make sure `.env` file exists in project root (same directory as `Dockerfile`)
2. Check deployment script uses `--env-file .env` flag
3. Or set environment variables directly: `-e GROQ_API_KEY=...`
4. Check the file encoding is UTF-8
5. Verify no extra spaces around the `=` sign

### Azure Deployment Missing API Key

**Problem**: Azure container doesn't have the API key.

**Solutions**:
1. Set it via Azure CLI (see Option 3 above)
2. Or use Azure Portal → Container App → Configuration → Environment Variables
3. Or use Azure Key Vault for secure storage

## Testing

After setting up, test the API:

```bash
# Test chat endpoint (should use LLM now)
curl -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is RSI?", "user_id": "test"}'

# Check logs - should see:
# "LLM Client initialized with provider: groq, model: llama3-8b-8192"
# Instead of: "GROQ_API_KEY not set"
```

