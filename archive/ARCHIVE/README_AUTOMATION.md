# WealthArena Automation System

## Overview

The WealthArena Automation System provides a comprehensive PowerShell-based orchestration script that automates the entire deployment pipeline from local testing to production APK build. This system streamlines what would otherwise be a manual 11-19 hour process into a single automated run.

### What It Automates

The automation system executes 11 sequential phases:

1. **Frontend Local Testing** - Install dependencies, start Expo server, verify health
2. **Data Download** - Download market data for all asset classes (ASX, Crypto, Forex, Commodities, ETFs)
3. **Data Processing** - Process raw data and store in Azure SQL
4. **Data Export** - Export processed data to RL training directory
5. **RL Model Training** - Train reinforcement learning models using Ray RLlib
6. **Azure Resource Verification** - Verify and provision Azure infrastructure
7. **Service Deployment** - Deploy backend, chatbot, and RL service to Azure
8. **Model Upload** - Upload trained models to Azure Blob Storage
9. **Frontend Configuration** - Update frontend with Azure service URLs
10. **End-to-End Testing** - Run health checks and integration tests
11. **APK Build** - Build Android APK using EAS CLI

### Expected Execution Time

- **Full Pipeline**: 8-12 hours (most time spent on RL training)
- **Quick Deployment**: 30-60 minutes (skip download, processing, training)
- **Testing Only**: 1-2 hours (skip deployment and APK build)

## Prerequisites

### System Requirements

- **OS**: Windows 10/11
- **PowerShell**: Version 5.1 or higher
- **Disk Space**: 10GB+ free space
- **RAM**: 8GB minimum (16GB recommended for training)
- **Internet**: Stable connection required for downloads and deployments

### Required Tools

1. **Node.js 18+** and npm/bun
   - Install from: https://nodejs.org/
   - Verify: `node --version`

2. **Python 3.8+** and pip
   - Install from: https://www.python.org/
   - Verify: `python --version`

3. **Azure CLI**
   - Install: `winget install -e --id Microsoft.AzureCLI`
   - Verify: `az --version`
   - Login: `az login`

4. **EAS CLI**
   - Install: `npm install -g eas-cli`
   - Verify: `eas --version`

5. **Git**
   - Usually pre-installed on Windows
   - Verify: `git --version`

6. **Microsoft ODBC Driver 18 for SQL Server** ⚠️ **CRITICAL for Phases 2-3**
   - Install: `winget install --id Microsoft.msodbcsql.18 -e`
   - Verify: Open ODBC Data Source Administrator (`odbcad32.exe`) and check the "Drivers" tab for "ODBC Driver 18 for SQL Server"
   - Download link: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
   - **Note**: This driver is required for database operations in Phases 2 (Data Download) and 3 (Data Processing). Without it, database connections will fail with "Data source name not found" error.

7. **PowerShell Yaml Module (Optional but Recommended)**
   - Install: `Install-Module -Name powershell-yaml -Force`

### Azure Prerequisites

- Active Azure subscription
- Contributor role on subscription or resource group
- DNS-compatible naming (for Web Apps)

### Python Dependencies

⚠️ **IMPORTANT**: Install ODBC Driver 18 for SQL Server BEFORE installing Python dependencies. The pyodbc package requires this system-level driver to function properly. See "Required Tools" section above for installation instructions.

The automation script runs these Python tools, which should have their dependencies installed:

- **Data Pipeline**: `data-pipeline/requirements.txt` (required for Phases 2-3)
  - Install: `cd data-pipeline && pip install -r requirements.txt`
  - Includes: polars, pyodbc, azure-storage-file-datalake, yfinance, python-dotenv
- **RL Training**: `rl-training/requirements.txt`
- **Chatbot**: `chatbot/requirements.txt`
- **RL Service**: `rl-service/requirements.txt`

**Before running Phases 2 and 3, ensure data-pipeline dependencies are installed:**
```powershell
cd data-pipeline
pip install -r requirements.txt
```

> 📘 **First-time setup?** See `data-pipeline/SETUP_INSTRUCTIONS.md` for detailed setup instructions, including ODBC driver installation and configuration.

### Node.js Dependencies

- **Frontend**: Run `npm install` in `frontend/`
- **Backend**: Run `npm install` in `backend/`

