"""
Prometheus Metrics for Specialized Trading Agents

This module defines Prometheus metrics for tracking specialized trading agents:
- Market Maker Agents
- Arbitrage Agents
- Portfolio Optimization Agents
- Risk Management Agents
"""

from prometheus_client import Counter, Histogram, Gauge, start_http_server
from typing import Dict, Any, Optional
import time

# ============================================================================
# SPECIALIZED AGENT METRICS
# ============================================================================

# Market Maker Agent Metrics
MARKET_MAKER_SPREAD = Gauge(
    'market_maker_spread',
    'Bid-ask spread maintained by market maker',
    ['agent_id', 'symbol']
)

MARKET_MAKER_QUOTES = Counter(
    'market_maker_quotes_total',
    'Total quotes provided by market maker',
    ['agent_id', 'symbol', 'side']
)

MARKET_MAKER_FILL_RATE = Gauge(
    'market_maker_fill_rate',
    'Fill rate for market maker quotes',
    ['agent_id', 'symbol']
)

MARKET_MAKER_INVENTORY = Gauge(
    'market_maker_inventory',
    'Current inventory position',
    ['agent_id', 'symbol']
)

MARKET_MAKER_PNL = Gauge(
    'market_maker_pnl',
    'Profit and loss for market maker',
    ['agent_id', 'symbol']
)

MARKET_MAKER_QUOTE_LATENCY = Histogram(
    'market_maker_quote_latency_seconds',
    'Latency for quote generation',
    ['agent_id']
)

# Arbitrage Agent Metrics
ARBITRAGE_OPPORTUNITIES = Counter(
    'arbitrage_opportunities_total',
    'Total arbitrage opportunities detected',
    ['agent_id', 'market_pair']
)

ARBITRAGE_EXECUTIONS = Counter(
    'arbitrage_executions_total',
    'Total arbitrage trades executed',
    ['agent_id', 'market_pair', 'status']
)

ARBITRAGE_PROFIT = Gauge(
    'arbitrage_profit',
    'Profit from arbitrage trades',
    ['agent_id', 'market_pair']
)

ARBITRAGE_EXECUTION_LATENCY = Histogram(
    'arbitrage_execution_latency_seconds',
    'Latency for arbitrage execution',
    ['agent_id', 'market_pair']
)

ARBITRAGE_SPREAD = Gauge(
    'arbitrage_spread',
    'Price spread detected for arbitrage',
    ['agent_id', 'market_pair']
)

ARBITRAGE_SUCCESS_RATE = Gauge(
    'arbitrage_success_rate',
    'Success rate of arbitrage opportunities',
    ['agent_id', 'market_pair']
)

# Portfolio Optimization Agent Metrics
PORTFOLIO_OPTIMIZATION_RUNS = Counter(
    'portfolio_optimization_runs_total',
    'Total portfolio optimization runs',
    ['agent_id', 'optimization_type']
)

PORTFOLIO_SHARPE_RATIO = Gauge(
    'portfolio_sharpe_ratio',
    'Sharpe ratio of optimized portfolio',
    ['agent_id']
)

PORTFOLIO_DIVERSIFICATION = Gauge(
    'portfolio_diversification',
    'Portfolio diversification score',
    ['agent_id']
)

PORTFOLIO_TURNOVER = Gauge(
    'portfolio_turnover',
    'Portfolio turnover rate',
    ['agent_id']
)

PORTFOLIO_REBALANCE_COUNT = Counter(
    'portfolio_rebalance_total',
    'Total portfolio rebalancing operations',
    ['agent_id', 'trigger']
)

PORTFOLIO_OPTIMIZATION_LATENCY = Histogram(
    'portfolio_optimization_latency_seconds',
    'Latency for portfolio optimization',
    ['agent_id', 'optimization_type']
)

PORTFOLIO_RISK_METRICS = Gauge(
    'portfolio_risk_metrics',
    'Portfolio risk metrics (VaR, CVaR, etc.)',
    ['agent_id', 'risk_type']
)

# Risk Management Agent Metrics
RISK_MANAGER_CHECKS = Counter(
    'risk_manager_checks_total',
    'Total risk checks performed',
    ['agent_id', 'check_type']
)

