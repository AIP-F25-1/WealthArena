# WealthArena Infrastructure Verification Script
# Verifies all required Azure resources exist and are accessible before deployment

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus"
)

# Set error action preference
$ErrorActionPreference = "Continue"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Blue"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Infrastructure Verification" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Discover suffix from automation state, existing resources, or fallback to resource group
$suffix = ""
$discoveredSuffix = $null

Write-ColorOutput "Discovering resource suffix..." $Cyan

# Priority 1: Check automation state file (if master_automation.ps1 created resources)
$stateFile = Join-Path $PSScriptRoot "..\..\automation_state.json"
if (Test-Path $stateFile) {
    try {
        $automationState = Get-Content $stateFile -Raw | ConvertFrom-Json
        if ($automationState -and $automationState.UniqueSuffix) {
            $discoveredSuffix = $automationState.UniqueSuffix
            Write-ColorOutput "   Found suffix from automation state: $discoveredSuffix" $Green
        }
    } catch {
        # Ignore errors reading state file
    }
}

# Priority 2: Discover from existing SQL Server
if (-not $discoveredSuffix) {
    $sqlListOutput = az sql server list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
    if ($LASTEXITCODE -eq 0 -and $sqlListOutput) {
        $sqlOutputString = $sqlListOutput.ToString()
        if ($sqlOutputString -match 'sql-wealtharena-([^\s]+)') {
            $discoveredSuffix = $matches[1]
            Write-ColorOutput "   Discovered suffix from SQL Server: $discoveredSuffix" $Green
        }
    }
}

# Priority 3: Discover from Key Vault
if (-not $discoveredSuffix) {
    $kvListOutput = az keyvault list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
    if ($LASTEXITCODE -eq 0 -and $kvListOutput) {
        $kvOutputString = $kvListOutput.ToString()
        if ($kvOutputString -match 'kv-wealtharena-([^\s]+)') {
            $discoveredSuffix = $matches[1]
            Write-ColorOutput "   Discovered suffix from Key Vault: $discoveredSuffix" $Green
        }
    }
}

# Priority 4: Fallback to resource group name
if (-not $discoveredSuffix) {
    if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
        $discoveredSuffix = $matches[1]
        Write-ColorOutput "   Using suffix from resource group: $discoveredSuffix" $Yellow
    } else {
        $discoveredSuffix = "dev"
        Write-ColorOutput "   Using default suffix: $discoveredSuffix" $Yellow
    }
}

$suffix = $discoveredSuffix

Write-ColorOutput ""

$allChecksPassed = $true

# Check 1: Azure CLI Connection
Write-ColorOutput "1. Verifying Azure CLI connection..." $Blue
$accountOutput = az account show --output json 2>&1
$account = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $account = $accountOutput | ConvertFrom-Json
        if ($account -and $account.user) {
            Write-ColorOutput "   Azure CLI: OK - Connected as $($account.user.name)" $Green
        } else {
            Write-ColorOutput "   Azure CLI: FAILED - Not logged in" $Red
            $allChecksPassed = $false
        }
    } catch {
        Write-ColorOutput "   Azure CLI: Could not parse account information" $Red
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   Azure CLI: Not logged in" $Red
    $allChecksPassed = $false
}

# Check 2: Resource Group
Write-ColorOutput "2. Verifying resource group..." $Blue
$rgOutput = az group show --name $ResourceGroup --output json 2>&1
$rg = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $rg = $rgOutput | ConvertFrom-Json
        if ($rg -and $rg.name) {
            Write-ColorOutput "   Resource Group: OK - Exists ($ResourceGroup)" $Green
        } else {
            Write-ColorOutput "   Resource Group: FAILED - Not found" $Red
            $allChecksPassed = $false
        }
    } catch {
        Write-ColorOutput "   Resource Group: Could not parse output" $Red
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   Resource Group: Not found" $Red
    $allChecksPassed = $false
}

