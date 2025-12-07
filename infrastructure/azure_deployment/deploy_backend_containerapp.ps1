# WealthArena Backend Container Apps Deployment Script
# Deploys backend as Azure Container App (no App Service Plan required, scales to zero)

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [string]$ContainerAppName = "wealtharena-backend",
    [string]$EnvironmentName = "wealtharena-env",
    [string]$RegistryName = "",
    [string]$KeyVault = "",
    [string]$ImageName = "wealtharena-backend:latest"
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
$backendDir = Join-Path $root "backend"

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Backend Container App Deployment" $Cyan
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

# Derive Key Vault and SQL Server names using discovered suffix
if ([string]::IsNullOrWhiteSpace($KeyVault)) {
    $KeyVault = "kv-wealtharena-$discoveredSuffix"
}

Write-ColorOutput "   Using Key Vault: $KeyVault" $Cyan
Write-ColorOutput ""

# Pre-deployment verification: Check Key Vault accessibility
Write-ColorOutput "Pre-deployment verification: Checking Key Vault accessibility..." $Blue
try {
    $kvTestOutput = az keyvault secret list --vault-name $KeyVault --query "[].name" -o tsv 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "Key Vault is accessible: $KeyVault" $Green
    } else {
        Write-ColorOutput "WARNING: Key Vault may not be accessible: $KeyVault" $Yellow
        Write-ColorOutput "This may cause deployment to fail when retrieving secrets." $Yellow
        Write-ColorOutput "To fix, run: .\infrastructure\azure_deployment\fix_keyvault_permissions.ps1 -KeyVault $KeyVault" $Blue
    }
} catch {
    Write-ColorOutput "WARNING: Could not verify Key Vault accessibility: $_" $Yellow
}
Write-ColorOutput ""

# Step 1: Create or verify Container Apps Environment
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 1: Creating Container Apps Environment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Check if environment exists - handle errors gracefully
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

if ($envExists -and $envExists.name) {
    Write-ColorOutput "Container Apps Environment already exists: $EnvironmentName" $Green
} else {
    Write-ColorOutput "Creating Container Apps Environment: $EnvironmentName" $Blue
    
    # Step 1a: Register required resource providers
    Write-ColorOutput "Registering required resource providers..." $Blue
    $providers = @("Microsoft.OperationalInsights", "Microsoft.App")
    
    foreach ($provider in $providers) {
        $providerStatus = az provider show --namespace $provider --query "registrationState" -o tsv 2>&1
        if ($providerStatus -ne "Registered") {
            Write-ColorOutput "Registering $provider..." $Yellow
            az provider register --namespace $provider --wait 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "$provider registered successfully" $Green
            } else {
                Write-ColorOutput "WARNING: Failed to register $provider, but continuing..." $Yellow
            }
        } else {
            Write-ColorOutput "$provider is already registered" $Green
        }
    }
    
    # Step 1b: Create or use existing Log Analytics workspace
    $logAnalyticsName = "$EnvironmentName-logs"
    Write-ColorOutput "Checking for Log Analytics workspace..." $Blue
    
    $logAnalyticsOutput = az monitor log-analytics workspace show `
        --resource-group $ResourceGroup `
        --workspace-name $logAnalyticsName `
        --output json 2>&1
    
    $logAnalyticsWorkspace = $null
    if ($LASTEXITCODE -eq 0) {
        try {
            $logAnalyticsWorkspace = $logAnalyticsOutput | ConvertFrom-Json
            Write-ColorOutput "Log Analytics workspace already exists: $logAnalyticsName" $Green
        } catch {
            Write-ColorOutput "WARNING: Could not parse Log Analytics workspace output" $Yellow
        }
    }
    
    if (-not $logAnalyticsWorkspace -or -not $logAnalyticsWorkspace.customerId) {
        Write-ColorOutput "Creating Log Analytics workspace: $logAnalyticsName" $Blue
        $logAnalyticsOutput = az monitor log-analytics workspace create `
            --resource-group $ResourceGroup `
            --workspace-name $logAnalyticsName `
            --location $Location `
            --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            try {
                $logAnalyticsWorkspace = $logAnalyticsOutput | ConvertFrom-Json
                Write-ColorOutput "Log Analytics workspace created: $logAnalyticsName" $Green
            } catch {
                Write-ColorOutput "ERROR: Could not parse Log Analytics workspace creation output" $Red
                Write-ColorOutput "Error details: $logAnalyticsOutput" $Yellow
                exit 1
            }
        } else {
            Write-ColorOutput "ERROR: Failed to create Log Analytics workspace" $Red
            Write-ColorOutput "Error details: $logAnalyticsOutput" $Yellow
            exit 1
        }
    }
    
    # Get the workspace ID for Log Analytics
    # Azure Container Apps Environment requires the workspace customer ID (Workspace ID GUID)
    # Try customerId first (this is the Workspace ID), then fall back to resource ID
    $logAnalyticsWorkspaceId = $logAnalyticsWorkspace.customerId
    if (-not $logAnalyticsWorkspaceId) {
        # Fallback to resource ID if customerId is not available
        $logAnalyticsWorkspaceId = $logAnalyticsWorkspace.id
    }
    
    if (-not $logAnalyticsWorkspaceId) {
        Write-ColorOutput "ERROR: Could not determine Log Analytics workspace ID" $Red
        Write-ColorOutput "Workspace details: $($logAnalyticsWorkspace | ConvertTo-Json)" $Yellow
        exit 1
    }
    
    # Step 1c: Create Container Apps Environment with Log Analytics workspace
    Write-ColorOutput "Creating Container Apps Environment with Log Analytics workspace..." $Blue
    Write-ColorOutput "Using Log Analytics workspace: $($logAnalyticsWorkspace.name)" $Blue
    $createOutput = az containerapp env create `
        --name $EnvironmentName `
        --resource-group $ResourceGroup `
        --location $Location `
        --logs-workspace-id $logAnalyticsWorkspaceId `
        --output none 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "Container Apps Environment created: $EnvironmentName" $Green
    } else {
        Write-ColorOutput "ERROR: Failed to create Container Apps Environment" $Red
        Write-ColorOutput "Error details: $createOutput" $Yellow
        Write-ColorOutput "" $Yellow
        Write-ColorOutput "If the error mentions 'OperationalInsights', try manually registering:" $Cyan
        Write-ColorOutput "  az provider register -n Microsoft.OperationalInsights --wait" $Blue
        exit 1
    }
}

