# ==================================================================================================
# Module: MetricsCollector.ps1
# Description: Metrics collection utilities for WealthArena automation system
# Author: Clifford Addison
# Company: WealthArena
# Year: 2025
# ==================================================================================================

Set-StrictMode -Version Latest

function ConvertTo-QuotedArguments {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][object[]] $Arguments
    )

    $result = @()
    foreach ($argument in $Arguments) {
        if ($null -eq $argument) {
            continue
        }

        $stringArg = [string]$argument
        if ($stringArg -match '[\s"`]') {
            $escaped = $stringArg.Replace('"', '\"')
            $result += '"' + $escaped + '"'
        }
        else {
            $result += $stringArg
        }
    }

    return $result
}

function Test-RequiredDirectories {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string[]] $Paths
    )

    foreach ($path in $Paths) {
        if (-not (Test-Path -LiteralPath $path)) {
            return $false
        }
    }

    return $true
}

function Invoke-MetricsHelper {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $HelperScript,
        [string[]] $Arguments = @(),
        [switch] $DryRun,
        $ExecutionSettings
    )

    if ($DryRun) {
        return @{ Success = $true; OutputPath = $null; Error = $null }
    }

    $pythonExecutable = if ($ExecutionSettings -and $ExecutionSettings.python_executable) { $ExecutionSettings.python_executable } else { 'python' }
    $useConda = $false
    $startExecutable = $pythonExecutable
    $startArguments = @($HelperScript) + $Arguments

    if ($ExecutionSettings -and $ExecutionSettings.conda_env_name -and (Get-Command 'conda' -ErrorAction SilentlyContinue)) {
        $useConda = $true
        $startExecutable = 'conda'
        $startArguments = @('run', '-n', $ExecutionSettings.conda_env_name, $pythonExecutable, $HelperScript) + $Arguments
    }

    $escapedArguments = ConvertTo-QuotedArguments -Arguments $startArguments
    $argumentString = ($escapedArguments -join ' ')

    $stdoutFile = New-TemporaryFile
    $stderrFile = New-TemporaryFile
    $stdoutPath = $stdoutFile.FullName
    $stderrPath = $stderrFile.FullName

    try {
        try {
            $process = Start-Process -FilePath $startExecutable -ArgumentList $argumentString -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
            if ($process.ExitCode -ne 0) {
                $stderr = if (Test-Path $stderrPath) { Get-Content -Path $stderrPath } else { @() }
                $prefix = if ($useConda) { "conda run" } else { $pythonExecutable }
                throw ("Helper script failed using {0}: {1}{2}{3}" -f $prefix, $HelperScript, [Environment]::NewLine, ($stderr -join [Environment]::NewLine))
            }

            return @{
                Success    = $true
                OutputPath = if ($Arguments -and $Arguments -contains '--output') { $Arguments[$Arguments.IndexOf('--output') + 1] } else { $null }
                Error      = $null
            }
        }
        catch {
            return @{
                Success    = $false
                OutputPath = $null
                Error      = $_.Exception.Message
            }
        }
    }
    finally {
        if (Test-Path $stdoutPath) {
            Remove-Item -Path $stdoutPath -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $stderrPath) {
            Remove-Item -Path $stderrPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Collect-DataStoreMetrics {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $HelpersDirectory,
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        $ExecutionSettings,
        [switch] $DryRun
    )

    $dataRoot = './data'
    if (-not (Test-Path -LiteralPath $dataRoot)) {
        Write-Warning ("Data root '{0}' not found. Datastore metrics will be empty until it is created." -f $dataRoot)
    }

    $outputFile = Join-Path -Path $MetricsDirectory -ChildPath 'datastore.json'
    $scriptPath = Join-Path -Path $HelpersDirectory -ChildPath 'collect_datastore_metrics.py'
    $result = Invoke-MetricsHelper -HelperScript $scriptPath -Arguments @('--output', $outputFile) -ExecutionSettings $ExecutionSettings -DryRun:$DryRun
    if (-not $result.Success) {
        Write-Warning ("Datastore metrics helper failed: {0}" -f $result.Error)
        return @{}
    }

    if (-not $DryRun -and (Test-Path $outputFile)) {
        return Get-Content -Path $outputFile -Raw | ConvertFrom-Json
    }
    elseif (-not $DryRun) {
        Write-Warning "Datastore metrics output file was not created."
    }
    return @{}
}

function Collect-PipelineMetrics {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $HelpersDirectory,
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        [string] $LogsDirectory = './logs',
        $ExecutionSettings,
        [switch] $DryRun
    )

    $requiredPaths = @($LogsDirectory)
    if (-not (Test-RequiredDirectories -Paths $requiredPaths)) {
        $missing = $requiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) }
        Write-Warning ("Skipping pipeline metrics collection; missing directories: {0}" -f ($missing -join ', '))
        return @{}
    }

    $outputFile = Join-Path -Path $MetricsDirectory -ChildPath 'pipeline.json'
    $scriptPath = Join-Path -Path $HelpersDirectory -ChildPath 'collect_pipeline_metrics.py'
    $args = @('--logs-dir', $LogsDirectory, '--output', $outputFile)
    $result = Invoke-MetricsHelper -HelperScript $scriptPath -Arguments $args -ExecutionSettings $ExecutionSettings -DryRun:$DryRun
    if (-not $result.Success) {
        Write-Warning ("Pipeline metrics helper failed: {0}" -f $result.Error)
        return @{}
    }

    if (-not $DryRun -and (Test-Path $outputFile)) {
        return Get-Content -Path $outputFile -Raw | ConvertFrom-Json
    }
    elseif (-not $DryRun) {
        Write-Warning "Pipeline metrics output file was not created."
    }
    return @{}
}

