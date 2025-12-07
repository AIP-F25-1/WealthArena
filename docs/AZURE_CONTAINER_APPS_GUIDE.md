# Azure Container Apps Deployment Guide

This guide provides comprehensive instructions for deploying WealthArena to Azure Container Apps, an alternative to App Service that doesn't require App Service Plan quotas and offers generous free tier grants.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Cost Breakdown](#cost-breakdown)
6. [Troubleshooting](#troubleshooting)
7. [Monitoring and Logs](#monitoring-and-logs)
8. [Scaling Configuration](#scaling-configuration)
9. [References](#references)

---

## Introduction

### What is Azure Container Apps?

Azure Container Apps is a serverless container platform that allows you to run containerized applications without managing infrastructure. It's built on Kubernetes but abstracts away the complexity.

### Why Use Container Apps Instead of App Service?

1. **No App Service Plan Required**: Container Apps doesn't require App Service Plan quotas, making it ideal for free tier Azure accounts
2. **Generous Free Tier**: 180,000 vCPU-seconds, 360,000 GiB-seconds, and 2 million requests per month
3. **Scales to Zero**: No idle costs when applications aren't in use
4. **Better for Large Dependencies**: Supports large Docker images (torch, transformers, Ray/PyTorch)
5. **No Code Restructuring**: Run existing containerized applications as-is
6. **Kubernetes-based**: Built on Kubernetes for reliability and scalability

### When to Use Container Apps vs Functions vs App Service

| Scenario | Recommended Platform |
|----------|---------------------|
| Standard web apps with quota | App Service |
| Containerized apps, ML workloads | Container Apps |
| Event-driven, small packages | Functions |
| Large dependencies (torch, Ray) | Container Apps |
| Serverless, scales to zero | Container Apps or Functions |
| Free tier Azure account | Container Apps |

---

## Prerequisites

Before deploying to Azure Container Apps, ensure you have:

1. **Azure CLI** installed and logged in
   ```powershell
   az login
   az account show
   ```

2. **Docker Desktop** installed and running
   - Download from: https://www.docker.com/products/docker-desktop
   - Verify installation:
     ```powershell
     docker --version
     docker ps
     ```

3. **Azure Subscription** (free tier is sufficient)
   - Free tier includes: 180k vCPU-s, 360k GiB-s, 2M requests/month

4. **Infrastructure Resources** already created:
   - Resource Group
   - Azure SQL Server and Database
   - Storage Account
   - Key Vault (optional, for secrets)

5. **Docker Images** built from updated Dockerfiles:
   - `backend/Dockerfile` (Node.js 20, multi-stage build)
   - `chatbot/Dockerfile` (Python 3.11, CPU-only torch)
   - `rl-service/Dockerfile` (Python 3.11, Ray/PyTorch optimized)

---

## Architecture

### Container Apps Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Azure Container Apps Environment                │
│                    (wealtharena-env)                         │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │  Backend App     │  │  Chatbot App     │  │ RL Service│ │
│  │  (Node.js 20)    │  │  (Python 3.11)   │  │ (Python)  │ │
│  │                  │  │                  │  │           │ │
│  │  CPU: 0.5        │  │  CPU: 1.0        │  │ CPU: 2.0  │ │
│  │  Memory: 1.0Gi   │  │  Memory: 2.0Gi   │  │ Mem: 4.0Gi│ │
│  │  Port: 8080      │  │  Port: 8000      │  │ Port: 8000│ │
│  └──────────────────┘  └──────────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Azure Container Registry (ACR)                  │
│         (acrwealtharena*)                                    │
│                                                              │
│  • wealtharena-backend:latest                               │
│  • wealtharena-chatbot:latest                               │
│  • wealtharena-rl:latest                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Supporting Azure Services                       │
│                                                              │
│  • Azure SQL Database (wealtharena_db)                      │
│  • Azure Storage Account (for model checkpoints)            │
│  • Azure Key Vault (for secrets)                            │
└─────────────────────────────────────────────────────────────┘
```

### Component Overview

1. **Container Apps Environment**: Shared environment for all services
2. **Backend Container App**: Node.js 20 Express.js API
3. **Chatbot Container App**: Python 3.11 FastAPI with torch/transformers
4. **RL Service Container App**: Python 3.11 Flask with Ray/PyTorch
5. **Azure Container Registry**: Stores Docker images
6. **Managed Identity**: Enables Key Vault access without secrets

---

## Step-by-Step Deployment

### Option A: Master Deployment Script (Recommended)

Deploy all services in one command:

```powershell
cd infrastructure\azure_deployment
.\deploy_all_services_containerapp.ps1 -ResourceGroup rg-wealtharena-northcentralus
```

**Estimated Time**: 50-60 minutes
- Backend: 10 minutes
- Chatbot: 15 minutes (large torch/transformers image)
- RL Service: 20 minutes (very large Ray/PyTorch image)
- Environment setup: 5 minutes

### Option B: Individual Service Deployment

#### Step 1: Create Container Apps Environment

The backend deployment script creates the environment automatically. If deploying manually:

```powershell
az containerapp env create `
    --name wealtharena-env `
    --resource-group rg-wealtharena-northcentralus `
    --location northcentralus
```

#### Step 2: Create Azure Container Registry

The backend deployment script creates ACR automatically. If deploying manually:

```powershell
az acr create `
    --name acrwealtharena< suffix> `
    --resource-group rg-wealtharena-northcentralus `
    --sku Basic `
    --admin-enabled true
```

**Note**: ACR name must be lowercase and alphanumeric only (no hyphens).

#### Step 3: Deploy Backend

```powershell
cd infrastructure\azure_deployment
.\deploy_backend_containerapp.ps1 `
    -ResourceGroup rg-wealtharena-northcentralus `
    -Location northcentralus
```

This script will:
1. Create/verify Container Apps Environment
2. Create/verify Azure Container Registry
3. Build and push backend Docker image
4. Create Backend Container App
5. Configure environment variables and secrets
6. Enable managed identity for Key Vault access
7. Test health endpoint

#### Step 4: Deploy Chatbot

```powershell
.\deploy_chatbot_containerapp.ps1 `
    -ResourceGroup rg-wealtharena-northcentralus `
    -Location northcentralus
```

**Note**: Chatbot deployment takes longer due to large dependencies (torch, transformers ≈ 2GB).

#### Step 5: Deploy RL Service

```powershell
.\deploy_rl_containerapp.ps1 `
    -ResourceGroup rg-wealtharena-northcentralus `
    -Location northcentralus `
    -ModelMode mock
```

**Note**: RL Service has the largest image (~3-4GB with Ray/PyTorch). Build and push may take 15-20 minutes.

#### Step 6: Configure Environment Variables

Environment variables are configured automatically by the deployment scripts. Key variables:

**Backend:**
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `PORT=8080`
- `CHATBOT_API_URL`, `RL_API_URL`

**Chatbot:**
- `GROQ_API_KEY` (from Key Vault)
- `GROQ_MODEL=llama3-8b-8192`
- `PORT=8000`

**RL Service:**
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `MODEL_PATH`, `MODEL_MODE`
- `AZURE_STORAGE_CONNECTION_STRING`

#### Step 7: Test Deployments

```powershell
# Test backend
curl https://wealtharena-backend.<region>.azurecontainerapps.io/health

# Test chatbot
curl https://wealtharena-chatbot.<region>.azurecontainerapps.io/health

# Test RL service
curl https://wealtharena-rl.<region>.azurecontainerapps.io/health
```

---

## Cost Breakdown

### Free Tier Limits

Azure Container Apps free tier includes:

- **180,000 vCPU-seconds/month**: Compute time
- **360,000 GiB-seconds/month**: Memory usage
- **2 million requests/month**: HTTP requests

### Estimated Usage for WealthArena

**Low Traffic Scenario** (typical for development/testing):

- **Backend**: 0.5 CPU × 1 hour/day × 30 days = 15 vCPU-hours = 54,000 vCPU-seconds
- **Chatbot**: 1.0 CPU × 0.5 hours/day × 30 days = 15 vCPU-hours = 54,000 vCPU-seconds
- **RL Service**: 2.0 CPU × 0.25 hours/day × 30 days = 15 vCPU-hours = 54,000 vCPU-seconds
- **Total**: ~162,000 vCPU-seconds (within free tier)

**Memory Usage**:
- Backend: 1.0Gi × 1 hour/day × 30 days = 30 GiB-hours = 108,000 GiB-seconds
- Chatbot: 2.0Gi × 0.5 hours/day × 30 days = 30 GiB-hours = 108,000 GiB-seconds
- RL Service: 4.0Gi × 0.25 hours/day × 30 days = 30 GiB-hours = 108,000 GiB-seconds
- **Total**: ~324,000 GiB-seconds (within free tier)

**Cost Comparison**:

| Platform | Free Tier | Monthly Cost (Low Traffic) |
|----------|-----------|----------------------------|
| Container Apps | Generous | $0 (within free tier) |
| App Service B1 | Limited | ~$13/month (always on) |
| Functions | Generous | $0 (within free tier) |

**Note**: Container Apps scales to zero, so you only pay for active usage. App Service charges for running instances even when idle.

---

## Troubleshooting

### Docker Build Failures

**Issue**: Docker build fails with "no space left on device"

**Solution**:
```powershell
# Clean up Docker system
docker system prune -a --volumes

# Check disk space
docker system df
```

**Issue**: Build timeout for large images (chatbot, RL service)

**Solution**:
- Increase Docker Desktop memory: Settings → Resources → Memory (8GB+)
- Build during off-peak hours
- Use multi-stage builds (already implemented)

### Image Push Failures

**Issue**: ACR login fails

**Solution**:
```powershell
# Re-login to ACR
az acr login --name <registry-name>
```

**Issue**: Push timeout for large images

**Solution**:
- Ensure stable internet connection
- Push during off-peak hours
- Consider using Azure DevOps or GitHub Actions for builds

### Container Startup Failures

**Issue**: Container fails to start

**Solution**:
1. Check Container App logs:
   ```powershell
   az containerapp logs show --name <app-name> --resource-group <rg> --follow
   ```

2. Verify environment variables:
   ```powershell
   az containerapp show --name <app-name> --resource-group <rg> --query properties.template.containers[0].env
   ```

3. Check image pull:
   ```powershell
   az containerapp revision list --name <app-name> --resource-group <rg>
   ```

### Cold Start Issues

**Issue**: First request takes 30-60 seconds

**Solution**:
- **Expected behavior**: Cold start is normal for Container Apps
- **For RL Service**: Model loading adds 30-60 seconds to cold start
- **Mitigation**: Keep 1 replica warm (costs ~$30/month) or accept cold start

### Memory/CPU Limits

**Issue**: Container crashes with OOM (Out of Memory)

**Solution**:
1. Increase memory allocation:
   ```powershell
   az containerapp update `
       --name <app-name> `
       --resource-group <rg> `
       --memory 4.0Gi
   ```

2. Check memory usage:
   ```powershell
   az containerapp logs show --name <app-name> --resource-group <rg> --type system
   ```

**Issue**: CPU throttling

**Solution**:
1. Increase CPU allocation:
   ```powershell
   az containerapp update `
       --name <app-name> `
       --resource-group <rg> `
       --cpu 2.0
   ```

### Health Check Failures

**Issue**: Health endpoint returns 503

**Solution**:
1. Verify health endpoint path: `/health`
2. Check application logs for startup errors
3. Increase startup timeout:
   ```powershell
   az containerapp update `
       --name <app-name> `
       --resource-group <rg> `
       --set-env-vars "WEBSITE_HEALTHCHECK_TIMEOUT=300"
   ```

---

## Monitoring and Logs

### View Container App Logs

**Real-time logs**:
```powershell
az containerapp logs show `
    --name <app-name> `
    --resource-group <rg> `
    --follow
```

**Application logs**:
```powershell
az containerapp logs show `
    --name <app-name> `
    --resource-group <rg> `
    --type console
```

**System logs**:
```powershell
az containerapp logs show `
    --name <app-name> `
    --resource-group <rg> `
    --type system
```

### Monitor Metrics in Azure Portal

1. Navigate to: Azure Portal → Container Apps → Your App → Metrics
2. Key metrics:
   - **Requests**: HTTP request count
   - **Response Time**: Average response time
   - **CPU Usage**: CPU utilization percentage
   - **Memory Usage**: Memory consumption
   - **Replicas**: Number of active replicas

### Set Up Alerts

```powershell
# Create alert for high error rate
az monitor metrics alert create `
    --name "HighErrorRate" `
    --resource-group <rg> `
    --scopes /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.App/containerApps/<app-name> `
    --condition "avg Requests > 100" `
    --window-size 5m `
    --evaluation-frequency 1m
```

---

## Scaling Configuration

### Configure Min/Max Replicas

**Scale to zero (default)**:
```powershell
az containerapp update `
    --name <app-name> `
    --resource-group <rg> `
    --min-replicas 0 `
    --max-replicas 1
```

**Keep warm (no cold start)**:
```powershell
az containerapp update `
    --name <app-name> `
    --resource-group <rg> `
    --min-replicas 1 `
    --max-replicas 1
```

**Auto-scaling**:
```powershell
az containerapp update `
    --name <app-name> `
    --resource-group <rg> `
    --min-replicas 0 `
    --max-replicas 5
```

### Configure Autoscaling Rules

```powershell
# Scale based on CPU usage
az containerapp update `
    --name <app-name> `
    --resource-group <rg> `
    --scale-rule-name "cpu-scale" `
    --scale-rule-type "cpu" `
    --scale-rule-metadata "targetUtilization=70" `
    --min-replicas 0 `
    --max-replicas 5
```

### Scale to Zero Configuration

**Benefits**:
- No costs when idle
- Automatic scaling up on first request
- Cold start penalty (5-30 seconds)

**When to Use**:
- Development/testing environments
- Low-traffic applications
- Cost optimization

**When NOT to Use**:
- Production applications requiring low latency
- Real-time applications
- Applications with SLAs

---

## References

### Azure Documentation

- **Azure Container Apps Overview**: https://docs.microsoft.com/azure/container-apps/overview
- **Container Apps Pricing**: https://azure.microsoft.com/pricing/details/container-apps/
- **Container Apps Quotas**: https://docs.microsoft.com/azure/container-apps/quotas
- **Container Apps CLI Reference**: https://docs.microsoft.com/cli/azure/containerapp

### Docker Documentation

- **Docker Desktop**: https://docs.docker.com/desktop/
- **Docker Build**: https://docs.docker.com/engine/reference/commandline/build/
- **Multi-stage Builds**: https://docs.docker.com/build/building/multi-stage/

### Deployment Script References

- `infrastructure/azure_deployment/deploy_all_services_containerapp.ps1` - Master deployment script
- `infrastructure/azure_deployment/deploy_backend_containerapp.ps1` - Backend deployment
- `infrastructure/azure_deployment/deploy_chatbot_containerapp.ps1` - Chatbot deployment
- `infrastructure/azure_deployment/deploy_rl_containerapp.ps1` - RL service deployment

### Troubleshooting References

- See `README_TROUBLESHOOTING.md` for common errors and solutions
- Azure Container Apps Known Issues: https://github.com/Azure/container-apps/issues

---

## Quick Start Checklist

- [ ] Azure CLI installed and logged in
- [ ] Docker Desktop installed and running
- [ ] Resource group, SQL Server, Storage Account created
- [ ] Dockerfiles updated (multi-stage builds)
- [ ] Run master deployment script or individual service scripts
- [ ] Verify health endpoints respond
- [ ] Check Container App logs for errors
- [ ] Configure frontend with service URLs
- [ ] Test end-to-end user flows

---

**Last Updated**: 2024
**Version**: 1.0

