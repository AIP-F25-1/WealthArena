# WealthArena Technical Architecture

## System Overview

The WealthArena multi-agent trading system is built on a modular architecture that separates concerns between data processing, environment simulation, agent training, and deployment. The system leverages RLlib for distributed reinforcement learning and integrates with external data sources and risk management systems.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        WealthArena Trading System                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Agent 1   │  │   Agent 2   │  │   Agent 3   │  │   Agent N   │  │
│  │ (Conservative│  │ (Aggressive │  │ (Balanced   │  │ (Custom     │  │
│  │  Trader)    │  │  Trader)    │  │  Trader)    │  │  Strategy)  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│         │                │                │                │         │
│         └────────────────┼────────────────┼────────────────┘         │
│                          │                │                          │
│  ┌───────────────────────┴────────────────┴───────────────────────┐  │
│  │              Multi-Agent Trading Environment                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │   Market    │  │  Portfolio  │  │    Risk     │            │  │
│  │  │  Simulator  │  │  Manager    │  │  Manager    │            │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────┴───────────────────────────────────────┐  │
│  │                    Data Layer                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │   SYS1 API  │  │  Technical  │  │   Market    │            │  │
│  │  │  Adapter    │  │  Indicators │  │   Data      │            │  │
│  │  │             │  │  Calculator │  │   Cache     │            │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────┴───────────────────────────────────────┐  │
│  │                RLlib Training Framework                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │     PPO     │  │     A2C     │  │   Custom    │            │  │
│  │  │  Algorithm  │  │  Algorithm  │  │  Algorithms │            │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│  ┌───────────────────────┴───────────────────────────────────────┐  │
│  │              Experiment Tracking & Monitoring                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │   MLflow    │  │     W&B     │  │   Ray       │            │  │
│  │  │  Tracking   │  │  Tracking   │  │  Dashboard  │            │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Multi-Agent Trading Environment

The core environment manages multiple trading agents operating in a shared market environment.

#### Key Features:
- **Gymnasium Compatibility**: Standard RL environment interface
- **Multi-Agent Support**: Multiple agents with different strategies
- **Real-time Market Simulation**: Dynamic price updates and market conditions
- **Portfolio Management**: Position tracking and value calculation
- **Risk Management**: Built-in risk constraints and monitoring

#### Implementation:
```python
class WealthArenaMultiAgentEnv(MultiAgentEnv):
    def __init__(self, config: Dict[str, Any]):
        super().__init__()
        self.config = config
        self.num_agents = config.get("num_agents", 3)
        self.agent_ids = [f"trader_{i}" for i in range(self.num_agents)]
        
        # Initialize components
        self.market_simulator = MarketSimulator(config.get("market_config", {}))
        self.portfolio_manager = PortfolioManager(config.get("portfolio_config", {}))
        self.risk_manager = RiskManager(config.get("risk_config", {}))
        
        self._setup_spaces()
        self.reset()
```

### 2. Market Simulator

Simulates market dynamics and provides real-time price data.

#### Key Features:
- **OHLCV Data Generation**: Realistic price movements
- **Technical Indicators**: RSI, MACD, Bollinger Bands, etc.
- **Market Microstructure**: Bid-ask spreads, volume dynamics
- **Correlation Modeling**: Asset correlation and co-movement

#### Implementation:
```python
class MarketSimulator:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.num_assets = config.get("num_assets", 10)
        self.volatility = config.get("volatility", 0.02)
        self.correlation = config.get("correlation", 0.1)
        
        # Initialize market state
        self.reset()
    
    def step(self):
        """Update market prices and indicators"""
        # Generate correlated returns
        returns = self._generate_correlated_returns()
        
        # Update prices
        self.prices *= (1 + returns)
        
        # Update technical indicators
        self._update_technical_indicators()
        
        # Update market microstructure
        self._update_market_microstructure()
```

### 3. Portfolio Manager

Manages individual agent portfolios and executes trades.

#### Key Features:
- **Position Tracking**: Real-time position and cash balance
- **Trade Execution**: Buy/sell order processing
- **Portfolio Valuation**: Real-time portfolio value calculation
- **Transaction Cost Modeling**: Realistic trading costs

