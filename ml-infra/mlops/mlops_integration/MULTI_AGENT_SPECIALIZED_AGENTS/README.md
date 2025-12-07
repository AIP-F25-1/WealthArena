# Multi-Agent System & Specialized Trading Agents Metrics

This folder contains Prometheus metrics implementation for:
1. **Multi-Agent RL Training System**
2. **Specialized Trading Agents** (Market Maker, Arbitrage, Portfolio Optimization, Risk Manager)

## 📁 Files

- `multi_agent_prometheus_metrics.py` - Multi-agent system metrics
- `specialized_agents_prometheus_metrics.py` - Specialized trading agents metrics
- `start_metrics_servers.py` - Script to start both metrics servers
- `integration_guide.md` - Integration instructions
- `metrics_reference.md` - Complete metrics reference

## 🚀 Quick Start

### Start Multi-Agent Metrics Server

```python
from multi_agent_prometheus_metrics import start_multi_agent_metrics_server
start_multi_agent_metrics_server(port=8012)
```

### Start Specialized Agents Metrics Server

```python
from specialized_agents_prometheus_metrics import start_specialized_agents_metrics_server
start_specialized_agents_metrics_server(port=8013)
```

### Start Both Servers

```bash
python start_metrics_servers.py
```

## 📊 Metrics Overview

### Multi-Agent System Metrics (Port 8012)

- Training lifecycle (runs, iterations, active status)
- Agent coordination overhead and efficiency
- Agent-to-agent communication tracking
- Shared resource utilization
- Inter-agent reward distribution
- Shared environment conflicts
- Multi-agent performance metrics

### Specialized Trading Agents Metrics (Port 8013)

- **Market Maker:** Spread, quotes, fill rate, inventory, PnL, latency
- **Arbitrage:** Opportunities, executions, profit, success rate, latency
- **Portfolio Optimization:** Sharpe ratio, diversification, turnover, risk metrics
- **Risk Manager:** Checks, violations, limits, exposure, actions

## 🔧 Integration

See `integration_guide.md` for detailed integration instructions with your training code.

## 📖 Metrics Reference

See `metrics_reference.md` for complete list of all available metrics.

