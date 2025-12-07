<#
.SYNOPSIS
    Diagnoses why Azure deployment isn't working when Docker works fine
.DESCRIPTION
    Checks common issues: GROQ_API_KEY in Azure, app settings, logs, and health endpoint
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup
)

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Azure Deployment Diagnostic Tool" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Check 1: GROQ_API_KEY in Azure
Write-Host "[1/5] Checking GROQ_API_KEY in Azure App Settings..." -ForegroundColor Yellow
try {
    $settings = az webapp config appsettings list --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    $groqKey = ($settings | Where-Object { $_.name -eq "GROQ_API_KEY" }).value
    
    if ($groqKey) {
        $masked = $groqKey.Substring(0, [Math]::Min(8, $groqKey.Length)) + "***"
        Write-Host "✅ GROQ_API_KEY is set in Azure: $masked" -ForegroundColor Green
        
        # Check if it's a placeholder
        if ($groqKey -eq "gsk_your_actual_key_here" -or $groqKey -like "*placeholder*" -or $groqKey.Length -lt 20) {
            Write-Host "⚠️  WARNING: GROQ_API_KEY appears to be a placeholder!" -ForegroundColor Red
            Write-Host "   You need to set your REAL API key in Azure:" -ForegroundColor Yellow
            Write-Host "   az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings GROQ_API_KEY=your_real_key_here" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ GROQ_API_KEY is NOT set in Azure App Settings!" -ForegroundColor Red
        Write-Host "   This is why your app isn't working." -ForegroundColor Yellow
        Write-Host "`n   Fix it by running:" -ForegroundColor Cyan
        Write-Host "   .\scripts\azure_fix_deployment.ps1 -AppName $AppName -ResourceGroup $ResourceGroup" -ForegroundColor Yellow
        Write-Host "`n   Or manually:" -ForegroundColor Cyan
        Write-Host "   az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings GROQ_API_KEY=your_key_here" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check Azure settings: $_" -ForegroundColor Red
}

# Check 2: Health endpoint
Write-Host "`n[2/5] Checking health endpoint..." -ForegroundColor Yellow
try {
    $app = az webapp show --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    $healthUrl = "https://$($app.defaultHostName)/healthz"
    
    Write-Host "   Testing: $healthUrl" -ForegroundColor Gray
    $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health endpoint responds: $($response.Content)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Health endpoint returned HTTP $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Health endpoint not accessible: $_" -ForegroundColor Red
    Write-Host "   App may be down or still starting" -ForegroundColor Yellow
}

# Check 3: App state
Write-Host "`n[3/5] Checking app state..." -ForegroundColor Yellow
try {
    $app = az webapp show --name $AppName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    Write-Host "   State: $($app.state)" -ForegroundColor $(if ($app.state -eq "Running") { "Green" } else { "Yellow" })
    Write-Host "   URL: https://$($app.defaultHostName)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Could not retrieve app state" -ForegroundColor Red
}

# Check 4: Recent logs
Write-Host "`n[4/5] Checking recent logs for errors..." -ForegroundColor Yellow
Write-Host "   Run this to see live logs:" -ForegroundColor Cyan
Write-Host "   az webapp log tail --name $AppName --resource-group $ResourceGroup" -ForegroundColor Yellow

# Check 5: Key differences Docker vs Azure
Write-Host "`n[5/5] Key Differences: Docker vs Azure" -ForegroundColor Yellow
Write-Host "`n   Why Docker works but Azure doesn't:" -ForegroundColor Cyan
Write-Host "   1. Docker reads .env file automatically" -ForegroundColor White
Write-Host "   2. Azure needs GROQ_API_KEY in App Settings (not from .env)" -ForegroundColor White
Write-Host "   3. Azure environment variables are separate from local .env" -ForegroundColor White
Write-Host "`n   Solution:" -ForegroundColor Green
Write-Host "   - Your .env file works for Docker (local)" -ForegroundColor White
Write-Host "   - For Azure, you MUST set GROQ_API_KEY in Azure App Settings" -ForegroundColor White
Write-Host "   - The deployment script should do this, but you can verify:" -ForegroundColor White
Write-Host "     az webapp config appsettings list --name $AppName --resource-group $ResourceGroup --query `"[?name=='GROQ_API_KEY']`"" -ForegroundColor Gray

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Quick Fix Commands" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "1. Verify current GROQ_API_KEY in Azure:" -ForegroundColor White
Write-Host "   az webapp config appsettings list --name $AppName --resource-group $ResourceGroup --query `"[?name=='GROQ_API_KEY']`"" -ForegroundColor Gray

Write-Host "`n2. Set GROQ_API_KEY from your .env file:" -ForegroundColor White
Write-Host "   .\scripts\azure_fix_deployment.ps1 -AppName $AppName -ResourceGroup $ResourceGroup" -ForegroundColor Yellow

Write-Host "`n3. Or set it manually (replace YOUR_KEY with your real key):" -ForegroundColor White
Write-Host "   az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings GROQ_API_KEY=YOUR_KEY" -ForegroundColor Yellow

Write-Host "`n4. Restart the app:" -ForegroundColor White
Write-Host "   az webapp restart --name $AppName --resource-group $ResourceGroup" -ForegroundColor Yellow

Write-Host "`n5. Check if it's working:" -ForegroundColor White
Write-Host "   curl https://$($app.defaultHostName)/healthz" -ForegroundColor Gray

Write-Host "`n═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