function Collect-MLMetrics {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $HelpersDirectory,
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        [string] $ExperimentsDir = './experiments',
        [string] $ResultsDir = './results',
        $ExecutionSettings,
        [switch] $DryRun
    )

    $requiredPaths = @($ExperimentsDir, $ResultsDir)
    if (-not (Test-RequiredDirectories -Paths $requiredPaths)) {
        $missing = $requiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) }
        Write-Warning ("Skipping ML metrics collection; missing directories: {0}" -f ($missing -join ', '))
        return @{}
    }

    $outputFile = Join-Path -Path $MetricsDirectory -ChildPath 'ml.json'
    $scriptPath = Join-Path -Path $HelpersDirectory -ChildPath 'collect_ml_metrics.py'
    $args = @('--experiments-dir', $ExperimentsDir, '--results-dir', $ResultsDir, '--output', $outputFile)
    $result = Invoke-MetricsHelper -HelperScript $scriptPath -Arguments $args -ExecutionSettings $ExecutionSettings -DryRun:$DryRun
    if (-not $result.Success) {
        Write-Warning ("ML metrics helper failed: {0}" -f $result.Error)
        return @{}
    }

    if (-not $DryRun -and (Test-Path $outputFile)) {
        return Get-Content -Path $outputFile -Raw | ConvertFrom-Json
    }
    elseif (-not $DryRun) {
        Write-Warning "ML metrics output file was not created."
    }
    return @{}
}

function Collect-TestMetrics {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $HelpersDirectory,
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        [string] $PreviousMetrics = $null,
        $ExecutionSettings,
        [switch] $DryRun
    )

    $requiredPaths = @($MetricsDirectory)
    if (-not (Test-RequiredDirectories -Paths $requiredPaths)) {
        $missing = $requiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) }
        Write-Warning ("Skipping test metrics collection; missing directories: {0}" -f ($missing -join ', '))
        return @{}
    }

    $outputFile = Join-Path -Path $MetricsDirectory -ChildPath 'test.json'
    $scriptPath = Join-Path -Path $HelpersDirectory -ChildPath 'collect_test_metrics.py'
    $args = @('--test-report', 'test_report.json', '--coverage-report', '.coverage.json', '--output', $outputFile)
    if ($PreviousMetrics) {
        $args += @('--previous', $PreviousMetrics)
    }

    $result = Invoke-MetricsHelper -HelperScript $scriptPath -Arguments $args -ExecutionSettings $ExecutionSettings -DryRun:$DryRun
    if (-not $result.Success) {
        Write-Warning ("Test metrics helper failed: {0}" -f $result.Error)
        return @{}
    }

    if (-not $DryRun -and (Test-Path $outputFile)) {
        return Get-Content -Path $outputFile -Raw | ConvertFrom-Json
    }
    elseif (-not $DryRun) {
        Write-Warning "Test metrics output file was not created."
    }
    return @{}
}

