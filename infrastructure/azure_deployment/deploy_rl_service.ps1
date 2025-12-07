# WealthArena RL Service Deployment Script
# Deploy WealthArena RL inference service to Azure Web App using az webapp up with Python 3.11 runtime

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$AppName = "wealtharena-rl",
    [string]$Location = "northcentralus",
    [string]$Sku = "B2",
    [string]$ModelMode = "mock",  # Optional: "mock" or "production"
    [string]$SqlServer = "",
    [string]$KeyVault = "",
    [string]$PlanName = "wealtharena-rl-plan"
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
Write-ColorOutput "WealthArena RL Service Deployment" $Cyan
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

# Note: B2 tier recommended for Ray and PyTorch (3.5GB RAM vs B1's 1.75GB)
Write-ColorOutput "ℹ️  Using B2 tier (3.5GB RAM) for Ray and PyTorch compatibility" $Blue
Write-ColorOutput ""

# Create separate App Service Plan for RL service (B2 tier for memory requirements)
# Or use shared plan if B2 is acceptable for all services
Write-ColorOutput "Verifying App Service Plan for RL service..." $Blue
if ([string]::IsNullOrWhiteSpace($PlanName)) {
    $PlanName = "wealtharena-rl-plan"
}
$plan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json

if (-not $plan) {
    Write-ColorOutput "Creating App Service Plan for RL service: $PlanName (B2 tier)" $Yellow
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

# Navigate to RL service directory
$rlPath = Join-Path $root "rl-service"
if (-not (Test-Path $rlPath)) {
    Write-ColorOutput "❌ RL service directory not found: $rlPath" $Red
    exit 1
}

Set-Location $rlPath
Write-ColorOutput "📂 RL service directory: $rlPath" $Blue
Write-ColorOutput ""

# Verify requirements.txt exists
if (-not (Test-Path "requirements.txt")) {
    Write-ColorOutput "❌ requirements.txt not found in RL service directory" $Red
    exit 1
}

# Deploy using az webapp up with dedicated plan (B2 for RL service)
Write-ColorOutput "Deploying RL service to Azure Web App..." $Yellow
Write-ColorOutput "This may take 10-15 minutes (pip install for Ray, PyTorch - large packages)..." $Yellow
Write-ColorOutput ""

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
Write-ColorOutput "🌐 RL Service URL: $webAppUrl" $Cyan
Write-ColorOutput ""

# Configure startup command
Write-ColorOutput "Configuring startup command..." $Yellow
# Check for main entry point
$apiInferenceFile = Join-Path $rlPath "api" "inference_server.py"
$mainFile = Join-Path $rlPath "main.py"
if (Test-Path $apiInferenceFile) {
    $startupCommand = "gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 --chdir api api.inference_server:app"
} elseif (Test-Path $mainFile) {
    $startupCommand = "uvicorn main:app --host 0.0.0.0 --port 8000"
} else {
    # Default fallback
    $startupCommand = "uvicorn main:app --host 0.0.0.0 --port 8000"
}
$startupResult = az webapp config set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --startup-file $startupCommand `
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

# Get storage connection string from env or use Key Vault reference
$storageConnString = ""
if ($envVars.ContainsKey("AZURE_STORAGE_CONNECTION_STRING")) {
    $storageConnString = $envVars["AZURE_STORAGE_CONNECTION_STRING"]
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
    Write-ColorOutput "⚠️  AZURE_STORAGE_CONNECTION_STRING not found in .env. Using Key Vault reference format." $Yellow
    Write-ColorOutput "   Please ensure secret exists in Key Vault: $kvVaultName" $Blue
    $storageConnString = "@Microsoft.KeyVault(SecretUri=https://$kvVaultName.vault.azure.net/secrets/storage-connection-string/)"
}

# Get DB password from env or use Key Vault reference
$dbPassword = $null
if ($envVars.ContainsKey("DB_PASSWORD")) {
    $dbPassword = $envVars["DB_PASSWORD"]
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
    Write-ColorOutput "⚠️  DB_PASSWORD not found in .env. Using Key Vault reference format." $Yellow
    Write-ColorOutput "   Please ensure secret exists in Key Vault: $kvVaultName" $Blue
    $dbPassword = "@Microsoft.KeyVault(SecretUri=https://$kvVaultName.vault.azure.net/secrets/sql-password/)"
}

# Derive SQL Server from parameter or ResourceGroup
$sqlServerHost = ""
if (-not [string]::IsNullOrWhiteSpace($SqlServer)) {
    $sqlServerHost = $SqlServer
} else {
    # Try to derive from ResourceGroup suffix pattern
    if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
        $suffix = $matches[1]
        $sqlServerHost = "sql-wealtharena-$suffix.database.windows.net"
    } else {
        $sqlServerHost = "sql-wealtharena-dev.database.windows.net"
    }
}

$appSettings = @{
    "DB_HOST" = $sqlServerHost
    "DB_NAME" = "wealtharena_db"
    "DB_USER" = "wealtharena_admin"
    "DB_PASSWORD" = $dbPassword
    "DB_PORT" = "1433"
    "DB_ENCRYPT" = "true"
    "MODEL_PATH" = "/home/site/models/latest"
    "MODEL_MODE" = $ModelMode
    "PORT" = "8000"
    "WEBSITES_PORT" = "8000"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"
}

if ($storageConnString) {
    $appSettings["AZURE_STORAGE_CONNECTION_STRING"] = $storageConnString
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

# Wait for restart (60 seconds for Python build and model loading)
Write-ColorOutput "Waiting for service to start (60 seconds for build + model loading)..." $Yellow
Start-Sleep -Seconds 60

# Test health endpoint
Write-ColorOutput "Testing health endpoint..." $Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$webAppUrl/health" -Method Get -TimeoutSec 60 -UseBasicParsing -ErrorAction Stop
    if ($healthResponse.StatusCode -eq 200) {
        Write-ColorOutput "✅ RL Service is healthy!" $Green
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
        Write-ColorOutput "⚠️ RL Service responded with status $($healthResponse.StatusCode)" $Yellow
    }
} catch {
    Write-ColorOutput "⚠️ Health check failed. RL Service may still be starting..." $Yellow
    Write-ColorOutput "   Error: $($_.Exception.Message)" $Yellow
    Write-ColorOutput "   Check logs: az webapp log tail --name $AppName --resource-group $ResourceGroup" $Blue
}

Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "✅ RL Service deployed successfully!" $Green
Write-ColorOutput "🌐 URL: $webAppUrl" $Cyan
Write-ColorOutput "📊 Health: $webAppUrl/health" $Blue
Write-ColorOutput ""
Write-ColorOutput "📝 Next Steps:" $Blue
Write-ColorOutput "   1. Upload model checkpoints to Azure Blob Storage (see upload_models.ps1)" $Blue
Write-ColorOutput "   2. Verify database connection in Azure Portal" $Blue
Write-ColorOutput "   3. Check App Service logs for any errors" $Blue
Write-ColorOutput "   4. Test prediction endpoint: POST $webAppUrl/predict" $Blue
Write-ColorOutput ""

# Troubleshooting tips
Write-ColorOutput "🔧 Troubleshooting:" $Yellow
Write-ColorOutput "   - If build timeout: Use --timeout 2400 (40 minutes)" $Blue
Write-ColorOutput "   - If OOM errors: Already using B2 tier (3.5GB RAM)" $Blue
Write-ColorOutput "   - If Ray fails to import: May need to use ray[default] instead of ray[rllib]" $Blue
Write-ColorOutput "   - If models not loading: Verify MODEL_PATH and Azure Blob Storage access" $Blue
Write-ColorOutput "   - If startup timeout: Increase health check grace period (600 seconds)" $Blue
Write-ColorOutput "   - View logs: az webapp log tail --name $AppName --resource-group $ResourceGroup" $Blue
Write-ColorOutput ""