# Check 3: SQL Server
Write-ColorOutput "3. Verifying SQL Server..." $Blue
$sqlServerName = "sql-wealtharena-$suffix"
$sqlServerOutput = az sql server show --name $sqlServerName --resource-group $ResourceGroup --output json 2>&1
$sqlServer = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $sqlServer = $sqlServerOutput | ConvertFrom-Json
        if ($sqlServer -and $sqlServer.name) {
            Write-ColorOutput "   SQL Server: OK - Exists ($sqlServerName)" $Green
            
            # Check database
            Write-ColorOutput "   SQL Database: Checking..." $Blue
            $dbOutput = az sql db show --name wealtharena_db --server $sqlServerName --resource-group $ResourceGroup --output json 2>&1
            if ($LASTEXITCODE -eq 0) {
                try {
                    $db = $dbOutput | ConvertFrom-Json
                    if ($db -and $db.name) {
                        Write-ColorOutput "   SQL Database: OK - Exists (wealtharena_db)" $Green
                    } else {
                        Write-ColorOutput "   SQL Database: FAILED - Not found" $Red
                        $allChecksPassed = $false
                    }
                } catch {
                    Write-ColorOutput "   SQL Database: Could not parse output" $Red
                    $allChecksPassed = $false
                }
            } else {
                Write-ColorOutput "   SQL Database: Not found" $Red
                $allChecksPassed = $false
            }
            
            # Check firewall rules
            Write-ColorOutput "   SQL Firewall: Checking..." $Blue
            $firewallOutput = az sql server firewall-rule list --server $sqlServerName --resource-group $ResourceGroup --output json 2>&1
            if ($LASTEXITCODE -eq 0) {
                try {
                    $firewallRules = $firewallOutput | ConvertFrom-Json
                    $allowAzureIps = $false
                    if ($firewallRules) {
                        foreach ($rule in $firewallRules) {
                            if ($rule.name -eq "AllowAllWindowsAzureIps" -or $rule.startIpAddress -eq "0.0.0.0" -and $rule.endIpAddress -eq "0.0.0.0") {
                                $allowAzureIps = $true
                                break
                            }
                        }
                    }
                    if ($allowAzureIps) {
                        Write-ColorOutput "   SQL Firewall: OK - Azure services allowed" $Green
                    } else {
                        Write-ColorOutput "   SQL Firewall: WARNING - Azure services may not be allowed" $Yellow
                        Write-ColorOutput "      Add rule: az sql server firewall-rule create --server $sqlServerName --resource-group $ResourceGroup --name AllowAllWindowsAzureIps --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0" $Blue
                    }
                } catch {
                    Write-ColorOutput "   SQL Firewall: Could not parse rules" $Yellow
                }
            }
            
            # Test DNS resolution
            Write-ColorOutput "   SQL DNS: Testing resolution..." $Blue
            $sqlFqdn = "$sqlServerName.database.windows.net"
            try {
                $dnsResult = Resolve-DnsName -Name $sqlFqdn -ErrorAction SilentlyContinue
                if ($dnsResult) {
                    Write-ColorOutput "   SQL DNS: OK - Resolves ($sqlFqdn)" $Green
                } else {
                    Write-ColorOutput "   SQL DNS: WARNING - Cannot resolve" $Yellow
                    Write-ColorOutput "      This may indicate the server doesn't exist or has DNS issues" $Yellow
                }
            } catch {
                Write-ColorOutput "   SQL DNS: Cannot resolve" $Yellow
            }
        } else {
            Write-ColorOutput "   SQL Server: FAILED - Not found" $Red
            Write-ColorOutput "      Create with: az sql server create --name $sqlServerName --resource-group $ResourceGroup --location $Location --admin-user wealtharena_admin --admin-password <password>" $Blue
            $allChecksPassed = $false
        }
    } catch {
        Write-ColorOutput "   SQL Server: FAILED - Could not parse output" $Red
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   SQL Server: FAILED - Not found ($sqlServerName)" $Red
    Write-ColorOutput "      Run infrastructure setup: setup_master.ps1 (Phase 6)" $Blue
    $allChecksPassed = $false
}