function Collect-ScrapingMetrics {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $HelpersDirectory,
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        [string] $LogsDirectory = './logs',
        [string] $AuditDirectory = './data/audit',
        $ExecutionSettings,
        [switch] $DryRun
    )

    $requiredPaths = @($LogsDirectory, $AuditDirectory)
    if (-not (Test-RequiredDirectories -Paths $requiredPaths)) {
        $missing = $requiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) }
        Write-Warning ("Skipping scraping metrics collection; missing directories: {0}" -f ($missing -join ', '))
        return @{}
    }

    $outputFile = Join-Path -Path $MetricsDirectory -ChildPath 'scraping.json'
    $scriptPath = Join-Path -Path $HelpersDirectory -ChildPath 'collect_scraping_metrics.py'
    $args = @('--logs-dir', $LogsDirectory, '--audit-dir', $AuditDirectory, '--output', $outputFile)
    $result = Invoke-MetricsHelper -HelperScript $scriptPath -Arguments $args -ExecutionSettings $ExecutionSettings -DryRun:$DryRun
    if (-not $result.Success) {
        Write-Warning ("Scraping metrics helper failed: {0}" -f $result.Error)
        return @{}
    }

    if (-not $DryRun -and (Test-Path $outputFile)) {
        return Get-Content -Path $outputFile -Raw | ConvertFrom-Json
    }
    elseif (-not $DryRun) {
        Write-Warning "Scraping metrics output file was not created."
    }
    return @{}
}

function Collect-CodeMetrics {
    [CmdletBinding()]
    param(
        [string] $SonarCommand = 'sonar-scanner',
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        $Configuration,
        [switch] $DryRun
    )

    $reportFile = Join-Path -Path $MetricsDirectory -ChildPath 'sonar-report.json'

    if (-not $Configuration -or -not $Configuration.sonarqube -or $Configuration.sonarqube.enabled -ne $true) {
        return @{}
    }

    $sonarSettings = $Configuration.sonarqube
    $commandToRun = if ($sonarSettings.scanner_command) { $sonarSettings.scanner_command } else { $SonarCommand }

    if (-not $DryRun) {
        $scannerCommand = Get-Command $commandToRun -ErrorAction SilentlyContinue
        if (-not $scannerCommand) {
            Write-Warning ("SonarQube scanner '{0}' not found in PATH. Skipping code metrics collection." -f $commandToRun)
            return @{}
        }

        $process = Start-Process -FilePath $commandToRun -NoNewWindow -Wait -PassThru
        if ($process.ExitCode -ne 0) {
            throw "SonarQube analysis failed with exit code $($process.ExitCode)"
        }
    }

    $serverUrl = if ($sonarSettings.server_url) { $sonarSettings.server_url } elseif ($env:SONAR_HOST_URL) { $env:SONAR_HOST_URL } else { '' }
    $projectKey = if ($sonarSettings.project_key) { $sonarSettings.project_key } else { '' }

    $tokenEnvVar = if ($sonarSettings.token_env_var) { $sonarSettings.token_env_var } else { 'SONAR_TOKEN' }
    $token = [Environment]::GetEnvironmentVariable($tokenEnvVar)
    if (-not $token -and $env:SONAR_TOKEN) {
        $token = $env:SONAR_TOKEN
    }

    $metricsList = if ($sonarSettings.metrics) { ($sonarSettings.metrics -join ',') } else { 'complexity,duplicated_lines_density,code_smells,coverage' }

    $result = @{
        project_key  = $projectKey
        collected_on = (Get-Date).ToString('o')
        measures     = @{}
        server_url   = $serverUrl
        metrics      = $metricsList
    }

    if (-not $DryRun -and $serverUrl -and $projectKey -and $token) {
        try {
            $uri = ('{0}/api/measures/component?component={1}&metricKeys={2}' -f $serverUrl.TrimEnd('/'), $projectKey, $metricsList)
            $authBytes = [System.Text.Encoding]::UTF8.GetBytes("{0}:" -f $token)
            $authHeader = [Convert]::ToBase64String($authBytes)
            $headers = @{ Authorization = "Basic $authHeader" }
            $response = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -ErrorAction Stop
            if ($response -and $response.component -and $response.component.measures) {
                $measures = @{}
                foreach ($measure in $response.component.measures) {
                    $measures[$measure.metric] = $measure.value
                }
                $result.measures = $measures
            }
        }
        catch {
            $result.error = $_.Exception.Message
        }
    }

    Export-MetricsToJSON -Metrics $result -OutputPath $reportFile
    return $result
}

function Get-SystemMetrics {
    [CmdletBinding()]
    param()

    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $memory = Get-CimInstance Win32_OperatingSystem
    $totalMem = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
    $freeMem = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)

    return @{
        cpu_load_percent = $cpu
        total_memory_gb  = $totalMem
        free_memory_gb   = $freeMem
        timestamp        = (Get-Date).ToString('o')
    }
}

