# Configuration Consolidation Migration Guide

This document describes the configuration consolidation that was performed to reduce duplication and improve maintainability across the WealthArena project.

## Changes Summary

### 1. SonarQube Configuration Consolidation

**Before:**
- 6 separate `sonar-project.properties` files in:
  - Root
  - `backend/`
  - `frontend/`
  - `chatbot/`
  - `rl-training/`
  - `rl-service/`
  - `data-pipeline/`

**After:**
- Root `sonar-project.properties` - Master configuration for entire project
- `sonar/` directory with service-specific override files:
  - `sonar/backend.properties`
  - `sonar/frontend.properties`
  - `sonar/chatbot.properties`
  - `sonar/rl-training.properties`
  - `sonar/rl-service.properties`
  - `sonar/data-pipeline.properties`

**Usage:**
```bash
# Analyze entire project
sonar-scanner

# Analyze specific service
sonar-scanner -Dproject.settings=sonar/backend.properties
```

**Action Required:**
- Old service-specific `sonar-project.properties` files can be removed (they're now in `sonar/` directory)
- Update any scripts that reference old paths

### 2. Environment Variables Consolidation

**Before:**
- Multiple `.env.example` files scattered across services:
  - `backend/env.example`
  - `data-pipeline/sqlDB.env.example`
  - `data-pipeline/azureCred.env.example`
  - Service-specific env files

**After:**
- Root `.env.example` - Master template with all environment variables
  - Organized by service with clear sections
  - Documents which variables are required for which services
  - Includes usage notes and prerequisites

**Action Required:**
- Services can still use service-specific `.env` files if needed
- Old `.env.example` files can be removed (all variables documented in root `.env.example`)
- Copy root `.env.example` to `.env` and fill in your values

### 3. Docker Compose Consolidation

**Before:**
- Multiple `docker-compose.yml` files:
  - `chatbot/docker-compose.yml`
  - `ml-infra/config/docker-compose.yml`

**After:**
- Root `docker-compose.yml` - Master orchestration file
  - Defines all services: chatbot, backend, rl-service, prometheus, grafana
  - Uses shared network (`wealtharena-network`)
  - Loads environment variables from root `.env` and service-specific `.env` files

**Action Required:**
- Old service-specific `docker-compose.yml` files are deprecated but kept for reference
- Use root `docker-compose.yml` for all services (recommended)
- Service-specific files (`chatbot/docker-compose.yml`, `ml-infra/config/docker-compose.yml`) can be removed if not needed
- Service-specific overrides can use `docker-compose.override.yml`
- To run only specific services, use: `docker-compose up -d [service-name]` from root

### 4. Automation Configuration Consolidation

**Before:**
- Root-level automation files:
  - `automation_config.yaml`
  - `automation_config.example.yaml`
  - `automation_state.json`

**After:**
- `config/automation_config.yaml` - Runtime configuration (gitignored)
- `config/automation_config.example.yaml` - Template (committed)
- `automation_state.json` - Runtime state (remains at root, gitignored)

**Action Required:**
- Scripts have been updated to use `config/automation_config.yaml`
- If you have a local `automation_config.yaml`, move it to `config/automation_config.yaml`
- Copy `config/automation_config.example.yaml` to `config/automation_config.yaml` if needed

### 5. Configuration Directory Structure

**New Structure:**
```
config/
├── README.md                      # Configuration guide
├── automation_config.yaml         # Runtime config (gitignored)
└── automation_config.example.yaml # Template (committed)

sonar/
├── backend.properties
├── frontend.properties
├── chatbot.properties
├── rl-training.properties
├── rl-service.properties
└── data-pipeline.properties

root/
├── sonar-project.properties       # Master SonarQube config
├── .env.example                   # Master environment template
├── docker-compose.yml             # Master Docker Compose
└── automation_state.json          # Runtime state (gitignored)
```

## Migration Steps

### For Existing Developers

1. **Update Automation Config Path:**
   ```powershell
   # If you have automation_config.yaml at root, move it
   Move-Item automation_config.yaml config/automation_config.yaml -Force
   ```

2. **Update Environment Variables:**
   ```powershell
   # Review root .env.example for all available variables
   # Update your .env files as needed
   ```

3. **Update Docker Usage:**
   ```bash
   # Use root docker-compose.yml instead of service-specific files
   docker-compose up -d
   ```

4. **Update SonarQube Scans:**
   ```bash
   # Use root config for full project analysis
   sonar-scanner
   
   # Or use service-specific overrides
   sonar-scanner -Dproject.settings=sonar/backend.properties
   ```

### For New Setup

1. **Copy Environment Template:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Copy Automation Config:**
   ```bash
   cp config/automation_config.example.yaml config/automation_config.yaml
   # Edit config/automation_config.yaml with your settings
   ```

3. **Start Services:**
   ```bash
   docker-compose up -d
   ```

## Script Updates

The following scripts have been updated to use the new paths:

- `master_automation.ps1` - Now uses `config/automation_config.yaml`
- `quick_deploy.ps1` - Now uses `config/automation_config.yaml`

## Files That Can Be Removed

After verifying everything works, you can safely remove:

- `backend/sonar-project.properties` (use `sonar/backend.properties`)
- `frontend/sonar-project.properties` (use `sonar/frontend.properties`)
- `rl-training/sonar-project.properties` (use `sonar/rl-training.properties`)
- `rl-service/sonar-project.properties` (use `sonar/rl-service.properties`)
- `data-pipeline/sonar-project.properties` (use `sonar/data-pipeline.properties`)
- `chatbot/docker-compose.yml` (use root `docker-compose.yml`)
- `ml-infra/config/docker-compose.yml` (services now in root `docker-compose.yml`)

**Note:** Keep service-specific `.env.example` files if they contain unique documentation, but all variables are now in root `.env.example`.

## Verification

After migration, verify:

1. ✅ Automation scripts can find `config/automation_config.yaml`
2. ✅ Docker Compose can start all services
3. ✅ SonarQube scans work with new configuration
4. ✅ Environment variables load correctly for all services

## Documentation

See `config/README.md` for detailed configuration documentation including:
- Configuration hierarchy
- Service-specific requirements
- Troubleshooting guide
- Best practices

## Questions?

If you encounter issues during migration:
1. Check `config/README.md` for detailed documentation
2. Review service-specific README files
3. Check troubleshooting section in `config/README.md`

