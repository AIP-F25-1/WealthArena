# Trading Agent Specification for WealthArena

## Executive Summary

This document defines the comprehensive specification for trading agents in the WealthArena multi-agent trading system. It covers observation spaces, action spaces, reward functions, and multi-objective optimization strategies for different asset types.

## Agent Architecture Overview

### Agent Types
1. **ASX Stocks Agent** - Handles all 300+ ASX listed companies
2. **ETF Trading Agent** - Manages Exchange-Traded Funds
3. **REITs Agent** - Real Estate Investment Trusts
4. **Currency Pairs Agent** - Major currency pairs (USD, GBP, CHF, AUD, JPY, NZD, CAD, EUR)
5. **US Stocks Agent** - Major US market influencers
6. **Commodities Agent** - Major tradable commodities
7. **Cryptocurrency Agent** - Major global cryptocurrencies

## Observation Space Design

### Market Data Features (Per Asset)
- **OHLCV Data**: Open, High, Low, Close, Volume
- **Technical Indicators**:
  - Moving Averages: SMA(5,10,20,50,200), EMA(12,26,50)
  - Momentum: RSI(14), MACD, Stochastic(14,3), Williams %R(14)
  - Volatility: ATR(14), Bollinger Bands(20,2), BB Width, BB Position
  - Volume: OBV, Volume Ratio, Money Flow Index(14)
  - Trend: ADX(14), Plus DI, Minus DI, Aroon Up/Down(14)
  - Custom: CCI(20), Commodity Channel Index

### Portfolio State Features
- **Position Weights**: Current allocation per asset
- **Cash Ratio**: Available cash as percentage of total value
- **Total Value Ratio**: Portfolio value relative to initial capital
- **Leverage**: Current leverage ratio
- **Unrealized P&L**: Per asset and total

### Risk Metrics Features
- **Volatility**: Portfolio volatility (20-day rolling)
- **Sharpe Ratio**: Risk-adjusted returns
- **Maximum Drawdown**: Peak-to-trough decline
- **VaR (95%)**: Value at Risk
- **CVaR (95%)**: Conditional Value at Risk
- **Skewness**: Return distribution skewness
- **Kurtosis**: Return distribution kurtosis
- **Beta**: Market correlation coefficient
- **Sortino Ratio**: Downside deviation ratio

### Market State Features
- **Market Regime**: Bull/Bear/Neutral classification
- **Volatility Regime**: High/Low volatility state
- **Trend Strength**: Market trend momentum
- **Market Return**: Recent market performance
- **Market Volatility**: Recent market volatility

### Time Features
- **Episode Progress**: Current step / total steps
- **Time to End**: Remaining steps in episode
- **Day of Week**: Cyclical encoding
- **Month of Year**: Seasonal encoding

## Action Space Design

### Continuous Action Space
- **Portfolio Weights**: Continuous allocation [-1.0, 1.0] per asset
- **Normalization**: Actions sum to reasonable values (≤ 1.0)
- **Interpretation**:
  - Positive values: Long positions
  - Negative values: Short positions
  - Zero: No position
  - Magnitude: Position size

### Action Constraints
- **Maximum Position Size**: 15% per individual asset
- **Maximum Short Exposure**: 30% total short positions
- **Leverage Limit**: 2.0x maximum leverage
- **Turnover Limit**: 50% maximum daily turnover

## Multi-Objective Reward Function

### Primary Objectives

#### 1. Profit Maximization
```python
profit_reward = (current_value - previous_value) / previous_value * 100
weight: 2.0
```

#### 2. Risk Management
```python
risk_penalty = volatility_penalty + drawdown_penalty + var_penalty
volatility_penalty = max(0, portfolio_volatility - max_volatility) * 100
drawdown_penalty = max(0, max_drawdown - max_drawdown_limit) * 100
var_penalty = max(0, var_95 - var_limit) * 100
weight: 0.5
```

#### 3. Transaction Costs
```python
cost_penalty = total_transaction_cost / initial_capital * 100
transaction_cost = trade_value * (commission_rate + slippage_rate)
weight: 0.1
```

#### 4. Portfolio Stability
```python
stability_penalty = trade_frequency_penalty + position_change_penalty
trade_frequency_penalty = num_trades * 0.1
position_change_penalty = sum(abs(position_changes)) * 0.01
weight: 0.05
```

#### 5. Risk-Adjusted Returns (Sharpe Ratio)
```python
sharpe_reward = (mean_return / std_return) * sqrt(252) * 10
weight: 1.0
```

#### 6. Momentum Alignment
```python
momentum_reward = portfolio_momentum * market_momentum * 100
weight: 0.3
```

#### 7. Diversification
```python
diversification_reward = (1 - concentration_index) * 10
concentration_index = sum(position_weights^2)
weight: 0.2
```

### Secondary Objectives

#### 8. Sector Rotation
```python
sector_rotation_reward = sector_performance_alignment * 5
weight: 0.1
```

#### 9. Market Timing
```python
market_timing_reward = regime_alignment * 3
weight: 0.05
```

#### 10. Liquidity Management
```python
liquidity_reward = liquidity_utilization_efficiency * 2
weight: 0.02
```

## Asset-Specific Configurations

### ASX Stocks Agent
- **Observation Window**: 30 days
- **Action Space**: 300+ assets (all ASX symbols)
- **Reward Weights**: Standard weights with sector rotation bonus
- **Risk Limits**: Standard portfolio limits
- **Rebalancing**: Daily

