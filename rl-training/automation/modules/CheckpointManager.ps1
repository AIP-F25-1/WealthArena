# ==================================================================================================
# Module: CheckpointManager.ps1
# Description: Checkpoint management utilities for WealthArena automation system
# Author: Clifford Addison
# Company: WealthArena
# Year: 2025
# ==================================================================================================

Set-StrictMode -Version Latest

function ConvertTo-OrderedHashtable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $InputObject
    )

    if ($null -eq $InputObject) {
        return [ordered]@{}
    }

    if ($InputObject -is [System.Collections.IDictionary]) {
        $ordered = [ordered]@{}
        foreach ($key in $InputObject.Keys) {
            $ordered[$key] = $InputObject[$key]
        }
        return $ordered
    }

    $ordered = [ordered]@{}
    foreach ($property in $InputObject.PSObject.Properties) {
        $ordered[$property.Name] = $property.Value
    }
    return $ordered
}

function Test-ObjectHasKey {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Map,
        [Parameter(Mandatory = $true)][string] $Key
    )

    if ($null -eq $Map) {
        return $false
    }

    if ($Map -is [System.Collections.IDictionary]) {
        return $Map.Contains($Key)
    }

    $property = $Map.PSObject.Properties[$Key]
    return $null -ne $property
}

function Get-ObjectKeys {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Map
    )

    if ($null -eq $Map) {
        return @()
    }

    if ($Map -is [System.Collections.IDictionary]) {
        return $Map.Keys
    }

    return $Map.PSObject.Properties.Name
}

function Initialize-CheckpointSystem {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $CheckpointDirectory,
        [Parameter(Mandatory = $true)] $Configuration
    )

    if (-not (Test-Path $CheckpointDirectory)) {
        New-Item -ItemType Directory -Path $CheckpointDirectory | Out-Null
    }

    $state = [ordered]@{
        version     = '1.0'
        created     = (Get-Date).ToString('o')
        updated     = (Get-Date).ToString('o')
        author      = $Configuration.project.author
        project     = $Configuration.project.name
        phases      = [ordered]@{}
        git         = @{
            initialized  = $false
            branch       = $Configuration.git.branch
            last_commit  = ''
            commits_count= 0
        }
        environment = @{
            conda_env          = $Configuration.execution.conda_env_name
            python_version     = ''
            api_keys_configured= @()
        }
    }

    $initialPath = Join-Path -Path $CheckpointDirectory -ChildPath ("checkpoint_{0}.json" -f (Get-Date).ToString('yyyyMMdd_HHmmss'))
    $state | ConvertTo-Json -Depth 10 | Out-File -FilePath $initialPath -Encoding UTF8
    return $state
}

function Get-LatestCheckpoint {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $CheckpointDirectory
    )

    if (-not (Test-Path $CheckpointDirectory)) {
        throw "Checkpoint directory does not exist: $CheckpointDirectory"
    }

    $files = Get-ChildItem -Path $CheckpointDirectory -Filter 'checkpoint_*.json' | Sort-Object -Property Name -Descending
    if (-not $files) {
        throw "No checkpoint files found in $CheckpointDirectory"
    }

    $latest = $files[0]
    $state = Get-Content -Path $latest.FullName -Raw | ConvertFrom-Json

    if ($null -ne $state -and $state.PSObject.Properties.Match('phases').Count -gt 0) {
        $state.phases = ConvertTo-OrderedHashtable -InputObject $state.phases
        foreach ($phaseKey in Get-ObjectKeys -Map $state.phases) {
            $phase = $state.phases.$phaseKey
            if ($null -ne $phase -and $phase.PSObject.Properties.Match('steps').Count -gt 0) {
                $state.phases.$phaseKey.steps = ConvertTo-OrderedHashtable -InputObject $phase.steps
            }
        }
    }

    return $state
}

function New-Checkpoint {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $CheckpointDirectory,
        [Parameter(Mandatory = $true)] $State,
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [Parameter(Mandatory = $true)][string] $StepId,
        [string] $PhaseName,
        [hashtable] $Metrics = @{}
    )

    if ($State.PSObject.Properties.Match('phases').Count -gt 0 -and $State.phases -isnot [System.Collections.IDictionary]) {
        $State.phases = ConvertTo-OrderedHashtable -InputObject $State.phases
        foreach ($phaseKey in Get-ObjectKeys -Map $State.phases) {
            $phase = $State.phases.$phaseKey
            if ($null -ne $phase -and $phase.PSObject.Properties.Match('steps').Count -gt 0 -and $phase.steps -isnot [System.Collections.IDictionary]) {
                $State.phases.$phaseKey.steps = ConvertTo-OrderedHashtable -InputObject $phase.steps
            }
        }
    }
    elseif ($State.PSObject.Properties.Match('phases').Count -eq 0 -or $null -eq $State.phases) {
        $State | Add-Member -NotePropertyName 'phases' -NotePropertyValue ([ordered]@{}) -Force
    }

    if (-not (Test-ObjectHasKey -Map $State.phases -Key $PhaseId)) {
        $State.phases.$PhaseId = @{
            name      = if ($PhaseName) { $PhaseName } else { $PhaseId }
            status    = 'in_progress'
            started   = (Get-Date).ToString('o')
            completed = $null
            steps     = @{}
        }
    }
    elseif ($PhaseName -and [string]::IsNullOrWhiteSpace($State.phases.$PhaseId.name)) {
        $State.phases.$PhaseId.name = $PhaseName
    }

    $State.phases.$PhaseId.steps.$StepId = @{
        status    = 'completed'
        timestamp = (Get-Date).ToString('o')
        metrics   = $Metrics
    }

    $State.updated = (Get-Date).ToString('o')
    $checkpointPath = Join-Path -Path $CheckpointDirectory -ChildPath ("checkpoint_{0}.json" -f (Get-Date).ToString('yyyyMMdd_HHmmss'))
    $State | ConvertTo-Json -Depth 20 | Out-File -FilePath $checkpointPath -Encoding UTF8
    return $State
}

