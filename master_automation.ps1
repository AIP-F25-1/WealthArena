#Requires -Version 5.1

<#
.SYNOPSIS
    WealthArena Master Automation Script - Complete deployment pipeline orchestration
    
.DESCRIPTION
    Orchestrates all phases of the WealthArena deployment pipeline including:
    - Frontend testing
    - Data download and processing
    - RL model training
    - Azure infrastructure and service deployment
    - End-to-end testing
    - APK build
    
.PARAMETER ConfigFile
    Path to configuration YAML file (default: automation_config.yaml)
    
.PARAMETER ResourceGroup
    Azure resource group name
    
.PARAMETER Location
    Azure region
    
.PARAMETER Suffix
    Unique suffix for resource naming
    
.PARAMETER StartFromPhase
    Phase number to start from (1-11)
    
.PARAMETER Resume
    Resume from last completed phase
    
.PARAMETER SkipFrontendTest
    Skip frontend testing phase
    
.PARAMETER SkipDataDownload
    Skip data download phase
    
.PARAMETER SkipDataProcessing
    Skip data processing phase
    
.PARAMETER SkipRLTraining
    Skip RL training phase
    
.PARAMETER SkipDeployment
    Skip Azure deployment phases
    
.PARAMETER SkipAPKBuild
    Skip APK build phase
    
.PARAMETER TrainingSpeed
    Training speed mode: fastest (10-15 min), faster (30-45 min), fast (1-1.5 hours), quick (2.5-5 hours), slow (8-12 hours), or full (24+ hours)
    Default: quick

.PARAMETER QuickTraining
    [DEPRECATED] Use --TrainingSpeed instead. Use quick training config (500 iterations, smaller batches) instead of production config
    
.PARAMETER KillStuckProcesses
    Kill stuck Python/Ray processes before starting training
    
.PARAMETER DryRun
    Show what would be executed without actually running
    
.PARAMETER FrontendStartScript
    Frontend start script to use (default: start-expo-web)
    Options: start-expo (native dev server) or start-expo-web (web)
    
.EXAMPLE
    .\master_automation.ps1
    
.EXAMPLE
    .\master_automation.ps1 -StartFromPhase 7
    
.EXAMPLE
    .\master_automation.ps1 -Resume
#>

param(
    [string]$ConfigFile = "config/automation_config.yaml",
    [string]$ResourceGroup = "",
    [string]$Location = "",
    [string]$Suffix = "",
    [int]$StartFromPhase = 0,
    [switch]$Resume = $false,
    [switch]$SkipFrontendTest = $false,
    [switch]$SkipDataDownload = $false,
    [switch]$SkipDataProcessing = $false,
    [switch]$SkipRLTraining = $false,
    [switch]$SkipDeployment = $false,
    [switch]$SkipAPKBuild = $false,
    [ValidateSet("fastest", "faster", "fast", "quick", "slow", "full")]
    [string]$TrainingSpeed = "quick",  # Default to quick training for faster runs
    [switch]$QuickTraining = $false,  # [DEPRECATED] Use -TrainingSpeed instead
    [switch]$KillStuckProcesses = $false,
    [switch]$DryRun = $false,
    [switch]$ForceDefaults = $false,
    [string]$FrontendStartScript = "start-expo-web",
    [switch]$NonInteractive = $false,  # Non-interactive mode for CI/automated runs
    [switch]$RunMaintenance = $false  # Run maintenance cleanup after automation
)

# Set strict error handling
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Configure PowerShell console to UTF-8 encoding for proper Unicode handling
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Verbose "Console encoding set to UTF-8"
}
catch {
    Write-Warning "Could not set console encoding to UTF-8: $_"
}

# Colors for output
$script:Green = "Green"
$script:Red = "Red"
$script:Yellow = "Yellow"
$script:Blue = "Blue"
$script:Cyan = "Cyan"
$script:Magenta = "Magenta"
$script:White = "White"

# Global state
$script:PhaseStartTime = @{}
$script:PhaseEndTime = @{}
$script:PhaseStatus = @{}
$script:AutomationState = @{
    StartTime = Get-Date
    CurrentPhase = 0
    CompletedPhases = @()
    FailedPhases = @()
    ServiceURLs = @{}
    Artifacts = @{}
}
$script:Config = $null
$script:ConfigMissing = $false
$script:TrackedProcesses = @()  # Track PIDs of processes started by the script
$script:TrainingSpeedExplicitlySet = $false  # Track if TrainingSpeed was explicitly set (parameter or prompt)

# Get script directory
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $script:ScriptDir

# Import powershell-yaml - REQUIRED, fail if missing
$script:YamlLoaded = $false
try {
    if (Get-Module -ListAvailable -Name powershell-yaml) {
        Import-Module powershell-yaml -ErrorAction Stop
        $script:YamlLoaded = $true
    }
    else {
        Write-Error "========================================"
        Write-Error "ERROR: powershell-yaml module is not installed"
        Write-Error "This module is REQUIRED for configuration parsing."
        Write-Error "Please install it with:"
        Write-Error "  Install-Module -Name powershell-yaml -Scope CurrentUser -Force"
        Write-Error "========================================"
        exit 1
    }
}
catch {
    Write-Error "========================================"
    Write-Error "ERROR: Failed to load powershell-yaml module"
    Write-Error "Error: $_"
    Write-Error "Please install it with:"
    Write-Error "  Install-Module -Name powershell-yaml -Scope CurrentUser -Force"
    Write-Error "========================================"
    exit 1
}

# New helper functions for user interaction and prerequisite checking
function Wait-ForUserConfirmation {
    param(
        [string]$Message = "Press Y to continue, or any other key to skip",
        [int]$TimeoutSeconds = 0
    )
    
    # Short-circuit to default affirmative response in non-interactive mode
    if ($NonInteractive) {
        Write-ColorOutput "[NON-INTERACTIVE] Auto-approving: $Message" $Cyan
        Write-PhaseLog "Non-interactive mode: auto-approved $Message"
        return $true
    }
    
    Write-ColorOutput $Message $Yellow
    Write-Host ""
    
    if ($TimeoutSeconds -gt 0) {
        $endTime = (Get-Date).AddSeconds($TimeoutSeconds)
        $userInput = ""
        while ((Get-Date) -lt $endTime -and $userInput -ne "Y" -and $userInput -ne "y") {
            if ([Console]::KeyAvailable) {
                $key = [Console]::ReadKey($true)
                $userInput = $key.KeyChar
                if ($userInput -eq "Y" -or $userInput -eq "y") {
                    Write-Host ""
                    Write-PhaseLog "User confirmed: $Message"
                    return $true
                }
                elseif ($userInput -eq "N" -or $userInput -eq "n" -or $userInput -eq [char]27) {
                    Write-Host ""
                    Write-PhaseLog "User declined: $Message"
                    return $false
                }
            }
            Start-Sleep -Milliseconds 100
        }
        
        if ($userInput -ne "Y" -and $userInput -ne "y") {
            Write-ColorOutput "Timeout reached. Continuing..." $Yellow
            Write-PhaseLog "Timeout reached for: $Message"
            return $false
        }
    }
    else {
        $response = Read-Host "Type Y to continue"
        if ($response -eq "Y" -or $response -eq "y") {
            Write-PhaseLog "User confirmed: $Message"
            return $true
        }
        else {
            Write-PhaseLog "User declined: $Message"
            return $false
        }
    }
    
    return $false
}

function Show-CountdownTimer {
    param(
        [int]$Seconds = 30,
        [string]$Message = "Waiting"
    )
    
    # Bypass countdown in non-interactive mode
    if ($NonInteractive) {
        Write-ColorOutput "[NON-INTERACTIVE] Skipping countdown: $Message" $Cyan
        Write-PhaseLog "Non-interactive mode: skipped countdown for $Message"
        return
    }
    
    Write-ColorOutput "$Message... ($Seconds seconds)" $Cyan
    for ($i = $Seconds; $i -gt 0; $i--) {
        Write-Host -NoNewline "`r$Message... ($i seconds remaining)  "
        Start-Sleep -Seconds 1
    }
    Write-Host -NoNewline "`r$Message... (0 seconds) - Ready!    " -ForegroundColor Green
    Write-Host ""
    Write-PhaseLog "Countdown timer completed: $Message ($Seconds seconds)"
}

# Import automation_common.ps1 for shared functions (Resolve-ServiceUrls, Get-FirewallGuidanceMessage, Show-FirewallGuidance)
$commonScript = Join-Path $script:ScriptDir "scripts\utilities\automation_common.ps1"
if (Test-Path $commonScript) {
    . $commonScript
}

function Test-PrerequisiteWithRetry {
    param(
        [scriptblock]$TestScript,
        [string]$FailureMessage = "Prerequisite check failed",
        [string]$InstructionMessage = "Please fix the issue and press Y when ready",
        [int]$MaxRetries = 3
    )
    
    $attempt = 0
    while ($attempt -lt $MaxRetries) {
        $attempt++
        Write-PhaseLog "Prerequisite check attempt $attempt of $MaxRetries"
        
        try {
            $result = & $TestScript
            if ($result) {
                Write-PhaseLog "Prerequisite check passed on attempt $attempt"
                return $true
            }
        }
        catch {
            Write-PhaseLog "Prerequisite check error: $_" "WARNING"
        }
        
        if ($attempt -lt $MaxRetries) {
            Write-ColorOutput "[CAUTION] $FailureMessage" $Yellow
            Write-ColorOutput "$InstructionMessage" $Cyan
            Write-Host ""
            
            $confirmed = Wait-ForUserConfirmation -Message "After fixing the issue, type Y to retry the prerequisite check, or N to abort (auto-retrying in 10 seconds)" -TimeoutSeconds 10
            if (-not $confirmed) {
                Write-ColorOutput "User chose to abort prerequisite check." $Red
                Write-PhaseLog "User aborted prerequisite check after attempt $attempt"
                return $false
            }
            
            Write-ColorOutput "Retrying prerequisite check..." $Blue
        }
    }
    
    Write-ColorOutput "[ERROR] Prerequisite check failed after $MaxRetries attempts: $FailureMessage" $Red
    Write-PhaseLog "Prerequisite check failed after $MaxRetries attempts" "ERROR"
    return $false
}

function Request-UserChoice {
    param(
        [string[]]$Options,
        [string]$Prompt = "Select an option"
    )
    
    # Short-circuit to default choice (first option) in non-interactive mode
    if ($NonInteractive) {
        Write-ColorOutput "[NON-INTERACTIVE] Auto-selecting first option: $($Options[0])" $Cyan
        Write-PhaseLog "Non-interactive mode: auto-selected option 1: $($Options[0])"
        return 1
    }
    
    Write-Host ""
    Write-ColorOutput $Prompt $Cyan
    Write-Host ""
    
    for ($i = 0; $i -lt $Options.Count; $i++) {
        Write-ColorOutput "  $($i + 1). $($Options[$i])" $White
    }
    
    Write-Host ""
    
    $validChoice = $false
    $choice = 0
    
    while (-not $validChoice) {
        $userInput = Read-Host "Enter your choice (1-$($Options.Count))"
        if ([int]::TryParse($userInput, [ref]$choice)) {
            if ($choice -ge 1 -and $choice -le $Options.Count) {
                $validChoice = $true
            }
            else {
                Write-ColorOutput "Invalid choice. Please enter a number between 1 and $($Options.Count)." $Yellow
            }
        }
        else {
            Write-ColorOutput "Invalid input. Please enter a number between 1 and $($Options.Count)." $Yellow
        }
    }
    
    Write-PhaseLog "User selected option $choice : $($Options[$choice - 1])"
    return $choice
}

function Test-DataValidation {
    param(
        [string]$DataDirectory
    )
    
    try {
        if (-not (Test-Path $DataDirectory)) {
            return @{
                Success = $false
                Message = "Data directory not found: $DataDirectory"
                RowCount = 0
                SymbolCount = 0
            }
        }
        
        $csvFiles = Get-ChildItem -Path $DataDirectory -Filter "*_processed.csv" -Recurse -ErrorAction SilentlyContinue
        $symbolCount = $csvFiles.Count
        $totalRows = 0
        
        foreach ($file in $csvFiles) {
            try {
                # Use streaming line count instead of loading entire file into memory
                # Read in chunks to avoid loading entire file
                $lineCount = 0
                $reader = [System.IO.StreamReader]::new($file.FullName)
                try {
                    while ($null -ne $reader.ReadLine()) {
                        $lineCount++
                    }
                }
                finally {
                    $reader.Close()
                    $reader.Dispose()
                }
                
                # Subtract header (first line)
                $rowCount = $lineCount - 1
                if ($rowCount -gt 0) {
                    $totalRows += $rowCount
                }
            }
            catch {
                Write-PhaseLog "Error reading file $($file.Name): $_" "WARNING"
            }
        }
        
        $minRows = 100
        $minSymbols = 5
        
        $isValid = $symbolCount -ge $minSymbols -and $totalRows -ge ($minRows * $minSymbols)
        
        $message = if ($isValid) {
            "Data validation passed: Found $symbolCount symbols with $totalRows total rows"
        }
        else {
            "Data validation failed: Found only $symbolCount symbols with $totalRows total rows (minimum: $minSymbols symbols, $($minRows * $minSymbols) rows)"
        }
        
        return @{
            Success = $isValid
            Message = $message
            RowCount = $totalRows
            SymbolCount = $symbolCount
        }
    }
    catch {
        Write-PhaseLog "Error during data validation: $_" "ERROR"
        return @{
            Success = $false
            Message = "Error validating data: $_"
            RowCount = 0
            SymbolCount = 0
        }
    }
}

function Test-ChatbotHealth {
    param(
        [string]$ChatbotUrl,
        [int]$TimeoutSeconds = 30
    )
    
    $results = @{
        HealthCheck = $false
        SampleQuery = $false
        ResponseTime = 0
        Message = ""
    }
    
    try {
        # Test health endpoint
        Write-PhaseLog "Testing chatbot health endpoint: $ChatbotUrl/health"
        $healthStartTime = Get-Date
        $healthResponse = Invoke-WebRequest -Uri "$ChatbotUrl/health" -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        $healthEndTime = Get-Date
        $healthResponseTime = ($healthEndTime - $healthStartTime).TotalMilliseconds
        
        if ($healthResponse.StatusCode -eq 200) {
            $results.HealthCheck = $true
            Write-PhaseLog "Chatbot health endpoint OK (Response time: $([math]::Round($healthResponseTime, 2))ms)"
        }
        
        # Test sample query endpoint if available
        try {
            Write-PhaseLog "Testing chatbot sample query endpoint: $ChatbotUrl/chat"
            $queryStartTime = Get-Date
            $queryBody = @{
                message = "Hello, test query"
            } | ConvertTo-Json
            
            $queryResponse = Invoke-WebRequest -Uri "$ChatbotUrl/chat" -Method POST -Body $queryBody -ContentType "application/json" -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
            $queryEndTime = Get-Date
            $queryResponseTime = ($queryEndTime - $queryStartTime).TotalMilliseconds
            
            if ($queryResponse.StatusCode -eq 200) {
                $results.SampleQuery = $true
                $results.ResponseTime = [math]::Round($queryResponseTime, 2)
                Write-PhaseLog "Chatbot sample query OK (Response time: $([math]::Round($queryResponseTime, 2))ms)"
            }
        }
        catch {
            Write-PhaseLog "Chatbot sample query test failed (endpoint may not be available): $_" "WARNING"
            $results.Message = "Health check OK, but sample query test failed: $_"
        }
        
        if ($results.HealthCheck -and $results.SampleQuery) {
            $results.Message = "Chatbot health: OK, Sample query: OK, Response time: $($results.ResponseTime)ms"
        }
        elseif ($results.HealthCheck) {
            $results.Message = "Chatbot health: OK, Sample query: Not available"
        }
        else {
            $results.Message = "Chatbot health check failed"
        }
    }
    catch {
        Write-PhaseLog "Chatbot health check error: $_" "ERROR"
        $results.Message = "Chatbot health check failed: $_"
    }
    
    return $results
}

# Initialize logging
$LogDir = Join-Path $script:ScriptDir "automation_logs"
$Null = New-Item -ItemType Directory -Path $LogDir -Force -ErrorAction SilentlyContinue
# Include process ID in log filename to prevent conflicts when multiple instances run simultaneously
$LogFile = Join-Path $LogDir "master_automation_$(Get-Date -Format 'yyyyMMdd_HHmmss')_$PID.log"
$StateFile = Join-Path $script:ScriptDir "automation_state.json"

# Initialize log file
function Initialize-LogFile {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    try {
        Add-Content -Path $LogFile -Value "========================================" -ErrorAction SilentlyContinue
        Add-Content -Path $LogFile -Value "WealthArena Master Automation Log" -ErrorAction SilentlyContinue
        Add-Content -Path $LogFile -Value "Started: $timestamp" -ErrorAction SilentlyContinue
        Add-Content -Path $LogFile -Value "Process ID: $PID" -ErrorAction SilentlyContinue
        Add-Content -Path $LogFile -Value "========================================" -ErrorAction SilentlyContinue
        Add-Content -Path $LogFile -Value "" -ErrorAction SilentlyContinue
    }
    catch {
        Write-Warning "Could not initialize log file: $_"
    }
}

function Write-PhaseLog {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Retry logic for file locking issues
    $maxRetries = 3
    $retryDelay = 0.1
    
    for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
        try {
            # Use ErrorAction SilentlyContinue to gracefully handle any remaining locking issues
            Add-Content -Path $LogFile -Value $logEntry -ErrorAction SilentlyContinue
            break
        }
        catch {
            if ($attempt -lt $maxRetries) {
                Start-Sleep -Seconds $retryDelay
                $retryDelay *= 2  # Exponential backoff
            }
            else {
                # On final failure, write to console only
                Write-Warning "Could not write to log file: $_"
            }
        }
    }
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    # Ensure color is a valid ConsoleColor string
    $validColors = @("Black", "DarkBlue", "DarkGreen", "DarkCyan", "DarkRed", "DarkMagenta", "DarkYellow", "Gray", "DarkGray", "Blue", "Green", "Cyan", "Red", "Magenta", "Yellow", "White")
    $safeColor = if ($Color -and $validColors -contains $Color) { $Color } else { "White" }
    # Safely write message - ensure it's treated as a literal string object
    $messageObj = [string]$Message
    Write-Host -Object $messageObj -ForegroundColor $safeColor
    Write-PhaseLog $Message
}

function Write-PhaseHeader {
    param(
        [string]$PhaseName,
        [string]$Description
    )
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "PHASE $($script:AutomationState.CurrentPhase): $PhaseName" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "$Description" $White
    Write-Host ""
}

function Write-SafeFile {
    param(
        [string]$FilePath,
        [string]$Content,
        [int]$MaxRetries = 5
    )
    
    $tempFile = "$FilePath.tmp"
    $retryCount = 0
    $writeSuccess = $false
    
    while ($retryCount -lt $MaxRetries -and -not $writeSuccess) {
        try {
            # Write to temporary file first (atomic operation)
            Set-Content -Path $tempFile -Value $Content -Force -ErrorAction Stop
            # Replace original file atomically
            Move-Item -Path $tempFile -Destination $FilePath -Force -ErrorAction Stop
            $writeSuccess = $true
            return $true
        }
        catch {
            $retryCount++
            if ($retryCount -lt $MaxRetries) {
                Write-PhaseLog "File write attempt $retryCount failed, retrying: $_" "WARNING"
                Start-Sleep -Milliseconds 200
                # Clean up temp file if it exists
                if (Test-Path $tempFile) {
                    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
                }
            }
            else {
                Write-PhaseLog "Failed to write file after $MaxRetries attempts: $_" "ERROR"
                # Clean up temp file
                if (Test-Path $tempFile) {
                    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
                }
                throw "Could not write to file $FilePath after $MaxRetries attempts: $_"
            }
        }
    }
    
    return $writeSuccess
}

function Normalize-Config {
    param([hashtable]$RawConfig)
    
    # Create canonical config structure with PascalCase top-level keys
    $normalized = @{}
    
    # Normalize Azure section
    $azureSection = $null
    if ($RawConfig.Azure) { $azureSection = $RawConfig.Azure }
    elseif ($RawConfig.azure) { $azureSection = $RawConfig.azure }
    
    if ($azureSection) {
        $normalized.Azure = @{}
        if ($azureSection.ResourceGroup) { $normalized.Azure.ResourceGroup = $azureSection.ResourceGroup }
        elseif ($azureSection.resource_group) { $normalized.Azure.ResourceGroup = $azureSection.resource_group }
        
        if ($azureSection.Location) { $normalized.Azure.Location = $azureSection.Location }
        elseif ($azureSection.location) { $normalized.Azure.Location = $azureSection.location }
        
        if ($azureSection.Suffix) { $normalized.Azure.Suffix = $azureSection.Suffix }
        elseif ($azureSection.suffix) { $normalized.Azure.Suffix = $azureSection.suffix }
        
        if ($azureSection.SubscriptionId) { $normalized.Azure.SubscriptionId = $azureSection.SubscriptionId }
        elseif ($azureSection.subscription_id) { $normalized.Azure.SubscriptionId = $azureSection.subscription_id }
        
        if ($azureSection.SqlServer) { $normalized.Azure.SqlServer = $azureSection.SqlServer }
        elseif ($azureSection.sql_server) { $normalized.Azure.SqlServer = $azureSection.sql_server }
        
        if ($azureSection.StorageAccount) { $normalized.Azure.StorageAccount = $azureSection.StorageAccount }
        elseif ($azureSection.storage_account) { $normalized.Azure.StorageAccount = $azureSection.storage_account }
        
        if ($azureSection.KeyVault) { $normalized.Azure.KeyVault = $azureSection.KeyVault }
        elseif ($azureSection.key_vault) { $normalized.Azure.KeyVault = $azureSection.key_vault }
    }
    
    # Normalize Deployment section
    $deploymentSection = $null
    if ($RawConfig.Deployment) { $deploymentSection = $RawConfig.Deployment }
    elseif ($RawConfig.deployment) { $deploymentSection = $RawConfig.deployment }
    
    if ($deploymentSection) {
        $normalized.Deployment = @{}
        if ($deploymentSection.BackendAppName) { $normalized.Deployment.BackendAppName = $deploymentSection.BackendAppName }
        elseif ($deploymentSection.backend_app_name) { $normalized.Deployment.BackendAppName = $deploymentSection.backend_app_name }
        
        if ($deploymentSection.ChatbotAppName) { $normalized.Deployment.ChatbotAppName = $deploymentSection.ChatbotAppName }
        elseif ($deploymentSection.chatbot_app_name) { $normalized.Deployment.ChatbotAppName = $deploymentSection.chatbot_app_name }
        
        if ($deploymentSection.RLServiceAppName) { $normalized.Deployment.RLServiceAppName = $deploymentSection.RLServiceAppName }
        elseif ($deploymentSection.rl_service_app_name) { $normalized.Deployment.RLServiceAppName = $deploymentSection.rl_service_app_name }
        
        if ($deploymentSection.SqlServer) { $normalized.Deployment.SqlServer = $deploymentSection.SqlServer }
        elseif ($deploymentSection.sql_server) { $normalized.Deployment.SqlServer = $deploymentSection.sql_server }
        
        if ($deploymentSection.StorageAccount) { $normalized.Deployment.StorageAccount = $deploymentSection.StorageAccount }
        elseif ($deploymentSection.storage_account) { $normalized.Deployment.StorageAccount = $deploymentSection.storage_account }
    }
    
    # Normalize Database section
    $databaseSection = $null
    if ($RawConfig.Database) { $databaseSection = $RawConfig.Database }
    elseif ($RawConfig.database) { $databaseSection = $RawConfig.database }
    
    if ($databaseSection) {
        $normalized.Database = @{}
        if ($databaseSection.AdminPassword) { $normalized.Database.AdminPassword = $databaseSection.AdminPassword }
        elseif ($databaseSection.admin_password) { $normalized.Database.AdminPassword = $databaseSection.admin_password }
    }
    
    # Normalize other sections
    $phaseControl = $null
    if ($RawConfig.PhaseControl) { $phaseControl = $RawConfig.PhaseControl }
    elseif ($RawConfig.phase_control) { $phaseControl = $RawConfig.phase_control }
    if ($phaseControl) { $normalized.PhaseControl = $phaseControl }
    
    $dataPipeline = $null
    if ($RawConfig.DataPipeline) { $dataPipeline = $RawConfig.DataPipeline }
    elseif ($RawConfig.data_pipeline) { $dataPipeline = $RawConfig.data_pipeline }
    if ($dataPipeline) { $normalized.DataPipeline = $dataPipeline }
    
    $rlTraining = $null
    if ($RawConfig.RLTraining) { $rlTraining = $RawConfig.RLTraining }
    elseif ($RawConfig.rl_training) { $rlTraining = $RawConfig.rl_training }
    if ($rlTraining) { $normalized.RLTraining = $rlTraining }
    
    $testing = $null
    if ($RawConfig.Testing) { $testing = $RawConfig.Testing }
    elseif ($RawConfig.testing) { $testing = $RawConfig.testing }
    if ($testing) { $normalized.Testing = $testing }
    
    $apkBuild = $null
    if ($RawConfig.APKBuild) { $apkBuild = $RawConfig.APKBuild }
    elseif ($RawConfig.apk_build) { $apkBuild = $RawConfig.apk_build }
    if ($apkBuild) { $normalized.APKBuild = $apkBuild }
    
    $logging = $null
    if ($RawConfig.Logging) { $logging = $RawConfig.Logging }
    elseif ($RawConfig.logging) { $logging = $RawConfig.logging }
    if ($logging) { $normalized.Logging = $logging }
    
    return $normalized
}

function Validate-Config {
    param([hashtable]$Config)
    
    $errors = @()
    
    # Validate required Azure keys
    if (-not $Config.Azure) {
        $errors += "Missing required section: Azure"
    }
    else {
        if (-not $Config.Azure.ResourceGroup -or [string]::IsNullOrWhiteSpace($Config.Azure.ResourceGroup)) {
            $errors += "Missing required key: azure.resource_group"
        }
    }
    
    # Validate required Deployment keys
    if (-not $Config.Deployment) {
        $errors += "Missing required section: Deployment"
    }
    else {
        if (-not $Config.Deployment.BackendAppName -or [string]::IsNullOrWhiteSpace($Config.Deployment.BackendAppName)) {
            $errors += "Missing required key: deployment.backend_app_name"
        }
        if (-not $Config.Deployment.ChatbotAppName -or [string]::IsNullOrWhiteSpace($Config.Deployment.ChatbotAppName)) {
            $errors += "Missing required key: deployment.chatbot_app_name"
        }
        if (-not $Config.Deployment.RLServiceAppName -or [string]::IsNullOrWhiteSpace($Config.Deployment.RLServiceAppName)) {
            $errors += "Missing required key: deployment.rl_service_app_name"
        }
    }
    
    if ($errors.Count -gt 0) {
        return $errors
    }
    
    return $null
}

function Load-Configuration {
    Write-ColorOutput "Loading configuration from $ConfigFile..." $Blue
    Write-PhaseLog "Loading configuration file: $ConfigFile"
    
    if (-not (Test-Path $ConfigFile)) {
        $errorMsg = "ERROR: Configuration file '{0}' not found." -f $ConfigFile
        Write-ColorOutput $errorMsg $Red
        Write-PhaseLog "Config file not found" "ERROR"
        $exampleFile = "automation_config.example.yaml"
        if (Test-Path $exampleFile) {
            Write-ColorOutput "Please copy from example: Copy-Item $exampleFile $ConfigFile" $Yellow
        }
        throw "Configuration file not found: $ConfigFile"
    }
    
    try {
        # Check if file is empty or only whitespace
        $fileContent = Get-Content $ConfigFile -Raw
        if ([string]::IsNullOrWhiteSpace($fileContent)) {
            throw "Configuration file is empty: $ConfigFile"
        }
        
        # Parse YAML using powershell-yaml (required, no fallback)
        if (-not $script:YamlLoaded) {
            throw "powershell-yaml module is required but not loaded"
        }
        
        $rawConfig = Get-Content $ConfigFile -Raw | ConvertFrom-Yaml -Ordered
        
        if ($null -eq $rawConfig) {
            throw "Configuration file parsed as null. Check YAML syntax."
        }
        
        # Normalize config to canonical structure
        $script:Config = Normalize-Config -RawConfig $rawConfig
        
        # Ensure required sections exist with defaults
        if (-not $script:Config.Azure) {
            $script:Config.Azure = @{}
        }
        if (-not $script:Config.Database) {
            $script:Config.Database = @{}
        }
        if (-not $script:Config.PhaseControl) { $script:Config.PhaseControl = @{} }
        if (-not $script:Config.DataPipeline) { $script:Config.DataPipeline = @{} }
        if (-not $script:Config.RLTraining) { $script:Config.RLTraining = @{} }
        if (-not $script:Config.Deployment) { $script:Config.Deployment = @{} }
        if (-not $script:Config.Testing) { $script:Config.Testing = @{} }
        if (-not $script:Config.APKBuild) { $script:Config.APKBuild = @{} }
        if (-not $script:Config.Logging) { 
            $script:Config.Logging = @{
                LogLevel = "INFO"
                LogDirectory = "automation_logs"
            }
        }
        
        # Override with command-line parameters
        if ($ResourceGroup) { $script:Config.Azure.ResourceGroup = $ResourceGroup }
        if ($Location) { $script:Config.Azure.Location = $Location }
        if ($Suffix) { $script:Config.Azure.Suffix = $Suffix }
        
        # Validate required keys
        $validationErrors = Validate-Config -Config $script:Config
        if ($validationErrors) {
            Write-ColorOutput "Configuration validation failed:" $Red
            foreach ($err in $validationErrors) {
                Write-ColorOutput "  - $err" $Red
            }
            throw "Configuration validation failed. Missing required keys."
        }
        
        # Log effective config
        Write-PhaseLog "Effective config loaded: Azure.ResourceGroup=$($script:Config.Azure.ResourceGroup), Deployment.BackendAppName=$($script:Config.Deployment.BackendAppName), Deployment.ChatbotAppName=$($script:Config.Deployment.ChatbotAppName), Deployment.RLServiceAppName=$($script:Config.Deployment.RLServiceAppName)"
        Write-ColorOutput "Configuration loaded and validated successfully." $Green
    }
    catch {
        Write-ColorOutput "Error loading configuration: $_" $Red
        Write-PhaseLog "Error loading config: $_" "ERROR"
        throw
    }
}

function Save-AutomationState {
    $script:AutomationState.SaveTime = Get-Date
    try {
        $script:AutomationState | ConvertTo-Json -Depth 10 | Set-Content -Path $StateFile -Force
        Write-PhaseLog "Automation state saved"
    }
    catch {
        Write-PhaseLog "Error saving state: $_" "ERROR"
    }
}

function Load-AutomationState {
    if (Test-Path $StateFile) {
        try {
            $script:AutomationState = Get-Content $StateFile -Raw | ConvertFrom-Json
            Write-ColorOutput "Loaded previous automation state." $Blue
            Write-ColorOutput "Last completed phase: $($script:AutomationState.CurrentPhase)" $Blue
            return $true
        }
        catch {
            Write-ColorOutput "Error loading state file, starting fresh." $Yellow
            return $false
        }
    }
    return $false
}

function Test-PhaseCompleted {
    param([int]$PhaseNumber)
    return $script:AutomationState.CompletedPhases -contains $PhaseNumber
}

function Invoke-WithRetry {
    param(
        [scriptblock]$ScriptBlock,
        [int]$MaxRetries = 3,
        [int]$RetryDelay = 5,
        [string]$ErrorMessage = "Operation failed"
    )
    
    $attempt = 0
    while ($attempt -lt $MaxRetries) {
        try {
            $attempt++
            Write-PhaseLog "Attempt $attempt of $MaxRetries"
            & $ScriptBlock
            return $true
        }
        catch {
            if ($attempt -lt $MaxRetries) {
                Write-ColorOutput "$ErrorMessage (attempt $attempt/$MaxRetries). Retrying in $RetryDelay seconds..." $Yellow
                Write-PhaseLog "Attempt failed, retrying: $_" "WARNING"
                Start-Sleep -Seconds $RetryDelay
            }
            else {
                Write-ColorOutput "$ErrorMessage after $MaxRetries attempts" $Red
                Write-PhaseLog "All attempts failed: $_" "ERROR"
                return $false
            }
        }
    }
    return $false
}

function Find-PythonCommand {
    # Try different Python commands
    $pythonCommands = @("python", "python3", "py -3", "py")
    foreach ($cmd in $pythonCommands) {
        try {
            $ErrorActionPreference = "Continue"
            $versionOutput = Invoke-Expression "$cmd --version 2>&1" -ErrorAction SilentlyContinue
            if ($LASTEXITCODE -eq 0 -and $versionOutput -and $versionOutput -notmatch "error|not found") {
                return $cmd
            }
        }
        catch {
            # Continue to next command
            continue
        }
    }
    return $null
}

