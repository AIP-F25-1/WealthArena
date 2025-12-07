# Prometheus Metrics for RL Training Models - Report Section

## Prometheus Integration for RL Training Models

The WealthArena RL training system implements comprehensive Prometheus metrics monitoring for all training models, enabling real-time observability of the entire training pipeline.

### Scope of Monitoring

**Algorithms Monitored:**
- PPO (Proximal Policy Optimization) - Primary algorithm for stable learning
- SAC (Soft Actor-Critic) - Continuous action space optimization
- DQN (Deep Q-Network) - Discrete action space for currency trading
- IMPALA - Distributed training algorithm

**Agent Types Monitored:**
- 7 Specialized Trading Agents: ASX Stocks, ETF, REIT, Currency Pairs, US Stocks, Commodities, Cryptocurrency
- 5 Multi-Agent System Agents: Conservative, Aggressive, Balanced, and 2 additional specialized agents

### Metrics Architecture

The system exposes **21 distinct metric types** organized into 7 categories:

#### 1. Training Lifecycle Metrics (5 metrics)
- `rl_training_runs_total` - Total training runs by algorithm and status (started/completed/failed)
- `rl_training_active` - Active training status indicator (1=active, 0=inactive)
- `rl_training_duration_seconds` - Training duration histogram with buckets from 1 minute to 10 hours
- `rl_training_iterations_total` - Total training iterations completed per algorithm
- `rl_training_current_iteration` - Current iteration number for active training runs

#### 2. Episode Metrics (5 metrics)
- `rl_training_episodes_total` - Total episodes completed by algorithm and agent
- `rl_training_episode_reward` - Episode reward distribution histogram
- `rl_training_episode_reward_mean` - Current mean episode reward per iteration
- `rl_training_episode_length` - Episode length distribution histogram
- `rl_training_episode_length_mean` - Current mean episode length per iteration

#### 3. Performance Metrics (4 metrics)
- `rl_training_sharpe_ratio` - Risk-adjusted return metric per algorithm and agent
- `rl_training_max_drawdown` - Maximum drawdown percentage per algorithm and agent
- `rl_training_win_rate` - Win rate percentage (0-100) per algorithm and agent
- `rl_training_total_return` - Total return percentage per algorithm and agent

#### 4. Loss Metrics (3 metrics)
- `rl_training_policy_loss` - Policy loss histogram during training
- `rl_training_value_loss` - Value function loss histogram
- `rl_training_entropy` - Policy entropy (exploration measure) histogram

#### 5. Data & Environment Metrics (2 metrics)
- `rl_training_data_load_time_seconds` - Data loading time histogram
- `rl_training_environment_steps_total` - Total environment steps per algorithm

#### 6. Error Tracking (1 metric)
- `rl_training_errors_total` - Training errors by error type (data_error, training_error, evaluation_error)

#### 7. Time Metrics (1 metric)
- `rl_training_start_timestamp` - Unix timestamp when training started per algorithm and run

### Metric Types Distribution

- **Counters**: 4 metrics (runs, iterations, episodes, steps, errors)
- **Gauges**: 8 metrics (active status, current values, performance metrics)
- **Histograms**: 9 metrics (distributions for duration, rewards, lengths, losses)

### Labeling Strategy

Metrics are labeled with:
- `algorithm`: PPO, SAC, DQN, IMPALA
- `agent_id`: agent_0 through agent_4 (for multi-agent metrics)
- `status`: started, completed, failed (for run metrics)
- `run_id`: Unique identifier for each training run
- `error_type`: Classification of error types

This labeling enables:
- Algorithm comparison (e.g., PPO vs SAC performance)
- Agent performance analysis (e.g., Conservative vs Aggressive strategies)
- Multi-run tracking (e.g., comparing different training experiments)
- Error categorization and debugging

### Integration Details

**Metrics Endpoint:**
- URL: `http://localhost:8011/metrics`
- Format: Prometheus text format
- Protocol: HTTP/GET

**Prometheus Configuration:**
- Job Name: `wealtharena_rl_training`
- Scrape Interval: 10 seconds
- Target: `host.docker.internal:8011`
- Path: `/metrics`

**Grafana Integration:**
- Comprehensive dashboard with 18 panels
- Real-time visualization of all metrics
- Algorithm filtering and multi-agent comparison
- Historical trend analysis

### Key Monitoring Capabilities

1. **Training Progress Tracking**: Monitor iteration progress, episode completion, and training duration in real-time
2. **Performance Comparison**: Compare Sharpe ratios, win rates, and returns across different algorithms and agents
3. **Loss Analysis**: Track policy loss, value loss, and entropy to monitor training quality
4. **Error Detection**: Identify and categorize training errors for quick debugging
5. **Resource Monitoring**: Track data loading times and environment step rates

### Example Use Cases

- **Algorithm Selection**: Compare PPO vs SAC performance metrics to choose optimal algorithm
- **Agent Tuning**: Analyze win rates and Sharpe ratios across different agent strategies
- **Training Optimization**: Monitor loss metrics to identify convergence issues
- **Error Prevention**: Track error rates to proactively address training failures
- **Resource Planning**: Analyze data load times and environment steps for capacity planning

### Metrics Availability

All metrics are automatically generated when:
- RL training is running (metrics server starts automatically)
- Training iterations complete (metrics updated in real-time)
- Episodes finish (agent-specific metrics recorded)
- Performance evaluations occur (Sharpe, drawdown, win rate updated)

The metrics system provides complete observability into the RL training pipeline, enabling data-driven decisions for model selection, hyperparameter tuning, and system optimization.

