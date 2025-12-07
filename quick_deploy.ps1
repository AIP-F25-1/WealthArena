#Requires -Version 5.1

<#
.SYNOPSIS
    WealthArena Quick Deployment Script - Fast deployment for existing artifacts
    
.DESCRIPTION
    Provides a fast-track deployment option that skips time-consuming phases
    (data download, processing, training) and focuses on deployment and testing.
    Ideal for redeployments after code changes.
    
.PARAMETER ResourceGroup
    Azure resource group name
    
.PARAMETER Location
    Azure region
    
.PARAMETER SkipAPKBuild
    Skip APK build phase
    
.PARAMETER Environment
    Deployment environment (dev, staging, production)
    
.EXAMPLE
    .\quick_deploy.ps1
    
.EXAMPLE
    .\quick_deploy.ps1 -SkipAPKBuild
    
.EXAMPLE
    .\quick_deploy.ps1 -Environment production
#>

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [switch]$SkipAPKBuild = $false,
    [string]$Environment = "dev"
)

# Set strict error handling
$ErrorActionPreference = "Stop"

# Colors for output
$script:Green = "Green"
$script:Red = "Red"
$script:Yellow = "Yellow"
$script:Blue = "Blue"
$script:Cyan = "Cyan"

# Get script directory
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $script:ScriptDir