function Export-MetricsToJSON {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Metrics,
        [Parameter(Mandatory = $true)][string] $OutputPath
    )

    $Metrics | ConvertTo-Json -Depth 20 | Out-File -FilePath $OutputPath -Encoding UTF8
}

function Format-MetricsTable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Metrics
    )

    if (-not $Metrics) {
        return "| Metric | Value |`n|--------|-------|`n| No data | - |"
    }

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.AppendLine('| Metric | Value |')
    [void]$builder.AppendLine('|--------|-------|')
    foreach ($key in $Metrics.Keys) {
        $value = $Metrics.$key
        if ($value -is [System.Collections.IDictionary]) {
            continue
        }
        [void]$builder.AppendLine("| $key | $value |")
    }
    return $builder.ToString().Trim()
}

function Collect-PhaseMetrics {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [Parameter(Mandatory = $true)][string] $HelpersDirectory,
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        $Configuration,
        [Parameter(Mandatory = $false)] $CheckpointState = $null,
        [switch] $DryRun
    )

    $phaseMetrics = @{
        phase_id      = $PhaseId
        collected_on  = (Get-Date).ToString('o')
        datastore     = @{}
        pipeline      = @{}
        ml            = @{}
        tests         = @{}
        scraping      = @{}
        code          = @{}
        system        = @{}
        optional_step_failures = @{}
    }
    
    # Extract optional step failures from checkpoint state if provided
    if ($CheckpointState) {
        try {
            $optionalFailures = Get-OptionalStepFailures -State $CheckpointState -PhaseId $PhaseId
            if ($optionalFailures -and $optionalFailures.Count -gt 0) {
                $phaseMetrics.optional_step_failures = @{
                    count = $optionalFailures.Count
                    failures = $optionalFailures
                }
            }
        }
        catch {
            Write-Warning ("Failed to extract optional step failures for phase {0}: {1}" -f $PhaseId, $_.Exception.Message)
        }
    }

    $collectionActions = @{
        datastore = { Collect-DataStoreMetrics -HelpersDirectory $HelpersDirectory -MetricsDirectory $MetricsDirectory -ExecutionSettings $Configuration.execution -DryRun:$DryRun }
        pipeline  = { Collect-PipelineMetrics -HelpersDirectory $HelpersDirectory -MetricsDirectory $MetricsDirectory -ExecutionSettings $Configuration.execution -DryRun:$DryRun }
        ml        = { Collect-MLMetrics -HelpersDirectory $HelpersDirectory -MetricsDirectory $MetricsDirectory -ExecutionSettings $Configuration.execution -DryRun:$DryRun }
        tests     = { Collect-TestMetrics -HelpersDirectory $HelpersDirectory -MetricsDirectory $MetricsDirectory -ExecutionSettings $Configuration.execution -DryRun:$DryRun }
        scraping  = { Collect-ScrapingMetrics -HelpersDirectory $HelpersDirectory -MetricsDirectory $MetricsDirectory -ExecutionSettings $Configuration.execution -DryRun:$DryRun }
        code      = { Collect-CodeMetrics -MetricsDirectory $MetricsDirectory -Configuration $Configuration -DryRun:$DryRun }
        system    = { Get-SystemMetrics }
    }

    foreach ($key in $collectionActions.Keys) {
        try {
            $phaseMetrics[$key] = & $collectionActions[$key]
        }
        catch {
            Write-Warning ("Failed to collect {0} metrics: {1}" -f $key, $_.Exception.Message)
            $phaseMetrics[$key] = @{}
        }
    }

    $phaseFile = Join-Path -Path $MetricsDirectory -ChildPath ("phase_{0}_metrics.json" -f $PhaseId)
    Export-MetricsToJSON -Metrics $phaseMetrics -OutputPath $phaseFile

    $aggregateFile = Join-Path -Path $MetricsDirectory -ChildPath 'aggregate_metrics.json'
    if (Test-Path $aggregateFile) {
        $existing = Get-Content -Path $aggregateFile -Raw | ConvertFrom-Json
        $aggregateList = @()
        if ($null -ne $existing) {
            if ($existing -is [System.Collections.IList]) {
                foreach ($item in $existing) {
                    $aggregateList += ,$item
                }
            }
            else {
                $aggregateList += ,$existing
            }
        }
        $aggregateList += ,$phaseMetrics
        Export-MetricsToJSON -Metrics $aggregateList -OutputPath $aggregateFile
    }
    else {
        Export-MetricsToJSON -Metrics @($phaseMetrics) -OutputPath $aggregateFile
    }

    return $phaseMetrics
}

