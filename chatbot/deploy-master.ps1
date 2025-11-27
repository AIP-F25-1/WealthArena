# ============================================================================
# WealthArena Master Deployment Script
# ============================================================================
# This script handles all deployment scenarios:
#   - Data Pipeline: PDF ingestion and vector store setup
#   - Docker Deployment: Build and run containerized application
#   - Azure Deployment: Deploy to Azure App Service
#
# Usage:
#   # Data Pipeline (default)
#   .\deploy-master.ps1
#   .\deploy-master.ps1 --skip-pdf-ingest
#   .\deploy-master.ps1 --full-refresh
#
#   # Docker Deployment
#   .\deploy-master.ps1 --deploy docker
#   .\deploy-master.ps1 --deploy docker -Build
#   .\deploy-master.ps1 --deploy docker -Run
#   .\deploy-master.ps1 --deploy docker -Stop
#   .\deploy-master.ps1 --deploy docker -Logs
#
#   # Azure Deployment
#   .\deploy-master.ps1 --deploy azure -ResourceGroup "rg-wealtharena" -AppName "wealtharena-api"
#   .\deploy-master.ps1 --deploy azure -ResourceGroup "rg-wealtharena" -AppName "wealtharena-api" -Location "eastus" -Sku "B1"
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Deploy = "pipeline",
    
    # Pipeline options
    [Parameter(Mandatory=$false)]
    [switch]$SkipPdfIngest,
    
    [Parameter(Mandatory=$false)]
    [switch]$FullRefresh,
    
    [Parameter(Mandatory=$false)]
    [string]$PdfTimeout = "150",
    
    # Docker options
    [Parameter(Mandatory=$false)]
    [string]$Tag = "latest",
    
    [Parameter(Mandatory=$false)]
    [switch]$Build,
    
    [Parameter(Mandatory=$false)]
    [switch]$Run,
    
    [Parameter(Mandatory=$false)]
    [switch]$Stop,
    
    [Parameter(Mandatory=$false)]
    [switch]$Logs,
    
    # Azure options
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup,
    
    [Parameter(Mandatory=$false)]
    [string]$AppName,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "eastus",
    
    [Parameter(Mandatory=$false)]
    [string]$Sku = "B1",
    
    [Parameter(Mandatory=$false)]
    [string]$PythonVersion = "3.12",  # Azure App Service default; local environments should match
    
    [Parameter(Mandatory=$false)]
    [switch]$EnableBackgroundScheduler,
    
    [Parameter(Mandatory=$false)]
    [switch]$ForceCleanup,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipVerification,
    
    [Parameter(Mandatory=$false)]
    [int]$VerificationTimeoutMinutes = 10,
    
    [Parameter(Mandatory=$false)]
    [switch]$AutoFixOnFailure
)

$ErrorActionPreference = "Stop"

# Handle --deploy syntax (PowerShell doesn't support -- prefix natively)
# Check unbound arguments and command line for --deploy
$unboundArgs = $MyInvocation.UnboundArguments
if ($unboundArgs) {
    for ($i = 0; $i -lt $unboundArgs.Count; $i++) {
        if ($unboundArgs[$i] -eq "--deploy" -and $i + 1 -lt $unboundArgs.Count) {
            $Deploy = $unboundArgs[$i + 1]
            break
        }
    }
}

# Also check $args for --deploy (fallback)
if ($args.Count -gt 0) {
    for ($i = 0; $i -lt $args.Count; $i++) {
        if ($args[$i] -eq "--deploy" -and $i + 1 -lt $args.Count) {
            $Deploy = $args[$i + 1]
            break
        }
    }
}

# Check if PdfTimeout was accidentally set to a deploy value (parameter binding error recovery)
$validDeployValues = @("pipeline", "docker", "azure")
if ($PdfTimeout -in $validDeployValues) {
    # PdfTimeout was bound to a deploy value, swap them
    $Deploy = $PdfTimeout
    $PdfTimeout = "150"
}

# Convert PdfTimeout to int (now that we've handled any binding issues)
try {
    $PdfTimeout = [int]$PdfTimeout
} catch {
    Write-Warning "Invalid PdfTimeout value: $PdfTimeout. Using default: 150"
    $PdfTimeout = 150
}

# Validate Deploy parameter value
if ($Deploy -notin $validDeployValues) {
    Write-Error "Invalid Deploy value: $Deploy. Must be one of: $($validDeployValues -join ', ')"
    Write-Info "Usage: .\deploy-master.ps1 -Deploy docker"
    Write-Info "   or: .\deploy-master.ps1 --deploy docker"
    exit 1
}

# Configuration
$DATA_DIR = "data"
$OUTPUT_DIR = $DATA_DIR
$PIPELINE_SCRIPT = "scripts/run_pipeline.py"

# Helper functions
function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "[STEP] $Message" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

