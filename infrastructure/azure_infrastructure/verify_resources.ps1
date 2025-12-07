# WealthArena Azure Resources Verification Script
# This script tests connectivity to all provisioned Azure resources

param(
    [string]$ResourceGroupName = "rg-wealtharena-northcentralus",
    [string]$Environment = "dev"
)

# Set error action preference
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

function Test-ResourceGroup {
    param([string]$ResourceGroup)
    
    Write-ColorOutput "Testing Resource Group: $ResourceGroup" $Blue
    
    try {
        $rg = az group show --name $ResourceGroup --output json | ConvertFrom-Json
        if ($rg) {
            Write-ColorOutput "   Resource Group exists" $Green
            Write-ColorOutput "   Location: $($rg.location)" $Blue
            return $true
        }
    }
    catch {
        Write-ColorOutput "   Resource Group not found" $Red
        return $false
    }
}

function Test-StorageAccount {
    param([string]$StorageAccount, [string]$ResourceGroup)
    
    Write-ColorOutput "Testing Storage Account: $StorageAccount" $Blue
    
    try {
        $storage = az storage account show --name $StorageAccount --resource-group $ResourceGroup --output json | ConvertFrom-Json
        if ($storage) {
            Write-ColorOutput "   Storage Account exists" $Green
            Write-ColorOutput "   Status: $($storage.statusOfPrimary)" $Blue
            
            # Test container access
            try {
                $containers = az storage container list --account-name $StorageAccount --auth-mode login --output json | ConvertFrom-Json
                Write-ColorOutput "   Containers: $($containers.Count) found" $Green
                return $true
            }
            catch {
                Write-ColorOutput "   Warning: Cannot access containers" $Yellow
                return $true
            }
        }
    }
    catch {
        Write-ColorOutput "   Storage Account not found" $Red
        return $false
    }
}

function Test-SQLDatabase {
    param([string]$ServerName, [string]$DatabaseName, [string]$ResourceGroup)
    
    Write-ColorOutput "Testing SQL Database: $DatabaseName" $Blue
    
    try {
        $server = az sql server show --name $ServerName --resource-group $ResourceGroup --output json | ConvertFrom-Json
        if ($server) {
            Write-ColorOutput "   SQL Server exists" $Green
            Write-ColorOutput "   State: $($server.state)" $Blue
            
            # Test database
            try {
                $db = az sql db show --name $DatabaseName --server $ServerName --resource-group $ResourceGroup --output json | ConvertFrom-Json
                if ($db) {
                    Write-ColorOutput "   Database exists" $Green
                    Write-ColorOutput "   Status: $($db.status)" $Blue
                    
                    # Verify AllowAzureServices firewall rule
                    Test-SQLFirewallRule -ServerName $ServerName -ResourceGroup $ResourceGroup
                    
                    return $true
                }
            }
            catch {
                Write-ColorOutput "   Database not found" $Red
                return $false
            }
        }
    }
    catch {
        Write-ColorOutput "   SQL Server not found" $Red
        return $false
    }
}

function Test-SQLFirewallRule {
    param([string]$ServerName, [string]$ResourceGroup, [string]$RuleName = "AllowAzureServices")
    
    Write-ColorOutput "Testing SQL Firewall Rule: $RuleName" $Blue
    
    try {
        $rule = az sql server firewall-rule show `
            --name $RuleName `
            --server $ServerName `
            --resource-group $ResourceGroup `
            --output json 2>$null | ConvertFrom-Json
        
        if ($rule) {
            Write-ColorOutput "   Firewall rule '$RuleName' exists" $Green
            Write-ColorOutput "   Start IP: $($rule.startIpAddress)" $Blue
            Write-ColorOutput "   End IP: $($rule.endIpAddress)" $Blue
            return $true
        } else {
            Write-ColorOutput "   Firewall rule '$RuleName' not found" $Yellow
            Write-ColorOutput "   Attempting to create firewall rule..." $Yellow
            
            # Create AllowAzureServices firewall rule (0.0.0.0 to 0.0.0.0 allows Azure services)
            $createResult = az sql server firewall-rule create `
                --name $RuleName `
                --server $ServerName `
                --resource-group $ResourceGroup `
                --start-ip-address "0.0.0.0" `
                --end-ip-address "0.0.0.0" `
                --output json 2>$null | ConvertFrom-Json
            
            if ($createResult) {
                Write-ColorOutput "   ✅ Firewall rule '$RuleName' created successfully" $Green
                return $true
            } else {
                Write-ColorOutput "   ❌ Failed to create firewall rule" $Red
                Write-ColorOutput "   Please create manually: az sql server firewall-rule create --name $RuleName --server $ServerName --resource-group $ResourceGroup --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0" $Yellow
                return $false
            }
        }
    }
    catch {
        Write-ColorOutput "   ⚠️  Error checking firewall rule: $($_.Exception.Message)" $Yellow
        Write-ColorOutput "   You may need to create the rule manually" $Blue
        return $false
    }
}

