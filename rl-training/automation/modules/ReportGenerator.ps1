# ==================================================================================================
# Module: ReportGenerator.ps1
# Description: Progress report generation utilities for WealthArena automation system
# Author: Clifford Addison
# Company: WealthArena
# Year: 2025
# ==================================================================================================

Set-StrictMode -Version Latest

function Format-MarkdownTable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Headers,
        [Parameter(Mandatory = $true)] $Rows
    )

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("| $($Headers -join ' | ') |")
    [void]$sb.AppendLine("|$(([string]::Join('|', ($Headers | ForEach-Object { '---' }))))|")
    foreach ($row in $Rows) {
        [void]$sb.AppendLine("| $([string]::Join(' | ', $row)) |")
    }
    return $sb.ToString().Trim()
}

function Get-MetricsJson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        [Parameter(Mandatory = $true)][string] $FileName
    )

    $path = Join-Path -Path $MetricsDirectory -ChildPath $FileName
    if (-not (Test-Path $path)) {
        return $null
    }
    return Get-Content -Path $path -Raw | ConvertFrom-Json
}

function Format-DisplayValue {
    [CmdletBinding()]
    param(
        $Value,
        [string] $Format = 'N2',
        [string] $Suffix = '',
        [switch] $Percent
    )

    if ($null -eq $Value -or $Value -eq '') {
        return '-'
    }

    try {
        $number = [double]$Value
        $composite = ('{0:' + $Format + '}')
        $formatted = $composite -f $number
        if ($Percent) {
            return "$formatted%"
        }
        return "$formatted$Suffix"
    }
    catch {
        return $Value.ToString()
    }
}

function Add-ProjectBoardItems {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $CheckpointState
    )

    [void]$ReportBuilder.AppendLine('## Project Board Items')
    [void]$ReportBuilder.AppendLine('- [ ] Review latest checkpoints')
    [void]$ReportBuilder.AppendLine('- [ ] Validate metrics completeness')
    [void]$ReportBuilder.AppendLine('- [ ] Schedule advisor sync meeting')
    [void]$ReportBuilder.AppendLine('')
}

function Add-FeaturesTable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $CheckpointState
    )

    [void]$ReportBuilder.AppendLine('## Features Developed')
    $rows = @()
    foreach ($phaseKey in $CheckpointState.phases.Keys) {
        $phase = $CheckpointState.phases.$phaseKey
        $status = if ($phase.status -eq 'completed') { 'Completed' } else { 'In Progress' }
        $rows += ,@(
            $phase.name,
            $status,
            $phaseKey,
            $phase.completed
        )
    }
    if ($rows.Count -eq 0) {
        $rows += ,@(
            'No data',
            '-',
            '-',
            '-'
        )
    }
    [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Feature','Status','Phase','Completion Date') -Rows $rows))
    [void]$ReportBuilder.AppendLine('')
}

function Add-DataStoreMetricsSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $MetricsDirectory
    )

    [void]$ReportBuilder.AppendLine('### Data Store Metrics')
    $dataStoreMetrics = Get-MetricsJson -MetricsDirectory $MetricsDirectory -FileName 'datastore.json'
    if (-not $dataStoreMetrics) {
        [void]$ReportBuilder.AppendLine('No data store metrics available.')
        [void]$ReportBuilder.AppendLine('')
        return
    }

    $rows = @()
    foreach ($storeName in $dataStoreMetrics.PSObject.Properties.Name) {
        $store = $dataStoreMetrics.$storeName
        $displayName = if ($store -and ($store.PSObject.Properties.Name -contains 'name') -and -not [string]::IsNullOrWhiteSpace($store.name)) { $store.name } else { $storeName }
        $rows += ,@(
            $displayName,
            (Format-DisplayValue -Value $store.index_usage_percent -Format 'N1' -Percent),
            (Format-DisplayValue -Value $store.disk_usage_gb -Format 'N2'),
            (Format-DisplayValue -Value $store.estimated_cpu_percent -Format 'N1' -Percent),
            (Format-DisplayValue -Value $store.estimated_memory_gb -Format 'N2' -Suffix ' GB'),
            (Format-DisplayValue -Value $store.file_count -Format 'N0'),
            (Format-DisplayValue -Value $store.error_rate_percent -Format 'N3' -Percent)
        )
    }

    [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Data Store','Index Usage %','Disk Usage GB','Avg CPU %','Avg Memory GB','File Count','Error Rate %') -Rows $rows))
    [void]$ReportBuilder.AppendLine('')
}

