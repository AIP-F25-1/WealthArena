# Quick status check for WealthArena deployment
$url = "https://wealtharena-api-kanika.azurewebsites.net"

Write-Host "=== WealthArena Deployment Status Check ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health endpoint
Write-Host "1. Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$url/healthz" -TimeoutSec 15 -ErrorAction Stop
    Write-Host "   ✅ HEALTH CHECK PASSED!" -ForegroundColor Green
    Write-Host "   Response: $($health | ConvertTo-Json -Compress)" -ForegroundColor Gray
    $healthy = $true
} catch {
    Write-Host "   ❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    $healthy = $false
}

if ($healthy) {
    # Test 2: API Docs
    Write-Host "`n2. Checking API documentation..." -ForegroundColor Yellow
    try {
        $docs = Invoke-WebRequest -Uri "$url/docs" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        Write-Host "   ✅ API docs available at: $url/docs" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠ API docs: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # Test 3: Metrics endpoint
    Write-Host "`n3. Checking metrics endpoint..." -ForegroundColor Yellow
    try {
        $metrics = Invoke-WebRequest -Uri "$url/metrics" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        Write-Host "   ✅ Prometheus metrics available" -ForegroundColor Green
        Write-Host "   URL: $url/metrics" -ForegroundColor Gray
    } catch {
        Write-Host "   ⚠ Metrics: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # Test 4: Chat endpoint
    Write-Host "`n4. Testing chat endpoint..." -ForegroundColor Yellow
    try {
        $start = Get-Date
        $chat = Invoke-RestMethod -Uri "$url/v1/chat" -Method Post -ContentType "application/json" `
            -Body '{"message":"What is RSI?","user_id":"test"}' -TimeoutSec 20 -ErrorAction Stop
        $latency = ((Get-Date) - $start).TotalMilliseconds
        Write-Host "   ✅ Chat endpoint working!" -ForegroundColor Green
        Write-Host "   Latency: $([math]::Round($latency, 2)) ms" -ForegroundColor Cyan
        Write-Host "   Response preview: $($chat.response.Substring(0, [Math]::Min(80, $chat.response.Length)))..." -ForegroundColor Gray
    } catch {
        Write-Host "   ⚠ Chat test: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Write-Host "`n=== ✅ DEPLOYMENT SUCCESSFUL ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your WealthArena API is live at:" -ForegroundColor Cyan
    Write-Host "  - API: $url" -ForegroundColor White
    Write-Host "  - Docs: $url/docs" -ForegroundColor White
    Write-Host "  - Health: $url/healthz" -ForegroundColor White
    Write-Host "  - Metrics: $url/metrics" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "`n=== ⚠ DEPLOYMENT IN PROGRESS ===" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The app is still building. This can take 10-15 minutes for first deployment." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Check deployment status at:" -ForegroundColor Cyan
    Write-Host "  https://portal.azure.com" -ForegroundColor Gray
    Write-Host "  Or: https://wealtharena-api-kanika.scm.azurewebsites.net/api/deployments/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Run this script again in a few minutes to recheck." -ForegroundColor Cyan
}

