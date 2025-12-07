# WealthArena Azure Deployment Guide

## Overview

This guide explains how to deploy the WealthArena RL, Chatbot, and Backend services to Azure. We've created a unified deployment system that uses Azure Container Instances (ACI) for hosting all services.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   RL Service    │    │  Chatbot Service│    │ Backend Service │
│   (Flask API)   │    │   (Flask API)   │    │  (Node.js API)  │
│   Port: 5000    │    │   Port: 5000    │    │   Port: 8080    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Azure Container │
                    │   Instances     │
                    │ (Public IPs)    │
                    └─────────────────┘
```

## Files Created

### 1. Configuration Files
- `azure_config.json` - Shared configuration for all services
- `deploy_to_azure_simple.py` - Main deployment script
- `requirements_deploy.txt` - Python dependencies for deployment

### 2. Service Files
- `wealtharena_rl/score.py` - RL service Flask API
- `wealtharena_chatbot/score.py` - Chatbot service Flask API
- `WealthArena_Backend/deploy_backend_to_azure.py` - Backend deployment script

### 3. Deployment Scripts
- `wealtharena_rl/deploy_rl_to_azure_in_py.py` - RL deployment (Azure ML)
- `wealtharena_chatbot/deploy_bot_to_azure_py.py` - Chatbot deployment (Azure ML)
- `WealthArena_Backend/deploy_backend_to_azure.py` - Backend deployment (Azure ML)

## Services Overview

### 1. RL Service (`wealtharena_rl`)
- **Technology**: Flask + Python
- **Endpoints**: 
  - `POST /score` - Get RL predictions
  - `GET /health` - Health check
- **Dependencies**: Flask, NumPy, Scikit-learn
- **Model Path**: `wealtharena_rl/model/`

### 2. Chatbot Service (`wealtharena_chatbot`)
- **Technology**: Flask + Python
- **Endpoints**:
  - `POST /chat` - Chat with the bot
  - `GET /health` - Health check
- **Dependencies**: Flask
- **Model Path**: `wealtharena_chatbot/model/`

### 3. Backend Service (`WealthArena_Backend`)
- **Technology**: Node.js + Express
- **Endpoints**: All existing API endpoints
- **Dependencies**: Node.js 18.x, npm packages
- **Build Process**: TypeScript compilation

## Deployment Methods

### Method 1: Simple Azure Container Instances (Recommended)

1. **Prerequisites**:
   ```bash
   # Install Azure CLI
   az login
   
   # Install Docker
   # Install Python dependencies
   pip install -r requirements_deploy.txt
   ```

2. **Deploy All Services**:
   ```bash
   python deploy_to_azure_simple.py
   ```

3. **Manual Deployment**:
   ```bash
   # Build and deploy RL service
   docker build -t wealtharena-rl wealtharena_rl/
   az container create --resource-group wealtharena-ml-rg --name wealtharena-rl --image wealtharena-rl --ports 5000
   
   # Build and deploy Chatbot service
   docker build -t wealtharena-chatbot wealtharena_chatbot/
   az container create --resource-group wealtharena-ml-rg --name wealtharena-chatbot --image wealtharena-chatbot --ports 5000
   
   # Build and deploy Backend service
   cd WealthArena_Backend && npm run build
   docker build -t wealtharena-backend .
   az container create --resource-group wealtharena-ml-rg --name wealtharena-backend --image wealtharena-backend --ports 8080
   ```

### Method 2: Azure Machine Learning (Advanced)

1. **Prerequisites**:
   ```bash
   pip install azureml-sdk azureml-core azureml-defaults
   ```

2. **Deploy Services**:
   ```bash
   # Deploy RL service
   cd wealtharena_rl
   python deploy_rl_to_azure_in_py.py
   
   # Deploy Chatbot service
   cd wealtharena_chatbot
   python deploy_bot_to_azure_py.py
   
   # Deploy Backend service
   cd WealthArena_Backend
   python deploy_backend_to_azure.py
   ```

## Configuration

### Azure Configuration (`azure_config.json`)
```json
{
  "subscription_id": "your-subscription-id",
  "resource_group": "wealtharena-ml-rg",
  "workspace_name": "wealtharena-ml-ws",
  "region": "northcentralus",
  "redeploy_if_exists": true,
  "aci_defaults": {
    "cpu_cores": 1,
    "memory_gb": 1
  },
  "services": {
    "rl": {
      "model_path": "wealtharena_rl/model",
      "model_name": "wealtharena-rl-model",
      "service_name": "wealtharena-rl-svc",
      "entry_script": "wealtharena_rl/score.py",
      "pip_packages": ["azureml-defaults", "numpy", "scikit-learn", "joblib"]
    },
    "chatbot": {
      "model_path": "wealtharena_chatbot/model",
      "model_name": "wealtharena-chatbot-model",
      "service_name": "wealtharena-chatbot-svc",
      "entry_script": "wealtharena_chatbot/score.py",
      "pip_packages": ["azureml-defaults"]
    },
    "backend": {
      "app_path": "WealthArena_Backend",
      "service_name": "wealtharena-backend-svc",
      "cpu_cores": 2,
      "memory_gb": 2,
      "node_version": "18.x",
      "environment_variables": {
        "NODE_ENV": "production",
        "PORT": "8080"
      }
    }
  }
}
```

## Testing Services

### Local Testing
```bash
# Test RL service
cd wealtharena_rl
python score.py
# Test: curl -X POST http://localhost:5000/score -d '{"test": "data"}'

