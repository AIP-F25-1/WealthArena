# WealthArena Chatbot Deployment Script
# Deploy WealthArena chatbot to Azure Web App using az webapp up with Python 3.11 runtime

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$AppName = "wealtharena-chatbot",
    [string]$Location = "northcentralus",
    [string]$Sku = "B1",
    [string]$KeyVault = "",
    [string]$PlanName = "wealtharena-plan"
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
Set-Location $root

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Chatbot Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Verify Azure CLI is installed and logged in
Write-ColorOutput "Verifying Azure CLI connection..." $Blue
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-ColorOutput "❌ Not logged in to Azure. Please run 'az login' first." $Red
    exit 1
}
Write-ColorOutput "✅ Connected as: $($account.user.name)" $Green
Write-ColorOutput ""

# Verify resource group exists
Write-ColorOutput "Verifying resource group..." $Blue
$rg = az group show --name $ResourceGroup --output json 2>$null | ConvertFrom-Json
if (-not $rg) {
    Write-ColorOutput "❌ Resource group not found: $ResourceGroup" $Red
    Write-ColorOutput "Please run setup_master.ps1 to create infrastructure first." $Yellow
    exit 1
}
Write-ColorOutput "✅ Resource group exists: $ResourceGroup" $Green
Write-ColorOutput ""

# Verify or create shared App Service Plan
Write-ColorOutput "Verifying shared App Service Plan..." $Blue
if ([string]::IsNullOrWhiteSpace($PlanName)) {
    $PlanName = "wealtharena-plan"
}
$plan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json

if (-not $plan) {
    Write-ColorOutput "Creating shared App Service Plan: $PlanName" $Yellow
    $planResult = az appservice plan create `
        --name $PlanName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku $Sku `
        --is-linux `
        2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ App Service Plan created: $PlanName" $Green
        $plan = $planResult
    } else {
        Write-ColorOutput "❌ Failed to create App Service Plan" $Red
        exit 1
    }
} else {
    Write-ColorOutput "✅ App Service Plan exists: $PlanName" $Green
}
Write-ColorOutput ""

# Navigate to chatbot directory
$chatbotPath = Join-Path $root "chatbot"
if (-not (Test-Path $chatbotPath)) {
    Write-ColorOutput "❌ Chatbot directory not found: $chatbotPath" $Red
    exit 1
}

Set-Location $chatbotPath
Write-ColorOutput "📂 Chatbot directory: $chatbotPath" $Blue
Write-ColorOutput ""

# Verify requirements.txt exists
if (-not (Test-Path "requirements.txt")) {
    Write-ColorOutput "❌ requirements.txt not found in chatbot directory" $Red
    exit 1
}

# Deploy using az webapp up with shared plan
Write-ColorOutput "Deploying chatbot to Azure Web App..." $Yellow
Write-ColorOutput "This may take 8-12 minutes (pip install for 21 packages including torch, transformers)..." $Yellow
Write-ColorOutput ""

# Set Oryx build settings for Python heavy dependencies
Write-ColorOutput "Configuring Oryx build settings..." $Blue
az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true ENABLE_ORYX_BUILD=true `
    --output none 2>&1 | Out-Null

$deployOutput = az webapp up `
    --name $AppName `
    --resource-group $ResourceGroup `
    --plan $PlanName `
    --runtime "PYTHON:3.11" `
    --sku $Sku `
    --location $Location `
    2>&1

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "❌ Deployment failed!" $Red
    Write-ColorOutput $deployOutput
    exit 1
}

Write-ColorOutput "✅ Deployment successful!" $Green
Write-ColorOutput ""

# Get Web App URL
$webAppUrl = "https://$AppName.azurewebsites.net"
Write-ColorOutput "🌐 Chatbot URL: $webAppUrl" $Cyan
Write-ColorOutput ""

# Configure startup command
Write-ColorOutput "Configuring startup command..." $Yellow
$startupResult = az webapp config set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --startup-file "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2" `
    2>&1

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "⚠️ Warning: Failed to configure startup command" $Yellow
    Write-ColorOutput $startupResult
} else {
    Write-ColorOutput "✅ Startup command configured" $Green
}

Write-ColorOutput ""

# Configure App Settings
Write-ColorOutput "Configuring App Settings..." $Yellow

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
    Write-ColorOutput "✅ Loaded environment configuration" $Green
} else {
    Write-ColorOutput "⚠️  Environment file not found: $envFile" $Yellow
    Write-ColorOutput "   Secrets must be set manually or via Key Vault" $Blue
}

# Get GROQ API key from env or use Key Vault reference
$groqApiKey = $null
if ($envVars.ContainsKey("GROQ_API_KEY")) {
    $groqApiKey = $envVars["GROQ_API_KEY"]
} else {
    # Use Key Vault reference format - use parameter or derive from config
    if ([string]::IsNullOrWhiteSpace($KeyVault)) {
        # Try to derive from ResourceGroup suffix pattern
        if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
            $suffix = $matches[1]
            $KeyVault = "kv-wealtharena-$suffix"
        } else {
            $KeyVault = "kv-wealtharena-dev"
        }
    }
    $kvVaultName = $KeyVault
    Write-ColorOutput "⚠️  GROQ_API_KEY not found in .env. Using Key Vault reference format." $Yellow
    Write-ColorOutput "   Please ensure secret exists in Key Vault: $kvVaultName" $Blue
    $groqApiKey = "@Microsoft.KeyVault(SecretUri=https://$kvVaultName.vault.azure.net/secrets/groq-api-key/)"
}

