# WealthArena RL Agent API Specification

## Overview

This document specifies the RL agent API for WealthArena's multi-agent reinforcement learning trading system, including observation spaces, action spaces, reward functions, and coordination mechanisms.

## RL Agent Interface

### Base RL Agent

```python
class BaseRLAgent:
    def __init__(self, config: RLAgentConfig, instrument_type: str)
    def train(self, training_data: pd.DataFrame, num_iterations: int) -> Dict[str, Any]
    def predict(self, obs: np.ndarray) -> np.ndarray
    def evaluate(self, test_data: pd.DataFrame, num_episodes: int) -> Dict[str, Any]
    def save_agent(self, model_path: str)
    def load_agent(self, model_path: str)
```

### RL Agent Configuration

```python
@dataclass
class RLAgentConfig:
    algorithm: str  # "PPO", "SAC", "A2C", "DQN"
    observation_space: int
    action_space: int
    hidden_layers: List[int] = None
    learning_rate: float = 3e-4
    gamma: float = 0.99
    tau: float = 0.005
    batch_size: int = 64
    buffer_size: int = 100000
    exploration_fraction: float = 0.1
    exploration_final_eps: float = 0.02
    target_update_interval: int = 1000
    train_freq: int = 4
    gradient_steps: int = 1
    learning_starts: int = 1000
    policy_kwargs: Dict[str, Any] = None
```

## Observation Spaces

### Individual Agent Observation Space

Each RL agent receives a comprehensive observation vector:

```python
observation_space = spaces.Box(
    low=-np.inf, high=np.inf,
    shape=(obs_dim,), dtype=np.float32
)
```

**Observation Components:**
1. **Market Features** (50 dimensions): OHLCV data, technical indicators
2. **Portfolio State** (5 dimensions): Position weights for each instrument type
3. **Risk Metrics** (3 dimensions): Volatility, position count, value ratio
4. **Coordination Info** (4 dimensions): Market regime, volatility regime
5. **Time Step** (1 dimension): Normalized time step

**Total Observation Dimension**: 63

### Multi-Agent Environment Observation Space

The multi-agent environment provides additional coordination information:

```python
obs_dim = (
    observation_space_size +  # Market features
    len(instrument_types) +   # Portfolio weights
    3 +                       # Cash ratio, portfolio value ratio, risk metrics
    len(instrument_types) +   # Coordination info
    1                         # Time step
)
```

## Action Spaces

### Discrete Action Space (PPO, A2C, DQN)

```python
action_space = spaces.Box(
    low=-1.0, high=1.0,
    shape=(3,), dtype=np.float32
)
```

**Actions:**
- `action[0]`: Buy signal strength (-1.0 to 1.0)
- `action[1]`: Sell signal strength (-1.0 to 1.0)  
- `action[2]`: Hold signal strength (-1.0 to 1.0)

### Continuous Action Space (SAC)

```python
action_space = spaces.Box(
    low=-1.0, high=1.0,
    shape=(action_dim,), dtype=np.float32
)
```

**Actions:**
- `action[i]`: Position size for instrument i (-1.0 to 1.0)

## Reward Functions

### Individual Agent Rewards

```python
def calculate_reward(self, obs: np.ndarray, action: np.ndarray, next_obs: np.ndarray) -> float:
    # 1. Profit-based reward
    price_change = (next_obs[3] - obs[3]) / obs[3]  # Close price change
    profit_reward = action[0] * price_change  # Buy action * price change
    
    # 2. Risk penalty
    risk_penalty = self._calculate_risk_penalty(obs, action)
    
    # 3. Transaction cost penalty
    transaction_cost = abs(action[0]) * self.transaction_cost_rate
    
    # Total reward
    total_reward = profit_reward - risk_penalty - transaction_cost
    return total_reward
```

### Multi-Agent Coordination Rewards

```python
def calculate_coordination_reward(self, action_dict: Dict[str, np.ndarray]) -> float:
    # 1. Market impact reduction
    total_action = np.sum(list(action_dict.values()), axis=0)
    market_impact = np.linalg.norm(total_action) / len(action_dict)
    impact_bonus = max(0, 0.1 - market_impact) * 0.5
    
    # 2. Diversification bonus
    action_vectors = np.array(list(action_dict.values()))
    correlation_matrix = np.corrcoef(action_vectors)
    avg_correlation = np.mean(correlation_matrix[np.triu_indices_from(correlation_matrix, k=1)])
    diversification = 1.0 - avg_correlation
    div_bonus = diversification * self.diversification_bonus
    
    return impact_bonus + div_bonus
```

