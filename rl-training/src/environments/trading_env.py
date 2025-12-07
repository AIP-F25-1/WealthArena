"""
Gym-compatible trading environments.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd

try:
    import gymnasium as gym
except ImportError:  # pragma: no cover - fallback path
    import gym  # type: ignore


logger = logging.getLogger(__name__)


def _ensure_dataframe(data: Any) -> pd.DataFrame:
    if isinstance(data, pd.DataFrame):
        return data
    raise TypeError("TradingEnv expects a pandas DataFrame as data input.")


class TradingEnv(gym.Env):
    """Base class for single-asset trading environments."""

    metadata = {"render_modes": ["human"]}

    def __init__(self, data: Any, config: Dict[str, Any]):
        super().__init__()
        self.data = _ensure_dataframe(data)
        self.config = config
        self.window_size = int(config.get("window_size", 32))
        self.initial_cash = float(config.get("initial_cash", 1_000_000.0))
        self.transaction_cost = float(config.get("transaction_cost", 0.0005))
        self.reward_scaling = float(config.get("reward_scaling", 1.0))

        price_column = config.get("price_column", "close")
        if price_column not in self.data.columns:
            raise ValueError(f"Price column '{price_column}' not present in data.")
        self.price_column = price_column

        obs_shape = (self.window_size * len(self.data.columns) + 2,)
        self.observation_space = config.get("observation_space") or gym.spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=obs_shape,
            dtype=np.float32,
        )
        self.action_space = config.get("action_space") or gym.spaces.Box(
            low=-1.0,
            high=1.0,
            shape=(1,),
            dtype=np.float32,
        )

        self.current_step = self.window_size
        self.position = 0.0
        self.cash = self.initial_cash
        self.portfolio_value = self.initial_cash
        self.last_price = float(self.data.iloc[self.current_step - 1][self.price_column])
        self.trade_history: list[Dict[str, Any]] = []

    def reset(self, *, seed: int | None = None, options: Dict[str, Any] | None = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)
        self.current_step = self.window_size
        self.position = 0.0
        self.cash = self.initial_cash
        self.portfolio_value = self.initial_cash
        self.last_price = float(self.data.iloc[self.current_step - 1][self.price_column])
        self.trade_history.clear()
        observation = self._get_observation()
        return observation, {}

    def step(self, action: Any) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """Execute a trading action.

        Parameters
        ----------
        action : Any
            Desired position expressed in the environment's action space.

        Returns
        -------
        numpy.ndarray
            Next observation window containing normalized features with position context.
        float
            Reward equal to the change in portfolio value scaled by ``reward_scaling``.
        bool
            ``True`` when the episode should terminate because data is exhausted.
        bool
            ``True`` when the episode is truncated (always ``False`` in this implementation).
        Dict[str, Any]
            Diagnostics including ``portfolio_value``, ``price_change``, and ``trade_cost``.
        """
        action = float(np.clip(action, self.action_space.low, self.action_space.high)[0])
        current_price = float(self.data.iloc[self.current_step][self.price_column])
        target_position = action * self.config.get("max_position", 1.0)
        prior_position = self.position
        prev_value = self.portfolio_value

        # Realize PnL from previous position
        price_change = current_price - self.last_price
        self.cash += prior_position * price_change

        # Execute trade to reach target position
        trade_change = target_position - prior_position
        cost = abs(trade_change) * current_price * self.transaction_cost
        self.cash -= trade_change * current_price + cost
        self.position = target_position

        # Update portfolio value and compute reward
        self.portfolio_value = self.cash + self.position * current_price
        reward = self.reward_scaling * (self.portfolio_value - prev_value)

        self.trade_history.append(
            {
                "step": self.current_step,
                "action": action,
                "position": self.position,
                "price": current_price,
                "cost": cost,
                "reward": reward,
            }
        )

        self.current_step += 1
        terminated = self.current_step >= len(self.data) - 1
        truncated = False
        self.last_price = current_price
        observation = self._get_observation()
        info = {
            "portfolio_value": self.portfolio_value,
            "price_change": price_change,
            "trade_cost": cost,
        }
        return observation, float(reward), terminated, truncated, info

    def render(self) -> None:
        logger.debug(
            "Step %d | Position %.4f | Cash %.2f | Portfolio %.2f",
            self.current_step,
            self.position,
            self.cash,
            self.portfolio_value,
        )

    def close(self) -> None:
        self.trade_history.clear()

    def _get_observation(self) -> np.ndarray:
        start = self.current_step - self.window_size
        window = self.data.iloc[start:self.current_step]
        normalized = window.pct_change().dropna().replace([np.inf, -np.inf], 0.0).fillna(0.0)
        flattened = normalized.to_numpy(dtype=np.float32).flatten()
        padding = self.window_size * len(self.data.columns) - flattened.shape[0]
        if padding > 0:
            flattened = np.pad(flattened, (padding, 0))
        observation = np.concatenate(
            [
                flattened,
                np.array([self.position, self.portfolio_value], dtype=np.float32),
            ]
        )
        return observation.astype(np.float32)


class StockTradingEnv(TradingEnv):
    """Stock-specific trading environment."""

    pass


class ForexTradingEnv(TradingEnv):
    """Forex-specific trading environment."""

    pass


class CryptoTradingEnv(TradingEnv):
    """Crypto-specific trading environment."""

    pass


class ETFTradingEnv(TradingEnv):
    """ETF-specific trading environment."""

    pass


class CommodityTradingEnv(TradingEnv):
    """Commodity-specific trading environment."""

    pass


class OptionsTradingEnv(TradingEnv):
    """Options-specific trading environment handling greeks and time decay."""

    pass


class VectorizedTradingEnv:
    """Wrapper for vectorized execution using Stable-Baselines3 utilities."""

    def __init__(self, env_fns: Any):
        self.env_fns = env_fns

    def reset(self) -> Any:
        return [env.reset() for env in self.env_fns]

    def step(self, actions: Any) -> Any:
        return [env.step(action) for env, action in zip(self.env_fns, actions)]

    def close(self) -> None:
        for env in self.env_fns:
            env.close()


class StockTradingEnv(TradingEnv):
    """Stock-specific trading environment."""

    pass


class ForexTradingEnv(TradingEnv):
    """Forex-specific trading environment."""

    pass


class CryptoTradingEnv(TradingEnv):
    """Crypto-specific trading environment."""

    pass


class ETFTradingEnv(TradingEnv):
    """ETF-specific trading environment."""

    pass


class CommodityTradingEnv(TradingEnv):
    """Commodity-specific trading environment."""

    pass


class OptionsTradingEnv(TradingEnv):
    """Options-specific trading environment handling greeks and time decay."""

    pass


class VectorizedTradingEnv:
    """Wrapper for vectorized execution using Stable-Baselines3 utilities."""

    def __init__(self, env_fns: Any):
        self.env_fns = env_fns

    def reset(self) -> Any:
        return [env.reset() for env in self.env_fns]

    def step(self, actions: Any) -> Any:
        return [env.step(action) for env, action in zip(self.env_fns, actions)]

    def close(self) -> None:
        for env in self.env_fns:
            env.close()
