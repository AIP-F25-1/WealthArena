# WealthArena Master Container Apps Deployment Script
# Orchestrates deployment of all three services to Azure Container Apps

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus"
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
Write-ColorOutput "WealthArena Container Apps Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Estimated time: 50-60 minutes" $Yellow
Write-ColorOutput ""

# Verify Azure CLI is installed and logged in
Write-ColorOutput "Verifying Azure CLI connection..." $Blue
$accountOutput = az account show --output json 2>&1
$account = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $account = $accountOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "ERROR: Could not parse Azure account information" $Red
        Write-ColorOutput "Error details: $accountOutput" $Yellow
        exit 1
    }
}

if (-not $account -or -not $account.user) {
    Write-ColorOutput "ERROR: Not logged in to Azure. Please run 'az login' first." $Red
    if ($accountOutput) {
        Write-ColorOutput "Error details: $accountOutput" $Yellow
    }
    exit 1
}
Write-ColorOutput "Connected as: $($account.user.name)" $Green
Write-ColorOutput ""

# Verify resource group exists
Write-ColorOutput "Verifying resource group..." $Blue
$rgOutput = az group show --name $ResourceGroup --output json 2>&1
$rg = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $rg = $rgOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "ERROR: Could not parse resource group information" $Red
        Write-ColorOutput "Error details: $rgOutput" $Yellow
        exit 1
    }
}

if (-not $rg -or -not $rg.name) {
    Write-ColorOutput "ERROR: Resource group not found: $ResourceGroup" $Red
    Write-ColorOutput "Please run setup_master.ps1 to create infrastructure first." $Yellow
    if ($rgOutput) {
        Write-ColorOutput "Error details: $rgOutput" $Yellow
    }
    exit 1
}
Write-ColorOutput "Resource group exists: $ResourceGroup" $Green
Write-ColorOutput ""

# Verify Docker is installed and running
Write-ColorOutput "Verifying Docker prerequisites..." $Blue
$dockerCheck = docker --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Docker is not installed" $Red
    Write-ColorOutput "Please install Docker Desktop: https://www.docker.com/products/docker-desktop" $Yellow
    exit 1
}

$dockerPs = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Docker daemon is not running" $Red
    Write-ColorOutput "Please start Docker Desktop" $Yellow
    exit 1
}
Write-ColorOutput "Docker is installed and running" $Green
Write-ColorOutput ""

# Verify storage account exists
Write-ColorOutput "Verifying storage account..." $Blue
$storageAccountsOutput = az storage account list --resource-group $ResourceGroup --output json 2>&1
$storageAccounts = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $storageAccounts = $storageAccountsOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "ERROR: Could not parse storage account list" $Red
        Write-ColorOutput "Error details: $storageAccountsOutput" $Yellow
        exit 1
    }
}

if (-not $storageAccounts -or $storageAccounts.Count -eq 0) {
    Write-ColorOutput "ERROR: No storage account found in resource group: $ResourceGroup" $Red
    Write-ColorOutput "Please run setup_master.ps1 to create infrastructure first." $Yellow
    if ($storageAccountsOutput) {
        Write-ColorOutput "Error details: $storageAccountsOutput" $Yellow
    }
    exit 1
}
Write-ColorOutput "Storage account exists" $Green
Write-ColorOutput ""

# Infrastructure pre-flight checks
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Infrastructure Pre-flight Checks" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$verifyScript = Join-Path $scriptDir "verify_infrastructure.ps1"
if (Test-Path $verifyScript) {
    Write-ColorOutput "Running infrastructure verification..." $Blue
    try {
        & $verifyScript -ResourceGroup $ResourceGroup -Location $Location
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "WARNING: Infrastructure verification failed" $Yellow
            Write-ColorOutput "Some required resources may be missing. Deployment may fail." $Yellow
            Write-ColorOutput "" $Yellow
            Write-ColorOutput "Options:" $Cyan
            Write-ColorOutput "  1. Run infrastructure setup: setup_master.ps1 (Phase 6)" $Blue
            Write-ColorOutput "  2. Continue anyway (deployment may fail)" $Blue
            Write-ColorOutput "" $Blue
            
            if (-not $NonInteractive) {
                $continue = Read-Host "Continue with deployment anyway? (y/N)"
                if ($continue -ne "y" -and $continue -ne "Y") {
                    Write-ColorOutput "Deployment cancelled by user" $Yellow
                    exit 1
                }
            } else {
                Write-ColorOutput "Non-interactive mode: Continuing despite warnings" $Yellow
            }
        } else {
            Write-ColorOutput "Infrastructure verification passed" $Green
        }
    } catch {
        Write-ColorOutput "WARNING: Infrastructure verification script encountered an error: $_" $Yellow
        Write-ColorOutput "Continuing with deployment..." $Yellow
    }
} else {
    Write-ColorOutput "WARNING: verify_infrastructure.ps1 not found, skipping pre-flight checks" $Yellow
}
Write-ColorOutput ""

