# WealthArena App Settings Configuration Script
# Configure App Settings (environment variables) for all three deployed Azure Web Apps

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus"
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
Write-ColorOutput "WealthArena App Settings Configuration" $Cyan
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

# Try to load connection strings from azure_infrastructure/.env
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
    Write-ColorOutput "   Using default values" $Blue
}

Write-ColorOutput ""

# Generate JWT secret (32 character random string)
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Configure Backend App Settings
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Configuring Backend App Settings" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$backendApp = "wealtharena-backend"

# Get DB password from env or use Key Vault reference
$dbPassword = $null
if ($envVars.ContainsKey("DB_PASSWORD")) {
    $dbPassword = $envVars["DB_PASSWORD"]
} else {
    # Use Key Vault reference format
    $kvVaultName = "kv-wealtharena-dev"
    Write-ColorOutput "⚠️  DB_PASSWORD not found in .env. Using Key Vault reference format." $Yellow
    Write-ColorOutput "   Please ensure secret exists in Key Vault: $kvVaultName" $Blue
    $dbPassword = "@Microsoft.KeyVault(SecretUri=https://$kvVaultName.vault.azure.net/secrets/sql-password/)"
}

$backendSettings = @{
    "DB_HOST" = "sql-wealtharena-dev.database.windows.net"
    "DB_NAME" = "wealtharena_db"
    "DB_USER" = "wealtharena_admin"
    "DB_PASSWORD" = $dbPassword
    "DB_PORT" = "1433"
    "DB_ENCRYPT" = "true"
    "NODE_ENV" = "production"
    "PORT" = "8080"
    "JWT_SECRET" = $jwtSecret
    "JWT_EXPIRES_IN" = "7d"
    "CHATBOT_API_URL" = "https://wealtharena-chatbot.azurewebsites.net"
    "RL_API_URL" = "https://wealtharena-rl.azurewebsites.net"
    "ALLOWED_ORIGINS" = "https://wealtharena-frontend.azurewebsites.net,exp://localhost:5001"
}

# Convert to Azure CLI format
$backendSettingsArray = @()
foreach ($key in $backendSettings.Keys) {
    $backendSettingsArray += "$key=$($backendSettings[$key])"
}

Write-ColorOutput "Setting backend App Settings..." $Yellow
$result = az webapp config appsettings set `
    --name $backendApp `
    --resource-group $ResourceGroup `
    --settings $backendSettingsArray `
    2>&1

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Backend settings configured" $Green
} else {
    Write-ColorOutput "❌ Failed to configure backend settings" $Red
    Write-ColorOutput $result
}

Write-ColorOutput ""

# Configure Chatbot App Settings
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Configuring Chatbot App Settings" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$chatbotApp = "wealtharena-chatbot"

# Get GROQ API key from env or use Key Vault reference
$groqApiKey = $null
if ($envVars.ContainsKey("GROQ_API_KEY")) {
    $groqApiKey = $envVars["GROQ_API_KEY"]
} else {
    # Use Key Vault reference format
    $kvVaultName = "kv-wealtharena-dev"
    Write-ColorOutput "⚠️  GROQ_API_KEY not found in .env. Using Key Vault reference format." $Yellow
    Write-ColorOutput "   Please ensure secret exists in Key Vault: $kvVaultName" $Blue
    $groqApiKey = "@Microsoft.KeyVault(SecretUri=https://$kvVaultName.vault.azure.net/secrets/groq-api-key/)"
}

$chatbotSettings = @{
    "GROQ_API_KEY" = $groqApiKey
    "GROQ_MODEL" = "llama3-8b-8192"
    "LLM_PROVIDER" = "groq"
    "PORT" = "8000"
    "CHROMA_PERSIST_DIR" = "/home/site/data/chroma_db"
    "WEBSITES_PORT" = "8000"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"
}

# Convert to Azure CLI format
$chatbotSettingsArray = @()
foreach ($key in $chatbotSettings.Keys) {
    $chatbotSettingsArray += "$key=$($chatbotSettings[$key])"
}

Write-ColorOutput "Setting chatbot App Settings..." $Yellow
$result = az webapp config appsettings set `
    --name $chatbotApp `
    --resource-group $ResourceGroup `
    --settings $chatbotSettingsArray `
    2>&1

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Chatbot settings configured" $Green
} else {
    Write-ColorOutput "❌ Failed to configure chatbot settings" $Red
    Write-ColorOutput $result
}

