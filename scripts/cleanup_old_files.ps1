#Requires -Version 5.1

<#
.SYNOPSIS
    Cleanup script for archiving old logs and temporary files in WealthArena project.

.DESCRIPTION
    This script archives old automation logs, cleans up old log files from various services,
    and removes temporary files based on configurable retention policies.

.PARAMETER AutomationLogsKeepCount
    Number of most recent automation reports to keep in automation_logs/ (default: 3)

.PARAMETER LogRetentionDays
    Number of days to keep log files in service directories (default: 7)

.PARAMETER DryRun
    Show what would be done without actually making changes

.PARAMETER SkipAutomationLogs
    Skip archiving automation logs

.PARAMETER SkipServiceLogs
    Skip cleaning service logs

.PARAMETER SkipTempFiles
    Skip cleaning temporary files

.EXAMPLE
    .\scripts\cleanup_old_files.ps1

.EXAMPLE
    .\scripts\cleanup_old_files.ps1 -DryRun -LogRetentionDays 14

.EXAMPLE
    .\scripts\cleanup_old_files.ps1 -AutomationLogsKeepCount 5 -LogRetentionDays 30
#>

[CmdletBinding()]
param(
    [int]$AutomationLogsKeepCount = 3,
    [int]$LogRetentionDays = 7,
    [switch]$DryRun = $false,
    [switch]$SkipAutomationLogs = $false,
    [switch]$SkipServiceLogs = $false,
    [switch]$SkipTempFiles = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

# Color output functions
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    $colorMap = @{
        "Red" = "Red"
        "Green" = "Green"
        "Yellow" = "Yellow"
        "Blue" = "Blue"
        "Cyan" = "Cyan"
        "White" = "White"
    }
    Write-Host $Message -ForegroundColor $colorMap[$Color]
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Statistics
$script:Stats = @{
    AutomationLogsArchived = 0
    ServiceLogsArchived = 0
    ServiceLogsDeleted = 0
    TempFilesDeleted = 0
    Errors = 0
}

function Archive-AutomationLogs {
    Write-ColorOutput "`n=== Archiving Automation Logs ===" "Cyan"
    
    $automationLogsDir = Join-Path $ProjectRoot "automation_logs"
    $archiveDir = Join-Path $ProjectRoot "archive\automation_logs"
    
    if (-not (Test-Path $automationLogsDir)) {
        Write-ColorOutput "  Automation logs directory not found: $automationLogsDir" "Yellow"
        return
    }
    
    # Ensure archive directory exists
    if (-not (Test-Path $archiveDir)) {
        if (-not $DryRun) {
            New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
            Write-ColorOutput "  Created archive directory: $archiveDir" "Green"
        } else {
            Write-ColorOutput "  [DRY RUN] Would create archive directory: $archiveDir" "Yellow"
        }
    }
    
    # Get all automation report files (both .md and .log files)
    $allFiles = Get-ChildItem -Path $automationLogsDir -File -ErrorAction SilentlyContinue | 
        Where-Object { $_.Name -match 'automation_report_|master_automation_' }
    
    if ($allFiles.Count -eq 0) {
        Write-ColorOutput "  No automation log files found to archive" "Yellow"
        return
    }
    
    # Sort by last write time (newest first) and keep the most recent N
    $filesToArchive = $allFiles | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -Skip $AutomationLogsKeepCount
    
    if ($filesToArchive.Count -eq 0) {
        $msg = "  All automation logs are within retention limit ($AutomationLogsKeepCount most recent)"
        Write-ColorOutput $msg "Green"
        return
    }
    
    $msg = "  Found $($filesToArchive.Count) file(s) to archive (keeping $AutomationLogsKeepCount most recent)"
    Write-ColorOutput $msg "Blue"
    
    foreach ($file in $filesToArchive) {
        $archivePath = Join-Path $archiveDir $file.Name
        
        if ($DryRun) {
            Write-ColorOutput "  [DRY RUN] Would archive: $($file.Name)" "Yellow"
        } else {
            try {
                Move-Item -Path $file.FullName -Destination $archivePath -Force -ErrorAction Stop
                Write-ColorOutput "  ✓ Archived: $($file.Name)" "Green"
                $script:Stats.AutomationLogsArchived++
            } catch {
                Write-ColorOutput "  ✗ Failed to archive $($file.Name): $_" "Red"
                $script:Stats.Errors++
            }
        }
    }
}

function Clean-ServiceLogs {
    Write-ColorOutput "`n=== Cleaning Service Logs ===" "Cyan"
    
    $cutoffDate = (Get-Date).AddDays(-$LogRetentionDays)
    $serviceDirs = @(
        @{ Path = "backend"; Patterns = @("*.log", "logs\*.log", "logs\*.txt") },
        @{ Path = "chatbot"; Patterns = @("*.log", "logs\*.log", "logs\*.txt", "app-logs.zip", "azure-logs.zip") },
        @{ Path = "rl-training"; Patterns = @("*.log", "automation\logs\*.log", "automation\logs\*.txt") },
        @{ Path = "data-pipeline"; Patterns = @("*.log", "logs\*.log", "logs\*.txt") }
    )
    
    $archiveBaseDir = Join-Path $ProjectRoot "archive"
    
    foreach ($serviceDir in $serviceDirs) {
        $servicePath = Join-Path $ProjectRoot $serviceDir.Path
        
        if (-not (Test-Path $servicePath)) {
            Write-ColorOutput "  Service directory not found: $servicePath" "Yellow"
            continue
        }
        
        Write-ColorOutput "  Processing: $($serviceDir.Path)" "Blue"
        
        # Create service-specific archive directory
        $serviceArchiveDir = Join-Path $archiveBaseDir $serviceDir.Path "logs"
        
        foreach ($pattern in $serviceDir.Patterns) {
            $searchPath = Join-Path $servicePath $pattern
            
            try {
                $files = Get-ChildItem -Path $searchPath -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.LastWriteTime -lt $cutoffDate }
                
                if ($files.Count -eq 0) {
                    continue
                }
                
                Write-ColorOutput "    Found $($files.Count) old file(s) matching: $pattern" "Blue"
                
                foreach ($file in $files) {
                    $relativePath = $file.FullName.Replace($servicePath, "").TrimStart('\', '/')
                    $archivePath = Join-Path $serviceArchiveDir $relativePath
                    $archiveParent = Split-Path -Parent $archivePath
                    
                    if ($DryRun) {
                        Write-ColorOutput "    [DRY RUN] Would archive: $relativePath" "Yellow"
                    } else {
                        try {
                            # Ensure archive directory exists
                            if (-not (Test-Path $archiveParent)) {
                                New-Item -ItemType Directory -Path $archiveParent -Force | Out-Null
                            }
                            
                            Move-Item -Path $file.FullName -Destination $archivePath -Force -ErrorAction Stop
                            Write-ColorOutput "    ✓ Archived: $relativePath" "Green"
                            $script:Stats.ServiceLogsArchived++
                        } catch {
                            # If archiving fails, try deleting instead
                            try {
                                Remove-Item -Path $file.FullName -Force -ErrorAction Stop
                                Write-ColorOutput "    ✓ Deleted (archive failed): $relativePath" "Yellow"
                                $script:Stats.ServiceLogsDeleted++
                            } catch {
                                Write-ColorOutput "    ✗ Failed to process: $relativePath - $_" "Red"
                                $script:Stats.Errors++
                            }
                        }
                    }
                }
            } catch {
                # Pattern might not match any files, which is fine
            }
        }
    }
}

function Clean-TempFiles {
    Write-ColorOutput "`n=== Cleaning Temporary Files ===" "Cyan"
    
    $tempExtensions = @("*.tmp", "*.temp", "*.cache")
    $tempFileNames = @("Thumbs.db", "desktop.ini")
    
    $excludeDirs = @(
        "node_modules",
        ".git",
        ".venv",
        "venv",
        "__pycache__",
        ".pytest_cache",
        "dist",
        "build"
    )
    
    $allTempFiles = @()
    
    # Find files by extension
    foreach ($ext in $tempExtensions) {
        try {
            $files = Get-ChildItem -Path $ProjectRoot -Filter $ext -Recurse -File -ErrorAction SilentlyContinue
            if ($files) {
                $allTempFiles += $files
            }
        } catch {
            # Pattern might not match any files, which is fine
        }
    }
    
    # Find files by name
    foreach ($fileName in $tempFileNames) {
        try {
            $files = Get-ChildItem -Path $ProjectRoot -Filter $fileName -Recurse -File -ErrorAction SilentlyContinue
            if ($files) {
                $allTempFiles += $files
            }
        } catch {
            # Pattern might not match any files, which is fine
        }
    }
    
    # Find files starting with ~$
    try {
        $tildeFiles = Get-ChildItem -Path $ProjectRoot -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "~$*" }
        if ($tildeFiles) {
            $allTempFiles += $tildeFiles
        }
    } catch {
        # No files found, which is fine
    }
    
    # Filter out excluded directories
    $filteredFiles = $allTempFiles | Where-Object {
        $filePath = $_.FullName
        $shouldExclude = $false
        foreach ($excludeDir in $excludeDirs) {
            if ($filePath -like "*\$excludeDir\*" -or $filePath -like "*/$excludeDir/*") {
                $shouldExclude = $true
                break
            }
        }
        -not $shouldExclude
    } | Sort-Object FullName -Unique
    
    if ($filteredFiles.Count -eq 0) {
        Write-ColorOutput "  No temporary files found" "Green"
        return
    }
    
    Write-ColorOutput "  Found $($filteredFiles.Count) temporary file(s)" "Blue"
    
    foreach ($file in $filteredFiles) {
        $relativePath = $file.FullName.Replace($ProjectRoot, "").TrimStart('\', '/')
        
        if ($DryRun) {
            Write-ColorOutput "    [DRY RUN] Would delete: $relativePath" "Yellow"
        } else {
            try {
                Remove-Item -Path $file.FullName -Force -ErrorAction Stop
                Write-ColorOutput "    ✓ Deleted: $relativePath" "Green"
                $script:Stats.TempFilesDeleted++
            } catch {
                Write-ColorOutput "    ✗ Failed to delete: $relativePath - $_" "Red"
                $script:Stats.Errors++
            }
        }
    }
}

# Main execution
function Main {
    Write-Host ""
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "WealthArena Cleanup Script" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-Host ""
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN MODE - No actual changes will be made" "Yellow"
        Write-Host ""
    }
    
    Write-ColorOutput "Configuration:" "Blue"
    Write-ColorOutput "  Automation Logs Keep Count: $AutomationLogsKeepCount" "White"
    Write-ColorOutput "  Log Retention Days: $LogRetentionDays" "White"
    Write-Host ""
    
    # Archive automation logs
    if (-not $SkipAutomationLogs) {
        Archive-AutomationLogs
    } else {
        Write-ColorOutput "`n=== Skipping Automation Logs Archive ===" "Yellow"
    }
    
    # Clean service logs
    if (-not $SkipServiceLogs) {
        Clean-ServiceLogs
    } else {
        Write-ColorOutput "`n=== Skipping Service Logs Cleanup ===" "Yellow"
    }
    
    # Clean temporary files
    if (-not $SkipTempFiles) {
        Clean-TempFiles
    } else {
        Write-ColorOutput "`n=== Skipping Temporary Files Cleanup ===" "Yellow"
    }
    
    # Print summary
    Write-Host ""
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "Cleanup Summary" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "  Automation Logs Archived: $($script:Stats.AutomationLogsArchived)" "White"
    Write-ColorOutput "  Service Logs Archived: $($script:Stats.ServiceLogsArchived)" "White"
    Write-ColorOutput "  Service Logs Deleted: $($script:Stats.ServiceLogsDeleted)" "White"
    Write-ColorOutput "  Temporary Files Deleted: $($script:Stats.TempFilesDeleted)" "White"
    Write-ColorOutput "  Errors: $($script:Stats.Errors)" $(if ($script:Stats.Errors -gt 0) { "Red" } else { "Green" })
    Write-Host ""
    
    if ($DryRun) {
        Write-ColorOutput "This was a DRY RUN. Run without -DryRun to apply changes." "Yellow"
    } else {
        Write-ColorOutput "Cleanup complete!" "Green"
    }
}

# Run main function
Main

