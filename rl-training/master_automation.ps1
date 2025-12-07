# ==================================================================================================
# File: master_automation.ps1
# Author: Clifford Addison
# Company: WealthArena
# Year: 2025
# Description: End-to-end automation for RL trading system pipeline
# Version: 1.0.0
# Last Updated: 2025-11-08T20:36:00Z
# ==================================================================================================

[CmdletBinding()]
param(
    [int[]] $SkipPhase = @(),
    [switch] $ForceRerun,
    [switch] $DryRun,
    [switch] $Resume
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --------------------------------------
# Global Paths and Configuration
# --------------------------------------
$Script:AutomationRoot     = Join-Path -Path $PSScriptRoot -ChildPath 'automation'
$Script:ModuleDirectory    = Join-Path -Path $AutomationRoot -ChildPath 'modules'
$Script:HelpersDirectory   = Join-Path -Path $AutomationRoot -ChildPath 'helpers'
$Script:ConfigDirectory    = Join-Path -Path $AutomationRoot -ChildPath 'config'
$Script:CheckpointDirectory= Join-Path -Path $AutomationRoot -ChildPath 'checkpoints'
$Script:LogsDirectory      = Join-Path -Path $AutomationRoot -ChildPath 'logs'
$Script:MetricsDirectory   = Join-Path -Path $AutomationRoot -ChildPath 'metrics'
$Script:ReportsDirectory   = Join-Path -Path $AutomationRoot -ChildPath 'reports'
$Script:ConfigFile         = Join-Path -Path $ConfigDirectory -ChildPath 'automation_config.json'
$Script:PhaseDefinitions   = Join-Path -Path $AutomationRoot -ChildPath 'phase_definitions.json'
$Script:AutomationLog      = Join-Path -Path $LogsDirectory -ChildPath 'automation_log.txt'
$Script:AutomationErrorLog = Join-Path -Path $LogsDirectory -ChildPath 'automation_errors.txt'
$Script:CheckpointBackup   = Join-Path -Path $CheckpointDirectory -ChildPath 'backup'
$Script:EnvTemplatePath    = Join-Path -Path $PSScriptRoot -ChildPath '.env.template'
$Script:EnvFilePath        = Join-Path -Path $PSScriptRoot -ChildPath '.env'
$Script:ConfigurationData  = $null
$Script:ExecutionSettings  = $null
$Script:GitSettings        = $null
$Script:NotebookSettings   = $null
$Script:SonarSettings      = $null
$Script:SetupDependenciesVerified = $false
$Script:AssetValidationRules = @{
    "scripts/collect_stocks.py"      = "stocks"
    "scripts/collect_forex.py"       = "forex"
    "scripts/collect_crypto.py"      = "crypto"
    "scripts/collect_etfs.py"        = "etfs"
    "scripts/collect_commodities.py" = "commodities"
    "scripts/collect_options.py"     = "options"
    "scripts/collect_news.py"        = "news"
    "scripts/collect_social.py"      = "social"
    "scripts/collect_macro.py"       = "macro"
}

# Ensure module directory is in PSModulePath for dot sourcing
$env:PSModulePath = ($ModuleDirectory + [System.IO.Path]::PathSeparator + $env:PSModulePath)

# --------------------------------------
# Logging Functions
# --------------------------------------
function Write-Log {
    param(
        [Parameter(Mandatory = $true)][string] $Message,
        [ValidateSet('INFO','WARN','ERROR','DEBUG')] [string] $Level = 'INFO'
    )

    $timestamp = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $entry = "[{0}] [{1}] {2}" -f $timestamp, $Level, $Message
    $attempt = 0
    $maxAttempts = 5
    while ($true) {
        try {
            Add-Content -Path $AutomationLog -Value $entry
            break
        }
        catch [System.IO.IOException] {
            $attempt++
            if ($attempt -ge $maxAttempts) {
                throw
            }
            Start-Sleep -Milliseconds 200
        }
    }

    if ($Level -in @('INFO', 'WARN', 'ERROR')) {
        $color = switch ($Level) {
            'ERROR' { 'Red' }
            'WARN'  { 'Yellow' }
            default { 'Green' }
        }
        Write-Host -ForegroundColor $color $entry
    }
}

function Write-ErrorLog {
    param(
        [Parameter(Mandatory = $true)][string] $Message,
        [System.Exception] $Exception = $null
    )

    $timestamp = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $entry = "[{0}] [ERROR] {1}" -f $timestamp, $Message
    $lines = @($entry)
    if ($Exception) {
        $lines += "Exception Type: {0}" -f $Exception.GetType().FullName
        $lines += "Exception Message: {0}" -f $Exception.Message
        $lines += "Stack Trace:`n{0}" -f $Exception.StackTrace
    }
    $payload = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
    $attempt = 0
    $maxAttempts = 5
    while ($true) {
        try {
            Add-Content -Path $AutomationErrorLog -Value $payload
            break
        }
        catch [System.IO.IOException] {
            $attempt++
            if ($attempt -ge $maxAttempts) {
                throw
            }
            Start-Sleep -Milliseconds 200
        }
    }
}

# --------------------------------------
# Utility Functions
# --------------------------------------
function Join-Arguments {
    param(
        [Parameter(Mandatory = $true)][object[]] $Args
    )

    $parts = @()
    foreach ($arg in $Args) {
        if ($null -eq $arg) { continue }
        $s = [string]$arg
        if ($s -match '[\s"`]') {
            $parts += ('"' + ($s -replace '"','\"') + '"')
        }
        else {
            $parts += $s
        }
    }
    return ($parts -join ' ')
}

function Get-BronzeAssetFileCount {
    param(
        [Parameter(Mandatory = $true)][string] $AssetType
    )

    $bronzeRoot = Join-Path -Path $PSScriptRoot -ChildPath 'data/bronze'
    $assetPath = Join-Path -Path $bronzeRoot -ChildPath $AssetType
    if (-not (Test-Path $assetPath)) {
        return 0
    }

    try {
        $files = Get-ChildItem -Path $assetPath -Recurse -File -ErrorAction Stop
        if ($null -eq $files) {
            return 0
        }
        # Use Measure-Object to reliably get count regardless of single item or array
        return ($files | Measure-Object).Count
    }
    catch {
        Write-Log -Message ("Failed to inspect Bronze directory {0}: {1}" -f $assetPath, $_.Exception.Message) -Level 'WARN'
        return 0
    }
}

function Test-BronzeAssetPopulated {
    param(
        [Parameter(Mandatory = $true)][string] $AssetType
    )

    return (Get-BronzeAssetFileCount -AssetType $AssetType) -gt 0
}

function Initialize-Directories {
    param ()
    $directories = @(
        $AutomationRoot,
        $ModuleDirectory,
        $HelpersDirectory,
        $ConfigDirectory,
        $CheckpointDirectory,
        $LogsDirectory,
        $MetricsDirectory,
        $ReportsDirectory,
        $CheckpointBackup,
        (Join-Path -Path $PSScriptRoot -ChildPath 'data'),
        (Join-Path -Path $PSScriptRoot -ChildPath 'data/bronze'),
        (Join-Path -Path $PSScriptRoot -ChildPath 'data/silver'),
        (Join-Path -Path $PSScriptRoot -ChildPath 'data/gold'),
        (Join-Path -Path $PSScriptRoot -ChildPath 'data/catalog'),
        (Join-Path -Path $PSScriptRoot -ChildPath 'data/audit'),
        (Join-Path -Path $PSScriptRoot -ChildPath 'logs'),
        (Join-Path -Path $PSScriptRoot -ChildPath 'experiments'),
        (Join-Path -Path $PSScriptRoot -ChildPath 'results')
    )

    foreach ($path in $directories) {
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path | Out-Null
        }
    }
}

