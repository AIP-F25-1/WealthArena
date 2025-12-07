# WealthArena Chatbot Container Apps Deployment Script
# Deploys chatbot as Azure Container App (no App Service Plan required, scales to zero)

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [string]$ContainerAppName = "wealtharena-chatbot",
    [string]$EnvironmentName = "wealtharena-env",
    [string]$RegistryName = "",
    [string]$KeyVault = "",
    [string]$ImageName = "wealtharena-chatbot:latest"
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

# Get root directory
$root = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $root
$chatbotDir = Join-Path $root "chatbot"

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Chatbot Container App Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
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
    if ($rgOutput) {
        Write-ColorOutput "Error details: $rgOutput" $Yellow
    }
    exit 1
}
Write-ColorOutput "Resource group exists: $ResourceGroup" $Green
Write-ColorOutput ""

# Discover resource suffix (before deriving Key Vault and SQL Server names)
Write-ColorOutput "Discovering resource suffix..." $Cyan
$discoveredSuffix = $null

# Priority 1: Check automation state file
$stateFile = Join-Path $PSScriptRoot "..\..\automation_state.json"
if (Test-Path $stateFile) {
    try {
        $automationState = Get-Content $stateFile -Raw | ConvertFrom-Json
        if ($automationState -and $automationState.UniqueSuffix) {
            $discoveredSuffix = $automationState.UniqueSuffix
            Write-ColorOutput "   Found suffix from automation state: $discoveredSuffix" $Green
        }
    } catch {
        # Ignore errors
    }
}

# Priority 2: Discover from existing SQL Server
if (-not $discoveredSuffix) {
    $sqlListOutput = az sql server list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
    if ($LASTEXITCODE -eq 0 -and $sqlListOutput) {
        $sqlOutputString = $sqlListOutput.ToString()
        if ($sqlOutputString -match 'sql-wealtharena-([^\s]+)') {
            $discoveredSuffix = $matches[1]
            Write-ColorOutput "   Discovered suffix from SQL Server: $discoveredSuffix" $Green
        }
    }
}

# Priority 3: Discover from Key Vault
if (-not $discoveredSuffix) {
    $kvListOutput = az keyvault list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
    if ($LASTEXITCODE -eq 0 -and $kvListOutput) {
        $kvOutputString = $kvListOutput.ToString()
        if ($kvOutputString -match 'kv-wealtharena-([^\s]+)') {
            $discoveredSuffix = $matches[1]
            Write-ColorOutput "   Discovered suffix from Key Vault: $discoveredSuffix" $Green
        }
    }
}

# Priority 4: Fallback to resource group name
if (-not $discoveredSuffix) {
    if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
        $discoveredSuffix = $matches[1]
        Write-ColorOutput "   Using suffix from resource group: $discoveredSuffix" $Yellow
    } else {
        $discoveredSuffix = "dev"
        Write-ColorOutput "   Using default suffix: $discoveredSuffix" $Yellow
    }
}

Write-ColorOutput ""

# Step 1: Verify Container Apps Environment exists (should be created by backend script)
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 1: Verifying Container Apps Environment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$envOutput = az containerapp env show --name $EnvironmentName --resource-group $ResourceGroup --output json 2>&1
$envExists = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $envExists = $envOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "WARNING: Could not parse environment output" $Yellow
        $envExists = $null
    }
}

if (-not $envExists -or -not $envExists.name) {
    Write-ColorOutput "ERROR: Container Apps Environment not found: $EnvironmentName" $Red
    Write-ColorOutput "Please run deploy_backend_containerapp.ps1 first to create the environment" $Yellow
    if ($envOutput) {
        Write-ColorOutput "Error details: $envOutput" $Yellow
    }
    exit 1
}
Write-ColorOutput "Container Apps Environment exists: $EnvironmentName" $Green
Write-ColorOutput ""

# Step 2: Get or verify Azure Container Registry
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Verifying Azure Container Registry" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

if ([string]::IsNullOrEmpty($RegistryName)) {
    # Use discovered suffix
    $RegistryName = "acrwealtharena$discoveredSuffix"
    $RegistryName = $RegistryName.ToLower() -replace '[^a-z0-9]', ''
}

# Check if ACR exists in this resource group first
$acrOutput = az acr show --name $RegistryName --resource-group $ResourceGroup --output json 2>&1
$acrExists = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $acrExists = $acrOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "WARNING: Could not parse ACR output" $Yellow
        $acrExists = $null
    }
}

