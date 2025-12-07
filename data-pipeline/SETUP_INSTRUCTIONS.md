# Data Pipeline Setup Instructions

This guide provides step-by-step instructions for setting up the WealthArena data pipeline for the first time.

## Table of Contents

1. [System Prerequisites](#section-1-system-prerequisites)
2. [ODBC Driver Installation (Detailed)](#section-2-odbc-driver-installation-detailed)
3. [Python Environment Setup](#section-3-python-environment-setup)
4. [Configuration Files](#section-4-configuration-files)
5. [Connection Testing](#section-5-connection-testing)
6. [Quick Start Commands](#section-6-quick-start-commands)
7. [Troubleshooting Reference](#section-7-troubleshooting-reference)

---

## Section 1: System Prerequisites

Before starting, ensure you have the following system-level dependencies installed:

### Required System Components

1. **Python 3.8 or higher**
   - Verify: `python --version` or `python3 --version`
   - Download: https://www.python.org/downloads/
   - Ensure Python is added to your system PATH

2. **Microsoft ODBC Driver 18 for SQL Server** ⚠️ **CRITICAL**
   - This is a system-level driver required for database connections
   - Installation instructions in [Section 2](#section-2-odbc-driver-installation-detailed)
   - Without this driver, all database operations will fail

3. **Azure CLI (Optional but Recommended)**
   - Useful for credential management and Azure resource operations
   - Install: `winget install -e --id Microsoft.AzureCLI`
   - Verify: `az --version`
   - Login: `az login`

4. **Git** (Usually pre-installed)
   - Verify: `git --version`

---

## Section 2: ODBC Driver Installation (Detailed)

The ODBC driver is the most common point of failure. Follow these steps carefully.

### Windows Installation Steps

#### Method 1: Using Winget (Recommended)

1. Open PowerShell or Command Prompt (Run as Administrator if needed)
2. Execute the installation command:
   ```powershell
   winget install --id Microsoft.msodbcsql.18 -e
   ```
3. Wait for installation to complete
4. Restart your terminal/PowerShell session

#### Method 2: Manual Download and Install

1. Visit: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
2. Download the appropriate installer:
   - **x64** for 64-bit Python installations (most common)
   - **x86** for 32-bit Python installations
3. Run the installer and follow the prompts
4. Restart your terminal/PowerShell session

### Verification

1. **Open ODBC Data Source Administrator:**
   - Press `Win + R` to open Run dialog
   - Type: `odbcad32.exe`
   - Press Enter

2. **Navigate to Drivers Tab:**
   - In the ODBC Data Source Administrator window
   - Click the "Drivers" tab
   - Look for "ODBC Driver 18 for SQL Server" in the list

3. **Verify Driver Bitness (Critical):**
   - Check your Python bitness:
     ```powershell
     python -c "import platform; print(platform.architecture()[0])"
     ```
   - Ensure driver bitness matches:
     - 64-bit Python → 64-bit ODBC Driver
     - 32-bit Python → 32-bit ODBC Driver
   - If you have both 32-bit and 64-bit Python, you may need both drivers

### Common Installation Issues

**Issue: Winget command not found**
- Solution: Update Windows to the latest version, or use Method 2 (manual download)

**Issue: Permission denied**
- Solution: Run PowerShell/Command Prompt as Administrator

**Issue: Driver installed but not detected**
- Solution: 
  1. Restart terminal/PowerShell
  2. Verify correct bitness match
  3. Check both 32-bit and 64-bit ODBC administrators:
     - 32-bit: `C:\Windows\SysWOW64\odbcad32.exe`
     - 64-bit: `C:\Windows\System32\odbcad32.exe`

**Issue: Installation succeeds but Python still can't find driver**
- Solution:
  1. Restart your terminal/PowerShell completely
  2. Verify driver appears in ODBC Administrator
  3. Check Python bitness matches driver bitness
  4. Try reinstalling the driver

---

## Section 3: Python Environment Setup

### Create Virtual Environment

1. **Navigate to data-pipeline directory:**
   ```powershell
   cd data-pipeline
   ```

2. **Create virtual environment:**
   ```powershell
   python -m venv venv
   ```

3. **Activate virtual environment:**
   
   **Windows (PowerShell):**
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```
   
   **Windows (Command Prompt):**
   ```cmd
   venv\Scripts\activate.bat
   ```
   
   **macOS/Linux:**
   ```bash
   source venv/bin/activate
   ```

4. **Verify activation:**
   - Your prompt should show `(venv)` prefix
   - Example: `(venv) PS C:\...\data-pipeline>`

### Install Python Dependencies

⚠️ **IMPORTANT**: Ensure ODBC Driver 18 is installed BEFORE installing Python packages.

1. **Install from requirements.txt:**
   ```powershell
   pip install -r requirements.txt
   ```

2. **Verify pyodbc can detect drivers:**
   ```powershell
   python -c "import pyodbc; print('\n'.join(pyodbc.drivers()))"
   ```
   
   **Expected Output:**
   ```
   ODBC Driver 18 for SQL Server
   ...
   ```
   
   If "ODBC Driver 18 for SQL Server" does NOT appear in the list, the driver is not installed correctly.

---

## Section 4: Configuration Files

### Step 1: Create sqlDB.env

1. **Copy the example file:**
   ```powershell
   copy sqlDB.env.example sqlDB.env
   ```
   
   Or on macOS/Linux:
   ```bash
   cp sqlDB.env.example sqlDB.env
   ```

2. **Edit sqlDB.env with a text editor:**
   ```powershell
   notepad sqlDB.env
   ```
   
   Or use your preferred editor (VS Code, nano, vim, etc.)

### Step 2: Obtain Azure SQL Credentials

You need the following information from your Azure SQL Database:

1. **SQL Server Name** (`SQL_SERVER`)
   - Format: `your-server-name.database.windows.net`
   - Found in: Azure Portal → SQL Databases → Your Database → Overview → Server name

2. **Database Name** (`SQL_DB`)
   - Found in: Azure Portal → SQL Databases → Your Database → Overview → Database name

3. **Username** (`SQL_UID`)
   - Usually the SQL Server admin username created during setup
   - Format: `sqladmin` or `admin@your-server-name`

4. **Password** (`SQL_PWD`)
   - The password for the SQL user account

5. **Azure Storage Connection String** (`AZURE_STORAGE_CONNECTION_STRING`)
   - Found in: Azure Portal → Storage Accounts → Your Storage Account → Access Keys → Connection string
   - Format: `DefaultEndpointsProtocol=https;AccountName=<name>;AccountKey=<key>;EndpointSuffix=core.windows.net`

### Step 3: Configure sqlDB.env

Replace the placeholder values in `sqlDB.env`:

```env
# Azure SQL Database
SQL_SERVER=your-actual-server.database.windows.net
SQL_DB=WealthArenaDB
SQL_UID=sqladmin
SQL_PWD=your_actual_password

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your_account;AccountKey=your_key;EndpointSuffix=core.windows.net
```

### Step 4: Configure azureCred.env (if needed)

1. **Copy the example file:**
   ```powershell
   copy azureCred.env.example azureCred.env
   ```

2. **Fill in Azure Storage credentials** (same as `AZURE_STORAGE_CONNECTION_STRING` from above)

### Security Best Practices

⚠️ **CRITICAL**: Never commit `.env` files to version control!

- Verify `.env` files are in `.gitignore`
- Use Azure Key Vault for production environments
- Store credentials in CI/CD pipeline secrets for automated deployments
- Rotate passwords regularly

---

## Section 5: Connection Testing

### Test Database Connectivity

1. **Test SQL connection:**
   ```powershell
   python -c "from dbConnection import get_conn; conn = get_conn(); print('✅ Connected to:', conn.execute('SELECT DB_NAME()').fetchone()[0])"
   ```

   **Expected Output:**
   ```
   ✅ Connected to: WealthArenaDB
   ```

   **If you get an error:**
   - `IM002` error: ODBC driver not installed (see Section 2)
   - `08001` error: Check firewall rules in Azure Portal
   - `28000` error: Invalid username/password

2. **Test Azure Storage connectivity (if using ADLS):**
   ```powershell
   python -c "from azure.storage.filedatalake import DataLakeServiceClient; print('Azure Storage module loaded')"
   ```

### Troubleshooting Connection Errors

**Error: "Data source name not found and no default driver specified"**
- **Cause**: ODBC Driver 18 not installed
- **Solution**: Install driver (Section 2), restart terminal, verify installation

**Error: "Connection timeout" or "Cannot open server"**
- **Cause**: Firewall blocking your IP address
- **Solution**: 
  1. Go to Azure Portal → SQL Server → Firewalls and virtual networks
  2. Add your current IP address
  3. Or enable "Allow Azure services and resources to access this server"

**Error: "Login failed for user"**
- **Cause**: Incorrect username or password
- **Solution**: Verify `SQL_UID` and `SQL_PWD` in `sqlDB.env`
- Check: Username format may need `@server-name` suffix

**Error: "SSL/TLS encryption required"**
- **Cause**: Driver connection string missing encryption settings
- **Solution**: Usually handled automatically by `dbConnection.py`, but verify connection string format

---

## Section 6: Quick Start Commands

Once setup is complete, use these commands to run the data pipeline:

### Download Market Data

**All asset classes:**
```powershell
python run_all_downloaders.py
```

**Individual asset classes:**
```powershell
# ASX Stocks
python asx_market_data_adls.py --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 80 --sleep-between 2.0

# Cryptocurrencies
python crypto_market_data_adls.py --category Major --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 20

# Forex Pairs
python forex_market_data_adls.py --category Major --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 10

# Commodities
python commodities_market_data_adls.py --category All --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 10

# ETFs
python etf_market_data_adls.py --start-date 2022-01-01 --end-date 2025-01-01 --batch-size 20
```

### Process and Store Data

**All asset classes:**
```powershell
# Set in sqlDB.env: ADLS_RAW_PREFIX_LIST=asxStocks,crypto,forex,commodities,etfs
python processAndStore.py
```

**Individual asset classes:**
```powershell
# ASX Stocks
$env:ADLS_RAW_PREFIX="asxStocks"
python processAndStore.py

# Crypto
$env:ADLS_RAW_PREFIX="crypto"
python processAndStore.py
```

### Export for RL Training

```powershell
python export_to_rl_training.py --output-dir ../rl-training/data/processed
```

---

## Section 7: Troubleshooting Reference

### Quick Reference Table

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `IM002: Data source name not found` | ODBC driver not installed | Install ODBC Driver 18 (Section 2) |
| `08001: Connection timeout` | Firewall blocking IP | Add IP to Azure SQL firewall |
| `28000: Login failed` | Wrong username/password | Verify `sqlDB.env` credentials |
| `ModuleNotFoundError: pyodbc` | Python package not installed | `pip install -r requirements.txt` |
| `Driver not found in pyodbc.drivers()` | Driver bitness mismatch | Install correct bitness driver |
| `SSL/TLS encryption error` | Missing encryption settings | Verify connection string format |

### Detailed Error Solutions

See `sqlDB.env.example` for troubleshooting comments, or refer to:
- `README_PHASE2.md` - Full Phase 2 documentation
- `README_AUTOMATION.md` - Automation troubleshooting section

### Getting Help

1. **Check Logs:**
   - Download logs: `data-pipeline/logs/data_download.log`
   - Orchestrator logs: `data-pipeline/logs/orchestrator.log`

2. **Verify Setup:**
   - ODBC driver installed and verified
   - Python virtual environment activated
   - `sqlDB.env` configured with real credentials
   - Database connection test passes

3. **Common Issues:**
   - Restart terminal after driver installation
   - Verify all credentials in `sqlDB.env` (no placeholders)
   - Check Azure SQL firewall allows your IP
   - Ensure Python and driver bitness match

---

## Next Steps

After completing setup:

1. ✅ Verify ODBC driver installation (Section 2)
2. ✅ Test database connectivity (Section 5)
3. ✅ Run a small download test (Section 6)
4. ➡️ Proceed to Phase 2 full execution (see `README_PHASE2.md`)

For detailed information about each component, see:
- `README_PHASE2.md` - Complete Phase 2 guide
- `sqlDB.env.example` - Configuration reference with troubleshooting
- `dbConnection.py` - Database connection module source code

---

**Last Updated**: Based on automation log analysis (2025-11-01)
**Reference**: `automation_logs/master_automation_20251101_183554.log`

