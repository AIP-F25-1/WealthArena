"""
Prometheus Metrics for Multi-Agent RL Training System

This module defines comprehensive Prometheus metrics for tracking
multi-agent RL training, agent coordination, and system performance.
"""

from prometheus_client import Counter, Histogram, Gauge, start_http_server
from typing import Dict, Any, Optional
import time

# ============================================================================
# MULTI-AGENT SYSTEM METRICS
# ============================================================================

# Training Lifecycle
MULTI_AGENT_TRAINING_RUNS = Counter(
    'multi_agent_training_runs_total',
    'Total multi-agent training runs',
    ['status', 'coordination_type']
)

MULTI_AGENT_TRAINING_ACTIVE = Gauge(
    'multi_agent_training_active',
    'Multi-agent training active status',
    ['coordination_type']
)

MULTI_AGENT_ITERATIONS = Counter(
    'multi_agent_iterations_total',
    'Total iterations across all agents',
    ['coordination_type']
)

MULTI_AGENT_CURRENT_ITERATION = Gauge(
    'multi_agent_current_iteration',
    'Current iteration in multi-agent training',
    ['coordination_type', 'run_id']
)

# Agent Coordination Metrics
AGENT_COORDINATION_OVERHEAD = Histogram(
    'agent_coordination_overhead_seconds',
    'Time spent on agent coordination',
    ['coordination_type', 'method']
)

AGENT_COMMUNICATION_COUNT = Counter(
    'agent_communication_total',
    'Total agent-to-agent communications',
    ['from_agent', 'to_agent', 'message_type']
)

AGENT_COORDINATION_EFFICIENCY = Gauge(
    'agent_coordination_efficiency',
    'Coordination efficiency score (0-1)',
    ['coordination_type']
)

SHARED_RESOURCE_UTILIZATION = Gauge(
    'shared_resource_utilization',
    'Shared resource utilization percentage',
    ['resource_type']
)

# Multi-Agent Performance Metrics
MULTI_AGENT_EPISODE_REWARD = Gauge(
    'multi_agent_episode_reward_mean',
    'Mean episode reward across all agents',
    ['coordination_type', 'run_id']
)

MULTI_AGENT_SHARPE_RATIO = Gauge(
    'multi_agent_sharpe_ratio',
    'Sharpe ratio for multi-agent system',
    ['coordination_type', 'agent_group']
)

MULTI_AGENT_WIN_RATE = Gauge(
    'multi_agent_win_rate',
    'Win rate for multi-agent system',
    ['coordination_type', 'agent_group']
)

MULTI_AGENT_TOTAL_RETURN = Gauge(
    'multi_agent_total_return',
    'Total return for multi-agent system',
    ['coordination_type', 'agent_group']
)

INTER_AGENT_REWARD_DISTRIBUTION = Histogram(
    'inter_agent_reward_distribution',
    'Distribution of rewards across agents',
    ['coordination_type']
)

# Agent Count Metrics
ACTIVE_AGENTS_COUNT = Gauge(
    'active_agents_count',
    'Number of active agents in system',
    ['coordination_type']
)

AGENT_EPISODES_TOTAL = Counter(
    'agent_episodes_total',
    'Total episodes per agent',
    ['agent_id', 'agent_type', 'coordination_type']
)

# Coordination Method Metrics
COORDINATION_METHOD_USAGE = Counter(
    'coordination_method_usage_total',
    'Usage count of coordination methods',
    ['method', 'coordination_type']
)

COORDINATION_DECISION_LATENCY = Histogram(
    'coordination_decision_latency_seconds',
    'Latency for coordination decisions',
    ['method', 'coordination_type']
)

# Shared Environment Metrics
SHARED_ENV_STEPS = Counter(
    'shared_environment_steps_total',
    'Total steps in shared environment',
    ['coordination_type']
)

SHARED_ENV_CONFLICTS = Counter(
    'shared_environment_conflicts_total',
    'Total conflicts in shared environment',
    ['conflict_type', 'coordination_type']
)

# Multi-Agent Errors
MULTI_AGENT_ERRORS = Counter(
    'multi_agent_errors_total',
    'Total errors in multi-agent system',
    ['error_type', 'coordination_type']
)

# ============================================================================
# METRIC RECORDING FUNCTIONS
# ============================================================================

def record_multi_agent_training_start(coordination_type: str = "hierarchical"):
    """Record multi-agent training start"""
    MULTI_AGENT_TRAINING_RUNS.labels(
        status='started',
        coordination_type=coordination_type
    ).inc()
    MULTI_AGENT_TRAINING_ACTIVE.labels(
        coordination_type=coordination_type
    ).set(1)

