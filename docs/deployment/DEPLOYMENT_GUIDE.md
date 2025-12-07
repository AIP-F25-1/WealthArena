# WealthArena Deployment Guide

This guide covers the complete deployment process for the WealthArena platform.

## Overview

The WealthArena platform consists of:
- **Frontend**: React Native/Expo mobile app
- **Backend API**: FastAPI service with Azure SQL + Cosmos DB
- **RAG Chatbot**: FastAPI service with Groq LLM integration
- **Data Pipeline**: Databricks notebooks for ML and data processing
- **Infrastructure**: Azure resources (SQL, Cosmos DB, Storage, Container Apps)

## Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web Frontend  │    │   Admin Portal  │
│   (React Native)│    │   (Next.js)     │    │   (React)       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │                           │
            ┌───────▼────────┐        ┌────────▼────────┐
            │  Backend API   │        │  RAG Chatbot    │
            │  (FastAPI)     │        │  (FastAPI)      │
            └───────┬────────┘        └────────┬────────┘
                    │                           │
            ┌───────▼────────┐        ┌────────▼────────┐
            │  Azure SQL DB  │        │  Vector DB      │
            │  + Cosmos DB   │        │  (ChromaDB)     │
            └─────────────────┘        └─────────────────┘
                    │
            ┌───────▼────────┐
            │  Databricks    │
            │  (ML Pipeline) │
            └─────────────────┘
```

## Prerequisites

### Required Tools
- Azure CLI 2.0+
- Docker Desktop
- PowerShell 5.1+
- Node.js 18+
- Python 3.11+

### Required Access
- Azure subscription with contributor permissions
- Databricks workspace access
- Docker Hub or Azure Container Registry access

## Step-by-Step Deployment

### Phase 1: Infrastructure Setup

#### 1.1 Provision Azure Resources
```powershell
# Run the master setup script
.\azure_infrastructure\setup_master.ps1

# Verify all resources are created
.\azure_infrastructure\verify_resources.ps1
```

#### 1.2 Set Up Database Schemas
```sql
-- Connect to Azure SQL Database
-- Run the schema script
-- File: database_schemas/azure_sql_schema.sql
```

#### 1.3 Configure Cosmos DB Collections
```json
-- Use the Cosmos DB collections schema
-- File: database_schemas/cosmos_collections.json
```

### Phase 2: Data Pipeline Setup

#### 2.1 Upload Databricks Notebooks
```powershell
# Configure Databricks CLI
databricks configure --token

# Upload notebooks
.\azure_infrastructure\setup_databricks_jobs.ps1
```

#### 2.2 Create Knowledge Base
```bash
# Scrape financial education content
python chatbot_setup/01_scrape_investopedia.py

# Create vector embeddings
python chatbot_setup/02_create_embeddings.py
```

### Phase 3: Backend Services Deployment

#### 3.1 Build and Push Docker Images

**RAG Chatbot Service:**
```bash
# Build image
docker build -t rag-chatbot ./azure_services/rag_chatbot_service/

# Tag for Azure Container Registry
docker tag rag-chatbot acrwealtharenadev.azurecr.io/rag-chatbot:latest

# Push to registry
docker push acrwealtharenadev.azurecr.io/rag-chatbot:latest
```

**Backend API Service:**
```bash
# Build image
docker build -t wealtharena-backend ./azure_services/wealtharena_backend_api/

# Tag for Azure Container Registry
docker tag wealtharena-backend acrwealtharenadev.azurecr.io/wealtharena-backend:latest

# Push to registry
docker push acrwealtharenadev.azurecr.io/wealtharena-backend:latest
```

#### 3.2 Deploy to Azure Container Apps

**Deploy RAG Chatbot:**
```bash
az containerapp create \
  --name rag-chatbot \
  --resource-group rg-wealtharena-northcentralus \
  --environment cae-wealtharena-dev \
  --image acrwealtharenadev.azurecr.io/rag-chatbot:latest \
  --target-port 8000 \
  --ingress external \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars GROQ_API_KEY=YOUR_GROQ_API_KEY \
  --env-vars AZURE_COSMOS_ENDPOINT=https://cosmos-wealtharena-dev.documents.azure.com:443/ \
  --env-vars AZURE_COSMOS_KEY=your_cosmos_key
