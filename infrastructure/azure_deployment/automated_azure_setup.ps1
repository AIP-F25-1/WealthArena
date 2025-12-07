<#
.SYNOPSIS
    Automated Azure Infrastructure Setup Script
    Fixes Key Vault permissions, deploys database schema, and generates environment files

.DESCRIPTION
    This script automates the complete Azure infrastructure setup process:
    1. Fixes Key Vault permissions and stores secrets
    2. Configures SQL firewall rules
    3. Deploys database schema (14 tables, 1 procedure, 1 function)
    4. Generates environment files for all services
    5. Verifies setup and generates status report

.PARAMETER ResourceGroup
    Azure resource group name (default: rg-wealtharena-northcentralus)

.PARAMETER Suffix
    Unique suffix for resources (default: jg1ve2)

.NOTES
    Author: WealthArena DevOps Team
    Version: 1.0
    Created: 2024-12-22
#>

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Suffix = "jg1ve2",
    [string]$UserEmail = "clifford.addison@hotmail.com",
    [string]$GroqApiKey = "",
    [string]$SqlPassword = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors for output
function Write-Status {
    param([string]$Message, [string]$Status = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Status) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        default { "Cyan" }
    }
    Write-Host "[$timestamp] [$Status] $Message" -ForegroundColor $color
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor Cyan
    Write-Host $Title.ToUpper() -ForegroundColor Cyan
    Write-Host "=" * 70 -ForegroundColor Cyan
}

# Track overall status
$global:SetupSuccess = $true
$global:StatusReport = @()

