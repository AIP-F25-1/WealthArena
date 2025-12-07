# WealthArena Documentation Index

This index categorizes all documentation in the WealthArena project by purpose and component.

## Quick Links

- **Main README**: [README.md](../README.md) - Complete setup and getting started guide
- **Troubleshooting**: [chatbot/docs/TROUBLESHOOTING.md](../chatbot/docs/TROUBLESHOOTING.md) - Comprehensive troubleshooting guide
- **Progress Reports**: [PROGRESS_REPORT_TEMPLATE.md](../PROGRESS_REPORT_TEMPLATE.md) - Template for weekly reports

## Documentation by Category

### Setup & Getting Started

#### Main Setup Guides
- **[README.md](../README.md)** - Comprehensive setup guide (merged from multiple setup files)
  - Quick start instructions
  - Simplified setup (recommended for local development)
  - Full local setup (with database)
  - Data pipeline setup
  - Troubleshooting

#### Component-Specific Setup
- **[backend/README.md](../backend/README.md)** - Backend API setup and configuration
- **[frontend/README.md](../frontend/README.md)** - Frontend mobile app setup
- **[chatbot/README.md](../chatbot/README.md)** - Chatbot service setup and configuration
- **[rl-training/README.md](../rl-training/README.md)** - RL training setup and configuration

### Deployment

#### Deployment Guides
- **[docs/deployment/PHASE11_AZURE_DEPLOYMENT_GUIDE.md](deployment/PHASE11_AZURE_DEPLOYMENT_GUIDE.md)** - Azure cloud deployment (primary guide)
- **[docs/deployment/PHASE12_GCP_DEPLOYMENT_GUIDE.md](deployment/PHASE12_GCP_DEPLOYMENT_GUIDE.md)** - GCP deployment guide
- **[docs/deployment/AZURE_DEPLOYMENT_GUIDE.md](deployment/AZURE_DEPLOYMENT_GUIDE.md)** - General Azure deployment
- **[docs/deployment/AZURE_SETUP_GUIDE.md](deployment/AZURE_SETUP_GUIDE.md)** - Azure infrastructure setup
- **[docs/deployment/DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md)** - General deployment guide
- **[docs/deployment/PHASE13_AZURE_RESOURCE_CONFLICTS.md](deployment/PHASE13_AZURE_RESOURCE_CONFLICTS.md)** - Azure resource conflict resolution
- **[DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md)** - Deployment checklist

#### Component Deployment
- **[chatbot/DEPLOYMENT.md](../chatbot/DEPLOYMENT.md)** - Chatbot deployment guide
- **[backend/TROUBLESHOOTING.md](../backend/TROUBLESHOOTING.md)** - Backend deployment troubleshooting

### Troubleshooting