function Import-ApiKeysFromConfig {
    param ()
    $candidateFiles = @(
        (Join-Path -Path $ConfigDirectory -ChildPath 'api_keys.local.json'),
        (Join-Path -Path $ConfigDirectory -ChildPath 'api_keys.json')
    )

    foreach ($file in $candidateFiles) {
        if (-not (Test-Path $file)) {
            continue
        }

        try {
            $raw = Get-Content -Path $file -Raw
            if (-not $raw) {
                continue
            }
            $secrets = $raw | ConvertFrom-Json
        }
        catch {
            Write-Log -Message ("Failed to parse API key configuration {0}: {1}" -f $file, $_.Exception.Message) -Level 'WARN'
            continue
        }

        foreach ($property in $secrets.PSObject.Properties) {
            $name = $property.Name
            $value = [string]$property.Value
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                Set-Item -Path Env:$name -Value $value
            }
        }

        Write-Log -Message ("Loaded API credentials from {0}" -f $file)
        break
    }

    if (-not [string]::IsNullOrWhiteSpace($LogsDirectory)) {
        Set-Item -Path Env:AUTOMATION_LOGS_DIR -Value $LogsDirectory
    }
}

function Test-GitInstalled {
    [CmdletBinding()]
    param ()

    $gitCommand = Get-Command 'git' -ErrorAction SilentlyContinue
    if (-not $gitCommand) {
        throw "Git executable not found in PATH."
    }

    try {
        $gitVersion = & $gitCommand.Source --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "git --version returned exit code $LASTEXITCODE"
        }
        if (-not $gitVersion) {
            throw "git --version did not return any output."
        }
    }
    catch {
        throw "Unable to execute 'git --version'. Details: $($_.Exception.Message)"
    }

    return $true
}

function Initialize-Environment {
    param (
        [Parameter(Mandatory = $true)] $Configuration
    )

    Write-Log -Message 'Validating execution environment'

    $psVersion = $PSVersionTable.PSVersion
    if ($psVersion.Major -lt 5) {
        throw "PowerShell 5.1 or higher is required. Detected version: $psVersion"
    }

    $requiredCommands = @('git')
    foreach ($command in $requiredCommands) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Required command not found in PATH: $command"
        }
    }

    $pythonExecutable = if ([string]::IsNullOrWhiteSpace($Configuration.execution.python_executable)) { 'python' } else { $Configuration.execution.python_executable }
    if (-not (Get-Command $pythonExecutable -ErrorAction SilentlyContinue)) {
        throw "Configured Python executable '$pythonExecutable' not found. Update execution.python_executable in automation_config.json."
    }

    $condaEnv = $Configuration.execution.conda_env_name
    if (-not [string]::IsNullOrWhiteSpace($condaEnv)) {
        if (-not (Get-Command 'conda' -ErrorAction SilentlyContinue)) {
            Write-Log -Message "Conda environment '$condaEnv' specified but 'conda' command not available. Falling back to direct Python execution." -Level 'WARN'
            $Configuration.execution.conda_env_name = $null
        }
        else {
            try {
                $envList = (& conda env list) 2>$null
                $envFound = $false
                foreach ($line in ($envList -split "`n")) {
                    $trimmed = $line.Trim()
                    if ($trimmed -and $trimmed.Split()[0] -eq $condaEnv) {
                        $envFound = $true
                        break
                    }
                }
                if (-not $envFound) {
                    Write-Log -Message "Conda environment '$condaEnv' not found. Continuing without conda integration." -Level 'WARN'
                    $Configuration.execution.conda_env_name = $null
                }
            }
            catch {
                Write-Log -Message ("Unable to verify conda environment '{0}'. Details: {1}. Continuing without conda integration." -f $condaEnv, $_.Exception.Message) -Level 'WARN'
                $Configuration.execution.conda_env_name = $null
            }
        }

        $condaEnv = $Configuration.execution.conda_env_name
    }

    try {
        Test-GitInstalled | Out-Null
    }
    catch {
        throw "Git validation failed: $($_.Exception.Message)"
    }

    Write-Log -Message 'Environment validation completed'
}