## Quick Start

### 1. Configure Settings

```powershell
# Copy example configuration
Copy-Item automation_config.example.yaml automation_config.yaml

# Edit with your settings
notepad automation_config.yaml
```

Key settings to configure:

```yaml
azure:
  resource_group: "rg-wealtharena-northcentralus"  # Your resource group
  location: "northcentralus"                         # Azure region
  suffix: "jg1ve2"                                   # Unique suffix

# Skip time-consuming phases if you have existing artifacts
phase_control:
  skip_data_download: false      # Set true if data exists
  skip_rl_training: false        # Set true if models exist
```

### 2. Validate Environment

```powershell
# Run validation script
.\test_automation.ps1
```

Fix any critical issues before proceeding.

### 3. Run Full Automation

```powershell
# Execute master automation script
.\master_automation.ps1
```

This will execute all 11 phases sequentially and save progress along the way.

**Note**: If Phase 3 is taking too long, you can check processed symbols and skip to Phase 4:

```bash
# Check what's been processed
cd data-pipeline
python check_processed_symbols.py

# If all non-ASX symbols are processed, stop Phase 3 and continue:
# Press Ctrl+C to stop Phase 3
# Then run:
.\master_automation.ps1 -StartFromPhase 4
```

## Configuration Guide

### automation_config.yaml

The configuration file controls all aspects of the automation. Key sections:

#### Azure Settings

```yaml
azure:
  resource_group: "rg-wealtharena-northcentralus"  # Must be unique
  location: "northcentralus"                         # Azure region
  suffix: "jg1ve2"                                   # For resource naming
  subscription_id: ""                                # Optional, uses default
```

#### Phase Control

Control which phases to skip:

```yaml
phase_control:
  skip_frontend_test: false      # Skip local frontend testing
  skip_data_download: false      # Skip if data already downloaded
  skip_data_processing: false    # Skip if already processed
  skip_rl_training: false        # Skip if models exist (saves 4-8 hours)
  skip_deployment: false         # Skip Azure deployment
  skip_apk_build: false          # Skip APK build
```

#### Data Pipeline Settings

```yaml
data_pipeline:
  start_date: "2022-01-01"       # Historical data start
  end_date: "2025-01-01"         # Historical data end
  asset_classes:                  # Which asset classes to download
    - asx
    - crypto
    - forex
    - commodities
    - etfs
  batch_size: 80                  # API request batch size
```

#### RL Training Settings

```yaml
rl_training:
  config_file: "config/production_config.yaml"
  max_iterations: 2000           # Training iterations
  target_reward: 500.0           # Early stop if achieved
  num_workers: 4                  # Parallel workers
```

### Common Configuration Scenarios

#### Quick Deployment (30-60 min)

Use when data and models already exist:

```yaml
phase_control:
  skip_data_download: true
  skip_data_processing: true
  skip_rl_training: true
```

#### Testing Only (1-2 hours)

Skip deployment and APK build:

```yaml
phase_control:
  skip_deployment: true
  skip_apk_build: true
```

#### Full Pipeline (8-12 hours)

Run everything from scratch:

```yaml
phase_control:
  skip_frontend_test: false
  skip_data_download: false
  skip_data_processing: false
  skip_rl_training: false
  skip_deployment: false
  skip_apk_build: false
```

## Phase Reference

| Phase | Name | Can Skip? | Prerequisites |
|-------|------|-----------|---------------|
| 1 | Frontend Testing | Yes | Node.js, npm |
| 2 | Data Download | No* | Azure Storage, API keys |
| 3 | Data Processing | Partial** | Downloaded data, SQL DB |
| 4 | Export to RL Training | No | Processed data in DB |
| 5 | RL Model Training | No | Exported CSV files |
| 6 | Azure Infrastructure | No | Azure CLI, credentials |
| 7-11 | Deployment & Testing | No | Trained models, Azure resources |

*Can skip if data already downloaded

**Can stop early if minimum symbols processed (100+ stocks + all non-ASX)

## Phase-by-Phase Breakdown

### Phase 1: Frontend Local Testing

**Duration**: 5-10 minutes

**What it does**:
- Installs Node.js dependencies in `frontend/`
- Starts Expo development server on port 5001
- Verifies server health

