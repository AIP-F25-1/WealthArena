# Script to switch to dev branch and merge changes with proper commits
$ErrorActionPreference = 'Stop'

# Disable git pager completely
$env:GIT_PAGER = 'cat'
$env:PAGER = 'cat'
git config core.pager cat

Write-Host "Step 1: Checking current status..." -ForegroundColor Cyan
$status = git status --short 2>&1 | Out-String
Write-Host $status

Write-Host "`nStep 2: Stashing current changes..." -ForegroundColor Cyan
git stash push -m "Temporary stash before switching to dev branch"

Write-Host "`nStep 3: Fetching latest from origin..." -ForegroundColor Cyan
git fetch origin

Write-Host "`nStep 4: Switching to dev branch..." -ForegroundColor Cyan
# Try to checkout existing dev branch, or create from origin/dev, or create new
$devExists = git show-ref --verify --quiet refs/heads/dev 2>&1
$originDevExists = git show-ref --verify --quiet refs/remotes/origin/dev 2>&1

if ($LASTEXITCODE -eq 0 -and $devExists -eq $null) {
    git checkout dev 2>&1 | Out-String | Write-Host
    git pull origin dev 2>&1 | Out-String | Write-Host
} elseif ($LASTEXITCODE -eq 0 -and $originDevExists -eq $null) {
    git checkout -b dev origin/dev 2>&1 | Out-String | Write-Host
    git pull origin dev 2>&1 | Out-String | Write-Host
} else {
    Write-Host "Creating new dev branch..." -ForegroundColor Yellow
    git checkout -b dev 2>&1 | Out-String | Write-Host
}

Write-Host "`nStep 5: Applying stashed changes..." -ForegroundColor Cyan
git stash pop

Write-Host "`nStep 6: Checking for conflicts..." -ForegroundColor Cyan
$conflicts = git diff --name-only --diff-filter=U
if ($conflicts) {
    Write-Host "Conflicts detected in: $conflicts" -ForegroundColor Yellow
    Write-Host "Please resolve conflicts manually, then run the commit script." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nStep 7: Ready to commit changes. Run commit_changes.ps1 next." -ForegroundColor Green

