#Requires -Version 5.1

<#
.SYNOPSIS
    WealthArena Local Setup Script - Complete local development environment setup
    
.NOTE
    For the simplified architecture (no RAG, mock database), prefer using master_setup_simplified.ps1
    This script supports both full and simplified setups, but master_setup_simplified.ps1 is optimized for the new architecture.
    
.DESCRIPTION
    Orchestrates the complete local setup process for WealthArena, including:
    - Prerequisites verification (Node.js, Python, npm, EAS CLI)
    - Dependency installation for all services
    - Environment configuration with auto-detected local IP
    - Database setup (Local SQL Server or PostgreSQL)
    - Service orchestration with health checks
    - Data pipeline execution
    - Windows Task Scheduler configuration
    - Android APK build configuration
    - Consolidated chatbot test harness (scripts/testing/test_chatbot.ps1)
    
.PARAMETER SkipDependencies
    Skip npm and pip dependency installation phases
    
.PARAMETER SkipDataDownload
    Skip market data download (use existing data)
    
.PARAMETER SkipDataProcessing
    Skip data processing step
    
.PARAMETER SkipAPKBuild
    Skip Android APK build configuration
    
.PARAMETER DatabaseType
    Database type: 'sqlserver', 'postgresql', or 'skip' (default: 'sqlserver' for local development)
    
.PARAMETER LocalIPOverride
    Manually specify local IP address instead of auto-detection
    
.EXAMPLE
    .\master_setup_local.ps1
    
.EXAMPLE
    .\master_setup_local.ps1 -SkipDataDownload -DatabaseType sqlserver
    
.EXAMPLE
    .\master_setup_local.ps1 -SkipAPKBuild -LocalIPOverride "192.168.1.100"
#>

param(
    [switch]$SkipDependencies = $false,
    [switch]$SkipDataDownload = $false,
    [switch]$SkipDataProcessing = $false,
    [switch]$SkipAPKBuild = $false,
    [ValidateSet('sqlserver', 'postgresql', 'skip')]
    [string]$DatabaseType = 'postgresql',
    [string]$LocalIPOverride = ""
)

# Set strict error handling
$ErrorActionPreference = "Stop"

# Colors for output
$script:Green = "Green"
$script:Red = "Red"
$script:Yellow = "Yellow"
$script:Blue = "Blue"
$script:Cyan = "Cyan"
$script:White = "White"

# Get script directory
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $script:ScriptDir

# Create logs directory
$logDir = Join-Path $script:ScriptDir "local_setup_logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Setup logging
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = Join-Path $logDir "master_setup_$timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Add-Content -Path $logFile -Value $logMessage
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
    Write-Log $Message $Color
}

function Write-PhaseHeader {
    param([string]$PhaseName, [string]$PhaseNumber)
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "Phase $PhaseNumber : $PhaseName" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
}

function Write-StatusMessage {
    param(
        [string]$Message,
        [string]$Status = "INFO"
    )
    $symbol = switch ($Status) {
        "SUCCESS" { "[OK]" }
        "ERROR" { "[X]" }
        "WARNING" { "[!]" }
        default { "[*]" }
    }
    $color = switch ($Status) {
        "SUCCESS" { $Green }
        "ERROR" { $Red }
        "WARNING" { $Yellow }
        default { $Blue }
    }
    Write-ColorOutput "$symbol $Message" $color
}

function Get-LocalIPAddress {
    if ($LocalIPOverride) {
        Write-StatusMessage "Using manually specified IP: $LocalIPOverride" "INFO"
        return $LocalIPOverride
    }
    
    try {
        $adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.InterfaceAlias -notlike "*Loopback*"
        } | Sort-Object -Property InterfaceIndex
        
        if ($adapters.Count -gt 0) {
            $localIP = $adapters[0].IPAddress
            Write-StatusMessage "Detected local IP: $localIP" "SUCCESS"
            return $localIP
        }
        else {
            Write-StatusMessage "Could not auto-detect local IP. Using localhost." "WARNING"
            return "localhost"
        }
    }
    catch {
        Write-StatusMessage "Error detecting local IP: $_. Using localhost." "WARNING"
        return "localhost"
    }
}

function Test-ServiceHealth {
    param(
        [string]$Url,
        [int]$MaxRetries = 3,
        [int]$RetryDelay = 5
    )
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                return $true
            }
        }
        catch {
            if ($i -lt $MaxRetries) {
                Start-Sleep -Seconds $RetryDelay
            }
        }
    }
    return $false
}

function Get-PythonMinorVersion {
    try {
        $pythonVersion = python --version 2>&1
        $pythonMinor = [int]($pythonVersion -replace 'Python \d+\.(\d+).*', '$1')
        return $pythonMinor
    }
    catch {
        Write-StatusMessage "Error detecting Python version: $_" "WARNING"
        return -1
    }
}

function Install-EASCLIIfMissing {
    try {
        $easVersion = eas --version 2>&1
        Write-StatusMessage "EAS CLI found: $easVersion" "SUCCESS"
        return $true
    }
    catch {
        Write-StatusMessage "EAS CLI not found. Installing..." "WARNING"
        try {
            npm install -g eas-cli
            Write-StatusMessage "EAS CLI installed successfully" "SUCCESS"
            return $true
        }
        catch {
            Write-StatusMessage "Failed to install EAS CLI: $_" "ERROR"
            return $false
        }
    }
}