function Test-ODBCDriver18 {
    param(
        [string]$PythonCommand
    )
    
    try {
        # Check if pyodbc can detect ODBC Driver 18
        $checkScript = "import pyodbc; drivers = pyodbc.drivers(); driver18 = [d for d in drivers if 'ODBC Driver 18' in d]; print('FOUND' if driver18 else 'NOT_FOUND')"
        
        # Split python command if it contains arguments (e.g., "py -3")
        if ($PythonCommand -match " ") {
            $pyCmdParts = $PythonCommand -split " ", 2
            $pyExe = $pyCmdParts[0]
            $pyArgs = $pyCmdParts[1]
            $allArgs = @($pyArgs, "-c", $checkScript)
        }
        else {
            $pyExe = $PythonCommand
            $allArgs = @("-c", $checkScript)
        }
        
        $result = & $pyExe $allArgs 2>&1 | Select-Object -Last 1
        
        if ($result -eq "FOUND") {
            return $true
        }
        
        return $false
    }
    catch {
        Write-PhaseLog "Error checking ODBC Driver 18: $_" "WARNING"
        return $false
    }
}

function Resolve-ServiceUrls {
    param(
        [string]$ResourceGroup,
        [hashtable]$DeploymentConfig
    )
    
    $urls = @{}
    
    try {
        # Check if deployment mode is Container Apps (from config or by detecting container apps)
        $deploymentMode = $DeploymentConfig.Mode
        if (-not $deploymentMode) {
            # Try to detect by checking for container apps in resource group
            $containerApps = az containerapp list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
            if ($containerApps -and -not $containerApps.StartsWith("az:") -and -not $containerApps.StartsWith("ERROR")) {
                $deploymentMode = "ContainerApps"
                Write-PhaseLog "Detected Container Apps deployment mode"
            }
        }
        
        # Resolve backend URL - handle both camelCase and snake_case keys
        $backendAppName = $DeploymentConfig.BackendAppName
        if (-not $backendAppName) {
            $backendAppName = $DeploymentConfig.backend_app_name
        }
        
        if ($backendAppName) {
            try {
                # If deploying Container Apps, query Container App FQDN
                if ($deploymentMode -eq "ContainerApps") {
                    $backendFqdn = az containerapp show --name $backendAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
                    if ($backendFqdn -and -not $backendFqdn.StartsWith("az:") -and -not $backendFqdn.StartsWith("ERROR")) {
                        $urls.Backend = "https://$backendFqdn"
                        Write-PhaseLog "Resolved backend Container App URL: $($urls.Backend)"
                    }
                    else {
                        # Fallback to App Service format if Container App not found
                        $backendHost = az webapp show --name $backendAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                        if ($backendHost -and -not $backendHost.StartsWith("az:")) {
                            $urls.Backend = "https://$backendHost"
                            Write-PhaseLog "Resolved backend App Service URL: $($urls.Backend)"
                        }
                        else {
                            $urls.Backend = "https://$backendAppName.azurewebsites.net"
                            Write-PhaseLog "Using fallback backend URL: $($urls.Backend)" "WARNING"
                        }
                    }
                }
                else {
                    # Deploying as App Service
                    $backendHost = az webapp show --name $backendAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                    if ($backendHost -and -not $backendHost.StartsWith("az:")) {
                        $urls.Backend = "https://$backendHost"
                        Write-PhaseLog "Resolved backend URL: $($urls.Backend)"
                    }
                    else {
                        # Fallback to building from config
                        $urls.Backend = "https://$backendAppName.azurewebsites.net"
                        Write-PhaseLog "Using fallback backend URL: $($urls.Backend)" "WARNING"
                    }
                }
            }
            catch {
                # Fallback to building from config
                $urls.Backend = "https://$backendAppName.azurewebsites.net"
                Write-PhaseLog "Failed to resolve backend URL, using fallback: $($urls.Backend)" "WARNING"
            }
        }
        
        # Resolve chatbot URL - handle both camelCase and snake_case keys
        $chatbotAppName = $DeploymentConfig.ChatbotAppName
        if (-not $chatbotAppName) {
            $chatbotAppName = $DeploymentConfig.chatbot_app_name
        }
        
        if ($chatbotAppName) {
            try {
                # If deploying Container Apps, query Container App FQDN
                if ($deploymentMode -eq "ContainerApps") {
                    $chatbotFqdn = az containerapp show --name $chatbotAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
                    if ($chatbotFqdn -and -not $chatbotFqdn.StartsWith("az:") -and -not $chatbotFqdn.StartsWith("ERROR")) {
                        $urls.Chatbot = "https://$chatbotFqdn"
                        Write-PhaseLog "Resolved chatbot Container App URL: $($urls.Chatbot)"
                    }
                    else {
                        # Fallback to App Service format if Container App not found
                        $chatbotHost = az webapp show --name $chatbotAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                        if ($chatbotHost -and -not $chatbotHost.StartsWith("az:")) {
                            $urls.Chatbot = "https://$chatbotHost"
                            Write-PhaseLog "Resolved chatbot App Service URL: $($urls.Chatbot)"
                        }
                        else {
                            $urls.Chatbot = "https://$chatbotAppName.azurewebsites.net"
                            Write-PhaseLog "Using fallback chatbot URL: $($urls.Chatbot)" "WARNING"
                        }
                    }
                }
                else {
                    # Deploying as App Service
                    $chatbotHost = az webapp show --name $chatbotAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                    if ($chatbotHost -and -not $chatbotHost.StartsWith("az:")) {
                        $urls.Chatbot = "https://$chatbotHost"
                        Write-PhaseLog "Resolved chatbot URL: $($urls.Chatbot)"
                    }
                    else {
                        $urls.Chatbot = "https://$chatbotAppName.azurewebsites.net"
                        Write-PhaseLog "Using fallback chatbot URL: $($urls.Chatbot)" "WARNING"
                    }
                }
            }
            catch {
                $urls.Chatbot = "https://$chatbotAppName.azurewebsites.net"
                Write-PhaseLog "Failed to resolve chatbot URL, using fallback: $($urls.Chatbot)" "WARNING"
            }
        }
        
        # Resolve RL service URL - handle both camelCase and snake_case keys
        $rlServiceAppName = $DeploymentConfig.RLServiceAppName
        if (-not $rlServiceAppName) {
            $rlServiceAppName = $DeploymentConfig.rl_service_app_name
        }
        
        if ($rlServiceAppName) {
            try {
                # If deploying Container Apps, query Container App FQDN
                if ($deploymentMode -eq "ContainerApps") {
                    $rlFqdn = az containerapp show --name $rlServiceAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
                    if ($rlFqdn -and -not $rlFqdn.StartsWith("az:") -and -not $rlFqdn.StartsWith("ERROR")) {
                        $urls.RLService = "https://$rlFqdn"
                        Write-PhaseLog "Resolved RL service Container App URL: $($urls.RLService)"
                    }
                    else {
                        # Fallback to App Service format if Container App not found
                        $rlHost = az webapp show --name $rlServiceAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                        if ($rlHost -and -not $rlHost.StartsWith("az:")) {
                            $urls.RLService = "https://$rlHost"
                            Write-PhaseLog "Resolved RL service App Service URL: $($urls.RLService)"
                        }
                        else {
                            $urls.RLService = "https://$rlServiceAppName.azurewebsites.net"
                            Write-PhaseLog "Using fallback RL service URL: $($urls.RLService)" "WARNING"
                        }
                    }
                }
                else {
                    # Deploying as App Service
                    $rlHost = az webapp show --name $rlServiceAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                    if ($rlHost -and -not $rlHost.StartsWith("az:")) {
                        $urls.RLService = "https://$rlHost"
                        Write-PhaseLog "Resolved RL service URL: $($urls.RLService)"
                    }
                    else {
                        $urls.RLService = "https://$rlServiceAppName.azurewebsites.net"
                        Write-PhaseLog "Using fallback RL service URL: $($urls.RLService)" "WARNING"
                    }
                }
            }
            catch {
                $urls.RLService = "https://$rlServiceAppName.azurewebsites.net"
                Write-PhaseLog "Failed to resolve RL service URL, using fallback: $($urls.RLService)" "WARNING"
            }
        }
    }
    catch {
        Write-PhaseLog "Error resolving service URLs: $_" "WARNING"
    }
    
    return $urls
}

function Test-ServiceHealth {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )
    
    try {
        Write-PhaseLog "Testing health endpoint: $Url"
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        return $response.StatusCode -eq 200
    }
    catch {
        Write-PhaseLog "Health check failed: $_" "WARNING"
        return $false
    }
}

function Stop-BackgroundProcesses {
    Write-PhaseLog "Cleaning up background processes"
    # Only stop processes that were started by this script
    foreach ($processId in $script:TrackedProcesses) {
        try {
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-PhaseLog "Stopping tracked process: $processId ($($proc.ProcessName))"
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            Write-PhaseLog "Could not stop process ${processId}: $_" "WARNING"
        }
    }
    $script:TrackedProcesses = @()
    Start-Sleep -Seconds 2
}

function Stop-StuckTrainingProcesses {
    Write-ColorOutput "Checking for stuck Python/Ray training processes..." $Yellow
    Write-PhaseLog "Checking for stuck training processes"
    
    $killedCount = 0
    
    try {
        # Find Python processes that might be running training
        # Check all Python processes and try to get command line via WMI
        $pythonProcesses = Get-Process python* -ErrorAction SilentlyContinue
        
        foreach ($proc in $pythonProcesses) {
            try {
                # Try to get command line via WMI to check if it's running train.py
                $cmdLine = $null
                try {
                    $wmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
                    if ($wmiProcess) {
                        $cmdLine = $wmiProcess.CommandLine
                    }
                }
                catch {
                    # If WMI fails, skip command line check
                }
                
                # Check if this is a training-related process
                $isTrainingProcess = $false
                if ($cmdLine) {
                    # Only kill if command line contains training-related keywords
                    if ($cmdLine -like "*train.py*" -or $cmdLine -like "*ray*" -or $cmdLine -like "*WealthArena*" -or $cmdLine -like "*rl-training*") {
                        $isTrainingProcess = $true
                    }
                }
                elseif ($proc.Path -and $proc.Path -like "*WealthArena*") {
                    # Only kill if process path is in WealthArena directory
                    $isTrainingProcess = $true
                }
                
                # Only kill if we're certain it's a training process
                if ($isTrainingProcess) {
                    Write-ColorOutput "  Killing Python training process: $($proc.ProcessName) (PID: $($proc.Id))" $Yellow
                    Write-PhaseLog "Killing Python training process: $($proc.ProcessName) (PID: $($proc.Id))"
                    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                    $killedCount++
                }
            }
            catch {
                Write-PhaseLog "Could not kill process $($proc.Id): $_" "WARNING"
            }
        }
        
        # Also try to kill Ray-related processes (though they may not exist as separate processes)
        $rayProcesses = Get-Process | Where-Object {
            $_.ProcessName -like "*ray*"
        } -ErrorAction SilentlyContinue
        
        foreach ($proc in $rayProcesses) {
            try {
                Write-ColorOutput "  Killing Ray process: $($proc.ProcessName) (PID: $($proc.Id))" $Yellow
                Write-PhaseLog "Killing Ray process: $($proc.ProcessName) (PID: $($proc.Id))"
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                $killedCount++
            }
            catch {
                Write-PhaseLog "Could not kill Ray process $($proc.Id): $_" "WARNING"
            }
        }
        
        # Wait a moment for processes to fully terminate
        if ($killedCount -gt 0) {
            Start-Sleep -Seconds 3
            Write-ColorOutput "Killed $killedCount stuck process(es)." $Green
            Write-PhaseLog "Killed $killedCount stuck process(es)"
        }
        else {
            Write-ColorOutput "No stuck training processes found." $Green
            Write-PhaseLog "No stuck training processes found"
        }
    }
    catch {
        Write-ColorOutput "Warning: Error while killing processes: $_" $Yellow
        Write-PhaseLog "Error killing processes: $_" "WARNING"
    }
    
    return $killedCount
}

# Phase-level prerequisite validation functions
function Test-Phase1Prerequisites {
    Write-PhaseLog "Checking Phase 1 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check Node.js installation
    try {
        $nodeVersion = & node --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            $checks.Success = $false
            $checks.Message = "Node.js not found. Please install Node.js from https://nodejs.org/"
            return $checks
        }
    }
    catch {
        $checks.Success = $false
        $checks.Message = "Node.js not found. Please install Node.js from https://nodejs.org/"
        return $checks
    }
    
    # Check frontend directory exists
    $frontendDir = Join-Path $script:ScriptDir "frontend"
    if (-not (Test-Path $frontendDir)) {
        $checks.Success = $false
        $checks.Message = "Frontend directory not found: $frontendDir"
        return $checks
    }
    
    $checks.Message = "Phase 1 prerequisites met"
    return $checks
}

function Test-Phase2Prerequisites {
    Write-PhaseLog "Checking Phase 2 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check Python installation
    $pythonCmd = Find-PythonCommand
    if (-not $pythonCmd) {
        $checks.Success = $false
        $checks.Message = "Python not found. Please install Python 3.8+ from https://www.python.org/downloads/"
        return $checks
    }
    
    # Check data-pipeline directory exists
    $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
    if (-not (Test-Path $dataPipelineDir)) {
        $checks.Success = $false
        $checks.Message = "Data pipeline directory not found: $dataPipelineDir"
        return $checks
    }
    
    $checks.Message = "Phase 2 prerequisites met"
    return $checks
}

function Test-Phase3Prerequisites {
    Write-PhaseLog "Checking Phase 3 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check Python installation
    $pythonCmd = Find-PythonCommand
    if (-not $pythonCmd) {
        $checks.Success = $false
        $checks.Message = "Python not found. Please install Python 3.8+ from https://www.python.org/downloads/"
        return $checks
    }
    
    # Check ODBC Driver 18
    $odbcDriverCheck = Test-ODBCDriver18 -PythonCommand $pythonCmd
    if (-not $odbcDriverCheck) {
        $checks.Success = $false
        $checks.Message = "ODBC Driver 18 for SQL Server not found. Install with: winget install --id Microsoft.msodbcsql.18 -e or download from https://aka.ms/downloadmsodbcsql"
        return $checks
    }
    
    # Check SQL credentials and connection
    $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
    $sqlEnvPath = Join-Path $dataPipelineDir "sqlDB.env"
    if (-not (Test-Path $sqlEnvPath)) {
        $checks.Success = $false
        $checks.Message = "SQL credentials file not found: $sqlEnvPath. Please configure sqlDB.env"
        return $checks
    }
    
    # Test database connection
    try {
        # Ensure we're in the data-pipeline directory for the import
        $originalTestLocation = Get-Location
        Set-Location $dataPipelineDir
        try {
            $testScript = @'
import sys
import os
from pathlib import Path
# Use current working directory instead of __file__ (which doesn't exist with -c)
sys.path.insert(0, os.getcwd())
from dbConnection import get_conn
try:
    conn = get_conn()
    conn.close()
    print('CONNECTION_OK')
except Exception as e:
    print(f'CONNECTION_FAILED: {e}')
'@
            
            if ($pythonCmd -match " ") {
                $pyCmdParts = $pythonCmd -split " ", 2
                $pyExe = $pyCmdParts[0]
                $pyArgs = $pyCmdParts[1]
                $testOutput = & $pyExe $pyArgs -c $testScript 2>&1
            }
            else {
                $testOutput = & $pythonCmd -c $testScript 2>&1
            }
        }
        finally {
            Set-Location $originalTestLocation
        }
        
        if ($testOutput -match "CONNECTION_FAILED") {
            $checks.Success = $false
            $checks.Message = "Database connection failed. Please check SQL credentials and firewall rules in sqlDB.env"
            return $checks
        }
    }
    catch {
        $checks.Success = $false
        $checks.Message = "Could not test database connection: $_"
        return $checks
    }
    
    $checks.Message = "Phase 3 prerequisites met"
    return $checks
}

function Test-Phase4Prerequisites {
    Write-PhaseLog "Checking Phase 4 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check if Phase 3 completed successfully (processed data exists locally)
    $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
    $localProcessedDir = Join-Path (Join-Path $dataPipelineDir "data") "processed"
    
    if (-not (Test-Path $localProcessedDir)) {
        $checks.Success = $false
        $checks.Message = "Processed data directory not found: $localProcessedDir. Please run Phase 3 first."
        return $checks
    }
    
    $processedFiles = Get-ChildItem -Path $localProcessedDir -Filter "*_processed.csv" -ErrorAction SilentlyContinue
    if ($processedFiles.Count -eq 0) {
        $checks.Success = $false
        $checks.Message = "No processed data files found in $localProcessedDir. Please run Phase 3 first."
        return $checks
    }
    
    $checks.Message = "Phase 4 prerequisites met (found $($processedFiles.Count) processed files)"
    return $checks
}

function Test-Phase5Prerequisites {
    Write-PhaseLog "Checking Phase 5 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check Python installation
    $pythonCmd = Find-PythonCommand
    if (-not $pythonCmd) {
        $checks.Success = $false
        $checks.Message = "Python not found. Please install Python 3.8+ from https://www.python.org/downloads/"
        return $checks
    }
    
    # Check Ray installation
    try {
        if ($pythonCmd -match " ") {
            $pyCmdParts = $pythonCmd -split " ", 2
            $pyExe = $pyCmdParts[0]
            $pyArgs = $pyCmdParts[1]
            $rayCheckCmd = "$pyExe $pyArgs -c `"import ray; print(ray.__version__)`""
        }
        else {
            $rayCheckCmd = "$pythonCmd -c `"import ray; print(ray.__version__)`""
        }
        
        $rayVersion = Invoke-Expression $rayCheckCmd 2>&1
        if ($LASTEXITCODE -ne 0) {
            $checks.Success = $false
            $checks.Message = "Ray not installed. Please install Ray: pip install ray[rllib]"
            return $checks
        }
    }
    catch {
        $checks.Success = $false
        $checks.Message = "Ray not installed. Please install Ray: pip install ray[rllib]"
        return $checks
    }
    
    # Check exported data exists
    $rlTrainingDir = Join-Path $script:ScriptDir "rl-training"
    $rlDataDir = Join-Path (Join-Path $rlTrainingDir "data") "processed"
    if (-not (Test-Path $rlDataDir)) {
        $checks.Success = $false
        $checks.Message = "Exported data directory not found: $rlDataDir. Please run Phase 4 first."
        return $checks
    }
    
    # Check training config exists
    # Join-Path only accepts two arguments, so nest the calls
    $configDir = Join-Path $rlTrainingDir "config"
    $quickConfigPath = Join-Path $configDir "quick_training_config.yaml"
    $productionConfigPath = Join-Path $configDir "production_config.yaml"
    if (-not (Test-Path $quickConfigPath) -and -not (Test-Path $productionConfigPath)) {
        $checks.Success = $false
        $checks.Message = "Training config file not found. Please ensure config/quick_training_config.yaml or config/production_config.yaml exists."
        return $checks
    }
    
    $checks.Message = "Phase 5 prerequisites met"
    return $checks
}

function Test-Phase6Prerequisites {
    Write-PhaseLog "Checking Phase 6 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check Azure CLI login
    try {
        $account = az account show --output json 2>&1 | ConvertFrom-Json
        if (-not $account) {
            $checks.Success = $false
            $checks.Message = "Not logged in to Azure. Please run: az login"
            return $checks
        }
    }
    catch {
        $checks.Success = $false
        $checks.Message = "Azure CLI not available or not logged in. Please install Azure CLI and run: az login"
        return $checks
    }
    
    # Check resource group exists
    $rg = $script:Config.Azure.ResourceGroup
    if ($rg) {
        try {
            $rgExists = az group show --name $rg --output json 2>&1 | ConvertFrom-Json
            if (-not $rgExists) {
                $checks.Success = $false
                $checks.Message = "Resource group not found: $rg. Please create it first."
                return $checks
            }
        }
        catch {
            $checks.Success = $false
            $checks.Message = "Could not verify resource group: $rg"
            return $checks
        }
    }
    
    $checks.Message = "Phase 6 prerequisites met"
    return $checks
}

function Test-Phase7Prerequisites {
    Write-PhaseLog "Checking Phase 7 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check Azure resources exist
    $rg = $script:Config.Azure.ResourceGroup
    if (-not $rg) {
        $checks.Success = $false
        $checks.Message = "Resource group not configured. Please set Azure.ResourceGroup in config."
        return $checks
    }
    
    # Check deployment scripts exist
    $backendDir = Join-Path $script:ScriptDir "backend"
    $chatbotDir = Join-Path $script:ScriptDir "chatbot"
    $rlServiceDir = Join-Path $script:ScriptDir "rl-service"
    
    $missingDirs = @()
    if (-not (Test-Path $backendDir)) { $missingDirs += "backend" }
    if (-not (Test-Path $chatbotDir)) { $missingDirs += "chatbot" }
    if (-not (Test-Path $rlServiceDir)) { $missingDirs += "rl-service" }
    
    if ($missingDirs.Count -gt 0) {
        $checks.Success = $false
        $checks.Message = "Missing service directories: $($missingDirs -join ', ')"
        return $checks
    }
    
    $checks.Message = "Phase 7 prerequisites met"
    return $checks
}

function Test-Phase8Prerequisites {
    Write-PhaseLog "Checking Phase 8 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check trained models exist
    $rlTrainingDir = Join-Path $script:ScriptDir "rl-training"
    $checkpointsDir = Join-Path $rlTrainingDir "checkpoints"
    if (-not (Test-Path $checkpointsDir)) {
        $checks.Success = $false
        $checks.Message = "Checkpoints directory not found: $checkpointsDir. Please run Phase 5 (RL Training) first."
        return $checks
    }
    
    $checkpointFiles = Get-ChildItem -Path $checkpointsDir -Recurse -File -ErrorAction SilentlyContinue
    if ($checkpointFiles.Count -eq 0) {
        $checks.Success = $false
        $checks.Message = "No checkpoint files found. Please run Phase 5 (RL Training) first."
        return $checks
    }
    
    # Check Azure storage account accessible
    $rg = $script:Config.Azure.ResourceGroup
    if (-not $rg) {
        $checks.Success = $false
        $checks.Message = "Resource group not configured. Please set Azure.ResourceGroup in config."
        return $checks
    }
    
    $checks.Message = "Phase 8 prerequisites met (found $($checkpointFiles.Count) checkpoint files)"
    return $checks
}

function Test-Phase9Prerequisites {
    Write-PhaseLog "Checking Phase 9 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check frontend directory exists
    $frontendDir = Join-Path $script:ScriptDir "frontend"
    if (-not (Test-Path $frontendDir)) {
        $checks.Success = $false
        $checks.Message = "Frontend directory not found: $frontendDir"
        return $checks
    }
    
    # Check service URLs available - ensure at least one resolvable source for each service
    $backendUrl = $script:AutomationState.ServiceURLs.Backend
    $chatbotUrl = $script:AutomationState.ServiceURLs.Chatbot
    $rlServiceUrl = $script:AutomationState.ServiceURLs.RLService
    
    # Check Backend URL
    if (-not $backendUrl) {
        $backendAppName = $script:Config.Deployment.backend_app_name
        if (-not $backendAppName) { $backendAppName = $script:Config.Deployment.BackendAppName }
        if (-not $backendAppName) {
            # Try to infer from Deployment app names if available
            if ($script:Config.Deployment -and $script:Config.Deployment.app_names) {
                $backendAppName = $script:Config.Deployment.app_names | Where-Object { $_ -match "backend" } | Select-Object -First 1
            }
        }
        if (-not $backendAppName) {
            $checks.Success = $false
            $checks.Message = "Backend service URL not available. Please ensure backend is deployed (Phase 7) or provide backend_app_name in config."
            return $checks
        }
    }
    
    # Check Chatbot URL
    if (-not $chatbotUrl) {
        $chatbotAppName = $script:Config.Deployment.chatbot_app_name
        if (-not $chatbotAppName) { $chatbotAppName = $script:Config.Deployment.ChatbotAppName }
        if (-not $chatbotAppName) {
            # Try to infer from Deployment app names if available
            if ($script:Config.Deployment -and $script:Config.Deployment.app_names) {
                $chatbotAppName = $script:Config.Deployment.app_names | Where-Object { $_ -match "chatbot" } | Select-Object -First 1
            }
        }
        if (-not $chatbotAppName) {
            $checks.Success = $false
            $checks.Message = "Chatbot service URL not available. Please ensure chatbot is deployed (Phase 7) or provide chatbot_app_name in config."
            return $checks
        }
    }
    
    # Check RL Service URL
    if (-not $rlServiceUrl) {
        $rlServiceAppName = $script:Config.Deployment.rl_service_app_name
        if (-not $rlServiceAppName) { $rlServiceAppName = $script:Config.Deployment.RLServiceAppName }
        if (-not $rlServiceAppName) {
            # Try to infer from Deployment app names if available
            if ($script:Config.Deployment -and $script:Config.Deployment.app_names) {
                $rlServiceAppName = $script:Config.Deployment.app_names | Where-Object { $_ -match "rl|rl-service|rlservice" } | Select-Object -First 1
            }
        }
        if (-not $rlServiceAppName) {
            $checks.Success = $false
            $checks.Message = "RL service URL not available. Please ensure RL service is deployed (Phase 7) or provide rl_service_app_name in config."
            return $checks
        }
    }
    
    $checks.Message = "Phase 9 prerequisites met"
    return $checks
}

function Test-Phase10Prerequisites {
    Write-PhaseLog "Checking Phase 10 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check service URLs available
    $backendUrl = $script:AutomationState.ServiceURLs.Backend
    $chatbotUrl = $script:AutomationState.ServiceURLs.Chatbot
    $rlServiceUrl = $script:AutomationState.ServiceURLs.RLService
    
    if (-not $backendUrl) {
        $backendAppName = $script:Config.Deployment.backend_app_name
        if (-not $backendAppName) { $backendAppName = $script:Config.Deployment.BackendAppName }
        if (-not $backendAppName) {
            $checks.Success = $false
            $checks.Message = "Backend service URL not available. Please ensure backend is deployed (Phase 7)."
            return $checks
        }
    }
    
    if (-not $chatbotUrl) {
        $chatbotAppName = $script:Config.Deployment.chatbot_app_name
        if (-not $chatbotAppName) { $chatbotAppName = $script:Config.Deployment.ChatbotAppName }
        if (-not $chatbotAppName) {
            $checks.Success = $false
            $checks.Message = "Chatbot service URL not available. Please ensure chatbot is deployed (Phase 7)."
            return $checks
        }
    }
    
    if (-not $rlServiceUrl) {
        $rlServiceAppName = $script:Config.Deployment.rl_service_app_name
        if (-not $rlServiceAppName) { $rlServiceAppName = $script:Config.Deployment.RLServiceAppName }
        if (-not $rlServiceAppName) {
            $checks.Success = $false
            $checks.Message = "RL service URL not available. Please ensure RL service is deployed (Phase 7)."
            return $checks
        }
    }
    
    $checks.Message = "Phase 10 prerequisites met"
    return $checks
}

function Test-Phase11Prerequisites {
    Write-PhaseLog "Checking Phase 11 prerequisites"
    
    $checks = @{
        Success = $true
        Message = ""
    }
    
    # Check EAS CLI installed
    try {
        $easVersion = eas --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            $checks.Success = $false
            $checks.Message = "EAS CLI not installed. Run: npm install -g eas-cli"
            return $checks
        }
    }
    catch {
        $checks.Success = $false
        $checks.Message = "EAS CLI not installed. Run: npm install -g eas-cli"
        return $checks
    }
    
    # Check frontend directory exists
    $frontendDir = Join-Path $script:ScriptDir "frontend"
    if (-not (Test-Path $frontendDir)) {
        $checks.Success = $false
        $checks.Message = "Frontend directory not found: $frontendDir"
        return $checks
    }
    
    $checks.Message = "Phase 11 prerequisites met"
    return $checks
}

# PHASE 1: Frontend Local Testing
function Invoke-Phase1-FrontendTest {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would run frontend tests" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Frontend Local Testing" "Installing dependencies, starting frontend, and verifying health"
    
    try {
        $frontendDir = Join-Path $script:ScriptDir "frontend"
        if (-not (Test-Path $frontendDir)) {
            throw "Frontend directory not found: $frontendDir"
        }
        
        Set-Location $frontendDir
        Write-PhaseLog "Changed directory to: $frontendDir"
        
        # Check if node_modules exists
        if (-not (Test-Path "node_modules")) {
            Write-ColorOutput "Installing Node.js dependencies..." $Blue
            Write-PhaseLog "Running npm install"
            
            # Try npm install first - capture all output including errors
            $ErrorActionPreferenceSave = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            
            try {
                $npmOutput = @()
                $npmExitCode = 0
                
                # Try npm install - capture output
                try {
                    $npmOutput = npm install 2>&1 | Tee-Object -FilePath $LogFile -Append
                    $npmExitCode = $LASTEXITCODE
                }
                catch {
                    $npmOutput = @($_.Exception.Message)
                    $npmExitCode = 1
                }
                
                if ($npmExitCode -ne 0) {
                    $npmErrorMsg = "npm install failed with exit code {0}" -f $npmExitCode
                    Write-ColorOutput $npmErrorMsg $Yellow
                    Write-ColorOutput "Checking for dependency resolution issues..." $Blue
                    
                    # Check if it's an ERESOLVE error
                    $errorOutput = $npmOutput | Out-String
                    if ($null -eq $errorOutput) { $errorOutput = "" }
                    if ($errorOutput -match "ERESOLVE" -or $errorOutput -match "dependency conflicts" -or $errorOutput -match "peer dep missing" -or $errorOutput -match "peer dependency") {
                        Write-ColorOutput "Dependency resolution conflict detected. Trying with --legacy-peer-deps..." $Yellow
                        Write-PhaseLog "Attempting npm install with --legacy-peer-deps flag" "WARNING"
                        
                        # Try with --legacy-peer-deps
                        $npmOutput2 = @()
                        $npmExitCode2 = 0
                        try {
                            $npmOutput2 = npm install --legacy-peer-deps 2>&1 | Tee-Object -FilePath $LogFile -Append
                            $npmExitCode2 = $LASTEXITCODE
                        }
                        catch {
                            $npmOutput2 = @($_.Exception.Message)
                            $npmExitCode2 = 1
                        }
                        
                        if ($npmExitCode2 -ne 0) {
                            Write-ColorOutput "npm install with --legacy-peer-deps also failed" $Red
                            Write-ColorOutput "Error details are in the log file: $LogFile" $Red
                            Write-PhaseLog "npm install with --legacy-peer-deps failed with exit code $npmExitCode2" "ERROR"
                            throw "npm install failed. See log file for details: $LogFile"
                        }
                        else {
                            Write-ColorOutput "Dependencies installed successfully with --legacy-peer-deps" $Green
                            Write-PhaseLog "npm install succeeded with --legacy-peer-deps flag"
                        }
                    }
                    else {
                        Write-ColorOutput "Error details are in the log file: $LogFile" $Red
                        Write-PhaseLog "npm install failed with exit code $npmExitCode" "ERROR"
                        throw "npm install failed. See log file for details: $LogFile"
                    }
                }
                else {
                    Write-ColorOutput "Dependencies installed successfully." $Green
                    Write-PhaseLog "npm install completed successfully"
                }
            }
            finally {
                $ErrorActionPreference = $ErrorActionPreferenceSave
            }
        }
        else {
            Write-ColorOutput "Node modules already exist, skipping install." $Yellow
        }
        
        # Validate frontend start script against package.json
        $startScript = $FrontendStartScript
        $packageJsonPath = Join-Path $frontendDir "package.json"
        if (Test-Path $packageJsonPath) {
            try {
                $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
                $availableScripts = @()
                if ($packageJson.scripts) {
                    $availableScripts = $packageJson.scripts.PSObject.Properties.Name
                }
                
                if ($startScript -notin $availableScripts) {
                    Write-ColorOutput "⚠️  Script '$startScript' not found in package.json" $Yellow
                    Write-ColorOutput "Available scripts: $($availableScripts -join ', ')" $Yellow
                    
                    # Try to find a suitable default
                    if ($availableScripts -contains "start-expo-web") {
                        $startScript = "start-expo-web"
                        Write-ColorOutput "Using default: start-expo-web" $Yellow
                    } elseif ($availableScripts -contains "start-expo") {
                        $startScript = "start-expo"
                        Write-ColorOutput "Using default: start-expo" $Yellow
                    } elseif ($availableScripts -contains "start") {
                        $startScript = "start"
                        Write-ColorOutput "Using default: start" $Yellow
                    } else {
                        throw "No suitable start script found in package.json. Available scripts: $($availableScripts -join ', ')"
                    }
                    Write-PhaseLog "Frontend start script changed from '$FrontendStartScript' to '$startScript'" "WARNING"
                } else {
                    Write-ColorOutput "✅ Frontend start script '$startScript' validated in package.json" $Green
                    Write-PhaseLog "Frontend start script validated: $startScript"
                }
            } catch {
                Write-ColorOutput "⚠️  Could not read package.json: $_" $Yellow
                Write-PhaseLog "Could not validate start script against package.json: $_" "WARNING"
                # Fallback to basic validation
                if ($startScript -notin @("start-expo", "start-expo-web", "start")) {
                    Write-ColorOutput "Invalid FrontendStartScript: $startScript. Defaulting to start-expo-web." $Yellow
                    $startScript = "start-expo-web"
                }
            }
        } else {
            Write-ColorOutput "⚠️  package.json not found. Cannot validate start script." $Yellow
            Write-PhaseLog "package.json not found, using provided start script" "WARNING"
            if ($startScript -notin @("start-expo", "start-expo-web", "start")) {
                Write-ColorOutput "Invalid FrontendStartScript: $startScript. Defaulting to start-expo-web." $Yellow
                $startScript = "start-expo-web"
            }
        }
        
        $scriptType = if ($startScript -eq "start-expo") { "Expo native dev server" } else { "Expo web" }
        Write-ColorOutput "Starting frontend server in background ($scriptType)..." $Blue
        Write-PhaseLog "Starting npm run $startScript in background"
        $proc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run $startScript" -WindowStyle Minimized -PassThru
        if ($proc) {
            $script:TrackedProcesses += $proc.Id
            Write-PhaseLog "Tracked frontend process PID: $($proc.Id)"
        }
        
        # Wait for server to start
        Write-ColorOutput "Waiting for server to start..." $Blue
        Start-Sleep -Seconds 30
        
        # Verify server is running
        Write-ColorOutput "Verifying server health..." $Blue
        $portOpen = Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue
        if ($portOpen) {
            Write-ColorOutput "Frontend server is running on port 5001." $Green
            Write-PhaseLog "Frontend health check passed"
        }
        else {
            Write-ColorOutput "Warning: Could not verify server on port 5001." $Yellow
            Write-PhaseLog "Port 5001 not found in listening connections" "WARNING"
        }
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 1 failed: $_" $Red
        Write-PhaseLog "Phase 1 failed: $_" "ERROR"
        return $false
    }
}

