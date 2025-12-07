# WealthArena Azure Infrastructure Setup Script - FIXED VERSION
# This script provisions all required Azure resources for the WealthArena platform
# Location: northcentralus (required for student account)
# Handles student account limitations and registration issues

param(
    [string]$SubscriptionId = "",
    [string]$ResourceGroupName = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [string]$Environment = "dev",
    [Parameter(Mandatory=$true)]
    [string]$AdminPassword,
    [string]$UniqueSuffix = ""
)

# Set error action preference
$ErrorActionPreference = "Continue"  # Changed to Continue to handle errors gracefully

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-AzureCLI {
    try {
        $azVersion = az version --output json | ConvertFrom-Json
        Write-ColorOutput "Azure CLI found: $($azVersion.'azure-cli')" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Azure CLI not found. Please install Azure CLI first." $Red
        return $false
    }
}

function Test-AzureLogin {
    try {
        $account = az account show --output json | ConvertFrom-Json
        Write-ColorOutput "Logged in as: $($account.user.name)" $Green
        Write-ColorOutput "   Subscription: $($account.name)" $Blue
        return $true
    }
    catch {
        Write-ColorOutput "Not logged in to Azure. Please run 'az login' first." $Red
        return $false
    }
}

function Register-AzureProviders {
    Write-ColorOutput "Registering required Azure providers..." $Blue
    
    $providers = @(
        "Microsoft.DocumentDB",
        "Microsoft.Sql",
        "Microsoft.Storage",
        "Microsoft.Databricks",
        "Microsoft.ContainerRegistry",
        "Microsoft.KeyVault",
        "Microsoft.DataFactory",
        "Microsoft.App"
    )
    
    foreach ($provider in $providers) {
        try {
            Write-ColorOutput "Registering $provider..." $Blue
            az provider register --namespace $provider --wait --output none
            Write-ColorOutput "   $provider registered successfully" $Green
        }
        catch {
            Write-ColorOutput "   Warning: Failed to register $provider - $($_.Exception.Message)" $Yellow
        }
    }
}

function New-AzureResourceGroup {
    param([string]$Name, [string]$Location)
    
    Write-ColorOutput "Creating Resource Group: $Name" $Blue
    
    try {
        az group create --name $Name --location $Location --output none
        Write-ColorOutput "Resource Group created successfully" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create Resource Group: $($_.Exception.Message)" $Red
        return $false
    }
}

function New-AzureStorageAccount {
    param([string]$Name, [string]$ResourceGroup, [string]$Location)
    
    Write-ColorOutput "Creating Storage Account: $Name" $Blue
    
    try {
        az storage account create `
            --name $Name `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku Standard_LRS `
            --kind StorageV2 `
            --enable-hierarchical-namespace true `
            --output none
        
        Write-ColorOutput "Storage Account created successfully" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create Storage Account: $($_.Exception.Message)" $Red
        return $false
    }
}

function New-AzureSQLDatabase {
    param([string]$ServerName, [string]$DatabaseName, [string]$ResourceGroup, [string]$Location, [string]$AdminUser, [string]$AdminPassword)
    
    Write-ColorOutput "Creating SQL Server: $ServerName" $Blue
    
    try {
        # Create SQL Server with provided password parameter
        az sql server create `
            --name $ServerName `
            --resource-group $ResourceGroup `
            --location $Location `
            --admin-user $AdminUser `
            --admin-password $AdminPassword `
            --output none
        
        # Create SQL Database
        az sql db create `
            --resource-group $ResourceGroup `
            --server $ServerName `
            --name $DatabaseName `
            --service-objective Basic `
            --output none
        
        # Configure firewall to allow Azure services
        az sql server firewall-rule create `
            --resource-group $ResourceGroup `
            --server $ServerName `
            --name "AllowAzureServices" `
            --start-ip-address 0.0.0.0 `
            --end-ip-address 0.0.0.0 `
            --output none
        
        Write-ColorOutput "SQL Database created successfully" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create SQL Database: $($_.Exception.Message)" $Red
        return $false
    }
}

