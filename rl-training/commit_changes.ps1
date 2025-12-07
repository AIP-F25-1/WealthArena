# Script to commit changes with proper messages based on edits
$ErrorActionPreference = 'Stop'

# Disable git pager completely
$env:GIT_PAGER = 'cat'
$env:PAGER = 'cat'
git config core.pager cat

Write-Host "Committing changes with proper messages..." -ForegroundColor Cyan

# Commit 1: Fix forex identifier mismatch
Write-Host "`nCommit 1: Fixing forex identifier normalization..." -ForegroundColor Yellow
git add scripts/process_bronze_to_silver.py src/data/processors.py
git commit -m "Fix forex identifier mismatch by normalizing pairs with =X suffix"

# Commit 2: Add bronze data discovery fallbacks
Write-Host "`nCommit 2: Adding bronze data discovery fallbacks..." -ForegroundColor Yellow
git add scripts/process_bronze_to_silver.py
git commit -m "Add bronze data discovery fallback for stocks ETFs and macro when catalogs missing"

# Commit 3: Enhance processors with helper functions
Write-Host "`nCommit 3: Enhancing processors with helper functions..." -ForegroundColor Yellow
git add src/data/processors.py
git commit -m "Enhance processors with identifier validation and discovery methods"

# Commit 4: Improve Silver to Gold processing
Write-Host "`nCommit 4: Improving Silver to Gold processing..." -ForegroundColor Yellow
git add scripts/process_silver_to_gold.py
git commit -m "Improve Silver to Gold processing with validation and better error messages"

# Commit 5: Enhance master automation
Write-Host "`nCommit 5: Enhancing master automation..." -ForegroundColor Yellow
git add master_automation.ps1
git commit -m "Enhance master automation with Silver and Gold layer validation functions"

# Commit 6: Update configuration documentation
Write-Host "`nCommit 6: Updating configuration documentation..." -ForegroundColor Yellow
git add config/data_config.yaml
git commit -m "Add documentation comments for forex normalization and catalog requirements"

# Commit 7: Update README with troubleshooting
Write-Host "`nCommit 7: Updating README with troubleshooting guide..." -ForegroundColor Yellow
git add README.md
git commit -m "Add troubleshooting section for Bronze to Silver processing issues"

# Commit 8: Other changes (phase definitions, test file)
Write-Host "`nCommit 8: Committing other changes..." -ForegroundColor Yellow
if (git status --porcelain | Select-String -Pattern "automation/phase_definitions.json") {
    git add automation/phase_definitions.json
    git commit -m "Update phase definitions configuration"
}

if (git status --porcelain | Select-String -Pattern "scripts/test_yfinance.py") {
    git add scripts/test_yfinance.py
    git commit -m "Add yfinance test script for debugging"
}

Write-Host "`nAll changes committed successfully!" -ForegroundColor Green
Write-Host "`nCurrent status:" -ForegroundColor Cyan
$status = git status --short 2>&1 | Out-String
Write-Host $status