function Add-PipelineMetricsSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $MetricsDirectory
    )

    [void]$ReportBuilder.AppendLine('### Pipeline Metrics')
    $pipelineMetrics = Get-MetricsJson -MetricsDirectory $MetricsDirectory -FileName 'pipeline.json'
    if (-not $pipelineMetrics) {
        [void]$ReportBuilder.AppendLine('No pipeline metrics available.')
        [void]$ReportBuilder.AppendLine('')
        return
    }

    $componentRows = @()
    $dagRows = @()

    foreach ($component in $pipelineMetrics.PSObject.Properties.Name) {
        if ($component.StartsWith('_')) {
            continue
        }
        $metrics = $pipelineMetrics.$component
        $componentRows += ,@(
            $component,
            (Format-DisplayValue -Value $metrics.response_time_seconds -Format 'N2'),
            (Format-DisplayValue -Value $metrics.error_rate_percent -Format 'N2' -Percent),
            (Format-DisplayValue -Value $metrics.cpu_utilization_percent -Format 'N1' -Percent),
            (Format-DisplayValue -Value $metrics.memory_utilization_gb -Format 'N2' -Suffix ' GB'),
            (Format-DisplayValue -Value $metrics.disk_io_mbps -Format 'N2')
        )

        if ($metrics.dag_success_rate_percent -or $metrics.task_failure_rate_percent -or $metrics.avg_duration_minutes -or $metrics.duration_variability_minutes) {
            $dagRows += ,@(
                $component,
                (Format-DisplayValue -Value $metrics.dag_success_rate_percent -Format 'N2' -Percent),
                (Format-DisplayValue -Value $metrics.task_failure_rate_percent -Format 'N2' -Percent),
                (Format-DisplayValue -Value $metrics.avg_duration_minutes -Format 'N2'),
                (Format-DisplayValue -Value $metrics.duration_variability_minutes -Format 'N2')
            )
        }
    }

    [void]$ReportBuilder.AppendLine('### Component Performance')
    [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Component','Response Time (s)','Error Rate %','CPU Util %','Memory Util GB','Disk I/O MBps') -Rows $componentRows))
    [void]$ReportBuilder.AppendLine('')

    if ($dagRows.Count -gt 0) {
        [void]$ReportBuilder.AppendLine('### DAG Execution Metrics')
        [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Pipeline','Success Rate %','Task Failure %','Avg Duration (min)','Duration Variability (min)') -Rows $dagRows))
        [void]$ReportBuilder.AppendLine('')
    }

    if ($pipelineMetrics._summary) {
        $summary = $pipelineMetrics._summary
        [void]$ReportBuilder.AppendLine('Average response time across pipelines: {0}s' -f (Format-DisplayValue -Value $summary.average_response_time_seconds -Format 'N2'))
        [void]$ReportBuilder.AppendLine('Peak response time observed: {0}s' -f (Format-DisplayValue -Value $summary.max_response_time_seconds -Format 'N2'))
        [void]$ReportBuilder.AppendLine('')
    }
}

function Add-ScrapingMetricsSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $MetricsDirectory
    )

    [void]$ReportBuilder.AppendLine('### Scraping Metrics')
    $scrapingMetrics = Get-MetricsJson -MetricsDirectory $MetricsDirectory -FileName 'scraping.json'
    if (-not $scrapingMetrics) {
        [void]$ReportBuilder.AppendLine('No scraping metrics available.')
        [void]$ReportBuilder.AppendLine('')
        return
    }

    $rows = @()
    foreach ($source in $scrapingMetrics.PSObject.Properties.Name) {
        $metrics = $scrapingMetrics.$source
        $rows += ,@(
            $source,
            (Format-DisplayValue -Value $metrics.success_percent -Format 'N2' -Percent),
            (Format-DisplayValue -Value $metrics.blocked_percent -Format 'N2' -Percent),
            (Format-DisplayValue -Value $metrics.error_rate_percent -Format 'N2' -Percent),
            (Format-DisplayValue -Value $metrics.throughput_per_minute -Format 'N1'),
            (Format-DisplayValue -Value $metrics.data_loss_percent -Format 'N2' -Percent),
            (Format-DisplayValue -Value $metrics.avg_response_time_seconds -Format 'N2'),
            (Format-DisplayValue -Value $metrics.ip_blocks -Format 'N0'),
            (Format-DisplayValue -Value $metrics.pages_scraped -Format 'N0')
        )
    }

    [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Website','Success %','Blocked %','Error Rate %','Throughput /min','Data Loss %','Response Time (s)','IP Blocks','Pages Scraped') -Rows $rows))
    [void]$ReportBuilder.AppendLine('')
}

