# WealthArena Data Pipeline Azure Functions Deployment Script
# Deploys 3 Azure Functions with timer triggers for automated data collection

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Location = "northcentralus",
    [string]$FunctionAppName = "wealtharena-data-pipeline",
    [string]$StorageAccountName = ""
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

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent (Split-Path -Parent $scriptDir)
$dataPipelineDir = Join-Path (Join-Path $rootDir "infrastructure") "data_pipeline_standalone"

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Data Pipeline Functions Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Verify Azure CLI is installed and logged in
Write-ColorOutput "Verifying Azure CLI connection..." $Blue
$accountOutput = az account show --output json 2>&1
$account = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $account = $accountOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "❌ Could not parse Azure account information" $Red
        exit 1
    }
}

if (-not $account -or -not $account.user) {
    Write-ColorOutput "❌ Not logged in to Azure. Please run 'az login' first." $Red
    if ($accountOutput) {
        Write-ColorOutput "Error details: $accountOutput" $Yellow
    }
    exit 1
}
Write-ColorOutput "✅ Connected as: $($account.user.name)" $Green
Write-ColorOutput ""

# Get storage account name if not provided
if ([string]::IsNullOrEmpty($StorageAccountName)) {
    Write-ColorOutput "Getting storage account name from resource group..." $Blue
    $storageAccountsOutput = az storage account list --resource-group $ResourceGroup --output json 2>&1
    $storageAccounts = $null
    
    if ($LASTEXITCODE -eq 0) {
        try {
            $storageAccounts = $storageAccountsOutput | ConvertFrom-Json
        } catch {
            Write-ColorOutput "❌ Could not parse storage account list" $Red
            Write-ColorOutput "Error details: $storageAccountsOutput" $Yellow
            exit 1
        }
    }
    
    if ($storageAccounts -and $storageAccounts.Count -gt 0) {
        $StorageAccountName = $storageAccounts[0].name
        Write-ColorOutput "✅ Using storage account: $StorageAccountName" $Green
    }
    else {
        Write-ColorOutput "❌ No storage account found in resource group: $ResourceGroup" $Red
        Write-ColorOutput "Please create a storage account first or provide -StorageAccountName parameter" $Yellow
        if ($storageAccountsOutput) {
            Write-ColorOutput "Error details: $storageAccountsOutput" $Yellow
        }
        exit 1
    }
}

# Step 1: Create Function App
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 1: Creating Azure Function App" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Check if Function App already exists
$functionAppOutput = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup --output json 2>&1
$functionAppExists = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $functionAppExists = $functionAppOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "⚠️  Could not parse Function App output" $Yellow
    }
}

