# WealthArena Agent API Specification

## Overview

This document specifies the agent API for WealthArena's multi-agent trading system, including observation spaces, action spaces, and reward functions. The design supports both discrete and continuous action spaces to accommodate different trading strategies.

## Observation Space

### Design Rationale

The observation space combines market data, technical indicators, and portfolio state to provide agents with comprehensive information for decision-making. The design prioritizes:

1. **Market Context**: OHLCV data with technical indicators
2. **Portfolio State**: Current positions and cash balance
3. **Temporal Information**: Time-based features for trend analysis
4. **Risk Metrics**: Volatility and correlation information

### Observation Space Structure

```python
observation_space = gym.spaces.Box(
    low=-np.inf, high=np.inf,
    shape=(obs_dim,), dtype=np.float32
)
```

Where `obs_dim = 6 * num_assets + 4 + num_assets + 3 = 7 * num_assets + 7`

#### Market Data Features (6 * num_assets)
- **OHLCV Data**: Open, High, Low, Close, Volume for each asset
- **Technical Indicators**: RSI, MACD, Bollinger Bands, Moving Averages

#### Portfolio State Features (num_assets + 3)
- **Position Weights**: Normalized position values for each asset
- **Cash Ratio**: Cash as fraction of total portfolio value
- **Portfolio Value**: Total portfolio value normalized by initial value
- **Time Step**: Current step normalized by episode length

#### Risk Features (4)
- **Portfolio Volatility**: Rolling volatility of portfolio returns
- **Max Drawdown**: Maximum peak-to-trough decline
- **Sharpe Ratio**: Risk-adjusted return metric
- **Correlation Matrix**: Average correlation between assets

### Feature Engineering

```python
def _get_observation(self, agent_id: str) -> np.ndarray:
    """Generate observation for agent"""
    
    # Market data (OHLCV + technical indicators)
    market_data = self._get_market_features()
    
    # Portfolio state
    portfolio_state = self._get_portfolio_features(agent_id)
    
    # Risk metrics
    risk_metrics = self._get_risk_features(agent_id)
    
    # Time features
    time_features = self._get_time_features()
    
    return np.concatenate([
        market_data,      # 6 * num_assets
        portfolio_state,  # num_assets + 3
        risk_metrics,     # 4
        time_features     # 1
    ]).astype(np.float32)
```

## Action Space

### Design Rationale

The action space supports both discrete and continuous trading strategies:

1. **Discrete Actions**: Simple buy/sell/hold decisions for each asset
2. **Continuous Actions**: Portfolio weight allocation for sophisticated strategies
3. **Multi-Asset Support**: Actions for all assets simultaneously
4. **Risk Constraints**: Built-in position size limits

### Discrete Action Space

```python
# MultiDiscrete: [0, 1, 2] for each asset
# 0: Sell (reduce position)
# 1: Hold (no action)
# 2: Buy (increase position)

action_space = gym.spaces.MultiDiscrete([3] * num_assets)
```

### Continuous Action Space

```python
# Box: [-1, 1] for each asset
# Negative: Sell (fraction of position)
# Positive: Buy (fraction of available cash)
# Magnitude: Trade size (0.1 = 10% of available)

action_space = gym.spaces.Box(
    low=-1.0, high=1.0,
    shape=(num_assets,), dtype=np.float32
)
```

### Action Execution

```python
def _execute_trades(self, agent_id: str, actions: np.ndarray) -> float:
    """Execute trading actions and return reward"""
    
    if self.action_type == "discrete":
        return self._execute_discrete_trades(agent_id, actions)
    else:
        return self._execute_continuous_trades(agent_id, actions)

def _execute_discrete_trades(self, agent_id: str, actions: np.ndarray) -> float:
    """Execute discrete trading actions"""
    for asset_idx, action in enumerate(actions):
        if action == 0:  # Sell
            self._sell_asset(agent_id, asset_idx, 0.1)  # Sell 10%
        elif action == 2:  # Buy
            self._buy_asset(agent_id, asset_idx, 0.1)   # Buy 10%

def _execute_continuous_trades(self, agent_id: str, actions: np.ndarray) -> float:
    """Execute continuous trading actions"""
    for asset_idx, action in enumerate(actions):
        if abs(action) > 0.01:  # Minimum trade threshold
            if action > 0:  # Buy
                self._buy_asset(agent_id, asset_idx, abs(action))
            else:  # Sell
                self._sell_asset(agent_id, asset_idx, abs(action))
```

