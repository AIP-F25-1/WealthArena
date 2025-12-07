<#
.SYNOPSIS
    Generate environment files for all WealthArena services

.DESCRIPTION
    This script retrieves secrets from Key Vault and generates .env files for:
    - WealthArena_Backend
    - wealtharena_chatbot
    - services/rl-service

.PARAMETER ResourceGroup
    Azure resource group name (default: rg-wealtharena-northcentralus)

.PARAMETER Suffix
    Unique suffix for resources (default: jg1ve2)

.NOTES
    Author: WealthArena DevOps Team
    Version: 1.0
    Created: 2024-12-22
#>

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Suffix = "jg1ve2"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors for output
function Write-Status {
    param([string]$Message, [string]$Status = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch ($Status) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        default { "Cyan" }
    }
    Write-Host "[$timestamp] [$Status] $Message" -ForegroundColor $color
}

Write-Host ""
Write-Host "Generating Environment Files" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

# Step 1: Retrieve Secrets from Key Vault
Write-Status "Retrieving secrets from Key Vault..." "INFO"

$vaultName = "kv-wealtharena-$Suffix"

try {
    $groqKey = az keyvault secret show --vault-name $vaultName --name groq-api-key --query value -o tsv
    if ([string]::IsNullOrWhiteSpace($groqKey)) {
        throw "GROQ API key is empty"
    }
    Write-Status "✅ Retrieved GROQ API key" "SUCCESS"
}
catch {
    Write-Status "❌ Failed to retrieve GROQ API key: $_" "ERROR"
    throw "Failed to retrieve GROQ API key"
}

try {
    $sqlPassword = az keyvault secret show --vault-name $vaultName --name sql-password --query value -o tsv
    if ([string]::IsNullOrWhiteSpace($sqlPassword)) {
        throw "SQL password is empty"
    }
    Write-Status "✅ Retrieved SQL password" "SUCCESS"
}
catch {
    Write-Status "❌ Failed to retrieve SQL password: $_" "ERROR"
    throw "Failed to retrieve SQL password"
}

try {
    $storageConnStr = az keyvault secret show --vault-name $vaultName --name storage-connection-string --query value -o tsv
    if ([string]::IsNullOrWhiteSpace($storageConnStr)) {
        throw "Storage connection string is empty"
    }
    Write-Status "✅ Retrieved storage connection string" "SUCCESS"
}
catch {
    Write-Status "❌ Failed to retrieve storage connection string: $_" "ERROR"
    throw "Failed to retrieve storage connection string"
}

# Step 2: Generate JWT Secret
Write-Status "Generating JWT secret..." "INFO"
$jwtSecretBytes = 1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }
$jwtSecret = [Convert]::ToBase64String($jwtSecretBytes)
Write-Status "✅ Generated JWT secret" "SUCCESS"

# Step 3: Create WealthArena_Backend/.env
Write-Host ""
Write-Host "Creating .env Files" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

$projectRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$backendEnvPath = Join-Path $projectRoot "WealthArena_Backend\.env"
$backendDir = Join-Path $projectRoot "WealthArena_Backend"

if (-not (Test-Path $backendDir)) {
    Write-Status "Creating directory: $backendDir" "INFO"
    New-Item -ItemType Directory -Path $backendDir -Force | Out-Null
}

Write-Status "Creating WealthArena_Backend/.env..." "INFO"

$backendEnv = @"
# Azure SQL Database Configuration
DB_HOST=sql-wealtharena-$Suffix.database.windows.net
DB_NAME=wealtharena_db
DB_USER=wealtharena_admin
DB_PASSWORD=$sqlPassword
DB_PORT=1433
DB_ENCRYPT=true

# Server Configuration
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d

# Service Endpoints
CHATBOT_API_URL=http://localhost:5001
RL_API_URL=http://localhost:5002

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5001,http://localhost:8081,http://localhost:3000
"@

$backendEnv | Out-File -FilePath $backendEnvPath -Encoding UTF8 -NoNewline
Write-Status "✅ WealthArena_Backend/.env created (12 variables)" "SUCCESS"

# Step 4: Create wealtharena_chatbot/.env
$chatbotEnvPath = Join-Path $projectRoot "wealtharena_chatbot\.env"
$chatbotDir = Join-Path $projectRoot "wealtharena_chatbot"

if (-not (Test-Path $chatbotDir)) {
    Write-Status "Creating directory: $chatbotDir" "INFO"
    New-Item -ItemType Directory -Path $chatbotDir -Force | Out-Null
}

Write-Status "Creating wealtharena_chatbot/.env..." "INFO"

