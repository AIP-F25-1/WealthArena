#!/usr/bin/env python3
"""Simple RL Training Metrics Server - Run this to generate metrics"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from prometheus_metrics import (
    start_metrics_server,
    record_training_start,
    record_training_iteration,
    record_episode_metrics,
    record_performance_metrics,
    record_loss_metrics,
    record_environment_steps,
    record_training_complete
)
import time

print("=" * 60)
print("Starting RL Training Metrics Server")
print("=" * 60)

# Start server
server = start_metrics_server(8011)
if not server:
    print("ERROR: Could not start server!")
    sys.exit(1)

print("\n✅ Server started on http://localhost:8011/metrics")
print("Generating test metrics...\n")

# Generate metrics
algorithm = "PPO"
run_id = "test_run"

record_training_start(algorithm, run_id)
print("✓ Training started")

for i in range(1, 11):
    record_training_iteration(algorithm, i, run_id)
    record_episode_metrics(algorithm, run_id, 100.0 + i*10, 200.0 + i*5)
    
    for agent_id in ["agent_0", "agent_1", "agent_2"]:
        record_performance_metrics(algorithm, agent_id, {
            "sharpe_ratio": 1.5 + i*0.1,
            "max_drawdown": 0.05 + i*0.01,
            "win_rate": 0.6 + i*0.02,
            "total_return": 0.15 + i*0.02
        })
    
    record_loss_metrics(algorithm, 0.1 - i*0.005, 0.05 - i*0.002, 2.0 - i*0.1)
    record_environment_steps(algorithm, 1000 * i)
    print(f"✓ Iteration {i} metrics recorded")
    time.sleep(0.3)

record_training_complete(algorithm, 300.0, run_id)
print("✓ Training completed\n")

print("=" * 60)
print("✅ Metrics generated successfully!")
print("=" * 60)
print("\nNow try these queries in Prometheus:")
print("  sum(rl_training_runs_total{})")
print("  rl_training_episode_reward_mean{}")
print("  rl_training_sharpe_ratio{}")
print("\nServer running. Press Ctrl+C to stop.\n")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    from prometheus_metrics import stop_metrics_server
    stop_metrics_server()
    print("\nServer stopped.")