# Import common automation functions
$commonScript = Join-Path $script:ScriptDir "scripts\utilities\automation_common.ps1"
if (Test-Path $commonScript) {
    . $commonScript
}
else {
    Write-Warning "automation_common.ps1 not found. URL resolution may not work correctly."
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-SectionHeader {
    param([string]$Message)
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput $Message $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
}

function Load-DeploymentConfig {
    param([string]$ConfigFile = "config/automation_config.yaml")
    
    $configPath = Join-Path $script:ScriptDir $ConfigFile
    $deploymentConfig = @{}
    
    # Check if powershell-yaml module is available - REQUIRED
    $yamlLoaded = $false
    try {
        if (Get-Module -ListAvailable -Name powershell-yaml) {
            Import-Module powershell-yaml -ErrorAction Stop
            $yamlLoaded = $true
        }
        else {
            Write-Error "ERROR: powershell-yaml module is not installed"
            Write-Error "Please install it with: Install-Module -Name powershell-yaml -Scope CurrentUser -Force"
            exit 1
        }
    }
    catch {
        Write-Error "ERROR: Failed to load powershell-yaml module: $_"
        exit 1
    }
    
    if (-not (Test-Path $configPath)) {
        Write-Error "ERROR: Configuration file not found: $ConfigFile"
        throw "Configuration file not found: $ConfigFile"
    }
    
    Write-ColorOutput "Loading configuration from $ConfigFile..." $Blue
    try {
        $fullConfig = Get-Content $configPath -Raw | ConvertFrom-Yaml -Ordered
        
        if ($null -eq $fullConfig) {
            throw "Configuration file parsed as null. Check YAML syntax."
        }
        
        # Normalize deployment section - handle both camelCase and snake_case
        $deploymentSection = $null
        if ($fullConfig.Deployment) { $deploymentSection = $fullConfig.Deployment }
        elseif ($fullConfig.deployment) { $deploymentSection = $fullConfig.deployment }
        
        if ($deploymentSection) {
            # Use canonical keys (BackendAppName, ChatbotAppName, RLServiceAppName)
            if ($deploymentSection.BackendAppName) {
                $deploymentConfig.BackendAppName = $deploymentSection.BackendAppName
            }
            elseif ($deploymentSection.backend_app_name) {
                $deploymentConfig.BackendAppName = $deploymentSection.backend_app_name
            }
            else {
                throw "Missing required key: deployment.backend_app_name"
            }
            
            if ($deploymentSection.ChatbotAppName) {
                $deploymentConfig.ChatbotAppName = $deploymentSection.ChatbotAppName
            }
            elseif ($deploymentSection.chatbot_app_name) {
                $deploymentConfig.ChatbotAppName = $deploymentSection.chatbot_app_name
            }
            else {
                throw "Missing required key: deployment.chatbot_app_name"
            }
            
            if ($deploymentSection.RLServiceAppName) {
                $deploymentConfig.RLServiceAppName = $deploymentSection.RLServiceAppName
            }
            elseif ($deploymentSection.rl_service_app_name) {
                $deploymentConfig.RLServiceAppName = $deploymentSection.rl_service_app_name
            }
            else {
                throw "Missing required key: deployment.rl_service_app_name"
            }
            
            # Also set snake_case for backward compatibility
            $deploymentConfig.backend_app_name = $deploymentConfig.BackendAppName
            $deploymentConfig.chatbot_app_name = $deploymentConfig.ChatbotAppName
            $deploymentConfig.rl_service_app_name = $deploymentConfig.RLServiceAppName
            
            Write-ColorOutput "✅ Configuration loaded successfully" $Green
        }
        else {
            throw "Missing required section: Deployment"
        }
    }
    catch {
        Write-ColorOutput "❌ Error loading configuration: $_" $Red
        throw
    }
    
    return $deploymentConfig
}

function Test-Prerequisites {
    Write-SectionHeader "Checking Prerequisites"
    
    $issues = @()
    
    # Check Azure CLI
    Write-ColorOutput "Checking Azure CLI..." $Blue
    try {
        $azVersion = az --version 2>&1 | Select-Object -First 1
        Write-ColorOutput "✅ Azure CLI installed: $azVersion" $Green
    }
    catch {
        $issues += "Azure CLI not installed. Install with: winget install Microsoft.AzureCLI"
    }
    
    # Check Azure login
    Write-ColorOutput "Checking Azure authentication..." $Blue
    try {
        $account = az account show --output json 2>&1 | ConvertFrom-Json
        if ($account) {
            Write-ColorOutput "✅ Logged in as: $($account.user.name)" $Green
        }
        else {
            $issues += "Not logged in to Azure. Run: az login"
        }
    }
    catch {
        $issues += "Not logged in to Azure. Run: az login"
    }
    
    # Check if data exists
    Write-ColorOutput "Checking for existing data..." $Blue
    $dataDir = Join-Path $script:ScriptDir "data-pipeline" "data" "raw"
    if (Test-Path $dataDir) {
        $dataFiles = Get-ChildItem $dataDir -File -Filter "*.csv"
        if ($dataFiles.Count -gt 0) {
            Write-ColorOutput "✅ Found $($dataFiles.Count) data files" $Green
        }
        else {
            Write-ColorOutput "⚠️  No data files found. Run data download first." $Yellow
        }
    }
    else {
        Write-ColorOutput "⚠️  Data directory not found. Run data download first." $Yellow
    }
    
    # Check if models exist
    Write-ColorOutput "Checking for existing models..." $Blue
    $checkpointsDir = Join-Path $script:ScriptDir "rl-training" "checkpoints"
    if (Test-Path $checkpointsDir) {
        $modelFiles = Get-ChildItem $checkpointsDir -Recurse -File
        if ($modelFiles.Count -gt 0) {
            Write-ColorOutput "✅ Found $($modelFiles.Count) model files" $Green
        }
        else {
            Write-ColorOutput "⚠️  No model files found. Run training first." $Yellow
        }
    }
    else {
        Write-ColorOutput "⚠️  Checkpoints directory not found. Run training first." $Yellow
    }
    
    # Check Azure resources
    Write-ColorOutput "Checking Azure resources..." $Blue
    try {
        $rgExists = az group show --name $ResourceGroup --output json 2>&1
        if ($rgExists) {
            $rgInfo = $rgExists | ConvertFrom-Json
            Write-ColorOutput "✅ Resource group exists: $ResourceGroup" $Green
        }
        else {
            $issues += "Resource group not found: $ResourceGroup. Run infrastructure setup first."
        }
    }
    catch {
        $issues += "Could not check resource group: $_"
    }
    
    # Check SQL Server
    Write-ColorOutput "Checking Azure SQL Server..." $Blue
    try {
        $sqlServers = az sql server list --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json
        if ($sqlServers.Count -gt 0) {
            Write-ColorOutput "✅ Found SQL Server: $($sqlServers[0].name)" $Green
        }
        else {
            $issues += "No SQL Server found in resource group. Run infrastructure setup first."
        }
    }
    catch {
        Write-ColorOutput "⚠️  Could not check SQL Server: $_" $Yellow
    }
    
    # Check Storage Account
    Write-ColorOutput "Checking Storage Account..." $Blue
    try {
        $storageAccounts = az storage account list --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json
        if ($storageAccounts.Count -gt 0) {
            Write-ColorOutput "✅ Found Storage Account: $($storageAccounts[0].name)" $Green
        }
        else {
            $issues += "No Storage Account found. Run infrastructure setup first."
        }
    }
    catch {
        Write-ColorOutput "⚠️  Could not check Storage Account: $_" $Yellow
    }
    
    # Check Web Apps
    Write-ColorOutput "Checking Web Apps..." $Blue
    try {
        $webApps = az webapp list --resource-group $ResourceGroup --output json 2>&1 | ConvertFrom-Json
        if ($webApps) {
            Write-ColorOutput "✅ Found $($webApps.Count) Web Apps" $Green
        }
        else {
            Write-ColorOutput "⚠️  No Web Apps found. Will need to deploy services." $Yellow
        }
    }
    catch {
        Write-ColorOutput "⚠️  Could not check Web Apps: $_" $Yellow
    }
    
    Write-Host ""
    
    if ($issues.Count -gt 0) {
        Write-ColorOutput "❌ Critical issues found:" $Red
        foreach ($issue in $issues) {
            Write-ColorOutput "  - $issue" $Red
        }
        Write-Host ""
        Write-ColorOutput "Please fix these issues before continuing." $Yellow
        return $false
    }
    
    Write-ColorOutput "✅ All prerequisites met!" $Green
    return $true
}

function Invoke-DeployServices {
    Write-SectionHeader "Deploying Services to Azure"
    
    try {
        $deployDir = Join-Path $script:ScriptDir "infrastructure" "azure_deployment"
        if (-not (Test-Path $deployDir)) {
            throw "Deployment directory not found: $deployDir"
        }
        
        Set-Location $deployDir
        Write-ColorOutput "Executing deployment script..." $Blue
        
        & ".\deploy_all_services.ps1" -ResourceGroup $ResourceGroup -Location $Location
        
        if ($LASTEXITCODE -ne 0) {
            throw "Service deployment failed"
        }
        
        Write-ColorOutput "✅ Services deployed successfully!" $Green
        return $true
    }
    catch {
        Write-ColorOutput "❌ Service deployment failed: $_" $Red
        return $false
    }
    finally {
        Set-Location $script:ScriptDir
    }
}

function Invoke-UploadModels {
    Write-SectionHeader "Uploading Models to Azure Blob Storage"
    
    try {
        $deployDir = Join-Path $script:ScriptDir "infrastructure" "azure_deployment"
        $uploadScript = Join-Path $deployDir "upload_models.ps1"
        
        if (-not (Test-Path $uploadScript)) {
            Write-ColorOutput "⚠️  Upload script not found. Skipping model upload." $Yellow
            return $true
        }
        
        Set-Location $deployDir
        Write-ColorOutput "Executing model upload script..." $Blue
        
        & $uploadScript -ResourceGroup $ResourceGroup
        
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "⚠️  Model upload returned non-zero exit code." $Yellow
            return $true  # Don't fail deployment if upload has issues
        }
        
        Write-ColorOutput "✅ Models uploaded successfully!" $Green
        return $true
    }
    catch {
        Write-ColorOutput "⚠️  Model upload warning: $_" $Yellow
        return $true  # Don't fail deployment
    }
    finally {
        Set-Location $script:ScriptDir
    }
}