**Outputs**:
- Running Expo server
- `node_modules/` directory

**Common Issues**:
- Port 5001 already in use: Close other Expo instances
- npm install fails: Check Node.js version (requires 18+)

**Skipping**: Set `skip_frontend_test: true` in config

### Phase 2: Data Download

**Duration**: 2-4 hours

**What it does**:
- Downloads historical market data for all asset classes
- Saves CSV files in `data-pipeline/data/raw/`
- Generates download summary JSON files

**Outputs**:
- Raw CSV files in `data-pipeline/data/raw/`
- `*_download_summary.json` files

**Common Issues**:
- API rate limits: Adjust `batch_size` in config
- Network timeouts: Check internet connection

**Skipping**: Set `skip_data_download: true` in config

**Manual Execution**:
```powershell
cd data-pipeline
python run_all_downloaders.py
```

### Phase 3: Data Processing

**Duration**: 2-4 hours for ~1,800 symbols (previously 14+ hours, now optimized)

**What it does**:
- Processes raw CSV files
- Calculates technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, etc.)
- Merges and cleans data
- Stores in Azure SQL `processed_prices` table

**Outputs**:
- Processed data in Azure SQL
- `processed_prices` table populated

**Performance Optimizations**:
- **Larger batch size**: 150K rows per insert (increased from 75K)
- **Less frequent merges**: Every 500K rows (increased from 200K)
- **More workers**: 12 parallel workers (increased from 8)
- **Progress tracking**: Real-time updates every 50 files with time estimates
- **Better error handling**: Failed files logged, processing continues

**Progress Monitoring**:
- Watch for progress messages: `[HH:MM:SS] Progress: X/1863 files (Y%) - ~Zm remaining`
- Check log files: `automation_logs/master_automation_*.log`
- Database row counts: Query `SELECT COUNT(*) FROM dbo.processed_prices`

**Common Issues**:
- SQL connection fails: Verify Azure SQL credentials
- Memory errors: Process in smaller batches (adjust `BATCH_ROWS` env var)
- Slow performance: Check Azure SQL region matches your location

**Environment Variables** (optional tuning):
```bash
# In data-pipeline/sqlDB.env or system environment
BATCH_ROWS=150000        # Rows per batch insert (default: 150K)
MERGE_EVERY_ROWS=500000  # Rows before triggering MERGE (default: 500K)
```

**Skipping**: Set `skip_data_processing: true` in config

**Manual Execution**:
```powershell
cd data-pipeline
python processAndStore.py
```

### Phase 4: Data Export for RL Training

**Duration**: 10-20 minutes

**What it does**:
- Exports processed data as CSVs
- Saves to `rl-training/data/processed/`
- Formats for RLlib consumption
- Organizes files by asset class (stocks, crypto, forex, commodities, etfs)

**Outputs**:
- CSV files in `rl-training/data/processed/`

**Path Handling**:
- **Fixed**: Paths with spaces (e.g., "AIP Project Folder") are now properly handled
- Output directory is automatically created if it doesn't exist
- Progress reporting with percentage and time estimates

**Common Issues**:
- "A positional parameter cannot be found": **Fixed** - Paths with spaces are now quoted
- "Directory not found": **Fixed** - Directory structure is auto-created
- "No data found": Run Phase 3 first to populate `processed_prices` table

**Manual Execution**:
```powershell
cd data-pipeline
python export_to_rl_training.py --output-dir ../rl-training/data/processed
```

**Quick Start**: Before running Phase 4, check processed symbols:
```bash
cd data-pipeline
python check_processed_symbols.py
```

This shows what's been processed and identifies any missing non-ASX symbols.

### Phase 5: RL Model Training

**Duration**: 4-8 hours (longest phase)

**What it does**:
- Trains reinforcement learning models
- Saves checkpoints in `rl-training/checkpoints/`
- Monitors training metrics

**Outputs**:
- Model checkpoints in `rl-training/checkpoints/`
- Training logs

**Common Issues**:
- Ray not installed: `pip install ray[rllib]`
- GPU out of memory: Reduce `num_workers`
- Training diverges: Adjust hyperparameters

**Skipping**: Set `skip_rl_training: true` in config

**Manual Execution**:
```powershell
cd rl-training
python train.py --config config/production_config.yaml --experiment wealtharena_production
```