Write-ColorOutput ""

# Step 2: Create or verify Azure Container Registry
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Creating Azure Container Registry" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

if ([string]::IsNullOrEmpty($RegistryName)) {
    # First, try to discover actual Container Registry name from resource group
    $acrName = $null
    $acrListOutput = az acr list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
    if ($LASTEXITCODE -eq 0 -and $acrListOutput) {
        # Parse the output - handle newlines and multiple registries
        $acrOutputString = $acrListOutput.ToString().Trim()
        if ($acrOutputString -and $acrOutputString -ne "" -and $acrOutputString -notmatch '^System\.') {
            # Split by newlines and get all non-empty entries
            $acrList = $acrOutputString -split "`r?`n" | Where-Object { $_ -and $_.ToString().Trim() -ne "" } | ForEach-Object { $_.ToString().Trim() }
            if ($acrList -and $acrList.Count -gt 0) {
                # Priority order:
                # 1. One matching resource group name pattern (most reliable for existing deployments)
                # 2. One matching suffix
                # 3. First one found
                $rgPattern = $ResourceGroup -replace '^rg-wealtharena-', ''
                $preferredAcr = $acrList | Where-Object { $_ -match $rgPattern }
                if ($preferredAcr) {
                    $acrName = $preferredAcr
                    Write-ColorOutput "   Discovered Container Registry (matching resource group): $acrName" $Cyan
                } else {
                    $preferredAcr = $acrList | Where-Object { $_ -match $discoveredSuffix }
                    if ($preferredAcr) {
                        $acrName = $preferredAcr
                        Write-ColorOutput "   Discovered Container Registry (matching suffix): $acrName" $Cyan
                    } else {
                        $acrName = $acrList[0]
                        Write-ColorOutput "   Discovered Container Registry: $acrName" $Cyan
                        if ($acrList.Count -gt 1) {
                            Write-ColorOutput "   (Found $($acrList.Count) Container Registry(ies), using first one)" $Yellow
                        }
                    }
                }
            }
        }
    }
    
    # If not found, use constructed name as fallback
    if (-not $acrName) {
        Write-ColorOutput "   WARNING: No Container Registry found in resource group, using constructed name" $Yellow
        $acrName = "acrwealtharena$discoveredSuffix"
        # ACR name must be lowercase and alphanumeric only
        $acrName = $acrName.ToLower() -replace '[^a-z0-9]', ''
        Write-ColorOutput "   Using constructed name: $acrName" $Yellow
    }
    
    $RegistryName = $acrName
}

