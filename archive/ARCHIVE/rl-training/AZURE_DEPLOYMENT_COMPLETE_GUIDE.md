# 🚀 Complete Azure Deployment Guide for WealthArena AI Models

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Understanding the Architecture](#understanding-the-architecture)
3. [Step 1: Prepare Your Local Environment](#step-1-prepare-your-local-environment)
4. [Step 2: Create Azure Resources](#step-2-create-azure-resources)
5. [Step 3: Set Up Docker Container](#step-3-set-up-docker-container)
6. [Step 4: Deploy to Azure Container Instances](#step-4-deploy-to-azure-container-instances)
7. [Step 5: Set Up ngrok for Public Access](#step-5-set-up-ngrok-for-public-access)
8. [Step 6: Connect to Your Backend](#step-6-connect-to-your-backend)
9. [Step 7: Test Everything](#step-7-test-everything)
10. [Troubleshooting](#troubleshooting)
11. [Cost Management](#cost-management)

---

## 🎯 Prerequisites

### What You Need:
1. **Azure Account** (with your existing resource group)
2. **Docker Desktop** installed on your computer
3. **Azure CLI** installed
4. **ngrok account** (free tier works)
5. **Your trained models** (already completed ✅)

### Estimated Time: 2-3 hours
### Estimated Cost: $5-20/month (depending on usage)

---

## 🏗️ Understanding the Architecture

Here's what we're building:

```
Your Computer → Docker Container → Azure Container Instance → ngrok → Internet → Your Backend
     ↓              ↓                        ↓                ↓         ↓           ↓
  Models API    Containerized          Azure Cloud        Public URL   Web        Your App
  Server        Application            Service            Access       Traffic    Database
```

**Simple Explanation:**
1. Your AI models run in a Docker container
2. The container runs on Azure (Microsoft's cloud)
3. ngrok makes it accessible from the internet
4. Your backend can call the AI models via the internet

---

## 📦 Step 1: Prepare Your Local Environment

### 1.1 Install Docker Desktop
1. Go to [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Download and install Docker Desktop
3. Start Docker Desktop
4. Verify installation:
   ```bash
   docker --version
   ```

### 1.2 Install Azure CLI
1. Go to [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
2. Download and install Azure CLI
3. Verify installation:
   ```bash
   az --version
   ```

### 1.3 Login to Azure
```bash
az login
```
- This will open a browser window
- Login with your Azure account
- Close the browser when done

### 1.4 Set Your Subscription
```bash
# List your subscriptions
az account list --output table

# Set the correct subscription (replace with your subscription ID)
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

---

## 🏢 Step 2: Create Azure Resources

### 2.1 Set Your Resource Group
```bash
# Replace with your existing resource group name
RESOURCE_GROUP="YOUR_RESOURCE_GROUP_NAME"
LOCATION="eastus"  # or your preferred location
```

### 2.2 Create Azure Container Registry (ACR)
This is where we'll store our Docker images.

```bash
# Create ACR (replace with unique name)
ACR_NAME="wealtharenaacr$(date +%s)"
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true
```

**Note:** Write down your ACR name! You'll need it later.

### 2.3 Login to ACR
```bash
az acr login --name $ACR_NAME
```

### 2.4 Create Azure Container Instance
```bash
# Create container instance
az container create \
  --resource-group $RESOURCE_GROUP \
  --name wealtharena-ai-models \
  --image $ACR_NAME.azurecr.io/wealtharena-api:latest \
  --cpu 2 \
  --memory 4 \
  --registry-login-server $ACR_NAME.azurecr.io \
  --registry-username $(az acr credential show --name $ACR_NAME --query username --output tsv) \
  --registry-password $(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv) \
  --ports 8000 \
  --environment-variables PYTHONPATH=/app
```

---

## 🐳 Step 3: Set Up Docker Container

### 3.1 Build the Docker Image Locally
```bash
# Navigate to your wealtharena_rl folder
cd "C:\Users\PC\Desktop\AIP Project Folder\WealthArena_UI\wealtharena_rl"

# Build the Docker image
docker build -t wealtharena-api .
```

### 3.2 Test the Container Locally
```bash
# Run the container locally to test
docker run -p 8000:8000 wealtharena-api
```

**Test it:**
- Open browser: http://localhost:8000
- You should see the API documentation
- Test health endpoint: http://localhost:8000/health

### 3.3 Tag and Push to Azure Container Registry
```bash
# Tag the image for ACR
docker tag wealtharena-api $ACR_NAME.azurecr.io/wealtharena-api:latest

# Push to ACR
docker push $ACR_NAME.azurecr.io/wealtharena-api:latest
```

---

## ☁️ Step 4: Deploy to Azure Container Instances

### 4.1 Update Container Instance
```bash
# Update the container instance with the new image
az container restart --resource-group $RESOURCE_GROUP --name wealtharena-ai-models
```

### 4.2 Get Container IP Address
```bash
# Get the public IP address
az container show --resource-group $RESOURCE_GROUP --name wealtharena-ai-models --query ipAddress.ip --output tsv
```

**Note:** Write down this IP address!

### 4.3 Test Azure Deployment
```bash
# Test the health endpoint
curl http://YOUR_CONTAINER_IP:8000/health
```

---

## 🌐 Step 5: Set Up ngrok for Public Access

### 5.1 Install ngrok
1. Go to [ngrok](https://ngrok.com/)
2. Sign up for a free account
3. Download ngrok
4. Extract and add to your PATH

### 5.2 Get ngrok Auth Token
1. Login to ngrok dashboard
2. Go to "Your Authtoken"
3. Copy your auth token

### 5.3 Configure ngrok
```bash
# Add your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 5.4 Create ngrok Tunnel
```bash
# Create tunnel to your Azure container
ngrok http YOUR_CONTAINER_IP:8000
```

**Note:** ngrok will give you a public URL like `https://abc123.ngrok.io`

### 5.5 Test Public Access
```bash
# Test the public URL
curl https://YOUR_NGROK_URL/health
```

---

## 🔗 Step 6: Connect to Your Backend

### 6.1 Update Your Backend Configuration
Add the AI API endpoint to your backend:

```javascript
// In your backend configuration
const AI_API_BASE_URL = "https://YOUR_NGROK_URL";
const AI_API_ENDPOINTS = {
  health: `${AI_API_BASE_URL}/health`,
  predict: `${AI_API_BASE_URL}/predict`,
  predictAll: `${AI_API_BASE_URL}/predict-all`,
  models: `${AI_API_BASE_URL}/models`
};
```

### 6.2 Create Backend Service
```javascript
// Example backend service for calling AI models
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
        agent_name: "dummy", // Required but not used for predict-all
        input_data: inputData,
        symbol: symbol
      })
    });
    return await response.json();
  }
}
```

### 6.3 Test Backend Connection
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

## ✅ Step 7: Test Everything

### 7.1 Test API Endpoints
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

### 7.2 Test from Your Backend
1. Start your backend application
2. Make API calls to the AI models
3. Verify responses are received
4. Check logs for any errors

### 7.3 Monitor Performance
```bash
# Check container logs
az container logs --resource-group $RESOURCE_GROUP --name wealtharena-ai-models

# Check container status
az container show --resource-group $RESOURCE_GROUP --name wealtharena-ai-models --query instanceView.state
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Container failed to start"
**Solution:**
```bash
# Check container logs
az container logs --resource-group $RESOURCE_GROUP --name wealtharena-ai-models

# Common fixes:
# 1. Check if all dependencies are installed
# 2. Verify model files are present
# 3. Check memory requirements
```

#### Issue 2: "Cannot connect to API"
**Solution:**
```bash
# Check if container is running
az container show --resource-group $RESOURCE_GROUP --name wealtharena-ai-models --query instanceView.state

# Check if port is open
az container show --resource-group $RESOURCE_GROUP --name wealtharena-ai-models --query ipAddress.ports
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
# Check if model files exist in container
az container exec --resource-group $RESOURCE_GROUP --name wealtharena-ai-models -- ls -la checkpoints/

# Rebuild and redeploy if needed
docker build -t wealtharena-api .
docker tag wealtharena-api $ACR_NAME.azurecr.io/wealtharena-api:latest
docker push $ACR_NAME.azurecr.io/wealtharena-api:latest
az container restart --resource-group $RESOURCE_GROUP --name wealtharena-ai-models
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
   az container stop --resource-group $RESOURCE_GROUP --name wealtharena-ai-models
   ```

2. **Start container when needed:**
   ```bash
   az container start --resource-group $RESOURCE_GROUP --name wealtharena-ai-models
   ```

3. **Use smaller instance size:**
   ```bash
   # Update to smaller size
   az container create --resource-group $RESOURCE_GROUP --name wealtharena-ai-models-small \
     --image $ACR_NAME.azurecr.io/wealtharena-api:latest \
     --cpu 1 --memory 2
   ```

---

## 📊 Monitoring and Maintenance

### 7.1 Set Up Monitoring
```bash
# Enable container insights
az monitor log-analytics workspace create --resource-group $RESOURCE_GROUP --workspace-name wealtharena-logs

# Link to container
az container create --resource-group $RESOURCE_GROUP --name wealtharena-ai-models \
  --image $ACR_NAME.azurecr.io/wealtharena-api:latest \
  --log-analytics-workspace wealtharena-logs
```

### 7.2 Regular Maintenance
1. **Update models monthly**
2. **Monitor costs weekly**
3. **Check logs daily**
4. **Test endpoints weekly**

### 7.3 Backup Strategy
```bash
# Backup model files
az storage blob upload-batch --destination models-backup --source checkpoints

# Backup configuration
az storage blob upload --file docker-compose.yml --container-name config-backup
```

---

## 🎯 Summary

**What We Accomplished:**
1. ✅ Created Azure Container Registry
2. ✅ Built and containerized AI models
3. ✅ Deployed to Azure Container Instances
4. ✅ Set up ngrok for public access
5. ✅ Connected to your backend
6. ✅ Tested everything end-to-end

**Your AI Models Are Now:**
- 🌐 **Publicly accessible** via ngrok
- ☁️ **Running on Azure** cloud infrastructure
- 🔗 **Connected to your backend**
- 📊 **Ready for production use**

**Next Steps:**
1. **Monitor performance** and costs
2. **Update models** regularly
3. **Scale up** if needed
4. **Add more features** as required

---

## 📞 Support

### Quick Commands Reference
```bash
# Check container status
az container show --resource-group $RESOURCE_GROUP --name wealtharena-ai-models

# View logs
az container logs --resource-group $RESOURCE_GROUP --name wealtharena-ai-models

# Restart container
az container restart --resource-group $RESOURCE_GROUP --name wealtharena-ai-models

# Stop container
az container stop --resource-group $RESOURCE_GROUP --name wealtharena-ai-models

# Start container
az container start --resource-group $RESOURCE_GROUP --name wealtharena-ai-models
```

### Useful URLs
- **API Documentation**: https://YOUR_NGROK_URL/docs
- **Health Check**: https://YOUR_NGROK_URL/health
- **Models Info**: https://YOUR_NGROK_URL/models

---

*Congratulations! Your WealthArena AI Models are now live on Azure! 🚀*

*Last Updated: October 17, 2025*
*Version: 1.0*
*Status: Production Ready* ✅
