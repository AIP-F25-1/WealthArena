# Install Microsoft ODBC Driver 18 for SQL Server
# Alternative installation script when winget is not available

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ODBC Driver 18 Installation Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if already installed
Write-Host "Checking for existing ODBC drivers..." -ForegroundColor Yellow
$existingDrivers = Get-OdbcDriver | Where-Object {$_.Name -like '*SQL Server*'}
if ($existingDrivers) {
    Write-Host "Found existing SQL Server ODBC drivers:" -ForegroundColor Green
    $existingDrivers | ForEach-Object {
        Write-Host "  - $($_.Name) (Version: $($_.Version))" -ForegroundColor White
    }
    Write-Host ""
    $useExisting = Read-Host "Use existing driver? (Y/N)"
    if ($useExisting -eq "Y" -or $useExisting -eq "y") {
        Write-Host "Using existing driver. No installation needed." -ForegroundColor Green
        exit 0
    }
}

Write-Host ""
Write-Host "Installation Methods:" -ForegroundColor Cyan
Write-Host "1. Direct Download from Microsoft (Recommended)" -ForegroundColor White
Write-Host "2. Chocolatey (if installed)" -ForegroundColor White
Write-Host "3. Manual download instructions" -ForegroundColor White
Write-Host ""

$method = Read-Host "Select installation method (1-3)"

switch ($method) {
    "1" {
        Write-Host ""
        Write-Host "Opening Microsoft download page..." -ForegroundColor Yellow
        Write-Host "Download URL: https://aka.ms/downloadmsodbcsql" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Steps:" -ForegroundColor Yellow
        Write-Host "1. The download page will open in your browser" -ForegroundColor White
        Write-Host "2. Download 'msodbcsql.msi' (x64 or x86 depending on your system)" -ForegroundColor White
        Write-Host "3. Run the installer as Administrator" -ForegroundColor White
        Write-Host "4. Follow the installation wizard" -ForegroundColor White
        Write-Host ""
        
        Start-Process "https://aka.ms/downloadmsodbcsql"
        
        Write-Host "After installation, verify with:" -ForegroundColor Yellow
        Write-Host "  Get-OdbcDriver | Where-Object {`$_.Name -like '*SQL Server*'}" -ForegroundColor Cyan
    }
    
    "2" {
        # Check if Chocolatey is available
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-Host ""
            Write-Host "Installing via Chocolatey..." -ForegroundColor Yellow
            Write-Host "Note: This requires Administrator privileges" -ForegroundColor Yellow
            Write-Host ""
            
            try {
                Start-Process powershell -Verb RunAs -ArgumentList "-Command", "choco install sqlserver-odbc -y" -Wait
                Write-Host "Installation completed!" -ForegroundColor Green
            }
            catch {
                Write-Host "Chocolatey installation failed. Try method 1 (Direct Download)." -ForegroundColor Red
            }
        }
        else {
            Write-Host ""
            Write-Host "Chocolatey is not installed." -ForegroundColor Red
            Write-Host "Install Chocolatey first from: https://chocolatey.org/install" -ForegroundColor Yellow
            Write-Host "Or use method 1 (Direct Download)" -ForegroundColor Yellow
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "Manual Installation Instructions:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Visit: https://aka.ms/downloadmsodbcsql" -ForegroundColor White
        Write-Host "2. Download 'Microsoft ODBC Driver 18 for SQL Server'" -ForegroundColor White
        Write-Host "   - Choose x64 for 64-bit Windows" -ForegroundColor White
        Write-Host "   - Choose x86 for 32-bit Windows (rare)" -ForegroundColor White
        Write-Host "3. Run the downloaded .msi file as Administrator" -ForegroundColor White
        Write-Host "4. Follow the installation wizard" -ForegroundColor White
        Write-Host "5. Verify installation:" -ForegroundColor White
        Write-Host "   Get-OdbcDriver | Where-Object {`$_.Name -like '*SQL Server*'}" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Alternative: Use PostgreSQL instead (already installed)" -ForegroundColor Yellow
        Write-Host "  The data pipeline supports PostgreSQL which you already have." -ForegroundColor White
        Write-Host "  Update sqlDB.env to use PostgreSQL instead of SQL Server." -ForegroundColor White
    }
    
    default {
        Write-Host "Invalid selection. Please run the script again." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "After installation, verify with:" -ForegroundColor Yellow
Write-Host "  Get-OdbcDriver | Where-Object {`$_.Name -like '*SQL Server*'}" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

