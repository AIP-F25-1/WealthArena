# WealthArena RL Service Container Apps Deployment Script
# Deploys RL service as Azure Container App (no App Service Plan required, scales to zero)

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [string]$ContainerAppName = "wealtharena-rl",
    [string]$EnvironmentName = "wealtharena-env",
    [string]$RegistryName = "",
    [string]$KeyVault = "",
    [string]$ImageName = "wealtharena-rl:latest",
    [string]$ModelMode = "mock"
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
$rlServiceDir = Join-Path $root "rl-service"

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena RL Service Container App Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Verify Azure CLI is installed and logged in
Write-ColorOutput "Verifying Azure CLI connection..." $Blue
$account = az account show --output json 2>&1 | ConvertFrom-Json
if (-not $account) {
    Write-ColorOutput "ERROR: Not logged in to Azure. Please run 'az login' first." $Red
    exit 1
}
Write-ColorOutput "Connected as: $($account.user.name)" $Green
Write-ColorOutput ""

# Verify resource group exists
Write-ColorOutput "Verifying resource group..." $Blue
$rg = az group show --name $ResourceGroup --output json 2>&1 | ConvertFrom-Json
if (-not $rg) {
    Write-ColorOutput "ERROR: Resource group not found: $ResourceGroup" $Red
    exit 1
}
Write-ColorOutput "Resource group exists: $ResourceGroup" $Green
Write-ColorOutput ""

# Step 1: Verify Container Apps Environment exists
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 1: Verifying Container Apps Environment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$envExists = az containerapp env show --name $EnvironmentName --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json

if (-not $envExists) {
    Write-ColorOutput "ERROR: Container Apps Environment not found: $EnvironmentName" $Red
    Write-ColorOutput "Please run deploy_backend_containerapp.ps1 first to create the environment" $Yellow
    exit 1
}
Write-ColorOutput "Container Apps Environment exists: $EnvironmentName" $Green
Write-ColorOutput ""

# Step 2: Get or verify Azure Container Registry
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Verifying Azure Container Registry" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Discover resource suffix (before deriving resource names)
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

if ([string]::IsNullOrEmpty($RegistryName)) {
    # Use discovered suffix
    $RegistryName = "acrwealtharena$discoveredSuffix"
    $RegistryName = $RegistryName.ToLower() -replace '[^a-z0-9]', ''
}

# Check if ACR exists in this resource group first
$acrExists = az acr show --name $RegistryName --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json

if (-not $acrExists) {
    # Try to find ACR in resource group (might have different name due to collision handling)
    $acrList = az acr list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
    if ($acrList -and $acrList.Count -gt 0) {
        $RegistryName = $acrList | Select-Object -First 1
        Write-ColorOutput "Using existing Container Registry: $RegistryName" $Green
    } else {
        Write-ColorOutput "ERROR: Container Registry not found: $RegistryName" $Red
        Write-ColorOutput "Please run deploy_backend_containerapp.ps1 first to create the registry" $Yellow
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
Write-ColorOutput "WARNING: RL Service image will be large (~3-4GB due to Ray + PyTorch)" $Yellow
Write-ColorOutput "Build time: 15-20 minutes" $Yellow
Write-ColorOutput ""

Write-ColorOutput "Logging into Azure Container Registry..." $Blue
az acr login --name $RegistryName

$fullImageName = "$RegistryName.azurecr.io/$ImageName"

Write-ColorOutput "Building Docker image: $fullImageName" $Blue
Set-Location $rlServiceDir
docker build -t $fullImageName .

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Docker build failed" $Red
    exit 1
}

Write-ColorOutput "Pushing Docker image to registry..." $Blue
Write-ColorOutput "Note: Push may take 5-10 minutes due to large image size" $Yellow
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

# Derive SQL Server, Key Vault, and Storage Account names using discovered suffix
if ([string]::IsNullOrWhiteSpace($KeyVault)) {
    $KeyVault = "kv-wealtharena-$discoveredSuffix"
}

$sqlServerHost = "sql-wealtharena-$discoveredSuffix.database.windows.net"

# Get storage account connection string
$storageAccounts = az storage account list --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json
$storageConnString = ""
if ($storageAccounts -and $storageAccounts.Count -gt 0) {
    $storageAccountName = $storageAccounts[0].name
    $storageConnStr = az storage account show-connection-string --name $storageAccountName --resource-group $ResourceGroup --query connectionString -o tsv 2>&1
    if ($storageConnStr -and -not $storageConnStr.StartsWith("az:")) {
        $storageConnString = $storageConnStr
    }
}

# Load secrets from env file if available
$envFile = Join-Path $root "azure_infrastructure" ".env"
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

# Get DB password from env file or Key Vault
$dbPassword = $null
if ($envVars.ContainsKey("DB_PASSWORD")) {
    $dbPassword = $envVars["DB_PASSWORD"]
    Write-ColorOutput "DB password loaded from env file" $Green
} else {
    Write-ColorOutput "Retrieving DB password from Key Vault..." $Blue
    try {
        $dbPassword = az keyvault secret show --name sql-password --vault-name $KeyVault --query value -o tsv 2>&1
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($dbPassword)) {
            Write-ColorOutput "WARNING: Failed to retrieve DB password from Key Vault" $Yellow
            Write-ColorOutput "Database connection may fail without DB password." $Yellow
        } else {
            Write-ColorOutput "DB password retrieved from Key Vault" $Green
        }
    } catch {
        Write-ColorOutput "WARNING: Exception retrieving DB password: $_" $Yellow
    }
}