function Invoke-PreflightDiagnostics {
    param ()

    Write-Log -Message 'Performing Python and conda preflight checks'
    try {
        $venvPython = Join-Path -Path $PSScriptRoot -ChildPath '.venv\Scripts\python.exe'
        if (Test-Path $venvPython) {
            $pythonVersion = (& $venvPython --version 2>&1).Trim()
            Write-Log -Message ("Detected project virtual environment interpreter: {0} ({1})" -f $venvPython, $pythonVersion)
        }
        else {
            $pythonVersion = (& python --version 2>&1).Trim()
            if (-not $pythonVersion) {
                Write-Log -Message 'Unable to determine default python version via PATH' -Level 'WARN'
            }
            else {
                Write-Log -Message ("Detected python interpreter: {0}" -f $pythonVersion)
            }
        }
    }
    catch {
        Write-Log -Message ("Failed to query python version: {0}" -f $_.Exception.Message) -Level 'WARN'
    }

    try {
        $condaCommand = Get-Command 'conda' -ErrorAction SilentlyContinue
        if ($null -eq $condaCommand) {
            Write-Log -Message 'Conda not detected in PATH; virtualenv/pip flow will be used.' -Level 'WARN'
        }
        else {
            $condaVersion = (& conda --version 2>&1).Trim()
            Write-Log -Message ("Detected conda: {0}" -f $condaVersion)
        }
    }
    catch {
        Write-Log -Message ("Unable to query conda version: {0}" -f $_.Exception.Message) -Level 'WARN'
    }
}

function Invoke-PostSetupValidation {
    param ()

    $checkScript = Join-Path -Path $PSScriptRoot -ChildPath 'scripts/check_dependencies.py'
    if (-not (Test-Path $checkScript)) {
        Write-Log -Message ("Dependency check script not found at {0}; skipping automatic validation." -f $checkScript) -Level 'WARN'
        return
    }

    Write-Log -Message 'Verifying environment dependencies after setup'
    try {
        $previousPythonPath = $env:PYTHONPATH
        if ([string]::IsNullOrWhiteSpace($previousPythonPath)) {
            $env:PYTHONPATH = $PSScriptRoot
        }
        else {
            $env:PYTHONPATH = ($PSScriptRoot + [System.IO.Path]::PathSeparator + $previousPythonPath)
        }
        Execute-PythonScript -ScriptPath $checkScript -RetryAttempts 1 -RetryDelaySeconds 1 | Out-Null
        $env:PYTHONPATH = $previousPythonPath
        $Script:SetupDependenciesVerified = $true
    }
    catch {
        $env:PYTHONPATH = $previousPythonPath
        Write-ErrorLog -Message 'Post-setup dependency verification failed' -Exception $_.Exception
        throw "Environment validation failed immediately after setup. Resolve the reported issues and rerun master_automation.ps1 with --SkipPhase 1 or --Resume once fixed."
    }
}

function Show-WelcomeBanner {
    param ()
    $banner = @"
============================================================
 WealthArena Agentic RL Trading System Automation
 Author: Clifford Addison | Year: 2025 | Company: WealthArena
 Version: 1.0.0
============================================================
"@
    Write-Host $banner
    Write-Log -Message 'Displayed welcome banner'
}

function Load-Configuration {
    param ()

    if (Test-Path $ConfigFile) {
        $jsonContent = Get-Content -Path $ConfigFile -Raw
        return $jsonContent | ConvertFrom-Json
    }

    throw "Configuration file not found: $ConfigFile"
}

function Load-PhaseDefinitions {
    param ()

    if (Test-Path $PhaseDefinitions) {
        $jsonContent = Get-Content -Path $PhaseDefinitions -Raw
        return $jsonContent | ConvertFrom-Json
    }

    throw "Phase definitions file not found: $PhaseDefinitions"
}

function Load-Checkpoint {
    param ()
    try {
        return Get-LatestCheckpoint -CheckpointDirectory $CheckpointDirectory
    }
    catch {
        Write-Log -Message 'No existing checkpoint found, starting fresh' -Level 'WARN'
        return $null
    }
}

function Save-Checkpoint {
    param(
        [Parameter(Mandatory = $true)] $CheckpointState
    )

    try {
        Update-Checkpoint -CheckpointDirectory $CheckpointDirectory -State $CheckpointState | Out-Null
        Write-Log -Message 'Checkpoint saved successfully'
    }
    catch {
        Write-ErrorLog -Message 'Failed to save checkpoint' -Exception $_.Exception
        throw
    }
}

function Cleanup-OldCheckpoints {
    param(
        [int] $MaxToKeep = 5
    )

    try {
        Remove-OldCheckpoints -CheckpointDirectory $CheckpointDirectory -BackupDirectory $CheckpointBackup -MaxToKeep $MaxToKeep
        Write-Log -Message "Old checkpoints cleanup completed (kept latest $MaxToKeep)"
    }
    catch {
        Write-ErrorLog -Message 'Failed to cleanup checkpoints' -Exception $_.Exception
    }
}

function Test-PhaseCompleted {
    param(
        [Parameter(Mandatory = $true)] $CheckpointState,
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [string] $StepId
    )

    return Test-StepCompleted -State $CheckpointState -PhaseId $PhaseId -StepId $StepId
}

function Mark-PhaseCompleted {
    param(
        [Parameter(Mandatory = $true)] $CheckpointState,
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [string] $StepId,
        [string] $PhaseName,
        [Hashtable] $Metrics = @{}
    )

    return New-Checkpoint `
        -CheckpointDirectory $CheckpointDirectory `
        -State $CheckpointState `
        -PhaseId $PhaseId `
        -StepId $StepId `
        -PhaseName $PhaseName `
        -Metrics $Metrics
}

