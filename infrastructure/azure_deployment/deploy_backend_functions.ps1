# WealthArena Backend Azure Functions Deployment Script
# Deploys backend as HTTP-triggered Azure Functions using Consumption Plan (no App Service Plan required)

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [string]$FunctionAppName = "wealtharena-backend-functions",
    [string]$StorageAccountName = "",
    [string]$KeyVault = ""
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

# Get root directory
$root = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $root
$backendDir = Join-Path $root "backend"

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Backend Functions Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Verify Azure CLI is installed and logged in
Write-ColorOutput "Verifying Azure CLI connection..." $Blue
$account = az account show --output json 2>&1 | ConvertFrom-Json
if (-not $account) {
    Write-ColorOutput "ERROR: Not logged in to Azure. Please run 'az login' first." $Red
    exit 1
}
Write-ColorOutput "Connected as: $($account.user.name)" $Green
Write-ColorOutput ""

# Verify resource group exists
Write-ColorOutput "Verifying resource group..." $Blue
$rg = az group show --name $ResourceGroup --output json 2>&1 | ConvertFrom-Json
if (-not $rg) {
    Write-ColorOutput "ERROR: Resource group not found: $ResourceGroup" $Red
    exit 1
}
Write-ColorOutput "Resource group exists: $ResourceGroup" $Green
Write-ColorOutput ""

# Get storage account name if not provided
if ([string]::IsNullOrEmpty($StorageAccountName)) {
    Write-ColorOutput "Getting storage account name from resource group..." $Blue
    $storageAccounts = az storage account list --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json
    if ($storageAccounts -and $storageAccounts.Count -gt 0) {
        $StorageAccountName = $storageAccounts[0].name
        Write-ColorOutput "Using storage account: $StorageAccountName" $Green
    }
    else {
        Write-ColorOutput "ERROR: No storage account found in resource group: $ResourceGroup" $Red
        exit 1
    }
}

# Step 1: Create Function App
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 1: Creating Azure Function App" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$functionAppExists = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json

if ($functionAppExists) {
    Write-ColorOutput "Function App already exists: $FunctionAppName" $Green
}
else {
    Write-ColorOutput "Creating Function App: $FunctionAppName (Consumption Plan)" $Blue
    
    # Create Function App (consumption plan - no App Service Plan required)
    $createResult = az functionapp create `
        --resource-group $ResourceGroup `
        --consumption-plan-location $Location `
        --runtime node `
        --runtime-version 20 `
        --functions-version 4 `
        --name $FunctionAppName `
        --storage-account $StorageAccountName `
        --os-type Linux `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "ERROR: Failed to create Function App: $createResult" $Red
        exit 1
    }
    
    Write-ColorOutput "Function App created: $FunctionAppName" $Green
}

Write-ColorOutput ""

# Step 2: Configure App Settings
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Configuring App Settings" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Load secrets from azure_infrastructure/.env if available
$envFile = Join-Path $root "azure_infrastructure" ".env"
$envVars = @{}

if (Test-Path $envFile) {
    Write-ColorOutput "Loading environment configuration from $envFile" $Blue
    $envContent = Get-Content $envFile
    
    foreach ($line in $envContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$key] = $value
        }
    }
    Write-ColorOutput "Loaded environment configuration" $Green
}

# Derive SQL Server and Key Vault names
if ([string]::IsNullOrWhiteSpace($KeyVault)) {
    if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
        $suffix = $matches[1]
        $KeyVault = "kv-wealtharena-$suffix"
    } else {
        $KeyVault = "kv-wealtharena-dev"
    }
}

$sqlServerHost = ""
if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
    $suffix = $matches[1]
    $sqlServerHost = "sql-wealtharena-$suffix.database.windows.net"
} else {
    $sqlServerHost = "sql-wealtharena-dev.database.windows.net"
}

# Get DB password
$dbPassword = $null
if ($envVars.ContainsKey("DB_PASSWORD")) {
    $dbPassword = $envVars["DB_PASSWORD"]
} else {
    $dbPassword = "@Microsoft.KeyVault(SecretUri=https://$KeyVault.vault.azure.net/secrets/sql-password/)"
}

# Generate JWT secret
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

$appSettings = @(
    "FUNCTIONS_WORKER_RUNTIME=node",
    "FUNCTIONS_EXTENSION_VERSION=~4",
    "WEBSITE_NODE_DEFAULT_VERSION=~20",
    "WEBSITE_TIME_ZONE=UTC",
    "DB_HOST=$sqlServerHost",
    "DB_NAME=wealtharena_db",
    "DB_USER=wealtharena_admin",
    "DB_PASSWORD=$dbPassword",
    "DB_PORT=1433",
    "DB_ENCRYPT=true",
    "NODE_ENV=production",
    "PORT=8080",
    "JWT_SECRET=$jwtSecret",
    "JWT_EXPIRES_IN=7d",
    "CHATBOT_API_URL=https://wealtharena-chatbot.azurewebsites.net",
    "RL_API_URL=https://wealtharena-rl.azurewebsites.net",
    "ALLOWED_ORIGINS=https://wealtharena-frontend.azurewebsites.net,exp://localhost:5001"
)

# Set app settings
az functionapp config appsettings set `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --settings $appSettings `
    --output none 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "App settings configured" $Green
} else {
    Write-ColorOutput "WARNING: Some app settings may not have been configured" $Yellow
}

Write-ColorOutput ""

# Step 3: Enable managed identity for Key Vault access
Write-ColorOutput "Enabling managed identity for Key Vault access..." $Yellow
try {
    $identityResult = az functionapp identity assign `
        --name $FunctionAppName `
        --resource-group $ResourceGroup `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($identityResult.principalId) {
        Write-ColorOutput "Managed identity enabled" $Green
        
        az keyvault set-policy `
            --name $KeyVault `
            --object-id $identityResult.principalId `
            --secret-permissions get list `
            --output none 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Key Vault access granted" $Green
        }
    }
} catch {
    Write-ColorOutput "WARNING: Failed to enable managed identity: $_" $Yellow
}

