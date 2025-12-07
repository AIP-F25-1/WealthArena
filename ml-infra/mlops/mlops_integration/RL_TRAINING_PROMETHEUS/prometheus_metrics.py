"""
Prometheus Metrics Integration for RL Training
Tracks training progress, episode metrics, and performance indicators
"""

from prometheus_client import Counter, Histogram, Gauge, start_http_server, generate_latest, CONTENT_TYPE_LATEST
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import time
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# PROMETHEUS METRICS DEFINITIONS
# ============================================================================

# Training lifecycle metrics
TRAINING_RUNS_TOTAL = Counter(
    'rl_training_runs_total',
    'Total number of training runs started',
    ['algorithm', 'status']  # algorithm: PPO, SAC, etc. | status: started, completed, failed
)

TRAINING_DURATION = Histogram(
    'rl_training_duration_seconds',
    'Duration of training runs in seconds',
    ['algorithm'],
    buckets=[60.0, 300.0, 600.0, 1800.0, 3600.0, 7200.0, 18000.0, 36000.0]  # 1min to 10hrs
)

TRAINING_ITERATIONS_TOTAL = Counter(
    'rl_training_iterations_total',
    'Total number of training iterations',
    ['algorithm']
)

# Episode metrics
EPISODES_TOTAL = Counter(
    'rl_training_episodes_total',
    'Total number of episodes completed',
    ['algorithm', 'agent_id']
)

EPISODE_REWARD = Histogram(
    'rl_training_episode_reward',
    'Episode reward distribution',
    ['algorithm', 'agent_id'],
    buckets=[-1000.0, -500.0, -100.0, 0.0, 100.0, 500.0, 1000.0, 5000.0, 10000.0]
)

EPISODE_LENGTH = Histogram(
    'rl_training_episode_length',
    'Episode length in steps',
    ['algorithm', 'agent_id'],
    buckets=[10, 50, 100, 200, 500, 1000, 2000, 5000]
)

# Performance metrics
SHARPE_RATIO = Gauge(
    'rl_training_sharpe_ratio',
    'Current Sharpe ratio',
    ['algorithm', 'agent_id']
)

MAX_DRAWDOWN = Gauge(
    'rl_training_max_drawdown',
    'Maximum drawdown percentage',
    ['algorithm', 'agent_id']
)

WIN_RATE = Gauge(
    'rl_training_win_rate',
    'Win rate percentage (0-100)',
    ['algorithm', 'agent_id']
)

TOTAL_RETURN = Gauge(
    'rl_training_total_return',
    'Total return percentage',
    ['algorithm', 'agent_id']
)

# Training progress metrics
CURRENT_ITERATION = Gauge(
    'rl_training_current_iteration',
    'Current training iteration number',
    ['algorithm', 'run_id']
)

CURRENT_EPISODE_REWARD_MEAN = Gauge(
    'rl_training_episode_reward_mean',
    'Mean episode reward for current iteration',
    ['algorithm', 'run_id']
)

CURRENT_EPISODE_LENGTH_MEAN = Gauge(
    'rl_training_episode_length_mean',
    'Mean episode length for current iteration',
    ['algorithm', 'run_id']
)

