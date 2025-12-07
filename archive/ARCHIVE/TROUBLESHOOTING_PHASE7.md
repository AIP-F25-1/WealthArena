# Phase 7 Troubleshooting Guide

This guide provides step-by-step troubleshooting for all Phase 7 deployment issues.

## Common Issues Overview

Phase 7 deployment failures typically fall into three main categories:

| Issue Category | Symptoms | Quick Solution |
|---------------|----------|----------------|
| **Database Connection Failure** | "getaddrinfo ENOTFOUND", "Failed to connect to sql-wealtharena-*.database.windows.net" | Run `diagnose_database_connectivity.ps1` |
| **Key Vault Access Denied** | "Failed to retrieve DB password from Key Vault", "Failed to retrieve GROQ API key" | Run `fix_keyvault_permissions.ps1` |
| **JSON Parsing Errors** | "Invalid JSON primitive: ERROR", script crashes on ConvertFrom-Json | Should be fixed in updated scripts |

---

## Issue 1: Database Connection Failure ("getaddrinfo ENOTFOUND")

### Symptoms

- Backend logs show: `Failed to connect to sql-wealtharena-*.database.windows.net`
- Error: `getaddrinfo ENOTFOUND sql-wealtharena-*.database.windows.net`
- Backend container starts but database is disconnected

### Root Causes

1. SQL Server doesn't exist
2. Wrong SQL Server name
3. Firewall rules don't allow Azure services
4. Network connectivity issues
5. Database doesn't exist

### Diagnosis

Run the diagnostic script:

```powershell
.\diagnose_database_connectivity.ps1 -ResourceGroup rg-wealtharena-northcentralus
```

This will check:
- SQL Server existence
- DNS resolution
- Firewall rules
- Network connectivity
- Database existence

### Solutions

#### Solution 1: Create SQL Server (if missing)

```powershell
az sql server create `
    --name sql-wealtharena-northcentralus `
    --resource-group rg-wealtharena-northcentralus `
    --location northcentralus `
    --admin-user wealtharena_admin `
    --admin-password <your-password>
```

#### Solution 2: Add Firewall Rule for Azure Services

```powershell
az sql server firewall-rule create `
    --server sql-wealtharena-northcentralus `
    --resource-group rg-wealtharena-northcentralus `
    --name AllowAllWindowsAzureIps `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0
```

This is **required** for Container Apps to connect to SQL Server.

#### Solution 3: Create Database (if missing)

```powershell
az sql db create `
    --name wealtharena_db `
    --server sql-wealtharena-northcentralus `
    --resource-group rg-wealtharena-northcentralus `
    --service-objective S0
```

#### Solution 4: Run Infrastructure Setup

If multiple resources are missing, run the infrastructure setup:

```powershell
.\setup_master.ps1 -Phase 6
```

Or run the full automation:

```powershell
.\master_automation.ps1 -Phase 6
```

---

## Issue 2: Key Vault Access Denied

### Symptoms

- "Failed to retrieve DB password from Key Vault"
- "Failed to retrieve GROQ API key"
- "Access denied" errors when deploying services

### Root Causes

1. No access policy for your user
2. Wrong Key Vault name
3. Secrets don't exist in Key Vault
4. RBAC-based Key Vault (no access policy)

### Diagnosis

Test Key Vault access:

```powershell
az keyvault secret list --vault-name kv-wealtharena-northcentralus
```

If this fails with "Access denied", you need to fix permissions.

### Solutions

#### Solution 1: Run Fix Script (Recommended)

```powershell
.\fix_keyvault_permissions.ps1 -ResourceGroup rg-wealtharena-northcentralus
```

This script will:
- Auto-detect your Azure user
- Grant access policy permissions (if supported)
- Grant RBAC permissions (if access policy fails)
- Verify permissions work

#### Solution 2: Manual Access Policy

Get your user email:

```powershell
az account show --query user.name -o tsv
```

Grant permissions:

```powershell
az keyvault set-policy `
    --name kv-wealtharena-northcentralus `
    --upn <your-email> `
    --secret-permissions get list
```

#### Solution 3: RBAC Permissions

If Key Vault uses RBAC instead of access policies:

```powershell
# Get Key Vault resource ID
$kvId = az keyvault show --name kv-wealtharena-northcentralus --resource-group rg-wealtharena-northcentralus --query id -o tsv

# Grant RBAC role
az role assignment create `
    --role "Key Vault Secrets User" `
    --assignee <your-email> `
    --scope $kvId
```

#### Solution 4: Create Missing Secrets

If secrets don't exist, create them:

```powershell
# Create SQL password secret
az keyvault secret set `
    --vault-name kv-wealtharena-northcentralus `
    --name sql-password `
    --value <your-db-password>

# Create GROQ API key secret
az keyvault secret set `
    --vault-name kv-wealtharena-northcentralus `
    --name groq-api-key `
    --value <your-groq-api-key>