# PHASE 2: Data Download
function Invoke-Phase2-DataDownload {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would download financial data" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Data Download" "Downloading market data for all asset classes"
    
    try {
        $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
        Set-Location $dataPipelineDir
        Write-PhaseLog "Changed directory to: $dataPipelineDir"
        
        # Check if raw data already exists
        $dataDir = Join-Path $dataPipelineDir "data"
        $rawDataDir = Join-Path $dataDir "raw"
        if (Test-Path $rawDataDir) {
            $rawFileCount = (Get-ChildItem $rawDataDir -Filter "*.csv" -Recurse -ErrorAction SilentlyContinue).Count
            if ($rawFileCount -gt 0) {
                Write-ColorOutput "Found existing raw data files: $rawFileCount files" $Green
                Write-PhaseLog "Found $rawFileCount existing raw data files"
                Write-ColorOutput "Data download scripts will skip existing files automatically." $Cyan
                Write-PhaseLog "Data download will use existing files where available"
            }
        }
        
        # Verify Python - try multiple methods
        Write-ColorOutput "Verifying Python environment..." $Blue
        $pythonCmd = Find-PythonCommand
        
        if (-not $pythonCmd) {
            Write-ColorOutput "Python not found in PATH" $Red
            Write-ColorOutput "Please install Python 3.8+ and add it to your PATH" $Yellow
            Write-ColorOutput "Download from: https://www.python.org/downloads/" $Yellow
            Write-PhaseLog "Python not found" "ERROR"
            throw "Python not found. Please install Python 3.8+ and add it to your PATH"
        }
        
        # Get Python version for display
        $pythonVersion = Invoke-Expression "$pythonCmd --version 2>&1" | Select-Object -First 1
        $pythonMsg = "Found Python: {0}" -f $pythonVersion
        Write-ColorOutput $pythonMsg $Green
        Write-PhaseLog "Using Python command: $pythonCmd, version: $pythonVersion"
        
        # Store python command for later use in this phase
        $script:PythonCommand = $pythonCmd
        
        # Build arguments from config using --flag=value format
        $scriptArgs = @()
        if ($script:Config.DataPipeline.StartDate) {
            $scriptArgs += "--start-date=$($script:Config.DataPipeline.StartDate)"
        }
        if ($script:Config.DataPipeline.EndDate) {
            $scriptArgs += "--end-date=$($script:Config.DataPipeline.EndDate)"
        }
        if ($script:Config.DataPipeline.AssetClasses) {
            $scriptArgs += "--asset-classes=$($script:Config.DataPipeline.AssetClasses -join ",")"
        }
        if ($script:Config.DataPipeline.BatchSize) {
            $scriptArgs += "--batch-size=$($script:Config.DataPipeline.BatchSize)"
        }
        
        # Check MVP mode and add flags if enabled
        $mvpMode = $script:Config.mvp_mode
        if ($null -eq $mvpMode) { $mvpMode = $script:Config.MvpMode }
        if ($mvpMode -and $mvpMode.enabled) {
            $scriptArgs += "--mvp-mode"
            if ($mvpMode.asx_stock_limit -and $mvpMode.asx_stock_limit -gt 0) {
                $scriptArgs += "--asx-limit=$($mvpMode.asx_stock_limit)"
                Write-PhaseLog "MVP mode enabled with ASX limit: $($mvpMode.asx_stock_limit)"
            }
            else {
                # Default ASX limit if not specified
                $scriptArgs += "--asx-limit=100"
                Write-PhaseLog "MVP mode enabled with default ASX limit: 100"
            }
        }
        
        # Execute data download
        Write-ColorOutput "Running data download script..." $Blue
        Write-PhaseLog "Executing run_all_downloaders.py with args: $($scriptArgs -join ' ')"
        
        # Use temporary files to avoid file locking issues
        $tempStdout = "$env:TEMP\python_stdout_$(Get-Random).txt"
        $tempStderr = "$env:TEMP\python_stderr_$(Get-Random).txt"
        
        # Split python command if it contains arguments (e.g., "py -3")
        if ($script:PythonCommand -match " ") {
            $pyCmdParts = $script:PythonCommand -split " ", 2
            $pyExe = $pyCmdParts[0]
            $pyArgs = $pyCmdParts[1]
            $allArgs = @($pyArgs, "run_all_downloaders.py") + $scriptArgs
        }
        else {
            $pyExe = $script:PythonCommand
            $allArgs = @("run_all_downloaders.py") + $scriptArgs
        }
        
        $proc = Start-Process -FilePath $pyExe -ArgumentList $allArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tempStdout -RedirectStandardError $tempStderr
        
        # Append output to log file after process completes
        if (Test-Path $tempStdout) {
            Get-Content $tempStdout -Encoding UTF8 | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
            Remove-Item $tempStdout -ErrorAction SilentlyContinue
        }
        if (Test-Path $tempStderr) {
            Get-Content $tempStderr -Encoding UTF8 | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
            Remove-Item $tempStderr -ErrorAction SilentlyContinue
        }
        
        if ($proc.ExitCode -ne 0) {
            throw "Data download failed with exit code $($proc.ExitCode)"
        }
        
        Write-ColorOutput "Data download completed successfully." $Green
        Write-PhaseLog "Data download completed"
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 2 failed: $_" $Red
        Write-PhaseLog "Phase 2 failed: $_" "ERROR"
        return $false
    }
}

# PHASE 3: Data Processing
function Invoke-Phase3-DataProcessing {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would process and store data" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Data Processing" "Processing downloaded data and storing in Azure SQL"
    
    try {
        # Check Phase 3 prerequisites
        Write-ColorOutput "[SEARCH] Checking Phase 3 prerequisites..." $Blue
        $prereqCheck = Test-Phase3Prerequisites
        if (-not $prereqCheck.Success) {
            Write-ColorOutput "[CAUTION] Prerequisites not met: $($prereqCheck.Message)" $Yellow
            $fixed = Test-PrerequisiteWithRetry -TestScript {
                $check = Test-Phase3Prerequisites
                return $check.Success
            } -FailureMessage $prereqCheck.Message -InstructionMessage "Please fix the issues above and press Y when ready to retry." -MaxRetries 3
            
            if (-not $fixed) {
                throw "Phase 3 prerequisites not met: $($prereqCheck.Message)"
            }
        }
        else {
            Write-ColorOutput "[CHECK] $($prereqCheck.Message)" $Green
        }
        
        $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
        Set-Location $dataPipelineDir
        
        # Verify Python
        $pythonCmd = Find-PythonCommand
        if (-not $pythonCmd) {
            $pythonCmd = $script:PythonCommand  # Try to reuse from Phase 2
            if (-not $pythonCmd) {
                throw "Python not found. Please install Python 3.8+ and add it to your PATH"
            }
        }
        else {
            $script:PythonCommand = $pythonCmd
        }
        
        # CRITICAL: Verify ODBC Driver 18 is installed before attempting database connection
        Write-ColorOutput "Verifying ODBC Driver 18 for SQL Server..." $Blue
        Write-PhaseLog "Checking ODBC Driver 18 installation"
        $odbcDriverCheck = Test-ODBCDriver18 -PythonCommand $pythonCmd
        if (-not $odbcDriverCheck) {
            Write-ColorOutput "" $Red
            Write-ColorOutput "CRITICAL ERROR: ODBC Driver 18 for SQL Server is not installed!" $Red
            Write-ColorOutput "" $Red
            Write-ColorOutput "Attempting automatic installation via winget..." $Yellow
            Write-PhaseLog "Attempting to install ODBC Driver 18 via winget"
            
            # Try to install using winget
            $installSuccess = $false
            try {
                $wingetCheck = Get-Command winget -ErrorAction SilentlyContinue
                if ($wingetCheck) {
                    Write-ColorOutput "Installing ODBC Driver 18 for SQL Server..." $Blue
                    Write-PhaseLog "Executing: winget install --id Microsoft.msodbcsql.18 -e"
                    
                    # Run winget install (may require elevation)
                    $installResult = & winget install --id Microsoft.msodbcsql.18 -e 2>&1
                    Write-PhaseLog "Winget install output: $($installResult -join ' ')"
                    
                    # Wait a moment for installation to register
                    Start-Sleep -Seconds 3
                    
                    # Verify installation succeeded
                    $odbcDriverCheck = Test-ODBCDriver18 -PythonCommand $pythonCmd
                    if ($odbcDriverCheck) {
                        $installSuccess = $true
                        Write-ColorOutput "ODBC Driver 18 installed successfully!" $Green
                        Write-PhaseLog "ODBC Driver 18 installed via winget"
                    }
                }
            }
            catch {
                Write-ColorOutput "Automatic installation failed or requires elevation" $Yellow
                Write-PhaseLog "Winget installation failed: $_" "WARNING"
            }
            
            if (-not $installSuccess) {
                Write-ColorOutput "" $Red
                Write-ColorOutput "MANUAL INSTALLATION REQUIRED:" $Yellow
                Write-ColorOutput "  1. Open PowerShell/Command Prompt as Administrator" $Yellow
                Write-ColorOutput "  2. Run: winget install --id Microsoft.msodbcsql.18 -e" $Yellow
                Write-ColorOutput "     OR download from: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server" $Yellow
                Write-ColorOutput "  3. Verify installation: Run 'odbcad32.exe' and check Drivers tab" $Yellow
                Write-ColorOutput "  4. Restart this terminal/PowerShell session after installation" $Yellow
                Write-ColorOutput "  5. After installation, press Y to continue" $Yellow
                Write-ColorOutput "" $Red
                Write-ColorOutput "See data-pipeline/SETUP_INSTRUCTIONS.md for detailed installation steps." $Yellow
                Write-PhaseLog "ODBC Driver 18 not found - requesting manual installation" "WARNING"
                
                # Wait for user confirmation instead of throwing
                $confirmed = Wait-ForUserConfirmation -Message "Have you installed ODBC Driver 18? Type Y after installation to retry, or N to abort"
                if (-not $confirmed) {
                    Write-ColorOutput "User declined. Phase 3 cannot proceed without ODBC Driver 18." $Red
                    Write-PhaseLog "User declined ODBC Driver 18 installation" "ERROR"
                    throw "ODBC Driver 18 for SQL Server is required. Please install it manually and re-run Phase 3."
                }
                
                # Re-run ODBC detection in a retry loop
                Write-ColorOutput "Re-checking ODBC Driver 18 installation..." $Blue
                $odbcRetrySuccess = Test-PrerequisiteWithRetry -TestScript {
                    return Test-ODBCDriver18 -PythonCommand $pythonCmd
                } -FailureMessage "ODBC Driver 18 still not detected" -InstructionMessage "Please ensure ODBC Driver 18 is installed and restart PowerShell if needed. Then press Y to retry." -MaxRetries 3
                
                if (-not $odbcRetrySuccess) {
                    Write-ColorOutput "ODBC Driver 18 installation verification failed after retries." $Red
                    Write-PhaseLog "ODBC Driver 18 verification failed after retries" "ERROR"
                    throw "ODBC Driver 18 for SQL Server verification failed. Please install it manually and restart the terminal."
                }
            }
        }
        Write-ColorOutput "ODBC Driver 18 for SQL Server is installed" $Green
        Write-PhaseLog "ODBC Driver 18 verified"
        
        # Verify sqlDB.env contains actual credentials (not placeholders)
        Write-ColorOutput "Verifying database configuration..." $Blue
        Write-PhaseLog "Checking sqlDB.env for placeholder values"
        $sqlEnvPath = Join-Path $dataPipelineDir "sqlDB.env"
        if (Test-Path $sqlEnvPath) {
            $sqlEnvContent = Get-Content $sqlEnvPath -Raw
            $placeholderPatterns = @(
                "your-sql-server",
                "your_database_name",
                "your_username",
                "your_password"
            )
            $foundPlaceholders = @()
            foreach ($pattern in $placeholderPatterns) {
                if ($sqlEnvContent -match $pattern) {
                    $foundPlaceholders += $pattern
                }
            }
            
            if ($foundPlaceholders.Count -gt 0) {
                Write-ColorOutput "" $Red
                Write-ColorOutput "CONFIGURATION ERROR: Placeholder credentials detected in sqlDB.env!" $Red
                Write-ColorOutput "" $Red
                Write-ColorOutput "The following placeholders were found: $($foundPlaceholders -join ', ')" $Yellow
                Write-ColorOutput "" $Red
                Write-ColorOutput "CONFIGURATION REQUIRED:" $Yellow
                Write-ColorOutput "" $Yellow
                Write-ColorOutput "Option 1: Use Interactive Helper Script (Recommended)" $Yellow
                Write-ColorOutput "  cd data-pipeline" $White
                Write-ColorOutput "  .\configure_sqldb.ps1" $White
                Write-ColorOutput "" $Yellow
                Write-ColorOutput "Option 2: Manual Configuration" $Yellow
                Write-ColorOutput "  1. Open data-pipeline/sqlDB.env in a text editor" $Yellow
                Write-ColorOutput "  2. Replace ALL placeholder values with your actual Azure SQL credentials:" $Yellow
                Write-ColorOutput "     - SQL_SERVER: Your Azure SQL server hostname (e.g., myserver.database.windows.net)" $Yellow
                Write-ColorOutput "     - SQL_DB: Your database name" $Yellow
                Write-ColorOutput "     - SQL_UID: Your SQL username" $Yellow
                Write-ColorOutput "     - SQL_PWD: Your SQL password" $Yellow
                Write-ColorOutput "" $Yellow
                Write-ColorOutput "  To obtain credentials:" $Yellow
                Write-ColorOutput "     Azure Portal → SQL Databases → Your Database → Connection Strings" $Yellow
                Write-ColorOutput "" $Red
                Write-ColorOutput "After configuration, re-run Phase 3." $Yellow
                Write-ColorOutput "See data-pipeline/SETUP_INSTRUCTIONS.md for detailed instructions." $Yellow
                Write-PhaseLog "Placeholder credentials detected in sqlDB.env" "ERROR"
                throw "sqlDB.env contains placeholder values. Please configure with actual Azure SQL credentials."
            }
        }
        else {
            Write-ColorOutput "WARNING: sqlDB.env not found. Creating from example..." $Yellow
            $sqlEnvExample = Join-Path $dataPipelineDir "sqlDB.env.example"
            if (Test-Path $sqlEnvExample) {
                Copy-Item $sqlEnvExample $sqlEnvPath
                Write-ColorOutput "   Created sqlDB.env from example. Please configure it before continuing." $Yellow
                Write-PhaseLog "Created sqlDB.env from example" "WARNING"
                throw "sqlDB.env was created from example. Please configure with actual Azure SQL credentials and re-run Phase 3."
            }
            else {
                throw "sqlDB.env not found and sqlDB.env.example not available. Cannot proceed."
            }
        }
        Write-ColorOutput "Database configuration verified" $Green
        Write-PhaseLog "sqlDB.env credentials validated"
        
        # Check if processed data already exists in database
        Write-ColorOutput "Checking for existing processed data in database..." $Blue
        Write-PhaseLog "Checking processed_prices table for existing data"
        
        $checkScript = @'
import sys
import os
from pathlib import Path
# Use current working directory instead of __file__ (which doesn't exist with -c)
sys.path.insert(0, os.getcwd())
from dbConnection import get_conn
try:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM dbo.processed_prices')
    row_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(DISTINCT symbol) FROM dbo.processed_prices')
    symbol_count = cursor.fetchone()[0]
    print(f'EXISTING_ROWS={row_count}')
    print(f'EXISTING_SYMBOLS={symbol_count}')
    conn.close()
except Exception as e:
    print(f'ERROR={str(e)}')
    sys.exit(1)
'@
        
        $existingRows = 0
        $existingSymbols = 0
        $hasExistingData = $false
        
        try {
            # Ensure we're in the data-pipeline directory for the import
            $originalCheckLocation = Get-Location
            Set-Location $dataPipelineDir
            try {
                if ($pythonCmd -match " ") {
                    $pyCmdParts = $pythonCmd -split " ", 2
                    $pyExe = $pyCmdParts[0]
                    $pyArgs = $pyCmdParts[1]
                    $checkOutput = & $pyExe $pyArgs -c $checkScript 2>&1
                }
                else {
                    $checkOutput = & $pythonCmd -c $checkScript 2>&1
                }
            }
            finally {
                Set-Location $originalCheckLocation
            }
            
            foreach ($line in $checkOutput) {
                if ($line -match "EXISTING_ROWS=(\d+)") {
                    $existingRows = [int]$matches[1]
                }
                if ($line -match "EXISTING_SYMBOLS=(\d+)") {
                    $existingSymbols = [int]$matches[1]
                }
            }
            
            if ($existingRows -gt 0 -and $existingSymbols -gt 0) {
                $hasExistingData = $true
                Write-ColorOutput "Found existing processed data: $existingRows rows across $existingSymbols symbols" $Green
                Write-PhaseLog "Found existing processed data: $existingRows rows, $existingSymbols symbols"
                Write-ColorOutput "Data processing script will skip already processed symbols." $Cyan
                Write-PhaseLog "Data processing will use existing data where available"
            }
            else {
                Write-ColorOutput "No existing processed data found. Will process all symbols." $Yellow
                Write-PhaseLog "No existing processed data found"
            }
        }
        catch {
            Write-ColorOutput "Could not check existing data (will proceed with processing): $_" $Yellow
            Write-PhaseLog "Could not check existing data: $_" "WARNING"
        }
        
        # Data validation prompt before processing
        Write-Host ""
        Write-ColorOutput "[SEARCH] Data Processing Summary:" $Cyan
        if ($hasExistingData) {
            Write-ColorOutput "  - Existing data: $existingRows rows across $existingSymbols symbols" $White
            Write-ColorOutput "  - Processing will skip already processed symbols (faster)" $White
        }
        else {
            Write-ColorOutput "  - No existing processed data found" $White
            Write-ColorOutput "  - Will process all symbols from downloaded data" $White
            Write-ColorOutput "  - Estimated time: 2-4 hours for 1800+ symbols" $Yellow
        }
        Write-ColorOutput "  - Only symbols with >= 100 rows will be pushed to Azure" $White
        Write-Host ""
        
        $confirmed = Wait-ForUserConfirmation -Message "Ready to process data? This will download and process historical data. Type Y to continue, or N to skip this phase (auto-continuing in 15 seconds)" -TimeoutSeconds 15
        if (-not $confirmed) {
            Write-ColorOutput "Phase 3 skipped by user." $Yellow
            Write-PhaseLog "Phase 3 skipped by user"
            return $false
        }
        
        Write-ColorOutput "[WAIT] Running data processing script..." $Blue
        Write-PhaseLog "Executing processAndStore.py"
        if ($hasExistingData) {
            Write-ColorOutput "Note: Processing will skip already processed symbols. This should be faster." $Cyan
            Write-PhaseLog "Processing will skip existing symbols"
        }
        else {
            Write-PhaseLog "Processing 1800+ symbols may take 2-4 hours. Monitor progress in the output above."
        }
        
        # Use temporary files to avoid file locking issues
        $tempStdout = "$env:TEMP\python_stdout_$(Get-Random).txt"
        $tempStderr = "$env:TEMP\python_stderr_$(Get-Random).txt"
        
        # Add arguments for new workflow: process locally, filter by row count, push to Azure
        # Use --flag=value format consistently
        $scriptArgs = @()
        $scriptArgs += "--min-rows=100"  # Only push symbols with >= 100 rows to Azure
        
        # Split python command if it contains arguments (e.g., "py -3")
        if ($pythonCmd -match " ") {
            $pyCmdParts = $pythonCmd -split " ", 2
            $pyExe = $pyCmdParts[0]
            $pyArgs = $pyCmdParts[1]
            $allArgs = @($pyArgs, "processAndStore.py") + $scriptArgs
        }
        else {
            $pyExe = $pythonCmd
            $allArgs = @("processAndStore.py") + $scriptArgs
        }
        
        Write-ColorOutput "Processing locally first, then pushing symbols with >= 100 rows to Azure..." $Cyan
        Write-PhaseLog "Processing with --min-rows 100 (only push symbols with >= 100 rows to Azure)"
        
        $proc = Start-Process -FilePath $pyExe -ArgumentList $allArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tempStdout -RedirectStandardError $tempStderr
        
        # Append output to log file after process completes
        if (Test-Path $tempStdout) {
            Get-Content $tempStdout -Encoding UTF8 | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
            Remove-Item $tempStdout -ErrorAction SilentlyContinue
        }
        if (Test-Path $tempStderr) {
            Get-Content $tempStderr -Encoding UTF8 | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
            Remove-Item $tempStderr -ErrorAction SilentlyContinue
        }
        
        if ($proc.ExitCode -ne 0) {
            # Display more detailed error information from logs
            $errorMsg = "Data processing failed with exit code $($proc.ExitCode)"
            if (Test-Path $tempStderr) {
                $stderrContent = Get-Content $tempStderr -Raw -ErrorAction SilentlyContinue
                if ($stderrContent) {
                    $errorMsg += "`nError output:`n$stderrContent"
                }
            }
            if (Test-Path $tempStdout) {
                # Read last 50 lines of output for context
                $lastLines = Get-Content $tempStdout -Tail 50 -ErrorAction SilentlyContinue
                if ($lastLines) {
                    $errorMsg += "`nLast 50 lines of output:`n$($lastLines -join "`n")"
                }
            }
            Write-PhaseLog "Phase 3 failed: $errorMsg" "ERROR"
            throw $errorMsg
        }
        
        Write-ColorOutput "Data processing completed successfully." $Green
        Write-PhaseLog "Data processing completed"
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 3 failed: $_" $Red
        Write-PhaseLog "Phase 3 failed: $_" "ERROR"
        return $false
    }
}

# PHASE 4: Data Export for RL Training
function Invoke-Phase4-DataExport {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would export data for RL training" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Data Export for RL Training" "Exporting processed data to RL training directory"
    
    try {
        # Check Phase 4 prerequisites
        Write-ColorOutput "[SEARCH] Checking Phase 4 prerequisites..." $Blue
        $prereqCheck = Test-Phase4Prerequisites
        if (-not $prereqCheck.Success) {
            Write-ColorOutput "[CAUTION] Prerequisites not met: $($prereqCheck.Message)" $Yellow
            $userChoice = Request-UserChoice -Options @(
                "Go back and run Phase 3 first",
                "Skip this phase"
            ) -Prompt "No processed data found. What would you like to do?"
            
            if ($userChoice -eq 1) {
                Write-ColorOutput "Returning to Phase 3..." $Blue
                Write-PhaseLog "User chose to go back to Phase 3"
                return $false
            }
            else {
                Write-ColorOutput "Skipping Phase 4..." $Yellow
                Write-PhaseLog "User chose to skip Phase 4"
                return $false
            }
        }
        else {
            Write-ColorOutput "[CHECK] $($prereqCheck.Message)" $Green
        }
        
        $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
        Set-Location $dataPipelineDir
        
        # Chain Join-Path calls to avoid parameter interpretation issues
        $rlTrainingDir = Join-Path $script:ScriptDir "rl-training"
        $rlDataDir = Join-Path $rlTrainingDir "data"
        $outputDir = Join-Path $rlDataDir "processed"
        
        # Check if local processed data exists (from Phase 3)
        $localProcessedDir = Join-Path (Join-Path $dataPipelineDir "data") "processed"
        $localProcessedCount = 0
        if (Test-Path $localProcessedDir) {
            $localProcessedCount = (Get-ChildItem $localProcessedDir -Filter "*_processed.csv" -ErrorAction SilentlyContinue).Count
            if ($localProcessedCount -gt 0) {
                Write-ColorOutput "Found local processed data: $localProcessedCount files" $Green
                Write-PhaseLog "Found $localProcessedCount local processed files"
            }
        }
        
        # Check if exported data already exists (for verification)
        Write-ColorOutput "Checking for existing exported data..." $Blue
        Write-PhaseLog "Checking for existing CSV files in $outputDir"
        
        $existingFileCount = 0
        if (Test-Path $outputDir) {
            $existingFileCount = (Get-ChildItem $outputDir -Filter "*_processed.csv" -Recurse -ErrorAction SilentlyContinue).Count
            if ($existingFileCount -gt 0) {
                Write-ColorOutput "Found existing exported data: $existingFileCount CSV files" $Green
                Write-PhaseLog "Found $existingFileCount existing exported CSV files"
                Write-ColorOutput "Export script will skip existing files (unless --overwrite is used)." $Cyan
                Write-PhaseLog "Export will use existing files where available"
            }
        }
        
        # Data validation before exporting
        Write-ColorOutput "[SEARCH] Validating data quality..." $Blue
        $dataValidation = Test-DataValidation -DataDirectory $localProcessedDir
        Write-ColorOutput "  $($dataValidation.Message)" $(if ($dataValidation.Success) { $Green } else { $Yellow })
        
        Write-Host ""
        Write-ColorOutput "[SEARCH] Data Export Summary:" $Cyan
        Write-ColorOutput "  - Processed files: $localProcessedCount" $White
        Write-ColorOutput "  - Symbols: $($dataValidation.SymbolCount)" $White
        Write-ColorOutput "  - Total rows: $($dataValidation.RowCount)" $White
        Write-ColorOutput "  - Output directory: $outputDir" $White
        Write-ColorOutput "  - Will select top 50 stocks with >= 100 rows" $White
        Write-Host ""
        
        $confirmed = Wait-ForUserConfirmation -Message "Data validation complete. Found $($dataValidation.SymbolCount) symbols with $($dataValidation.RowCount) total rows. Ready to export for training? Type Y to continue (auto-continuing in 15 seconds)" -TimeoutSeconds 15
        if (-not $confirmed) {
            Write-ColorOutput "Phase 4 skipped by user." $Yellow
            Write-PhaseLog "Phase 4 skipped by user"
            return $false
        }
        
        Write-ColorOutput "[WAIT] Exporting data to: $outputDir" $Blue
        
        # Ensure output directory structure exists
        Write-PhaseLog "Ensuring output directory exists: $outputDir"
        $outputParentDir = Split-Path $outputDir -Parent
        if (-not (Test-Path $outputParentDir)) {
            New-Item -ItemType Directory -Path $outputParentDir -Force -ErrorAction SilentlyContinue | Out-Null
            Write-PhaseLog "Created parent directory: $outputParentDir"
        }
        if (-not (Test-Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force -ErrorAction SilentlyContinue | Out-Null
            Write-PhaseLog "Created output directory: $outputDir"
        }
        
        Write-PhaseLog "Executing export_to_rl_training.py"
        
        # Verify Python
        $pythonCmd = Find-PythonCommand
        if (-not $pythonCmd) {
            $pythonCmd = $script:PythonCommand  # Try to reuse from previous phases
            if (-not $pythonCmd) {
                throw "Python not found. Please install Python 3.8+ and add it to your PATH"
            }
        }
        else {
            $script:PythonCommand = $pythonCmd
        }
        
        # Use temporary files to avoid file locking issues
        $tempStdout = "$env:TEMP\python_stdout_$(Get-Random).txt"
        $tempStderr = "$env:TEMP\python_stderr_$(Get-Random).txt"
        
        # Use relative path for script since we're already in data-pipeline directory
        $scriptName = "export_to_rl_training.py"
        
        # Use relative path for output directory to avoid spaces in path issues
        # Since we're in data-pipeline directory, use ../rl-training/data/processed
        $relativeOutputDir = "../rl-training/data/processed"
        
        # If existing files found, verify they're sufficient before exporting
        if ($existingFileCount -gt 0) {
            Write-ColorOutput "Verifying existing exported data..." $Blue
            Write-PhaseLog "Verifying existing CSV files"
            
            # Check if we have enough files (at least 5 per asset class)
            $minFilesNeeded = 5
            if ($existingFileCount -ge $minFilesNeeded) {
                Write-ColorOutput "Existing exported data looks sufficient ($existingFileCount files found)." $Green
                Write-PhaseLog "Existing exported data verified: $existingFileCount files"
                Write-ColorOutput "Export script will only export missing symbols. Skipping full re-export." $Cyan
                Write-PhaseLog "Export will skip existing files"
            }
            else {
                Write-ColorOutput "Found only $existingFileCount files. Will export remaining symbols." $Yellow
                Write-PhaseLog "Insufficient existing files, will export missing symbols"
            }
        }
        
        # Add arguments for new workflow: read from local files, select 50 stocks
        # Use --flag=value format consistently, quote paths with spaces
        $scriptArgs = @()
        # Quote output directory path if it contains spaces
        if ($relativeOutputDir -match '\s') {
            $scriptArgs += "--output-dir=`"$relativeOutputDir`""
        }
        else {
            $scriptArgs += "--output-dir=$relativeOutputDir"
        }
        $scriptArgs += "--local-only"  # Read from local processed files instead of Azure SQL
        $scriptArgs += "--min-rows=100"  # Only export symbols with >= 100 rows
        $scriptArgs += "--max-symbols=50"  # Select top 50 stocks for training
        
        # Split python command if it contains arguments (e.g., "py -3")
        if ($pythonCmd -match " ") {
            $pyCmdParts = $pythonCmd -split " ", 2
            $pyExe = $pyCmdParts[0]
            $pyArgs = $pyCmdParts[1]
            $allArgs = @($pyArgs, $scriptName) + $scriptArgs
        }
        else {
            $pyExe = $pythonCmd
            $allArgs = @($scriptName) + $scriptArgs
        }
        
        Write-ColorOutput "Exporting from local processed files, selecting top 50 stocks with >= 100 rows..." $Cyan
        Write-PhaseLog "Exporting with --local-only --min-rows 100 --max-symbols 50"
        
        Write-PhaseLog "Executing: $pyExe $($allArgs -join ' ') (from directory: $dataPipelineDir)"
        
        $proc = Start-Process -FilePath $pyExe -ArgumentList $allArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tempStdout -RedirectStandardError $tempStderr
        
        # Append output to log file after process completes
        if (Test-Path $tempStdout) {
            Get-Content $tempStdout -Encoding UTF8 | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
            Remove-Item $tempStdout -ErrorAction SilentlyContinue
        }
        if (Test-Path $tempStderr) {
            Get-Content $tempStderr -Encoding UTF8 | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
            Remove-Item $tempStderr -ErrorAction SilentlyContinue
        }
        
        if ($proc.ExitCode -ne 0) {
            # Display more detailed error information from logs
            $errorMsg = "Data export failed with exit code $($proc.ExitCode)"
            if (Test-Path $tempStderr) {
                $stderrContent = Get-Content $tempStderr -Raw -ErrorAction SilentlyContinue
                if ($stderrContent) {
                    $errorMsg += "`nError output:`n$stderrContent"
                }
            }
            Write-PhaseLog "Phase 4 failed: $errorMsg" "ERROR"
            throw $errorMsg
        }
        
        Write-ColorOutput "Data export completed successfully." $Green
        Write-PhaseLog "Data export completed"
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 4 failed: $_" $Red
        Write-PhaseLog "Phase 4 failed: $_" "ERROR"
        return $false
    }
}

# PHASE 5: RL Model Training
function Invoke-Phase5-RLTraining {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would train RL models" $Yellow
        return $true
    }
    
    Write-PhaseHeader "RL Model Training" "Training reinforcement learning models using Ray RLlib"
    
    try {
        # Check Phase 5 prerequisites
        Write-ColorOutput "[SEARCH] Checking Phase 5 prerequisites..." $Blue
        $prereqCheck = Test-Phase5Prerequisites
        if (-not $prereqCheck.Success) {
            Write-ColorOutput "[CAUTION] Prerequisites not met: $($prereqCheck.Message)" $Yellow
            $fixed = Test-PrerequisiteWithRetry -TestScript {
                $check = Test-Phase5Prerequisites
                return $check.Success
            } -FailureMessage $prereqCheck.Message -InstructionMessage "Please fix the issues above and press Y when ready to retry." -MaxRetries 3
            
            if (-not $fixed) {
                throw "Phase 5 prerequisites not met: $($prereqCheck.Message)"
            }
        }
        else {
            Write-ColorOutput "[CHECK] $($prereqCheck.Message)" $Green
        }
        
        # Always check for and kill stuck processes before starting training
        # This prevents issues from previous failed runs
        Write-ColorOutput "[SEARCH] Checking for stuck training processes..." $Blue
        $killedCount = Stop-StuckTrainingProcesses
        if ($killedCount -gt 0) {
            Write-ColorOutput "Cleaned up $killedCount stuck process(es). Starting fresh..." $Green
        }
        
        $rlTrainingDir = Join-Path $script:ScriptDir "rl-training"
        Set-Location $rlTrainingDir
        
        # Verify Python
        $pythonCmd = Find-PythonCommand
        if (-not $pythonCmd) {
            $pythonCmd = $script:PythonCommand  # Try to reuse from previous phases
            if (-not $pythonCmd) {
                throw "Python not found. Please install Python 3.8+ and add it to your PATH"
            }
        }
        else {
            $script:PythonCommand = $pythonCmd
        }
        
        # Verify Ray installation
        Write-ColorOutput "[SEARCH] Verifying Ray installation..." $Blue
        if ($pythonCmd -match " ") {
            $pyCmdParts = $pythonCmd -split " ", 2
            $pyExe = $pyCmdParts[0]
            $pyArgs = $pyCmdParts[1]
            $rayCheckCmd = "$pyExe $pyArgs -c `"import ray; print(ray.__version__)`""
        }
        else {
            $rayCheckCmd = "$pythonCmd -c `"import ray; print(ray.__version__)`""
        }
        
        $rayVersion = Invoke-Expression $rayCheckCmd 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Ray not installed"
        }
        Write-ColorOutput "Ray version: $rayVersion" $Green
        
        # Ensure required directories exist
        Write-ColorOutput "Setting up RL training directories..." $Blue
        Write-PhaseLog "Creating RL training directories"
        $requiredDirs = @("logs", "checkpoints", "results", "artifacts", "models")
        foreach ($dir in $requiredDirs) {
            $dirPath = Join-Path $rlTrainingDir $dir
            if (-not (Test-Path $dirPath)) {
                New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
                Write-PhaseLog "Created directory: $dirPath"
            }
        }
        
        # Training speed mode selection
        # Map TrainingSpeed to config file and metadata
        $trainingSpeedModes = @{
            "fastest" = @{ config = "fastest_training_config.yaml"; iterations = 50; duration = "10-15 minutes"; description = "Smoke test - verify setup works" }
            "faster" = @{ config = "faster_training_config.yaml"; iterations = 100; duration = "30-45 minutes"; description = "Quick validation" }
            "fast" = @{ config = "fast_training_config.yaml"; iterations = 200; duration = "1-1.5 hours"; description = "Fast development testing" }
            "quick" = @{ config = "quick_training_config.yaml"; iterations = 500; duration = "2.5-5 hours"; description = "Recommended for testing" }
            "slow" = @{ config = "slow_training_config.yaml"; iterations = 1000; duration = "8-12 hours"; description = "Comprehensive training" }
            "full" = @{ config = "production_config.yaml"; iterations = 2000; duration = "24+ hours"; description = "Production model training" }
        }
        
        # Handle backwards compatibility: if QuickTraining is set, map to appropriate speed
        if ($QuickTraining -and -not $PSBoundParameters.ContainsKey('TrainingSpeed')) {
            $TrainingSpeed = "quick"
            Write-ColorOutput "[NOTE] QuickTraining parameter is deprecated. Using TrainingSpeed='quick' instead." $Yellow
        }
        
        # Determine training speed (from parameter, config, or prompt)
        # Track if TrainingSpeed was explicitly set (either via parameter or prompt selection)
        $script:TrainingSpeedExplicitlySet = $false
        
        $selectedSpeed = $TrainingSpeed
        if ($PSBoundParameters.ContainsKey('TrainingSpeed')) {
            # Explicitly passed as parameter
            $script:TrainingSpeedExplicitlySet = $true
        }
        elseif ($script:Config -and $script:Config.RLTraining -and $script:Config.RLTraining.TrainingSpeed) {
            $selectedSpeed = $script:Config.RLTraining.TrainingSpeed
            Write-ColorOutput "[CHECK] Using training speed from config: $selectedSpeed" $Green
        }
        elseif (-not $NonInteractive) {
            # Prompt user if not set and not non-interactive
            Write-Host ""
            Write-ColorOutput "[SEARCH] Training speed not selected. Please choose:" $Cyan
            $trainingOptions = @(
                "Fastest (50 iterations, 10-15 min) - Smoke test to verify setup works",
                "Faster (100 iterations, 30-45 min) - Quick validation",
                "Fast (200 iterations, 1-1.5 hours) - Fast development testing",
                "Quick (500 iterations, 2.5-5 hours) - Recommended for testing",
                "Slow (1000 iterations, 8-12 hours) - Comprehensive training",
                "Full (2000 iterations, 24+ hours) - Production model training"
            )
            $selectedChoice = Request-UserChoice -Options $trainingOptions -Prompt "Select training speed mode"
            $speedKeys = @("fastest", "faster", "fast", "quick", "slow", "full")
            if ($selectedChoice -ge 1 -and $selectedChoice -le $speedKeys.Count) {
                $selectedSpeed = $speedKeys[$selectedChoice - 1]
                $script:TrainingSpeedExplicitlySet = $true  # User explicitly selected from prompt
            }
            else {
                $selectedSpeed = "quick"  # Default fallback
            }
        }
        
        if (-not $trainingSpeedModes.ContainsKey($selectedSpeed)) {
            Write-ColorOutput "[WARNING] Invalid training speed '$selectedSpeed'. Defaulting to 'quick'." $Yellow
            $selectedSpeed = "quick"
        }
        
        $speedInfo = $trainingSpeedModes[$selectedSpeed]
        
        # Check if checkpoints already exist before starting training
        $checkpointsDir = Join-Path $rlTrainingDir "checkpoints"
        if (Test-Path $checkpointsDir) {
            $checkpointFiles = Get-ChildItem -Path $checkpointsDir -Recurse -File -ErrorAction SilentlyContinue
            
            # Check for checkpoint_final directories (indicates complete training)
            $finalCheckpoints = Get-ChildItem -Path $checkpointsDir -Directory -Filter "*checkpoint_final*" -Recurse -ErrorAction SilentlyContinue
            
            if ($finalCheckpoints.Count -gt 0 -or $checkpointFiles.Count -gt 0) {
                Write-ColorOutput "[CHECK] Found existing checkpoints in $checkpointsDir" $Green
                Write-ColorOutput "  - Found $($checkpointFiles.Count) checkpoint file(s)" $White
                if ($finalCheckpoints.Count -gt 0) {
                    Write-ColorOutput "  - Found $($finalCheckpoints.Count) final checkpoint directory(ies)" $White
                    Write-ColorOutput "[NOTE] Training appears to have completed previously for '$selectedSpeed' mode." $Green
                    
                    if (-not $NonInteractive) {
                        $retrain = Request-UserChoice -Options @(
                            "Yes, retrain from scratch (existing checkpoints will be overwritten)",
                            "No, skip training and use existing checkpoints"
                        ) -Prompt "Do you want to retrain? (Existing checkpoints found)"
                        
                        if ($retrain -eq 2) {
                            Write-ColorOutput "[SKIP] Skipping training - using existing checkpoints" $Yellow
                            Write-PhaseLog "Skipped training - existing checkpoints found ($($checkpointFiles.Count) files, $($finalCheckpoints.Count) final directories)"
                            return $true
                        }
                    }
                    else {
                        Write-ColorOutput "[NOTE] Non-interactive mode: Proceeding with training (existing checkpoints may be overwritten)" $Yellow
                    }
                }
            }
        }
        
        # Display training configuration summary
        Write-Host ""
        Write-ColorOutput "[SEARCH] Training Configuration Summary:" $Cyan
        Write-ColorOutput "  - Speed Mode: $selectedSpeed" $White
        Write-ColorOutput "  - Description: $($speedInfo.description)" $White
        Write-ColorOutput "  - Iterations: $($speedInfo.iterations)" $White
        Write-ColorOutput "  - Expected duration: $($speedInfo.duration)" $White
        Write-ColorOutput "  - You can monitor progress in the logs directory" $White
        Write-ColorOutput "  - Training will run in the foreground" $White
        Write-Host ""
        
        $confirmed = Wait-ForUserConfirmation -Message "Ready to start RL training? This will take $($speedInfo.duration) based on your selected speed mode ($selectedSpeed). Type Y to continue (auto-continuing in 20 seconds)" -TimeoutSeconds 20
        if (-not $confirmed) {
            Write-ColorOutput "Phase 5 skipped by user." $Yellow
            Write-PhaseLog "Phase 5 skipped by user"
            return $false
        }
        
        # Execute training
        Write-ColorOutput "[WAIT] Starting RL training..." $Blue
        Write-ColorOutput "[WAIT] $($selectedSpeed.ToUpper()) MODE: This should take $($speedInfo.duration) ($($speedInfo.iterations) iterations)" $Cyan
        Write-PhaseLog "Starting $selectedSpeed training mode ($($speedInfo.iterations) iterations)"
        Write-PhaseLog "Executing train.py"
        
        # Diagnostic: Verify train.py imports correct module
        Write-PhaseLog "Verifying train.py imports correct module..."
        
        # Handle python command with arguments (e.g., "py -3") - define outside try block for later use
        if ($pythonCmd -match " ") {
            $pyCmdParts = $pythonCmd -split " ", 2
            $pyExe = $pyCmdParts[0]
            $pyArgs = $pyCmdParts[1]
        }
        else {
            $pyExe = $pythonCmd
            $pyArgs = ""
        }
        
        try {
            # Use train.py --help to verify it's the correct script (RL training, not data collection)
            # Execute train.py --help, redirecting stderr to null to ignore warnings
            # Capture only stdout for verification (stderr is ignored to avoid TensorFlow warnings)
            $helpOutput = ""
            
            if ($pyArgs) {
                Start-Process -FilePath $pyExe -ArgumentList @($pyArgs, "train.py", "--help") -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\train_help_stdout.txt" -RedirectStandardError "$env:TEMP\train_help_stderr.txt" -ErrorAction SilentlyContinue | Out-Null
            }
            else {
                Start-Process -FilePath $pyExe -ArgumentList @("train.py", "--help") -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\train_help_stdout.txt" -RedirectStandardError "$env:TEMP\train_help_stderr.txt" -ErrorAction SilentlyContinue | Out-Null
            }
            
            # Read stdout (ignore stderr warnings)
            if (Test-Path "$env:TEMP\train_help_stdout.txt") {
                $helpOutput = Get-Content "$env:TEMP\train_help_stdout.txt" -Encoding UTF8 -Raw
                Remove-Item "$env:TEMP\train_help_stdout.txt" -ErrorAction SilentlyContinue
            }
            # Clean up stderr file (we ignore its contents to avoid TensorFlow warnings)
            if (Test-Path "$env:TEMP\train_help_stderr.txt") {
                Remove-Item "$env:TEMP\train_help_stderr.txt" -ErrorAction SilentlyContinue
            }
            
            Write-PhaseLog "Help command verification output captured"
            
            # Simple verification using string contains checks
            $hasRLTrainingArgs = $false
            $hasDataCollectionArgs = $false
            
            if ($helpOutput) {
                if ($helpOutput -match '--config') {
                    $hasRLTrainingArgs = $true
                }
                if ($helpOutput -match '--all-assets') {
                    $hasDataCollectionArgs = $true
                }
            }
            
            # Check results
            if ($hasRLTrainingArgs -and -not $hasDataCollectionArgs) {
                Write-PhaseLog "train.py correctly shows RL training arguments (--config found, --all-assets not found)"
            }
            elseif ($hasDataCollectionArgs) {
                Write-ColorOutput "WARNING: train.py appears to be the data collection script (--all-assets found)!" $Yellow
                Write-PhaseLog "WARNING: train.py may be importing the wrong module" "WARNING"
                Write-ColorOutput "This may indicate train.py is importing from the wrong module." $Yellow
                Write-ColorOutput "Continuing anyway - actual training execution will fail if there's a real problem." $Yellow
            }
            elseif (-not $hasRLTrainingArgs) {
                Write-ColorOutput "WARNING: Could not verify train.py help output (--config not found)!" $Yellow
                Write-PhaseLog "WARNING: Could not verify train.py arguments from help output" "WARNING"
                Write-ColorOutput "Continuing anyway - actual training execution will fail if there's a real problem." $Yellow
            }
        }
        catch {
            Write-ColorOutput "WARNING: Could not complete diagnostic check: $_" $Yellow
            Write-PhaseLog "WARNING: Diagnostic check failed: $_" "WARNING"
            Write-ColorOutput "Continuing anyway - actual training execution will fail if there's a real problem." $Yellow
        }
        
        # Log Python environment info
        Write-PhaseLog "Python environment info:"
        if ($pythonCmd -match " ") {
            $pythonVersion = & $pyExe $pyArgs --version 2>&1
        }
        else {
            $pythonVersion = & $pythonCmd --version 2>&1
        }
        Write-PhaseLog "  Python version: $pythonVersion"
        $pythonPath = $env:PYTHONPATH
        if ($pythonPath) {
            Write-PhaseLog "  PYTHONPATH: $pythonPath"
        }
        else {
            Write-PhaseLog "  PYTHONPATH: (not set)"
        }
        
        # Build arguments from config - use quick training by default unless explicitly set
        $scriptArgs = @()
        $configFile = $null
        
        # Use selected training speed config
        $configFileName = $speedInfo.config
        $configPath = Join-Path "config" $configFileName
        
        if (Test-Path $configPath) {
            $configFile = $configPath
            Write-ColorOutput "Using $($selectedSpeed.ToUpper()) training config ($($speedInfo.iterations) iterations, ~$($speedInfo.duration))" $Green
            Write-PhaseLog "Using $selectedSpeed training config: $configFile"
        }
        elseif ($selectedSpeed -eq "quick" -and (Test-Path "config/quick_training.yaml")) {
            # Fallback for old quick_training.yaml name
            $configFile = "config/quick_training.yaml"
            Write-ColorOutput "Using QUICK training config (500 iterations, ~2.5-5 hours)" $Green
            Write-PhaseLog "Using quick training config: $configFile"
        }
        else {
            Write-ColorOutput "$selectedSpeed training config not found ($configPath), falling back to production config" $Yellow
            Write-PhaseLog "$selectedSpeed training config not found, using production config" "WARNING"
            $configFile = "config/production_config.yaml"
        }
        
        # Use explicit config from automation config if specified
        # BUT: Only if TrainingSpeed was NOT explicitly set (respect user's speed choice)
        # Handle both config_file (YAML) and ConfigFile (PascalCase) property names
        $configFileFromConfig = $null
        $useConfigFileFromAutomationConfig = $false
        
        # Only use automation config file if TrainingSpeed was not explicitly set (parameter or prompt)
        if (-not $script:TrainingSpeedExplicitlySet -and $script:Config.RLTraining) {
            if ($script:Config.RLTraining.ConfigFile) {
                $configFileFromConfig = $script:Config.RLTraining.ConfigFile
                $useConfigFileFromAutomationConfig = $true
            }
            elseif ($script:Config.RLTraining.config_file) {
                $configFileFromConfig = $script:Config.RLTraining.config_file
                $useConfigFileFromAutomationConfig = $true
            }
        }
        
        if ($useConfigFileFromAutomationConfig -and $configFileFromConfig) {
            # Resolve relative path if needed
            if (-not [System.IO.Path]::IsPathRooted($configFileFromConfig)) {
                $resolvedConfigPath = Join-Path $rlTrainingDir $configFileFromConfig
            }
            else {
                $resolvedConfigPath = $configFileFromConfig
            }
            
            if (Test-Path $resolvedConfigPath) {
                $configFile = $resolvedConfigPath
                Write-PhaseLog "Using config from automation_config.yaml: $configFile"
                Write-ColorOutput "[NOTE] Using config from automation_config.yaml (TrainingSpeed not explicitly set)" $Yellow
            }
            else {
                Write-PhaseLog "Config file from automation_config.yaml not found: $resolvedConfigPath" "WARNING"
            }
        }
        elseif ($script:TrainingSpeedExplicitlySet) {
            Write-PhaseLog "TrainingSpeed explicitly set to '$selectedSpeed' - ignoring automation_config.yaml config file override"
        }
        
        # Fallback to production config if nothing else found
        if (-not $configFile) {
            if (Test-Path "config/production_config.yaml") {
                $configFile = "config/production_config.yaml"
                Write-ColorOutput "Using PRODUCTION training config (2000 iterations, ~24+ hours)" $Yellow
                Write-PhaseLog "Using production training config: $configFile"
            }
            else {
                throw "No training config file found. Please ensure config/quick_training_config.yaml or config/production_config.yaml exists."
            }
        }
        
        # Ensure config file path is relative to rl-training directory (since we're already in that directory)
        if ($configFile -and [System.IO.Path]::IsPathRooted($configFile)) {
            # Convert absolute path to relative path from rl-training directory
            $configFileRelative = $configFile.Replace($rlTrainingDir + "\", "").Replace($rlTrainingDir + "/", "").Replace("\", "/")
            if ($configFileRelative -ne $configFile) {
                $configFile = $configFileRelative
                Write-PhaseLog "Converted config file path to relative: $configFile"
            }
        }
        
        # Fix: Use --flag=value format instead of separate --flag and value arguments
        # This ensures PowerShell properly associates values with their flags
        # Quote the config file path if it contains spaces or special characters
        if ($configFile -match '\s') {
            $scriptArgs += "--config=`"$configFile`""
        }
        else {
            $scriptArgs += "--config=$configFile"
        }
        $experimentName = "wealtharena_$selectedSpeed"
        $scriptArgs += "--experiment=$experimentName"
        $scriptArgs += "--local"  # Always run in local mode for automation
        
        # Handle both PascalCase and lowercase_with_underscore property names
        # BUT: Only use automation config overrides if TrainingSpeed was NOT explicitly set (parameter or prompt)
        # When TrainingSpeed is set, let the selected config file control max_iterations and num_workers
        if (-not $script:TrainingSpeedExplicitlySet -and $script:Config.RLTraining) {
            $maxIter = if ($script:Config.RLTraining.MaxIterations) { $script:Config.RLTraining.MaxIterations } elseif ($script:Config.RLTraining.max_iterations) { $script:Config.RLTraining.max_iterations } else { $null }
            $targetReward = if ($script:Config.RLTraining.TargetReward) { $script:Config.RLTraining.TargetReward } elseif ($script:Config.RLTraining.target_reward) { $script:Config.RLTraining.target_reward } else { $null }
            $numWorkers = if ($script:Config.RLTraining.NumWorkers) { $script:Config.RLTraining.NumWorkers } elseif ($script:Config.RLTraining.num_workers) { $script:Config.RLTraining.num_workers } else { $null }
            
            if ($maxIter) {
                $scriptArgs += "--max-iterations=$maxIter"
                Write-PhaseLog "Using max_iterations from automation_config.yaml: $maxIter"
            }
            if ($targetReward) {
                $scriptArgs += "--target-reward=$targetReward"
                Write-PhaseLog "Using target_reward from automation_config.yaml: $targetReward"
            }
            if ($numWorkers) {
                $scriptArgs += "--num-workers=$numWorkers"
                Write-PhaseLog "Using num_workers from automation_config.yaml: $numWorkers"
            }
        }
        else {
            Write-PhaseLog "TrainingSpeed explicitly set to '$selectedSpeed' - using config file values for iterations/workers (not overriding)"
        }
        
        Write-PhaseLog "Executing train.py with args: $($scriptArgs -join ' ')"
        
        # Use temporary files to avoid file locking issues
        $tempStdout = "$env:TEMP\python_stdout_$(Get-Random).txt"
        $tempStderr = "$env:TEMP\python_stderr_$(Get-Random).txt"
        
        # Split python command if it contains arguments (e.g., "py -3")
        # Build allArgs as a properly formatted array - ensure each argument is a separate array element
        $allArgs = @()
        if ($pythonCmd -match " ") {
            $pyCmdParts = $pythonCmd -split " ", 2
            $pyExe = $pyCmdParts[0]
            $pyArgs = $pyCmdParts[1]
            if ($pyArgs) {
                $allArgs += $pyArgs
            }
        }
        else {
            $pyExe = $pythonCmd
        }
        $allArgs += "train.py"
        # Add each script argument as a separate array element
        foreach ($arg in $scriptArgs) {
            $allArgs += $arg
        }
        
        Write-PhaseLog "Start-Process arguments: $($allArgs -join ' ')"
        $proc = Start-Process -FilePath $pyExe -ArgumentList $allArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tempStdout -RedirectStandardError $tempStderr
        
        # Read and process output after process completes
        $stdoutContent = @()
        $stderrContent = @()
        
        if (Test-Path $tempStdout) {
            $stdoutContent = Get-Content $tempStdout -Encoding UTF8 -Raw
            Get-Content $tempStdout -Encoding UTF8 | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
            Remove-Item $tempStdout -ErrorAction SilentlyContinue
        }
        if (Test-Path $tempStderr) {
            $stderrContent = Get-Content $tempStderr -Encoding UTF8 -Raw
            Get-Content $tempStderr -Encoding UTF8 | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
            Remove-Item $tempStderr -ErrorAction SilentlyContinue
        }
        
        # Check exit code - this is the ONLY condition for failure
        if ($proc.ExitCode -ne 0) {
            # Extract actual error from stderr or stdout
            $errorLines = @()
            if ($stderrContent) {
                $stderrLines = $stderrContent -split "`n" | Where-Object { $_ -match "(?i)(error|failed|exception|traceback)" -and $_ -notmatch "(?i)(warning|deprecation)" }
                if ($stderrLines.Count -gt 0) {
                    $errorLines += $stderrLines
                }
            }
            if ($stdoutContent -and $errorLines.Count -eq 0) {
                $stdoutLines = $stdoutContent -split "`n" | Where-Object { $_ -match "(?i)(error|failed|exception)" }
                if ($stdoutLines.Count -gt 0) {
                    $errorLines += $stdoutLines
                }
            }
            
            # Build error message
            $errorMsg = "RL training failed with exit code $($proc.ExitCode)"
            if ($errorLines.Count -gt 0) {
                $errorMsg += "`nError details:`n" + ($errorLines -join "`n")
            } elseif ($stderrContent -match "(?i)(error|failed|exception|traceback)") {
                # Show last 10 lines of stderr if it contains errors
                $lastLines = ($stderrContent -split "`n" | Select-Object -Last 10) -join "`n"
                $errorMsg += "`nLast stderr lines:`n$lastLines"
            }
            
            throw $errorMsg
        }
        else {
            # Exit code is 0, but log any warnings from stderr
            if ($stderrContent) {
                $warnings = $stderrContent -split "`n" | Where-Object { $_ -match "(?i)warning" }
                if ($warnings.Count -gt 0) {
                    Write-PhaseLog "Training completed with $($warnings.Count) warning(s) (exit code 0 - success)" "WARNING"
                }
            }
        }
        
        # Verify checkpoints created
        $checkpointsDir = Join-Path $rlTrainingDir "checkpoints"
        if (Test-Path $checkpointsDir) {
            $checkpointCount = (Get-ChildItem $checkpointsDir -Recurse -File).Count
            Write-ColorOutput "Training completed. Created $checkpointCount checkpoint files." $Green
            Write-PhaseLog "Training completed with $checkpointCount checkpoints"
        }
        else {
            Write-ColorOutput "Warning: No checkpoints directory found." $Yellow
        }
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 5 failed: $_" $Red
        Write-PhaseLog "Phase 5 failed: $_" "ERROR"
        return $false
    }
}