# Loss metrics
POLICY_LOSS = Histogram(
    'rl_training_policy_loss',
    'Policy loss during training',
    ['algorithm'],
    buckets=[0.001, 0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

VALUE_LOSS = Histogram(
    'rl_training_value_loss',
    'Value function loss during training',
    ['algorithm'],
    buckets=[0.001, 0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

ENTROPY = Histogram(
    'rl_training_entropy',
    'Policy entropy (exploration measure)',
    ['algorithm'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0]
)

# Data and environment metrics
DATA_LOAD_TIME = Histogram(
    'rl_training_data_load_time_seconds',
    'Time taken to load training data',
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0]
)

ENVIRONMENT_STEPS_TOTAL = Counter(
    'rl_training_environment_steps_total',
    'Total number of environment steps',
    ['algorithm']
)

# Error metrics
TRAINING_ERRORS_TOTAL = Counter(
    'rl_training_errors_total',
    'Total number of training errors',
    ['error_type']  # error_type: data_error, training_error, evaluation_error, etc.
)

# Training status
TRAINING_ACTIVE = Gauge(
    'rl_training_active',
    'Whether training is currently active (1) or not (0)',
    ['algorithm']
)

TRAINING_START_TIME = Gauge(
    'rl_training_start_timestamp',
    'Unix timestamp when training started',
    ['algorithm', 'run_id']
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def record_training_start(algorithm: str, run_id: str = "default"):
    """Record that a training run has started"""
    TRAINING_RUNS_TOTAL.labels(algorithm=algorithm, status='started').inc()
    TRAINING_ACTIVE.labels(algorithm=algorithm).set(1)
    TRAINING_START_TIME.labels(algorithm=algorithm, run_id=run_id).set(time.time())

def record_training_complete(algorithm: str, duration: float, run_id: str = "default"):
    """Record that a training run has completed"""
    TRAINING_RUNS_TOTAL.labels(algorithm=algorithm, status='completed').inc()
    TRAINING_DURATION.labels(algorithm=algorithm).observe(duration)
    TRAINING_ACTIVE.labels(algorithm=algorithm).set(0)

def record_training_failed(algorithm: str, error_type: str = "unknown"):
    """Record that a training run has failed"""
    TRAINING_RUNS_TOTAL.labels(algorithm=algorithm, status='failed').inc()
    TRAINING_ERRORS_TOTAL.labels(error_type=error_type).inc()
    TRAINING_ACTIVE.labels(algorithm=algorithm).set(0)

def record_training_iteration(algorithm: str, iteration: int, run_id: str = "default"):
    """Record a training iteration"""
    TRAINING_ITERATIONS_TOTAL.labels(algorithm=algorithm).inc()
    CURRENT_ITERATION.labels(algorithm=algorithm, run_id=run_id).set(iteration)

def record_episode(algorithm: str, agent_id: str, reward: float, length: int):
    """Record an episode completion"""
    EPISODES_TOTAL.labels(algorithm=algorithm, agent_id=agent_id).inc()
    EPISODE_REWARD.labels(algorithm=algorithm, agent_id=agent_id).observe(reward)
    EPISODE_LENGTH.labels(algorithm=algorithm, agent_id=agent_id).observe(length)

def record_episode_metrics(algorithm: str, run_id: str, reward_mean: float, length_mean: float):
    """Record mean episode metrics for current iteration"""
    CURRENT_EPISODE_REWARD_MEAN.labels(algorithm=algorithm, run_id=run_id).set(reward_mean)
    CURRENT_EPISODE_LENGTH_MEAN.labels(algorithm=algorithm, run_id=run_id).set(length_mean)

def record_performance_metrics(algorithm: str, agent_id: str, metrics: Dict[str, float]):
    """Record performance metrics (Sharpe, drawdown, win rate, etc.)"""
    if 'sharpe_ratio' in metrics:
        SHARPE_RATIO.labels(algorithm=algorithm, agent_id=agent_id).set(metrics['sharpe_ratio'])
    if 'max_drawdown' in metrics:
        MAX_DRAWDOWN.labels(algorithm=algorithm, agent_id=agent_id).set(metrics['max_drawdown'])
    if 'win_rate' in metrics:
        WIN_RATE.labels(algorithm=algorithm, agent_id=agent_id).set(metrics['win_rate'] * 100)  # Convert to percentage
    if 'total_return' in metrics:
        TOTAL_RETURN.labels(algorithm=algorithm, agent_id=agent_id).set(metrics['total_return'] * 100)  # Convert to percentage

def record_loss_metrics(algorithm: str, policy_loss: Optional[float] = None, 
                       value_loss: Optional[float] = None, entropy: Optional[float] = None):
    """Record loss metrics"""
    if policy_loss is not None:
        POLICY_LOSS.labels(algorithm=algorithm).observe(policy_loss)
    if value_loss is not None:
        VALUE_LOSS.labels(algorithm=algorithm).observe(value_loss)
    if entropy is not None:
        ENTROPY.labels(algorithm=algorithm).observe(entropy)

def record_data_load_time(duration: float):
    """Record data loading time"""
    DATA_LOAD_TIME.observe(duration)

def record_environment_steps(algorithm: str, steps: int):
    """Record environment steps"""
    ENVIRONMENT_STEPS_TOTAL.labels(algorithm=algorithm).inc(steps)

def record_training_error(error_type: str):
    """Record a training error"""
    TRAINING_ERRORS_TOTAL.labels(error_type=error_type).inc()

# ============================================================================
# METRICS HTTP SERVER
# ============================================================================

class MetricsHandler(BaseHTTPRequestHandler):
    """HTTP handler for Prometheus metrics endpoint"""
    
    def do_GET(self):
        if self.path == '/metrics':
            self.send_response(200)
            self.send_header('Content-Type', CONTENT_TYPE_LATEST)
            self.end_headers()
            self.wfile.write(generate_latest().encode())
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "healthy"}')
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

_metrics_server = None
_metrics_thread = None

def start_metrics_server(port: int = 8011):
    """
    Start HTTP server for Prometheus metrics
    
    Args:
        port: Port to serve metrics on (default: 8011)
    """
    global _metrics_server, _metrics_thread
    
    if _metrics_server is not None:
        # Server already started
        return _metrics_server
    
    try:
        server = HTTPServer(('0.0.0.0', port), MetricsHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        _metrics_server = server
        _metrics_thread = thread
        logger.info(f"✅ Prometheus metrics server started on port {port}")
        return server
    except Exception as e:
        logger.error(f"⚠️  Warning: Could not start metrics server on port {port}: {e}")
        return None

def stop_metrics_server():
    """Stop the metrics server"""
    global _metrics_server
    if _metrics_server is not None:
        _metrics_server.shutdown()
        _metrics_server = None
        logger.info("Stopped Prometheus metrics server")

def get_metrics_response():
    """Get metrics in Prometheus format"""
    return generate_latest().decode('utf-8')