function Add-MLMetricsSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $MetricsDirectory
    )

    [void]$ReportBuilder.AppendLine('### ML Metrics')
    $mlMetrics = Get-MetricsJson -MetricsDirectory $MetricsDirectory -FileName 'ml.json'
    if (-not $mlMetrics) {
        [void]$ReportBuilder.AppendLine('No ML metrics available.')
        [void]$ReportBuilder.AppendLine('')
        return
    }

    $rows = @()
    $modelMetrics = @{}
    if ($mlMetrics.backtests) {
        $modelMetrics = $mlMetrics.backtests
    }
    elseif ($mlMetrics.experiments) {
        $modelMetrics = $mlMetrics.experiments
    }

    foreach ($modelName in $modelMetrics.PSObject.Properties.Name) {
        $metrics = $modelMetrics.$modelName
        $baselineKeys = @('inference_time_ms','sharpe_ratio','max_drawdown_percent','win_rate_percent')
        $otherPairs = @()
        foreach ($property in $metrics.PSObject.Properties.Name) {
            if ($baselineKeys -notcontains $property) {
                $otherPairs += ("{0}: {1}" -f $property, $metrics.$property)
            }
        }

        $rows += ,@(
            $modelName,
            (Format-DisplayValue -Value $metrics.inference_time_ms -Format 'N2'),
            (Format-DisplayValue -Value $metrics.sharpe_ratio -Format 'N2'),
            (Format-DisplayValue -Value $metrics.max_drawdown_percent -Format 'N2' -Percent),
            (Format-DisplayValue -Value $metrics.win_rate_percent -Format 'N2' -Percent),
            ($otherPairs -join '; ')
        )
    }

    if ($rows.Count -eq 0) {
        $rows += ,@(
            'No tracked models',
            '-',
            '-',
            '-',
            '-',
            '-'
        )
    }

    [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Model','Inference Time (ms)','Sharpe Ratio','Max Drawdown %','Win Rate %','Other Metrics') -Rows $rows))
    [void]$ReportBuilder.AppendLine('')
}