# Check if ACR exists - handle errors gracefully
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

if ($acrExists -and $acrExists.name) {
    Write-ColorOutput "Container Registry already exists: $RegistryName" $Green
} else {
    Write-ColorOutput "Creating Azure Container Registry: $RegistryName" $Blue
    
    # Attempt to create ACR with collision handling
    $maxRetries = 3
    $retryCount = 0
    $acrCreated = $false
    $originalRegistryName = $RegistryName
    
    while (-not $acrCreated -and $retryCount -lt $maxRetries) {
        $acrCheck = az acr show --name $RegistryName --output json 2>&1
        if ($LASTEXITCODE -eq 0) {
            # Registry exists in another subscription or resource group
            Write-ColorOutput "Registry name $RegistryName already exists, generating unique name..." $Yellow
            $randomSuffix = -join ((48..57) + (97..122) | Get-Random -Count 5 | ForEach-Object {[char]$_})
            $RegistryName = "$originalRegistryName$randomSuffix"
            Write-ColorOutput "Trying new name: $RegistryName" $Blue
            $retryCount++
            continue
        }
        
        az acr create `
            --name $RegistryName `
            --resource-group $ResourceGroup `
            --sku Basic `
            --admin-enabled true `
            --output none 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Container Registry created: $RegistryName" $Green
            $acrCreated = $true
        } else {
            # Check if it's a name collision error
            $errorOutput = az acr create `
                --name $RegistryName `
                --resource-group $ResourceGroup `
                --sku Basic `
                --admin-enabled true `
                --output json 2>&1 | Out-String
            
            if ($errorOutput -match "already exists" -or $errorOutput -match "already in use") {
                Write-ColorOutput "Registry name $RegistryName already exists, generating unique name..." $Yellow
                $randomSuffix = -join ((48..57) + (97..122) | Get-Random -Count 5 | ForEach-Object {[char]$_})
                $RegistryName = "$originalRegistryName$randomSuffix"
                Write-ColorOutput "Trying new name: $RegistryName" $Blue
                $retryCount++
            } else {
                Write-ColorOutput "ERROR: Failed to create Container Registry: $errorOutput" $Red
                exit 1
            }
        }
    }
    
    if (-not $acrCreated) {
        Write-ColorOutput "ERROR: Failed to create Container Registry after $maxRetries attempts" $Red
        exit 1
    }
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
    Write-ColorOutput "Please install Docker Desktop and ensure it's running" $Yellow
    exit 1
}
Write-ColorOutput "Docker is available" $Green

$dockerPs = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Docker daemon is not running" $Red
    Write-ColorOutput "Please start Docker Desktop" $Yellow
    exit 1
}
Write-ColorOutput "Docker daemon is running" $Green

Write-ColorOutput ""
Write-ColorOutput "Logging into Azure Container Registry..." $Blue
az acr login --name $RegistryName

$fullImageName = "$RegistryName.azurecr.io/$ImageName"

Write-ColorOutput "Building Docker image: $fullImageName" $Blue
Write-ColorOutput "Build context: $backendDir" $Blue
Set-Location $backendDir

# Verify required files exist before building
if (-not (Test-Path "package.json")) {
    Write-ColorOutput "ERROR: package.json not found in $backendDir" $Red
    exit 1
}
if (-not (Test-Path "tsconfig.json")) {
    Write-ColorOutput "ERROR: tsconfig.json not found in $backendDir" $Red
    exit 1
}
if (-not (Test-Path "src")) {
    Write-ColorOutput "ERROR: src directory not found in $backendDir" $Red
    exit 1
}

# Build Docker image with verbose output
Write-ColorOutput "Starting Docker build (this may take several minutes)..." $Yellow
$buildOutput = docker build --progress=plain -t $fullImageName . 2>&1
$buildExitCode = $LASTEXITCODE

# Display build output
Write-ColorOutput "Docker build output:" $Blue
$buildOutput | ForEach-Object {
    # Highlight errors in red
    if ($_ -match "error|ERROR|failed|FAILED") {
        Write-Host $_ -ForegroundColor Red
    } elseif ($_ -match "warning|WARNING") {
        Write-Host $_ -ForegroundColor Yellow
    } else {
        Write-Host $_ -ForegroundColor Gray
    }
}

