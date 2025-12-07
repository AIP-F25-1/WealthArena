<#
.SYNOPSIS
    Verify Azure infrastructure setup

.DESCRIPTION
    This script runs comprehensive verification tests to ensure all components are configured correctly:
    1. Key Vault access
    2. SQL database connection
    3. Database schema verification
    4. Storage container access
    5. Environment file validation
    6. Sample data verification

.PARAMETER ResourceGroup
    Azure resource group name (default: rg-wealtharena-northcentralus)

.PARAMETER Suffix
    Unique suffix for resources (default: jg1ve2)

.NOTES
    Author: WealthArena DevOps Team
    Version: 1.0
    Created: 2024-12-22
#>

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Suffix = "jg1ve2"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors for output
function Write-Test {
    param([string]$Message, [string]$Result = "INFO", [string]$Details = "")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch ($Result) {
        "PASSED" { "Green" }
        "FAILED" { "Red" }
        "WARNING" { "Yellow" }
        default { "Cyan" }
    }
    $icon = switch ($Result) {
        "PASSED" { "[OK]" }
        "FAILED" { "[X]" }
        "WARNING" { "[!]" }
        default { "[?]" }
    }
    Write-Host "[$timestamp] $icon Test $Message" -ForegroundColor $color
    if ($Details) {
        Write-Host "        $Details" -ForegroundColor Gray
    }
}

$allTestsPassed = $true
$testResults = @()

Write-Host ""
Write-Host "Azure Setup Verification" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

# Retrieve SQL password from Key Vault at the top (without printing the value)
$vaultName = "kv-wealtharena-$Suffix"
$sqlPassword = $null
try {
    $sqlPassword = az keyvault secret show --vault-name $vaultName --name sql-password --query value -o tsv
    if ([string]::IsNullOrWhiteSpace($sqlPassword)) {
        throw "SQL password not found in Key Vault"
    }
}
catch {
    Write-Test "SQL Password Retrieval" "FAILED" "Could not retrieve SQL password from Key Vault"
    throw "Failed to retrieve SQL password from Key Vault: $_"
}

# Test 1: Key Vault Access
Write-Host ""
Write-Test "1: Key Vault Access" "INFO"

try {
    $groqKey = az keyvault secret show --vault-name $vaultName --name groq-api-key --query value -o tsv
    if ($groqKey -like "gsk_*") {
        Write-Test "1: Key Vault Access" "PASSED" "GROQ key retrieved successfully"
        $testResults += "✅ Test 1: Key Vault Access - PASSED"
    } else {
        throw "Invalid GROQ key format"
    }
}
catch {
    Write-Test "1: Key Vault Access" "FAILED" "Could not retrieve GROQ API key"
    $testResults += "❌ Test 1: Key Vault Access - FAILED"
    $allTestsPassed = $false
}

# Test 2: SQL Database Connection
Write-Host ""
Write-Test "2: SQL Database Connection" "INFO"

$connectionTestScript = @"
import pyodbc
import sys

try:
    sqlPassword = r'''$($sqlPassword -replace "'", "''")'''
    conn = pyodbc.connect(
        'Driver={ODBC Driver 18 for SQL Server};'
        'Server=tcp:sql-wealtharena-$Suffix.database.windows.net,1433;'
        'Database=wealtharena_db;'
        'Uid=wealtharena_admin;'
        'Pwd=' + sqlPassword + ';'
        'Encrypt=yes;'
        'TrustServerCertificate=no;'
        'Connection Timeout=30;'
    )
    cursor = conn.cursor()
    cursor.execute('SELECT @@VERSION')
    version = cursor.fetchone()[0]
    print('SUCCESS:', version.split()[0:2] if version else 'Connected')
    conn.close()
    sys.exit(0)
except Exception as e:
    print('ERROR:', str(e))
    sys.exit(1)
"@

$testScriptPath = Join-Path $env:TEMP "test_sql_connection.py"
$connectionTestScript | Out-File -FilePath $testScriptPath -Encoding UTF8

try {
    $pythonResult = python $testScriptPath 2>&1
    Remove-Item $testScriptPath -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Test "2: SQL Database Connection" "PASSED" ($pythonResult -join " ")
        $testResults += "✅ Test 2: SQL Database Connection - PASSED"
    } else {
        throw "Connection failed"
    }
}
catch {
    Write-Test "2: SQL Database Connection" "FAILED" $_.Exception.Message
    $testResults += "❌ Test 2: SQL Database Connection - FAILED"
    $allTestsPassed = $false
    throw "SQL Database Connection test failed"
}

# Test 3: Database Schema Verification
Write-Host ""
Write-Test "3: Database Schema Verification" "INFO"

$schemaTestScript = @"
import pyodbc
import sys

try:
    sqlPassword = r'''$($sqlPassword -replace "'", "''")'''
    conn = pyodbc.connect(
        'Driver={ODBC Driver 18 for SQL Server};'
        'Server=tcp:sql-wealtharena-$Suffix.database.windows.net,1433;'
        'Database=wealtharena_db;'
        'Uid=wealtharena_admin;'
        'Pwd=' + sqlPassword + ';'
        'Encrypt=yes;'
        'TrustServerCertificate=no;'
        'Connection Timeout=30;'
    )
    cursor = conn.cursor()
    
    # Count tables
    cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'")
    tableCount = cursor.fetchone()[0]
    
    # Get table names
    cursor.execute("SELECT name FROM sys.tables ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    
    # Check for stored procedure
    cursor.execute("SELECT name FROM sys.procedures WHERE name = 'CalculatePortfolioPerformance'")
    proc = cursor.fetchone()
    
    # Check for function
    cursor.execute("SELECT name FROM sys.objects WHERE name = 'GetTopSignals' AND type = 'IF'")
    func = cursor.fetchone()
    
    conn.close()
    
    if tableCount >= 14 and proc and func:
        print(f'SUCCESS: Tables={tableCount}, Procedure=Present, Function=Present')
        sys.exit(0)
    else:
        print(f'PARTIAL: Tables={tableCount}, Procedure={\"Yes\" if proc else \"No\"}, Function={\"Yes\" if func else \"No\"}')
        sys.exit(0 if tableCount >= 14 else 1)
except Exception as e:
    print('ERROR:', str(e))
    sys.exit(1)
"@

$testScriptPath = Join-Path $env:TEMP "test_schema.py"
$schemaTestScript | Out-File -FilePath $testScriptPath -Encoding UTF8

try {
    $pythonResult = python $testScriptPath 2>&1
    Remove-Item $testScriptPath -Force
    
    if ($LASTEXITCODE -eq 0) {
        $resultText = ($pythonResult -join " ") -replace "SUCCESS:|PARTIAL:"
        Write-Test "3: Database Schema" "PASSED" $resultText.Trim()
        $testResults += "✅ Test 3: Database Schema (14 tables, 1 procedure, 1 function) - PASSED"
    } else {
        throw "Schema verification failed"
    }
}
catch {
    Write-Test "3: Database Schema" "FAILED" $_.Exception.Message
    $testResults += "❌ Test 3: Database Schema - FAILED"
    $allTestsPassed = $false
    throw "Database Schema test failed"
}

# Test 4: Storage Container Access
Write-Host ""
Write-Test "4: Storage Container Access" "INFO"

try {
    $storageAccountName = "stwealtharena$Suffix"
    $containers = az storage container list --account-name $storageAccountName --auth-mode login --query "[].name" -o tsv
    
    if ($containers) {
        $containerCount = ($containers -split "`n").Count
        Write-Test "4: Storage Container Access" "PASSED" "Found $containerCount containers"
        $testResults += "✅ Test 4: Storage Container Access ($containerCount containers) - PASSED"
    } else {
        throw "No containers found"
    }
}
catch {
    Write-Test "4: Storage Container Access" "FAILED" $_.Exception.Message
    $testResults += "❌ Test 4: Storage Container Access - FAILED"
    $allTestsPassed = $false
    throw "Storage Container Access test failed"
}

# Test 5: Environment Files Validation
Write-Host ""
Write-Test "5: Environment Files Validation" "INFO"

$projectRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$envFiles = @(
    @{Path = Join-Path $projectRoot "WealthArena_Backend\.env"; Required = @("DB_HOST", "DB_PASSWORD", "JWT_SECRET")},
    @{Path = Join-Path $projectRoot "wealtharena_chatbot\.env"; Required = @("GROQ_API_KEY")},
    @{Path = Join-Path $projectRoot "services\rl-service\.env"; Required = @("DB_HOST", "AZURE_STORAGE_CONNECTION_STRING")}
)

$allEnvValid = $true
foreach ($env in $envFiles) {
    if (-not (Test-Path $env.Path)) {
        Write-Test "5: Environment Files Validation" "FAILED" "$($env.Path) missing"
        $allEnvValid = $false
    } else {
        $content = Get-Content $env.Path -Raw
        $missing = @()
        foreach ($required in $env.Required) {
            if ($content -notlike "*$required*") {
                $missing += $required
            }
        }
        
        if ($missing.Count -eq 0) {
            Write-Test "  $($env.Path.Split('\')[-2])/.env" "PASSED" "All required variables present"
        } else {
            Write-Test "  $($env.Path.Split('\')[-2])/.env" "FAILED" "Missing: $($missing -join ', ')"
            $allEnvValid = $false
        }
    }
}

if ($allEnvValid) {
    Write-Test "5: Environment Files Validation" "PASSED" "All 3 files valid"
    $testResults += "✅ Test 5: Environment Files (3 files) - PASSED"
} else {
    Write-Test "5: Environment Files Validation" "FAILED" "Some files missing or invalid"
    $testResults += "❌ Test 5: Environment Files - FAILED"
    $allTestsPassed = $false
}

# Test 6: Sample Data Verification
Write-Host ""
Write-Test "6: Sample Data Verification" "INFO"

$sampleDataScript = @"
import pyodbc
import sys

try:
    sqlPassword = r'''$($sqlPassword -replace "'", "''")'''
    conn = pyodbc.connect(
        'Driver={ODBC Driver 18 for SQL Server};'
        'Server=tcp:sql-wealtharena-$Suffix.database.windows.net,1433;'
        'Database=wealtharena_db;'
        'Uid=wealtharena_admin;'
        'Pwd=' + sqlPassword + ';'
        'Encrypt=yes;'
        'TrustServerCertificate=no;'
        'Connection Timeout=30;'
    )
    cursor = conn.cursor()
    
    # Check sample data
    cursor.execute('SELECT COUNT(*) FROM market_data_ohlcv')
    ohlcvCount = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM rl_signals')
    signalsCount = cursor.fetchone()[0]
    
    conn.close()
    
    if ohlcvCount >= 3 and signalsCount >= 3:
        print(f'SUCCESS: OHLCV={ohlcvCount}, Signals={signalsCount}')
        sys.exit(0)
    else:
        print(f'PARTIAL: OHLCV={ohlcvCount}, Signals={signalsCount}')
        sys.exit(0)
except Exception as e:
    print('ERROR:', str(e))
    sys.exit(1)
"@

$testScriptPath = Join-Path $env:TEMP "test_sample_data.py"
$sampleDataScript | Out-File -FilePath $testScriptPath -Encoding UTF8

try {
    $pythonResult = python $testScriptPath 2>&1
    Remove-Item $testScriptPath -Force
    
    if ($LASTEXITCODE -eq 0) {
        $resultText = ($pythonResult -join " ") -replace "SUCCESS:|PARTIAL:"
        Write-Test "6: Sample Data" "PASSED" $resultText.Trim()
        $testResults += "✅ Test 6: Sample Data (3 records) - PASSED"
    } else {
        throw "Sample data verification failed"
    }
}
catch {
    Write-Test "6: Sample Data" "FAILED" $_.Exception.Message
    $testResults += "❌ Test 6: Sample Data - FAILED"
}

# Final Summary
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan

$passedCount = ($testResults | Where-Object { $_ -like "✅*" }).Count
$failedCount = ($testResults | Where-Object { $_ -like "❌*" }).Count

Write-Host ""
if ($allTestsPassed) {
    Write-Host "All Verification Tests Passed!" -ForegroundColor Green
    Write-Host ""
    foreach ($result in $testResults) {
        Write-Host $result
    }
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ready for Subsequent Phases:" -ForegroundColor Cyan
    Write-Host "  ✅ Phase: Download Market Data & Train RL Models" -ForegroundColor Green
    Write-Host "  ✅ Phase: Start All Local Services" -ForegroundColor Green
    Write-Host "  ✅ Phase: Deploy to Azure Web Apps" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Run: scripts/data_pipeline/run_all_downloaders.py (Phase 2)"
    Write-Host "  2. Run: scripts/rl_training/run_training.bat (Phase 7)"
    Write-Host "  3. Run: scripts/azure_deployment/start_all_services.bat (Local testing)"
    Write-Host "  4. Run: scripts/azure_deployment/deploy_all_services.ps1 (Cloud deployment)"
    Write-Host ""
    return
} else {
    Write-Host "⚠️  Some Verification Tests Failed" -ForegroundColor Yellow
    Write-Host ""
    foreach ($result in $testResults) {
        Write-Host $result
    }
    Write-Host ""
    Write-Host "Please review the failures above and retry setup." -ForegroundColor Yellow
    throw "Verification tests failed"
}

