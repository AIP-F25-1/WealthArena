# WealthArena Configuration Guide

This directory contains consolidated configuration files for the WealthArena project. This guide explains the configuration hierarchy and which files are used where.

## Directory Structure

```
config/
├── README.md                      # This file
├── automation_config.yaml         # Runtime automation configuration (gitignored)
└── automation_config.example.yaml # Template for automation configuration

sonar/
├── backend.properties             # SonarQube config for backend service
├── frontend.properties            # SonarQube config for frontend service
├── chatbot.properties             # SonarQube config for chatbot service
├── rl-training.properties         # SonarQube config for RL training
├── rl-service.properties          # SonarQube config for RL service
└── data-pipeline.properties       # SonarQube config for data pipeline

root/
├── sonar-project.properties       # Master SonarQube configuration
├── .env.example                   # Master environment variables template
└── docker-compose.yml             # Master Docker Compose configuration
```

## Configuration Files Overview

### 1. SonarQube Configuration

**Root Configuration:**
- `sonar-project.properties` - Master configuration for the entire WealthArena project
  - Contains common settings shared across all services
  - Defines project-wide exclusions, encoding, and quality gates
  - Used for analyzing the entire codebase

**Service-Specific Overrides:**
- `sonar/backend.properties` - Backend (Node.js/TypeScript) specific settings
- `sonar/frontend.properties` - Frontend (React Native/TypeScript) specific settings
- `sonar/chatbot.properties` - Chatbot (Python/FastAPI) specific settings
- `sonar/rl-training.properties` - RL Training (Python) specific settings
- `sonar/rl-service.properties` - RL Service (Python/Flask) specific settings
- `sonar/data-pipeline.properties` - Data Pipeline (Python) specific settings

**Usage:**
```bash
# Analyze entire project
sonar-scanner

# Analyze specific service
sonar-scanner -Dproject.settings=sonar/backend.properties
```

### 2. Environment Variables

**Master Template:**
- `.env.example` (root) - Comprehensive template with all environment variables
  - Organized by service with clear sections
  - Documents which variables are required for which services
  - Includes usage notes and prerequisites

**Service-Specific Files:**
- Services can use either:
  - Root `.env` file (shared configuration)
  - Service-specific `.env` files (e.g., `backend/.env`, `chatbot/.env`)
  - Both (service-specific overrides root)

**Service Requirements:**

| Service | Required Variables | Optional Variables |
|---------|-------------------|-------------------|
| **Backend** | `USE_MOCK_DB=true` (for local dev) | `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `OPENAI_API_KEY`, `ALPHA_VANTAGE_API_KEY` |
| **Chatbot** | `GROQ_API_KEY` | `GROQ_MODEL`, `CHROMA_PERSIST_DIR`, `PDF_INGEST_INTERVAL_HOURS` |
| **Data Pipeline** | `SQL_SERVER`, `SQL_DB`, `SQL_UID`, `SQL_PWD`, `AZURE_STORAGE_CONNECTION_STRING` | `BATCH_ROWS`, `MERGE_EVERY_ROWS` |
| **RL Training** | (Most config in YAML files) | Environment variable overrides |
| **RL Service** | `DB_TYPE`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `MODEL_PATH`, `MODEL_MODE`, `PORT`, `HOST` | `LOG_LEVEL`, `GCS_BUCKET`, `GCS_MODEL_PREFIX`, `AZURE_STORAGE_CONNECTION_STRING`, `DB_ENCRYPT`, `SQL_DRIVER` |
| **Frontend** | `BACKEND_API_URL`, `CHATBOT_API_URL` | `RL_SERVICE_API_URL` |

**Setup:**
```bash
# Copy template
cp .env.example .env

# Edit with your values
# Services will automatically load from root .env or service-specific .env
```

### 3. Docker Compose Configuration

**Master Configuration:**
- `docker-compose.yml` (root) - Orchestrates all WealthArena services
  - Defines all services: chatbot, backend, rl-service, prometheus, grafana
  - Uses shared network (`wealtharena-network`)
  - Loads environment variables from root `.env` and service-specific `.env` files

**Service-Specific Overrides:**
- `docker-compose.override.yml` (optional) - Local development overrides
- Service-specific compose files can be created if needed

**Legacy Service-Specific Files (Deprecated):**
The following service-specific Docker Compose files exist but are **deprecated** in favor of the root `docker-compose.yml`:
- `chatbot/docker-compose.yml` - Standalone chatbot service (use root file instead)
- `ml-infra/config/docker-compose.yml` - Standalone monitoring stack (use root file instead)

These files are kept for reference but should not be used for normal operations. The root `docker-compose.yml` orchestrates all services including monitoring. If you need to run only specific services, use:
```bash
# Run only specific services from root compose file
docker-compose up -d chatbot backend
docker-compose up -d prometheus grafana  # Monitoring only
```

**Usage:**
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d chatbot

# View logs
docker-compose logs -f chatbot

# Stop all services
docker-compose down
```

