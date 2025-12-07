# Local Development Setup Guide - MVP Demo

## ✅ Quick Fix Guide

This guide will help you run all services locally for your MVP demo.

---

## 🔧 **Step 1: Fix Backend (Build Missing)**

The backend needs to be compiled from TypeScript to JavaScript first.

### Fix:
```powershell
cd backend

# Install dependencies (if not already done)
npm install

# Build TypeScript to JavaScript
npm run build

# Now start the backend
npm start
```

**Expected output:**
```
> wealtharena_backend@1.0.0 start
> node dist/index.js

Server running on port 8080
```

---

## 🐍 **Step 2: Fix Python Path Issues**

The "python.exe failed to run" error means Python isn't in your PATH or you need to use `py` instead.

### Check Python Installation:
```powershell
# Try these commands to find Python:
python --version
py --version
python3 --version
where python
where py
```

### Fix Option A: Use `py` launcher (Windows):
```powershell
# Chatbot
cd chatbot
py -m uvicorn main:app --port 8000

# RL Service
cd rl-service
py -m uvicorn main:app --port 8001
```

### Fix Option B: Find Python and use full path:
```powershell
# Find Python installation
where python
# or
where py

# Use the full path, for example:
C:\Users\PC\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn main:app --port 8000
```

### Fix Option C: Install Python if missing:
1. Download Python: https://www.python.org/downloads/
2. **Important:** Check "Add Python to PATH" during installation
3. Restart PowerShell after installation
4. Verify: `python --version`

---

## 🚀 **Complete Setup Instructions**

### **Terminal 1: Backend (Node.js)**

```powershell
cd backend

# First time setup
npm install

# Build TypeScript (REQUIRED before starting)
npm run build

# Start backend
npm start
```

**Backend will run on:** `http://localhost:8080`

---

### **Terminal 2: Chatbot (Python)**

```powershell
cd chatbot

# First time setup - Create virtual environment
py -m venv .venv
# OR if py doesn't work:
python -m venv .venv
# OR if python3 works:
python3 -m venv .venv

# Activate virtual environment (Windows)
.venv\Scripts\activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Create .env file if it doesn't exist
# Copy .env.example to .env and add your GROQ_API_KEY

# Start chatbot
python -m uvicorn main:app --port 8000
# OR if python doesn't work:
py -m uvicorn main:app --port 8000
```

**Chatbot will run on:** `http://localhost:8000`

---

### **Terminal 3: RL Service (Python)**

```powershell
cd rl-service

# First time setup - Create virtual environment
py -m venv .venv
# OR if py doesn't work:
python -m venv .venv

# Activate virtual environment (Windows)
.venv\Scripts\activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start RL service
python -m uvicorn main:app --port 8001
# OR if python doesn't work:
py -m uvicorn main:app --port 8001
```

**RL Service will run on:** `http://localhost:8001`

---

## 🌐 **Step 3: Configure Frontend**

### Update Frontend .env file:

```powershell
cd frontend
```

Edit or create `.env` file with:

```env
# Backend API URL (running locally)
VITE_BACKEND_URL=http://localhost:8080

# Chatbot API URL (running locally)
VITE_CHATBOT_URL=http://localhost:8000

# RL Service URL (running locally)
VITE_RL_SERVICE_URL=http://localhost:8001
```

### Start Frontend:

```powershell
cd frontend

# Install dependencies (first time only)
npm install

# Start frontend dev server
npm run dev
```

**Frontend will run on:** `http://localhost:5173` (or similar)

---

## ✅ **Verification Checklist**

### 1. Backend Running:
```powershell
# Test backend health
curl http://localhost:8080/health
# OR in browser:
# http://localhost:8080/health
```

### 2. Chatbot Running:
```powershell
# Test chatbot health
curl http://localhost:8000/health
# OR in browser:
# http://localhost:8000/health
```

### 3. RL Service Running:
```powershell
# Test RL service health
curl http://localhost:8001/health
# OR in browser:
# http://localhost:8001/health
```

### 4. Frontend Running:
- Open browser: `http://localhost:5173`
- Should see your WealthArena frontend

---

## 🔍 **Troubleshooting**

### Issue: "Cannot find module 'dist/index.js'"
**Solution:** Run `npm run build` in the backend directory first

### Issue: "python.exe failed to run"
**Solutions:**
1. Try `py` instead of `python`
2. Check if Python is installed: `py --version`
3. Install Python and check "Add to PATH" during installation
4. Use full path: `C:\Python311\python.exe -m uvicorn main:app --port 8000`

### Issue: "Module not found" errors
**Solution:** 
- Make sure you activated the virtual environment: `.venv\Scripts\activate`
- Install dependencies: `pip install -r requirements.txt`

### Issue: "Port already in use"
**Solution:**
- Check what's using the port: `netstat -ano | findstr :8080`
- Kill the process or use a different port

### Issue: Frontend can't connect to backend
**Solution:**
- Check `.env` file in frontend has correct URLs
- Make sure backend is running on port 8080
- Check browser console for CORS errors (backend should handle CORS)

---

## 📋 **Quick Reference Commands**

### Backend:
```powershell
cd backend
npm install          # First time only
npm run build        # REQUIRED before starting
npm start            # Start backend
```

### Chatbot:
```powershell
cd chatbot
py -m venv .venv                    # First time only
.venv\Scripts\activate              # Activate venv
pip install -r requirements.txt     # First time only
py -m uvicorn main:app --port 8000  # Start chatbot
```

### RL Service:
```powershell
cd rl-service
py -m venv .venv                    # First time only
.venv\Scripts\activate              # Activate venv
pip install -r requirements.txt    # First time only
py -m uvicorn main:app --port 8001  # Start RL service
```

### Frontend:
```powershell
cd frontend
npm install          # First time only
npm run dev          # Start frontend
```

---

## 🎯 **For MVP Demo**

Once all services are running:

1. **Backend:** `http://localhost:8080`
2. **Chatbot:** `http://localhost:8000`
3. **RL Service:** `http://localhost:8001`
4. **Frontend:** `http://localhost:5173`

**To make it accessible for demo:**
- Use ngrok (free): `ngrok http 5173` (for frontend)
- Or use ngrok for backend: `ngrok http 8080`
- Share the ngrok URL for your demo

---

## 🆘 **Still Having Issues?**

1. **Python not found:** Install Python from python.org and check "Add to PATH"
2. **Module errors:** Make sure virtual environment is activated
3. **Port conflicts:** Check if ports are already in use
4. **Build errors:** Make sure all dependencies are installed

Share the specific error message and I can help troubleshoot!