### ETF Trading Agent
- **Observation Window**: 20 days
- **Action Space**: 50+ major ETFs
- **Reward Weights**: Higher stability weight (0.1)
- **Risk Limits**: Lower volatility tolerance
- **Rebalancing**: Weekly

### REITs Agent
- **Observation Window**: 20 days
- **Action Space**: 30+ REITs
- **Reward Weights**: Higher diversification weight (0.3)
- **Risk Limits**: Moderate risk tolerance
- **Rebalancing**: Monthly

### Currency Pairs Agent
- **Observation Window**: 14 days
- **Action Space**: 28 major pairs (8 currencies)
- **Reward Weights**: Higher momentum weight (0.5)
- **Risk Limits**: Higher volatility tolerance
- **Rebalancing**: Daily

### US Stocks Agent
- **Observation Window**: 30 days
- **Action Space**: 50+ major US stocks
- **Reward Weights**: Standard weights
- **Risk Limits**: Standard portfolio limits
- **Rebalancing**: Daily

### Commodities Agent
- **Observation Window**: 20 days
- **Action Space**: 20+ major commodities
- **Reward Weights**: Higher momentum weight (0.4)
- **Risk Limits**: Higher volatility tolerance
- **Rebalancing**: Weekly

### Cryptocurrency Agent
- **Observation Window**: 14 days
- **Action Space**: 20+ major cryptocurrencies
- **Reward Weights**: Higher momentum weight (0.6)
- **Risk Limits**: Very high volatility tolerance
- **Rebalancing**: Daily

## Risk Management Framework

### Position Limits
- **Maximum Single Position**: 15% of portfolio
- **Maximum Sector Exposure**: 30% per sector
- **Maximum Country Exposure**: 40% per country
- **Maximum Asset Class Exposure**: 50% per asset class

### Risk Controls
- **Stop Loss**: 8% per position
- **Take Profit**: 20% per position
- **Maximum Drawdown**: 15% portfolio level
- **VaR Limit**: 5% daily (95% confidence)
- **Correlation Limit**: 0.7 maximum correlation

### Dynamic Risk Adjustment
- **Volatility Scaling**: Reduce position sizes during high volatility
- **Correlation Monitoring**: Reduce correlated positions
- **Regime Detection**: Adjust risk parameters based on market regime
- **Liquidity Assessment**: Reduce positions in illiquid assets

## Performance Metrics

### Primary Metrics
- **Total Return**: Cumulative portfolio return
- **Sharpe Ratio**: Risk-adjusted return
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Calmar Ratio**: Annual return / maximum drawdown
- **Sortino Ratio**: Return / downside deviation

### Secondary Metrics
- **Win Rate**: Percentage of profitable trades
- **Average Win/Loss**: Average winning vs losing trade
- **Profit Factor**: Gross profit / gross loss
- **Recovery Factor**: Net profit / maximum drawdown
- **Stability**: Return consistency measure

### Risk Metrics
- **VaR (95%)**: Value at Risk
- **CVaR (95%)**: Conditional Value at Risk
- **Beta**: Market correlation
- **Alpha**: Excess return over market
- **Tracking Error**: Volatility of excess returns

## Training Configuration

### Environment Parameters
- **Episode Length**: 252 trading days (1 year)
- **Lookback Window**: 30 days
- **Initial Capital**: $1,000,000
- **Transaction Costs**: 0.05% commission + 0.02% slippage
- **Data Frequency**: Daily

### Training Parameters
- **Algorithm**: PPO (Proximal Policy Optimization)
- **Learning Rate**: 3e-4
- **Batch Size**: 4000
- **Epochs**: 10 per update
- **Gamma**: 0.99
- **Lambda**: 0.95
- **Clip Parameter**: 0.2
- **Value Loss Coefficient**: 0.5
- **Entropy Coefficient**: 0.01

### Evaluation Metrics
- **Validation Period**: 20% of data
- **Test Period**: 20% of data
- **Benchmark**: Buy-and-hold ASX 200
- **Evaluation Frequency**: Every 100 episodes
- **Early Stopping**: 50 episodes without improvement

## Implementation Notes

### State Normalization
- **Price Data**: Log-normalized returns
- **Volume Data**: Log-transformed
- **Technical Indicators**: Z-score normalized
- **Portfolio State**: Percentage-based
- **Risk Metrics**: Clipped to reasonable ranges

### Action Processing
- **Softmax Normalization**: For position weights
- **Constraint Enforcement**: Hard limits on position sizes
- **Smooth Transitions**: Gradual position changes
- **Transaction Cost Integration**: Realistic cost modeling

### Reward Shaping
- **Sparse to Dense**: Convert sparse rewards to dense
- **Reward Clipping**: Prevent extreme reward values
- **Reward Scaling**: Normalize reward magnitudes
- **Curriculum Learning**: Gradually increase complexity

## Conclusion

This specification provides a comprehensive framework for developing sophisticated trading agents that can handle multiple asset types while maintaining robust risk management and performance optimization. The multi-objective reward function ensures balanced optimization across profit, risk, and stability objectives, while asset-specific configurations allow for specialized strategies tailored to different market characteristics.

---

*Document Version: 1.0*  
*Last Updated: 2025-09-20*  
*Author: WealthArena RL Engineering Team*