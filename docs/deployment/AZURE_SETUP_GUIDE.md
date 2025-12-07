# WealthArena Azure Setup Guide

This guide provides step-by-step instructions for setting up the complete WealthArena platform on Azure.

## Prerequisites

- Azure CLI installed and configured
- PowerShell 5.1 or later
- Azure subscription with sufficient permissions
- Student account (for northcentralus region)

## Quick Start

1. **Clone the repository and navigate to the project directory**
   ```bash
   cd WealthArena_UI
   ```

2. **Run the master setup script**
   ```powershell
   .\azure_infrastructure\setup_master.ps1
   ```

3. **Verify all resources are created**
   ```powershell
   .\azure_infrastructure\verify_resources.ps1
   ```

4. **Set up database schemas**
   ```sql
   -- Run the SQL schema script in Azure SQL Database
   -- Use the connection string from the .env file
   ```

5. **Upload Databricks notebooks and create jobs**
   ```powershell
   .\azure_infrastructure\setup_databricks_jobs.ps1
   ```

6. **Deploy backend services**
   ```powershell
   # Build and deploy RAG chatbot
   docker build -t rag-chatbot ./azure_services/rag_chatbot_service/
   az acr login --name acrwealtharenadev
   docker tag rag-chatbot acrwealtharenadev.azurecr.io/rag-chatbot:latest
   docker push acrwealtharenadev.azurecr.io/rag-chatbot:latest
   
   # Deploy to Azure Container Apps
   az containerapp create \
     --name rag-chatbot \
     --resource-group rg-wealtharena-northcentralus \
     --environment cae-wealtharena-dev \
     --image acrwealtharenadev.azurecr.io/rag-chatbot:latest \
     --target-port 8000 \
     --ingress external
   ```

7. **Run integration tests**
   ```powershell
   .\azure_infrastructure\test_integration.ps1
   ```

## Detailed Setup Instructions

### 1. Azure Resource Provisioning

The `setup_master.ps1` script creates the following Azure resources:

#### Core Infrastructure
- **Resource Group**: `rg-wealtharena-northcentralus`
- **Location**: `northcentralus` (required for student accounts)

#### Data Storage
- **Azure SQL Database**: `wealtharena_db`
  - Server: `sql-wealtharena-dev.database.windows.net`
  - Admin: `wealtharena_admin`
  - Password: `WealthArena2024!`
- **Azure Cosmos DB**: `cosmos-wealtharena-dev`
  - API: Core (SQL)
  - Consistency: Session
- **Azure Storage Account**: `stwealtharenadev`
  - Containers: `raw-market-data`, `processed-features`, `rl-models`, `chatbot-vectors`, `user-uploads`

#### Compute & Analytics
- **Azure Databricks**: `databricks-wealtharena-dev`
  - Workspace URL: `https://adb-xxxxx.x.azuredatabricks.net`
  - Tier: Standard
- **Azure Container Registry**: `acrwealtharenadev`
- **Azure Container Apps Environment**: `cae-wealtharena-dev`

#### Security & Orchestration
- **Azure Key Vault**: `kv-wealtharena-dev`
  - Stores: Groq API key, database passwords, connection strings
- **Azure Data Factory**: `adf-wealtharena-dev`
  - For orchestrating Databricks jobs

### 2. Database Schema Setup

#### Azure SQL Database Schema
The `database_schemas/azure_sql_schema.sql` script creates:

**Market Data Tables:**
- `market_data_raw` - Raw market data from various sources
- `market_data_ohlcv` - Processed OHLCV data with returns and volatility
- `technical_indicators` - 50+ technical indicators (SMA, EMA, RSI, MACD, etc.)
- `rl_signals` - AI-generated trading signals
- `news_sentiment` - News sentiment analysis results

**User & Portfolio Tables:**
- `portfolios` - User portfolios
- `positions` - Portfolio positions
- `trades` - Trade history
- `game_sessions` - Game sessions
- `leaderboard_entries` - Leaderboard rankings

**Analytics Tables:**
- `feature_snapshots` - ML feature snapshots
- `model_performance` - Model performance tracking
- `chat_sessions` - Chat sessions
- `chat_messages` - Individual chat messages

#### Cosmos DB Collections
The `database_schemas/cosmos_collections.json` defines:

