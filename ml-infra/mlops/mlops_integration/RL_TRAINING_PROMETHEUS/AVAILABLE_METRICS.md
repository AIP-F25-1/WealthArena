# Available RL Training Metrics in Prometheus

Complete list of all metrics you can query for RL training models.

## 📊 Training Lifecycle Metrics

### Training Runs
```
# Total training runs (all statuses)
sum(rl_training_runs_total{})

# Training runs by status
sum by (status) (rl_training_runs_total{})

# Training runs by algorithm
sum by (algorithm) (rl_training_runs_total{})

# Training runs by algorithm and status
rl_training_runs_total{}

# Only started runs
sum(rl_training_runs_total{status="started"})

# Only completed runs
sum(rl_training_runs_total{status="completed"})

# Only failed runs
sum(rl_training_runs_total{status="failed"})
```

### Training Status
```
# Check if training is currently active (1 = active, 0 = not active)
sum(rl_training_active{})

# Active training by algorithm
rl_training_active{}

# Check if any training is active
sum(rl_training_active{}) > 0
```

### Training Duration
```
# Training duration histogram (shows distribution)
rate(rl_training_duration_seconds_sum[5m]) / rate(rl_training_duration_seconds_count[5m])

# Average training duration
rate(rl_training_duration_seconds_sum[5m]) / rate(rl_training_duration_seconds_count[5m])

# Training duration by algorithm
rate(rl_training_duration_seconds_sum{algorithm="PPO"}[5m])
```

### Training Iterations
```
# Total iterations across all algorithms
sum(rl_training_iterations_total{})

# Iterations by algorithm
sum by (algorithm) (rl_training_iterations_total{})

# Iteration rate (iterations per second)
rate(rl_training_iterations_total[5m])

# Current iteration number
rl_training_current_iteration{}

# Current iteration by algorithm and run
rl_training_current_iteration{algorithm="PPO"}
```

## 🎮 Episode Metrics

### Episode Counts
```
# Total episodes across all agents
sum(rl_training_episodes_total{})

# Episodes by algorithm
sum by (algorithm) (rl_training_episodes_total{})

# Episodes by agent
sum by (agent_id) (rl_training_episodes_total{})

# Episodes by algorithm and agent
rl_training_episodes_total{}

# Episode rate (episodes per second)
rate(rl_training_episodes_total[5m])
```

### Episode Rewards
```
# Current mean episode reward
rl_training_episode_reward_mean{}

# Episode reward by algorithm
rl_training_episode_reward_mean{algorithm="PPO"}

# Episode reward by run
rl_training_episode_reward_mean{run_id="demo_run"}

# Episode reward distribution (histogram)
histogram_quantile(0.95, sum(rate(rl_training_episode_reward_bucket[5m])) by (le))
histogram_quantile(0.50, sum(rate(rl_training_episode_reward_bucket[5m])) by (le))
histogram_quantile(0.05, sum(rate(rl_training_episode_reward_bucket[5m])) by (le))

# Average episode reward
rate(rl_training_episode_reward_sum[5m]) / rate(rl_training_episode_reward_count[5m])
```

### Episode Length
```
# Current mean episode length
rl_training_episode_length_mean{}

# Episode length by algorithm
rl_training_episode_length_mean{algorithm="PPO"}

# Episode length distribution
histogram_quantile(0.95, sum(rate(rl_training_episode_length_bucket[5m])) by (le))
histogram_quantile(0.50, sum(rate(rl_training_episode_length_bucket[5m])) by (le))

# Average episode length
rate(rl_training_episode_length_sum[5m]) / rate(rl_training_episode_length_count[5m])
```

## 📈 Performance Metrics

### Sharpe Ratio
```
# Current Sharpe ratio for all agents
rl_training_sharpe_ratio{}

# Sharpe ratio by algorithm
rl_training_sharpe_ratio{algorithm="PPO"}

# Sharpe ratio by agent
rl_training_sharpe_ratio{agent_id="agent_0"}

# Sharpe ratio for specific algorithm and agent
rl_training_sharpe_ratio{algorithm="PPO", agent_id="agent_0"}

# Average Sharpe ratio across all agents
avg(rl_training_sharpe_ratio{})
```

### Max Drawdown
```
# Current max drawdown (as percentage)
rl_training_max_drawdown{}

# Max drawdown by algorithm
rl_training_max_drawdown{algorithm="PPO"}

# Max drawdown by agent
rl_training_max_drawdown{agent_id="agent_0"}

# Worst (highest) drawdown across all agents
max(rl_training_max_drawdown{})
```

### Win Rate
```
# Current win rate (percentage 0-100)
rl_training_win_rate{}

# Win rate by algorithm
rl_training_win_rate{algorithm="PPO"}

# Win rate by agent
rl_training_win_rate{agent_id="agent_0"}

# Average win rate
avg(rl_training_win_rate{})
```

### Total Return
```
# Current total return (percentage)
rl_training_total_return{}

# Total return by algorithm
rl_training_total_return{algorithm="PPO"}

# Total return by agent
rl_training_total_return{agent_id="agent_0"}

# Best return across all agents
max(rl_training_total_return{})
```

## 🔧 Loss Metrics

### Policy Loss
```
# Average policy loss
rate(rl_training_policy_loss_sum[5m]) / rate(rl_training_policy_loss_count[5m])

# Policy loss by algorithm
rate(rl_training_policy_loss_sum{algorithm="PPO"}[5m]) / rate(rl_training_policy_loss_count{algorithm="PPO"}[5m])

# Policy loss percentiles
histogram_quantile(0.95, sum(rate(rl_training_policy_loss_bucket[5m])) by (le))
histogram_quantile(0.50, sum(rate(rl_training_policy_loss_bucket[5m])) by (le))
```