RISK_VIOLATIONS = Counter(
    'risk_violations_total',
    'Total risk violations detected',
    ['agent_id', 'violation_type', 'severity']
)

RISK_LIMITS = Gauge(
    'risk_limits',
    'Current risk limits set by risk manager',
    ['agent_id', 'limit_type']
)

RISK_EXPOSURE = Gauge(
    'risk_exposure',
    'Current risk exposure',
    ['agent_id', 'exposure_type']
)

RISK_MANAGER_ACTIONS = Counter(
    'risk_manager_actions_total',
    'Total risk management actions taken',
    ['agent_id', 'action_type']
)

RISK_CHECK_LATENCY = Histogram(
    'risk_check_latency_seconds',
    'Latency for risk checks',
    ['agent_id', 'check_type']
)

# Specialized Agent Performance
SPECIALIZED_AGENT_REWARD = Gauge(
    'specialized_agent_reward',
    'Reward for specialized agent',
    ['agent_id', 'agent_type']
)

SPECIALIZED_AGENT_EPISODES = Counter(
    'specialized_agent_episodes_total',
    'Total episodes for specialized agent',
    ['agent_id', 'agent_type']
)

SPECIALIZED_AGENT_ERRORS = Counter(
    'specialized_agent_errors_total',
    'Total errors for specialized agent',
    ['agent_id', 'agent_type', 'error_type']
)

# ============================================================================
# METRIC RECORDING FUNCTIONS
# ============================================================================

# Market Maker Functions
def record_market_maker_spread(agent_id: str, symbol: str, spread: float):
    """Record market maker spread"""
    MARKET_MAKER_SPREAD.labels(agent_id=agent_id, symbol=symbol).set(spread)

def record_market_maker_quote(agent_id: str, symbol: str, side: str):
    """Record market maker quote"""
    MARKET_MAKER_QUOTES.labels(agent_id=agent_id, symbol=symbol, side=side).inc()

def record_market_maker_fill_rate(agent_id: str, symbol: str, rate: float):
    """Record market maker fill rate"""
    MARKET_MAKER_FILL_RATE.labels(agent_id=agent_id, symbol=symbol).set(rate)

def record_market_maker_inventory(agent_id: str, symbol: str, inventory: float):
    """Record market maker inventory"""
    MARKET_MAKER_INVENTORY.labels(agent_id=agent_id, symbol=symbol).set(inventory)

def record_market_maker_pnl(agent_id: str, symbol: str, pnl: float):
    """Record market maker PnL"""
    MARKET_MAKER_PNL.labels(agent_id=agent_id, symbol=symbol).set(pnl)

def record_market_maker_quote_latency(agent_id: str, latency: float):
    """Record market maker quote latency"""
    MARKET_MAKER_QUOTE_LATENCY.labels(agent_id=agent_id).observe(latency)

# Arbitrage Functions
def record_arbitrage_opportunity(agent_id: str, market_pair: str):
    """Record arbitrage opportunity detected"""
    ARBITRAGE_OPPORTUNITIES.labels(agent_id=agent_id, market_pair=market_pair).inc()

def record_arbitrage_execution(agent_id: str, market_pair: str, status: str):
    """Record arbitrage execution"""
    ARBITRAGE_EXECUTIONS.labels(agent_id=agent_id, market_pair=market_pair, status=status).inc()

def record_arbitrage_profit(agent_id: str, market_pair: str, profit: float):
    """Record arbitrage profit"""
    ARBITRAGE_PROFIT.labels(agent_id=agent_id, market_pair=market_pair).set(profit)

def record_arbitrage_execution_latency(agent_id: str, market_pair: str, latency: float):
    """Record arbitrage execution latency"""
    ARBITRAGE_EXECUTION_LATENCY.labels(agent_id=agent_id, market_pair=market_pair).observe(latency)

def record_arbitrage_spread(agent_id: str, market_pair: str, spread: float):
    """Record arbitrage spread"""
    ARBITRAGE_SPREAD.labels(agent_id=agent_id, market_pair=market_pair).set(spread)

