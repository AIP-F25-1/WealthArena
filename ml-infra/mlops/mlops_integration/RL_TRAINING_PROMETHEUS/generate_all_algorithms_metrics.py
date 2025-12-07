#!/usr/bin/env python3
"""
Generate Prometheus Metrics for ALL 4 RL Algorithms
This script generates test metrics for PPO, SAC, DQN, and IMPALA
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
WIN_RATE = Gauge('rl_training_win_rate', 'Win rate percentage', ['algorithm', 'agent_id'])
TOTAL_RETURN = Gauge('rl_training_total_return', 'Total return percentage', ['algorithm', 'agent_id'])
MAX_DRAWDOWN = Gauge('rl_training_max_drawdown', 'Max drawdown percentage', ['algorithm', 'agent_id'])
ITERATIONS_TOTAL = Counter('rl_training_iterations_total', 'Total iterations', ['algorithm'])
POLICY_LOSS = Histogram('rl_training_policy_loss', 'Policy loss', ['algorithm'])
VALUE_LOSS = Histogram('rl_training_value_loss', 'Value loss', ['algorithm'])
ENTROPY = Histogram('rl_training_entropy', 'Entropy', ['algorithm'])
ENV_STEPS = Counter('rl_training_environment_steps_total', 'Environment steps', ['algorithm'])
TRAINING_ERRORS = Counter('rl_training_errors_total', 'Training errors', ['error_type'])

print("=" * 60)
print("Generating Metrics for ALL 4 RL Algorithms")
print("=" * 60)
print("\nStarting server on port 8011...")

# Start HTTP server
start_http_server(8011)
print("✅ Server started: http://localhost:8011/metrics")

# Algorithms to generate metrics for
algorithms = ["PPO", "SAC", "DQN", "IMPALA"]
run_ids = {
    "PPO": "ppo_run_1",
    "SAC": "sac_run_1",
    "DQN": "dqn_run_1",
    "IMPALA": "impala_run_1"
}

print("\nGenerating metrics for all algorithms...")
print("")

# Generate metrics for each algorithm
for algo in algorithms:
    print(f"Generating metrics for {algo}...")
    run_id = run_ids[algo]
    
    # Record training start
    TRAINING_RUNS.labels(algorithm=algo, status='started').inc()
    TRAINING_ACTIVE.labels(algorithm=algo).set(0)  # Completed
    
    # Generate different values for each algorithm
    base_reward = {"PPO": 300, "SAC": 280, "DQN": 250, "IMPALA": 320}[algo]
    base_sharpe = {"PPO": 2.2, "SAC": 2.0, "DQN": 1.8, "IMPALA": 2.4}[algo]
    base_iteration = {"PPO": 20, "SAC": 25, "DQN": 18, "IMPALA": 30}[algo]
    base_episodes = {"PPO": 20, "SAC": 25, "DQN": 18, "IMPALA": 30}[algo]
    
    # Set current iteration
    CURRENT_ITER.labels(algorithm=algo, run_id=run_id).set(base_iteration)
    
    # Set episode reward
    EPISODE_REWARD.labels(algorithm=algo, run_id=run_id).set(base_reward)
    
    # Generate metrics for multiple agents
    for agent_idx in range(3):
        agent_id = f"agent_{agent_idx}"
        
        # Sharpe ratio with slight variation per agent
        sharpe = base_sharpe + (agent_idx * 0.1) - 0.1
        SHARPE_RATIO.labels(algorithm=algo, agent_id=agent_id).set(sharpe)
        
        # Episodes
        EPISODES_TOTAL.labels(algorithm=algo, agent_id=agent_id).inc(base_episodes)
        
        # Win rate (different per algorithm)
        win_rate = {"PPO": 65, "SAC": 62, "DQN": 58, "IMPALA": 68}[algo] + (agent_idx * 2)
        WIN_RATE.labels(algorithm=algo, agent_id=agent_id).set(win_rate)
        
        # Total return (different per algorithm)
        total_return = {"PPO": 25, "SAC": 22, "DQN": 20, "IMPALA": 28}[algo] + (agent_idx * 1)
        TOTAL_RETURN.labels(algorithm=algo, agent_id=agent_id).set(total_return)
        
        # Max drawdown (different per algorithm)
        max_dd = {"PPO": 8, "SAC": 9, "DQN": 10, "IMPALA": 7}[algo] - (agent_idx * 0.5)
        MAX_DRAWDOWN.labels(algorithm=algo, agent_id=agent_id).set(max_dd)
    
    # Record iterations
    ITERATIONS_TOTAL.labels(algorithm=algo).inc(base_iteration)
    
    # Record loss metrics
    policy_loss = {"PPO": 0.05, "SAC": 0.06, "DQN": 0.07, "IMPALA": 0.04}[algo]
    value_loss = {"PPO": 0.03, "SAC": 0.035, "DQN": 0.04, "IMPALA": 0.025}[algo]
    entropy = {"PPO": 1.5, "SAC": 1.6, "DQN": 1.4, "IMPALA": 1.7}[algo]
    
    POLICY_LOSS.labels(algorithm=algo).observe(policy_loss)
    VALUE_LOSS.labels(algorithm=algo).observe(value_loss)
    ENTROPY.labels(algorithm=algo).observe(entropy)
    
    # Environment steps
    ENV_STEPS.labels(algorithm=algo).inc(base_iteration * 1000)
    
    # Record training completion
    TRAINING_RUNS.labels(algorithm=algo, status='completed').inc()
    
    print(f"✓ {algo} metrics generated")

print("\n" + "=" * 60)
print("✅ Metrics generated for ALL 4 algorithms!")
print("=" * 60)
print("\nMetrics available at: http://localhost:8011/metrics")
print("\nNow you can query Prometheus for:")
print("  - PPO: rl_training_sharpe_ratio{algorithm=\"PPO\"}")
print("  - SAC: rl_training_sharpe_ratio{algorithm=\"SAC\"}")
print("  - DQN: rl_training_sharpe_ratio{algorithm=\"DQN\"}")
print("  - IMPALA: rl_training_sharpe_ratio{algorithm=\"IMPALA\"}")
print("\n⚠️  KEEP THIS WINDOW OPEN!")
print("   Press Ctrl+C to stop the server\n")

# Keep running
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\n\nServer stopped.")

