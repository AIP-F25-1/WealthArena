#Requires -Version 5.1

<#
.SYNOPSIS
    WealthArena Automation Environment Validation Script
    
.DESCRIPTION
    Quickly validates that the automation environment is properly configured
    before running the full automation pipeline.
    
.PARAMETER CheckCategory
    Specific check category to run (System, Tools, Azure, Python, Node, Config, AzureResources, Structure)
    
.PARAMETER SkipAzureChecks
    Skip Azure resource verification checks
    
.PARAMETER Verbose
    Show detailed check output
    
.EXAMPLE
    .\test_automation.ps1
    
.EXAMPLE
    .\test_automation.ps1 -CheckCategory Tools
    
.EXAMPLE
    .\test_automation.ps1 -SkipAzureChecks
#>

param(
    [string]$CheckCategory = "All",
    [switch]$SkipAzureChecks = $false,
    [switch]$Verbose = $false
)

# Colors
$script:Green = "Green"
$script:Red = "Red"
$script:Yellow = "Yellow"
$script:Blue = "Blue"
$script:Cyan = "Cyan"
$script:White = "White"

# Results tracking
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0
$script:Issues = @()
$script:WarningsList = @()

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-SectionHeader {
    param([string]$Message)
    Write-Host ""
    Write-ColorOutput "========================================" $Cyan
    Write-ColorOutput $Message $Cyan
    Write-ColorOutput "========================================" $Cyan
    Write-Host ""
}

function Add-Result {
    param([string]$CheckName, [bool]$Passed, [string]$Message, [bool]$IsWarning = $false)
    
    if ($Passed) {
        Write-ColorOutput "✅ $CheckName" $Green
        $script:Passed++
        if ($Verbose) {
            Write-ColorOutput "   $Message" $Green
        }
    }
    elseif ($IsWarning) {
        Write-ColorOutput "⚠️  $CheckName" $Yellow
        $script:Warnings++
        $script:WarningsList += "${CheckName}: $Message"
        if ($Verbose) {
            Write-ColorOutput "   $Message" $Yellow
        }
    }
    else {
        Write-ColorOutput "❌ $CheckName" $Red
        $script:Failed++
        $script:Issues += "${CheckName}: $Message"
        if ($Verbose) {
            Write-ColorOutput "   $Message" $Red
        }
    }
}

function Test-SystemRequirements {
    Write-SectionHeader "System Requirements"
    
    # PowerShell version
    Add-Result -CheckName "PowerShell Version" -Passed ($PSVersionTable.PSVersion.Major -ge 5) `
        -Message "Current: $($PSVersionTable.PSVersion). Required: 5.1+"
    
    # Windows version
    $osInfo = Get-CimInstance Win32_OperatingSystem
    Add-Result -CheckName "Windows Version" -Passed ($osInfo.Version -ge 10.0) `
        -Message "Current: $($osInfo.Caption) Build $($osInfo.BuildNumber)"
    
    # Disk space
    $disk = Get-PSDrive C
    $freeGB = [math]::Round($disk.Free / 1GB, 2)
    $hasSpace = $freeGB -ge 10
    Add-Result -CheckName "Disk Space (C:\)" -Passed $hasSpace `
        -Message "Available: ${freeGB}GB. Required: 10GB+" -IsWarning:$(!$hasSpace)
    
    # Memory
    $totalMemory = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
    $hasEnoughRAM = $totalMemory -ge 8
    Add-Result -CheckName "RAM" -Passed $hasEnoughRAM `
        -Message "Total: ${totalMemory}GB. Recommended: 8GB+, Training: 16GB+" -IsWarning:$(!$hasEnoughRAM)
}

