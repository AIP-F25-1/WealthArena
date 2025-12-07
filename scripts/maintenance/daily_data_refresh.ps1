#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$logDir = Join-Path $projectRoot "local_setup_logs"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd"
$logFile = Join-Path $logDir "daily_refresh_$timestamp.log"

function Write-Log {
    param([string]$Message)
    $logTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$logTime] $Message"
}

$startTime = Get-Date
Write-Log "Daily data refresh started"

try {
    Set-Location $projectRoot
    $pipelineScript = Join-Path (Join-Path (Join-Path $projectRoot "infrastructure") "data_pipeline_standalone") "run_full_pipeline.bat"
    
    if (Test-Path $pipelineScript) {
        Write-Log "Executing: $pipelineScript"
        & $pipelineScript
        $exitCode = $LASTEXITCODE
        
        $endTime = Get-Date
        $duration = $endTime - $startTime
        
        if ($exitCode -eq 0) {
            Write-Log "Daily data refresh completed successfully in $($duration.ToString('hh\:mm\:ss'))"
        }
        else {
            Write-Log "Daily data refresh failed with exit code $exitCode"
            exit $exitCode
        }
    }
    else {
        Write-Log "ERROR: Pipeline script not found: $pipelineScript"
        exit 1
    }
}
catch {
    Write-Log "ERROR: Exception during daily refresh: $_"
    exit 1
}