$containerAppExists = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json

if ($containerAppExists) {
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
    Write-ColorOutput "Resources: 2.0 CPU, 4.0Gi memory (required for Ray/PyTorch)" $Blue
    
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
        --cpu 2.0 `
        --memory 4.0Gi `
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

# Set secrets in Container App (if DB password is available)
if ($dbPassword) {
    Write-ColorOutput "Setting DB password as Container App secret..." $Blue
    az containerapp secret set `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --secrets db-password=$dbPassword `
        --output none 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "DB password set as secret" $Green
    } else {
        Write-ColorOutput "WARNING: Failed to set DB password as secret" $Yellow
    }
}

# Update container app with environment variables
Write-ColorOutput "Configuring environment variables..." $Blue
$envVarsArray = @(
    "DB_HOST=$sqlServerHost",
    "DB_NAME=wealtharena_db",
    "DB_USER=wealtharena_admin",
    "DB_PORT=1433",
    "DB_ENCRYPT=true",
    "MODEL_PATH=/tmp/models/latest",
    "MODEL_MODE=$ModelMode",
    "PORT=8000"
)

if ($storageConnString) {
    $envVarsArray += "AZURE_STORAGE_CONNECTION_STRING=$storageConnString"
}

if ($dbPassword) {
    $envVarsArray += "DB_PASSWORD=secretref:db-password"
} else {
    Write-ColorOutput "WARNING: DB_PASSWORD not set - database connection may fail" $Yellow
}

az containerapp update `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --set-env-vars $envVarsArray `
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
    
    Write-ColorOutput "Waiting for container to start (60 seconds for Ray/PyTorch initialization)..." $Yellow
    Start-Sleep -Seconds 60
    
    Write-ColorOutput "Testing health endpoint..." $Yellow
    try {
        $healthResponse = Invoke-WebRequest -Uri "$fullUrl/health" -Method Get -TimeoutSec 60 -UseBasicParsing -ErrorAction Stop
        if ($healthResponse.StatusCode -eq 200) {
            Write-ColorOutput "RL Service is healthy!" $Green
        }
    } catch {
        Write-ColorOutput "WARNING: Health check failed. Container may still be starting..." $Yellow
        Write-ColorOutput "   Cold start may take 30-60 seconds for model loading" $Yellow
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
Write-ColorOutput "Resources: 2.0 CPU, 4.0Gi memory (required for Ray/PyTorch)" $Blue
Write-ColorOutput ""
Write-ColorOutput "Important Notes:" $Yellow
Write-ColorOutput "   - Cold start: 30-60 seconds for model loading" $Yellow
Write-ColorOutput "   - Model mode: $ModelMode" $Yellow
Write-ColorOutput "   - For production models, upload checkpoints to Azure Blob Storage" $Yellow
Write-ColorOutput ""
Write-ColorOutput "Next Steps:" $Yellow
Write-ColorOutput "   1. Upload model checkpoints to Azure Blob Storage (if using production mode)" $Blue
Write-ColorOutput "   2. Verify database connection in Azure Portal" $Blue
Write-ColorOutput "   3. Check Container App logs for any errors" $Blue
Write-ColorOutput "   4. Test prediction endpoint: POST $fullUrl/predict" $Blue
Write-ColorOutput ""

