# Metrics Reference

## Multi-Agent System Metrics (Port 8012)

### Training Lifecycle
- `multi_agent_training_runs_total{status, coordination_type}` - Total training runs
- `multi_agent_training_active{coordination_type}` - Training active status (0/1)
- `multi_agent_iterations_total{coordination_type}` - Total iterations
- `multi_agent_current_iteration{coordination_type, run_id}` - Current iteration

### Coordination Metrics
- `agent_coordination_overhead_seconds{coordination_type, method}` - Coordination overhead time (histogram)
- `agent_communication_total{from_agent, to_agent, message_type}` - Agent communications (counter)
- `agent_coordination_efficiency{coordination_type}` - Coordination efficiency 0-1 (gauge)
- `shared_resource_utilization{resource_type}` - Resource utilization % (gauge)

### Performance Metrics
- `multi_agent_episode_reward_mean{coordination_type, run_id}` - Mean episode reward (gauge)
- `multi_agent_sharpe_ratio{coordination_type, agent_group}` - Sharpe ratio (gauge)
- `multi_agent_win_rate{coordination_type, agent_group}` - Win rate % (gauge)
- `multi_agent_total_return{coordination_type, agent_group}` - Total return % (gauge)
- `inter_agent_reward_distribution{coordination_type}` - Reward distribution (histogram)

### Agent Metrics
- `active_agents_count{coordination_type}` - Number of active agents (gauge)
- `agent_episodes_total{agent_id, agent_type, coordination_type}` - Episodes per agent (counter)

### Coordination Methods
- `coordination_method_usage_total{method, coordination_type}` - Method usage count (counter)
- `coordination_decision_latency_seconds{method, coordination_type}` - Decision latency (histogram)

### Environment Metrics
- `shared_environment_steps_total{coordination_type}` - Shared environment steps (counter)
- `shared_environment_conflicts_total{conflict_type, coordination_type}` - Environment conflicts (counter)

### Error Metrics
- `multi_agent_errors_total{error_type, coordination_type}` - Multi-agent errors (counter)

## Specialized Trading Agents Metrics (Port 8013)

### Market Maker Agent
- `market_maker_spread{agent_id, symbol}` - Bid-ask spread (gauge)
- `market_maker_quotes_total{agent_id, symbol, side}` - Total quotes bid/ask (counter)
- `market_maker_fill_rate{agent_id, symbol}` - Fill rate 0-1 (gauge)
- `market_maker_inventory{agent_id, symbol}` - Current inventory (gauge)
- `market_maker_pnl{agent_id, symbol}` - Profit and loss (gauge)
- `market_maker_quote_latency_seconds{agent_id}` - Quote generation latency (histogram)

### Arbitrage Agent
- `arbitrage_opportunities_total{agent_id, market_pair}` - Opportunities detected (counter)
- `arbitrage_executions_total{agent_id, market_pair, status}` - Executions success/failed (counter)
- `arbitrage_profit{agent_id, market_pair}` - Profit from arbitrage (gauge)
- `arbitrage_execution_latency_seconds{agent_id, market_pair}` - Execution latency (histogram)
- `arbitrage_spread{agent_id, market_pair}` - Price spread detected (gauge)
- `arbitrage_success_rate{agent_id, market_pair}` - Success rate 0-1 (gauge)

### Portfolio Optimization Agent
- `portfolio_optimization_runs_total{agent_id, optimization_type}` - Optimization runs (counter)
- `portfolio_sharpe_ratio{agent_id}` - Portfolio Sharpe ratio (gauge)
- `portfolio_diversification{agent_id}` - Diversification score (gauge)
- `portfolio_turnover{agent_id}` - Turnover rate (gauge)
- `portfolio_rebalance_total{agent_id, trigger}` - Rebalancing operations (counter)
- `portfolio_optimization_latency_seconds{agent_id, optimization_type}` - Optimization latency (histogram)
- `portfolio_risk_metrics{agent_id, risk_type}` - Risk metrics VaR/CVaR (gauge)

### Risk Management Agent
- `risk_manager_checks_total{agent_id, check_type}` - Risk checks performed (counter)
- `risk_violations_total{agent_id, violation_type, severity}` - Risk violations (counter)
- `risk_limits{agent_id, limit_type}` - Current risk limits (gauge)
- `risk_exposure{agent_id, exposure_type}` - Current risk exposure (gauge)
- `risk_manager_actions_total{agent_id, action_type}` - Risk management actions (counter)
- `risk_check_latency_seconds{agent_id, check_type}` - Risk check latency (histogram)

### General Specialized Agent Metrics
- `specialized_agent_reward{agent_id, agent_type}` - Agent reward (gauge)
- `specialized_agent_episodes_total{agent_id, agent_type}` - Total episodes (counter)
- `specialized_agent_errors_total{agent_id, agent_type, error_type}` - Agent errors (counter)

## Prometheus Query Examples

### Multi-Agent Queries

```
# Coordination efficiency
agent_coordination_efficiency

# Agent communication rate
rate(agent_communication_total[5m])

# Multi-agent Sharpe ratio
multi_agent_sharpe_ratio

# Shared environment conflicts
rate(shared_environment_conflicts_total[5m])
```

### Specialized Agents Queries

```
# Market maker fill rate
market_maker_fill_rate

# Arbitrage success rate
arbitrage_success_rate

# Portfolio Sharpe ratio
portfolio_sharpe_ratio

# Risk violations
rate(risk_violations_total[5m])
```

## Metric Types

- **Counter**: Monotonically increasing value (e.g., total communications)
- **Gauge**: Value that can go up or down (e.g., current inventory)
- **Histogram**: Distribution of values (e.g., latency, overhead)