function Test-CosmosDB {
    param([string]$AccountName, [string]$ResourceGroup)
    
    Write-ColorOutput "Testing Cosmos DB: $AccountName" $Blue
    
    try {
        $cosmos = az cosmosdb show --name $AccountName --resource-group $ResourceGroup --output json | ConvertFrom-Json
        if ($cosmos) {
            Write-ColorOutput "   Cosmos DB exists" $Green
            Write-ColorOutput "   Status: $($cosmos.provisioningState)" $Blue
            return $true
        }
    }
    catch {
        Write-ColorOutput "   Cosmos DB not found or not available" $Yellow
        return $false
    }
}

function Test-Databricks {
    param([string]$WorkspaceName, [string]$ResourceGroup)
    
    Write-ColorOutput "Testing Databricks: $WorkspaceName" $Blue
    
    try {
        $workspace = az databricks workspace show --name $WorkspaceName --resource-group $ResourceGroup --output json | ConvertFrom-Json
        if ($workspace) {
            Write-ColorOutput "   Databricks Workspace exists" $Green
            Write-ColorOutput "   Workspace URL: $($workspace.workspaceUrl)" $Blue
            return $true
        }
    }
    catch {
        Write-ColorOutput "   Databricks Workspace not found" $Red
        return $false
    }
}

function Test-ContainerRegistry {
    param([string]$RegistryName, [string]$ResourceGroup)
    
    Write-ColorOutput "Testing Container Registry: $RegistryName" $Blue
    
    try {
        $acr = az acr show --name $RegistryName --resource-group $ResourceGroup --output json | ConvertFrom-Json
        if ($acr) {
            Write-ColorOutput "   Container Registry exists" $Green
            Write-ColorOutput "   Login Server: $($acr.loginServer)" $Blue
            return $true
        }
    }
    catch {
        Write-ColorOutput "   Container Registry not found" $Red
        return $false
    }
}

function Test-KeyVault {
    param([string]$VaultName, [string]$ResourceGroup)
    
    Write-ColorOutput "Testing Key Vault: $VaultName" $Blue
    
    try {
        $kv = az keyvault show --name $VaultName --resource-group $ResourceGroup --output json | ConvertFrom-Json
        if ($kv) {
            Write-ColorOutput "   Key Vault exists" $Green
            Write-ColorOutput "   Vault URI: $($kv.properties.vaultUri)" $Blue
            return $true
        }
    }
    catch {
        Write-ColorOutput "   Key Vault not found" $Red
        return $false
    }
}

function Test-DataFactory {
    param([string]$FactoryName, [string]$ResourceGroup)
    
    Write-ColorOutput "Testing Data Factory: $FactoryName" $Blue
    
    try {
        $adf = az datafactory show --name $FactoryName --resource-group $ResourceGroup --output json | ConvertFrom-Json
        if ($adf) {
            Write-ColorOutput "   Data Factory exists" $Green
            Write-ColorOutput "   State: $($adf.provisioningState)" $Blue
            return $true
        }
    }
    catch {
        Write-ColorOutput "   Data Factory not found" $Red
        return $false
    }
}

function Test-Connectivity {
    Write-ColorOutput "Testing Azure CLI connectivity..." $Blue
    
    try {
        $account = az account show --output json | ConvertFrom-Json
        Write-ColorOutput "   Connected as: $($account.user.name)" $Green
        Write-ColorOutput "   Subscription: $($account.name)" $Blue
        return $true
    }
    catch {
        Write-ColorOutput "   Not connected to Azure" $Red
        return $false
    }
}

function Load-EnvironmentConfig {
    $envFile = "azure_infrastructure/.env"
    
    if (Test-Path $envFile) {
        Write-ColorOutput "Loading environment configuration from $envFile" $Blue
        
        $envContent = Get-Content $envFile
        $envVars = @{}
        
        foreach ($line in $envContent) {
            if ($line -match "^([^#][^=]+)=(.*)$") {
                $envVars[$matches[1]] = $matches[2]
            }
        }
        
        return $envVars
    }
    else {
        Write-ColorOutput "Environment file not found: $envFile" $Yellow
        return @{}
    }
}

# Main execution
Write-ColorOutput "Verifying Azure Resources for WealthArena" $Blue
Write-ColorOutput "=========================================" $Blue

# Test Azure CLI
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-ColorOutput "✅ Azure CLI found: $($azVersion.'azure-cli')" $Green
} catch {
    Write-ColorOutput "❌ Azure CLI not found" $Red
    exit 1
}

