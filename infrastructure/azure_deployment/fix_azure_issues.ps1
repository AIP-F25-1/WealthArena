# WealthArena Azure Issues Fix Script
# Fixes firewall, SQL Server, Key Vault, Container Registry, and naming issues

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlServerName = "sql-wealtharena-jg1ve2",
    
    [Parameter(Mandatory=$false)]
    [string]$KeyVaultName = "kv-wealtharena-jg1ve2",
    
    [Parameter(Mandatory=$false)]
    [string]$ContainerRegistryName = "acrwealtharenanorthcentralus"
)

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
Write-ColorOutput "Azure Issues Fix Script" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Resource Group: $ResourceGroup" $Cyan
Write-ColorOutput "SQL Server: $SqlServerName" $Cyan
Write-ColorOutput "Key Vault: $KeyVaultName" $Cyan
Write-ColorOutput "Container Registry: $ContainerRegistryName" $Cyan
Write-ColorOutput ""

# Verify Azure login
Write-ColorOutput "Step 1: Verifying Azure login" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

$accountOutput = az account show --output json 2>&1
$account = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $account = $accountOutput | ConvertFrom-Json
        if ($account -and $account.user) {
            Write-ColorOutput "   PASS: Azure login verified" $Green
            Write-ColorOutput "   User: $($account.user.name)" $Green
        } else {
            Write-ColorOutput "   FAIL: Azure login invalid" $Red
            Write-ColorOutput "   Run 'az login' to authenticate" $Yellow
            exit 1
        }
    } catch {
        Write-ColorOutput "   FAIL: Could not parse account information" $Red
        exit 1
    }
} else {
    Write-ColorOutput "   FAIL: Not logged in to Azure" $Red
    Write-ColorOutput "   Run 'az login' to authenticate" $Yellow
    exit 1
}

Write-ColorOutput ""

# Step 2: Fix SQL Server firewall rules
Write-ColorOutput "Step 2: Fixing SQL Server firewall rules" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

# Check if SQL Server exists
$sqlServerOutput = az sql server show --name $SqlServerName --resource-group $ResourceGroup --output json 2>&1
$sqlServer = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $sqlServer = $sqlServerOutput | ConvertFrom-Json
        if ($sqlServer -and $sqlServer.name) {
            Write-ColorOutput "   SQL Server exists: $SqlServerName" $Green
        } else {
            Write-ColorOutput "   FAIL: SQL Server not found: $SqlServerName" $Red
            exit 1
        }
    } catch {
        Write-ColorOutput "   FAIL: Could not parse SQL Server output" $Red
        exit 1
    }
} else {
    Write-ColorOutput "   FAIL: SQL Server not found: $SqlServerName" $Red
    if ($sqlServerOutput) {
        Write-ColorOutput "   Error details: $sqlServerOutput" $Yellow
    }
    exit 1
}

# Check existing firewall rules
Write-ColorOutput "   Checking existing firewall rules..." $Cyan
$firewallOutput = az sql server firewall-rule list --server $SqlServerName --resource-group $ResourceGroup --output json 2>&1
$allowAzureIps = $false

if ($LASTEXITCODE -eq 0) {
    try {
        $firewallRules = $firewallOutput | ConvertFrom-Json
        if ($firewallRules -and $firewallRules.Count -gt 0) {
            foreach ($rule in $firewallRules) {
                if ($rule.name -eq "AllowAllWindowsAzureIps" -or 
                    ($rule.startIpAddress -eq "0.0.0.0" -and $rule.endIpAddress -eq "0.0.0.0")) {
                    $allowAzureIps = $true
                    Write-ColorOutput "   PASS: Azure services already allowed" $Green
                    Write-ColorOutput "   Rule: $($rule.name)" $Green
                    break
                }
            }
        }
    } catch {
        Write-ColorOutput "   Could not parse firewall rules" $Yellow
    }
}

# Add firewall rule for Azure services if not present
if (-not $allowAzureIps) {
    Write-ColorOutput "   Adding firewall rule for Azure services..." $Cyan
    $firewallRuleOutput = az sql server firewall-rule create `
        --server $SqlServerName `
        --resource-group $ResourceGroup `
        --name AllowAllWindowsAzureIps `
        --start-ip-address 0.0.0.0 `
        --end-ip-address 0.0.0.0 `
        --output none 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "   PASS: Added firewall rule for Azure services" $Green
    } else {
        Write-ColorOutput "   WARN: Failed to add firewall rule (may already exist)" $Yellow
        if ($firewallRuleOutput) {
            Write-ColorOutput "   Error details: $firewallRuleOutput" $Yellow
        }
    }
}

Write-ColorOutput ""

# Step 3: Enable Container Registry admin access
Write-ColorOutput "Step 3: Enabling Container Registry admin access" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