function Invoke-UpdateFrontendConfig {
    param([hashtable]$ServiceUrls)
    
    Write-SectionHeader "Updating Frontend Configuration"
    
    try {
        $frontendDir = Join-Path $script:ScriptDir "frontend"
        $envFile = Join-Path $frontendDir ".env.azure"
        
        Write-ColorOutput "Creating .env.azure configuration..." $Blue
        
        # Use resolved URLs, or fallback to defaults (prefer Container Apps)
        $backendUrl = $ServiceUrls.Backend
        if (-not $backendUrl) {
            # Try Container App first, then fallback to App Service
            $backendFqdn = az containerapp show --name "wealtharena-backend" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($backendFqdn) -and -not $backendFqdn.StartsWith("az:")) {
                $backendUrl = "https://$backendFqdn"
            } else {
                $backendUrl = "https://wealtharena-backend.azurewebsites.net"
            }
        }
        
        $chatbotUrl = $ServiceUrls.Chatbot
        if (-not $chatbotUrl) {
            # Try Container App first, then fallback to App Service
            $chatbotFqdn = az containerapp show --name "wealtharena-chatbot" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($chatbotFqdn) -and -not $chatbotFqdn.StartsWith("az:")) {
                $chatbotUrl = "https://$chatbotFqdn"
            } else {
                $chatbotUrl = "https://wealtharena-chatbot.azurewebsites.net"
            }
        }
        
        $rlServiceUrl = $ServiceUrls.RLService
        if (-not $rlServiceUrl) {
            # Try Container App first, then fallback to App Service
            $rlFqdn = az containerapp show --name "wealtharena-rl" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($rlFqdn) -and -not $rlFqdn.StartsWith("az:")) {
                $rlServiceUrl = "https://$rlFqdn"
            } else {
                $rlServiceUrl = "https://wealtharena-rl.azurewebsites.net"
            }
        }
        
        $configContent = @"