# PHASE 6: Azure Resource Verification
function Invoke-Phase6-AzureVerification {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would verify Azure resources" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Azure Resource Verification" "Verifying and provisioning Azure infrastructure"
    
    try {
        # Verify Azure CLI
        Write-ColorOutput "Verifying Azure CLI connection..." $Blue
        $account = az account show --output json 2>&1 | ConvertFrom-Json
        if (-not $account) {
            throw "Not logged in to Azure. Please run 'az login'"
        }
        Write-ColorOutput "Connected to Azure as: $($account.user.name)" $Green
        Write-PhaseLog "Azure CLI verified, user: $($account.user.name)"
        
        # Check if resources exist
        $rg = $script:Config.Azure.ResourceGroup
        $location = $script:Config.Azure.Location
        if (-not $rg) {
            throw "Resource group not specified in configuration"
        }
        if (-not $location) {
            $location = "northcentralus"
        }
        
        Write-ColorOutput "Checking resource group: $rg" $Blue
        $rgExists = az group show --name $rg --output json 2>&1 | ConvertFrom-Json
        if (-not $rgExists) {
            Write-ColorOutput "Resource group does not exist. Creating..." $Yellow
            az group create --name $rg --location $location 2>&1 | Out-Null
            Write-ColorOutput "Resource group created." $Green
            Write-PhaseLog "Resource group created: $rg in $location"
        }
        else {
            Write-ColorOutput "Resource group exists." $Green
            Write-PhaseLog "Resource group exists: $rg"
        }
        
        # Check for missing key resources and call setup_master.ps1 if needed
        $missingResources = @()
        
        # Get suffix for suffix-based naming (prioritized over config values)
        # Try multiple property paths to handle different config formats
        $suffix = $null
        if ($script:Config.Azure) {
            $suffix = $script:Config.Azure.Suffix
            if ([string]::IsNullOrWhiteSpace($suffix)) {
                $suffix = $script:Config.Azure.suffix
            }
        }
        
        # Also check automation state for suffix (it may be stored there)
        if ([string]::IsNullOrWhiteSpace($suffix) -and $script:AutomationState -and $script:AutomationState["UniqueSuffix"]) {
            $suffix = $script:AutomationState["UniqueSuffix"]
            Write-PhaseLog "Using suffix from automation state: $suffix"
        }
        
        if (-not [string]::IsNullOrWhiteSpace($suffix)) {
            Write-PhaseLog "Using suffix-based naming. Suffix: '$suffix'"
            Write-ColorOutput "Using suffix-based naming. Suffix: $suffix" $Blue
        }
        else {
            Write-PhaseLog "Suffix not found in config or automation state. Will fallback to config values if available."
            Write-ColorOutput "Warning: Suffix not found. Storage account name will be read from config." $Yellow
        }
        
        # Check SQL Server
        Write-ColorOutput "Checking SQL Server..." $Blue
        # Prioritize suffix-based naming for consistency (sql-wealtharena-{suffix})
        if (-not [string]::IsNullOrWhiteSpace($suffix)) {
            $sqlServerName = "sql-wealtharena-$suffix"
            Write-PhaseLog "Computed SQL Server name from suffix: $sqlServerName"
        }
        else {
            # Fallback to config if suffix not available
            $sqlServerName = $script:Config.Deployment.sql_server
            if (-not $sqlServerName) { $sqlServerName = $script:Config.Deployment.SqlServer }
            if ($sqlServerName) {
                Write-PhaseLog "Using SQL Server name from config: $sqlServerName"
            }
        }
        if ($sqlServerName) {
            Write-PhaseLog "Checking SQL Server: $sqlServerName"
            # Use 'show' command instead of 'list' for better error handling
            $sqlCheckResult = az sql server show --name $sqlServerName --resource-group $rg --output json 2>&1
            if ($LASTEXITCODE -eq 0) {
                $sqlExists = $sqlCheckResult | ConvertFrom-Json
                if ($sqlExists) {
                    Write-ColorOutput "SQL Server exists: $sqlServerName" $Green
                    Write-PhaseLog "SQL Server exists: $sqlServerName"
                }
                else {
                    Write-ColorOutput "SQL Server not found: $sqlServerName" $Yellow
                    Write-PhaseLog "SQL Server not found: $sqlServerName"
                    $missingResources += "SQL Server"
                }
            }
            else {
                # Check if it's a "not found" error vs API failure
                if ($sqlCheckResult -match "not found|NotFound|ResourceNotFound") {
                    Write-ColorOutput "SQL Server not found: $sqlServerName" $Yellow
                    Write-PhaseLog "SQL Server not found: $sqlServerName"
                    $missingResources += "SQL Server"
                }
                else {
                    Write-ColorOutput "Error checking SQL Server: $sqlCheckResult" $Red
                    Write-PhaseLog "Error checking SQL Server: $sqlCheckResult" "ERROR"
                    throw "Failed to check SQL Server existence: $sqlCheckResult"
                }
            }
        }
        
        # Check Storage Account
        Write-ColorOutput "Checking Storage Account..." $Blue
        # Prioritize suffix-based naming for consistency (stwealtharena{suffix})
        if (-not [string]::IsNullOrWhiteSpace($suffix)) {
            $storageAccountName = "stwealtharena$suffix"
            Write-PhaseLog "Computed Storage Account name from suffix: $storageAccountName"
        }
        else {
            # Fallback to config if suffix not available
            $storageAccountName = $script:Config.Deployment.storage_account
            if (-not $storageAccountName) { $storageAccountName = $script:Config.Deployment.StorageAccount }
            if ($storageAccountName) {
                Write-PhaseLog "Using Storage Account name from config: $storageAccountName"
            }
        }
        if ($storageAccountName) {
            Write-PhaseLog "Checking Storage Account: $storageAccountName"
            # Use 'show' command instead of 'list' for better error handling
            $storageCheckResult = az storage account show --name $storageAccountName --resource-group $rg --output json 2>&1
            if ($LASTEXITCODE -eq 0) {
                $storageExists = $storageCheckResult | ConvertFrom-Json
                if ($storageExists) {
                    Write-ColorOutput "Storage Account exists: $storageAccountName" $Green
                    Write-PhaseLog "Storage Account exists: $storageAccountName"
                }
                else {
                    Write-ColorOutput "Storage Account not found: $storageAccountName" $Yellow
                    Write-PhaseLog "Storage Account not found: $storageAccountName"
                    $missingResources += "Storage Account"
                }
            }
            else {
                # Check if it's a "not found" error vs API failure
                if ($storageCheckResult -match "not found|NotFound|ResourceNotFound") {
                    Write-ColorOutput "Storage Account not found: $storageAccountName" $Yellow
                    Write-PhaseLog "Storage Account not found: $storageAccountName"
                    $missingResources += "Storage Account"
                }
                else {
                    Write-ColorOutput "Error checking Storage Account: $storageCheckResult" $Red
                    Write-PhaseLog "Error checking Storage Account: $storageCheckResult" "ERROR"
                    throw "Failed to check Storage Account existence: $storageCheckResult"
                }
            }
        }
        
        # If key resources are missing, call setup_master.ps1
        if ($missingResources.Count -gt 0) {
            Write-ColorOutput "Missing key resources detected: $($missingResources -join ', ')" $Yellow
            Write-ColorOutput "Calling setup_master.ps1 to provision missing resources..." $Blue
            Write-PhaseLog "Missing resources: $($missingResources -join ', ') - calling setup_master.ps1"
            
            # Join-Path only accepts 2 arguments, so nest the calls
            $infraDir = Join-Path $script:ScriptDir "infrastructure"
            $azureInfraDir = Join-Path $infraDir "azure_infrastructure"
            $setupScript = Join-Path $azureInfraDir "setup_master.ps1"
            if (Test-Path $setupScript) {
                # Generate or get suffix
                $suffix = $script:Config.Azure.Suffix
                if (-not $suffix) {
                    # Generate random suffix if not provided
                    $randomChars = -join ((48..57) + (97..122) | Get-Random -Count 8 | ForEach-Object {[char]$_})
                    $suffix = $randomChars
                    Write-ColorOutput "Generated unique suffix: $suffix" $Blue
                    Write-PhaseLog "Generated unique suffix: $suffix"
                    
                    # Update config and state
                    if (-not $script:Config.Azure) { $script:Config.Azure = @{} }
                    $script:Config.Azure.Suffix = $suffix
                    $script:AutomationState["UniqueSuffix"] = $suffix
                    Save-AutomationState
                }
                
                # Get SubscriptionId and AdminPassword from config
                $subscriptionId = $script:Config.Azure.SubscriptionId
                if ([string]::IsNullOrWhiteSpace($subscriptionId)) {
                    $subscriptionId = ""
                }
                
                # Get AdminPassword from config (check Database section first, then fallback)
                $adminPassword = $null
                if ($script:Config.Database -and $script:Config.Database.AdminPassword) {
                    $adminPassword = $script:Config.Database.AdminPassword
                }
                elseif ($script:Config.Database -and $script:Config.Database.admin_password) {
                    $adminPassword = $script:Config.Database.admin_password
                }
                
                # If password not in config, prompt user securely
                if ([string]::IsNullOrWhiteSpace($adminPassword)) {
                    Write-ColorOutput "AdminPassword not found in configuration. Please provide SQL Server admin password:" $Yellow
                    $adminPasswordSecure = Read-Host "Enter SQL Server admin password" -AsSecureString
                    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPasswordSecure)
                    $adminPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
                    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
                    
                    if ([string]::IsNullOrWhiteSpace($adminPassword)) {
                        throw "AdminPassword is required but was not provided. Please set Config.Database.AdminPassword or provide it when prompted."
                    }
                }
                
                # Call setup_master.ps1
                Write-ColorOutput "Executing setup_master.ps1..." $Blue
                Write-PhaseLog "Executing: $setupScript -ResourceGroupName $rg -Location $location -UniqueSuffix $suffix"
                
                try {
                    # Build argument list as array (handles paths with spaces correctly)
                    # Use absolute path to script to avoid argument parsing issues
                    $scriptArgs = @(
                        "-File",
                        $setupScript,
                        "-ResourceGroupName",
                        $rg,
                        "-Location",
                        $location,
                        "-UniqueSuffix",
                        $suffix
                    )
                    
                    # Add SubscriptionId if provided
                    if (-not [string]::IsNullOrWhiteSpace($subscriptionId)) {
                        $scriptArgs += "-SubscriptionId"
                        $scriptArgs += $subscriptionId
                    }
                    
                    # Add Environment if provided in Config.Azure
                    $environment = $script:Config.Azure.Environment
                    if (-not [string]::IsNullOrWhiteSpace($environment)) {
                        $scriptArgs += "-Environment"
                        $scriptArgs += $environment
                    }
                    
                    # Add AdminPassword (required)
                    $scriptArgs += "-AdminPassword"
                    $scriptArgs += $adminPassword
                    
                    # Create sanitized copy of scriptArgs for logging (replace AdminPassword value with placeholder)
                    $sanitizedArgs = @()
                    for ($i = 0; $i -lt $scriptArgs.Count; $i++) {
                        if ($i -gt 0 -and $scriptArgs[$i - 1] -eq "-AdminPassword") {
                            $sanitizedArgs += "***REDACTED***"
                        }
                        else {
                            $sanitizedArgs += $scriptArgs[$i]
                        }
                    }
                    
                    # Detect PowerShell executable (prefer powershell, fallback to pwsh)
                    $powershellExe = "powershell"
                    if (-not (Get-Command "powershell" -ErrorAction SilentlyContinue)) {
                        if (Get-Command "pwsh" -ErrorAction SilentlyContinue) {
                            $powershellExe = "pwsh"
                        }
                    }
                    
                    Write-PhaseLog "Command: $powershellExe $($sanitizedArgs -join ' ')"
                    
                    # Create temporary files for stdout/stderr capture
                    $tempStdout = "$env:TEMP\setup_master_stdout_$(Get-Random).txt"
                    $tempStderr = "$env:TEMP\setup_master_stderr_$(Get-Random).txt"
                    
                    # Execute with PowerShell, capturing stdout/stderr
                    $proc = Start-Process -FilePath $powershellExe -ArgumentList $scriptArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tempStdout -RedirectStandardError $tempStderr -WorkingDirectory $azureInfraDir
                    $exitCode = $proc.ExitCode
                    
                    # Append output to log file after process completes
                    if (Test-Path $tempStdout) {
                        $stdoutContent = Get-Content $tempStdout -Encoding UTF8 -Raw
                        if ($stdoutContent) {
                            Write-PhaseLog "=== setup_master.ps1 stdout ==="
                            Write-PhaseLog $stdoutContent
                            Add-Content -Path $script:LogFile -Value "=== setup_master.ps1 stdout ===" -Encoding UTF8
                            Add-Content -Path $script:LogFile -Value $stdoutContent -Encoding UTF8
                        }
                        Remove-Item $tempStdout -ErrorAction SilentlyContinue
                    }
                    if (Test-Path $tempStderr) {
                        $stderrContent = Get-Content $tempStderr -Encoding UTF8 -Raw
                        if ($stderrContent) {
                            Write-PhaseLog "=== setup_master.ps1 stderr ===" "WARNING"
                            Write-PhaseLog $stderrContent "WARNING"
                            Add-Content -Path $script:LogFile -Value "=== setup_master.ps1 stderr ===" -Encoding UTF8
                            Add-Content -Path $script:LogFile -Value $stderrContent -Encoding UTF8
                        }
                        Remove-Item $tempStderr -ErrorAction SilentlyContinue
                    }
                    
                    if ($exitCode -eq 0) {
                        Write-ColorOutput "Setup completed successfully." $Green
                        Write-PhaseLog "setup_master.ps1 completed successfully"
                        
                        # Recompute resource names based on suffix
                        $computedSqlServerName = "sql-wealtharena-$suffix"
                        $computedStorageAccountName = "stwealtharena$suffix"
                        
                        # Persist resource names and suffix to automation state
                        $script:AutomationState["ResourceGroup"] = $rg
                        $script:AutomationState["Location"] = $location
                        $script:AutomationState["UniqueSuffix"] = $suffix
                        $script:AutomationState["SQLServer"] = $computedSqlServerName
                        $script:AutomationState["StorageAccount"] = $computedStorageAccountName
                        
                        # Also update Config.Deployment to keep configuration consistent
                        if (-not $script:Config.Deployment) {
                            $script:Config.Deployment = @{}
                        }
                        $script:Config.Deployment["sql_server"] = $computedSqlServerName
                        $script:Config.Deployment["storage_account"] = $computedStorageAccountName
                        
                        Save-AutomationState
                    }
                    else {
                        Write-ColorOutput "Warning: setup_master.ps1 returned non-zero exit code: $exitCode" $Yellow
                        Write-PhaseLog "setup_master.ps1 returned exit code: $exitCode" "WARNING"
                        throw "setup_master.ps1 failed with exit code: $exitCode"
                    }
                }
                catch {
                    Write-ColorOutput "Error calling setup_master.ps1: $_" $Red
                    Write-PhaseLog "Error calling setup_master.ps1: $_" "ERROR"
                    throw
                }
            }
            else {
                Write-ColorOutput "Setup script not found: $setupScript" $Yellow
                Write-ColorOutput "Please provision missing resources manually or ensure setup_master.ps1 exists." $Yellow
                Write-PhaseLog "Setup script not found: $setupScript" "WARNING"
            }
        }
        
        # Check Web Apps
        Write-ColorOutput "Checking Web Apps..." $Blue
        $backendAppName = $script:Config.Deployment.backend_app_name
        if (-not $backendAppName) { $backendAppName = $script:Config.Deployment.BackendAppName }
        $chatbotAppName = $script:Config.Deployment.chatbot_app_name
        if (-not $chatbotAppName) { $chatbotAppName = $script:Config.Deployment.ChatbotAppName }
        $rlServiceAppName = $script:Config.Deployment.rl_service_app_name
        if (-not $rlServiceAppName) { $rlServiceAppName = $script:Config.Deployment.RLServiceAppName }
        
        $webApps = az webapp list --resource-group $rg --output json 2>&1 | ConvertFrom-Json
        $existingAppNames = @()
        if ($webApps) {
            $existingAppNames = $webApps | ForEach-Object { $_.name }
        }
        
        $missingApps = @()
        if ($backendAppName -and $backendAppName -notin $existingAppNames) {
            Write-ColorOutput "Backend Web App not found: $backendAppName" $Yellow
            $missingApps += "Backend: $backendAppName"
            Write-PhaseLog "Backend Web App not found: $backendAppName"
        }
        elseif ($backendAppName) {
            Write-ColorOutput "Backend Web App exists: $backendAppName" $Green
            Write-PhaseLog "Backend Web App exists: $backendAppName"
        }
        
        if ($chatbotAppName -and $chatbotAppName -notin $existingAppNames) {
            Write-ColorOutput "Chatbot Web App not found: $chatbotAppName" $Yellow
            $missingApps += "Chatbot: $chatbotAppName"
            Write-PhaseLog "Chatbot Web App not found: $chatbotAppName"
        }
        elseif ($chatbotAppName) {
            Write-ColorOutput "Chatbot Web App exists: $chatbotAppName" $Green
            Write-PhaseLog "Chatbot Web App exists: $chatbotAppName"
        }
        
        if ($rlServiceAppName -and $rlServiceAppName -notin $existingAppNames) {
            Write-ColorOutput "RL Service Web App not found: $rlServiceAppName" $Yellow
            $missingApps += "RL Service: $rlServiceAppName"
            Write-PhaseLog "RL Service Web App not found: $rlServiceAppName"
        }
        elseif ($rlServiceAppName) {
            Write-ColorOutput "RL Service Web App exists: $rlServiceAppName" $Green
            Write-PhaseLog "RL Service Web App exists: $rlServiceAppName"
        }
        
        if ($missingApps.Count -gt 0) {
            Write-ColorOutput "Missing Web Apps will be provisioned during deployment phase." $Yellow
            Write-PhaseLog "Missing Web Apps: $($missingApps -join ', ')"
        }
        
        Write-ColorOutput "Azure resources verified." $Green
        Write-PhaseLog "Azure resource verification completed"
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 6 failed: $_" $Red
        Write-PhaseLog "Phase 6 failed: $_" "ERROR"
        return $false
    }
}