## Reward Function

### Design Rationale

The reward function balances multiple objectives:

1. **Profit Maximization**: Primary objective
2. **Risk Management**: Penalize excessive risk-taking
3. **Transaction Costs**: Account for trading costs
4. **Portfolio Stability**: Encourage consistent performance

### Reward Function Formula

```python
def calculate_reward(self, agent_id: str) -> float:
    """Calculate comprehensive reward for agent"""
    
    # Portfolio value change
    portfolio_return = self._get_portfolio_return(agent_id)
    
    # Risk penalty
    risk_penalty = self._calculate_risk_penalty(agent_id)
    
    # Transaction cost penalty
    cost_penalty = self._calculate_transaction_costs(agent_id)
    
    # Stability bonus
    stability_bonus = self._calculate_stability_bonus(agent_id)
    
    # Combined reward
    reward = (
        portfolio_return * 1.0 +           # Primary: profit
        risk_penalty * -0.1 +              # Risk management
        cost_penalty * -0.05 +             # Cost efficiency
        stability_bonus * 0.02             # Consistency
    )
    
    return reward
```

### Reward Components

#### 1. Portfolio Return
```python
def _get_portfolio_return(self, agent_id: str) -> float:
    """Calculate portfolio return"""
    current_value = self._get_portfolio_value(agent_id)
    prev_value = self.agent_states[agent_id]["prev_portfolio_value"]
    
    return (current_value - prev_value) / (prev_value + 1e-8)
```

#### 2. Risk Penalty
```python
def _calculate_risk_penalty(self, agent_id: str) -> float:
    """Calculate risk-based penalty"""
    portfolio_value = self._get_portfolio_value(agent_id)
    
    # Volatility penalty
    volatility = self._get_portfolio_volatility(agent_id)
    vol_penalty = volatility * 0.1
    
    # Drawdown penalty
    drawdown = self._get_max_drawdown(agent_id)
    dd_penalty = max(0, drawdown - 0.1) * 0.5  # Penalty if > 10% drawdown
    
    # Concentration penalty
    concentration = self._get_portfolio_concentration(agent_id)
    conc_penalty = concentration * 0.2
    
    return vol_penalty + dd_penalty + conc_penalty
```

#### 3. Transaction Costs
```python
def _calculate_transaction_costs(self, agent_id: str) -> float:
    """Calculate transaction cost penalty"""
    trade_volume = self._get_trade_volume(agent_id)
    cost_rate = 0.001  # 0.1% transaction cost
    
    return trade_volume * cost_rate
```

#### 4. Stability Bonus
```python
def _calculate_stability_bonus(self, agent_id: str) -> float:
    """Calculate stability bonus for consistent performance"""
    returns = self._get_recent_returns(agent_id, window=20)
    
    if len(returns) < 5:
        return 0.0
    
    # Consistency bonus (lower variance = higher bonus)
    consistency = 1.0 / (np.std(returns) + 1e-8)
    
    # Trend bonus (positive trend = higher bonus)
    trend = np.mean(returns)
    
    return consistency * 0.01 + trend * 0.1
```

## Multi-Agent Coordination

### Agent Types

1. **Conservative Trader**: Low risk, steady returns
2. **Aggressive Trader**: High risk, high potential returns
3. **Balanced Trader**: Moderate risk-return profile

### Coordination Mechanisms