## RL Algorithms

### 1. PPO (Proximal Policy Optimization)

**Configuration:**
```python
ppo_config = {
    "algorithm": "PPO",
    "clip_param": 0.2,
    "entropy_coeff": 0.01,
    "vf_loss_coeff": 0.5,
    "num_sgd_iter": 4,
    "sgd_minibatch_size": 64,
    "learning_rate": 3e-4,
    "gamma": 0.99
}
```

**Use Case**: Stock and REIT agents (discrete actions)

### 2. SAC (Soft Actor-Critic)

**Configuration:**
```python
sac_config = {
    "algorithm": "SAC",
    "tau": 0.005,
    "target_network_update_freq": 1000,
    "replay_buffer_config": {"capacity": 100000},
    "learning_rate": 3e-4,
    "gamma": 0.99
}
```

**Use Case**: Crypto agent (continuous actions)

### 3. A2C (Advantage Actor-Critic)

**Configuration:**
```python
a2c_config = {
    "algorithm": "A2C",
    "vf_loss_coeff": 0.5,
    "entropy_coeff": 0.01,
    "learning_rate": 3e-4,
    "gamma": 0.99
}
```

**Use Case**: ETF agent (discrete actions)

### 4. DQN (Deep Q-Network)

**Configuration:**
```python
dqn_config = {
    "algorithm": "DQN",
    "exploration_config": {
        "type": "EpsilonGreedy",
        "initial_epsilon": 1.0,
        "final_epsilon": 0.02,
        "epsilon_timesteps": 10000
    },
    "target_network_update_freq": 1000,
    "replay_buffer_config": {"capacity": 100000},
    "learning_rate": 3e-4,
    "gamma": 0.99
}
```

**Use Case**: Currency agent (discrete actions)

## Multi-Agent RL Environment

### Environment Interface

```python
class WealthArenaMultiAgentRLEnv(MultiAgentEnv):
    def __init__(self, config: MultiAgentRLConfig)
    def reset(self, *, seed: Optional[int] = None, options: Optional[Dict] = None) -> Tuple[Dict[str, np.ndarray], Dict[str, Dict]]
    def step(self, action_dict: Dict[str, np.ndarray]) -> Tuple[Dict[str, np.ndarray], Dict[str, float], Dict[str, bool], Dict[str, bool], Dict[str, Dict]]
    def render(self, mode: str = 'human') -> Optional[np.ndarray]
    def close(self)
```

### Environment Configuration

```python
@dataclass
class MultiAgentRLConfig:
    instrument_types: List[str]
    observation_space_size: int
    action_space_size: int
    max_episode_steps: int
    initial_cash: float
    transaction_cost: float
    risk_free_rate: float
    coordination_method: str  # "hierarchical", "decentralized", "centralized"
    reward_shaping: bool = True
    risk_penalty: float = 0.1
    diversification_bonus: float = 0.05
```

## RL Meta Agent

### Meta Agent Interface

```python
class RLMetaAgent:
    def __init__(self, config: RLMetaAgentConfig)
    def add_instrument_agent(self, instrument_type: str, agent: BaseRLAgent)
    def train_meta_agent(self, training_data: Dict[str, pd.DataFrame]) -> Dict[str, Any]
    def generate_signals(self, market_data: Dict[str, pd.DataFrame]) -> Dict[str, Any]
    def evaluate_meta_agent(self, test_data: Dict[str, pd.DataFrame]) -> Dict[str, Any]
    def save_meta_agent(self, model_path: str)
    def load_meta_agent(self, model_path: str)
```

### Meta Agent Configuration

```python
@dataclass
class RLMetaAgentConfig:
    coordination_method: str  # "hierarchical", "decentralized", "centralized"
    fusion_method: str  # "weighted", "voting", "neural"
    agent_weights: Dict[str, float]
    confidence_threshold: float
    risk_tolerance: float
    max_position_size: float
    rebalance_frequency: int
    lookback_window: int
    prediction_horizon: int
    high_level_algorithm: str = "PPO"
    low_level_algorithm: str = "PPO"
```

## Signal Fusion Methods

### 1. Weighted Fusion