function Invoke-AzSafe {
    <#
    .SYNOPSIS
    Safely invokes Azure CLI commands with proper error handling and exit code checking.
    
    .DESCRIPTION
    Wraps Azure CLI invocations with try/finally to ensure error preference is reset,
    checks exit codes, and uses --only-show-errors flag to suppress warnings.
    
    .PARAMETER ArgsArray
    Array of arguments to pass to az command.
    
    .PARAMETER OperationName
    Human-readable name of the operation for error messages.
    
    .PARAMETER Context
    Optional context information (e.g., resource group, app name) for error messages.
    
    .PARAMETER ShowErrors
    If true, displays actual error output from Azure CLI for debugging.
    
    .OUTPUTS
    Boolean. Returns $true if operation succeeded, $false otherwise.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [array]$ArgsArray,
        
        [Parameter(Mandatory=$true)]
        [string]$OperationName,
        
        [Parameter(Mandatory=$false)]
        [string]$Context = "",
        
        [Parameter(Mandatory=$false)]
        [switch]$ShowErrors
    )
    
    $originalPreference = $ErrorActionPreference
    $output = $null
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        # Build command string to pass to cmd.exe to avoid PowerShell pipe parsing issues
        $cmdArgs = $ArgsArray | ForEach-Object { 
            if ($_ -match '\|' -or ($_ -match '\s' -and $_ -notmatch '^--')) {
                # Quote arguments containing pipe characters or spaces (but not flags like --startup-file)
                "`"$_`""
            } else {
                $_
            }
        }
        $cmdLine = "az " + ($cmdArgs -join " ")
        if ($ShowErrors) {
            $output = cmd /c $cmdLine 2>&1
        } else {
            $null = cmd /c $cmdLine 2>&1
        }
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    if ($exitCode -ne 0) {
        $errorMsg = "Failed to $OperationName"
        if ($Context) {
            $errorMsg += " ($Context)"
        }
        Write-Error $errorMsg
        if ($ShowErrors -and $output) {
            Write-Error "Azure CLI output: $output"
        }
        return $false
    }
    
    return $true
}

function Remove-AzureWebApp {
    <#
    .SYNOPSIS
    Safely removes an Azure Web App.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName,
        
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroup
    )
    
    Write-Info "Deleting web app: $AppName from resource group: $ResourceGroup"
    
    # First verify the app exists in this resource group
    $originalPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $null = & az webapp show --name $AppName --resource-group $ResourceGroup --only-show-errors 2>&1 | Out-Null
        $appExists = ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    if (-not $appExists) {
        Write-Info "Web app '$AppName' not found in resource group '$ResourceGroup' (may already be deleted)"
        return $true
    }
    
    $deleteArgs = @("webapp", "delete", "--name", $AppName, "--resource-group", $ResourceGroup, "--yes", "--only-show-errors")
    if (Invoke-AzSafe -ArgsArray $deleteArgs -OperationName "delete web app" -Context "App: $AppName, ResourceGroup: $ResourceGroup" -ShowErrors) {
        # Verify deletion succeeded
        Write-Info "Verifying deletion..."
        Start-Sleep -Seconds 3
        $originalPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'SilentlyContinue'
            $null = & az webapp show --name $AppName --resource-group $ResourceGroup --only-show-errors 2>&1 | Out-Null
            $stillExists = ($LASTEXITCODE -eq 0)
        } finally {
            $ErrorActionPreference = $originalPreference
        }
        
        if (-not $stillExists) {
            Write-Success "Web app deleted: $AppName"
            return $true
        } else {
            Write-Warning "Deletion command succeeded but app still exists. Waiting longer..."
            Start-Sleep -Seconds 10
            # Check again
            try {
                $ErrorActionPreference = 'SilentlyContinue'
                $null = & az webapp show --name $AppName --resource-group $ResourceGroup --only-show-errors 2>&1 | Out-Null
                $stillExists = ($LASTEXITCODE -eq 0)
            } finally {
                $ErrorActionPreference = $originalPreference
            }
            if (-not $stillExists) {
                Write-Success "Web app deleted: $AppName"
                return $true
            } else {
                Write-Warning "App still exists after deletion attempt. It may be in a deleting state."
                return $false
            }
        }
    }
    return $false
}

function Remove-AzureAppServicePlan {
    <#
    .SYNOPSIS
    Safely removes an Azure App Service Plan.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$PlanName,
        
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroup
    )
    
    Write-Info "Deleting App Service plan: $PlanName"
    $deleteArgs = @("appservice", "plan", "delete", "--name", $PlanName, "--resource-group", $ResourceGroup, "--yes", "--only-show-errors")
    if (Invoke-AzSafe -ArgsArray $deleteArgs -OperationName "delete App Service plan" -Context "Plan: $PlanName") {
        Write-Success "App Service plan deleted: $PlanName"
        return $true
    }
    return $false
}

function Get-AzureResourceDiagnostics {
    <#
    .SYNOPSIS
    Diagnoses Azure resources and returns information about what exists.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName,
        
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroup,
        
        [Parameter(Mandatory=$true)]
        [string]$PlanName
    )
    
    $diagnostics = @{
        ResourceGroupExists = $false
        PlanExists = $false
        AppExists = $false
        AppNameAvailable = $true
        PlanDetails = $null
        AppDetails = $null
    }
    
    # Check resource group
    $originalPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $rgCheck = & az group exists --name $ResourceGroup --only-show-errors 2>&1
        $diagnostics.ResourceGroupExists = ($rgCheck -eq "true")
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    # Check plan
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $planOutput = & az appservice plan show --name $PlanName --resource-group $ResourceGroup --only-show-errors 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($LASTEXITCODE -eq 0 -and $planOutput) {
            $diagnostics.PlanExists = $true
            $diagnostics.PlanDetails = $planOutput
        }
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    # Check app (try in current resource group)
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $appOutput = & az webapp show --name $AppName --resource-group $ResourceGroup --only-show-errors 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($LASTEXITCODE -eq 0 -and $appOutput) {
            $diagnostics.AppExists = $true
            $diagnostics.AppDetails = $appOutput
        }
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    # Check if app name is available globally (try to find it in any resource group)
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $allApps = & az webapp list --query "[?name=='$AppName']" --only-show-errors 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($allApps -and $allApps.Count -gt 0) {
            $diagnostics.AppNameAvailable = $false
            $diagnostics.ConflictingApp = $allApps[0]
        }
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    return $diagnostics
}

# ============================================================================
# DOCKER DEPLOYMENT
# ============================================================================
function Deploy-Docker {
    Write-Step "Docker Deployment"
    
    # Check Docker
    Write-Info "Checking Docker..."
    try {
        $dockerVersion = docker --version 2>&1
        Write-Success "Docker found: $dockerVersion"
    } catch {
        Write-Error "Docker not found. Please install Docker Desktop."
        exit 1
    }
    
    # Check .env file
    if (-not (Test-Path ".env")) {
        Write-Error ".env file not found. Please create one from .env.example"
        exit 1
    }
    Write-Success ".env file found"
    
    $imageName = "wealtharena-api:$Tag"
    
    # Build
    if ($Build -or (-not ($Run -or $Stop -or $Logs))) {
        Write-Step "Building Docker Image"
        Write-Info "Building $imageName..."
        docker build -t $imageName .
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Image built successfully"
        } else {
            Write-Error "Build failed"
            exit 1
        }
    }
    
    # Run
    if ($Run -or (-not ($Build -or $Stop -or $Logs))) {
        Write-Step "Starting Container"
        
        # Stop existing container if running
        $existing = docker ps -a --filter "name=wealtharena-api" --format "{{.Names}}"
        if ($existing -eq "wealtharena-api") {
            Write-Info "Stopping existing container..."
            docker stop wealtharena-api 2>&1 | Out-Null
            docker rm wealtharena-api 2>&1 | Out-Null
        }
        
        Write-Info "Starting container..."
        $dockerEnvVars = @(
            "--env-file", ".env",
            "-e", "CHROMA_PERSIST_DIR=/app/data/vectorstore"
        )
        
        # Set ENABLE_BACKGROUND_SCHEDULER if flag is provided
        if ($EnableBackgroundScheduler) {
            $dockerEnvVars += "-e", "ENABLE_BACKGROUND_SCHEDULER=true"
            Write-Info "Background scheduler will be enabled"
        }
        
        docker run -d `
            --name wealtharena-api `
            -p 8000:8000 `
            $dockerEnvVars `
            -v "${PWD}/data:/app/data" `
            --restart unless-stopped `
            $imageName
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Container started"
            Write-Info "Waiting for health check (10 seconds)..."
            Start-Sleep -Seconds 10
            
            try {
                $health = Invoke-RestMethod -Uri "http://localhost:8000/healthz" -TimeoutSec 5
                Write-Success "Health check passed: $($health | ConvertTo-Json)"
            } catch {
                Write-Info "Health check pending. View logs: docker logs wealtharena-api"
            }
            
            Write-Host "`nContainer is running!" -ForegroundColor Green
            Write-Host "  API: http://localhost:8000" -ForegroundColor Cyan
            Write-Host "  Docs: http://localhost:8000/docs" -ForegroundColor Cyan
            Write-Host "  Health: http://localhost:8000/healthz" -ForegroundColor Cyan
            Write-Host "`nView logs: docker logs -f wealtharena-api" -ForegroundColor Yellow
        } else {
            Write-Error "Failed to start container"
            exit 1
        }
    }
    
    # Stop
    if ($Stop) {
        Write-Step "Stopping Container"
        docker stop wealtharena-api 2>&1 | Out-Null
        docker rm wealtharena-api 2>&1 | Out-Null
        Write-Success "Container stopped and removed"
    }
    
    # Logs
    if ($Logs) {
        docker logs -f wealtharena-api
    }
}