function Complete-Phase {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $State,
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [string] $PhaseName
    )

    if ($State.PSObject.Properties.Match('phases').Count -gt 0 -and $State.phases -isnot [System.Collections.IDictionary]) {
        $State.phases = ConvertTo-OrderedHashtable -InputObject $State.phases
        foreach ($phaseKey in Get-ObjectKeys -Map $State.phases) {
            $phase = $State.phases.$phaseKey
            if ($null -ne $phase -and $phase.PSObject.Properties.Match('steps').Count -gt 0 -and $phase.steps -isnot [System.Collections.IDictionary]) {
                $State.phases.$phaseKey.steps = ConvertTo-OrderedHashtable -InputObject $phase.steps
            }
        }
    }
    elseif ($State.PSObject.Properties.Match('phases').Count -eq 0 -or $null -eq $State.phases) {
        $State | Add-Member -NotePropertyName 'phases' -NotePropertyValue ([ordered]@{}) -Force
    }

    if (-not (Test-ObjectHasKey -Map $State.phases -Key $PhaseId)) {
        $State.phases.$PhaseId = @{
            name      = if ($PhaseName) { $PhaseName } else { $PhaseId }
            status    = 'completed'
            started   = (Get-Date).ToString('o')
            completed = (Get-Date).ToString('o')
            steps     = @{}
        }
    }
    else {
        if ($PhaseName -and [string]::IsNullOrWhiteSpace($State.phases.$PhaseId.name)) {
            $State.phases.$PhaseId.name = $PhaseName
        }
        if (-not $State.phases.$PhaseId.started) {
            $State.phases.$PhaseId.started = (Get-Date).ToString('o')
        }
        $State.phases.$PhaseId.status = 'completed'
        $State.phases.$PhaseId.completed = (Get-Date).ToString('o')
    }

    $State.updated = (Get-Date).ToString('o')
    return $State
}

function Update-Checkpoint {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $CheckpointDirectory,
        [Parameter(Mandatory = $true)] $State
    )

    $State.updated = (Get-Date).ToString('o')
    $checkpointPath = Join-Path -Path $CheckpointDirectory -ChildPath ("checkpoint_{0}.json" -f (Get-Date).ToString('yyyyMMdd_HHmmss'))
    $State | ConvertTo-Json -Depth 20 | Out-File -FilePath $checkpointPath -Encoding UTF8
    return $State
}

function Test-StepCompleted {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $State,
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [string] $StepId
    )

    if (-not (Test-ObjectHasKey -Map $State.phases -Key $PhaseId)) {
        return $false
    }

    if ([string]::IsNullOrWhiteSpace($StepId)) {
        return $State.phases.$PhaseId.status -eq 'completed'
    }

    return Test-ObjectHasKey -Map $State.phases.$PhaseId.steps -Key $StepId
}

function Get-CheckpointHistory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $CheckpointDirectory
    )

    if (-not (Test-Path $CheckpointDirectory)) {
        return @()
    }

    return Get-ChildItem -Path $CheckpointDirectory -Filter 'checkpoint_*.json' | Sort-Object -Property CreationTime -Descending
}

function Remove-OldCheckpoints {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $CheckpointDirectory,
        [string] $BackupDirectory,
        [int] $MaxToKeep = 5,
        [int] $MaxAgeDays = 30
    )

    if (-not (Test-Path $CheckpointDirectory)) {
        return
    }

    if ($BackupDirectory -and -not (Test-Path $BackupDirectory)) {
        New-Item -ItemType Directory -Path $BackupDirectory | Out-Null
    }

    $checkpoints = @(Get-ChildItem -Path $CheckpointDirectory -Filter 'checkpoint_*.json' | Sort-Object -Property CreationTime -Descending)
    $toRemove = @()

    if ($checkpoints.Count -gt $MaxToKeep) {
        $toRemove += $checkpoints[$MaxToKeep..($checkpoints.Count - 1)]
    }

    foreach ($file in $checkpoints) {
        if ((Get-Date) - $file.CreationTime -gt [TimeSpan]::FromDays($MaxAgeDays)) {
            if ($toRemove -notcontains $file) {
                $toRemove += $file
            }
        }
    }

    foreach ($file in $toRemove) {
        if ($BackupDirectory) {
            Copy-Item -Path $file.FullName -Destination $BackupDirectory -Force
        }
        Remove-Item -Path $file.FullName -Force
    }
}

