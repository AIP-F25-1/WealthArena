# RL Training Prometheus Integration Guide

This folder contains the complete Prometheus metrics integration for RL Training service.

## Files in This Folder

- `prometheus_metrics.py` - Main Prometheus metrics module with all metric definitions and helper functions
- `grafana_dashboard.json` - Grafana dashboard configuration for visualizing RL training metrics
- `INTEGRATION_GUIDE.md` - This file

## Integration Steps

### 1. Copy Metrics Module to RL Training

Copy `prometheus_metrics.py` to your RL training source directory:

```bash
# From mlops_integration/RL_TRAINING_PROMETHEUS/
cp prometheus_metrics.py WealthArena_Production/rl-training/src/tracking/prometheus_metrics.py
```

### 2. Update Training Script

In your training script (e.g., `train_agents.py`), add the following imports:

```python
from tracking.prometheus_metrics import (
    start_metrics_server, record_training_start, record_training_complete,
    record_training_failed, record_training_iteration, record_episode_metrics,
    record_performance_metrics, record_loss_metrics, record_data_load_time,
    record_environment_steps, record_training_error
)
```

### 3. Initialize Metrics Server

In your trainer's `__init__` method:

```python
def __init__(self, config_path: str = "config/production_config.yaml"):
    # ... existing initialization code ...
    
    # Start Prometheus metrics server
    try:
        metrics_port = self.config.get("monitoring", {}).get("prometheus_port", 8011)
        start_metrics_server(port=metrics_port)
        logger.info(f"Prometheus metrics server started on port {metrics_port}")
    except Exception as e:
        logger.warning(f"Could not start Prometheus metrics server: {e}")
```

### 4. Record Metrics During Training

In your training loop:

```python
# At training start
algorithm_name = self.config["training"]["algorithm"]
training_start_time = time.time()
run_id = experiment_name
record_training_start(algorithm=algorithm_name, run_id=run_id)

# During training iterations
for i in range(max_iterations):
    result = algorithm.train()
    
    # Record metrics
    record_training_iteration(algorithm=algorithm_name, iteration=i+1, run_id=run_id)
    record_episode_metrics(
        algorithm=algorithm_name, 
        run_id=run_id,
        reward_mean=result.get("episode_reward_mean", 0.0),
        length_mean=result.get("episode_len_mean", 0.0)
    )
    
    # Record performance metrics if available
    custom_metrics = result.get("custom_metrics", {})
    if custom_metrics:
        for agent_id in ["agent_0", "agent_1", "agent_2", "agent_3", "agent_4"]:
            agent_metrics = {}
            if "sharpe_ratio" in custom_metrics:
                agent_metrics["sharpe_ratio"] = custom_metrics.get("sharpe_ratio", 0.0)
            if "max_drawdown" in custom_metrics:
                agent_metrics["max_drawdown"] = custom_metrics.get("max_drawdown", 0.0)
            if "win_rate" in custom_metrics:
                agent_metrics["win_rate"] = custom_metrics.get("win_rate", 0.0)
            if agent_metrics:
                record_performance_metrics(algorithm=algorithm_name, agent_id=agent_id, metrics=agent_metrics)

# At training completion
training_duration = time.time() - training_start_time
if success:
    record_training_complete(algorithm=algorithm_name, duration=training_duration, run_id=run_id)
else:
    record_training_failed(algorithm=algorithm_name, error_type="training_error")
```

### 5. Add Dependencies

Ensure `prometheus-client` is in your `requirements.txt`:

```
prometheus-client>=0.19.0
```

### 6. Configure Prometheus

Update `config/prometheus.yml` to include:

```yaml
  # RL Training Service
  - job_name: 'wealtharena_rl_training'
    static_configs:
      - targets: ['host.docker.internal:8011']
        labels: 
          component: 'rl_training'
          service: 'training'
    scrape_interval: 10s
    metrics_path: /metrics
```

### 7. Deploy Grafana Dashboard

Copy `grafana_dashboard.json` to your Grafana dashboards directory:

```bash
cp grafana_dashboard.json WealthArena_Production/grafana/dashboards/rl-training-metrics.json
```

Or import it manually in Grafana UI:
1. Go to Grafana → Dashboards → Import
2. Upload `grafana_dashboard.json`
3. Select Prometheus as data source

## Available Metrics

### Training Lifecycle
- `rl_training_runs_total` - Total training runs by algorithm and status
- `rl_training_active` - Whether training is currently active (1 or 0)
- `rl_training_duration_seconds` - Training duration histogram
- `rl_training_iterations_total` - Total iterations completed

### Episode Metrics
- `rl_training_episodes_total` - Total episodes by algorithm and agent
- `rl_training_episode_reward` - Episode reward distribution
- `rl_training_episode_length` - Episode length distribution
- `rl_training_episode_reward_mean` - Current mean episode reward
- `rl_training_episode_length_mean` - Current mean episode length

### Performance Metrics
- `rl_training_sharpe_ratio` - Current Sharpe ratio per agent
- `rl_training_max_drawdown` - Maximum drawdown percentage
- `rl_training_win_rate` - Win rate percentage (0-100)
- `rl_training_total_return` - Total return percentage

### Loss Metrics
- `rl_training_policy_loss` - Policy loss histogram
- `rl_training_value_loss` - Value function loss histogram
- `rl_training_entropy` - Policy entropy (exploration measure)

### Other Metrics
- `rl_training_data_load_time_seconds` - Data loading time
- `rl_training_environment_steps_total` - Total environment steps
- `rl_training_errors_total` - Training errors by type
- `rl_training_current_iteration` - Current iteration number

## Accessing Metrics

### Direct HTTP Endpoint
- Metrics: `http://localhost:8011/metrics`
- Health: `http://localhost:8011/health`

### Prometheus
- Prometheus UI: `http://127.0.0.1:9090`
- Query examples:
  - `rl_training_runs_total`
  - `rl_training_active`
  - `rl_training_episode_reward_mean`

### Grafana
- Grafana UI: `http://127.0.0.1:3000`
- Dashboard: "RL Training - Comprehensive Metrics"

## Troubleshooting

### Metrics Server Not Starting
- Check if port 8011 is already in use
- Ensure `prometheus-client` is installed
- Check logs for error messages

### No Metrics in Prometheus
- Verify Prometheus config includes RL training job
- Check Prometheus targets: `http://127.0.0.1:9090/targets`
- Ensure metrics endpoint is accessible: `http://localhost:8011/metrics`

### Dashboard Not Showing Data
- Verify Prometheus data source is configured in Grafana
- Check time range in dashboard
- Ensure training has been running and generating metrics

## Example Usage

See the integration in `WealthArena_Production/rl-training/src/training/train_agents.py` for a complete example of how to integrate these metrics into your training pipeline.

