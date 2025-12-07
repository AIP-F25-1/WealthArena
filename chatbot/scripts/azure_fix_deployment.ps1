<#
.SYNOPSIS
    Automatically fixes common Azure App Service deployment issues for WealthArena
.DESCRIPTION
    Applies configuration fixes, sets environment variables, and restarts the app
.PARAMETER AppName
    Azure App Service name (e.g., wealtharena-api-kanika)
.PARAMETER ResourceGroup
    Azure resource group name
.PARAMETER SkipRestart
    Skip automatic restart after applying fixes
.EXAMPLE
    .\azure_fix_deployment.ps1 -AppName "wealtharena-api-kanika" -ResourceGroup "myResourceGroup"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,
    
    [switch]$SkipRestart
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

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[STEP] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message -ForegroundColor Yellow
}

Write-Host "`n===============================================================" -ForegroundColor Cyan
Write-Host "  Azure App Service Automatic Fix Tool" -ForegroundColor Cyan
Write-Host "===============================================================`n" -ForegroundColor Cyan

$fixesApplied = 0
$errors = @()

# Verify Azure CLI login
Write-Step "Verifying Azure CLI login..."
try {
    $account = az account show 2>$null | ConvertFrom-Json
    if ($account) {
        Write-Success "Logged in as: $($account.user.name)"
    } else {
        Write-Failure "Not logged in to Azure CLI. Run: az login"
        exit 1
    }
} catch {
    Write-Failure "Azure CLI not available"
    exit 1
}

# Verify app exists
Write-Step "Verifying app exists..."
try {
    $app = az webapp show --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    if ($app) {
        Write-Success "App '$AppName' found"
    } else {
        Write-Failure "App '$AppName' not found in resource group '$ResourceGroup'"
        exit 1
    }
} catch {
    Write-Failure "Failed to retrieve app information"
    exit 1
}

# Get current settings
Write-Step "Reading current app settings..."
try {
    $settings = az webapp config appsettings list --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    $settingsHash = @{}
    foreach ($setting in $settings) {
        $settingsHash[$setting.name] = $setting.value
    }
    Write-Success "Retrieved $($settings.Count) existing settings"
} catch {
    Write-Failure "Failed to retrieve app settings"
    exit 1
}

# Fix 1: Set SCM_DO_BUILD_DURING_DEPLOYMENT
Write-Step "Fix 1: Enabling Oryx build during deployment..."
if ($settingsHash["SCM_DO_BUILD_DURING_DEPLOYMENT"] -ne "true" -and $settingsHash["SCM_DO_BUILD_DURING_DEPLOYMENT"] -ne "1") {
    try {
        az webapp config appsettings set `
            --name $AppName `
            --resource-group $ResourceGroup `
            --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true `
            --output none
        Write-Success "Set SCM_DO_BUILD_DURING_DEPLOYMENT=true"
        $fixesApplied++
    } catch {
        Write-Failure "Failed to set SCM_DO_BUILD_DURING_DEPLOYMENT"
        $errors += "SCM_DO_BUILD_DURING_DEPLOYMENT"
    }
} else {
    Write-Info "SCM_DO_BUILD_DURING_DEPLOYMENT already enabled"
}

# Fix 2: Remove WEBSITE_RUN_FROM_PACKAGE if present
Write-Step "Fix 2: Removing WEBSITE_RUN_FROM_PACKAGE (if present)..."
if ($settingsHash.ContainsKey("WEBSITE_RUN_FROM_PACKAGE")) {
    try {
        az webapp config appsettings delete `
            --name $AppName `
            --resource-group $ResourceGroup `
            --setting-names WEBSITE_RUN_FROM_PACKAGE `
            --output none
        Write-Success "Removed WEBSITE_RUN_FROM_PACKAGE setting"
        $fixesApplied++
    } catch {
        Write-Failure "Failed to remove WEBSITE_RUN_FROM_PACKAGE"
        $errors += "WEBSITE_RUN_FROM_PACKAGE removal"
    }
} else {
    Write-Info "WEBSITE_RUN_FROM_PACKAGE not set (good)"
}

# Fix 3: Set PYTHONPATH
Write-Step "Fix 3: Setting PYTHONPATH..."
if ($settingsHash["PYTHONPATH"] -ne "/home/site/wwwroot") {
    try {
        az webapp config appsettings set `
            --name $AppName `
            --resource-group $ResourceGroup `
            --settings PYTHONPATH=/home/site/wwwroot `
            --output none
        Write-Success "Set PYTHONPATH=/home/site/wwwroot"
        $fixesApplied++
    } catch {
        Write-Failure "Failed to set PYTHONPATH"
        $errors += "PYTHONPATH"
    }
} else {
    Write-Info "PYTHONPATH already correctly set"
}