# Step 1: Deploy Backend
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 1: Deploying Backend Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "[1/3] Deploying Backend Service..." $Yellow
Write-ColorOutput ""

$backendScript = Join-Path $scriptDir "deploy_backend_containerapp.ps1"
if (Test-Path $backendScript) {
    try {
        & $backendScript -ResourceGroup $ResourceGroup -Location $Location
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Backend deployed successfully" $Green
        } else {
            Write-ColorOutput "ERROR: Backend deployment failed with exit code $LASTEXITCODE" $Red
            Write-ColorOutput "Check logs for details. Common issues:" $Yellow
            Write-ColorOutput "  - Missing SQL Server or Key Vault" $Blue
            Write-ColorOutput "  - Key Vault permissions" $Blue
            Write-ColorOutput "  - Database connectivity issues" $Blue
            exit 1
        }
    }
    catch {
        Write-ColorOutput "ERROR: Backend deployment failed: $_" $Red
        Write-ColorOutput "Error occurred during backend deployment step" $Yellow
        exit 1
    }
} else {
    Write-ColorOutput "ERROR: deploy_backend_containerapp.ps1 not found!" $Red
    exit 1
}

Write-ColorOutput ""

# Step 2: Deploy Chatbot
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Deploying Chatbot Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "[2/3] Deploying Chatbot Service..." $Yellow
Write-ColorOutput ""

$chatbotScript = Join-Path $scriptDir "deploy_chatbot_containerapp.ps1"
if (Test-Path $chatbotScript) {
    try {
        & $chatbotScript -ResourceGroup $ResourceGroup -Location $Location
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Chatbot deployed successfully" $Green
        } else {
            Write-ColorOutput "ERROR: Chatbot deployment failed with exit code $LASTEXITCODE" $Red
            Write-ColorOutput "Check logs for details. Common issues:" $Yellow
            Write-ColorOutput "  - Missing Key Vault or GROQ API key" $Blue
            Write-ColorOutput "  - Key Vault permissions" $Blue
            Write-ColorOutput "  - JSON parsing errors (should be fixed)" $Blue
            exit 1
        }
    }
    catch {
        Write-ColorOutput "ERROR: Chatbot deployment failed: $_" $Red
        Write-ColorOutput "Error occurred during chatbot deployment step" $Yellow
        exit 1
    }
} else {
    Write-ColorOutput "ERROR: deploy_chatbot_containerapp.ps1 not found!" $Red
    exit 1
}

Write-ColorOutput ""

# Step 3: Deploy RL Service
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 3: Deploying RL Inference Service" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "[3/3] Deploying RL Inference Service..." $Yellow
Write-ColorOutput ""

$rlScript = Join-Path $scriptDir "deploy_rl_containerapp.ps1"
if (Test-Path $rlScript) {
    try {
        & $rlScript -ResourceGroup $ResourceGroup -Location $Location
        if ($LASTEXITCODE -ne 0) {
            throw "RL Service deployment returned exit code $LASTEXITCODE"
        }
        Write-ColorOutput "RL Service deployed successfully" $Green
    }
    catch {
        Write-ColorOutput "ERROR: RL Service deployment failed: $_" $Red
        exit 1
    }
} else {
    Write-ColorOutput "ERROR: deploy_rl_containerapp.ps1 not found!" $Red
    exit 1
}

Write-ColorOutput ""

# Step 4: Configure cross-service communication
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 4: Configuring Cross-Service Communication" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Get service FQDNs
Write-ColorOutput "Retrieving service FQDNs..." $Blue
$backendFqdnOutput = az containerapp show --name "wealtharena-backend" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
$backendFqdnExitCode = $LASTEXITCODE

$chatbotFqdnOutput = az containerapp show --name "wealtharena-chatbot" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
$chatbotFqdnExitCode = $LASTEXITCODE

$rlServiceFqdnOutput = az containerapp show --name "wealtharena-rl" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
$rlServiceFqdnExitCode = $LASTEXITCODE

$backendFqdn = $null
$chatbotFqdn = $null
$rlServiceFqdn = $null

if ($backendFqdnExitCode -eq 0 -and $backendFqdnOutput -and -not $backendFqdnOutput.StartsWith("az:")) {
    $backendFqdn = $backendFqdnOutput
}

if ($chatbotFqdnExitCode -eq 0 -and $chatbotFqdnOutput -and -not $chatbotFqdnOutput.StartsWith("az:")) {
    $chatbotFqdn = $chatbotFqdnOutput
}