# PHASE 7: Service Deployment
function Invoke-Phase7-ServiceDeployment {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would deploy all services to Azure" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Service Deployment" "Deploying backend, chatbot, and RL service to Azure (App Service or Container Apps)"
    
    try {
        $deployDir = Join-Path (Join-Path $script:ScriptDir "infrastructure") "azure_deployment"
        
        $rg = $script:Config.Azure.ResourceGroup
        $location = $script:Config.Azure.Location
        
        if (-not $rg) {
            $rg = "rg-wealtharena-northcentralus"
        }
        if (-not $location) {
            $location = "northcentralus"
        }
        
        # Infrastructure pre-flight checks
        Write-ColorOutput "" $Blue
        Write-ColorOutput "Running infrastructure verification..." $Blue
        $verifyScript = Join-Path $deployDir "verify_infrastructure.ps1"
        if (Test-Path $verifyScript) {
            try {
                & $verifyScript -ResourceGroup $rg -Location $location
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "WARNING: Infrastructure verification failed" $Yellow
                    Write-ColorOutput "Some required resources may be missing. Deployment may fail." $Yellow
                    Write-ColorOutput "" $Yellow
                    Write-ColorOutput "Options:" $Cyan
                    Write-ColorOutput "  1. Run infrastructure setup: setup_master.ps1 (Phase 6)" $Blue
                    Write-ColorOutput "  2. Skip Phase 7 and fix manually" $Blue
                    Write-ColorOutput "  3. Continue anyway (at your own risk)" $Blue
                    Write-ColorOutput "" $Blue
                    
                    if (-not $NonInteractive) {
                        $continue = Read-Host "Continue with deployment anyway? (y/N)"
                        if ($continue -ne "y" -and $continue -ne "Y") {
                            Write-ColorOutput "Phase 7 cancelled by user" $Yellow
                            Write-PhaseLog "Phase 7 cancelled - infrastructure verification failed"
                            return $false
                        }
                    } else {
                        Write-ColorOutput "Non-interactive mode: Continuing despite warnings" $Yellow
                        Write-PhaseLog "Continuing despite infrastructure verification failures (non-interactive mode)"
                    }
                } else {
                    Write-ColorOutput "Infrastructure verification passed" $Green
                    Write-PhaseLog "Infrastructure verification passed"
                }
            } catch {
                Write-ColorOutput "WARNING: Infrastructure verification script encountered an error: $_" $Yellow
                Write-PhaseLog "Infrastructure verification error: $_" "WARNING"
                Write-ColorOutput "Continuing with deployment..." $Yellow
            }
        } else {
            Write-ColorOutput "WARNING: verify_infrastructure.ps1 not found, skipping pre-flight checks" $Yellow
            Write-PhaseLog "verify_infrastructure.ps1 not found, skipping pre-flight checks" "WARNING"
        }
        Write-ColorOutput ""
        
        # Step 1: Deployment mode selection
        Write-ColorOutput "" $Blue
        Write-ColorOutput "Select deployment mode:" $Yellow
        Write-ColorOutput "  1) App Service (requires quota)" $Blue
        Write-ColorOutput "  2) Container Apps (free tier, no quota required)" $Blue
        Write-ColorOutput ""
        
        $deploymentMode = ""
        if ($NonInteractive) {
            # In non-interactive mode, check quota first and default to Container Apps if quota is 0
            Write-ColorOutput "Non-interactive mode: Checking quota..." $Blue
            $quotaCheck = az vm list-usage --location $location --query "[?name.value=='cores'].{Current:currentValue, Limit:limit}" --output json 2>&1 | ConvertFrom-Json
            if ($quotaCheck -and $quotaCheck.Limit -eq 0) {
                Write-ColorOutput "Quota is 0, using Container Apps mode" $Yellow
                $deploymentMode = "ContainerApps"
            } else {
                Write-ColorOutput "Quota available, using App Service mode" $Yellow
                $deploymentMode = "AppService"
            }
        } else {
            $userInput = Read-Host "Enter choice (1 or 2)"
            if ($userInput -eq "2") {
                $deploymentMode = "ContainerApps"
            } else {
                $deploymentMode = "AppService"
            }
        }
        
        # Step 2: Quota check for App Service mode
        if ($deploymentMode -eq "AppService") {
            Write-ColorOutput "Checking App Service Plan quota..." $Blue
            Write-ColorOutput "Note: This is a heuristic check using VM cores. Actual App Service Plan quota may differ." $Yellow
            
            # Try to check App Service Plan quota directly by attempting a dry-run
            $quotaCheckPassed = $false
            $testPlanName = "test-quota-check-$(Get-Random -Minimum 1000 -Maximum 9999)"
            
            try {
                Write-ColorOutput "Attempting App Service Plan quota check (dry-run)..." $Blue
                # Attempt to create a Free F1 plan as a quota check
                $testResult = az appservice plan create `
                    --name $testPlanName `
                    --resource-group $rg `
                    --location $location `
                    --sku F1 `
                    --is-linux `
                    --output json 2>&1 | Out-String
                
                if ($LASTEXITCODE -eq 0) {
                    # Plan was created successfully, delete it
                    Write-ColorOutput "Quota check passed - App Service Plan quota available" $Green
                    az appservice plan delete `
                        --name $testPlanName `
                        --resource-group $rg `
                        --yes `
                        --output none 2>&1 | Out-Null
                    $quotaCheckPassed = $true
                } else {
                    # Check if it's a quota error
                    if ($testResult -match "quota" -or $testResult -match "Additional quota" -or $testResult -match "Current Limit.*0") {
                        Write-ColorOutput "WARNING: App Service Plan quota appears to be 0 or insufficient" $Yellow
                        Write-ColorOutput "This subscription cannot create App Service Plans." $Yellow
                        Write-ColorOutput ""
                        Write-ColorOutput "Recommendation: Use Container Apps instead (no quota required)" $Yellow
                        Write-ColorOutput ""
                        
                        if (-not $NonInteractive) {
                            $continue = Read-Host "Continue with App Service anyway? (y/N)"
                            if ($continue -ne "y" -and $continue -ne "Y") {
                                Write-ColorOutput "Switching to Container Apps mode..." $Blue
                                $deploymentMode = "ContainerApps"
                            }
                        } else {
                            Write-ColorOutput "Non-interactive mode: Automatically switching to Container Apps" $Blue
                            $deploymentMode = "ContainerApps"
                        }
                    } else {
                        # Different error - might be resource group or other issue
                        Write-ColorOutput "WARNING: Could not verify App Service Plan quota (error may not be quota-related)" $Yellow
                        Write-ColorOutput "Error: $testResult" $Yellow
                        Write-ColorOutput "Continuing with App Service deployment anyway (quota check may be inaccurate)" $Yellow
                        Write-ColorOutput "If deployment fails due to quota, you can switch to Container Apps" $Yellow
                        # Don't switch to Container Apps - let the deployment proceed and fail if quota is actually an issue
                    }
                }
            } catch {
                Write-ColorOutput "WARNING: Exception during quota check: $_" $Yellow
                Write-ColorOutput "Continuing with App Service deployment anyway (quota check may be inaccurate)" $Yellow
                Write-ColorOutput "If deployment fails due to quota, you can switch to Container Apps" $Yellow
                # Don't switch to Container Apps - let the deployment proceed and fail if quota is actually an issue
            }
            
            # Fallback: Use VM cores check as heuristic
            if (-not $quotaCheckPassed -and $deploymentMode -eq "AppService") {
                Write-ColorOutput "Using VM cores as heuristic quota check..." $Blue
                $vmQuotaCheck = az vm list-usage --location $location --query "[?name.value=='cores'].{Current:currentValue, Limit:limit}" --output json 2>&1 | ConvertFrom-Json
                
                if ($vmQuotaCheck -and $vmQuotaCheck.Limit -eq 0) {
                    Write-ColorOutput "WARNING: VM cores quota is 0 (heuristic check)" $Yellow
                    Write-ColorOutput "This may indicate insufficient quota for App Service Plans." $Yellow
                    Write-ColorOutput "Switching to Container Apps (recommended for free-tier accounts)" $Yellow
                    $deploymentMode = "ContainerApps"
                } else {
                    Write-ColorOutput "Heuristic quota check passed (VM cores available)" $Green
                }
            }
        }
        
        # Step 3: Docker prerequisite check for Container Apps
        if ($deploymentMode -eq "ContainerApps") {
            Write-ColorOutput "Checking Docker prerequisites for Container Apps..." $Blue
            
            # Check if Docker is installed
            $dockerCheck = docker --version 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-ColorOutput "ERROR: Docker is not installed" $Red
                Write-ColorOutput "Container Apps requires Docker Desktop to be installed and running" $Yellow
                Write-ColorOutput "Please install Docker Desktop: https://www.docker.com/products/docker-desktop" $Yellow
                throw "Docker prerequisite not met"
            }
            Write-ColorOutput "Docker is installed: $dockerCheck" $Green
            
            # Check DOCKER_HOST environment variable (common cause of connection issues)
            $dockerHost = $env:DOCKER_HOST
            if ($dockerHost) {
                Write-ColorOutput "DOCKER_HOST is set to: $dockerHost" $Yellow
                if ($dockerHost -match "2376") {
                    Write-ColorOutput "WARNING: DOCKER_HOST is set to port 2376 (TLS), which may require certificates" $Yellow
                    Write-ColorOutput "For Docker Desktop on Windows, DOCKER_HOST should be unset to use the default named pipe" $Yellow
                    Write-ColorOutput "Attempting to clear DOCKER_HOST for this session..." $Blue
                    $env:DOCKER_HOST = $null
                    Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue
                    Write-ColorOutput "DOCKER_HOST cleared. Using default Docker Desktop connection (named pipe)" $Green
                } elseif ($dockerHost -match "tcp://127\.0\.0\.1:2375") {
                    Write-ColorOutput "DOCKER_HOST is set to HTTP endpoint (port 2375)" $Yellow
                    Write-ColorOutput "For Docker Desktop on Windows, clearing DOCKER_HOST to use default named pipe..." $Blue
                    $env:DOCKER_HOST = $null
                    Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue
                    Write-ColorOutput "DOCKER_HOST cleared. Using default Docker Desktop connection" $Green
                }
            } else {
                Write-ColorOutput "DOCKER_HOST is not set (using default Docker Desktop connection)" $Green
            }
            
            # Check Docker context - ensure it's using default (Docker Desktop)
            $dockerContext = docker context show 2>&1
            if ($dockerContext -match "default" -or $dockerContext -match "desktop") {
                Write-ColorOutput "Docker context: $dockerContext" $Green
            } else {
                Write-ColorOutput "WARNING: Docker context is set to: $dockerContext" $Yellow
                Write-ColorOutput "Switching to default context for Docker Desktop..." $Yellow
                docker context use default 2>&1 | Out-Null
                # Verify the switch worked
                $dockerContext = docker context show 2>&1
                Write-ColorOutput "Docker context switched to: $dockerContext" $Green
            }
            
            # Check if Docker Desktop process is running (Windows)
            $dockerProcess = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
            if (-not $dockerProcess) {
                Write-ColorOutput "WARNING: Docker Desktop process not detected" $Yellow
                Write-ColorOutput "Please ensure Docker Desktop is running" $Yellow
            } else {
                Write-ColorOutput "Docker Desktop process is running" $Green
            }
            
            # Check Docker daemon connectivity
            Write-ColorOutput "Checking Docker daemon connectivity..." $Blue
            $dockerError = $null
            $dockerExitCode = 0
            
            try {
                $dockerPs = docker ps 2>&1
                $dockerExitCode = $LASTEXITCODE
            } catch {
                $dockerError = $_.Exception.Message
                $dockerExitCode = 1
            }
            
            if ($dockerExitCode -ne 0) {
                $errorMsg = if ($dockerError) { $dockerError } else { ($dockerPs -join " ") }
                Write-ColorOutput "ERROR: Cannot connect to Docker daemon" $Red
                Write-ColorOutput "Error details: $errorMsg" $Yellow
                Write-ColorOutput "" $Yellow
                
                # Provide specific troubleshooting based on error
                if ($errorMsg -match "2376") {
                    Write-ColorOutput "DIAGNOSIS: Docker is trying to connect via TLS port 2376" $Yellow
                    Write-ColorOutput "This usually means DOCKER_HOST is set incorrectly or Docker context is misconfigured" $Yellow
                    Write-ColorOutput "" $Yellow
                    Write-ColorOutput "SOLUTION STEPS:" $Cyan
                    Write-ColorOutput "1. Clear DOCKER_HOST: Remove-Item Env:\DOCKER_HOST (or restart PowerShell)" $Blue
                    Write-ColorOutput "2. Reset Docker context: docker context use default" $Blue
                    Write-ColorOutput "3. Ensure Docker Desktop is running and fully started (wait 30-60 seconds)" $Blue
                    Write-ColorOutput "4. Try: docker context ls (to see available contexts)" $Blue
                    Write-ColorOutput "5. Restart Docker Desktop if needed" $Blue
                    Write-ColorOutput "" $Yellow
                } elseif ($errorMsg -match "127\.0\.0\.1") {
                    Write-ColorOutput "DIAGNOSIS: Docker is trying to connect via TCP/IP but Docker Desktop may not be exposing the daemon" $Yellow
                    Write-ColorOutput "On Windows, Docker Desktop uses a named pipe by default" $Yellow
                    Write-ColorOutput "" $Yellow
                }
                
                Write-ColorOutput "Docker Desktop is not running or not accessible." $Yellow
                Write-ColorOutput "" $Yellow
                
                # Offer to switch to App Service instead
                Write-ColorOutput "Alternative: Use App Service deployment (no Docker required)" $Cyan
                Write-ColorOutput "" $Cyan
                Write-ColorOutput "Would you like to switch to App Service deployment?" $Yellow
                Write-ColorOutput "  1) Yes, switch to App Service (recommended - no Docker needed)" $Blue
                Write-ColorOutput "  2) No, I'll fix Docker and retry" $Blue
                Write-ColorOutput "" $Blue
                
                $switchChoice = ""
                if ($NonInteractive) {
                    Write-ColorOutput "Non-interactive mode: Automatically switching to App Service" $Yellow
                    $switchChoice = "1"
                } else {
                    $switchChoice = Read-Host "Enter your choice (1 or 2)"
                }
                
                if ($switchChoice -eq "1") {
                    Write-ColorOutput "" $Blue
                    Write-ColorOutput "Switching to App Service deployment..." $Green
                    Write-ColorOutput "Note: App Service requires an App Service Plan (may need quota)" $Yellow
                    Write-PhaseLog "Switching from Container Apps to App Service due to Docker unavailability"
                    $deploymentMode = "AppService"
                    $script:Config.Deployment.Mode = "AppService"
                    # Break out of Docker check - continue with App Service deployment
                } else {
                    Write-ColorOutput "" $Yellow
                    Write-ColorOutput "Troubleshooting steps for Docker:" $Yellow
                    Write-ColorOutput "  1. Check DOCKER_HOST: if set, clear it with: Remove-Item Env:\DOCKER_HOST" $Blue
                    Write-ColorOutput "     Or restart PowerShell to clear environment variables" $Blue
                    Write-ColorOutput "  2. Ensure Docker Desktop is installed and running" $Blue
                    Write-ColorOutput "  3. Check if Docker Desktop is starting (may take 30-60 seconds)" $Blue
                    Write-ColorOutput "  4. Try resetting Docker context: docker context use default" $Blue
                    Write-ColorOutput "  5. Check Docker Desktop settings -> Resources -> Ensure WSL 2 is enabled" $Blue
                    Write-ColorOutput "  6. Verify Docker context: docker context ls (should show 'default' or 'desktop')" $Blue
                    Write-ColorOutput "  7. Restart Docker Desktop if it's stuck" $Blue
                    Write-ColorOutput "" $Yellow
                    Write-ColorOutput "Quick fix: In PowerShell, run:" $Cyan
                    Write-ColorOutput "  Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue" $Blue
                    Write-ColorOutput "  docker context use default" $Blue
                    Write-ColorOutput "  docker ps" $Blue
                    throw "Docker daemon not accessible: $errorMsg"
                }
            } else {
                Write-ColorOutput "Docker daemon is accessible" $Green
            }
        }
        
        # If we switched from Container Apps to App Service, skip Docker check and continue with App Service
        if ($deploymentMode -eq "AppService" -and $script:Config.Deployment.Mode -eq "AppService") {
            Write-ColorOutput "Proceeding with App Service deployment (Docker not required)" $Green
        }
        
        # Step 4: Execute deployment script based on mode
        if ($deploymentMode -eq "ContainerApps") {
            $deployScript = Join-Path $deployDir "deploy_all_services_containerapp.ps1"
            Write-ColorOutput "Using Container Apps deployment (no App Service Plan required)" $Blue
        } else {
            $deployScript = Join-Path $deployDir "deploy_all_services.ps1"
            Write-ColorOutput "Using App Service deployment" $Blue
        }
        
        Write-ColorOutput "Executing deployment script..." $Blue
        Write-PhaseLog "Executing $deployScript with mode: $deploymentMode"
        
        # Verify paths exist
        if (-not (Test-Path $deployScript)) {
            throw "Deployment script not found: $deployScript"
        }
        if (-not (Test-Path $deployDir)) {
            throw "Deployment directory not found: $deployDir"
        }
        
        try {
            # Resolve to absolute paths
            $deployScript = (Resolve-Path $deployScript).Path
            $deployDir = (Resolve-Path $deployDir).Path
            Write-PhaseLog "Resolved paths - Script: $deployScript, Directory: $deployDir"
        }
        catch {
            throw "Failed to resolve paths: $_"
        }
        
        # Execute script using full path with explicit PowerShell call
        Write-PhaseLog "Running: $deployScript with -ResourceGroup $rg -Location $location"
        
        try {
            # Change to deployment directory and execute script directly
            $originalLocation = Get-Location
            Push-Location $deployDir
            
            try {
                # Use call operator with full path
                & $deployScript -ResourceGroup $rg -Location $location
                
                if ($LASTEXITCODE -ne 0) {
                    throw "Deployment script exited with code $LASTEXITCODE"
                }
            }
            finally {
                Pop-Location
            }
        }
        catch {
            Write-PhaseLog "Deployment error: $_" "ERROR"
            Write-PhaseLog "Error details: $($_.Exception.Message)" "ERROR"
            if ($_.ScriptStackTrace) {
                Write-PhaseLog "Error stack: $($_.ScriptStackTrace)" "ERROR"
            }
            
            # Provide specific remediation based on error type
            $errorMessage = $_.Exception.Message
            if ($errorMessage -match "SQL|database|getaddrinfo") {
                Write-ColorOutput "Database connectivity issue detected." $Yellow
                Write-ColorOutput "Run: .\infrastructure\azure_deployment\diagnose_database_connectivity.ps1 -ResourceGroup $rg" $Blue
            } elseif ($errorMessage -match "Key Vault|secret|permission") {
                Write-ColorOutput "Key Vault access issue detected." $Yellow
                Write-ColorOutput "Run: .\infrastructure\azure_deployment\fix_keyvault_permissions.ps1 -ResourceGroup $rg" $Blue
            } elseif ($errorMessage -match "JSON|ConvertFrom-Json") {
                Write-ColorOutput "JSON parsing error (should be fixed in updated scripts)." $Yellow
                Write-ColorOutput "Check logs for details." $Blue
            }
            
            Write-ColorOutput ""
            Write-ColorOutput "See TROUBLESHOOTING_PHASE7.md for detailed guidance." $Yellow
            
            throw "Service deployment failed: $_"
        }
        
        # Resolve service URLs after deployment
        Write-ColorOutput "Resolving service URLs..." $Blue
        try {
            $resolvedUrls = Resolve-ServiceUrls -ResourceGroup $rg -DeploymentConfig $script:Config.Deployment
            $script:AutomationState.ServiceURLs = $resolvedUrls
            Save-AutomationState
        } catch {
            Write-ColorOutput "WARNING: Could not resolve service URLs: $_" $Yellow
            Write-PhaseLog "Service URL resolution failed: $_" "WARNING"
            Write-ColorOutput "URLs can be resolved manually later." $Yellow
        }
        
        Write-ColorOutput "Service deployment completed successfully." $Green
        Write-PhaseLog "Service deployment completed with mode: $deploymentMode"
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 7 failed: $_" $Red
        Write-PhaseLog "Phase 7 failed: $_" "ERROR"
        return $false
    }
    finally {
        # Location is managed via -WorkingDirectory parameter, no need to restore
    }
}

# Function to test Azure infrastructure
function Test-AzureInfrastructure {
    param(
        [string]$ResourceGroup,
        [string]$Location
    )
    
    $deployDir = Join-Path (Join-Path $script:ScriptDir "infrastructure") "azure_deployment"
    $verifyScript = Join-Path $deployDir "verify_infrastructure.ps1"
    
    if (-not (Test-Path $verifyScript)) {
        return @{
            Passed = $false
            Message = "verify_infrastructure.ps1 not found"
        }
    }
    
    try {
        $output = & $verifyScript -ResourceGroup $ResourceGroup -Location $Location 2>&1
        $exitCode = $LASTEXITCODE
        
        return @{
            Passed = ($exitCode -eq 0)
            ExitCode = $exitCode
            Output = $output
        }
    } catch {
        return @{
            Passed = $false
            Message = $_.Exception.Message
        }
    }
}

# PHASE 7.5: Data Pipeline Functions Deployment
function Invoke-Phase7-5-DataPipelineFunctions {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would deploy data pipeline Azure Functions" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Data Pipeline Functions Deployment" "Deploying Azure Functions for automated data collection"
    
    try {
        $deployDir = Join-Path (Join-Path $script:ScriptDir "infrastructure") "azure_deployment"
        $functionsScript = Join-Path $deployDir "deploy_data_pipeline_functions.ps1"
        
        if (-not (Test-Path $functionsScript)) {
            Write-ColorOutput "Data pipeline functions deployment script not found: $functionsScript" $Yellow
            Write-ColorOutput "Skipping data pipeline functions deployment..." $Yellow
            Write-PhaseLog "Data pipeline functions script not found, skipping" "WARNING"
            return $true  # Not critical, allow to continue
        }
        
        Write-ColorOutput "Executing data pipeline functions deployment script..." $Blue
        Write-PhaseLog "Executing deploy_data_pipeline_functions.ps1"
        
        $rg = $script:Config.Azure.ResourceGroup
        $location = $script:Config.Azure.Location
        
        if (-not $rg) {
            $rg = "rg-wealtharena-northcentralus"
        }
        if (-not $location) {
            $location = "northcentralus"
        }
        
        # Verify paths exist and resolve to absolute paths
        if (-not (Test-Path $functionsScript)) {
            Write-ColorOutput "Data pipeline functions deployment script not found: $functionsScript" $Yellow
            Write-ColorOutput "Skipping data pipeline functions deployment..." $Yellow
            Write-PhaseLog "Data pipeline functions script not found, skipping" "WARNING"
            return $true  # Not critical, allow to continue
        }
        if (-not (Test-Path $deployDir)) {
            throw "Deployment directory not found: $deployDir"
        }
        
        $functionsScript = (Resolve-Path $functionsScript).Path
        $deployDir = (Resolve-Path $deployDir).Path
        
        # Save current location and change to deployment directory
        $originalLocation = Get-Location
        try {
            Set-Location $deployDir
            
            # Execute the script using call operator
            Write-PhaseLog "Running: $functionsScript with -ResourceGroup $rg -Location $location"
            & $functionsScript -ResourceGroup $rg -Location $location
            
            if ($LASTEXITCODE -ne 0) {
                Write-ColorOutput "Warning: Data pipeline functions deployment returned non-zero exit code." $Yellow
                Write-PhaseLog "Data pipeline functions deployment warning (exit code: $LASTEXITCODE)" "WARNING"
                Write-ColorOutput "Functions may still be deploying or may need manual configuration." $Yellow
                Write-ColorOutput "You can deploy manually later using deploy_data_pipeline_functions.ps1" $Yellow
            }
            else {
                Write-ColorOutput "Data pipeline functions deployment completed successfully." $Green
                Write-PhaseLog "Data pipeline functions deployment completed"
            }
        }
        catch {
            Write-ColorOutput "Warning: Data pipeline functions deployment had issues: $_" $Yellow
            Write-PhaseLog "Data pipeline functions deployment warning: $_" "WARNING"
            Write-ColorOutput "You can deploy manually later using deploy_data_pipeline_functions.ps1" $Yellow
        }
        finally {
            Set-Location $originalLocation
        }
        
        # Record deployment info (always record, status depends on exit code)
        $deploymentStatus = if ($LASTEXITCODE -eq 0) { "Completed" } else { "Warning" }
        $script:AutomationState.Artifacts["DataPipelineFunctions"] = @{
            Status = $deploymentStatus
            Timestamp = Get-Date
            FunctionAppName = "wealtharena-data-pipeline"
            ResourceGroup = $rg
        }
        Save-AutomationState
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 7.5 failed: $_" $Red
        Write-PhaseLog "Phase 7.5 failed: $_" "ERROR"
        # Don't fail the entire automation for this - it's not critical
        Write-ColorOutput "Continuing with next phase (data pipeline functions can be deployed manually later)" $Yellow
        return $true
    }
    finally {
        # Location is managed via -WorkingDirectory parameter, no need to restore
    }
}

