# Comprehensive script to merge changes to dev branch with proper commits
$ErrorActionPreference = 'Continue'

# Set git to not use pager
$env:GIT_PAGER = ''
$env:PAGER = ''
git config --local core.pager ''

Write-Host "=== Merging changes to dev branch ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check current branch and status
Write-Host "Step 1: Current branch and status" -ForegroundColor Yellow
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $currentBranch"
$statusOutput = & git status --porcelain 2>&1
if ($statusOutput) {
    Write-Host "Uncommitted changes detected"
    $statusOutput | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "No uncommitted changes"
}
Write-Host ""

# Step 2: Stash changes
Write-Host "Step 2: Stashing current changes" -ForegroundColor Yellow
& git stash push -m "Stash before switching to dev - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Stash may have failed or no changes to stash" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Fetch and checkout dev
Write-Host "Step 3: Fetching and switching to dev branch" -ForegroundColor Yellow
& git fetch origin 2>&1 | Out-Null

# Check if dev exists locally
$devLocal = & git show-ref --verify --quiet refs/heads/dev 2>&1; $localExists = $LASTEXITCODE -eq 0

# Check if dev exists on remote
$devRemote = & git show-ref --verify --quiet refs/remotes/origin/dev 2>&1; $remoteExists = $LASTEXITCODE -eq 0

if ($localExists) {
    Write-Host "Switching to existing local dev branch"
    & git checkout dev 2>&1 | Out-Null
    & git pull origin dev 2>&1 | Out-Null
} elseif ($remoteExists) {
    Write-Host "Creating local dev branch from origin/dev"
    & git checkout -b dev origin/dev 2>&1 | Out-Null
    & git pull origin dev 2>&1 | Out-Null
} else {
    Write-Host "Creating new dev branch"
    & git checkout -b dev 2>&1 | Out-Null
}
Write-Host ""

# Step 4: Apply stashed changes
Write-Host "Step 4: Applying stashed changes" -ForegroundColor Yellow
$stashList = & git stash list 2>&1
if ($stashList -match "Stash before switching") {
    & git stash pop 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Stash pop may have conflicts. Please resolve manually." -ForegroundColor Red
        Write-Host "Run 'git status' to see conflicts, then resolve and continue with commit_changes.ps1"
        exit 1
    }
    Write-Host "Stash applied successfully"
} else {
    Write-Host "No stash found to apply"
}
Write-Host ""

# Step 5: Check for conflicts
Write-Host "Step 5: Checking for merge conflicts" -ForegroundColor Yellow
$conflicts = & git diff --name-only --diff-filter=U 2>&1
if ($conflicts) {
    Write-Host "CONFLICTS DETECTED in the following files:" -ForegroundColor Red
    $conflicts | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Please resolve conflicts manually, then run commit_changes.ps1" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "No conflicts detected" -ForegroundColor Green
}
Write-Host ""

# Step 6: Show what will be committed
Write-Host "Step 6: Files ready to commit" -ForegroundColor Yellow
$statusOutput = & git status --porcelain 2>&1
if ($statusOutput) {
    $statusOutput | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "Ready to commit. Run commit_changes.ps1 next." -ForegroundColor Green
} else {
    Write-Host "No changes to commit" -ForegroundColor Yellow
}



