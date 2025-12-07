<#
.SYNOPSIS
    Fixes Azure container timeout issues by setting all required configuration
.DESCRIPTION
    Sets timeout values, ensures all required settings are configured, and restarts the app
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup
)

Write-Host "`n===============================================================" -ForegroundColor Cyan
Write-Host "  Fixing Azure Container Timeout Issues" -ForegroundColor Cyan
Write-Host "===============================================================`n" -ForegroundColor Cyan

# Read GROQ_API_KEY from .env if it exists
$groqKey = $null
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    $envLines = Get-Content $envFile
    foreach ($line in $envLines) {
        $trimmedLine = $line.Trim()
        if (-not [string]::IsNullOrWhiteSpace($trimmedLine) -and -not $trimmedLine.StartsWith("#")) {
            if ($trimmedLine -match '^GROQ_API_KEY\s*=\s*(.+)') {
                $groqKey = $matches[1].Trim()
                # Strip comments
                if ($groqKey -match '^([^#]+)') {
                    $groqKey = $matches[1].Trim()
                }
                # Remove quotes
                if ($groqKey -match '^"(.*)"$' -or $groqKey -match "^'(.*)'$") {
                    $groqKey = $matches[1].Trim()
                }
                break
            }
        }
    }
}

if (-not $groqKey -or $groqKey -eq "gsk_your_actual_key_here" -or $groqKey -eq "your_groq_api_key_here") {
    Write-Host "[WARN] No valid GROQ_API_KEY found in .env file" -ForegroundColor Yellow
    Write-Host "       You'll need to set it manually in Azure or update .env first" -ForegroundColor Yellow
}

# Get current settings to preserve existing values
Write-Host "[INFO] Reading current app settings..." -ForegroundColor Cyan
$currentSettings = az webapp config appsettings list --name $AppName --resource-group $ResourceGroup --output json | ConvertFrom-Json
$settingsHash = @{}
foreach ($setting in $currentSettings) {
    if ($setting.value) {
        $settingsHash[$setting.name] = $setting.value
    }
}

# Build settings string
$settingsToSet = @()

# Critical settings
$settingsToSet += "SCM_DO_BUILD_DURING_DEPLOYMENT=true"
$settingsToSet += "PYTHONPATH=/home/site/wwwroot"
$settingsToSet += "PYTHONUNBUFFERED=1"
$settingsToSet += "PORT=8000"

# Timeout settings to fix container timeout
$settingsToSet += "WEBSITES_CONTAINER_START_TIME_LIMIT=600"
$settingsToSet += "SCM_COMMAND_IDLE_TIMEOUT=1800"
$settingsToSet += "SCM_BUILD_TIMEOUT=1800"

# ChromaDB path for Azure
$settingsToSet += "CHROMA_PERSIST_DIR=/home/data/vectorstore"

# GROQ_API_KEY if we have it
if ($groqKey -and $groqKey -ne "gsk_your_actual_key_here" -and $groqKey -ne "your_groq_api_key_here") {
    $settingsToSet += "GROQ_API_KEY=$groqKey"
} elseif ($settingsHash.ContainsKey("GROQ_API_KEY")) {
    # Preserve existing key
    $settingsToSet += "GROQ_API_KEY=$($settingsHash['GROQ_API_KEY'])"
}

# Preserve other important settings if they exist
if ($settingsHash.ContainsKey("CORS_ALLOWED_ORIGINS")) {
    $settingsToSet += "CORS_ALLOWED_ORIGINS=$($settingsHash['CORS_ALLOWED_ORIGINS'])"
}

if ($settingsHash.ContainsKey("GROQ_MODEL")) {
    $settingsToSet += "GROQ_MODEL=$($settingsHash['GROQ_MODEL'])"
} else {
    $settingsToSet += "GROQ_MODEL=llama3-8b-8192"
}

if ($settingsHash.ContainsKey("LLM_PROVIDER")) {
    $settingsToSet += "LLM_PROVIDER=$($settingsHash['LLM_PROVIDER'])"
} else {
    $settingsToSet += "LLM_PROVIDER=groq"
}

# Set all settings at once
Write-Host "[INFO] Setting all app settings..." -ForegroundColor Cyan
$settingsString = $settingsToSet -join " "
az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings $settingsString --output none

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Settings updated successfully" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Failed to update settings" -ForegroundColor Red
    exit 1
}

# Verify startup command
Write-Host "[INFO] Verifying startup command..." -ForegroundColor Cyan
$config = az webapp config show --name $AppName --resource-group $ResourceGroup --output json | ConvertFrom-Json
if ($config.appCommandLine -ne "bash startup.sh") {
    Write-Host "[INFO] Setting startup command to 'bash startup.sh'..." -ForegroundColor Cyan
    az webapp config set --name $AppName --resource-group $ResourceGroup --startup-file "bash startup.sh" --output none
    Write-Host "[OK] Startup command set" -ForegroundColor Green
} else {
    Write-Host "[OK] Startup command already correct" -ForegroundColor Green
}

# Restart the app
Write-Host "`n[INFO] Restarting app..." -ForegroundColor Cyan
az webapp restart --name $AppName --resource-group $ResourceGroup --output none

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] App restarted" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Failed to restart app" -ForegroundColor Red
    exit 1
}

Write-Host "`n===============================================================" -ForegroundColor Cyan
Write-Host "  Configuration Complete" -ForegroundColor Cyan
Write-Host "===============================================================`n" -ForegroundColor Cyan

Write-Host "The app is now restarting with:" -ForegroundColor White
Write-Host "  - Container startup timeout: 600 seconds (10 minutes)" -ForegroundColor Gray
Write-Host "  - Build timeout: 1800 seconds (30 minutes)" -ForegroundColor Gray
Write-Host "  - All required environment variables set" -ForegroundColor Gray
Write-Host "`nMonitor the app status:" -ForegroundColor White
Write-Host "  az webapp log tail --name $AppName --resource-group $ResourceGroup" -ForegroundColor Yellow
Write-Host "`nTest health endpoint:" -ForegroundColor White
Write-Host "  https://$AppName.azurewebsites.net/healthz" -ForegroundColor Yellow
Write-Host "`nNote: First startup may take 10-15 minutes due to dependency installation." -ForegroundColor Cyan
Write-Host "===============================================================`n" -ForegroundColor Cyan