#### Implementation:
```python
class PortfolioManager:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.initial_cash = config.get("initial_cash", 100000)
        self.transaction_cost = config.get("transaction_cost", 0.001)
        
        # Initialize agent portfolios
        self.agent_portfolios = {}
    
    def execute_trade(self, agent_id: str, asset_idx: int, action: float):
        """Execute a trade for an agent"""
        portfolio = self.agent_portfolios[agent_id]
        current_price = self.market_simulator.get_price(asset_idx)
        
        if action > 0:  # Buy
            self._execute_buy(portfolio, asset_idx, action, current_price)
        elif action < 0:  # Sell
            self._execute_sell(portfolio, asset_idx, abs(action), current_price)
```

### 4. Risk Manager

Implements risk management and position limits.

#### Key Features:
- **Position Limits**: Maximum position sizes per asset
- **Risk Metrics**: VaR, CVaR, maximum drawdown
- **Portfolio Constraints**: Diversification requirements
- **Real-time Monitoring**: Continuous risk assessment

#### Implementation:
```python
class RiskManager:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.max_position_size = config.get("max_position_size", 0.2)
        self.max_portfolio_risk = config.get("max_portfolio_risk", 0.15)
        self.var_confidence = config.get("var_confidence", 0.95)
    
    def validate_trade(self, agent_id: str, asset_idx: int, action: float) -> bool:
        """Validate if trade meets risk constraints"""
        portfolio = self.portfolio_manager.get_portfolio(agent_id)
        
        # Check position limits
        if not self._check_position_limits(portfolio, asset_idx, action):
            return False
        
        # Check portfolio risk
        if not self._check_portfolio_risk(portfolio, asset_idx, action):
            return False
        
        return True
```

### 5. Data Adapter

Integrates with external data sources and provides data processing capabilities.

#### Key Features:
- **SYS1 API Integration**: Real-time market data
- **Data Caching**: Efficient data storage and retrieval
- **Technical Analysis**: Indicator calculation
- **Data Validation**: Quality checks and error handling

#### Implementation:
```python
class DataAdapter:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.api_client = SYS1APIClient(config.get("api_config", {}))
        self.cache = DataCache(config.get("cache_config", {}))
        self.technical_calculator = TechnicalCalculator()
    
    async def get_ohlcv_data(self, symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
        """Fetch OHLCV data from SYS1 API"""
        # Check cache first
        cached_data = self.cache.get(symbol, start_date, end_date)
        if cached_data is not None:
            return cached_data
        
        # Fetch from API
        data = await self.api_client.get_ohlcv(symbol, start_date, end_date)
        
        # Calculate technical indicators
        data = self.technical_calculator.add_indicators(data)
        
        # Cache the data
        self.cache.store(symbol, start_date, end_date, data)
        
        return data
```

## Training Architecture

### RLlib Integration

The system uses RLlib for distributed reinforcement learning with the following components:

#### 1. Algorithm Configuration
```python
training_config = {
    "env": WealthArenaMultiAgentEnv,
    "env_config": environment_config,
    
    # Multi-agent configuration
    "multiagent": {
        "policies": {
            "conservative_trader": (None, obs_space, action_space, {"model": {"custom_model": "conservative_lstm"}}),
            "aggressive_trader": (None, obs_space, action_space, {"model": {"custom_model": "aggressive_lstm"}}),
            "balanced_trader": (None, obs_space, action_space, {"model": {"custom_model": "balanced_lstm"}})
        },
        "policy_mapping_fn": lambda agent_id, episode, worker, **kwargs: f"{agent_id.split('_')[1]}_trader",
        "policies_to_train": ["conservative_trader", "aggressive_trader", "balanced_trader"]
    },
    
    # PPO configuration
    "lr": 3e-4,
    "gamma": 0.99,
    "lambda": 0.95,
    "entropy_coeff": 0.01,
    "vf_loss_coeff": 0.5,
    "clip_param": 0.2,
    
    # Resource configuration
    "num_workers": 4,
    "num_envs_per_worker": 2,
    "num_cpus_per_worker": 1,
    "num_gpus": 0.5,
    
    # Framework
    "framework": "torch"
}
```

