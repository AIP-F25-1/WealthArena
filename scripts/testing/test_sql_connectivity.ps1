# WealthArena Azure SQL Database Connectivity Test Script
# Tests database connectivity using multiple methods

param(
    [string]$ResourceGroupName = "rg-wealtharena-northcentralus",
    [string]$ServerName = "sql-wealtharena-dev",
    [string]$DatabaseName = "wealtharena_db",
    [string]$UserName = "wealtharena_admin",
    [string]$Password = "Secure@Db2024!$%"
)

$ErrorActionPreference = "Continue"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-AzureCLIConnectivity {
    param([string]$Server, [string]$Database, [string]$ResourceGroup)
    
    Write-ColorOutput "Test 1: Azure CLI Query" $Blue
    Write-ColorOutput "----------------------" $Blue
    
    try {
        $db = az sql db show `
            --name $Database `
            --server $Server `
            --resource-group $ResourceGroup `
            --output json | ConvertFrom-Json
        
        if ($db) {
            Write-ColorOutput "✅ Database exists and is accessible" $Green
            Write-ColorOutput "   Name: $($db.name)" $Blue
            Write-ColorOutput "   Status: $($db.status)" $Blue
            Write-ColorOutput "   Tier: $($db.currentServiceObjectiveName)" $Blue
            return $true
        }
    }
    catch {
        Write-ColorOutput "❌ Azure CLI test failed: $($_.Exception.Message)" $Red
        return $false
    }
}