# PHASE 8: Model Upload
function Invoke-Phase8-ModelUpload {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would upload models to Azure Blob Storage" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Model Upload" "Uploading trained models to Azure Blob Storage"
    
    try {
        $deployDir = Join-Path (Join-Path $script:ScriptDir "infrastructure") "azure_deployment"
        $uploadScript = Join-Path $deployDir "upload_models.ps1"
        
        if (Test-Path $uploadScript) {
            Write-ColorOutput "Executing model upload script..." $Blue
            Write-PhaseLog "Executing upload_models.ps1"
            
            $rg = $script:Config.Azure.ResourceGroup
            $storageAccount = $script:Config.Deployment.storage_account
            if (-not $storageAccount) { $storageAccount = $script:Config.Deployment.StorageAccount }
            
            # Detect PowerShell executable (prefer powershell, fallback to pwsh)
            $powershellExe = "powershell"
            if (-not (Get-Command "powershell" -ErrorAction SilentlyContinue)) {
                if (Get-Command "pwsh" -ErrorAction SilentlyContinue) {
                    $powershellExe = "pwsh"
                }
            }
            
            # Build argument string (handles paths with spaces correctly)
            # Include -ExecutionPolicy only for Windows PowerShell
            if ($powershellExe -eq "powershell") {
                $uploadArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$uploadScript`""
            } else {
                $uploadArgs = "-NoProfile -File `"$uploadScript`""
            }
            if ($rg) {
                $uploadArgs += " -ResourceGroup `"$rg`""
            }
            if ($storageAccount) {
                $uploadArgs += " -StorageAccount `"$storageAccount`""
            }
            
            # Use temporary files to avoid file locking issues
            $tempStdout = "$env:TEMP\powershell_stdout_$(Get-Random).txt"
            $tempStderr = "$env:TEMP\powershell_stderr_$(Get-Random).txt"
            $proc = Start-Process -FilePath $powershellExe -ArgumentList $uploadArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tempStdout -RedirectStandardError $tempStderr -WorkingDirectory $deployDir
            
            # Append output to log file after process completes
            if (Test-Path $tempStdout) {
                Get-Content $tempStdout | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
                Remove-Item $tempStdout -ErrorAction SilentlyContinue
            }
            if (Test-Path $tempStderr) {
                Get-Content $tempStderr | Add-Content -Path $LogFile -ErrorAction SilentlyContinue
                Remove-Item $tempStderr -ErrorAction SilentlyContinue
            }
            
            if ($proc.ExitCode -ne 0) {
                Write-ColorOutput "Warning: Model upload script returned non-zero exit code." $Yellow
                Write-PhaseLog "Model upload script warning (exit code: $($proc.ExitCode))" "WARNING"
            }
            else {
                Write-ColorOutput "Model upload completed successfully." $Green
                Write-PhaseLog "Model upload completed"
                
                # Record model upload stats
                $script:AutomationState.Artifacts["ModelUpload"] = @{
                    Status = "Completed"
                    Timestamp = Get-Date
                    ResourceGroup = $rg
                    StorageAccount = $storageAccount
                }
                Save-AutomationState
            }
        }
        else {
            Write-ColorOutput "Model upload script not found. Skipping..." $Yellow
            Write-PhaseLog "upload_models.ps1 not found, skipping" "WARNING"
        }
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 8 failed: $_" $Red
        Write-PhaseLog "Phase 8 failed: $_" "ERROR"
        return $false
    }
    finally {
        # Location is managed via -WorkingDirectory parameter, no need to restore
    }
}

# PHASE 9: Frontend Configuration Update
function Invoke-Phase9-FrontendConfig {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would update frontend configuration" $Yellow
        return $true
    }
    
    Write-PhaseHeader "Frontend Configuration Update" "Updating frontend with Azure service URLs"
    
    try {
        $frontendDir = Join-Path $script:ScriptDir "frontend"
        $envFile = Join-Path $frontendDir ".env.azure"
        
        Write-ColorOutput "Creating .env.azure configuration file..." $Blue
        Write-PhaseLog "Creating .env.azure file"
        
        # Use resolved URLs from AutomationState, or fallback to config
        $backendUrl = $script:AutomationState.ServiceURLs.Backend
        $chatbotUrl = $script:AutomationState.ServiceURLs.Chatbot
        $rlServiceUrl = $script:AutomationState.ServiceURLs.RLService
        
        if (-not $backendUrl) {
            $backendAppName = $script:Config.Deployment.backend_app_name
            if (-not $backendAppName) { $backendAppName = $script:Config.Deployment.BackendAppName }
            if (-not $backendAppName -and $script:Config.Deployment -and $script:Config.Deployment.app_names) {
                $backendAppName = $script:Config.Deployment.app_names | Where-Object { $_ -match "backend" } | Select-Object -First 1
            }
            if ($backendAppName) {
                $backendUrl = "https://$backendAppName.azurewebsites.net"
            }
            else {
                Write-ColorOutput "[WAIT] Backend URL not available - using placeholder" $Yellow
                Write-PhaseLog "Backend URL not available in AutomationState or config, using placeholder" "WARNING"
                $backendUrl = "https://backend-service.azurewebsites.net"
            }
        }
        if (-not $chatbotUrl) {
            $chatbotAppName = $script:Config.Deployment.chatbot_app_name
            if (-not $chatbotAppName) { $chatbotAppName = $script:Config.Deployment.ChatbotAppName }
            if (-not $chatbotAppName -and $script:Config.Deployment -and $script:Config.Deployment.app_names) {
                $chatbotAppName = $script:Config.Deployment.app_names | Where-Object { $_ -match "chatbot" } | Select-Object -First 1
            }
            if ($chatbotAppName) {
                $chatbotUrl = "https://$chatbotAppName.azurewebsites.net"
            }
            else {
                Write-ColorOutput "[WAIT] Chatbot URL not available - using placeholder" $Yellow
                Write-PhaseLog "Chatbot URL not available in AutomationState or config, using placeholder" "WARNING"
                $chatbotUrl = "https://chatbot-service.azurewebsites.net"
            }
        }
        if (-not $rlServiceUrl) {
            $rlServiceAppName = $script:Config.Deployment.rl_service_app_name
            if (-not $rlServiceAppName) { $rlServiceAppName = $script:Config.Deployment.RLServiceAppName }
            if (-not $rlServiceAppName -and $script:Config.Deployment -and $script:Config.Deployment.app_names) {
                $rlServiceAppName = $script:Config.Deployment.app_names | Where-Object { $_ -match "rl|rl-service|rlservice" } | Select-Object -First 1
            }
            if ($rlServiceAppName) {
                $rlServiceUrl = "https://$rlServiceAppName.azurewebsites.net"
            }
            else {
                Write-ColorOutput "[WAIT] RL Service URL not available - using placeholder" $Yellow
                Write-PhaseLog "RL Service URL not available in AutomationState or config, using placeholder" "WARNING"
                $rlServiceUrl = "https://rl-service.azurewebsites.net"
            }
        }
        
        $configContent = @"
EXPO_PUBLIC_DEPLOYMENT_ENV=azure
EXPO_PUBLIC_BACKEND_URL=$backendUrl
EXPO_PUBLIC_CHATBOT_URL=$chatbotUrl
EXPO_PUBLIC_RL_SERVICE_URL=$rlServiceUrl
"@
        
        Set-Content -Path $envFile -Value $configContent -Force
        Write-ColorOutput "Frontend configuration updated." $Green
        Write-PhaseLog "Frontend config created with URLs: Backend=$backendUrl, Chatbot=$chatbotUrl, RL=$rlServiceUrl"
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 9 failed: $_" $Red
        Write-PhaseLog "Phase 9 failed: $_" "ERROR"
        return $false
    }
}

# PHASE 10: End-to-End Testing
function Invoke-Phase10-E2ETesting {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would run end-to-end tests" $Yellow
        return $true
    }
    
    Write-PhaseHeader "End-to-End Testing" "Running health checks and integration tests on all services"
    
    try {
        # Get timeout and retry settings from config
        $healthCheckTimeout = 30
        $healthCheckRetries = 3
        if ($script:Config.Testing.health_check_timeout) {
            $healthCheckTimeout = $script:Config.Testing.health_check_timeout
        }
        elseif ($script:Config.Testing.HealthCheckTimeout) {
            $healthCheckTimeout = $script:Config.Testing.HealthCheckTimeout
        }
        if ($script:Config.Testing.health_check_retries) {
            $healthCheckRetries = $script:Config.Testing.health_check_retries
        }
        elseif ($script:Config.Testing.HealthCheckRetries) {
            $healthCheckRetries = $script:Config.Testing.HealthCheckRetries
        }
        
        $testResults = @()
        
        # Get URLs from AutomationState or fallback
        $backendUrl = $script:AutomationState.ServiceURLs.Backend
        $chatbotUrl = $script:AutomationState.ServiceURLs.Chatbot
        $rlServiceUrl = $script:AutomationState.ServiceURLs.RLService
        
        # Determine deployment mode
        $deploymentMode = $script:Config.Deployment.Mode
        if (-not $deploymentMode) {
            # Default to ContainerApps if not specified
            $deploymentMode = "ContainerApps"
        }
        
        $resourceGroup = $script:Config.Azure.ResourceGroup
        
        # Helper function to resolve Container Apps URL
        function Get-ContainerAppUrl {
            param(
                [string]$AppName,
                [string]$ResourceGroup
            )
            
            if ([string]::IsNullOrWhiteSpace($AppName) -or [string]::IsNullOrWhiteSpace($ResourceGroup)) {
                return $null
            }
            
            try {
                $fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
                if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($fqdn) -and -not $fqdn.StartsWith("az:")) {
                    return "https://$fqdn"
                }
            } catch {
                $errorMsg = $_.Exception.Message
                Write-ColorOutput "[WARNING] Failed to retrieve Container Apps URL for $AppName : $errorMsg" $Yellow
            }
            
            return $null
        }
        
        # Resolve backend URL
        if (-not $backendUrl) {
            $backendAppName = $script:Config.Deployment.backend_app_name
            if (-not $backendAppName) { $backendAppName = $script:Config.Deployment.BackendAppName }
            
            if ($deploymentMode -eq "ContainerApps" -and $backendAppName -and $resourceGroup) {
                $backendUrl = Get-ContainerAppUrl -AppName $backendAppName -ResourceGroup $resourceGroup
            }
            
            if (-not $backendUrl) {
                # Fallback to App Service URL format
                if ($backendAppName) {
                    $backendUrl = "https://$backendAppName.azurewebsites.net"
                } else {
                    Write-ColorOutput "[WARNING] Could not determine backend URL. Please check Azure Portal or set it manually." $Yellow
                }
            }
        }
        
        # Resolve chatbot URL
        if (-not $chatbotUrl) {
            $chatbotAppName = $script:Config.Deployment.chatbot_app_name
            if (-not $chatbotAppName) { $chatbotAppName = $script:Config.Deployment.ChatbotAppName }
            
            if ($deploymentMode -eq "ContainerApps" -and $chatbotAppName -and $resourceGroup) {
                $chatbotUrl = Get-ContainerAppUrl -AppName $chatbotAppName -ResourceGroup $resourceGroup
            }
            
            if (-not $chatbotUrl) {
                # Fallback to App Service URL format
                if ($chatbotAppName) {
                    $chatbotUrl = "https://$chatbotAppName.azurewebsites.net"
                } else {
                    Write-ColorOutput "[WARNING] Could not determine chatbot URL. Please check Azure Portal or set it manually." $Yellow
                }
            }
        }
        
        # Resolve RL service URL
        if (-not $rlServiceUrl) {
            $rlServiceAppName = $script:Config.Deployment.rl_service_app_name
            if (-not $rlServiceAppName) { $rlServiceAppName = $script:Config.Deployment.RLServiceAppName }
            
            if ($deploymentMode -eq "ContainerApps" -and $rlServiceAppName -and $resourceGroup) {
                $rlServiceUrl = Get-ContainerAppUrl -AppName $rlServiceAppName -ResourceGroup $resourceGroup
            }
            
            if (-not $rlServiceUrl) {
                # Fallback to App Service URL format
                if ($rlServiceAppName) {
                    $rlServiceUrl = "https://$rlServiceAppName.azurewebsites.net"
                } else {
                    Write-ColorOutput "[WARNING] Could not determine RL service URL. Please check Azure Portal or set it manually." $Yellow
                }
            }
        }
        
        # Test backend
        Write-ColorOutput "[SEARCH] Testing backend service..." $Blue
        $backendHealthy = Invoke-WithRetry -ScriptBlock { Test-ServiceHealth "$backendUrl/health" -TimeoutSeconds $healthCheckTimeout } -MaxRetries $healthCheckRetries
        if ($backendHealthy) {
            Write-ColorOutput "[CHECK] Backend service is healthy." $Green
            $testResults += "Backend: PASS"
            
            # Test backend sample endpoint
            try {
                Write-ColorOutput "[SEARCH] Testing backend sample endpoint..." $Blue
                $sampleEndpoints = @("/api/health/detailed", "/api/ping", "/health/detailed", "/ping")
                $sampleTestPassed = $false
                $sampleEndpoint = $null
                
                foreach ($endpoint in $sampleEndpoints) {
                    try {
                        $sampleResponse = Invoke-WebRequest -Uri "$backendUrl$endpoint" -Method GET -TimeoutSec $healthCheckTimeout -UseBasicParsing -ErrorAction Stop
                        if ($sampleResponse.StatusCode -eq 200) {
                            # Validate minimal JSON shape
                            try {
                                $jsonContent = $sampleResponse.Content | ConvertFrom-Json
                                $sampleTestPassed = $true
                                $sampleEndpoint = $endpoint
                                Write-ColorOutput "[CHECK] Backend sample endpoint OK: $endpoint" $Green
                                break
                            }
                            catch {
                                # Not JSON, but 200 is still good
                                $sampleTestPassed = $true
                                $sampleEndpoint = $endpoint
                                Write-ColorOutput "[CHECK] Backend sample endpoint OK: $endpoint (non-JSON response)" $Green
                                break
                            }
                        }
                    }
                    catch {
                        # Try next endpoint
                        continue
                    }
                }
                
                if ($sampleTestPassed) {
                    $testResults += "Backend Sample ($sampleEndpoint): PASS"
                }
                else {
                    Write-ColorOutput "[WAIT] Backend sample endpoints not available (health endpoint OK)" $Yellow
                    $testResults += "Backend Sample: N/A"
                }
            }
            catch {
                Write-PhaseLog "Backend sample endpoint test failed: $_" "WARNING"
                $testResults += "Backend Sample: N/A"
            }
        }
        else {
            Write-ColorOutput "[CAUTION] Backend service health check failed." $Red
            $testResults += "Backend: FAIL"
        }
        
        # Test chatbot with detailed checks
        Write-ColorOutput "[SEARCH] Testing chatbot service (detailed)..." $Blue
        $chatbotTestResults = Test-ChatbotHealth -ChatbotUrl $chatbotUrl -TimeoutSeconds $healthCheckTimeout
        if ($chatbotTestResults.HealthCheck) {
            Write-ColorOutput "[CHECK] Chatbot health: OK" $Green
            if ($chatbotTestResults.SampleQuery) {
                Write-ColorOutput "[CHECK] Chatbot sample query: OK (Response time: $($chatbotTestResults.ResponseTime)ms)" $Green
                $testResults += "Chatbot: PASS (Health: OK, Query: OK, Response: $($chatbotTestResults.ResponseTime)ms)"
            }
            else {
                Write-ColorOutput "[WAIT] Chatbot sample query: Not available (health endpoint OK)" $Yellow
                $testResults += "Chatbot: PASS (Health: OK, Query: N/A)"
            }
        }
        else {
            Write-ColorOutput "[CAUTION] Chatbot health check failed: $($chatbotTestResults.Message)" $Red
            $testResults += "Chatbot: FAIL"
        }
        
        # Test RL service
        Write-ColorOutput "[SEARCH] Testing RL service..." $Blue
        $rlHealthy = Invoke-WithRetry -ScriptBlock { Test-ServiceHealth "$rlServiceUrl/health" -TimeoutSeconds $healthCheckTimeout } -MaxRetries $healthCheckRetries
        if ($rlHealthy) {
            Write-ColorOutput "[CHECK] RL service is healthy." $Green
            $testResults += "RL Service: PASS"
            
            # Test RL service sample endpoint
            try {
                Write-ColorOutput "[SEARCH] Testing RL service sample endpoint..." $Blue
                $predictBody = @{
                    features = @(0.1, 0.2, 0.3, 0.4, 0.5)
                } | ConvertTo-Json
                
                $rlSampleResponse = Invoke-WebRequest -Uri "$rlServiceUrl/predict" -Method POST -Body $predictBody -ContentType "application/json" -TimeoutSec $healthCheckTimeout -UseBasicParsing -ErrorAction Stop
                if ($rlSampleResponse.StatusCode -eq 200) {
                    # Validate expected keys in response
                    try {
                        $rlJsonContent = $rlSampleResponse.Content | ConvertFrom-Json
                        # Check for common prediction response keys
                        $hasValidKeys = $false
                        if ($rlJsonContent.PSObject.Properties.Name -match "prediction|action|value|result|score") {
                            $hasValidKeys = $true
                        }
                        if ($hasValidKeys) {
                            Write-ColorOutput "[CHECK] RL service sample endpoint OK: /predict" $Green
                            $testResults += "RL Service Sample (/predict): PASS"
                        }
                        else {
                            Write-ColorOutput "[WAIT] RL service /predict returned 200 but unexpected JSON shape" $Yellow
                            $testResults += "RL Service Sample (/predict): PARTIAL"
                        }
                    }
                    catch {
                        Write-ColorOutput "[WAIT] RL service /predict returned 200 but response is not JSON" $Yellow
                        $testResults += "RL Service Sample (/predict): PARTIAL"
                    }
                }
            }
            catch {
                Write-PhaseLog "RL service sample endpoint test failed: $_" "WARNING"
                $testResults += "RL Service Sample: N/A"
            }
        }
        else {
            Write-ColorOutput "[CAUTION] RL service health check failed." $Red
            $testResults += "RL Service: FAIL"
        }
        
        # Display comprehensive test summary
        Write-Host ""
        Write-ColorOutput "[SEARCH] End-to-End Testing Summary:" $Cyan
        foreach ($result in $testResults) {
            if ($result -match "PASS") {
                Write-ColorOutput "  [OK] $result" $Green
            }
            else {
                Write-ColorOutput "  [FAIL] $result" $Red
            }
        }
        Write-Host ""
        
        # Check if any services failed
        $failedServices = $testResults | Where-Object { $_ -match "FAIL" }
        if ($failedServices.Count -gt 0) {
            Write-ColorOutput "[CAUTION] Some services failed health checks. Review the errors above." $Yellow
            $confirmed = Wait-ForUserConfirmation -Message "Some services failed health checks. Type Y to continue anyway, or N to abort"
            if (-not $confirmed) {
                Write-ColorOutput "Phase 10 aborted by user due to failed service checks." $Yellow
                Write-PhaseLog "Phase 10 aborted by user due to failed service checks"
                return $false
            }
        }
        
        Write-ColorOutput "[SUCCESS] End-to-end testing completed." $Green
        Write-PhaseLog "E2E testing completed: $($testResults -join ', ') (timeout: $healthCheckTimeout, retries: $healthCheckRetries)"
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 10 failed: $_" $Red
        Write-PhaseLog "Phase 10 failed: $_" "ERROR"
        return $false
    }
}

# PHASE 11: APK Build
function Invoke-Phase11-APKBuild {
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would build Android APK" $Yellow
        return $true
    }
    
    Write-PhaseHeader "APK Build" "Building Android APK using EAS CLI"
    
    try {
        $frontendDir = Join-Path $script:ScriptDir "frontend"
        Set-Location $frontendDir
        
        # Verify EAS CLI
        Write-ColorOutput "Verifying EAS CLI installation..." $Blue
        $easVersion = eas --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "EAS CLI not installed. Run: npm install -g eas-cli"
        }
        Write-ColorOutput "EAS CLI version: $easVersion" $Green
        Write-PhaseLog "EAS CLI version: $easVersion"
        
        # Check EAS authentication
        Write-ColorOutput "Checking EAS authentication..." $Blue
        try {
            $easWhoami = eas whoami 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "Not authenticated with EAS. Run: eas login"
            }
            Write-ColorOutput "✅ Authenticated as: $easWhoami" $Green
            Write-PhaseLog "EAS authenticated: $easWhoami"
        } catch {
            if (-not [string]::IsNullOrWhiteSpace($env:EXPO_TOKEN)) {
                Write-ColorOutput "✅ Using EXPO_TOKEN environment variable" $Green
                Write-PhaseLog "Using EXPO_TOKEN for authentication"
            } else {
                Write-ColorOutput "⚠️  Not authenticated with EAS. Will attempt to use EXPO_TOKEN if available." $Yellow
                Write-PhaseLog "EAS authentication check failed: $_" "WARNING"
            }
        }
        
        # Check for eas.json
        $easJsonPath = Join-Path $frontendDir "eas.json"
        if (-not (Test-Path $easJsonPath)) {
            Write-ColorOutput "⚠️  eas.json not found. EAS build may fail." $Yellow
            Write-PhaseLog "eas.json not found" "WARNING"
            Write-ColorOutput "  Consider running: eas init" $Yellow
        } else {
            Write-ColorOutput "✅ eas.json found" $Green
            Write-PhaseLog "eas.json found"
        }
        
        # Check for app.json or app.config.js
        $appJsonPath = Join-Path $frontendDir "app.json"
        $appConfigPath = Join-Path $frontendDir "app.config.js"
        if (-not (Test-Path $appJsonPath) -and -not (Test-Path $appConfigPath)) {
            Write-ColorOutput "⚠️  app.json or app.config.js not found. EAS build may fail." $Yellow
            Write-PhaseLog "app.json/app.config.js not found" "WARNING"
        } else {
            Write-ColorOutput "✅ App configuration found" $Green
            Write-PhaseLog "App configuration found"
            
            # Check if project is linked (has expo project ID)
            if (Test-Path $appJsonPath) {
                try {
                    $appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
                    if ($appJson.extra -and $appJson.extra.eas -and $appJson.extra.eas.projectId) {
                        Write-ColorOutput "✅ Expo project ID found: $($appJson.extra.eas.projectId)" $Green
                        Write-PhaseLog "Expo project ID: $($appJson.extra.eas.projectId)"
                    } else {
                        Write-ColorOutput "⚠️  Expo project ID not found in app.json. Project may not be linked." $Yellow
                        Write-PhaseLog "Expo project ID not found in app.json" "WARNING"
                        Write-ColorOutput "  Consider running: eas init" $Yellow
                    }
                } catch {
                    Write-PhaseLog "Could not parse app.json: $_" "WARNING"
                }
            }
        }
        
        # Get build profile from config
        $buildProfile = "production"
        if ($script:Config.APKBuild.build_profile) {
            $buildProfile = $script:Config.APKBuild.build_profile
        }
        elseif ($script:Config.APKBuild.BuildProfile) {
            $buildProfile = $script:Config.APKBuild.BuildProfile
        }
        
        # Build APK
        Write-ColorOutput "Starting APK build..." $Blue
        Write-ColorOutput "Note: This will upload to EAS servers and may take 15-30 minutes." $Yellow
        Write-PhaseLog "Executing eas build with profile: $buildProfile"
        
        $buildOutput = eas build --platform android --profile $buildProfile --non-interactive 2>&1 | Tee-Object -FilePath $LogFile -Append
        
        if ($LASTEXITCODE -ne 0) {
            throw "APK build failed"
        }
        
        Write-ColorOutput "APK build completed successfully." $Green
        Write-PhaseLog "APK build completed"
        
        # Try to parse build URL from output
        $buildUrl = $null
        if ($buildOutput) {
            $buildUrlMatch = [regex]::Match($buildOutput, 'https://expo\.dev/artifacts/[^\s]+')
            if ($buildUrlMatch.Success) {
                $buildUrl = $buildUrlMatch.Value
            }
        }
        
        # Try to get latest build URL from EAS
        if (-not $buildUrl) {
            try {
                $buildListOutput = eas build:list --platform android --limit 1 --json 2>&1 | ConvertFrom-Json
                if ($buildListOutput -and $buildListOutput.Count -gt 0 -and $buildListOutput[0].artifacts) {
                    $buildUrl = $buildListOutput[0].artifacts.buildUrl
                }
            }
            catch {
                Write-PhaseLog "Could not retrieve build URL from EAS: $_" "WARNING"
            }
        }
        
        # Download APK if configured
        $downloadApk = $false
        if ($script:Config.APKBuild.download_apk) {
            $downloadApk = $script:Config.APKBuild.download_apk
        }
        elseif ($script:Config.APKBuild.DownloadApk) {
            $downloadApk = $script:Config.APKBuild.DownloadApk
        }
        
        $apkPath = $null
        if ($downloadApk -and $buildUrl) {
            Write-ColorOutput "Downloading APK..." $Blue
            try {
                $buildsDir = Join-Path $script:ScriptDir "builds"
                $null = New-Item -ItemType Directory -Path $buildsDir -Force -ErrorAction SilentlyContinue
                
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                $apkFileName = "wealtharena_$timestamp.apk"
                $apkPath = Join-Path $buildsDir $apkFileName
                
                Invoke-WebRequest -Uri $buildUrl -OutFile $apkPath -UseBasicParsing -ErrorAction Stop
                Write-ColorOutput "APK downloaded to: $apkPath" $Green
                Write-PhaseLog "APK downloaded to: $apkPath"
            }
            catch {
                Write-ColorOutput "Warning: Could not download APK: $_" $Yellow
                Write-PhaseLog "APK download failed: $_" "WARNING"
            }
        }
        
        # Record build info in AutomationState
        $script:AutomationState.Artifacts["APKBuild"] = @{
            Status = "Completed"
            Timestamp = Get-Date
            BuildProfile = $buildProfile
            BuildUrl = $buildUrl
            APKPath = $apkPath
        }
        Save-AutomationState
        
        return $true
    }
    catch {
        Write-ColorOutput "Phase 11 failed: $_" $Red
        Write-PhaseLog "Phase 11 failed: $_" "ERROR"
        return $false
    }
    finally {
        # Restore original location (Phase 11 uses Set-Location directly, not Start-Process)
        Set-Location $script:ScriptDir
    }
}

# Phase 12: Maintenance Cleanup
function Invoke-Phase12-Maintenance {
    Write-PhaseHeader 12 "Maintenance Cleanup"
    
    try {
        Write-ColorOutput "Running maintenance cleanup..." $Blue
        Write-PhaseLog "Starting maintenance cleanup"
        
        $cleanupScript = Join-Path $script:ScriptDir "scripts\cleanup_old_files.ps1"
        
        if (-not (Test-Path $cleanupScript)) {
            Write-ColorOutput "Warning: Cleanup script not found at $cleanupScript" $Yellow
            Write-PhaseLog "Cleanup script not found" "WARNING"
            return $false
        }
        
        # Run cleanup script (non-interactive mode, respect DryRun flag)
        $cleanupParams = @{}
        if ($DryRun) {
            $cleanupParams["DryRun"] = $true
        }
        
        Write-ColorOutput "Executing cleanup script..." $Blue
        $cleanupResult = & $cleanupScript @cleanupParams
        
        if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
            Write-ColorOutput "Maintenance cleanup completed successfully" $Green
            Write-PhaseLog "Maintenance cleanup completed"
            return $true
        } else {
            Write-ColorOutput "Warning: Cleanup script returned non-zero exit code" $Yellow
            Write-PhaseLog "Cleanup script returned exit code: $LASTEXITCODE" "WARNING"
            return $false
        }
    }
    catch {
        Write-ColorOutput "Phase 12 (Maintenance) encountered an error: $_" $Red
        Write-PhaseLog "Phase 12 failed: $_" "ERROR"
        return $false
    }
}