EXPO_PUBLIC_DEPLOYMENT_ENV=azure
EXPO_PUBLIC_BACKEND_URL=$backendUrl
EXPO_PUBLIC_CHATBOT_URL=$chatbotUrl
EXPO_PUBLIC_RL_SERVICE_URL=$rlServiceUrl
"@
        
        Set-Content -Path $envFile -Value $configContent -Force
        Write-ColorOutput "Frontend configuration updated!" $Green
        Write-ColorOutput "  Backend: $backendUrl" $White
        Write-ColorOutput "  Chatbot: $chatbotUrl" $White
        Write-ColorOutput "  RL Service: $rlServiceUrl" $White
        return $true
    }
    catch {
        Write-ColorOutput "ERROR: Frontend configuration failed: $_" $Red
        return $false
    }
}

function Invoke-HealthChecks {
    param([hashtable]$ServiceUrls)
    
    Write-SectionHeader "Running Health Checks"
    
    $testResults = @()
    
    # Use resolved URLs, or fallback to defaults (prefer Container Apps)
    $backendBaseUrl = $ServiceUrls.Backend
    if (-not $backendBaseUrl) {
        # Try Container App first, then fallback to App Service
        $backendFqdn = az containerapp show --name "wealtharena-backend" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($backendFqdn) -and -not $backendFqdn.StartsWith("az:")) {
            $backendBaseUrl = "https://$backendFqdn"
        } else {
            $backendBaseUrl = "https://wealtharena-backend.azurewebsites.net"
        }
    }
    
    $chatbotBaseUrl = $ServiceUrls.Chatbot
    if (-not $chatbotBaseUrl) {
        # Try Container App first, then fallback to App Service
        $chatbotFqdn = az containerapp show --name "wealtharena-chatbot" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($chatbotFqdn) -and -not $chatbotFqdn.StartsWith("az:")) {
            $chatbotBaseUrl = "https://$chatbotFqdn"
        } else {
            $chatbotBaseUrl = "https://wealtharena-chatbot.azurewebsites.net"
        }
    }
    
    $rlServiceBaseUrl = $ServiceUrls.RLService
    if (-not $rlServiceBaseUrl) {
        # Try Container App first, then fallback to App Service
        $rlFqdn = az containerapp show --name "wealtharena-rl" --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($rlFqdn) -and -not $rlFqdn.StartsWith("az:")) {
            $rlServiceBaseUrl = "https://$rlFqdn"
        } else {
            $rlServiceBaseUrl = "https://wealtharena-rl.azurewebsites.net"
        }
    }
    
    # Test backend - standardized /health endpoint
    Write-ColorOutput "Testing backend service..." $Blue
    try {
        $backendUrl = "$backendBaseUrl/health"
        $response = Invoke-WebRequest -Uri $backendUrl -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "Backend is healthy" $Green
            $testResults += "Backend: PASS"
        }
        else {
            Write-ColorOutput "WARNING: Backend returned status $($response.StatusCode)" $Yellow
            $testResults += "Backend: FAIL"
        }
    }
    catch {
        Write-ColorOutput "WARNING: Backend health check failed: $_" $Yellow
        $testResults += "Backend: FAIL"
    }
    
    # Test chatbot - standardized /health endpoint
    Write-ColorOutput "Testing chatbot service..." $Blue
    try {
        $chatbotUrl = "$chatbotBaseUrl/health"
        $response = Invoke-WebRequest -Uri $chatbotUrl -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "Chatbot is healthy" $Green
            $testResults += "Chatbot: PASS"
        }
        else {
            Write-ColorOutput "WARNING: Chatbot returned status $($response.StatusCode)" $Yellow
            $testResults += "Chatbot: FAIL"
        }
    }
    catch {
        Write-ColorOutput "WARNING: Chatbot health check failed: $_" $Yellow
        $testResults += "Chatbot: FAIL"
    }
    
    # Test RL service - standardized /health endpoint
    Write-ColorOutput "Testing RL service..." $Blue
    try {
        $rlUrl = "$rlServiceBaseUrl/health"
        $response = Invoke-WebRequest -Uri $rlUrl -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "RL service is healthy" $Green
            $testResults += "RL Service: PASS"
        }
        else {
            Write-ColorOutput "WARNING: RL service returned status $($response.StatusCode)" $Yellow
            $testResults += "RL Service: FAIL"
        }
    }
    catch {
        Write-ColorOutput "WARNING: RL service health check failed: $_" $Yellow
        $testResults += "RL Service: FAIL"
    }
    
    Write-Host ""
    Write-ColorOutput "Test Results:" $White
    foreach ($result in $testResults) {
        if ($result -like "*FAIL") {
            Write-ColorOutput "  $result" $Red
        }
        else {
            Write-ColorOutput "  $result" $Green
        }
    }
    
    return $true
}