#### Main Troubleshooting Guide
- **[chatbot/docs/TROUBLESHOOTING.md](../chatbot/docs/TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide
  - Server issues
  - Port conflicts
  - Dependency issues
  - ChromaDB/Vector store issues
  - Testing issues
  - Data pipeline issues
  - API and connection issues
  - Azure App Service issues
  - **GroQ API troubleshooting** (merged from CHATBOT_GROQ_TROUBLESHOOTING.md and FIX_GROQ_MODEL.md)

#### Component-Specific Troubleshooting
- **[backend/TROUBLESHOOTING.md](../backend/TROUBLESHOOTING.md)** - Backend troubleshooting
- **[backend/TROUBLESHOOTING_DATABASE.md](../backend/TROUBLESHOOTING_DATABASE.md)** - Database troubleshooting

### API Documentation

#### API References
- **[docs/api/API_REFERENCE.md](api/API_REFERENCE.md)** - Backend API reference
- **[docs/api/CHATBOT_API.md](api/CHATBOT_API.md)** - Chatbot API reference
- **[docs/api/RL_SERVICE_API.md](api/RL_SERVICE_API.md)** - RL Service API reference

### Architecture & Design

#### Architecture Documentation
- **[docs/architecture/Overall Architecture.txt](architecture/Overall%20Architecture.txt)** - Overall system architecture
- **[docs/DATA_FLOW_EXPLANATION.md](DATA_FLOW_EXPLANATION.md)** - Data flow explanation
- **[docs/DATA_PIPELINE_FLOW.md](DATA_PIPELINE_FLOW.md)** - Data pipeline flow

### Data Pipeline

#### Data Pipeline Guides
- **[DATA_PIPELINE_MASTER_PLAN.md](../DATA_PIPELINE_MASTER_PLAN.md)** - Data pipeline master plan
- **[LIVE_DATA_INTEGRATION.md](../LIVE_DATA_INTEGRATION.md)** - Live data integration summary
- **[docs/PHASE3_AIRFLOW_SETUP_GUIDE.md](PHASE3_AIRFLOW_SETUP_GUIDE.md)** - Airflow setup guide
- **[docs/PHASE3_DATABRICKS_SETUP_GUIDE.md](PHASE3_DATABRICKS_SETUP_GUIDE.md)** - Databricks setup guide

### Testing

#### Testing Guides
- **[backend/TESTING_GUIDE.md](../backend/TESTING_GUIDE.md)** - Backend testing guide
- **[docs/testing/PHASE13_END_TO_END_TESTING_PLAN.md](testing/PHASE13_END_TO_END_TESTING_PLAN.md)** - End-to-end testing plan
- **[docs/testing/PHASE3_PIPELINE_TESTING_GUIDE.md](testing/PHASE3_PIPELINE_TESTING_GUIDE.md)** - Pipeline testing guide

### Metrics & Monitoring

#### Metrics Documentation
- **[docs/METRICS_COLLECTION.md](METRICS_COLLECTION.md)** - Metrics collection guide
- **[PROGRESS_REPORT_TEMPLATE.md](../PROGRESS_REPORT_TEMPLATE.md)** - Progress report template
- **[PROGRESS_REPORT_METRICS.md](../PROGRESS_REPORT_METRICS.md)** - Latest progress report metrics

### Azure Infrastructure

#### Azure Guides
- **[docs/AZURE_CONTAINER_APPS_GUIDE.md](AZURE_CONTAINER_APPS_GUIDE.md)** - Azure Container Apps guide
- **[docs/deployment/AZURE_SETUP_GUIDE.md](deployment/AZURE_SETUP_GUIDE.md)** - Azure setup guide

### Chatbot & RAG

#### Chatbot Documentation
- **[chatbot/docs/RAG_PIPELINE.md](../chatbot/docs/RAG_PIPELINE.md)** - RAG pipeline documentation
- **[chatbot/docs/TROUBLESHOOTING.md](../chatbot/docs/TROUBLESHOOTING.md)** - Chatbot troubleshooting (includes GroQ API issues)

## Archived Documentation

Historical documentation from previous development phases has been moved to the `archive/` directory at the root level. See [archive/INDEX.md](../archive/INDEX.md) for a complete list of archived files.

**Note**: Archived files are kept for historical reference but are no longer actively maintained. For current setup and troubleshooting, refer to the main README.md and component-specific documentation.

## Documentation Structure

```
WealthArena/
├── README.md                          # Main setup guide (consolidated)
├── DEPLOYMENT_CHECKLIST.md            # Deployment checklist
├── DATA_PIPELINE_MASTER_PLAN.md       # Data pipeline plan
├── LIVE_DATA_INTEGRATION.md           # Live data integration
├── PROGRESS_REPORT_TEMPLATE.md        # Progress report template
├── PROGRESS_REPORT_METRICS.md        # Latest metrics
├── archive/                           # Archived documentation
│   ├── INDEX.md                       # Archive index
│   ├── ARCHIVE/                       # Old docs/ARCHIVE content
│   └── automation_logs/               # Archived automation logs
├── backend/
│   ├── README.md                      # Backend setup
│   ├── TESTING_GUIDE.md               # Backend testing
│   └── TROUBLESHOOTING.md             # Backend troubleshooting
├── frontend/
│   └── README.md                      # Frontend setup
├── chatbot/
│   ├── README.md                      # Chatbot setup
│   └── docs/
│       ├── TROUBLESHOOTING.md         # Comprehensive troubleshooting
│       └── RAG_PIPELINE.md            # RAG pipeline
├── rl-training/
│   └── README.md                      # RL training setup
└── docs/
    ├── INDEX.md                       # This file
    ├── api/                           # API documentation
    ├── architecture/                  # Architecture docs
    ├── deployment/                    # Deployment guides
    ├── testing/                       # Testing guides
    └── METRICS_COLLECTION.md          # Metrics guide
```

## Finding Documentation

### By Task

- **Setting up locally**: Start with [README.md](../README.md)
- **Deploying to Azure**: See [docs/deployment/PHASE11_AZURE_DEPLOYMENT_GUIDE.md](deployment/PHASE11_AZURE_DEPLOYMENT_GUIDE.md)
- **Troubleshooting issues**: See [chatbot/docs/TROUBLESHOOTING.md](../chatbot/docs/TROUBLESHOOTING.md)
- **Understanding APIs**: See [docs/api/](api/)
- **Setting up data pipeline**: See [DATA_PIPELINE_MASTER_PLAN.md](../DATA_PIPELINE_MASTER_PLAN.md)
- **Writing progress reports**: Use [PROGRESS_REPORT_TEMPLATE.md](../PROGRESS_REPORT_TEMPLATE.md)

### By Component

- **Backend**: [backend/README.md](../backend/README.md), [backend/TROUBLESHOOTING.md](../backend/TROUBLESHOOTING.md)
- **Frontend**: [frontend/README.md](../frontend/README.md)
- **Chatbot**: [chatbot/README.md](../chatbot/README.md), [chatbot/docs/TROUBLESHOOTING.md](../chatbot/docs/TROUBLESHOOTING.md)
- **RL Training**: [rl-training/README.md](../rl-training/README.md)
- **RL Service**: [rl-service/README.md](../rl-service/README.md), [rl-service/TESTING_GUIDE.md](../rl-service/TESTING_GUIDE.md)

## Contributing to Documentation

When adding new documentation:

1. **Place it in the appropriate location**:
   - Component-specific docs: In the component directory (e.g., `backend/`, `chatbot/`)
   - General docs: In `docs/` directory
   - Setup guides: Update main `README.md` if applicable

2. **Update this index** if adding a new category or major document

3. **Follow naming conventions**:
   - Use descriptive names
   - Use UPPERCASE for important guides (e.g., `TROUBLESHOOTING.md`)
   - Use lowercase with hyphens for general docs (e.g., `deployment-guide.md`)

4. **Link from relevant places**:
   - Add links in component READMEs
   - Update main README.md if it's a setup-related doc
   - Update this index

## Last Updated

This index was last updated: 2025-01-XX

