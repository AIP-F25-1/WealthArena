# Deployment Checklist

## Prerequisites
- [ ] Azure account or GCP account
- [ ] Azure CLI / gcloud CLI
- [ ] Node.js 18+, Python 3.8+
- [ ] **Install ODBC Driver 18 for SQL Server** (Required for data pipeline)
  - Windows: `winget install --id Microsoft.msodbcsql.18 -e`
  - Verify: Open `odbcad32.exe` and check Drivers tab
  - Download: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
  - Note: Must match Python bitness (64-bit Python → 64-bit driver)
- [ ] Git
- [ ] 10GB+ free disk space

## Phase 1: Infrastructure (30 min)
- [ ] Run infrastructure setup scripts
- [ ] Verify resources created
- [ ] Test connectivity

## Phase 2: Database (15 min)
- [ ] Deploy schema
- [ ] Verify tables created
- [ ] Test queries

## Phase 3: Environment Config (10 min)
- [ ] Generate .env files
- [ ] Store secrets in Key Vault
- [ ] Review configurations

## Phase 4: Market Data (2-4 hours, optional)
- [ ] Download market data
- [ ] Process and store
- [ ] Export to RL training

## Phase 5: RL Training (4-8 hours, optional)
- [ ] Train models
- [ ] Verify win rates
- [ ] Deploy checkpoints

## Phase 6: Local Testing (30 min)
- [ ] Start all services
- [ ] Test endpoints
- [ ] Verify frontend connection

## Phase 7: Cloud Deployment (40-60 min)
- [ ] Deploy services
- [ ] Upload models
- [ ] Configure settings
- [ ] Run health checks

## Phase 8: Frontend Config (10 min)
- [ ] Update .env for cloud
- [ ] Test with cloud backend

## Phase 9: End-to-End Testing (2-3 hours)
- [ ] Test user journeys
- [ ] Document bugs

## Phase 10: APK Build (30 min, optional)
- [ ] Build Android APK
- [ ] Test on device

## Phase 11: Production Readiness (1 hour)
- [ ] Review .gitignore
- [ ] Verify no secrets
- [ ] Final verification

## Success Criteria
- [ ] All services healthy
- [ ] Database populated
- [ ] Frontend connects
- [ ] No secrets in repo
- [ ] Documentation complete

Estimated Time: 11-19 hours

## Common Issues

### Issue: Phase 3 fails with "Data source name not found"
- **Cause**: ODBC Driver 18 for SQL Server not installed
- **Solution**: Install driver using winget or MSI installer, restart terminal
- **Verification**: Run `odbcad32.exe` and confirm driver appears in list
