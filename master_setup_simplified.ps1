#Requires -Version 5.1

<#
.SYNOPSIS
    WealthArena Simplified Setup Script - Streamlined local development setup
    
.DESCRIPTION
    Simplified setup for WealthArena with:
    - No database installation (uses in-memory mock database)
    - No RAG system (direct GroQ API with guardrails)
    - Faster setup and testing
    - Interactive testing prompts
    - Data pipeline setup (Phase 3.5) for market data download
    - Consolidated chatbot test harness (scripts/testing/test_chatbot.ps1)
    - APK build after testing
    
    Data Pipeline Setup (Phase 3.5):
    - Requires Python 3.8+ installation
    - Downloads market data from data-pipeline scripts
    - Options: MVP mode (~50 stocks, 5-10 min) or Full mode (all stocks, 30-60 min)
    - Backend automatically loads CSV data on startup
    
.PARAMETER SkipDependencies
    Skip npm and pip dependency installation phases
    
.PARAMETER SkipAPKBuild
    Skip Android APK build
    
.EXAMPLE
    .\master_setup_simplified.ps1
    
.EXAMPLE
    .\master_setup_simplified.ps1 -SkipDependencies
    
.NOTES
    Python Requirement:
    - Python 3.8+ is required for data-pipeline scripts
    - Install from https://www.python.org/ and add to PATH
    - Data download options: MVP (recommended) or Full dataset
#>

param(
    [switch]$SkipDependencies = $false,
    [switch]$SkipAPKBuild = $false
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
$logFile = Join-Path $logDir "master_setup_simplified_$timestamp.log"

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

function Get-MachineIPAddress {
    <#
    .SYNOPSIS
        Detects the machine's IPv4 address on the active network interface
    
    .DESCRIPTION
        Finds the first valid IPv4 address that is not loopback (127.0.0.1), 
        link-local (169.254.x.x), or VirtualBox network (192.168.56.x).
        Prioritizes actual network interfaces over virtual ones.
        Falls back to prompting the user if auto-detection fails.
    
    .OUTPUTS
        [string] The machine's IP address
    #>
    try {
        # Get all IPv4 addresses
        $ipAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop
        
        # Filter out loopback, link-local, and VirtualBox addresses
        $validIPs = $ipAddresses | Where-Object {
            $ip = $_.IPAddress
            # Not loopback (127.0.0.1)
            -not $ip.StartsWith("127.") -and
            # Not link-local (169.254.x.x)
            -not $ip.StartsWith("169.254.") -and
            # Not VirtualBox network (192.168.56.x) - prefer actual network IPs
            -not $ip.StartsWith("192.168.56.") -and
            # Has a valid prefix length (connected interface)
            $_.PrefixLength -gt 0
        } | ForEach-Object {
            # Add priority score to each IP
            $ip = $_.IPAddress
            $interface = $_.InterfaceAlias
            $priority = 0
            
            # Prioritize Wi-Fi and Ethernet interfaces (actual network connections)
            if ($interface -like "*Wi-Fi*" -or $interface -like "*WLAN*" -or $interface -like "*Wireless*") {
                $priority += 200  # Wi-Fi gets highest priority
            }
            elseif ($interface -like "*Ethernet*" -and $interface -notlike "*vEthernet*" -and $interface -notlike "*Virtual*") {
                $priority += 150  # Physical Ethernet gets high priority
            }
            elseif ($interface -like "*vEthernet*" -or $interface -like "*Virtual*") {
                $priority += 10   # Virtual adapters get low priority
            }
            else {
                $priority += 50   # Other interfaces get medium priority
            }
            
            # Prefer 192.168.1.x (common home network) over other ranges
            if ($ip.StartsWith("192.168.1.")) { $priority += 100 }
            elseif ($ip.StartsWith("192.168.")) { $priority += 80 }
            elseif ($ip.StartsWith("10.")) { $priority += 60 }
            else { $priority += 20 }
            
            # Add prefix length as tiebreaker (more specific = better)
            $priority += (32 - $_.PrefixLength)
            
            [PSCustomObject]@{
                IPAddress = $ip
                InterfaceAlias = $interface
                PrefixLength = $_.PrefixLength
                Priority = $priority
                OriginalObject = $_
            }
        } | Sort-Object -Property Priority -Descending
        
        if ($validIPs.Count -gt 0) {
            # Show all detected IPs for user verification
            Write-Host ""
            Write-ColorOutput "Detected Network IPs (sorted by priority):" $Cyan
            Write-Host ""
            $index = 1
            foreach ($ipInfo in $validIPs) {
                $marker = if ($index -eq 1) { " [AUTO-SELECTED]" } else { "" }
                $color = if ($index -eq 1) { $Green } else { $White }
                Write-ColorOutput "  [$index] $($ipInfo.IPAddress) | $($ipInfo.InterfaceAlias) | Priority: $($ipInfo.Priority)$marker" $color
                $index++
            }
            Write-Host ""
            
            # Auto-select the highest priority IP
            $detectedIP = $validIPs[0].IPAddress
            $selectedInterface = $validIPs[0].InterfaceAlias
            
            # If multiple IPs found, let user choose (but default to auto-selected)
            if ($validIPs.Count -gt 1) {
                Write-ColorOutput "Multiple network interfaces detected." $Yellow
                Write-ColorOutput "Auto-selected: $detectedIP ($selectedInterface)" $Green
                Write-Host ""
                Write-ColorOutput "========================================" $Cyan
                Write-ColorOutput "ACTION REQUIRED: Choose IP address" $Yellow
                Write-ColorOutput "========================================" $Cyan
                Write-ColorOutput "Options:" $Cyan
                Write-ColorOutput "  [Y] or [Enter] = Use auto-selected IP: $detectedIP (recommended)" $White
                Write-ColorOutput "  [N] = Choose a different IP from the list above" $White
                Write-Host ""
                Write-ColorOutput ">>> Waiting for your input..." $Yellow
                $useSelected = Read-Host "Use auto-selected IP? (Y/N, default: Y)"
                
                if ($useSelected.Trim().ToUpper() -eq "N" -or $useSelected.Trim().ToUpper() -eq "NO") {
                    Write-Host ""
                    Write-ColorOutput "Available IPs:" $Cyan
                    for ($i = 0; $i -lt $validIPs.Count; $i++) {
                        Write-ColorOutput "  [$($i+1)] $($validIPs[$i].IPAddress) - $($validIPs[$i].InterfaceAlias)" $White
                    }
                    Write-Host ""
                    $choice = Read-Host "Enter number (1-$($validIPs.Count)) or IP address"
                    
                    # Try to parse as number
                    $choiceNum = 0
                    if ([int]::TryParse($choice.Trim(), [ref]$choiceNum)) {
                        if ($choiceNum -ge 1 -and $choiceNum -le $validIPs.Count) {
                            $detectedIP = $validIPs[$choiceNum - 1].IPAddress
                            $selectedInterface = $validIPs[$choiceNum - 1].InterfaceAlias
                        } else {
                            Write-StatusMessage "Invalid choice number, using auto-selected IP" "WARNING"
                        }
                    }
                    # Try to parse as IP address
                    elseif ($choice -match '^(\d{1,3}\.){3}\d{1,3}$') {
                        $found = $validIPs | Where-Object { $_.IPAddress -eq $choice.Trim() }
                        if ($found) {
                            $detectedIP = $found.IPAddress
                            $selectedInterface = $found.InterfaceAlias
                        } else {
                            Write-StatusMessage "IP address not found in detected IPs, using auto-selected IP" "WARNING"
                        }
                    }
                    else {
                        Write-StatusMessage "Invalid input, using auto-selected IP" "WARNING"
                    }
                }
                # Default to auto-selected if user presses Enter or types Y/Yes
                else {
                    # Use auto-selected IP (already set above)
                }
            }
            # Single IP detected - use it automatically (no prompt needed)
            else {
                Write-ColorOutput "Single network interface detected - using automatically." $Green
            }
            
            Write-StatusMessage "Selected machine IP: $detectedIP ($selectedInterface)" "SUCCESS"
            Write-Host ""
            
            return $detectedIP
        }
        else {
            Write-StatusMessage "Could not auto-detect IP address" "WARNING"
            Write-Host ""
            Write-ColorOutput "Please enter your machine's IP address manually:" $Yellow
            Write-ColorOutput "  - On Windows: Run 'ipconfig' and look for IPv4 Address" $White
            Write-ColorOutput "  - On Mac/Linux: Run 'ifconfig' or 'ip addr'" $White
            Write-Host ""
            $manualIP = Read-Host "Enter your machine's IP address"
            
            if (-not $manualIP -or $manualIP.Trim() -eq "") {
                throw "IP address is required for physical device connectivity"
            }
            
            # Basic validation
            if ($manualIP -match '^(\d{1,3}\.){3}\d{1,3}$') {
                return $manualIP.Trim()
            }
            else {
                throw "Invalid IP address format: $manualIP"
            }
        }
    }
    catch {
        Write-StatusMessage "Error detecting IP address: $_" "WARNING"
        Write-Host ""
        Write-ColorOutput "Please enter your machine's IP address manually:" $Yellow
        Write-ColorOutput "  - On Windows: Run 'ipconfig' and look for IPv4 Address" $White
        Write-ColorOutput "  - On Mac/Linux: Run 'ifconfig' or 'ip addr'" $White
        Write-Host ""
        $manualIP = Read-Host "Enter your machine's IP address"
        
        if (-not $manualIP -or $manualIP.Trim() -eq "") {
            throw "IP address is required for physical device connectivity"
        }
        
        return $manualIP.Trim()
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

function Test-PythonInstalled {
    <#
    .SYNOPSIS
        Tests if Python is installed and accessible
    
    .DESCRIPTION
        Checks for Python installation by trying 'python' and 'python3' commands.
        Returns a hashtable with installation status, command name, and version.
    
    .OUTPUTS
        [hashtable] @{ Installed = $true/$false; Command = "python" or "python3"; Version = "x.y.z" }
    #>
    try {
        $pythonCmd = $null
        $pythonVersion = $null
        
        # Try 'python' first (Windows default)
        try {
            $pythonVersion = python --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                $pythonCmd = "python"
                $versionMatch = $pythonVersion -match 'Python (\d+\.\d+\.\d+)'
                if ($versionMatch) {
                    return @{
                        Installed = $true
                        Command = $pythonCmd
                        Version = $matches[1]
                    }
                }
            }
        }
        catch {
            # Try 'python3' next
            try {
                $pythonVersion = python3 --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $pythonCmd = "python3"
                    $versionMatch = $pythonVersion -match 'Python (\d+\.\d+\.\d+)'
                    if ($versionMatch) {
                        return @{
                            Installed = $true
                            Command = $pythonCmd
                            Version = $matches[1]
                        }
                    }
                }
            }
            catch {
                # Python not found
            }
        }
        
        return @{
            Installed = $false
            Command = $null
            Version = $null
        }
    }
    catch {
        return @{
            Installed = $false
            Command = $null
            Version = $null
        }
    }
}

function Get-CSVFileCount {
    <#
    .SYNOPSIS
        Counts CSV files in a given path
    
    .DESCRIPTION
        Recursively counts all CSV files in the specified path.
        Returns 0 if path doesn't exist or on errors.
    
    .PARAMETER Path
        Directory path to search for CSV files
    
    .OUTPUTS
        [int] Count of CSV files found
    #>
    param([string]$Path)
    
    try {
        if (-not (Test-Path $Path)) {
            return 0
        }
        
        $files = Get-ChildItem -Path $Path -Filter "*.csv" -Recurse -ErrorAction SilentlyContinue
        return ($files | Measure-Object).Count
    }
    catch {
        return 0
    }
}

# Phase 1: Prerequisites Check
function Invoke-Phase1-Prerequisites {
    Write-PhaseHeader "Prerequisites Check" "1"
    
    $issues = @()
    
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
        $pythonVersion = python --version
        $pythonMajor = [int]($pythonVersion -replace 'Python (\d+)\..*', '$1')
        if ($pythonMajor -ge 3) {
            Write-StatusMessage "Python version: $pythonVersion" "SUCCESS"
        }
        else {
            $issues += "Python version $pythonVersion is too old. Requires Python 3.9+"
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
        $issues += "npm not found. Install Node.js to get npm"
    }
    
    # Check Git
    Write-StatusMessage "Checking Git..." "INFO"
    try {
        $gitVersion = git --version
        Write-StatusMessage "Git found: $gitVersion" "SUCCESS"
    }
    catch {
        Write-StatusMessage "Git not found (optional)" "WARNING"
    }
    
    # Check EAS CLI
    Write-StatusMessage "Checking EAS CLI..." "INFO"
    try {
        $easVersion = eas --version 2>&1
        Write-StatusMessage "EAS CLI found: $easVersion" "SUCCESS"
    }
    catch {
        Write-StatusMessage "EAS CLI not found. Will install if needed for APK build" "WARNING"
    }
    
    if ($issues.Count -gt 0) {
        Write-Host ""
        Write-ColorOutput "Prerequisites Issues:" $Red
        foreach ($issue in $issues) {
            Write-ColorOutput "  - $issue" $Red
        }
        Write-Host ""
        throw "Please fix the prerequisites issues before continuing"
    }
    
    Write-StatusMessage "All prerequisites met" "SUCCESS"
    return $true
}

# Phase 2: Install Dependencies
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
            $results.Backend = $true
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
    
    # Chatbot (simplified - no RAG dependencies, DeepSeek API only)
    Write-StatusMessage "Installing chatbot dependencies (simplified - DeepSeek API only)..." "INFO"
    try {
        Set-Location (Join-Path $script:ScriptDir "chatbot")
        
        # Upgrade pip first for better wheel support
        Write-StatusMessage "Upgrading pip for better package compatibility..." "INFO"
        python -m pip install --upgrade pip --quiet 2>&1 | Out-Null
        
        # Use simplified requirements file (no heavy dependencies like chromadb, pandas, numpy)
        $requirementsFile = "requirements-simplified.txt"
        if (-not (Test-Path $requirementsFile)) {
            Write-StatusMessage "Simplified requirements not found, using full requirements..." "WARNING"
            $requirementsFile = "requirements.txt"
        }
        else {
            Write-StatusMessage "Using simplified requirements (DeepSeek API only - no RAG)" "INFO"
        }
        
        # Install dependencies - simplified version should have no compilation issues
        Write-StatusMessage "Installing dependencies from $requirementsFile..." "INFO"
        $pipOutput = pip install -r $requirementsFile 2>&1
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            Write-StatusMessage "Chatbot dependencies installed successfully" "SUCCESS"
            Write-ColorOutput "  Using simplified setup: FastAPI + httpx + DeepSeek API" $Cyan
            Write-ColorOutput "  No RAG/vector DB dependencies required" $Cyan
            $results.Chatbot = $true
        }
        else {
            Write-StatusMessage "Chatbot dependency installation failed" "ERROR"
            Write-ColorOutput "  Error output:" $Yellow
            Write-ColorOutput "  $pipOutput" $Red
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
    
    Write-Host ""
    Write-ColorOutput "Installation Summary:" $Cyan
    foreach ($key in $results.Keys) {
        $success = $results[$key]
        $status = if ($success) { "[OK]" } else { "[FAIL]" }
        $color = if ($success) { $Green } else { $Red }
        Write-ColorOutput "  $status $key" $color
    }
    
    return $results
}

# Phase 3: Environment Setup
function Invoke-Phase3-Environment {
    Write-PhaseHeader "Environment Configuration" "3"
    
    # Detect machine IP address for physical device connectivity
    Write-StatusMessage "Detecting machine IP address for physical device connectivity..." "INFO"
    $machineIP = Get-MachineIPAddress
    
    Write-Host ""
    Write-ColorOutput "Detected IP Address: $machineIP" $Cyan
    Write-ColorOutput "This IP will be used for:" $White
    Write-ColorOutput "  - Frontend environment variables (EXPO_PUBLIC_API_URL, EXPO_PUBLIC_CHATBOT_URL)" $White
    Write-ColorOutput "  - Backend CORS configuration (CORS_ORIGINS, ALLOWED_ORIGINS)" $White
    Write-Host ""
    Write-ColorOutput "Note: If you change networks, you may need to re-run this script to update the IP." $Yellow
    Write-Host ""
    
    # Ask for confirmation with clear default
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "PROMPT: Confirm IP address" $Yellow
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "Options:" $Cyan
    Write-ColorOutput "  [Y or Enter] Use detected IP: $machineIP (recommended)" $White
    Write-ColorOutput "  [N] Enter a different IP address" $White
    Write-Host ""
    Write-ColorOutput ">>> " -NoNewline
    $confirmIP = Read-Host "Use this IP address? (Y/N, default: Y)"
    
    if ($confirmIP.Trim().ToUpper() -eq "N" -or $confirmIP.Trim().ToUpper() -eq "NO") {
        Write-Host ""
        Write-ColorOutput "Please enter your machine's IP address:" $Yellow
        $newIP = Read-Host "IP Address"
        if (-not $newIP -or $newIP.Trim() -eq "") {
            Write-StatusMessage "No IP entered, using detected IP: $machineIP" "WARNING"
        }
        else {
            # Validate IP format
            if ($newIP -match '^(\d{1,3}\.){3}\d{1,3}$') {
                $machineIP = $newIP.Trim()
                Write-StatusMessage "Using manually entered IP: $machineIP" "SUCCESS"
            }
            else {
                Write-StatusMessage "Invalid IP format, using detected IP: $machineIP" "WARNING"
            }
        }
    }
    else {
        # Default to detected IP (user pressed Enter or typed Y/Yes)
        Write-StatusMessage "Using detected IP: $machineIP" "SUCCESS"
    }
    
    # Backend .env.local
    Write-StatusMessage "Creating backend/.env.local..." "INFO"
    try {
        $backendEnvPath = Join-Path (Join-Path $script:ScriptDir "backend") ".env.local"
        
        $backendEnvContent = @"
# Simplified Local Development Configuration
USE_MOCK_DB=true
NODE_ENV=development
PORT=3000

# Mock Database (In-Memory) - no database credentials needed
# All user data will be stored in memory and cleared on server restart

# Service URLs
CHATBOT_URL=http://localhost:8000

# CORS Origins
# Includes localhost for emulators/simulators and machine IP for physical devices
CORS_ORIGINS=http://localhost:3000,http://localhost:8081,http://${machineIP}:8081,http://${machineIP}:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,http://${machineIP}:8081,http://${machineIP}:3000

# JWT Secret
JWT_SECRET=local-dev-secret-change-in-production
"@
        Set-Content -Path $backendEnvPath -Value $backendEnvContent -Force
        Write-StatusMessage "Backend .env.local created with IP: $machineIP" "SUCCESS"
    }
    catch {
        Write-StatusMessage "Error creating backend .env.local: $_" "ERROR"
    }
    
    # Chatbot .env
    Write-StatusMessage "Creating chatbot/.env..." "INFO"
    try {
        $chatbotEnvPath = Join-Path (Join-Path $script:ScriptDir "chatbot") ".env"
        
        # Check for existing DEEPSEEK_API_KEY (primary)
        $deepseekApiKey = $null
        $hasDeepseekKey = $false
        if (Test-Path $chatbotEnvPath) {
            $existingContent = Get-Content $chatbotEnvPath
            foreach ($line in $existingContent) {
                if ($line -match "^DEEPSEEK_API_KEY=(.+)$") {
                    $deepseekApiKey = $matches[1].Trim()
                    # Check if key looks real (starts with 'sk-' which is DeepSeek's API key prefix)
                    if ($deepseekApiKey -and $deepseekApiKey.StartsWith("sk-") -and $deepseekApiKey -ne "your_deepseek_api_key_here") {
                        $hasDeepseekKey = $true
                    }
                    break
                }
            }
        }
        
        # Check for existing GROQ_API_KEY (fallback)
        $groqApiKey = $null
        $hasRealKey = $false
        if (Test-Path $chatbotEnvPath) {
            $existingContent = Get-Content $chatbotEnvPath
            foreach ($line in $existingContent) {
                if ($line -match "^GROQ_API_KEY=(.+)$") {
                    $groqApiKey = $matches[1].Trim()
                    # Check if key looks real (starts with 'gsk_' which is Groq's API key prefix)
                    if ($groqApiKey -and $groqApiKey.StartsWith("gsk_") -and $groqApiKey -ne "your_groq_api_key_here") {
                        $hasRealKey = $true
                    }
                    break
                }
            }
        }
        
        # Warn if real keys detected
        if ($hasDeepseekKey -or $hasRealKey) {
            Write-Host ""
            Write-ColorOutput "⚠️  SECURITY WARNING: Detected potential real API keys in existing chatbot/.env" $Yellow
            Write-ColorOutput "   If these keys were ever committed to git, rotate them immediately at:" $Yellow
            Write-ColorOutput "   - DeepSeek: https://platform.deepseek.com" $Yellow
            Write-ColorOutput "   - Groq: https://console.groq.com" $Yellow
            Write-ColorOutput "   The script will preserve your existing keys, but ensure they're not in version control." $Yellow
            Write-Host ""
            $continueResponse = Read-Host "Continue with existing keys? (Y/N)"
            if ($continueResponse.Trim().ToUpper() -ne "Y") {
                Write-StatusMessage "Skipping chatbot .env configuration" "WARNING"
                return $true
            }
        }
        
        # Prompt for DEEPSEEK_API_KEY first (primary)
        if (-not $deepseekApiKey -or $deepseekApiKey -eq "your_deepseek_api_key_here") {
            Write-Host ""
            Write-ColorOutput "DeepSeek API Key Required (Primary)" $Yellow
            Write-ColorOutput "Get your API key from: https://platform.deepseek.com or https://openrouter.ai" $White
            Write-ColorOutput "Model: DeepSeek V3.1 Terminus (via OpenRouter)" $Cyan
            Write-ColorOutput "Note: Groq will be used as fallback if configured" $Cyan
            $deepseekApiKey = Read-Host "Enter your DeepSeek/OpenRouter API Key (REQUIRED)"
            
            if (-not $deepseekApiKey -or $deepseekApiKey.Trim() -eq "") {
                Write-StatusMessage "DeepSeek API key is required. Please provide a valid key." "ERROR"
                throw "DEEPSEEK_API_KEY is required. Please provide a valid DeepSeek/OpenRouter API key."
            }
            
            # Validate key format (should start with sk-)
            if (-not $deepseekApiKey.StartsWith("sk-")) {
                Write-StatusMessage "Warning: API key format may be invalid (expected 'sk-' prefix)" "WARNING"
            }
        }
        
        # Prompt for GROQ_API_KEY as fallback
        if (-not $groqApiKey -or $groqApiKey -eq "your_groq_api_key_here") {
            Write-Host ""
            Write-ColorOutput "GroQ API Key (Optional - Fallback)" $Cyan
            Write-ColorOutput "Get your API key from: https://console.groq.com" $White
            Write-ColorOutput "Note: This will be used as fallback if DeepSeek is unavailable" $Cyan
            $groqApiKey = Read-Host "Enter your GroQ API Key (or press Enter to skip)"
            
            if (-not $groqApiKey -or $groqApiKey.Trim() -eq "") {
                Write-StatusMessage "Skipping GroQ API key - will use DeepSeek only" "INFO"
                $groqApiKey = "your_groq_api_key_here"  # Placeholder
            }
        }
        
        # Validate at least DeepSeek API key is set
        if ($deepseekApiKey -eq "your_deepseek_api_key_here" -or -not $deepseekApiKey) {
            throw "DEEPSEEK_API_KEY is required. Please provide a valid DeepSeek API key."
        }
        
        $chatbotEnvContent = @"
# WealthArena Chatbot Environment Configuration
# Simplified setup without RAG system
#
# SECURITY WARNING: Never commit your real API keys to version control.
# This file is automatically generated by master_setup_simplified.ps1.
# If you need to manually configure, replace the placeholders below with your actual keys.

# DeepSeek API Configuration (Primary)
# Template: Replace with your actual key from https://platform.deepseek.com. Do not commit real keys.
# DeepSeek is the primary LLM provider (Groq is fallback)
# Model: DeepSeek V3.1 Terminus (using deepseek-chat model name)
DEEPSEEK_API_KEY=$deepseekApiKey
DEEPSEEK_MODEL=deepseek-chat
LLM_PROVIDER=deepseek

# GroQ API Configuration (Fallback)
# Template: Replace with your actual key from https://console.groq.com. Do not commit real keys.
# GroQ will be used as fallback if DeepSeek is not available or fails
GROQ_API_KEY=$groqApiKey
# Note: llama3-8b-8192 has been decommissioned, using llama-3.1-8b-instant as default
GROQ_MODEL=llama-3.1-8b-instant

# Server Configuration
APP_HOST=0.0.0.0
APP_PORT=8000
"@
        Set-Content -Path $chatbotEnvPath -Value $chatbotEnvContent -Force
        Write-StatusMessage "Chatbot .env created" "SUCCESS"
    }
    catch {
        Write-StatusMessage "Error creating chatbot .env: $_" "ERROR"
        throw
    }
    
    # Frontend .env.local
    Write-StatusMessage "Creating frontend/.env.local..." "INFO"
    try {
        $frontendEnvPath = Join-Path (Join-Path $script:ScriptDir "frontend") ".env.local"
        
        $frontendEnvContent = @"
# Backend API URL - uses machine IP for physical device connectivity
# This is the PRIMARY source of truth for backend URL
# Emulators/simulators will automatically use platform-specific localhost URLs
# Physical devices will use this IP address
EXPO_PUBLIC_API_URL=http://${machineIP}:3000
EXPO_PUBLIC_BACKEND_URL=http://${machineIP}:3000

# Chatbot Service URL - uses machine IP for physical device connectivity
EXPO_PUBLIC_CHATBOT_URL=http://${machineIP}:8000

# RL Service URL (if used)
EXPO_PUBLIC_RL_SERVICE_URL=http://${machineIP}:5002

# Network Configuration
# The networkConfig.ts will prioritize these environment variables
# If IP changes, re-run master_setup_simplified.ps1 to update
NODE_ENV=development
"@
        Set-Content -Path $frontendEnvPath -Value $frontendEnvContent -Force
        Write-StatusMessage "Frontend .env.local created with IP: $machineIP" "SUCCESS"
        Write-ColorOutput "  Backend URL: http://${machineIP}:3000" $Cyan
        Write-ColorOutput "  Chatbot URL: http://${machineIP}:8000" $Cyan
    }
    catch {
        Write-StatusMessage "Error creating frontend .env.local: $_" "ERROR"
    }
    
    Write-StatusMessage "Environment configuration complete" "SUCCESS"
    return $true
}

# Phase 3.5: Data Pipeline Setup
function Invoke-Phase3_5-DataPipeline {
    Write-PhaseHeader "Data Pipeline Setup" "3.5"
    
    try {
        # Check Python installation
        Write-StatusMessage "Checking Python installation..." "INFO"
        $pythonInfo = Test-PythonInstalled
        
        if (-not $pythonInfo.Installed) {
            Write-StatusMessage "Python not found. Python is required for data-pipeline scripts." "ERROR"
            Write-Host ""
            Write-ColorOutput "Installation Instructions:" $Yellow
            Write-ColorOutput "  1. Download Python 3.8+ from: https://www.python.org/" $White
            Write-ColorOutput "  2. During installation, check 'Add Python to PATH'" $White
            Write-ColorOutput "  3. Restart PowerShell and re-run this script" $White
            Write-Host ""
            Write-StatusMessage "Skipping data pipeline setup" "WARNING"
            Write-StatusMessage "Backend will start but may have no market data available" "WARNING"
            return $true  # Continue anyway - user can manually run data-pipeline later
        }
        
        Write-StatusMessage "Python found: $($pythonInfo.Command) version $($pythonInfo.Version)" "SUCCESS"
        
        # Check and install Python dependencies
        Write-StatusMessage "Checking Python dependencies for data-pipeline..." "INFO"
        $dataPipelineDir = Join-Path $script:ScriptDir "data-pipeline"
        $requirementsPath = Join-Path $dataPipelineDir "requirements.txt"
        
        if (-not (Test-Path $requirementsPath)) {
            Write-StatusMessage "requirements.txt not found at: $requirementsPath" "WARNING"
            Write-StatusMessage "Skipping dependency installation" "WARNING"
        }
        else {
            try {
                Set-Location $dataPipelineDir
                
                Write-StatusMessage "Installing Python dependencies from requirements.txt..." "INFO"
                $pipOutput = & $pythonInfo.Command -m pip install -r requirements.txt 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-StatusMessage "Python dependencies installed successfully" "SUCCESS"
                }
                else {
                    Write-StatusMessage "Python dependency installation had warnings (continuing anyway)" "WARNING"
                    Write-ColorOutput "Check output above for specific errors" $Yellow
                }
            }
            catch {
                Write-StatusMessage "Error installing Python dependencies: $_" "ERROR"
                Write-StatusMessage "Continuing anyway - you can manually install later" "WARNING"
            }
            finally {
                Set-Location $script:ScriptDir
            }
        }
        
        # Check for existing market data
        Write-StatusMessage "Checking for existing market data..." "INFO"
        $dataLocations = @(
            (Join-Path $script:ScriptDir "stockDataRaw&Processed"),
            (Join-Path $script:ScriptDir "cryptoData"),
            (Join-Path $script:ScriptDir "forexData"),
            (Join-Path $script:ScriptDir "commoditiesData"),
            (Join-Path $dataPipelineDir "data\raw\stocks"),
            (Join-Path $dataPipelineDir "data\raw\crypto"),
            (Join-Path $dataPipelineDir "data\raw\forex"),
            (Join-Path $dataPipelineDir "data\raw\commodities")
        )
        
        $totalCSVCount = 0
        $locationCounts = @{}
        
        foreach ($location in $dataLocations) {
            $count = Get-CSVFileCount -Path $location
            $locationCounts[$location] = $count
            $totalCSVCount += $count
        }
        
        Write-StatusMessage "Found $totalCSVCount CSV files in data folders" "INFO"
        
        # Determine if data download is needed
        $minRequiredFiles = 10
        $needsDownload = $totalCSVCount -lt $minRequiredFiles
        $userSkippedDownload = $false
        
        if ($needsDownload) {
            Write-Host ""
            Write-ColorOutput "========================================" $Cyan
            Write-ColorOutput "ACTION REQUIRED: Market Data Download" $Yellow
            Write-ColorOutput "========================================" $Cyan
            Write-Host ""
            Write-StatusMessage "Insufficient market data found ($totalCSVCount files, minimum $minRequiredFiles required)" "WARNING"
            Write-ColorOutput "Market data is required for:" $White
            Write-ColorOutput "  - Stock/crypto/forex charts" $White
            Write-ColorOutput "  - Historical fast-forward investing game" $White
            Write-ColorOutput "  - AI gameplay and trading signals" $White
            Write-Host ""
            Write-ColorOutput "Options:" $Cyan
            Write-ColorOutput "  [Y or Enter] Download sample dataset (MVP mode - ~50 stocks, faster, 5-10 minutes, recommended)" $Green
            Write-ColorOutput "  [F] Download full dataset (all stocks, slower, 30-60 minutes)" $White
            Write-ColorOutput "  [S] Skip data download (backend will start but have no data)" $Yellow
            Write-Host ""
            Write-ColorOutput ">>> Waiting for your input..." $Yellow
            $downloadChoice = Read-Host "Download market data? (Y/F/S, default: Y)"
            $downloadChoice = $downloadChoice.Trim().ToUpper()
            
            if ($downloadChoice -eq "" -or $downloadChoice -eq "Y" -or $downloadChoice -eq "YES") {
                # MVP mode download
                Write-Host ""
                Write-StatusMessage "Starting MVP mode data download (limited dataset for faster setup)..." "INFO"
                Write-StatusMessage "This will take approximately 5-10 minutes" "INFO"
                Write-Host ""
                
                try {
                    Set-Location $dataPipelineDir
                    Write-StatusMessage "Running: $($pythonInfo.Command) run_all_downloaders.py --mvp-mode --asx-limit 50" "INFO"
                    
                    $downloadOutput = & $pythonInfo.Command run_all_downloaders.py --mvp-mode --asx-limit 50 2>&1
                    
                    # Display output in real-time
                    $downloadOutput | ForEach-Object {
                        Write-Host $_ -ForegroundColor $White
                    }
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-StatusMessage "MVP mode data download completed successfully" "SUCCESS"
                    }
                    else {
                        Write-StatusMessage "Data download completed with warnings (exit code: $LASTEXITCODE)" "WARNING"
                        Write-ColorOutput "Check output above for specific errors" $Yellow
                    }
                }
                catch {
                    Write-StatusMessage "Error during data download: $_" "ERROR"
                    Write-StatusMessage "You can manually run: cd data-pipeline && $($pythonInfo.Command) run_all_downloaders.py --mvp-mode" "INFO"
                }
                finally {
                    Set-Location $script:ScriptDir
                }
            }
            elseif ($downloadChoice -eq "F" -or $downloadChoice -eq "FULL") {
                # Full dataset download
                Write-Host ""
                Write-StatusMessage "Full dataset download will take 30-60 minutes" "WARNING"
                Write-ColorOutput ">>> " -NoNewline
                $confirmFull = Read-Host "Continue with full download? (Y/N)"
                
                if ($confirmFull.Trim().ToUpper() -eq "Y" -or $confirmFull.Trim().ToUpper() -eq "YES") {
                    try {
                        Set-Location $dataPipelineDir
                        Write-StatusMessage "Running: $($pythonInfo.Command) run_all_downloaders.py" "INFO"
                        Write-StatusMessage "This may take 30-60 minutes..." "INFO"
                        Write-Host ""
                        
                        $downloadOutput = & $pythonInfo.Command run_all_downloaders.py 2>&1
                        
                        # Display output in real-time
                        $downloadOutput | ForEach-Object {
                            Write-Host $_ -ForegroundColor $White
                        }
                        
                        if ($LASTEXITCODE -eq 0) {
                            Write-StatusMessage "Full dataset download completed successfully" "SUCCESS"
                        }
                        else {
                            Write-StatusMessage "Data download completed with warnings (exit code: $LASTEXITCODE)" "WARNING"
                            Write-ColorOutput "Check output above for specific errors" $Yellow
                        }
                    }
                    catch {
                        Write-StatusMessage "Error during data download: $_" "ERROR"
                        Write-StatusMessage "You can manually run: cd data-pipeline && $($pythonInfo.Command) run_all_downloaders.py" "INFO"
                    }
                    finally {
                        Set-Location $script:ScriptDir
                    }
                }
                else {
                    $userSkippedDownload = $true
                    Write-StatusMessage "Full download cancelled by user" "WARNING"
                    Write-StatusMessage "Skipping data download" "INFO"
                }
            }
            else {
                # Skip download
                $userSkippedDownload = $true
                Write-StatusMessage "Skipping data download - backend will start but have no market data" "WARNING"
                Write-StatusMessage "You can manually run data-pipeline scripts later" "INFO"
                Write-ColorOutput "Manual command: cd data-pipeline && $($pythonInfo.Command) run_all_downloaders.py --mvp-mode --asx-limit 50" $Cyan
            }
        }
        else {
            Write-StatusMessage "Using existing data ($totalCSVCount files found)" "SUCCESS"
        }
        
        # Verify data download success
        Write-Host ""
        Write-StatusMessage "Verifying data availability..." "INFO"
        $verifyTotalCount = 0
        foreach ($location in $dataLocations) {
            $count = Get-CSVFileCount -Path $location
            $verifyTotalCount += $count
        }
        
        Write-StatusMessage "Data verification: Found $verifyTotalCount CSV files" "INFO"
        
        if ($verifyTotalCount -gt 0) {
            Write-StatusMessage "Market data is ready for processing" "SUCCESS"
            
            # Show breakdown by location if any have files
            $hasAnyFiles = $false
            foreach ($location in $dataLocations) {
                $count = Get-CSVFileCount -Path $location
                if ($count -gt 0) {
                    $folderName = Split-Path -Leaf $location
                    Write-ColorOutput "  $folderName : $count files" $Cyan
                    $hasAnyFiles = $true
                }
            }
            
            if ($hasAnyFiles) {
                Write-Host ""
            }
            
            # Process CSV files immediately to eliminate backend startup delay
            Write-Host ""
            Write-StatusMessage "Checking for existing processed data..." "INFO"
            
            try {
                $backendDir = Join-Path $script:ScriptDir "backend"
                $dataFile = Join-Path $backendDir "data\local-market-data.json"
                $processScriptPath = Join-Path $backendDir "scripts\processMarketData.js"
                $verifyScriptPath = Join-Path $backendDir "scripts\verifyMarketData.js"
                
                # Check if JSON file already exists
                $fileExists = Test-Path $dataFile
                $needsProcessing = $true
                
                if ($fileExists) {
                    Write-StatusMessage "Found existing data file: backend/data/local-market-data.json" "INFO"
                    Write-StatusMessage "Verifying existing file integrity..." "INFO"
                    
                    Set-Location $backendDir
                    $verifyOutput = node scripts\verifyMarketData.js 2>&1
                    $verifyExitCode = $LASTEXITCODE
                    
                    # Display verification output
                    $verifyOutput | ForEach-Object {
                        Write-Host $_ -ForegroundColor $White
                    }
                    
                    if ($verifyExitCode -eq 0) {
                        Write-StatusMessage "Existing data file is valid - skipping processing" "SUCCESS"
                        Write-StatusMessage "Data is ready in: backend/data/local-market-data.json" "SUCCESS"
                        $needsProcessing = $false
                    }
                    else {
                        Write-StatusMessage "Existing data file failed verification - will reprocess" "WARNING"
                        Write-StatusMessage "Removing invalid file..." "INFO"
                        Remove-Item $dataFile -Force -ErrorAction SilentlyContinue
                    }
                }
                
                # Process only if needed
                if ($needsProcessing) {
                    Write-Host ""
                    Write-StatusMessage "Processing CSV files to prepare data for backend..." "INFO"
                    Write-StatusMessage "This eliminates the ~30 second delay on backend startup" "INFO"
                    Write-Host ""
                    
                    # Check if Node.js script exists
                    if (-not (Test-Path $processScriptPath)) {
                        Write-StatusMessage "Processing script not found at: $processScriptPath" "WARNING"
                        Write-StatusMessage "Backend will process data on startup (takes ~30 seconds)" "WARNING"
                    }
                    else {
                        Set-Location $backendDir
                        
                        Write-StatusMessage "Running: node scripts\processMarketData.js" "INFO"
                        $processOutput = node scripts\processMarketData.js 2>&1
                        
                        # Display output
                        $processOutput | ForEach-Object {
                            Write-Host $_ -ForegroundColor $White
                        }
                        
                        if ($LASTEXITCODE -eq 0) {
                            Write-StatusMessage "Market data processed successfully" "SUCCESS"
                            Write-StatusMessage "Data is ready in: backend/data/local-market-data.json" "SUCCESS"
                            Write-StatusMessage "Backend can now load this data instantly (no delay)" "SUCCESS"
                            
                            # Verify the newly processed data file
                            Write-StatusMessage "Verifying data file integrity..." "INFO"
                            $verifyOutput = node scripts\verifyMarketData.js 2>&1
                            $verifyExitCode = $LASTEXITCODE
                            
                            # Display verification output
                            $verifyOutput | ForEach-Object {
                                Write-Host $_ -ForegroundColor $White
                            }
                            
                            if ($verifyExitCode -eq 0) {
                                Write-StatusMessage "Data verification passed - file is valid and ready" "SUCCESS"
                            }
                            else {
                                Write-StatusMessage "Data verification failed - check the output above" "WARNING"
                                Write-StatusMessage "Backend will still attempt to load the data" "INFO"
                            }
                        }
                        else {
                            Write-StatusMessage "Data processing completed with warnings (exit code: $LASTEXITCODE)" "WARNING"
                            Write-StatusMessage "Backend will still process data on startup as fallback" "INFO"
                        }
                    }
                }
            }
            catch {
                Write-StatusMessage "Error processing market data: $_" "ERROR"
                Write-StatusMessage "Backend will process data on startup (takes ~30 seconds)" "WARNING"
            }
            finally {
                Set-Location $script:ScriptDir
            }
        }
        else {
            Write-StatusMessage "No data files found after download attempt" "WARNING"
            Write-StatusMessage "Check data-pipeline console output for errors" "WARNING"
            Write-StatusMessage "Backend will start but may have no market data" "WARNING"
        }
        
        Write-Host ""
        
        # Return boolean indicating data availability
        # Return true if data exists (verifyTotalCount > 0), OR if user explicitly chose to skip
        # Return false if no data and user didn't explicitly skip (error case)
        if ($verifyTotalCount -gt 0) {
            return $true
        }
        elseif ($userSkippedDownload) {
            # User explicitly chose to skip, allow continuation
            return $false
        }
        else {
            # No data and user didn't skip (download failed or cancelled)
            return $false
        }
    }
    catch {
        Write-StatusMessage "Error in data pipeline setup: $_" "ERROR"
        Write-StatusMessage "Continuing anyway - you can manually run data-pipeline scripts later" "WARNING"
        return $false  # No data available due to error
    }
}

