# WealthArena GCP Master Deployment Script
# Orchestrates deployment of all three services to GCP App Engine

param(
    [string]$ProjectId = "wealtharena-prod",
    [switch]$SkipModels = $false
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

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
Set-Location $scriptDir

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena GCP Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Estimated time: 40-60 minutes" $Yellow
Write-ColorOutput ""

# Verify prerequisites
Write-ColorOutput "Verifying prerequisites..." $Blue
$account = gcloud auth list --format="value(account)" 2>$null
if (-not $account) {
    Write-ColorOutput "❌ Not authenticated. Please run 'gcloud auth login' first." $Red
    exit 1
}
Write-ColorOutput "✅ Authenticated as: $account" $Green

gcloud config set project $ProjectId | Out-Null
Write-ColorOutput "✅ Project set to: $ProjectId" $Green

# Verify project exists
$projectCheck = gcloud projects describe $ProjectId --format="value(projectId)" 2>$null
if (-not $projectCheck) {
    Write-ColorOutput "❌ Project $ProjectId does not exist. Run setup_gcp_infrastructure.ps1 first." $Red
    exit 1
}

# Verify App Engine initialized
$appEngine = gcloud app describe --format="value(name)" --project=$ProjectId 2>$null
if (-not $appEngine) {
    Write-ColorOutput "❌ App Engine not initialized. Run setup_gcp_infrastructure.ps1 first." $Red
    exit 1
}
Write-ColorOutput "✅ App Engine initialized" $Green

# Verify Cloud SQL instance exists
$sqlInstance = gcloud sql instances describe wealtharena-db --format="value(name)" --project=$ProjectId 2>$null
if (-not $sqlInstance) {
    Write-ColorOutput "❌ Cloud SQL instance not found. Run setup_gcp_infrastructure.ps1 first." $Red
    exit 1
}
Write-ColorOutput "✅ Cloud SQL instance exists" $Green
Write-ColorOutput ""

# Confirm deployment
Write-ColorOutput "Ready to deploy:" $Blue
Write-ColorOutput "  - Backend (default service)" $Blue
Write-ColorOutput "  - Chatbot (chatbot service)" $Blue
Write-ColorOutput "  - RL Service (rl-service service)" $Blue
Write-ColorOutput ""
$confirm = Read-Host "Continue with deployment? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-ColorOutput "Deployment cancelled." $Yellow
    exit 0
}
Write-ColorOutput ""

# Step 1: Deploy PostgreSQL Schema (if not already deployed)
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 1: Deploying PostgreSQL Schema" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "⚠️  Schema deployment requires Cloud SQL Proxy or direct connection." $Yellow
Write-ColorOutput "   Please deploy schema manually using:" $Yellow
Write-ColorOutput "   psql -h <ip> -U wealtharena_admin -d wealtharena_db -f database_schemas/postgresql_schema.sql" $Yellow
Write-ColorOutput ""
$response = Read-Host "Press Enter after schema is deployed (or if already deployed)"
Write-ColorOutput ""

# Step 2: Deploy Backend Service
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Deploying Backend Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Estimated time: 5-8 minutes" $Yellow
Write-ColorOutput ""

$backendDir = Join-Path $projectRoot "WealthArena_Backend"
if (-not (Test-Path $backendDir)) {
    Write-ColorOutput "❌ Backend directory not found: $backendDir" $Red
    exit 1
}

Set-Location $backendDir
Write-ColorOutput "Deploying backend service..." $Blue
gcloud app deploy app.yaml --project=$ProjectId --version=v1 --quiet 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    $backendUrl = "https://$ProjectId.appspot.com"
    Write-ColorOutput "✅ Backend deployed: $backendUrl" $Green
    
    # Test health endpoint
    Start-Sleep -Seconds 10
    try {
        $healthResponse = Invoke-WebRequest -Uri "$backendUrl/api/health" -Method Get -TimeoutSec 10 -UseBasicParsing
        if ($healthResponse.StatusCode -eq 200) {
            Write-ColorOutput "✅ Backend health check passed" $Green
        }
    } catch {
        Write-ColorOutput "⚠️  Health check failed (service may still be starting)" $Yellow
    }
} else {
    Write-ColorOutput "❌ Backend deployment failed" $Red
    exit 1
}
Write-ColorOutput ""

# Step 3: Deploy Chatbot Service
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 3: Deploying Chatbot Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Estimated time: 15-25 minutes" $Yellow
Write-ColorOutput "⚠️  This may take longer due to large dependencies (torch, transformers)" $Yellow
Write-ColorOutput ""

$chatbotDir = Join-Path $projectRoot "wealtharena_chatbot"
if (-not (Test-Path $chatbotDir)) {
    Write-ColorOutput "❌ Chatbot directory not found: $chatbotDir" $Red
    exit 1
}

Set-Location $chatbotDir
Write-ColorOutput "Deploying chatbot service..." $Blue
gcloud app deploy app.yaml --project=$ProjectId --version=v1 --quiet 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    $chatbotUrl = "https://chatbot-dot-$ProjectId.appspot.com"
    Write-ColorOutput "✅ Chatbot deployed: $chatbotUrl" $Green
    
    # Test health endpoint
    Start-Sleep -Seconds 10
    try {
        $healthResponse = Invoke-WebRequest -Uri "$chatbotUrl/healthz" -Method Get -TimeoutSec 10 -UseBasicParsing
        if ($healthResponse.StatusCode -eq 200) {
            Write-ColorOutput "✅ Chatbot health check passed" $Green
        }
    } catch {
        Write-ColorOutput "⚠️  Health check failed (service may still be starting)" $Yellow
    }
} else {
    Write-ColorOutput "❌ Chatbot deployment failed" $Red
    exit 1
}
Write-ColorOutput ""

