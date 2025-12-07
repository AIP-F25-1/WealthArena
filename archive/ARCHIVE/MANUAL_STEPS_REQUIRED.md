# Manual Steps Required

This document outlines the manual steps you must take to resolve issues that cannot be fixed by code changes alone.

## Section 1: Install PowerShell YAML Module

The `powershell-yaml` module is required for proper configuration file parsing. Follow these steps to install it:

### Step-by-Step Instructions

1. **Open PowerShell as Administrator**
   - Right-click on PowerShell and select "Run as Administrator"
   - Or open a regular PowerShell window if you prefer user-level installation

2. **Install the module**
   ```powershell
   Install-Module -Name powershell-yaml -Scope CurrentUser -Force
   ```

3. **Verify installation**
   ```powershell
   Get-Module -ListAvailable -Name powershell-yaml
   ```
   This should display the module information if installed correctly.

4. **If installation fails due to PSGallery trust**
   If you see an error about untrusted repository, run:
   ```powershell
   Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
   ```
   Then try the installation command again.

5. **Restart PowerShell**
   Close and reopen PowerShell to ensure the module is loaded.

---

## Section 2: Fix Azure SQL Firewall Rules

Your IP address needs to be added to Azure SQL Server firewall rules to allow database connections.

### Option A - Using Azure Portal (Recommended for beginners)

1. **Navigate to Azure Portal**
   - Go to https://portal.azure.com
   - Log in with your Azure account

2. **Find your SQL Server**
   - Navigate to: **SQL Servers** → `sql-wealtharena-jg1ve2`
   - Or search for "SQL Servers" in the top search bar

3. **Open Firewall Settings**
   - Click on **"Networking"** or **"Firewalls and virtual networks"** in the left menu
   - Or click **"Set server firewall"** if you see it

4. **Add Your IP Address**
   - Click **"Add client IP"** to automatically add your current IP address
   - Or manually enter your IP address in the **"Start IP"** and **"End IP"** fields
   - Click **"Save"** to apply the changes

5. **Verify**
   - The firewall rule should appear in the list
   - Wait a few seconds for the changes to propagate

### Option B - Using Azure CLI (Recommended for automation)

1. **Get your public IP address**
   ```powershell
   curl ifconfig.me
   ```
   Or visit https://whatismyip.com in your browser

2. **Add firewall rule via Azure CLI**
   ```powershell
   az sql server firewall-rule create `
     --resource-group rg-wealtharena-northcentralus `
     --server sql-wealtharena-jg1ve2 `
     --name AllowMyIP `
     --start-ip-address YOUR_IP `
     --end-ip-address YOUR_IP
   ```
   Replace `YOUR_IP` with the IP address you obtained in step 1.

3. **Verify the rule was created**
   ```powershell
   az sql server firewall-rule list `
     --resource-group rg-wealtharena-northcentralus `
     --server sql-wealtharena-jg1ve2
   ```

### Option C - Allow Azure Services (If running from Azure VM/service)

If you're running the automation from an Azure VM or Azure service, you may need to allow Azure services:

```powershell
az sql server firewall-rule create `
  --resource-group rg-wealtharena-northcentralus `
  --server sql-wealtharena-jg1ve2 `
  --name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

**Note:** This allows all Azure services to connect. Use with caution.

---

## Section 3: Install RL Training Dependencies Manually

If the automated dependency installation fails, you can install them manually.

### Step-by-Step Instructions

1. **Navigate to the RL training directory**
   ```powershell
   cd rl-training
   ```

2. **Install dependencies**
   ```powershell
   pip install -r requirements.txt
   ```

### Troubleshooting Installation Issues

#### Issue: Build Errors (Missing Visual C++ Build Tools)

**Symptoms:** Error messages mentioning "Microsoft Visual C++", "subprocess-exited-with-error", or "building extension"

**Solution:**
1. Install **Microsoft C++ Build Tools** from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. During installation, select:
   - **"Desktop development with C++"** workload
   - **"Windows 10/11 SDK"** (latest version)
3. Restart your computer after installation
4. Try installing dependencies again

**Alternative:** Install problematic packages from pre-built wheels:
```powershell
pip install --only-binary :all: <package-name>
```

#### Issue: Gym Package Installation Fails

**Symptoms:** Errors when installing `gym` or `gymnasium` packages

**Solution:**
Try installing a minimal version of gym instead:
```powershell
pip install gymnasium==0.29.1
```
Or if you need classic control environments:
```powershell
pip install gymnasium[classic_control]==0.29.1
```

#### Issue: Ray Installation Fails

**Symptoms:** Errors when installing `ray[rllib]`

**Solution:**
1. **Check Python version** (Ray may not support Python 3.12 yet):
   ```powershell
   python --version
   ```
   Should be Python 3.8, 3.9, 3.10, or 3.11

2. **Install a stable Ray version:**
   ```powershell
   pip install ray[rllib]==2.7.0
   ```
   Or try:
   ```powershell
   pip install ray[rllib]==2.9.0
   ```

3. **If using Python 3.12**, consider using a virtual environment with Python 3.11:
   ```powershell
   # Install Python 3.11 if not already installed
   # Then create venv with Python 3.11
   python3.11 -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

