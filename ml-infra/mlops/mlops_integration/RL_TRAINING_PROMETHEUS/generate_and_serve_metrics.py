#!/usr/bin/env python3
"""
Generate RL Training Metrics and Serve Them
This script starts the metrics server and immediately generates test metrics
"""

import sys
from pathlib import Path

# Add current directory to path
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
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    port = 8011
    algorithm = "PPO"
    run_id = "demo_run_1"
    
    logger.info("=" * 60)
    logger.info("RL Training Prometheus Metrics Server")
    logger.info("=" * 60)
    
    # Start metrics server
    logger.info(f"Starting metrics server on port {port}...")
    server = start_metrics_server(port=port)
    
    if not server:
        logger.error("Failed to start metrics server!")
        return
    
    logger.info(f"✅ Metrics server started on http://localhost:{port}/metrics")
    logger.info("")
    
    # Generate test metrics immediately
    logger.info("Generating test metrics...")
    
    # Record training start
    record_training_start(algorithm=algorithm, run_id=run_id)
    logger.info("✓ Recorded training start")
    
    # Generate metrics for 10 iterations
    for i in range(1, 11):
        # Record iteration
        record_training_iteration(algorithm=algorithm, iteration=i, run_id=run_id)
        
        # Record episode metrics
        reward_mean = 100.0 + (i * 10) + (i * 2)
        length_mean = 200.0 + (i * 5)
        record_episode_metrics(
            algorithm=algorithm,
            run_id=run_id,
            reward_mean=reward_mean,
            length_mean=length_mean
        )
        
        # Record performance metrics for multiple agents
        for agent_idx in range(3):
            agent_id = f"agent_{agent_idx}"
            record_performance_metrics(
                algorithm=algorithm,
                agent_id=agent_id,
                metrics={
                    "sharpe_ratio": 1.2 + (i * 0.08) + (agent_idx * 0.1),
                    "max_drawdown": 0.05 + (i * 0.005),
                    "win_rate": 0.55 + (i * 0.02) + (agent_idx * 0.05),
                    "total_return": 0.12 + (i * 0.015) + (agent_idx * 0.02)
                }
            )
        
        # Record loss metrics
        record_loss_metrics(
            algorithm=algorithm,
            policy_loss=0.1 - (i * 0.005),
            value_loss=0.05 - (i * 0.002),
            entropy=2.0 - (i * 0.1)
        )
        
        # Record environment steps
        record_environment_steps(algorithm=algorithm, steps=1000 * i)
        
        logger.info(f"✓ Generated metrics for iteration {i}")
        time.sleep(0.5)  # Small delay between iterations
    
    # Record training completion
    record_training_complete(algorithm=algorithm, duration=300.0, run_id=run_id)
    logger.info("✓ Recorded training completion")
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("✅ Test metrics generated successfully!")
    logger.info("=" * 60)
    logger.info("")
    logger.info("Metrics are now available at:")
    logger.info(f"  http://localhost:{port}/metrics")
    logger.info("")
    logger.info("Prometheus queries to try:")
    logger.info("  - sum(rl_training_runs_total{})")
    logger.info("  - rl_training_episode_reward_mean{}")
    logger.info("  - rl_training_sharpe_ratio{}")
    logger.info("  - rl_training_current_iteration{}")
    logger.info("")
    logger.info("Server will keep running. Press Ctrl+C to stop.")
    logger.info("")
    
    # Keep server running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("\nShutting down...")
        from prometheus_metrics import stop_metrics_server
        stop_metrics_server()
        logger.info("Server stopped.")

if __name__ == "__main__":
    main()

