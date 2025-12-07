# WealthArena Backend Deployment Script
# Deploy WealthArena backend to Azure Web App using az webapp up with Node.js 20 runtime

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$AppName = "wealtharena-backend",
    [string]$Location = "northcentralus",
    [string]$Sku = "B1",
    [string]$SqlServer = "",
    [string]$KeyVault = "",
    [string]$PlanName = "wealtharena-plan"
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
Set-Location $root

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Backend Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Verify Azure CLI is installed and logged in
Write-ColorOutput "Verifying Azure CLI connection..." $Blue
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-ColorOutput "ERROR: Not logged in to Azure. Please run 'az login' first." $Red
    exit 1
}
Write-ColorOutput "Connected as: $($account.user.name)" $Green
Write-ColorOutput ""

# Verify resource group exists
Write-ColorOutput "Verifying resource group..." $Blue
$rg = az group show --name $ResourceGroup --output json 2>$null | ConvertFrom-Json
if (-not $rg) {
    Write-ColorOutput "ERROR: Resource group not found: $ResourceGroup" $Red
    Write-ColorOutput "Please run setup_master.ps1 to create infrastructure first." $Yellow
    exit 1
}
Write-ColorOutput "Resource group exists: $ResourceGroup" $Green
Write-ColorOutput ""

# Verify or create shared App Service Plan
Write-ColorOutput "Verifying shared App Service Plan..." $Blue
if ([string]::IsNullOrWhiteSpace($PlanName)) {
    $PlanName = "wealtharena-plan"
}

# Check if Microsoft.Web provider is registered
Write-ColorOutput "Checking Microsoft.Web provider registration..." $Blue
$provider = az provider show --namespace Microsoft.Web --output json 2>$null | ConvertFrom-Json
$needsRegistration = $false

if (-not $provider) {
    $needsRegistration = $true
} elseif ($provider.registrationState -ne "Registered") {
    $needsRegistration = $true
}

if ($needsRegistration) {
    Write-ColorOutput "Registering Microsoft.Web provider (this may take 1-2 minutes)..." $Yellow
    try {
        az provider register --namespace Microsoft.Web --wait --output none 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Microsoft.Web provider registered successfully" $Green
        } else {
            Write-ColorOutput "WARNING: Provider registration may still be in progress" $Yellow
            Write-ColorOutput "Waiting 30 seconds for registration to complete..." $Yellow
            Start-Sleep -Seconds 30
        }
    } catch {
        Write-ColorOutput "WARNING: Provider registration had issues: $_" $Yellow
        Write-ColorOutput "Waiting 30 seconds before continuing..." $Yellow
        Start-Sleep -Seconds 30
    }
} else {
    Write-ColorOutput "Microsoft.Web provider is already registered" $Green
}

$plan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json

