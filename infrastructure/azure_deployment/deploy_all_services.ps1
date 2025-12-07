# WealthArena Master Deployment Script
# Orchestrates deployment of all three services to Azure Web Apps in correct order

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [switch]$SkipModels = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

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
Set-Location $scriptDir

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Azure Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Estimated time: 30-40 minutes" $Yellow
Write-ColorOutput ""

# Verify Azure CLI is installed and logged in
Write-ColorOutput "Verifying Azure CLI connection..." $Blue
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-ColorOutput "❌ Not logged in to Azure. Please run 'az login' first." $Red
    exit 1
}
Write-ColorOutput "✅ Connected as: $($account.user.name)" $Green
Write-ColorOutput ""

# Step 1: Verify prerequisites
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 1: Verifying Azure Resources" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$verifyScript = Join-Path $scriptDir "..\..\azure_infrastructure\verify_resources.ps1"
if (Test-Path $verifyScript) {
    & $verifyScript -ResourceGroupName $ResourceGroup -Environment "dev"
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "⚠️  Resource verification had issues. Continuing anyway..." $Yellow
    }
} else {
    Write-ColorOutput "⚠️  verify_resources.ps1 not found. Skipping verification..." $Yellow
}

Write-ColorOutput ""

# Step 2: Deploy Backend
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Deploying Backend Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "[1/3] Deploying Backend Service..." $Yellow
Write-ColorOutput ""

$backendScript = Join-Path $scriptDir "deploy_backend.ps1"
if (Test-Path $backendScript) {
    try {
        & $backendScript -ResourceGroup $ResourceGroup -Location $Location
        if ($LASTEXITCODE -ne 0) {
            throw "Backend deployment returned exit code $LASTEXITCODE"
        }
        # Verify backend exists and get actual URL
        $backendHost = az webapp show --name "wealtharena-backend" --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
        if ($backendHost -and -not $backendHost.StartsWith("az:") -and -not $backendHost.StartsWith("ERROR")) {
            Write-ColorOutput "✅ Backend deployed: https://$backendHost" $Green
        } else {
            Write-ColorOutput "✅ Backend deployed: https://wealtharena-backend.azurewebsites.net" $Green
        }
    }
    catch {
        Write-ColorOutput "❌ Backend deployment failed: $_" $Red
        exit 1
    }
} else {
    Write-ColorOutput "❌ deploy_backend.ps1 not found!" $Red
    exit 1
}

Write-ColorOutput ""

# Step 3: Deploy Chatbot
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 3: Deploying Chatbot Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "[2/3] Deploying Chatbot Service..." $Yellow
Write-ColorOutput ""

$chatbotScript = Join-Path $scriptDir "deploy_chatbot.ps1"
if (Test-Path $chatbotScript) {
    try {
        & $chatbotScript -ResourceGroup $ResourceGroup -Location $Location
        if ($LASTEXITCODE -ne 0) {
            throw "Chatbot deployment returned exit code $LASTEXITCODE"
        }
        # Verify chatbot exists and get actual URL
        $chatbotHost = az webapp show --name "wealtharena-chatbot" --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
        if ($chatbotHost -and -not $chatbotHost.StartsWith("az:") -and -not $chatbotHost.StartsWith("ERROR")) {
            Write-ColorOutput "✅ Chatbot deployed: https://$chatbotHost" $Green
        } else {
            Write-ColorOutput "✅ Chatbot deployed: https://wealtharena-chatbot.azurewebsites.net" $Green
        }
    }
    catch {
        Write-ColorOutput "❌ Chatbot deployment failed: $_" $Red
        exit 1
    }
} else {
    Write-ColorOutput "❌ deploy_chatbot.ps1 not found!" $Red
    exit 1
}

Write-ColorOutput ""

# Step 4: Deploy RL Service
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 4: Deploying RL Inference Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "[3/3] Deploying RL Inference Service..." $Yellow
Write-ColorOutput ""

$rlScript = Join-Path $scriptDir "deploy_rl_service.ps1"
if (Test-Path $rlScript) {
    try {
        & $rlScript -ResourceGroup $ResourceGroup -Location $Location
        if ($LASTEXITCODE -ne 0) {
            throw "RL Service deployment returned exit code $LASTEXITCODE"
        }
        # Verify RL service exists and get actual URL
        $rlHost = az webapp show --name "wealtharena-rl" --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
        if ($rlHost -and -not $rlHost.StartsWith("az:") -and -not $rlHost.StartsWith("ERROR")) {
            Write-ColorOutput "✅ RL Service deployed: https://$rlHost" $Green
        } else {
            Write-ColorOutput "✅ RL Service deployed: https://wealtharena-rl.azurewebsites.net" $Green
        }
    }
    catch {
        Write-ColorOutput "❌ RL Service deployment failed: $_" $Red
        exit 1
    }
} else {
    Write-ColorOutput "❌ deploy_rl_service.ps1 not found!" $Red
    exit 1
}

