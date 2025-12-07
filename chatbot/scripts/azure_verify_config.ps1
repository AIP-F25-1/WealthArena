<#
.SYNOPSIS
    Verifies Azure App Service configuration for WealthArena deployment
.DESCRIPTION
    Checks critical Azure settings, app state, and recent logs to diagnose deployment issues
.PARAMETER AppName
    Azure App Service name (e.g., wealtharena-api-kanika)
.PARAMETER ResourceGroup
    Azure resource group name
.PARAMETER ExportConfig
    Export full configuration to JSON file
.EXAMPLE
    .\azure_verify_config.ps1 -AppName "wealtharena-api-kanika" -ResourceGroup "myResourceGroup"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,
    
    [switch]$ExportConfig
)

# Color output functions
function Write-Success {
    param([string]$Message)
    Write-Host "[OK] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Failure {
    param([string]$Message)
    Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

Write-Host "`n===============================================================" -ForegroundColor Cyan
Write-Host "  Azure App Service Configuration Diagnostic Tool" -ForegroundColor Cyan
Write-Host "===============================================================`n" -ForegroundColor Cyan

$issues = @()
$warnings = @()

# Step 1: Check Azure CLI login
Write-Host "[1/7] Checking Azure CLI login status..." -ForegroundColor Yellow
try {
    $account = az account show 2>$null | ConvertFrom-Json
    if ($account) {
        Write-Success "Logged in as: $($account.user.name)"
        Write-Info "Subscription: $($account.name)"
    } else {
        Write-Failure "Not logged in to Azure CLI"
        $issues += "Run: az login"
        exit 1
    }
} catch {
    Write-Failure "Azure CLI not installed or not logged in"
    $issues += "Install Azure CLI: https://aka.ms/installazurecliwindows"
    exit 1
}

# Step 2: Check app existence and state
Write-Host "`n[2/7] Checking app existence and state..." -ForegroundColor Yellow
try {
    $app = az webapp show --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    if ($app) {
        Write-Success "App '$AppName' exists in resource group '$ResourceGroup'"
        Write-Info "State: $($app.state)"
        Write-Info "Location: $($app.location)"
        Write-Info "URL: https://$($app.defaultHostName)"
        
        if ($app.state -ne "Running") {
            Write-Warning "App state is '$($app.state)' (expected 'Running')"
            $warnings += "App is not in Running state"
        }
    } else {
        Write-Failure "App '$AppName' not found in resource group '$ResourceGroup'"
        $issues += "Verify app name and resource group"
        exit 1
    }
} catch {
    Write-Failure "Failed to retrieve app information"
    $issues += "Verify resource group and app name are correct"
    exit 1
}

# Step 3: Check critical app settings
Write-Host "`n[3/7] Checking critical app settings..." -ForegroundColor Yellow
try {
    $settings = az webapp config appsettings list --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    $settingsHash = @{}
    foreach ($setting in $settings) {
        $settingsHash[$setting.name] = $setting.value
    }
    
    # Check SCM_DO_BUILD_DURING_DEPLOYMENT
    if ($settingsHash.ContainsKey("SCM_DO_BUILD_DURING_DEPLOYMENT")) {
        if ($settingsHash["SCM_DO_BUILD_DURING_DEPLOYMENT"] -eq "true" -or $settingsHash["SCM_DO_BUILD_DURING_DEPLOYMENT"] -eq "1") {
            Write-Success "SCM_DO_BUILD_DURING_DEPLOYMENT is enabled"
        } else {
            Write-Failure "SCM_DO_BUILD_DURING_DEPLOYMENT is set to '$($settingsHash["SCM_DO_BUILD_DURING_DEPLOYMENT"])'"
            $issues += "Fix: az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true"
        }
    } else {
        Write-Failure "SCM_DO_BUILD_DURING_DEPLOYMENT is not set"
        $issues += "Fix: az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true"
    }
    
    # Check PYTHONPATH
    if ($settingsHash.ContainsKey("PYTHONPATH")) {
        if ($settingsHash["PYTHONPATH"] -eq "/home/site/wwwroot") {
            Write-Success "PYTHONPATH is correctly set to '/home/site/wwwroot'"
        } else {
            Write-Failure "PYTHONPATH is set to '$($settingsHash["PYTHONPATH"])' (expected '/home/site/wwwroot')"
            $issues += "Fix: az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings PYTHONPATH=/home/site/wwwroot"
        }
    } else {
        Write-Failure "PYTHONPATH is not set"
        $issues += "Fix: az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings PYTHONPATH=/home/site/wwwroot"
    }
    
    # Check GROQ_API_KEY
    if ($settingsHash.ContainsKey("GROQ_API_KEY")) {
        $keyLength = $settingsHash["GROQ_API_KEY"].Length
        $maskedKey = $settingsHash["GROQ_API_KEY"].Substring(0, [Math]::Min(8, $keyLength)) + "***"
        Write-Success "GROQ_API_KEY is set (value: $maskedKey...)"
    } else {
        Write-Failure "GROQ_API_KEY is not set"
        $issues += "Fix: az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings GROQ_API_KEY=your_api_key"
    }
    
    # Check for WEBSITE_RUN_FROM_PACKAGE (should not be set)
    if ($settingsHash.ContainsKey("WEBSITE_RUN_FROM_PACKAGE")) {
        Write-Failure "WEBSITE_RUN_FROM_PACKAGE is set (blocks Oryx build)"
        $issues += "Fix: az webapp config appsettings delete --name $AppName --resource-group $ResourceGroup --setting-names WEBSITE_RUN_FROM_PACKAGE"
    } else {
        Write-Success "WEBSITE_RUN_FROM_PACKAGE is not set (good)"
    }
    
} catch {
    Write-Failure "Failed to retrieve app settings"
    $issues += "Check Azure CLI permissions"
}

# Step 4: Check startup command
Write-Host "`n[4/7] Checking startup command..." -ForegroundColor Yellow
try {
    $config = az webapp config show --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    $startupCommand = $config.appCommandLine
    
    if ($startupCommand) {
        if ($startupCommand -eq "bash startup.sh") {
            Write-Success "Startup command is correctly set to 'bash startup.sh'"
        } else {
            Write-Warning "Startup command is '$startupCommand' (recommended: 'bash startup.sh')"
            $warnings += "Consider setting startup command to 'bash startup.sh'"
        }
    } else {
        Write-Failure "No startup command configured"
        $issues += "Fix: az webapp config set --name $AppName --resource-group $ResourceGroup --startup-file 'bash startup.sh'"
    }
    
    # Check Python version
    $pythonVersion = $config.linuxFxVersion
    if ($pythonVersion) {
        Write-Info "Runtime: $pythonVersion"
    }
    
} catch {
    Write-Failure "Failed to retrieve app configuration"
}

# Step 5: Check app availability
Write-Host "`n[5/7] Checking app availability..." -ForegroundColor Yellow
try {
    $healthUrl = "https://$($app.defaultHostName)/healthz"
    Write-Info "Testing: $healthUrl"
    
    $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Success "Health endpoint is responding (HTTP $($response.StatusCode))"
        Write-Info "Response: $($response.Content)"
    }
} catch {
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Failure "Health endpoint returned HTTP $statusCode"
        $issues += "App is not responding correctly. Check logs with: az webapp log tail --name $AppName --resource-group $ResourceGroup"
    } else {
        Write-Failure "Health endpoint is not accessible (timeout or network error)"
        $issues += "App may still be starting or has crashed. Check logs."
    }
}

