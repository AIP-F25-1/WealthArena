# Azure Deployment Pipeline for WealthArena RL System

## Prerequisites
- Azure CLI installed and configured
- Docker Desktop running
- Kubernetes cluster (AKS) or Container Instances
- Azure Container Registry (ACR)

## Step 1: Azure Infrastructure Setup

### 1.1 Create Resource Group
```bash
az group create --name wealtharena-rl-rg --location eastus
```

### 1.2 Create Azure Container Registry
```bash
az acr create --resource-group wealtharena-rl-rg --name wealtharenaacr --sku Basic
az acr login --name wealtharenaacr
```

### 1.3 Create Azure Kubernetes Service
```bash
az aks create \
  --resource-group wealtharena-rl-rg \
  --name wealtharena-aks \
  --node-count 3 \
  --enable-addons monitoring \
  --generate-ssh-keys \
  --attach-acr wealtharenaacr
```

### 1.4 Create Azure SQL Database
```bash
az sql server create \
  --resource-group wealtharena-rl-rg \
  --name wealtharena-sql-server \
  --admin-user wealtharenaadmin \
  --admin-password <secure-password>

az sql db create \
  --resource-group wealtharena-rl-rg \
  --server wealtharena-sql-server \
  --name wealtharena-db \
  --service-objective S2
```

### 1.5 Create Azure Storage Account
```bash
az storage account create \
  --resource-group wealtharena-rl-rg \
  --name wealtharenastorage \
  --location eastus \
  --sku Standard_LRS
```

## Step 2: Build and Push Docker Images

### 2.1 Build RL System Image
```bash
cd wealtharena_rl
docker build -t wealtharenaacr.azurecr.io/wealtharena-rl:latest .
docker push wealtharenaacr.azurecr.io/wealtharena-rl:latest
```

### 2.2 Build UI Image
```bash
cd ../WealthArena_UI/WealthArena
docker build -t wealtharenaacr.azurecr.io/wealtharena-ui:latest .
docker push wealtharenaacr.azurecr.io/wealtharena-ui:latest
```

### 2.3 Build Backend Image
```bash
cd ../../WealthArena_Backend
docker build -t wealtharenaacr.azurecr.io/wealtharena-backend:latest .
docker push wealtharenaacr.azurecr.io/wealtharena-backend:latest
```

## Step 3: Deploy to Kubernetes

### 3.1 Get AKS Credentials
```bash
az aks get-credentials --resource-group wealtharena-rl-rg --name wealtharena-aks
```

### 3.2 Create Namespace
```bash
kubectl create namespace wealtharena
```

### 3.3 Deploy RL System
```bash
kubectl apply -f wealtharena_rl/k8s/ -n wealtharena
```

### 3.4 Deploy Backend
```bash
kubectl apply -f WealthArena_Backend/k8s/ -n wealtharena
```

### 3.5 Deploy UI
```bash
kubectl apply -f WealthArena_UI/k8s/ -n wealtharena
```

## Step 4: Configure Environment Variables

### 4.1 Create ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: wealtharena-config
  namespace: wealtharena
data:
  DATABASE_URL: "Server=wealtharena-sql-server.database.windows.net;Database=wealtharena-db;User Id=wealtharenaadmin;Password=<password>;Encrypt=true;"
  REDIS_URL: "redis://wealtharena-redis:6379"
  KAFKA_BROKERS: "wealtharena-kafka:9092"
  AZURE_STORAGE_CONNECTION_STRING: "<storage-connection-string>"
```

### 4.2 Create Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: wealtharena-secrets
  namespace: wealtharena
type: Opaque
data:
  JWT_SECRET: <base64-encoded-secret>
  ALPHA_VANTAGE_API_KEY: <base64-encoded-key>
  OPENAI_API_KEY: <base64-encoded-key>
```

## Step 5: Set Up Monitoring

### 5.1 Install Prometheus
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n wealtharena
```

### 5.2 Install Grafana
```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana -n wealtharena
```

## Step 6: Database Migration

### 6.1 Run Database Scripts
```bash
# Connect to Azure SQL and run the schema creation script
sqlcmd -S wealtharena-sql-server.database.windows.net -d wealtharena-db -U wealtharenaadmin -P <password> -i WealthArena_UI/WealthArena/database/AzureSQL_CreateTables.sql
```

## Step 7: Health Checks and Testing

### 7.1 Check Pod Status
```bash
kubectl get pods -n wealtharena
```

### 7.2 Test API Endpoints
```bash
# Get external IP
kubectl get services -n wealtharena

# Test health endpoints
curl http://<external-ip>/api/health
curl http://<external-ip>/api/rl-agent/health
```

## Step 8: CI/CD Pipeline (GitHub Actions)

### 8.1 Create .github/workflows/deploy.yml
```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Azure Login
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
    
    - name: Build and push images
      run: |
        az acr build --registry wealtharenaacr --image wealtharena-rl:latest ./wealtharena_rl
        az acr build --registry wealtharenaacr --image wealtharena-backend:latest ./WealthArena_Backend
        az acr build --registry wealtharenaacr --image wealtharena-ui:latest ./WealthArena_UI/WealthArena
    
    - name: Deploy to AKS
      run: |
        az aks get-credentials --resource-group wealtharena-rl-rg --name wealtharena-aks
        kubectl set image deployment/wealtharena-rl wealtharena-rl=wealtharenaacr.azurecr.io/wealtharena-rl:latest -n wealtharena
        kubectl rollout restart deployment/wealtharena-rl -n wealtharena
```

## Step 9: Scaling and Optimization

### 9.1 Horizontal Pod Autoscaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wealtharena-rl-hpa
  namespace: wealtharena
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: wealtharena-rl
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Step 10: Backup and Disaster Recovery

### 10.1 Database Backup
```bash
# Automated daily backups
az sql db export \
  --resource-group wealtharena-rl-rg \
  --server wealtharena-sql-server \
  --name wealtharena-db \
  --storage-key-type StorageAccessKey \
  --storage-key <storage-key> \
  --storage-uri https://wealtharenastorage.blob.core.windows.net/backups/wealtharena-db-$(date +%Y%m%d).bacpac
```

## Estimated Timeline
- **Infrastructure Setup**: 2-3 hours
- **Docker Build & Push**: 1 hour
- **Kubernetes Deployment**: 1-2 hours
- **Database Migration**: 30 minutes
- **Testing & Validation**: 1-2 hours
- **Total**: 5-8 hours

## Cost Estimation (Monthly)
- **AKS Cluster (3 nodes)**: ~$300-500
- **Azure SQL Database (S2)**: ~$75
- **Container Registry**: ~$5
- **Storage Account**: ~$10-20
- **Total**: ~$390-595/month
