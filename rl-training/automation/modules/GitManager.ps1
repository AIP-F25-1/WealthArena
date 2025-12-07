# ==================================================================================================
# Module: GitManager.ps1
# Description: Git integration utilities for WealthArena automation system
# Author: Clifford Addison
# Company: WealthArena
# Year: 2025
# ==================================================================================================

Set-StrictMode -Version Latest

function Test-GitInstalled {
    [CmdletBinding()]
    param()

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw 'Git is not installed or not available in PATH.'
    }
    return $true
}

function Initialize-GitRepository {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $RepositoryUrl
    )

    if (-not (Test-Path '.git')) {
        git init | Out-Null
    }

    if ((git remote) -notcontains 'origin') {
        git remote add origin $RepositoryUrl | Out-Null
    }
}

function Add-GitRemote {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $RepositoryUrl
    )

    if ((git remote) -contains 'origin') {
        git remote set-url origin $RepositoryUrl | Out-Null
    }
    else {
        git remote add origin $RepositoryUrl | Out-Null
    }
}

function Switch-GitBranch {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $BranchName
    )

    $currentBranch = $null
    try {
        $currentBranch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($LASTEXITCODE -ne 0) {
            $currentBranch = $null
        }
    }
    catch {
        $currentBranch = $null
    }

    if (-not [string]::IsNullOrWhiteSpace($currentBranch) -and $currentBranch -eq $BranchName) {
        return
    }

    $branches = git branch --list $BranchName
    if ($branches) {
        git checkout $BranchName | Out-Null
    }
    else {
        git checkout -b $BranchName | Out-Null
    }
}

function Add-GitFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string[]] $Paths
    )

    if (-not $Paths -or $Paths.Count -eq 0) {
        return
    }

    $output = git add @Paths 2>&1
    if ($LASTEXITCODE -ne 0) {
        $message = if ($output) { ($output -join [Environment]::NewLine) } else { 'Unknown git add error.' }
        if ($message -match 'Filename too long') {
            Write-Warning ("Git add failed due to path length limitations. Ensure '.venv/' is listed in .gitignore and remove the directory from the index. Details: {0}" -f $message)
        }
        else {
            Write-Warning ("Git add failed: {0}" -f $message)
        }
    }
}

function Validate-CommitMessage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Message,
        [int] $MinWords,
        [int] $MaxWords
    )

    if (-not $PSBoundParameters.ContainsKey('MinWords')) {
        $MinWords = 3
    }
    if (-not $PSBoundParameters.ContainsKey('MaxWords')) {
        $MaxWords = 20
    }

    $wordCount = ($Message -split '\s+') | Where-Object { $_ -ne '' } | Measure-Object | Select-Object -ExpandProperty Count
    if ($wordCount -lt $MinWords -or $wordCount -gt $MaxWords) {
        throw "Commit message must be between $MinWords and $MaxWords words. Provided message has $wordCount words."
    }
    return $true
}

function Get-CommitMessageSuggestion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $PhaseId,
        [Parameter(Mandatory = $true)] $Step
    )

    if ($Step.commit_message) {
        return $Step.commit_message
    }

    $phaseNumber = ($PhaseId -replace '[^0-9]', '')
    if ([string]::IsNullOrWhiteSpace($phaseNumber)) {
        $phaseNumber = $PhaseId
    }

    $stepName = $Step.name
    if ([string]::IsNullOrWhiteSpace($stepName)) {
        $stepName = "step $($Step.id)"
    }

    return "Update phase $phaseNumber $stepName completed"
}

function New-GitCommit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Message,
        [switch] $DryRun
    )

    if ($DryRun) {
        return
    }

    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        return
    }

    $output = git commit -m $Message 2>&1
    if ($LASTEXITCODE -ne 0) {
        $message = if ($output) { ($output -join [Environment]::NewLine) } else { 'Unknown git commit error.' }
        Write-Warning ("Git commit failed: {0}" -f $message)
    }
}

function Push-GitChanges {
    [CmdletBinding()]
    param(
        [int] $RetryAttempts = 3,
        [int] $RetryDelaySeconds = 5
    )

    git rev-parse HEAD 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'No commits to push yet. Skipping git push.'
        return
    }

    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch) -or $branch -eq 'HEAD') {
        Write-Warning 'Unable to determine the current branch for git push. Ensure you are on a named branch.'
        return
    }

    $aheadTarget = "$branch" + "@{u}..HEAD"
    $aheadOutput = git rev-list --count $aheadTarget 2>$null
    if ($LASTEXITCODE -eq 0) {
        $aheadCount = 0
        if ([int]::TryParse(($aheadOutput | Select-Object -First 1), [ref]$aheadCount)) {
            if ($aheadCount -eq 0) {
                Write-Warning ("No new commits ahead of '{0}'; skipping git push." -f $branch)
                return
            }
        }
    }

    $attempt = 0
    while ($attempt -lt $RetryAttempts) {
        $attempt++
        $output = git push -u origin $branch 2>&1
        if ($LASTEXITCODE -eq 0) {
            return
        }

        if ($attempt -ge $RetryAttempts) {
            $message = if ($output) { ($output -join [Environment]::NewLine) } else { 'Unknown git push error.' }
            Write-Warning ("Git push to branch '{0}' failed after {1} attempt(s): {2}" -f $branch, $attempt, $message)
            return
        }

        $message = if ($output) { ($output -join [Environment]::NewLine) } else { '' }
        if ($message -match 'failed to push some refs' -or $message -match 'fetch first') {
            Write-Warning ("Push rejected because remote branch '{0}' is ahead. Attempting 'git pull --rebase origin {0}' before retrying." -f $branch)
            $pullOutput = git pull --rebase origin $branch 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Warning ("Rebase completed successfully; retrying push to '{0}'." -f $branch)
                $attempt--
                Start-Sleep -Seconds 1
                continue
            }
            else {
                $pullMessage = if ($pullOutput) { ($pullOutput -join [Environment]::NewLine) } else { 'Unknown git pull error.' }
                Write-Warning ("Automatic rebase before push failed: {0}" -f $pullMessage)
            }
        }

        Start-Sleep -Seconds ([Math]::Pow($RetryDelaySeconds, $attempt))
    }
}

function Get-GitStatus {
    [CmdletBinding()]
    param()

    $branch = ''
    try {
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
            $branch = 'No branch'
        }
    }
    catch {
        $branch = 'No branch'
    }

    $latestCommit = ''
    try {
        $latestCommit = git log -1 --pretty=format:'%H' 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($latestCommit)) {
            $latestCommit = 'No commits yet'
        }
    }
    catch {
        $latestCommit = 'No commits yet'
    }

    $changed = ''
    try {
        $changed = git status --short 2>$null
        if ($LASTEXITCODE -ne 0) {
            $changed = ''
        }
    }
    catch {
        $changed = ''
    }

    return @{
        branch        = $branch
        latest_commit = $latestCommit
        changed       = $changed
    }
}