# Pre-initialization: Check dependencies, collect credentials, setup configuration
function Initialize-AutomationEnvironment {
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "WealthArena Automation Setup" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    
    $setupNeeded = $false
    # Minimal setup mode when starting from later phases (e.g., 7+)
    $script:MinimalSetup = ($StartFromPhase -ge 7)
    if ($script:MinimalSetup) {
        Write-ColorOutput "[NOTE] Minimal setup mode detected (StartFromPhase=$StartFromPhase). Skipping non-essential preflight checks." $Yellow
    }
    
    # STEP 1: Check Azure login (FIRST - before anything else)
    Write-ColorOutput "[SEARCH] STEP 1: Checking Azure login..." $Blue
    Write-PhaseLog "Checking Azure login"
    
    # Check Azure CLI with retry loop
    $azureCliCheck = Test-PrerequisiteWithRetry -TestScript {
        $azCheck = Get-Command az -ErrorAction SilentlyContinue
        return $null -ne $azCheck
    } -FailureMessage "Azure CLI not found" -InstructionMessage "Please install Azure CLI from: https://aka.ms/installazurecliwindows`nAfter installation, restart PowerShell and run this script again." -MaxRetries 3
    
    if (-not $azureCliCheck) {
        if ($DryRun) {
            Write-ColorOutput "[DRY RUN] Would attempt automatic Azure CLI installation" $Yellow
        }
        else {
            # Try automatic installation as fallback
            $wingetCheck = Get-Command winget -ErrorAction SilentlyContinue
            if ($wingetCheck) {
                Write-ColorOutput "Attempting automatic installation via winget..." $Blue
                & winget install -e --id Microsoft.AzureCLI 2>&1 | Out-Null
                Write-ColorOutput "[OK] Azure CLI installed. Please restart PowerShell and run this script again." $Green
                throw "Azure CLI was installed. Please restart PowerShell."
            }
            else {
                throw "Azure CLI is required but not found and winget is not available. Please install manually."
            }
        }
    }
    
    # Check Azure login with retry loop
    $azureLoggedIn = $false
    $loginCheck = Test-PrerequisiteWithRetry -TestScript {
        $account = az account show --output json 2>&1 | ConvertFrom-Json
        return $null -ne $account
    } -FailureMessage "Not logged in to Azure" -InstructionMessage "Please log in to Azure. A browser window will open for authentication." -MaxRetries 3
    
    if (-not $loginCheck) {
        if ($DryRun) {
            Write-ColorOutput "[DRY RUN] Would prompt for Azure login" $Yellow
        }
        else {
            Write-ColorOutput "Opening Azure login..." $Blue
            Write-ColorOutput "Please log in to Azure in the browser window that will open." $Cyan
            Write-Host ""
            
            & az login 2>&1 | Out-Null
            
            # Give user time to complete login
            Show-CountdownTimer -Seconds 30 -Message "Waiting for Azure login to complete"
            
            # Confirm user completed login
            $confirmed = Wait-ForUserConfirmation -Message "Have you completed the Azure login? Type Y when done, or N to retry"
            if (-not $confirmed) {
                Write-ColorOutput "Please complete Azure login and run this script again." $Yellow
                throw "Azure login not completed. Please run 'az login' manually and try again."
            }
            
            # Verify login after confirmation
            $account = az account show --output json 2>&1 | ConvertFrom-Json
            if (-not $account) {
                throw "Azure login verification failed. Please run 'az login' manually and try again."
            }
        }
    }
    
    # Verify login status
    $account = az account show --output json 2>&1 | ConvertFrom-Json
    if ($account) {
        Write-ColorOutput "[CHECK] [OK] Azure login verified. Account: $($account.user.name)" $Green
        Write-ColorOutput "  Subscription: $($account.name)" $Green
        $azureLoggedIn = $true
    }
    else {
        throw "Azure login is required. Please log in and run this script again."
    }
    
    # STEP 2: Check and install dependencies
    if ($script:MinimalSetup) {
        Write-ColorOutput "[SKIP] Skipping system dependency checks for StartFromPhase $StartFromPhase" $Yellow
    } else {
        Write-Host ""
        Write-ColorOutput "[SEARCH] STEP 2: Checking system dependencies..." $Blue
        Write-PhaseLog "Checking system dependencies"
        
        # Check Python with retry loop
        $pythonCmd = $null
        $pythonCheck = Test-PrerequisiteWithRetry -TestScript {
            $cmd = Find-PythonCommand
            if ($cmd) {
                $script:PythonCommand = $cmd
                return $true
            }
            return $false
        } -FailureMessage "[CAUTION] Python not found. Please install Python 3.8+ from https://www.python.org/downloads/ and add it to your PATH." -InstructionMessage "After installation, restart PowerShell and run this script again. Then press Y to retry." -MaxRetries 3
        
        if (-not $pythonCheck) {
            throw "Python is required but not found. Please install Python 3.8+ and add it to PATH."
        }
        
        $pythonCmd = $script:PythonCommand
        # Handle Python command with arguments (e.g., "py -3")
        if ($pythonCmd -match " ") {
            $pyCmdParts = $pythonCmd -split " ", 2
            $pythonVersion = & $pyCmdParts[0] $pyCmdParts[1] "--version" 2>&1 | Select-Object -First 1
        }
        else {
            $pythonVersion = & $pythonCmd --version 2>&1 | Select-Object -First 1
        }
        Write-ColorOutput "[CHECK] [OK] Python found: $pythonVersion" $Green
        
        # Check Node.js with retry loop
        $nodeCheck = Test-PrerequisiteWithRetry -TestScript {
            $nodeVersion = & node --version 2>&1
            return $LASTEXITCODE -eq 0
        } -FailureMessage "[CAUTION] Node.js not found" -InstructionMessage "Please install Node.js from https://nodejs.org/ or we can try automatic installation via winget." -MaxRetries 3
        
        if (-not $nodeCheck) {
            if ($DryRun) {
                Write-ColorOutput "[DRY RUN] Would attempt automatic Node.js installation" $Yellow
            }
            else {
                # Try automatic installation as fallback
                $wingetCheck = Get-Command winget -ErrorAction SilentlyContinue
                if ($wingetCheck) {
                    Write-ColorOutput "Attempting automatic Node.js installation via winget..." $Blue
                    & winget install -e --id OpenJS.NodeJS 2>&1 | Out-Null
                    Write-ColorOutput "[OK] Node.js installed. Please restart PowerShell and run this script again." $Green
                    throw "Node.js was installed. Please restart PowerShell."
                }
                else {
                    throw "Node.js is required but not found and winget is not available. Please install manually."
                }
            }
        }
        else {
            $nodeVersion = & node --version 2>&1
            Write-ColorOutput "[CHECK] [OK] Node.js found: $nodeVersion" $Green
        }
        
        # Check ODBC Driver 18 with retry loop (will be checked again in Phase 3, but warn early)
        Write-ColorOutput "[SEARCH] Checking ODBC Driver 18 for SQL Server..." $Blue
        $odbcDriverCheck = Test-PrerequisiteWithRetry -TestScript {
            return Test-ODBCDriver18 -PythonCommand $pythonCmd
        } -FailureMessage "[CAUTION] ODBC Driver 18 for SQL Server not found. Required for Phase 3." -InstructionMessage "You can install it with: winget install --id Microsoft.msodbcsql.18 -e`nor download from https://aka.ms/downloadmsodbcsql`nAfter installation, press Y to retry." -MaxRetries 3
        
        if ($odbcDriverCheck) {
            Write-ColorOutput "[CHECK] [OK] ODBC Driver 18 found" $Green
        }
        else {
            Write-ColorOutput "[WAIT] [WARNING] ODBC Driver 18 not found. Will attempt installation in Phase 3." $Yellow
            Write-ColorOutput "   You can install it now with: winget install --id Microsoft.msodbcsql.18 -e" $Yellow
        }
        
        # Install Python dependencies
        Write-Host ""
        if ($DryRun) {
            Write-ColorOutput "[DRY RUN] Would install Python dependencies" $Yellow
        }
        else {
            Write-ColorOutput "Installing Python dependencies..." $Blue
            
            $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
            $dataPipelineReq = Join-Path $dataPipelineDir "requirements.txt"
            if (Test-Path $dataPipelineReq) {
                Write-ColorOutput "Installing data-pipeline dependencies..." $Blue
                try {
                    if ($pythonCmd -match " ") {
                        $pyCmdParts = $pythonCmd -split " ", 2
                        & $pyCmdParts[0] $pyCmdParts[1] -m pip install -q -r $dataPipelineReq 2>&1 | Out-Null
                    }
                    else {
                        & $pythonCmd -m pip install -q -r $dataPipelineReq 2>&1 | Out-Null
                    }
                    Write-ColorOutput "[OK] Data pipeline dependencies installed" $Green
                }
                catch {
                    Write-ColorOutput "[WARNING] Could not install data-pipeline dependencies: $_" $Yellow
                }
            }
        }
        
        $rlTrainingDir = Join-Path $script:ScriptDir "rl-training"
        $rlTrainingReq = Join-Path $rlTrainingDir "requirements.txt"
        if (Test-Path $rlTrainingReq) {
            # Check Python version before installing RL dependencies
            Write-ColorOutput "Checking Python version for RL training compatibility..." $Blue
            $pythonVersionOutput = $null
            $majorVersion = $null
            $minorVersion = $null
            $continue = $null
            
            if ($pythonCmd -match " ") {
                $pyCmdParts = $pythonCmd -split " ", 2
                $pythonVersionOutput = & $pyCmdParts[0] $pyCmdParts[1] --version 2>&1
            }
            else {
                $pythonVersionOutput = & $pythonCmd --version 2>&1
            }
            
            if ($pythonVersionOutput -match "Python (\d+)\.(\d+)") {
                $majorVersion = [int]$matches[1]
                $minorVersion = [int]$matches[2]
                
                if ($majorVersion -eq 3 -and $minorVersion -ge 12) {
                    # Note: Python 3.12+ detected - proceeding with installation
                    # Ray and some RL dependencies may have compatibility issues, but will attempt installation
                    Write-PhaseLog "Python 3.12+ detected - proceeding with RL training dependencies installation (compatibility issues may occur)"
                    $continue = $true  # Auto-continue without prompting
                }
                else {
                    Write-ColorOutput "[CHECK] [OK] Python version compatible: $pythonVersionOutput" $Green
                }
            }
            
            # Only proceed with installation if user didn't skip due to Python version
            $shouldInstall = $true
            if ($null -ne $majorVersion -and $null -ne $minorVersion -and $majorVersion -eq 3 -and $minorVersion -ge 12) {
                # Check if user chose to skip (Wait-ForUserConfirmation was called above)
                if ($null -ne $continue -and -not $continue) {
                    $shouldInstall = $false
                }
            }
            
            if ($shouldInstall) {
                if ($DryRun) {
                    Write-ColorOutput "[DRY RUN] Would install RL training dependencies" $Yellow
                }
                else {
                    Write-ColorOutput "Installing RL training dependencies (this may take a few minutes)..." $Blue
                    try {
                        $installOutput = $null
                        $installError = $null
                        if ($pythonCmd -match " ") {
                            $pyCmdParts = $pythonCmd -split " ", 2
                            $installOutput = & $pyCmdParts[0] $pyCmdParts[1] -m pip install -r $rlTrainingReq 2>&1
                            if ($LASTEXITCODE -ne 0) {
                                $installError = $installOutput | Out-String
                            }
                        }
                        else {
                            $installOutput = & $pythonCmd -m pip install -r $rlTrainingReq 2>&1
                            if ($LASTEXITCODE -ne 0) {
                                $installError = $installOutput | Out-String
                            }
                        }
                        
                        if ($LASTEXITCODE -eq 0) {
                            Write-ColorOutput "[OK] RL training dependencies installed" $Green
                        }
                        else {
                            Write-ColorOutput "[WARNING] Could not install RL training dependencies" $Yellow
                            if ($installError) {
                                # Show only the first few lines of error to avoid clutter
                                $errorLines = ($installError -split "`n" | Select-Object -First 5) -join "`n"
                                Write-ColorOutput "  Error: $errorLines" $Yellow
                                
                                # Provide specific remediation steps based on error type
                                Write-Host ""
                                Write-ColorOutput "Common issues and solutions:" $Yellow
                                
                                # Check for Visual C++ build tools errors
                                if ($installError -match "Microsoft Visual C\+\+|error: subprocess-exited-with-error|building '.*' extension") {
                                    Write-ColorOutput "  → Missing Visual C++ Build Tools (common on Windows)" $Yellow
                                    Write-ColorOutput "    Install from: https://visualstudio.microsoft.com/visual-cpp-build-tools/" $Yellow
                                    Write-ColorOutput "    Or try pre-built wheels for problematic packages" $Yellow
                                }
                                
                                # Check for Python version issues
                                if ($installError -match "Python 3\.12|requires Python|<3\.12|not supported") {
                                    Write-ColorOutput "  → Python version compatibility issue" $Yellow
                                    Write-ColorOutput "    Ray may require Python 3.8-3.11" $Yellow
                                    Write-ColorOutput "    Check Python version: python --version" $Yellow
                                }
                                
                                # Check for network/proxy issues
                                if ($installError -match "timeout|Connection refused|proxy|SSL") {
                                    Write-ColorOutput "  → Network/proxy issue" $Yellow
                                    Write-ColorOutput "    Check network connection or proxy settings" $Yellow
                                }
                                
                                # Check for Ray-specific issues
                                if ($installError -match "ray|rllib") {
                                    Write-ColorOutput "  → Ray installation issue" $Yellow
                                    Write-ColorOutput "    Try: pip install ray[rllib]==2.7.0" $Yellow
                                    Write-ColorOutput "    Or: pip install ray[rllib]==2.9.0" $Yellow
                                }
                                
                                Write-Host ""
                                Write-ColorOutput "  You can try installing manually:" $Yellow
                                Write-ColorOutput "    cd rl-training && pip install -r requirements.txt" $Yellow
                            }
                            else {
                                Write-ColorOutput "  You may need to install them manually later." $Yellow
                                Write-ColorOutput "  Try running: cd rl-training && pip install -r requirements.txt" $Yellow
                            }
                        }
                    }
                    catch {
                        Write-ColorOutput "[WARNING] Could not install RL training dependencies: $_" $Yellow
                        Write-Host ""
                        Write-ColorOutput "Common issues and solutions:" $Yellow
                        Write-ColorOutput "  → Missing Visual C++ Build Tools (Windows): Install from https://visualstudio.microsoft.com/visual-cpp-build-tools/" $Yellow
                        Write-ColorOutput "  → Python version: Ensure Python 3.8-3.11 (Ray may not support 3.12 yet)" $Yellow
                        Write-ColorOutput "  → Network issues: Check connection or proxy settings" $Yellow
                        Write-Host ""
                        Write-ColorOutput "  You can try installing manually:" $Yellow
                        Write-ColorOutput "    cd rl-training && pip install -r requirements.txt" $Yellow
                    }
                }
            }
        }
    }
    
    # STEP 3: Load or create configuration, then check/create Azure resources
    Write-Host ""
    Write-ColorOutput "STEP 3: Checking Azure resources..." $Blue
    Write-PhaseLog "Checking Azure resources"
    
    # Load configuration first (or create it)
    $configFile = "config/automation_config.yaml"
    $configExampleFile = "config/automation_config.example.yaml"
    
    if (-not (Test-Path $configFile) -or (Get-Content $configFile -Raw).Trim() -eq "") {
        if ($DryRun) {
            Write-ColorOutput "[DRY RUN] Would create configuration file interactively" $Yellow
            $setupNeeded = $true
        }
        else {
            Write-ColorOutput "Configuration file not found. Creating interactively..." $Yellow
            Write-Host ""
            Write-ColorOutput "Please provide the following information:" $Cyan
            Write-Host ""
            
            $resourceGroup = Read-Host 'Azure Resource Group name (e.g., rg-wealtharena-dev)'
            if ([string]::IsNullOrWhiteSpace($resourceGroup)) {
                $resourceGroup = "rg-wealtharena-dev"
                Write-ColorOutput "Using default: $resourceGroup" $Yellow
            }
            
            $location = Read-Host 'Azure Location (e.g., northcentralus) [default: northcentralus]'
            if ([string]::IsNullOrWhiteSpace($location)) {
                $location = "northcentralus"
            }
            
            $suffix = Read-Host 'Unique suffix for resource naming (e.g., dev1) [default: auto-generated]'
            if ([string]::IsNullOrWhiteSpace($suffix)) {
                $suffix = -join ((65..90) + (97..122) | Get-Random -Count 6 | ForEach-Object {[char]$_})
                Write-ColorOutput "Generated suffix: $suffix" $Green
            }
            
            # Create config from example if available
            if (Test-Path $configExampleFile) {
                if ($script:YamlLoaded) {
                    # Use structured YAML update when powershell-yaml is available
                    $configContent = Get-Content $configExampleFile -Raw | ConvertFrom-Yaml -Ordered
                    
                    # Update Azure section
                    if (-not $configContent.Azure) {
                        $configContent.Azure = @{}
                    }
                    $configContent.Azure.resource_group = $resourceGroup
                    $configContent.Azure.location = $location
                    $configContent.Azure.suffix = $suffix
                    
                    # Update rl_training section
                    if (-not $configContent.rl_training) {
                        $configContent.rl_training = @{}
                    }
                    if ($QuickTraining) {
                        $configContent.rl_training.config_file = "config/quick_training_config.yaml"
                        $configContent.rl_training.quick_training_mode = $true
                    }
                    
                    # Write back using ConvertTo-Yaml with safe file writing
                    $yamlOutput = $configContent | ConvertTo-Yaml
                    Write-SafeFile -FilePath $configFile -Content $yamlOutput
                    Write-ColorOutput "[OK] Created automation_config.yaml" $Green
                }
                else {
                    # Fallback to regex-based replacement with improved anchors
                    $configContent = Get-Content $configExampleFile -Raw
                    $configContent = $configContent -replace '(?m)^(\s*)resource_group:\s+"[^"]*"', "`$1resource_group: `"$resourceGroup`""
                    $configContent = $configContent -replace '(?m)^(\s*)location:\s+"[^"]*"', "`$1location: `"$location`""
                    $configContent = $configContent -replace '(?m)^(\s*)suffix:\s+"[^"]*"', "`$1suffix: `"$suffix`""
                    
                    if ($QuickTraining) {
                        # Scope regex replacements to rl_training section
                        $configContent = $configContent -replace '(?m)^(\s+)config_file:\s+"[^"]*"', "`$1config_file: `"config/quick_training_config.yaml`""
                        $configContent = $configContent -replace '(?m)^(\s+)quick_training_mode:\s+false', "`$1quick_training_mode: true"
                        # If quick_training_mode doesn't exist, add it after rl_training: or config_file
                        if ($configContent -notmatch '(?m)^(\s+)quick_training_mode:') {
                            if ($configContent -match '(?m)^(\s+)config_file:\s+"[^"]*"') {
                                $configContent = $configContent -replace '(?m)^(\s+)config_file:\s+"[^"]*"', "`$1config_file: `"config/quick_training_config.yaml`"`n`$1quick_training_mode: true"
                            }
                            else {
                                $configContent = $configContent -replace '(?m)^(\s+)rl_training:', "`$1rl_training:`n`$1  quick_training_mode: true"
                            }
                        }
                    }
                    
                    # Write with safe file writing
                    Write-SafeFile -FilePath $configFile -Content $configContent
                    Write-ColorOutput "[OK] Created automation_config.yaml" $Green
                }
        }
        else {
            $basicConfig = @"
azure:
  resource_group: "$resourceGroup"
  location: "$location"
  suffix: "$suffix"

data_pipeline:
  start_date: "2022-01-01"
  end_date: "2025-01-01"

rl_training:
  config_file: "config/quick_training_config.yaml"
  quick_training_mode: true
"@
            # Write with safe file writing
            Write-SafeFile -FilePath $configFile -Content $basicConfig
            Write-ColorOutput "[OK] Created basic automation_config.yaml" $Green
        }
            }
        
        $setupNeeded = $true
    }
    
    # Load configuration
    Load-Configuration
    
    # Check and create Azure resources
    $rg = $script:Config.Azure.ResourceGroup
    $location = $script:Config.Azure.Location
    if (-not $location) { $location = "northcentralus" }
    
    if ($rg) {
        Write-ColorOutput "Checking Resource Group: $rg" $Blue
        $rgExists = az group show --name $rg --output json 2>&1 | ConvertFrom-Json
        if (-not $rgExists) {
            if ($DryRun) {
                Write-ColorOutput "[DRY RUN] Would create Resource Group: $rg" $Yellow
            }
            else {
                Write-ColorOutput "Resource Group does not exist. Creating..." $Yellow
                az group create --name $rg --location $location 2>&1 | Out-Null
                Write-ColorOutput "[OK] Resource Group created" $Green
            }
        }
        else {
            Write-ColorOutput "[OK] Resource Group exists" $Green
        }
        
        # Check SQL Server
        $suffix = $script:Config.Azure.Suffix
        if ($suffix) {
            $sqlServerName = "sql-wealtharena-$suffix"
            Write-ColorOutput "Checking SQL Server: $sqlServerName" $Blue
            $sqlServers = az sql server list --resource-group $rg --output json 2>&1 | ConvertFrom-Json
            $sqlExists = $sqlServers | Where-Object { $_.name -eq $sqlServerName }
            if (-not $sqlExists) {
                if ($DryRun) {
                    Write-ColorOutput "[DRY RUN] Would create SQL Server: $sqlServerName" $Yellow
                    Write-ColorOutput "[DRY RUN] Would create database: wealtharena_db" $Yellow
                }
                else {
                    Write-ColorOutput "SQL Server does not exist. Creating..." $Yellow
                    Write-ColorOutput "This will prompt for SQL admin username and password." $Blue
                    $sqlAdmin = Read-Host "SQL Server Admin Username"
                    $secureSqlPwd = Read-Host "SQL Server Admin Password" -AsSecureString
                    $sqlPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSqlPwd)
                    )
                    
                    az sql server create --name $sqlServerName --resource-group $rg --location $location --admin-user $sqlAdmin --admin-password $sqlPwd 2>&1 | Out-Null
                    
                    # Create database
                    $dbName = "wealtharena_db"
                    Write-ColorOutput "Creating database: $dbName" $Blue
                    az sql db create --resource-group $rg --server $sqlServerName --name $dbName --service-objective Basic 2>&1 | Out-Null
                    
                    Write-ColorOutput "[OK] SQL Server and database created" $Green
                    Write-ColorOutput "  Server: $sqlServerName.database.windows.net" $Green
                    Write-ColorOutput "  Database: $dbName" $Green
                    Write-ColorOutput "  Username: $sqlAdmin" $Green
                    Write-Host ""
                    Write-ColorOutput "Please note these SQL credentials. They will be needed for Phase 3." $Yellow
                    Wait-ForUserConfirmation -Message "Have you noted the SQL credentials? Type Y to continue"
                }
            }
            else {
                Write-ColorOutput "[OK] SQL Server exists" $Green
            }
        }
        
        # Check Storage Account
        $storageAccountName = "stwealtharena$suffix"
        if ($storageAccountName.Length -gt 24) {
            $storageAccountName = "stwea$suffix"
        }
        Write-ColorOutput "Checking Storage Account: $storageAccountName" $Blue
        $storageAccounts = az storage account list --resource-group $rg --output json 2>&1 | ConvertFrom-Json
        $storageExists = $storageAccounts | Where-Object { $_.name -eq $storageAccountName }
        if (-not $storageExists) {
            if ($DryRun) {
                Write-ColorOutput "[DRY RUN] Would create Storage Account: $storageAccountName" $Yellow
            }
            else {
                Write-ColorOutput "Storage Account does not exist. Creating..." $Yellow
                az storage account create --name $storageAccountName --resource-group $rg --location $location --sku Standard_LRS --kind StorageV2 2>&1 | Out-Null
                Write-ColorOutput "[OK] Storage Account created" $Green
            }
        }
        else {
            Write-ColorOutput "[OK] Storage Account exists" $Green
        }
    }
    
    # STEP 4: Check and verify database credentials (skip prompts if already configured)
    if ($script:MinimalSetup) {
        Write-ColorOutput "[SKIP] Skipping Azure SQL credential verification in minimal setup (handled in Phase 3)" $Yellow
    } else {
        Write-Host ""
        Write-ColorOutput "STEP 4: Checking Azure SQL Database credentials..." $Blue
        
        $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
        $sqlEnvPath = Join-Path $dataPipelineDir "sqlDB.env"
        $sqlEnvExample = Join-Path $dataPipelineDir "sqlDB.env.example"
        
        $needsSqlConfig = $false
        $connectionVerified = $false
        
        if (-not (Test-Path $sqlEnvPath)) {
            $needsSqlConfig = $true
            if (Test-Path $sqlEnvExample) {
                Copy-Item $sqlEnvExample $sqlEnvPath
                Write-ColorOutput "Created sqlDB.env from example" $Yellow
            }
        }
        else {
            # Check for placeholders first
            $envContent = Get-Content $sqlEnvPath -Raw
            $placeholders = @('your-sql-server', 'your_server', 'localhost', 'your_database', 'your_db', 'your_username', 'your_user', 'your_password', 'your_password_here', 'password', '123456', 'your_account_name', 'your_account_key_here')
            $hasPlaceholder = $false
            foreach ($placeholder in $placeholders) {
                if ($envContent -match [regex]::Escape($placeholder)) {
                    $hasPlaceholder = $true
                    break
                }
            }
            
            if ($hasPlaceholder) {
                $needsSqlConfig = $true
                Write-ColorOutput "Placeholder credentials detected in sqlDB.env" $Yellow
            }
            else {
                # sqlDB.env exists and has non-placeholder values - test connection automatically
                Write-ColorOutput "sqlDB.env found with configured credentials. Testing connection..." $Blue
                try {
                    $testScript = @'
import sys
import os
from pathlib import Path
# Use current working directory instead of __file__ (which doesn't exist with -c)
sys.path.insert(0, os.getcwd())
from dbConnection import get_conn
try:
    conn = get_conn()
    conn.close()
    print('CONNECTION_OK')
except Exception as e:
    print(f'CONNECTION_FAILED: {e}')
'@
                    # Change to data-pipeline directory for dbConnection import
                    $originalLocation = Get-Location
                    Set-Location $dataPipelineDir
                    
                    try {
                        if ($pythonCmd -match " ") {
                            $pyCmdParts = $pythonCmd -split " ", 2
                            $testOutput = & $pyCmdParts[0] $pyCmdParts[1] -c $testScript 2>&1
                        }
                        else {
                            $testOutput = & $pythonCmd -c $testScript 2>&1
                        }
                        
                        Set-Location $originalLocation
                        
                        if ($testOutput -match "CONNECTION_OK") {
                            $connectionVerified = $true
                            Write-ColorOutput "[CHECK] [OK] Database connection verified successfully" $Green
                            Write-PhaseLog "Database connection verified from sqlDB.env"
                        }
                        elseif ($testOutput -match "CONNECTION_FAILED") {
                            $needsSqlConfig = $true
                            $errorMsg = ($testOutput -split "`n" | Where-Object { $_ -match "CONNECTION_FAILED" } | Select-Object -First 1)
                            Write-ColorOutput "[CAUTION] Connection test failed: $errorMsg" $Yellow
                            Write-PhaseLog "Database connection test failed: $testOutput"
                            
                            # Enhanced error message with Azure CLI commands
                            Show-FirewallGuidance -Config $script:Config
                        }
                        else {
                            # Connection test couldn't be determined
                            Write-ColorOutput "[WAIT] Could not verify connection. Will prompt for credentials." $Yellow
                            $needsSqlConfig = $true
                        }
                    }
                    catch {
                        Set-Location $originalLocation
                        Write-ColorOutput "[WAIT] Could not test connection: $_" $Yellow
                        Write-PhaseLog "Connection test error: $_"
                        $needsSqlConfig = $true
                    }
                }
                catch {
                    Write-ColorOutput "[WAIT] Could not test connection: $_" $Yellow
                    Write-PhaseLog "Connection test setup error: $_"
                    $needsSqlConfig = $true
                }
            }
        }
        
        # Only prompt for credentials if needed and connection is not verified
        if ($needsSqlConfig -and -not $connectionVerified) {
            Write-Host ""
            Write-ColorOutput "Please provide your Azure SQL Database credentials:" $Cyan
            Write-Host ""
            
            # Try to get from existing config if available
            $suffix = $script:Config.Azure.Suffix
            $defaultServer = if ($suffix) { "sql-wealtharena-$suffix.database.windows.net" } else { "" }
            $defaultDb = "wealtharena_db"
            
            if ($defaultServer) {
                Write-ColorOutput "Default server (from config): $defaultServer" $Cyan
                $sqlServer = Read-Host "Azure SQL Server [$defaultServer]"
                if ([string]::IsNullOrWhiteSpace($sqlServer)) {
                    $sqlServer = $defaultServer
                }
            }
            else {
                $sqlServer = Read-Host "Azure SQL Server (e.g., myserver.database.windows.net)"
            }
            
            Write-ColorOutput "Default database (from config): $defaultDb" $Cyan
            $sqlDb = Read-Host "Database name [$defaultDb]"
            if ([string]::IsNullOrWhiteSpace($sqlDb)) {
                $sqlDb = $defaultDb
            }
            
            $sqlUser = Read-Host "SQL Username"
            $securePwd = Read-Host "SQL Password" -AsSecureString
            $sqlPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
            )
            
            # Update sqlDB.env
            $envContent = Get-Content $sqlEnvPath -Raw
            $envContent = $envContent -replace "(?m)^SQL_SERVER=.*", "SQL_SERVER=$sqlServer"
            $envContent = $envContent -replace "(?m)^SQL_DB=.*", "SQL_DB=$sqlDb"
            $envContent = $envContent -replace "(?m)^SQL_UID=.*", "SQL_UID=$sqlUser"
            $envContent = $envContent -replace "(?m)^SQL_PWD=.*", "SQL_PWD=$sqlPwd"
            
            Set-Content -Path $sqlEnvPath -Value $envContent -NoNewline
            Write-ColorOutput "[OK] Updated sqlDB.env with your credentials" $Green
            
            # Test connection with retry loop after updating credentials
            Write-ColorOutput "[SEARCH] Testing database connection..." $Blue
            $originalLocation = Get-Location
            Set-Location $dataPipelineDir
            
            try {
                $connectionTest = Test-PrerequisiteWithRetry -TestScript {
                    # Ensure we're in the data-pipeline directory for the import
                    $originalTestLocation = Get-Location
                    Set-Location $dataPipelineDir
                    try {
                        $testScript = @'
import sys
import os
from pathlib import Path
# Use current working directory instead of __file__ (which doesn't exist with -c)
sys.path.insert(0, os.getcwd())
from dbConnection import get_conn
try:
    conn = get_conn()
    conn.close()
    print('CONNECTION_OK')
except Exception as e:
    print(f'CONNECTION_FAILED: {e}')
'@
                    if ($pythonCmd -match " ") {
                        $pyCmdParts = $pythonCmd -split " ", 2
                        $testOutput = & $pyCmdParts[0] $pyCmdParts[1] -c $testScript 2>&1
                    }
                    else {
                        $testOutput = & $pythonCmd -c $testScript 2>&1
                    }
                    return $testOutput -match "CONNECTION_OK"
                }
                finally {
                    Set-Location $originalTestLocation
                }
            } -FailureMessage "[CAUTION] Database connection test failed. Please check SQL credentials and firewall rules." -InstructionMessage (Get-FirewallGuidanceMessage -Config $script:Config) -MaxRetries 3
            
                Set-Location $originalLocation
                
                if (-not $connectionTest) {
                    Write-ColorOutput "[WAIT] Connection test failed. This will be checked again in Phase 3." $Yellow
                }
                else {
                    Write-ColorOutput "[CHECK] [OK] Connection test successful" $Green
                    $connectionVerified = $true
                }
            }
            catch {
                Set-Location $originalLocation
                Write-ColorOutput "[WAIT] Connection test error: $_" $Yellow
            }
            
            # Note: User may need to add firewall rule - this will be handled in Phase 3 if needed
            if (-not $connectionVerified) {
                Write-Host ""
                Write-ColorOutput "Note: You may need to add your IP address to Azure SQL firewall rules." $Yellow
                Write-ColorOutput "  This will be checked automatically in Phase 3." $Yellow
                Show-FirewallGuidance -Config $script:Config
            }
        }
        else {
            if ($connectionVerified) {
                Write-ColorOutput "[CHECK] [OK] Azure SQL configuration verified" $Green
            }
            else {
                Write-ColorOutput "[CHECK] [OK] Azure SQL configuration file exists" $Green
            }
        }
    }
    
    # STEP 5: Ensure quick training config has 50 stocks
    if ($script:MinimalSetup) {
        Write-ColorOutput "[SKIP] Skipping training config verification in minimal setup" $Yellow
    } else {
        Write-Host ""
        Write-ColorOutput "STEP 5: Verifying training configuration..." $Blue
        # Join-Path only accepts two arguments, so build the path step by step
        $rlTrainingDirPath = Join-Path $script:ScriptDir "rl-training"
        $configDirPath = Join-Path $rlTrainingDirPath "config"
        $quickConfigPath = Join-Path $configDirPath "quick_training_config.yaml"
        if (Test-Path $quickConfigPath) {
            $quickConfigContent = Get-Content $quickConfigPath -Raw
            if ($quickConfigContent -notmatch "max_symbols: 50") {
                if ($quickConfigContent -match "max_symbols: \d+") {
                    $quickConfigContent = $quickConfigContent -replace "max_symbols: \d+", "max_symbols: 50"
                }
                else {
                    $quickConfigContent = $quickConfigContent -replace "(data:)", "`$1`n  max_symbols: 50  # Limit to 50 stocks for quick training"
                }
                Set-Content -Path $quickConfigPath -Value $quickConfigContent -NoNewline
                Write-ColorOutput "[OK] Quick training config set to 50 stocks" $Green
            }
            else {
                Write-ColorOutput "[OK] Quick training config already set to 50 stocks" $Green
            }
        }
    }
    
    # STEP 6: Training Speed Mode Selection
    if ($script:MinimalSetup) {
        Write-ColorOutput "[SKIP] Skipping training speed selection in minimal setup" $Yellow
        Write-Host ""
        Write-ColorOutput "[SUCCESS] Minimal setup checks complete. Ready to run from Phase $StartFromPhase." $Green
        Write-Host ""
    } else {
    Write-Host ""
    Write-ColorOutput "STEP 6: Selecting training speed mode..." $Blue
    Write-PhaseLog "Selecting training speed mode"
    
    # Map TrainingSpeed to config file and metadata
    $trainingSpeedModes = @{
        "fastest" = @{ config = "fastest_training_config.yaml"; iterations = 50; duration = "10-15 minutes"; description = "Smoke test - verify setup works" }
        "faster" = @{ config = "faster_training_config.yaml"; iterations = 100; duration = "30-45 minutes"; description = "Quick validation" }
        "fast" = @{ config = "fast_training_config.yaml"; iterations = 200; duration = "1-1.5 hours"; description = "Fast development testing" }
        "quick" = @{ config = "quick_training_config.yaml"; iterations = 500; duration = "2.5-5 hours"; description = "Recommended for testing" }
        "slow" = @{ config = "slow_training_config.yaml"; iterations = 1000; duration = "8-12 hours"; description = "Comprehensive training" }
        "full" = @{ config = "production_config.yaml"; iterations = 2000; duration = "24+ hours"; description = "Production model training" }
    }
    
    # Handle backwards compatibility: if QuickTraining is set, map to appropriate speed
    if ($QuickTraining -and -not $PSBoundParameters.ContainsKey('TrainingSpeed')) {
        $TrainingSpeed = "quick"
        Write-ColorOutput "[NOTE] QuickTraining parameter is deprecated. Using TrainingSpeed='quick' instead." $Yellow
    }
    
    # Determine training speed (from parameter, config, or prompt)
    $selectedSpeed = $TrainingSpeed
    if ($PSBoundParameters.ContainsKey('TrainingSpeed')) {
        # Explicitly passed as parameter
        Write-ColorOutput "[CHECK] Using training speed from parameter: $selectedSpeed" $Green
        Write-PhaseLog "Using training speed from parameter: $selectedSpeed"
    }
    elseif ($script:Config -and $script:Config.RLTraining -and $script:Config.RLTraining.TrainingSpeed) {
        $selectedSpeed = $script:Config.RLTraining.TrainingSpeed
        Write-ColorOutput "[CHECK] Using training speed from config: $selectedSpeed" $Green
        Write-PhaseLog "Using training speed from config: $selectedSpeed"
    }
    elseif (-not $NonInteractive) {
        # No config value, prompt user
        Write-Host ""
        Write-ColorOutput "[SEARCH] Training speed not selected. Please choose:" $Cyan
        $trainingOptions = @(
            "Fastest (50 iterations, 10-15 min) - Smoke test to verify setup works",
            "Faster (100 iterations, 30-45 min) - Quick validation",
            "Fast (200 iterations, 1-1.5 hours) - Fast development testing",
            "Quick (500 iterations, 2.5-5 hours) - Recommended for testing",
            "Slow (1000 iterations, 8-12 hours) - Comprehensive training",
            "Full (2000 iterations, 24+ hours) - Production model training"
        )
        
        $selectedChoice = Request-UserChoice -Options $trainingOptions -Prompt "Select training speed mode"
        $speedKeys = @("fastest", "faster", "fast", "quick", "slow", "full")
        if ($selectedChoice -ge 1 -and $selectedChoice -le $speedKeys.Count) {
            $selectedSpeed = $speedKeys[$selectedChoice - 1]
        }
        else {
            $selectedSpeed = "quick"  # Default fallback
        }
        
        if ($trainingSpeedModes.ContainsKey($selectedSpeed)) {
            $speedInfo = $trainingSpeedModes[$selectedSpeed]
            Write-ColorOutput "[CHECK] Selected: $($selectedSpeed.ToUpper()) mode ($($speedInfo.iterations) iterations, $($speedInfo.duration))" $Green
            Write-PhaseLog "User selected $selectedSpeed training speed mode"
        }
    }
    
    if (-not $trainingSpeedModes.ContainsKey($selectedSpeed)) {
        Write-ColorOutput "[WARNING] Invalid training speed '$selectedSpeed'. Defaulting to 'quick'." $Yellow
        $selectedSpeed = "quick"
    }
    
    # Set QuickTraining for backwards compatibility (deprecated)
    $script:QuickTraining = ($selectedSpeed -eq "quick")
    
    # Store selected speed for use in Phase 5
    $script:SelectedTrainingSpeed = $selectedSpeed
    
    # Update config file with selected training speed if config file exists
    if ($script:Config -and $ConfigFile -and (Test-Path $ConfigFile)) {
        try {
            if ($script:YamlLoaded) {
                # Use structured YAML update when powershell-yaml is available
                $configContent = Get-Content $configFile -Raw | ConvertFrom-Yaml -Ordered
                
                # Ensure rl_training section exists
                if (-not $configContent.rl_training) {
                    $configContent.rl_training = @{}
                }
                
                # Update with new TrainingSpeed parameter
                $configContent.rl_training.training_speed = $selectedSpeed
                $speedInfo = $trainingSpeedModes[$selectedSpeed]
                $configContent.rl_training.config_file = "config/$($speedInfo.config)"
                
                # Keep deprecated quick_training_mode for backwards compatibility
                $configContent.rl_training.quick_training_mode = ($selectedSpeed -eq "quick")
                
                # Write back using ConvertTo-Yaml with safe file writing
                $yamlOutput = $configContent | ConvertTo-Yaml
                Write-SafeFile -FilePath $ConfigFile -Content $yamlOutput
                Write-ColorOutput "[OK] Updated automation_config.yaml with training speed: $selectedSpeed" $Green
                Write-PhaseLog "Updated automation_config.yaml with training speed: $selectedSpeed"
            }
            else {
                # Fallback to regex-based replacement with improved anchors
                $configContent = Get-Content $ConfigFile -Raw
                if ($script:QuickTraining) {
                    # Anchor to start of line and scope to rl_training section
                    $configContent = $configContent -replace '(?m)^(\s+)config_file:\s+"[^"]*"', "`$1config_file: `"config/quick_training_config.yaml`""
                    $configContent = $configContent -replace '(?m)^(\s+)quick_training_mode:\s+false', "`$1quick_training_mode: true"
                    if ($configContent -notmatch '(?m)^(\s+)quick_training_mode:') {
                        # Add quick_training_mode after config_file or rl_training:
                        if ($configContent -match '(?m)^(\s+)config_file:\s+"[^"]*"') {
                            $configContent = $configContent -replace '(?m)^(\s+)config_file:\s+"[^"]*"', "`$1config_file: `"config/quick_training_config.yaml`"`n`$1quick_training_mode: true"
                        }
                        else {
                            $configContent = $configContent -replace '(?m)^(\s+)rl_training:', "`$1rl_training:`n`$1  quick_training_mode: true"
                        }
                    }
                }
                else {
                    $configContent = $configContent -replace '(?m)^(\s+)config_file:\s+"[^"]*"', "`$1config_file: `"config/production_config.yaml`""
                    $configContent = $configContent -replace '(?m)^(\s+)quick_training_mode:\s+true', "`$1quick_training_mode: false"
                    if ($configContent -notmatch '(?m)^(\s+)quick_training_mode:') {
                        if ($configContent -match '(?m)^(\s+)config_file:\s+"[^"]*"') {
                            $configContent = $configContent -replace '(?m)^(\s+)config_file:\s+"[^"]*"', "`$1config_file: `"config/production_config.yaml`"`n`$1quick_training_mode: false"
                        }
                        else {
                            $configContent = $configContent -replace '(?m)^(\s+)rl_training:', "`$1rl_training:`n`$1  quick_training_mode: false"
                        }
                    }
                }
                # Write with safe file writing
                Write-SafeFile -FilePath $ConfigFile -Content $configContent
                Write-ColorOutput "[OK] Updated automation_config.yaml with training speed: $selectedSpeed" $Green
                Write-PhaseLog "Updated automation_config.yaml with training speed: $selectedSpeed"
            }
        }
        catch {
            Write-ColorOutput "[WARNING] Could not update automation_config.yaml: $_" $Yellow
            Write-PhaseLog "Could not update automation_config.yaml: $_" "WARNING"
        }
    }
    
    Write-Host ""
    Write-ColorOutput "[SUCCESS] [OK] Setup complete! Ready to run automation." $Green
    Write-Host ""
    }
    
    if ($setupNeeded) {
        Write-ColorOutput "Configuration files have been created. Review them before continuing." $Yellow
        $confirmed = Wait-ForUserConfirmation -Message "Continue with automation? (Y/n) - Auto-continuing in 10 seconds" -TimeoutSeconds 10
        if (-not $confirmed) {
            Write-ColorOutput "Setup complete. Run the script again when ready." $Green
            exit 0
        }
    }
}