#### Issue: Network/Proxy Issues

**Symptoms:** Timeout errors, connection refused, SSL errors

**Solution:**
1. Check your internet connection
2. If behind a proxy, configure pip:
   ```powershell
   pip install --proxy http://proxy-server:port -r requirements.txt
   ```
3. Try using a different package index:
   ```powershell
   pip install -i https://pypi.org/simple/ -r requirements.txt
   ```

---

## Section 4: Verify Configuration File

Ensure `automation_config.yaml` is properly formatted and contains correct values.

### Step-by-Step Instructions

1. **Open the configuration file**
   - Open `automation_config.yaml` in a text editor (VS Code, Notepad++, etc.)

2. **Verify YAML syntax**
   - Ensure proper indentation (use spaces, not tabs)
   - YAML requires 2 spaces per indentation level
   - Check for proper colons (`:`) after keys
   - Ensure list items start with `-` and are properly indented

3. **Verify required sections exist**
   The file should contain these sections:
   - `azure` - Azure resource group, location, suffix
   - `phase_control` - Skip flags for various phases
   - `rl_training` - Training configuration
   - `deployment` - Azure Web App names, storage account, SQL server

4. **Validate YAML syntax online (optional)**
   - Visit https://www.yamllint.com/
   - Paste your YAML content to validate syntax

5. **Test parsing in PowerShell (after installing powershell-yaml)**
   ```powershell
   Get-Content automation_config.yaml -Raw | ConvertFrom-Yaml
   ```
   This should return a hashtable without errors.

### Common YAML Issues

- **Tabs instead of spaces:** YAML requires spaces. Convert all tabs to spaces.
- **Missing colons:** Keys must be followed by colons (`key: value`)
- **Incorrect indentation:** All items at the same level must have the same indentation
- **Trailing commas:** YAML doesn't use commas in lists (unlike JSON)

---

## Section 5: Close Conflicting Processes

Before running the automation again, ensure no conflicting processes are running.

### Step-by-Step Instructions

1. **Close log file viewers**
   - Close any text editors or log viewers that might have the log file open
   - This includes VS Code, Notepad++, or any other editor viewing files in the `automation_logs` directory

2. **Kill stuck Python processes**
   ```powershell
   Get-Process python | Stop-Process -Force
   ```
   Or more selectively:
   ```powershell
   Get-Process python | Where-Object { $_.Path -like "*WealthArena*" } | Stop-Process -Force
   ```

3. **Kill stuck Ray processes**
   ```powershell
   Get-Process ray | Stop-Process -Force
   ```
   Or search for Ray-related processes:
   ```powershell
   Get-Process | Where-Object { $_.ProcessName -like "*ray*" -or $_.CommandLine -like "*ray*" } | Stop-Process -Force
   ```

4. **Delete locked log files (if necessary)**
   - Navigate to the `automation_logs` directory
   - If a log file is locked and you can't delete it:
     - Close all programs that might have it open
     - Or wait a few minutes and try again
     - Or restart your computer if the file is truly stuck

5. **Check for stuck automation processes**
   ```powershell
   Get-Process powershell | Where-Object { $_.CommandLine -like "*master_automation*" } | Stop-Process -Force
   ```

### Verification

After cleaning up processes, verify nothing is running:
```powershell
# Check for Python processes
Get-Process python -ErrorAction SilentlyContinue

# Check for Ray processes
Get-Process ray -ErrorAction SilentlyContinue

# Check for stuck PowerShell automation
Get-Process powershell | Where-Object { $_.CommandLine -like "*master_automation*" }
```

If all commands return nothing (or empty results), you're ready to run the automation again.

---

## Summary Checklist

Before running the automation, ensure you have:

- [ ] Installed `powershell-yaml` module
- [ ] Added your IP address to Azure SQL firewall rules
- [ ] Manually installed RL training dependencies (if automated installation failed)
- [ ] Verified `automation_config.yaml` is properly formatted
- [ ] Closed all conflicting processes
- [ ] Deleted any locked log files

After completing these steps, you should be able to run the automation successfully.

