# Metrics Collection Guide

## Overview

This guide explains how to collect metrics from all services for progress reports. The WealthArena project uses multiple metrics collection systems:

- **Prometheus**: Backend and RL Service metrics
- **Comprehensive Metrics**: Aggregated metrics from rl-training
- **SonarQube**: Code quality metrics
- **Data Pipeline**: JSON summaries
- **MLflow/W&B**: Training experiment metrics

## Metrics Architecture

### Backend Metrics
- **Endpoint**: `http://localhost:3000/api/metrics`
- **Format**: Prometheus text format
- **Metrics Collected**:
  - HTTP request counts and durations
  - Database query durations
  - Error rates
  - Request in-progress gauge

### RL Service Metrics
- **Endpoint**: `http://localhost:5002/api/metrics/summary`
- **Format**: Prometheus text format
- **Metrics Collected**:
  - Inference request counts and durations
  - Model loaded status
  - Database query durations
  - Error counts by type

### Data Pipeline Metrics
- **Location**: `data-pipeline/*_summary.json`
- **Files**:
  - `raw_download_summary.json`
  - `crypto_download_summary.json`
  - `forex_download_summary.json`
  - `commodities_download_summary.json`
  - `etf_download_summary.json`
  - `orchestrator_summary.json`

### RL Training Metrics
- **Location**: `rl-training/results/performance_metrics.json`
- **Format**: JSON
- **Metrics**: Model performance, training metrics, evaluation results

### SonarQube Metrics
- **URL**: https://sonarcloud.io/project/overview?id=AIP-F25-WealthArena
- **Metrics**: Code quality, coverage, security, maintainability

## Quick Start

### Collect All Metrics

```bash
# Run the metrics collection script
python scripts/collect_metrics.py
```

This will generate:
- `PROGRESS_REPORT_METRICS.md` - Formatted metrics tables
- `metrics_summary.json` - Raw metrics data

### Run SonarQube Scan

```bash
# Run tests and SonarQube scan
scripts/run_sonarqube_scan.bat
```

This will:
1. Run all tests (backend, frontend, Python services)
2. Generate coverage reports
3. Upload to SonarCloud
4. Provide URL to view results

## Step-by-Step Collection

### 1. Backend Metrics

```bash
# Start backend server
cd backend
npm run dev

# In another terminal, fetch metrics
curl http://localhost:3000/api/metrics
```

### 2. RL Service Metrics

```bash
# Start RL service
cd rl-service
python api/inference_server.py

# In another terminal, fetch metrics
curl http://localhost:5002/api/metrics/summary
```

### 3. Data Pipeline Metrics

```bash
# Check data pipeline summaries
cd data-pipeline
cat raw_download_summary.json
cat crypto_download_summary.json
# ... etc
```

### 4. RL Training Metrics

```bash
# Check training results
cd rl-training
cat results/performance_metrics.json
```

### 5. SonarQube Metrics

1. Run `scripts/run_sonarqube_scan.bat`
2. Visit https://sonarcloud.io/project/overview?id=AIP-F25-WealthArena
3. Take screenshots of:
   - Code Quality Overview
   - Coverage Report
   - Security Hotspots
   - Reliability Issues
   - Maintainability Rating

## Interpreting Metrics

### Response Time
- **Good**: < 200ms
- **Acceptable**: 200-500ms
- **Poor**: > 500ms

### Error Rate
- **Good**: < 0.01 (1%)
- **Acceptable**: 0.01-0.05 (1-5%)
- **Poor**: > 0.05 (5%)

### Test Coverage
- **Good**: > 80%
- **Acceptable**: 60-80%
- **Poor**: < 60%

### CPU/Memory Usage
- **Good**: < 70%
- **Acceptable**: 70-85%
- **Poor**: > 85%

## Troubleshooting

### Backend Metrics Not Available

1. Check if backend is running: `curl http://localhost:3000/health`
2. Check if metrics endpoint is accessible: `curl http://localhost:3000/api/metrics`
3. Verify Prometheus middleware is installed: `cd backend && npm list prom-client`

### RL Service Metrics Not Available

1. Check if RL service is running: `curl http://localhost:5002/health`
2. Check if metrics module is imported correctly
3. Verify prometheus-client is installed: `cd rl-service && pip list | grep prometheus`

### Coverage Files Not Generated

1. Run tests with coverage flags:
   - Backend: `cd backend && npm test`
   - Frontend: `cd frontend && npm test`
   - Python: `pytest --cov --cov-report=xml`
2. Check coverage configuration files:
   - Backend: `backend/jest.config.js`
   - Frontend: `frontend/jest.config.js`
   - Python: `.coveragerc` files

### SonarQube Scan Fails

1. Verify sonar-scanner is installed: `sonar-scanner --version`
2. Check `sonar-project.properties` files exist
3. Verify SONAR_TOKEN environment variable is set
4. Check SonarCloud project key matches

## Progress Report Template

Use `PROGRESS_REPORT_TEMPLATE.md` as a base for your progress reports. Copy metrics tables from `PROGRESS_REPORT_METRICS.md` into the template.

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [SonarCloud Documentation](https://docs.sonarcloud.io/)
- [Jest Coverage](https://jestjs.io/docs/cli#--coverage)
- [pytest-cov Documentation](https://pytest-cov.readthedocs.io/)