function Create-SchedulerTask {
    param(
        [string]$TaskName,
        [string]$ScriptPath,
        [string]$Schedule = "Daily",
        [string]$Time = "06:00"
    )
    
    try {
        # Check if task already exists
        $existingTask = schtasks /query /tn $TaskName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "Task '$TaskName' already exists. Updating..." "WARNING"
            schtasks /delete /tn $TaskName /f | Out-Null
        }
        
        # Verify script path exists
        if (-not (Test-Path $ScriptPath)) {
            Write-StatusMessage "Script path does not exist: $ScriptPath" "ERROR"
            return $false
        }
        
        # Create the task - use full path for PowerShell
        $action = "powershell.exe -ExecutionPolicy Bypass -File `"$ScriptPath`""
        
        schtasks /create /tn $TaskName /tr $action /sc $Schedule /st $Time /ru "SYSTEM" /f 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "Scheduled task '$TaskName' created successfully" "SUCCESS"
            return $true
        }
        else {
            Write-StatusMessage "Failed to create scheduled task" "ERROR"
            return $false
        }
    }
    catch {
        Write-StatusMessage "Error creating scheduled task: $_" "ERROR"
        return $false
    }
}

function Stop-AllServices {
    Write-PhaseHeader "Cleanup" "X"
    Write-StatusMessage "Stopping all services..." "INFO"
    
    try {
        $processes = Get-Process | Where-Object {
            ($_.ProcessName -eq "node" -or $_.ProcessName -eq "python" -or $_.ProcessName -eq "expo") -and
            $_.Path -like "*$($script:ScriptDir.Replace('\', '*'))*"
        }
        
        if ($processes.Count -gt 0) {
            $processes | Stop-Process -Force
            Write-StatusMessage "Stopped $($processes.Count) service process(es)" "SUCCESS"
        }
        else {
            Write-StatusMessage "No running services found" "INFO"
        }
    }
    catch {
        Write-StatusMessage "Error stopping services: $_" "WARNING"
    }
}

# Phase 1: Prerequisites Check
function Invoke-Phase1-Prerequisites {
    Write-PhaseHeader "Prerequisites Check" "1"
    
    $issues = @()
    $localIP = Get-LocalIPAddress
    
    # Check Node.js
    Write-StatusMessage "Checking Node.js..." "INFO"
    try {
        $nodeVersion = node --version
        $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($nodeMajor -ge 18) {
            Write-StatusMessage "Node.js version: $nodeVersion" "SUCCESS"
        }
        else {
            $issues += "Node.js version $nodeVersion is too old. Requires v18+"
        }
    }
    catch {
        $issues += "Node.js not found. Install from https://nodejs.org/"
    }
    
    # Check Python
    Write-StatusMessage "Checking Python..." "INFO"
    try {
        $pythonVersion = python --version 2>&1
        $pythonMajor = [int]($pythonVersion -replace 'Python (\d+)\..*', '$1')
        $pythonMinor = [int]($pythonVersion -replace 'Python \d+\.(\d+).*', '$1')
        if ($pythonMajor -gt 3 -or ($pythonMajor -eq 3 -and $pythonMinor -ge 8)) {
            Write-StatusMessage "Python version: $pythonVersion" "SUCCESS"
            
            # Warn about Python 3.13 compatibility issues
            if ($pythonMajor -eq 3 -and $pythonMinor -eq 13) {
                Write-StatusMessage "Python 3.13 detected. Some packages may have compatibility issues." "WARNING"
                Write-ColorOutput "  Note: pandas 2.1.x doesn't support Python 3.13. Consider using Python 3.11 or 3.12, or update pandas to 2.2.0+" "Yellow"
            }
        }
        else {
            $issues += "Python version $pythonVersion is too old. Requires 3.8+"
        }
    }
    catch {
        $issues += "Python not found. Install from https://www.python.org/"
    }
    
    # Check npm
    Write-StatusMessage "Checking npm..." "INFO"
    try {
        $npmVersion = npm --version
        Write-StatusMessage "npm version: $npmVersion" "SUCCESS"
    }
    catch {
        $issues += "npm not found. Usually comes with Node.js"
    }
    
    # Check Git (optional)
    Write-StatusMessage "Checking Git (optional)..." "INFO"
    try {
        $gitVersion = git --version
        Write-StatusMessage "Git version: $gitVersion" "SUCCESS"
    }
    catch {
        Write-StatusMessage "Git not found (optional)" "WARNING"
    }
    
    # Check EAS CLI
    Write-StatusMessage "Checking EAS CLI..." "INFO"
    Install-EASCLIIfMissing | Out-Null
    
    Write-Host ""
    Write-ColorOutput "Local IP Address: $localIP" $Cyan
    Write-Host ""
    
    if ($issues.Count -gt 0) {
        Write-StatusMessage "Prerequisites check found issues:" "ERROR"
        foreach ($issue in $issues) {
            Write-ColorOutput "  - $issue" $Red
        }
        Write-Host ""
        Write-ColorOutput "Please fix these issues before continuing." $Yellow
        return $false
    }
    
    Write-StatusMessage "All prerequisites met!" "SUCCESS"
    return @{ LocalIP = $localIP }
}

# Phase 2: Dependency Installation
function Invoke-Phase2-Dependencies {
    if ($SkipDependencies) {
        Write-PhaseHeader "Dependency Installation" "2"
        Write-StatusMessage "Skipping dependency installation as requested" "WARNING"
        return $true
    }
    
    Write-PhaseHeader "Dependency Installation" "2"
    
    $results = @{}
    
    # Frontend
    Write-StatusMessage "Installing frontend dependencies..." "INFO"
    try {
        Set-Location (Join-Path $script:ScriptDir "frontend")
        npm install --legacy-peer-deps
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "Frontend dependencies installed" "SUCCESS"
            $results.Frontend = $true
        }
        else {
            Write-StatusMessage "Frontend dependency installation failed" "ERROR"
            $results.Frontend = $false
        }
    }
    catch {
        Write-StatusMessage "Frontend dependency installation error: $_" "ERROR"
        $results.Frontend = $false
    }
    finally {
        Set-Location $script:ScriptDir
    }
    
    # Backend
    Write-StatusMessage "Installing backend dependencies..." "INFO"
    try {
        Set-Location (Join-Path $script:ScriptDir "backend")
        npm install --legacy-peer-deps
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "Backend dependencies installed" "SUCCESS"
            # Try to build, but don't fail if it doesn't work (dev mode uses ts-node)
            npm run build 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-StatusMessage "Backend build successful" "SUCCESS"
                $results.Backend = $true
            }
            else {
                Write-StatusMessage "Backend build failed (TypeScript errors), but dev mode will still work with ts-node" "WARNING"
                Write-ColorOutput "  You can fix TypeScript errors later. Development mode (npm run dev) doesn't require a build." "Yellow"
                $results.Backend = $true  # Still mark as success since dev mode works
            }
        }
        else {
            Write-StatusMessage "Backend dependency installation failed" "ERROR"
            $results.Backend = $false
        }
    }
    catch {
        Write-StatusMessage "Backend dependency installation error: $_" "ERROR"
        $results.Backend = $false
    }
    finally {
        Set-Location $script:ScriptDir
    }
    
    # Chatbot
    Write-StatusMessage "Installing chatbot dependencies..." "INFO"
    try {
        Set-Location (Join-Path $script:ScriptDir "chatbot")
        # For Python 3.13, try to use pre-built wheels first, then fallback to building
        $pythonMinor = Get-PythonMinorVersion
        $installSuccess = $false
        if ($pythonMinor -eq 13) {
            Write-StatusMessage "Python 3.13 detected. Attempting to install with pre-built wheels..." "INFO"
            $pipOutput = pip install --only-binary :all: -r requirements.txt 2>&1
            $exitCode = $LASTEXITCODE
            if ($exitCode -ne 0) {
                Write-ColorOutput "  Pre-built wheels failed (this is expected for Python 3.13)" "Yellow"
                Write-StatusMessage "Trying with updated packages and constraints..." "WARNING"
                # Try updating packages to versions that support Python 3.13
                pip install "pandas>=2.2.0" "coverage>=7.6.1" "scikit-learn>=1.5.2" --upgrade 2>&1 | Out-Null
                # Create temporary constraints file to override pinned versions
                $constraintsFile = Join-Path (Join-Path $script:ScriptDir "chatbot") "constraints_temp.txt"
                @"
pandas>=2.2.0
coverage>=7.6.1
scikit-learn>=1.5.2
"@ | Set-Content -Path $constraintsFile
                $pipOutput = pip install -r requirements.txt -c $constraintsFile 2>&1
                $exitCode = $LASTEXITCODE
                Remove-Item -Path $constraintsFile -ErrorAction SilentlyContinue
                # Check if installation succeeded - warnings about yanked versions are OK
                if ($exitCode -eq 0) {
                    # Verify installation by trying to import a key package
                    $testOutput = python -c "import fastapi; print('OK')" 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        $installSuccess = $true
                    }
                    else {
                        Write-ColorOutput "  Installation reported success but fastapi not found. Retrying..." "Yellow"
                        # Try installing again without constraints
                        $pipOutput = pip install -r requirements.txt 2>&1
                        $exitCode = $LASTEXITCODE
                        if ($exitCode -eq 0) {
                            $testOutput = python -c "import fastapi; print('OK')" 2>&1
                            if ($LASTEXITCODE -eq 0) {
                                $installSuccess = $true
                            }
                            else {
                                Write-ColorOutput "  Verification failed: $testOutput" "Red"
                            }
                        }
                    }
                }
                elseif ($pipOutput -match "ERROR: Could not find a version") {
                    # Actual error - package not available
                    Write-ColorOutput "  $pipOutput" "Red"
                }
                else {
                    # Might be warnings (like yanked versions) - try to verify installation
                    Write-ColorOutput "  Note: Some warnings may appear, checking if installation succeeded..." "Yellow"
                    # Re-check if packages are actually installed
                    $testOutput = python -c "import fastapi; print('OK')" 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        $installSuccess = $true
                    }
                    else {
                        Write-ColorOutput "  Installation verification failed: $testOutput" "Red"
                        Write-ColorOutput "  Full pip output: $pipOutput" "Red"
                    }
                }
            }
            else {
                $installSuccess = $true
            }
        }
        else {
            $pipOutput = pip install -r requirements.txt 2>&1
            $exitCode = $LASTEXITCODE
            if ($exitCode -eq 0) {
                $installSuccess = $true
            }
            else {
                Write-ColorOutput "  $pipOutput" "Red"
            }
        }
        
        if ($installSuccess) {
            Write-StatusMessage "Chatbot dependencies installed" "SUCCESS"
            $results.Chatbot = $true
            
            # RAG knowledge base initialization skipped for simplified architecture
            # Using direct GroQ API with guardrails instead of vector database
            Write-StatusMessage "Skipping RAG knowledge base initialization (simplified architecture)" "INFO"
            Write-ColorOutput "  Using direct GroQ API with guardrails - no vector database needed" "Cyan"
            Write-ColorOutput "  Note: For the simplified architecture, prefer using master_setup_simplified.ps1" "Cyan"
        }
        else {
            Write-StatusMessage "Chatbot dependency installation failed" "ERROR"
            Write-ColorOutput "  If using Python 3.13, update requirements.txt: pandas>=2.2.0, coverage>=7.6.1" "Yellow"
            Write-ColorOutput "  Or consider using Python 3.11 or 3.12 for better compatibility" "Yellow"
            $results.Chatbot = $false
        }
    }
    catch {
        Write-StatusMessage "Chatbot dependency installation error: $_" "ERROR"
        $results.Chatbot = $false
    }
    finally {
        Set-Location $script:ScriptDir
    }
    
    # RL Service
    Write-StatusMessage "Installing RL service dependencies..." "INFO"
    try {
        Set-Location (Join-Path $script:ScriptDir "rl-service")
        # For Python 3.13, try to use pre-built wheels first
        $pythonMinor = Get-PythonMinorVersion
        $installSuccess = $false
        if ($pythonMinor -eq 13) {
            Write-StatusMessage "Python 3.13 detected. Attempting to install with pre-built wheels..." "INFO"
            $pipOutput = pip install --only-binary :all: -r requirements.txt 2>&1
            $exitCode = $LASTEXITCODE
            if ($exitCode -ne 0) {
                Write-ColorOutput "  Pre-built wheels failed (this is expected for Python 3.13)" "Yellow"
                Write-StatusMessage "Trying with updated packages and constraints..." "WARNING"
                # Try updating packages to versions that support Python 3.13
                pip install "numpy>=2.1.0" "pandas>=2.2.0" "coverage>=7.6.1" "scikit-learn>=1.5.2" "ray[rllib]>=2.10.0" "setuptools>=75.0.0" --upgrade 2>&1 | Out-Null
                # Create temporary constraints file to override pinned versions
                $constraintsFile = Join-Path (Join-Path $script:ScriptDir "rl-service") "constraints_temp.txt"
                @"
numpy>=2.1.0
pandas>=2.2.0
coverage>=7.6.1
scikit-learn>=1.5.2
ray[rllib]>=2.10.0
"@ | Set-Content -Path $constraintsFile
                $pipOutput = pip install -r requirements.txt -c $constraintsFile 2>&1
                $exitCode = $LASTEXITCODE
                Remove-Item -Path $constraintsFile -ErrorAction SilentlyContinue
                # Check if installation succeeded
                if ($exitCode -eq 0) {
                    $installSuccess = $true
                }
                elseif ($pipOutput -match "ERROR: Could not find a version") {
                    # Actual error - package not available
                    Write-ColorOutput "  $pipOutput" "Red"
                }
                else {
                    # Might be warnings - try to verify installation
                    Write-ColorOutput "  Note: Some warnings may appear, but installation may still succeed" "Yellow"
                    # Re-check if packages are actually installed
                    $testOutput = python -c "import flask; print('OK')" 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        $installSuccess = $true
                    }
                    else {
                        Write-ColorOutput "  $pipOutput" "Red"
                    }
                }
            }
            else {
                $installSuccess = $true
            }
        }
        else {
            $pipOutput = pip install -r requirements.txt 2>&1
            $exitCode = $LASTEXITCODE
            if ($exitCode -eq 0) {
                $installSuccess = $true
            }
            else {
                Write-ColorOutput "  $pipOutput" "Red"
            }
        }
        
        if ($installSuccess) {
            Write-StatusMessage "RL service dependencies installed" "SUCCESS"
            $results.RLService = $true
        }
        else {
            Write-StatusMessage "RL service dependency installation failed" "ERROR"
            Write-ColorOutput "  If using Python 3.13, update requirements.txt: numpy>=2.1.0, pandas>=2.2.0, coverage>=7.6.1" "Yellow"
            Write-ColorOutput "  Or consider using Python 3.11 or 3.12 for better compatibility" "Yellow"
            $results.RLService = $false
        }
    }
    catch {
        Write-StatusMessage "RL service dependency installation error: $_" "ERROR"
        $results.RLService = $false
    }
    finally {
        Set-Location $script:ScriptDir
    }
    
    # Data Pipeline
    Write-StatusMessage "Installing data pipeline dependencies..." "INFO"
    try {
        Set-Location (Join-Path $script:ScriptDir "data-pipeline")
        # For Python 3.13, try to use pre-built wheels first
        $pythonMinor = Get-PythonMinorVersion
        if ($pythonMinor -eq 13) {
            Write-StatusMessage "Python 3.13 detected. Attempting to install with pre-built wheels..." "INFO"
            $pipOutput = pip install --only-binary :all: -r requirements.txt 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-ColorOutput "  $pipOutput" "Red"
                Write-StatusMessage "Pre-built wheels failed. Trying with updated packages..." "WARNING"
                # Try updating packages to versions that support Python 3.13
                $pipOutput = pip install "coverage>=7.6.1" --upgrade 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "  $pipOutput" "Red"
                }
                # Create temporary constraints file to override pinned versions
                $constraintsFile = Join-Path (Join-Path $script:ScriptDir "data-pipeline") "constraints_temp.txt"
                @"
coverage>=7.6.1
"@ | Set-Content -Path $constraintsFile
                $pipOutput = pip install -r requirements.txt -c $constraintsFile 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "  $pipOutput" "Red"
                }
                Remove-Item -Path $constraintsFile -ErrorAction SilentlyContinue
            }
        }
        else {
            $pipOutput = pip install -r requirements.txt 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-ColorOutput "  $pipOutput" "Red"
            }
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "Data pipeline dependencies installed" "SUCCESS"
            $results.DataPipeline = $true
        }
        else {
            Write-StatusMessage "Data pipeline dependency installation failed" "ERROR"
            Write-ColorOutput "  If using Python 3.13, update requirements.txt: coverage>=7.6.1" "Yellow"
            Write-ColorOutput "  Or consider using Python 3.11 or 3.12 for better compatibility" "Yellow"
            $results.DataPipeline = $false
        }
    }
    catch {
        Write-StatusMessage "Data pipeline dependency installation error: $_" "ERROR"
        $results.DataPipeline = $false
    }
    finally {
        Set-Location $script:ScriptDir
    }
    
    Write-Host ""
    Write-ColorOutput "Installation Summary:" $Cyan
    foreach ($key in $results.Keys) {
        $success = $results[$key]
        $status = if ($success) { "[OK]" } else { "[X]" }
        $color = if ($success) { $Green } else { $Red }
        Write-ColorOutput "  $status $key" $color
    }
    
    return $results
}

# Phase 3: Environment Configuration
function Invoke-Phase3-Environment {
    param([string]$LocalIP)
    
    Write-PhaseHeader "Environment Configuration" "3"
    
    # Backend .env.local
    Write-StatusMessage "Creating backend/.env.local..." "INFO"
    try {
        $backendEnvPath = Join-Path (Join-Path $script:ScriptDir "backend") ".env.local"
        
        # First, try to read password from sqlDB.env (source of truth)
        $passwordValue = $null
        $sqlDBEnvPath = Join-Path (Join-Path $script:ScriptDir "data-pipeline") "sqlDB.env"
        if (Test-Path $sqlDBEnvPath) {
            Write-StatusMessage "Reading password from sqlDB.env (source of truth)..." "INFO"
            $sqlDBContent = Get-Content $sqlDBEnvPath
            foreach ($line in $sqlDBContent) {
                if ($line -match "^SQL_PWD=(.+)$") {
                    $readPassword = $matches[1].Trim()
                    # Accept any non-placeholder password value
                    if ($readPassword -and $readPassword -ne "your-postgres-password" -and $readPassword -ne "your-sql-password" -and $readPassword.Length -gt 0) {
                        $passwordValue = $readPassword
                        Write-StatusMessage "Found password in sqlDB.env: $passwordValue" "SUCCESS"
                        break
                    }
                }
            }
        }
        else {
            Write-StatusMessage "sqlDB.env not found. Will check existing backend/.env.local..." "WARNING"
        }
        
        # If not found in sqlDB.env, check existing backend/.env.local
        if (-not $passwordValue -or $passwordValue -eq "your-postgres-password" -or $passwordValue -eq "your-sql-password") {
            if (Test-Path $backendEnvPath) {
                Write-StatusMessage "Checking existing backend/.env.local for password..." "INFO"
                try {
                    $existingContent = Get-Content $backendEnvPath
                    foreach ($line in $existingContent) {
                        if ($line -match "^DB_PASSWORD=(.+)$") {
                            $existingPassword = $matches[1].Trim()
                            if ($existingPassword -and $existingPassword -ne "your-postgres-password" -and $existingPassword -ne "your-sql-password" -and $existingPassword.Length -gt 0) {
                                $passwordValue = $existingPassword
                                Write-StatusMessage "Using password from existing backend/.env.local" "SUCCESS"
                                break
                            }
                        }
                    }
                }
                catch {
                    Write-StatusMessage "Error reading existing backend/.env.local: $_" "WARNING"
                }
            }
        }
        
        # Final validation - if still placeholder, use it but warn strongly
        if (-not $passwordValue -or $passwordValue -eq "your-postgres-password" -or $passwordValue -eq "your-sql-password") {
            $passwordValue = "your-postgres-password"
            Write-StatusMessage "CRITICAL: No valid password found! Using placeholder." "ERROR"
            Write-ColorOutput "  The backend will FAIL to start with this placeholder password!" "Red"
            Write-ColorOutput "  Please update SQL_PWD in data-pipeline/sqlDB.env with your actual PostgreSQL password" "Yellow"
            Write-ColorOutput "  Then re-run this setup script, or manually update DB_PASSWORD in backend/.env.local" "Yellow"
        }
        
        # Build CORS origins list (clean and valid URLs only)
        $corsOrigins = @(
            "http://localhost:3000",
            "http://localhost:8081"
        )
        if ($LocalIP -and $LocalIP -ne "localhost") {
            $corsOrigins += "http://$LocalIP:3000"
            $corsOrigins += "http://$LocalIP:8081"
        }
        $corsOriginsString = $corsOrigins -join ","
        
        # Determine password status for messaging
        $isPlaceholder = ($passwordValue -eq "your-postgres-password" -or $passwordValue -eq "your-sql-password")
        
        $backendEnvContent = @"
# Local Development Configuration
USE_MOCK_DB=true
NODE_ENV=development
PORT=3000

# Mock Database (In-Memory) - no database credentials needed for simplified setup
# All user data will be stored in memory and cleared on server restart
# To use real database, set USE_MOCK_DB=false and configure below:

# Database Configuration (Optional - only needed if USE_MOCK_DB=false)
# DB_TYPE=postgres
# DB_HOST=localhost
# DB_NAME=wealtharenadb
# DB_USER=postgres
# DB_PASSWORD=$passwordValue
# DB_PORT=5432

# Option 2: Local SQL Server (Alternative)
# DB_TYPE=sqlserver
# DB_HOST=localhost
# DB_NAME=WealthArenaDB
# DB_USER=sa
# DB_PASSWORD=your-sql-password
# DB_PORT=1433
# DB_ENCRYPT=false

# Note: This setup is configured for LOCAL databases only
# For production deployments, update these settings accordingly

# Service URLs
CHATBOT_URL=http://localhost:8000
RL_SERVICE_URL=http://localhost:5002

# CORS Origins (include local IP for mobile testing)
# Clean, comma-separated list of valid origins (no empty or malformed entries)
CORS_ORIGINS=$corsOriginsString
ALLOWED_ORIGINS=$corsOriginsString

# JWT Secret (change in production)
JWT_SECRET=local-dev-secret-change-in-production
"@
        Set-Content -Path $backendEnvPath -Value $backendEnvContent -Force
        
        if ($isPlaceholder) {
            Write-StatusMessage "Backend .env.local created/updated" "WARNING"
            Write-ColorOutput "  WARNING: DB_PASSWORD is still a placeholder!" $Red
            Write-ColorOutput "  Please update DB_PASSWORD in backend/.env.local with your actual PostgreSQL password" $Yellow
            Write-ColorOutput "  Current value: $passwordValue" $Yellow
            Write-ColorOutput "  Tip: Run scripts\sync_db_password.ps1 to sync password from sqlDB.env" $Cyan
        }
        else {
            Write-StatusMessage "Backend .env.local created/updated with password from sqlDB.env" "SUCCESS"
            Write-ColorOutput "  Database password configured: $passwordValue" $Green
            Write-ColorOutput "  CORS origins configured: $corsOriginsString" $Green
            Write-ColorOutput "  Tip: Run scripts\sync_db_password.ps1 anytime to re-sync passwords" $Cyan
        }
    }
    catch {
        Write-StatusMessage "Error creating backend .env.local: $_" "ERROR"
    }
    
    # Chatbot .env.local and .env
    Write-StatusMessage "Creating chatbot environment files..." "INFO"
    try {
        $chatbotDir = Join-Path $script:ScriptDir "chatbot"
        $chatbotEnvExamplePath = Join-Path $chatbotDir ".env.example"
        $chatbotEnvPath = Join-Path $chatbotDir ".env"
        $chatbotEnvLocalPath = Join-Path $chatbotDir ".env.local"
        
        # RAG vars function removed for simplified architecture
        # No RAG system - using direct GroQ API with guardrails
        
        # Create .env.local (simplified - no RAG vars)
        $chatbotEnvContent = @"
# Local Development Configuration (Simplified - No RAG)
APP_PORT=8000
ENVIRONMENT=local

# GROQ API Key (required)
GROQ_API_KEY=your-groq-api-key-here
GROQ_MODEL=llama3-8b-8192
LLM_PROVIDER=groq

# Note: RAG system removed - using direct GroQ API with guardrails
"@
        Set-Content -Path $chatbotEnvLocalPath -Value $chatbotEnvContent -Force
        
        # Create .env from .env.example if it exists
        if (Test-Path $chatbotEnvExamplePath) {
            if (-not (Test-Path $chatbotEnvPath)) {
                Copy-Item $chatbotEnvExamplePath $chatbotEnvPath
                Write-StatusMessage "Created chatbot/.env from .env.example" "SUCCESS"
            }
            # RAG vars skipped for simplified architecture
        }
        else {
            # If .env.example doesn't exist, create .env (simplified - no RAG vars)
            if (-not (Test-Path $chatbotEnvPath)) {
                $basicEnvContent = @"
# WealthArena Chatbot Environment Variables (Simplified - No RAG)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama3-8b-8192
LLM_PROVIDER=groq
APP_PORT=8000
APP_HOST=0.0.0.0

# Note: RAG system removed - using direct GroQ API with guardrails
"@
                Set-Content -Path $chatbotEnvPath -Value $basicEnvContent -Force
            }
        }
        
        # RAG vars verification skipped for simplified architecture
        Write-StatusMessage "Chatbot environment files configured (simplified - no RAG)" "SUCCESS"
        
        # Prompt for GROQ API key if not set
        if (Test-Path $chatbotEnvLocalPath) {
            $currentKey = (Get-Content $chatbotEnvLocalPath | Select-String "GROQ_API_KEY=").ToString().Split('=')[1]
            if ($currentKey -eq "your-groq-api-key-here") {
                Write-ColorOutput "Please set GROQ_API_KEY in chatbot/.env.local" $Yellow
            }
        }
    }
    catch {
        Write-StatusMessage "Error creating chatbot environment files: $_" "ERROR"
    }
    
    # RL Service .env.local
    Write-StatusMessage "Creating rl-service/.env.local..." "INFO"
    try {
        $rlEnvPath = Join-Path (Join-Path $script:ScriptDir "rl-service") ".env.local"
        $rlEnvContent = @"
# Local Development Configuration
PORT=5002
MODEL_MODE=mock

# Database Configuration (if needed)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=wealtharena
# DB_USER=postgres
# DB_PASSWORD=your-password
"@
        Set-Content -Path $rlEnvPath -Value $rlEnvContent -Force
        Write-StatusMessage "RL service .env.local created" "SUCCESS"
    }
    catch {
        Write-StatusMessage "Error creating rl-service .env.local: $_" "ERROR"
    }
    
    # Frontend .env.local
    Write-StatusMessage "Creating frontend/.env.local..." "INFO"
    try {
        $frontendEnvPath = Join-Path (Join-Path $script:ScriptDir "frontend") ".env.local"
        $frontendEnvContent = @"
EXPO_PUBLIC_DEPLOYMENT_ENV=local
EXPO_PUBLIC_BACKEND_URL=http://$LocalIP:3000
EXPO_PUBLIC_CHATBOT_URL=http://$LocalIP:8000
EXPO_PUBLIC_RL_SERVICE_URL=http://$LocalIP:5002
"@
        Set-Content -Path $frontendEnvPath -Value $frontendEnvContent -Force
        Write-StatusMessage "Frontend .env.local created" "SUCCESS"
    }
    catch {
        Write-StatusMessage "Error creating frontend .env.local: $_" "ERROR"
    }
    
    # Data Pipeline sqlDB.env
    Write-StatusMessage "Creating data-pipeline/sqlDB.env..." "INFO"
    try {
        $dataPipelineEnvPath = Join-Path (Join-Path $script:ScriptDir "data-pipeline") "sqlDB.env"
        
        # Check if file exists and preserve existing password
        $existingPassword = $null
        $existingDriver = $null
        if (Test-Path $dataPipelineEnvPath) {
            Write-StatusMessage "sqlDB.env already exists, preserving existing password..." "INFO"
            $existingContent = Get-Content $dataPipelineEnvPath
            foreach ($line in $existingContent) {
                if ($line -match "^SQL_PWD=(.+)$") {
                    $existingPassword = $matches[1].Trim()
                }
                if ($line -match "^SQL_DRIVER=(.+)$") {
                    $existingDriver = $matches[1].Trim()
                }
            }
        }
        
        # Use existing password if found, otherwise use placeholder
        $passwordValue = if ($existingPassword) { $existingPassword } else { "your-postgres-password" }
        $driverValue = if ($existingDriver) { $existingDriver } else { "PostgreSQL Unicode" }
        
        $dataPipelineEnvContent = @"
# Database Configuration for Data Pipeline
# LOCAL DATABASE SETUP - PostgreSQL (you already have this installed)

# PostgreSQL Configuration (using ODBC)
# Note: You need PostgreSQL ODBC Driver installed
# Download: https://www.postgresql.org/ftp/odbc/versions/msi/
SQL_DRIVER=$driverValue
SQL_SERVER=localhost
SQL_DB=wealtharenadb
SQL_UID=postgres
SQL_PWD=$passwordValue

# Alternative: If you prefer SQL Server instead
# SQL_DRIVER={ODBC Driver 18 for SQL Server}
# SQL_SERVER=localhost
# SQL_DB=WealthArenaDB
# SQL_UID=sa
# SQL_PWD=your-sql-password

# Setup Instructions for PostgreSQL:
# 1. Install PostgreSQL ODBC Driver: https://www.postgresql.org/ftp/odbc/versions/msi/
# 2. Create database: psql -U postgres -c "CREATE DATABASE wealtharenadb;"
# 3. Update SQL_PWD above with your PostgreSQL password
# 4. Verify ODBC driver: odbcad32.exe (check Drivers tab for "PostgreSQL Unicode")
"@
        Set-Content -Path $dataPipelineEnvPath -Value $dataPipelineEnvContent -Force
        if ($existingPassword) {
            Write-StatusMessage "Data pipeline sqlDB.env updated (password preserved)" "SUCCESS"
        }
        else {
            Write-StatusMessage "Data pipeline sqlDB.env created" "SUCCESS"
            Write-ColorOutput "Please update data-pipeline/sqlDB.env with your PostgreSQL password" $Yellow
            Write-ColorOutput "  Since you already have PostgreSQL installed:" $White
            Write-ColorOutput "  1. Install PostgreSQL ODBC Driver: https://www.postgresql.org/ftp/odbc/versions/msi/" $White
            Write-ColorOutput "  2. Create database: psql -U postgres -c 'CREATE DATABASE wealtharenadb;'" $Cyan
            Write-ColorOutput "  3. Update SQL_PWD in sqlDB.env with your PostgreSQL password" $White
        }
    }
    catch {
        Write-StatusMessage "Error creating data-pipeline/sqlDB.env: $_" "ERROR"
    }
    
    Write-Host ""
    Write-StatusMessage "Environment files created. Please review and update with your credentials." "WARNING"
}

# Phase 4: Database Setup
function Invoke-Phase4-Database {
    Write-PhaseHeader "Database Setup" "4"
    
    # Simplified architecture uses mock database - skip real database setup
    Write-StatusMessage "Using in-memory mock database - no setup required" "INFO"
    Write-StatusMessage "All user data will be stored in memory (cleared on server restart)" "INFO"
    Write-StatusMessage "To use a real database, set USE_MOCK_DB=false in backend/.env.local" "INFO"
    return $true
    
    if ($DatabaseType -eq "skip") {
        Write-StatusMessage "Skipping database setup as requested" "WARNING"
        Write-StatusMessage "Note: Database-dependent features will not work" "WARNING"
        return $false
    }
    
    $sqlDBEnvPath = Join-Path (Join-Path $script:ScriptDir "data-pipeline") "sqlDB.env"
    if (-not (Test-Path $sqlDBEnvPath)) {
        Write-StatusMessage "sqlDB.env not found. Please run Phase 3 first." "ERROR"
        return $false
    }
    
    # Read database credentials
    $dbConfig = @{}
    Get-Content $sqlDBEnvPath | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $dbConfig[$key] = $value
        }
    }
    
    # Detect database type from sqlDB.env (prefer local databases)
    # Check for both old (DB_TYPE) and new (SQL_SERVER) variable names
    $detectedDbType = $dbConfig["DB_TYPE"]
    if (-not $detectedDbType) {
        # Fallback to DatabaseType parameter or detect from server name
        # Default to PostgreSQL for local development
        if ($DatabaseType -ne "skip") {
            $detectedDbType = $DatabaseType
        }
        else {
            $detectedDbType = "postgresql"
        }
    }
    
    Write-Host ""
    Write-ColorOutput "Detected database type: $detectedDbType" $Cyan
    Write-Host ""
    
    if ($detectedDbType -eq "postgresql" -or ($detectedDbType -eq $null -and $DatabaseType -eq "postgresql")) {
        Write-StatusMessage "Setting up LOCAL PostgreSQL database..." "INFO"
        Write-Host ""
        Write-ColorOutput "PostgreSQL Local Setup Instructions:" $Yellow
        Write-ColorOutput "  1. Install PostgreSQL from: https://www.postgresql.org/download/windows/" $White
        Write-ColorOutput "  2. During installation, set a password for the 'postgres' user" $White
        Write-ColorOutput "  3. Create a database named 'wealtharenadb':" $White
        Write-ColorOutput "     psql -U postgres" $Cyan
        Write-ColorOutput "     CREATE DATABASE wealtharenadb;" $Cyan
        Write-ColorOutput "     \\q" $Cyan
        Write-ColorOutput "  4. Update data-pipeline/sqlDB.env with your PostgreSQL password" $White
        Write-Host ""
        
        # Check if PostgreSQL is installed (check PATH first, then common locations)
        $pgInstalled = $false
        $psqlPath = $null
        
        # Try to find psql in PATH
        try {
            $pgVersion = psql --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-StatusMessage "PostgreSQL found in PATH: $pgVersion" "SUCCESS"
                $pgInstalled = $true
                $psqlPath = "psql"
            }
        }
        catch {
            # Try to find PostgreSQL in common installation locations
            $commonPaths = @(
                "C:\Program Files\PostgreSQL\*\bin\psql.exe",
                "C:\Program Files (x86)\PostgreSQL\*\bin\psql.exe"
            )
            
            foreach ($pattern in $commonPaths) {
                $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($found) {
                    $psqlPath = $found.FullName
                    $pgInstalled = $true
                    Write-StatusMessage "PostgreSQL found at: $psqlPath" "SUCCESS"
                    Write-ColorOutput "  Note: PostgreSQL is installed but not in PATH. Using full path." $Yellow
                    break
                }
            }
        }
        
        if (-not $pgInstalled) {
            Write-StatusMessage "PostgreSQL is not installed or not found" "WARNING"
            Write-ColorOutput "  Please install PostgreSQL and add it to your PATH, then re-run this phase" $Yellow
        }
        else {
            Write-StatusMessage "Schema creation script: database/postgresql_schema.sql" "INFO"
            $runSchema = Read-Host "Run schema creation script now? (Y/N)"
            if ($runSchema -eq "Y" -or $runSchema -eq "y") {
                $schemaPath = Join-Path (Join-Path $script:ScriptDir "database") "postgresql_schema.sql"
                if (Test-Path $schemaPath) {
                    $dbName = if ($dbConfig["SQL_DB"]) { $dbConfig["SQL_DB"] } elseif ($dbConfig["DB_NAME"]) { $dbConfig["DB_NAME"] } else { "wealtharenadb" }
                    $dbUser = if ($dbConfig["SQL_UID"]) { $dbConfig["SQL_UID"] } elseif ($dbConfig["DB_USER"]) { $dbConfig["DB_USER"] } else { "postgres" }
                    Write-StatusMessage "To run the schema, execute:" "INFO"
                    if ($psqlPath -eq "psql") {
                        Write-ColorOutput "  psql -U $dbUser -d $dbName -f `"$schemaPath`"" $Cyan
                    }
                    else {
                        Write-ColorOutput "  & `"$psqlPath`" -U $dbUser -d $dbName -f `"$schemaPath`"" $Cyan
                    }
                    Write-ColorOutput "  (You will be prompted for the password)" $Yellow
                    Write-Host ""
                    Write-ColorOutput "  Or set PGPASSWORD environment variable to avoid password prompt:" $White
                    Write-ColorOutput "  `$env:PGPASSWORD='your-password'; & `"$psqlPath`" -U $dbUser -d $dbName -f `"$schemaPath`"" $Cyan
                }
                else {
                    Write-StatusMessage "Schema file not found: $schemaPath" "WARNING"
                }
            }
        }
    }
    elseif ($detectedDbType -eq "sqlserver") {
        Write-StatusMessage "Setting up LOCAL SQL Server database..." "INFO"
        Write-Host ""
        Write-ColorOutput "SQL Server Local Setup Instructions:" $Yellow
        Write-ColorOutput "  1. Install SQL Server Express from: https://www.microsoft.com/en-us/sql-server/sql-server-downloads" $White
        Write-ColorOutput "     OR install SQL Server LocalDB (lighter option for development)" $White
        Write-ColorOutput "  2. During installation, set SQL Server authentication mode to 'Mixed Mode'" $White
        Write-ColorOutput "  3. Set a password for the 'sa' user" $White
        Write-ColorOutput "  4. Create a database named 'WealthArenaDB' using SQL Server Management Studio (SSMS)" $White
        Write-ColorOutput "     Or use sqlcmd: sqlcmd -S localhost -U sa -Q 'CREATE DATABASE WealthArenaDB;'" $Cyan
        Write-ColorOutput "  5. Update data-pipeline/sqlDB.env with your SQL Server password" $White
        Write-Host ""
        
        # Check if SQL Server is accessible
        $sqlInstalled = $false
        try {
            $sqlVersion = sqlcmd -? 2>&1
            if ($LASTEXITCODE -eq 0 -or $sqlVersion -match "sqlcmd") {
                Write-StatusMessage "SQL Server tools found" "SUCCESS"
                $sqlInstalled = $true
            }
        }
        catch {
            Write-StatusMessage "SQL Server tools not found in PATH" "WARNING"
        }
        
        if (-not $sqlInstalled) {
            Write-StatusMessage "SQL Server is not installed or not in PATH" "WARNING"
            Write-ColorOutput "  Please install SQL Server Express and add it to your PATH, then re-run this phase" $Yellow
        }
        else {
            Write-StatusMessage "Schema creation script: database/azure_sql_schema.sql" "INFO"
            Write-ColorOutput "  Note: The SQL schema file is compatible with local SQL Server" $Yellow
            $runSchema = Read-Host "Run schema creation script now? (Y/N)"
            if ($runSchema -eq "Y" -or $runSchema -eq "y") {
                $schemaPath = Join-Path (Join-Path $script:ScriptDir "database") "azure_sql_schema.sql"
                if (Test-Path $schemaPath) {
                    $dbName = if ($dbConfig["SQL_DB"]) { $dbConfig["SQL_DB"] } else { "WealthArenaDB" }
                    $dbUser = if ($dbConfig["SQL_UID"]) { $dbConfig["SQL_UID"] } else { "sa" }
                    Write-StatusMessage "To run the schema, execute:" "INFO"
                    Write-ColorOutput "  sqlcmd -S localhost -U $dbUser -d $dbName -i `"$schemaPath`"" $Cyan
                    Write-ColorOutput "  (You will be prompted for the password)" $Yellow
                }
                else {
                    Write-StatusMessage "Schema file not found: $schemaPath" "WARNING"
                }
            }
        }
    }
    else {
        Write-StatusMessage "Unknown database type: $detectedDbType" "WARNING"
        Write-ColorOutput "Supported types: postgresql, sqlserver" $Yellow
    }
    
    Write-Host ""
    Write-ColorOutput "Database setup instructions provided. Update sqlDB.env with your credentials and run the schema script." $Cyan
    Write-Host ""
    
    return $true
}

# Phase 5: Service Startup
function Invoke-Phase5-Services {
    Write-PhaseHeader "Service Startup" "5"
    
    # Clean up existing processes on service ports
    Write-StatusMessage "Cleaning up existing processes on service ports..." "INFO"
    $portsToClean = @(3000, 8000, 5002, 8081)
    $cleanedPorts = @()
    
    foreach ($port in $portsToClean) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connections) {
                $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
                foreach ($pid in $processIds) {
                    try {
                        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                        $cleanedPorts += $port
                        Write-StatusMessage "Terminated process $pid on port $port" "INFO"
                    }
                    catch {
                        # Process may have already terminated
                    }
                }
            }
        }
        catch {
            # Port may not be in use
        }
    }
    
    if ($cleanedPorts.Count -gt 0) {
        Write-StatusMessage "Cleaned up processes on ports: $($cleanedPorts -join ', ')" "SUCCESS"
        Start-Sleep -Seconds 2  # Give ports time to release
    }
    else {
        Write-StatusMessage "No existing processes found on service ports" "INFO"
    }
    
    $serviceStatus = @{}
    
    # Start Backend
    Write-StatusMessage "Starting Backend service..." "INFO"
    try {
        $backendDir = Join-Path $script:ScriptDir "backend"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$backendDir'; npm run dev"
        Start-Sleep -Seconds 5
        
        if (Test-ServiceHealth "http://localhost:3000/health") {
            Write-StatusMessage "Backend service is running" "SUCCESS"
            $serviceStatus.Backend = $true
        }
        else {
            Write-StatusMessage "Backend service may not be ready yet" "WARNING"
            $serviceStatus.Backend = $false
        }
    }
    catch {
        Write-StatusMessage "Error starting Backend: $_" "ERROR"
        $serviceStatus.Backend = $false
    }
    
    # Start Chatbot
    Write-StatusMessage "Starting Chatbot service..." "INFO"
    try {
        $chatbotDir = Join-Path $script:ScriptDir "chatbot"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$chatbotDir'; python main.py"
        Start-Sleep -Seconds 5
        
        if (Test-ServiceHealth "http://localhost:8000/health") {
            Write-StatusMessage "Chatbot service is running" "SUCCESS"
            $serviceStatus.Chatbot = $true
        }
        else {
            Write-StatusMessage "Chatbot service may not be ready yet" "WARNING"
            $serviceStatus.Chatbot = $false
        }
    }
    catch {
        Write-StatusMessage "Error starting Chatbot: $_" "ERROR"
        $serviceStatus.Chatbot = $false
    }
    
    # Start RL Service
    Write-StatusMessage "Starting RL Service..." "INFO"
    try {
        $rlDir = Join-Path (Join-Path $script:ScriptDir "rl-service") "api"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$rlDir'; python inference_server.py"
        Start-Sleep -Seconds 5
        
        if (Test-ServiceHealth "http://localhost:5002/health") {
            Write-StatusMessage "RL Service is running" "SUCCESS"
            $serviceStatus.RLService = $true
        }
        else {
            Write-StatusMessage "RL Service may not be ready yet" "WARNING"
            $serviceStatus.RLService = $false
        }
    }
    catch {
        Write-StatusMessage "Error starting RL Service: $_" "ERROR"
        $serviceStatus.RLService = $false
    }
    
    # Start Frontend
    Write-StatusMessage "Starting Frontend (Expo)..." "INFO"
    try {
        $frontendDir = Join-Path $script:ScriptDir "frontend"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$frontendDir'; npm start"
        Start-Sleep -Seconds 10
        
        Write-StatusMessage "Frontend Expo server starting (check the new window for QR code)" "SUCCESS"
        $serviceStatus.Frontend = $true
    }
    catch {
        Write-StatusMessage "Error starting Frontend: $_" "ERROR"
        $serviceStatus.Frontend = $false
    }
    
    Write-Host ""
    Write-ColorOutput "Service Status Dashboard:" $Cyan
    Write-ColorOutput "  Backend API    : http://localhost:3000" $White
    Write-ColorOutput "  Chatbot Service: http://localhost:8000" $White
    Write-ColorOutput "  RL Service     : http://localhost:5002" $White
    Write-ColorOutput "  Frontend (Expo) : http://localhost:8081" $White
    Write-Host ""
    
    return $serviceStatus
}

# Phase 6: Data Pipeline Execution
function Invoke-Phase6-DataPipeline {
    if ($SkipDataDownload -and $SkipDataProcessing) {
        Write-PhaseHeader "Data Pipeline Execution" "6"
        Write-StatusMessage "Skipping data pipeline execution as requested" "WARNING"
        return $true
    }
    
    Write-PhaseHeader "Data Pipeline Execution" "6"
    
    $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
    Set-Location $dataPipelineDir
    
    if (-not $SkipDataDownload) {
        # Check if financial assets data already exists
        $rawDataDir = Join-Path $dataPipelineDir "data\raw"
        $hasStocks = (Get-ChildItem -Path $rawDataDir -Filter "*_raw.csv" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*stock*" -or $_.Name -match "^[A-Z]{2,5}_raw\.csv$" }).Count -gt 0
        $hasForex = (Get-ChildItem -Path $rawDataDir -Filter "*_raw.csv" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*forex*" -or $_.Name -like "*FX*" -or $_.Name -match "^[A-Z]{6}=X_raw\.csv$" }).Count -gt 0
        $hasCrypto = (Get-ChildItem -Path $rawDataDir -Filter "*_raw.csv" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*crypto*" -or $_.Name -match "^(BTC|ETH|SOL|ADA|XRP|DOT|AVAX|LINK|UNI|ATOM|MATIC|ALGO|VET|FIL|TRX|ETC|LTC|BCH|XLM|AAVE)-USD_raw\.csv$" }).Count -gt 0
        $hasCommodities = (Get-ChildItem -Path $rawDataDir -Filter "*_raw.csv" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*commodity*" -or $_.Name -match "^(GC|SI|CL|NG|ZC|ZS|ZW|KC|CC|CT|SB|JO|LBS|OZ)=F_raw\.csv$" }).Count -gt 0
        
        $totalFiles = (Get-ChildItem -Path $rawDataDir -Filter "*_raw.csv" -ErrorAction SilentlyContinue).Count
        
        if ($totalFiles -gt 50 -and ($hasStocks -or $hasForex -or $hasCrypto -or $hasCommodities)) {
            Write-StatusMessage "Financial assets data already exists" "INFO"
            Write-ColorOutput "  Found $totalFiles data files in data/raw/" "Cyan"
            Write-ColorOutput "  Stocks: $(if ($hasStocks) { 'Yes' } else { 'No' })" "Cyan"
            Write-ColorOutput "  Forex: $(if ($hasForex) { 'Yes' } else { 'No' })" "Cyan"
            Write-ColorOutput "  Crypto: $(if ($hasCrypto) { 'Yes' } else { 'No' })" "Cyan"
            Write-ColorOutput "  Commodities: $(if ($hasCommodities) { 'Yes' } else { 'No' })" "Cyan"
            Write-StatusMessage "Skipping data download - existing data found" "SUCCESS"
            Write-ColorOutput "  To re-download, delete files in data-pipeline/data/raw/ or use --SkipDataDownload:$false" "Yellow"
        }
        else {
            Write-StatusMessage "Running data download (MVP mode - 100 stocks)..." "INFO"
            try {
                python run_all_downloaders.py --mvp
                if ($LASTEXITCODE -eq 0) {
                    Write-StatusMessage "Data download completed" "SUCCESS"
                }
                else {
                    Write-StatusMessage "Data download failed" "ERROR"
                }
            }
            catch {
                Write-StatusMessage "Data download error: $_" "ERROR"
            }
        }
    }
    
    if (-not $SkipDataProcessing) {
        Write-StatusMessage "Processing data and computing indicators..." "INFO"
        
        # Check for required ODBC driver before processing
        Write-StatusMessage "Verifying required ODBC driver..." "INFO"
        try {
            $sqlEnvPath = Join-Path $dataPipelineDir "sqlDB.env"
            if (Test-Path $sqlEnvPath) {
                $sqlEnvContent = Get-Content $sqlEnvPath -Raw
                if ($sqlEnvContent -match "SQL_DRIVER=(.+)") {
                    $driverName = $matches[1].Trim()
                    $isPostgres = $driverName -like "*PostgreSQL*"
                    
                    # Check if required driver is available
                    $driverCheckScript = @"
import pyodbc
drivers = pyodbc.drivers()
driver_name = '$driverName'
is_postgres = $isPostgres
if is_postgres:
    pg_drivers = [d for d in drivers if 'PostgreSQL' in d or 'postgres' in d.lower()]
    if pg_drivers:
        print('OK')
    else:
        print('MISSING_POSTGRES')
else:
    sql_drivers = [d for d in drivers if 'SQL Server' in d and '18' in d]
    if sql_drivers:
        print('OK')
    else:
        print('MISSING_SQLSERVER')
"@
                    $driverCheck = python -c $driverCheckScript 2>&1
                    if ($driverCheck -match "MISSING") {
                        if ($driverCheck -match "POSTGRES") {
                            Write-StatusMessage "PostgreSQL ODBC driver not found!" "ERROR"
                            Write-ColorOutput "  Your sqlDB.env uses PostgreSQL but the driver is not installed." $Red
                            Write-ColorOutput "  Install with: choco install psqlodbc -y (as Administrator)" $Yellow
                            Write-ColorOutput "  Or download: https://www.postgresql.org/ftp/odbc/versions/msi/" $Yellow
                            Write-ColorOutput "  Or switch to SQL Server in sqlDB.env (driver already installed)" $Yellow
                            throw "PostgreSQL ODBC driver required but not installed"
                        }
                        else {
                            Write-StatusMessage "SQL Server ODBC driver not found!" "ERROR"
                            Write-ColorOutput "  Install with: winget install --id Microsoft.msodbcsql.18 -e" $Yellow
                            throw "SQL Server ODBC driver required but not installed"
                        }
                    }
                    else {
                        Write-StatusMessage "Required ODBC driver verified" "SUCCESS"
                    }
                }
            }
        }
        catch {
            Write-StatusMessage "ODBC driver check failed: $_" "WARNING"
            Write-ColorOutput "  Continuing anyway - connection will be attempted..." $Yellow
        }
        
        try {
            python processAndStore.py
            if ($LASTEXITCODE -eq 0) {
                Write-StatusMessage "Data processing completed" "SUCCESS"
            }
            else {
                Write-StatusMessage "Data processing failed" "ERROR"
            }
        }
        catch {
            Write-StatusMessage "Data processing error: $_" "ERROR"
        }
    }
    
    Set-Location $script:ScriptDir
    return $true
}

# Phase 7: Scheduler Setup
function Invoke-Phase7-Scheduler {
    Write-PhaseHeader "Scheduler Setup" "7"
    
    # Create daily refresh script
    $dailyRefreshScript = Join-Path (Join-Path $script:ScriptDir "scripts") "daily_data_refresh.ps1"
    $scriptsDir = Join-Path $script:ScriptDir "scripts"
    if (-not (Test-Path $scriptsDir)) {
        New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
    }
    
    Write-StatusMessage "Creating daily data refresh script..." "INFO"
    $refreshScriptContent = @"
#Requires -Version 5.1
`$ErrorActionPreference = "Stop"

`$scriptDir = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$projectRoot = Split-Path -Parent `$scriptDir
`$logDir = Join-Path `$projectRoot "local_setup_logs"

if (-not (Test-Path `$logDir)) {
    New-Item -ItemType Directory -Path `$logDir -Force | Out-Null
}

`$timestamp = Get-Date -Format "yyyyMMdd"
`$logFile = Join-Path `$logDir "daily_refresh_`$timestamp.log"

function Write-Log {
    param([string]`$Message)
    `$logTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path `$logFile -Value "[`$logTime] `$Message"
}

`$startTime = Get-Date
Write-Log "Daily data refresh started"

try {
    Set-Location `$projectRoot
    `$pipelineScript = Join-Path (Join-Path (Join-Path `$projectRoot "infrastructure") "data_pipeline_standalone") "run_full_pipeline.bat"
    
    if (Test-Path `$pipelineScript) {
        Write-Log "Executing: `$pipelineScript"
        & `$pipelineScript
        `$exitCode = `$LASTEXITCODE
        
        `$endTime = Get-Date
        `$duration = `$endTime - `$startTime
        
        if (`$exitCode -eq 0) {
            Write-Log "Daily data refresh completed successfully in `$(`$duration.ToString('hh\:mm\:ss'))"
        }
        else {
            Write-Log "Daily data refresh failed with exit code `$exitCode"
            exit `$exitCode
        }
    }
    else {
        Write-Log "ERROR: Pipeline script not found: `$pipelineScript"
        exit 1
    }
}
catch {
    Write-Log "ERROR: Exception during daily refresh: `$_"
    exit 1
}
"@
    
    Set-Content -Path $dailyRefreshScript -Value $refreshScriptContent -Force
    Write-StatusMessage "Daily refresh script created" "SUCCESS"
    
    # Create scheduled task
    Write-StatusMessage "Creating Windows Task Scheduler job..." "INFO"
    $taskCreated = Create-SchedulerTask -TaskName "WealthArena_DailyDataRefresh" -ScriptPath $dailyRefreshScript -Schedule "Daily" -Time "06:00"
    
    if ($taskCreated) {
        Write-StatusMessage "Scheduled task created. Runs daily at 6:00 AM" "SUCCESS"
        Write-ColorOutput "To modify schedule: schtasks /change /tn WealthArena_DailyDataRefresh /st <TIME>" $Yellow
    }
    
    return $taskCreated
}

# Phase 8: APK Build Configuration
function Invoke-Phase8-APKBuild {
    if ($SkipAPKBuild) {
        Write-PhaseHeader "APK Build Configuration" "8"
        Write-StatusMessage "Skipping APK build configuration as requested" "WARNING"
        return $true
    }
    
    Write-PhaseHeader "APK Build Configuration" "8"
    
    $frontendDir = Join-Path $script:ScriptDir "frontend"
    $easJsonPath = Join-Path $frontendDir "eas.json"
    
    # Create eas.json if it doesn't exist
    if (-not (Test-Path $easJsonPath)) {
        Write-StatusMessage "Creating frontend/eas.json..." "INFO"
        $easJsonContent = @"
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
"@
        Set-Content -Path $easJsonPath -Value $easJsonContent -Force
        Write-StatusMessage "eas.json created" "SUCCESS"
    }
    else {
        Write-StatusMessage "eas.json already exists" "INFO"
    }
    
    # Check EAS login
    Write-StatusMessage "Checking EAS CLI login status..." "INFO"
    try {
        $easUser = eas whoami 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "EAS CLI logged in as: $easUser" "SUCCESS"
        }
        else {
            Write-StatusMessage "EAS CLI not logged in" "WARNING"
            Write-ColorOutput "Please run: eas login" $Yellow
            Write-ColorOutput "Then you can build APK with: eas build --platform android --profile development" $Yellow
        }
    }
    catch {
        Write-StatusMessage "Error checking EAS login: $_" "WARNING"
    }
    
    $buildNow = Read-Host "Start APK build now? (Y/N)"
    if ($buildNow -eq "Y" -or $buildNow -eq "y") {
        Set-Location $frontendDir
        Write-StatusMessage "Starting APK build (this may take 15-30 minutes)..." "INFO"
        try {
            eas build --platform android --profile development --local
            if ($LASTEXITCODE -eq 0) {
                Write-StatusMessage "APK build completed" "SUCCESS"
            }
            else {
                Write-StatusMessage "APK build failed" "ERROR"
            }
        }
        catch {
            Write-StatusMessage "APK build error: $_" "ERROR"
        }
        finally {
            Set-Location $script:ScriptDir
        }
    }
    else {
        Write-StatusMessage "APK build skipped. Run manually when ready:" "INFO"
        Write-ColorOutput "  cd frontend && eas build --platform android --profile development" $Yellow
    }
    
    return $true
}

# Phase 9: Verification & Summary
function Invoke-Phase9-Verification {
    param([string]$LocalIP)
    
    Write-PhaseHeader "Verification & Summary" "9"
    
    Write-StatusMessage "Testing service health endpoints..." "INFO"
    
    $healthResults = @{
        Backend = Test-ServiceHealth "http://localhost:3000/health"
        Chatbot = Test-ServiceHealth "http://localhost:8000/health"
        RLService = Test-ServiceHealth "http://localhost:5002/health"
    }
    
    # Validate chatbot environment variables
    Write-StatusMessage "Validating chatbot environment configuration..." "INFO"
    try {
        $chatbotDir = Join-Path $script:ScriptDir "chatbot"
        $validateScript = Join-Path $chatbotDir "scripts\validate_env.py"
        if (Test-Path $validateScript) {
            Set-Location $chatbotDir
            $validateOutput = python $validateScript 2>&1
            $validateExitCode = $LASTEXITCODE
            if ($validateExitCode -eq 0) {
                Write-StatusMessage "Chatbot environment validation passed" "SUCCESS"
            }
            else {
                Write-StatusMessage "Chatbot environment validation found issues (non-critical)" "WARNING"
                Write-ColorOutput "  Review the output above and update .env or .env.local as needed" $Yellow
            }
            Set-Location $script:ScriptDir
        }
    }
    catch {
        Write-StatusMessage "Environment validation script not available (non-critical)" "WARNING"
    }
    
    # Run consolidated chatbot test harness (optional, non-fatal)
    if ($healthResults.Chatbot) {
        Write-StatusMessage "Running consolidated chatbot test harness..." "INFO"
        try {
            $testChatbotScript = Join-Path $script:ScriptDir "scripts\testing\test_chatbot.ps1"
            if (Test-Path $testChatbotScript) {
                & $testChatbotScript -Mode Full
                if ($LASTEXITCODE -eq 0) {
                    Write-StatusMessage "Chatbot test harness passed" "SUCCESS"
                } else {
                    Write-StatusMessage "Chatbot test harness had issues (non-critical)" "WARNING"
                    Write-ColorOutput "  Review the test output above for details" $Yellow
                }
            } else {
                Write-StatusMessage "Consolidated chatbot test script not found at: $testChatbotScript" "WARNING"
            }
        }
        catch {
            Write-StatusMessage "Error running chatbot test harness: $_ (non-critical)" "WARNING"
        }
    }
    
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "Setup Complete!" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    
    Write-ColorOutput "Service URLs:" $White
    Write-ColorOutput "  Backend API    : http://localhost:3000" $White
    Write-ColorOutput "  Chatbot Service: http://localhost:8000" $White
    Write-ColorOutput "  RL Service     : http://localhost:5002" $White
    Write-ColorOutput "  Frontend (Expo) : http://localhost:8081" $White
    Write-Host ""
    
    Write-ColorOutput "Mobile Device Connection:" $White
    Write-ColorOutput "  Local IP: $LocalIP" $Cyan
    Write-ColorOutput "  Backend URL: http://$LocalIP:3000" $Cyan
    Write-ColorOutput "  Chatbot URL: http://$LocalIP:8000" $Cyan
    Write-ColorOutput "  RL Service URL: http://$LocalIP:5002" $Cyan
    Write-Host ""
    Write-ColorOutput "  To connect from mobile device:" $Yellow
    Write-ColorOutput "  1. Ensure your device is on the same network" $Yellow
    Write-ColorOutput "  2. Scan the QR code from Expo dev server" $Yellow
    Write-ColorOutput "  3. Or install APK when build completes" $Yellow
    Write-Host ""
    
    Write-ColorOutput "Next Steps:" $White
    Write-ColorOutput "  1. Review and update .env.local files with your credentials" $Yellow
    Write-ColorOutput "  2. Scan QR code in Expo window to test on mobile" $Yellow
    Write-ColorOutput "  3. Access backend API docs: http://localhost:3000" $Yellow
    Write-ColorOutput "  4. Check service logs in the PowerShell windows" $Yellow
    Write-Host ""
    
    Write-ColorOutput "Log File: $logFile" $Cyan
    Write-Host ""
    
    $openBrowser = Read-Host "Open backend API in browser? (Y/N)"
    if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
        Start-Process "http://localhost:3000"
    }
}

# Main execution
function Main {
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "WealthArena Local Setup" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    Write-ColorOutput "This script will set up your local development environment" $White
    Write-ColorOutput "Estimated time: 30-60 minutes (excluding data download)" $Yellow
    Write-Host ""
    
    $startTime = Get-Date
    Write-Log "Setup started"
    
    # Phase 1: Prerequisites
    $prereqResult = Invoke-Phase1-Prerequisites
    if ($prereqResult -is [hashtable]) {
        $localIP = $prereqResult.LocalIP
    }
    else {
        Write-StatusMessage "Prerequisites check failed. Exiting." "ERROR"
        exit 1
    }
    
    Write-Host ""
    Write-ColorOutput "Continue with setup? (Y/N)" $Yellow
    $response = Read-Host
    if ($response -ne "Y" -and $response -ne "y") {
        Write-StatusMessage "Setup cancelled by user" "WARNING"
        exit 0
    }
    
    # Phase 2: Dependencies
    Invoke-Phase2-Dependencies | Out-Null
    
    # Phase 3: Environment
    Invoke-Phase3-Environment -LocalIP $localIP
    
    # Phase 4: Database
    Invoke-Phase4-Database | Out-Null
    
    # Phase 5: Services
    Invoke-Phase5-Services | Out-Null
    
    # Phase 6: Data Pipeline
    Invoke-Phase6-DataPipeline | Out-Null
    
    # Phase 7: Scheduler
    Invoke-Phase7-Scheduler | Out-Null
    
    # Phase 8: APK Build
    Invoke-Phase8-APKBuild | Out-Null
    
    # Phase 9: Verification
    Invoke-Phase9-Verification -LocalIP $localIP
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    Write-Log "Setup completed in $($duration.ToString('hh\:mm\:ss'))"
    
    Write-Host ""
    Write-ColorOutput "Setup completed in $($duration.ToString('hh\:mm\:ss'))" $Green
    Write-Host ""
    
    # EAS Login Prompt for APK Build
    Write-Host ""
    $separator = -join (1..70 | ForEach-Object { "=" })
    Write-ColorOutput $separator $Cyan
    Write-ColorOutput "EAS Login for APK Build" $Cyan
    Write-ColorOutput $separator $Cyan
    Write-Host ""
    Write-ColorOutput "To build the APK, you need to be logged into Expo Application Services (EAS)." $Yellow
    Write-Host ""
    
    # Check if already logged in
    $frontendDir = Join-Path $script:ScriptDir "frontend"
    Set-Location $frontendDir
    try {
        $easUser = eas whoami 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "[OK] Already logged in as: $($easUser.Trim())" $Green
            Write-Host ""
            Write-ColorOutput "You can now build the APK with:" $Cyan
            Write-ColorOutput "  cd frontend" $White
            Write-ColorOutput "  eas build --platform android --profile development" $White
            Write-Host ""
        }
        else {
            Write-ColorOutput "[X] Not logged into EAS" $Red
            Write-Host ""
            Write-ColorOutput "Please login to EAS now to enable APK builds:" $Yellow
            Write-ColorOutput "  1. Run: eas login" $White
            Write-ColorOutput "  2. Enter your Expo account credentials" $White
            Write-ColorOutput "  3. Then build APK with: eas build --platform android --profile development" $White
            Write-Host ""
            $loginNow = Read-Host "Login to EAS now? (Y/N)"
            if ($loginNow -eq "Y" -or $loginNow -eq "y") {
                Write-StatusMessage "Starting EAS login..." "INFO"
                try {
                    eas login
                    if ($LASTEXITCODE -eq 0) {
                        Write-StatusMessage "EAS login successful" "SUCCESS"
                        Write-Host ""
                        Write-ColorOutput "You can now build the APK with:" $Cyan
                        Write-ColorOutput "  cd frontend" $White
                        Write-ColorOutput "  eas build --platform android --profile development" $White
                    }
                    else {
                        Write-StatusMessage "EAS login failed" "ERROR"
                        Write-ColorOutput "Please try logging in manually: eas login" $Yellow
                    }
                }
                catch {
                    Write-StatusMessage "EAS login error: $_" "ERROR"
                    Write-ColorOutput "Please try logging in manually: eas login" $Yellow
                }
            }
            else {
                Write-ColorOutput "You can login later with: eas login" $Yellow
            }
        }
    }
    catch {
        Write-ColorOutput "Could not check EAS login status. Install EAS CLI with: npm install -g eas-cli" $Yellow
        Write-ColorOutput "Then login with: eas login" $Yellow
    }
    finally {
        Set-Location $script:ScriptDir
    }
    
    Write-Host ""
}

# Run main
try {
    Main
}
catch {
    Write-StatusMessage "Fatal error: $_" "ERROR"
    Write-Log "Fatal error: $_" "ERROR"
    Stop-AllServices
    exit 1
}