# ============================================================================
# AZURE DEPLOYMENT
# ============================================================================
function Deploy-Azure {
    Write-Step "Azure App Service Deployment"
    
    if (-not $ResourceGroup -or -not $AppName) {
        Write-Error "Azure deployment requires -ResourceGroup and -AppName parameters"
        Write-Info "Example: .\deploy-master.ps1 --deploy azure -ResourceGroup rg-wealtharena -AppName wealtharena-api"
        exit 1
    }
    
    # Check Azure CLI
    Write-Info "Checking Azure CLI..."
    try {
        $azVersion = az --version 2>&1 | Select-Object -First 1
        Write-Success "Azure CLI found: $azVersion"
    } catch {
        Write-Error "Azure CLI not found. Please install from https://aka.ms/installazurecliwindows"
        exit 1
    }
    
    # Check if logged in
    Write-Info "Checking Azure login status..."
    $accountShowArgs = @("account", "show")
    if (-not (Invoke-AzSafe -ArgsArray $accountShowArgs -OperationName "check Azure login status")) {
        Write-Error "Not logged in to Azure. Please run: az login"
        exit 1
    }
    Write-Success "Logged in to Azure"
    
    # Run diagnostics
    Write-Step "Azure Resource Diagnostics"
    # Try to find existing plan - check both naming conventions
    $planName = "$AppName-plan"
    $alternatePlanName = "wealtharena-plan"  # Common alternative name
    
    # Check if alternate plan exists first (in case user has existing plan with different name)
    $originalPreference = $ErrorActionPreference
    $alternatePlanExists = $false
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $null = & az appservice plan show --name $alternatePlanName --resource-group $ResourceGroup --only-show-errors 2>&1 | Out-Null
        $alternatePlanExists = ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    if ($alternatePlanExists) {
        Write-Info "Found existing App Service plan: $alternatePlanName (using this instead of $planName)"
        $planName = $alternatePlanName
    }
    
    $diagnostics = Get-AzureResourceDiagnostics -AppName $AppName -ResourceGroup $ResourceGroup -PlanName $planName
    
    Write-Info "Resource Group '$ResourceGroup': $(if ($diagnostics.ResourceGroupExists) { 'EXISTS' } else { 'NOT FOUND' })"
    Write-Info "App Service Plan '$planName': $(if ($diagnostics.PlanExists) { 'EXISTS' } else { 'NOT FOUND' })"
    Write-Info "Web App '$AppName': $(if ($diagnostics.AppExists) { 'EXISTS' } else { 'NOT FOUND' })"
    
    if (-not $diagnostics.AppNameAvailable) {
        $conflictApp = $diagnostics.ConflictingApp
        # Check if the conflicting app is in the same resource group (it's the same app, continue deployment)
        if ($conflictApp.resourceGroup -eq $ResourceGroup) {
            Write-Info "App '$AppName' already exists in resource group '$ResourceGroup' - continuing with configuration and deployment"
        } elseif ($ForceCleanup) {
            Write-Info "ForceCleanup flag set - will delete conflicting resources..."
            Write-Info "Attempting to delete from: $($conflictApp.resourceGroup)"
            Remove-AzureWebApp -AppName $AppName -ResourceGroup $conflictApp.resourceGroup
            Start-Sleep -Seconds 5  # Wait for deletion to propagate
        } else {
            Write-Error "App name conflict detected in different resource group. Use -ForceCleanup to automatically delete conflicting resources."
            Write-Info "Or manually delete with: az webapp delete --name $AppName --resource-group $($conflictApp.resourceGroup) --yes"
            exit 1
        }
    }
    
    # Trim and validate Python version
    Write-Info "Validating Python version..."
    $PythonVersion = $PythonVersion.Trim()
    # Use single quotes to prevent PowerShell from parsing the pipe character
    $runtimeString = 'PYTHON|' + $PythonVersion
    
    # Optionally validate runtime exists
    Write-Info "Checking available Python runtimes..."
    $listRuntimesArgs = @("webapp", "list-runtimes", "--os", "linux", "--only-show-errors")
    $originalPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $availableRuntimesOutput = & az @listRuntimesArgs 2>&1
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    # Check if runtime exists in the output (handle both JSON and text formats)
    $runtimeFound = $false
    if ($availableRuntimesOutput) {
        # Convert output to string if it's an array
        $runtimeOutputString = if ($availableRuntimesOutput -is [array]) {
            $availableRuntimesOutput -join "`n"
        } else {
            [string]$availableRuntimesOutput
        }
        
        # Check if runtime string exists in output (case-insensitive)
        if ($runtimeOutputString -match [regex]::Escape($runtimeString)) {
            $runtimeFound = $true
        }
    }
    
    if (-not $runtimeFound) {
        Write-Warning "Python runtime '$runtimeString' not found in available runtimes. Continuing anyway - Azure may accept it."
        Write-Info "Available Python runtimes can be checked with: az webapp list-runtimes --os linux"
        Write-Info "If deployment fails, try a different Python version (e.g., 3.11, 3.10)"
    } else {
        Write-Success "Python version validated: $PythonVersion"
    }
    
    # Check .env file
    Write-Info "Checking .env file..."
    if (-not (Test-Path ".env")) {
        Write-Error ".env file not found. Please create one from .env.example"
        exit 1
    }
    Write-Success ".env file found"
    
    # Create Resource Group
    Write-Step "Ensuring Resource Group Exists"
    $rgArgs = @("group", "exists", "--name", $ResourceGroup, "--only-show-errors")
    $originalPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $rgExists = & az @rgArgs 2>&1
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    if ($rgExists -eq "false") {
        Write-Info "Creating resource group: $ResourceGroup"
        $rgCreateArgs = @("group", "create", "--name", $ResourceGroup, "--location", $Location, "--only-show-errors")
        $context = "ResourceGroup: $ResourceGroup, Location: $Location"
        if (-not (Invoke-AzSafe -ArgsArray $rgCreateArgs -OperationName "create resource group" -Context $context)) {
            exit 1
        }
        Write-Success "Resource group created"
    } else {
        Write-Success "Resource group already exists"
    }
    
    # Create App Service Plan
    Write-Step "Ensuring App Service Plan Exists"
    # $planName already set above
    $planShowArgs = @("appservice", "plan", "show", "--name", $planName, "--resource-group", $ResourceGroup, "--only-show-errors")
    $originalPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $null = & az @planShowArgs 2>&1 | Out-Null
        $planExists = ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    if (-not $planExists) {
        Write-Info "Creating App Service plan: $planName"
        $planCreateArgs = @("appservice", "plan", "create", "--name", $planName, "--resource-group", $ResourceGroup, "--location", $Location, "--sku", $Sku, "--is-linux", "--only-show-errors")
        $context = "Plan: $planName, ResourceGroup: $ResourceGroup, Location: $Location, SKU: $Sku"
        if (-not (Invoke-AzSafe -ArgsArray $planCreateArgs -OperationName "create App Service plan" -Context $context)) {
            exit 1
        }
        Write-Success "App Service plan created"
    } else {
        Write-Success "App Service plan already exists"
    }
    
    # Create Web App
    Write-Step "Ensuring Web App Exists"
    $appShowArgs = @("webapp", "show", "--name", $AppName, "--resource-group", $ResourceGroup, "--only-show-errors")
    $originalPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $null = & az @appShowArgs 2>&1 | Out-Null
        $appExists = ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    if (-not $appExists) {
        Write-Info "Creating Web App: $AppName"
        
        # Verify plan exists before creating web app
        $originalPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'SilentlyContinue'
            $null = & az appservice plan show --name $planName --resource-group $ResourceGroup --only-show-errors 2>&1 | Out-Null
            $planCheckCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $originalPreference
        }
        
        if ($planCheckCode -ne 0) {
            Write-Error "App Service plan '$planName' not found in resource group '$ResourceGroup'. Please create the plan first."
            exit 1
        }
        
        # Create web app with explicit parameters
        # Note: Runtime is set during creation, but we'll also set it via config later for consistency
        $appCreateArgs = @("webapp", "create", "--name", $AppName, "--resource-group", $ResourceGroup, "--plan", $planName, "--runtime", $runtimeString, "--only-show-errors")
        $context = "App: $AppName, ResourceGroup: $ResourceGroup, Plan: $planName, Runtime: $runtimeString"
        
        # Use ShowErrors to capture actual Azure CLI error messages
        $appCreated = $false
        if (-not (Invoke-AzSafe -ArgsArray $appCreateArgs -OperationName "create web app" -Context $context -ShowErrors)) {
            Write-Warning "Web app creation failed. Attempting automatic recovery..."
            
            # Try to find and delete conflicting app in any resource group
            Write-Info "Searching for conflicting web apps..."
            $originalPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'SilentlyContinue'
                $conflictingApps = & az webapp list --query "[?name=='$AppName']" --only-show-errors 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
            } finally {
                $ErrorActionPreference = $originalPreference
            }
            
            if ($conflictingApps -and $conflictingApps.Count -gt 0) {
                foreach ($conflictApp in $conflictingApps) {
                    Write-Info "Found conflicting app in resource group: $($conflictApp.resourceGroup)"
                    if ($ForceCleanup) {
                        Write-Info "ForceCleanup enabled - deleting conflicting app..."
                        $deleteSuccess = Remove-AzureWebApp -AppName $AppName -ResourceGroup $conflictApp.resourceGroup
                        
                        if ($deleteSuccess) {
                            Write-Info "Waiting for deletion to propagate (15 seconds)..."
                            Start-Sleep -Seconds 15
                            
                            # Verify app is gone before retrying
                            $originalPreference = $ErrorActionPreference
                            $appStillExists = $false
                            try {
                                $ErrorActionPreference = 'SilentlyContinue'
                                $null = & az webapp show --name $AppName --resource-group $conflictApp.resourceGroup --only-show-errors 2>&1 | Out-Null
                                $appStillExists = ($LASTEXITCODE -eq 0)
                            } finally {
                                $ErrorActionPreference = $originalPreference
                            }
                            
                            if ($appStillExists) {
                                Write-Warning "App still exists after deletion. Waiting additional 20 seconds..."
                                Start-Sleep -Seconds 20
                            }
                            
                            # Retry creation
                            Write-Info "Retrying web app creation..."
                            if (Invoke-AzSafe -ArgsArray $appCreateArgs -OperationName "create web app (retry)" -Context $context -ShowErrors) {
                                Write-Success "Web App created successfully after cleanup"
                                $appCreated = $true
                                break
                            } else {
                                Write-Warning "Retry failed. App name may still be reserved. Waiting 30 seconds and retrying once more..."
                                Start-Sleep -Seconds 30
                                if (Invoke-AzSafe -ArgsArray $appCreateArgs -OperationName "create web app (final retry)" -Context $context -ShowErrors) {
                                    Write-Success "Web App created successfully after extended wait"
                                    $appCreated = $true
                                    break
                                }
                            }
                        } else {
                            Write-Warning "Failed to delete conflicting app. You may need to delete it manually."
                            Write-Info "Try: az webapp delete --name $AppName --resource-group $($conflictApp.resourceGroup) --yes"
                        }
                    } else {
                        Write-Error "Conflicting app found. Use -ForceCleanup to automatically delete and retry."
                        Write-Info "Or manually delete with: az webapp delete --name $AppName --resource-group $($conflictApp.resourceGroup) --yes"
                    }
                }
                if (-not $appCreated) {
                    Write-Error "Failed to create web app after cleanup attempts."
                    Write-Info "The app name may still be reserved. Try:"
                    Write-Info "  1. Wait a few minutes and retry"
                    Write-Info "  2. Use a different app name"
                    Write-Info "  3. Manually delete: az webapp delete --name $AppName --resource-group <resource-group> --yes"
                    exit 1
                }
            } else {
                Write-Error "Web app creation failed. Common issues:"
                Write-Error "  - App name may already be taken (must be globally unique)"
                Write-Error "  - App name must be 2-60 characters, alphanumeric and hyphens only"
                Write-Error "  - Verify the App Service plan exists and is Linux-based"
                Write-Error "  - Check Azure CLI is up to date: az upgrade"
                Write-Info "Try running with -ForceCleanup to automatically resolve conflicts"
                exit 1
            }
        } else {
            $appCreated = $true
            Write-Success "Web App created"
        }
    } else {
        Write-Success "Web App already exists"
    }
    
    # Configure App Settings
    Write-Step "Configuring App Settings"
    
    # Critical: Remove WEBSITE_RUN_FROM_PACKAGE
    Write-Info "Removing WEBSITE_RUN_FROM_PACKAGE setting..."
    $appSettingsDeleteArgs = @("webapp", "config", "appsettings", "delete", "--name", $AppName, "--resource-group", $ResourceGroup, "--setting-names", "WEBSITE_RUN_FROM_PACKAGE", "--only-show-errors")
    $context = "App: $AppName, ResourceGroup: $ResourceGroup"
    if (-not (Invoke-AzSafe -ArgsArray $appSettingsDeleteArgs -OperationName "delete WEBSITE_RUN_FROM_PACKAGE setting" -Context $context)) {
        exit 1
    }
    
    # Enable Oryx build
    Write-Info "Enabling Oryx build..."
    $appSettingsSetArgs = @("webapp", "config", "appsettings", "set", "--name", $AppName, "--resource-group", $ResourceGroup, "--settings", "SCM_DO_BUILD_DURING_DEPLOYMENT=true", "--only-show-errors")
    if (-not (Invoke-AzSafe -ArgsArray $appSettingsSetArgs -OperationName "enable Oryx build" -Context $context)) {
        exit 1
    }
    
    # Add Azure build optimization settings for heavy dependencies
    Write-Info "Configuring Azure build optimization settings..."
    $buildOptimizationSettings = @(
        "SCM_BUILD_TIMEOUT=1800",
        "ENABLE_ORYX_BUILD=true",
        "ORYX_DISABLE_TELEMETRY=true"
    )
    $buildOptimizationArgs = @("webapp", "config", "appsettings", "set", "--name", $AppName, "--resource-group", $ResourceGroup, "--settings")
    $buildOptimizationArgs += $buildOptimizationSettings
    $buildOptimizationArgs += "--only-show-errors"
    if (-not (Invoke-AzSafe -ArgsArray $buildOptimizationArgs -OperationName "configure build optimization settings" -Context $context)) {
        exit 1
    }
    Write-Success "Build optimization settings configured"
    
    # Set Python version
    Write-Info "Setting Python version..."
    $configSetRuntimeArgs = @("webapp", "config", "set", "--name", $AppName, "--resource-group", $ResourceGroup, "--linux-fx-version=$runtimeString", "--only-show-errors")
    $runtimeContext = "$context, PythonVersion: $PythonVersion"
    if (-not (Invoke-AzSafe -ArgsArray $configSetRuntimeArgs -OperationName "set Python runtime" -Context $runtimeContext -ShowErrors)) {
        Write-Warning "Failed to set Python runtime. The app may already be configured with a different version."
        Write-Info "Current runtime will be used. Continuing with deployment..."
        # Don't exit - continue deployment as the app may already have a working runtime
    } else {
        Write-Success "Python runtime set to $runtimeString"
    }
    
    # Set startup command
    Write-Info "Setting startup command..."
    
    # Verify that startup.sh exists in the repository (single source of truth)
    $startupScript = "startup.sh"
    if (-not (Test-Path $startupScript)) {
        Write-Error "startup.sh not found in repository root!"
        Write-Error "The startup.sh file must exist in the repository and be under version control."
        Write-Error "This file is the canonical startup script for Azure App Service."
        Write-Info ""
        Write-Info "To fix this:"
        Write-Info "  1. Restore startup.sh from version control (git checkout startup.sh)"
        Write-Info "  2. Or ensure startup.sh exists in the project root directory"
        Write-Info ""
        Write-Info "The startup.sh file should contain the gunicorn/uvicorn startup logic."
        exit 1
    }
    
    Write-Success "Found startup.sh in repository - will use as canonical startup script"
    Write-Info "startup.sh is the single source of truth for Azure App Service startup"
    
    # Use startup script (Azure will make it executable automatically)
    $startupCmd = $startupScript
    $configSetStartupArgs = @("webapp", "config", "set", "--name", $AppName, "--resource-group", $ResourceGroup, "--startup-file", $startupCmd, "--only-show-errors")
    if (-not (Invoke-AzSafe -ArgsArray $configSetStartupArgs -OperationName "set startup command" -Context $context -ShowErrors)) {
        Write-Warning "Failed to set startup command. Trying fallback with uvicorn..."
        # Fallback to uvicorn if gunicorn fails
        $startupCmdFallback = 'python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT'
        $configSetStartupArgsFallback = @("webapp", "config", "set", "--name", $AppName, "--resource-group", $ResourceGroup, "--startup-file", $startupCmdFallback, "--only-show-errors")
        if (-not (Invoke-AzSafe -ArgsArray $configSetStartupArgsFallback -OperationName "set startup command (fallback)" -Context $context -ShowErrors)) {
            Write-Warning "Failed to set startup command. Continuing anyway - Azure may use default startup."
            Write-Info "You can manually set it with: az webapp config set --name $AppName --resource-group $ResourceGroup --startup-file '$startupCmd'"
            # Don't exit - continue deployment as Azure may have a default startup command
        } else {
            Write-Success "Startup command configured (uvicorn fallback)"
        }
    } else {
        Write-Success "Startup command configured (gunicorn)"
    }
    
    # Load environment variables from .env
    Write-Info "Loading environment variables from .env..."
    $envVars = @{}
    $groqApiKeyFound = $false
    
    Get-Content ".env" -Raw | ForEach-Object {
        # Split by newlines and process each line
        $lines = $_ -split "`r?`n"
        foreach ($line in $lines) {
            # Remove inline comments (everything after # that's not in quotes)
            $line = $line -replace '#.*$', ''
            $line = $line.Trim()
            
            # Skip empty lines
            if ([string]::IsNullOrWhiteSpace($line)) {
                continue
            }
            
            # Match key=value pattern (handles quoted and unquoted values)
            if ($line -match '^([^#=]+?)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                
                # Remove surrounding quotes if present
                if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                    $value = $matches[1]
                }
                
                if ($key -and $value) {
                    # Track if GROQ_API_KEY is found and apply defensive trimming
                    if ($key -eq "GROQ_API_KEY") {
                        $groqApiKeyFound = $true
                        # Trim again defensively to remove any leading/trailing whitespace
                        $value = $value.Trim()
                        # Validate format
                        if (-not $value.StartsWith("gsk_")) {
                            Write-Warning "GROQ_API_KEY format may be invalid (should start with 'gsk_')"
                        }
                    }
                    
                    # Skip CHROMA_PERSIST_DIR to avoid propagating Windows paths to Azure
                    if ($key -ne "CHROMA_PERSIST_DIR") {
                        $envVars[$key] = $value
                    }
                }
            }
        }
    }
    
    # Validate GROQ_API_KEY is present
    if (-not $groqApiKeyFound -or -not $envVars.ContainsKey("GROQ_API_KEY")) {
        Write-Error "GROQ_API_KEY not found in .env file!"
        Write-Error "The application requires GROQ_API_KEY to function. Please add it to your .env file."
        Write-Info "Example: GROQ_API_KEY=gsk_your_actual_key_here"
        exit 1
    }
    
    # Trim and validate GROQ_API_KEY is not empty or whitespace-only
    $trimmedGroqKey = $envVars["GROQ_API_KEY"].Trim()
    if ([string]::IsNullOrWhiteSpace($trimmedGroqKey)) {
        Write-Error "GROQ_API_KEY is empty or contains only whitespace in .env file!"
        Write-Error "Please set a valid Groq API key (non-empty, no leading/trailing spaces)."
        Write-Info "Example: GROQ_API_KEY=gsk_your_actual_key_here"
        exit 1
    }
    
    # Store the trimmed value back
    $envVars["GROQ_API_KEY"] = $trimmedGroqKey
    
    Write-Success "Found GROQ_API_KEY in .env file"
    Write-Info "Loaded $($envVars.Count) environment variables from .env"
    
    # Set container-appropriate path for CHROMA_PERSIST_DIR in Azure
    # Use /home/data/vectorstore to match Azure Files mount path (if configured)
    # This path is consistent with the Azure Files mount path documented in DEPLOYMENT.md
    $envVars["CHROMA_PERSIST_DIR"] = "/home/data/vectorstore"
    
    # Ensure PORT is set (Azure App Service sets it automatically, but we set it explicitly for clarity)
    # Azure App Service on Linux uses PORT environment variable, which is automatically set
    # The startup command uses $PORT which Azure expands at runtime
    if (-not $envVars.ContainsKey("PORT")) {
        $envVars["PORT"] = "8000"
        Write-Info "Setting PORT=8000 (Azure will override this with its own PORT if needed)"
    }
    
    # Set PYTHONPATH to ensure app module can be found
    # Azure extracts ZIP to /home/site/wwwroot, so we need PYTHONPATH to include that
    $envVars["PYTHONPATH"] = "/home/site/wwwroot"
    Write-Info "Setting PYTHONPATH=/home/site/wwwroot to ensure app module can be found"
    
    # Set ENABLE_BACKGROUND_SCHEDULER if flag is provided
    if ($EnableBackgroundScheduler) {
        $envVars["ENABLE_BACKGROUND_SCHEDULER"] = "true"
        Write-Info "Background scheduler will be enabled in Azure deployment"
    }
    
    # Convert to Azure format (properly escape values)
    $settings = @()
    foreach ($key in $envVars.Keys) {
        $value = $envVars[$key]
        # Azure app settings handle most characters, but we'll escape quotes
        $value = $value -replace '"', '\"'
        $settings += "$key=$value"
    }
    
    Write-Info "Environment variables to set:"
    foreach ($key in $envVars.Keys) {
        if ($key -eq "GROQ_API_KEY") {
            Write-Info "  $key=***hidden*** (length: $($envVars[$key].Length) chars)"
        } else {
            Write-Info "  $key=$($envVars[$key])"
        }
    }
    
    if ($settings.Count -gt 0) {
        $appSettingsSetEnvArgs = @("webapp", "config", "appsettings", "set", "--name", $AppName, "--resource-group", $ResourceGroup, "--settings")
        $appSettingsSetEnvArgs += $settings
        $appSettingsSetEnvArgs += "--only-show-errors"
        $context = "App: $AppName, ResourceGroup: $ResourceGroup, Variables: $($settings.Count)"
        if (-not (Invoke-AzSafe -ArgsArray $appSettingsSetEnvArgs -OperationName "configure environment variables" -Context $context)) {
            exit 1
        }
        Write-Success "Environment variables configured ($($settings.Count) variables)"
    } else {
        Write-Info "No environment variables found in .env"
    }
    
    # Create Deployment Package
    Write-Step "Creating Deployment Package"
    $deployZip = "deploy.zip"
    Write-Info "Creating deployment ZIP: $deployZip"
    
    if (Test-Path $deployZip) {
        Remove-Item $deployZip -Force
    }
    
    # Create zip (exclude unnecessary files)
    # Note: data/vectorstore is excluded because:
    #   - It contains large database files that shouldn't be deployed
    #   - Files may be locked by running ChromaDB processes
    #   - Vectorstore should be persisted separately (Azure Files mount)
    $excludePatterns = @(
        "*.pyc", "__pycache__", ".venv", "venv", "*.log", 
        ".git", ".gitignore", "*.md", "docs/*.pdf",
        "tests", "examples", "ml/notebooks", "app-logs",
        "data/raw", "data/processed", "data/vectorstore", ".env", "deploy.zip"
    )
    
    Write-Info "Collecting files to zip (excluding: $($excludePatterns -join ', '))..."
    $filesToZip = Get-ChildItem -Path . -Exclude $excludePatterns -Recurse | 
        Where-Object { 
            $_.FullName -notmatch '\\\.(git|venv|__pycache__)' -and
            $_.FullName -notmatch '\\data\\vectorstore\\' -and
            $_.FullName -notmatch '\\chroma\.sqlite3'
        }
    
    Write-Info "Creating ZIP archive with $($filesToZip.Count) files..."
    Write-Info "Filtering out locked files upfront to avoid retries..."
    # Filter out locked files upfront to avoid retries
    $unlockedFiles = @()
    $lockedCount = 0
    $totalCount = $filesToZip.Count
    $checkCount = 0
    foreach ($file in $filesToZip) {
        $checkCount++
        if ($checkCount % 50 -eq 0) {
            Write-Host "  Checking files: $checkCount/$totalCount..." -NoNewline -ForegroundColor Gray
            Write-Host "`r" -NoNewline
        }
        try {
            # Quick check - try to open file for reading
            $stream = [System.IO.File]::Open($file.FullName, 'Open', 'Read', 'None')
            $stream.Close()
            $unlockedFiles += $file
        } catch {
            $lockedCount++
            # Only warn about important files
            if ($file.Name -match '\.(py|txt|json|yaml|yml)$') {
                Write-Warning "Skipping locked file: $($file.Name)"
            }
        }
    }
    Write-Host "`r" -NoNewline
    Write-Info "Found $($unlockedFiles.Count) unlocked files (skipped $lockedCount locked files)"
    
    if ($unlockedFiles.Count -eq 0) {
        Write-Error "No files available to zip. All files appear to be locked."
        Write-Info "Common causes: Python processes, ChromaDB, or file explorers with the directory open"
        Write-Info "Try closing Python processes or file explorers and retry"
        exit 1
    }
    
    Write-Info "Creating ZIP archive..."
    try {
        Compress-Archive -Path $unlockedFiles -DestinationPath $deployZip -Force -ErrorAction Stop
        Write-Success "Deployment package created: $deployZip ($([math]::Round((Get-Item $deployZip).Length / 1MB, 2)) MB)"
    } catch {
        Write-Error "ZIP creation failed: $_"
        Write-Info "Try closing any processes that might be using files in this directory"
        exit 1
    }
    
    # Deploy to Azure
    Write-Step "Deploying to Azure App Service"
    Write-Info "Deploying $deployZip to $AppName..."
    Write-Info "This step uploads the ZIP file. Azure will then:"
    Write-Info "  1. Extract the ZIP file"
    Write-Info "  2. Run Oryx build (install Python dependencies)"
    Write-Info "  3. Start the application"
    Write-Info "Total time: 5-10 minutes (first deployment may take longer)"
    Write-Info ""
    
    $deployZipArgs = @("webapp", "deployment", "source", "config-zip", "--resource-group", $ResourceGroup, "--name", $AppName, "--src", $deployZip, "--only-show-errors")
    $context = "App: $AppName, ResourceGroup: $ResourceGroup, Package: $deployZip"
    
    $originalPreference = $ErrorActionPreference
    $deploymentOutput = $null
    $deploymentExitCode = 0
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $deploymentOutput = & az @deployZipArgs 2>&1
        $deploymentExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    # Check if it's a timeout (deployment still ongoing) vs actual failure
    $isTimeout = $false
    $deploymentUrl = $null
    if ($deploymentOutput) {
        $outputString = if ($deploymentOutput -is [array]) { $deploymentOutput -join "`n" } else { [string]$deploymentOutput }
        if ($outputString -match "Timeout reached while tracking deployment status" -or $outputString -match "deployment operation is still on-going") {
            $isTimeout = $true
            Write-Warning "Azure CLI timeout reached, but deployment is still in progress"
            Write-Info "This is normal - Azure deployments can take 5-10 minutes"
            Write-Success "ZIP file uploaded successfully. Deployment is continuing in the background..."
            # Extract deployment URL if present
            if ($outputString -match "https://[^\s]+/api/deployments/[^\s]+") {
                $deploymentUrl = $matches[0]
                Write-Info "Monitor deployment: $deploymentUrl"
            }
        }
    }
    
    # Check app state - if it's running, deployment likely succeeded
    $appState = $null
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        $appState = & az webapp show --name $AppName --resource-group $ResourceGroup --query "state" --only-show-errors 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
    } catch {
        # Ignore
    } finally {
        $ErrorActionPreference = $originalPreference
    }
    
    if ($deploymentExitCode -ne 0 -and -not $isTimeout) {
        if ($appState -eq "Running") {
            Write-Warning "Deployment command returned error, but app is Running"
            Write-Info "Deployment may have succeeded. Continuing with verification..."
            $isTimeout = $true  # Treat as timeout/ongoing
        } else {
            Write-Error "Deployment failed. App state: $appState"
            Write-Info "Try checking logs: az webapp log tail --name $AppName --resource-group $ResourceGroup"
            if ($deploymentUrl) {
                Write-Info "Check deployment status: $deploymentUrl"
            }
            exit 1
        }
    }
    
    if (-not $isTimeout) {
        Write-Success "ZIP file uploaded successfully"
    }
    Write-Info "Azure is now building and starting your application..."
    if ($deploymentUrl) {
        Write-Info "Monitor deployment: $deploymentUrl"
    }
    Write-Info "Or monitor logs: az webapp log tail --name $AppName --resource-group $ResourceGroup"
    
    if ($SkipVerification) {
        Write-Warning "Skipping deployment verification (--SkipVerification flag set)"
        Write-Info "You can manually verify deployment:"
        Write-Info "  Health check: curl https://$AppName.azurewebsites.net/healthz"
        Write-Info "  View logs: az webapp log tail --name $AppName --resource-group $ResourceGroup"
        Write-Info "  Check status: az webapp show --name $AppName --resource-group $ResourceGroup --query state"
        return
    }
    
    Write-Info "Waiting for build to complete (max wait: $VerificationTimeoutMinutes minutes)..."
    
    # Verify Deployment
    Write-Step "Verifying Deployment"
    $appUrl = "https://$AppName.azurewebsites.net"
    Write-Info "Checking deployment status (using smart polling with exponential backoff)..."
    
    # Smart deployment verification - check multiple indicators in parallel
    $deploymentActive = $false
    $appReady = $false
    $maxWaitSeconds = $VerificationTimeoutMinutes * 60
    $checkInterval = 15  # Start with 15 seconds
    $maxChecks = [math]::Ceiling($maxWaitSeconds / $checkInterval)
    $consecutiveFailures = 0
    Write-Info "Will check deployment status up to $maxChecks times (max $VerificationTimeoutMinutes minutes)"
    
    for ($i = 1; $i -le $maxChecks; $i++) {
        $originalPreference = $ErrorActionPreference
        $currentAppState = $null
        $deploymentStatus = $null
        
        try {
            $ErrorActionPreference = 'SilentlyContinue'
            
            # Check app state (faster than deployment status)
            $currentAppState = & az webapp show --name $AppName --resource-group $ResourceGroup --query "state" --only-show-errors 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
            
            # Check deployment status (less frequently)
            if ($i % 2 -eq 0 -or $i -eq 1) {
                $deploymentStatus = & az webapp deployment list --name $AppName --resource-group $ResourceGroup --only-show-errors 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($deploymentStatus -and $deploymentStatus.Count -gt 0) {
                    $latestDeployment = $deploymentStatus[0]
                    if ($latestDeployment.status -eq "4" -or $latestDeployment.status -eq "Success") {
                        $deploymentActive = $true
                    }
                }
            }
            
            # Try health check (fastest indicator)
            if ($i -ge 3) {  # Start health checks after 45 seconds
                try {
                    $healthResponse = Invoke-RestMethod -Uri "$appUrl/healthz" -TimeoutSec 5 -ErrorAction Stop
                    $appReady = $true
                    $deploymentActive = $true
                    Write-Success "✅ App is responding! Health check passed"
                    break
                } catch {
                    # Health check failed, continue polling
                }
            }
            
        } catch {
            # Ignore errors, continue polling
        } finally {
            $ErrorActionPreference = $originalPreference
        }
        
        # Progress indicator
        if ($i -le $maxChecks) {
            $elapsed = ($i - 1) * $checkInterval
            $statusMsg = "Checking deployment status... ($i/$maxChecks, ~$elapsed seconds)"
            if ($currentAppState) {
                $statusMsg += " [App State: $currentAppState]"
            }
            if ($deploymentActive) {
                $statusMsg += " [Deployment: Active]"
            }
            Write-Host $statusMsg -ForegroundColor Gray
            
            # If app state is Running and we've waited a bit, try health check
            if ($currentAppState -eq "Running" -and $i -ge 5) {
                Write-Info "App state is Running, attempting health check..."
                try {
                    $healthResponse = Invoke-RestMethod -Uri "$appUrl/healthz" -TimeoutSec 10 -ErrorAction Stop
                    $appReady = $true
                    Write-Success "✅ Health check passed: $($healthResponse | ConvertTo-Json -Compress)"
                    break
                } catch {
                    Write-Info "Health check not ready yet, continuing to wait..."
                }
            }
            
            # Exponential backoff - increase wait time if no progress
            if ($i -lt $maxChecks) {
                if ($i -gt 10 -and -not $deploymentActive -and -not $appReady) {
                    $checkInterval = 20  # Slow down after 2.5 minutes
                }
                Start-Sleep -Seconds $checkInterval
            }
        }
    }
    
    if (-not $deploymentActive -and -not $appReady) {
        Write-Warning "Deployment verification timeout reached, but continuing with health checks..."
        Write-Info "The app may still be building. You can check logs: az webapp log tail --name $AppName --resource-group $ResourceGroup"
    }
    
    # Final health check with retries
    if (-not $appReady) {
        Write-Info "Performing final health check attempts..."
        $healthCheckPassed = $false
        $maxRetries = 5
        for ($i = 1; $i -le $maxRetries; $i++) {
            try {
                $response = Invoke-RestMethod -Uri "$appUrl/healthz" -TimeoutSec 10
                Write-Success "✅ Health check passed: $($response | ConvertTo-Json -Compress)"
                $healthCheckPassed = $true
                $appReady = $true
                break
            } catch {
                if ($i -lt $maxRetries) {
                    Write-Info "Health check attempt $i/$maxRetries failed, retrying in 10 seconds..."
                    Start-Sleep -Seconds 10
                } else {
                    Write-Warning "Health check failed after $maxRetries attempts: $_"
                    Write-Info "App may still be starting. Check logs: az webapp log tail --name $AppName --resource-group $ResourceGroup"
                    Write-Info "Or test manually: curl $appUrl/healthz"
                }
            }
        }
    } else {
        $healthCheckPassed = $true
    }
    
    # Test Groq API integration
    if ($appReady) {
        Write-Step "Testing Groq API Integration"
        Write-Info "Testing chat endpoint to verify Groq API is working..."
        try {
            $testPayload = @{
                message = "Hello, test message"
                user_id = "deployment-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
            } | ConvertTo-Json
            
            $chatResponse = Invoke-RestMethod -Uri "$appUrl/v1/chat" -Method Post -ContentType "application/json" -Body $testPayload -TimeoutSec 30
            if ($chatResponse.response) {
                Write-Success "✅ Groq API test successful!"
                $responsePreview = $chatResponse.response.Substring(0, [Math]::Min(150, $chatResponse.response.Length))
                Write-Info "Response preview: $responsePreview..."
            } else {
                Write-Warning "Groq API returned unexpected response format"
            }
        } catch {
            Write-Warning "Groq API test failed: $_"
            Write-Info "This may indicate:"
            Write-Info "  1. App is still starting (wait a few minutes and retry manually)"
            Write-Info "  2. GROQ_API_KEY not properly set in Azure app settings"
            Write-Info "  3. Network/firewall issue"
            Write-Info ""
            Write-Info "To verify environment variables in Azure:"
            Write-Info "  az webapp config appsettings list --name $AppName --resource-group $ResourceGroup --query `"[?name=='GROQ_API_KEY']`""
            Write-Info ""
            Write-Info "To test manually:"
            Write-Info "  curl -X POST $appUrl/v1/chat -H 'Content-Type: application/json' -d '$testPayload'"
        }
    } else {
        Write-Warning "Skipping Groq API test - health check did not pass"
    }
    
    # Post-Deployment Configuration Verification
    if (-not $appReady) {
        Write-Step "Post-Deployment Diagnostics"
        Write-Warning "Application did not pass health check - running diagnostics..."
        
        # Check critical app settings
        Write-Info "Verifying critical app settings..."
        $configIssues = @()
        
        try {
            $currentSettings = az webapp config appsettings list --name $AppName --resource-group $ResourceGroup --only-show-errors 2>&1 | ConvertFrom-Json
            $settingsHash = @{}
            foreach ($setting in $currentSettings) {
                $settingsHash[$setting.name] = $setting.value
            }
            
            # Check SCM_DO_BUILD_DURING_DEPLOYMENT
            if (-not $settingsHash.ContainsKey("SCM_DO_BUILD_DURING_DEPLOYMENT") -or $settingsHash["SCM_DO_BUILD_DURING_DEPLOYMENT"] -ne "true") {
                $configIssues += "SCM_DO_BUILD_DURING_DEPLOYMENT not set to 'true'"
            }
            
            # Check WEBSITE_RUN_FROM_PACKAGE (should NOT be set)
            if ($settingsHash.ContainsKey("WEBSITE_RUN_FROM_PACKAGE")) {
                $configIssues += "WEBSITE_RUN_FROM_PACKAGE is set (blocks Oryx build)"
            }
            
            # Check PYTHONPATH
            if (-not $settingsHash.ContainsKey("PYTHONPATH") -or $settingsHash["PYTHONPATH"] -ne "/home/site/wwwroot") {
                $configIssues += "PYTHONPATH not set to '/home/site/wwwroot'"
            }
            
            # Check GROQ_API_KEY
            if (-not $settingsHash.ContainsKey("GROQ_API_KEY") -or -not $settingsHash["GROQ_API_KEY"].StartsWith("gsk_")) {
                $configIssues += "GROQ_API_KEY missing or invalid format"
            }
            
            if ($configIssues.Count -gt 0) {
                Write-Warning "Found $($configIssues.Count) configuration issue(s):"
                foreach ($issue in $configIssues) {
                    Write-Host "  ✗ $issue" -ForegroundColor Red
                }
                
                Write-Host "`nThese issues may cause module import errors or startup failures." -ForegroundColor Yellow
                Write-Host ""
                Write-Host "Automatic Fix Options:" -ForegroundColor Cyan
                Write-Host "  1. Run the automatic fix script:" -ForegroundColor White
                Write-Host "     .\scripts\azure_fix_deployment.ps1 -AppName $AppName -ResourceGroup $ResourceGroup" -ForegroundColor Gray
                Write-Host ""
                Write-Host "  2. Run diagnostics:" -ForegroundColor White
                Write-Host "     .\scripts\azure_verify_config.ps1 -AppName $AppName -ResourceGroup $ResourceGroup" -ForegroundColor Gray
                Write-Host ""
                
                # Auto-fix if requested, or prompt in interactive mode
                if ($AutoFixOnFailure) {
                    Write-Info "Auto-fix enabled - running fix script..."
                    $fixScriptPath = Join-Path $PSScriptRoot "scripts\azure_fix_deployment.ps1"
                    if (Test-Path $fixScriptPath) {
                        & $fixScriptPath -AppName $AppName -ResourceGroup $ResourceGroup
                    } else {
                        Write-Warning "Fix script not found at: $fixScriptPath"
                        Write-Info "You can download the latest version or run the commands manually from DEPLOYMENT.md"
                    }
                } elseif ([Environment]::UserInteractive -and $Host.UI.RawUI) {
                    # Interactive mode - prompt user
                    $response = Read-Host "Would you like to run the automatic fix script now? (Y/N)"
                    if ($response -eq "Y" -or $response -eq "y") {
                        Write-Info "Running automatic fix script..."
                        $fixScriptPath = Join-Path $PSScriptRoot "scripts\azure_fix_deployment.ps1"
                        if (Test-Path $fixScriptPath) {
                            & $fixScriptPath -AppName $AppName -ResourceGroup $ResourceGroup
                        } else {
                            Write-Warning "Fix script not found at: $fixScriptPath"
                            Write-Info "You can download the latest version or run the commands manually from DEPLOYMENT.md"
                        }
                    } else {
                        Write-Info "Skipping automatic fix. You can run it later if needed."
                    }
                } else {
                    # Non-interactive mode - just display command
                    Write-Info "Non-interactive mode detected. To auto-run the fix script, use -AutoFixOnFailure parameter."
                    Write-Info "Or run the fix script manually: .\scripts\azure_fix_deployment.ps1 -AppName $AppName -ResourceGroup $ResourceGroup"
                }
            } else {
                Write-Success "All critical settings are correctly configured"
                Write-Info "The app may still be starting. Build process can take 10-15 minutes for first deployment."
            }
            
        } catch {
            Write-Warning "Failed to retrieve app settings for verification: $_"
        }
        
        # Display recent logs
        Write-Info "`nRetrieving recent deployment logs..."
        try {
            Write-Host "Last 30 lines of logs:" -ForegroundColor Cyan
            $logs = az webapp log download --name $AppName --resource-group $ResourceGroup --log-file "-" --only-show-errors 2>&1 | Select-Object -Last 30
            $logs | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
            
            # Check for common error patterns
            $logString = $logs -join "`n"
            if ($logString -match "ModuleNotFoundError|ImportError") {
                Write-Warning "`n⚠️ Module import errors detected in logs!"
                Write-Info "This usually indicates PYTHONPATH or Oryx build issues."
                Write-Info "Run the fix script to resolve: .\scripts\azure_fix_deployment.ps1 -AppName $AppName -ResourceGroup $ResourceGroup"
            }
            if ($logString -match "No module named 'uvicorn'|No module named 'gunicorn'") {
                Write-Warning "`n⚠️ Missing Python packages detected!"
                Write-Info "Ensure SCM_DO_BUILD_DURING_DEPLOYMENT=true and redeploy."
            }
        } catch {
            Write-Warning "Failed to retrieve logs: $_"
        }
    }
    
    # Summary
    Write-Step "Deployment Summary"
    
    # Display deployment status with color coding
    if ($appReady -and $healthCheckPassed) {
        Write-Host "`n✅ Deployment Successful!" -ForegroundColor Green
        Write-Host "Status: " -NoNewline -ForegroundColor White
        Write-Host "HEALTHY" -ForegroundColor Green
    } elseif ($deploymentActive) {
        Write-Host "`n⚠️  Deployment In Progress" -ForegroundColor Yellow
        Write-Host "Status: " -NoNewline -ForegroundColor White
        Write-Host "BUILDING" -ForegroundColor Yellow
        Write-Host "Note: First deployment can take 10-15 minutes due to dependency compilation" -ForegroundColor Gray
    } else {
        Write-Host "`n⚠️  Deployment May Need Attention" -ForegroundColor Yellow
        Write-Host "Status: " -NoNewline -ForegroundColor White
        Write-Host "NEEDS VERIFICATION" -ForegroundColor Red
    }
    
    Write-Host "`nApplication Information:" -ForegroundColor Cyan
    Write-Host "  URL:         $appUrl" -ForegroundColor White
    Write-Host "  API Docs:    $appUrl/docs" -ForegroundColor White
    Write-Host "  Health:      $appUrl/healthz" -ForegroundColor White
    Write-Host "  Resource:    $ResourceGroup / $AppName" -ForegroundColor Gray
    
    if ($appReady) {
        Write-Host "`n✓ Health Check: " -NoNewline -ForegroundColor Green
        Write-Host "PASSED" -ForegroundColor Green
        Write-Host "✓ Groq API:     " -NoNewline -ForegroundColor Green
        Write-Host "TESTED" -ForegroundColor Green
    } else {
        Write-Host "`n✗ Health Check: " -NoNewline -ForegroundColor Red
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
        Write-Host "  1. Check logs:       az webapp log tail --name $AppName --resource-group $ResourceGroup" -ForegroundColor Gray
        Write-Host "  2. Run diagnostics:  .\scripts\azure_verify_config.ps1 -AppName $AppName -ResourceGroup $ResourceGroup" -ForegroundColor Gray
        Write-Host "  3. Fix issues:       .\scripts\azure_fix_deployment.ps1 -AppName $AppName -ResourceGroup $ResourceGroup" -ForegroundColor Gray
        Write-Host "  4. Manual restart:   az webapp restart --name $AppName --resource-group $ResourceGroup" -ForegroundColor Gray
    }
    
    Write-Host "`nUseful Commands:" -ForegroundColor Cyan
    Write-Host "  View logs:       az webapp log tail --name $AppName --resource-group $ResourceGroup" -ForegroundColor Gray
    Write-Host "  Restart app:     az webapp restart --name $AppName --resource-group $ResourceGroup" -ForegroundColor Gray
    Write-Host "  View settings:   az webapp config appsettings list --name $AppName --resource-group $ResourceGroup" -ForegroundColor Gray
    Write-Host "  Check status:    az webapp show --name $AppName --resource-group $ResourceGroup --query state" -ForegroundColor Gray
    Write-Host "  Test health:     curl $appUrl/healthz" -ForegroundColor Gray
    
    Write-Host "`nNext Steps:" -ForegroundColor Cyan
    if ($appReady) {
        Write-Host "  ✓ Your application is ready to use!" -ForegroundColor Green
        Write-Host "  ✓ Visit $appUrl/docs for interactive API documentation" -ForegroundColor Green
        Write-Host "  ✓ Monitor application logs for any issues" -ForegroundColor Green
    } else {
        Write-Host "  1. Wait a few more minutes for the build to complete" -ForegroundColor Yellow
        Write-Host "  2. Monitor logs for build progress and errors" -ForegroundColor Yellow
        Write-Host "  3. Run diagnostics if app doesn't start after 15 minutes" -ForegroundColor Yellow
        Write-Host "  4. See DEPLOYMENT.md for detailed troubleshooting" -ForegroundColor Yellow
    }
    
    Write-Host "`nFor detailed troubleshooting, see:" -ForegroundColor Cyan
    Write-Host "  - DEPLOYMENT.md (Module Import Errors section)" -ForegroundColor Gray
    Write-Host "  - docs\TROUBLESHOOTING.md (Section 9: Azure App Service)" -ForegroundColor Gray
    Write-Host ""
}

# ============================================================================
# DATA PIPELINE (Default)
# ============================================================================
function Deploy-Pipeline {
    Write-Step "Phase 0: Environment Setup"
    
    # Check Python installation
    Write-Info "Checking Python installation..."
    try {
        $pythonVersion = python --version 2>&1
        Write-Success "Python is available: $pythonVersion"
    } catch {
        Write-Error "Python is not installed or not in PATH"
        exit 1
    }
    
    # Check virtual environment
    Write-Info "Checking virtual environment..."
    if (Test-Path ".venv") {
        Write-Success "Virtual environment exists"
    } else {
        Write-Warning "Virtual environment not found - creating..."
        python -m venv .venv
        Write-Success "Virtual environment created"
    }
    
    # Activate virtual environment
    Write-Info "Activating virtual environment..."
    if (Test-Path ".\.venv\Scripts\Activate.ps1") {
        .\.venv\Scripts\Activate.ps1
        Write-Success "Virtual environment activated"
    } else {
        Write-Warning "Virtual environment activation script not found, using system Python"
    }
    
    # Determine Python and pip executables
    $pythonExe = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "python" }
    $pipExe = if (Test-Path ".\.venv\Scripts\pip.exe") { ".\.venv\Scripts\pip.exe" } else { "pip" }
    
    # Check required packages
    Write-Info "Checking required packages..."
    $requiredPackages = @("chromadb", "PyPDF2", "pdfplumber", "beautifulsoup4", "lxml", "httpx", "aiohttp", "prometheus_client", "fastapi")
    $missingPackages = @()
    
    foreach ($package in $requiredPackages) {
        $ErrorActionPreference = 'SilentlyContinue'
        $packageName = $package
        if ($package -eq "PyPDF2") {
            $packageName = "PyPDF2"
        } elseif ($package -eq "pdfplumber") {
            $packageName = "pdfplumber"
        } elseif ($package -eq "beautifulsoup4") {
            $packageName = "bs4"
        } elseif ($package -eq "prometheus_client") {
            $packageName = "prometheus_client"
        } elseif ($package -eq "fastapi") {
            $packageName = "fastapi"
        }
        $check = & $pythonExe -c "import $packageName" 2>&1
        $ErrorActionPreference = 'Stop'
        if ($LASTEXITCODE -ne 0) {
            $missingPackages += $package
        }
    }
    
    if ($missingPackages.Count -gt 0) {
        Write-Warning "Missing packages: $($missingPackages -join ', ')"
        Write-Info "Installing missing packages from requirements.txt..."
        & $pipExe install -r requirements.txt
        Write-Success "Packages installed"
    } else {
        Write-Success "All required packages are installed"
    }
    
    # Check environment variables
    Write-Info "Checking environment variables..."
    $requiredVars = @("GROQ_API_KEY", "CHROMA_PERSIST_DIR")
    $missingVars = @()
    
    foreach ($var in $requiredVars) {
        $value = [Environment]::GetEnvironmentVariable($var)
        if (-not $value) {
            # Try .env file
            if (Test-Path ".env") {
                $envContent = Get-Content ".env" -Raw
                if ($envContent -match "$var=(.+)") {
                    continue
                }
            }
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Warning "Missing environment variables: $($missingVars -join ', ')"
        Write-Info "Please set these in .env file or environment"
    }
    
    # Create data directories
    Write-Info "Creating data directories..."
    $dirs = @("$DATA_DIR/vectorstore")
    foreach ($dir in $dirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Success "Created directory: $dir"
        }
    }
    
    # Check docs directory exists
    Write-Info "Checking docs directory..."
    if (-not (Test-Path "docs")) {
        Write-Warning "docs directory not found - creating..."
        New-Item -ItemType Directory -Path "docs" -Force | Out-Null
        Write-Success "docs directory created"
        Write-Warning "Please add PDF files to the docs directory before running PDF ingestion"
    } else {
        $pdfFiles = Get-ChildItem -Path "docs" -Filter "*.pdf" -ErrorAction SilentlyContinue
        if ($pdfFiles.Count -eq 0) {
            Write-Warning "No PDF files found in docs directory"
            Write-Info "Please add PDF files to the docs directory"
        } else {
            Write-Success "Found $($pdfFiles.Count) PDF file(s) in docs directory"
        }
    }
    
    Write-Success "Phase 0 complete: Environment setup verified"
    
    # ============================================================================
    # PHASE 1: PDF Ingestion
    # ============================================================================
    Write-Step "Phase 1: PDF Ingestion into Vector Database"
    
    if (-not $SkipPdfIngest) {
        # Check if PDF files exist
        $pdfFiles = Get-ChildItem -Path "docs" -Filter "*.pdf" -ErrorAction SilentlyContinue
        if ($pdfFiles.Count -eq 0) {
            Write-Warning "No PDF files found in docs directory"
            Write-Info "Skipping PDF ingestion - add PDF files to docs/ directory and run again"
        } else {
            Write-Info "Found $($pdfFiles.Count) PDF file(s) to process"
            
            # Calculate total size
            $totalSize = ($pdfFiles | Measure-Object -Property Length -Sum).Sum
            $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
            Write-Info "Total size of PDFs: $totalSizeMB MB"
            
            Write-Warning "PDF ingestion may take several minutes depending on the number and size of PDFs"
            Write-Info "The process will show continuous progress updates for each PDF and batch"
            Write-Info "Problematic PDFs will be skipped automatically and processing will continue"
            Write-Info "PDF processing timeout is set to $PdfTimeout seconds per PDF"
            
            if ($FullRefresh) {
                Write-Warning "Full refresh requested - existing PDF chunks will be deleted and re-added"
            }
            
            Write-Info "Starting PDF ingestion..."
            $ingestStartTime = Get-Date
            $ErrorActionPreference = 'Continue'
            $PDF_INGEST_SCRIPT = "scripts/pdf_ingest.py"
            
            # Build command with timeout parameter
            $ingestArgs = @()
            $ingestArgs += "--timeout", $PdfTimeout
            $ingestArgs += "--skip-on-error"
            if ($FullRefresh) {
                $ingestArgs += "--full-refresh"
            }
            
            & $pythonExe $PDF_INGEST_SCRIPT $ingestArgs
            $pdfIngestExitCode = $LASTEXITCODE
            $ErrorActionPreference = 'Stop'
            
            $ingestElapsed = (Get-Date) - $ingestStartTime
            $ingestMinutes = [math]::Round($ingestElapsed.TotalMinutes, 2)
            
            Write-Info "PDF ingestion completed in $ingestMinutes minutes"
            
            if ($pdfIngestExitCode -ne 0) {
                Write-Warning "PDF ingestion completed with some failures (exit code: $pdfIngestExitCode)"
                Write-Info "Check the output above for details on which PDFs failed"
                Write-Info "Failed PDFs are listed at the end of the ingestion summary"
                Write-Info "You can retry processing by running the script again"
                
                # Don't exit with error if some PDFs succeeded
                # Only exit if ALL PDFs failed (which would be indicated by the script)
                # The script returns 0 if all succeeded, 1 if any failed
                # We'll continue deployment even if some PDFs failed
            } else {
                Write-Success "PDF ingestion phase completed successfully"
            }
        }
    } else {
        Write-Info "Skipping PDF ingestion phase (--skip-pdf-ingest flag set)"
    }
    
    # ============================================================================
    # PHASE 1b: KB Ingestion
    # ============================================================================
    Write-Step "Phase 1b: KB Ingestion into Vector Database"
    
    # Check if KB directory exists
    $kbDir = "docs\kb"
    if (Test-Path $kbDir) {
        $kbFiles = Get-ChildItem -Path $kbDir -Filter "*.md" -ErrorAction SilentlyContinue
        if ($kbFiles.Count -gt 0) {
            Write-Info "Found $($kbFiles.Count) KB markdown file(s) in docs/kb/"
            Write-Info "Starting KB ingestion..."
            $kbIngestStartTime = Get-Date
            $ErrorActionPreference = 'Continue'
            
            & $pythonExe scripts/kb_ingest.py
            $kbIngestExitCode = $LASTEXITCODE
            $ErrorActionPreference = 'Stop'
            
            $kbIngestElapsed = (Get-Date) - $kbIngestStartTime
            $kbIngestMinutes = [math]::Round($kbIngestElapsed.TotalMinutes, 2)
            
            Write-Info "KB ingestion completed in $kbIngestMinutes minutes"
            
            if ($kbIngestExitCode -eq 0) {
                Write-Success "KB ingestion phase completed successfully"
            } else {
                Write-Warning "KB ingestion completed with warnings (exit code: $kbIngestExitCode)"
                Write-Info "Check the output above for details on KB ingestion status"
            }
        } else {
            Write-Info "No markdown files found in docs/kb/ directory"
            Write-Info "KB ingestion skipped - add .md files to docs/kb/ to enable KB ingestion"
        }
    } else {
        Write-Info "KB directory not found: $kbDir"
        Write-Info "KB ingestion skipped - create docs/kb/ directory and add .md files to enable KB ingestion"
    }
    
    # ============================================================================
    # PHASE 2: API Verification
    # ============================================================================
    Write-Step "Phase 2: API Verification"
    
    Write-Info "Testing API endpoints..."
    $API_URL = "http://localhost:8000"
    
    # Check if server is running
    try {
        $healthResponse = Invoke-RestMethod -Uri "$API_URL/healthz" -TimeoutSec 5 -ErrorAction Stop
        Write-Success "API server is running"
        
        # Test search endpoint
        Write-Info "Testing /v1/search endpoint..."
        try {
            $searchResult = Invoke-RestMethod -Uri "$API_URL/v1/search?q=technical%20analysis&k=3" -TimeoutSec 10 -ErrorAction Stop
            Write-Success "Search endpoint working - found results"
        } catch {
            Write-Warning "Search endpoint test failed: $_"
        }
        
        # Test chat endpoint
        Write-Info "Testing /v1/chat endpoint..."
        try {
            $chatTest = @{
                message = "What is RSI?"
                user_id = "pipeline-test"
            } | ConvertTo-Json
            $chatResponse = Invoke-RestMethod -Uri "$API_URL/v1/chat" -Method Post -ContentType "application/json" -Body $chatTest -TimeoutSec 30
            Write-Success "Chat endpoint working"
        } catch {
            Write-Warning "Chat endpoint test failed: $_"
        }
        
        # Test background status
        Write-Info "Testing /v1/background/status endpoint..."
        try {
            $bgStatus = Invoke-RestMethod -Uri "$API_URL/v1/background/status" -TimeoutSec 10 -ErrorAction Stop
            Write-Success "Background scheduler status accessible"
        } catch {
            Write-Warning "Background status endpoint test failed: $_"
        }
        
    } catch {
        Write-Warning "API server is not running - skipping API verification"
        Write-Info "Start the server with: python -m uvicorn app.main:app --reload"
    }
    
    # ============================================================================
    # PHASE 3: Summary & Next Steps
    # ============================================================================
    Write-Step "Phase 3: Summary & Next Steps"
    
    Write-Success "Pipeline execution completed!"
    Write-Host "`nPipeline Summary:" -ForegroundColor Cyan
    Write-Host "  - PDF documents: docs/" -ForegroundColor Gray
    Write-Host "  - Vector store: $DATA_DIR/vectorstore/" -ForegroundColor Gray
    
    # Check vector store stats
    Write-Info "Checking vector store statistics..."
    try {
        $statsScript = @"
import sys
import os
sys.path.insert(0, os.getcwd())
from app.tools.vector_ingest import get_vector_ingestor
ingestor = get_vector_ingestor()
stats = ingestor.get_collection_stats('pdf_documents')
if stats.get('exists'):
    print(f"PDF documents collection: {stats.get('count', 0)} chunks")
else:
    print("PDF documents collection: not found")
"@
        $statsOutput = $statsScript | & $pythonExe
        Write-Info $statsOutput
    } catch {
        Write-Warning "Could not retrieve vector store statistics"
    }
    
    Write-Host "`nNext Steps:" -ForegroundColor Cyan
    Write-Host "  - Add more PDF files to docs/ directory and run PDF ingestion again" -ForegroundColor Gray
    Write-Host "  - The chatbot will use only information from PDF documents" -ForegroundColor Gray
    Write-Host "  - Background scheduler will periodically re-ingest PDFs (configurable via PDF_INGEST_INTERVAL_HOURS)" -ForegroundColor Gray
    Write-Host "  - Monitor metrics: GET /v1/metrics endpoints" -ForegroundColor Gray
    Write-Host "  - Test chat: POST /v1/chat with your questions" -ForegroundColor Gray
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "WealthArena Master Deployment Script" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

switch ($Deploy.ToLower()) {
    "docker" {
        Deploy-Docker
    }
    "azure" {
        Deploy-Azure
    }
    default {
        Deploy-Pipeline
    }
}

Write-Host "`n"
