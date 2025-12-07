# configure_sqldb.ps1
# Helper script to configure sqlDB.env with Azure SQL credentials

param(
    [string]$Server = "",
    [string]$Database = "",
    [string]$Username = "",
    [string]$Password = "",
    [switch]$Interactive = $true
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info { param([string]$msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host $msg -ForegroundColor Green }
function Write-Warning { param([string]$msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Error { param([string]$msg) Write-Host $msg -ForegroundColor Red }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Azure SQL Database Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir "sqlDB.env"
$envExample = Join-Path $scriptDir "sqlDB.env.example"

# Check if sqlDB.env exists
if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Write-Info "Creating sqlDB.env from example..."
        Copy-Item $envExample $envFile
        Write-Success "✅ Created sqlDB.env from example"
    }
    else {
        Write-Error "❌ sqlDB.env.example not found. Cannot create configuration file."
        exit 1
    }
}

Write-Info "Current sqlDB.env location: $envFile"
Write-Host ""

# Collect credentials
if ($Interactive) {
    Write-Info "Enter your Azure SQL Database credentials:"
    Write-Host ""
    
    if (-not $Server) {
        Write-Info "Azure SQL Server hostname:"
        Write-Host "  Example: myserver.database.windows.net" -ForegroundColor Gray
        Write-Host "  Find it in: Azure Portal → SQL Databases → Your Database → Overview → Server name" -ForegroundColor Gray
        $Server = Read-Host "  SQL_SERVER"
    }
    
    if (-not $Database) {
        Write-Info "Database name:"
        Write-Host "  Example: WealthArenaDB" -ForegroundColor Gray
        Write-Host "  Find it in: Azure Portal → SQL Databases → Your Database → Overview" -ForegroundColor Gray
        $Database = Read-Host "  SQL_DB"
    }
    
    if (-not $Username) {
        Write-Info "SQL Username:"
        Write-Host "  Example: sqladmin or admin@myserver" -ForegroundColor Gray
        Write-Host "  Usually the admin username you created during SQL Server setup" -ForegroundColor Gray
        $Username = Read-Host "  SQL_UID"
    }
    
    if (-not $Password) {
        Write-Info "SQL Password:"
        Write-Host "  Password for the SQL user account" -ForegroundColor Gray
        $securePassword = Read-Host "  SQL_PWD" -AsSecureString
        $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        )
    }
}

# Validate inputs
if ([string]::IsNullOrWhiteSpace($Server) -or 
    [string]::IsNullOrWhiteSpace($Database) -or 
    [string]::IsNullOrWhiteSpace($Username) -or 
    [string]::IsNullOrWhiteSpace($Password)) {
    Write-Error "❌ All fields are required (Server, Database, Username, Password)"
    exit 1
}

# Check for placeholder patterns
$placeholders = @{
    "SQL_SERVER" = @("your-sql-server", "your_server", "localhost")
    "SQL_DB" = @("your_database_name", "your_database", "your_db", "test")
    "SQL_UID" = @("your_username", "your_user", "sa", "admin", "root")
    "SQL_PWD" = @("your_password", "your_password_here", "password", "123456")
}

$validationErrors = @()
if ($Server -match "(your-sql-server|your_server|localhost)") {
    $validationErrors += "SQL_SERVER appears to be a placeholder"
}
if ($Database -match "(your_database_name|your_database|your_db|test)") {
    $validationErrors += "SQL_DB appears to be a placeholder"
}
if ($Username -match "(your_username|your_user|sa|admin|root)") {
    $validationErrors += "SQL_UID appears to be a placeholder (unless this is actually your username)"
}
if ($Password -match "(your_password|your_password_here|password|123456)") {
    $validationErrors += "SQL_PWD appears to be a placeholder"
}

if ($validationErrors.Count -gt 0) {
    Write-Warning "⚠️  Warnings detected:"
    foreach ($error in $validationErrors) {
        Write-Warning "  - $error"
    }
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Info "Configuration cancelled."
        exit 0
    }
}

# Read current sqlDB.env
$envContent = Get-Content $envFile -Raw

# Replace values
$envContent = $envContent -replace "(?m)^SQL_SERVER=.*", "SQL_SERVER=$Server"
$envContent = $envContent -replace "(?m)^SQL_DB=.*", "SQL_DB=$Database"
$envContent = $envContent -replace "(?m)^SQL_UID=.*", "SQL_UID=$Username"
$envContent = $envContent -replace "(?m)^SQL_PWD=.*", "SQL_PWD=$Password"

# Write back to file
Set-Content -Path $envFile -Value $envContent -NoNewline

Write-Host ""
Write-Success "✅ sqlDB.env has been updated!"
Write-Host ""

# Verify changes
Write-Info "Verifying configuration..."
$newContent = Get-Content $envFile -Raw
if ($newContent -match "SQL_SERVER=$([regex]::Escape($Server))" -and
    $newContent -match "SQL_DB=$([regex]::Escape($Database))" -and
    $newContent -match "SQL_UID=$([regex]::Escape($Username))") {
    Write-Success "✅ Configuration verified"
}
else {
    Write-Warning "⚠️  Verification check failed. Please manually review sqlDB.env"
}

Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. Verify your Azure SQL firewall allows your IP address" -ForegroundColor Yellow
Write-Host "  2. Test connection: python -c `"from dbConnection import get_conn; conn = get_conn(); print('Connected!')`"" -ForegroundColor Yellow
Write-Host "  3. Re-run Phase 3 of the automation script" -ForegroundColor Yellow
Write-Host ""

Write-Info "To add firewall rule for your IP:"
Write-Host "  Azure Portal → SQL Servers → $($Server.Split('.')[0]) → Networking" -ForegroundColor Gray
Write-Host "  Click 'Add client IP' or manually add your current IP address" -ForegroundColor Gray
Write-Host ""

# Get current IP (helpful for firewall rule)
try {
    $currentIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5).Content
    Write-Info "Your current public IP address: $currentIP"
    Write-Host "  (Use this IP in the Azure SQL firewall rule)" -ForegroundColor Gray
}
catch {
    Write-Warning "Could not detect your public IP. You'll need to find it manually for the firewall rule."
}

Write-Host ""