function Test-SqlcmdConnectivity {
    param([string]$Server, [string]$Database, [string]$User, [string]$Pwd)
    
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Test 2: sqlcmd Connection" $Blue
    Write-ColorOutput "------------------------" $Blue
    
    # Check if sqlcmd is available
    $sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if (-not $sqlcmdPath) {
        Write-ColorOutput "⚠️  sqlcmd not found (SQL Server Command Line Tools not installed)" $Yellow
        Write-ColorOutput "   Skipping sqlcmd test" $Yellow
        Write-ColorOutput "   Install from: https://docs.microsoft.com/en-us/sql/tools/sqlcmd-utility" $Yellow
        return $null
    }
    
    try {
        $serverFQDN = "$Server.database.windows.net"
        $query = "SELECT @@VERSION AS Version"
        
        $result = sqlcmd -S $serverFQDN `
            -d $Database `
            -U $User `
            -P $Pwd `
            -Q $query `
            -W `
            -h -1 `
            2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Direct TCP connection successful" $Green
            $version = ($result | Select-Object -First 1).Trim()
            if ($version) {
                Write-ColorOutput "   SQL Server version: $($version.Substring(0, [Math]::Min(80, $version.Length)))" $Blue
            }
            return $true
        } else {
            Write-ColorOutput "❌ sqlcmd connection failed" $Red
            Write-ColorOutput "   Error: $result" $Red
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ sqlcmd test failed: $($_.Exception.Message)" $Red
        return $false
    }
}

function Test-PythonConnectivity {
    param([string]$Server, [string]$Database, [string]$User, [string]$Pwd)
    
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Test 3: Python pyodbc Connection" $Blue
    Write-ColorOutput "---------------------------------" $Blue
    
    # Check if Python is available
    $pythonPath = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonPath) {
        Write-ColorOutput "⚠️  Python not found" $Yellow
        Write-ColorOutput "   Skipping Python test" $Yellow
        return $null
    }
    
    # Create temporary Python script
    $pythonScript = @"
import pyodbc
import sys

server = '$Server.database.windows.net'
database = '$Database'
username = '$User'
password = '$Pwd'
connection_string = f'Server=tcp:{server},1433;Database={database};User ID={username};Password={password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;'

try:
    conn = pyodbc.connect(connection_string)
    cursor = conn.cursor()
    
    # Test query
    cursor.execute("SELECT DB_NAME() AS CurrentDatabase, COUNT(*) AS TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo'")
    row = cursor.fetchone()
    
    print(f"Current Database: {row[0]}")
    print(f"Table Count: {row[1]}")
    
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)
"@
    
    $scriptPath = Join-Path $env:TEMP "test_sql_connectivity_$(Get-Random).py"
    try {
        $pythonScript | Out-File -FilePath $scriptPath -Encoding UTF8
        
        # Check if pyodbc is installed
        $pyodbcCheck = python -c "import pyodbc" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "⚠️  pyodbc module not installed" $Yellow
            Write-ColorOutput "   Install with: pip install pyodbc" $Yellow
            Write-ColorOutput "   Skipping Python test" $Yellow
            return $null
        }
        
        # Run Python script
        $result = python $scriptPath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Connection pool created successfully" $Green
            $result | ForEach-Object {
                if ($_ -match 'Current Database:|Table Count:') {
                    Write-ColorOutput "   $_" $Blue
                }
            }
            return $true
        } else {
            Write-ColorOutput "❌ Python connection test failed" $Red
            $result | ForEach-Object {
                if ($_ -match 'ERROR:') {
                    Write-ColorOutput "   $_" $Red
                }
            }
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ Python test failed: $($_.Exception.Message)" $Red
        return $false
    }
    finally {
        if (Test-Path $scriptPath) {
            Remove-Item $scriptPath -Force -ErrorAction SilentlyContinue
        }
    }
}

# Main execution
Write-ColorOutput "Testing Azure SQL Database Connectivity" $Blue
Write-ColorOutput "========================================" $Blue
Write-ColorOutput "" $Blue

# Check Azure connection
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-ColorOutput "✅ Logged in as: $($account.user.name)" $Green
} catch {
    Write-ColorOutput "❌ Not logged in to Azure" $Red
    Write-ColorOutput "Please run 'az login' first." $Yellow
    exit 1
}

Write-ColorOutput "" $Blue

# Run tests
$testResults = @{}

$testResults.AzureCLI = Test-AzureCLIConnectivity -Server $ServerName -Database $DatabaseName -ResourceGroup $ResourceGroupName
$testResults.Sqlcmd = Test-SqlcmdConnectivity -Server $ServerName -Database $DatabaseName -User $UserName -Pwd $Password
$testResults.Python = Test-PythonConnectivity -Server $ServerName -Database $DatabaseName -User $UserName -Pwd $Password

Write-ColorOutput "" $Blue
Write-ColorOutput "========================================" $Blue
Write-ColorOutput "Connectivity Test Summary" $Blue
Write-ColorOutput "========================================" $Blue
Write-ColorOutput "" $Blue

$passedTests = ($testResults.Values | Where-Object { $_ -eq $true }).Count
$totalTests = ($testResults.Values | Where-Object { $null -ne $_ }).Count

if ($passedTests -eq $totalTests -and $totalTests -gt 0) {
    Write-ColorOutput "✅ All automated tests passed" $Green
    Write-ColorOutput "✅ Database is accessible from local machine" $Green
    Write-ColorOutput "✅ Ready for schema deployment" $Green
} elseif ($passedTests -gt 0) {
    Write-ColorOutput "⚠️  Some tests passed, but some were skipped or failed" $Yellow
} else {
    Write-ColorOutput "❌ All tests failed" $Red
    Write-ColorOutput "Please check firewall rules and connection details" $Yellow
}

Write-ColorOutput "" $Blue
Write-ColorOutput "Test 4: Azure Data Studio" $Blue
Write-ColorOutput "⚠️  Manual test required - open Azure Data Studio and connect" $Yellow
Write-ColorOutput "" $Blue
Write-ColorOutput "Connection Details:" $Blue
Write-ColorOutput "  Server: $ServerName.database.windows.net" $Blue
Write-ColorOutput "  Authentication: SQL Login" $Blue
Write-ColorOutput "  Username: $UserName" $Blue
Write-ColorOutput "  Password: [Hidden]" $Blue
Write-ColorOutput "  Database: $DatabaseName" $Blue
Write-ColorOutput "" $Blue

if ($testResults.Python -eq $true) {
    Write-ColorOutput "Next Steps:" $Blue
    Write-ColorOutput "1. Deploy database schema: python deploy_schema.py" $Blue
    Write-ColorOutput "2. Verify tables created:" $Blue
    Write-ColorOutput "   sqlcmd -S $ServerName.database.windows.net -d $DatabaseName -U $UserName -P '[password]' -Q `"SELECT name FROM sys.tables`"" $Blue
}
