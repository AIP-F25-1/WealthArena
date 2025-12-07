# Integration Guide

## Multi-Agent System Integration

### Step 1: Import Metrics Functions

```python
from mlops_integration.MULTI_AGENT_SPECIALIZED_AGENTS.multi_agent_prometheus_metrics import (
    start_multi_agent_metrics_server,
    record_multi_agent_training_start,
    record_multi_agent_training_complete,
    record_multi_agent_iteration,
    record_agent_communication,
    record_coordination_overhead,
    record_coordination_efficiency,
    record_multi_agent_performance
)
```

### Step 2: Start Metrics Server

```python
# Start metrics server (do this once at startup)
start_multi_agent_metrics_server(port=8012)
```

### Step 3: Record Metrics in Training Code

```python
# In your multi-agent training script

# At training start
record_multi_agent_training_start(coordination_type="hierarchical")

# During training iterations
for iteration in range(num_iterations):
    # Record iteration
    record_multi_agent_iteration(
        coordination_type="hierarchical",
        iteration=iteration,
        run_id="run_1",
        episode_reward=mean_reward
    )
    
    # Record agent communication
    record_agent_communication(
        from_agent="agent_0",
        to_agent="agent_1",
        message_type="coordination"
    )
    
    # Record coordination overhead
    start_time = time.time()
    # ... coordination logic ...
    overhead = time.time() - start_time
    record_coordination_overhead(
        coordination_type="hierarchical",
        method="hierarchical",
        duration=overhead
    )
    
    # Record performance metrics
    record_multi_agent_performance(
        coordination_type="hierarchical",
        agent_group="all",
        sharpe_ratio=sharpe,
        win_rate=win_rate,
        total_return=total_return
    )

# At training completion
record_multi_agent_training_complete(coordination_type="hierarchical")
```

## Specialized Trading Agents Integration

### Step 1: Import Metrics Functions

```python
from mlops_integration.MULTI_AGENT_SPECIALIZED_AGENTS.specialized_agents_prometheus_metrics import (
    start_specialized_agents_metrics_server,
    # Market Maker
    record_market_maker_spread,
    record_market_maker_quote,
    record_market_maker_fill_rate,
    # Arbitrage
    record_arbitrage_opportunity,
    record_arbitrage_execution,
    record_arbitrage_profit,
    # Portfolio Optimization
    record_portfolio_optimization_run,
    record_portfolio_sharpe_ratio,
    # Risk Management
    record_risk_manager_check,
    record_risk_violation
)
```

### Step 2: Start Metrics Server

```python
# Start metrics server (do this once at startup)
start_specialized_agents_metrics_server(port=8013)
```

### Step 3: Record Metrics in Agent Code

#### Market Maker Agent

```python
# Record spread
record_market_maker_spread(
    agent_id="mm_1",
    symbol="AAPL",
    spread=0.05
)

# Record quote
record_market_maker_quote(
    agent_id="mm_1",
    symbol="AAPL",
    side="bid"
)

# Record fill rate
record_market_maker_fill_rate(
    agent_id="mm_1",
    symbol="AAPL",
    rate=0.75
)
```

#### Arbitrage Agent

```python
# Record opportunity detected
record_arbitrage_opportunity(
    agent_id="arb_1",
    market_pair="AAPL-NASDAQ"
)

# Record execution
record_arbitrage_execution(
    agent_id="arb_1",
    market_pair="AAPL-NASDAQ",
    status="success"
)

# Record profit
record_arbitrage_profit(
    agent_id="arb_1",
    market_pair="AAPL-NASDAQ",
    profit=100.50
)
```

#### Portfolio Optimization Agent

```python
# Record optimization run
record_portfolio_optimization_run(
    agent_id="portfolio_1",
    optimization_type="sharpe_maximization"
)

# Record Sharpe ratio
record_portfolio_sharpe_ratio(
    agent_id="portfolio_1",
    sharpe=2.5
)
```

#### Risk Management Agent

```python
# Record risk check
record_risk_manager_check(
    agent_id="risk_1",
    check_type="position_limit"
)

# Record violation
record_risk_violation(
    agent_id="risk_1",
    violation_type="position_limit",
    severity="warning"
)
```

## Prometheus Configuration

Add these scrape targets to your `prometheus.yml`:

```yaml
scrape_configs:
  # Multi-Agent System
  - job_name: 'wealtharena_multi_agent_rl'
    scrape_interval: 10s
    static_configs:
      - targets: ['host.docker.internal:8012']
  
  # Specialized Trading Agents
  - job_name: 'wealtharena_specialized_agents'
    scrape_interval: 10s
    static_configs:
      - targets: ['host.docker.internal:8013']
```

## Testing

### Test Multi-Agent Metrics

```bash
curl http://localhost:8012/metrics | grep multi_agent
```

### Test Specialized Agents Metrics

```bash
curl http://localhost:8013/metrics | grep market_maker
curl http://localhost:8013/metrics | grep arbitrage
curl http://localhost:8013/metrics | grep portfolio
curl http://localhost:8013/metrics | grep risk_manager
```

### Query in Prometheus

```
# Multi-agent coordination efficiency
agent_coordination_efficiency

# Agent communication rate
rate(agent_communication_total[5m])

# Market maker fill rate
market_maker_fill_rate

# Arbitrage success rate
arbitrage_success_rate
```