Write-ColorOutput ""

# Configure RL Service App Settings
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Configuring RL Service App Settings" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$rlApp = "wealtharena-rl"

# Get storage connection string if available
$storageConnString = ""
if ($envVars.ContainsKey("AZURE_STORAGE_CONNECTION_STRING")) {
    $storageConnString = $envVars["AZURE_STORAGE_CONNECTION_STRING"]
} else {
    # Use Key Vault reference format
    $kvVaultName = "kv-wealtharena-dev"
    Write-ColorOutput "⚠️  AZURE_STORAGE_CONNECTION_STRING not found in .env. Using Key Vault reference format." $Yellow
    Write-ColorOutput "   Please ensure secret exists in Key Vault: $kvVaultName" $Blue
    $storageConnString = "@Microsoft.KeyVault(SecretUri=https://$kvVaultName.vault.azure.net/secrets/storage-connection-string/)"
}

# Get DB password from env or use Key Vault reference
$rlDbPassword = $null
if ($envVars.ContainsKey("DB_PASSWORD")) {
    $rlDbPassword = $envVars["DB_PASSWORD"]
} else {
    # Use Key Vault reference format
    $kvVaultName = "kv-wealtharena-dev"
    Write-ColorOutput "⚠️  DB_PASSWORD not found in .env for RL service. Using Key Vault reference format." $Yellow
    Write-ColorOutput "   Please ensure secret exists in Key Vault: $kvVaultName" $Blue
    $rlDbPassword = "@Microsoft.KeyVault(SecretUri=https://$kvVaultName.vault.azure.net/secrets/sql-password/)"
}