#### 2. Custom Models
```python
class TradingLSTMModel(TorchModelV2, nn.Module):
    def __init__(self, obs_space, action_space, num_outputs, model_config, name):
        super().__init__(obs_space, action_space, num_outputs, model_config, name)
        
        # LSTM for temporal patterns
        self.lstm = nn.LSTM(
            input_size=obs_space.shape[0],
            hidden_size=model_config.get("hidden_size", 128),
            num_layers=model_config.get("num_layers", 2),
            batch_first=True
        )
        
        # Actor network
        self.actor = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, action_space.shape[0])
        )
        
        # Critic network
        self.critic = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )
```

### Experiment Tracking

#### MLflow Integration
```python
class MLflowTracker:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.client = mlflow.tracking.MlflowClient()
        self.experiment = self._setup_experiment()
    
    def log_metrics(self, metrics: Dict[str, float], step: int):
        """Log training metrics to MLflow"""
        with mlflow.start_run(run_id=self.current_run_id):
            for key, value in metrics.items():
                mlflow.log_metric(key, value, step=step)
    
    def log_artifacts(self, artifacts: Dict[str, str]):
        """Log artifacts to MLflow"""
        with mlflow.start_run(run_id=self.current_run_id):
            for name, path in artifacts.items():
                mlflow.log_artifact(path, name)
```

#### Weights & Biases Integration
```python
class WandbTracker:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        wandb.init(
            project=config.get("project", "wealtharena-trading"),
            entity=config.get("entity", None),
            config=config
        )
    
    def log_metrics(self, metrics: Dict[str, float], step: int):
        """Log training metrics to W&B"""
        wandb.log(metrics, step=step)
    
    def log_artifacts(self, artifacts: Dict[str, str]):
        """Log artifacts to W&B"""
        for name, path in artifacts.items():
            wandb.log_artifact(path, name=name)
```

## Deployment Architecture

### Docker Containerization

```dockerfile
FROM rayproject/ray:2.8.0-py310

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy source code
COPY src/ /app/src/
COPY config/ /app/config/
COPY scripts/ /app/scripts/

# Set working directory
WORKDIR /app

# Expose ports
EXPOSE 8265 10001

# Start Ray head node
CMD ["ray", "start", "--head", "--dashboard-host=0.0.0.0", "--dashboard-port=8265"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wealtharena-training
spec:
  replicas: 1
  selector:
    matchLabels:
      app: wealtharena-training
  template:
    metadata:
      labels:
        app: wealtharena-training
    spec:
      containers:
      - name: wealtharena-training
        image: wealtharena/rllib:latest
        ports:
        - containerPort: 8265
        - containerPort: 10001
        env:
        - name: RAY_DISABLE_IMPORT_WARNING
          value: "1"
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
```

## Performance Optimization

### 1. Data Processing
- **Vectorized Operations**: NumPy and Pandas for efficient data processing
- **Caching**: Redis for frequently accessed data
- **Batch Processing**: Process multiple assets simultaneously

### 2. Training Optimization
- **Distributed Training**: Ray for parallel agent training
- **GPU Acceleration**: CUDA support for neural network training
- **Memory Management**: Efficient memory usage for large datasets

### 3. Environment Optimization
- **JIT Compilation**: Numba for numerical computations
- **Parallel Environments**: Multiple environment instances
- **Efficient State Management**: Minimal state copying and updates

## Security Considerations

### 1. API Security
- **Authentication**: API key management for SYS1 integration
- **Rate Limiting**: Prevent API abuse
- **Data Encryption**: Secure data transmission

### 2. Model Security
- **Model Validation**: Ensure model integrity
- **Access Control**: Restrict model access
- **Audit Logging**: Track all model operations

### 3. Data Security
- **Data Encryption**: Encrypt sensitive data
- **Access Logging**: Track data access
- **Backup Security**: Secure backup storage

## Monitoring and Alerting

### 1. System Monitoring
- **Resource Usage**: CPU, memory, disk usage
- **Performance Metrics**: Training speed, convergence
- **Error Tracking**: Exception monitoring and alerting

### 2. Trading Monitoring
- **Portfolio Performance**: Real-time portfolio tracking
- **Risk Metrics**: Continuous risk monitoring
- **Anomaly Detection**: Unusual trading pattern detection

### 3. Alerting System
- **Threshold Alerts**: Performance and risk alerts
- **Email Notifications**: Critical event notifications
- **Dashboard Integration**: Real-time monitoring dashboard

This architecture provides a robust, scalable foundation for the WealthArena multi-agent trading system while maintaining flexibility for future enhancements and integrations.
