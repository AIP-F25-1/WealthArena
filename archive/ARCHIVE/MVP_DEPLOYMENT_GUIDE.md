# MVP Deployment Guide - Free Tier Solutions for Students

## 🎓 Your Situation
- **No App Service quota** (free tier limitation)
- **Docker Desktop not working** (required for Container Apps)
- **MVP for school** (needs to be free and working)
- **No budget** for paid Azure services

---

## ✅ **RECOMMENDED: Option 1 - Fix Docker Desktop (FREE)**

**Why:** Container Apps is completely free tier (no quota needed) and works perfectly for MVPs.

### Quick Fix Steps:

1. **Check if WSL2 is installed and enabled:**
   ```powershell
   wsl --status
   wsl --list --verbose
   ```

2. **If WSL2 is not installed:**
   ```powershell
   # Enable WSL2 feature
   wsl --install
   # Restart your computer after this
   ```

3. **If WSL2 is installed but Docker Desktop still fails:**
   ```powershell
   # Check Docker Desktop status
   Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
   
   # Try resetting Docker context
   docker context use default
   
   # Check Docker daemon
   docker ps
   ```

4. **Common Docker Desktop Issues:**
   - **Windows Home Edition:** May need WSL2 backend instead of Hyper-V
   - **Port conflict:** Port 2376 might be in use
   - **WSL2 not default:** Set WSL2 as default backend in Docker Desktop settings
   - **Antivirus:** May block Docker Desktop - add exception

5. **Alternative: Use Docker without Docker Desktop:**
   ```powershell
   # Install Docker via WSL2 directly
   wsl --install -d Ubuntu
   # Then install Docker inside Ubuntu
   ```

### If Docker Works:
- Proceed with Container Apps deployment (FREE, no quota)
- Your automation script will work perfectly
- All services will be deployed to free tier

---

## 🔄 **Option 2 - Run Locally for MVP Demo (FREE)**

**Best for:** MVP presentation/demo, no cloud deployment needed

### Steps:

1. **Skip Phase 7 (Cloud Deployment)**
   - Choose option 2 (Skip Phase 7) when prompted
   - Continue with local testing

2. **Run all services locally:**
   ```powershell
   # Terminal 1: Backend
   cd backend
   npm install
   npm start

   # Terminal 2: Chatbot
   cd chatbot
   pip install -r requirements.txt
   python -m uvicorn main:app --port 8000

   # Terminal 3: RL Service
   cd rl-service
   pip install -r requirements.txt
   python -m uvicorn main:app --port 8001
   ```

3. **For demo:**
   - Use ngrok or similar to expose localhost for presentation
   - Or use Azure Static Web Apps (free) for frontend only
   - Keep backend services local

---

## 🆓 **Option 3 - Azure Static Web Apps + Azure Functions (FREE)**

**Best for:** Frontend + serverless backend (no quota, no Docker)

### Setup:

1. **Frontend: Azure Static Web Apps (FREE)**
   ```powershell
   # Deploy frontend to Static Web Apps
   cd frontend
   npm run build
   # Use Azure Static Web Apps GitHub Actions or Azure CLI
   ```

2. **Backend: Azure Functions (FREE - 1M executions/month)**
   - Requires code restructuring to Function Apps
   - Not recommended unless you have time to refactor

---

## 📋 **Option 4 - Request Free Quota (Takes Time)**

**Best for:** If you have a few days to wait

1. **Request App Service quota increase:**
   - Go to Azure Portal → Subscriptions → Your Subscription → Usage + quotas
   - Search for "App Service Plans"
   - Click "Request increase"
   - Fill out form (explain it's for school project)
   - Usually approved within 1-3 business days

2. **Use Student Azure Credits:**
   - If you have Azure for Students ($100 free credit)
   - This includes quota for App Service Plans
   - Check if you're eligible: https://azure.microsoft.com/free/students/

---

## 🎯 **IMMEDIATE ACTION PLAN**

### Step 1: Try to Fix Docker Desktop (15 minutes)
1. Check WSL2 status: `wsl --status`
2. If not installed: `wsl --install` and restart
3. Open Docker Desktop and wait 30-60 seconds
4. Test: `docker ps`
5. If it works → **Deploy to Container Apps (FREE)**

### Step 2: If Docker Still Fails (30 minutes)
1. **For MVP Demo:**
   - Skip Phase 7
   - Run services locally
   - Use ngrok for demo: `ngrok http 8080`

2. **For Real Deployment:**
   - Request quota increase (takes 1-3 days)
   - Or use Azure for Students credits

### Step 3: Quick Demo Setup (Local)
```powershell
# Install ngrok (free)
# Download from: https://ngrok.com/download

# Start backend
cd backend
npm start
# In another terminal:
ngrok http 8080
# Use the ngrok URL for your frontend

# Start chatbot
cd chatbot
python -m uvicorn main:app --port 8000
# In another terminal:
ngrok http 8000

# Start RL service
cd rl-service
python -m uvicorn main:app --port 8001
# In another terminal:
ngrok http 8001
```

---

## 💡 **Recommendation for School MVP**

**For immediate demo (today/tomorrow):**
1. **Run locally** + use ngrok for public URLs
2. **Skip cloud deployment** (Phase 7)
3. **Document local setup** in your README

**For submission (if you have a few days):**
1. **Fix Docker Desktop** (best option)
2. **Deploy to Container Apps** (completely free)
3. **All services running in Azure** (impressive for demo)

---

## ❓ **Quick Questions**

1. **Do you have Azure for Students credits?**
   - If yes → You might have quota available
   - Check: Azure Portal → Subscriptions → Usage + quotas

2. **What's your deadline?**
   - If immediate → Use local + ngrok
   - If a few days → Fix Docker or request quota

3. **Is WSL2 installed?**
   - Run: `wsl --status`
   - If not installed, Docker Desktop won't work on Windows

---

## 🆘 **Need More Help?**

If Docker Desktop is still not working after trying the steps above, share:
1. Output of `wsl --status`
2. Output of `docker --version`
3. Output of `docker ps` (the error message)
4. Your Windows version (`winver`)

I can help troubleshoot Docker Desktop specifically!

