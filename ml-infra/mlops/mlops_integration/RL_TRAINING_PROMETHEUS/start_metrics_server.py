#!/usr/bin/env python3
"""
Standalone RL Training Metrics Server
Starts Prometheus metrics server for RL training without running actual training.
Useful for testing Prometheus integration.
"""

import sys
from pathlib import Path

# Add the integration folder to path
integration_path = Path(__file__).parent
sys.path.insert(0, str(integration_path))

from prometheus_metrics import start_metrics_server, record_training_start, record_training_iteration
from prometheus_metrics import record_episode_metrics, record_performance_metrics
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def generate_test_metrics():
    """Generate some test metrics for demonstration"""
    logger.info("Generating test metrics...")
    
    # Record a training start
    record_training_start(algorithm="PPO", run_id="test_run_1")
    
    # Simulate some training iterations
    for i in range(1, 11):
        record_training_iteration(algorithm="PPO", iteration=i, run_id="test_run_1")
        record_episode_metrics(
            algorithm="PPO",
            run_id="test_run_1",
            reward_mean=100.0 + (i * 10),
            length_mean=200.0 + (i * 5)
        )
        
        # Record performance metrics for agents
        for agent_id in ["agent_0", "agent_1", "agent_2"]:
            record_performance_metrics(
                algorithm="PPO",
                agent_id=agent_id,
                metrics={
                    "sharpe_ratio": 1.5 + (i * 0.1),
                    "max_drawdown": 0.05 + (i * 0.01),
                    "win_rate": 0.6 + (i * 0.02),
                    "total_return": 0.15 + (i * 0.02)
                }
            )
        
        logger.info(f"Recorded metrics for iteration {i}")
        time.sleep(2)  # Wait 2 seconds between iterations

if __name__ == "__main__":
    port = 8011
    
    logger.info("=" * 60)
    logger.info("RL Training Prometheus Metrics Server")
    logger.info("=" * 60)
    logger.info(f"Starting metrics server on port {port}...")
    
    # Start the metrics server
    server = start_metrics_server(port=port)
    
    if server:
        logger.info(f"✅ Metrics server is running on http://localhost:{port}/metrics")
        logger.info(f"✅ Health check available at http://localhost:{port}/health")
        logger.info("")
        logger.info("Generating test metrics...")
        logger.info("Press Ctrl+C to stop the server")
        logger.info("")
        
        try:
            # Generate some test metrics
            generate_test_metrics()
            
            # Keep server running
            logger.info("")
            logger.info("Metrics server is running. Test metrics have been generated.")
            logger.info("You can now query Prometheus for RL training metrics.")
            logger.info("")
            logger.info("Example queries:")
            logger.info("  - sum(rl_training_runs_total{})")
            logger.info("  - rl_training_episode_reward_mean{}")
            logger.info("  - rl_training_sharpe_ratio{}")
            logger.info("")
            logger.info("Server will continue running. Press Ctrl+C to stop.")
            
            # Keep running
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("\nShutting down metrics server...")
            from prometheus_metrics import stop_metrics_server
            stop_metrics_server()
            logger.info("Server stopped.")
    else:
        logger.error("Failed to start metrics server. Check if port 8011 is available.")
        sys.exit(1)