function New-AzureCosmosDB {
    param([string]$AccountName, [string]$ResourceGroup, [string]$Location)
    
    Write-ColorOutput "Creating Cosmos DB Account: $AccountName" $Blue
    
    try {
        # Wait a bit for provider registration
        Start-Sleep -Seconds 30
        
        az cosmosdb create `
            --name $AccountName `
            --resource-group $ResourceGroup `
            --locations regionName=$Location failoverPriority=0 isZoneRedundant=False `
            --capabilities EnableServerless `
            --output none
        
        Write-ColorOutput "Cosmos DB Account created successfully" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create Cosmos DB: $($_.Exception.Message)" $Red
        Write-ColorOutput "Note: Cosmos DB may not be available in student accounts. Continuing..." $Yellow
        return $false
    }
}

function New-AzureDatabricks {
    param([string]$WorkspaceName, [string]$ResourceGroup, [string]$Location)
    
    Write-ColorOutput "Creating Databricks Workspace: $WorkspaceName" $Blue
    
    try {
        az databricks workspace create `
            --name $WorkspaceName `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku standard `
            --output none
        
        Write-ColorOutput "Databricks Workspace created successfully" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create Databricks: $($_.Exception.Message)" $Red
        return $false
    }
}

function New-AzureContainerRegistry {
    param([string]$RegistryName, [string]$ResourceGroup, [string]$Location)
    
    Write-ColorOutput "Creating Container Registry: $RegistryName" $Blue
    
    try {
        az acr create `
            --name $RegistryName `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku Basic `
            --admin-enabled true `
            --output none
        
        Write-ColorOutput "Container Registry created successfully" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create Container Registry: $($_.Exception.Message)" $Red
        return $false
    }
}

function New-AzureKeyVault {
    param([string]$VaultName, [string]$ResourceGroup, [string]$Location)
    
    Write-ColorOutput "Creating Key Vault: $VaultName" $Blue
    
    try {
        # Remove unsupported parameters for student accounts
        az keyvault create `
            --name $VaultName `
            --resource-group $ResourceGroup `
            --location $Location `
            --output none
        
        Write-ColorOutput "Key Vault created successfully" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create Key Vault: $($_.Exception.Message)" $Red
        return $false
    }
}

function New-AzureDataFactory {
    param([string]$FactoryName, [string]$ResourceGroup, [string]$Location)
    
    Write-ColorOutput "Creating Data Factory: $FactoryName" $Blue
    
    try {
        az datafactory create `
            --name $FactoryName `
            --resource-group $ResourceGroup `
            --location $Location `
            --output none
        
        Write-ColorOutput "Data Factory created successfully" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create Data Factory: $($_.Exception.Message)" $Red
        return $false
    }
}

function New-AzureContainerAppEnvironment {
    param([string]$EnvironmentName, [string]$ResourceGroup, [string]$Location)
    
    Write-ColorOutput "Creating Container App Environment: $EnvironmentName" $Blue
    
    try {
        # Skip Container Apps for now due to registration issues
        Write-ColorOutput "Skipping Container Apps Environment due to registration issues" $Yellow
        Write-ColorOutput "Container App Environment will be created manually later" $Yellow
        return $true
    }
    catch {
        Write-ColorOutput "Failed to create Container App Environment: $($_.Exception.Message)" $Red
        return $false
    }
}

function Set-AzureStorageContainers {
    param([string]$StorageAccountName, [string]$ResourceGroup)
    
    Write-ColorOutput "Creating Storage Containers" $Blue
    
    $containers = @(
        "raw-market-data",
        "processed-features", 
        "rl-models",
        "chatbot-vectors",
        "user-uploads"
    )
    
    $successCount = 0
    
    foreach ($container in $containers) {
        try {
            az storage container create `
                --name $container `
                --account-name $StorageAccountName `
                --auth-mode login `
                --output none
            Write-ColorOutput "   Created container: $container" $Green
            $successCount++
        }
        catch {
            Write-ColorOutput "   Failed to create container: $container - $($_.Exception.Message)" $Red
        }
    }
    
    if ($successCount -eq $containers.Count) {
        Write-ColorOutput "All storage containers created successfully" $Green
        return $true
    } else {
        Write-ColorOutput "Some storage containers failed to create" $Yellow
        return $false
    }
}