### 4. Automation Configuration

**Configuration Files:**
- `config/automation_config.example.yaml` - Template for automation settings
  - Contains all configurable options with documentation
  - Includes example scenarios (MVP mode, quick deployment, etc.)
  - **This file should be committed to version control**

- `config/automation_config.yaml` - Runtime automation configuration
  - Copy from `automation_config.example.yaml` and customize
  - Contains actual values for your environment
  - **This file should NOT be committed (gitignored)**

**State File:**
- `automation_state.json` (root) - Runtime automation state
  - Tracks automation progress, completed phases, service URLs
  - Generated automatically by automation scripts
  - **This file should NOT be committed (gitignored)**

**Setup:**
```bash
# Copy template
cp config/automation_config.example.yaml config/automation_config.yaml

# Edit with your settings
# Automation scripts will use this file
```

## Configuration Hierarchy

### Priority Order (Highest to Lowest)

1. **Service-specific files** (e.g., `backend/.env`, `chatbot/docker-compose.yml`)
2. **Root-level files** (e.g., `.env`, `docker-compose.yml`)
3. **Default values** (hardcoded in application code)

### Best Practices

1. **Shared Configuration**: Use root-level files (`.env`, `docker-compose.yml`) for common settings
2. **Service-Specific Overrides**: Use service-specific files only when needed
3. **Templates**: Always copy from `.example` files, never commit actual secrets
4. **Documentation**: Keep this README updated when adding new configuration files
5. **Version Control**: 
   - ✅ Commit: `.example` files, templates, documentation
   - ❌ Never commit: `.env`, `automation_config.yaml`, `automation_state.json`, secrets

## Migration from Old Structure

If you're migrating from the old structure:

1. **SonarQube**: Old service-specific `sonar-project.properties` files have been consolidated
   - Old files can be removed (they're now in `sonar/` directory)
   - Use root `sonar-project.properties` for full project analysis
   - Use `sonar/*.properties` for service-specific analysis

2. **Environment Variables**: Old service-specific `.env.example` files can be removed
   - All variables are now documented in root `.env.example`
   - Services can still use service-specific `.env` files if needed

3. **Docker Compose**: Old service-specific `docker-compose.yml` files can be removed
   - All services are now in root `docker-compose.yml`
   - Service-specific overrides can use `docker-compose.override.yml`

4. **Automation Configs**: Moved to `config/` directory
   - `automation_config.yaml` → `config/automation_config.yaml`
   - `automation_config.example.yaml` → `config/automation_config.example.yaml`
   - `automation_state.json` remains at root (runtime state, gitignored)

## Troubleshooting

### SonarQube Analysis Fails
- Check that you're using the correct properties file for your service
- Verify paths in `sonar.sources` and `sonar.tests` are correct
- Ensure service-specific overrides extend root config properly

### Environment Variables Not Loading
- Check file location (root `.env` vs service-specific `.env`)
- Verify variable names match exactly (case-sensitive)
- Check for typos in variable names
- Ensure `.env` file is not gitignored (but don't commit secrets!)

### Docker Compose Issues
- Verify all service Dockerfiles exist
- Check port conflicts (services may use same ports)
- Ensure environment variables are set correctly
- Check network connectivity between services

### Automation Script Errors
- Verify `config/automation_config.yaml` exists and is valid YAML
- Check that all required fields are set
- Review `automation_state.json` for previous state issues
- Ensure Azure credentials are configured correctly

## Additional Resources

- [Backend Configuration Guide](../backend/README.md)
- [Chatbot Configuration Guide](../chatbot/README.md)
- [Data Pipeline Setup](../data-pipeline/SETUP_INSTRUCTIONS.md)
- [RL Training Configuration](../rl-training/README.md)
- [Deployment Guide](../DEPLOYMENT_CHECKLIST.md)

## Questions?

If you have questions about configuration:
1. Check service-specific README files
2. Review example configurations
3. Check troubleshooting section above
4. Consult team documentation or raise an issue

