# WealthArena Azure Infrastructure Verification and Provisioning Script
# Orchestrates resource verification and conditional provisioning

param(
    [string]$ResourceGroupName = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [string]$Environment = "dev",
    [switch]$ConfigureFirewall = $false,
    [switch]$StoreSecrets = $false
)

$ErrorActionPreference = "Continue"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-AzureConnection {
    try {
        $account = az account show --output json | ConvertFrom-Json
        Write-ColorOutput "✅ Logged in as: $($account.user.name)" $Green
        return $true
    }
    catch {
        Write-ColorOutput "❌ Not logged in to Azure" $Red
        Write-ColorOutput "Please run 'az login' first." $Yellow
        return $false
    }
}

function Test-CriticalResources {
    param([string]$ResourceGroup, [string]$Env)
    
    Write-ColorOutput "Verifying existing Azure resources..." $Blue
    Write-ColorOutput "" $Blue
    
    $results = @{}
    
    # Test Resource Group
    try {
        $rg = az group show --name $ResourceGroup --output json 2>$null | ConvertFrom-Json
        $results.ResourceGroup = $null -ne $rg
        if ($results.ResourceGroup) {
            Write-ColorOutput "✅ Resource Group: $ResourceGroup" $Green
        } else {
            Write-ColorOutput "❌ Resource Group: $ResourceGroup not found" $Red
        }
    } catch {
        $results.ResourceGroup = $false
        Write-ColorOutput "❌ Resource Group: $ResourceGroup not found" $Red
    }
    
    # Test Storage Account
    try {
        $storage = az storage account show --name "stwealtharena$Env" --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
        $results.Storage = $null -ne $storage
        if ($results.Storage) {
            Write-ColorOutput "✅ Storage Account: stwealtharena$Env" $Green
        } else {
            Write-ColorOutput "❌ Storage Account: stwealtharena$Env not found" $Red
        }
    } catch {
        $results.Storage = $false
        Write-ColorOutput "❌ Storage Account: stwealtharena$Env not found" $Red
    }
    
    # Test SQL Database
    try {
        $server = az sql server show --name "sql-wealtharena-$Env" --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
        $db = az sql db show --name "wealtharena_db" --server "sql-wealtharena-$Env" --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
        $results.SQL = ($null -ne $server) -and ($null -ne $db)
        if ($results.SQL) {
            Write-ColorOutput "✅ SQL Database: wealtharena_db" $Green
        } else {
            Write-ColorOutput "❌ SQL Database: wealtharena_db not found" $Red
        }
    } catch {
        $results.SQL = $false
        Write-ColorOutput "❌ SQL Database: wealtharena_db not found" $Red
    }
    
    # Test Key Vault
    try {
        $kv = az keyvault show --name "kv-wealtharena-$Env" --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
        $results.KeyVault = $null -ne $kv
        if ($results.KeyVault) {
            Write-ColorOutput "✅ Key Vault: kv-wealtharena-$Env" $Green
        } else {
            Write-ColorOutput "❌ Key Vault: kv-wealtharena-$Env not found" $Red
        }
    } catch {
        $results.KeyVault = $false
        Write-ColorOutput "❌ Key Vault: kv-wealtharena-$Env not found" $Red
    }
    
    return $results
}

# Main execution
Write-ColorOutput "WealthArena Azure Infrastructure Verification and Provisioning" $Blue
Write-ColorOutput "=================================================================" $Blue
Write-ColorOutput "" $Blue

# Check Azure connection
if (-not (Test-AzureConnection)) {
    exit 1
}

Write-ColorOutput "" $Blue

# Verify critical resources
$resourceStatus = Test-CriticalResources -ResourceGroup $ResourceGroupName -Env $Environment

Write-ColorOutput "" $Blue

# Check if all critical resources exist
$criticalResources = @($resourceStatus.ResourceGroup, $resourceStatus.Storage, $resourceStatus.SQL, $resourceStatus.KeyVault)
$allCriticalExist = ($criticalResources | Where-Object { $_ -eq $true }).Count -eq $criticalResources.Count

if ($allCriticalExist) {
    Write-ColorOutput "✅ All critical resources exist" $Green
    Write-ColorOutput "Skipping provisioning (resources already exist)" $Blue
    Write-ColorOutput "Proceeding to firewall configuration..." $Blue
} else {
    Write-ColorOutput "Provisioning missing resources..." $Yellow
    Write-ColorOutput "" $Blue
    
    # Run setup_master.ps1
    $setupScript = Join-Path $PSScriptRoot "..\..\azure_infrastructure\setup_master.ps1"
    
    if (Test-Path $setupScript) {
        Write-ColorOutput "Running setup_master.ps1..." $Blue
        & $setupScript -ResourceGroupName $ResourceGroupName -Location $Location -Environment $Environment
        
        Write-ColorOutput "" $Blue
        Write-ColorOutput "✅ Provisioning complete" $Green
        
        # Verify again after provisioning
        Write-ColorOutput "" $Blue
        Write-ColorOutput "Verifying provisioned resources..." $Blue
        $resourceStatus = Test-CriticalResources -ResourceGroup $ResourceGroupName -Env $Environment
    } else {
        Write-ColorOutput "❌ setup_master.ps1 not found at: $setupScript" $Red
        exit 1
    }
}

Write-ColorOutput "" $Blue

# Optional post-provision steps
$runPostProvisionSteps = $false

if ($ConfigureFirewall -or $StoreSecrets) {
    $runPostProvisionSteps = $true
} else {
    # Prompt user if neither flag was set
    Write-ColorOutput "Post-provision configuration available" $Blue
    $prompt = Read-Host "Would you like to configure SQL firewall and store secrets in Key Vault? (Y/N)"
    if ($prompt -eq "Y" -or $prompt -eq "y") {
        $runPostProvisionSteps = $true
    }
}

if ($runPostProvisionSteps) {
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Running post-provision configuration steps..." $Blue
    
    # Configure SQL Firewall
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Configuring SQL Firewall..." $Blue
    $firewallScript = Join-Path $PSScriptRoot "configure_sql_firewall.ps1"
    
    if (Test-Path $firewallScript) {
        try {
            & $firewallScript -ResourceGroupName $ResourceGroupName -ServerName "sql-wealtharena-$Environment"
            Write-ColorOutput "✅ Firewall configuration complete" $Green
        }
        catch {
            Write-ColorOutput "⚠️  Firewall configuration failed: $($_.Exception.Message)" $Yellow
        }
    } else {
        Write-ColorOutput "⚠️  Firewall script not found at: $firewallScript" $Yellow
    }
    
    # Store secrets in Key Vault
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Storing secrets in Key Vault..." $Blue
    $secretsScript = Join-Path $PSScriptRoot "store_secrets_in_keyvault.ps1"
    
    if (Test-Path $secretsScript) {
        try {
            & $secretsScript -ResourceGroupName $ResourceGroupName -KeyVaultName "kv-wealtharena-$Environment" -Environment $Environment
            Write-ColorOutput "✅ Secret storage complete" $Green
        }
        catch {
            Write-ColorOutput "⚠️  Secret storage failed: $($_.Exception.Message)" $Yellow
        }
    } else {
        Write-ColorOutput "⚠️  Secrets script not found at: $secretsScript" $Yellow
    }
}

Write-ColorOutput "" $Blue
Write-ColorOutput "Verification and provisioning complete!" $Green