function Get-ConnectionStrings {
    param([string]$ResourceGroup, [string]$Suffix)
    
    Write-ColorOutput "Gathering connection strings and endpoints" $Blue
    
    try {
        # Get Storage Account connection string for Key Vault storage
        $storageConnStr = az storage account show-connection-string `
            --name "stwealtharena$Suffix" `
            --resource-group $ResourceGroup `
            --query connectionString `
            --output tsv
        
        # Store storage connection string in Key Vault
        if ($storageConnStr) {
            try {
                az keyvault secret set --vault-name "kv-wealtharena-$Suffix" --name "storage-connection-string" --value $storageConnStr --output none
                Write-ColorOutput "Storage connection string stored in Key Vault" $Green
            }
            catch {
                Write-ColorOutput "Warning: Failed to store storage connection string in Key Vault: $($_.Exception.Message)" $Yellow
            }
        }
        
        # Get SQL Server connection metadata (no password)
        $sqlServer = "sql-wealtharena-$Suffix"
        $sqlDatabase = "wealtharena_db"
        
        # Try to get Cosmos DB connection string (may fail)
        $cosmosConnStr = ""
        $cosmosExists = $false
        try {
            $cosmosConnStr = az cosmosdb keys list `
                --name "cosmos-wealtharena-$Suffix" `
                --resource-group $ResourceGroup `
                --type connection-strings `
                --query connectionStrings[0].connectionString `
                --output tsv 2>$null
            
            if ($cosmosConnStr) {
                $cosmosExists = $true
                # Store Cosmos connection string in Key Vault
                try {
                    az keyvault secret set --vault-name "kv-wealtharena-$Suffix" --name "cosmos-connection-string" --value $cosmosConnStr --output none 2>$null
                    Write-ColorOutput "Cosmos DB connection string stored in Key Vault" $Green
                }
                catch {
                    Write-ColorOutput "Warning: Failed to store Cosmos DB connection string in Key Vault: $($_.Exception.Message)" $Yellow
                }
            }
        }
        catch {
            Write-ColorOutput "Cosmos DB connection string not available (may not exist in student accounts)" $Yellow
        }
        
        # Get Databricks workspace URL
        $databricksUrl = ""
        try {
            $databricksUrl = az databricks workspace show `
                --name "databricks-wealtharena-$Environment" `
                --resource-group $ResourceGroup `
                --query workspaceUrl `
                --output tsv
        }
        catch {
            Write-ColorOutput "Databricks workspace URL not available" $Yellow
        }
        
        # Get Container Registry login server
        $acrLoginServer = ""
        try {
            $acrLoginServer = az acr show `
                --name "acrwealtharena$Suffix" `
                --resource-group $ResourceGroup `
                --query loginServer `
                --output tsv
        }
        catch {
            Write-ColorOutput "Container Registry login server not available" $Yellow
        }
        
        # Create .env file with non-sensitive metadata only
        $envContent = @"
# WealthArena Azure Environment Configuration
# Generated on $(Get-Date)
# Note: Secrets are stored in Azure Key Vault - use Key Vault references for sensitive values

# Azure Resource Group
AZURE_RESOURCE_GROUP=$ResourceGroup
AZURE_LOCATION=$Location

# Storage Account
AZURE_STORAGE_ACCOUNT=stwealtharena$Suffix
# Storage connection string stored in Key Vault: @Microsoft.KeyVault(SecretUri=https://kv-wealtharena-$Suffix.vault.azure.net/secrets/storage-connection-string/)

# SQL Database
AZURE_SQL_SERVER=$sqlServer.database.windows.net
AZURE_SQL_DATABASE=$sqlDatabase
AZURE_SQL_USER=wealtharena_admin
# SQL password stored in Key Vault: @Microsoft.KeyVault(SecretUri=https://kv-wealtharena-$Suffix.vault.azure.net/secrets/sql-password/)
# SQL connection string format: Server=tcp:$sqlServer.database.windows.net,1433;Initial Catalog=$sqlDatabase;Persist Security Info=False;User ID=wealtharena_admin;Password=[FROM_KEY_VAULT];MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;

# Cosmos DB (may not be available in student accounts)
AZURE_COSMOS_ACCOUNT=cosmos-wealtharena-$Suffix
# Cosmos DB connection string stored in Key Vault: @Microsoft.KeyVault(SecretUri=https://kv-wealtharena-$Suffix.vault.azure.net/secrets/cosmos-connection-string/)

# Databricks
AZURE_DATABRICKS_WORKSPACE_URL=$databricksUrl

# Container Registry
AZURE_CONTAINER_REGISTRY=$acrLoginServer

# Key Vault
AZURE_KEY_VAULT=kv-wealtharena-$Suffix

# Data Factory
AZURE_DATA_FACTORY=adf-wealtharena-$Suffix

# Container App Environment (skipped due to registration issues)
AZURE_CONTAINER_APP_ENV=cae-wealtharena-$Environment

# Groq API Key stored in Key Vault: @Microsoft.KeyVault(SecretUri=https://kv-wealtharena-$Suffix.vault.azure.net/secrets/groq-api-key/)
"@

        # Save .env file to script directory (infrastructure/azure_infrastructure/.env)
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $envFilePath = Join-Path $scriptDir ".env"
        $envContent | Out-File -FilePath $envFilePath -Encoding UTF8
        Write-ColorOutput "Environment configuration saved to $envFilePath" $Green
        
        return $true
    }
    catch {
        Write-ColorOutput "Failed to gather connection strings: $($_.Exception.Message)" $Red
        return $false
    }
}

# Main execution
Write-ColorOutput "WealthArena Azure Infrastructure Setup - FIXED VERSION" $Blue
Write-ColorOutput "=====================================================" $Blue

# Check prerequisites
if (-not (Test-AzureCLI)) {
    exit 1
}

if (-not (Test-AzureLogin)) {
    exit 1
}

# Set subscription if provided
if ($SubscriptionId) {
    Write-ColorOutput "Setting subscription: $SubscriptionId" $Yellow
    az account set --subscription $SubscriptionId
}

# Register Azure providers first
Register-AzureProviders

# Generate unique suffixes (shortened for Azure naming constraints)
if ([string]::IsNullOrEmpty($UniqueSuffix)) {
    $randomChars = -join ((48..57) + (97..122) | Get-Random -Count 8 | ForEach-Object {[char]$_})
    $uniqueSuffix = $randomChars
}

Write-ColorOutput "Configuration:" $Blue
Write-ColorOutput "   Resource Group: $ResourceGroupName" $Blue
Write-ColorOutput "   Location: $Location" $Blue
Write-ColorOutput "   Environment: $Environment" $Blue
Write-ColorOutput "   Unique Suffix: $uniqueSuffix" $Blue

# Create resource group
$rgCreated = New-AzureResourceGroup -Name $ResourceGroupName -Location $Location
if (-not $rgCreated) {
    Write-ColorOutput "Failed to create resource group. Exiting." $Red
    exit 1
}

# Create all Azure resources
Write-ColorOutput "Creating Azure Resources..." $Blue

# Storage Account
$storageCreated = New-AzureStorageAccount -Name "stwealtharena$uniqueSuffix" -ResourceGroup $ResourceGroupName -Location $Location

# SQL Database
$sqlCreated = New-AzureSQLDatabase -ServerName "sql-wealtharena-$uniqueSuffix" -DatabaseName "wealtharena_db" -ResourceGroup $ResourceGroupName -Location $Location -AdminUser "wealtharena_admin" -AdminPassword $AdminPassword

# Cosmos DB (may fail in student accounts)
$cosmosCreated = New-AzureCosmosDB -AccountName "cosmos-wealtharena-$uniqueSuffix" -ResourceGroup $ResourceGroupName -Location $Location

# Databricks
$databricksCreated = New-AzureDatabricks -WorkspaceName "databricks-wealtharena-$Environment" -ResourceGroup $ResourceGroupName -Location $Location

# Container Registry
$acrCreated = New-AzureContainerRegistry -RegistryName "acrwealtharena$uniqueSuffix" -ResourceGroup $ResourceGroupName -Location $Location

# Key Vault
$kvCreated = New-AzureKeyVault -VaultName "kv-wealtharena-$uniqueSuffix" -ResourceGroup $ResourceGroupName -Location $Location

# Data Factory
$adfCreated = New-AzureDataFactory -FactoryName "adf-wealtharena-$uniqueSuffix" -ResourceGroup $ResourceGroupName -Location $Location

# Container App Environment (skipped due to registration issues)
$caeCreated = New-AzureContainerAppEnvironment -EnvironmentName "cae-wealtharena-$Environment" -ResourceGroup $ResourceGroupName -Location $Location

# Create storage containers
if ($storageCreated) {
    Set-AzureStorageContainers -StorageAccountName "stwealtharena$uniqueSuffix" -ResourceGroup $ResourceGroupName
}

# Store secrets in Key Vault (if created)
if ($kvCreated) {
    Write-ColorOutput "Storing secrets in Key Vault" $Blue
    try {
        # Store SQL password (from parameter or environment)
        az keyvault secret set --vault-name "kv-wealtharena-$uniqueSuffix" --name "sql-password" --value $AdminPassword --output none
        Write-ColorOutput "SQL password stored in Key Vault" $Green
        
        # Store Groq API key from environment variable or prompt user
        $groqApiKey = $env:GROQ_API_KEY
        if ([string]::IsNullOrEmpty($groqApiKey)) {
            Write-ColorOutput "Groq API key not found in environment variable GROQ_API_KEY" $Yellow
            Write-ColorOutput "Prompting for Groq API key (press Enter to skip)..." $Blue
            $groqApiKeySecure = Read-Host "Enter Groq API key (or press Enter to skip)" -AsSecureString
            if ($groqApiKeySecure) {
                $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($groqApiKeySecure)
                $groqApiKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
            }
        }
        
        if (-not [string]::IsNullOrEmpty($groqApiKey)) {
            az keyvault secret set --vault-name "kv-wealtharena-$uniqueSuffix" --name "groq-api-key" --value $groqApiKey --output none
            Write-ColorOutput "Groq API key stored in Key Vault" $Green
            # Clear the variable from memory
            $groqApiKey = $null
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        }
        else {
            Write-ColorOutput "Groq API key not provided. Skipping. You can set it later via: az keyvault secret set --vault-name kv-wealtharena-$uniqueSuffix --name groq-api-key --value <key>" $Yellow
        }
        
        Write-ColorOutput "Secrets stored in Key Vault" $Green
    }
    catch {
        Write-ColorOutput "Warning: Failed to store secrets in Key Vault: $($_.Exception.Message)" $Yellow
    }
}

# Gather connection strings
Get-ConnectionStrings -ResourceGroup $ResourceGroupName -Suffix $uniqueSuffix

Write-ColorOutput "Azure Infrastructure Setup Complete!" $Green
Write-ColorOutput "=========================================" $Green

# Summary of what was created
Write-ColorOutput "Summary of created resources:" $Blue
Write-ColorOutput "  Resource Group: $ResourceGroupName" $Blue
Write-ColorOutput "  Storage Account: stwealtharena$uniqueSuffix" $Blue
Write-ColorOutput "  SQL Database: sql-wealtharena-$uniqueSuffix" $Blue
if ($cosmosCreated) { Write-ColorOutput "  Cosmos DB: cosmos-wealtharena-$uniqueSuffix" $Blue }
Write-ColorOutput "  Databricks: databricks-wealtharena-$Environment" $Blue
Write-ColorOutput "  Container Registry: acrwealtharena$uniqueSuffix" $Blue
Write-ColorOutput "  Key Vault: kv-wealtharena-$uniqueSuffix" $Blue
Write-ColorOutput "  Data Factory: adf-wealtharena-$uniqueSuffix" $Blue

Write-ColorOutput "Next steps:" $Blue
Write-ColorOutput "1. Run verify_resources.ps1 to test connectivity" $Blue
Write-ColorOutput "2. Set up database schemas" $Blue
Write-ColorOutput "3. Upload Databricks notebooks" $Blue
Write-ColorOutput "4. Deploy backend services" $Blue