```

---

## Issue 3: JSON Parsing Errors ("Invalid JSON primitive: ERROR")

### Symptoms

- Script crashes with: `Invalid JSON primitive: ERROR`
- Error occurs during `ConvertFrom-Json` calls
- Deployment script fails immediately

### Root Causes

- Azure CLI command failed but script tried to parse error message as JSON
- This was a bug in deployment scripts (now fixed)

### Solutions

This issue should be **fixed** in the updated deployment scripts. The scripts now:

1. Check `$LASTEXITCODE` before parsing JSON
2. Only parse JSON if command succeeded
3. Handle errors gracefully without crashing

If you still see this error:

1. **Update scripts**: Ensure you're using the latest version of deployment scripts
2. **Check command output**: The error message will show which command failed
3. **Fix underlying issue**: Usually Key Vault access or missing resource

### Verification

The fix is verified by checking that scripts:
- Don't crash on Azure CLI errors
- Display clear error messages
- Provide actionable guidance

---

## Pre-deployment Checklist

Before starting Phase 7, verify:

1. **Infrastructure exists**: Run `verify_infrastructure.ps1`
   ```powershell
   .\verify_infrastructure.ps1 -ResourceGroup rg-wealtharena-northcentralus
   ```

2. **Docker Desktop is running** (for Container Apps):
   ```powershell
   docker ps
   ```

3. **Azure CLI is logged in**:
   ```powershell
   az account show
   ```

4. **Infrastructure setup completed**: Verify Phase 6 or `setup_master.ps1` ran successfully

---

## Manual Recovery Steps

If deployment partially completed:

### 1. Check Current State

```powershell
# List Container Apps
az containerapp list --resource-group rg-wealtharena-northcentralus

# Check Container App status
az containerapp show --name wealtharena-backend --resource-group rg-wealtharena-northcentralus
```

### 2. Clean Up Partial Deployment (if needed)

```powershell
# Delete Container Apps
az containerapp delete --name wealtharena-backend --resource-group rg-wealtharena-northcentralus --yes
az containerapp delete --name wealtharena-chatbot --resource-group rg-wealtharena-northcentralus --yes
az containerapp delete --name wealtharena-rl --resource-group rg-wealtharena-northcentralus --yes
```

### 3. Manually Configure Environment Variables

If Container App exists but configuration is wrong:

```powershell
# Update environment variables
az containerapp update `
    --name wealtharena-backend `
    --resource-group rg-wealtharena-northcentralus `
    --set-env-vars "DB_HOST=sql-wealtharena-northcentralus.database.windows.net" "DB_NAME=wealtharena_db" "DB_USER=wealtharena_admin"
```

### 4. Update Secrets in Container App

```powershell
# Set secrets
az containerapp secret set `
    --name wealtharena-backend `
    --resource-group rg-wealtharena-northcentralus `
    --secrets "db-password=<password>" "jwt-secret=<secret>"
```

---

## Reference Commands

### Check Container App Logs

```powershell
# View logs
az containerapp logs show `
    --name wealtharena-backend `
    --resource-group rg-wealtharena-northcentralus `
    --follow

# Last 100 lines
az containerapp logs show `
    --name wealtharena-backend `
    --resource-group rg-wealtharena-northcentralus `
    --tail 100
```

### Restart Container App

```powershell
az containerapp revision restart `
    --name wealtharena-backend `
    --resource-group rg-wealtharena-northcentralus `
    --revision <revision-name>
```

### Update Environment Variables

```powershell
az containerapp update `
    --name wealtharena-backend `
    --resource-group rg-wealtharena-northcentralus `
    --set-env-vars "KEY1=value1" "KEY2=value2"
```

### Get Service URLs

```powershell
# Get backend URL
az containerapp show `
    --name wealtharena-backend `
    --resource-group rg-wealtharena-northcentralus `
    --query properties.configuration.ingress.fqdn -o tsv

# Get all service URLs
az containerapp list `
    --resource-group rg-wealtharena-northcentralus `
    --query "[].{Name:name, URL:properties.configuration.ingress.fqdn}" -o table
```

### Test Health Endpoints

```powershell
# Test backend health
$backendUrl = az containerapp show --name wealtharena-backend --resource-group rg-wealtharena-northcentralus --query properties.configuration.ingress.fqdn -o tsv
Invoke-WebRequest -Uri "https://$backendUrl/health" -UseBasicParsing

# Test chatbot health
$chatbotUrl = az containerapp show --name wealtharena-chatbot --resource-group rg-wealtharena-northcentralus --query properties.configuration.ingress.fqdn -o tsv
Invoke-WebRequest -Uri "https://$chatbotUrl/health" -UseBasicParsing
```

---

## Getting Help

If issues persist:

1. **Check logs**: Review Container App logs for detailed error messages
2. **Verify infrastructure**: Run `verify_infrastructure.ps1` to check all resources
3. **Diagnose database**: Run `diagnose_database_connectivity.ps1` for SQL issues
4. **Fix permissions**: Run `fix_keyvault_permissions.ps1` for Key Vault issues
5. **Review automation logs**: Check `automation_logs/` directory for phase logs

---

## Quick Reference: Error to Solution Mapping

| Error Message | Solution |
|--------------|----------|
| `getaddrinfo ENOTFOUND sql-wealtharena-*.database.windows.net` | Run `diagnose_database_connectivity.ps1` |
| `Failed to retrieve DB password from Key Vault` | Run `fix_keyvault_permissions.ps1` |
| `Failed to retrieve GROQ API key` | Run `fix_keyvault_permissions.ps1` |
| `Invalid JSON primitive: ERROR` | Should be fixed - check script version |
| `Access denied` (Key Vault) | Run `fix_keyvault_permissions.ps1` |
| `Resource group not found` | Run `setup_master.ps1` Phase 6 |
| `SQL Server not found` | Create SQL Server or run Phase 6 |
| `Key Vault not found` | Create Key Vault or run Phase 6 |

---

## Additional Resources

- **Azure Container Apps Documentation**: https://docs.microsoft.com/en-us/azure/container-apps/
- **Azure SQL Database Documentation**: https://docs.microsoft.com/en-us/azure/azure-sql/
- **Azure Key Vault Documentation**: https://docs.microsoft.com/en-us/azure/key-vault/