# Fix 4: Configure GROQ_API_KEY from .env file
Write-Step "Fix 4: Configuring GROQ_API_KEY..."
if (-not $settingsHash.ContainsKey("GROQ_API_KEY")) {
    # Try to read from .env file
    $envFile = Join-Path $PSScriptRoot "..\.env"
    if (Test-Path $envFile) {
        $groqKey = $null
        $envLines = Get-Content $envFile
        foreach ($line in $envLines) {
            # Skip empty lines and comment lines (starting with #)
            $trimmedLine = $line.Trim()
            if ([string]::IsNullOrWhiteSpace($trimmedLine) -or $trimmedLine.StartsWith("#")) {
                continue
            }
            
            # Match GROQ_API_KEY at the start of the line (anchored)
            if ($trimmedLine -match '^GROQ_API_KEY\s*=\s*(.+)') {
                $groqKey = $matches[1]
                
                # Strip trailing comments (split on # and take first part)
                if ($groqKey -match '^([^#]+)') {
                    $groqKey = $matches[1]
                }
                
                # Trim whitespace
                $groqKey = $groqKey.Trim()
                
                # Remove surrounding quotes if present
                if ($groqKey -match '^"(.*)"$' -or $groqKey -match "^'(.*)'$") {
                    $groqKey = $matches[1].Trim()
                }
                
                break
            }
        }
        
        if ($groqKey) {
            
            # Validate key is not empty or whitespace-only
            if ([string]::IsNullOrWhiteSpace($groqKey)) {
                Write-Failure "GROQ_API_KEY is empty or contains only whitespace in .env file"
                Write-Info "Please set a valid Groq API key (non-empty, no leading/trailing spaces)"
                Write-Info "Example: GROQ_API_KEY=gsk_your_actual_key_here"
                $errors += "GROQ_API_KEY (empty or whitespace)"
            } else {
                # Warn if key doesn't start with gsk_
                if (-not $groqKey.StartsWith("gsk_")) {
                    Write-Warning "GROQ_API_KEY format may be invalid (should start with 'gsk_')"
                }
                
                # Security warning: Check if key appears to be a real key (long enough) vs placeholder
                if ($groqKey.Length -gt 50 -and $groqKey -notlike "*placeholder*" -and $groqKey -ne "gsk_your_actual_key_here" -and $groqKey -ne "your_groq_api_key_here") {
                    Write-Warning "SECURITY: Detected what appears to be a real API key in .env file"
                    Write-Warning "For security, .env should contain placeholders. Real keys should be set in Azure App Settings only."
                    Write-Info "This script will still set it in Azure, but consider rotating the key after deployment."
                }
                
                try {
                    az webapp config appsettings set `
                        --name $AppName `
                        --resource-group $ResourceGroup `
                        --settings "GROQ_API_KEY=$groqKey" `
                        --output none
                    Write-Success "Set GROQ_API_KEY from .env file"
                    $fixesApplied++
                } catch {
                    Write-Failure "Failed to set GROQ_API_KEY"
                    $errors += "GROQ_API_KEY"
                }
            }
        } else {
            Write-Failure "GROQ_API_KEY not found in .env file"
            Write-Info "Manually set with: az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings GROQ_API_KEY=your_key"
            $errors += "GROQ_API_KEY (not in .env)"
        }
    } else {
        Write-Failure ".env file not found at: $envFile"
        Write-Info "Manually set with: az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings GROQ_API_KEY=your_key"
        $errors += "GROQ_API_KEY (.env not found)"
    }
} else {
    Write-Info "GROQ_API_KEY already set"
}

# Fix 5: Set startup command
Write-Step "Fix 5: Setting startup command..."

# First, verify that startup.sh exists in the repository
$startupScriptLocal = Join-Path $PSScriptRoot "..\startup.sh"
if (-not (Test-Path $startupScriptLocal)) {
    Write-Failure "startup.sh not found in repository at: $startupScriptLocal"
    Write-Info "The startup.sh file must exist in the repository root before setting the startup command"
    Write-Info "To fix this:"
    Write-Info "  1. Restore startup.sh to the repository root (check version control)"
    Write-Info "  2. Or redeploy using: .\deploy-master.ps1 --deploy azure -ResourceGroup $ResourceGroup -AppName $AppName"
    $errors += "Startup command (startup.sh missing from repo)"
} else {
    Write-Info "Found startup.sh in repository - proceeding with startup command configuration"
    
    try {
        $config = az webapp config show --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
        $currentStartup = $config.appCommandLine
        
        if ($currentStartup -ne "bash startup.sh") {
            az webapp config set `
                --name $AppName `
                --resource-group $ResourceGroup `
                --startup-file "bash startup.sh" `
                --output none
            Write-Success "Set startup command to 'bash startup.sh'"
            Write-Info "Note: Ensure startup.sh was included in your deployment ZIP"
            Write-Info "If the app fails to start, verify startup.sh exists in /home/site/wwwroot/"
            $fixesApplied++
        } else {
            Write-Info "Startup command already correctly set to 'bash startup.sh'"
        }
    } catch {
        Write-Failure "Failed to set startup command"
        Write-Info "This may indicate startup.sh is missing from /home/site/wwwroot/"
        Write-Info "Redeploy using: .\deploy-master.ps1 --deploy azure -ResourceGroup $ResourceGroup -AppName $AppName"
        $errors += "Startup command"
    }
}