function Add-CodeMetricsSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $MetricsDirectory
    )

    [void]$ReportBuilder.AppendLine('### Code Quality Metrics (SonarQube)')
    $codeMetrics = Get-MetricsJson -MetricsDirectory $MetricsDirectory -FileName 'sonar-report.json'
    if (-not $codeMetrics) {
        [void]$ReportBuilder.AppendLine('No SonarQube metrics available.')
        [void]$ReportBuilder.AppendLine('')
        return
    }

    $measures = $codeMetrics.measures
    $hasMeasures = $measures -and $measures.PSObject.Properties.Name.Count -gt 0
    $rows = @()
    if ($hasMeasures) {
        $rows += ,@(
            'Overall',
            (Format-DisplayValue -Value $measures.complexity -Format 'N0'),
            (Format-DisplayValue -Value $measures.duplicated_lines_density -Format 'N2' -Percent),
            (Format-DisplayValue -Value $measures.code_smells -Format 'N0'),
            (Format-DisplayValue -Value $measures.coverage -Format 'N2' -Percent)
        )
    }
    else {
        $rows += ,@(
            'Overall',
            '-',
            '-',
            '-',
            '-'
        )
    }

    [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Module','Cyclomatic Complexity','Duplication Rate','Technical Debt','Test Coverage') -Rows $rows))
    [void]$ReportBuilder.AppendLine('')
}
function Add-TestCasesSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $MetricsDirectory
    )

    [void]$ReportBuilder.AppendLine('## Test Cases Summary')
    $testMetricsPath = Join-Path -Path $MetricsDirectory -ChildPath 'test.json'
    if (Test-Path $testMetricsPath) {
        $metrics = Get-Content -Path $testMetricsPath -Raw | ConvertFrom-Json
        if ($metrics.summary) {
            $summary = $metrics.summary
            $summaryRows = @(
                @(
                    'Suite',
                    (Format-DisplayValue -Value $summary.total_tests -Format 'N0'),
                    (Format-DisplayValue -Value $summary.passed -Format 'N0'),
                    (Format-DisplayValue -Value $summary.failed -Format 'N0'),
                    (Format-DisplayValue -Value $summary.skipped -Format 'N0'),
                    (Format-DisplayValue -Value $summary.coverage_percent -Format 'N2' -Percent)
                )
            )
            [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Scope','Total Tests','Passed','Failed','Skipped','Coverage %') -Rows $summaryRows))
            [void]$ReportBuilder.AppendLine('')
        }

        if ($metrics.by_module) {
            $moduleRows = @()
            foreach ($moduleName in $metrics.by_module.PSObject.Properties.Name) {
                $module = $metrics.by_module.$moduleName
                $moduleRows += ,@(
                    $moduleName,
                    (Format-DisplayValue -Value $module.coverage_percent -Format 'N2' -Percent),
                    (Format-DisplayValue -Value $module.failure_rate_percent -Format 'N2' -Percent),
                    (Format-DisplayValue -Value $module.bugs_detected -Format 'N0'),
                    (Format-DisplayValue -Value $module.tests_passed -Format 'N0'),
                    (Format-DisplayValue -Value $module.tests_failed -Format 'N0')
                )
            }
            [void]$ReportBuilder.AppendLine('### Module-Level Results')
            [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Module','Coverage %','Failure Rate %','Bugs Detected','Passed','Failed') -Rows $moduleRows))
            [void]$ReportBuilder.AppendLine('')
        }

        [void]$ReportBuilder.AppendLine('### Fixed/Passed Since Last Report')
        foreach ($item in $metrics.fixed_since_last) {
            [void]$ReportBuilder.AppendLine("- $item")
        }
        [void]$ReportBuilder.AppendLine('')
        [void]$ReportBuilder.AppendLine('### Still Failing')
        foreach ($item in $metrics.still_failing) {
            [void]$ReportBuilder.AppendLine("- $item")
        }
        [void]$ReportBuilder.AppendLine('')
        [void]$ReportBuilder.AppendLine('### New Failing (Since Last Report)')
        foreach ($item in $metrics.new_failures) {
            [void]$ReportBuilder.AppendLine("- $item")
        }
    }
    else {
        [void]$ReportBuilder.AppendLine('No test metrics available.')
    }
    [void]$ReportBuilder.AppendLine('')
}

function Add-MetricsSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $MetricsDirectory
    )

    [void]$ReportBuilder.AppendLine('## Metrics Overview')
    Add-DataStoreMetricsSection -ReportBuilder $ReportBuilder -MetricsDirectory $MetricsDirectory
    Add-PipelineMetricsSection -ReportBuilder $ReportBuilder -MetricsDirectory $MetricsDirectory
    Add-ScrapingMetricsSection -ReportBuilder $ReportBuilder -MetricsDirectory $MetricsDirectory
    Add-MLMetricsSection -ReportBuilder $ReportBuilder -MetricsDirectory $MetricsDirectory
    Add-CodeMetricsSection -ReportBuilder $ReportBuilder -MetricsDirectory $MetricsDirectory
    [void]$ReportBuilder.AppendLine('')
}

