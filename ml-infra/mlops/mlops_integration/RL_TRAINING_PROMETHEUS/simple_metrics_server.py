#!/usr/bin/env python3
"""
Simple RL Training Metrics Server
Run this script to start metrics server and generate test data
"""

from prometheus_client import Counter, Histogram, Gauge, start_http_server, generate_latest
import time
import threading

# Define metrics
TRAINING_RUNS = Counter('rl_training_runs_total', 'Total training runs', ['algorithm', 'status'])
TRAINING_ACTIVE = Gauge('rl_training_active', 'Training active status', ['algorithm'])
EPISODE_REWARD = Gauge('rl_training_episode_reward_mean', 'Mean episode reward', ['algorithm', 'run_id'])
CURRENT_ITER = Gauge('rl_training_current_iteration', 'Current iteration', ['algorithm', 'run_id'])
SHARPE_RATIO = Gauge('rl_training_sharpe_ratio', 'Sharpe ratio', ['algorithm', 'agent_id'])
EPISODES_TOTAL = Counter('rl_training_episodes_total', 'Total episodes', ['algorithm', 'agent_id'])

print("=" * 60)
print("RL Training Prometheus Metrics Server")
print("=" * 60)
print("\nStarting server on port 8011...")

# Start HTTP server
start_http_server(8011)
print("✅ Server started: http://localhost:8011/metrics")

# Generate metrics
print("\nGenerating test metrics...")
algorithm = "PPO"
run_id = "demo_run"

# Record training start
TRAINING_RUNS.labels(algorithm=algorithm, status='started').inc()
TRAINING_ACTIVE.labels(algorithm=algorithm).set(1)
print("✓ Training started")

# Generate metrics over time
for i in range(1, 21):
    CURRENT_ITER.labels(algorithm=algorithm, run_id=run_id).set(i)
    EPISODE_REWARD.labels(algorithm=algorithm, run_id=run_id).set(100.0 + i * 10)
    
    for agent_id in ["agent_0", "agent_1", "agent_2"]:
        SHARPE_RATIO.labels(algorithm=algorithm, agent_id=agent_id).set(1.2 + i * 0.05)
        EPISODES_TOTAL.labels(algorithm=algorithm, agent_id=agent_id).inc()
    
    print(f"✓ Iteration {i} - Metrics updated")
    time.sleep(1)

TRAINING_RUNS.labels(algorithm=algorithm, status='completed').inc()
TRAINING_ACTIVE.labels(algorithm=algorithm).set(0)
print("✓ Training completed")

print("\n" + "=" * 60)
print("✅ Metrics server is running!")
print("=" * 60)
print("\nMetrics available at: http://localhost:8011/metrics")
print("\nTry these queries in Prometheus:")
print("  sum(rl_training_runs_total{})")
print("  rl_training_episode_reward_mean{}")
print("  rl_training_sharpe_ratio{}")
print("  rl_training_current_iteration{}")
print("\n⚠️  KEEP THIS WINDOW OPEN!")
print("   Press Ctrl+C to stop the server\n")

# Keep running
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\n\nServer stopped.")