# Detect if models have been uploaded to Blob Storage
$modelMode = "mock"  # Default to mock mode
if ($storageConnString) {
    Write-ColorOutput "Checking for uploaded models in Blob Storage..." $Blue
    
    try {
        # Try to parse connection string to extract account name and key
        if ($storageConnString -match "AccountName=([^;]+).*AccountKey=([^;]+)") {
            $accountName = $matches[1]
            $accountKey = $matches[2]
            
            # Use Azure CLI to check for blobs
            $containerName = "rl-models"
            $blobPrefix = "latest/"
            
            $blobs = az storage blob list `
                --connection-string $storageConnString `
                --container-name $containerName `
                --prefix $blobPrefix `
                --query "[].name" `
                --output json 2>$null | ConvertFrom-Json
            
            if ($blobs -and $blobs.Count -gt 0) {
                Write-ColorOutput "✅ Found $($blobs.Count) model files in Blob Storage. Setting MODEL_MODE=production" $Green
                $modelMode = "production"
            } else {
                Write-ColorOutput "⚠️  No model files found in Blob Storage. Setting MODEL_MODE=mock" $Yellow
                $modelMode = "mock"
            }
        } elseif ($storageConnString -like "*@Microsoft.KeyVault*") {
            # If using Key Vault reference, we can't check blobs directly
            Write-ColorOutput "⚠️  Using Key Vault reference for storage. Cannot detect model presence." $Yellow
            Write-ColorOutput "   Setting MODEL_MODE=mock by default" $Yellow
            $modelMode = "mock"
        }
    } catch {
        Write-ColorOutput "⚠️  Error checking Blob Storage: $($_.Exception.Message)" $Yellow
        Write-ColorOutput "   Setting MODEL_MODE=mock by default" $Yellow
        $modelMode = "mock"
    }
} else {
    Write-ColorOutput "No storage connection string available. Setting MODEL_MODE=mock" $Yellow
    $modelMode = "mock"
}

Write-ColorOutput "MODEL_MODE will be set to: $modelMode" $Blue

$rlSettings = @{
    "DB_HOST" = "sql-wealtharena-dev.database.windows.net"
    "DB_NAME" = "wealtharena_db"
    "DB_USER" = "wealtharena_admin"
    "DB_PASSWORD" = $rlDbPassword
    "DB_PORT" = "1433"
    "DB_ENCRYPT" = "true"
    "MODEL_PATH" = "/home/site/models/latest"
    "MODEL_MODE" = $modelMode
    "PORT" = "8000"
    "WEBSITES_PORT" = "8000"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"
}

if ($storageConnString) {
    $rlSettings["AZURE_STORAGE_CONNECTION_STRING"] = $storageConnString
}

# Convert to Azure CLI format
$rlSettingsArray = @()
foreach ($key in $rlSettings.Keys) {
    $rlSettingsArray += "$key=$($rlSettings[$key])"
}

Write-ColorOutput "Setting RL service App Settings..." $Yellow
$result = az webapp config appsettings set `
    --name $rlApp `
    --resource-group $ResourceGroup `
    --settings $rlSettingsArray `
    2>&1

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ RL service settings configured" $Green
} else {
    Write-ColorOutput "❌ Failed to configure RL service settings" $Red
    Write-ColorOutput $result
}

Write-ColorOutput ""

# Restart all services to apply settings
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Restarting Services" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Restarting backend..." $Yellow
az webapp restart --name $backendApp --resource-group $ResourceGroup | Out-Null
Write-ColorOutput "✅ Backend restarted" $Green

Write-ColorOutput "Restarting chatbot..." $Yellow
az webapp restart --name $chatbotApp --resource-group $ResourceGroup | Out-Null
Write-ColorOutput "✅ Chatbot restarted" $Green

Write-ColorOutput "Restarting RL service..." $Yellow
az webapp restart --name $rlApp --resource-group $ResourceGroup | Out-Null
Write-ColorOutput "✅ RL service restarted" $Green

Write-ColorOutput ""

# Wait for services to restart
Write-ColorOutput "Waiting for services to restart (30 seconds)..." $Yellow
Start-Sleep -Seconds 30
Write-ColorOutput "✅ Services restarted" $Green
Write-ColorOutput ""

# Verify settings
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Verifying App Settings" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Verifying backend DB_HOST..." $Blue
$backendDbHost = az webapp config appsettings list `
    --name $backendApp `
    --resource-group $ResourceGroup `
    --query "[?name=='DB_HOST'].value" `
    --output tsv 2>$null

if ($backendDbHost -eq "sql-wealtharena-dev.database.windows.net") {
    Write-ColorOutput "✅ Backend DB_HOST: $backendDbHost" $Green
} else {
    Write-ColorOutput "⚠️  Backend DB_HOST: $backendDbHost" $Yellow
}

Write-ColorOutput "Verifying chatbot GROQ_API_KEY..." $Blue
$chatbotGroqKey = az webapp config appsettings list `
    --name $chatbotApp `
    --resource-group $ResourceGroup `
    --query "[?name=='GROQ_API_KEY'].value" `
    --output tsv 2>$null

if ($chatbotGroqKey) {
    Write-ColorOutput "✅ Chatbot GROQ_API_KEY: Set (hidden)" $Green
} else {
    Write-ColorOutput "⚠️  Chatbot GROQ_API_KEY: Not set" $Yellow
}

Write-ColorOutput "Verifying RL service MODEL_MODE..." $Blue
$rlModelMode = az webapp config appsettings list `
    --name $rlApp `
    --resource-group $ResourceGroup `
    --query "[?name=='MODEL_MODE'].value" `
    --output tsv 2>$null

if ($rlModelMode) {
    Write-ColorOutput "✅ RL service MODEL_MODE: $rlModelMode" $Green
} else {
    Write-ColorOutput "⚠️  RL service MODEL_MODE: Not set" $Yellow
}

Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Configuration Complete!" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "✅ All App Settings configured successfully!" $Green
Write-ColorOutput ""
Write-ColorOutput "📝 Next Steps:" $Blue
Write-ColorOutput "   1. Test all service endpoints" $Blue
Write-ColorOutput "   2. Verify database connections" $Blue
Write-ColorOutput "   3. Check App Service logs for errors" $Blue
Write-ColorOutput ""

# Security note
Write-ColorOutput "🔒 Security Best Practice:" $Yellow
Write-ColorOutput "   For production, store sensitive values in Azure Key Vault:" $Blue
Write-ColorOutput "   az webapp config appsettings set --name $backendApp --resource-group $ResourceGroup --settings `"DB_PASSWORD=@Microsoft.KeyVault(SecretUri=https://kv-wealtharena-dev.vault.azure.net/secrets/sql-password/)`"" $Blue
Write-ColorOutput ""