$appSettings = @{
    "GROQ_API_KEY" = $groqApiKey
    "GROQ_MODEL" = "llama3-8b-8192"
    "LLM_PROVIDER" = "groq"
    "PORT" = "8000"
    "CHROMA_PERSIST_DIR" = "/home/site/data/chroma_db"
    "WEBSITES_PORT" = "8000"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"
    "ENABLE_ORYX_BUILD" = "true"
}

# Convert to Azure CLI format
$settingsArray = @()
foreach ($key in $appSettings.Keys) {
    $settingsArray += "$key=$($appSettings[$key])"
}

$settingsResult = az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings $settingsArray `
    2>&1

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "⚠️ Warning: Failed to configure some App Settings" $Yellow
    Write-ColorOutput $settingsResult
} else {
    Write-ColorOutput "✅ App Settings configured" $Green
}

Write-ColorOutput ""

# Enable system-assigned managed identity for Key Vault access
Write-ColorOutput "Enabling managed identity for Key Vault access..." $Yellow
try {
    $identityResult = az webapp identity assign `
        --name $AppName `
        --resource-group $ResourceGroup `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($identityResult.principalId) {
        Write-ColorOutput "✅ Managed identity enabled" $Green
        
        # Grant Key Vault access to the app's managed identity
        if ([string]::IsNullOrWhiteSpace($KeyVault)) {
            # Try to derive from ResourceGroup suffix pattern
            if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
                $suffix = $matches[1]
                $KeyVault = "kv-wealtharena-$suffix"
            } else {
                $KeyVault = "kv-wealtharena-dev"
            }
        }
        $kvVaultName = $KeyVault
        Write-ColorOutput "Granting Key Vault access to managed identity..." $Blue
        az keyvault set-policy `
            --name $kvVaultName `
            --object-id $identityResult.principalId `
            --secret-permissions get list `
            --output none 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Key Vault access granted" $Green
        } else {
            Write-ColorOutput "⚠️ Warning: Failed to grant Key Vault access" $Yellow
        }
    }
} catch {
    Write-ColorOutput "⚠️ Warning: Failed to enable managed identity: $_" $Yellow
}

Write-ColorOutput ""

# Restart Web App to apply settings
Write-ColorOutput "Restarting Web App..." $Yellow
az webapp restart --name $AppName --resource-group $ResourceGroup | Out-Null
Write-ColorOutput "✅ Web App restarted" $Green
Write-ColorOutput ""

# Wait for restart (60 seconds for Python build)
Write-ColorOutput "Waiting for service to start (60 seconds)..." $Yellow
Start-Sleep -Seconds 60

# Test health endpoint
Write-ColorOutput "Testing health endpoint..." $Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$webAppUrl/health" -Method Get -TimeoutSec 60 -UseBasicParsing -ErrorAction Stop
    if ($healthResponse.StatusCode -eq 200) {
        Write-ColorOutput "✅ Chatbot is healthy!" $Green
        # Try to parse JSON response if available
        try {
            $healthJson = $healthResponse.Content | ConvertFrom-Json
            if ($healthJson.status) {
                Write-ColorOutput "   Status: $($healthJson.status)" $Blue
            }
        } catch {
            # Not JSON, just check status code
        }
    } else {
        Write-ColorOutput "⚠️ Chatbot responded with status $($healthResponse.StatusCode)" $Yellow
    }
} catch {
    Write-ColorOutput "⚠️ Health check failed. Chatbot may still be starting..." $Yellow
    Write-ColorOutput "   Error: $($_.Exception.Message)" $Yellow
    Write-ColorOutput "   Check logs: az webapp log tail --name $AppName --resource-group $ResourceGroup" $Blue
}

Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "✅ Chatbot deployed successfully!" $Green
Write-ColorOutput "🌐 URL: $webAppUrl" $Cyan
Write-ColorOutput "📊 Health: $webAppUrl/health" $Blue
Write-ColorOutput "📚 API Docs: $webAppUrl/docs" $Blue
Write-ColorOutput ""
Write-ColorOutput "📝 Next Steps:" $Blue
Write-ColorOutput "   1. Verify GROQ API key in App Settings" $Blue
Write-ColorOutput "   2. Check App Service logs for any errors" $Blue
Write-ColorOutput "   3. Test chat endpoint: POST $webAppUrl/v1/chat" $Blue
Write-ColorOutput "   4. Proceed to deploy RL service" $Blue
Write-ColorOutput ""

# Troubleshooting tips
Write-ColorOutput "🔧 Troubleshooting:" $Yellow
Write-ColorOutput "   - If build timeout: Use --timeout 1800 (30 minutes)" $Blue
Write-ColorOutput "   - If torch installation fails: May need CPU-only version" $Blue
Write-ColorOutput "   - If Chroma fails: Service falls back to in-memory search" $Blue
Write-ColorOutput "   - View logs: az webapp log tail --name $AppName --resource-group $ResourceGroup" $Blue
Write-ColorOutput ""