### Phase 6: Azure Resource Verification

**Duration**: 5-10 minutes

**What it does**:
- Verifies Azure CLI authentication
- Checks if resource group exists
- Creates resource group if missing
- Verifies SQL Server and Storage Account existence
- Provisions missing resources via `setup_master.ps1` if needed
- Generates environment configuration file at `infrastructure/azure_infrastructure/.env`

**Outputs**:
- Confirmed Azure resources
- Environment configuration file: `infrastructure/azure_infrastructure/.env`
- Resource names persisted to automation state and config

**Configuration Requirements**:
- `Config.Azure.SubscriptionId` (optional): Azure subscription ID
- `Config.Database.AdminPassword` (required if not provided interactively): SQL Server admin password

**Environment File**:
The setup script creates `.env` file at `infrastructure/azure_infrastructure/.env` containing:
- Azure resource metadata (resource group, location, resource names)
- Connection string references (secrets stored in Key Vault)
- This file is consumed by downstream deployment scripts

**Common Issues**:
- Not logged in: Run `az login`
- Insufficient permissions: Request Contributor role
- Resource group name conflict: Use unique name
- AdminPassword not provided: Set `Config.Database.AdminPassword` in config or provide when prompted

### Phase 7: Service Deployment

**Duration**: 30-40 minutes

**What it does**:
- Deploys backend API to Azure Web App
- Deploys chatbot service to Azure Web App
- Deploys RL service to Azure Web App
- Configures environment variables

**Outputs**:
- Deployed services with URLs
- Configured environment variables

**Common Issues**:
- Deployment fails: Check Azure quotas
- Build errors: Review service logs
- Timeout: Increase timeout in config

**Skipping**: Set `skip_deployment: true` in config

**Manual Execution**:
```powershell
cd infrastructure\azure_deployment
.\deploy_all_services.ps1 -ResourceGroup "your-rg" -Location "northcentralus"
```

### Phase 8: Model Upload

**Duration**: 10-20 minutes

**What it does**:
- Uploads trained model checkpoints
- Stores in Azure Blob Storage
- Makes models available to RL service

**Outputs**:
- Models in Azure Blob Storage

**Common Issues**:
- Upload fails: Check storage account permissions
- Large files: Compress checkpoints first

**Manual Execution**:
```powershell
cd infrastructure\azure_deployment
.\upload_models.ps1
```

### Phase 9: Frontend Configuration Update

**Duration**: 1-2 minutes

**What it does**:
- Creates `frontend/.env.azure`
- Configures service URLs
- Sets deployment environment flag

**Outputs**:
- `.env.azure` file with Azure URLs

**Manual Execution**: Create file manually with service URLs

### Phase 10: End-to-End Testing

**Duration**: 15-30 minutes

**What it does**:
- Runs health checks on all services
- Tests API endpoints
- Validates service connectivity

**Outputs**:
- Test results
- Service health status

**Common Issues**:
- Health checks fail: Verify services are running
- Timeout errors: Increase timeout in config

### Phase 11: APK Build

**Duration**: 20-30 minutes

**What it does**:
- Builds Android APK using EAS CLI
- Uploads to Expo servers
- Returns download link

**Outputs**:
- APK download link
- Build logs

**Common Issues**:
- EAS CLI not authenticated: Run `eas login`
- Build errors: Check `eas.json` configuration
- Quota exceeded: Upgrade Expo plan

**Skipping**: Set `skip_apk_build: true` in config

**Manual Execution**:
```powershell
cd frontend
eas build --platform android --profile production
```

## Advanced Usage

### Resume from Checkpoint

If automation is interrupted or a phase fails, resume from last completed phase:

```powershell
# Resume from last checkpoint
.\master_automation.ps1 -Resume

# Start from specific phase
.\master_automation.ps1 -StartFromPhase 7
```

The automation saves state in `automation_state.json` between phases.

## Stopping Mid-Process and Resuming

### Scenario: Phase 3 Processing Taking Too Long

If Phase 3 (data processing) is taking too long and you want to proceed with available data:

1. **Check what's been processed:**

   ```bash
   cd data-pipeline
   python check_processed_symbols.py
   ```

   This shows:

   - How many symbols processed per asset class
   - First 30 symbols of each type
   - Missing non-ASX symbols (crypto, forex, commodities, ETFs)

