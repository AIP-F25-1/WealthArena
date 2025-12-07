# Comprehensive metrics runner that handles server startup and metrics collection
param(
    [int]$Port = 8000,
    [int]$Runs = 5,
    [switch]$SkipServerStart = $false
)

$ErrorActionPreference = "Stop"
Write-Host "`n== WealthArena: Complete Metrics Runner ==" -ForegroundColor Green
Set-Location (Split-Path -Parent $PSScriptRoot)

# Function to check if server is running
function Test-ServerRunning {
    param([string]$Url, [int]$Timeout = 5)
    try {
        $response = Invoke-WebRequest -Uri "$Url/healthz" -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Function to start server in background
function Start-ServerBackground {
    param([int]$Port)
    
    Write-Host "`n[Starting Server] Activating virtual environment..." -ForegroundColor Cyan
    . .\.venv\Scripts\Activate.ps1
    
    if (-not (Test-Path ".venv")) {
        Write-Host "❌ Virtual environment not found. Run scripts/dev_up.ps1 first." -ForegroundColor Red
        exit 1
    }
    
    # Check if port is in use
    $portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host "⚠️  Port $Port is already in use. Attempting to use existing server..." -ForegroundColor Yellow
        if (Test-ServerRunning "http://127.0.0.1:$Port") {
            Write-Host "✅ Server is already running on port $Port" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Port $Port is in use but server is not responding. Please free the port." -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "[Starting Server] Starting FastAPI server on port $Port..." -ForegroundColor Cyan
    $env:APP_HOST = "127.0.0.1"
    $env:APP_PORT = "$Port"
    
    # Start server in background job
    $job = Start-Job -ScriptBlock {
        param($Host, $Port)
        Set-Location $using:PWD
        . .\.venv\Scripts\Activate.ps1
        $env:APP_HOST = $Host
        $env:APP_PORT = $Port
        python -m uvicorn app.main:app --host $Host --port $Port
    } -ArgumentList "127.0.0.1", $Port
    
    Write-Host "[Starting Server] Waiting for server to start..." -ForegroundColor Cyan
    $maxWait = 30
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2
        if (Test-ServerRunning "http://127.0.0.1:$Port") {
            Write-Host "✅ Server started successfully on port $Port" -ForegroundColor Green
            return $true, $job
        }
        Write-Host "   Waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
    }
    
    Write-Host "❌ Server failed to start within $maxWait seconds" -ForegroundColor Red
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -ErrorAction SilentlyContinue
    return $false, $null
}

# Main execution
try {
    # Step 1: Start server if needed
    $serverJob = $null
    if (-not $SkipServerStart) {
        $serverRunning = Test-ServerRunning "http://127.0.0.1:$Port"
        if (-not $serverRunning) {
            $result, $serverJob = Start-ServerBackground -Port $Port
            if (-not $result) {
                exit 1
            }
            # Give server a moment to fully initialize
            Start-Sleep -Seconds 3
        } else {
            Write-Host "✅ Server is already running" -ForegroundColor Green
        }
    } else {
        if (-not (Test-ServerRunning "http://127.0.0.1:$Port")) {
            Write-Host "❌ Server is not running and --SkipServerStart was specified" -ForegroundColor Red
            exit 1
        }
    }
    
    # Step 2: Verify server is ready
    Write-Host "`n[Verifying Server] Checking server health..." -ForegroundColor Cyan
    if (-not (Test-ServerRunning "http://127.0.0.1:$Port")) {
        Write-Host "❌ Server health check failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Server is healthy" -ForegroundColor Green
    
    # Step 3: Run metrics
    Write-Host "`n[Running Metrics] Starting metrics collection..." -ForegroundColor Cyan
    . .\.venv\Scripts\Activate.ps1
    python scripts/print_metrics.py --url "http://127.0.0.1:$Port" --runs $Runs
    
    $metricsExitCode = $LASTEXITCODE
    if ($metricsExitCode -ne 0) {
        Write-Host "`n⚠️  Metrics script exited with code $metricsExitCode" -ForegroundColor Yellow
    } else {
        Write-Host "`n✅ Metrics collection completed successfully" -ForegroundColor Green
    }
    
    # Step 4: Display metrics file if it exists
    $metricsFile = "metrics/runtime_http.json"
    if (Test-Path $metricsFile) {
        Write-Host "`n[Metrics Summary] Reading metrics file..." -ForegroundColor Cyan
        $metrics = Get-Content $metricsFile | ConvertFrom-Json
        $separator = "=" * 70
        Write-Host "`n$separator" -ForegroundColor Green
        Write-Host "METRICS SUMMARY" -ForegroundColor Green
        Write-Host $separator -ForegroundColor Green
        Write-Host "Timestamp: $($metrics.timestamp)" -ForegroundColor Cyan
        Write-Host "Base URL: $($metrics.base_url)" -ForegroundColor Cyan
        Write-Host ""
        
        if ($metrics.overall) {
            Write-Host "Overall:" -ForegroundColor Yellow
            Write-Host "  Success Rate: $([math]::Round($metrics.overall.success_rate_pct, 2))%" -ForegroundColor White
            Write-Host "  Avg Latency: $([math]::Round($metrics.overall.avg_latency_ms, 2)) ms" -ForegroundColor White
            Write-Host "  P50: $([math]::Round($metrics.overall.p50_ms, 2)) ms" -ForegroundColor White
            Write-Host "  P95: $([math]::Round($metrics.overall.p95_ms, 2)) ms" -ForegroundColor White
            Write-Host "  Total Requests: $($metrics.overall.total_requests)" -ForegroundColor White
            Write-Host "  Successful: $($metrics.overall.successful_requests)" -ForegroundColor White
        }
        
        if ($metrics.chatbot) {
            Write-Host "`nChatbot (/v1/explain):" -ForegroundColor Yellow
            Write-Host "  Inference: $([math]::Round($metrics.chatbot.inference_ms, 2)) ms" -ForegroundColor White
            if ($metrics.chatbot.rouge_l) {
                Write-Host "  ROUGE-L: $([math]::Round($metrics.chatbot.rouge_l, 3))" -ForegroundColor White
            }
            if ($metrics.chatbot.bert_f1) {
                Write-Host "  BERT-F1: $([math]::Round($metrics.chatbot.bert_f1, 3))" -ForegroundColor White
            }
        }
        
        if ($metrics.retrieval) {
            Write-Host "`nRetrieval (/v1/search):" -ForegroundColor Yellow
            Write-Host "  Latency: $([math]::Round($metrics.retrieval.latency_ms, 2)) ms" -ForegroundColor White
            if ($metrics.retrieval.map5) {
                Write-Host "  MAP@5: $([math]::Round($metrics.retrieval.map5, 3))" -ForegroundColor White
            }
            if ($metrics.retrieval.mrr5) {
                Write-Host "  MRR@5: $([math]::Round($metrics.retrieval.mrr5, 3))" -ForegroundColor White
            }
        }
        
        if ($metrics.endpoints) {
            Write-Host "`nEndpoint Details:" -ForegroundColor Yellow
            foreach ($endpoint in $metrics.endpoints.PSObject.Properties) {
                $epData = $endpoint.Value
                Write-Host "  $($endpoint.Name):" -ForegroundColor Cyan
                Write-Host "    Success Rate: $([math]::Round($epData.success_rate_pct, 1))%)" -ForegroundColor White
                Write-Host "    Avg Latency: $([math]::Round($epData.avg_latency_ms, 2)) ms" -ForegroundColor White
                Write-Host "    P95: $([math]::Round($epData.p95_ms, 2)) ms" -ForegroundColor White
            }
        }
        
        $separator = "=" * 70
        Write-Host "`n$separator" -ForegroundColor Green
        Write-Host "Full metrics saved to: $metricsFile" -ForegroundColor Cyan
    }
    
    # Cleanup: Stop background server if we started it
    if ($serverJob) {
        Write-Host "`n[Cleanup] Stopping background server..." -ForegroundColor Cyan
        Stop-Job $serverJob -ErrorAction SilentlyContinue
        Remove-Job $serverJob -ErrorAction SilentlyContinue
        Write-Host "✅ Server stopped" -ForegroundColor Green
    }
    
    Write-Host "`n✅ All done!" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Error: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    if ($serverJob) {
        Stop-Job $serverJob -ErrorAction SilentlyContinue
        Remove-Job $serverJob -ErrorAction SilentlyContinue
    }
    exit 1
}