function Record-OptionalStepFailure {
    param(
        [Parameter(Mandatory = $true)] $CheckpointState,
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [Parameter(Mandatory = $true)][string] $StepId,
        [Parameter(Mandatory = $true)][string] $StepName,
        [Parameter(Mandatory = $true)][string] $ErrorMessage,
        [int] $AttemptCount = 0
    )

    Write-Log -Message "Recording optional step failure: $StepName (Step ID: $StepId)" -Level 'WARN'
    
    try {
        $updatedState = Add-OptionalStepFailure `
            -State $CheckpointState `
            -PhaseId $PhaseId `
            -StepId $StepId `
            -StepName $StepName `
            -ErrorMessage $ErrorMessage `
            -AttemptCount $AttemptCount
        return $updatedState
    }
    catch {
        Write-ErrorLog -Message "Failed to record optional step failure: $StepName" -Exception $_.Exception
        return $CheckpointState
    }
}

function Prompt-UserAction {
    param(
        [Parameter(Mandatory = $true)][string] $Message,
        [ValidateSet('Yes','No','Redo')] [string[]] $Options = @('Yes','No','Redo')
    )

    return Show-ManualTaskPrompt -PromptMessage $Message -Options $Options
}

function Prompt-APIKey {
    param(
        [Parameter(Mandatory = $true)][string] $KeyName,
        [Parameter(Mandatory = $true)][string] $Instructions
    )

    return Show-APIKeyPrompt -KeyName $KeyName -Instructions $Instructions -EnvTemplatePath $EnvTemplatePath -EnvFilePath $EnvFilePath
}