```python
def _weighted_fusion(self, agent_signals: Dict[str, np.ndarray]) -> np.ndarray:
    adaptive_weights = self._calculate_adaptive_weights()
    fused_signal = np.zeros_like(list(agent_signals.values())[0])
    
    for agent_name, signal in agent_signals.items():
        if agent_name in adaptive_weights:
            fused_signal += signal * adaptive_weights[agent_name]
    
    return fused_signal
```

### 2. Voting Fusion

```python
def _voting_fusion(self, agent_signals: Dict[str, np.ndarray]) -> np.ndarray:
    votes = []
    for signal in agent_signals.values():
        vote = np.argmax(signal) if len(signal) > 1 else (1 if signal[0] > 0 else -1)
        votes.append(vote)
    
    if votes:
        majority_vote = np.bincount(votes).argmax()
        return np.array([majority_vote])
    else:
        return np.array([0])
```

### 3. Neural Fusion

```python
def _neural_fusion(self, agent_signals: Dict[str, np.ndarray], agent_states: Dict[str, np.ndarray]) -> np.ndarray:
    combined_features = []
    for agent_name in agent_signals.keys():
        if agent_name in agent_signals and agent_name in agent_states:
            signal = agent_signals[agent_name]
            state = agent_states[agent_name]
            combined_features.extend(signal)
            combined_features.extend(state)
    
    if combined_features:
        features = np.array(combined_features)
        return np.tanh(features.mean())
    else:
        return np.array([0])
```

## Training Pipeline

### 1. Individual Agent Training

```python
# Create and train individual agents
for instrument_type in ["stocks", "crypto", "etf", "currencies", "reits"]:
    agent = RLAgentFactory.create_agent(instrument_type)
    results = agent.train(training_data[instrument_type], num_iterations=1000)
    agent.save_agent(f"models/{instrument_type}")
```

### 2. Multi-Agent Environment Training

```python
# Train agents in multi-agent environment
env = WealthArenaMultiAgentRLEnv(config)
for episode in range(1000):
    obs, info = env.reset()
    done = False
    
    while not done:
        actions = {}
        for agent_id in env.agent_ids:
            actions[agent_id] = env.action_space.sample()  # Replace with agent.predict()
        
        obs, rewards, terminateds, truncateds, infos = env.step(actions)
        done = terminateds["__all__"] or truncateds["__all__"]
```

### 3. Meta Agent Training

```python
# Train hierarchical meta agent
meta_agent = RLMetaAgent(config)

# Add individual agents
for instrument_type, agent in instrument_agents.items():
    meta_agent.add_instrument_agent(instrument_type, agent)

# Train meta agent
results = meta_agent.train_meta_agent(training_data)
meta_agent.save_meta_agent("models/meta_agent")
```

## Performance Metrics

### RL Training Metrics

```python
training_metrics = {
    "final_reward": float,           # Final episode reward
    "final_length": float,           # Final episode length
    "training_iterations": int,      # Number of training iterations
    "convergence": bool              # Whether training converged
}
```

### Evaluation Metrics

```python
evaluation_metrics = {
    "mean_reward": float,            # Mean reward across episodes
    "std_reward": float,             # Standard deviation of rewards
    "mean_length": float,            # Mean episode length
    "num_episodes": int              # Number of evaluation episodes
}
```

### Trading Performance Metrics

```python
trading_metrics = {
    "sharpe_ratio": float,           # Risk-adjusted returns
    "max_drawdown": float,           # Maximum drawdown
    "win_rate": float,               # Percentage of profitable trades
    "average_return": float,         # Mean return per trade
    "volatility": float,             # Portfolio volatility
    "calmar_ratio": float            # Return/max drawdown ratio
}
```

## Error Handling

### Common Exceptions

```python
class RLAgentError(Exception):
    """Base exception for RL agent errors"""
    pass

class TrainingError(RLAgentError):
    """Error during agent training"""
    pass

class PredictionError(RLAgentError):
    """Error during agent prediction"""
    pass

class ModelNotFoundError(RLAgentError):
    """Error when model file not found"""
    pass
```

### Error Handling Examples

```python
try:
    agent = RLAgentFactory.create_agent("stocks")
    results = agent.train(training_data, num_iterations=1000)
except TrainingError as e:
    logger.error(f"Training failed: {e}")
    # Handle training error
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    # Handle unexpected error
```

This API specification provides a comprehensive guide for using WealthArena's RL trading system with proper error handling and performance monitoring.
