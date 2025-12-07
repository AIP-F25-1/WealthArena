# Setup Databricks Jobs for WealthArena
# This script creates Databricks jobs for data ingestion, feature engineering, and RL training

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$DatabricksWorkspace = "databricks-wealtharena-dev",
    [string]$StorageAccount = "stwealtharenadev",
    [string]$ContainerName = "databricks-notebooks"
)

Write-Host "Setting up Databricks Jobs for WealthArena..." -ForegroundColor Green

# Check if Databricks CLI is installed
Write-Host "Checking Databricks CLI installation..." -ForegroundColor Yellow
try {
    $cliVersion = databricks --version 2>&1
    Write-Host "✅ Databricks CLI found: $cliVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Databricks CLI not found. Please install: pip install databricks-cli" -ForegroundColor Red
    exit 1
}

# Check if CLI is configured
Write-Host "Checking Databricks CLI configuration..." -ForegroundColor Yellow
try {
    databricks workspace ls / 2>&1 | Out-Null
    Write-Host "✅ Databricks CLI configured successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Databricks CLI not configured. Run: databricks configure --token" -ForegroundColor Red
    exit 1
}

# Create job configurations
$jobs = @(
    @{
        name = "WealthArena-Quick-Data-Load"
        description = "Quick data load for demo (6-12 months, limited symbols)"
        notebook_path = "/Workspace/Shared/WealthArena/01_market_data_ingestion"
        parameters = @{
            mode = "quick"
            start_date = "2023-01-01"
            end_date = ""
            max_symbols_per_asset = "50"
            batch_size = "10"
            sleep_seconds = "1"
        }
        timeout_seconds = 1800  # 30 minutes
        max_concurrent_runs = 1
    },
    
    @{
        name = "WealthArena-Full-Data-Load"
        description = "Full data load for production (5-10 years, all symbols)"
        notebook_path = "/Workspace/Shared/WealthArena/01_market_data_ingestion"
        parameters = @{
            mode = "full"
            start_date = "2019-01-01"
            end_date = ""
            max_symbols_per_asset = "1000"
            batch_size = "20"
            sleep_seconds = "2"
        }
        timeout_seconds = 14400  # 4 hours
        max_concurrent_runs = 1
    },
    
    @{
        name = "WealthArena-Feature-Engineering"
        description = "Calculate technical indicators from market data"
        notebook_path = "/Workspace/Shared/WealthArena/02_feature_engineering"
        parameters = @{
            lookback_days = "252"
            batch_size = "1000"
        }
        timeout_seconds = 3600  # 1 hour
        max_concurrent_runs = 1
    },
    
    @{
        name = "WealthArena-News-Sentiment"
        description = "Analyze news sentiment for financial markets"
        notebook_path = "/Workspace/Shared/WealthArena/03_news_sentiment"
        parameters = @{
            lookback_hours = "24"
            max_articles = "100"
            sleep_seconds = "2"
        }
        timeout_seconds = 1800  # 30 minutes
        max_concurrent_runs = 1
    },
    
    @{
        name = "WealthArena-RL-Training"
        description = "Train RL agents for trading (quick mode: 50K-100K timesteps)"
        notebook_path = "/Workspace/Shared/WealthArena/05_rl_agent_training"
        parameters = @{
            training_mode = "quick"
            timesteps_per_agent = "50000"
            eval_freq = "10000"
            save_freq = "10000"
            n_eval_episodes = "5"
        }
        timeout_seconds = 7200  # 2 hours
        max_concurrent_runs = 1
    },
    
    @{
        name = "WealthArena-RL-Inference"
        description = "Generate trading signals from trained RL models"
        notebook_path = "/Workspace/Shared/WealthArena/06_rl_inference"
        parameters = @{
            signal_threshold = "0.6"
            max_signals_per_symbol = "3"
            risk_reward_ratio_min = "1.5"
            position_size_max = "0.1"
        }
        timeout_seconds = 1800  # 30 minutes
        max_concurrent_runs = 1
    },
    
    @{
        name = "WealthArena-Portfolio-Optimization"
        description = "Optimize portfolios using mean-variance optimization"
        notebook_path = "/Workspace/Shared/WealthArena/07_portfolio_optimization"
        parameters = @{
            optimization_method = "sharpe"
            max_portfolio_weight = "0.2"
            min_portfolio_weight = "0.01"
            risk_free_rate = "0.02"
            confidence_level = "0.05"
        }
        timeout_seconds = 1800  # 30 minutes
        max_concurrent_runs = 1
    }
)

# Verify notebooks are uploaded
Write-Host "Verifying notebooks are uploaded to workspace..." -ForegroundColor Yellow
$notebookPaths = @(
    "/Workspace/Shared/WealthArena/01_market_data_ingestion",
    "/Workspace/Shared/WealthArena/02_feature_engineering",
    "/Workspace/Shared/WealthArena/03_news_sentiment",
    "/Workspace/Shared/WealthArena/05_rl_agent_training",
    "/Workspace/Shared/WealthArena/06_rl_inference",
    "/Workspace/Shared/WealthArena/07_portfolio_optimization"
)

foreach ($path in $notebookPaths) {
    try {
        databricks workspace get-status --path $path 2>&1 | Out-Null
        Write-Host "✅ Notebook found: $path" -ForegroundColor Green
    } catch {
        Write-Host "❌ Notebook not found: $path" -ForegroundColor Red
        Write-Host "Please upload notebooks first using: databricks workspace import" -ForegroundColor Yellow
        exit 1
    }
}

# Create jobs using Databricks CLI
foreach ($job in $jobs) {
    try {
        Write-Host "Creating job: $($job.name)..." -ForegroundColor Yellow
        
        # Create job configuration JSON with cluster configuration
        $jobConfig = @{
            name = $job.name
            description = $job.description
            timeout_seconds = $job.timeout_seconds
            max_concurrent_runs = $job.max_concurrent_runs
            job_clusters = @(
                @{
                    job_cluster_key = "main_cluster"
                    new_cluster = @{
                        spark_version = "13.3.x-scala2.12"
                        node_type_id = "Standard_DS3_v2"
                        num_workers = 2
                        spark_conf = @{
                            "spark.databricks.cluster.profile" = "singleNode"
                            "spark.master" = "local[*]"
                        }
                    }
                }
            )
            tasks = @(
                @{
                    task_key = "main_task"
                    job_cluster_key = "main_cluster"
                    notebook_task = @{
                        notebook_path = $job.notebook_path
                        base_parameters = $job.parameters
                    }
                    timeout_seconds = $job.timeout_seconds
                }
            )
        } | ConvertTo-Json -Depth 10
        
        # Save job config to temporary file
        $tempFile = "temp_job_config.json"
        $jobConfig | Out-File -FilePath $tempFile -Encoding UTF8
        
        # Create job using Databricks CLI
        $result = databricks jobs create --json-file $tempFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Job '$($job.name)' created successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to create job '$($job.name)': $result" -ForegroundColor Red
        }
        
        # Clean up temporary file
        if (Test-Path $tempFile) {
            Remove-Item $tempFile
        }
        
    } catch {
        Write-Host "❌ Error creating job '$($job.name)': $_" -ForegroundColor Red
    }
}

# Create job schedules
Write-Host "Setting up job schedules..." -ForegroundColor Yellow

$schedules = @(
    @{
        job_name = "WealthArena-Full-Data-Load"
        schedule = "0 0 6 * * ?"  # Daily at 6 AM UTC
        description = "Daily full data load"
    },
    @{
        job_name = "WealthArena-Feature-Engineering"
        schedule = "0 0 8 * * ?"  # Daily at 8 AM UTC
        description = "Daily feature engineering"
    },
    @{
        job_name = "WealthArena-News-Sentiment"
        schedule = "0 0 */6 * * ?"  # Every 6 hours
        description = "News sentiment analysis"
    },
    @{
        job_name = "WealthArena-RL-Training"
        schedule = "0 0 0 ? * SUN"  # Weekly on Sunday
        description = "Weekly RL model training"
    },
    @{
        job_name = "WealthArena-RL-Inference"
        schedule = "0 0 9 * * ?"  # Daily at 9 AM UTC
        description = "Daily signal generation"
    },
    @{
        job_name = "WealthArena-Portfolio-Optimization"
        schedule = "0 30 9 * * ?"  # Daily at 9:30 AM UTC
        description = "Daily portfolio optimization"
    }
)

foreach ($schedule in $schedules) {
    try {
        Write-Host "Setting up schedule for $($schedule.job_name)..." -ForegroundColor Yellow
        
        # Get job ID first
        $jobList = databricks jobs list --output JSON | ConvertFrom-Json
        $jobId = ($jobList.jobs | Where-Object { $_.settings.name -eq $schedule.job_name }).job_id
        
        if ($jobId) {
            # Update job with schedule
            $scheduleConfig = @{
                schedule = @{
                    quartz_cron_expression = $schedule.schedule
                    timezone_id = "UTC"
                }
            } | ConvertTo-Json -Depth 10
            
            $tempFile = "temp_schedule_config.json"
            $scheduleConfig | Out-File -FilePath $tempFile -Encoding UTF8
            
            $result = databricks jobs update --job-id $jobId --json-file $tempFile 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Schedule set for $($schedule.job_name): $($schedule.schedule)" -ForegroundColor Green
            } else {
                Write-Host "❌ Failed to set schedule for $($schedule.job_name): $result" -ForegroundColor Red
            }
            
            # Clean up
            if (Test-Path $tempFile) {
                Remove-Item $tempFile
            }
        } else {
            Write-Host "⚠️ Job '$($schedule.job_name)' not found, skipping schedule" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "❌ Error setting schedule for $($schedule.job_name): $_" -ForegroundColor Red
    }
}

# Note: Job-level dependencies are not supported in Databricks.
# If dependencies are required, create a single multi-task job where each task
# includes a depends_on block referencing upstream task keys, or orchestrate
# dependencies externally (e.g., via Airflow using DatabricksRunNowOperator
# or staggered schedules plus state checks).

# List all jobs
Write-Host "Listing all WealthArena jobs..." -ForegroundColor Yellow
$jobList = databricks jobs list --output JSON | ConvertFrom-Json
$wealthArenaJobs = $jobList.jobs | Where-Object { $_.settings.name -like "WealthArena-*" }

if ($wealthArenaJobs) {
    Write-Host "📊 WealthArena Jobs Created:" -ForegroundColor Green
    $jobIdsExport = @{}
    foreach ($job in $wealthArenaJobs) {
        Write-Host "  - $($job.settings.name): Job ID $($job.job_id)" -ForegroundColor White
        $jobIdsExport[$job.settings.name] = $job.job_id
    }
    # Export job IDs to file for reference
    $jobIdsExport | ConvertTo-Json | Out-File -FilePath "databricks_job_ids.json" -Encoding UTF8
    Write-Host "📄 Job IDs saved to: databricks_job_ids.json" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ No WealthArena jobs found" -ForegroundColor Yellow
}

Write-Host "✅ Databricks jobs setup completed!" -ForegroundColor Green
Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "1. Upload notebooks to Databricks workspace" -ForegroundColor White
Write-Host "2. Test job execution manually" -ForegroundColor White
Write-Host "3. Monitor job performance and logs" -ForegroundColor White
Write-Host "4. Set up job monitoring and alerts" -ForegroundColor White
