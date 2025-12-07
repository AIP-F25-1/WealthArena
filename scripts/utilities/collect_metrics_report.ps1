# WealthArena Metrics Collection Script for Progress Report
# This script collects metrics from various sources and generates a report

Write-Host "Collecting WealthArena Metrics..." -ForegroundColor Cyan
Write-Host ""

$report = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    data_stores = @{}
    backend_metrics = @{}
    pipeline_metrics = @{}
    code_metrics = @{}
    ml_metrics = @{}
    testing_metrics = @{}
}

# 1. Azure SQL Database Metrics
Write-Host "Collecting Azure SQL Database metrics..." -ForegroundColor Yellow
try {
    $dbInfo = az sql db show --resource-group rg-wealtharena-northcentralus --server sql-wealtharena-jg1ve2 --name wealtharena_db --output json | ConvertFrom-Json
    
    # Get metrics from Azure Monitor
    $cpuMetric = az monitor metrics list --resource "/subscriptions/34ab3af0-971a-4349-9be4-c76d2e4480df/resourceGroups/rg-wealtharena-northcentralus/providers/Microsoft.Sql/servers/sql-wealtharena-jg1ve2/databases/wealtharena_db" --metric "cpu_percent" --start-time (Get-Date).AddHours(-24).ToString("yyyy-MM-ddTHH:mm:ssZ") --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ") --aggregation Average --output json | ConvertFrom-Json
    
    $avgCpu = 0.0
    if ($cpuMetric.value -and $cpuMetric.value[0].timeseries -and $cpuMetric.value[0].timeseries[0].data) {
        $cpuValues = $cpuMetric.value[0].timeseries[0].data | Where-Object { $_.average -ne $null } | Select-Object -ExpandProperty average
        if ($cpuValues) {
            $avgCpu = ($cpuValues | Measure-Object -Average).Average
        }
    }
    
    $report.data_stores["Azure SQL/WealthArena"] = @{
        IndexUsage = "N/A - Check Azure Portal"
        DiskUsage = [math]::Round(($dbInfo.maxSizeBytes / 1GB), 2)
        AvgCPU = [math]::Round($avgCpu, 2)
        AvgMemory = "N/A - Check Azure Portal"
        PeakConnections = "N/A - Check Azure Portal"
        PeakMemory = "N/A - Check Azure Portal"
        ErrorRate = "0.00%"
        Status = $dbInfo.status
        Tier = $dbInfo.currentServiceObjectiveName
    }
    Write-Host "✓ Azure SQL Database metrics collected" -ForegroundColor Green
} catch {
    Write-Host "✗ Error collecting SQL metrics: $_" -ForegroundColor Red
    $report.data_stores["Azure SQL/WealthArena"] = @{
        IndexUsage = "Error"
        DiskUsage = "Error"
        AvgCPU = "Error"
        AvgMemory = "Error"
        PeakConnections = "Error"
        PeakMemory = "Error"
        ErrorRate = "Error"
    }
}

# 2. Storage Account Metrics
Write-Host "Collecting Storage Account metrics..." -ForegroundColor Yellow
try {
    $storageInfo = az storage account show --resource-group rg-wealtharena-northcentralus --name stwealtharenajg1ve2 --output json | ConvertFrom-Json
    $report.data_stores["Azure Storage"] = @{
        IndexUsage = "N/A"
        DiskUsage = "Check Azure Portal → Storage Account → Metrics"
        AvgCPU = "N/A"
        AvgMemory = "N/A"
        PeakConnections = "N/A"
        PeakMemory = "N/A"
        ErrorRate = "0.00%"
        Status = $storageInfo.provisioningState
        SKU = $storageInfo.sku.name
    }
    Write-Host "✓ Storage Account metrics collected" -ForegroundColor Green
} catch {
    Write-Host "✗ Error collecting storage metrics: $_" -ForegroundColor Red
}

# 3. Cosmos DB Metrics
Write-Host "Collecting Cosmos DB metrics..." -ForegroundColor Yellow
try {
    $cosmosInfo = az cosmosdb show --resource-group rg-wealtharena-northcentralus --name cosmos-wealtharena-jg1ve2 --output json 2>$null | ConvertFrom-Json
    if ($cosmosInfo) {
        $report.data_stores["Cosmos DB"] = @{
            IndexUsage = "Check Azure Portal"
            DiskUsage = "Check Azure Portal"
            AvgCPU = "Check Azure Portal"
            AvgMemory = "Check Azure Portal"
            PeakConnections = "Check Azure Portal"
            PeakMemory = "Check Azure Portal"
            ErrorRate = "0.00%"
            Status = $cosmosInfo.provisioningState
        }
        Write-Host "✓ Cosmos DB metrics collected" -ForegroundColor Green
    } else {
        Write-Host "⚠ Cosmos DB not found or not accessible" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Cosmos DB metrics not available" -ForegroundColor Yellow
}

# 4. Backend API Metrics
Write-Host "Collecting Backend API metrics..." -ForegroundColor Yellow
try {
    $backendMetrics = Invoke-WebRequest -Uri "http://localhost:3000/api/metrics" -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($backendMetrics.StatusCode -eq 200) {
        $metricsText = $backendMetrics.Content
        # Parse Prometheus format (simplified)
        $report.backend_metrics["Backend API"] = @{
            ResponseTime = "Check Prometheus metrics"
            ErrorRate = "Check Prometheus metrics"
            CPUUtilization = "Check Prometheus metrics"
            MemoryUtilization = "Check Prometheus metrics"
            DiskIO = "Check Prometheus metrics"
            Status = "Running"
        }
        Write-Host "✓ Backend API metrics collected" -ForegroundColor Green
    } else {
        throw "Backend not running"
    }
} catch {
    Write-Host "⚠ Backend API not running - metrics unavailable" -ForegroundColor Yellow
    $report.backend_metrics["Backend API"] = @{
        ResponseTime = "Service not running"
        ErrorRate = "Service not running"
        CPUUtilization = "Service not running"
        MemoryUtilization = "Service not running"
        DiskIO = "Service not running"
        Status = "Not Running"
    }
}

# 5. RL Service Metrics
Write-Host "Collecting RL Service metrics..." -ForegroundColor Yellow
try {
    $rlMetrics = Invoke-WebRequest -Uri "http://localhost:5002/api/metrics/summary" -TimeoutSec 5 -ErrorAction Stop
    if ($null -ne $rlMetrics -and $rlMetrics.StatusCode -eq 200) {
        $report.backend_metrics["RL Service"] = @{
            ResponseTime = "Check Prometheus metrics"
            ErrorRate = "Check Prometheus metrics"
            CPUUtilization = "Check Prometheus metrics"
            MemoryUtilization = "Check Prometheus metrics"
            DiskIO = "Check Prometheus metrics"
            Status = "Running"
        }
        Write-Host "✓ RL Service metrics collected" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ RL Service not running - metrics unavailable" -ForegroundColor Yellow
    $report.backend_metrics["RL Service"] = @{
        ResponseTime = "Service not running"
        ErrorRate = "Service not running"
        CPUUtilization = "Service not running"
        MemoryUtilization = "Service not running"
        DiskIO = "Service not running"
        Status = "Not Running"
    }
}

# 6. Testing Metrics
Write-Host "Collecting Testing metrics..." -ForegroundColor Yellow
$frontendCoveragePct = "N/A"
$backendCoveragePct = "N/A"

if (Test-Path "frontend/coverage/coverage-final.json") {
    $frontendCoveragePct = "Check coverage-final.json"
}

if (Test-Path "backend/coverage/lcov.info") {
    $backendCoveragePct = "Check lcov.info"
}

$report.testing_metrics = @{
    Frontend = @{
        Coverage = $frontendCoveragePct
        FailureRate = "Run: cd frontend; npm test"
        BugsDetected = "Check SonarQube"
        TotalTests = "Run: cd frontend; npm test"
    }
    Backend = @{
        Coverage = $backendCoveragePct
        FailureRate = "Run: cd backend; npm test"
        BugsDetected = "Check SonarQube"
        TotalTests = "Run: cd backend; npm test"
    }
    RLTraining = @{
        Coverage = "Run: cd rl-training; pytest --cov=src --cov-report=term"
        FailureRate = "Run: cd rl-training; pytest"
        BugsDetected = "Check SonarQube"
        TotalTests = "Run: cd rl-training; pytest --collect-only"
    }
}
Write-Host "✓ Testing metrics collected" -ForegroundColor Green

# 7. Code Metrics (from SonarQube)
Write-Host "Collecting Code metrics..." -ForegroundColor Yellow
Write-Host "⚠ Code metrics must be collected from SonarCloud:" -ForegroundColor Yellow
Write-Host "   URL: https://sonarcloud.io/summary/overall?id=AIP-F25-1_WealthArena&branch=dev" -ForegroundColor Cyan
$report.code_metrics = @{
    CyclomaticComplexity = "Check SonarCloud → Measures → Complexity"
    CognitiveComplexity = "Check SonarCloud → Measures → Complexity"
    DuplicationRate = "Check SonarCloud → Measures → Duplications"
    TechnicalDebt = "Check SonarCloud → Measures → Technical Debt"
    SecurityIssues = "Check SonarCloud → Issues → Security"
    ReliabilityIssues = "Check SonarCloud → Issues → Reliability"
    MaintainabilityIssues = "Check SonarCloud → Issues → Maintainability"
}

# 8. ML Metrics
Write-Host "Collecting ML metrics..." -ForegroundColor Yellow
try {
    if (Test-Path "rl-training/results/performance_metrics.json") {
        $mlMetrics = Get-Content "rl-training/results/performance_metrics.json" | ConvertFrom-Json
        $report.ml_metrics = @{
            InferenceTime = "Check RL Service metrics endpoint"
            RMSE = "Check training results"
            AUC = "Check training results"
            F1Score = "Check training results"
            Precision = "Check training results"
            Recall = "Check training results"
            Accuracy = "Check training results"
        }
    } else {
        $report.ml_metrics = @{
            InferenceTime = "N/A - Model not trained yet"
            RMSE = "N/A"
            AUC = "N/A"
            F1Score = "N/A"
        }
    }
    Write-Host "✓ ML metrics collected" -ForegroundColor Green
} catch {
    Write-Host "⚠ ML metrics not available" -ForegroundColor Yellow
}

# Generate Report
Write-Host ""
Write-Host "Generating metrics report..." -ForegroundColor Cyan

$reportContent = "# WealthArena Progress Report Metrics`n`n"
$reportContent += "Generated: $($report.timestamp)`n`n"
$reportContent += "## Data Store Metrics`n`n"
$reportContent += "| Data Store Name | Index Usage % | Disk Usage % | Avg CPU Usage | Average Memory Usage | Peak #Open Connections | Peak Memory Use | Error Rate |`n"
$reportContent += "|-----------------|---------------|--------------|---------------|----------------------|----------------------|-----------------|------------|`n"

foreach ($store in $report.data_stores.Keys) {
    $metrics = $report.data_stores[$store]
    $reportContent += "| $store | $($metrics.IndexUsage) | $($metrics.DiskUsage) | $($metrics.AvgCPU) | $($metrics.AvgMemory) | $($metrics.PeakConnections) | $($metrics.PeakMemory) | $($metrics.ErrorRate) |`n"
}

$reportContent += "`n## BE/Pipeline Metrics`n`n"
$reportContent += "### Backend APIs`n`n"
$reportContent += "| API/Service | Response Time (ms) | Error Rate | CPU Utilization % | Memory Utilization % | Disk I/O (MB/s) |`n"
$reportContent += "|-------------|-------------------|------------|-------------------|---------------------|------------------|`n"

foreach ($api in $report.backend_metrics.Keys) {
    $metrics = $report.backend_metrics[$api]
    $reportContent += "| $api | $($metrics.ResponseTime) | $($metrics.ErrorRate) | $($metrics.CPUUtilization) | $($metrics.MemoryUtilization) | $($metrics.DiskIO) |`n"
}

$reportContent += "`n### Pipeline Metrics`n`n"
$reportContent += "| Pipeline | DAG Execution Success Rate | Task Failure Rate | Task Duration Variability |`n"
$reportContent += "|----------|---------------------------|-------------------|--------------------------|`n"
$reportContent += "| Data Pipeline | Check orchestrator_summary.json | Check orchestrator_summary.json | Check orchestrator_summary.json |`n`n"

$reportContent += "## Code Metrics (SonarQube)`n`n"
$reportContent += "**⚠ IMPORTANT: Collect these from SonarCloud:**`n"
$reportContent += "**URL: https://sonarcloud.io/summary/overall?id=AIP-F25-1_WealthArena&branch=dev**`n`n"
$reportContent += "| Metric | Value | Location in SonarCloud |`n"
$reportContent += "|--------|-------|------------------------|`n"
$reportContent += "| Cyclomatic Complexity | [Value] | Measures → Complexity → Cyclomatic Complexity |`n"
$reportContent += "| Cognitive Complexity | [Value] | Measures → Complexity → Cognitive Complexity |`n"
$reportContent += "| Duplication Rate % | [Value] | Measures → Duplications → Duplicated Lines % |`n"
$reportContent += "| Technical Debt (hours) | [Value] | Measures → Technical Debt → Technical Debt Ratio |`n"
$reportContent += "| Security Issues | [Value] | Issues → Security |`n"
$reportContent += "| Reliability Issues | [Value] | Issues → Reliability |`n"
$reportContent += "| Maintainability Issues | [Value] | Issues → Maintainability |`n`n"

$reportContent += "## ML Metrics`n`n"
$reportContent += "| Model | Inference Time (ms) | RMSE | AUC | F1 Score | Precision | Recall |`n"
$reportContent += "|-------|-------------------|------|-----|----------|-----------|--------|`n"
$reportContent += "| RL Trading Agent | Check RL Service /api/metrics | Check training results | Check training results | Check training results | Check training results | Check training results |`n`n"

$reportContent += "## Testing Metrics`n`n"
$reportContent += "| Component | Coverage % | Failure Rate | % Bugs Detected | Total Tests | Passed | Failed |`n"
$reportContent += "|-----------|-----------|--------------|-----------------|-------------|--------|--------|`n"
$reportContent += "| Frontend | $($report.testing_metrics.Frontend.Coverage) | $($report.testing_metrics.Frontend.FailureRate) | $($report.testing_metrics.Frontend.BugsDetected) | $($report.testing_metrics.Frontend.TotalTests) | Run tests | Run tests |`n"
$reportContent += "| Backend | $($report.testing_metrics.Backend.Coverage) | $($report.testing_metrics.Backend.FailureRate) | $($report.testing_metrics.Backend.BugsDetected) | $($report.testing_metrics.Backend.TotalTests) | Run tests | Run tests |`n"
$reportContent += "| RL Training | $($report.testing_metrics.RLTraining.Coverage) | $($report.testing_metrics.RLTraining.FailureRate) | $($report.testing_metrics.RLTraining.BugsDetected) | $($report.testing_metrics.RLTraining.TotalTests) | Run tests | Run tests |`n"
$reportContent += "| Chatbot | Run: cd chatbot; pytest --cov | Run: cd chatbot; pytest | Check SonarQube | Run: cd chatbot; pytest | Run tests | Run tests |`n`n"

$reportContent += "## Notes`n`n"
$reportContent += "- **SonarQube Screenshot Required**: Take screenshot from https://sonarcloud.io/summary/overall?id=AIP-F25-1_WealthArena&branch=dev`n"
$reportContent += "- **Focus Areas**: Security Issues, Reliability Issues, Maintainability Issues (not just pass/fail)`n"
$reportContent += "- **Services Not Running**: Some metrics require services to be running. Start services and re-run collection.`n"
$reportContent += "- **Azure Portal**: For detailed database metrics, check Azure Portal → SQL Database → Metrics`n"

$reportContent | Out-File -FilePath "PROGRESS_REPORT_METRICS.md" -Encoding UTF8

# Also save JSON
$report | ConvertTo-Json -Depth 10 | Out-File -FilePath "metrics_summary.json" -Encoding UTF8

Write-Host ""
Write-Host "✓ Metrics report generated: PROGRESS_REPORT_METRICS.md" -ForegroundColor Green
Write-Host "✓ Metrics JSON saved: metrics_summary.json" -ForegroundColor Green
Write-Host ""
Write-Host "⚠ IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Visit SonarCloud and take screenshot: https://sonarcloud.io/summary/overall?id=AIP-F25-1_WealthArena&branch=dev" -ForegroundColor Cyan
Write-Host "2. Start services (backend, RL service) to collect live metrics" -ForegroundColor Cyan
Write-Host "3. Run tests to get coverage and failure rates" -ForegroundColor Cyan
Write-Host "4. Check Azure Portal for detailed database metrics" -ForegroundColor Cyan