# Summary of fixes
Write-Host "`n===============================================================" -ForegroundColor Cyan
Write-Host "  Fix Summary" -ForegroundColor Cyan
Write-Host "===============================================================`n" -ForegroundColor Cyan

Write-Host "Fixes applied: $fixesApplied" -ForegroundColor $(if ($fixesApplied -gt 0) { "Green" } else { "Yellow" })
if ($errors.Count -gt 0) {
    Write-Host "Errors encountered: $($errors.Count)" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
}

# Restart app
if (-not $SkipRestart) {
    Write-Step "Restarting app to apply changes..."
    try {
        az webapp restart --name $AppName --resource-group $ResourceGroup --output none
        Write-Success "App restarted successfully"
        
        # Wait for app to start
        Write-Step "Waiting for app to start (this may take 5-10 minutes for first deployment)..."
        $healthUrl = "https://$($app.defaultHostName)/healthz"
        $maxAttempts = 40
        $attemptDelay = 15
        $attempt = 0
        $healthy = $false
        
        Write-Info "Health check URL: $healthUrl"
        Write-Info "Maximum wait time: $($maxAttempts * $attemptDelay / 60) minutes`n"
        
        while ($attempt -lt $maxAttempts -and -not $healthy) {
            $attempt++
            $elapsed = $attempt * $attemptDelay
            $minutes = [math]::Floor($elapsed / 60)
            $seconds = $elapsed % 60
            
            Write-Host "  [Attempt $attempt/$maxAttempts] Elapsed: $($minutes)m $($seconds)s - " -NoNewline
            
            try {
                $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
                if ($response.StatusCode -eq 200) {
                    Write-Host "[OK] HEALTHY" -ForegroundColor Green
                    $healthy = $true
                    break
                } else {
                    Write-Host "HTTP $($response.StatusCode)" -ForegroundColor Yellow
                }
            } catch {
                if ($_.Exception.Response) {
                    $statusCode = $_.Exception.Response.StatusCode.value__
                    Write-Host "HTTP $statusCode" -ForegroundColor Yellow
                } else {
                    Write-Host "Not ready (building...)" -ForegroundColor Yellow
                }
            }
            
            if ($attempt -lt $maxAttempts) {
                Start-Sleep -Seconds $attemptDelay
            }
        }
        
        Write-Host ""
        
        if ($healthy) {
            Write-Host "`n===============================================================" -ForegroundColor Green
            Write-Host "  [SUCCESS] Deployment Successful!" -ForegroundColor Green
            Write-Host "  Your app is now running at:" -ForegroundColor Green
            Write-Host "  https://$($app.defaultHostName)" -ForegroundColor Cyan
            Write-Host "===============================================================`n" -ForegroundColor Green
        } else {
            Write-Host "`n===============================================================" -ForegroundColor Yellow
            Write-Host "  [WARNING] Health check timeout" -ForegroundColor Yellow
            Write-Host "  The app may still be building (especially on first deploy)." -ForegroundColor Yellow
            Write-Host "  Check logs with:" -ForegroundColor Yellow
            Write-Host "  az webapp log tail --name $AppName --resource-group $ResourceGroup" -ForegroundColor Gray
            Write-Host "===============================================================`n" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Failure "Failed to restart app"
    }
} else {
    Write-Info "Skipped restart (use -SkipRestart:$false to enable)"
    Write-Host "`nTo apply changes, run:" -ForegroundColor Cyan
    Write-Host "  az webapp restart --name $AppName --resource-group $ResourceGroup`n" -ForegroundColor Yellow
}

# Final recommendations
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor Cyan
Write-Host "===============================================================`n" -ForegroundColor Cyan

Write-Host "1. Monitor logs in real-time:" -ForegroundColor White
Write-Host "   az webapp log tail --name $AppName --resource-group $ResourceGroup`n" -ForegroundColor Gray

Write-Host "2. Test the health endpoint:" -ForegroundColor White
Write-Host "   curl https://$($app.defaultHostName)/healthz`n" -ForegroundColor Gray

Write-Host "3. View app in browser:" -ForegroundColor White
Write-Host "   https://$($app.defaultHostName)`n" -ForegroundColor Gray

Write-Host "4. If issues persist, run diagnostics:" -ForegroundColor White
Write-Host "   .\scripts\azure_verify_config.ps1 -AppName $AppName -ResourceGroup $ResourceGroup -ExportConfig`n" -ForegroundColor Gray

Write-Host "===============================================================`n" -ForegroundColor Cyan

# Exit with appropriate code
if ($errors.Count -gt 0) {
    exit 1
} else {
    exit 0
}
