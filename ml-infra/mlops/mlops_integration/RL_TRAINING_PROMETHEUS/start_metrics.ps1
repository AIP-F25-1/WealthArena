# Start RL Training Metrics Server
# This script starts a test metrics server to generate sample RL training metrics

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RL Training Prometheus Metrics Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found. Please install Python first." -ForegroundColor Red
    exit 1
}

# Check if prometheus-client is installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
$hasPromClient = python -c "import prometheus_client; print('OK')" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing prometheus-client..." -ForegroundColor Yellow
    pip install prometheus-client
}

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $scriptDir "start_metrics_server.py"

Write-Host ""
Write-Host "Starting metrics server on port 8011..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
Write-Host "Metrics will be available at:" -ForegroundColor Green
Write-Host "  http://localhost:8011/metrics" -ForegroundColor Cyan
Write-Host ""
Write-Host "After starting, wait 10-15 seconds, then:" -ForegroundColor Yellow
Write-Host "  1. Go to Prometheus: http://127.0.0.1:9090" -ForegroundColor Cyan
Write-Host "  2. Try query: sum(rl_training_runs_total{})" -ForegroundColor Cyan
Write-Host ""

# Start the Python script
python $serverScript