Write-ColorOutput ""

# Step 4: Verify Function App code structure exists
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 3: Verifying Function App Code Structure" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Check for required Function App files
$hostJsonPath = Join-Path $backendDir "host.json"
$functionsDir = Join-Path $backendDir "functions"

$codeReady = $false
if (Test-Path $hostJsonPath) {
    Write-ColorOutput "Found host.json file" $Green
    if (Test-Path $functionsDir) {
        # Check for at least one function.json file
        $functionJsonFiles = Get-ChildItem -Path $functionsDir -Filter "function.json" -Recurse -ErrorAction SilentlyContinue
        if ($functionJsonFiles -and $functionJsonFiles.Count -gt 0) {
            Write-ColorOutput "Found $($functionJsonFiles.Count) function(s) with function.json files" $Green
            $codeReady = $true
        } else {
            Write-ColorOutput "ERROR: No function.json files found in functions directory" $Red
        }
    } else {
        Write-ColorOutput "ERROR: Functions directory not found: $functionsDir" $Red
    }
} else {
    Write-ColorOutput "ERROR: host.json file not found: $hostJsonPath" $Red
}

if (-not $codeReady) {
    Write-ColorOutput "" $Red
    Write-ColorOutput "========================================" $Red
    Write-ColorOutput "ERROR: Function App code structure not ready" $Red
    Write-ColorOutput "========================================" $Red
    Write-ColorOutput "" $Red
    Write-ColorOutput "Backend code restructuring required before deployment:" $Yellow
    Write-ColorOutput "   1. Convert Express.js routes to individual Azure Functions" $Yellow
    Write-ColorOutput "   2. Create host.json file in backend directory" $Yellow
    Write-ColorOutput "   3. Create functions directory with individual function folders" $Yellow
    Write-ColorOutput "   4. Create function.json files for each endpoint" $Yellow
    Write-ColorOutput "   5. Update code to work with Azure Functions runtime" $Yellow
    Write-ColorOutput "" $Yellow
    Write-ColorOutput "This is currently a placeholder deployment path." $Yellow
    Write-ColorOutput "Use Container Apps instead (see deploy_backend_containerapp.ps1)" $Yellow
    Write-ColorOutput "   - Container Apps requires no code restructuring" $Yellow
    Write-ColorOutput "   - Works with existing Express.js application" $Yellow
    Write-ColorOutput "" $Yellow
    exit 1
}

Write-ColorOutput "Function App code structure verified" $Green
Write-ColorOutput ""

# Step 5: Deploy to Azure
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 4: Deploying to Azure Functions" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Deploying Function App code..." $Blue
# Note: Actual deployment would use: func azure functionapp publish $FunctionAppName
# This requires Azure Functions Core Tools to be installed
Write-ColorOutput "NOTE: Azure Functions deployment requires Azure Functions Core Tools" $Yellow
Write-ColorOutput "Install with: npm install -g azure-functions-core-tools@4" $Yellow
Write-ColorOutput ""

# Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Function App: $FunctionAppName" $Cyan
Write-ColorOutput "Plan: Consumption (serverless, no App Service Plan required)" $Blue
Write-ColorOutput ""
Write-ColorOutput "Next Steps:" $Yellow
Write-ColorOutput "   1. Restructure backend code to use Azure Functions" $Blue
Write-ColorOutput "   2. Convert Express.js routes to individual HTTP-triggered functions" $Blue
Write-ColorOutput "   3. Create function.json files for each endpoint" $Blue
Write-ColorOutput "   4. Deploy using: func azure functionapp publish $FunctionAppName" $Blue
Write-ColorOutput ""
Write-ColorOutput "Alternative: Use Container Apps instead (see deploy_backend_containerapp.ps1)" $Blue
Write-ColorOutput "   Container Apps requires no code restructuring" $Blue
Write-ColorOutput ""