function Invoke-BuildAPK {
    if ($SkipAPKBuild) {
        Write-SectionHeader "Skipping APK Build"
        Write-ColorOutput "APK build skipped as requested." $Yellow
        return $true
    }
    
    Write-SectionHeader "Building Android APK"
    
    try {
        $frontendDir = Join-Path $script:ScriptDir "frontend"
        Set-Location $frontendDir
        
        Write-ColorOutput "Verifying EAS CLI..." $Blue
        try {
            $easVersion = eas --version 2>&1
            Write-ColorOutput "✅ EAS CLI: $easVersion" $Green
        }
        catch {
            throw "EAS CLI not installed. Run: npm install -g eas-cli"
        }
        
        Write-ColorOutput "Starting APK build..." $Blue
        Write-ColorOutput "Note: This will take 15-30 minutes." $Yellow
        
        $profile = switch ($Environment) {
            "production" { "production" }
            "staging" { "preview" }
            default { "development" }
        }
        
        eas build --platform android --profile $profile --non-interactive
        
        if ($LASTEXITCODE -ne 0) {
            throw "APK build failed"
        }
        
        Write-ColorOutput "✅ APK build completed!" $Green
        return $true
    }
    catch {
        Write-ColorOutput "❌ APK build failed: $_" $Red
        return $false
    }
    finally {
        Set-Location $script:ScriptDir
    }
}