if ($rlServiceFqdnExitCode -eq 0 -and $rlServiceFqdnOutput -and -not $rlServiceFqdnOutput.StartsWith("az:")) {
    $rlServiceFqdn = $rlServiceFqdnOutput
}

$backendFullUrl = $null
$chatbotFullUrl = $null
$rlServiceFullUrl = $null
$frontendFqdn = $null

if ($backendFqdn) {
    $backendFullUrl = "https://$backendFqdn"
    Write-ColorOutput "Backend FQDN: $backendFqdn" $Green
} else {
    Write-ColorOutput "WARNING: Could not retrieve backend FQDN" $Yellow
}

if ($chatbotFqdn) {
    $chatbotFullUrl = "https://$chatbotFqdn"
    Write-ColorOutput "Chatbot FQDN: $chatbotFqdn" $Green
} else {
    Write-ColorOutput "WARNING: Could not retrieve chatbot FQDN" $Yellow
}

if ($rlServiceFqdn) {
    $rlServiceFullUrl = "https://$rlServiceFqdn"
    Write-ColorOutput "RL Service FQDN: $rlServiceFqdn" $Green
} else {
    Write-ColorOutput "WARNING: Could not retrieve RL service FQDN" $Yellow
}

# Try to get frontend FQDN if deployed
$frontendFqdnOutput = az containerapp show --name "wealtharena-frontend" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
if ($LASTEXITCODE -eq 0 -and $frontendFqdnOutput -and -not $frontendFqdnOutput.StartsWith("az:")) {
    $frontendFqdn = $frontendFqdnOutput
    Write-ColorOutput "Frontend FQDN: $frontendFqdn" $Green
}

Write-ColorOutput ""
Write-ColorOutput "Updating backend Container App with cross-service URLs..." $Blue

# Update backend with actual service URLs
if ($backendFqdn -and $chatbotFqdn -and $rlServiceFqdn) {
    $envVarsToUpdate = @()
    
    if ($chatbotFqdn -and -not $chatbotFqdn.StartsWith("az:")) {
        $envVarsToUpdate += "CHATBOT_API_URL=https://$chatbotFqdn"
    }
    
    if ($rlServiceFqdn -and -not $rlServiceFqdn.StartsWith("az:")) {
        $envVarsToUpdate += "RL_API_URL=https://$rlServiceFqdn"
    }
    
    # Set ALLOWED_ORIGINS with actual frontend FQDN if available, otherwise use placeholder
    if ($frontendFqdn -and -not $frontendFqdn.StartsWith("az:")) {
        $envVarsToUpdate += "ALLOWED_ORIGINS=https://$frontendFqdn,exp://localhost:5001"
    } else {
        # Keep placeholder for now, will be updated after frontend deployment
        $envVarsToUpdate += "ALLOWED_ORIGINS=exp://localhost:5001"
    }
    
    if ($envVarsToUpdate.Count -gt 0) {
        az containerapp update `
            --name "wealtharena-backend" `
            --resource-group $ResourceGroup `
            --set-env-vars $envVarsToUpdate `
            --output none 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Backend Container App updated with cross-service URLs" $Green
        } else {
            Write-ColorOutput "WARNING: Failed to update backend with cross-service URLs" $Yellow
        }
    }
} else {
    Write-ColorOutput "WARNING: Could not retrieve all service FQDNs. URLs not updated." $Yellow
}

Write-ColorOutput ""
Write-ColorOutput "Cross-service URLs applied to backend Container App" $Green
Write-ColorOutput ""

# Persist URLs to automation_state.json if it exists
$rootDir = Split-Path -Parent $PSScriptRoot
$rootDir = Split-Path -Parent $rootDir
$stateFile = Join-Path $rootDir "automation_state.json"

if (Test-Path $stateFile) {
    Write-ColorOutput "Persisting service URLs to automation_state.json..." $Blue
    try {
        $stateContent = Get-Content $stateFile -Raw | ConvertFrom-Json
        if (-not $stateContent.ServiceURLs) {
            $stateContent.ServiceURLs = @{}
        }
        if ($backendFullUrl) { $stateContent.ServiceURLs.Backend = $backendFullUrl }
        if ($chatbotFullUrl) { $stateContent.ServiceURLs.Chatbot = $chatbotFullUrl }
        if ($rlServiceFullUrl) { $stateContent.ServiceURLs.RLService = $rlServiceFullUrl }
        if ($frontendFqdn -and -not $frontendFqdn.StartsWith("az:")) {
            $stateContent.ServiceURLs.Frontend = "https://$frontendFqdn"
        }
        $stateContent | ConvertTo-Json -Depth 10 | Set-Content $stateFile
        Write-ColorOutput "Service URLs persisted to automation_state.json" $Green
    } catch {
        Write-ColorOutput "WARNING: Failed to persist URLs to automation_state.json: $_" $Yellow
    }
}