2. **Download and process missing non-ASX symbols:**

   ```bash
   python check_processed_symbols.py --download --process
   ```

   This ensures all ~30 non-ASX symbols are processed.

3. **Stop Phase 3 processing:**

   - Press `Ctrl+C` to stop the current processAndStore.py
   - Or close the PowerShell window running master_automation.ps1

4. **Resume from Phase 4:**

   ```powershell
   ./master_automation.ps1 -StartFromPhase 4
   ```

   This skips to export and continues to training.

### What Gets Skipped

When you resume from Phase 4:

- ✓ Uses already processed symbols (e.g., 1177 symbols)
- ✓ Skips remaining ASX stocks (e.g., 736 unprocessed)
- ✓ Exports available data to RL training
- ✓ Trains models on available symbols
- ⊘ Does not re-download or re-process existing data

### Minimum Requirements for Phase 4+

To successfully run from Phase 4 onwards, you need:

- At least 100 processed symbols in database
- All non-ASX symbols processed (crypto, forex, commodities, ETFs)
- Database connection working
- RL training environment set up

### Skip Specific Phases

Override configuration file settings:

```powershell
# Skip data download and training
.\master_automation.ps1 -SkipDataDownload -SkipRLTraining

# Skip APK build
.\master_automation.ps1 -SkipAPKBuild

# Skip everything except deployment
.\master_automation.ps1 -SkipFrontendTest -SkipDataDownload -SkipDataProcessing -SkipRLTraining
```

### Custom Parameters

```powershell
# Use custom resource group and suffix
.\master_automation.ps1 -ResourceGroup "my-rg" -Suffix "abc123"

# Use different configuration file
.\master_automation.ps1 -ConfigFile custom_config.yaml
```

### Dry Run Mode

Preview what will be executed without making changes:

```powershell
.\master_automation.ps1 -DryRun
```

### Quick Deploy Script

For fast redeployments when artifacts already exist:

```powershell
.\quick_deploy.ps1

# Skip APK build
.\quick_deploy.ps1 -SkipAPKBuild

# Deploy to specific environment
.\quick_deploy.ps1 -Environment production
```

## Monitoring and Logs

### Log Files

Logs are stored in `automation_logs/` directory:

- `master_automation_[timestamp].log` - Main automation log
- `automation_state.json` - Phase completion state
- Service-specific logs from each phase

### View Logs

```powershell
# View latest log
Get-Content automation_logs\master_automation_*.log -Tail 50

# Follow log in real-time
Get-Content automation_logs\master_automation_*.log -Wait

# Search for errors
Select-String -Path automation_logs\*.log -Pattern "ERROR"
```

### Automation State

State is saved in `automation_state.json`:

```json
{
  "StartTime": "2025-01-15T10:00:00",
  "CurrentPhase": 7,
  "CompletedPhases": [1, 2, 3, 4, 5, 6],
  "FailedPhases": [],
  "ServiceURLs": {},
  "Artifacts": {}
}
```

## Troubleshooting

### Common Issues

#### 1. Azure CLI Not Authenticated

**Error**: "Not logged in to Azure"

**Solution**:
```powershell
az login
az account list  # Verify subscription
```

#### 2. Python Dependencies Missing

**Error**: "Module not found: ray"

**Solution**:
```powershell
pip install ray[rllib] pandas numpy
# Or install from requirements.txt
pip install -r requirements.txt  # In each service directory
```

#### 3. Node Modules Missing

**Error**: "Cannot find module"

**Solution**:
```powershell
cd frontend
npm install

cd ../backend
npm install
```

#### 4. Azure Resources Don't Exist

**Error**: "Resource group not found"

**Solution**: Run infrastructure setup first:
```powershell
cd infrastructure\azure_deployment
.\automated_azure_setup.ps1
```

Or let automation create resources (Phase 6).

#### 5. Training Fails

**Error**: "RL training failed"

**Solution**: 
- Check Ray installation: `python -c "import ray; print(ray.__version__)"`
- Verify data exists: `ls rl-training/data/processed/`
- Check GPU/memory availability
- Review training logs: `rl-training/logs/`

#### 6. Deployment Fails

**Error**: "Service deployment failed"