# Step 6: Check recent logs
Write-Host "`n[6/7] Checking recent logs..." -ForegroundColor Yellow
try {
    # Use a temporary file in system temp directory
    $tempLogZip = Join-Path $env:TEMP "azure-logs-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
    
    Write-Info "Downloading deployment logs..."
    $logDownload = az webapp log download --name $AppName --resource-group $ResourceGroup --log-file $tempLogZip 2>&1
    
    if (Test-Path $tempLogZip) {
        Write-Info "Logs downloaded successfully"
        
        # Try to extract and read log files if possible
        try {
            # Check if Expand-Archive is available (PowerShell 5.0+)
            if (Get-Command Expand-Archive -ErrorAction SilentlyContinue) {
                $tempLogDir = Join-Path $env:TEMP "azure-logs-extracted-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
                New-Item -ItemType Directory -Path $tempLogDir -Force | Out-Null
                Expand-Archive -Path $tempLogZip -DestinationPath $tempLogDir -Force
                
                # Look for log files in the extracted directory
                $logFiles = Get-ChildItem -Path $tempLogDir -Recurse -Filter "*.log" -ErrorAction SilentlyContinue
                if ($logFiles.Count -gt 0) {
                    Write-Info "Found $($logFiles.Count) log file(s)"
                    # Show last few lines from first log file
                    $firstLog = $logFiles[0].FullName
                    $lastLines = Get-Content $firstLog -Tail 5 -ErrorAction SilentlyContinue
                    if ($lastLines) {
                        Write-Info "Recent log entries:"
                        foreach ($line in $lastLines) {
                            Write-Host "  $line" -ForegroundColor Gray
                        }
                    }
                }
                
                # Clean up extracted directory
                Remove-Item -Path $tempLogDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Info "Could not extract log files (this is optional)"
        }
        
        # Clean up zip file
        Remove-Item $tempLogZip -Force -ErrorAction SilentlyContinue
    } else {
        Write-Warning "Log download may have failed (file not found)"
    }
    
    # Also check deployment status
    Write-Info "Checking deployment status..."
    $deployments = az webapp deployment list --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    if ($deployments -and $deployments.Count -gt 0) {
        $latestDeployment = $deployments[0]
        Write-Info "Latest deployment: $($latestDeployment.status) at $($latestDeployment.start_time)"
    }
    
    Write-Warning "Use 'az webapp log tail --name $AppName --resource-group $ResourceGroup' to view real-time logs"
    
} catch {
    Write-Warning "Could not retrieve logs automatically"
    Write-Info "Run manually: az webapp log tail --name $AppName --resource-group $ResourceGroup"
}

# Step 7: Summary
Write-Host "`n[7/7] Summary" -ForegroundColor Yellow
Write-Host "===============================================================`n" -ForegroundColor Cyan

if ($issues.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "[OK] All checks passed! Your app should be running correctly." -ForegroundColor Green
} else {
    if ($issues.Count -gt 0) {
        Write-Host "Found $($issues.Count) critical issue(s):`n" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "  - $issue" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "Found $($warnings.Count) warning(s):`n" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "  - $warning" -ForegroundColor Yellow
        }
        Write-Host ""
    }
    
    Write-Host "Recommended Action:" -ForegroundColor Cyan
    Write-Host "  Run the automatic fix script:" -ForegroundColor White
    Write-Host "  .\scripts\azure_fix_deployment.ps1 -AppName $AppName -ResourceGroup $ResourceGroup`n" -ForegroundColor Yellow
}

# Export configuration if requested
if ($ExportConfig) {
    $exportFile = "azure-config-export-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    Write-Host "Exporting full configuration to: $exportFile" -ForegroundColor Cyan
    
    $exportData = @{
        timestamp = Get-Date -Format "o"
        app = $app
        settings = $settingsHash
        config = $config
        issues = $issues
        warnings = $warnings
    }
    
    $exportData | ConvertTo-Json -Depth 10 | Out-File -FilePath $exportFile -Encoding UTF8
    Write-Success "Configuration exported to $exportFile"
}

Write-Host "===============================================================`n" -ForegroundColor Cyan

# Clean up temp files (handled in Step 6)

# Exit with appropriate code
if ($issues.Count -gt 0) {
    exit 1
} else {
    exit 0
}