if (-not $acrExists -or -not $acrExists.name) {
    # Try to find ACR in resource group (might have different name due to collision handling)
    $acrListOutput = az acr list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
    if ($LASTEXITCODE -eq 0 -and $acrListOutput) {
        $acrList = ($acrListOutput -split "`n" | Where-Object { $_ -and $_.Trim() })
        if ($acrList -and $acrList.Count -gt 0) {
            $RegistryName = $acrList[0]
            Write-ColorOutput "Using existing Container Registry: $RegistryName" $Green
        } else {
            Write-ColorOutput "ERROR: Container Registry not found: $RegistryName" $Red
            Write-ColorOutput "Please run deploy_backend_containerapp.ps1 first to create the registry" $Yellow
            exit 1
        }
    } else {
        Write-ColorOutput "ERROR: Container Registry not found: $RegistryName" $Red
        Write-ColorOutput "Please run deploy_backend_containerapp.ps1 first to create the registry" $Yellow
        if ($acrOutput) {
            Write-ColorOutput "Error details: $acrOutput" $Yellow
        }
        exit 1
    }
} else {
    Write-ColorOutput "Container Registry exists: $RegistryName" $Green
}
Write-ColorOutput ""

# Step 3: Build and push Docker image
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 3: Building and Pushing Docker Image" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Verifying Docker is installed and running..." $Blue
$dockerCheck = docker --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Docker is not installed or not running" $Red
    exit 1
}

$dockerPs = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Docker daemon is not running" $Red
    exit 1
}
Write-ColorOutput "Docker is available and running" $Green

Write-ColorOutput ""
Write-ColorOutput "Logging into Azure Container Registry..." $Blue
az acr login --name $RegistryName

$fullImageName = "$RegistryName.azurecr.io/$ImageName"

Write-ColorOutput "Building Docker image: $fullImageName" $Blue
Write-ColorOutput "Note: This may take 10-15 minutes due to torch and transformers dependencies" $Yellow
Set-Location $chatbotDir
docker build -t $fullImageName .

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Docker build failed" $Red
    exit 1
}

Write-ColorOutput "Pushing Docker image to registry..." $Blue
docker push $fullImageName

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Docker push failed" $Red
    exit 1
}

Write-ColorOutput "Docker image built and pushed successfully" $Green
Write-ColorOutput ""

# Step 4: Create Container App
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 4: Creating Container App" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$acrLoginServer = az acr show --name $RegistryName --query loginServer -o tsv
$acrUsername = az acr credential show --name $RegistryName --query username -o tsv
$acrPassword = az acr credential show --name $RegistryName --query passwords[0].value -o tsv

# Derive Key Vault name using discovered suffix
if ([string]::IsNullOrWhiteSpace($KeyVault)) {
    $KeyVault = "kv-wealtharena-$discoveredSuffix"
}

# Load secrets from env file if available
$envFile = Join-Path (Join-Path $root "infrastructure/azure_infrastructure") ".env"
$envVars = @{}
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    foreach ($line in $envContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$key] = $value
        }
    }
}

# Get GROQ API key from env file or Key Vault
$groqApiKey = $null
if ($envVars.ContainsKey("GROQ_API_KEY")) {
    $groqApiKey = $envVars["GROQ_API_KEY"]
    Write-ColorOutput "GROQ API key loaded from env file" $Green
} else {
    Write-ColorOutput "Retrieving GROQ API key from Key Vault..." $Blue
    $groqApiKeyOutput = az keyvault secret show --name groq-api-key --vault-name $KeyVault --query value -o tsv 2>&1
    
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($groqApiKeyOutput) -and -not $groqApiKeyOutput.StartsWith("az:")) {
        $groqApiKey = $groqApiKeyOutput
        Write-ColorOutput "GROQ API key retrieved from Key Vault" $Green
    } else {
        Write-ColorOutput "WARNING: Failed to retrieve GROQ API key from Key Vault: $KeyVault" $Yellow
        Write-ColorOutput "Chatbot service may not work without GROQ API key." $Yellow
        Write-ColorOutput "" $Yellow
        Write-ColorOutput "This is likely a Key Vault permissions issue. To fix:" $Cyan
        Write-ColorOutput "  1. Run the fix script: .\infrastructure\azure_deployment\fix_keyvault_permissions.ps1 -KeyVault $KeyVault" $Blue
        Write-ColorOutput "  2. Or manually grant permissions: az keyvault set-policy --name $KeyVault --upn <your-email> --secret-permissions get list" $Blue
        Write-ColorOutput "  3. Verify access: az keyvault secret show --name groq-api-key --vault-name $KeyVault" $Blue
        $groqApiKey = $null
    }
}

$containerAppOutput = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --output json 2>&1
$containerAppExists = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $containerAppExists = $containerAppOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "WARNING: Could not parse container app output" $Yellow
        $containerAppExists = $null
    }
}