- `users` - User accounts and authentication
- `user_profiles` - Extended user profile information
- `user_settings` - Application settings and preferences
- `achievements` - User achievements and milestones
- `badges` - User badges and recognition
- `leaderboard` - Global and category leaderboards
- `game_sessions` - Game sessions and competitions
- `chat_sessions` - AI chatbot conversation sessions
- `notifications` - User notifications and alerts

### 3. Databricks Setup

#### Notebooks
The following notebooks are uploaded to Databricks:

1. **01_market_data_ingestion.py**
   - Downloads data from Yahoo Finance, Alpha Vantage, ASX
   - Stores raw data to ADLS Gen2
   - Loads processed data to Azure SQL

2. **02_feature_engineering.py**
   - Calculates 50+ technical indicators
   - Computes volatility estimators
   - Generates custom features

3. **03_news_sentiment.py**
   - Fetches news from RSS feeds
   - Performs sentiment analysis
   - Stores results to Azure SQL

4. **04_rl_environment.py**
   - Builds custom Gym trading environment
   - Defines observation and action spaces
   - Implements reward functions

5. **05_rl_agent_training.py**
   - Trains PPO agents using Stable-Baselines3
   - Logs experiments to MLflow
   - Saves models to ADLS Gen2

6. **06_rl_inference.py**
   - Generates daily trading signals
   - Calculates entry/exit prices
   - Stores signals to Azure SQL

7. **07_portfolio_optimization.py**
   - Implements mean-variance optimization
   - Calculates VaR/CVaR metrics
   - Ranks top trading setups

#### Jobs Schedule
- **Daily Market Data Ingestion**: 6:00 AM UTC
- **Feature Engineering**: 7:00 AM UTC
- **News Sentiment**: Every 4 hours
- **RL Signal Generation**: 8:00 AM UTC
- **Portfolio Optimization**: 8:30 AM UTC
- **RL Model Training**: Weekly (Sunday midnight)

### 4. Backend Services

#### RAG Chatbot Service
- **Framework**: FastAPI
- **LLM**: Groq API (Llama 3.1 70B)
- **Vector Database**: ChromaDB + Azure Cosmos DB
- **Endpoints**:
  - `POST /api/chat` - General chat
  - `POST /api/explain/signal/{id}` - Explain trading signal
  - `POST /api/explain/indicator/{name}` - Explain technical indicator
  - `POST /api/explain/trade/{id}` - Explain trade setup

#### Backend API Service
- **Framework**: FastAPI
- **Database**: Azure SQL + Cosmos DB
- **Storage**: Azure Blob Storage
- **Endpoints**:
  - Authentication: `/api/auth/signup`, `/api/auth/login`
  - User Profile: `/api/user/profile`, `/api/user/avatar`
  - Trading Signals: `/api/signals/top`, `/api/signals/{id}`
  - Portfolio: `/api/portfolio`
  - Game: `/api/game/start`, `/api/game/leaderboard`
  - Chat: `/api/chat` (proxies to RAG chatbot)

### 5. Environment Configuration

#### Required Environment Variables

**Azure Configuration:**
```bash
AZURE_RESOURCE_GROUP=rg-wealtharena-northcentralus
AZURE_LOCATION=northcentralus
AZURE_STORAGE_ACCOUNT=stwealtharenadev
AZURE_SQL_SERVER=sql-wealtharena-dev.database.windows.net
AZURE_SQL_DATABASE=wealtharena_db
AZURE_COSMOS_ENDPOINT=https://cosmos-wealtharena-dev.documents.azure.com:443/
```

**API Keys:**
```bash
GROQ_API_KEY=YOUR_GROQ_API_KEY
ALPHA_VANTAGE_KEY=your_alpha_vantage_key
```

**Service URLs:**
```bash
BACKEND_URL=https://wealtharena-backend-dev.azurecontainerapps.io
CHATBOT_URL=https://rag-chatbot-dev.azurecontainerapps.io
```

### 6. Deployment Commands