function Main {
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "WealthArena Quick Deployment" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    Write-ColorOutput "This script performs fast deployment assuming:" $White
    Write-ColorOutput "  ✓ Data already downloaded and processed" $White
    Write-ColorOutput "  ✓ RL models already trained" $White
    Write-ColorOutput "  ✓ Azure infrastructure already provisioned" $White
    Write-Host ""
    Write-ColorOutput "Estimated time: 30-60 minutes" $Yellow
    Write-Host ""
    
    $startTime = Get-Date
    
    # Load deployment configuration
    $deploymentConfig = Load-DeploymentConfig
    
    # Step 1: Check prerequisites
    if (-not (Test-Prerequisites)) {
        Write-ColorOutput "❌ Prerequisites check failed. Cannot proceed." $Red
        exit 1
    }
    
    Write-Host ""
    Write-ColorOutput "Continue with deployment? (Y/N)" $Yellow
    $response = Read-Host
    if ($response -ne "Y" -and $response -ne "y") {
        Write-ColorOutput "Deployment cancelled." $Yellow
        exit 0
    }
    
    # Step 2: Deploy services
    if (-not (Invoke-DeployServices)) {
        Write-ColorOutput "❌ Deployment failed!" $Red
        exit 1
    }
    
    # Resolve service URLs after deployment
    Write-SectionHeader "Resolving Service URLs"
    Write-ColorOutput "Resolving service URLs from Azure..." $Blue
    $serviceUrls = Resolve-ServiceUrls -ResourceGroup $ResourceGroup -DeploymentConfig $deploymentConfig
    
    if ($serviceUrls.Count -eq 0) {
        Write-ColorOutput "WARNING: Could not resolve service URLs. Attempting Container Apps resolution..." $Yellow
        
        # Try to resolve Container Apps URLs directly
        $backendAppName = $deploymentConfig.BackendAppName
        if (-not $backendAppName) { $backendAppName = $deploymentConfig.backend_app_name }
        $chatbotAppName = $deploymentConfig.ChatbotAppName
        if (-not $chatbotAppName) { $chatbotAppName = $deploymentConfig.chatbot_app_name }
        $rlServiceAppName = $deploymentConfig.RLServiceAppName
        if (-not $rlServiceAppName) { $rlServiceAppName = $deploymentConfig.rl_service_app_name }
        
        $serviceUrls = @{}
        
        # Try Container Apps first, then fallback to App Service format
        if ($backendAppName) {
            $backendFqdn = az containerapp show --name $backendAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($backendFqdn) -and -not $backendFqdn.StartsWith("az:")) {
                $serviceUrls.Backend = "https://$backendFqdn"
            } else {
                $serviceUrls.Backend = "https://$backendAppName.azurewebsites.net"
            }
        }
        
        if ($chatbotAppName) {
            $chatbotFqdn = az containerapp show --name $chatbotAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($chatbotFqdn) -and -not $chatbotFqdn.StartsWith("az:")) {
                $serviceUrls.Chatbot = "https://$chatbotFqdn"
            } else {
                $serviceUrls.Chatbot = "https://$chatbotAppName.azurewebsites.net"
            }
        }
        
        if ($rlServiceAppName) {
            $rlFqdn = az containerapp show --name $rlServiceAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($rlFqdn) -and -not $rlFqdn.StartsWith("az:")) {
                $serviceUrls.RLService = "https://$rlFqdn"
            } else {
                $serviceUrls.RLService = "https://$rlServiceAppName.azurewebsites.net"
            }
        }
    }
    else {
        Write-ColorOutput "Service URLs resolved:" $Green
        if ($serviceUrls.Backend) {
            Write-ColorOutput "  Backend: $($serviceUrls.Backend)" $White
        }
        if ($serviceUrls.Chatbot) {
            Write-ColorOutput "  Chatbot: $($serviceUrls.Chatbot)" $White
        }
        if ($serviceUrls.RLService) {
            Write-ColorOutput "  RL Service: $($serviceUrls.RLService)" $White
        }
    }
    
    # Step 3: Upload models
    Invoke-UploadModels
    
    # Step 4: Update frontend config
    if (-not (Invoke-UpdateFrontendConfig -ServiceUrls $serviceUrls)) {
        Write-ColorOutput "WARNING: Frontend configuration warning" $Yellow
    }
    
    # Step 5: Health checks
    Invoke-HealthChecks -ServiceUrls $serviceUrls
    
    # Step 6: Build APK
    if (-not (Invoke-BuildAPK)) {
        Write-ColorOutput "WARNING: APK build failed" $Yellow
    }
    
    # Summary
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Host ""
    Write-SectionHeader "Deployment Summary"
    Write-ColorOutput "Total time: $($duration.ToString('hh\:mm\:ss'))" $White
    Write-ColorOutput "" $White
    Write-ColorOutput "Services deployed:" $White
    
    # Use resolved URLs in summary, with fallback to defaults (prefer Container Apps)
    $backendUrl = $serviceUrls.Backend
    if (-not $backendUrl) {
        $backendAppName = $deploymentConfig.BackendAppName
        if (-not $backendAppName) { $backendAppName = $deploymentConfig.backend_app_name }
        if ($backendAppName) {
            $backendFqdn = az containerapp show --name $backendAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($backendFqdn) -and -not $backendFqdn.StartsWith("az:")) {
                $backendUrl = "https://$backendFqdn"
            } else {
                $backendUrl = "https://$backendAppName.azurewebsites.net"
            }
        }
    }
    $chatbotUrl = $serviceUrls.Chatbot
    if (-not $chatbotUrl) {
        $chatbotAppName = $deploymentConfig.ChatbotAppName
        if (-not $chatbotAppName) { $chatbotAppName = $deploymentConfig.chatbot_app_name }
        if ($chatbotAppName) {
            $chatbotFqdn = az containerapp show --name $chatbotAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($chatbotFqdn) -and -not $chatbotFqdn.StartsWith("az:")) {
                $chatbotUrl = "https://$chatbotFqdn"
            } else {
                $chatbotUrl = "https://$chatbotAppName.azurewebsites.net"
            }
        }
    }
    $rlServiceUrl = $serviceUrls.RLService
    if (-not $rlServiceUrl) {
        $rlServiceAppName = $deploymentConfig.RLServiceAppName
        if (-not $rlServiceAppName) { $rlServiceAppName = $deploymentConfig.rl_service_app_name }
        if ($rlServiceAppName) {
            $rlFqdn = az containerapp show --name $rlServiceAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($rlFqdn) -and -not $rlFqdn.StartsWith("az:")) {
                $rlServiceUrl = "https://$rlFqdn"
            } else {
                $rlServiceUrl = "https://$rlServiceAppName.azurewebsites.net"
            }
        }
    }
    
    Write-ColorOutput "  - Backend: $backendUrl" $White
    Write-ColorOutput "  - Chatbot: $chatbotUrl" $White
    Write-ColorOutput "  - RL Service: $rlServiceUrl" $White
    Write-Host ""
    Write-ColorOutput "Quick deployment complete!" $Green
}

# Run main
try {
    Main
}
catch {
    Write-ColorOutput "❌ Fatal error: $_" $Red
    exit 1
}