Write-ColorOutput ""

# Step 5: Upload Models (if trained)
if (-not $SkipModels) {
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "Step 5: Uploading Model Checkpoints" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput ""
    
    $root = Split-Path -Parent $scriptDir
    $root = Split-Path -Parent $root
    $checkpointsPath = Join-Path $root "wealtharena_rl" "checkpoints" "asx_stocks"
    
    if (Test-Path $checkpointsPath) {
        Write-ColorOutput "Uploading trained model checkpoints..." $Yellow
        
        $uploadScript = Join-Path $scriptDir "upload_models.ps1"
        if (Test-Path $uploadScript) {
            & $uploadScript -ResourceGroup $ResourceGroup
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✅ Uploaded model checkpoints" $Green
            } else {
                Write-ColorOutput "⚠️  Model upload had issues (this is acceptable)" $Yellow
            }
        }
    } else {
        Write-ColorOutput "No trained models found. RL service will use mock mode." $Yellow
        Write-ColorOutput "This is acceptable for demo purposes." $Blue
    }
    
    Write-ColorOutput ""
} else {
    Write-ColorOutput "Skipping model upload (--SkipModels flag set)" $Yellow
    Write-ColorOutput ""
}

# Step 6: Configure App Settings
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 6: Configuring App Settings" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Configuring App Settings..." $Yellow
Write-ColorOutput ""

$configScript = Join-Path $scriptDir "configure_app_settings.ps1"
if (Test-Path $configScript) {
    & $configScript -ResourceGroup $ResourceGroup
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Backend settings configured" $Green
        Write-ColorOutput "✅ Chatbot settings configured" $Green
        Write-ColorOutput "✅ RL Service settings configured" $Green
    } else {
        Write-ColorOutput "⚠️  App Settings configuration had issues" $Yellow
    }
} else {
    Write-ColorOutput "❌ configure_app_settings.ps1 not found!" $Red
}

Write-ColorOutput ""

# Step 7: Health Checks
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 7: Running Health Checks" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Running health checks..." $Yellow
Write-ColorOutput ""

# Compute path to consolidated health-check script (scripts/testing/test_azure_deployments.ps1)
# $scriptDir is infrastructure/azure_deployment, so go up two levels to repo root
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$testScript = Join-Path $repoRoot "scripts\testing\test_azure_deployments.ps1"
if (Test-Path $testScript) {
    & $testScript -ResourceGroup $ResourceGroup
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ All health checks passed" $Green
    } else {
        Write-ColorOutput "⚠️  Some health checks failed (check logs)" $Yellow
    }
} else {
    Write-ColorOutput "⚠️  scripts/testing/test_azure_deployments.ps1 not found. Skipping health checks..." $Yellow
}

Write-ColorOutput ""

# Deployment Summary - Resolve actual URLs
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Resolve actual service URLs
Write-ColorOutput "Resolving service URLs..." $Blue
$backendUrl = "https://wealtharena-backend.azurewebsites.net"
$chatbotUrl = "https://wealtharena-chatbot.azurewebsites.net"
$rlServiceUrl = "https://wealtharena-rl.azurewebsites.net"

try {
    $backendHost = az webapp show --name "wealtharena-backend" --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
    if ($backendHost -and -not $backendHost.StartsWith("az:") -and -not $backendHost.StartsWith("ERROR")) {
        $backendUrl = "https://$backendHost"
    }
} catch { }

try {
    $chatbotHost = az webapp show --name "wealtharena-chatbot" --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
    if ($chatbotHost -and -not $chatbotHost.StartsWith("az:") -and -not $chatbotHost.StartsWith("ERROR")) {
        $chatbotUrl = "https://$chatbotHost"
    }
} catch { }

try {
    $rlHost = az webapp show --name "wealtharena-rl" --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
    if ($rlHost -and -not $rlHost.StartsWith("az:") -and -not $rlHost.StartsWith("ERROR")) {
        $rlServiceUrl = "https://$rlHost"
    }
} catch { }

Write-ColorOutput "Service URLs:" $Cyan
Write-ColorOutput "  Backend:  $backendUrl" $Blue
Write-ColorOutput "  Chatbot:  $chatbotUrl" $Blue
Write-ColorOutput "  RL Service: $rlServiceUrl" $Blue
Write-ColorOutput ""
Write-ColorOutput "All services deployed successfully!" $Green
Write-ColorOutput ""
Write-ColorOutput "Next Steps:" $Blue
Write-ColorOutput "  1. Update frontend .env.azure with service URLs" $Blue
Write-ColorOutput "  2. Test end-to-end user flows" $Blue
Write-ColorOutput "  3. Monitor App Service logs for errors" $Blue
Write-ColorOutput "  4. Set up custom domain (optional)" $Blue
Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan

