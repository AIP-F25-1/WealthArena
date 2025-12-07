# WealthArena Local Docker Testing Script
# Builds and tests Docker containers locally before deployment

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("backend", "chatbot", "rl-service", "all")]
    [string]$Service = "all",
    
    [Parameter(Mandatory=$false)]
    [string]$BackendPort = "8080",
    
    [Parameter(Mandatory=$false)]
    [string]$ChatbotPort = "8081",
    
    [Parameter(Mandatory=$false)]
    [string]$RLServicePort = "8082"
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

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Local Docker Testing" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Check if Docker is running
Write-ColorOutput "Checking Docker..." $Blue
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

# Function to test HTTP endpoint
function Test-HttpEndpoint {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [string]$ExpectedStatus = "200",
        [int]$TimeoutSeconds = 10
    )
    
    try {
        Write-ColorOutput "   Testing: $Method $Url" $Blue
        $response = Invoke-WebRequest -Uri $Url -Method $Method -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq [int]$ExpectedStatus) {
            Write-ColorOutput "   PASS: Status $($response.StatusCode)" $Green
            return $true
        } else {
            Write-ColorOutput "   FAIL: Expected status $ExpectedStatus, got $($response.StatusCode)" $Red
            return $false
        }
    } catch {
        Write-ColorOutput "   FAIL: $($_.Exception.Message)" $Red
        return $false
    }
}

# Function to build and test a service
function Test-Service {
    param(
        [string]$ServiceName,
        [string]$ServiceDir,
        [string]$ImageName,
        [string]$Port,
        [string[]]$TestEndpoints
    )
    
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput "Testing $ServiceName" $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput ""
    
    # Step 1: Build Docker image
    Write-ColorOutput "Step 1: Building Docker image..." $Blue
    Set-Location $ServiceDir
    
    $buildOutput = docker build -t $ImageName . 2>&1
    $buildExitCode = $LASTEXITCODE
    
    if ($buildExitCode -ne 0) {
        Write-ColorOutput "ERROR: Docker build failed" $Red
        Write-ColorOutput $buildOutput $Red
        Set-Location $root
        return $false
    }
    
    Write-ColorOutput "Docker image built successfully: $ImageName" $Green
    Write-ColorOutput ""
    
    # Step 2: Run container
    Write-ColorOutput "Step 2: Running container..." $Blue
    Write-ColorOutput "   Container will run on port $Port" $Cyan
    
    # Stop and remove existing container if it exists
    docker stop $ImageName 2>&1 | Out-Null
    docker rm $ImageName 2>&1 | Out-Null
    
    # Run container in background
    $containerId = docker run -d `
        --name $ImageName `
        -p "${Port}:${Port}" `
        -e PORT=$Port `
        -e NODE_ENV=development `
        $ImageName
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "ERROR: Failed to start container" $Red
        Set-Location $root
        return $false
    }
    
    Write-ColorOutput "Container started: $containerId" $Green
    Write-ColorOutput "Waiting for container to be ready..." $Blue
    
    # Wait for container to be ready (max 30 seconds)
    $maxWait = 30
    $waited = 0
    $isReady = $false
    
    while ($waited -lt $maxWait -and -not $isReady) {
        Start-Sleep -Seconds 2
        $waited += 2
        
        try {
            $healthCheck = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($healthCheck.StatusCode -eq 200) {
                $isReady = $true
            }
        } catch {
            # Container not ready yet
        }
    }
    
    if (-not $isReady) {
        Write-ColorOutput "WARNING: Container may not be fully ready, but continuing with tests..." $Yellow
    } else {
        Write-ColorOutput "Container is ready" $Green
    }
    Write-ColorOutput ""
    
    # Step 3: Test endpoints
    Write-ColorOutput "Step 3: Testing endpoints..." $Blue
    $allTestsPassed = $true
    
    foreach ($endpoint in $TestEndpoints) {
        $testPassed = Test-HttpEndpoint -Url "http://localhost:$Port$endpoint"
        if (-not $testPassed) {
            $allTestsPassed = $false
        }
    }
    
    Write-ColorOutput ""
    
    # Step 4: Cleanup
    Write-ColorOutput "Step 4: Cleaning up..." $Blue
    docker stop $ImageName 2>&1 | Out-Null
    docker rm $ImageName 2>&1 | Out-Null
    Write-ColorOutput "Container stopped and removed" $Green
    Write-ColorOutput ""
    
    Set-Location $root
    
    if ($allTestsPassed) {
        Write-ColorOutput "$ServiceName: All tests PASSED" $Green
        return $true
    } else {
        Write-ColorOutput "$ServiceName: Some tests FAILED" $Red
        return $false
    }
}

# Test results
$allServicesPassed = $true

# Test Backend
if ($Service -eq "backend" -or $Service -eq "all") {
    $backendDir = Join-Path $root "backend"
    $backendImage = "wealtharena-backend-test"
    $backendTests = @(
        "/health",
        "/"
    )
    
    $result = Test-Service -ServiceName "Backend" -ServiceDir $backendDir -ImageName $backendImage -Port $BackendPort -TestEndpoints $backendTests
    if (-not $result) {
        $allServicesPassed = $false
    }
}

# Test Chatbot
if ($Service -eq "chatbot" -or $Service -eq "all") {
    $chatbotDir = Join-Path $root "chatbot"
    $chatbotImage = "wealtharena-chatbot-test"
    $chatbotTests = @(
        "/health",
        "/"
    )
    
    $result = Test-Service -ServiceName "Chatbot" -ServiceDir $chatbotDir -ImageName $chatbotImage -Port $ChatbotPort -TestEndpoints $chatbotTests
    if (-not $result) {
        $allServicesPassed = $false
    }
}

# Test RL Service
if ($Service -eq "rl-service" -or $Service -eq "all") {
    $rlServiceDir = Join-Path $root "rl-service"
    $rlServiceImage = "wealtharena-rl-service-test"
    $rlServiceTests = @(
        "/health",
        "/"
    )
    
    $result = Test-Service -ServiceName "RL Service" -ServiceDir $rlServiceDir -ImageName $rlServiceImage -Port $RLServicePort -TestEndpoints $rlServiceTests
    if (-not $result) {
        $allServicesPassed = $false
    }
}

# Final summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Testing Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

if ($allServicesPassed) {
    Write-ColorOutput "All services passed local testing!" $Green
    Write-ColorOutput "Containers are ready for deployment to Azure." $Green
    exit 0
} else {
    Write-ColorOutput "Some services failed local testing." $Red
    Write-ColorOutput "Please fix issues before deploying to Azure." $Red
    exit 1
}