```python
def _calculate_coordination_reward(self, agent_id: str) -> float:
    """Calculate coordination reward for multi-agent cooperation"""
    
    # Market impact reduction
    market_impact = self._calculate_market_impact(agent_id)
    impact_bonus = max(0, 0.1 - market_impact) * 0.5
    
    # Diversification bonus
    diversification = self._calculate_diversification_bonus()
    div_bonus = diversification * 0.3
    
    # Information sharing bonus
    info_sharing = self._calculate_information_sharing_bonus(agent_id)
    info_bonus = info_sharing * 0.2
    
    return impact_bonus + div_bonus + info_bonus
```

## Environment Interface

### Gymnasium Compatibility

```python
class WealthArenaTradingEnv(gym.Env):
    """Gymnasium-compatible trading environment"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__()
        self.config = config
        self._setup_spaces()
        self.reset()
    
    def reset(self, *, seed=None, options=None):
        """Reset environment for new episode"""
        # Implementation details...
        return observation, info
    
    def step(self, action):
        """Execute one step of the environment"""
        # Implementation details...
        return observation, reward, terminated, truncated, info
    
    def render(self, mode='human'):
        """Render environment state"""
        # Implementation details...
    
    def close(self):
        """Clean up environment resources"""
        # Implementation details...
```

### Multi-Agent Extension

```python
class WealthArenaMultiAgentEnv(MultiAgentEnv):
    """Multi-agent trading environment for RLlib"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__()
        self.config = config
        self.num_agents = config.get("num_agents", 3)
        self.agent_ids = [f"trader_{i}" for i in range(self.num_agents)]
        self._setup_spaces()
    
    def reset(self, *, seed=None, options=None):
        """Reset environment for all agents"""
        # Implementation details...
        return observations, infos
    
    def step(self, action_dict: Dict[str, np.ndarray]):
        """Execute actions for all agents"""
        # Implementation details...
        return observations, rewards, terminateds, truncateds, infos
```

## Integration Points

### Data Integration

```python
def get_ohlcv_data(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch OHLCV data from SYS1 API"""
    # Implementation for SYS1 API integration
    pass

def calculate_technical_indicators(data: pd.DataFrame) -> pd.DataFrame:
    """Calculate technical indicators from OHLCV data"""
    # Implementation for technical analysis
    pass
```

### Risk System Integration

```python
def calculate_risk_metrics(portfolio: Dict[str, float]) -> Dict[str, float]:
    """Calculate risk metrics for portfolio"""
    # Implementation for risk calculation
    pass

def validate_position_limits(positions: Dict[str, float]) -> bool:
    """Validate position limits against risk constraints"""
    # Implementation for risk validation
    pass
```

## Performance Metrics

### Agent Performance

- **Sharpe Ratio**: Risk-adjusted returns
- **Maximum Drawdown**: Peak-to-trough decline
- **Win Rate**: Percentage of profitable trades
- **Average Return**: Mean portfolio return
- **Volatility**: Portfolio return standard deviation

### System Performance

- **Total Portfolio Value**: Combined value of all agents
- **Market Impact**: Effect of trading on market prices
- **Transaction Costs**: Total costs incurred
- **Coordination Efficiency**: Multi-agent cooperation metrics

## Configuration

### Environment Configuration

```yaml
environment:
  num_agents: 3
  num_assets: 10
  episode_length: 1000
  initial_cash: 100000
  action_type: "continuous"  # or "discrete"
  reward_components:
    profit_weight: 1.0
    risk_weight: -0.1
    cost_weight: -0.05
    stability_weight: 0.02
```

### Agent Configuration

```yaml
agents:
  conservative_trader:
    risk_tolerance: 0.1
    max_position_size: 0.2
    trading_frequency: 0.1
  aggressive_trader:
    risk_tolerance: 0.3
    max_position_size: 0.5
    trading_frequency: 0.3
  balanced_trader:
    risk_tolerance: 0.2
    max_position_size: 0.3
    trading_frequency: 0.2
```

This specification provides a comprehensive foundation for implementing the WealthArena multi-agent trading system with RLlib.
