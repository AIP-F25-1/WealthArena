# WealthArena Individual Agent Trainers

This document explains how to use the individual agent trainers for each financial instrument type.

## Overview

The WealthArena system includes specialized trainers for each financial instrument type:

1. **ASX Stocks Agent** - 30+ ASX listed companies
2. **Currency Pairs Agent** - 10+ major forex pairs
3. **Cryptocurrency Agent** - 12+ major cryptocurrencies
4. **ETF Agent** - 20+ major exchange-traded funds

Each trainer provides:
- ✅ Training simulation
- ✅ Backtesting capabilities
- ✅ Comprehensive evaluation metrics
- ✅ Performance comparison
- ✅ Results saving

## Quick Start

### Option 1: Interactive Menu
```bash
python run_individual_agents.py
```
This will show an interactive menu where you can select which agent to train.

### Option 2: Individual Agent Scripts
```bash
# ASX Stocks Agent
python -m src.training.asx_stocks_trainer

# Currency Pairs Agent
python -m src.training.currency_pairs_trainer

# Cryptocurrency Agent
python -m src.training.cryptocurrency_trainer

# ETF Agent
python -m src.training.etf_trainer
```

### Option 3: Master Comparison
```bash
python -m src.training.master_trainer
```
This will train and compare all agents.

### Option 4: Demo Script
```bash
python demo_currency_pairs.py
```
This demonstrates the Currency Pairs agent with detailed output.

## Individual Agent Details

### 1. ASX Stocks Agent

**File**: `src/training/asx_stocks_trainer.py`

**Features**:
- 30 ASX 200 stocks
- 30-day lookback window
- Stock-specific volatility modeling
- Sector-based correlation structure

**Configuration**:
```python
config = ASXStocksConfig(
    symbols=get_asx_200_symbols()[:30],
    start_date="2020-01-01",
    end_date="2024-01-01",
    max_position_size=0.15,
    transaction_cost_rate=0.001
)
```

**Key Metrics**:
- Total Return
- Annual Return
- Volatility
- Sharpe Ratio
- Max Drawdown
- Win Rate
- Profit Factor
- Alpha/Beta vs Benchmark

### 2. Currency Pairs Agent

**File**: `src/training/currency_pairs_trainer.py`

**Features**:
- 10 major currency pairs (EUR/USD, GBP/USD, etc.)
- 14-day lookback window
- Forex-specific volatility modeling
- Currency correlation structure

**Configuration**:
```python
config = CurrencyPairsConfig(
    currency_pairs=get_currency_pairs_by_category("Major_Pairs")[:10],
    start_date="2020-01-01",
    end_date="2024-01-01",
    max_position_size=0.20,
    transaction_cost_rate=0.0001
)
```

**Key Metrics**:
- All standard metrics
- Sortino Ratio (better for forex)
- VaR/CVaR (95%)
- Calmar Ratio
- Recovery Factor
- Stability Score

### 3. Cryptocurrency Agent

**File**: `src/training/cryptocurrency_trainer.py`

**Features**:
- 12 major cryptocurrencies (BTC, ETH, etc.)
- 14-day lookback window
- High volatility modeling
- Crypto market regime simulation

**Configuration**:
```python
config = CryptocurrencyConfig(
    symbols=get_major_cryptocurrencies()[:12],
    start_date="2020-01-01",
    end_date="2024-01-01",
    max_position_size=0.10,  # Lower due to high volatility
    max_portfolio_risk=0.20  # Higher risk tolerance
)
```

**Key Metrics**:
- All standard metrics
- Sortino Ratio
- VaR/CVaR (95%)
- Volatility Regime Classification
- Risk Level Assessment

### 4. ETF Agent

**File**: `src/training/etf_trainer.py`

**Features**:
- 20 major ETFs (SPY, QQQ, etc.)
- 20-day lookback window
- Lower volatility modeling
- Sector-based correlation

**Configuration**:
```python
config = ETFConfig(
    symbols=["SPY", "QQQ", "IWM", "VTI", "VEA", "VWO", ...],
    start_date="2020-01-01",
    end_date="2024-01-01",
    max_position_size=0.12,
    transaction_cost_rate=0.0005
)
```