if ($containerAppExists -and $containerAppExists.name) {
    Write-ColorOutput "Container App already exists: $ContainerAppName" $Green
    Write-ColorOutput "Updating Container App..." $Blue
    
    az containerapp update `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --image $fullImageName `
        --registry-server $acrLoginServer `
        --registry-username $acrUsername `
        --registry-password $acrPassword `
        --output none 2>&1 | Out-Null
} else {
    Write-ColorOutput "Creating Container App: $ContainerAppName" $Blue
    
    az containerapp create `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --environment $EnvironmentName `
        --image $fullImageName `
        --registry-server $acrLoginServer `
        --registry-username $acrUsername `
        --registry-password $acrPassword `
        --target-port 8000 `
        --ingress external `
        --min-replicas 0 `
        --max-replicas 1 `
        --cpu 1.0 `
        --memory 2.0Gi `
        --output none 2>&1 | Out-Null
}

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Failed to create/update Container App" $Red
    exit 1
}

Write-ColorOutput "Container App created/updated: $ContainerAppName" $Green
Write-ColorOutput ""

# Step 5: Configure environment variables and secrets
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 5: Configuring Environment Variables and Secrets" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Set secrets in Container App (if GROQ API key is available)
if ($groqApiKey) {
    Write-ColorOutput "Setting GROQ API key as Container App secret..." $Blue
    az containerapp secret set `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --secrets groq-api-key=$groqApiKey `
        --output none 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "GROQ API key set as secret" $Green
    } else {
        Write-ColorOutput "WARNING: Failed to set GROQ API key as secret" $Yellow
    }
}

# Update container app with environment variables
Write-ColorOutput "Configuring environment variables..." $Blue
$envVarsList = @(
    "GROQ_MODEL=llama3-8b-8192",
    "LLM_PROVIDER=groq",
    "PORT=8000",
    "CHROMA_PERSIST_DIR=/tmp/chroma_db"
)

if ($groqApiKey) {
    $envVarsList += "GROQ_API_KEY=secretref:groq-api-key"
} else {
    Write-ColorOutput "WARNING: GROQ_API_KEY not set - chatbot service may not work" $Yellow
}

az containerapp update `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --set-env-vars $envVarsList `
    --output none 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "Environment variables configured" $Green
} else {
    Write-ColorOutput "WARNING: Some environment variables may not have been configured" $Yellow
}

Write-ColorOutput ""

# Step 6: Test deployment
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 6: Testing Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$containerAppUrl = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv

if ($containerAppUrl) {
    $fullUrl = "https://$containerAppUrl"
    Write-ColorOutput "Container App URL: $fullUrl" $Cyan
    Write-ColorOutput ""
    
    Write-ColorOutput "Waiting for container to start (90 seconds for torch/transformers loading)..." $Yellow
    Start-Sleep -Seconds 90
    
    Write-ColorOutput "Testing health endpoint with retries..." $Yellow
    $maxRetries = 5
    $retryDelay = 20
    $healthCheckPassed = $false
    
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            Write-ColorOutput "Health check attempt $i of $maxRetries..." $Blue
            $healthResponse = Invoke-WebRequest -Uri "$fullUrl/health" -Method Get -TimeoutSec 60 -UseBasicParsing -ErrorAction Stop
            
            if ($healthResponse.StatusCode -eq 200 -or $healthResponse.StatusCode -eq 503) {
                Write-ColorOutput "Chatbot is responding!" $Green
                if ($healthResponse.StatusCode -eq 200) {
                    Write-ColorOutput "Chatbot is healthy!" $Green
                } else {
                    Write-ColorOutput "Chatbot is starting (503) - service is responding but may still be loading models" $Yellow
                }
                $healthCheckPassed = $true
                break
            } else {
                Write-ColorOutput "WARNING: Chatbot responded with status $($healthResponse.StatusCode)" $Yellow
            }
        } catch {
            if ($i -lt $maxRetries) {
                Write-ColorOutput "Health check failed, retrying in $retryDelay seconds..." $Yellow
                Write-ColorOutput "   Error: $($_.Exception.Message)" $Yellow
                Start-Sleep -Seconds $retryDelay
            } else {
                Write-ColorOutput "WARNING: Health check failed after $maxRetries attempts" $Yellow
                Write-ColorOutput "   Error: $($_.Exception.Message)" $Yellow
                Write-ColorOutput "" $Yellow
                Write-ColorOutput "Troubleshooting steps:" $Cyan
                Write-ColorOutput "  1. Check container logs: az containerapp logs show --name $ContainerAppName --resource-group $ResourceGroup --follow" $Blue
                Write-ColorOutput "  2. Verify GROQ API key is set correctly in Key Vault" $Blue
                Write-ColorOutput "  3. Container may still be starting - wait a few minutes and try again" $Blue
                Write-ColorOutput "  4. Models may take longer to load - check logs for loading progress" $Blue
            }
        }
    }
}

Write-ColorOutput ""

# Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "Container App: $ContainerAppName" $Cyan
if ($containerAppUrl) {
    Write-ColorOutput "URL: https://$containerAppUrl" $Cyan
}
Write-ColorOutput "Plan: Consumption (scales to zero, no App Service Plan required)" $Blue
Write-ColorOutput "Resources: 1.0 CPU, 2.0Gi memory (for torch/transformers)" $Blue
Write-ColorOutput ""
Write-ColorOutput "Next Steps:" $Yellow
Write-ColorOutput "   1. Verify GROQ API key in Key Vault" $Blue
Write-ColorOutput "   2. Check Container App logs for any errors" $Blue
Write-ColorOutput "   3. Test chat endpoint: POST $fullUrl/v1/chat" $Blue
Write-ColorOutput "   4. Proceed to deploy RL service" $Blue
Write-ColorOutput ""

