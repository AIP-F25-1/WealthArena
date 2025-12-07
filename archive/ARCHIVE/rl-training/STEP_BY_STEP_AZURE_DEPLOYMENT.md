# 🚀 Step-by-Step Azure Deployment Guide for WealthArena AI Models

## 🎯 What We're Going to Do

This guide will take you through **every single step** to deploy your WealthArena AI models on Azure, make them accessible via the internet, and connect them to your backend. No technical experience required!

---

## 📋 Prerequisites Checklist

Before we start, make sure you have:

- [ ] **Azure Account** (with your existing resource group)
- [ ] **Docker Desktop** installed on your computer
- [ ] **Azure CLI** installed
- [ ] **ngrok account** (free tier works)
- [ ] **Your trained models** (already completed ✅)

---

## 🏗️ Step 1: Install Required Software

### 1.1 Install Docker Desktop
1. Go to [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Click "Download for Windows"
3. Run the installer
4. Restart your computer when prompted
5. Open Docker Desktop and make sure it's running

**Test it:**
```bash
docker --version
```
You should see something like "Docker version 20.10.x"

### 1.2 Install Azure CLI
1. Go to [https://docs.microsoft.com/en-us/cli/azure/install-azure-cli](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
2. Download the Windows installer
3. Run the installer
4. Restart your command prompt

**Test it:**
```bash
az --version
```
You should see Azure CLI version information

### 1.3 Install ngrok
1. Go to [https://ngrok.com/](https://ngrok.com/)
2. Sign up for a free account
3. Download ngrok for Windows
4. Extract the zip file to a folder (like `C:\ngrok\`)
5. Add the folder to your Windows PATH

**Test it:**
```bash
ngrok version
```

---

## 🔐 Step 2: Set Up Azure

### 2.1 Login to Azure
Open PowerShell or Command Prompt and run:
```bash
az login
```
- This will open a browser window
- Login with your Azure account
- Close the browser when done

### 2.2 Set Your Resource Group
```bash
# List your resource groups
az group list --output table

# Set your resource group (replace with your actual name)
$env:RESOURCE_GROUP = "YOUR_RESOURCE_GROUP_NAME"
```

---

## 🐳 Step 3: Prepare Your Models for Docker

### 3.1 Navigate to Your Project
```bash
cd "C:\Users\PC\Desktop\AIP Project Folder\WealthArena_UI\wealtharena_rl"
```

### 3.2 Test Your API Locally
```bash
# Install FastAPI if not already installed
pip install fastapi uvicorn

# Run the API server
python api_server.py
```

**Test it:**
- Open browser: http://localhost:8000
- You should see the API documentation
- Test: http://localhost:8000/health

### 3.3 Stop the Local Server
Press `Ctrl+C` to stop the server

---

## 🏗️ Step 4: Build and Deploy to Azure

### 4.1 Run the Deployment Script
I've created an automated script for you. Run this in PowerShell:

```powershell
# Make sure you're in the right directory
cd "C:\Users\PC\Desktop\AIP Project Folder\WealthArena_UI\wealtharena_rl"

# Run the deployment script
.\deploy_to_azure.ps1
```

**What this script does:**
1. Creates Azure Container Registry
2. Builds your Docker image
3. Pushes it to Azure
4. Creates a container instance
5. Gets the IP address

### 4.2 Manual Deployment (if script fails)
If the script doesn't work, follow these steps manually:

```bash
# 1. Create Azure Container Registry
az acr create --resource-group YOUR_RESOURCE_GROUP --name wealtharenaacr123 --sku Basic --admin-enabled true

# 2. Login to ACR
az acr login --name wealtharenaacr123

# 3. Build Docker image
docker build -t wealtharena-api .

# 4. Tag image
docker tag wealtharena-api wealtharenaacr123.azurecr.io/wealtharena-api:latest

# 5. Push to ACR
docker push wealtharenaacr123.azurecr.io/wealtharena-api:latest

# 6. Create container instance
az container create \
  --resource-group YOUR_RESOURCE_GROUP \
  --name wealtharena-ai-models \
  --image wealtharenaacr123.azurecr.io/wealtharena-api:latest \
  --cpu 2 \
  --memory 4 \
  --registry-login-server wealtharenaacr123.azurecr.io \
  --registry-username $(az acr credential show --name wealtharenaacr123 --query username --output tsv) \
  --registry-password $(az acr credential show --name wealtharenaacr123 --query passwords[0].value --output tsv) \
  --ports 8000 \
  --environment-variables PYTHONPATH=/app

# 7. Get container IP
az container show --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models --query ipAddress.ip --output tsv
```

---

## 🧪 Step 5: Test Your Azure Deployment

### 5.1 Get Your Container IP
```bash
az container show --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models --query ipAddress.ip --output tsv
```

### 5.2 Test the API
```bash
# Test health endpoint
curl http://YOUR_CONTAINER_IP:8000/health

# Or use PowerShell
Invoke-WebRequest -Uri "http://YOUR_CONTAINER_IP:8000/health"
```

### 5.3 Run Comprehensive Tests
```bash
# Run the test script
python test_api.py http://YOUR_CONTAINER_IP:8000
```

---

## 🌐 Step 6: Set Up Public Access with ngrok

### 6.1 Get Your ngrok Auth Token
1. Go to [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
2. Copy your auth token

### 6.2 Configure ngrok
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 6.3 Create Public Tunnel
```bash
ngrok http YOUR_CONTAINER_IP:8000
```

**You'll see something like:**
```
Session Status                online
Account                       your-email@example.com
Version                       3.1.0
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://YOUR_CONTAINER_IP:8000
```

**Write down the forwarding URL!** (e.g., `https://abc123.ngrok.io`)

### 6.4 Test Public Access
```bash
# Test the public URL
curl https://YOUR_NGROK_URL/health

# Or use PowerShell
Invoke-WebRequest -Uri "https://YOUR_NGROK_URL/health"
```

---

## 🔗 Step 7: Connect to Your Backend

### 7.1 Update Your Backend Configuration
Add this to your backend configuration:

```javascript
// AI API Configuration
const AI_API_BASE_URL = "https://YOUR_NGROK_URL";
const AI_API_ENDPOINTS = {
  health: `${AI_API_BASE_URL}/health`,
  predict: `${AI_API_BASE_URL}/predict`,
  predictAll: `${AI_API_BASE_URL}/predict-all`,
  models: `${AI_API_BASE_URL}/models`
};
```

### 7.2 Create AI Service in Your Backend
```javascript
class AIApiService {
  constructor() {
    this.baseURL = "https://YOUR_NGROK_URL";
  }

  async getHealth() {
    const response = await fetch(`${this.baseURL}/health`);
    return await response.json();
  }

  async getPrediction(agentName, inputData, symbol = null) {
    const response = await fetch(`${this.baseURL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_name: agentName,
        input_data: inputData,
        symbol: symbol
      })
    });
    return await response.json();
  }

  async getAllPredictions(inputData, symbol = null) {
    const response = await fetch(`${this.baseURL}/predict-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_name: "dummy",
        input_data: inputData,
        symbol: symbol
      })
    });
    return await response.json();
  }
}
```

### 7.3 Test Backend Connection
```javascript
// Test the connection
const aiService = new AIApiService();

// Test health check
aiService.getHealth().then(console.log);

// Test prediction
const testData = Array(140).fill(0).map(() => Math.random());
aiService.getPrediction('asx_stocks', [testData], 'AAPL').then(console.log);
```

---

## ✅ Step 8: Final Testing

### 8.1 Test All Endpoints
```bash
# Test health
curl https://YOUR_NGROK_URL/health

# Test models
curl https://YOUR_NGROK_URL/models

# Test prediction
curl -X POST https://YOUR_NGROK_URL/predict \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "asx_stocks",
    "input_data": [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]],
    "symbol": "AAPL"
  }'
```

### 8.2 Test from Your Backend
1. Start your backend application
2. Make API calls to the AI models
3. Verify responses are received
4. Check logs for any errors

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Container failed to start"
**Solution:**
```bash
# Check container logs
az container logs --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models

# Restart container
az container restart --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models
```

#### Issue 2: "Cannot connect to API"
**Solution:**
```bash
# Check if container is running
az container show --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models --query instanceView.state

# Check container IP
az container show --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models --query ipAddress.ip --output tsv
```

#### Issue 3: "ngrok tunnel not working"
**Solution:**
```bash
# Check ngrok status
ngrok api tunnels list

# Restart ngrok
ngrok http YOUR_CONTAINER_IP:8000
```

#### Issue 4: "Models not loading"
**Solution:**
```bash
# Check if model files exist
az container exec --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models -- ls -la checkpoints/

# Rebuild and redeploy
docker build -t wealtharena-api .
docker tag wealtharena-api YOUR_ACR_NAME.azurecr.io/wealtharena-api:latest
docker push YOUR_ACR_NAME.azurecr.io/wealtharena-api:latest
az container restart --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models
```

---

## 💰 Cost Management

### Azure Costs (Estimated Monthly)
- **Container Registry**: $5/month
- **Container Instance**: $10-15/month (2 CPU, 4GB RAM)
- **Storage**: $1-2/month
- **Total**: ~$16-22/month

### ngrok Costs
- **Free Tier**: 1 tunnel, 40 connections/minute
- **Paid Tier**: $8/month for more features

### Cost Optimization Tips
1. **Stop container when not in use:**
   ```bash
   az container stop --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models
   ```

2. **Start container when needed:**
   ```bash
   az container start --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models
   ```

---

## 📊 Monitoring and Maintenance

### Daily Tasks
- [ ] Check if container is running
- [ ] Monitor API response times
- [ ] Check ngrok tunnel status

### Weekly Tasks
- [ ] Review Azure costs
- [ ] Test all API endpoints
- [ ] Check container logs

### Monthly Tasks
- [ ] Update models with new data
- [ ] Review and optimize costs
- [ ] Backup configuration

---

## 🎯 Summary

**What We Accomplished:**
1. ✅ Installed all required software
2. ✅ Set up Azure resources
3. ✅ Containerized AI models
4. ✅ Deployed to Azure Container Instances
5. ✅ Set up public access with ngrok
6. ✅ Connected to your backend
7. ✅ Tested everything end-to-end

**Your AI Models Are Now:**
- 🌐 **Publicly accessible** via ngrok
- ☁️ **Running on Azure** cloud infrastructure
- 🔗 **Connected to your backend**
- 📊 **Ready for production use**

**Useful URLs:**
- **API Documentation**: https://YOUR_NGROK_URL/docs
- **Health Check**: https://YOUR_NGROK_URL/health
- **Models Info**: https://YOUR_NGROK_URL/models

---

## 📞 Quick Reference Commands

```bash
# Check container status
az container show --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models

# View logs
az container logs --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models

# Restart container
az container restart --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models

# Stop container
az container stop --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models

# Start container
az container start --resource-group YOUR_RESOURCE_GROUP --name wealtharena-ai-models
```

---

*Congratulations! Your WealthArena AI Models are now live on Azure! 🚀*

*Last Updated: October 17, 2025*
*Version: 1.0*
*Status: Production Ready* ✅
