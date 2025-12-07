# Restart Chatbot Service Script
Write-Host "=== Restarting Chatbot Service ===" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Find and stop existing Python processes running the chatbot
Write-Host "Stopping existing chatbot service..." -ForegroundColor Yellow
$processes = Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*main.py*" -or $_.CommandLine -like "*uvicorn*app.main*"
}

if ($processes) {
    foreach ($proc in $processes) {
        Write-Host "Stopping process ID: $($proc.Id)" -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "No existing chatbot process found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Starting chatbot service..." -ForegroundColor Green
Write-Host "Service will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""

# Start the chatbot service
Start-Process python -ArgumentList "main.py" -WorkingDirectory $scriptDir -NoNewWindow

Write-Host "Waiting for service to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test if service is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/healthz" -Method GET -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Chatbot service is running!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Testing GROQ_API_KEY loading..." -ForegroundColor Yellow
        $testResponse = Invoke-RestMethod -Uri "http://localhost:8000/v1/chat" -Method POST -Body '{"message":"test"}' -ContentType "application/json" -ErrorAction Stop
        if ($testResponse.reply -like "*Chatbot service is not properly configured*") {
            Write-Host "❌ GROQ_API_KEY still not loading. Check the .env file." -ForegroundColor Red
        } else {
            Write-Host "✅ GROQ_API_KEY is loaded correctly!" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "⚠️  Service may still be starting. Check manually at http://localhost:8000/healthz" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Restart Complete ===" -ForegroundColor Cyan