# Main execution
function Main {
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "WealthArena Master Automation Script" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN MODE - No actual changes will be made" $Yellow
        Write-Host ""
    }
    
    Initialize-LogFile
    
    # Run pre-initialization setup (DryRun checks are inside Initialize-AutomationEnvironment)
    Initialize-AutomationEnvironment
    
    # Load configuration early (needed for subscription setting)
    Load-Configuration
    
    # Set Azure subscription from config if provided (after config is loaded)
    if ($null -ne $script:Config -and $null -ne $script:Config.Azure -and -not [string]::IsNullOrWhiteSpace($script:Config.Azure.SubscriptionId)) {
        Write-ColorOutput "Setting Azure subscription to: $($script:Config.Azure.SubscriptionId)" $Blue
        Write-PhaseLog "Setting Azure subscription: $($script:Config.Azure.SubscriptionId)"
        try {
            az account set --subscription $script:Config.Azure.SubscriptionId 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $currentAccount = az account show --output json 2>&1 | ConvertFrom-Json
                Write-ColorOutput "✅ Subscription set to: $($currentAccount.name) ($($currentAccount.id))" $Green
                Write-PhaseLog "Azure subscription set successfully"
            } else {
                Write-ColorOutput "⚠️  Warning: Failed to set subscription. Using current subscription." $Yellow
                Write-PhaseLog "Failed to set subscription, continuing with current" "WARNING"
            }
        } catch {
            Write-ColorOutput "⚠️  Warning: Could not set subscription: $_. Continuing with current subscription." $Yellow
            Write-PhaseLog "Error setting subscription: $_" "WARNING"
        }
    }
    
    # Determine starting phase
    if ($Resume) {
        if (Load-AutomationState) {
            Write-ColorOutput "Resuming from last checkpoint..." $Blue
        }
        else {
            Write-ColorOutput "No previous state found, starting from beginning." $Yellow
            $script:AutomationState.CurrentPhase = 1
        }
    }
    elseif ($StartFromPhase -gt 0) {
        # Validate phase number
        if ($StartFromPhase -lt 1 -or $StartFromPhase -gt 12) {
            Write-ColorOutput "ERROR: StartFromPhase must be between 1 and 12" $Red
            throw "Invalid phase number: $StartFromPhase. Must be between 1 and 12."
        }
        
        Write-ColorOutput "Starting from phase $StartFromPhase..." $Blue
        
        # Validate prerequisites for Phase 4+
        if ($StartFromPhase -ge 4) {
            Write-ColorOutput "Validating prerequisites for Phase $StartFromPhase..." $Blue
            Write-PhaseLog "Validating prerequisites for Phase $StartFromPhase"
            
            # Check if database has processed data
            try {
                    $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
                    $pythonCmd = Find-PythonCommand
                    if ($pythonCmd) {
                        # Check processed_prices table
                        # Ensure we're in the data-pipeline directory for the import
                        $originalValidationLocation = Get-Location
                        Set-Location $dataPipelineDir
                        try {
                            $checkScript = @'
import sys
import os
from pathlib import Path
# Use current working directory instead of __file__ (which doesn't exist with -c)
sys.path.insert(0, os.getcwd())
from dbConnection import get_conn
conn = get_conn()
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM dbo.processed_prices')
row_count = cursor.fetchone()[0]
print(f'PROCESSED_ROWS={row_count}')
cursor.execute('SELECT COUNT(DISTINCT symbol) FROM dbo.processed_prices')
symbol_count = cursor.fetchone()[0]
print(f'PROCESSED_SYMBOLS={symbol_count}')
conn.close()
'@
                    
                            if ($pythonCmd -match " ") {
                                $pyCmdParts = $pythonCmd -split " ", 2
                                $pyExe = $pyCmdParts[0]
                                $pyArgs = $pyCmdParts[1]
                                $checkOutput = & $pyExe $pyArgs -c $checkScript 2>&1
                            }
                            else {
                                $checkOutput = & $pythonCmd -c $checkScript 2>&1
                            }
                            
                            $rowCount = 0
                            $symbolCount = 0
                            foreach ($line in $checkOutput) {
                                if ($line -match "PROCESSED_ROWS=(\d+)") {
                                    $rowCount = [int]$matches[1]
                                }
                                if ($line -match "PROCESSED_SYMBOLS=(\d+)") {
                                    $symbolCount = [int]$matches[1]
                                }
                            }
                            
                            if ($rowCount -gt 0 -and $symbolCount -gt 0) {
                                $successMsg = "Database has {0} rows across {1} symbols" -f $rowCount, $symbolCount
                                Write-ColorOutput $successMsg $Green
                                Write-PhaseLog "Database validation passed: $rowCount rows, $symbolCount symbols"
                            }
                            else {
                                Write-ColorOutput "WARNING: Database appears empty or not processed" $Yellow
                                Write-PhaseLog "Database validation warning: $rowCount rows, $symbolCount symbols" "WARNING"
                                if ($StartFromPhase -eq 4) {
                                    Write-ColorOutput "Phase 4 requires processed data. Consider running Phase 3 first." $Yellow
                                }
                            }
                        }
                        finally {
                            Set-Location $originalValidationLocation
                        }
                    }
                    else {
                        Write-ColorOutput "WARNING: Could not find Python to validate database" $Yellow
                    }
                }
            catch {
                $errorText = $_.ToString()
                # Limit error message to first line to avoid parsing issues with special characters
                $firstLine = ($errorText -split "`n" | Select-Object -First 1).Trim()
                # Replace asterisks with a safe alternative to prevent PowerShell parameter interpretation
                $safeErrorText = $firstLine -replace '\*', '[ASTERISK]'
                $errorMsg = "WARNING: Could not validate database prerequisites: " + $safeErrorText
                Write-ColorOutput -Message $errorMsg -Color "Yellow"
                Write-PhaseLog "Database validation failed: $_" "WARNING"
            }
        }
        
        $script:AutomationState.CurrentPhase = $StartFromPhase
    }
    else {
        $script:AutomationState.CurrentPhase = 1
    }
    
    # Load configuration first (needed for phase skip flags)
    Load-Configuration
    
    # Map phase_control config flags to skip switches if CLI switches not provided
    if ($script:Config.PhaseControl) {
        if (-not $SkipFrontendTest -and $script:Config.PhaseControl.SkipFrontendTest) {
            $SkipFrontendTest = $script:Config.PhaseControl.SkipFrontendTest
        }
        if (-not $SkipDataDownload -and $script:Config.PhaseControl.SkipDataDownload) {
            $SkipDataDownload = $script:Config.PhaseControl.SkipDataDownload
        }
        if (-not $SkipDataProcessing -and $script:Config.PhaseControl.SkipDataProcessing) {
            $SkipDataProcessing = $script:Config.PhaseControl.SkipDataProcessing
        }
        if (-not $SkipRLTraining -and $script:Config.PhaseControl.SkipRLTraining) {
            $SkipRLTraining = $script:Config.PhaseControl.SkipRLTraining
        }
        if (-not $SkipDeployment -and $script:Config.PhaseControl.SkipDeployment) {
            $SkipDeployment = $script:Config.PhaseControl.SkipDeployment
        }
        if (-not $SkipAPKBuild -and $script:Config.PhaseControl.SkipAPKBuild) {
            $SkipAPKBuild = $script:Config.PhaseControl.SkipAPKBuild
        }
    }
    
    # Determine Phase 4 skip flag (can skip if training is skipped or dedicated flag set)
    $skipDataExport = $false
    if ($script:Config.PhaseControl.SkipDataExport) {
        $skipDataExport = $script:Config.PhaseControl.SkipDataExport
    }
    # Also skip if RL training is skipped (no point exporting data for training that won't happen)
    if ($SkipRLTraining) {
        $skipDataExport = $true
    }
    
    # Define phases (must be defined before first use)
    $phases = @(
        @{ Name = "Frontend Test"; Skip = $SkipFrontendTest; Invoke = { Invoke-Phase1-FrontendTest } },
        @{ Name = "Data Download"; Skip = $SkipDataDownload; Invoke = { Invoke-Phase2-DataDownload } },
        @{ Name = "Data Processing"; Skip = $SkipDataProcessing; Invoke = { Invoke-Phase3-DataProcessing } },
        @{ Name = "Data Export"; Skip = $skipDataExport; Invoke = { Invoke-Phase4-DataExport } },
        @{ Name = "RL Training"; Skip = $SkipRLTraining; Invoke = { Invoke-Phase5-RLTraining } },
        @{ Name = "Azure Verification"; Skip = $false; Invoke = { Invoke-Phase6-AzureVerification } },
        @{ Name = "Service Deployment"; Skip = $SkipDeployment; Invoke = { Invoke-Phase7-ServiceDeployment } },
        @{ Name = "Data Pipeline Functions"; Skip = $false; Invoke = { Invoke-Phase7-5-DataPipelineFunctions } },
        @{ Name = "Model Upload"; Skip = $false; Invoke = { Invoke-Phase8-ModelUpload } },
        @{ Name = "Frontend Config"; Skip = $false; Invoke = { Invoke-Phase9-FrontendConfig } },
        @{ Name = "E2E Testing"; Skip = $false; Invoke = { Invoke-Phase10-E2ETesting } },
        @{ Name = "APK Build"; Skip = $SkipAPKBuild; Invoke = { Invoke-Phase11-APKBuild } },
        @{ Name = "Maintenance Cleanup"; Skip = -not $RunMaintenance; Invoke = { Invoke-Phase12-Maintenance } }
    )
    
    # Display phase execution plan
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput " " * 12 + "PHASE EXECUTION PLAN" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    
    $startPhaseNum = $script:AutomationState.CurrentPhase
    Write-ColorOutput "Starting from Phase $startPhaseNum" $White
    
    $phasesToExecute = @()
    $phasesToSkip = @()
    
    for ($i = 0; $i -lt $phases.Count; $i++) {
        $phaseNum = $i + 1
        $phase = $phases[$i]
        
        if ($phaseNum -lt $startPhaseNum) {
            $phasesToSkip += "Phase $phaseNum : $($phase.Name)"
        }
        elseif ($phase.Skip) {
            $phasesToSkip += "Phase $phaseNum : $($phase.Name)"
        }
        else {
            $phasesToExecute += "Phase $phaseNum : $($phase.Name)"
        }
    }
    
    if ($phasesToExecute.Count -gt 0) {
        Write-ColorOutput "Phases to Execute:" $Green
        foreach ($phase in $phasesToExecute) {
            Write-ColorOutput "  - $phase" $Green
        }
    }
    
    if ($phasesToSkip.Count -gt 0) {
        Write-ColorOutput "Phases to Skip:" $Yellow
        foreach ($phase in $phasesToSkip) {
            Write-ColorOutput "  - $phase (Skipped)" $Yellow
        }
    }
    
    Write-Host ""
    
    # Check if config is missing before critical phases (2-7)
    # Skip this check if ForceDefaults flag is set
    if ($script:ConfigMissing -and -not $ForceDefaults) {
        $criticalPhaseNumbers = @(2, 3, 4, 5, 6, 7)
        $willRunCriticalPhase = $false
        
        # Check if any critical phase will be run (not skipped and starting from or before it)
        for ($i = 0; $i -lt $phases.Count; $i++) {
            $phaseNum = $i + 1
            if ($criticalPhaseNumbers -contains $phaseNum) {
                # Check if this phase will be executed
                if ($phaseNum -ge $script:AutomationState.CurrentPhase -and -not $phases[$i].Skip) {
                    $willRunCriticalPhase = $true
                    break
                }
            }
        }
        
        if ($willRunCriticalPhase) {
            $errorMsg = "ERROR: Configuration file '{0}' is required for phases 2-7!" -f $ConfigFile
            Write-ColorOutput $errorMsg $Red
            Write-ColorOutput "   Starting from phase: $($script:AutomationState.CurrentPhase)" $Red
            Write-PhaseLog "Config file missing and critical phase will run" "ERROR"
            $exampleFile = "automation_config.example.yaml"
            if (Test-Path $exampleFile) {
                Write-ColorOutput "   Copy from example: Copy-Item $exampleFile $ConfigFile" $Yellow
            }
            Write-ColorOutput "   Or skip critical phases with: -SkipDataDownload -SkipDataProcessing -SkipRLTraining -SkipDeployment" $Yellow
            Write-ColorOutput "   Or use override flag: -ForceDefaults" $Yellow
            throw "Configuration file '$ConfigFile' is required. Copy from automation_config.example.yaml and configure it, or use -ForceDefaults flag."
        }
    }
    
    # Execute phases
    for ($i = $script:AutomationState.CurrentPhase - 1; $i -lt $phases.Count; $i++) {
        $phase = $phases[$i]
        $phaseNumber = $i + 1
        
        $script:AutomationState.CurrentPhase = $phaseNumber
        $script:PhaseStartTime[$phaseNumber] = Get-Date
        
        # Skip if phase is before StartFromPhase
        if ($StartFromPhase -gt 0 -and $phaseNumber -lt $StartFromPhase) {
            Write-ColorOutput "Skipping phase $phaseNumber : $($phase.Name) (starting from Phase $StartFromPhase)" $Yellow
            Write-PhaseLog "Skipping Phase $phaseNumber (starting from Phase $StartFromPhase)"
            $script:PhaseStatus[$phaseNumber] = "SKIPPED"
            $script:PhaseEndTime[$phaseNumber] = Get-Date
            Save-AutomationState
            continue
        }
        
        if ($phase.Skip) {
            Write-ColorOutput "Skipping phase $phaseNumber : $($phase.Name)" $Yellow
            $script:PhaseStatus[$phaseNumber] = "SKIPPED"
            $script:PhaseEndTime[$phaseNumber] = Get-Date
            Save-AutomationState
            continue
        }
        
        try {
            # Check phase prerequisites before execution
            $prereqFunctionName = "Test-Phase$phaseNumber`Prerequisites"
            if (Get-Command $prereqFunctionName -ErrorAction SilentlyContinue) {
                Write-ColorOutput "[SEARCH] Checking Phase $phaseNumber prerequisites..." $Blue
                $prereqCheck = & $prereqFunctionName
                if (-not $prereqCheck.Success) {
                    Write-ColorOutput "[CAUTION] Prerequisites not met: $($prereqCheck.Message)" $Yellow
                    $userChoice = Request-UserChoice -Options @(
                        "Retry prerequisite check",
                        "Skip this phase",
                        "Abort automation"
                    ) -Prompt "Phase $phaseNumber prerequisites failed. What would you like to do?"
                    
                    if ($userChoice -eq 1) {
                        $fixed = Test-PrerequisiteWithRetry -TestScript {
                            $check = & $prereqFunctionName
                            return $check.Success
                        } -FailureMessage $prereqCheck.Message -InstructionMessage "Please fix the issues above and press Y when ready to retry." -MaxRetries 3
                        
                        if (-not $fixed) {
                            Write-ColorOutput "Prerequisites still not met. Skipping phase." $Yellow
                            $script:PhaseStatus[$phaseNumber] = "SKIPPED"
                            $script:PhaseEndTime[$phaseNumber] = Get-Date
                            Save-AutomationState
                            continue
                        }
                    }
                    elseif ($userChoice -eq 2) {
                        Write-ColorOutput "Skipping Phase $phaseNumber..." $Yellow
                        $script:PhaseStatus[$phaseNumber] = "SKIPPED"
                        $script:PhaseEndTime[$phaseNumber] = Get-Date
                        Save-AutomationState
                        continue
                    }
                    else {
                        Write-ColorOutput "Automation aborted by user." $Red
                        Write-PhaseLog "Automation aborted by user due to Phase $phaseNumber prerequisites"
                        break
                    }
                }
                else {
                    Write-ColorOutput "[CHECK] $($prereqCheck.Message)" $Green
                }
            }
            
            Write-Host ""
            Write-ColorOutput "========================================" $Cyan
            Write-ColorOutput "[EXEC] Executing Phase $phaseNumber : $($phase.Name)" $Cyan
            Write-ColorOutput "========================================" $Cyan
            Write-Host ""
            
            $success = & $phase.Invoke
            $script:PhaseEndTime[$phaseNumber] = Get-Date
            $script:PhaseStatus[$phaseNumber] = if ($success) { "COMPLETED" } else { "FAILED" }
            
            if ($success) {
                $script:AutomationState.CompletedPhases += $phaseNumber
                Save-AutomationState
                Write-Host ""
                Write-ColorOutput "[SUCCESS] [OK] Phase $phaseNumber completed successfully!" $Green
                
                # Calculate phase duration
                $phaseDuration = $script:PhaseEndTime[$phaseNumber] - $script:PhaseStartTime[$phaseNumber]
                Write-ColorOutput "  Duration: $($phaseDuration.ToString('hh\:mm\:ss'))" $White
                
                # Check if there are more phases to execute
                $nextPhaseNum = $phaseNumber + 1
                if ($nextPhaseNum -le $phases.Count) {
                    $nextPhase = $phases[$nextPhaseNum - 1]
                    if (-not $nextPhase.Skip) {
                        Write-ColorOutput "[WAIT] Phase $phaseNumber completed successfully. Moving to Phase $nextPhaseNum : $($nextPhase.Name)..." $Cyan
                        Write-PhaseLog "Phase $phaseNumber completed, moving to Phase $nextPhaseNum"
                        Show-CountdownTimer -Seconds 3 -Message "Starting Phase $nextPhaseNum in"
                    }
                    else {
                        Write-ColorOutput "Phase $nextPhaseNum is skipped. Moving to next available phase..." $Yellow
                    }
                }
                else {
                    Write-ColorOutput "[SUCCESS] All phases completed!" $Green
                }
            }
            else {
                $script:AutomationState.FailedPhases += $phaseNumber
                Save-AutomationState
                Write-Host ""
                Write-ColorOutput "[CAUTION] [FAIL] Phase $phaseNumber failed." $Red
                
                # Track retry attempts per phase (initialize if not exists)
                if (-not $script:PhaseRetryCount) {
                    $script:PhaseRetryCount = @{}
                }
                if (-not $script:PhaseRetryCount.ContainsKey($phaseNumber)) {
                    $script:PhaseRetryCount[$phaseNumber] = 0
                }
                
                $maxRetries = 2  # Maximum number of retries per phase
                $retryCount = $script:PhaseRetryCount[$phaseNumber]
                $canRetry = $retryCount -lt $maxRetries
                
                # In non-interactive mode, skip retry and abort after first failure
                if ($NonInteractive) {
                    Write-ColorOutput "[NON-INTERACTIVE] Phase $phaseNumber failed. Skipping retry and aborting automation." $Red
                    Write-ColorOutput "  Fix the issue and run the script again with: -StartFromPhase $phaseNumber" $Yellow
                    Write-PhaseLog "Non-interactive mode: Phase $phaseNumber failed, aborting automation"
                    break
                }
                
                # Build options based on retry count
                $options = @()
                if ($canRetry) {
                    $options += "Retry Phase $phaseNumber (attempt $($retryCount + 1)/$maxRetries)"
                }
                $options += "Skip Phase $phaseNumber"
                $options += "Abort automation"
                
                $userChoice = Request-UserChoice -Options $options -Prompt "Phase $phaseNumber failed. What would you like to do?"
                
                $retryOptionIndex = if ($canRetry) { 1 } else { 0 }
                $skipOptionIndex = if ($canRetry) { 2 } else { 1 }
                
                if ($canRetry -and $userChoice -eq $retryOptionIndex) {
                    $script:PhaseRetryCount[$phaseNumber]++
                    Write-ColorOutput "Retrying Phase $phaseNumber (attempt $($script:PhaseRetryCount[$phaseNumber])/$maxRetries)..." $Blue
                    $i--  # Go back one iteration to retry
                    continue
                }
                elseif ($userChoice -eq $skipOptionIndex) {
                    Write-ColorOutput "Skipping Phase $phaseNumber..." $Yellow
                    $script:PhaseStatus[$phaseNumber] = "SKIPPED"
                    Save-AutomationState
                    continue
                }
                else {
                    # Abort automation (option 3 if retry available, option 2 if not)
                    Write-ColorOutput "Automation aborted by user." $Red
                    Write-ColorOutput "  Fix the issue and run the script again with: -StartFromPhase $phaseNumber" $Yellow
                    Write-PhaseLog "Automation aborted by user due to Phase $phaseNumber failure"
                    break
                }
            }
        }
        catch {
            $script:PhaseStatus[$phaseNumber] = "ERROR"
            $script:PhaseEndTime[$phaseNumber] = Get-Date
            $script:AutomationState.FailedPhases += $phaseNumber
            Save-AutomationState
            Write-ColorOutput "Phase $phaseNumber encountered an error: $_" $Red
            break
        }
        
        if (-not $DryRun) {
            Save-AutomationState
        }
    }
    
    # Run maintenance cleanup if requested (after all phases complete)
    if ($RunMaintenance -and -not $DryRun) {
        Write-Host ""
        Write-ColorOutput "========================================" $Cyan
        Write-ColorOutput "Running Maintenance Cleanup" $Cyan
        Write-ColorOutput "========================================" $Cyan
        Write-Host ""
        
        try {
            $maintenanceResult = Invoke-Phase12-Maintenance
            if ($maintenanceResult) {
                Write-ColorOutput "Maintenance cleanup completed successfully" $Green
            } else {
                Write-ColorOutput "Maintenance cleanup completed with warnings" $Yellow
            }
        }
        catch {
            Write-ColorOutput "Maintenance cleanup failed: $_" $Red
            Write-PhaseLog "Maintenance cleanup error: $_" "ERROR"
        }
    }
    
    # Generate final report
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "AUTOMATION SUMMARY" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    
    $totalTime = (Get-Date) - $script:AutomationState.StartTime
    Write-ColorOutput "Total execution time: $($totalTime.ToString('hh\:mm\:ss'))" $White
    
    $script:AutomationState.EndTime = Get-Date
    Save-AutomationState
    
    # Generate detailed report file
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $reportFile = Join-Path $LogDir "automation_report_$timestamp.md"
    
    # Define bold marker once to avoid parsing issues
    $boldMarker = '**'
    
    # Build report using string concatenation to avoid here-string parsing issues
    $report = "# WealthArena Automation Report`n`n"
    $report += "$boldMarker Generated: $boldMarker " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "`n"
    $report += "$boldMarker Total Duration: $boldMarker " + $totalTime.ToString('hh\:mm\:ss') + "`n`n"
    $report += "## Summary`n`n"
    $report += "- $boldMarker Completed Phases: $boldMarker $($script:AutomationState.CompletedPhases.Count)`n"
    $report += "- $boldMarker Failed Phases: $boldMarker $($script:AutomationState.FailedPhases.Count)`n"
    $report += "- $boldMarker Started: $boldMarker $($script:AutomationState.StartTime.ToString("yyyy-MM-dd HH:mm:ss"))`n"
    $report += "- $boldMarker Ended: $boldMarker $($script:AutomationState.EndTime.ToString("yyyy-MM-dd HH:mm:ss"))`n`n"
    $report += "## Phase Status`n`n"
    
    for ($i = 0; $i -lt $phases.Count; $i++) {
        $phaseNum = $i + 1
        $phaseName = $phases[$i].Name
        $status = $script:PhaseStatus[$phaseNum]
        
        $duration = ""
        if ($script:PhaseStartTime[$phaseNum] -and $script:PhaseEndTime[$phaseNum]) {
            $phaseDuration = $script:PhaseEndTime[$phaseNum] - $script:PhaseStartTime[$phaseNum]
            $durationStr = $phaseDuration.ToString('hh\:mm\:ss')
            $duration = " ($durationStr)"
        }
        
        $report += "- ${boldMarker} Phase $phaseNum ${boldMarker}: $phaseName - $status$duration`n"
    }
    
    $report += "`n## Service URLs`n`n"
    
    if ($script:AutomationState.ServiceURLs.Count -gt 0) {
        foreach ($key in $script:AutomationState.ServiceURLs.Keys) {
            $url = $script:AutomationState.ServiceURLs[$key]
            $report += "- ${boldMarker}$key${boldMarker}: $url`n"
        }
    }
    else {
        $report += "No service URLs resolved.`n"
    }
    
    $report += "`n## Artifacts`n`n"
    
    if ($script:AutomationState.Artifacts.Count -gt 0) {
        foreach ($key in $script:AutomationState.Artifacts.Keys) {
            $artifact = $script:AutomationState.Artifacts[$key]
            $report += "### $key`n"
            foreach ($prop in $artifact.Keys) {
                $report += "- ${boldMarker}$prop${boldMarker}: $($artifact[$prop])`n"
            }
        }
    }
    else {
        $report += "No artifacts recorded.`n"
    }
    
    $report += "`n## APK Build Information`n`n"
    
    if ($script:AutomationState.Artifacts["APKBuild"]) {
        $apkInfo = $script:AutomationState.Artifacts["APKBuild"]
        if ($apkInfo.BuildUrl) {
            $report += "- ${boldMarker} Build URL ${boldMarker}: $($apkInfo.BuildUrl)`n"
        }
        if ($apkInfo.APKPath) {
            $report += "- ${boldMarker} Local APK Path ${boldMarker}: $($apkInfo.APKPath)`n"
        }
        if ($apkInfo.BuildProfile) {
            $report += "- ${boldMarker} Build Profile ${boldMarker}: $($apkInfo.BuildProfile)`n"
        }
    }
    else {
        $report += "APK build not completed or not attempted.`n"
    }
    
    $report += "`n## Log Files`n`n"
    $report += "- ${boldMarker} Main Log ${boldMarker}: $LogFile`n"
    $report += "- ${boldMarker} State File ${boldMarker}: $StateFile`n"
    
    try {
        $report | Out-File -FilePath $reportFile -Encoding UTF8
        Write-ColorOutput "Report saved to: $reportFile" $Green
    }
    catch {
        Write-ColorOutput "Warning: Could not save report file: $_" $Yellow
    }
    
    Write-Host ""
    Write-ColorOutput "Automation complete. Logs saved to: $LogFile" $Green
    Write-ColorOutput "State saved to: $StateFile" $Green
    if (Test-Path $reportFile) {
        Write-ColorOutput "Report saved to: $reportFile" $Green
    }
    
    # Final cleanup
    if (-not $DryRun) {
        Stop-BackgroundProcesses
    }
    
    Write-Host ""
}

# Register cleanup on exit
Register-ObjectEvent -InputObject ([System.Console]) -EventName "CancelKeyPress" -Action {
    Write-Host ""
    Write-ColorOutput "Interrupted by user. Cleaning up..." $Yellow
    Stop-BackgroundProcesses
    $script:AutomationState.EndTime = Get-Date
    Save-AutomationState
} | Out-Null

# Run main
try {
    Main
}
catch {
    # Safely extract error message - handle both string and exception objects
    # Never use ToString() directly to avoid format exceptions
    $errorText = ""
    try {
        # Try to get error message from Exception object
        if ($null -ne $_.Exception) {
            try {
                if ($null -ne $_.Exception.Message -and $_.Exception.Message -ne "") {
                    $errorText = $_.Exception.Message
                }
                else {
                    # Use Out-String as safe alternative to ToString()
                    $errorText = $_.Exception | Out-String -Width 4096
                    $errorText = $errorText.Trim()
                }
            }
            catch {
                # If Exception.Message fails, try Out-String on the whole exception
                try {
                    $errorText = $_.Exception | Out-String -Width 4096
                    $errorText = $errorText.Trim()
                }
                catch {
                    $errorText = "Error occurred (exception details unavailable)"
                }
            }
        }
        # Try Message property directly
        elseif ($null -ne $_.Message -and $_.Message -ne "") {
            $errorText = $_.Message
        }
        # Last resort: use Out-String as safe alternative to ToString()
        else {
            try {
                $errorText = $_ | Out-String -Width 4096
                $errorText = $errorText.Trim()
                if ([string]::IsNullOrWhiteSpace($errorText)) {
                    $errorText = "Unknown error occurred"
                }
            }
            catch {
                $errorText = "Unknown error occurred (could not extract error message)"
            }
        }
    }
    catch {
        # Fallback if all error extraction fails
        $errorText = "Unknown error occurred"
    }
    
    # Ensure errorText is a string
    if ($null -eq $errorText) {
        $errorText = "Unknown error occurred"
    }
    $errorText = [string]$errorText
    
    # Replace asterisks with safe alternative to prevent PowerShell parameter interpretation
    if ($errorText) {
        $safeErrorText = $errorText -replace '\*', '[ASTERISK]'
        $fatalErrorMsg = "Fatal error: " + $safeErrorText
    }
    else {
        $fatalErrorMsg = "Fatal error: Unknown error occurred"
    }
    Write-ColorOutput -Message $fatalErrorMsg -Color "Red"
    # Safely log error - use Out-String instead of direct variable to avoid ToString() issues
    $logErrorText = "Unknown error"
    try {
        $logErrorText = $_ | Out-String -Width 4096
        $logErrorText = $logErrorText.Trim()
        if ([string]::IsNullOrWhiteSpace($logErrorText)) {
            $logErrorText = "Unknown error occurred"
        }
    }
    catch {
        $logErrorText = "Unknown error (could not extract details)"
    }
    Write-PhaseLog "Fatal error: $logErrorText" "ERROR"
    Stop-BackgroundProcesses
    exit 1
}