if (-not $plan) {
    Write-ColorOutput "Creating shared App Service Plan: $PlanName" $Yellow
    try {
        $planCreated = $false
        $actualSku = $Sku
        
        # Try to create with requested SKU first
        $planOutput = az appservice plan create `
            --name $PlanName `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku $Sku `
            --is-linux `
            --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            try {
                $planResult = $planOutput | ConvertFrom-Json
                Write-ColorOutput "App Service Plan created: $PlanName (SKU: $Sku)" $Green
                $plan = $planResult
                $planCreated = $true
            } catch {
                Write-ColorOutput "App Service Plan created: $PlanName (output parsing failed, but creation succeeded)" $Green
                # Verify the plan was created by checking again
                $plan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
                $planCreated = $true
            }
        } else {
            # Check if it's a registration error
            if ($planOutput -match "MissingSubscriptionRegistration" -or $planOutput -match "not registered") {
                Write-ColorOutput "WARNING: Microsoft.Web provider is not registered. Attempting to register now..." $Yellow
                Write-ColorOutput "Registering Microsoft.Web provider (this may take 1-2 minutes)..." $Yellow
                az provider register --namespace Microsoft.Web --wait --output none 2>&1 | Out-Null
                Write-ColorOutput "Waiting 30 seconds for registration to propagate..." $Yellow
                Start-Sleep -Seconds 30
                
                # Retry creating the plan
                Write-ColorOutput "Retrying App Service Plan creation..." $Yellow
                $planOutput = az appservice plan create `
                    --name $PlanName `
                    --resource-group $ResourceGroup `
                    --location $Location `
                    --sku $Sku `
                    --is-linux `
                    --output json 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    try {
                        $planResult = $planOutput | ConvertFrom-Json
                        Write-ColorOutput "App Service Plan created: $PlanName (SKU: $Sku)" $Green
                        $plan = $planResult
                        $planCreated = $true
                    } catch {
                        Write-ColorOutput "App Service Plan created: $PlanName (output parsing failed, but creation succeeded)" $Green
                        $plan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
                        $planCreated = $true
                    }
                }
            }
            
            # Check if it's an "operation in progress" error - wait and retry
            if (-not $planCreated -and ($planOutput -match "operation is in progress" -or $planOutput -match "another operation" -or $planOutput -match "Cannot modify this webspace")) {
                Write-ColorOutput "WARNING: Another operation is in progress. Waiting for it to complete..." $Yellow
                
                # Wait for operation to complete (up to 5 minutes with polling)
                $maxWaitTime = 300  # 5 minutes
                $waitInterval = 15   # Check every 15 seconds
                $elapsedTime = 0
                $operationCompleted = $false
                
                while ($elapsedTime -lt $maxWaitTime -and -not $operationCompleted) {
                    Write-ColorOutput "Waiting for operation to complete... ($elapsedTime seconds elapsed)" $Yellow
                    Start-Sleep -Seconds $waitInterval
                    $elapsedTime += $waitInterval
                    
                    # Check if plan exists now (operation might have been a delete)
                    $checkPlan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
                    if ($checkPlan) {
                        Write-ColorOutput "App Service Plan already exists: $PlanName" $Green
                        $plan = $checkPlan
                        $planCreated = $true
                        $operationCompleted = $true
                    } else {
                        # Try to create again to see if operation completed
                        $testOutput = az appservice plan create `
                            --name $PlanName `
                            --resource-group $ResourceGroup `
                            --location $Location `
                            --sku $Sku `
                            --is-linux `
                            --output json 2>&1
                        
                        if ($LASTEXITCODE -eq 0) {
                            try {
                                $planResult = $testOutput | ConvertFrom-Json
                                Write-ColorOutput "App Service Plan created: $PlanName (SKU: $Sku)" $Green
                                $plan = $planResult
                                $planCreated = $true
                                $operationCompleted = $true
                            } catch {
                                $plan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
                                if ($plan) {
                                    $planCreated = $true
                                    $operationCompleted = $true
                                }
                            }
                        } elseif ($testOutput -notmatch "operation is in progress" -and $testOutput -notmatch "another operation") {
                            # Different error - operation might have completed, but we have a different issue
                            $planOutput = $testOutput
                            $operationCompleted = $true
                        }
                    }
                }
                
                if (-not $planCreated) {
                    Write-ColorOutput "WARNING: Still waiting for operation after $maxWaitTime seconds. Will retry with alternative SKUs..." $Yellow
                }
            }
            
            # Check if it's a quota error - try alternative SKUs
            if (-not $planCreated -and ($planOutput -match "quota" -or $planOutput -match "Additional quota" -or $planOutput -match "Current Limit")) {
                Write-ColorOutput "WARNING: Quota issue detected with SKU $Sku. Trying alternative SKUs..." $Yellow
                
                # Try Free tier (F1) first
                Write-ColorOutput "Attempting to create with Free tier (F1)..." $Yellow
                $planOutput = az appservice plan create `
                    --name $PlanName `
                    --resource-group $ResourceGroup `
                    --location $Location `
                    --sku F1 `
                    --is-linux `
                    --output json 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    try {
                        $planResult = $planOutput | ConvertFrom-Json
                        Write-ColorOutput "App Service Plan created: $PlanName (SKU: F1 - Free tier)" $Green
                        Write-ColorOutput "NOTE: Free tier has limitations. Consider upgrading later if needed." $Yellow
                        $plan = $planResult
                        $actualSku = "F1"
                        $planCreated = $true
                    } catch {
                        Write-ColorOutput "App Service Plan created: $PlanName (SKU: F1 - Free tier)" $Green
                        $plan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
                        $actualSku = "F1"
                        $planCreated = $true
                    }
                } else {
                    # Check if it's still an operation in progress error
                    if ($planOutput -match "operation is in progress" -or $planOutput -match "another operation" -or $planOutput -match "Cannot modify this webspace") {
                        Write-ColorOutput "WARNING: Operation still in progress. Waiting additional 60 seconds..." $Yellow
                        Start-Sleep -Seconds 60
                        
                        # Try F1 again
                        $planOutput = az appservice plan create `
                            --name $PlanName `
                            --resource-group $ResourceGroup `
                            --location $Location `
                            --sku F1 `
                            --is-linux `
                            --output json 2>&1
                        
                        if ($LASTEXITCODE -eq 0) {
                            try {
                                $planResult = $planOutput | ConvertFrom-Json
                                Write-ColorOutput "App Service Plan created: $PlanName (SKU: F1 - Free tier)" $Green
                                $plan = $planResult
                                $actualSku = "F1"
                                $planCreated = $true
                            } catch {
                                $plan = az appservice plan show --name $PlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
                                if ($plan) {
                                    $actualSku = "F1"
                                    $planCreated = $true
                                }
                            }
                        }
                    }
                    
                    # Check if F1 failed due to quota or other issues
                    if (-not $planCreated) {
                        if ($planOutput -match "quota" -or $planOutput -match "Additional quota" -or $planOutput -match "Current Limit") {
                            Write-ColorOutput "ERROR: Free tier (F1) also unavailable due to quota restrictions" $Red
                        } else {
                            Write-ColorOutput "ERROR: Free tier (F1) creation failed" $Red
                            Write-ColorOutput "Error: $planOutput" $Red
                        }
                        
                        # Check if there's an existing Linux App Service Plan we can reuse
                        Write-ColorOutput "Checking for existing Linux App Service Plans in resource group..." $Yellow
                        $existingPlans = az appservice plan list --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
                        $linuxPlan = $null
                        
                        if ($existingPlans) {
                            foreach ($existingPlan in $existingPlans) {
                                if ($existingPlan.kind -match "linux" -or $existingPlan.reserved -eq $true) {
                                    $linuxPlan = $existingPlan
                                    Write-ColorOutput "Found existing Linux App Service Plan: $($existingPlan.name) (SKU: $($existingPlan.sku.name))" $Green
                                    Write-ColorOutput "Will reuse this plan instead of creating a new one" $Yellow
                                    $plan = $existingPlan
                                    $planCreated = $true
                                    $PlanName = $existingPlan.name
                                    $actualSku = $existingPlan.sku.name
                                    break
                                }
                            }
                        }
                        
                        if (-not $planCreated) {
                            Write-ColorOutput "No existing Linux App Service Plan found to reuse" $Yellow
                            
                            # Last resort: Try Windows plan with Shared tier (D1) if available
                            Write-ColorOutput "" $Yellow
                            Write-ColorOutput "WARNING: Attempting Windows App Service Plan as fallback..." $Yellow
                            Write-ColorOutput "NOTE: This will require deploying as Windows app (not Linux)" $Yellow
                            Write-ColorOutput "Trying to create Windows plan with Shared tier (D1)..." $Yellow
                            
                            $windowsPlanName = "$PlanName-windows"
                            $windowsPlanOutput = az appservice plan create `
                                --name $windowsPlanName `
                                --resource-group $ResourceGroup `
                                --location $Location `
                                --sku D1 `
                                --output json 2>&1
                            
                            if ($LASTEXITCODE -eq 0) {
                                try {
                                    $windowsPlanResult = $windowsPlanOutput | ConvertFrom-Json
                                    Write-ColorOutput "Windows App Service Plan created: $windowsPlanName (SKU: D1 - Shared tier)" $Green
                                    Write-ColorOutput "WARNING: This is a Windows plan. You may need to modify deployment configuration." $Yellow
                                    $plan = $windowsPlanResult
                                    $planCreated = $true
                                    $PlanName = $windowsPlanName
                                    $actualSku = "D1"
                                    # Note: Will need to deploy without --is-linux flag
                                } catch {
                                    $plan = az appservice plan show --name $windowsPlanName --resource-group $ResourceGroup --output json 2>$null | ConvertFrom-Json
                                    if ($plan) {
                                        $planCreated = $true
                                        $PlanName = $windowsPlanName
                                        $actualSku = "D1"
                                    }
                                }
                            } else {
                                Write-ColorOutput "Windows plan creation also failed" $Red
                                Write-ColorOutput "Error: $windowsPlanOutput" $Red
                            }
                        }
                    }
                }
            }
            
            # If still not created, show error with Linux-specific guidance
            if (-not $planCreated) {
                Write-ColorOutput "ERROR: Failed to create App Service Plan" $Red
                Write-ColorOutput "Error output: $planOutput" $Red
                Write-ColorOutput "" $Red
                Write-ColorOutput "Important: Linux App Service Plans only support Free (F1) and Basic/Standard/Premium tiers." $Yellow
                Write-ColorOutput "Shared tier (D1) is NOT available for Linux plans." $Yellow
                Write-ColorOutput "" $Yellow
                Write-ColorOutput "Possible solutions:" $Yellow
                Write-ColorOutput "1. Request quota increase for App Service Plans in Azure Portal:" $Yellow
                Write-ColorOutput "   - Go to Azure Portal > Subscriptions > Your Subscription > Usage + quotas" $Yellow
                Write-ColorOutput "   - Search for 'App Service Plans' and request increase" $Yellow
                Write-ColorOutput "2. Use a different subscription with quota available" $Yellow
                Write-ColorOutput "3. Contact Azure support to increase quota:" $Yellow
                Write-ColorOutput "   https://aka.ms/quota-increase" $Yellow
                Write-ColorOutput "4. Create a Windows App Service Plan (supports Shared tier) and use Windows containers" $Yellow
                Write-ColorOutput "5. Wait and retry if quota might become available" $Yellow
                exit 1
            }
        }
        
        # Update SKU variable if we used a different one
        if ($actualSku -ne $Sku) {
            Write-ColorOutput "NOTE: Using SKU $actualSku instead of requested $Sku due to quota limitations" $Yellow
            $Sku = $actualSku
        }
    } catch {
        Write-ColorOutput "ERROR: Exception during App Service Plan creation: $_" $Red
        exit 1
    }
} else {
    Write-ColorOutput "App Service Plan exists: $PlanName" $Green
}
Write-ColorOutput ""

# Navigate to backend directory
$backendPath = Join-Path $root "backend"
if (-not (Test-Path $backendPath)) {
    Write-ColorOutput "ERROR: Backend directory not found: $backendPath" $Red
    exit 1
}

Set-Location $backendPath
Write-ColorOutput "Backend directory: $backendPath" $Blue
Write-ColorOutput ""

# Verify package.json exists
if (-not (Test-Path "package.json")) {
    Write-ColorOutput "ERROR: package.json not found in backend directory" $Red
    exit 1
}

# Create .deployment file (tells Azure where to find package.json)
Write-ColorOutput "Creating .deployment file..." $Blue
$deploymentContent = @"
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true
"@
Set-Content -Path ".deployment" -Value $deploymentContent -Force
Write-ColorOutput ".deployment file created" $Green
Write-ColorOutput ""

# Deploy using az webapp up with shared plan
Write-ColorOutput "Deploying backend to Azure Web App..." $Yellow
Write-ColorOutput "This may take 5-8 minutes..." $Yellow
Write-ColorOutput ""

# Detect if we're using a Windows plan (check plan name or plan kind)
$isWindowsPlan = $false
if ($plan) {
    if ($PlanName -match "windows" -or $plan.kind -notmatch "linux" -and $plan.reserved -ne $true) {
        $isWindowsPlan = $true
    }
}

# Deploy based on plan type
if ($isWindowsPlan) {
    Write-ColorOutput "Deploying to Windows App Service Plan..." $Yellow
    $deployOutput = az webapp up `
        --name $AppName `
        --resource-group $ResourceGroup `
        --plan $PlanName `
        --runtime "NODE:20-lts" `
        --sku $Sku `
        --location $Location `
        2>&1
} else {
    Write-ColorOutput "Deploying to Linux App Service Plan..." $Yellow
    $deployOutput = az webapp up `
        --name $AppName `
        --resource-group $ResourceGroup `
        --plan $PlanName `
        --runtime "NODE:20-lts" `
        --sku $Sku `
        --location $Location `
        --os-type Linux `
        2>&1
}

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "ERROR: Deployment failed!" $Red
    Write-ColorOutput $deployOutput
    exit 1
}

Write-ColorOutput "Deployment successful!" $Green
Write-ColorOutput ""

# Get Web App URL
$webAppUrl = "https://$AppName.azurewebsites.net"
Write-ColorOutput "Backend URL: $webAppUrl" $Cyan
Write-ColorOutput ""

# Configure App Settings
Write-ColorOutput "Configuring App Settings..." $Yellow

# Load secrets from azure_infrastructure/.env if available
$envFile = Join-Path $root "azure_infrastructure" ".env"
$envVars = @{}

if (Test-Path $envFile) {
    Write-ColorOutput "Loading environment configuration from $envFile" $Blue
    $envContent = Get-Content $envFile
    
    foreach ($line in $envContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$key] = $value
        }
    }
    Write-ColorOutput "Loaded environment configuration" $Green
} else {
    Write-ColorOutput "WARNING: Environment file not found: $envFile" $Yellow
    Write-ColorOutput "   Secrets must be set manually or via Key Vault" $Blue
}