# Step 4: Deploy RL Service
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 4: Deploying RL Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Estimated time: 20-30 minutes" $Yellow
Write-ColorOutput "⚠️  This may take longer due to Ray and PyTorch installation" $Yellow
Write-ColorOutput ""

$rlServiceDir = Join-Path $projectRoot "services" "rl-service"
if (-not (Test-Path $rlServiceDir)) {
    Write-ColorOutput "❌ RL Service directory not found: $rlServiceDir" $Red
    exit 1
}

Set-Location $rlServiceDir
Write-ColorOutput "Deploying RL service..." $Blue
gcloud app deploy app.yaml --project=$ProjectId --version=v1 --quiet 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    $rlServiceUrl = "https://rl-service-dot-$ProjectId.appspot.com"
    Write-ColorOutput "✅ RL Service deployed: $rlServiceUrl" $Green
    
    # Test health endpoint
    Start-Sleep -Seconds 10
    try {
        $healthResponse = Invoke-WebRequest -Uri "$rlServiceUrl/health" -Method Get -TimeoutSec 10 -UseBasicParsing
        if ($healthResponse.StatusCode -eq 200) {
            Write-ColorOutput "✅ RL Service health check passed" $Green
        }
    } catch {
        Write-ColorOutput "⚠️  Health check failed (service may still be starting)" $Yellow
    }
} else {
    Write-ColorOutput "❌ RL Service deployment failed" $Red
    exit 1
}
Write-ColorOutput ""

# Step 5: Upload Model Checkpoints (if not skipped)
if (-not $SkipModels) {
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "Step 5: Uploading Model Checkpoints" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput ""
    
    $checkpointsDir = Join-Path $projectRoot "wealtharena_rl" "checkpoints"
    if (Test-Path $checkpointsDir) {
        Write-ColorOutput "Uploading model checkpoints to Cloud Storage..." $Blue
        Write-ColorOutput "Estimated time: 5-10 minutes" $Yellow
        gsutil -m cp -r "$checkpointsDir/*" "gs://wealtharena-models/latest/" --project=$ProjectId 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Model checkpoints uploaded" $Green
            
            # Verify uploads
            $files = gsutil ls -r "gs://wealtharena-models/latest/" --project=$ProjectId 2>$null
            $fileCount = ($files | Measure-Object).Count
            Write-ColorOutput "✅ Uploaded $fileCount files" $Green
        } else {
            Write-ColorOutput "⚠️  Upload may have failed or models may already exist" $Yellow
        }
    } else {
        Write-ColorOutput "⚠️  No trained models found. RL service will use mock mode." $Yellow
        Write-ColorOutput "   To upload models later, run:" $Yellow
        Write-ColorOutput "   gsutil -m cp -r wealtharena_rl/checkpoints/* gs://wealtharena-models/latest/" $Yellow
    }
    Write-ColorOutput ""
}

# Step 6: Run Integration Tests
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 6: Integration Tests" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$backendUrl = "https://$ProjectId.appspot.com"
$chatbotUrl = "https://chatbot-dot-$ProjectId.appspot.com"
$rlServiceUrl = "https://rl-service-dot-$ProjectId.appspot.com"

Write-ColorOutput "Testing backend health..." $Blue
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/health" -Method Get -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-ColorOutput "✅ Backend: Healthy" $Green
    }
} catch {
    Write-ColorOutput "❌ Backend: Health check failed" $Red
}

Write-ColorOutput "Testing chatbot health..." $Blue
try {
    $response = Invoke-WebRequest -Uri "$chatbotUrl/healthz" -Method Get -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-ColorOutput "✅ Chatbot: Healthy" $Green
    }
} catch {
    Write-ColorOutput "❌ Chatbot: Health check failed" $Red
}

Write-ColorOutput "Testing RL service health..." $Blue
try {
    $response = Invoke-WebRequest -Uri "$rlServiceUrl/health" -Method Get -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-ColorOutput "✅ RL Service: Healthy" $Green
    }
} catch {
    Write-ColorOutput "❌ RL Service: Health check failed" $Red
}
Write-ColorOutput ""

# Step 7: Generate Deployment Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "🌐 Service URLs:" $Green
Write-ColorOutput "  Backend:    $backendUrl" $Green
Write-ColorOutput "  Chatbot:    $chatbotUrl" $Green
Write-ColorOutput "  RL Service: $rlServiceUrl" $Green
Write-ColorOutput ""

Write-ColorOutput "📊 Database:" $Green
Write-ColorOutput "  Instance: wealtharena-prod:us-central1:wealtharena-db" $Green
Write-ColorOutput "  Database: wealtharena_db" $Green
Write-ColorOutput "  Type: PostgreSQL 15" $Green
Write-ColorOutput ""

Write-ColorOutput "💾 Storage:" $Green
Write-ColorOutput "  Bucket: gs://wealtharena-models" $Green
Write-ColorOutput "  Models: latest/" $Green
Write-ColorOutput ""

Write-ColorOutput "💰 Estimated Cost:" $Yellow
Write-ColorOutput "  ~$110 for 2 weeks (within $300 free credits)" $Yellow
Write-ColorOutput ""

Write-ColorOutput "✅ All services deployed successfully!" $Green
Write-ColorOutput ""

Write-ColorOutput "📝 Next Steps:" $Cyan
Write-ColorOutput "  1. Copy .env.gcp to .env in WealthArena/ directory" $Yellow
Write-ColorOutput "  2. Test mobile app with GCP backend" $Yellow
Write-ColorOutput "  3. Monitor App Engine logs for errors" $Yellow
Write-ColorOutput "  4. Set up custom domain (optional)" $Yellow
Write-ColorOutput ""

Set-Location $scriptDir

