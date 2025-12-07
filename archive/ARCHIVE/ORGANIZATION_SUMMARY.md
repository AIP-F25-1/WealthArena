# Documentation Organization Summary

> **Note**: This document is archived and preserved for historical reference. The structure described here (the old `docs/ARCHIVE/` layout) is no longer current. For current documentation, see `docs/` and the root `README.md`. These files are preserved for historical reference but are no longer actively maintained.

## What Was Archived

This archive contains **all scattered documentation files** that were consolidated into main documentation files. The archive is organized by service/module for easy reference.

## Archive Structure

```
docs/ARCHIVE/
├── README.md (this file)
├── ORGANIZATION_SUMMARY.md
├── backend/          - Backend phase-specific and redundant docs
├── frontend/         - Frontend status files, integration guides, phase docs
│   └── database/     - Frontend database documentation
├── chatbot/          - Chatbot phase-specific and setup guides
│   └── docs/         - Chatbot API documentation
├── rl-training/      - RL Training comprehensive guides and status files
│   ├── docs/         - RL Training technical documentation
│   └── backend/      - RL Training backend docs
├── rl-service/       - RL Service phase-specific docs
├── data-pipeline/    - Data pipeline phase-specific docs
└── docs/             - Root docs that were archived
```

## Main Documentation (Keep These)

### Root Level
- `README.md` - Main project README
- `PROGRESS_REPORT_TEMPLATE.md` - Progress report template
- `DEPLOYMENT_CHECKLIST.md` - Deployment checklist

### Backend
- `backend/README.md` - Backend service README
- `backend/TROUBLESHOOTING.md` - Consolidated troubleshooting guide

### Frontend
- `frontend/README.md` - Frontend service README
- `frontend/TESTING.md` - Consolidated testing guide

### Chatbot
- `chatbot/README.md` - Chatbot service README

### RL Training
- `rl-training/README.md` - RL Training service README
- `rl-training/DEPLOYMENT.md` - Consolidated deployment guide
- `rl-training/TESTING_AND_COVERAGE.md` - Consolidated testing guide

### RL Service
- `rl-service/README.md` - RL Service README (if exists)
- `rl-service/TESTING_GUIDE.md` - Testing guide (if exists)

### Docs Directory
- `docs/METRICS_COLLECTION.md` - Metrics collection guide
- `docs/api/*.md` - API documentation
- `docs/deployment/*.md` - Deployment guides
- `docs/testing/*.md` - Testing guides

## Files Ignored by Git

The following patterns are excluded from version control (see `.gitignore`):
- `automation_logs/*.md` - Automation report logs
- `PROGRESS_REPORT_METRICS.md` - Generated metrics reports
- `*_SUMMARY.md` - Summary files
- `*_STATUS.md` - Status files
- `*_REPORT.md` - Report files
- `*_ANALYSIS.md` - Analysis files
- `*_COMPLETE.md` - Completion files
- `*_VERIFICATION.md` - Verification files
- `VERIFICATION_*.md` - Verification reports
- `COPY_*.md` - Copy-related files
- `PRODUCTION_FOLDER_*.md` - Production folder files
- `MANUAL_*.md` - Manual instruction files
- `LOCAL_SETUP_*.md` - Local setup files
- `MVP_*.md` - MVP-related files

## Rationale

1. **Consolidation**: Multiple phase-specific and status files were consolidated into main documentation
2. **Clarity**: Only essential, maintained documentation is kept in main directories
3. **Reference**: Archived files are kept for historical reference but not actively maintained
4. **Git Hygiene**: Generated and temporary files are excluded from version control

## Next Steps

1. Review archived files and extract any unique information if needed
2. Update main documentation files if any important details are missing
3. After verification period, archived files can be removed if no longer needed

