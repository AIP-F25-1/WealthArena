#Requires -Version 5.1

<#
.SYNOPSIS
    Check WealthArena Services Status
    
.DESCRIPTION
    Quick health check of all running WealthArena local services.
    Tests health endpoints and displays service status with response times.
    
.PARAMETER Watch
    Continuously monitor services, refreshing every 5 seconds
    
.EXAMPLE
    .\scripts\check_services_status.ps1
    
.EXAMPLE
    .\scripts\check_services_status.ps1 -Watch
#>

param(
    [switch]$Watch = $false
)

$ErrorActionPreference = "Continue"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Test-ServiceEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 5
    )
    
    $result = @{
        Name = $Name
        Url = $Url
        Status = "Stopped"
        ResponseTime = $null
        Error = $null
        ProcessId = $null
    }
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        $stopwatch.Stop()
        
        if ($response.StatusCode -eq 200) {
            $result.Status = "Running"
            $result.ResponseTime = $stopwatch.ElapsedMilliseconds
        }
        else {
            $result.Status = "Degraded"
            $result.Error = "HTTP $($response.StatusCode)"
        }
    }
    catch {
        $result.Status = "Stopped"
        $result.Error = $_.Exception.Message
    }
    
    return $result
}

function Get-ServiceProcess {
    param([string]$ProcessName, [string]$ProjectRoot)
    
    try {
        $processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object {
            try {
                $_.Path -like "*$($ProjectRoot.Replace('\', '*'))*"
            }
            catch {
                $false
            }
        }
        
        if ($processes.Count -gt 0) {
            return $processes[0].Id
        }
    }
    catch {
        # Ignore errors
    }
    
    return $null
}

function Show-ServiceStatus {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $projectRoot = Split-Path -Parent $scriptDir
    
    # Clear screen if watching
    if ($Watch) {
        Clear-Host
    }
    
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "WealthArena Services Status" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-Host ""
    
    # Test Backend
    $backendResult = Test-ServiceEndpoint "Backend API" "http://localhost:3000/health"
    $backendPid = Get-ServiceProcess "node" $projectRoot
    if ($backendPid) { $backendResult.ProcessId = $backendPid }
    
    # Test Chatbot
    $chatbotResult = Test-ServiceEndpoint "Chatbot Service" "http://localhost:8000/health"
    $chatbotPid = Get-ServiceProcess "python" $projectRoot
    if ($chatbotPid) { $chatbotResult.ProcessId = $chatbotPid }
    
    # Test RL Service
    $rlResult = Test-ServiceEndpoint "RL Service" "http://localhost:5002/health"
    $rlPid = Get-ServiceProcess "python" $projectRoot
    if ($rlPid) { $rlResult.ProcessId = $rlPid }
    
    # Check Frontend (Expo)
    $frontendPid = Get-ServiceProcess "expo" $projectRoot
    if (-not $frontendPid) {
        $frontendPid = Get-ServiceProcess "node" $projectRoot | Where-Object {
            # Try to identify Expo process by checking command line
            # This is a simplified check
            $true
        }
    }
    
    # Display results
    $statusSymbol = @{
        "Running" = "[OK]"
        "Degraded" = "[!]"
        "Stopped" = "[X]"
    }
    
    $statusColor = @{
        "Running" = "Green"
        "Degraded" = "Yellow"
        "Stopped" = "Red"
    }
    
    # Backend
    $symbol = $statusSymbol[$backendResult.Status]
    $color = $statusColor[$backendResult.Status]
    $responseInfo = if ($backendResult.ResponseTime) { " [Response: $($backendResult.ResponseTime)ms]" } else { "" }
    $pidInfo = if ($backendResult.ProcessId) { " [PID: $($backendResult.ProcessId)]" } else { "" }
    Write-ColorOutput "$symbol Backend API       : $($backendResult.Status) (http://localhost:3000)$responseInfo$pidInfo" $color
    if ($backendResult.Error) {
        Write-ColorOutput "    Error: $($backendResult.Error)" "Red"
    }
    
    # Chatbot
    $symbol = $statusSymbol[$chatbotResult.Status]
    $color = $statusColor[$chatbotResult.Status]
    $responseInfo = if ($chatbotResult.ResponseTime) { " [Response: $($chatbotResult.ResponseTime)ms]" } else { "" }
    $pidInfo = if ($chatbotResult.ProcessId) { " [PID: $($chatbotResult.ProcessId)]" } else { "" }
    Write-ColorOutput "$symbol Chatbot Service   : $($chatbotResult.Status) (http://localhost:8000)$responseInfo$pidInfo" $color
    if ($chatbotResult.Error) {
        Write-ColorOutput "    Error: $($chatbotResult.Error)" "Red"
    }
    
    # RL Service
    $symbol = $statusSymbol[$rlResult.Status]
    $color = $statusColor[$rlResult.Status]
    $responseInfo = if ($rlResult.ResponseTime) { " [Response: $($rlResult.ResponseTime)ms]" } else { "" }
    $pidInfo = if ($rlResult.ProcessId) { " [PID: $($rlResult.ProcessId)]" } else { "" }
    Write-ColorOutput "$symbol RL Service        : $($rlResult.Status) (http://localhost:5002)$responseInfo$pidInfo" $color
    if ($rlResult.Error) {
        Write-ColorOutput "    Error: $($rlResult.Error)" "Red"
    }
    
    # Frontend
    if ($frontendPid) {
        Write-ColorOutput "[OK] Frontend (Expo)   : Running (PID: $frontendPid)" "Green"
    }
    else {
        Write-ColorOutput "[X] Frontend (Expo)   : Stopped" "Red"
    }
    
    # Database (simplified check - would need actual connection test)
    Write-ColorOutput "[*] Database          : Not checked (manual verification required)" "Yellow"
    
    Write-Host ""
    Write-ColorOutput "========================================" "Cyan"
    
    # Provide suggestions for stopped services
    $stoppedServices = @()
    if ($backendResult.Status -eq "Stopped") { $stoppedServices += "Backend" }
    if ($chatbotResult.Status -eq "Stopped") { $stoppedServices += "Chatbot" }
    if ($rlResult.Status -eq "Stopped") { $stoppedServices += "RL Service" }
    if (-not $frontendPid) { $stoppedServices += "Frontend" }
    
    if ($stoppedServices.Count -gt 0) {
        Write-Host ""
        Write-ColorOutput "To start stopped services:" "Yellow"
        Write-ColorOutput "  Run: .\master_setup_local.ps1" "Yellow"
        Write-ColorOutput "  Or start manually:" "Yellow"
        foreach ($service in $stoppedServices) {
            switch ($service) {
                "Backend" { Write-ColorOutput "    cd backend && npm run dev" "White" }
                "Chatbot" { Write-ColorOutput "    cd chatbot && python main.py" "White" }
                "RL Service" { Write-ColorOutput "    cd rl-service/api && python inference_server.py" "White" }
                "Frontend" { Write-ColorOutput "    cd frontend && npm start" "White" }
            }
        }
    }
    
    Write-Host ""
}

# Main execution
try {
    do {
        Show-ServiceStatus
        
        if ($Watch) {
            Write-ColorOutput "Refreshing in 5 seconds... (Press Ctrl+C to stop)" "Gray"
            Start-Sleep -Seconds 5
        }
    } while ($Watch)
}
catch {
    Write-ColorOutput "Error checking services: $_" "Red"
    exit 1
}

