# Reinforcement Learning Agents

This document summarizes the design of the agent hierarchy and how it relates to configuration and data assets in the repository.

## PPO Asset Agents (`src/agents/ppo_agent.py`)

- **State**: Rolling feature vectors built from Gold datasets (`technical`, `sentiment`, `macro`, `regime`) plus current position and cash context. Observations are windowed and flattened by `TradingEnv`/`PortfolioEnv`.
- **Action Space**: Continuous signal in `[-1, 1]` representing target position (short ↔ long). Bounds and leverage controls per asset class are defined in `config/agent_config.yaml`.
- **Reward**: Combination of Sharpe-style excess returns with penalties for CVaR, drawdown, turnover, and transaction costs. The exact weights are configured per asset class in `config/agent_config.yaml`.
- **Training**: Stable-Baselines3 PPO with policy defaults from the config file. Launch via `scripts/train_ppo_agents.py` or the orchestrated `scripts/train_all_agents.py` (supports Ray-distributed execution and experiment tracking).
- **Factory & Callbacks**: `PPOAgentFactory` centralizes asset-specific overrides; `PPOTrainingCallback` logs checkpoints, metrics, and W&B artefacts following the logging conventions in `src/utils`.

## SAC Meta-Controller (`src/agents/sac_meta_controller.py`)

- **State**: Aggregated PPO signals (per asset class), macro regime indicators, Ledoit–Wolf covariance snapshots, and portfolio diagnostics.
- **Action Space**: Portfolio weight allocation vector constrained by leverage, minimum/max exposure, and turnover budgets.
- **Reward**: Off-policy SAC objective balancing realized returns, CVaR, drawdown, and penalty terms for violating allocation limits. Integrates with `PortfolioEnv` to evaluate hierarchical decisions.
- **Training Loop**: `scripts/train_sac_controller.py` pulls PPO signal datasets and runs SAC updates with optional Ray acceleration. Supports replay buffers built from live PPO rollouts or offline datasets.

## Conservative Q-Learning Pretrainer (`src/agents/cql_pretrainer.py`)

- **Purpose**: Provides offline initialization for PPO/SAC by training on historical datasets with conservative penalties to avoid extrapolation error.
- **Dataset**: Generated via `scripts/pretrain_cql.py`, which samples Gold features, PPO meta-data, and simulated trade outcomes to build a replay buffer.
- **Safety**: Enforces hard constraints before fine-tuning (max drawdown, exposure limits, sector caps) through `SafetyValidator` and integrates with experiment tracking for auditability.

## Configuration & Experimentation

- Agent hyperparameters live in `config/agent_config.yaml`. Each asset class inherits global defaults and overrides learning rates, batch sizes, KL penalties, reward weights, and callback options.
- Replay buffer, offline dataset, and pretraining parameters are declared in `config/data_config.yaml` and `config/feature_config.yaml`.
- Use `scripts/train_all_agents.py --distributed --num-workers 4` to execute Ray-distributed PPO training. LangGraph/Ray integration is handled by `src/orchestration/ray_trainer.py`, while multi-agent workflows leverage `src/orchestration/multi_agent_orchestrator.py`.

Adhere to the logging conventions established in `src/utils.get_logger` when extending agent classes or callbacks to keep experiment artifacts and structured logs consistent.