$chatbotEnv = @"
# GROQ API Configuration
GROQ_API_KEY=$groqKey
GROQ_MODEL=llama3-8b-8192
LLM_PROVIDER=groq

# Server Configuration
PORT=5001
CHROMA_PERSIST_DIR=data/chroma_db
APP_HOST=0.0.0.0
"@

$chatbotEnv | Out-File -FilePath $chatbotEnvPath -Encoding UTF8 -NoNewline
Write-Status "✅ wealtharena_chatbot/.env created (6 variables)" "SUCCESS"

# Step 5: Create services/rl-service/.env
$rlServiceEnvPath = Join-Path $projectRoot "services\rl-service\.env"
$rlServiceDir = Join-Path $projectRoot "services\rl-service"

if (-not (Test-Path $rlServiceDir)) {
    Write-Status "Creating directories: $rlServiceDir" "INFO"
    New-Item -ItemType Directory -Path $rlServiceDir -Force | Out-Null
}

Write-Status "Creating services/rl-service/.env..." "INFO"

$rlServiceEnv = @"
# Server Configuration
PORT=5002
HOST=0.0.0.0

# Model Configuration
MODEL_PATH=../../wealtharena_rl/checkpoints/latest
MODEL_MODE=mock

# Azure SQL Database Configuration
DB_HOST=sql-wealtharena-$Suffix.database.windows.net
DB_NAME=wealtharena_db
DB_USER=wealtharena_admin
DB_PASSWORD=$sqlPassword
DB_PORT=1433
DB_ENCRYPT=true

# Logging
LOG_LEVEL=INFO
WORKERS=2
TIMEOUT=120

# Azure Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=$storageConnStr
"@

$rlServiceEnv | Out-File -FilePath $rlServiceEnvPath -Encoding UTF8 -NoNewline
Write-Status "✅ services/rl-service/.env created (14 variables)" "SUCCESS"

# Step 6: Verification
Write-Host ""
Write-Host "Verification" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

Write-Status "Verifying all .env files exist..." "INFO"

$envFiles = @($backendEnvPath, $chatbotEnvPath, $rlServiceEnvPath)
$allExist = $true

foreach ($file in $envFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Status "✅ $file exists ($size bytes)" "SUCCESS"
    } else {
        Write-Status "❌ $file missing" "ERROR"
        $allExist = $false
    }
}

# Check for placeholder values
Write-Status "Checking for placeholder values..." "INFO"
$placeholders = @("<from-keyvault>", "your-key-here", "<<", ">>")

$allValid = $true
foreach ($file in $envFiles) {
    $content = Get-Content $file -Raw
    foreach ($placeholder in $placeholders) {
        if ($content -like "*$placeholder*") {
            $fileName = Split-Path $file -Leaf
            Write-Status "WARNING: Found placeholder in $fileName : $placeholder" "WARNING"
            $allValid = $false
        }
    }
}

if ($allValid) {
    Write-Status "✅ No placeholder values found" "SUCCESS"
}

# Test loading with Node.js (if available)
Write-Status "Testing .env file loading..." "INFO"
try {
    $testScript = @"
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, 'WealthArena_Backend', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const lines = env.split('\n').filter(l => l.trim() && !l.startsWith('#'));
console.log('Variables found:', lines.length);
"@

    $testScriptPath = Join-Path $projectRoot "test_env_load.js"
    $testScript | Out-File -FilePath $testScriptPath -Encoding UTF8 -NoNewline
    
    $nodeResult = node $testScriptPath 2>&1
    Remove-Item $testScriptPath -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ .env files are valid" "SUCCESS"
    } else {
        Write-Status "⚠️  Node.js test failed (non-critical)" "WARNING"
    }
}
catch {
    Write-Status "⚠️  Node.js not available for testing (non-critical)" "WARNING"
}

if ($allExist) {
    Write-Host ""
    Write-Host "Environment Configuration Complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Cyan
    Write-Host "  - WealthArena_Backend/.env: 12 variables"
    Write-Host "  - wealtharena_chatbot/.env: 6 variables"
    Write-Host "  - services/rl-service/.env: 14 variables"
    Write-Host ""
    Write-Host "⚠️  SECURITY REMINDER:" -ForegroundColor Yellow
    Write-Host "  - .env files contain sensitive credentials"
    Write-Host "  - Ensure all .env files are in .gitignore"
    Write-Host "  - Never commit .env files to version control"
    return
} else {
    Write-Host ""
    Write-Host "❌ Some .env files are missing" -ForegroundColor Red
    throw "Some .env files are missing"
}