if ($functionAppExists -and $functionAppExists.name) {
    Write-ColorOutput "✅ Function App already exists: $FunctionAppName" $Green
}
else {
    Write-ColorOutput "Creating Function App: $FunctionAppName" $Blue
    
    # Create Function App (consumption plan)
    $createResult = az functionapp create `
        --resource-group $ResourceGroup `
        --consumption-plan-location $Location `
        --runtime python `
        --runtime-version 3.11 `
        --functions-version 4 `
        --name $FunctionAppName `
        --storage-account $StorageAccountName `
        --os-type Linux `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "❌ Failed to create Function App: $createResult" $Red
        exit 1
    }
    
    Write-ColorOutput "✅ Function App created: $FunctionAppName" $Green
}

Write-ColorOutput ""

# Step 2: Configure App Settings
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Configuring App Settings" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Get SQL connection info from sqlDB.env
$sqlEnvPath = Join-Path $rootDir "data-pipeline" "sqlDB.env"
$sqlServer = ""
$sqlDatabase = ""
$sqlUser = ""
$sqlPassword = ""

if (Test-Path $sqlEnvPath) {
    Write-ColorOutput "Reading SQL configuration from sqlDB.env..." $Blue
    $envContent = Get-Content $sqlEnvPath -Raw
    
    if ($envContent -match "SQL_SERVER=(.+)") {
        $sqlServer = $matches[1].Trim()
    }
    if ($envContent -match "SQL_DB=(.+)") {
        $sqlDatabase = $matches[1].Trim()
    }
    if ($envContent -match "SQL_UID=(.+)") {
        $sqlUser = $matches[1].Trim()
    }
    if ($envContent -match "SQL_PWD=(.+)") {
        $sqlPassword = $matches[1].Trim()
    }
}

# Get Azure Storage connection string
$storageConnStr = az storage account show-connection-string --name $StorageAccountName --resource-group $ResourceGroup --query connectionString -o tsv 2>&1

# Configure app settings
Write-ColorOutput "Configuring Function App settings..." $Blue

$appSettings = @(
    "FUNCTIONS_WORKER_RUNTIME=python",
    "FUNCTIONS_EXTENSION_VERSION=~4",
    "PYTHON_ENABLE_WORKER_EXTENSIONS=1",
    "WEBSITE_TIME_ZONE=UTC"
)

if ($sqlServer) {
    $appSettings += "SQL_SERVER=$sqlServer"
}
if ($sqlDatabase) {
    $appSettings += "SQL_DATABASE=$sqlDatabase"
}
if ($sqlUser) {
    $appSettings += "SQL_USER=$sqlUser"
}
if ($sqlPassword) {
    $appSettings += "SQL_PASSWORD=$sqlPassword"
}
if ($storageConnStr -and -not $storageConnStr.StartsWith("az:")) {
    $appSettings += "AZURE_STORAGE_CONNECTION_STRING=$storageConnStr"
}

# Set app settings
$settingsString = ($appSettings | ForEach-Object { "'$_'" }) -join " "
az functionapp config appsettings set `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --settings $appSettings `
    --output none 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ App settings configured" $Green
}
else {
    Write-ColorOutput "⚠️  Some app settings may not have been configured" $Yellow
}

Write-ColorOutput ""

# Step 3: Create Function App structure
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 3: Preparing Function App Code" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Create temporary directory for Function App code
$tempFunctionDir = Join-Path $env:TEMP "wealtharena_functions_$(Get-Random)"
New-Item -ItemType Directory -Path $tempFunctionDir -Force | Out-Null

Write-ColorOutput "Creating Function App structure in: $tempFunctionDir" $Blue

# Create host.json
$hostJson = @{
    version = "2.0"
    logging = @{
        applicationInsights = @{
            samplingSettings = @{
                isEnabled = $true
                maxTelemetryItemsPerSecond = 20
            }
        }
    }
    extensionBundle = @{
        id = "Microsoft.Azure.Functions.ExtensionBundle"
        version = "[2.*, 3.0.0)"
    }
} | ConvertTo-Json -Depth 10

Set-Content -Path (Join-Path $tempFunctionDir "host.json") -Value $hostJson

# Create requirements.txt
$requirementsContent = Get-Content (Join-Path $dataPipelineDir "requirements.txt") -Raw
Set-Content -Path (Join-Path $tempFunctionDir "requirements.txt") -Value $requirementsContent

# Create .funcignore
$funcIgnore = @"
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
*.log
.env
.git
.gitignore
"@
Set-Content -Path (Join-Path $tempFunctionDir ".funcignore") -Value $funcIgnore

# Create function directories and files
$functions = @(
    @{
        Name = "MarketDataRefresh"
        Schedule = "0 0 6 * * *"  # Daily at 6:00 AM UTC
        Script = "01_daily_market_data_refresh.py"
    },
    @{
        Name = "TechnicalIndicators"
        Schedule = "0 30 6 * * *"  # Daily at 6:30 AM UTC
        Script = "02_compute_technical_indicators.py"
    },
    @{
        Name = "RLSignalGeneration"
        Schedule = "0 0 7 * * *"  # Daily at 7:00 AM UTC
        Script = "03_generate_rl_signals.py"
    }
)

foreach ($func in $functions) {
    $funcDir = Join-Path $tempFunctionDir $func.Name
    New-Item -ItemType Directory -Path $funcDir -Force | Out-Null
    
    # Create function.json
    $functionJson = @{
        scriptFile = "__init__.py"
        bindings = @(
            @{
                name = "timer"
                type = "timerTrigger"
                direction = "in"
                schedule = $func.Schedule
            }
        )
    } | ConvertTo-Json -Depth 10
    
    Set-Content -Path (Join-Path $funcDir "function.json") -Value $functionJson
    
        # Create __init__.py wrapper
        $scriptPath = Join-Path $dataPipelineDir $func.Script
        if (Test-Path $scriptPath) {
            $scriptContent = Get-Content $scriptPath -Raw
            
            # Create wrapper that imports and runs the main function with data freshness check
            $wrapperContent = @"
import sys
import os
from pathlib import Path
import logging
from datetime import datetime, timedelta

# Add data pipeline directories to path
script_dir = Path(__file__).parent.parent.parent
data_pipeline_standalone_dir = script_dir / "infrastructure" / "data_pipeline_standalone"
data_pipeline_dir = script_dir / "data-pipeline"
sys.path.insert(0, str(data_pipeline_standalone_dir))
sys.path.insert(0, str(data_pipeline_dir))

# Import the script module
import importlib.util
spec = importlib.util.spec_from_file_location("data_script", r"$scriptPath")
data_script = importlib.util.module_from_spec(spec)
spec.loader.exec_module(data_script)

def check_data_freshness():
    """Check if data is current and return date range for backfill if needed"""
    try:
        # Import database connection from data-pipeline directory
        from dbConnection import get_conn
        
        conn = get_conn()
        cursor = conn.cursor()
        
        # Check latest data date
        cursor.execute("""
            SELECT MAX(date_utc) as latest_date
            FROM dbo.processed_prices
        """)
        
        result = cursor.fetchone()
        latest_date = result[0] if result and result[0] else None
        
        today = datetime.now().date()
        days_behind = 0
        backfill_needed = False
        backfill_start = None
        backfill_end = today.isoformat()
        
        if latest_date:
            if isinstance(latest_date, str):
                latest_date = datetime.strptime(latest_date.split()[0], "%Y-%m-%d").date()
            elif hasattr(latest_date, 'date'):
                latest_date = latest_date.date()
            elif hasattr(latest_date, '__str__'):
                latest_date = datetime.strptime(str(latest_date).split()[0], "%Y-%m-%d").date()
            
            days_behind = (today - latest_date).days
            
            # If data is more than 1 day behind, backfill
            if days_behind > 1:
                backfill_needed = True
                backfill_start = (latest_date + timedelta(days=1)).isoformat()
                logging.info(f"Data is {days_behind} days behind. Will backfill from {latest_date} to {today}")
            else:
                logging.info(f"Data is current (latest: {latest_date}, today: {today})")
        else:
            # No data exists, backfill last 30 days
            backfill_needed = True
            backfill_start = (today - timedelta(days=30)).isoformat()
            logging.info(f"No data found. Will backfill last 30 days: {backfill_start} to {backfill_end}")
        
        conn.close()
        
        return {
            'backfill_needed': backfill_needed,
            'start_date': backfill_start,
            'end_date': backfill_end,
            'days_behind': days_behind
        }
    except Exception as e:
        logging.warning(f"Could not check data freshness: {e}. Using default 7-day window.")
        return {
            'backfill_needed': False,
            'start_date': None,
            'end_date': None,
            'days_behind': 0
        }

def main(timer) -> None:
    """Azure Function entry point"""
    logging.info(f"Starting {timer.name} function execution")
    
    try:
        # Check if data is up to date and get backfill date range if needed
        freshness_info = check_data_freshness()
        
        # Set environment variables for date range if backfill needed
        if freshness_info['backfill_needed'] and freshness_info['start_date']:
            os.environ['BACKFILL_START_DATE'] = freshness_info['start_date']
            os.environ['BACKFILL_END_DATE'] = freshness_info['end_date']
            logging.info(f"Backfill mode: {freshness_info['start_date']} to {freshness_info['end_date']}")
        
        # Run the main script
        if hasattr(data_script, 'main'):
            # Check for backfill environment variables
            backfill_start = os.environ.get('BACKFILL_START_DATE')
            backfill_end = os.environ.get('BACKFILL_END_DATE')
            days_behind = freshness_info.get('days_behind', 0)
            
            if backfill_start and backfill_end:
                # Backfill mode - run with custom date range
                logging.info("Running in BACKFILL MODE")
                
                if hasattr(data_script, 'download_asset_class'):
                    # Get asset classes
                    asset_classes = {
                        "ASX Stocks": (data_script.get_asx_stocks, "asxStocks"),
                        "Crypto": (data_script.get_crypto_symbols, "crypto"),
                        "Forex": (data_script.get_forex_symbols, "forex"),
                        "Commodities": (data_script.get_commodity_symbols, "commodities"),
                        "ETFs": (data_script.get_etf_symbols, "etfs")
                    }
                    
                    logger = logging.getLogger("daily_market_refresh")
                    logger.info("=" * 70)
                    logger.info("Starting market data refresh (BACKFILL MODE)...")
                    logger.info("=" * 70)
                    logger.info(f"Backfill date range: {backfill_start} → {backfill_end}")
                    logger.info(f"Days behind: {days_behind}")
                    logger.info("")
                    
                    results = {}
                    total_success = 0
                    total_failed = 0
                    
                    for asset_class, (get_symbols_func, prefix) in asset_classes.items():
                        symbols = get_symbols_func()
                        
                        result = data_script.download_asset_class(
                            asset_class=asset_class,
                            symbols=symbols,
                            prefix=prefix,
                            start_date=backfill_start,
                            end_date=backfill_end
                        )
                        
                        results[asset_class] = result
                        total_success += result["success"]
                        total_failed += result.get("failed_count", len(result.get("failed", [])))
                        logger.info("")
                    
                    logger.info("=" * 70)
                    logger.info("📊 BACKFILL SUMMARY")
                    logger.info("=" * 70)
                    logger.info(f"Symbols downloaded: {total_success}/{total_success + total_failed}")
                    logger.info("✅ Backfill completed")
                    logger.info("=" * 70)
                else:
                    # Fallback to original main
                    data_script.main()
            else:
                # Normal scheduled run - use default 7-day window
                data_script.main()
        else:
            logging.error(f"Script {r"$scriptPath"} does not have a main() function")
    except Exception as e:
        logging.error(f"Error in function: {e}", exc_info=True)
        raise
"@
        
        Set-Content -Path (Join-Path $funcDir "__init__.py") -Value $wrapperContent -Encoding UTF8
    }
    else {
        Write-ColorOutput "⚠️  Script not found: $scriptPath" $Yellow
    }
}

Write-ColorOutput "✅ Function App structure created" $Green
Write-ColorOutput ""

# Step 4: Deploy to Azure
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 4: Deploying to Azure Functions" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Deploying Function App code..." $Blue
Write-ColorOutput "Note: This may take 5-10 minutes for first deployment" $Yellow
Write-ColorOutput ""

# Use Azure Functions Core Tools if available, otherwise use zip deploy
$funcTools = Get-Command func -ErrorAction SilentlyContinue

if ($funcTools) {
    Write-ColorOutput "Using Azure Functions Core Tools..." $Blue
    Set-Location $tempFunctionDir
    
    # Publish functions
    func azure functionapp publish $FunctionAppName --python 2>&1 | Out-Host
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Functions deployed successfully" $Green
    }
    else {
        Write-ColorOutput "⚠️  Deployment may have issues. Check logs above." $Yellow
    }
}
else {
    Write-ColorOutput "Azure Functions Core Tools not found. Using zip deploy..." $Yellow
    Write-ColorOutput "Installing Azure Functions Core Tools is recommended for better deployments." $Yellow
    
    # Create zip file
    $zipFile = Join-Path $env:TEMP "wealtharena_functions_$(Get-Random).zip"
    Compress-Archive -Path "$tempFunctionDir\*" -DestinationPath $zipFile -Force
    
    # Deploy zip
    az functionapp deployment source config-zip `
        --resource-group $ResourceGroup `
        --name $FunctionAppName `
        --src $zipFile `
        --output none 2>&1 | Out-Host
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Functions deployed successfully" $Green
    }
    else {
        Write-ColorOutput "⚠️  Deployment may have issues. Check logs above." $Yellow
    }
    
    # Clean up zip
    Remove-Item $zipFile -ErrorAction SilentlyContinue
}

# Clean up temp directory
Remove-Item $tempFunctionDir -Recurse -Force -ErrorAction SilentlyContinue

Write-ColorOutput ""

# Step 5: Verify deployment
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 5: Verifying Deployment" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$functionsListOutput = az functionapp function list --name $FunctionAppName --resource-group $ResourceGroup --output json 2>&1
$functionsList = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $functionsList = $functionsListOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "⚠️  Could not parse functions list" $Yellow
    }
}

if ($functionsList) {
    Write-ColorOutput "✅ Deployed Functions:" $Green
    foreach ($func in $functionsList) {
        Write-ColorOutput "  - $($func.name)" $Green
    }
}
else {
    Write-ColorOutput "⚠️  Could not verify functions. They may still be deploying." $Yellow
}

Write-ColorOutput ""

# Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Deployment Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "🌐 Function App: $FunctionAppName" $Cyan
Write-ColorOutput "📅 Schedules:" $Cyan
Write-ColorOutput "  - Market Data Refresh: Daily at 6:00 AM UTC" $Blue
Write-ColorOutput "  - Technical Indicators: Daily at 6:30 AM UTC" $Blue
Write-ColorOutput "  - RL Signal Generation: Daily at 7:00 AM UTC" $Blue
Write-ColorOutput ""
Write-ColorOutput "✅ Data Pipeline Functions deployed successfully!" $Green
Write-ColorOutput ""
Write-ColorOutput "📝 Next Steps:" $Blue
Write-ColorOutput "  1. Monitor function executions in Azure Portal" $Blue
Write-ColorOutput "  2. Check logs for any errors" $Blue
Write-ColorOutput "  3. Functions will automatically check data freshness and backfill if needed" $Blue
Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan

