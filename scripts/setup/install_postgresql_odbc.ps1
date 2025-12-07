# Install PostgreSQL ODBC Driver
# This is required for the data pipeline when using PostgreSQL

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL ODBC Driver Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
Write-Host "Checking for PostgreSQL ODBC drivers..." -ForegroundColor Yellow
try {
    $drivers = python -c "import pyodbc; print(chr(10).join([d for d in pyodbc.drivers() if 'PostgreSQL' in d or 'postgres' in d.lower()]))" 2>&1
    if ($drivers -and $drivers -notmatch "None|Error") {
        Write-Host "PostgreSQL ODBC driver found:" -ForegroundColor Green
        Write-Host $drivers -ForegroundColor White
        Write-Host ""
        Write-Host "Driver is already installed! You can proceed." -ForegroundColor Green
        exit 0
    }
}
catch {
    Write-Host "Could not check drivers (this is OK)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "PostgreSQL ODBC Driver is NOT installed." -ForegroundColor Red
Write-Host ""
Write-Host "Installation Methods:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Method 1: Chocolatey (Recommended - if you have admin rights)" -ForegroundColor Yellow
Write-Host "  Run this command as Administrator:" -ForegroundColor White
Write-Host "    choco install psqlodbc -y" -ForegroundColor Cyan
Write-Host ""
Write-Host "Method 2: Direct Download (Manual)" -ForegroundColor Yellow
Write-Host "  1. Visit: https://www.postgresql.org/ftp/odbc/versions/msi/" -ForegroundColor White
Write-Host "  2. Download: psqlodbc_XX_XX-x64.zip (for 64-bit Windows)" -ForegroundColor White
Write-Host "  3. Extract and run: psqlodbc_x64.msi as Administrator" -ForegroundColor White
Write-Host "  4. Restart PowerShell after installation" -ForegroundColor White
Write-Host ""
Write-Host "Method 3: Use SQL Server Instead" -ForegroundColor Yellow
Write-Host "  If you prefer, you can switch to SQL Server:" -ForegroundColor White
Write-Host "  1. Edit data-pipeline/sqlDB.env" -ForegroundColor White
Write-Host "  2. Change SQL_DRIVER to: {ODBC Driver 18 for SQL Server}" -ForegroundColor White
Write-Host "  3. Update SQL_SERVER, SQL_DB, SQL_UID, SQL_PWD accordingly" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Would you like to try Chocolatey installation now? (Y/N)"

if ($choice -eq "Y" -or $choice -eq "y") {
    Write-Host ""
    Write-Host "Attempting Chocolatey installation..." -ForegroundColor Yellow
    Write-Host "Note: This requires Administrator privileges" -ForegroundColor Yellow
    Write-Host ""
    
    try {
        # Try to run choco install
        $chocoOutput = choco install psqlodbc -y 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Installation successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Please restart PowerShell and verify with:" -ForegroundColor Yellow
            Write-Host "  python -c `"import pyodbc; print([d for d in pyodbc.drivers() if 'PostgreSQL' in d])`"" -ForegroundColor Cyan
        }
        else {
            Write-Host "Chocolatey installation failed. Please try Method 2 (Direct Download)." -ForegroundColor Red
            Write-Host $chocoOutput -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host "Please try Method 2 (Direct Download) or run Chocolatey manually as Administrator." -ForegroundColor Yellow
    }
}
else {
    Write-Host ""
    Write-Host "Please install manually using one of the methods above." -ForegroundColor Yellow
    Write-Host "After installation, restart PowerShell and run your setup again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