def record_multi_agent_training_complete(coordination_type: str = "hierarchical"):
    """Record multi-agent training completion"""
    MULTI_AGENT_TRAINING_RUNS.labels(
        status='completed',
        coordination_type=coordination_type
    ).inc()
    MULTI_AGENT_TRAINING_ACTIVE.labels(
        coordination_type=coordination_type
    ).set(0)

def record_multi_agent_iteration(
    coordination_type: str,
    iteration: int,
    run_id: str,
    episode_reward: float
):
    """Record multi-agent training iteration"""
    MULTI_AGENT_ITERATIONS.labels(
        coordination_type=coordination_type
    ).inc()
    MULTI_AGENT_CURRENT_ITERATION.labels(
        coordination_type=coordination_type,
        run_id=run_id
    ).set(iteration)
    MULTI_AGENT_EPISODE_REWARD.labels(
        coordination_type=coordination_type,
        run_id=run_id
    ).set(episode_reward)

def record_agent_communication(
    from_agent: str,
    to_agent: str,
    message_type: str
):
    """Record agent-to-agent communication"""
    AGENT_COMMUNICATION_COUNT.labels(
        from_agent=from_agent,
        to_agent=to_agent,
        message_type=message_type
    ).inc()

def record_coordination_overhead(
    coordination_type: str,
    method: str,
    duration: float
):
    """Record coordination overhead time"""
    AGENT_COORDINATION_OVERHEAD.labels(
        coordination_type=coordination_type,
        method=method
    ).observe(duration)

def record_coordination_efficiency(
    coordination_type: str,
    efficiency: float
):
    """Record coordination efficiency (0-1)"""
    AGENT_COORDINATION_EFFICIENCY.labels(
        coordination_type=coordination_type
    ).set(efficiency)

def record_shared_resource_utilization(
    resource_type: str,
    utilization: float
):
    """Record shared resource utilization"""
    SHARED_RESOURCE_UTILIZATION.labels(
        resource_type=resource_type
    ).set(utilization)

def record_multi_agent_performance(
    coordination_type: str,
    agent_group: str,
    sharpe_ratio: float,
    win_rate: float,
    total_return: float
):
    """Record multi-agent performance metrics"""
    MULTI_AGENT_SHARPE_RATIO.labels(
        coordination_type=coordination_type,
        agent_group=agent_group
    ).set(sharpe_ratio)
    MULTI_AGENT_WIN_RATE.labels(
        coordination_type=coordination_type,
        agent_group=agent_group
    ).set(win_rate)
    MULTI_AGENT_TOTAL_RETURN.labels(
        coordination_type=coordination_type,
        agent_group=agent_group
    ).set(total_return)

def record_active_agents_count(
    coordination_type: str,
    count: int
):
    """Record number of active agents"""
    ACTIVE_AGENTS_COUNT.labels(
        coordination_type=coordination_type
    ).set(count)

def record_agent_episode(
    agent_id: str,
    agent_type: str,
    coordination_type: str
):
    """Record agent episode completion"""
    AGENT_EPISODES_TOTAL.labels(
        agent_id=agent_id,
        agent_type=agent_type,
        coordination_type=coordination_type
    ).inc()

def record_coordination_method_usage(
    method: str,
    coordination_type: str
):
    """Record coordination method usage"""
    COORDINATION_METHOD_USAGE.labels(
        method=method,
        coordination_type=coordination_type
    ).inc()

def record_coordination_decision_latency(
    method: str,
    coordination_type: str,
    latency: float
):
    """Record coordination decision latency"""
    COORDINATION_DECISION_LATENCY.labels(
        method=method,
        coordination_type=coordination_type
    ).observe(latency)

def record_shared_env_step(coordination_type: str):
    """Record shared environment step"""
    SHARED_ENV_STEPS.labels(
        coordination_type=coordination_type
    ).inc()

def record_shared_env_conflict(
    conflict_type: str,
    coordination_type: str
):
    """Record shared environment conflict"""
    SHARED_ENV_CONFLICTS.labels(
        conflict_type=conflict_type,
        coordination_type=coordination_type
    ).inc()

def record_multi_agent_error(
    error_type: str,
    coordination_type: str
):
    """Record multi-agent error"""
    MULTI_AGENT_ERRORS.labels(
        error_type=error_type,
        coordination_type=coordination_type
    ).inc()

# ============================================================================
# METRICS SERVER
# ============================================================================

def start_multi_agent_metrics_server(port: int = 8012):
    """Start HTTP server for multi-agent metrics"""
    start_http_server(port)
    print(f"Multi-agent metrics server started on port {port}")
    print(f"Metrics available at: http://localhost:{port}/metrics")
    return port

