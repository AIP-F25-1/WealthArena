# System Architecture

This document captures the end-to-end architecture of the Agentic Multi-Agent RL Trading System and explains how data, intelligence, and execution layers communicate.

## High-Level Flow

```{mermaid}
flowchart LR
    A[Bronze Layer<br/>Raw Parquet (partitioned)] --> B[Silver Layer<br/>Validated Schema]
    B --> C[Gold Layer<br/>Feature Store]
    C --> D[PPO Asset Agents<br/>Stable-Baselines3]
    D --> E[SAC Meta-Controller<br/>Portfolio Allocation]
    E --> F[Execution Layer<br/>Backtrader + vectorbt]
    F --> G[Serving & Reporting<br/>BentoML | LangGraph]
```

- **Bronze → Silver → Gold** implements the medallion pattern described in `src/data/processors.py` and `src/features/*.py`.
- **RL Layer** combines per-asset PPO policies (`src/agents/ppo_agent.py`) with a SAC-based meta-controller (`src/agents/sac_meta_controller.py`) and offline safety pretraining (`src/agents/cql_pretrainer.py`).
- **Execution Surface** couples event-driven analytics (`src/backtesting/backtest_engine.py`) with vectorized analysis (`src/backtesting/vectorized_backtester.py`) and portfolio tooling (`src/portfolio/*.py`).
- **Orchestration & Serving** rely on LangGraph (`src/orchestration/multi_agent_orchestrator.py`), Ray (`src/orchestration/ray_trainer.py`), and BentoML (`src/serving/model_server.py`) to provide reproducibility and deployment.

## Subsystem Overview

### Data Pipeline (`src/data`, `src/features`, `scripts/process_*.py`)
- **Ingestion** uses collectors (`YahooFinanceCollector`, `CCXTCollector`, `AlphaVantageCollector`, `FREDCollector`, `SocialMediaCollector`) with rate limiting, retries, and metadata-rich Parquet output.
- **Bronze → Silver** processing enforces canonical schemas, quality flags, and UTC timestamps via `BronzeToSilverProcessor`.
- **Silver → Gold** applies feature engineering: TA-Lib indicators, FinBERT/BERTweet sentiment, macro differentials, Ledoit–Wolf shrinkage, and portfolio-ready covariances.
- **Utilities** in `src/features` keep indicator logic, sentiment alignment, macro pipelines, and correlation diagnostics modular.

### Reinforcement Learning Layer (`src/agents`, `config/agent_config.yaml`)
- **PPO Asset Agents** observe technical, sentiment, and position features; act in the continuous range `[-1, 1]`; optimize a reward blending Sharpe, drawdown, turnover, and cost penalties. Hyperparameters live in `config/agent_config.yaml` and training entrypoints in `scripts/train_ppo_agents.py` / `scripts/train_all_agents.py`.
- **SAC Meta-Controller** consumes PPO signals plus macro, covariance, and regime state to output allocation weights with leverage and risk budgets (`src/agents/sac_meta_controller.py`).
- **CQL Pretraining** builds offline buffers and enforces safety limits prior to on-policy fine-tuning (`scripts/pretrain_cql.py`).

### Orchestration (`src/orchestration`)
- **LangGraph Workflows** orchestrate hierarchical/parallel agent execution through `WorkflowBuilder` and `AgentCommunicationBus`.
- **Ray Trainer** enables distributed PPO training (`RayTrainer`) with experiment tracking hooks.
- **Experiment Tracking** integrates W&B, TensorBoard, and LangSmith for traceability.

### Backtesting & Evaluation (`src/backtesting`, `scripts/run_*`)
- **Backtrader Engine** provides event-driven simulations with transaction cost and slippage modelling.
- **Vectorbt-style Engine** accelerates experimentation; supports purged K-fold walk-forward optimization (`walk_forward.py`) and Monte Carlo stress tests (`monte_carlo.py`).
- **Performance Analytics** compute Sharpe, Sortino, CVaR, turnover, attribution, and regime-aware diagnostics.

### Serving & Deployment (`src/serving`, `scripts/serve_*.py`)
- **BentoML Service** wraps TradingService endpoints (`/predict`, `/allocate`, `/health`) via `ModelServer`.
- **Paper Trading Connectors** (Alpaca, CCXT) expose allocation decisions to live sandboxes with risk checks (`src/serving/paper_trading.py`).
- **LangGraph Orchestration** coordinates scheduled inference, logging, and escalation loops for production-like environments.

## Technology Stack

- **Data**: Pandas, Parquet, TA-Lib, FinBERT/BERTweet, Ledoit–Wolf.
- **RL**: Stable-Baselines3 (PPO), PyTorch, SAC implementation, CQL offline training.
- **Backtesting**: Backtrader, vectorbt-inspired utilities, block bootstrap simulation.
- **Serving**: BentoML, FastAPI, Ray, LangGraph, LangSmith observability.
- **Tooling**: pytest + coverage, Sphinx docs, W&B/TensorBoard experiment logging.

