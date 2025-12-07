# RL Training Prometheus - Troubleshooting Guide

## Issue: "No data queried yet" in Prometheus

### Root Cause
The metrics endpoint on port 8011 is not running. The RL training metrics server only starts when:
1. RL training is actively running, OR
2. You manually start the metrics server

### Solution 1: Start Test Metrics Server (Quick Test)

Run the test metrics server to generate sample data:

```bash
cd mlops_integration/RL_TRAINING_PROMETHEUS
python start_metrics_server.py
```

This will:
- Start metrics server on port 8011
- Generate test metrics
- Keep server running so Prometheus can scrape

Then in Prometheus, try these queries:
```
sum(rl_training_runs_total{})
rl_training_episode_reward_mean{}
rl_training_sharpe_ratio{}
```

### Solution 2: Run Actual RL Training

The metrics server starts automatically when you run RL training:

```bash
cd WealthArena_Production/rl-training
python train.py
```

Once training starts, metrics will be available.

### Solution 3: Check Prometheus Targets

1. Go to: http://127.0.0.1:9090/targets
2. Find `wealtharena_rl_training` job
3. Check status:
   - **UP (green)** = Working correctly
   - **DOWN (red)** = Metrics server not running

### Solution 4: Verify Metrics Endpoint

Check if metrics endpoint is accessible:

```powershell
# Test metrics endpoint
Invoke-WebRequest -Uri "http://localhost:8011/metrics" -UseBasicParsing

# Or in browser
http://localhost:8011/metrics
```

**Expected:** You should see metrics starting with `# HELP rl_training_`

**If connection refused:**
- Metrics server is not running
- Start it using Solution 1 or 2 above

### Solution 5: Check Prometheus Configuration

Verify `config/prometheus.yml` has:

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

If config was updated, restart Prometheus:
```bash
docker-compose restart prometheus
```

## Common Issues

### Issue: "connection refused" on port 8011

**Cause:** Metrics server not running

**Fix:** 
- Start RL training, OR
- Run `start_metrics_server.py` for testing

### Issue: Prometheus target shows "DOWN"

**Cause:** Cannot reach metrics endpoint

**Fix:**
1. Verify metrics server is running: `http://localhost:8011/metrics`
2. Check Prometheus config points to correct address
3. On Windows, use `host.docker.internal:8011` (not `localhost:8011`)

### Issue: "Empty query result" in Prometheus

**Cause:** No metrics generated yet

**Fix:**
- Metrics only exist when training is running
- Start training or test metrics server
- Wait a few seconds for Prometheus to scrape

### Issue: Metrics appear but graphs are empty

**Cause:** Time range issue or no recent data

**Fix:**
1. Check time range in Prometheus (top right)
2. Try "Last 1 hour" or "Last 6 hours"
3. Ensure training/metrics server is currently running

## Quick Verification Steps

1. **Check metrics endpoint:**
   ```
   http://localhost:8011/metrics
   ```
   Should return Prometheus format metrics

2. **Check Prometheus targets:**
   ```
   http://127.0.0.1:9090/targets
   ```
   `wealtharena_rl_training` should be UP

3. **Test query in Prometheus:**
   ```
   up{job="wealtharena_rl_training"}
   ```
   Should return `1` if working

4. **Query actual metrics:**
   ```
   sum(rl_training_runs_total{})
   ```
   Should return a number (may be 0 if no training run yet)

## Still Not Working?

1. Check if port 8011 is in use:
   ```powershell
   netstat -ano | findstr :8011
   ```

2. Check Prometheus logs:
   ```bash
   docker logs prometheus
   ```

3. Verify Docker networking:
   - Prometheus container can reach `host.docker.internal:8011`
   - On Windows, `host.docker.internal` resolves to host machine

4. Try accessing metrics from within Prometheus container:
   ```bash
   docker exec prometheus wget -qO- http://host.docker.internal:8011/metrics
   ```

