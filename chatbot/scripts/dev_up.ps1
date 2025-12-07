param([int]$Port=8000)

$ErrorActionPreference = "Stop"
Write-Host "`n== WealthArena: dev_up ==" -ForegroundColor Green
Set-Location (Split-Path -Parent $PSScriptRoot)

# Check Python installation
Write-Host "`n[1/5] Checking Python installation..." -ForegroundColor Cyan
try {
    $pythonVersion = py -3 --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        $pythonVersion = python --version 2>&1
    }
    Write-Host "   Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: Python 3 not found. Install from https://python.org" -ForegroundColor Red
    exit 1
}

# Check if port is already in use
Write-Host "`n[2/5] Checking port $Port availability..." -ForegroundColor Cyan
try {
    $portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host "   WARNING: Port $Port is already in use" -ForegroundColor Yellow
        Write-Host "   Kill process with: netstat -ano | findstr :$Port" -ForegroundColor Yellow
        Write-Host "   Or use a different port: scripts/dev_up.ps1 -Port 8001" -ForegroundColor Yellow
        $continue = Read-Host "   Continue anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            exit 1
        }
    } else {
        Write-Host "   Port $Port is available" -ForegroundColor Green
    }
} catch {
    # Get-NetTCPConnection might not be available on older Windows versions
    # Try alternative method using netstat
    $netstatOutput = netstat -ano | Select-String ":$Port "
    if ($netstatOutput) {
        Write-Host "   WARNING: Port $Port appears to be in use" -ForegroundColor Yellow
        Write-Host "   Kill process with: netstat -ano | findstr :$Port" -ForegroundColor Yellow
        Write-Host "   Or use a different port: scripts/dev_up.ps1 -Port 8001" -ForegroundColor Yellow
        $continue = Read-Host "   Continue anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            exit 1
        }
    } else {
        Write-Host "   Port $Port appears to be available" -ForegroundColor Green
    }
}

# Create logs directory
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# venv
Write-Host "`n[3/5] Setting up virtual environment..." -ForegroundColor Cyan
if (!(Test-Path ".venv")) {
    Write-Host "   Creating virtual environment..." -ForegroundColor Yellow
    py -3 -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        python -m venv .venv
    }
    Write-Host "   Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "   Virtual environment already exists" -ForegroundColor Green
}
. .\.venv\Scripts\Activate.ps1

# deps
Write-Host "`n[4/5] Installing dependencies..." -ForegroundColor Cyan
pip install -U pip 2>&1 | Tee-Object -FilePath "logs/pip_install.log" | Out-Null
pip install -r requirements.txt --use-deprecated=legacy-resolver 2>&1 | Tee-Object -FilePath "logs/pip_install.log" -Append | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Initial install failed, clearing pip cache and retrying..." -ForegroundColor Yellow
    pip cache purge
    pip install -r requirements.txt --use-pep517 2>&1 | Tee-Object -FilePath "logs/pip_install.log" -Append | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ERROR: Failed to install dependencies after retry" -ForegroundColor Red
        Write-Host "   Check logs/pip_install.log for details" -ForegroundColor Red
        Write-Host "   Try manual install: pip install -r requirements.txt" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "   Dependencies installed successfully" -ForegroundColor Green

# ingest KB
Write-Host "`n[5/5] Ingesting knowledge base..." -ForegroundColor Cyan
python scripts/kb_ingest.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERROR: Knowledge base ingestion failed" -ForegroundColor Red
    Write-Host "   Check the error above and fix before starting server" -ForegroundColor Red
    exit 1
}

# Verify vectorstore was created
if (Test-Path "data/vectorstore") {
    $docCount = (Get-ChildItem "data/vectorstore" -Recurse -File | Measure-Object).Count
    Write-Host "   Knowledge base ready ($docCount files in vectorstore)" -ForegroundColor Green
} else {
    Write-Host "   WARNING: data/vectorstore directory not found after ingestion" -ForegroundColor Yellow
}

# run API
Write-Host "`n" + "="*70 -ForegroundColor Green
Write-Host "Starting FastAPI server..." -ForegroundColor Green
Write-Host "="*70 -ForegroundColor Green
$env:APP_HOST="127.0.0.1"
$env:APP_PORT="$Port"
Write-Host "Server will be available at: http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host "API docs: http://127.0.0.1:$Port/docs" -ForegroundColor Cyan
Write-Host "Health check: http://127.0.0.1:$Port/healthz" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop the server`n" -ForegroundColor Yellow

# Start server (this will block until Ctrl+C)
python -m uvicorn app.main:app --host $env:APP_HOST --port $env:APP_PORT --log-level debug
