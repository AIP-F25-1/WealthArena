# Metrics Collection Guide

## Overview

WealthArena collects metrics from multiple services using Prometheus, comprehensive metrics aggregation, and SonarQube for code quality analysis. This guide covers all metrics sources, collection methods, and how to view results.

## Metrics Sources

### Backend Service

**Endpoint:** `http://localhost:3000/api/metrics`

**Format:** Prometheus text format

**Metrics Collected:**
- HTTP request counts and durations
- Database query metrics
- Node.js process metrics (CPU, memory, event loop)
- Error rates and status codes
- Active connections

**Example:**
```bash
curl http://localhost:3000/api/metrics
```

**Output:**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 150

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 100
http_request_duration_seconds_bucket{le="0.5"} 140
http_request_duration_seconds_bucket{le="+Inf"} 150
```

### RL Service

**Endpoint:** `http://localhost:5002/api/metrics/summary`

**Format:** Prometheus text format or JSON

**Metrics Collected:**
- Inference request counts and durations
- Database query metrics
- Model loading status
- Prediction latency
- Model performance metrics

**Example:**
```bash
curl http://localhost:5002/api/metrics/summary
```

### RL Training

**Metrics Source:** `rl-training/src/metrics/comprehensive_metrics.py`

**Metrics Collected:**
- Training metrics (loss, rewards, episode length)
- Pipeline execution metrics (DAG success rate, task duration)
- Code quality metrics (cyclomatic complexity, duplication rate)
- Data store metrics (query latency, disk usage)
- ML metrics (inference time, RMSE, AUC, F1 score)
- Testing metrics (coverage, failure rate)

**Collection Method:**
```python
from rl_training.src.metrics.comprehensive_metrics import MetricsCollector

collector = MetricsCollector()
collector.collect_backend_api_metrics()
collector.collect_pipeline_metrics()
collector.collect_code_metrics()
collector.collect_data_metrics()
collector.collect_ml_metrics()
collector.collect_testing_metrics()
```

### Data Pipeline

**Metrics Source:** JSON summary files in `data-pipeline/`

**Summary Files:**
- `raw_download_summary.json`
- `crypto_download_summary.json`
- `forex_download_summary.json`
- `commodities_download_summary.json`
- `etf_download_summary.json`
- `orchestrator_summary.json`

**Metrics Collected:**
- Data download success rates
- Data processing durations
- Data quality metrics
- Pipeline execution statistics

## Collecting Metrics

### Quick Method: Using collect_metrics.py

**Script Location:** `scripts/collect_metrics.py`

**Usage:**
```bash
python scripts/collect_metrics.py
```

**What it does:**
1. Fetches metrics from backend `/api/metrics` endpoint
2. Fetches metrics from RL service `/api/metrics/summary` endpoint
3. Parses data pipeline JSON summaries
4. Parses RL training performance metrics
5. Uses `comprehensive_metrics.py` if available
6. Generates `PROGRESS_REPORT_METRICS.md` with formatted tables

**Output:**
- `PROGRESS_REPORT_METRICS.md` - Formatted metrics report
- `metrics_summary.json` - Aggregated metrics as JSON

**Configuration:**
```bash
# Set environment variables (optional)
export BACKEND_URL=http://localhost:3000
export RL_SERVICE_URL=http://localhost:5002

# Run collection
python scripts/collect_metrics.py
```

### Manual Collection

#### Backend Metrics

```bash
# Fetch backend metrics
curl http://localhost:3000/api/metrics > backend_metrics.txt

# Or use PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/metrics" -OutFile "backend_metrics.txt"
```

#### RL Service Metrics

```bash
# Fetch RL service metrics
curl http://localhost:5002/api/metrics/summary > rl_service_metrics.txt

# Or use PowerShell
Invoke-WebRequest -Uri "http://localhost:5002/api/metrics/summary" -OutFile "rl_service_metrics.txt"
```

#### Comprehensive Metrics

```python
from rl_training.src.metrics.comprehensive_metrics import MetricsCollector

collector = MetricsCollector()

# Collect all metrics
collector.collect_backend_api_metrics()
collector.collect_pipeline_metrics()
collector.collect_code_metrics()
collector.collect_data_metrics()
collector.collect_ml_metrics()
collector.collect_testing_metrics()

# Generate progress report
collector.export_progress_report_metrics("PROGRESS_REPORT_METRICS.md")

# Or get summary
summary = collector.get_metrics_summary(hours=24)
print(summary)
```

## Metrics Categories

### Data Store Metrics

**Source:** Database performance metrics, data pipeline summaries

**Metrics:**
- Average query latency (ms)
- P95 query latency (ms)
- P99 query latency (ms)
- Index usage percentage
- Average disk usage %
- CPU usage %
- Memory usage %
- Open connections
- Error rate