# Test Chatbot service
cd wealtharena_chatbot
python score.py
# Test: curl -X POST http://localhost:5000/chat -d '{"message": "hello"}'

# Test Backend service
cd WealthArena_Backend
npm run dev
# Test: curl http://localhost:3000/api/health
```

### Azure Testing
```bash
# Get service URLs
az container show --resource-group wealtharena-ml-rg --name wealtharena-rl --query "ipAddress.ip" --output tsv

# Test health endpoints
curl http://[RL_SERVICE_IP]:5000/health
curl http://[CHATBOT_SERVICE_IP]:5000/health
curl http://[BACKEND_SERVICE_IP]:8080/api/health
```

## Integration with Frontend

Once deployed, update your frontend configuration to use the Azure service URLs:

```javascript
// In your frontend config
const API_ENDPOINTS = {
  backend: 'http://[BACKEND_SERVICE_IP]:8080',
  rl: 'http://[RL_SERVICE_IP]:5000',
  chatbot: 'http://[CHATBOT_SERVICE_IP]:5000'
};
```

## Monitoring and Management

### View Service Status
```bash
# List all containers
az container list --resource-group wealtharena-ml-rg

# View logs
az container logs --resource-group wealtharena-ml-rg --name wealtharena-rl

# Restart service
az container restart --resource-group wealtharena-ml-rg --name wealtharena-rl
```

### Cleanup
```bash
# Delete all services
az container delete --resource-group wealtharena-ml-rg --name wealtharena-rl --yes
az container delete --resource-group wealtharena-ml-rg --name wealtharena-chatbot --yes
az container delete --resource-group wealtharena-ml-rg --name wealtharena-backend --yes

# Delete resource group
az group delete --name wealtharena-ml-rg --yes
```

## Troubleshooting

### Common Issues

1. **Service not starting**: Check logs with `az container logs`
2. **Port conflicts**: Ensure ports 5000 and 8080 are available
3. **Authentication errors**: Run `az login` to authenticate
4. **Resource group issues**: Ensure you have permissions to create resources

### Debug Commands
```bash
# Check Azure CLI status
az account show

# List available regions
az account list-locations

# Check container registry
az acr list --resource-group wealtharena-ml-rg
```

## Next Steps

1. **Deploy to Production**: Use Azure Container Apps or Azure Kubernetes Service for production
2. **Add Monitoring**: Integrate Azure Monitor and Application Insights
3. **Set up CI/CD**: Use Azure DevOps or GitHub Actions for automated deployment
4. **Add Load Balancing**: Use Azure Application Gateway for high availability
5. **Implement Security**: Add authentication and HTTPS endpoints

## Cost Optimization

- Use smaller container instances for development
- Implement auto-scaling for production workloads
- Use Azure Container Registry Basic tier for development
- Monitor usage with Azure Cost Management

## Support

For issues with deployment, check:
1. Azure service logs
2. Container logs
3. Network connectivity
4. Authentication status
5. Resource quotas

---

**Note**: This deployment creates publicly accessible services. For production, implement proper security measures including authentication, HTTPS, and network restrictions.