if ($buildExitCode -ne 0) {
    Write-ColorOutput "" $Red
    Write-ColorOutput "ERROR: Docker build failed with exit code $buildExitCode" $Red
    Write-ColorOutput "" $Red
    Write-ColorOutput "Common causes:" $Yellow
    Write-ColorOutput "  1. TypeScript compilation errors (check src/ directory)" $Blue
    Write-ColorOutput "  2. Missing dependencies (check package.json)" $Blue
    Write-ColorOutput "  3. Missing files in Docker build context" $Blue
    Write-ColorOutput "" $Yellow
    Write-ColorOutput "To debug locally, run:" $Cyan
    Write-ColorOutput "  cd $backendDir" $Blue
    Write-ColorOutput "  npm install" $Blue
    Write-ColorOutput "  npm run build" $Blue
    Write-ColorOutput "  docker build -t test-image ." $Blue
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

# Get ACR credentials
$acrLoginServer = az acr show --name $RegistryName --query loginServer -o tsv
$acrUsername = az acr credential show --name $RegistryName --query username -o tsv
$acrPassword = az acr credential show --name $RegistryName --query passwords[0].value -o tsv

# Derive SQL Server name using discovered suffix (Key Vault already derived above)
$sqlServerHost = "sql-wealtharena-$discoveredSuffix.database.windows.net"

# Generate JWT secret
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Check if container app exists - handle errors gracefully
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
    
    # First, register/update the registry credentials with the Container App
    # This is required for authentication when pulling images
    # Use 'registry add' which will add or update the registry if it already exists
    Write-ColorOutput "Registering ACR credentials with Container App..." $Blue
    
    # Check if registry is already registered
    $existingRegistries = az containerapp registry list --name $ContainerAppName --resource-group $ResourceGroup --query "[?server=='$acrLoginServer'].server" -o tsv 2>&1
    $registryExists = $false
    if ($LASTEXITCODE -eq 0 -and $existingRegistries -and $existingRegistries.ToString().Trim() -eq $acrLoginServer) {
        $registryExists = $true
        Write-ColorOutput "   Registry already registered, updating credentials..." $Cyan
    }
    
    # Add or update registry credentials using 'set' command
    $registryAddOutput = az containerapp registry set `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --server $acrLoginServer `
        --username $acrUsername `
        --password $acrPassword `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "WARNING: Failed to register registry credentials: $registryAddOutput" $Yellow
        Write-ColorOutput "Continuing with image update (registry may already be configured)..." $Yellow
    } else {
        Write-ColorOutput "Registry credentials registered successfully" $Green
    }
    
    # Now update the image (registry credentials are already registered)
    Write-ColorOutput "Updating container image..." $Blue
    $updateOutput = az containerapp update `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --image $fullImageName `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "ERROR: Failed to update Container App" $Red
        Write-ColorOutput "Error details:" $Red
        Write-ColorOutput $updateOutput $Red
        Write-ColorOutput "" $Red
        Write-ColorOutput "Troubleshooting steps:" $Cyan
        Write-ColorOutput "  1. Check if the Container App is in a healthy state" $Blue
        Write-ColorOutput "  2. Verify registry credentials are correct" $Blue
        Write-ColorOutput "  3. Verify ACR admin access is enabled: az acr update --name $RegistryName --admin-enabled true" $Blue
        Write-ColorOutput "  4. Register registry manually: az containerapp registry set --name $ContainerAppName --resource-group $ResourceGroup --server $acrLoginServer --username $acrUsername --password $acrPassword" $Blue
        Write-ColorOutput "  5. Then update image: az containerapp update --name $ContainerAppName --resource-group $ResourceGroup --image $fullImageName" $Blue
        exit 1
    }
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
        --target-port 8080 `
        --ingress external `
        --min-replicas 0 `
        --max-replicas 1 `
        --cpu 0.5 `
        --memory 1.0Gi `
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
Write-ColorOutput "Step 5: Configuring Environment Variables" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Retrieve DB password from Key Vault
Write-ColorOutput "Retrieving DB password from Key Vault..." $Blue
$dbPassword = $null
$dbPasswordOutput = az keyvault secret show --name sql-password --vault-name $KeyVault --query value -o tsv 2>&1