**Key Metrics**:
- All standard metrics
- Tracking Error
- Information Ratio
- Stability Score
- Diversification Score

## Evaluation Metrics

### Performance Metrics
- **Total Return**: Cumulative portfolio return
- **Annual Return**: Annualized return
- **Volatility**: Annualized volatility
- **Sharpe Ratio**: Risk-adjusted return
- **Sortino Ratio**: Downside risk-adjusted return
- **Calmar Ratio**: Return vs max drawdown

### Risk Metrics
- **Max Drawdown**: Largest peak-to-trough decline
- **VaR (95%)**: Value at Risk
- **CVaR (95%)**: Conditional Value at Risk
- **Volatility Regime**: High/Medium/Low classification

### Trading Metrics
- **Win Rate**: Percentage of profitable periods
- **Profit Factor**: Gross profit / Gross loss
- **Recovery Factor**: Net profit / Max drawdown
- **Stability**: Return consistency measure
- **Turnover**: Portfolio turnover rate

### Benchmark Comparison
- **Excess Return**: Return above benchmark
- **Alpha**: Risk-adjusted excess return
- **Beta**: Market correlation coefficient
- **Information Ratio**: Excess return / Tracking error
- **Tracking Error**: Volatility of excess returns

## Results Structure

Each trainer saves results to its respective directory:

```
results/
├── asx_stocks/
│   ├── evaluation_report.json
│   ├── detailed_metrics.json
│   └── agent_config.yaml
├── currency_pairs/
│   ├── evaluation_report.json
│   ├── detailed_metrics.json
│   └── agent_config.yaml
├── cryptocurrencies/
│   ├── evaluation_report.json
│   ├── detailed_metrics.json
│   └── agent_config.yaml
├── etf/
│   ├── evaluation_report.json
│   ├── detailed_metrics.json
│   └── agent_config.yaml
└── master_comparison/
    ├── comparison_report.json
    ├── master_summary.json
    └── [individual agent results]
```

## Customization

### Modifying Agent Configuration

You can customize each agent by modifying the configuration:

```python
# Example: Custom ASX Stocks configuration
config = ASXStocksConfig(
    symbols=["ANZ", "BHP", "CBA", "CSL", "WBC"],  # Custom symbols
    start_date="2021-01-01",  # Custom date range
    end_date="2023-12-31",
    lookback_window=20,  # Custom lookback
    max_position_size=0.20,  # Custom position limits
    transaction_cost_rate=0.002  # Custom costs
)
```

### Adding New Asset Types

To add a new asset type:

1. Create a new trainer class following the existing pattern
2. Add the asset type to `specialized_agent_factory.py`
3. Update the master trainer to include the new agent
4. Add the new agent to the interactive menu

## Performance Expectations

### Typical Performance Ranges

| Agent Type | Annual Return | Sharpe Ratio | Max Drawdown | Win Rate |
|------------|---------------|--------------|--------------|----------|
| ASX Stocks | 8-15% | 0.8-1.5 | 10-20% | 45-60% |
| Currency Pairs | 5-12% | 0.6-1.2 | 8-15% | 40-55% |
| Cryptocurrency | 15-30% | 0.5-1.0 | 20-40% | 35-50% |
| ETF | 6-12% | 1.0-1.8 | 8-15% | 50-65% |

*Note: These are simulated results and actual performance may vary.*

## Troubleshooting

### Common Issues

1. **Import Errors**: Make sure you're running from the correct directory
2. **Data Generation**: Synthetic data is generated automatically
3. **Memory Issues**: Reduce the number of assets or training period
4. **Performance**: Results are simulated for demonstration purposes

### Getting Help

- Check the logs for detailed error messages
- Verify your Python environment has all required packages
- Ensure you're using the correct Python version (3.8+)

## Next Steps

1. **Real Data Integration**: Replace synthetic data with real market data
2. **Actual RL Training**: Implement real reinforcement learning algorithms
3. **Live Trading**: Connect to live trading APIs
4. **Advanced Metrics**: Add more sophisticated evaluation metrics
5. **Portfolio Optimization**: Implement advanced portfolio management

---

*For more information, see the main WealthArena documentation.*