#### Deploy RAG Chatbot
```bash
# Build image
docker build -t rag-chatbot ./azure_services/rag_chatbot_service/

# Tag for Azure Container Registry
docker tag rag-chatbot acrwealtharenadev.azurecr.io/rag-chatbot:latest

# Push to registry
docker push acrwealtharenadev.azurecr.io/rag-chatbot:latest

# Deploy to Container Apps
az containerapp create \
  --name rag-chatbot \
  --resource-group rg-wealtharena-northcentralus \
  --environment cae-wealtharena-dev \
  --image acrwealtharenadev.azurecr.io/rag-chatbot:latest \
  --target-port 8000 \
  --ingress external \
  --env-vars GROQ_API_KEY=YOUR_GROQ_API_KEY
```

#### Deploy Backend API
```bash
# Build image
docker build -t wealtharena-backend ./azure_services/wealtharena_backend_api/

# Tag for Azure Container Registry
docker tag wealtharena-backend acrwealtharenadev.azurecr.io/wealtharena-backend:latest

# Push to registry
docker push acrwealtharenadev.azurecr.io/wealtharena-backend:latest

# Deploy to Container Apps
az containerapp create \
  --name wealtharena-backend \
  --resource-group rg-wealtharena-northcentralus \
  --environment cae-wealtharena-dev \
  --image acrwealtharenadev.azurecr.io/wealtharena-backend:latest \
  --target-port 8000 \
  --ingress external \
  --env-vars AZURE_SQL_SERVER=sql-wealtharena-dev.database.windows.net \
  --env-vars AZURE_SQL_DATABASE=wealtharena_db \
  --env-vars AZURE_SQL_USERNAME=wealtharena_admin \
  --env-vars AZURE_SQL_PASSWORD=WealthArena2024!
```

### 7. Testing

#### Run Integration Tests
```powershell
.\azure_infrastructure\test_integration.ps1 -BackendUrl "https://wealtharena-backend-dev.azurecontainerapps.io" -ChatbotUrl "https://rag-chatbot-dev.azurecontainerapps.io"
```

#### Test Individual Components
```powershell
# Test Azure resources
.\azure_infrastructure\verify_resources.ps1

# Test database connectivity
.\azure_infrastructure\test_connections.ps1
```

### 8. Monitoring and Maintenance

#### Azure Monitor
- Set up alerts for API failures
- Monitor database performance
- Track Databricks job execution

#### Log Analytics
- Application Insights for backend services
- Databricks job logs
- Azure SQL Database logs

#### Backup and Recovery
- Automated backups for Azure SQL Database
- Cosmos DB point-in-time recovery
- ADLS Gen2 versioning and lifecycle management

## Troubleshooting

### Common Issues

1. **Resource Creation Fails**
   - Check Azure subscription limits
   - Verify permissions for resource creation
   - Ensure northcentralus region is available

2. **Database Connection Issues**
   - Verify firewall rules allow Azure services
   - Check connection strings in environment variables
   - Ensure SQL Server is running

3. **Databricks Jobs Fail**
   - Check cluster configuration
   - Verify notebook paths
   - Review job dependencies

4. **API Services Not Responding**
   - Check Container Apps status
   - Verify environment variables
   - Review application logs

### Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Azure service logs
3. Run the integration test script
4. Check the generated test report

## Cost Optimization

### Student Account Considerations
- Use northcentralus region (free tier available)
- Monitor resource usage regularly
- Stop non-essential services when not in use
- Use appropriate VM sizes for Databricks clusters

### Resource Scaling
- Databricks clusters: Auto-scaling enabled
- Container Apps: Consumption plan
- SQL Database: Basic tier (upgrade as needed)
- Cosmos DB: Serverless mode

## Security Best Practices

1. **Secrets Management**
   - Store all secrets in Azure Key Vault
   - Use managed identities where possible
   - Rotate keys regularly

2. **Network Security**
   - Configure VNet integration
   - Use private endpoints for databases
   - Implement proper firewall rules

3. **Access Control**
   - Use Azure RBAC for resource access
   - Implement least privilege principle
   - Enable MFA for admin accounts

## Next Steps

After successful setup:

1. **Frontend Integration**
   - Update API URLs in frontend configuration
   - Test all frontend features
   - Deploy frontend to Azure Static Web Apps

2. **Data Pipeline**
   - Run initial data ingestion
   - Train first RL models
   - Generate initial trading signals

3. **User Onboarding**
   - Create test user accounts
   - Set up sample portfolios
   - Test game functionality

4. **Production Deployment**
   - Configure custom domains
   - Set up SSL certificates
   - Implement monitoring and alerting