def record_arbitrage_success_rate(agent_id: str, market_pair: str, rate: float):
    """Record arbitrage success rate"""
    ARBITRAGE_SUCCESS_RATE.labels(agent_id=agent_id, market_pair=market_pair).set(rate)

# Portfolio Optimization Functions
def record_portfolio_optimization_run(agent_id: str, optimization_type: str):
    """Record portfolio optimization run"""
    PORTFOLIO_OPTIMIZATION_RUNS.labels(agent_id=agent_id, optimization_type=optimization_type).inc()

def record_portfolio_sharpe_ratio(agent_id: str, sharpe: float):
    """Record portfolio Sharpe ratio"""
    PORTFOLIO_SHARPE_RATIO.labels(agent_id=agent_id).set(sharpe)

def record_portfolio_diversification(agent_id: str, diversification: float):
    """Record portfolio diversification"""
    PORTFOLIO_DIVERSIFICATION.labels(agent_id=agent_id).set(diversification)

def record_portfolio_turnover(agent_id: str, turnover: float):
    """Record portfolio turnover"""
    PORTFOLIO_TURNOVER.labels(agent_id=agent_id).set(turnover)

def record_portfolio_rebalance(agent_id: str, trigger: str):
    """Record portfolio rebalance"""
    PORTFOLIO_REBALANCE_COUNT.labels(agent_id=agent_id, trigger=trigger).inc()

def record_portfolio_optimization_latency(agent_id: str, optimization_type: str, latency: float):
    """Record portfolio optimization latency"""
    PORTFOLIO_OPTIMIZATION_LATENCY.labels(agent_id=agent_id, optimization_type=optimization_type).observe(latency)

def record_portfolio_risk_metrics(agent_id: str, risk_type: str, value: float):
    """Record portfolio risk metrics"""
    PORTFOLIO_RISK_METRICS.labels(agent_id=agent_id, risk_type=risk_type).set(value)

# Risk Management Functions
def record_risk_manager_check(agent_id: str, check_type: str):
    """Record risk manager check"""
    RISK_MANAGER_CHECKS.labels(agent_id=agent_id, check_type=check_type).inc()

def record_risk_violation(agent_id: str, violation_type: str, severity: str):
    """Record risk violation"""
    RISK_VIOLATIONS.labels(agent_id=agent_id, violation_type=violation_type, severity=severity).inc()

def record_risk_limits(agent_id: str, limit_type: str, limit: float):
    """Record risk limits"""
    RISK_LIMITS.labels(agent_id=agent_id, limit_type=limit_type).set(limit)

def record_risk_exposure(agent_id: str, exposure_type: str, exposure: float):
    """Record risk exposure"""
    RISK_EXPOSURE.labels(agent_id=agent_id, exposure_type=exposure_type).set(exposure)

def record_risk_manager_action(agent_id: str, action_type: str):
    """Record risk manager action"""
    RISK_MANAGER_ACTIONS.labels(agent_id=agent_id, action_type=action_type).inc()

def record_risk_check_latency(agent_id: str, check_type: str, latency: float):
    """Record risk check latency"""
    RISK_CHECK_LATENCY.labels(agent_id=agent_id, check_type=check_type).observe(latency)

# General Specialized Agent Functions
def record_specialized_agent_reward(agent_id: str, agent_type: str, reward: float):
    """Record specialized agent reward"""
    SPECIALIZED_AGENT_REWARD.labels(agent_id=agent_id, agent_type=agent_type).set(reward)

def record_specialized_agent_episode(agent_id: str, agent_type: str):
    """Record specialized agent episode"""
    SPECIALIZED_AGENT_EPISODES.labels(agent_id=agent_id, agent_type=agent_type).inc()

def record_specialized_agent_error(agent_id: str, agent_type: str, error_type: str):
    """Record specialized agent error"""
    SPECIALIZED_AGENT_ERRORS.labels(agent_id=agent_id, agent_type=agent_type, error_type=error_type).inc()

# ============================================================================
# METRICS SERVER
# ============================================================================

def start_specialized_agents_metrics_server(port: int = 8013):
    """Start HTTP server for specialized agents metrics"""
    start_http_server(port)
    print(f"Specialized agents metrics server started on port {port}")
    print(f"Metrics available at: http://localhost:{port}/metrics")
    return port