```

**Deploy Backend API:**
```bash
az containerapp create \
  --name wealtharena-backend \
  --resource-group rg-wealtharena-northcentralus \
  --environment cae-wealtharena-dev \
  --image acrwealtharenadev.azurecr.io/wealtharena-backend:latest \
  --target-port 8000 \
  --ingress external \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars AZURE_SQL_SERVER=sql-wealtharena-dev.database.windows.net \
  --env-vars AZURE_SQL_DATABASE=wealtharena_db \
  --env-vars AZURE_SQL_USERNAME=wealtharena_admin \
  --env-vars AZURE_SQL_PASSWORD=WealthArena2024! \
  --env-vars AZURE_STORAGE_ACCOUNT=stwealtharenadev \
  --env-vars AZURE_STORAGE_KEY=your_storage_key \
  --env-vars CHATBOT_URL=https://rag-chatbot-dev.azurecontainerapps.io
```

### Phase 4: Frontend Integration

#### 4.1 Update Frontend Configuration

**Update API URLs in WealthArena/config/apiKeys.ts:**
```typescript
export const API_CONFIG = {
  BACKEND_URL: 'https://wealtharena-backend-dev.azurecontainerapps.io',
  CHATBOT_URL: 'https://rag-chatbot-dev.azurecontainerapps.io',
  // ... other config
};
```

#### 4.2 Test Frontend Integration
```bash
# Install dependencies
cd WealthArena
npm install

# Start development server
npm start

# Test on device/simulator
npm run ios  # or npm run android
```

### Phase 5: Testing and Validation

#### 5.1 Run Integration Tests
```powershell
.\azure_infrastructure\test_integration.ps1 -BackendUrl "https://wealtharena-backend-dev.azurecontainerapps.io" -ChatbotUrl "https://rag-chatbot-dev.azurecontainerapps.io"
```

#### 5.2 Test Individual Components

**Test Backend API:**
```bash
# Health check
curl https://wealtharena-backend-dev.azurecontainerapps.io/healthz

# Test user registration
curl -X POST https://wealtharena-backend-dev.azurecontainerapps.io/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"TestPass123!","display_name":"Test User"}'

# Test trading signals
curl https://wealtharena-backend-dev.azurecontainerapps.io/api/signals/top
```

**Test RAG Chatbot:**
```bash
# Health check
curl https://rag-chatbot-dev.azurecontainerapps.io/healthz

# Test chat
curl -X POST https://rag-chatbot-dev.azurecontainerapps.io/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is RSI and how do I use it?","user_id":"test123"}'
```

#### 5.3 Test Data Pipeline

**Trigger Databricks Jobs:**
```bash
# List jobs
databricks jobs list

# Run market data ingestion
databricks jobs run-now --job-id <job_id>

# Check job status
databricks jobs get --job-id <job_id>
```

### Phase 6: Production Deployment

#### 6.1 Configure Custom Domains
```bash
# Add custom domain to Container Apps
az containerapp hostname add \
  --name wealtharena-backend \
  --resource-group rg-wealtharena-northcentralus \
  --hostname api.wealtharena.com

az containerapp hostname add \
  --name rag-chatbot \
  --resource-group rg-wealtharena-northcentralus \
  --hostname chatbot.wealtharena.com
```

#### 6.2 Set Up SSL Certificates
```bash
# Configure SSL for custom domains
az containerapp hostname bind \
  --name wealtharena-backend \
  --resource-group rg-wealtharena-northcentralus \
  --hostname api.wealtharena.com
```

#### 6.3 Configure Monitoring
```bash
# Enable Application Insights
az monitor app-insights component create \
  --app wealtharena-insights \
  --location northcentralus \
  --resource-group rg-wealtharena-northcentralus

# Configure alerts
az monitor metrics alert create \
  --name "API Response Time" \
  --resource-group rg-wealtharena-northcentralus \
  --scopes /subscriptions/{subscription-id}/resourceGroups/rg-wealtharena-northcentralus \
  --condition "avg responseTime > 1000" \
  --description "Alert when API response time exceeds 1 second"
```

## Environment Configuration

### Development Environment
```bash
# Backend API
BACKEND_URL=http://localhost:8000
CHATBOT_URL=http://localhost:8001

# Database
AZURE_SQL_SERVER=localhost
AZURE_SQL_DATABASE=wealtharena_dev
AZURE_SQL_USERNAME=sa
AZURE_SQL_PASSWORD=YourPassword123!

# Storage
AZURE_STORAGE_ACCOUNT=devstorage
AZURE_STORAGE_KEY=your_dev_key
```

### Staging Environment
```bash
# Backend API
BACKEND_URL=https://wealtharena-backend-staging.azurecontainerapps.io
CHATBOT_URL=https://rag-chatbot-staging.azurecontainerapps.io