function Add-DocumentationSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder
    )

    [void]$ReportBuilder.AppendLine('## Documentation Coverage')
    [void]$ReportBuilder.AppendLine('- Completed: Architecture documentation, API reference for data module')
    [void]$ReportBuilder.AppendLine('- Pending: Deployment guide, Troubleshooting for SAC training')
    [void]$ReportBuilder.AppendLine('')
}

function Add-DeploymentSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder
    )

    [void]$ReportBuilder.AppendLine('## Deployment Readiness')
    [void]$ReportBuilder.AppendLine('- [x] Environment setup automated')
    [void]$ReportBuilder.AppendLine('- [x] Data pipeline operational')
    [void]$ReportBuilder.AppendLine('- [ ] Model serving configured')
    [void]$ReportBuilder.AppendLine('- [ ] Paper trading tested')
    [void]$ReportBuilder.AppendLine('')
}

function Add-OptionalStepsStatusSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $CheckpointState,
        [Parameter(Mandatory = $true)][string] $PhaseId
    )

    [void]$ReportBuilder.AppendLine('## Optional Steps Status')
    
    try {
        $optionalFailures = Get-OptionalStepFailures -State $CheckpointState -PhaseId $PhaseId
        if ($optionalFailures -and $optionalFailures.Count -gt 0) {
            foreach ($failure in $optionalFailures) {
                $stepName = $failure.step_name
                $stepId = $failure.step_id
                $errorMessage = $failure.error_message
                $attemptCount = $failure.attempt_count
                $failedAt = $failure.failed_at
                
                [void]$ReportBuilder.AppendLine("")
                [void]$ReportBuilder.AppendLine("⚠️ **$stepName** - Failed after $attemptCount attempts")
                [void]$ReportBuilder.AppendLine("- Step ID: $stepId")
                [void]$ReportBuilder.AppendLine("- Reason: $errorMessage")
                [void]$ReportBuilder.AppendLine("- Failed at: $failedAt")
                [void]$ReportBuilder.AppendLine("- Impact: Pipeline continued without this data")
                
                if ($stepName -like '*Options*') {
                    $retryCmd = 'python scripts/collect_options.py --config config/data_config.yaml'
                    [void]$ReportBuilder.AppendLine(('- Retry: {0}{1}{0}' -f [char]0x60, $retryCmd))
                }
            }
        }
        else {
            [void]$ReportBuilder.AppendLine('No optional step failures recorded.')
        }
    }
    catch {
        [void]$ReportBuilder.AppendLine('Unable to retrieve optional step failures.')
    }
    
    [void]$ReportBuilder.AppendLine('')
}

function Add-TimeTrackingSection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $ReportBuilder,
        [Parameter(Mandatory = $true)] $Configuration
    )

    [void]$ReportBuilder.AppendLine('## Time Tracking')
    $rows = @()
    foreach ($phaseKey in $Configuration.phases.PSObject.Properties.Name) {
        $phase = $Configuration.phases.$phaseKey
        $status = if ($phase.enabled) { 'Enabled' } else { 'Disabled' }
        $rows += ,@(
            $phase.name,
            $phase.estimated_time_hours,
            '-',
            '-',
            $status
        )
    }
    [void]$ReportBuilder.AppendLine((Format-MarkdownTable -Headers @('Phase','Estimated Time','Actual Time','Variance','Status') -Rows $rows))
    [void]$ReportBuilder.AppendLine('')
}

function Export-ReportToMarkdown {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Content,
        [Parameter(Mandatory = $true)][string] $ReportsDirectory,
        [string] $PhaseId = 'final',
        [string] $PublicDirectory
    )

    if (-not (Test-Path $ReportsDirectory)) {
        New-Item -ItemType Directory -Path $ReportsDirectory | Out-Null
    }

    $fileName = if ($PhaseId -eq 'final') {
        "progress_report_{0}.md" -f (Get-Date).ToString('yyyyMMdd')
    }
    else {
        "progress_report_{0}_{1}.md" -f $PhaseId, (Get-Date).ToString('yyyyMMdd_HHmmss')
    }

    $filePath = Join-Path -Path $ReportsDirectory -ChildPath $fileName
    $Content | Out-File -FilePath $filePath -Encoding UTF8
    if ($PublicDirectory) {
        if (-not (Test-Path $PublicDirectory)) {
            New-Item -ItemType Directory -Path $PublicDirectory | Out-Null
        }
        Copy-Item -Path $filePath -Destination (Join-Path -Path $PublicDirectory -ChildPath $fileName) -Force
    }
    return $filePath
}