# Get DB password from env or prompt for Key Vault reference
$dbPassword = $null
if ($envVars.ContainsKey("DB_PASSWORD")) {
    $dbPassword = $envVars["DB_PASSWORD"]
} else {
    # Use Key Vault reference format - use parameter or derive from config
    if ([string]::IsNullOrWhiteSpace($KeyVault)) {
        # Try to derive from ResourceGroup suffix pattern
        if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
            $suffix = $matches[1]
            $KeyVault = "kv-wealtharena-$suffix"
        } else {
            $KeyVault = "kv-wealtharena-dev"
        }
    }
    $kvVaultName = $KeyVault
    Write-ColorOutput "WARNING: DB_PASSWORD not found in .env. Using Key Vault reference format." $Yellow
    Write-ColorOutput "   Please ensure secret exists in Key Vault: $kvVaultName" $Blue
    $dbPassword = "@Microsoft.KeyVault(SecretUri=https://$kvVaultName.vault.azure.net/secrets/sql-password/)"
}

# Generate JWT secret (32 character random string)
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Derive SQL Server from parameter or ResourceGroup
$sqlServerHost = ""
if (-not [string]::IsNullOrWhiteSpace($SqlServer)) {
    $sqlServerHost = $SqlServer
} else {
    # Try to derive from ResourceGroup suffix pattern
    if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
        $suffix = $matches[1]
        $sqlServerHost = "sql-wealtharena-$suffix.database.windows.net"
    } else {
        $sqlServerHost = "sql-wealtharena-dev.database.windows.net"
    }
}