# Database
AZURE_SQL_SERVER=sql-wealtharena-staging.database.windows.net
AZURE_SQL_DATABASE=wealtharena_staging
AZURE_SQL_USERNAME=wealtharena_admin
AZURE_SQL_PASSWORD=StagingPassword123!

# Storage
AZURE_STORAGE_ACCOUNT=stwealtharenastaging
AZURE_STORAGE_KEY=your_staging_key
```

### Production Environment
```bash
# Backend API
BACKEND_URL=https://api.wealtharena.com
CHATBOT_URL=https://chatbot.wealtharena.com

# Database
AZURE_SQL_SERVER=sql-wealtharena-prod.database.windows.net
AZURE_SQL_DATABASE=wealtharena_prod
AZURE_SQL_USERNAME=wealtharena_admin
AZURE_SQL_PASSWORD=ProductionPassword123!

# Storage
AZURE_STORAGE_ACCOUNT=stwealtharenaprod
AZURE_STORAGE_KEY=your_prod_key
```

## Monitoring and Maintenance

### Health Checks
- **Backend API**: `/healthz` endpoint
- **RAG Chatbot**: `/healthz` endpoint
- **Databricks Jobs**: Job execution status
- **Database**: Connection and query performance

### Logging
- **Application Logs**: Azure Container Apps logs
- **Database Logs**: Azure SQL Database logs
- **Databricks Logs**: Job execution logs
- **Storage Logs**: ADLS Gen2 access logs

### Backup and Recovery
- **Database Backups**: Automated daily backups
- **Cosmos DB**: Point-in-time recovery
- **Storage**: Versioning and lifecycle management
- **Container Images**: Registry backups

### Scaling
- **Container Apps**: Auto-scaling based on CPU/memory
- **Databricks**: Cluster auto-scaling
- **Database**: Manual scaling (upgrade tiers)
- **Storage**: Automatic scaling

## Troubleshooting

### Common Issues

1. **Container Apps Not Starting**
   - Check environment variables
   - Verify image exists in registry
   - Review container logs

2. **Database Connection Failures**
   - Check firewall rules
   - Verify connection strings
   - Test network connectivity

3. **Databricks Jobs Failing**
   - Check cluster configuration
   - Verify notebook paths
   - Review job dependencies

4. **API Timeouts**
   - Check resource limits
   - Monitor database performance
   - Review network latency

### Debug Commands

```bash
# Check container status
az containerapp show --name wealtharena-backend --resource-group rg-wealtharena-northcentralus

# View logs
az containerapp logs show --name wealtharena-backend --resource-group rg-wealtharena-northcentralus

# Test database connection
sqlcmd -S sql-wealtharena-dev.database.windows.net -U wealtharena_admin -P WealthArena2024! -d wealtharena_db -Q "SELECT 1"

# Check Databricks jobs
databricks jobs list
databricks jobs get --job-id <job_id>
```

## Security Considerations

### Secrets Management
- Store all secrets in Azure Key Vault
- Use managed identities for service authentication
- Rotate keys and passwords regularly

### Network Security
- Configure VNet integration
- Use private endpoints for databases
- Implement proper firewall rules

### Access Control
- Use Azure RBAC for resource access
- Implement least privilege principle
- Enable MFA for admin accounts

### Data Protection
- Encrypt data at rest and in transit
- Use Azure SQL TDE
- Implement Cosmos DB encryption

## Cost Optimization

### Resource Optimization
- Use appropriate VM sizes
- Enable auto-scaling
- Monitor resource usage
- Stop unused resources

### Storage Optimization
- Use appropriate storage tiers
- Implement lifecycle policies
- Compress data where possible

### Database Optimization
- Use appropriate database tiers
- Optimize queries
- Implement connection pooling
- Use read replicas where appropriate

## Support and Maintenance

### Regular Maintenance
- Update dependencies monthly
- Review security patches
- Monitor performance metrics
- Backup critical data

### Monitoring
- Set up alerts for critical metrics
- Monitor resource usage
- Track application performance
- Review error logs

### Updates and Upgrades
- Plan maintenance windows
- Test updates in staging
- Use blue-green deployment
- Rollback procedures

## Conclusion

This deployment guide provides comprehensive instructions for setting up the WealthArena platform. Follow the steps in order, and refer to the troubleshooting section if you encounter issues.

For additional support, refer to:
- Azure documentation
- Databricks documentation
- FastAPI documentation
- React Native documentation
