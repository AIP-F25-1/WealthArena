# Prometheus Queries for RL Training Metrics

## Access Prometheus

Open Prometheus UI: **http://127.0.0.1:9090**

## Key RL Training Queries

### 1. Training Runs Total
```
sum(rl_training_runs_total{})
```

### 2. Active Training Status
```
sum(rl_training_active{})
```
- Returns 1 if training is active, 0 if not

### 3. Training Runs by Status
```
sum by (status) (rl_training_runs_total{})
```

### 4. Training Runs by Algorithm
```
sum by (algorithm) (rl_training_runs_total{})
```

### 5. Current Episode Reward Mean
```
rl_training_episode_reward_mean{}
```

### 6. Episode Reward Mean by Algorithm
```
rl_training_episode_reward_mean{algorithm="PPO"}
```

### 7. Current Iteration
```
rl_training_current_iteration{}
```

### 8. Training Iterations Total
```
sum(rl_training_iterations_total{})
```

### 9. Total Episodes
```
sum(rl_training_episodes_total{})
```

### 10. Episodes by Agent
```
sum by (agent_id) (rl_training_episodes_total{})
```

### 11. Sharpe Ratio
```
rl_training_sharpe_ratio{}
```

### 12. Sharpe Ratio by Agent
```
rl_training_sharpe_ratio{agent_id="agent_0"}
```

### 13. Max Drawdown
```
rl_training_max_drawdown{}
```

### 14. Win Rate
```
rl_training_win_rate{}
```

### 15. Total Return
```
rl_training_total_return{}
```

### 16. Training Duration (Rate)
```
rate(rl_training_duration_seconds_sum[5m])
```

### 17. Policy Loss (Average)
```
rate(rl_training_policy_loss_sum[5m]) / rate(rl_training_policy_loss_count[5m])
```

### 18. Value Loss (Average)
```
rate(rl_training_value_loss_sum[5m]) / rate(rl_training_value_loss_count[5m])
```

### 19. Entropy (Average)
```
rate(rl_training_entropy_sum[5m]) / rate(rl_training_entropy_count[5m])
```

### 20. Training Errors
```
sum by (error_type) (rl_training_errors_total{})
```

### 21. Environment Steps Rate
```
sum(rate(rl_training_environment_steps_total[5m]))
```

### 22. Episode Reward Distribution (Histogram)
```
sum(rate(rl_training_episode_reward_bucket[5m])) by (le)
```

### 23. Episode Length Distribution
```
sum(rate(rl_training_episode_length_bucket[5m])) by (le)
```

## Graph Queries (Time Series)

### Training Progress Over Time
```
rl_training_episode_reward_mean{algorithm="PPO"}
```

### Iteration Progress
```
rl_training_current_iteration{algorithm="PPO"}
```

### Performance Metrics Over Time
```
rl_training_sharpe_ratio{algorithm="PPO", agent_id="agent_0"}
```

### Loss Metrics Over Time
```
rate(rl_training_policy_loss_sum{algorithm="PPO"}[5m]) / rate(rl_training_policy_loss_count{algorithm="PPO"}[5m])
```

## Filtering by Algorithm

Replace `"PPO"` with your algorithm:
- `algorithm="PPO"`
- `algorithm="SAC"`
- `algorithm="DQN"`

Or use regex:
```
{algorithm=~"PPO|SAC"}
```

## Filtering by Agent

```
{agent_id="agent_0"}
{agent_id=~"agent_0|agent_1"}
```

## Combined Filters

```
rl_training_sharpe_ratio{algorithm="PPO", agent_id="agent_0"}
```

## Rate Queries (for Counters)

For counter metrics, use `rate()` to see per-second rate:
```
rate(rl_training_iterations_total[5m])
rate(rl_training_episodes_total[5m])
```

## Histogram Queries

For histogram metrics, calculate percentiles:
```
histogram_quantile(0.95, sum(rate(rl_training_episode_reward_bucket[5m])) by (le))
histogram_quantile(0.50, sum(rate(rl_training_episode_reward_bucket[5m])) by (le))
```

## Troubleshooting

### No Data Showing?

1. **Check if metrics endpoint is accessible:**
   ```
   http://localhost:8011/metrics
   ```

2. **Check Prometheus targets:**
   - Go to: http://127.0.0.1:9090/targets
   - Look for `wealtharena_rl_training` job
   - Should show "UP" status

3. **Check if training is running:**
   - Metrics only appear when training is active
   - Start a training run to generate metrics

4. **Verify Prometheus config:**
   - Check `config/prometheus.yml` has RL training job configured
   - Restart Prometheus if config was updated

### Common Issues

- **"Empty query result"** - Training hasn't started yet or no metrics generated
- **"No data points"** - Time range too narrow, try "Last 1 hour" or "Last 6 hours"
- **Target down** - Check if metrics server is running on port 8011

## Quick Test Queries

Test if metrics are available:
```
up{job="wealtharena_rl_training"}
```

Should return `1` if target is up.