**Solution**:
- Verify Azure permissions: `az role assignment list --assignee <your-email>`
- Check quotas: `az quota list --location northcentralus`
- Review deployment logs: Check Azure Portal → App Service → Deployment Logs

#### 7. APK Build Fails

**Error**: "EAS build failed"

**Solution**:
- Authenticate: `eas login`
- Check project: `cd frontend && eas whoami`
- Verify `eas.json` exists
- Upgrade plan if quota exceeded

#### 8. ODBC Driver Missing

**Error**: `pyodbc.InterfaceError: ('IM002', '[IM002] [Microsoft][ODBC Driver Manager] Data source name not found and no default driver specified')`

**Symptoms**: Phase 3 (Data Processing) fails immediately with this error.

**Root Cause**: Microsoft ODBC Driver 18 for SQL Server is not installed on your system.

**Solution**:
1. Install ODBC Driver 18 for SQL Server:
   ```powershell
   winget install --id Microsoft.msodbcsql.18 -e
   ```
   Or download from: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

2. Verify installation:
   - Run `odbcad32.exe` (opens ODBC Data Source Administrator)
   - Check the "Drivers" tab
   - Verify "ODBC Driver 18 for SQL Server" appears in the list

3. Restart your terminal/PowerShell session after installation

4. Verify driver bitness matches Python:
   - Check Python: `python -c "import platform; print(platform.architecture()[0])"`
   - 64-bit Python requires 64-bit ODBC driver
   - 32-bit Python requires 32-bit ODBC driver

**Prevention**: Install the ODBC driver before running Phases 2-3. See "Required Tools" section for details.

#### 9. Phase 4 Path Error with Spaces

**Error**: `A positional parameter cannot be found that accepts argument 'data'`

**Symptoms**: Phase 4 (Data Export) fails immediately when workspace path contains spaces.

**Root Cause**: PowerShell's call operator `&` didn't properly quote arguments containing spaces in the path.

**Solution**: **FIXED** - Paths with spaces are now properly quoted in the updated `master_automation.ps1`. If you're still experiencing issues:

1. Verify you're using the latest version of `master_automation.ps1`
2. Alternative: Use a workspace path without spaces (e.g., `C:\Projects\WealthArena` instead of `C:\Users\PC\Desktop\AIP Project Folder\...`)
3. Manual workaround: Create the directory structure yourself:
   ```powershell
   New-Item -ItemType Directory -Path "rl-training\data\processed" -Force
   ```

#### 10. Phase 3 Too Slow (14+ hours)

**Symptoms**: Phase 3 processing takes more than 6 hours for 1,800 symbols.

**Root Cause**: Suboptimal batch sizes, merge frequency, and worker count.

**Solution**: **OPTIMIZED** - The latest version includes:
- Larger batch size (150K rows, was 75K)
- Less frequent merges (every 500K rows, was 200K)
- More workers (12, was 8)
- Better progress tracking

If still slow, check:
- Azure SQL region proximity (use same region as your machine)
- Network bandwidth to Azure
- Database performance tier
- Consider local SQL Server for development

#### 11. Phase 3 Timeout or Hanging

**Error**: Phase 3 appears to hang with no output.

**Solution**:
- Check the log file: `automation_logs/master_automation_*.log`
- Look for progress messages with timestamps
- Verify database connection is active
- Consider increasing timeout (currently 6 hours suggested)
- Monitor database activity in Azure Portal

#### 12. Phase 3 Taking Too Long

**Problem**: processAndStore.py has been running for hours and only processed 1177 of 1913 symbols.

**Solution**:

1. Check processed symbols: `python check_processed_symbols.py`
2. Verify all non-ASX symbols are processed
3. Stop Phase 3 and resume from Phase 4: `./master_automation.ps1 -StartFromPhase 4`
4. This skips remaining ASX stocks and proceeds with available data

**Why this works**:

- MVP mode only needs 50-100 stocks for training
- 1177 processed symbols is more than enough
- Non-ASX symbols (~30 total) are critical and should all be processed
- Remaining ASX stocks can be processed later if needed

### Error Recovery

#### Identify Failed Phase

Check `automation_state.json`:
```powershell
Get-Content automation_state.json | ConvertFrom-Json | Select-Object CurrentPhase, FailedPhases
```