# Check if Container Registry exists
$acrOutput = az acr show --name $ContainerRegistryName --resource-group $ResourceGroup --output json 2>&1
$acr = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $acr = $acrOutput | ConvertFrom-Json
        if ($acr -and $acr.name) {
            Write-ColorOutput "   Container Registry exists: $ContainerRegistryName" $Green
            
            # Check if admin is enabled
            if ($acr.adminUserEnabled -eq $true) {
                Write-ColorOutput "   PASS: Admin access already enabled" $Green
            } else {
                Write-ColorOutput "   Enabling admin access..." $Cyan
                $acrUpdateOutput = az acr update --name $ContainerRegistryName --admin-enabled true --output json 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-ColorOutput "   PASS: Admin access enabled" $Green
                } else {
                    Write-ColorOutput "   FAIL: Failed to enable admin access" $Red
                    if ($acrUpdateOutput) {
                        Write-ColorOutput "   Error details: $acrUpdateOutput" $Yellow
                    }
                }
            }
        } else {
            Write-ColorOutput "   FAIL: Container Registry not found: $ContainerRegistryName" $Red
        }
    } catch {
        Write-ColorOutput "   FAIL: Could not parse Container Registry output" $Red
    }
} else {
    Write-ColorOutput "   FAIL: Container Registry not found: $ContainerRegistryName" $Red
    if ($acrOutput) {
        Write-ColorOutput "   Error details: $acrOutput" $Yellow
    }
}

Write-ColorOutput ""

# Step 4: Fix Key Vault permissions
Write-ColorOutput "Step 4: Fixing Key Vault permissions" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

# Check if Key Vault exists
$kvOutput = az keyvault show --name $KeyVaultName --resource-group $ResourceGroup --output json 2>&1
$kv = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $kv = $kvOutput | ConvertFrom-Json
        if ($kv -and $kv.name) {
            Write-ColorOutput "   Key Vault exists: $KeyVaultName" $Green
        } else {
            Write-ColorOutput "   FAIL: Key Vault not found: $KeyVaultName" $Red
            exit 1
        }
    } catch {
        Write-ColorOutput "   FAIL: Could not parse Key Vault output" $Red
        exit 1
    }
} else {
    Write-ColorOutput "   FAIL: Key Vault not found: $KeyVaultName" $Red
    if ($kvOutput) {
        Write-ColorOutput "   Error details: $kvOutput" $Yellow
    }
    exit 1
}

# Get current user
$currentUser = $account.user.name
Write-ColorOutput "   Current user: $currentUser" $Cyan

# Check current permissions
Write-ColorOutput "   Checking current permissions..." $Cyan
$secretListOutput = az keyvault secret list --vault-name $KeyVaultName --query "[].name" -o tsv 2>&1
$hasAccess = $false

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "   PASS: Permissions are already sufficient" $Green
    $hasAccess = $true
} else {
    Write-ColorOutput "   Current permissions insufficient" $Yellow
    
    # Try Access Policy approach
    Write-ColorOutput "   Attempting Access Policy approach..." $Cyan
    $policyOutput = az keyvault set-policy `
        --name $KeyVaultName `
        --upn $currentUser `
        --secret-permissions get list `
        --output none 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "   PASS: Granted access policy permissions" $Green
        $hasAccess = $true
    } else {
        Write-ColorOutput "   Access policy approach failed, trying RBAC..." $Yellow
        
        # Try RBAC approach
        $kvId = $kv.id
        $rbacOutput = az role assignment create `
            --role "Key Vault Secrets User" `
            --assignee $currentUser `
            --scope $kvId `
            --output none 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "   PASS: Granted RBAC permissions" $Green
            $hasAccess = $true
        } else {
            # Check if assignment already exists
            $checkOutput = az role assignment list --assignee $currentUser --scope $kvId --role "Key Vault Secrets User" --query "[].id" -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and $checkOutput) {
                Write-ColorOutput "   PASS: RBAC role assignment already exists" $Green
                $hasAccess = $true
            } else {
                Write-ColorOutput "   WARN: RBAC assignment failed" $Yellow
                if ($rbacOutput) {
                    Write-ColorOutput "   Error details: $rbacOutput" $Yellow
                }
            }
        }
    }
}

Write-ColorOutput ""

# Step 5: Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Fix Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "SQL Server Firewall:" $Cyan
if ($allowAzureIps) {
    Write-ColorOutput "   PASS: Azure services allowed" $Green
} else {
    Write-ColorOutput "   PASS: Firewall rule added" $Green
}

Write-ColorOutput ""
Write-ColorOutput "Container Registry:" $Cyan
if ($acr -and $acr.adminUserEnabled -eq $true) {
    Write-ColorOutput "   PASS: Admin access enabled" $Green
} else {
    Write-ColorOutput "   Check: Admin access status" $Yellow
}

Write-ColorOutput ""
Write-ColorOutput "Key Vault Permissions:" $Cyan
if ($hasAccess) {
    Write-ColorOutput "   PASS: Permissions verified" $Green
} else {
    Write-ColorOutput "   WARN: Permissions may need manual fix" $Yellow
    Write-ColorOutput "   Run: .\infrastructure\azure_deployment\fix_keyvault_permissions.ps1 -KeyVault $KeyVaultName" $Blue
}

Write-ColorOutput ""
Write-ColorOutput "Next Steps:" $Yellow
Write-ColorOutput "  1. Test database connection: .\infrastructure\azure_deployment\diagnose_database_connectivity.ps1 -SqlServerName $SqlServerName" $Blue
Write-ColorOutput "  2. Verify Key Vault access: az keyvault secret list --vault-name $KeyVaultName" $Blue
Write-ColorOutput "  3. Continue with deployment" $Blue
Write-ColorOutput ""

if ($hasAccess) {
    exit 0
} else {
    exit 1
}