# Check 4: Key Vault
Write-ColorOutput "4. Verifying Key Vault..." $Blue
$keyVaultName = "kv-wealtharena-$suffix"
$keyVaultOutput = az keyvault show --name $keyVaultName --resource-group $ResourceGroup --output json 2>&1
$keyVault = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $keyVault = $keyVaultOutput | ConvertFrom-Json
        if ($keyVault -and $keyVault.name) {
            Write-ColorOutput "   Key Vault: OK - Exists ($keyVaultName)" $Green
            
            # Check access permissions
            Write-ColorOutput "   Key Vault Access: Testing..." $Blue
            $secretListOutput = az keyvault secret list --vault-name $keyVaultName --query "[].name" -o tsv 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "   Key Vault Access: OK - Accessible" $Green
                
                # Check required secrets
                Write-ColorOutput "   Key Vault Secrets: Checking..." $Blue
                $secrets = $secretListOutput -split "`n" | Where-Object { $_ -and $_.Trim() }
                $requiredSecrets = @("sql-password", "groq-api-key")
                $missingSecrets = @()
                
                foreach ($reqSecret in $requiredSecrets) {
                    if ($secrets -contains $reqSecret) {
                        Write-ColorOutput "      $reqSecret : OK - Present" $Green
                    } else {
                        Write-ColorOutput "      $reqSecret : FAILED - Missing" $Red
                        $missingSecrets += $reqSecret
                    }
                }
                
                if ($missingSecrets.Count -gt 0) {
                    Write-ColorOutput "   Key Vault Secrets: Some secrets are missing" $Yellow
                    Write-ColorOutput "      Create with: az keyvault secret set --vault-name $keyVaultName --name <secret-name> --value <value>" $Blue
                    $allChecksPassed = $false
                } else {
                    Write-ColorOutput "   Key Vault Secrets: OK - All required secrets present" $Green
                }
            } else {
                Write-ColorOutput "   Key Vault Access: FAILED - Access denied" $Red
                Write-ColorOutput "      Fix with: .\infrastructure\azure_deployment\fix_keyvault_permissions.ps1 -KeyVault $keyVaultName" $Blue
                $allChecksPassed = $false
            }
        } else {
            Write-ColorOutput "   Key Vault: FAILED - Not found" $Red
            Write-ColorOutput "      Run infrastructure setup: setup_master.ps1 (Phase 6)" $Blue
            $allChecksPassed = $false
        }
    } catch {
        Write-ColorOutput "   Key Vault: FAILED - Could not parse output" $Red
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   Key Vault: FAILED - Not found ($keyVaultName)" $Red
    Write-ColorOutput "      Run infrastructure setup: setup_master.ps1 (Phase 6)" $Blue
    $allChecksPassed = $false
}

# Check 5: Container Registry
Write-ColorOutput "5. Verifying Container Registry..." $Blue

# First, try to discover actual Container Registry name from resource group
$acrName = $null
$acrListOutput = az acr list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
if ($LASTEXITCODE -eq 0 -and $acrListOutput) {
    # Parse the output - handle newlines and multiple registries
    $acrOutputString = $acrListOutput.ToString().Trim()
    if ($acrOutputString -and $acrOutputString -ne "" -and $acrOutputString -notmatch '^System\.') {
        # Split by newlines and get all non-empty entries
        $acrList = $acrOutputString -split "`r?`n" | Where-Object { $_ -and $_.ToString().Trim() -ne "" } | ForEach-Object { $_.ToString().Trim() }
        if ($acrList -and $acrList.Count -gt 0) {
            # Prefer the one matching the suffix, otherwise use the first one
            $preferredAcr = $acrList | Where-Object { $_ -match $suffix }
            if ($preferredAcr) {
                $acrName = $preferredAcr
            } else {
                $acrName = $acrList[0]
            }
            Write-ColorOutput "   Discovered Container Registry: $acrName" $Cyan
            if ($acrList.Count -gt 1) {
                Write-ColorOutput "   (Found $($acrList.Count) Container Registry(ies) in resource group)" $Cyan
            }
        }
    }
}