# Phase 4: Start Services
function Invoke-Phase4-Services {
    Write-PhaseHeader "Service Startup" "4"
    
    # Clean up existing processes on service ports
    Write-StatusMessage "Cleaning up existing processes on service ports..." "INFO"
    $portsToClean = @(3000, 8000, 8081)
    $cleanedPorts = @()
    
    foreach ($port in $portsToClean) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connections) {
                $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
                foreach ($pid in $processIds) {
                    try {
                        # Get process name for better logging
                        $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
                        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                        $cleanedPorts += $port
                        Write-StatusMessage "Terminated process $pid ($processName) on port $port" "INFO"
                    }
                    catch {
                        # Process may have already terminated
                        Write-StatusMessage "Could not terminate process $pid on port $port (may have already stopped)" "WARNING"
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
        Start-Sleep -Seconds 2
    }
    
    $serviceStatus = @{}
    
    # Start Backend
    Write-StatusMessage "Starting Backend service (Mock Database)..." "INFO"
    try {
        $backendDir = Join-Path $script:ScriptDir "backend"
        $backendCmd = "cd '$backendDir'; npm run dev"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCmd
        
        # Wait for backend to be ready (with retries)
        # Reduced retries and delay - backend should start quickly
        $maxRetries = 6
        $retryDelay = 3
        $backendReady = $false
        
        Write-StatusMessage "Waiting for backend to start..." "INFO"
        for ($i = 1; $i -le $maxRetries; $i++) {
            Start-Sleep -Seconds $retryDelay
            if (Test-ServiceHealth "http://localhost:3000/health") {
                Write-StatusMessage "Backend service is running" "SUCCESS"
                $backendReady = $true
                $serviceStatus.Backend = $true
                break
            }
            else {
                if ($i -lt $maxRetries) {
                    Write-StatusMessage "Waiting for backend... ($i/$maxRetries)" "INFO"
                }
            }
        }
        
        if (-not $backendReady) {
            # Fallback: Check /api/health in case mock server is running
            if (Test-ServiceHealth "http://localhost:3000/api/health") {
                Write-StatusMessage "Backend service is running (mock mode detected)" "SUCCESS"
                $backendReady = $true
                $serviceStatus.Backend = $true
            }
            else {
                Write-StatusMessage "Backend service may not be ready yet (check backend console window)" "WARNING"
                Write-StatusMessage "Backend may still be starting - continuing anyway" "INFO"
                $serviceStatus.Backend = $false
            }
        }
        else {
            # Market data has been pre-processed in Phase 3.5
            # Backend will load it instantly from backend/data/local-market-data.json
            Write-StatusMessage "Market data is ready (pre-processed in Phase 3.5)" "SUCCESS"
            Write-StatusMessage "Backend will load data instantly from: backend/data/local-market-data.json" "INFO"
            Write-StatusMessage "No delay - data is already processed and ready" "INFO"
        }
    }
    catch {
        Write-StatusMessage "Error starting Backend: $_" "ERROR"
        $serviceStatus.Backend = $false
    }
    
    # Start Chatbot
    Write-StatusMessage "Starting Chatbot service (DeepSeek API via OpenRouter)..." "INFO"
    try {
        $chatbotDir = Join-Path $script:ScriptDir "chatbot"
        
        # Ensure port 8000 is completely free before starting
        Write-StatusMessage "Ensuring port 8000 is available for chatbot..." "INFO"
        Start-Sleep -Seconds 2
        
        # Double-check port is free
        $portCheck = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
        if ($portCheck) {
            Write-StatusMessage "Port 8000 still in use, attempting additional cleanup..." "WARNING"
            $processIds = $portCheck | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($processId in $processIds) {
                try {
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    Write-StatusMessage "Force-killed remaining process $processId on port 8000" "INFO"
                }
                catch {
                    Write-StatusMessage "Could not kill process $processId" "WARNING"
                }
            }
            Start-Sleep -Seconds 3
        }
        
        # Use a more robust approach to start the chatbot with proper working directory
        $chatbotCmd = @"
Set-Location '$chatbotDir'
python -m app.main
"@
        Start-Process powershell -ArgumentList '-NoExit', '-Command', $chatbotCmd
        
        # Wait longer for chatbot to start (it needs time to initialize)
        Write-StatusMessage "Waiting for chatbot to initialize..." "INFO"
        Start-Sleep -Seconds 8
        
        # Try both health endpoints
        $chatbotReady = $false
        if (Test-ServiceHealth "http://localhost:8000/healthz") {
            Write-StatusMessage "Chatbot service is running (healthz endpoint)" "SUCCESS"
            $chatbotReady = $true
        }
        elseif (Test-ServiceHealth "http://localhost:8000/health") {
            Write-StatusMessage "Chatbot service is running (health endpoint)" "SUCCESS"
            $chatbotReady = $true
        }
        else {
            Write-StatusMessage "Chatbot service may not be ready yet (check chatbot console window)" "WARNING"
            Write-StatusMessage "Chatbot may still be starting - continuing anyway" "INFO"
        }
        
        $serviceStatus.Chatbot = $chatbotReady
        
        # Run consolidated chatbot test harness (optional, non-fatal)
        if ($chatbotReady) {
            Write-StatusMessage "Running consolidated chatbot test harness..." "INFO"
            try {
                $testChatbotScript = Join-Path $script:ScriptDir "scripts\testing\test_chatbot.ps1"
                if (Test-Path $testChatbotScript) {
                    & $testChatbotScript -Mode Simple
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
    }
    catch {
        Write-StatusMessage "Error starting Chatbot: $_" "ERROR"
        $serviceStatus.Chatbot = $false
    }
    
    # Start Frontend
    Write-StatusMessage "Starting Frontend (Expo)..." "INFO"
    try {
        $frontendDir = Join-Path $script:ScriptDir "frontend"
        $frontendCmd = "cd '$frontendDir'; npm start"
        Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontendCmd
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
    Write-ColorOutput "  Frontend (Expo) : http://localhost:8081" $White
    Write-Host ""
    
    return $serviceStatus
}

# Phase 5: Interactive Testing
function Invoke-Phase5-Testing {
    Write-PhaseHeader "Interactive Testing" "5"
    
    Write-Host ""
    Write-ColorOutput "Testing Instructions:" $Cyan
    Write-ColorOutput "1. Open the frontend app at http://localhost:8081" $White
    Write-ColorOutput "2. Test signup/login flow" $White
    Write-ColorOutput "3. Test onboarding conversation" $White
    Write-ColorOutput "4. Test chatbot with financial questions (e.g., What is RSI?)" $White
    Write-ColorOutput "5. Try off-topic questions (should be rejected)" $White
    Write-Host ""
    
    do {
        $response = Read-Host "Have you completed testing? (Y/N)"
        $response = $response.Trim().ToUpper()
        
        if ($response -eq "Y") {
            Write-StatusMessage "Testing complete" "SUCCESS"
            return $true
        }
        elseif ($response -eq "N") {
            Write-StatusMessage "Waiting for testing to complete..." "INFO"
            Start-Sleep -Seconds 5
        }
        else {
            Write-ColorOutput "Please enter Y or N" $Yellow
        }
    } while ($true)
}

# Phase 6: APK Build
function Invoke-Phase6-APKBuild {
    if ($SkipAPKBuild) {
        Write-PhaseHeader "APK Build" "6"
        Write-StatusMessage "Skipping APK build as requested" "WARNING"
        return $true
    }
    
    Write-PhaseHeader "APK Build" "6"
    
    # Check EAS CLI
    Write-StatusMessage "Checking EAS CLI..." "INFO"
    try {
        $easVersion = eas --version 2>&1
        Write-StatusMessage "EAS CLI found: $easVersion" "SUCCESS"
    }
    catch {
        Write-StatusMessage "EAS CLI not found. Installing..." "WARNING"
        try {
            npm install -g eas-cli
            Write-StatusMessage "EAS CLI installed" "SUCCESS"
        }
        catch {
            Write-StatusMessage "Failed to install EAS CLI: $_" "ERROR"
            return $false
        }
    }
    
    # Check EAS login
    Write-StatusMessage "Checking EAS login..." "INFO"
    try {
        $loginStatus = eas whoami 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "EAS CLI logged in" "SUCCESS"
        }
        else {
            Write-StatusMessage "EAS CLI not logged in. Please login:" "WARNING"
            Write-ColorOutput "  Run: eas login" $Yellow
            Write-ColorOutput "  Then re-run this script or manually run: eas build --platform android --profile preview" $Yellow
            return $false
        }
    }
    catch {
        Write-StatusMessage "Error checking EAS login: $_" "ERROR"
        return $false
    }
    
    # Prompt for build
    Write-Host ""
    $buildResponse = Read-Host "Ready to build APK? (Y/N)"
    if ($buildResponse.Trim().ToUpper() -ne "Y") {
        Write-StatusMessage "APK build skipped" "WARNING"
        return $true
    }
    
    # Build APK
    Write-StatusMessage "Building Android APK..." "INFO"
    try {
        $frontendDir = Join-Path $script:ScriptDir "frontend"
        Set-Location $frontendDir
        
        eas build --platform android --profile preview
        
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "APK build completed successfully" "SUCCESS"
            Write-ColorOutput "Check the EAS dashboard for download link" $Green
        }
        else {
            Write-StatusMessage "APK build failed" "ERROR"
            return $false
        }
    }
    catch {
        Write-StatusMessage "Error building APK: $_" "ERROR"
        return $false
    }
    finally {
        Set-Location $script:ScriptDir
    }
    
    return $true
}

# Main execution
try {
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "WealthArena Simplified Setup" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    Write-ColorOutput "This script will:" $White
    Write-ColorOutput "  - Check prerequisites" $White
    Write-ColorOutput "  - Install dependencies (simplified)" $White
    Write-ColorOutput "  - Configure environment (mock database, no RAG)" $White
    Write-ColorOutput "  - Start all services" $White
    Write-ColorOutput "  - Prompt for testing" $White
    Write-ColorOutput "  - Build APK (optional)" $White
    Write-Host ""
    
    # Phase 1: Prerequisites
    Invoke-Phase1-Prerequisites | Out-Null
    
    # Phase 2: Dependencies
    $depResults = Invoke-Phase2-Dependencies
    if (-not $depResults.Frontend -or -not $depResults.Backend -or -not $depResults.Chatbot) {
        Write-ColorOutput "Some dependencies failed to install. Continuing anyway..." $Yellow
    }
    
    # Phase 3: Environment
    Invoke-Phase3-Environment | Out-Null
    
    # Phase 3.5: Data Pipeline Setup
    $dataReady = Invoke-Phase3_5-DataPipeline
    
    # Check if data is available before starting services
    if (-not $dataReady) {
        Write-Host ""
        Write-ColorOutput "========================================" $Red
        Write-ColorOutput "WARNING: No Market Data Available" $Red
        Write-ColorOutput "========================================" $Red
        Write-Host ""
        Write-ColorOutput "⚠️  Market data is not available. The backend will start, but:" $Yellow
        Write-ColorOutput "  - Charts will have no data to display" $White
        Write-ColorOutput "  - Historical fast-forward investing game will have no symbols" $White
        Write-ColorOutput "  - AI gameplay and trading signals will not function" $White
        Write-Host ""
        Write-ColorOutput "To fix this, manually run:" $Cyan
        Write-ColorOutput "  cd data-pipeline" $White
        Write-ColorOutput "  python run_all_downloaders.py --mvp-mode --asx-limit 50" $White
        Write-Host ""
        Write-ColorOutput "========================================" $Cyan
        Write-ColorOutput "ACTION REQUIRED: Proceed without data?" $Yellow
        Write-ColorOutput "========================================" $Cyan
        Write-ColorOutput "Options:" $Cyan
        Write-ColorOutput "  [Y or Enter] Continue anyway (backend will start but have no data)" $Yellow
        Write-ColorOutput "  [N] Abort setup to fix data pipeline first" $White
        Write-Host ""
        Write-ColorOutput ">>> Waiting for your input..." $Yellow
        $proceedWithoutData = Read-Host "Continue without market data? (Y/N, default: Y)"
        $proceedWithoutData = $proceedWithoutData.Trim().ToUpper()
        
        if ($proceedWithoutData -eq "N" -or $proceedWithoutData -eq "NO") {
            Write-Host ""
            Write-ColorOutput "Setup aborted. Please fix the data pipeline issue and re-run the script." $Yellow
            Write-ColorOutput "To manually download data, run:" $Cyan
            Write-ColorOutput "  cd data-pipeline" $White
            Write-ColorOutput "  python run_all_downloaders.py --mvp-mode --asx-limit 50" $White
            Write-Host ""
            throw "Setup aborted: No market data available"
        }
        else {
            Write-StatusMessage "Continuing setup without market data (as requested)" "WARNING"
            Write-StatusMessage "Remember to run data-pipeline scripts later" "INFO"
            Write-Host ""
        }
    }
    
    # Phase 4: Services
    $serviceStatus = Invoke-Phase4-Services
    
    # Phase 5: Testing
    Invoke-Phase5-Testing | Out-Null
    
    # Phase 6: APK Build
    if (-not $SkipAPKBuild) {
        Invoke-Phase6-APKBuild | Out-Null
    }
    
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "Setup Complete!" $Green
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
    Write-ColorOutput "Services are running:" $White
    Write-ColorOutput "  Backend: http://localhost:3000" $White
    Write-ColorOutput "  Chatbot: http://localhost:8000" $White
    Write-ColorOutput "  Frontend: http://localhost:8081" $White
    Write-Host ""
}
catch {
    Write-Host ""
    Write-ColorOutput "========================================" $Red
    Write-ColorOutput "Setup Failed!" $Red
    Write-ColorOutput "========================================" $Red
    Write-ColorOutput "Error: $_" $Red
    Write-Host ""
    Write-ColorOutput "Check the log file for details: $logFile" $Yellow
    exit 1
}

