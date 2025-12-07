# RL Training Prometheus Integration

Complete Prometheus metrics integration for WealthArena RL Training service.

## Overview

This integration provides comprehensive monitoring of RL training processes including:
- Training lifecycle (start, completion, failures)
- Episode metrics (rewards, lengths)
- Performance metrics (Sharpe ratio, drawdown, win rate)
- Loss metrics (policy loss, value loss, entropy)
- Training progress tracking

## Quick Start

1. **Copy the metrics module:**
   ```bash
   cp prometheus_metrics.py WealthArena_Production/rl-training/src/tracking/prometheus_metrics.py
   ```

2. **Add to requirements.txt:**
   ```
   prometheus-client>=0.19.0
   ```

3. **Import in your training script:**
   ```python
   from tracking.prometheus_metrics import start_metrics_server, record_training_start, ...
   ```

4. **Start metrics server in trainer initialization:**
   ```python
   start_metrics_server(port=8011)
   ```

5. **Record metrics during training** (see INTEGRATION_GUIDE.md for details)

6. **Configure Prometheus** to scrape `host.docker.internal:8011`

7. **Import Grafana dashboard** from `grafana_dashboard.json`

## Files

- `prometheus_metrics.py` - Core metrics module
- `grafana_dashboard.json` - Grafana dashboard configuration
- `INTEGRATION_GUIDE.md` - Detailed integration instructions
- `README.md` - This file

## Metrics Endpoint

Once integrated, metrics are available at:
- `http://localhost:8011/metrics` - Prometheus format
- `http://localhost:8011/health` - Health check

## Documentation

See `INTEGRATION_GUIDE.md` for complete integration instructions and examples.