if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($dbPasswordOutput) -and -not $dbPasswordOutput.StartsWith("az:")) {
    $dbPassword = $dbPasswordOutput
    Write-ColorOutput "DB password retrieved from Key Vault: $KeyVault" $Green
} else {
    Write-ColorOutput "WARNING: Failed to retrieve DB password from Key Vault: $KeyVault" $Yellow
    Write-ColorOutput "Database connection may fail. Please set DB_PASSWORD manually." $Yellow
    Write-ColorOutput "" $Yellow
    Write-ColorOutput "This is likely a Key Vault permissions issue. To fix:" $Cyan
    Write-ColorOutput "  1. Run the fix script: .\infrastructure\azure_deployment\fix_keyvault_permissions.ps1 -KeyVault $KeyVault" $Blue
    Write-ColorOutput "  2. Or manually grant permissions: az keyvault set-policy --name $KeyVault --upn <your-email> --secret-permissions get list" $Blue
    Write-ColorOutput "  3. Verify access: az keyvault secret show --name sql-password --vault-name $KeyVault" $Blue
    if ($dbPasswordOutput) {
        Write-ColorOutput "Error details: $dbPasswordOutput" $Yellow
    }
}

# Set secrets in Container App Environment
Write-ColorOutput "Setting secrets..." $Blue
$secrets = @("jwt-secret=$jwtSecret")
if ($dbPassword) {
    $secrets += "db-password=$dbPassword"
}
az containerapp secret set `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --secrets $secrets `
    --output none 2>&1 | Out-Null

# Update container app with environment variables (without cross-service URLs initially)
Write-ColorOutput "Configuring environment variables (without cross-service URLs - will be updated after all services are deployed)..." $Blue
$envVarsList = @(
    "DB_HOST=$sqlServerHost",
    "DB_NAME=wealtharena_db",
    "DB_USER=wealtharena_admin",
    "DB_PORT=1433",
    "DB_TYPE=mssql",
    "DB_ENCRYPT=true",
    "NODE_ENV=production",
    "PORT=8080",
    "JWT_SECRET=secretref:jwt-secret",
    "JWT_EXPIRES_IN=7d"
)

if ($dbPassword) {
    $envVarsList += "DB_PASSWORD=secretref:db-password"
}

az containerapp update `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --set-env-vars $envVarsList `
    --output none 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "Environment variables configured (cross-service URLs will be set after all services are deployed)" $Green
} else {
    Write-ColorOutput "WARNING: Some environment variables may not have been configured" $Yellow
}

Write-ColorOutput ""

# Step 6: Get Container App URL and test
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 6: Testing Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$containerAppUrl = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv

if ($containerAppUrl) {
    $fullUrl = "https://$containerAppUrl"
    Write-ColorOutput "Container App URL: $fullUrl" $Cyan
    Write-ColorOutput ""
    
    Write-ColorOutput "Waiting for container to start (60 seconds)..." $Yellow
    Start-Sleep -Seconds 60
    
    Write-ColorOutput "Testing health endpoint with retries..." $Yellow
    $maxRetries = 3
    $retryDelay = 10
    $healthCheckPassed = $false
    
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            Write-ColorOutput "Health check attempt $i of $maxRetries..." $Blue
            $healthResponse = Invoke-WebRequest -Uri "$fullUrl/health" -Method Get -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
            
            if ($healthResponse.StatusCode -eq 200 -or $healthResponse.StatusCode -eq 503) {
                $healthData = $healthResponse.Content | ConvertFrom-Json
                Write-ColorOutput "Backend is responding!" $Green
                Write-ColorOutput "  Status: $($healthData.status)" $Green
                Write-ColorOutput "  Database: $($healthData.database)" $Green
                
                if ($healthData.database -eq 'connected') {
                    Write-ColorOutput "Backend is fully healthy!" $Green
                } elseif ($healthData.database -eq 'disconnected') {
                    Write-ColorOutput "Backend is running but database is disconnected" $Yellow
                    Write-ColorOutput "   Check database configuration and credentials" $Yellow
                    Write-ColorOutput "   Server is operational but some features may not work" $Yellow
                }
                $healthCheckPassed = $true
                break
            } else {
                Write-ColorOutput "WARNING: Backend responded with status $($healthResponse.StatusCode)" $Yellow
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
                Write-ColorOutput "  2. Verify database connection: Check DB_HOST, DB_PORT, DB_TYPE, and DB_PASSWORD" $Blue
                Write-ColorOutput "  3. Container may still be starting - wait a few minutes and try again" $Blue
            }
        }
    }
} else {
    Write-ColorOutput "WARNING: Could not retrieve Container App URL" $Yellow
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
Write-ColorOutput ""
Write-ColorOutput "Next Steps:" $Yellow
Write-ColorOutput "   1. Verify database connection in Azure Portal" $Blue
Write-ColorOutput "   2. Check Container App logs for any errors" $Blue
Write-ColorOutput "   3. Proceed to deploy chatbot service" $Blue
Write-ColorOutput ""

