#Requires -Version 5.1

<#
.SYNOPSIS
    Stop All WealthArena Services
    
.DESCRIPTION
    Clean shutdown of all running WealthArena local services.
    Identifies and stops Node.js, Python, and Expo processes running from the project directory.
    
.PARAMETER Force
    Skip confirmation prompt and force stop all services
    
.EXAMPLE
    .\scripts\stop_all_services.ps1
    
.EXAMPLE
    .\scripts\stop_all_services.ps1 -Force
#>

param(
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

# Get script and project directories
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Stop-ServiceProcesses {
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "Stopping WealthArena Services" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-Host ""
    
    # Find processes running from project directory
    $processesToStop = @()
    
    # Find Node.js processes
    Write-ColorOutput "Scanning for Node.js processes..." "Blue"
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $processPath = $_.Path
            if ($processPath -like "*$($projectRoot.Replace('\', '*'))*") {
                $processesToStop += $_
            }
        }
        catch {
            # Process may have exited, ignore
        }
    }
    
    # Find Python processes
    Write-ColorOutput "Scanning for Python processes..." "Blue"
    Get-Process -Name "python*" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $processPath = $_.Path
            if ($processPath -like "*$($projectRoot.Replace('\', '*'))*") {
                $processesToStop += $_
            }
        }
        catch {
            # Process may have exited, ignore
        }
    }
    
    # Find Expo processes
    Write-ColorOutput "Scanning for Expo processes..." "Blue"
    Get-Process -Name "expo" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $processPath = $_.Path
            if ($processPath -like "*$($projectRoot.Replace('\', '*'))*") {
                $processesToStop += $_
            }
        }
        catch {
            # Process may have exited, ignore
        }
    }
    
    if ($processesToStop.Count -eq 0) {
        Write-ColorOutput "No running services found in project directory" "Yellow"
        return
    }
    
    # Display processes to be stopped
    Write-Host ""
    Write-ColorOutput "Found $($processesToStop.Count) service process(es):" "White"
    foreach ($proc in $processesToStop) {
        Write-ColorOutput "  - $($proc.ProcessName) (PID: $($proc.Id))" "White"
    }
    Write-Host ""
    
    # Confirm unless Force is specified
    if (-not $Force) {
        $confirm = Read-Host "Stop these processes? (Y/N)"
        if ($confirm -ne "Y" -and $confirm -ne "y") {
            Write-ColorOutput "Cancelled by user" "Yellow"
            return
        }
    }
    
    # Stop processes gracefully
    Write-ColorOutput "Stopping processes..." "Blue"
    $stoppedCount = 0
    $failedCount = 0
    
    foreach ($proc in $processesToStop) {
        try {
            # Try graceful shutdown first
            $proc.CloseMainWindow() | Out-Null
            Start-Sleep -Seconds 2
            
            # Check if still running
            if (-not $proc.HasExited) {
                # Force kill if still running after 10 seconds
                $proc | Stop-Process -Force -ErrorAction Stop
            }
            
            Write-ColorOutput "  [OK] Stopped $($proc.ProcessName) (PID: $($proc.Id))" "Green"
            $stoppedCount++
        }
        catch {
            Write-ColorOutput "  [X] Failed to stop $($proc.ProcessName) (PID: $($proc.Id)): $_" "Red"
            $failedCount++
        }
    }
    
    # Wait a bit for processes to fully exit
    Start-Sleep -Seconds 2
    
    # Final summary
    Write-Host ""
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "Summary" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "  Stopped: $stoppedCount" "Green"
    if ($failedCount -gt 0) {
        Write-ColorOutput "  Failed: $failedCount" "Red"
    }
    Write-Host ""
    
    if ($stoppedCount -gt 0) {
        Write-ColorOutput "All services stopped successfully" "Green"
    }
}

# Main execution
try {
    Stop-ServiceProcesses
}
catch {
    Write-ColorOutput "Error stopping services: $_" "Red"
    exit 1
}