#### Fix Issues and Resume

1. Identify the failing phase
2. Fix the underlying issue (see Common Issues above)
3. Resume automation:
   ```powershell
   .\master_automation.ps1 -Resume
   ```

#### Start Over

If automation state is corrupted:

```powershell
# Delete state file
Remove-Item automation_state.json

# Start fresh
.\master_automation.ps1
```

### Manual Intervention Points

The automation may require user interaction at:

1. **Azure Login** (Phase 6): First-time Azure login
2. **Resource Creation** (Phase 6): Approving resource creation
3. **EAS Authentication** (Phase 11): EAS CLI login if not authenticated

### Performance Optimization

#### Speed Up Data Download

```yaml
data_pipeline:
  batch_size: 100  # Increase batch size
  # Or reduce date range
  start_date: "2024-01-01"  # Instead of 2022
```

#### Optimize Phase 3 Performance

**Database Connection Options**:
```bash
# In data-pipeline/sqlDB.env
# These optimizations can be added to connection string in dbConnection.py if needed
# Max Pool Size=100          # Larger connection pool
# MultipleActiveResultSets=True  # Allow multiple queries
# Connection Timeout=30      # Handle transient issues
```

**Tune Processing Parameters**:
```bash
# In data-pipeline/sqlDB.env or system environment
BATCH_ROWS=150000        # Increase for faster insertion (default: 150K, was 75K)
MERGE_EVERY_ROWS=750000  # Further increase to reduce merge overhead (default: 500K, was 200K)
```

**Network Optimization**:
- Use Azure SQL Database in the **same region** as your machine
- For development, consider local SQL Server (10x faster)
- Check Azure SQL service tier (DTU/vCores)

#### Speed Up Training

```yaml
rl_training:
  max_iterations: 1000  # Reduce iterations
  num_workers: 8        # More parallel workers
```

#### Reduce Azure Deployment Time

Skip phases not needed:
- Skip data download if data exists
- Skip training if models exist
- Use quick_deploy.ps1 for redeployments

## Output Artifacts

### Files Created

- `automation_logs/master_automation_[timestamp].log` - Execution log
- `automation_state.json` - Phase completion state
- `automation_config.yaml` - Configuration (user-created)
- `frontend/.env.azure` - Frontend Azure configuration

### Deployed Services

After Phase 7, you'll have:

- Backend API: `https://wealtharena-backend.azurewebsites.net`
- Chatbot: `https://wealtharena-chatbot.azurewebsites.net`
- RL Service: `https://wealtharena-rl.azurewebsites.net`

### Model Checkpoints

After Phase 5:

- `rl-training/checkpoints/` - Local checkpoints
- Azure Blob Storage - Uploaded models (after Phase 8)

### APK Build

After Phase 11:

- APK download link from EAS
- Build artifacts in `builds/` (if configured)

## Best Practices

### Before Running

1. **Review Configuration**: Check `automation_config.yaml` settings
2. **Validate Environment**: Run `.\test_automation.ps1`
3. **Backup Existing Data**: Backup important files before running
4. **Monitor Azure Costs**: Keep an eye on resource costs
5. **Run During Off-Peak Hours**: Training phase takes hours

### During Execution

1. **Monitor Logs**: Keep `automation_logs` open in another terminal
2. **Don't Interrupt**: Let phases complete fully
3. **Save Progress**: Script auto-saves after each phase
4. **Check Azure Portal**: Monitor resource provisioning

### After Completion

1. **Verify Services**: Test all deployed services
2. **Download APK**: Save APK download link
3. **Review Logs**: Check for warnings
4. **Document URLs**: Save service URLs for future reference
5. **Clean Up**: Remove old log files periodically

### Version Control

**DO commit**:
- `automation_config.example.yaml`
- `master_automation.ps1`
- `quick_deploy.ps1`
- `test_automation.ps1`
- `README_AUTOMATION.md`

**DON'T commit**:
- `automation_config.yaml` (may contain secrets)
- `automation_logs/`
- `automation_state.json`
- `builds/*.apk`
- `.env.azure`

## Integration with CI/CD

### GitHub Actions

Example workflow:

```yaml
name: WealthArena Deployment
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.8'
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Run Master Automation
        run: .\master_automation.ps1 -ConfigFile automation_config.yaml
      
      - name: Upload Logs
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: automation-logs
          path: automation_logs/
```