$appSettings = @{
    "DB_HOST" = $sqlServerHost
    "DB_NAME" = "wealtharena_db"
    "DB_USER" = "wealtharena_admin"
    "DB_PASSWORD" = $dbPassword
    "DB_PORT" = "1433"
    "DB_ENCRYPT" = "true"
    "NODE_ENV" = "production"
    "PORT" = "8080"
    "JWT_SECRET" = $jwtSecret
    "JWT_EXPIRES_IN" = "7d"
    "CHATBOT_API_URL" = "https://wealtharena-chatbot.azurewebsites.net"
    "RL_API_URL" = "https://wealtharena-rl.azurewebsites.net"
    "ALLOWED_ORIGINS" = "https://wealtharena-frontend.azurewebsites.net,exp://localhost:5001"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "true"
}

# Convert to Azure CLI format
$settingsArray = @()
foreach ($key in $appSettings.Keys) {
    $settingsArray += "$key=$($appSettings[$key])"
}

$settingsResult = az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings $settingsArray `
    2>&1

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "WARNING: Failed to configure some App Settings" $Yellow
    Write-ColorOutput $settingsResult
} else {
    Write-ColorOutput "App Settings configured" $Green
}

Write-ColorOutput ""

# Enable system-assigned managed identity for Key Vault access
Write-ColorOutput "Enabling managed identity for Key Vault access..." $Yellow
try {
    $identityResult = az webapp identity assign `
        --name $AppName `
        --resource-group $ResourceGroup `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($identityResult.principalId) {
        Write-ColorOutput "Managed identity enabled" $Green
        
        # Grant Key Vault access to the app's managed identity
        if ([string]::IsNullOrWhiteSpace($KeyVault)) {
            # Try to derive from ResourceGroup suffix pattern
            if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
                $suffix = $matches[1]
                $KeyVault = "kv-wealtharena-$suffix"
            } else {
                $KeyVault = "kv-wealtharena-dev"
            }
        }
        $kvVaultName = $KeyVault
        Write-ColorOutput "Granting Key Vault access to managed identity..." $Blue
        az keyvault set-policy `
            --name $kvVaultName `
            --object-id $identityResult.principalId `
            --secret-permissions get list `
            --output none 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Key Vault access granted" $Green
        } else {
            Write-ColorOutput "WARNING: Failed to grant Key Vault access" $Yellow
        }
    }
} catch {
    Write-ColorOutput "WARNING: Failed to enable managed identity: $_" $Yellow
}

