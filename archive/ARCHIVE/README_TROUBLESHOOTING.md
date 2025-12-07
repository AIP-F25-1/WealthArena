# Troubleshooting Guide

This guide documents common issues encountered during automation execution and their solutions.

---

## Common Error 1: "Configuration file exists but parsed content is invalid"

**Error Message:**
```
WARNING: powershell-yaml module is not installed
Configuration file exists but parsed content may be invalid
```

**Cause:** PowerShell YAML module not installed or YAML syntax error in `automation_config.yaml`.

**Solutions:**

1. **Install powershell-yaml module** (see `MANUAL_STEPS_REQUIRED.md` Section 1)
   ```powershell
   Install-Module -Name powershell-yaml -Scope CurrentUser -Force
   ```

2. **Validate YAML syntax in automation_config.yaml**
   - Open the file in a text editor
   - Check for proper indentation (use spaces, not tabs)
   - Ensure proper YAML syntax (colons after keys, proper list formatting)
   - Use an online YAML validator: https://www.yamllint.com/

3. **Check for common YAML issues:**
   - Tabs instead of spaces (YAML requires spaces)
   - Missing colons after keys
   - Incorrect indentation levels
   - Trailing commas (YAML doesn't use commas like JSON)

4. **Test YAML parsing:**
   ```powershell
   Get-Content automation_config.yaml -Raw | ConvertFrom-Yaml
   ```
   This should return a hashtable without errors.

---

## Common Error 2: "A positional parameter cannot be found that accepts argument 'quick_training_config.yaml'"

**Error Message:**
```
A positional parameter cannot be found that accepts argument 'quick_training_config.yaml'
```

**Cause:** PowerShell argument passing bug in Phase 5. This was a bug in how arguments were passed to Python's `train.py` script.

**Solution:** This is fixed in the updated `master_automation.ps1` script. The fix changes how arguments are passed to Python by using `--flag=value` format instead of separate `--flag` and `value` arguments.

**If you still see this error:**
1. Ensure you're using the latest version of `master_automation.ps1`
2. The fix should automatically handle argument formatting correctly
3. If the issue persists, check that the config file path is correct: `rl-training/config/quick_training_config.yaml`

---

## Common Error 3: "Database connection test failed"

**Error Message:**
```
[CAUTION] Database connection test failed. Please check SQL credentials and firewall rules.
CONNECTION_FAILED: <error details>
```

**Cause:** Azure SQL firewall blocking your IP address, incorrect SQL credentials, or SQL Server name mismatch.

**Solutions:**

1. **Add your IP to Azure SQL firewall rules** (see `MANUAL_STEPS_REQUIRED.md` Section 2)
   
   **Option A - Azure Portal:**
   - Navigate to Azure Portal → SQL Servers → `sql-wealtharena-jg1ve2`
   - Click "Networking" or "Firewalls and virtual networks"
   - Click "Add client IP" or manually enter your IP
   - Click "Save"

   **Option B - Azure CLI:**
   ```powershell
   # Get your public IP
   curl ifconfig.me
   
   # Add firewall rule
   az sql server firewall-rule create `
     --resource-group rg-wealtharena-northcentralus `
     --server sql-wealtharena-jg1ve2 `
     --name AllowMyIP `
     --start-ip-address YOUR_IP `
     --end-ip-address YOUR_IP
   ```

2. **Verify SQL credentials in `database/sqlDB.env` or `data-pipeline/sqlDB.env`**
   - Check that `SQL_SERVER` matches: `sql-wealtharena-jg1ve2.database.windows.net`
   - Verify `SQL_DB`, `SQL_UID`, and `SQL_PWD` are correct
   - Ensure no placeholder values remain

3. **Check if SQL Server name is correct**
   - Verify the server name: `sql-wealtharena-jg1ve2.database.windows.net`
   - Check Azure Portal to confirm the actual server name if different

4. **Ensure port 1433 is not blocked by local firewall**
   - Check Windows Firewall settings
   - Ensure outbound connections to port 1433 are allowed

5. **Verify ODBC Driver 18 is installed**
   ```powershell
   # Check if driver is installed
   odbcad32.exe
   # Look for "ODBC Driver 18 for SQL Server" in the Drivers tab
   ```

---

## Common Error 4: "Could not write to log file: The process cannot access the file"

**Error Message:**
```
Could not write to log file: The process cannot access the file because it is being used by another process.
```

**Cause:** Multiple processes or file handles accessing the same log file simultaneously.

**Solutions:**

1. **Close any text editors viewing the log file**
   - Close VS Code, Notepad++, or any other editor that has the log file open
   - Ensure no log viewers are accessing files in `automation_logs` directory

2. **Kill stuck automation processes**
   ```powershell
   # Find and kill stuck PowerShell automation processes
   Get-Process powershell | Where-Object { $_.CommandLine -like "*master_automation*" } | Stop-Process -Force
   ```

3. **Delete the locked log file from `automation_logs` directory**
   - Navigate to the `automation_logs` directory
   - If a file is locked, close all programs that might have it open
   - Wait a few minutes and try again
   - Or restart your computer if the file is truly stuck

4. **The updated script includes process ID in log filenames**
   - New log files are named: `master_automation_YYYYMMDD_HHMMSS_PID.log`
   - This prevents conflicts when multiple automation instances run simultaneously
   - Each process gets its own unique log file

---

## Common Error 5: "Could not install RL training dependencies: error: subprocess-exited-with-error"

**Error Message:**
```
[WARNING] Could not install RL training dependencies
error: subprocess-exited-with-error
```

**Cause:** Missing build tools (Visual C++ on Windows), incompatible package versions, or network/proxy issues.

**Solutions:**

1. **Install Microsoft C++ Build Tools** (Windows)
   - Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Install "Desktop development with C++" workload
   - Include "Windows 10/11 SDK" (latest version)
   - Restart your computer after installation
   - Try installing dependencies again

2. **Manually install dependencies:**
   ```powershell
   cd rl-training
   pip install -r requirements.txt
   ```

3. **Check Python version compatibility** (3.8-3.11 recommended for Ray)
   ```powershell
   python --version
   ```
   - Ray may not fully support Python 3.12 yet
   - If using Python 3.12, consider using a virtual environment with Python 3.11

4. **Install problematic packages individually to identify the issue:**
   ```powershell
   pip install ray[rllib]==2.7.0
   pip install gymnasium==0.29.1
   pip install torch==2.1.0
   ```

5. **Try installing from pre-built wheels:**
   ```powershell
   pip install --only-binary :all: <package-name>
   ```

6. **For Visual C++ issues specifically:**
   - Install "Microsoft C++ Build Tools" from the link above
   - Or use pre-built wheels for packages that require compilation

---

## Common Error 6: "Ray not installed"

**Error Message:**
```
Ray not installed
or
ImportError: No module named 'ray'
```

**Cause:** Ray installation failed or wrong Python environment is being used.

**Solutions:**

1. **Manually install Ray:**
   ```powershell
   pip install ray[rllib]==2.7.0
   ```
   Or try:
   ```powershell
   pip install ray[rllib]==2.9.0
   ```

2. **Verify Python version:**
   ```powershell
   python --version
   ```
   Should be Python 3.8, 3.9, 3.10, or 3.11 (Ray may not support 3.12 yet)

3. **Check if using correct Python environment:**
   ```powershell
   # Check which Python is being used
   where python
   # Check if virtual environment is active
   echo $env:VIRTUAL_ENV
   ```

4. **Try installing in a fresh virtual environment:**
   ```powershell
   # Create new virtual environment
   python -m venv venv
   
   # Activate it
   .\venv\Scripts\Activate.ps1
   
   # Install dependencies
   cd rl-training
   pip install -r requirements.txt
   ```

5. **Verify Ray installation:**
   ```powershell
   python -c "import ray; print(ray.__version__)"
   ```

---

## Common Error 7: "YAML parsing failed" or "Invalid configuration"

**Error Message:**
```
Invalid configuration
or
YAML parsing error
```

**Cause:** YAML syntax error in configuration file or missing powershell-yaml module.

**Solutions:**

1. **Install powershell-yaml module** (see `MANUAL_STEPS_REQUIRED.md` Section 1)
   ```powershell
   Install-Module -Name powershell-yaml -Scope CurrentUser -Force
   ```

2. **Validate YAML syntax:**
   - Use an online validator: https://www.yamllint.com/
   - Check for proper indentation (spaces, not tabs)
   - Ensure all keys have colons
   - Verify list formatting

3. **Check for common YAML issues:**
   - Tabs instead of spaces
   - Missing colons after keys
   - Incorrect indentation
   - Trailing commas (not allowed in YAML)

---

## Common Error 8: "ODBC Driver 18 not found"

**Error Message:**
```
[CAUTION] ODBC Driver 18 for SQL Server not found
```

**Cause:** ODBC Driver 18 is not installed on the system.

**Solutions:**

1. **Install via winget:**
   ```powershell
   winget install --id Microsoft.msodbcsql.18 -e
   ```

2. **Download and install manually:**
   - Visit: https://aka.ms/downloadmsodbcsql
   - Download and run the installer
   - Follow the installation wizard

3. **Verify installation:**
   ```powershell
   odbcad32.exe
   ```
   Open the "Drivers" tab and look for "ODBC Driver 18 for SQL Server"

---

## Common Error 9: App Service Plan quota exceeded

**Error Message:**
```
Operation cannot be completed without additional quota
The subscription does not have enough quota to complete this operation
Current Limit: 0 for Free VMs and Shared VMs
```

**Cause:** Azure free accounts have quota limits for App Service Plans. The subscription has a quota of 0 for both Free VMs and Shared VMs, preventing the creation of App Service Plans required for deploying the backend, chatbot, and RL services.

**Solutions:**

### Solution 1: Use Azure Container Apps (Recommended)

Azure Container Apps does not require App Service Plan quotas and has a generous free tier:

1. **Prerequisites:**
   - Docker Desktop installed and running
   - Azure CLI logged in

2. **Deploy using Container Apps:**
   ```powershell
   cd infrastructure\azure_deployment
   .\deploy_all_services_containerapp.ps1 -ResourceGroup rg-wealtharena-northcentralus
   ```

3. **Advantages:**
   - No quota required (no App Service Plan needed)
   - Free tier: 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 million requests/month
   - Scales to zero (no idle costs)
   - Better for large dependencies (torch, transformers, Ray)
   - No code restructuring required

4. **When using master_automation.ps1:**
   - Phase 7 will prompt you to choose deployment mode
   - Select option 2 (Container Apps) when quota check fails
   - The script will automatically detect quota issues and suggest Container Apps

### Solution 2: Use Azure Functions

Azure Functions Consumption Plan also doesn't require App Service Plan quotas, but has limitations:

1. **IMPORTANT: Functions deployment is currently a placeholder path**
   - Backend code must be restructured to use Azure Functions format
   - Requires `host.json` and `function.json` files for each endpoint
   - Express.js routes must be converted to individual function handlers
   - The deployment scripts will exit with an error if code restructuring isn't complete

2. **Limitations:**
   - Code restructuring required (Express.js routes → Functions)
   - Package size limit: 1.5GB (chatbot and RL service exceed this)
   - Not recommended for RL service (Ray/PyTorch too large)
   - **Currently non-functional** - use Container Apps instead

3. **Deploy Functions (only if code is restructured):**
   ```powershell
   cd infrastructure\azure_deployment
   .\deploy_backend_functions.ps1  # Will exit with error if code not ready
   .\deploy_chatbot_functions.ps1  # Warning: May exceed size limits
   .\deploy_rl_functions.ps1        # Not recommended: Exceeds size limits
   ```

4. **Recommendation:** Use Container Apps instead (see Solution 1) - no code changes required

### Solution 3: Request Quota Increase

Request a quota increase from Azure Support:

1. **Via Azure Portal:**
   - Navigate to: Azure Portal → Subscriptions → Your Subscription → Usage + quotas
   - Search for "App Service Plans" or "Compute" quotas
   - Click "Request increase"
   - Fill out the request form
   - Wait 1-3 business days for approval

2. **Via Azure CLI:**
   ```powershell
   az support tickets create \
     --title "App Service Plan Quota Increase Request" \
     --description "Need quota for WealthArena deployment" \
     --service "Microsoft.Compute" \
     --severity "minimal"
   ```

3. **Link:** https://aka.ms/quota-increase

### Solution 4: Switch to GCP Deployment

Use the existing GCP deployment scripts as a complete alternative:

1. **Prerequisites:**
   - Google Cloud account with free credits
   - GCP CLI installed

2. **Deploy to GCP:**
   ```powershell
   cd infrastructure\gcp_deployment
   # Follow GCP deployment instructions
   ```

### Comparison Table

| Feature | App Service | Container Apps | Functions |
|---------|-------------|----------------|-----------|
| **Quota Required** | Yes (Free/Shared) | No | No |
| **Free Tier** | Limited | Generous (180k vCPU-s, 360k GiB-s, 2M requests) | Generous (1M executions, 400k GB-s) |
| **Code Changes** | None | None (Docker) | Required (restructure) |
| **Package Size Limit** | N/A | None | 1.5GB |
| **Large Dependencies** | Supported | Supported | Limited |
| **Scales to Zero** | No | Yes | Yes |
| **Cold Start** | None | 5-30 seconds | 1-10 seconds |
| **Best For** | Standard apps | Containerized apps, ML workloads | Event-driven, small apps |

### Quick Command Reference

**Container Apps Deployment:**
```powershell
# Master deployment (all services)
cd infrastructure\azure_deployment
.\deploy_all_services_containerapp.ps1 -ResourceGroup rg-wealtharena-northcentralus

# Individual services
.\deploy_backend_containerapp.ps1 -ResourceGroup rg-wealtharena-northcentralus
.\deploy_chatbot_containerapp.ps1 -ResourceGroup rg-wealtharena-northcentralus
.\deploy_rl_containerapp.ps1 -ResourceGroup rg-wealtharena-northcentralus
```

**Check Current Quota:**
```powershell
az vm list-usage --location northcentralus --query "[?name.value=='cores']"
```

**Check Docker Status:**
```powershell
docker --version
docker ps
```

---

## Performance Tips

1. **Skip completed phases:** Use `-StartFromPhase` parameter to resume from a specific phase
   ```powershell
   .\master_automation.ps1 -StartFromPhase 5
   ```

2. **Use Quick Training mode:** Select option 1 during training mode selection (500 iterations vs 2000)

3. **Skip expensive phases:** Set skip flags in `automation_config.yaml` for phases you don't need:
   ```yaml
   phase_control:
     skip_data_download: true
     skip_data_processing: true
     skip_rl_training: true
   ```

4. **Monitor progress:** Check logs in `automation_logs` directory during long-running phases

5. **Run phases individually:** Use `-StartFromPhase` and `-SkipDeployment` flags to test specific phases

---

## Getting Help

If you continue to experience issues after trying these solutions:

1. **Check the log files** in `automation_logs` directory for detailed error messages
2. **Review `MANUAL_STEPS_REQUIRED.md`** for manual steps that need to be completed
3. **Verify all prerequisites** are installed:
   - Azure CLI
   - Python 3.8-3.11
   - Node.js
   - ODBC Driver 18
   - powershell-yaml module

4. **Check Azure resources** in Azure Portal:
   - SQL Server exists and is accessible
   - Resource group exists
   - Storage account exists

5. **Verify configuration** in `automation_config.yaml`:
   - All Azure resource names match actual resources
   - SQL server name is correct
   - All required sections are present

---

## Error Log Locations

- **Main automation log:** `automation_logs/master_automation_YYYYMMDD_HHMMSS_PID.log`
- **Phase-specific errors:** Check the main log file for detailed phase execution logs
- **Python script errors:** Check `automation_logs` for Python stdout/stderr files

---

## Quick Reference: Common Commands

```powershell
# Install PowerShell YAML module
Install-Module -Name powershell-yaml -Scope CurrentUser -Force

# Add IP to Azure SQL firewall
curl ifconfig.me  # Get your IP
az sql server firewall-rule create --resource-group rg-wealtharena-northcentralus --server sql-wealtharena-jg1ve2 --name AllowMyIP --start-ip-address YOUR_IP --end-ip-address YOUR_IP

# Install RL dependencies manually
cd rl-training
pip install -r requirements.txt

# Kill stuck processes
Get-Process python | Stop-Process -Force
Get-Process ray | Stop-Process -Force

# Verify Python version
python --version

# Verify Ray installation
python -c "import ray; print(ray.__version__)"
```

