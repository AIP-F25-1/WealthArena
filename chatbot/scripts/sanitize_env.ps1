<#
.SYNOPSIS
    Sanitizes .env file by replacing real API keys with placeholders
.DESCRIPTION
    Replaces real GROQ_API_KEY values with placeholder to prevent secret exposure
#>

$envFile = Join-Path $PSScriptRoot "..\.env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found at: $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "Sanitizing .env file..." -ForegroundColor Yellow

$content = Get-Content $envFile -Raw

# Pattern to match real Groq API keys (starts with gsk_ and is long)
# Match the specific exposed key
$exposedKey = "______"
$oldValue = "GROQ_API_KEY=$exposedKey"
$newValue = "GROQ_API_KEY=gsk_your_actual_key_here"

if ($content -like "*$exposedKey*") {
    $content = $content.Replace($oldValue, $newValue)
    Set-Content -Path $envFile -Value $content -NoNewline
    Write-Host "[OK] Replaced real API key with placeholder" -ForegroundColor Green
} else {
    Write-Host "[INFO] No real API keys found (already sanitized or using placeholder)" -ForegroundColor Cyan
}

Write-Host "[OK] .env file sanitized" -ForegroundColor Green