Write-ColorOutput ""

# Restart Web App to apply settings
Write-ColorOutput "Restarting Web App..." $Yellow
az webapp restart --name $AppName --resource-group $ResourceGroup | Out-Null
Write-ColorOutput "Web App restarted" $Green
Write-ColorOutput ""

# Wait for restart (30 seconds)
Write-ColorOutput "Waiting for service to start (30 seconds)..." $Yellow
Start-Sleep -Seconds 30

# Test health endpoint
Write-ColorOutput "Testing health endpoint..." $Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$webAppUrl/health" -Method Get -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
    if ($healthResponse.StatusCode -eq 200) {
        Write-ColorOutput "Backend is healthy!" $Green
        # Try to parse JSON response if available
        try {
            $healthJson = $healthResponse.Content | ConvertFrom-Json
            if ($healthJson.status) {
                Write-ColorOutput "   Status: $($healthJson.status)" $Blue
            }
        } catch {
            # Not JSON, just check status code
        }
    } else {
        Write-ColorOutput "WARNING: Backend responded with status $($healthResponse.StatusCode)" $Yellow
    }
} catch {
    Write-ColorOutput "WARNING: Health check failed. Backend may still be starting..." $Yellow
    Write-ColorOutput "   Error: $($_.Exception.Message)" $Yellow
    Write-ColorOutput "   Check logs: az webapp log tail --name $AppName --resource-group $ResourceGroup" $Blue
}

Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Backend deployed successfully!" $Green
Write-ColorOutput "URL: $webAppUrl" $Cyan
Write-ColorOutput "Health: $webAppUrl/health" $Blue
Write-ColorOutput ""
Write-ColorOutput "Next Steps:" $Blue
Write-ColorOutput "   1. Verify database connection in Azure Portal" $Blue
Write-ColorOutput "   2. Check App Service logs for any errors" $Blue
Write-ColorOutput "   3. Proceed to deploy chatbot service" $Blue
Write-ColorOutput ""