function Test-RequiredTools {
    Write-SectionHeader "Required Tools"
    
    # Node.js
    try {
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $versionMatch = $nodeVersion -match "v(\d+)\."
            if ($versionMatch) {
                $majorVersion = [int]$matches[1]
                Add-Result -CheckName "Node.js" -Passed ($majorVersion -ge 18) `
                    -Message "$nodeVersion (Required: 18+)"
            }
        }
    }
    catch {
        Add-Result -CheckName "Node.js" -Passed $false -Message "Not installed. Download from nodejs.org"
    }
    
    # npm
    try {
        $npmVersion = npm --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Add-Result -CheckName "npm" -Passed $true -Message "v$npmVersion"
        }
        else {
            Add-Result -CheckName "npm" -Passed $false -Message "Not installed"
        }
    }
    catch {
        Add-Result -CheckName "npm" -Passed $false -Message "Not installed"
    }
    
    # bun (optional)
    try {
        $bunVersion = bun --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Add-Result -CheckName "bun" -Passed $true -Message "v$bunVersion"
        }
    }
    catch {
        Add-Result -CheckName "bun" -Passed $false `
            -Message "Not installed (optional)" -IsWarning $true
    }
    
    # Python
    try {
        $pythonVersion = python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $versionMatch = $pythonVersion -match "Python (\d+)\.(\d+)"
            if ($versionMatch) {
                $majorVersion = [int]$matches[1]
                $minorVersion = [int]$matches[2]
                $isValidVersion = ($majorVersion -eq 3 -and $minorVersion -ge 8) -or $majorVersion -gt 3
                Add-Result -CheckName "Python" -Passed $isValidVersion `
                    -Message "$pythonVersion (Required: 3.8+)"
            }
            else {
                Add-Result -CheckName "Python" -Passed $false -Message "Could not parse version"
            }
        }
        else {
            Add-Result -CheckName "Python" -Passed $false -Message "Not installed. Download from python.org"
        }
    }
    catch {
        Add-Result -CheckName "Python" -Passed $false -Message "Not installed. Download from python.org"
    }
    
    # pip
    try {
        $pipVersion = pip --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Add-Result -CheckName "pip" -Passed $true -Message "Installed"
        }
        else {
            Add-Result -CheckName "pip" -Passed $false -Message "Not installed"
        }
    }
    catch {
        Add-Result -CheckName "pip" -Passed $false -Message "Not installed"
    }
    
    # Azure CLI
    try {
        $azVersion = az --version 2>&1 | Select-Object -First 1
        Add-Result -CheckName "Azure CLI" -Passed $true -Message $azVersion
    }
    catch {
        Add-Result -CheckName "Azure CLI" -Passed $false `
            -Message "Not installed. Install with: winget install Microsoft.AzureCLI"
    }
    
    # EAS CLI
    try {
        $easVersion = eas --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Add-Result -CheckName "EAS CLI" -Passed $true -Message "v$easVersion"
        }
        else {
            Add-Result -CheckName "EAS CLI" -Passed $false `
                -Message "Not installed. Install with: npm install -g eas-cli"
        }
    }
    catch {
        Add-Result -CheckName "EAS CLI" -Passed $false `
            -Message "Not installed. Install with: npm install -g eas-cli"
    }
    
    # Git
    try {
        $gitVersion = git --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Add-Result -CheckName "Git" -Passed $true -Message $gitVersion
        }
        else {
            Add-Result -CheckName "Git" -Passed $false -Message "Not installed"
        }
    }
    catch {
        Add-Result -CheckName "Git" -Passed $false -Message "Not installed"
    }
}

function Test-AzureAuthentication {
    Write-SectionHeader "Azure Authentication"
    
    # Check if logged in
    try {
        $account = az account show --output json 2>&1 | ConvertFrom-Json
        if ($account) {
            Add-Result -CheckName "Azure Login" -Passed $true -Message "Logged in as: $($account.user.name)"
            
            # Check subscription
            Add-Result -CheckName "Azure Subscription" -Passed $true `
                -Message "Subscription: $($account.name) (ID: $($account.id))"
            
            # Check permissions (basic check)
            try {
                $rgList = az group list --output json 2>&1 | ConvertFrom-Json
                Add-Result -CheckName "Azure Permissions" -Passed $true `
                    -Message "Can list resource groups"
            }
            catch {
                Add-Result -CheckName "Azure Permissions" -Passed $false `
                    -Message "Cannot access Azure resources. Check permissions."
            }
        }
        else {
            Add-Result -CheckName "Azure Login" -Passed $false -Message "Not logged in. Run: az login"
        }
    }
    catch {
        Add-Result -CheckName "Azure Login" -Passed $false -Message "Not logged in. Run: az login"
    }
}

function Test-PythonDependencies {
    Write-SectionHeader "Python Dependencies"
    
    $services = @(
        @{ Name = "data-pipeline"; Required = $true },
        @{ Name = "rl-training"; Required = $true },
        @{ Name = "chatbot"; Required = $true },
        @{ Name = "rl-service"; Required = $true }
    )
    
    foreach ($service in $services) {
        $reqFile = Join-Path (Join-Path $script:ScriptDir $service.Name) "requirements.txt"
        if (Test-Path $reqFile) {
            Add-Result -CheckName "$($service.Name) requirements.txt" -Passed $true `
                -Message "Found requirements.txt"
        }
        elseif ($service.Required) {
            Add-Result -CheckName "$($service.Name) requirements.txt" -Passed $false `
                -Message "requirements.txt not found"
        }
    }
    
    # Check key packages
    $keyPackages = @("pandas", "ray", "fastapi", "flask")
    foreach ($package in $keyPackages) {
        try {
            $result = python -c "import $package; print($package.__version__)" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Add-Result -CheckName "Python Package: $package" -Passed $true `
                    -Message "Installed"
            }
            else {
                Add-Result -CheckName "Python Package: $package" -Passed $false `
                    -Message "Not installed. Run: pip install $package" -IsWarning $true
            }
        }
        catch {
            Add-Result -CheckName "Python Package: $package" -Passed $false `
                -Message "Could not check. Run: pip install $package" -IsWarning $true
        }
    }
}

function Test-NodeDependencies {
    Write-SectionHeader "Node.js Dependencies"
    
    $projects = @(
        @{ Name = "frontend"; Required = $true },
        @{ Name = "backend"; Required = $true }
    )
    
    foreach ($project in $projects) {
        $projectDir = Join-Path $script:ScriptDir $project.Name
        $packageJson = Join-Path $projectDir "package.json"
        $nodeModules = Join-Path $projectDir "node_modules"
        
        if (Test-Path $packageJson) {
            Add-Result -CheckName "$($project.Name) package.json" -Passed $true `
                -Message "Found package.json"
            
            if (Test-Path $nodeModules) {
                $moduleCount = (Get-ChildItem $nodeModules -Directory).Count
                Add-Result -CheckName "$($project.Name) node_modules" -Passed ($moduleCount -gt 0) `
                    -Message "$moduleCount packages installed"
            }
            else {
                Add-Result -CheckName "$($project.Name) node_modules" -Passed $false `
                    -Message "Not installed. Run: npm install" -IsWarning $true
            }
        }
        elseif ($project.Required) {
            Add-Result -CheckName "$($project.Name) package.json" -Passed $false `
                -Message "package.json not found"
        }
    }
}

function Test-ConfigurationFiles {
    Write-SectionHeader "Configuration Files"
    
    $configFile = Join-Path $script:ScriptDir "automation_config.yaml"
    if (Test-Path $configFile) {
        Add-Result -CheckName "automation_config.yaml" -Passed $true -Message "Found"
        
        # Check if critical phases are skipped
        try {
            $configContent = Get-Content $configFile -Raw
            $skipDataProcessing = $false
            if ($configContent -match 'skip_data_processing:\s*(true|yes|1)') {
                $skipDataProcessing = $true
            }
            if (-not $skipDataProcessing) {
                Add-Result -CheckName "automation_config.yaml: Phase 3 not skipped" -Passed $true `
                    -Message "Data processing phase enabled"
            }
        }
        catch {
            # Ignore parsing errors
        }
    }
    else {
        $exampleFile = Join-Path $script:ScriptDir "automation_config.example.yaml"
        if (Test-Path $exampleFile) {
            Add-Result -CheckName "automation_config.yaml" -Passed $false `
                -Message "Not found. Copy from automation_config.example.yaml" -IsWarning $true
        }
        else {
            Add-Result -CheckName "automation_config.yaml" -Passed $false `
                -Message "Configuration files not found"
        }
    }
    
    # Check .env.example files
    $envExamples = @(
        "frontend/.env.example",
        "backend/.env.example",
        "chatbot/.env.example",
        "rl-service/.env.example"
    )
    
    foreach ($envExample in $envExamples) {
        $envPath = Join-Path $script:ScriptDir $envExample
        if (Test-Path $envPath) {
            Add-Result -CheckName "$envExample" -Passed $true -Message "Found"
        }
        else {
            Add-Result -CheckName "$envExample" -Passed $false `
                -Message "Not found" -IsWarning $true
        }
    }
}

function Test-ODBCDriverAndSQLConfig {
    Write-SectionHeader "ODBC Driver and SQL Configuration"
    
    # Check ODBC Driver 18 availability
    try {
        $driversOutput = python -c "import pyodbc; print('\n'.join(pyodbc.drivers()))" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $drivers = $driversOutput -split "`n" | Where-Object { $_ -match "ODBC Driver" }
            $driver18Found = $false
            foreach ($driver in $drivers) {
                if ($driver -match "ODBC Driver 18 for SQL Server") {
                    $driver18Found = $true
                    break
                }
            }
            
            if ($driver18Found) {
                Add-Result -CheckName "ODBC Driver 18 for SQL Server" -Passed $true `
                    -Message "Driver found in pyodbc.drivers()"
            }
            else {
                Add-Result -CheckName "ODBC Driver 18 for SQL Server" -Passed $false `
                    -Message "Driver not found. Install Microsoft ODBC Driver 18 for SQL Server (ensure bitness matches Python interpreter)"
            }
            
            if ($Verbose) {
                Write-ColorOutput "   Available drivers: $($drivers -join ', ')" $Blue
            }
        }
        else {
            Add-Result -CheckName "ODBC Driver Check" -Passed $false `
                -Message "Could not check ODBC drivers. Is pyodbc installed?"
        }
    }
    catch {
        Add-Result -CheckName "ODBC Driver Check" -Passed $false `
            -Message "Error checking drivers: $_"
    }
    
    # Check sqlDB.env configuration
    $sqlEnvPath = Join-Path $script:ScriptDir "data-pipeline\sqlDB.env"
    if (Test-Path $sqlEnvPath) {
        Add-Result -CheckName "sqlDB.env file" -Passed $true -Message "Found"
        
        try {
            $envContent = Get-Content $sqlEnvPath -Raw
            $requiredVars = @("SQL_SERVER", "SQL_DB", "SQL_UID", "SQL_PWD")
            $placeholders = @("your-sql-server", "your_database", "your_username", "your_password")
            
            foreach ($var in $requiredVars) {
                if ($envContent -match "$var=([^`n`r]+)") {
                    $value = $matches[1].Trim()
                    $isPlaceholder = $false
                    foreach ($placeholder in $placeholders) {
                        if ($value -match $placeholder) {
                            $isPlaceholder = $true
                            break
                        }
                    }
                    
                    if ($isPlaceholder -or [string]::IsNullOrWhiteSpace($value)) {
                        Add-Result -CheckName "sqlDB.env: $var" -Passed $false `
                            -Message "Contains placeholder or empty value. Update with real credentials."
                    }
                    else {
                        Add-Result -CheckName "sqlDB.env: $var" -Passed $true `
                            -Message "Configured (value masked for security)"
                    }
                }
                else {
                    Add-Result -CheckName "sqlDB.env: $var" -Passed $false `
                        -Message "Variable not found in sqlDB.env"
                }
            }
        }
        catch {
            Add-Result -CheckName "sqlDB.env parsing" -Passed $false `
                -Message "Error parsing sqlDB.env: $_"
        }
    }
    else {
        $examplePath = Join-Path $script:ScriptDir "data-pipeline\sqlDB.env.example"
        if (Test-Path $examplePath) {
            Add-Result -CheckName "sqlDB.env file" -Passed $false `
                -Message "Not found. Copy from data-pipeline\sqlDB.env.example and configure"
        }
        else {
            Add-Result -CheckName "sqlDB.env file" -Passed $false `
                -Message "sqlDB.env not found and example file missing"
        }
    }
    
    # Check automation_config.yaml if Phase 3 is not skipped
    $configFile = Join-Path $script:ScriptDir "automation_config.yaml"
    if (-not (Test-Path $configFile)) {
        # Warn if config is missing and Phase 3 is likely to run
        Add-Result -CheckName "automation_config.yaml: Phase 3 validation" -Passed $false `
            -Message "Config file missing. Phase 3 (data processing) requires automation_config.yaml or explicit skip flag" -IsWarning $true
    }
}

function Test-AzureResources {
    if ($SkipAzureChecks) {
        Write-SectionHeader "Azure Resources (Skipped)"
        Write-ColorOutput "Azure resource checks skipped as requested." $Yellow
        return
    }
    
    Write-SectionHeader "Azure Resources"
    
    # Try to get default resource group from config
    $rgName = "rg-wealtharena-northcentralus"
    $configFile = Join-Path $script:ScriptDir "automation_config.yaml"
    if (Test-Path $configFile) {
        try {
            $configContent = Get-Content $configFile -Raw
            if ($configContent -match 'resource_group:\s*"([^"]*)"') {
                $rgName = $matches[1]
            }
        }
        catch {
            Write-ColorOutput "Could not read config file" $Yellow
        }
    }
    
    Write-ColorOutput "Checking resource group: $rgName" $Blue
    
    try {
        $rgExists = az group show --name $rgName --output json 2>&1 | ConvertFrom-Json
        if ($rgExists) {
            Add-Result -CheckName "Resource Group" -Passed $true `
                -Message "$rgName exists in $($rgExists.location)"
            
            # Check SQL Server
            $sqlServers = az sql server list --resource-group $rgName --output json 2>&1 | ConvertFrom-Json
            if ($sqlServers -and $sqlServers.Count -gt 0) {
                Add-Result -CheckName "SQL Server" -Passed $true `
                    -Message "Found: $($sqlServers[0].name)"
            }
            else {
                Add-Result -CheckName "SQL Server" -Passed $false `
                    -Message "Not found. Run infrastructure setup." -IsWarning $true
            }
            
            # Check Storage Account
            $storageAccounts = az storage account list --resource-group $rgName --output json 2>&1 | ConvertFrom-Json
            if ($storageAccounts -and $storageAccounts.Count -gt 0) {
                Add-Result -CheckName "Storage Account" -Passed $true `
                    -Message "Found: $($storageAccounts[0].name)"
            }
            else {
                Add-Result -CheckName "Storage Account" -Passed $false `
                    -Message "Not found. Run infrastructure setup." -IsWarning $true
            }
            
            # Check Web Apps
            $webApps = az webapp list --resource-group $rgName --output json 2>&1 | ConvertFrom-Json
            if ($webApps -and $webApps.Count -gt 0) {
                Add-Result -CheckName "Web Apps" -Passed $true `
                    -Message "Found $($webApps.Count) Web Apps"
            }
            else {
                Add-Result -CheckName "Web Apps" -Passed $false `
                    -Message "Not found. Will be created during deployment." -IsWarning $true
            }
        }
        else {
            Add-Result -CheckName "Resource Group" -Passed $false `
                -Message "$rgName not found. Run infrastructure setup or automation will create it." -IsWarning $true
        }
    }
    catch {
        Add-Result -CheckName "Resource Group" -Passed $false `
            -Message "Could not check: $_" -IsWarning $true
    }
}

function Test-DirectoryStructure {
    Write-SectionHeader "Directory Structure"
    
    $requiredDirs = @(
        "frontend",
        "backend",
        "chatbot",
        "rl-service",
        "rl-training",
        "data-pipeline",
        "infrastructure/azure_deployment",
        "database"
    )
    
    foreach ($dir in $requiredDirs) {
        $dirPath = Join-Path $script:ScriptDir $dir
        if (Test-Path $dirPath) {
            Add-Result -CheckName "Directory: $dir" -Passed $true -Message "Exists"
        }
        else {
            Add-Result -CheckName "Directory: $dir" -Passed $false -Message "Not found"
        }
    }
    
    # Check for key files
    $keyFiles = @(
        "master_automation.ps1",
        "quick_deploy.ps1",
        "test_automation.ps1"
    )
    
    foreach ($file in $keyFiles) {
        $filePath = Join-Path $script:ScriptDir $file
        if (Test-Path $filePath) {
            Add-Result -CheckName "File: $file" -Passed $true -Message "Exists"
        }
        else {
            Add-Result -CheckName "File: $file" -Passed $false -Message "Not found"
        }
    }
}

function Show-Summary {
    Write-Host ""
    Write-SectionHeader "Summary"
    
    $total = $script:Passed + $script:Failed + $script:Warnings
    
    Write-ColorOutput "Total Checks: $total" $White
    Write-ColorOutput "  ✅ Passed: $script:Passed" $Green
    Write-ColorOutput "  ⚠️  Warnings: $script:Warnings" $Yellow
    Write-ColorOutput "  ❌ Failed: $script:Failed" $Red
    Write-Host ""
    
    # Calculate readiness
    $readiness = [math]::Round(($script:Passed / $total) * 100, 1)
    Write-ColorOutput "Readiness: ${readiness}%" $White
    Write-Host ""
    
    if ($script:Issues.Count -gt 0) {
        Write-ColorOutput "Critical Issues:" $Red
        foreach ($issue in $script:Issues) {
            Write-ColorOutput "  - $issue" $Red
        }
        Write-Host ""
    }
    
    if ($script:WarningsList.Count -gt 0) {
        Write-ColorOutput "Warnings:" $Yellow
        foreach ($warning in $script:WarningsList) {
            Write-ColorOutput "  - $warning" $Yellow
        }
        Write-Host ""
    }
    
    # Final recommendation
    if ($script:Failed -eq 0) {
        if ($script:Warnings -eq 0) {
            Write-ColorOutput "✅ All checks passed! Ready to run automation." $Green
            $exitCode = 0
        }
        else {
            Write-ColorOutput "⚠️  Ready to proceed with warnings." $Yellow
            Write-ColorOutput "Review warnings above and run automation when ready." $Yellow
            $exitCode = 2
        }
    }
    else {
        Write-ColorOutput "❌ Critical issues found. Cannot run automation." $Red
        Write-ColorOutput "Please fix the issues above before proceeding." $Red
        $exitCode = 1
    }
    
    Write-Host ""
    return $exitCode
}

# Main
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Environment Validation" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-Host ""

switch ($CheckCategory.ToLower()) {
    "system" {
        Test-SystemRequirements
    }
    "tools" {
        Test-RequiredTools
    }
    "azure" {
        Test-AzureAuthentication
    }
    "python" {
        Test-PythonDependencies
    }
    "odbc" {
        Test-ODBCDriverAndSQLConfig
    }
    "node" {
        Test-NodeDependencies
    }
    "config" {
        Test-ConfigurationFiles
        Test-ODBCDriverAndSQLConfig
    }
    "azureresources" {
        if (-not $SkipAzureChecks) {
            Test-AzureResources
        }
    }
    "structure" {
        Test-DirectoryStructure
    }
    default {
        Test-SystemRequirements
        Test-RequiredTools
        Test-AzureAuthentication
        Test-PythonDependencies
        Test-NodeDependencies
        Test-ConfigurationFiles
        Test-ODBCDriverAndSQLConfig
        if (-not $SkipAzureChecks) {
            Test-AzureResources
        }
        Test-DirectoryStructure
    }
}

$exitCode = Show-Summary
exit $exitCode

