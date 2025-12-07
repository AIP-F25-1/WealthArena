# WealthArena Chatbot Azure Functions Deployment Script
# Deploys chatbot as HTTP-triggered Azure Functions using Consumption Plan (no App Service Plan required)

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [string]$FunctionAppName = "wealtharena-chatbot-functions",
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
$chatbotDir = Join-Path $root "chatbot"

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Chatbot Functions Deployment" $Cyan
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
        --runtime python `
        --runtime-version 3.11 `
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

# Derive Key Vault name
if ([string]::IsNullOrWhiteSpace($KeyVault)) {
    if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
        $suffix = $matches[1]
        $KeyVault = "kv-wealtharena-$suffix"
    } else {
        $KeyVault = "kv-wealtharena-dev"
    }
}

# Get GROQ API key
$groqApiKey = $null
if ($envVars.ContainsKey("GROQ_API_KEY")) {
    $groqApiKey = $envVars["GROQ_API_KEY"]
} else {
    $groqApiKey = "@Microsoft.KeyVault(SecretUri=https://$KeyVault.vault.azure.net/secrets/groq-api-key/)"
}

$appSettings = @(
    "FUNCTIONS_WORKER_RUNTIME=python",
    "FUNCTIONS_EXTENSION_VERSION=~4",
    "PYTHON_ENABLE_WORKER_EXTENSIONS=1",
    "WEBSITE_TIME_ZONE=UTC",
    "GROQ_API_KEY=$groqApiKey",
    "GROQ_MODEL=llama3-8b-8192",
    "LLM_PROVIDER=groq",
    "PORT=8000",
    "CHROMA_PERSIST_DIR=/tmp/chroma_db"
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

# Step 4: Warning about dependencies
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 3: Dependency Size Warning" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "CRITICAL: Chatbot dependencies exceed Consumption Plan limits" $Yellow
Write-ColorOutput "   - torch + transformers + chromadb ≈ 2GB" $Yellow
Write-ColorOutput "   - Consumption Plan limit: 1.5GB" $Yellow
Write-ColorOutput ""
Write-ColorOutput "Solutions:" $Blue
Write-ColorOutput "   1. Use Azure Container Apps instead (recommended)" $Blue
Write-ColorOutput "      Run: deploy_chatbot_containerapp.ps1" $Blue
Write-ColorOutput "   2. Use Azure Functions Premium Plan (EP1)" $Blue
Write-ColorOutput "   3. Use CPU-only torch version to reduce size" $Blue
Write-ColorOutput "   4. Consider in-memory Chroma DB fallback (no persistence)" $Blue
Write-ColorOutput ""

# Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Function App: $FunctionAppName" $Cyan
Write-ColorOutput "Plan: Consumption (serverless, no App Service Plan required)" $Blue
Write-ColorOutput ""
Write-ColorOutput "Recommendation: Use Container Apps instead" $Yellow
Write-ColorOutput "   - Better for large dependencies (torch, transformers)" $Blue
Write-ColorOutput "   - Supports persistent storage for Chroma DB" $Blue
Write-ColorOutput "   - No code restructuring required" $Blue
Write-ColorOutput "   - See: deploy_chatbot_containerapp.ps1" $Blue
Write-ColorOutput ""