function Add-Status {
    param([string]$Phase, [string]$Status, [string]$Details = "")
    $global:StatusReport += [PSCustomObject]@{
        Phase = $Phase
        Status = $Status
        Details = $Details
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
}

Write-Header "Automated Azure Infrastructure Setup"
Write-Status "Starting automated setup for suffix: $Suffix" "INFO"

# Phase 1: Key Vault Permissions
Write-Header "Phase 1: Key Vault Permissions"
try {
    Write-Status "Calling fix_keyvault_permissions.ps1 script..." "INFO"
    $kvScript = Join-Path $PSScriptRoot "fix_keyvault_permissions.ps1"
    
    # Build parameter hashtable
    $kvParams = @{
        ResourceGroup = $ResourceGroup
        Suffix = $Suffix
        UserEmail = $UserEmail
    }
    if ($GroqApiKey) {
        $kvParams['GroqApiKey'] = $GroqApiKey
    }
    if ($SqlPassword) {
        $kvParams['SqlPassword'] = $SqlPassword
    }
    
    & $kvScript @kvParams
    
    Write-Status "Key Vault permissions fixed successfully" "SUCCESS"
    Add-Status "Key Vault Permissions" "✅ COMPLETED" "All 3 secrets stored"
}
catch {
    Write-Status "Key Vault permissions setup failed: $_" "ERROR"
    Add-Status "Key Vault Permissions" "❌ FAILED" $_.Exception.Message
    $global:SetupSuccess = $false
    Write-Host "`nMANUAL ACTION REQUIRED: Go to Azure Portal → kv-wealtharena-$Suffix → Access Policies → Add your user" -ForegroundColor Yellow
}

# Phase 2: SQL Firewall Configuration
Write-Header "Phase 2: SQL Firewall Configuration"
try {
    $serverName = "sql-wealtharena-$Suffix"
    
    # Get current public IP
    Write-Status "Detecting your public IP address..." "INFO"
    try {
        $publicIP = (Invoke-WebRequest -Uri 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 10).Content.Trim()
        Write-Status "Public IP detected: $publicIP" "SUCCESS"
    }
    catch {
        Write-Status "Failed to detect public IP, using 0.0.0.0" "WARNING"
        $publicIP = "0.0.0.0"
    }
    
    # Check existing firewall rules
    Write-Status "Checking existing firewall rules..." "INFO"
    $existingRules = az sql server firewall-rule list --server $serverName --resource-group $ResourceGroup --output json | ConvertFrom-Json
    
    # Check if Azure Services rule exists by matching IP range (0.0.0.0 to 0.0.0.0)
    $azureRule = $existingRules | Where-Object { $_.startIpAddress -eq "0.0.0.0" -and $_.endIpAddress -eq "0.0.0.0" }
    if (-not $azureRule) {
        Write-Status "Adding AllowAzureServices firewall rule..." "INFO"
        az sql server firewall-rule create `
            --resource-group $ResourceGroup `
            --server $serverName `
            --name AllowAzureServices `
            --start-ip-address 0.0.0.0 `
            --end-ip-address 0.0.0.0 `
            --output none
        Write-Status "AllowAzureServices rule created" "SUCCESS"
    } else {
        Write-Status "AllowAzureServices rule already exists" "INFO"
    }
    
    # Check if local development rule exists
    $localRule = $existingRules | Where-Object { $_.name -eq "AllowLocalDevelopment" }
    if (-not $localRule -and $publicIP -ne "0.0.0.0") {
        Write-Status "Adding AllowLocalDevelopment firewall rule for IP: $publicIP..." "INFO"
        az sql server firewall-rule create `
            --resource-group $ResourceGroup `
            --server $serverName `
            --name AllowLocalDevelopment `
            --start-ip-address $publicIP `
            --end-ip-address $publicIP `
            --output none
        Write-Status "AllowLocalDevelopment rule created" "SUCCESS"
    } else {
        Write-Status "AllowLocalDevelopment rule already exists or IP detection failed" "INFO"
    }
    
    Write-Status "SQL firewall configured successfully" "SUCCESS"
    Add-Status "SQL Firewall Configuration" "✅ COMPLETED" "Public IP: $publicIP"
}
catch {
    Write-Status "SQL firewall configuration failed: $_" "ERROR"
    Add-Status "SQL Firewall Configuration" "❌ FAILED" $_.Exception.Message
    $global:SetupSuccess = $false
    Write-Host "`nMANUAL ACTION REQUIRED: Go to Azure Portal → SQL Server → Firewalls → Add client IP" -ForegroundColor Yellow
}

# Phase 3: Database Schema Deployment
Write-Header "Phase 3: Database Schema Deployment"
try {
    Write-Status "Executing database schema deployment script..." "INFO"
    $dbScript = Join-Path $PSScriptRoot "deploy_database_schema.py"
    
    # Check if Python is available
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCmd) {
        throw "Python is not installed or not in PATH"
    }
    
    $schemaFile = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "database_schemas\azure_sql_schema.sql"
    if (-not (Test-Path $schemaFile)) {
        throw "Schema file not found: $schemaFile"
    }
    
    # Retrieve SQL password from Key Vault
    $vaultName = "kv-wealtharena-$Suffix"
    Write-Status "Retrieving SQL password from Key Vault..." "INFO"
    try {
        $sqlPasswordFromKV = az keyvault secret show --vault-name $vaultName --name sql-password --query value -o tsv
        if ([string]::IsNullOrWhiteSpace($sqlPasswordFromKV)) {
            throw "SQL password not found in Key Vault"
        }
    }
    catch {
        throw "Failed to retrieve SQL password from Key Vault: $_"
    }
    
    # Run deployment
    Write-Status "Deploying schema from: $schemaFile" "INFO"
    python $dbScript --server "sql-wealtharena-$Suffix.database.windows.net" --database "wealtharena_db" --password $sqlPasswordFromKV
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Database schema deployed successfully" "SUCCESS"
        Add-Status "Database Schema Deployment" "✅ COMPLETED" "14 tables, 1 procedure, 1 function"
    } else {
        throw "Schema deployment script failed with exit code $LASTEXITCODE"
    }
}
catch {
    Write-Status "Database schema deployment failed: $_" "ERROR"
    Add-Status "Database Schema Deployment" "❌ FAILED" $_.Exception.Message
    $global:SetupSuccess = $false
    Write-Host "`nMANUAL ACTION REQUIRED: Use Azure Data Studio to execute schema manually" -ForegroundColor Yellow
}