### Value Loss
```
# Average value loss
rate(rl_training_value_loss_sum[5m]) / rate(rl_training_value_loss_count[5m])

# Value loss by algorithm
rate(rl_training_value_loss_sum{algorithm="PPO"}[5m]) / rate(rl_training_value_loss_count{algorithm="PPO"}[5m])

# Value loss percentiles
histogram_quantile(0.95, sum(rate(rl_training_value_loss_bucket[5m])) by (le))
```

### Entropy (Exploration)
```
# Average entropy (exploration measure)
rate(rl_training_entropy_sum[5m]) / rate(rl_training_entropy_count[5m])

# Entropy by algorithm
rate(rl_training_entropy_sum{algorithm="PPO"}[5m]) / rate(rl_training_entropy_count{algorithm="PPO"}[5m])

# Entropy distribution
histogram_quantile(0.50, sum(rate(rl_training_entropy_bucket[5m])) by (le))
```

## 📊 Data & Environment Metrics

### Data Loading
```
# Data load time distribution
histogram_quantile(0.95, sum(rate(rl_training_data_load_time_seconds_bucket[5m])) by (le))

# Average data load time
rate(rl_training_data_load_time_seconds_sum[5m]) / rate(rl_training_data_load_time_seconds_count[5m])
```

### Environment Steps
```
# Total environment steps
sum(rl_training_environment_steps_total{})

# Environment steps by algorithm
sum by (algorithm) (rl_training_environment_steps_total{})

# Environment steps rate (steps per second)
sum(rate(rl_training_environment_steps_total[5m]))

# Steps rate by algorithm
rate(rl_training_environment_steps_total{algorithm="PPO"}[5m])
```

## ⚠️ Error Metrics

### Training Errors
```
# Total training errors
sum(rl_training_errors_total{})

# Errors by type
sum by (error_type) (rl_training_errors_total{})

# Error rate (errors per second)
sum(rate(rl_training_errors_total[5m]))

# Errors by type (rate)
sum by (error_type) (rate(rl_training_errors_total[5m]))
```

## 🕐 Time-Based Metrics

### Training Start Time
```
# When training started (Unix timestamp)
rl_training_start_timestamp{}

# Training start time by algorithm
rl_training_start_timestamp{algorithm="PPO"}

# Training start time by run
rl_training_start_timestamp{run_id="demo_run"}
```

## 🔍 Filtering Examples

### Filter by Algorithm
```
# All metrics for PPO
{algorithm="PPO"}

# All metrics for SAC
{algorithm="SAC"}

# Multiple algorithms
{algorithm=~"PPO|SAC"}
```

### Filter by Agent
```
# Metrics for agent_0
{agent_id="agent_0"}

# Metrics for multiple agents
{agent_id=~"agent_0|agent_1"}
```

### Filter by Run ID
```
# Metrics for specific run
{run_id="demo_run"}
```

### Combined Filters
```
# Sharpe ratio for PPO agent_0
rl_training_sharpe_ratio{algorithm="PPO", agent_id="agent_0"}

# Episode reward for specific run
rl_training_episode_reward_mean{run_id="demo_run", algorithm="PPO"}
```

## 📊 Useful Aggregations

### Across All Agents
```
# Average Sharpe ratio across all agents
avg(rl_training_sharpe_ratio{})

# Maximum Sharpe ratio
max(rl_training_sharpe_ratio{})

# Minimum drawdown (best performance)
min(rl_training_max_drawdown{})

# Sum of all episodes
sum(rl_training_episodes_total{})
```

### By Algorithm
```
# Average metrics by algorithm
avg by (algorithm) (rl_training_sharpe_ratio{})
avg by (algorithm) (rl_training_win_rate{})
avg by (algorithm) (rl_training_total_return{})
```

### By Agent
```
# Metrics grouped by agent
avg by (agent_id) (rl_training_sharpe_ratio{})
sum by (agent_id) (rl_training_episodes_total{})
```

## 🎯 Quick Reference - Most Common Queries

```
# 1. Is training running?
sum(rl_training_active{})

# 2. How many training runs?
sum(rl_training_runs_total{})

# 3. Current episode reward
rl_training_episode_reward_mean{}

# 4. Current iteration
rl_training_current_iteration{}

# 5. Sharpe ratio
rl_training_sharpe_ratio{}

# 6. Win rate
rl_training_win_rate{}

# 7. Total episodes
sum(rl_training_episodes_total{})

# 8. Training errors
sum(rl_training_errors_total{})

# 9. Policy loss
rate(rl_training_policy_loss_sum[5m]) / rate(rl_training_policy_loss_count[5m])

# 10. Environment steps rate
sum(rate(rl_training_environment_steps_total[5m]))
```

## 📈 Graph Queries (Time Series)

These queries work best in Graph view:

```
# Training progress over time
rl_training_episode_reward_mean{}
rl_training_current_iteration{}
rl_training_sharpe_ratio{}

# Performance metrics over time
rl_training_win_rate{}
rl_training_total_return{}
rl_training_max_drawdown{}

# Loss metrics over time
rate(rl_training_policy_loss_sum[5m]) / rate(rl_training_policy_loss_count[5m])
rate(rl_training_value_loss_sum[5m]) / rate(rl_training_value_loss_count[5m])
rate(rl_training_entropy_sum[5m]) / rate(rl_training_entropy_count[5m])
```

## 💡 Tips

1. **Use Graph tab** for time series metrics
2. **Use Table tab** for current values
3. **Set time range** to "Last 1 hour" or "Last 6 hours" for historical data
4. **Filter by algorithm** if training multiple algorithms
5. **Use rate()** for counter metrics to see per-second rates
6. **Use histogram_quantile()** for percentile analysis

