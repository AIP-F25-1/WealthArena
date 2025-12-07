# WealthArena Maintenance Guide

This document outlines maintenance procedures, cleanup policies, and retention guidelines for the WealthArena project.

## Table of Contents

- [Overview](#overview)
- [Cleanup Policies](#cleanup-policies)
- [File Retention Policies](#file-retention-policies)
- [Running Cleanup Scripts](#running-cleanup-scripts)
- [What Should Never Be Deleted](#what-should-never-be-deleted)
- [Automated Maintenance](#automated-maintenance)
- [Manual Cleanup Procedures](#manual-cleanup-procedures)

## Overview

Regular maintenance is essential to keep the repository clean, reduce storage usage, and ensure that important files are preserved while temporary and outdated files are properly archived or removed.

The maintenance system includes:
- **Automated cleanup scripts** for periodic maintenance
- **Archive system** for preserving historical logs
- **Retention policies** for different file types
- **Integration** with master automation pipeline

## Cleanup Policies

### Archive vs Delete

#### Archive (Preserve)
The following files should be **archived** (moved to `archive/` directory) rather than deleted:

- **Automation Reports**: Historical automation reports older than the retention limit
- **Service Logs**: Application logs from backend, chatbot, RL training, and data pipeline services
- **Build Artifacts**: Historical build artifacts and deployment logs
- **Configuration Snapshots**: Historical configuration files for troubleshooting

#### Delete (Remove)
The following files should be **deleted** (not archived):

- **Temporary Files**: `.tmp`, `.temp`, `.cache` files
- **OS Files**: `Thumbs.db`, `desktop.ini`, `.DS_Store`
- **IDE Files**: Editor swap files, local IDE settings
- **Old Cache Files**: Build caches, dependency caches that can be regenerated

## File Retention Policies

### Automation Logs

**Location**: `automation_logs/`

**Policy**:
- Keep the **3 most recent** automation reports (both `.md` and `.log` files)
- Archive older reports to `archive/automation_logs/`
- Reports are sorted by `LastWriteTime` (newest first)

**Rationale**: Recent reports are needed for immediate troubleshooting, while older reports are preserved for historical analysis.

### Service Logs

**Locations**:
- `backend/logs/`
- `chatbot/logs/`
- `rl-training/automation/logs/`
- `data-pipeline/logs/`

**Policy**:
- Keep logs from the **last 7 days**
- Archive logs older than 7 days to `archive/{service}/logs/`
- If archiving fails, delete old logs (they can be regenerated)

**Rationale**: Recent logs are critical for debugging, while older logs are rarely needed but preserved in archive.

### Temporary Files

**Policy**:
- Delete immediately (no retention)
- Patterns: `*.tmp`, `*.temp`, `*.cache`, `Thumbs.db`, `desktop.ini`, `~$*`

**Rationale**: Temporary files can always be regenerated and should not clutter the repository.

### Build Artifacts

**Policy**:
- Keep only the most recent build artifacts
- Archive or delete older builds based on project needs
- APK builds: Keep last successful build, archive others

**Rationale**: Build artifacts are large and can be regenerated, but recent builds may be needed for testing.

## Running Cleanup Scripts

### Automated Cleanup Script

The main cleanup script is located at `scripts/cleanup_old_files.ps1`.

#### Basic Usage

```powershell
# Run cleanup with default settings (keep 3 automation logs, 7 days retention)
.\scripts\cleanup_old_files.ps1
```

#### Advanced Usage

```powershell
# Dry run to see what would be cleaned
.\scripts\cleanup_old_files.ps1 -DryRun

# Custom retention settings
.\scripts\cleanup_old_files.ps1 -AutomationLogsKeepCount 5 -LogRetentionDays 14

# Skip specific cleanup operations
.\scripts\cleanup_old_files.ps1 -SkipServiceLogs -SkipTempFiles

# Combine options
.\scripts\cleanup_old_files.ps1 -DryRun -AutomationLogsKeepCount 10 -LogRetentionDays 30
```

#### Parameters

- `-AutomationLogsKeepCount <int>`: Number of most recent automation reports to keep (default: 3)
- `-LogRetentionDays <int>`: Number of days to keep service logs (default: 7)
- `-DryRun`: Show what would be done without making changes
- `-SkipAutomationLogs`: Skip archiving automation logs
- `-SkipServiceLogs`: Skip cleaning service logs
- `-SkipTempFiles`: Skip cleaning temporary files

#### Output

The script provides:
- Color-coded progress messages
- Summary statistics (files archived, deleted, errors)
- Error reporting for failed operations

### Integration with Master Automation

The cleanup script can be run as part of the master automation pipeline:

```powershell
# Run cleanup as part of automation (optional maintenance phase)
.\master_automation.ps1 -RunMaintenance
```

Or run cleanup separately after automation:

```powershell
# After automation completes
.\scripts\cleanup_old_files.ps1
```

## What Should Never Be Deleted

### Critical Files (Never Delete)

- **Source Code**: All `.py`, `.ts`, `.tsx`, `.js`, `.sql` files
- **Configuration Templates**: `.env.example`, `*.example.yaml`, `*.template`
- **Documentation**: All `.md` files in `docs/`, `README.md` files
- **Test Files**: All test files in `tests/` directories
- **Database Schemas**: SQL schema files in `database/`
- **Dependencies**: `package.json`, `requirements.txt`, `pyproject.toml`
- **Git Files**: `.git/`, `.gitignore`, `.gitattributes`
- **CI/CD Configs**: `.github/workflows/`, `.github/`

### Important Files (Archive Instead of Delete)

- **Historical Logs**: Move to `archive/` rather than delete
- **Old Build Artifacts**: Archive if space allows, delete if necessary
- **Configuration Snapshots**: Archive for troubleshooting reference

### Safe to Delete

- **Temporary Files**: `.tmp`, `.temp`, `.cache`
- **OS Files**: `Thumbs.db`, `desktop.ini`
- **IDE Files**: Local IDE settings (not shared)
- **Old Caches**: Build caches, dependency caches

## Automated Maintenance

### Scheduled Cleanup

You can set up scheduled cleanup using Windows Task Scheduler:

```powershell
# Create scheduled task (runs weekly on Sundays at 2 AM)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File `"$PWD\scripts\cleanup_old_files.ps1`""
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 2am
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive
Register-ScheduledTask -TaskName "WealthArena Cleanup" -Action $action -Trigger $trigger -Principal $principal
```

### Post-Automation Cleanup

The cleanup script can be integrated into `master_automation.ps1` as an optional maintenance phase. This ensures cleanup runs automatically after automation completes.

## Manual Cleanup Procedures

### Archiving Automation Logs Manually

```powershell
# Archive all but the 3 most recent automation reports
$automationLogsDir = "automation_logs"
$archiveDir = "archive\automation_logs"
New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
Get-ChildItem -Path $automationLogsDir -File | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -Skip 3 | 
    Move-Item -Destination $archiveDir -Force
```

### Cleaning Service Logs Manually

```powershell
# Clean logs older than 7 days from a specific service
$serviceDir = "chatbot\logs"
$cutoffDate = (Get-Date).AddDays(-7)
$archiveDir = "archive\chatbot\logs"
New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
Get-ChildItem -Path $serviceDir -File | 
    Where-Object { $_.LastWriteTime -lt $cutoffDate } | 
    Move-Item -Destination $archiveDir -Force
```

### Removing Temporary Files Manually

```powershell
# Remove all temporary files
Get-ChildItem -Path . -Include *.tmp,*.temp,*.cache -Recurse -File | 
    Remove-Item -Force
```

## Best Practices

1. **Run Dry Run First**: Always use `-DryRun` to preview changes before applying them
2. **Regular Maintenance**: Run cleanup weekly or after major automation runs
3. **Monitor Archive Size**: Periodically review `archive/` directory size and prune if needed
4. **Backup Before Major Cleanup**: For critical operations, backup important files first
5. **Document Custom Policies**: If you modify retention policies, update this document

## Troubleshooting

### Cleanup Script Fails

**Issue**: Script fails with permission errors

**Solution**: 
- Run PowerShell as Administrator
- Check file permissions on target directories
- Ensure files are not locked by running processes

### Archive Directory Grows Too Large

**Issue**: `archive/` directory becomes very large

**Solution**:
- Review archive contents and delete very old archives (>6 months)
- Adjust retention policies to be more aggressive
- Consider compressing old archives

### Files Not Being Cleaned

**Issue**: Expected files are not being cleaned

**Solution**:
- Check file patterns match expected files
- Verify file dates are older than retention period
- Use `-DryRun` to see what would be processed
- Check `.gitignore` isn't excluding files from cleanup

## Maintenance Checklist

Use this checklist for regular maintenance:

- [ ] Run cleanup script with `-DryRun` to preview changes
- [ ] Review preview output for any unexpected files
- [ ] Run cleanup script without `-DryRun` to apply changes
- [ ] Verify automation logs are properly archived
- [ ] Check service logs are cleaned appropriately
- [ ] Confirm temporary files are removed
- [ ] Review archive directory size
- [ ] Update this document if policies change

## Contact

For questions or issues with maintenance procedures, refer to:
- Project documentation: `docs/`
- Troubleshooting guides: Service-specific `TROUBLESHOOTING.md` files
- Automation logs: `automation_logs/` for recent automation history