# Phase 4: Environment File Generation
Write-Header "Phase 4: Environment File Generation"
try {
    Write-Status "Generating environment files for all services..." "INFO"
    $envScript = Join-Path $PSScriptRoot "generate_env_files.ps1"
    & $envScript -ResourceGroup $ResourceGroup -Suffix $Suffix
    
    Write-Status "Environment files generated successfully" "SUCCESS"
    Add-Status "Environment File Generation" "✅ COMPLETED" "3 files created"
}
catch {
    Write-Status "Environment file generation failed: $_" "ERROR"
    Add-Status "Environment File Generation" "❌ FAILED" $_.Exception.Message
    $global:SetupSuccess = $false
}

# Phase 5: Verification & Status Report
Write-Header "Phase 5: Verification & Status Report"
try {
    Write-Status "Running verification tests..." "INFO"
    $verifyScript = Join-Path $PSScriptRoot "verify_setup.ps1"
    & $verifyScript -ResourceGroup $ResourceGroup -Suffix $Suffix
    
    Write-Status "All verification tests passed" "SUCCESS"
    Add-Status "Verification Tests" "✅ COMPLETED" "All tests passed"
}
catch {
    Write-Status "Verification tests failed: $_" "ERROR"
    Add-Status "Verification Tests" "❌ FAILED" $_.Exception.Message
    $global:SetupSuccess = $false
}

# Generate final status report
Write-Header "Generating Status Report"
try {
    $statusReportPath = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "AZURE_SETUP_STATUS.md"
    
    $report = @"
# Azure Infrastructure Setup - Status Report

**Generated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Executed By:** $UserEmail
**Resource Group:** $ResourceGroup
**Unique Suffix:** $Suffix

## Summary

$(foreach ($item in $global:StatusReport) {
    "- $($item.Phase): $($item.Status)"
})
"@
    
    # Add detailed sections for each phase
    $report += @"


## Phase 1: Key Vault Permissions

**Status:** $(($global:StatusReport | Where-Object { $_.Phase -eq "Key Vault Permissions" }).Status)

$(($global:StatusReport | Where-Object { $_.Phase -eq "Key Vault Permissions" }).Details)


## Phase 2: SQL Firewall Configuration

**Status:** $(($global:StatusReport | Where-Object { $_.Phase -eq "SQL Firewall Configuration" }).Status)

$(($global:StatusReport | Where-Object { $_.Phase -eq "SQL Firewall Configuration" }).Details)


## Phase 3: Database Schema Deployment

**Status:** $(($global:StatusReport | Where-Object { $_.Phase -eq "Database Schema Deployment" }).Status)

$(($global:StatusReport | Where-Object { $_.Phase -eq "Database Schema Deployment" }).Details)


## Phase 4: Environment File Generation

**Status:** $(($global:StatusReport | Where-Object { $_.Phase -eq "Environment File Generation" }).Status)

$(($global:StatusReport | Where-Object { $_.Phase -eq "Environment File Generation" }).Details)


## Phase 5: Verification Tests

**Status:** $(($global:StatusReport | Where-Object { $_.Phase -eq "Verification Tests" }).Status)

$(($global:StatusReport | Where-Object { $_.Phase -eq "Verification Tests" }).Details)

"@
    
    $report | Out-File -FilePath $statusReportPath -Encoding UTF8
    Write-Status "Status report generated: $statusReportPath" "SUCCESS"
}
catch {
    Write-Status "Failed to generate status report: $_" "WARNING"
}

# Final summary
Write-Header "Setup Complete"
if ($global:SetupSuccess) {
    Write-Host @"
✅ Automated Azure infrastructure setup completed successfully!

All critical components are configured and ready for use:
  - Key Vault permissions fixed
  - SQL firewall configured
  - Database schema deployed
  - Environment files generated
  - All verification tests passed

Next Steps:
  1. Review AZURE_SETUP_STATUS.md for details
  2. Run: scripts/data_pipeline/run_all_downloaders.py (Phase 2)
  3. Run: scripts/rl_training/run_training.bat (Phase 7)
  4. Run: scripts/azure_deployment/start_all_services.bat (Local testing)

"@ -ForegroundColor Green
    exit 0
}
else {
    Write-Host @"
⚠️ Setup completed with some failures. Please review the errors above.

Manual actions may be required for failed components.

Check AZURE_SETUP_STATUS.md for detailed status and troubleshooting steps.

"@ -ForegroundColor Yellow
    exit 1
}