function Add-OptionalStepFailure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $State,
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [Parameter(Mandatory = $true)][string] $StepId,
        [Parameter(Mandatory = $true)][string] $StepName,
        [Parameter(Mandatory = $true)][string] $ErrorMessage,
        [int] $AttemptCount = 0
    )

    if ($State.PSObject.Properties.Match('phases').Count -gt 0 -and $State.phases -isnot [System.Collections.IDictionary]) {
        $State.phases = ConvertTo-OrderedHashtable -InputObject $State.phases
        foreach ($phaseKey in Get-ObjectKeys -Map $State.phases) {
            $phase = $State.phases.$phaseKey
            if ($null -ne $phase -and $phase.PSObject.Properties.Match('steps').Count -gt 0 -and $phase.steps -isnot [System.Collections.IDictionary]) {
                $State.phases.$phaseKey.steps = ConvertTo-OrderedHashtable -InputObject $phase.steps
            }
        }
    }
    elseif ($State.PSObject.Properties.Match('phases').Count -eq 0 -or $null -eq $State.phases) {
        $State | Add-Member -NotePropertyName 'phases' -NotePropertyValue ([ordered]@{}) -Force
    }

    if (-not (Test-ObjectHasKey -Map $State.phases -Key $PhaseId)) {
        $State.phases.$PhaseId = @{
            name      = $PhaseId
            status    = 'in_progress'
            started   = (Get-Date).ToString('o')
            completed = $null
            steps     = @{}
            optional_failures = @()
        }
    }

    # Initialize optional_failures array if it doesn't exist
    if (-not (Test-ObjectHasKey -Map $State.phases.$PhaseId -Key 'optional_failures')) {
        $State.phases.$PhaseId.optional_failures = @()
    }
    elseif ($State.phases.$PhaseId.optional_failures -isnot [System.Collections.IList]) {
        $State.phases.$PhaseId.optional_failures = @($State.phases.$PhaseId.optional_failures)
    }

    # Create failure record
    $failureRecord = @{
        step_id       = $StepId
        step_name     = $StepName
        failed_at     = (Get-Date).ToString('o')
        error_message = $ErrorMessage
        attempt_count = $AttemptCount
    }

    # Add failure record to array
    $State.phases.$PhaseId.optional_failures += $failureRecord

    $State.updated = (Get-Date).ToString('o')
    return $State
}

function Get-OptionalStepFailures {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $State,
        [Parameter(Mandatory = $true)][string] $PhaseId
    )

    if (-not (Test-ObjectHasKey -Map $State.phases -Key $PhaseId)) {
        return @()
    }

    $phase = $State.phases.$PhaseId
    if (-not (Test-ObjectHasKey -Map $phase -Key 'optional_failures')) {
        return @()
    }

    $failures = $phase.optional_failures
    if ($null -eq $failures) {
        return @()
    }

    if ($failures -isnot [System.Collections.IList]) {
        return @($failures)
    }

    return $failures
}

function Export-CheckpointReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $State,
        [Parameter(Mandatory = $true)][string] $OutputPath
    )

    $reportLines = @()
    $reportLines += "Checkpoint Version: $($State.version)"
    $reportLines += "Author: $($State.author)"
    $reportLines += "Project: $($State.project)"
    $reportLines += "Created: $($State.created)"
    $reportLines += "Updated: $($State.updated)"
    $reportLines += ''
    $reportLines += 'Phases:'

    foreach ($phaseKey in (Get-ObjectKeys -Map $State.phases | Sort-Object)) {
        $phase = $State.phases.$phaseKey
        $reportLines += "  - $phaseKey ($($phase.status))"
        foreach ($stepKey in (Get-ObjectKeys -Map $phase.steps | Sort-Object)) {
            $step = $phase.steps.$stepKey
            $reportLines += ("      * Step {0}: {1} at {2}" -f $stepKey, $step.status, $step.timestamp)
        }
        if (Test-ObjectHasKey -Map $phase -Key 'optional_failures' -and $phase.optional_failures.Count -gt 0) {
            $reportLines += "      * Optional Failures: $($phase.optional_failures.Count)"
            foreach ($failure in $phase.optional_failures) {
                $reportLines += ("        - {0} (Step {1}): {2}" -f $failure.step_name, $failure.step_id, $failure.error_message)
            }
        }
    }

    $reportLines | Out-File -FilePath $OutputPath -Encoding UTF8
}