### Azure DevOps

Add PowerShell task:

```yaml
- task: PowerShell@2
  displayName: 'Run Master Automation'
  inputs:
    filePath: '$(System.DefaultWorkingDirectory)/master_automation.ps1'
    arguments: '-ConfigFile automation_config.yaml -DryRun false'
```

### Environment Variables in CI/CD

Store secrets securely:

- Azure credentials: Service principal in GitHub Secrets or Azure DevOps Variable Groups
- EAS credentials: `EXPO_TOKEN` environment variable
- Database credentials: Azure Key Vault

## Appendix

### Directory Structure

```
WealthArena_Production/
├── master_automation.ps1           # Main orchestration script
├── quick_deploy.ps1                # Fast deployment script
├── test_automation.ps1             # Environment validation
├── automation_config.example.yaml  # Configuration template
├── automation_config.yaml          # User configuration (gitignored)
├── automation_state.json           # State tracking (gitignored)
├── automation_logs/                # Execution logs (gitignored)
│   └── master_automation_*.log
├── builds/                         # APK artifacts (gitignored)
├── frontend/                       # React Native app
├── backend/                        # Express API
├── chatbot/                        # FastAPI chatbot
├── rl-service/                     # Flask RL service
├── rl-training/                    # Ray RLlib training
├── data-pipeline/                  # Market data downloaders
└── infrastructure/                 # Deployment scripts
```

### Environment Variable Reference

#### Frontend (.env.azure)

```env
EXPO_PUBLIC_DEPLOYMENT_ENV=azure
EXPO_PUBLIC_BACKEND_URL=https://wealtharena-backend.azurewebsites.net
EXPO_PUBLIC_CHATBOT_URL=https://wealtharena-chatbot.azurewebsites.net
EXPO_PUBLIC_RL_SERVICE_URL=https://wealtharena-rl.azurewebsites.net
```

#### Azure Service Configuration

Configured via deployment scripts:
- Connection strings
- API keys
- GROQ credentials
- Storage account keys

### Azure Resource Naming Conventions

- Resource Group: `rg-wealtharena-{location}`
- Web Apps: `wealtharena-backend`, `wealtharena-chatbot`, `wealtharena-rl`
- Storage: `stwealtharena{suffix}`
- SQL: `sql-wealtharena-{suffix}`
- Key Vault: `kv-wealtharena-{suffix}`

### Useful Azure CLI Commands

```powershell
# List resource groups
az group list

# Show resource group
az group show --name rg-wealtharena-northcentralus

# List web apps
az webapp list --resource-group rg-wealtharena-northcentralus

# Show app logs
az webapp log tail --name wealtharena-backend --resource-group rg-wealtharena-northcentralus

# Delete resource group (careful!)
az group delete --name rg-wealtharena-northcentralus --yes
```

### Useful PowerShell Commands

```powershell
# Check PowerShell version
$PSVersionTable.PSVersion

# Check Azure login
az account show

# List Python packages
pip list

# Check Node version
node --version

# Find listening ports
Get-NetTCPConnection -State Listen | Select-Object LocalPort

# Kill process by port
Get-NetTCPConnection -LocalPort 5001 | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

### Script Reference

All scripts in the automation system:

1. **master_automation.ps1** - Main orchestration (this runs everything)
2. **quick_deploy.ps1** - Fast deployment script
3. **test_automation.ps1** - Environment validation
4. **data-pipeline/run_all_downloaders.py** - Downloads all market data
5. **data-pipeline/processAndStore.py** - Processes and stores data
6. **data-pipeline/export_to_rl_training.py** - Exports for training
7. **rl-training/train.py** - Training entry point
8. **infrastructure/azure_deployment/deploy_all_services.ps1** - Deploys services
9. **infrastructure/azure_deployment/upload_models.ps1** - Uploads models
10. **infrastructure/azure_deployment/automated_azure_setup.ps1** - Infrastructure setup

## Support

For issues or questions:

1. Check this README first
2. Review logs in `automation_logs/`
3. Run `test_automation.ps1` to diagnose issues
4. Check DEPLOYMENT_CHECKLIST.md for manual steps
5. Review service-specific README files

## License

MIT

