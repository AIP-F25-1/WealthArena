# Documentation Archive

> **Note**: This document is archived and preserved for historical reference. The structure described here (the old `docs/ARCHIVE/` layout) is no longer current. For current documentation, see `docs/` and the root `README.md`. These files are preserved for historical reference but are no longer actively maintained.

This directory contains archived documentation files that have been consolidated into main documentation files.

## Archive Organization

### Root Level Archives
- **Status/Summary Files**: Implementation status, summaries, completion reports
- **Phase-Specific Guides**: Phase-specific implementation guides that are now consolidated
- **Troubleshooting**: Redundant troubleshooting guides (consolidated into service-specific TROUBLESHOOTING.md)
- **Integration Guides**: Outdated integration guides
- **Deployment Guides**: Phase-specific deployment guides (consolidated into main DEPLOYMENT.md files)

### Service-Specific Archives
- **backend/**: Phase-specific and redundant backend docs
- **frontend/**: Status files, integration guides, phase-specific docs
- **chatbot/**: Phase-specific and setup guides
- **rl-training/**: Comprehensive guides, status files, phase-specific docs
- **rl-service/**: Phase-specific docs

## Main Documentation (Keep These)

### Root
- `README.md` - Main project README
- `PROGRESS_REPORT_TEMPLATE.md` - Template for progress reports

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
- `rl-service/README.md` (if exists) - RL Service README

### Docs
- `docs/METRICS_COLLECTION.md` - Metrics collection guide
- `docs/api/*.md` - API documentation
- `docs/deployment/*.md` - Deployment guides
- `docs/testing/*.md` - Testing guides

## Files Ignored by Git

The following .md files are excluded from version control (see `.gitignore`):
- `automation_logs/*.md` - Automation report logs
- `PROGRESS_REPORT_METRICS.md` - Generated metrics reports
- Any other generated/temporary documentation files

## Note

Archived files are kept for reference but are not actively maintained. Refer to the main consolidated documentation files for current information.