# Test Azure connectivity
$account = $null
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-ColorOutput "✅ Logged in as: $($account.user.name)" $Green
} catch {
    Write-ColorOutput "❌ Not logged in" $Red
    Write-ColorOutput "Please run 'az login' first." $Yellow
    exit 1
}

# Load environment configuration (for future use)
Load-EnvironmentConfig | Out-Null

# Test Resource Group
$rgExists = Test-ResourceGroup -ResourceGroup $ResourceGroupName

if (-not $rgExists) {
    Write-ColorOutput "Resource Group not found. Please run setup_master.ps1 first." $Red
    exit 1
}

# Test all resources
$results = @{}

Write-ColorOutput "Testing Azure Resources..." $Blue

# Storage Account
$results.Storage = Test-StorageAccount -StorageAccount "stwealtharena$Environment" -ResourceGroup $ResourceGroupName

# SQL Database
$results.SQL = Test-SQLDatabase -ServerName "sql-wealtharena-$Environment" -DatabaseName "wealtharena_db" -ResourceGroup $ResourceGroupName

# Cosmos DB
$results.Cosmos = Test-CosmosDB -AccountName "cosmos-wealtharena-$Environment" -ResourceGroup $ResourceGroupName

# Databricks
$results.Databricks = Test-Databricks -WorkspaceName "databricks-wealtharena-$Environment" -ResourceGroup $ResourceGroupName

# Container Registry
$results.ACR = Test-ContainerRegistry -RegistryName "acrwealtharena$Environment" -ResourceGroup $ResourceGroupName

# Key Vault
$results.KeyVault = Test-KeyVault -VaultName "kv-wealtharena-$Environment" -ResourceGroup $ResourceGroupName

# Data Factory
$results.DataFactory = Test-DataFactory -FactoryName "adf-wealtharena-$Environment" -ResourceGroup $ResourceGroupName

# Summary
Write-ColorOutput "" $Blue
Write-ColorOutput "Verification Summary:" $Blue
Write-ColorOutput "====================" $Blue

# Display results in plan format
if ($rgExists) {
    Write-ColorOutput "✅ Resource Group: $ResourceGroupName" $Green
} else {
    Write-ColorOutput "❌ Resource Group: $ResourceGroupName (not found)" $Red
}

if ($results.Storage) {
    Write-ColorOutput "✅ Storage Account: stwealtharena$Environment exists" $Green
} else {
    Write-ColorOutput "❌ Storage Account: stwealtharena$Environment not found" $Red
}

if ($results.SQL) {
    Write-ColorOutput "✅ SQL Server: sql-wealtharena-$Environment exists" $Green
    Write-ColorOutput "✅ SQL Database: wealtharena_db exists" $Green
} else {
    Write-ColorOutput "❌ SQL Server: sql-wealtharena-$Environment not found" $Red
}

if ($results.Databricks) {
    Write-ColorOutput "✅ Databricks: databricks-wealtharena-$Environment exists" $Green
} else {
    Write-ColorOutput "❌ Databricks: databricks-wealtharena-$Environment not found" $Red
}

if ($results.ACR) {
    Write-ColorOutput "✅ Container Registry: acrwealtharena$Environment exists" $Green
} else {
    Write-ColorOutput "❌ Container Registry: acrwealtharena$Environment not found" $Red
}

if ($results.KeyVault) {
    Write-ColorOutput "✅ Key Vault: kv-wealtharena-$Environment exists" $Green
} else {
    Write-ColorOutput "❌ Key Vault: kv-wealtharena-$Environment not found" $Red
}

if ($results.DataFactory) {
    Write-ColorOutput "✅ Data Factory: adf-wealtharena-$Environment exists" $Green
} else {
    Write-ColorOutput "❌ Data Factory: adf-wealtharena-$Environment not found" $Red
}

if ($results.Cosmos) {
    Write-ColorOutput "✅ Cosmos DB: cosmos-wealtharena-$Environment exists" $Green
} else {
    Write-ColorOutput "⚠️  Cosmos DB: cosmos-wealtharena-$Environment not found (acceptable for student accounts)" $Yellow
}

Write-ColorOutput "" $Blue
$totalTests = $results.Count
$passedTests = ($results.Values | Where-Object { $_ -eq $true }).Count
$cosmosCount = if ($results.Cosmos) { 1 } else { 0 }
$expectedTotal = $totalTests - $cosmosCount

Write-ColorOutput "Summary: $passedTests/$expectedTotal resources exist (Cosmos DB optional)" $Blue
if ($passedTests -eq $expectedTotal -or ($passedTests -eq ($expectedTotal - 1) -and -not $results.Cosmos)) {
    Write-ColorOutput "Status: Infrastructure ready for deployment" $Green
} else {
    Write-ColorOutput "Status: Some resources missing - run setup_master.ps1 if needed" $Yellow
}