# Write URLs to frontend .env.azure if frontend directory exists
$frontendDir = Join-Path $rootDir "frontend"
if (Test-Path $frontendDir) {
    Write-ColorOutput "Writing service URLs to frontend .env.azure..." $Blue
    try {
        $envAzureFile = Join-Path $frontendDir ".env.azure"
        $envContent = @()
        $envContent += "EXPO_PUBLIC_DEPLOYMENT_ENV=azure"
        if ($backendFullUrl) { $envContent += "EXPO_PUBLIC_BACKEND_URL=$backendFullUrl" }
        if ($chatbotFullUrl) { $envContent += "EXPO_PUBLIC_CHATBOT_URL=$chatbotFullUrl" }
        if ($rlServiceFullUrl) { $envContent += "EXPO_PUBLIC_RL_SERVICE_URL=$rlServiceFullUrl" }
        $envContent | Set-Content $envAzureFile -Force
        Write-ColorOutput "Frontend .env.azure updated with service URLs" $Green
    } catch {
        Write-ColorOutput "WARNING: Failed to write frontend .env.azure: $_" $Yellow
    }
}

Write-ColorOutput ""

# Step 5: Run integration tests
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 5: Running Integration Tests" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Waiting for all services to be ready (60 seconds)..." $Yellow
Start-Sleep -Seconds 60

Write-ColorOutput "Testing service health endpoints..." $Blue

$allHealthy = $true

# Test backend
if ($backendFullUrl) {
    try {
        $response = Invoke-WebRequest -Uri "$backendFullUrl/health" -Method Get -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "Backend: Healthy" $Green
        } else {
            Write-ColorOutput "Backend: Unhealthy (status $($response.StatusCode))" $Yellow
            $allHealthy = $false
        }
    } catch {
        Write-ColorOutput "Backend: Health check failed - $($_.Exception.Message)" $Yellow
        $allHealthy = $false
    }
}

# Test chatbot
if ($chatbotFullUrl) {
    try {
        $response = Invoke-WebRequest -Uri "$chatbotFullUrl/health" -Method Get -TimeoutSec 60 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "Chatbot: Healthy" $Green
        } else {
            Write-ColorOutput "Chatbot: Unhealthy (status $($response.StatusCode))" $Yellow
            $allHealthy = $false
        }
    } catch {
        Write-ColorOutput "Chatbot: Health check failed - $($_.Exception.Message)" $Yellow
        $allHealthy = $false
    }
}

# Test RL service
if ($rlServiceFullUrl) {
    try {
        $response = Invoke-WebRequest -Uri "$rlServiceFullUrl/health" -Method Get -TimeoutSec 60 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "RL Service: Healthy" $Green
        } else {
            Write-ColorOutput "RL Service: Unhealthy (status $($response.StatusCode))" $Yellow
            $allHealthy = $false
        }
    } catch {
        Write-ColorOutput "RL Service: Health check failed - $($_.Exception.Message)" $Yellow
        Write-ColorOutput "   Note: Cold start may take 30-60 seconds for model loading" $Blue
        $allHealthy = $false
    }
}

Write-ColorOutput ""

# Deployment Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Service URLs:" $Cyan
if ($backendFullUrl) {
    Write-ColorOutput "  Backend:  $backendFullUrl" $Blue
}
if ($chatbotFullUrl) {
    Write-ColorOutput "  Chatbot:  $chatbotFullUrl" $Blue
}
if ($rlServiceFullUrl) {
    Write-ColorOutput "  RL Service: $rlServiceFullUrl" $Blue
}
Write-ColorOutput ""

if ($allHealthy) {
    Write-ColorOutput "All services deployed and healthy!" $Green
} else {
    Write-ColorOutput "Deployment completed with some health check warnings" $Yellow
    Write-ColorOutput "Services may still be starting up. Check logs if issues persist." $Yellow
}

Write-ColorOutput ""
Write-ColorOutput "Next Steps:" $Yellow
Write-ColorOutput "  1. Update frontend .env.azure with service URLs" $Blue
Write-ColorOutput "  2. Test end-to-end user flows" $Blue
Write-ColorOutput "  3. Monitor Container App logs for errors" $Blue
Write-ColorOutput "  4. Review Container Apps metrics in Azure Portal" $Blue
Write-ColorOutput ""
Write-ColorOutput "Cost Note:" $Yellow
Write-ColorOutput "  - Container Apps scale to zero (no idle costs)" $Blue
Write-ColorOutput "  - Free tier: 180k vCPU-s, 360k GiB-s, 2M requests/month" $Blue
Write-ColorOutput "  - Low-traffic apps typically stay within free tier" $Blue
Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan

