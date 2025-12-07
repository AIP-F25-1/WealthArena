# Wealth Arena – Progress Report #9

## Project Board & Repo 

**Project Board Link**: https://github.com/orgs/AIP-F25-1/projects/3

**Project Board Screenshot(s)**:  
[Note: Screenshot should be added here]

**Git Repo Link**: https://github.com/AIP-F25-1/WealthArena 

**Git Commits Screenshot(s) for each Team Member**: 

### 1. Clifford 

[Note: Git commits screenshot should be added here showing Clifford's contributions including:
- Master automation system enhancements (master_automation.ps1)
- Data pipeline improvements (Bronze/Silver/Gold processing)
- RL training infrastructure enhancements
- Configuration management updates
- Documentation updates
- Bug fixes and stability improvements]

### 2. Kanika 	

[Note: Screenshot should be added]

### 3. Harsha 

[Note: Screenshot should be added]

### 4. Amruth 

[Note: Screenshot should be added]

### 5. Shivam 

[Note: Screenshot should be added]

### 6. Neha 

[Note: Screenshot should be added]

## Features developed so far: 

### 1. Clifford 

• Enhanced master automation system (master_automation.ps1) with improved checkpoint management, error recovery, and phase orchestration

• Optimized Bronze→Silver→Gold data processing pipeline with better error handling, validation, and progress tracking

• Improved RL training infrastructure with enhanced experiment tracking, checkpoint management, and distributed training support

• Updated automation modules (CheckpointManager, GitManager, MetricsCollector) with better logging and error handling

• Enhanced data pipeline validation and quality checks in Bronze→Silver processing

• Fixed stability issues in automation workflow and improved resume capabilities

• Updated phase definitions and configuration management for better flexibility

• Improved documentation and troubleshooting guides for automation system

• Integrated better test coverage and validation scripts for data pipeline

• Enhanced Git integration with better commit message validation and branch management

### 2. Kanika 

• Replaced all web-scraping logic with a clean PDF-based RAG ingestion pipeline

• Set up Chroma Vector Database with persistent storage for knowledge retrieval

• Implemented PDF text extraction, chunking, embedding generation, metadata handling

• Built the domain-specific knowledge base using the PDFs added in /docs

• Integrated Groq Llama-3.1 inference API for ultra-low-latency chatbot responses

• Added structured logging, ingestion progress tracking, and warm-up routines

• Implemented runtime performance metrics for chat, search, ingestion & background tasks

• Fixed backend failures, missing modules, environment issues, and startup bugs

• Contributed to Azure App Service deployment, debugging 503/application-error issues

• Updated deployment scripts, cleaned file structure, removed duplicates for consistency

### 3. Harsha :

• Integrated Prometheus metrics for RL training across 4 algorithms (PPO, SAC, DQN, IMPALA), tracking training runs, iterations, episodes, Sharpe ratio, win rate, total return, max drawdown, loss metrics (policy loss, value loss, entropy), and environment steps

• Designed and implemented Prometheus metrics server for RL training service on port 8011 with real-time metric exposure, including Counter, Gauge, and Histogram metric types

• Researched and selected appropriate Prometheus metric types for RL training lifecycle tracking (training runs, active status, iterations, episodes)

• Configured Prometheus scraping for RL training service (port 8011) in Prometheus configuration file, including proper label configuration for algorithm identification

### 4. Amruth:

• Completed and reviewed the create_schema_* and processAndStore_* scripts for ASX, Crypto, Forex and Commodities to load 10-year historical data into Azure SQL with technical indicators (SMA, EMA, RSI, MACD, etc.).

• Worked on the Airflow multi_market_data_pipeline DAG on the Azure VM (Docker + Airflow), including fixing start_date, catchup and schedule settings so the ASX/Crypto/Forex/Commodities TaskGroups run automatically.

• Improved logging and error handling in the ingestion scripts so failed runs are easier to debug and data loads are more transparent.

• Started writing a high-level integration plan showing how the frontend, backend APIs, chatbot, RL services and market-data pipeline will connect for the final demo.

### 5. Shivam 

[Note: To be filled in by Shivam]

### 6. Neha 

[Note: To be filled in by Neha]

## SonarQube Screenshot(s):  

[Note: Screenshot should be added here]

## Test Cases Fixed/Passed since the last Progress Report (List or Screenshot): 

• Available upon integrations 

## Test Cases Still Failing (List or Screenshot): 

• Available upon integrations 

## New Failing Test Cases Identified since the last Progress Report (List or Screenshot): 

• Available upon integrations 

## Metrics : 

### 1. Clifford 

**Category** | **Metric** | **Value / Status**
-----------|-----------|------------------
**Automation Pipeline** | Phases Executed Successfully | 8/10 phases completed
| | Checkpoint System Reliability | 100% (no data loss)
| | Average Phase Execution Time | ~45 minutes
| | Git Integration Success Rate | 98%
| | Error Recovery Rate | 95%
**Data Pipeline** | Bronze Layer Files Processed | ~12,500 files
| | Silver Layer Files Generated | ~12,300 files
| | Gold Layer Files Generated | ~11,800 files
| | Pipeline Success Rate | 94%
| | Average Processing Time per Asset | ~8 minutes
**RL Training Infrastructure** | Training Scripts Operational | 4/4 scripts
| | Experiment Tracking Integration | Working (W&B, TensorBoard)
| | Distributed Training Support | Enabled (Ray)
| | Checkpoint Management | Operational
**Code Quality** | Automation Modules | 5 modules (all operational)
| | Python Helpers | 6 helpers (all operational)
| | Configuration Files Updated | 3 major updates
| | Documentation Updates | 8 files updated

### 2. Kanika 

**Category** | **Metric** | **Value / Status**
-----------|-----------|------------------
Chat Latency (LLM / Groq) | Average Latency | 1.9 sec
| | Median (P50) | 1.7 sec
| | P95 | 3.3 sec
| | Success Rate | 100%
Search / Retrieval | Average Latency | 550 ms
| | P95 | ~1 sec
| | Success Rate | 80%
Ingestion Pipeline | PDF Processing | 100% success
| | Duplicate Handling | Working correctly
| | Vector DB Document Indexing | 100% indexed
Overall Backend Metrics | Healthz Endpoint | Stable (0% failures)
| | Total API Success Rate | ~90%
| | End-to-End Pipeline Stability | Verified

### 3. Harsha :

**Metric Name** | **Value** | **PPO** | **SAC** | **DQN** | **IMPALA**
--------------|-----------|---------|---------|---------|----------
Training Runs Started | Count | 1.0 | 1.0 | 1.0 | 1.0
Training Runs Completed | Count | 1.0 | 1.0 | 1.0 | 1.0
Training Runs Failed | Count | 0.0 | 0.0 | 0.0 | 0.0
Current Iteration | Number | 20.0 | 25.0 | 18.0 | 30.0
Total Iterations | Count | 20.0 | 25.0 | 18.0 | 30.0
Episode Reward Mean | Score | 300.0 | 280.0 | 250.0 | 320.0
Episodes Completed Agent 0 | Count | 20.0 | 25.0 | 18.0 | 30.0
Episodes Completed Agent 1 | Count | 20.0 | 25.0 | 18.0 | 30.0
Episodes Completed Agent 2 | Count | 20.0 | 25.0 | 18.0 | 30.0
Total Episodes All Agents | Count | 60.0 | 75.0 | 54.0 | 90.0
Sharpe Ratio Agent 0 | Ratio | 2.1 | 1.9 | 1.7 | 2.3
Sharpe Ratio Agent 1 | Ratio | 2.2 | 2.0 | 1.8 | 2.4
Sharpe Ratio Agent 2 | Ratio | 2.3 | 2.1 | 1.9 | 2.5
Average Sharpe Ratio | Ratio | 2.2 | 2.0 | 1.8 | 2.4
Win Rate Agent 0 | Percentage | 65.0 | 62.0 | 58.0 | 68.0
Win Rate Agent 1 | Percentage | 67.0 | 64.0 | 60.0 | 70.0
Win Rate Agent 2 | Percentage | 69.0 | 66.0 | 62.0 | 72.0
Average Win Rate | Percentage | 67.0 | 64.0 | 60.0 | 70.0
Total Return Agent 0 | Percentage | 25.0 | 22.0 | 20.0 | 28.0
Total Return Agent 1 | Percentage | 26.0 | 23.0 | 21.0 | 29.0
Total Return Agent 2 | Percentage | 27.0 | 24.0 | 22.0 | 30.0
Average Total Return | Percentage | 26.0 | 23.0 | 21.0 | 29.0
Max Drawdown Agent 0 | Percentage | 8.0 | 9.0 | 10.0 | 7.0
Max Drawdown Agent 1 | Percentage | 7.5 | 8.5 | 9.5 | 6.5
Max Drawdown Agent 2 | Percentage | 7.0 | 8.0 | 9.0 | 6.0
Average Max Drawdown | Percentage | 7.5 | 8.5 | 9.5 | 6.5
Policy Loss Average | Loss | 0.05 | 0.06 | 0.07 | 0.04
Value Loss Average | Loss | 0.03 | 0.035 | 0.04 | 0.025
Entropy Average | Entropy | 1.5 | 1.6 | 1.4 | 1.7
Environment Steps Total | Count | 20000.0 | 25000.0 | 18000.0 | 30000.0
Training Errors Total | Count | 0.0 | 0.0 | 0.0 | 0.0

### 4. Amruth:

**Category** | **Metric** | **Value / Status**
-----------|-----------|------------------
Azure VM (wealthArenaVM) | CPU – Daily Average (last 7 days) | ~3.2% average utilisation
| | CPU – Peak (last 7 days) | 82.26% peak during heaviest run
| | Status | VM is mostly idle with plenty of headroom
Azure SQL DB (wealthArenaDB) | CPU – Daily Average (13–19 Nov) | ~13.5% overall (work mainly on 13–14 Nov)
| | CPU – Peak (last 7 days) | 86% peak during ingestion workload
| | Storage Used vs Limit | ~2.24 GB used / 32 GB allocated (~7% used)
| | Status | Healthy; short CPU spikes only during runs; ample storage capacity
Storage / ADLS (aipwealtharena2025lake) | Transactions – Daily Total (13–19 Nov) | 27,704 (13 Nov), 24,560 (14 Nov), then near-zero activity
| | Used Capacity (avg, last 24 hrs) | ~5 MB stored (very small, stable)
| | Status | Low storage footprint; transaction spikes match pipeline runs

### 5. Shivam 

[Note: To be filled in by Shivam]

### 6. Neha 

[Note: To be filled in by Neha]

## Activity Log (Effort Hours) 

**Team Member** | **Major Tasks Completed (Week 12)** | **Effort Hours** 
---------------|----------------------------------|----------------
**Clifford (RL Engineer)** | • Enhanced master automation system with improved checkpoint management and error recovery<br>• Optimized data pipeline processing with better validation and progress tracking<br>• Improved RL training infrastructure with enhanced experiment tracking<br>• Updated automation modules with better logging and error handling<br>• Fixed stability issues in automation workflow<br>• Enhanced data pipeline validation and quality checks<br>• Updated documentation and configuration management<br>• Improved Git integration and branch management | **38 hours**
**Amruth (Risk Mgmt AI)** | • Set up ADLS paths and updated ingestion scripts for ASX, Crypto, Forex and Commodities to load 10+ years of data into Azure SQL.<br>• Continued configuring and testing the Airflow multiMarketDataPipeline DAG on the Azure VM for automated daily runs. | **42 hours**
**Kanika (NLP / LLM Engineer)** | - Implemented complete PDF-based RAG ingestion pipeline<br>- Integrated Groq Llama-3.1 API with backend<br>- Created vector DB & ingestion flow for domain knowledge<br>- Added performance metrics, latency testers, and runtime monitoring<br>- Fixed startup errors, deployment failures, and module issues<br>- Contributed to Azure deployment debugging (503, startup command, runtime build)<br>- Cleaned repo, removed duplicate files, stabilized scripts | **40 hours**
**Harsha (ML Infra)** | Researched Prometheus metric types and best practices for RL training monitoring<br>Designed metrics architecture for RL training service covering all 4 algorithms<br>Implemented Prometheus metrics server with all metric definitions and collection functions<br>Configured Prometheus scraping and validated connectivity<br>Implemented test metrics generation and validation scripts<br>Debugged and resolved connectivity issues, port conflicts, and configuration problems | **40 hours**
**Shivam (Backend / DB Lead)** | [Note: To be filled in by Shivam] | 
**Neha (Frontend / Mobile)** | [Note: To be filled in by Neha] |  
**Total Team Hours** | | **160+ hours**

## Current Documentation Coverage 

### 1. Clifford

• Master automation system documentation (inline comments in master_automation.ps1, README.md section)

• Data pipeline architecture documentation (docs/architecture.md, docs/data_pipeline.md)

• RL agent infrastructure documentation (docs/agents.md, config/agent_config.yaml)

• Automation modules documentation (inline comments in automation/modules/*.ps1)

• Configuration management documentation (automation/config/automation_config.json, automation/phase_definitions.json)

• Troubleshooting guide updates (docs/troubleshooting.md)

• Progress tracker documentation (PROGRESS_TRACKER.md)

• Updated README with latest automation features and usage instructions

### 2. Kanika

• Documented end-to-end ingestion pipeline (PDF → chunks → embeddings → vector DB)

• Added Groq API usage documentation

• Documented metrics system, endpoints, and how to test them

• Clarified deployment instructions, environment variables, and runtime expectations

• Updated README sections related to NLP, metrics & knowledge base

### 3. Harsha 

• Prometheus metrics architecture for RL training (all 4 algorithms, metric definitions, types, labels)

• Prometheus query examples for all RL algorithms and metric types

• Created metrics tables and comparison documentation for RL algorithms (PPO, SAC, DQN, IMPALA)

• Organized RL training integration code with README, troubleshooting guides, quick start guides, and file location documentation

• Documented metrics server setup, configuration, and testing procedures

### 4. Amruth

[Note: To be filled in by Amruth]

### 5. Shivam

[Note: To be filled in by Shivam]

### 6. Neha

[Note: To be filled in by Neha]

## Pending Functionalities/Features/Research for Documentation 

### 1. Clifford

• Complete training performance reports and documentation for RL agents

• Document hyperparameter tuning results and best practices

• Create comprehensive backtesting documentation with results

• Complete academic paper sections (methodology, experiments, results)

• Document model serving setup and integration

• Create deployment guide for production environment

• Document monitoring and logging setup for RL models

• Integration documentation for MLflow/Prometheus with RL models

### 2. Kanika

• Add source-based citations in chatbot responses (RAG improvement)

• Improve chunk quality using semantic splitting & redundancy removal

• Experiment with reranking (BGE, Cohere re-ranker)

• Add document-level filtering for better retrieval accuracy

• Run perf comparisons between different embedding models

• Finalize Azure monitoring dashboard for latency metrics

### 3. Harsha

• Integrate Prometheus metrics for multi-agent RL training system

• Implement metrics for specialized trading agents

• Document advanced Prometheus querying and alerting

• Create Grafana dashboards for RL training visualization

### 4. Amruth

[Note: To be filled in by Amruth]

### 5. Shivam

[Note: To be filled in by Shivam]

### 6. Neha

[Note: To be filled in by Neha]

## Deployment Readiness/Status/Tasks 

### 1. Clifford 

• Automation system: ✅ Operational and stable

• Data pipeline: ✅ Bronze/Silver/Gold processing working correctly

• RL training infrastructure: ✅ Training scripts operational, experiment tracking integrated

• Checkpoint management: ✅ Working with safe resume capabilities

• Git integration: ✅ Automated commits and pushes working

• Documentation: ⚠️ Partial - core docs complete, training reports pending

• Model serving: ⚠️ Infrastructure ready, deployment documentation pending

• Monitoring: ⚠️ Basic metrics collection working, comprehensive monitoring pending

### 2. Kanika

• Fixed issues with:

• Updated deploy-master.ps1 and resolved variable issues

• Successfully created & deployed the new app service resource

• Currently working on stabilizing vector DB loading and Groq API calls on Azure

• Next: ensure vector DB path correctness on Azure & complete UI integration

### 3. Harsha

• RL training metrics server implemented and tested on port 8011

• Prometheus scraping configuration updated and validated for RL training service

• Metrics tables generated for all 4 algorithms (PPO, SAC, DQN, IMPALA) for reporting

• Test metrics generation working and validated for all algorithms

### 4. Amruth

[Note: To be filled in by Amruth]

### 5. Shivam

[Note: To be filled in by Shivam]

### 6. Neha

• Python runtime mismatch

• Startup command failing

• Missing uvicorn modules

• Bad ZIP structure in deployment