**Collection:**
```python
from rl_training.src.metrics.comprehensive_metrics import MetricsCollector

collector = MetricsCollector()
data_metrics = collector.collect_data_metrics()
print(f"Avg Query Latency: {data_metrics.avg_query_latency * 1000:.2f} ms")
print(f"P95 Query Latency: {data_metrics.p95_query_latency * 1000:.2f} ms")
print(f"Disk Usage: {data_metrics.disk_usage:.2f}%")
```

### Backend/Pipeline Metrics

**Source:** Backend API metrics, pipeline execution logs

**Metrics:**
- Response time (ms)
- Error rate
- CPU utilization %
- Memory utilization %
- Requests per second
- Success/failure rates
- Task duration variability

**Collection:**
```bash
# Backend metrics
curl http://localhost:3000/api/metrics

# Pipeline metrics
python -c "from rl_training.src.metrics.comprehensive_metrics import MetricsCollector; c = MetricsCollector(); print(c.collect_pipeline_metrics())"
```

### Code Metrics

**Source:** SonarQube analysis, code quality tools

**Metrics:**
- Cyclomatic complexity
- Duplication rate
- Technical debt (hours)
- Lines of code
- Test coverage %
- Code smells count
- Maintainability index

**Collection:**
```bash
# Run SonarQube scan
scripts/run_sonarqube_scan.bat <groupId> <repoName>

# View results on SonarCloud
# https://sonarcloud.io/summary/overall?id=AIP-F25-<groupId>_<Repo>&branch=dev
```

### ML Metrics

**Source:** RL training results, model performance evaluations

**Metrics:**
- Inference time (ms)
- RMSE (Root Mean Squared Error)
- AUC (Area Under Curve)
- F1 Score
- Precision
- Recall
- Accuracy
- R2 Score
- Model size (MB)

**Collection:**
```python
from rl_training.src.metrics.comprehensive_metrics import MetricsCollector

collector = MetricsCollector()
ml_metrics = collector.collect_ml_metrics()
print(f"Inference Time: {ml_metrics.inference_time * 1000:.2f} ms")
print(f"RMSE: {ml_metrics.rmse:.4f}")
print(f"AUC: {ml_metrics.auc:.4f}")
print(f"F1 Score: {ml_metrics.f1_score:.4f}")
```

### Testing Metrics

**Source:** Test execution results, coverage reports

**Metrics:**
- Test coverage %
- Failure rate
- Bug detection percentage
- Total tests
- Passed tests
- Failed tests
- Test duration (seconds)

**Collection:**
```bash
# Run tests with coverage
cd rl-training
pytest --cov=src --cov-report=xml --cov-report=term

# Coverage report is in coverage.xml
```

## SonarQube Integration

### Running SonarQube Scan

**Script Location:** `scripts/run_sonarqube_scan.bat`

**Usage:**
```bash
scripts/run_sonarqube_scan.bat <groupId> <repoName>
```

**Example:**
```bash
scripts/run_sonarqube_scan.bat F25 WealthArena
```

**What it does:**
1. Runs backend tests and generates `coverage/lcov.info`
2. Runs frontend tests and generates `coverage/lcov.info`
3. Runs Python service tests (chatbot, RL training, RL service) and generates `coverage.xml`
4. Runs SonarQube scan with project key: `AIP-F25-<groupId>_<repoName>`

**Project Key Format:**
```
AIP-F25-<groupId>_<repoName>
```

**Example:**
```
AIP-F25-F25_WealthArena
```

### Viewing SonarQube Results

**SonarCloud URL:**
```
https://sonarcloud.io/summary/overall?id=AIP-F25-<groupId>_<Repo>&branch=dev
```

**Example:**
```
https://sonarcloud.io/summary/overall?id=AIP-F25-F25_WealthArena&branch=dev
```

**What to check:**
- **Coverage %** - Code coverage percentage
- **Code Smells** - Code quality issues
- **Bugs** - Actual bugs found
- **Vulnerabilities** - Security vulnerabilities
- **Technical Debt** - Estimated time to fix issues
- **Duplications** - Code duplication percentage
- **Complexity** - Cyclomatic complexity

### SonarQube Configuration

**Required Environment Variables:**
```bash
# Set SONAR_TOKEN (get from SonarCloud)
export SONAR_TOKEN=your_sonar_token

# Or pass as parameter
sonar-scanner -Dsonar.login=your_sonar_token
```

**Project Configuration:**
- Project key is automatically set: `AIP-F25-<groupId>_<repoName>`
- Coverage files are automatically detected:
  - Backend: `backend/coverage/lcov.info`
  - Frontend: `frontend/coverage/lcov.info`
  - Python services: `*/coverage.xml`

## Advisor-Required Metrics Mapping

### Frontend/Backend Metrics

**Data Source:** Backend `/api/metrics` endpoint

**Metrics:**
- Response time (ms)
- Error rate
- CPU utilization %
- Memory utilization %
- Requests per second

**Collection:**
```bash
curl http://localhost:3000/api/metrics
```

### SonarQube Metrics

**Data Source:** SonarCloud analysis results

**Metrics:**
- Code coverage %
- Code smells count
- Bugs count
- Vulnerabilities count
- Technical debt (hours)
- Duplication rate %
- Cyclomatic complexity

**Collection:**
```bash
# Run scan
scripts/run_sonarqube_scan.bat <groupId> <repoName>

# View results
# https://sonarcloud.io/summary/overall?id=AIP-F25-<groupId>_<Repo>&branch=dev
```

### Model Metrics

**Data Source:** RL training results, model performance evaluations

**Metrics:**
- Inference time (ms)
- RMSE
- AUC
- F1 Score
- Model accuracy

**Collection:**
```python
from rl_training.src.metrics.comprehensive_metrics import MetricsCollector

collector = MetricsCollector()
ml_metrics = collector.collect_ml_metrics()
```

## Progress Report Format

### Generated Report Structure

The `collect_metrics.py` script generates `PROGRESS_REPORT_METRICS.md` with the following structure:

```markdown
# Progress Report Metrics

Generated: 2025-11-06T10:30:00

## Data Store Metrics

| Metric | Value |
|--------|-------|
| Avg Query Latency (ms) | 25.50 |
| P95 Query Latency (ms) | 45.20 |
| P99 Query Latency (ms) | 78.90 |
| Avg Disk Usage % | 65.30 |

## BE/Pipeline Metrics

| Metric | Value |
|--------|-------|
| Response Time (ms) | 120.50 |
| Error Rate | 0.0010 |
| CPU % | 45.20 |
| Memory % | 60.30 |
| Avg Success Rate | 98.50% |
| Avg Failure Rate | 0.0150 |

## Code Metrics

| Metric | Value |
|--------|-------|
| Cyclomatic Complexity | 8.50 |
| Duplication Rate | 0.0250 |
| Technical Debt (hours) | 12.50 |

## ML Metrics

| Metric | Value |
|--------|-------|
| Inference Time (ms) | 15.20 |
| RMSE | 0.1250 |
| AUC | 0.8500 |
| F1 Score | 0.8200 |

## Testing Metrics

| Metric | Value |
|--------|-------|
| Avg Coverage % | 85.50% |
| Avg Failure Rate | 0.0050 |
```

## Continuous Collection

### Start Continuous Collection

```python
from rl_training.src.metrics.comprehensive_metrics import MetricsCollector

collector = MetricsCollector()

# Start continuous collection (collects every 60 seconds)
collector.start_continuous_collection(interval=60)

# Stop collection when done
collector.stop_continuous_collection()
```

### Generate Weekly Report

```python
from rl_training.src.metrics.comprehensive_metrics import MetricsCollector

collector = MetricsCollector()

# Collect metrics for a week
weekly_report = collector.generate_weekly_report()

# Report includes:
# - Metrics summary for last 7 days
# - Alerts based on thresholds
# - Recommendations for improvements

print(f"Weekly report: {len(weekly_report['alerts'])} alerts, {len(weekly_report['recommendations'])} recommendations")
```

## Troubleshooting

### Metrics Endpoint Not Available

**Symptoms:** `curl http://localhost:3000/api/metrics` returns 404

**Solutions:**
1. Verify backend is running: `npm run dev`
2. Check metrics route is registered
3. Verify Prometheus client is installed: `npm list prom-client`
4. Check route order (metrics should be before catch-all routes)

### Coverage Not Showing in SonarQube

**Symptoms:** SonarQube shows 0% coverage

**Solutions:**
1. Verify coverage files exist:
   - `backend/coverage/lcov.info`
   - `frontend/coverage/lcov.info`
   - `rl-training/coverage.xml`
2. Check coverage file paths in SonarQube configuration
3. Regenerate coverage files:
   ```bash
   # Backend
   cd backend && npm test
   
   # Frontend
   cd frontend && npm test
   
   # RL Training
   cd rl-training && pytest --cov=src --cov-report=xml
   ```
4. Run SonarQube scan again

### Metrics Collection Script Fails

**Symptoms:** `python scripts/collect_metrics.py` fails

**Solutions:**
1. Check services are running:
   - Backend: `http://localhost:3000`
   - RL Service: `http://localhost:5002`
2. Verify Python dependencies:
   ```bash
   pip install requests
   ```
3. Check environment variables:
   ```bash
   export BACKEND_URL=http://localhost:3000
   export RL_SERVICE_URL=http://localhost:5002
   ```
4. Review error messages in script output

## Best Practices

1. **Collect metrics regularly** (daily or weekly)
2. **Monitor trends over time** to identify issues early
3. **Set up alerts** for critical metrics thresholds
4. **Document metric definitions** for consistency
5. **Review metrics in progress reports** regularly
6. **Use SonarQube** for code quality metrics
7. **Track ML model performance** over time
8. **Monitor database performance** metrics

## Additional Resources

- **Prometheus Documentation**: https://prometheus.io/docs/
- **SonarCloud Documentation**: https://docs.sonarcloud.io/
- **Coverage.py Documentation**: https://coverage.readthedocs.io/

---

*Last Updated: 2024*
*Status: Production Ready* ✅
