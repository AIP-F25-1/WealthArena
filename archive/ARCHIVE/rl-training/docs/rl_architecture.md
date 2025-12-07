# WealthArena RL Trading System Architecture

## System Overview

WealthArena is a **multi-agent reinforcement learning trading system** that coordinates multiple RL agents across different financial instrument types using hierarchical RL and advanced coordination mechanisms.

## RL Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WealthArena RL Trading System                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Stock RL    │  │ Crypto RL   │  │ ETF RL      │  │ Currency RL │  │
│  │ Agent (PPO) │  │ Agent (SAC) │  │ Agent (A2C) │  │ Agent (DQN) │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│         │                │                │                │         │
│         └────────────────┼────────────────┼────────────────┘         │
│                          │                │                          │
│  ┌───────────────────────┴────────────────┴───────────────────────┐  │
│  │              Multi-Agent RL Environment                        │  │
│  │  • Hierarchical RL Coordination                               │  │
│  │  • Signal Fusion & Weighting                                 │  │
│  │  • Risk Management & Position Sizing                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────┴───────────────────────────────────────┐  │
│  │                    RL Meta Agent                              │  │
│  │  • High-Level Allocator (PPO)                                │  │
│  │  • Low-Level Execution Policies                               │  │
│  │  • Adaptive Weight Adjustment                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## RL Agent Types

### 1. Stock RL Agent (PPO)
- **Algorithm**: Proximal Policy Optimization
- **Action Space**: Buy, Sell, Hold
- **Observation Space**: Market data + portfolio state + coordination info
- **Specialization**: ASX stock trading with momentum and mean-reversion strategies

### 2. Crypto RL Agent (SAC)
- **Algorithm**: Soft Actor-Critic
- **Action Space**: Continuous position sizing
- **Observation Space**: Crypto market data + volatility indicators
- **Specialization**: High-frequency crypto trading with volatility management

### 3. ETF RL Agent (A2C)
- **Algorithm**: Advantage Actor-Critic
- **Action Space**: Buy, Sell, Hold
- **Observation Space**: ETF data + sector rotation signals
- **Specialization**: Sector rotation and diversification strategies

### 4. Currency RL Agent (DQN)
- **Algorithm**: Deep Q-Network
- **Action Space**: Discrete trading actions
- **Observation Space**: Forex data + economic indicators
- **Specialization**: Currency pair trading with carry strategies

### 5. REIT RL Agent (PPO)
- **Algorithm**: Proximal Policy Optimization
- **Action Space**: Buy, Sell, Hold
- **Observation Space**: REIT data + real estate indicators
- **Specialization**: Real estate investment trust trading

## Multi-Agent RL Environment

### Hierarchical RL Coordination
- **High-Level Allocator**: PPO agent that coordinates all instrument agents
- **Low-Level Execution**: Individual agents execute specific instrument strategies
- **Signal Fusion**: Advanced methods for combining agent signals
- **Adaptive Weights**: Performance-based weight adjustment

### Coordination Methods
1. **Hierarchical**: High-level agent coordinates low-level agents
2. **Decentralized**: Independent agent decision making
3. **Centralized**: Centralized signal fusion

## RL Training Pipeline

### 1. Individual Agent Training
```python
# Train each RL agent
for instrument_type in ["stocks", "crypto", "etf", "currencies", "reits"]:
    agent = RLAgentFactory.create_agent(instrument_type)
    results = agent.train(training_data, num_iterations=1000)
```

### 2. Multi-Agent Environment Training
```python
# Train in multi-agent environment
env = WealthArenaMultiAgentRLEnv(config)
for episode in range(1000):
    obs, info = env.reset()
    while not done:
        actions = {agent_id: agent.predict(obs[agent_id]) for agent_id in env.agent_ids}
        obs, rewards, terminateds, truncateds, infos = env.step(actions)
```

### 3. Meta Agent Training
```python
# Train hierarchical meta agent
meta_agent = RLMetaAgent(config)
meta_agent.add_instrument_agent("stocks", stock_agent)
meta_agent.add_instrument_agent("crypto", crypto_agent)
# ... add other agents
results = meta_agent.train_meta_agent(training_data)
```

## Reward Functions

### Individual Agent Rewards
- **Profit-Based**: Direct return maximization
- **Risk Penalties**: Volatility and drawdown penalties
- **Transaction Costs**: Realistic trading cost modeling

### Multi-Agent Coordination Rewards
- **Cooperation Bonus**: Multi-agent coordination incentives
- **Diversification Bonus**: Portfolio diversification rewards
- **Market Impact Reduction**: Reduced market impact through coordination

## Key Features

### 1. RL Algorithms
- **PPO**: Stable policy optimization for discrete actions
- **SAC**: Soft actor-critic for continuous actions
- **A2C**: Advantage actor-critic for faster convergence
- **DQN**: Deep Q-learning for discrete action spaces

### 2. Custom Policy Networks
- **Actor-Critic Architecture**: Separate networks for policy and value function
- **Trading-Specific Design**: Optimized for financial trading decisions
- **Feature Engineering**: Market data + portfolio state + coordination info

### 3. Risk Management
- **Position Sizing**: Dynamic position sizing based on signal strength
- **Risk Penalties**: Volatility and drawdown penalties in reward function
- **Portfolio Constraints**: Maximum position size and diversification limits

### 4. Signal Fusion
- **Weighted Fusion**: Performance-based adaptive weights
- **Voting Fusion**: Majority vote among agents
- **Neural Fusion**: Neural network-based signal combination

## Usage

### Quick Start
```bash
# Train RL agents
python train_wealtharena_system.py --train-models-only

# Run full RL system
python train_wealtharena_system.py --config config/training_config.yaml
```

### Individual Agent Usage
```python
from src.models.rl_agents import RLAgentFactory

# Create and train RL agent
agent = RLAgentFactory.create_agent("stocks")
results = agent.train(training_data, num_iterations=1000)

# Make trading decisions
action = agent.predict(observation)
```

### Multi-Agent Environment
```python
from src.environments.multi_agent_rl_env import WealthArenaMultiAgentRLEnv

# Create multi-agent environment
env = WealthArenaMultiAgentRLEnv(config)

# Train agents in environment
obs, info = env.reset()
for step in range(1000):
    actions = {agent_id: env.action_space.sample() for agent_id in env.agent_ids}
    obs, rewards, terminateds, truncateds, infos = env.step(actions)
```

## Performance Metrics

### RL-Specific Metrics
- **Episode Reward**: Total reward per episode
- **Episode Length**: Number of steps per episode
- **Convergence**: Training convergence indicators
- **Exploration Rate**: Agent exploration behavior

### Trading Performance
- **Sharpe Ratio**: Risk-adjusted returns
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Win Rate**: Percentage of profitable trades
- **Average Return**: Mean return per trade

## Configuration

### RL Agent Configuration
```yaml
rl_agents:
  stocks:
    algorithm: "PPO"
    learning_rate: 3e-4
    gamma: 0.99
    hidden_layers: [256, 256, 128]
  
  crypto:
    algorithm: "SAC"
    learning_rate: 3e-4
    gamma: 0.99
    tau: 0.005
```

### Multi-Agent Environment Configuration
```yaml
multi_agent_env:
  coordination_method: "hierarchical"
  fusion_method: "weighted"
  agent_weights:
    stocks: 0.3
    crypto: 0.2
    etf: 0.2
    currencies: 0.2
    reits: 0.1
```

This architecture provides a robust, scalable RL trading system that can adapt to changing market conditions and coordinate multiple agents effectively.