function Export-ReportToJSON {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Data,
        [Parameter(Mandatory = $true)][string] $ReportsDirectory,
        [string] $PublicDirectory
    )

    if (-not (Test-Path $ReportsDirectory)) {
        New-Item -ItemType Directory -Path $ReportsDirectory | Out-Null
    }

    $filePath = Join-Path -Path $ReportsDirectory -ChildPath ("progress_report_{0}.json" -f (Get-Date).ToString('yyyyMMdd_HHmmss'))
    $Data | ConvertTo-Json -Depth 20 | Out-File -FilePath $filePath -Encoding UTF8
    if ($PublicDirectory) {
        if (-not (Test-Path $PublicDirectory)) {
            New-Item -ItemType Directory -Path $PublicDirectory | Out-Null
        }
        Copy-Item -Path $filePath -Destination (Join-Path -Path $PublicDirectory -ChildPath (Split-Path -Path $filePath -Leaf)) -Force
    }
    return $filePath
}

function New-ProgressReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [Parameter(Mandatory = $true)] $CheckpointState,
        [Parameter(Mandatory = $true)][string] $MetricsDirectory,
        [Parameter(Mandatory = $true)][string] $ReportsDirectory,
        [Parameter(Mandatory = $true)] $GitRepositoryStatus,
        $Configuration = $null,
        [switch] $DryRun
    )

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.AppendLine('# WealthArena RL Trading System - Progress Report')
    [void]$builder.AppendLine('')
    [void]$builder.AppendLine('**Author**: Clifford Addison')
    [void]$builder.AppendLine("**Date**: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))")
    [void]$builder.AppendLine('**Project**: WealthArena Agentic RL Trading System')
    [void]$builder.AppendLine('**Year**: 2025')
    [void]$builder.AppendLine('')
    [void]$builder.AppendLine('## Executive Summary')
    [void]$builder.AppendLine("Phase processed: $PhaseId")
    [void]$builder.AppendLine('')

    Add-ProjectBoardItems -ReportBuilder $builder -CheckpointState $CheckpointState
    [void]$builder.AppendLine('## Git Repository Status')
    [void]$builder.AppendLine("- Branch: $($GitRepositoryStatus.branch)")
    [void]$builder.AppendLine("- Latest Commit: $($GitRepositoryStatus.latest_commit)")
    [void]$builder.AppendLine('')

    Add-FeaturesTable -ReportBuilder $builder -CheckpointState $CheckpointState
    Add-OptionalStepsStatusSection -ReportBuilder $builder -CheckpointState $CheckpointState -PhaseId $PhaseId
    Add-TestCasesSection -ReportBuilder $builder -MetricsDirectory $MetricsDirectory
    Add-MetricsSection -ReportBuilder $builder -MetricsDirectory $MetricsDirectory
    if ($Configuration) {
        Add-TimeTrackingSection -ReportBuilder $builder -Configuration $Configuration
    }
    Add-DocumentationSection -ReportBuilder $builder
    Add-DeploymentSection -ReportBuilder $builder

    if (-not $DryRun) {
        $publicDirectory = Join-Path -Path $ReportsDirectory -ChildPath 'public'
        $markdownPath = Export-ReportToMarkdown -Content $builder.ToString() -ReportsDirectory $ReportsDirectory -PhaseId $PhaseId -PublicDirectory $publicDirectory
        $jsonPath = Export-ReportToJSON -Data @{
            phase = $PhaseId
            generated_on = (Get-Date).ToString('o')
            git = $GitRepositoryStatus
        } -ReportsDirectory $ReportsDirectory -PublicDirectory $publicDirectory
        return @{
            markdown = $markdownPath
            json     = $jsonPath
        }
    }

    return @{
        markdown = ''
        json     = ''
    }
}