function Get-PythonInvocation {
    param(
        [Parameter(Mandatory = $true)][string] $ScriptPath,
        [string[]] $Arguments = @()
    )

    $settings = $Script:ExecutionSettings
    $venvPython = Join-Path -Path $PSScriptRoot -ChildPath '.venv\Scripts\python.exe'
    $configuredPython = if ($settings -and -not [string]::IsNullOrWhiteSpace($settings.python_executable)) { $settings.python_executable } else { $null }
    if ($configuredPython -and (Test-Path $configuredPython)) {
        $pythonExecutable = $configuredPython
    }
    elseif (Test-Path $venvPython) {
        $pythonExecutable = $venvPython
        Write-Log -Message ("Resolved project virtual environment interpreter at {0}" -f $venvPython) -Level 'DEBUG'
    }
    else {
        $pythonExecutable = 'python'
    }

    $resolvedScriptPath = $ScriptPath
    try {
        $resolvedScriptPath = (Resolve-Path -LiteralPath $ScriptPath -ErrorAction Stop).ProviderPath
    }
    catch {
        # leave as provided if resolution fails
    }

    $useModuleInvocation = $false
    $moduleArguments = @()
    if ($resolvedScriptPath -and $resolvedScriptPath -match '\.py$') {
        try {
            $projectRootResolved = (Resolve-Path -LiteralPath $PSScriptRoot -ErrorAction Stop).ProviderPath
        }
        catch {
            $projectRootResolved = $PSScriptRoot
        }

        if ($resolvedScriptPath.StartsWith($projectRootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
            $relativePath = $resolvedScriptPath.Substring($projectRootResolved.Length).TrimStart('\','/')
            if ($relativePath) {
                $moduleName = ($relativePath -replace '[\\\/]', '.') -replace '\.py$', ''
                if (-not [string]::IsNullOrWhiteSpace($moduleName)) {
                    $useModuleInvocation = $true
                    $moduleArguments = @('-m', $moduleName) + $Arguments
                }
            }
        }
    }

    $pythonArguments = if ($useModuleInvocation) { $moduleArguments } else { @($resolvedScriptPath) + $Arguments }

    if ($settings -and -not [string]::IsNullOrWhiteSpace($settings.conda_env_name) -and (Get-Command 'conda' -ErrorAction SilentlyContinue)) {
        return @{
            Executable = 'conda'
            Arguments  = @('run', '-n', $settings.conda_env_name, $pythonExecutable) + $pythonArguments
        }
    }

    return @{
        Executable = $pythonExecutable
        Arguments  = $pythonArguments
    }
}

function Execute-Command {
    param(
        [Parameter(Mandatory = $true)][string] $Executable,
        [string[]] $Arguments = @(),
        [int] $RetryAttempts,
        [int] $RetryDelaySeconds
    )

    $attempts = if ($PSBoundParameters.ContainsKey('RetryAttempts')) {
        [Math]::Max(1, [int]$RetryAttempts)
    } elseif ($Script:ExecutionSettings) {
        [Math]::Max(1, [int]$Script:ExecutionSettings.retry_attempts)
    } else {
        3
    }

    $delay = if ($PSBoundParameters.ContainsKey('RetryDelaySeconds')) {
        [Math]::Max(1, [int]$RetryDelaySeconds)
    } elseif ($Script:ExecutionSettings) {
        [Math]::Max(1, [int]$Script:ExecutionSettings.retry_delay_seconds)
    } else {
        5
    }

    $attempt = 0
    while ($attempt -lt $attempts) {
        $attempt++
        try {
            $argumentString = Join-Arguments -Args $Arguments
            Write-Log -Message ("Executing command: {0} {1} (Attempt {2})" -f $Executable, $argumentString, $attempt)
            $stdoutPath = $null
            $stderrPath = $null
            $stdoutFile = $null
            $stderrFile = $null
            if ($DryRun) {
                Write-Log -Message "Dry-run enabled; skipping execution." -Level 'WARN'
                return @{ Success = $true; Output = @(); Error = @(); ExitCode = 0 }
            }

            $stdoutFile = New-TemporaryFile
            $stderrFile = New-TemporaryFile
            $stdoutPath = $stdoutFile.FullName
            $stderrPath = $stderrFile.FullName

            try {
                $process = Start-Process -FilePath $Executable -ArgumentList $argumentString -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
            }
            catch {
                throw "Failed to start process '$Executable'. Ensure the executable exists in PATH. Details: $($_.Exception.Message)"
            }

            $stdOut = if (Test-Path $stdoutPath) { Get-Content -Path $stdoutPath } else { @() }
            $stdErr = if (Test-Path $stderrPath) { Get-Content -Path $stderrPath } else { @() }

            if ($process.ExitCode -eq 0) {
                return @{ Success = $true; Output = $stdOut; Error = $stdErr; ExitCode = 0 }
            }

            throw "Command '$Executable' exited with code $($process.ExitCode). Error: $($stdErr -join ' ')"
        }
        catch {
            Write-ErrorLog -Message "Command execution failed: $Executable (Attempt $attempt)" -Exception $_.Exception
            if ($attempt -ge $attempts) {
                throw
            }
            Start-Sleep -Seconds $delay
        }
        finally {
            if ($stdoutPath -and (Test-Path $stdoutPath)) {
                Remove-Item -Path $stdoutPath -Force -ErrorAction SilentlyContinue
            }
            if ($stderrPath -and (Test-Path $stderrPath)) {
                Remove-Item -Path $stderrPath -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Execute-PythonScript {
    param(
        [Parameter(Mandatory = $true)][string] $ScriptPath,
        [string[]] $Arguments = @(),
        [int] $RetryAttempts = 3,
        [int] $RetryDelaySeconds = 10
    )

    $invocation = Get-PythonInvocation -ScriptPath $ScriptPath -Arguments $Arguments
    $previousPythonPath = $env:PYTHONPATH
    $projectRoot = $PSScriptRoot
    try {
        if ([string]::IsNullOrWhiteSpace($previousPythonPath)) {
            $env:PYTHONPATH = $projectRoot
        }
        elseif (-not ($previousPythonPath -split [System.IO.Path]::PathSeparator | Where-Object { $_ -eq $projectRoot })) {
            $env:PYTHONPATH = $projectRoot + [System.IO.Path]::PathSeparator + $previousPythonPath
        }
        return Execute-Command -Executable $invocation.Executable -Arguments $invocation.Arguments -RetryAttempts $RetryAttempts -RetryDelaySeconds $RetryDelaySeconds
    }
    finally {
        $env:PYTHONPATH = $previousPythonPath
    }
}

function Execute-GitOperation {
    param(
        [Parameter(Mandatory = $true)][scriptblock] $Operation,
        [int] $RetryAttempts = 3,
        [int] $RetryDelaySeconds = 5
    )

    $attempt = 0
    while ($attempt -lt $RetryAttempts) {
        try {
            $attempt++
            return & $Operation
        }
        catch {
            Write-ErrorLog -Message "Git operation failed (Attempt $attempt)" -Exception $_.Exception
            if ($attempt -ge $RetryAttempts) {
                throw
            }
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
}

function Collect-Metrics {
    param(
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [Parameter(Mandatory = $false)] $CheckpointState = $null
    )

    Write-Log -Message "Collecting metrics for $PhaseId"
    try {
        return Collect-PhaseMetrics -PhaseId $PhaseId -HelpersDirectory $HelpersDirectory -MetricsDirectory $MetricsDirectory -Configuration $Script:ConfigurationData -CheckpointState $CheckpointState -DryRun:$DryRun
    }
    catch {
        Write-Log -Message ("Metrics collection failed for {0}: {1}" -f $PhaseId, $_.Exception.Message) -Level 'ERROR'
        Write-ErrorLog -Message "Failed to collect metrics for $PhaseId" -Exception $_.Exception
        return @{
            collection_failed = $true
            error             = $_.Exception.Message
        }
    }
}

function Generate-Report {
    param(
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [Parameter(Mandatory = $true)] $CheckpointState
    )

    try {
        New-ProgressReport `
            -PhaseId $PhaseId `
            -CheckpointState $CheckpointState `
            -MetricsDirectory $MetricsDirectory `
            -ReportsDirectory $ReportsDirectory `
            -GitRepositoryStatus (Get-GitStatus) `
            -Configuration $Script:ConfigurationData `
            -DryRun:$DryRun | Out-Null
        Write-Log -Message "Report generated for $PhaseId"
    }
    catch {
        Write-ErrorLog -Message 'Failed to generate report' -Exception $_.Exception
    }
}

# --------------------------------------
# Main Execution Flow
# --------------------------------------
try {
    Initialize-Directories
    Import-ApiKeysFromConfig
    $moduleFiles = @(
        'CheckpointManager.ps1',
        'GitManager.ps1',
        'InteractivePrompts.ps1',
        'MetricsCollector.ps1',
        'ReportGenerator.ps1'
    )

    foreach ($moduleName in $moduleFiles) {
        $modulePath = Join-Path -Path $ModuleDirectory -ChildPath $moduleName
        if (-not (Test-Path $modulePath)) {
            throw "Required module file not found: $modulePath"
        }
        . $modulePath
    }

    if (Get-Command -Name Test-GitInstalled -ErrorAction SilentlyContinue) {
        Write-Log -Message 'Loaded GitManager module'
    }
    else {
        throw 'Failed to load GitManager module'
    }
    Show-WelcomeBanner

    $configuration = Load-Configuration
    $Script:ConfigurationData = $configuration
    $Script:ExecutionSettings = $configuration.execution
    $Script:GitSettings = $configuration.git
    $Script:NotebookSettings = $configuration.notebooks
    $Script:SonarSettings = $configuration.sonarqube

    Initialize-Environment -Configuration $configuration
    Invoke-PreflightDiagnostics
    $phaseDefinitions = Load-PhaseDefinitions
    $checkpointState = Load-Checkpoint

    if ($null -eq $checkpointState -or $ForceRerun) {
        $checkpointState = Initialize-CheckpointSystem -CheckpointDirectory $CheckpointDirectory -Configuration $configuration
    }
    elseif ($checkpointState) {
        if ($checkpointState.PSObject.Properties.Match('phases').Count -eq 0 -or $null -eq $checkpointState.phases) {
            $checkpointState | Add-Member -NotePropertyName 'phases' -NotePropertyValue ([ordered]@{}) -Force
        }
        elseif ($checkpointState.phases -isnot [System.Collections.IDictionary]) {
            $checkpointState.phases = ConvertTo-OrderedHashtable -InputObject $checkpointState.phases
        }

        foreach ($phaseKey in (Get-ObjectKeys -Map $checkpointState.phases)) {
            $phase = $checkpointState.phases.$phaseKey
            if ($null -ne $phase -and $phase.PSObject.Properties.Match('steps').Count -gt 0 -and $phase.steps -isnot [System.Collections.IDictionary]) {
                $checkpointState.phases.$phaseKey.steps = ConvertTo-OrderedHashtable -InputObject $phase.steps
            }
        }
    }

    if ($Resume) {
        Write-Log -Message 'Resuming automation from last checkpoint'
    }

    Execute-GitOperation -Operation {
        Initialize-GitRepository -RepositoryUrl $configuration.git.repository
        Add-GitRemote -RepositoryUrl $configuration.git.repository
        Switch-GitBranch -BranchName $configuration.git.branch
    } | Out-Null

    $gitIgnorePath = Join-Path -Path $PSScriptRoot -ChildPath '.gitignore'
    if (Test-Path $gitIgnorePath) {
        $containsVenvIgnore = $false
        foreach ($line in (Get-Content -Path $gitIgnorePath -ErrorAction SilentlyContinue)) {
            if ($line -match '^\s*\.venv/?\s*$') {
                $containsVenvIgnore = $true
                break
            }
        }
        if (-not $containsVenvIgnore) {
            Write-Log -Message "WARNING: .venv directory is not in .gitignore. This will cause git errors. Please add '.venv/' to .gitignore and run 'git rm -r --cached .venv' to unstage it." -Level 'ERROR'
        }
    }

    $phaseKeys = $phaseDefinitions.PSObject.Properties.Name | Sort-Object { [int]($_ -replace '[^0-9]', '') }
    foreach ($phaseKey in $phaseKeys) {
        $phase = $phaseDefinitions.$phaseKey
        if ($phase.enabled -eq $false -or $SkipPhase -contains ([int]($phaseKey -replace 'phase',''))) {
            Write-Log -Message "Skipping $($phase.name) due to configuration"
            continue
        }

        Write-Log -Message "Starting phase: $($phase.name)"
        foreach ($step in $phase.steps) {
            # Skip disabled steps (check if property exists first)
            if ($step.PSObject.Properties.Name -contains 'enabled' -and $step.enabled -eq $false) {
                Write-Log -Message "Skipping disabled step: $($step.name)"
                continue
            }
            
            if ((Test-PhaseCompleted -CheckpointState $checkpointState -PhaseId $phaseKey -StepId $step.id) -and -not $ForceRerun) {
                Write-Log -Message "Step already completed: $($step.name). Skipping."
                continue
            }

            Write-Log -Message "Executing step: $($step.name)"

            $stepCompleted = $false
            $shouldRecordStep = $false

            while (-not $stepCompleted) {
                try {
                    switch ($step.type) {
                        'script' {
                            if ($step.script -match '\.py$') {
                                $scriptFullPath = Join-Path -Path $PSScriptRoot -ChildPath $step.script
                                if (-not (Test-Path $scriptFullPath)) {
                                    $response = Prompt-UserAction -Message "Script file not found: $scriptFullPath. (Yes) mark complete, (No) skip, (Redo) retry after creating."
                                    switch ($response) {
                                        'Yes' {
                                            Write-Log -Message "Marking missing script step as complete per user confirmation."
                                            $shouldRecordStep = $true
                                            $stepCompleted = $true
                                        }
                                        'No' {
                                            Write-Log -Message "Skipping step due to missing script: $scriptFullPath" -Level 'WARN'
                                            $shouldRecordStep = $false
                                            $stepCompleted = $true
                                        }
                                        'Redo' {
                                            Write-Log -Message "Retry selected for missing script. Awaiting resolution." -Level 'WARN'
                                            continue
                                        }
                                    }
                                }
                                else {
                                    $invocation = Get-PythonInvocation -ScriptPath $scriptFullPath -Arguments $step.args
                                    Execute-Command -Executable $invocation.Executable -Arguments $invocation.Arguments | Out-Null
                                    if ($step.script -eq 'scripts/setup_environment.py') {
                                        Invoke-PostSetupValidation
                                    }
                                    $shouldRecordStep = $true
                                    $stepCompleted = $true
                                }
                            }
                            else {
                                $executable = $null
                                $arguments = $step.args
                                if ($step.script -in @('pytest', 'sonar-scanner', 'sphinx-build')) {
                                    $executable = $step.script
                                }
                                else {
                                    $potentialPath = Join-Path -Path $PSScriptRoot -ChildPath $step.script
                                    if (Test-Path $potentialPath) {
                                        $executable = $potentialPath
                                    }
                                    else {
                                        if (-not (Get-Command $step.script -ErrorAction SilentlyContinue)) {
                                            $response = Prompt-UserAction -Message "Executable '$($step.script)' not found in PATH. (Yes) mark complete, (No) skip, (Redo) retry after resolving."
                                            switch ($response) {
                                                'Yes' {
                                                    Write-Log -Message "Marking step complete despite missing executable per user instruction."
                                                    $shouldRecordStep = $true
                                                    $stepCompleted = $true
                                                }
                                                'No' {
                                                    Write-Log -Message "Skipping step due to missing executable: $($step.script)" -Level 'WARN'
                                                    $shouldRecordStep = $false
                                                    $stepCompleted = $true
                                                }
                                                'Redo' {
                                                    Write-Log -Message "Retry selected for missing executable. Awaiting resolution." -Level 'WARN'
                                                    continue
                                                }
                                            }
                                            continue
                                        }
                                        $executable = $step.script
                                    }
                                }

                                if ($executable) {
                                    Execute-Command -Executable $executable -Arguments $arguments | Out-Null
                                    $shouldRecordStep = $true
                                    $stepCompleted = $true
                                }
                            }

                            if ($shouldRecordStep -and $Script:AssetValidationRules.ContainsKey($step.script)) {
                                $assetType = $Script:AssetValidationRules[$step.script]
                                if (-not (Test-BronzeAssetPopulated -AssetType $assetType)) {
                                    $recommendedArgs = if ($step.args) { " " + (Join-Arguments -Args $step.args) } else { "" }
                                    $recommendedCommand = ("python {0}{1}" -f $step.script, $recommendedArgs).Trim()
                                    $warningMessage = "No Bronze data detected for asset '{0}' after running {1}. Check logs and rerun manually: {2}" -f $assetType, $step.script, $recommendedCommand
                                    Write-Log -Message $warningMessage -Level 'WARN'
                                    $shouldRecordStep = $false
                                }
                            }
                        }
                        'notebook' {
                            $notebookPath = Join-Path -Path $PSScriptRoot -ChildPath $step.notebook
                            if (-not (Test-Path $notebookPath)) {
                                $response = Prompt-UserAction -Message "Notebook not found: $notebookPath. (Yes) mark complete, (No) skip, (Redo) retry after creating."
                                switch ($response) {
                                    'Yes' {
                                        Write-Log -Message "Marking notebook step as complete without execution."
                                        $shouldRecordStep = $true
                                        $stepCompleted = $true
                                    }
                                    'No' {
                                        Write-Log -Message "Skipping notebook step due to missing file." -Level 'WARN'
                                        $shouldRecordStep = $false
                                        $stepCompleted = $true
                                    }
                                    'Redo' {
                                        Write-Log -Message "Retry selected for missing notebook. Awaiting user action." -Level 'WARN'
                                        continue
                                    }
                                }
                                continue
                            }

                            if ($configuration.notebooks.prompt_before_execution) {
                                $confirmation = Show-NotebookExecutionPrompt -NotebookPath $step.notebook
                                if ($confirmation -eq 'Skip') {
                                    Write-Log -Message "User skipped notebook execution: $($step.notebook)" -Level 'WARN'
                                    $shouldRecordStep = $false
                                    $stepCompleted = $true
                                    continue
                                }
                                elseif ($confirmation -eq 'No') {
                                    $shouldRecordStep = $false
                                    $stepCompleted = $true
                                    continue
                                }
                            }

                            if ($configuration.notebooks.execute_automatically -and -not $DryRun) {
                                $notebookExecutor = Join-Path -Path $HelpersDirectory -ChildPath 'execute_notebooks.py'
                                $notebookDir = Join-Path -Path $PSScriptRoot -ChildPath $configuration.notebooks.notebooks_directory
                                $outputDir = Join-Path -Path $PSScriptRoot -ChildPath $configuration.notebooks.output_directory
                                $reportPath = Join-Path -Path $MetricsDirectory -ChildPath ("notebooks_{0}.json" -f $phaseKey)
                                $notebookFilename = Split-Path -Path $step.notebook -Leaf
                                $parameters = @(
                                    '--notebooks-dir', $notebookDir,
                                    '--output-dir', $outputDir,
                                    '--report', $reportPath,
                                    '--single', $notebookFilename
                                )
                                Execute-PythonScript -ScriptPath $notebookExecutor -Arguments $parameters | Out-Null
                            }
                            else {
                                Write-Log -Message "Manual execution required for notebook: $($step.notebook)" -Level 'WARN'
                                $ack = Prompt-UserAction -Message "Confirm completion of notebook $($step.notebook). (Yes) mark complete, (No) skip, (Redo) rerun prompt."
                                switch ($ack) {
                                    'Yes' { }
                                    'No' {
                                        $shouldRecordStep = $false
                                        $stepCompleted = $true
                                        continue
                                    }
                                    'Redo' {
                                        Write-Log -Message "Redo selected for notebook confirmation." -Level 'WARN'
                                        continue
                                    }
                                }
                            }

                            $shouldRecordStep = $true
                            $stepCompleted = $true
                        }
                        'interactive' {
                            foreach ($key in $step.required_keys) {
                                $instructionText = if ($configuration.api_keys -and -not [string]::IsNullOrWhiteSpace($configuration.api_keys.instructions)) {
                                    $configuration.api_keys.instructions
                                }
                                else {
                                    "Please configure $key in the .env file, using guidance in .env.template."
                                }
                                Prompt-APIKey -KeyName $key -Instructions $instructionText | Out-Null
                            }
                            $shouldRecordStep = $true
                            $stepCompleted = $true
                        }
                        'manual' {
                            $manualResponse = Prompt-UserAction -Message $step.description
                            switch ($manualResponse) {
                                'Yes' {
                                    $shouldRecordStep = $true
                                    $stepCompleted = $true
                                }
                                'No' {
                                    $shouldRecordStep = $false
                                    $stepCompleted = $true
                                }
                                'Redo' {
                                    Write-Log -Message "Redo selected for manual task: $($step.name)" -Level 'WARN'
                                    continue
                                }
                            }
                        }
                        default {
                            throw "Unknown step type: $($step.type)"
                        }
                    }
                }
                catch {
                    Write-ErrorLog -Message "Step failed: $($step.name)" -Exception $_.Exception
                    if ($_.Exception.Message -like 'Environment validation failed immediately after setup*') {
                        throw $_.Exception
                    }
                    
                    # Check if this is an optional step (allow_failure: true)
                    $isOptionalStep = ($step.PSObject.Properties.Name -contains 'allow_failure') -and ($step.allow_failure -eq $true)
                    $errorMessage = $_.Exception.Message
                    
                    if ($isOptionalStep) {
                        # Extract attempt count from error message if available
                        $attemptCount = 0
                        if ($errorMessage -match 'after (\d+) attempt') {
                            $attemptCount = [int]$matches[1]
                        }
                        
                        Write-Log -Message "Optional step '$($step.name)' failed after attempts. Pipeline will continue without this data." -Level 'WARN'
                        Write-Log -Message "Failure reason: $errorMessage" -Level 'WARN'
                        
                        # Record the optional step failure
                        $checkpointState = Record-OptionalStepFailure `
                            -CheckpointState $checkpointState `
                            -PhaseId $phaseKey `
                            -StepId $step.id `
                            -StepName $step.name `
                            -ErrorMessage $errorMessage `
                            -AttemptCount $attemptCount
                        
                        # Save checkpoint with failure record
                        Save-Checkpoint -CheckpointState $checkpointState
                        
                        # Mark step as completed (failed but optional) and continue
                        $shouldRecordStep = $false
                        $stepCompleted = $true
                        
                        # Log continuation message
                        if ($step.name -like '*Options*') {
                            Write-Log -Message "Options data collection failed. The pipeline will continue, but options-based features and the options agent will be unavailable." -Level 'WARN'
                            Write-Log -Message "You can retry options collection later by running: python scripts/collect_options.py --config config/data_config.yaml" -Level 'WARN'
                        }
                    }
                    else {
                        # Non-optional step: prompt user for action
                        $action = Prompt-UserAction -Message "Step '$($step.name)' failed. Choose Yes to retry, No to skip, Redo to rerun prerequisites."
                        switch ($action) {
                            'Yes' {
                                Write-Log -Message "Retrying step: $($step.name)" -Level 'WARN'
                                continue
                            }
                            'Redo' {
                                Write-Log -Message "Redo selected for step: $($step.name). Re-running." -Level 'WARN'
                                continue
                            }
                            'No' {
                                Write-Log -Message "Skipping step after failure: $($step.name)" -Level 'WARN'
                                $shouldRecordStep = $false
                                $stepCompleted = $true
                            }
                        }
                    }
                }
            }

            if ($shouldRecordStep) {
                if ($DryRun) {
                    Write-Log -Message "Dry-run active; not recording checkpoint for step $($step.name)" -Level 'DEBUG'
                    $shouldRecordStep = $false
                }
            }

            if ($shouldRecordStep) {
                try {
                    Execute-GitOperation -Operation {
                        Add-GitFiles -Paths @('.')
                        $message = $step.commit_message
                        if (-not $message) {
                            $message = Get-CommitMessageSuggestion -PhaseId $phaseKey -Step $step
                        }
                        Validate-CommitMessage -Message $message -MinWords $configuration.git.commit_message_min_words -MaxWords $configuration.git.commit_message_max_words | Out-Null
                        New-GitCommit -Message $message -DryRun:$DryRun
                        if ($configuration.git.auto_push -and -not $DryRun) {
                            Push-GitChanges -RetryAttempts $configuration.git.push_retry_attempts -RetryDelaySeconds $configuration.git.push_retry_delay_seconds
                        }
                    } | Out-Null
                }
                catch {
                    $gitErrorMessage = $_.Exception.Message
                    if ($gitErrorMessage -match 'Filename too long') {
                        Write-Log -Message "Git reported a filename too long error. Ensure '.venv/' is added to .gitignore and run 'git rm -r --cached .venv' to remove it from the index." -Level 'ERROR'
                    }
                    else {
                        Write-Log -Message ("Git operations failed during step {0}: {1}" -f $step.name, $gitErrorMessage) -Level 'ERROR'
                    }
                    Write-ErrorLog -Message "Git operation failed during step $($step.name)" -Exception $_.Exception
                    $continueWithoutCommit = Prompt-UserAction -Message "Git operations failed for step '$($step.name)'. Continue without committing changes?" -Options @('Yes','No')
                    if ($continueWithoutCommit -ne 'Yes') {
                        throw $_.Exception
                    }
                    Write-Log -Message "Continuing without committing changes for step $($step.name) per user selection." -Level 'WARN'
                }

                $metrics = Collect-Metrics -PhaseId $phaseKey -CheckpointState $checkpointState
                $checkpointState = Mark-PhaseCompleted -CheckpointState $checkpointState -PhaseId $phaseKey -StepId $step.id -PhaseName $phase.name -Metrics $metrics
                Save-Checkpoint -CheckpointState $checkpointState
            }
        }

        $allStepsCompleted = $true
        foreach ($definedStep in $phase.steps) {
            if (-not (Test-PhaseCompleted -CheckpointState $checkpointState -PhaseId $phaseKey -StepId $definedStep.id)) {
                $allStepsCompleted = $false
                break
            }
        }

        if ($allStepsCompleted) {
            $checkpointState = Complete-Phase -State $checkpointState -PhaseId $phaseKey -PhaseName $phase.name
            Save-Checkpoint -CheckpointState $checkpointState
        }

        $phaseMetrics = Collect-Metrics -PhaseId $phaseKey -CheckpointState $checkpointState
        Generate-Report -PhaseId $phaseKey -CheckpointState $checkpointState
        Write-Log -Message "Completed phase: $($phase.name)"
    }

    if (-not $DryRun) {
        $finalMetrics = Collect-Metrics -PhaseId 'final' -CheckpointState $checkpointState
        Generate-Report -PhaseId 'final' -CheckpointState $checkpointState
    }

    Cleanup-OldCheckpoints -MaxToKeep $configuration.checkpoint.max_checkpoints_to_keep
    Write-Log -Message 'Automation completed successfully'
    Write-Host ''
    Write-Host 'Automation Summary'
    Write-Host '-------------------'
    Write-Host ('Final checkpoint stored at: {0}' -f $CheckpointDirectory)
    Write-Host ('Reports available in: {0}' -f $ReportsDirectory)
}
catch {
    Write-ErrorLog -Message 'Automation encountered a critical error' -Exception $_.Exception
    Write-Host 'Automation failed. Check automation/logs/automation_errors.txt for details.'
    exit 1
}

exit 0

