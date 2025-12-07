# Script to get WealthArena chatbot metrics
# Run this once your app is deployed and working

$BASE_URL = "https://wealtharena-api-kanika.azurewebsites.net"

Write-Host "=== WealthArena Chatbot Metrics ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Checking app health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/healthz" -TimeoutSec 5
    Write-Host "   ✓ App is healthy" -ForegroundColor Green
} catch {
    Write-Host "   ✗ App is not responding" -ForegroundColor Red
    exit 1
}

# Test 2: Get Prometheus Metrics
Write-Host "`n2. Fetching Prometheus metrics..." -ForegroundColor Yellow
try {
    $metrics = Invoke-WebRequest -Uri "$BASE_URL/metrics" -UseBasicParsing
    Write-Host "   ✓ Metrics available" -ForegroundColor Green
    Write-Host "`nChat Latency Metrics:" -ForegroundColor Cyan
    $metrics.Content | Select-String "chat_latency" | ForEach-Object { Write-Host "   $_" }
    Write-Host "`nChat Request Totals:" -ForegroundColor Cyan
    $metrics.Content | Select-String "chat_requests_total" | ForEach-Object { Write-Host "   $_" }
} catch {
    Write-Host "   ⚠ Prometheus metrics not available yet" -ForegroundColor Yellow
}

# Test 3: Get JSON Metrics
Write-Host "`n3. Fetching JSON metrics..." -ForegroundColor Yellow
try {
    $jsonMetrics = Invoke-RestMethod -Uri "$BASE_URL/v1/metrics"
    Write-Host "   ✓ JSON metrics available" -ForegroundColor Green
    Write-Host "`nCurrent Stats:" -ForegroundColor Cyan
    $jsonMetrics | ConvertTo-Json -Depth 3 | Write-Host
} catch {
    Write-Host "   ⚠ JSON metrics endpoint not available" -ForegroundColor Yellow
}

# Test 4: Test Chat Endpoint and Measure Latency
Write-Host "`n4. Testing chat endpoint (measuring latency)..." -ForegroundColor Yellow
try {
    $startTime = Get-Date
    $chatResponse = Invoke-RestMethod -Uri "$BASE_URL/v1/chat" -Method Post -ContentType "application/json" -Body (@{
        message = "What is RSI in trading?"
        user_id = "metrics-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    } | ConvertTo-Json) -TimeoutSec 15
    $endTime = Get-Date
    $latency = ($endTime - $startTime).TotalMilliseconds
    
    Write-Host "   ✓ Chat test successful!" -ForegroundColor Green
    Write-Host "   Response latency: $([math]::Round($latency, 2)) ms" -ForegroundColor Cyan
    Write-Host "   Response preview: $($chatResponse.response.Substring(0, [Math]::Min(100, $chatResponse.response.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Chat test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Metrics Collection Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "For continuous monitoring:" -ForegroundColor Yellow
Write-Host "  - Prometheus metrics: $BASE_URL/metrics" -ForegroundColor Gray
Write-Host "  - JSON metrics: $BASE_URL/v1/metrics" -ForegroundColor Gray
Write-Host "  - Background status: $BASE_URL/v1/background/status" -ForegroundColor Gray