# If not found, try constructed name
if (-not $acrName) {
    $acrName = "acrwealtharena$suffix"
    $acrName = $acrName.ToLower() -replace '[^a-z0-9]', ''
}

$acrOutput = az acr show --name $acrName --resource-group $ResourceGroup --output json 2>&1
$acr = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $acr = $acrOutput | ConvertFrom-Json
        if ($acr -and $acr.name) {
            Write-ColorOutput "   Container Registry: OK - Exists ($($acr.name))" $Green
            
            # Check admin access - check both the JSON output and query
            $adminEnabled = $false
            if ($acr.adminUserEnabled -eq $true) {
                $adminEnabled = $true
            } else {
                # Fallback to query
                $adminEnabledOutput = az acr show --name $acr.name --resource-group $ResourceGroup --query adminUserEnabled -o tsv 2>&1
                if ($LASTEXITCODE -eq 0 -and $adminEnabledOutput) {
                    $adminEnabledOutputString = $adminEnabledOutput.ToString().Trim().ToLower()
                    if ($adminEnabledOutputString -eq "true" -or $adminEnabledOutputString -eq "1") {
                        $adminEnabled = $true
                    }
                }
            }
            
            if ($adminEnabled) {
                Write-ColorOutput "   Container Registry: OK - Admin access enabled" $Green
            } else {
                Write-ColorOutput "   Container Registry: WARNING - Admin access not enabled" $Yellow
                Write-ColorOutput "      Enable with: az acr update --name $($acr.name) --admin-enabled true" $Blue
            }
        } else {
            Write-ColorOutput "   Container Registry: Not found" $Yellow
            Write-ColorOutput "      Will be created during deployment" $Blue
        }
    } catch {
        Write-ColorOutput "   Container Registry: Could not parse output" $Yellow
    }
} else {
    Write-ColorOutput "   Container Registry: Not found (will be created during deployment)" $Yellow
}

# Check 6: Container Apps Environment
Write-ColorOutput "6. Verifying Container Apps Environment..." $Blue
$envName = "wealtharena-env"
$envOutput = az containerapp env show --name $envName --resource-group $ResourceGroup --output json 2>&1
$env = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $env = $envOutput | ConvertFrom-Json
        if ($env -and $env.name) {
            Write-ColorOutput "   Container Apps Environment: OK - Exists ($envName)" $Green
        } else {
            Write-ColorOutput "   Container Apps Environment: Not found" $Yellow
            Write-ColorOutput "      Will be created during deployment" $Blue
        }
    } catch {
        Write-ColorOutput "   Container Apps Environment: Could not parse output" $Yellow
        Write-ColorOutput "      Will be created during deployment" $Blue
    }
} else {
    Write-ColorOutput "   Container Apps Environment: Not found (will be created during deployment)" $Yellow
}

Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Verification Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

if ($allChecksPassed) {
    Write-ColorOutput "All critical infrastructure checks passed" $Green
    Write-ColorOutput ""
    Write-ColorOutput "Deployment can proceed." $Green
    exit 0
} else {
    Write-ColorOutput "Some infrastructure checks failed" $Red
    Write-ColorOutput ""
    Write-ColorOutput "Remediation steps:" $Cyan
    Write-ColorOutput "  1. Run infrastructure setup: setup_master.ps1 (Phase 6)" $Blue
    Write-ColorOutput "  2. Or fix missing resources manually:" $Blue
    Write-ColorOutput "     - Create SQL Server if missing" $Blue
    Write-ColorOutput "     - Create Key Vault if missing" $Blue
    Write-ColorOutput "     - Fix Key Vault permissions: .\infrastructure\azure_deployment\fix_keyvault_permissions.ps1" $Blue
    Write-ColorOutput "     - Create missing secrets in Key Vault" $Blue
    Write-ColorOutput ""
    Write-ColorOutput "See TROUBLESHOOTING_PHASE7.md for detailed guidance." $Yellow
    exit 1
}

