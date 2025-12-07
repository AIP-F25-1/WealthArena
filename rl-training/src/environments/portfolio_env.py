"""
Portfolio-level environment for SAC meta-controller.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd

try:
    import gymnasium as gym
except ImportError:  # pragma: no cover - fallback
    import gym  # type: ignore


logger = logging.getLogger(__name__)


def _ensure_dataframe(data: Any) -> pd.DataFrame:
    if isinstance(data, pd.DataFrame):
        return data
    raise TypeError("PortfolioEnv expects a pandas DataFrame with asset returns.")


class PortfolioEnv(gym.Env):
    """Meta-environment aggregating signals from asset agents."""

    metadata = {"render_modes": ["human"]}

    def __init__(self, data: Any, config: Dict[str, Any]):
        super().__init__()
        self.data = _ensure_dataframe(data)
        self.config = config

        self.window_size = int(config.get("window_size", 63))
        self.initial_capital = float(config.get("initial_capital", 1_000_000.0))
        self.transaction_cost = float(config.get("transaction_cost", 0.0005))
        self.turnover_penalty = float(config.get("turnover_penalty", 0.0))
        self.risk_penalty = float(config.get("risk_penalty", 0.0))
        self.leverage_limit = float(config.get("leverage_limit", 1.0))
        self.allow_short = bool(config.get("allow_short", False))

        self.num_assets = len(self.data.columns)
        if self.window_size >= len(self.data):
            raise ValueError("window_size must be smaller than the number of rows in data.")

        obs_dim = self.window_size * self.num_assets + self.num_assets + 1
        low = -1.0 if self.allow_short else 0.0
        self.observation_space = config.get("observation_space") or gym.spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(obs_dim,),
            dtype=np.float32,
        )
        self.action_space = config.get("action_space") or gym.spaces.Box(
            low=low,
            high=1.0,
            shape=(self.num_assets,),
            dtype=np.float32,
        )

        self.current_step = self.window_size
        self.weights = np.full(self.num_assets, 1.0 / self.num_assets, dtype=np.float32)
        self.previous_weights = self.weights.copy()
        self.portfolio_value = self.initial_capital

    def reset(self, *, seed: int | None = None, options: Dict[str, Any] | None = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)
        self.current_step = self.window_size
        self.weights = np.full(self.num_assets, 1.0 / self.num_assets, dtype=np.float32)
        self.previous_weights = self.weights.copy()
        self.portfolio_value = self.initial_capital
        observation = self._get_observation()
        return observation, {}

    def step(self, action: Any) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """Advance the portfolio environment using new allocation weights.

        Parameters
        ----------
        action : Any
            Proposed portfolio weights emitted by the SAC meta-controller.

        Returns
        -------
        numpy.ndarray
            Updated observation including the latest return window and current weights.
        float
            Reward adjusted for transaction costs and turnover penalties.
        bool
            ``True`` when the episode reaches the end of the dataset.
        bool
            ``True`` when the episode is truncated (always ``False`` here).
        Dict[str, Any]
            Additional metrics such as ``portfolio_value``, ``weights``, ``turnover``,
            and ``portfolio_return``.
        """
        weights = self._normalize_action(np.asarray(action, dtype=np.float32))
        asset_returns = self.data.iloc[self.current_step].to_numpy(dtype=np.float32)

        turnover = float(np.abs(weights - self.weights).sum())
        transaction_cost = self.transaction_cost * turnover

        portfolio_return = float(np.dot(weights, asset_returns))
        reward = portfolio_return - transaction_cost - self.turnover_penalty * turnover

        self.portfolio_value *= (1.0 + portfolio_return)
        self.previous_weights = self.weights
        self.weights = weights

        self.current_step += 1
        terminated = self.current_step >= len(self.data) - 1
        truncated = False
        observation = self._get_observation()
        info = {
            "portfolio_value": self.portfolio_value,
            "weights": weights,
            "turnover": turnover,
            "portfolio_return": portfolio_return,
        }
        return observation, float(reward), terminated, truncated, info

    def _get_observation(self) -> np.ndarray:
        start = self.current_step - self.window_size
        window = self.data.iloc[start:self.current_step].to_numpy(dtype=np.float32)
        flattened = window.flatten()
        observation = np.concatenate([flattened, self.weights, np.array([self.portfolio_value], dtype=np.float32)])
        return observation.astype(np.float32)

    def _normalize_action(self, action: np.ndarray) -> np.ndarray:
        clipped = np.clip(action, self.action_space.low, self.action_space.high)
        if self.allow_short:
            leverage = np.abs(clipped).sum()
            if leverage > self.leverage_limit:
                clipped = clipped * (self.leverage_limit / leverage)
        else:
            total = clipped.sum()
            if total <= 0:
                clipped = np.full_like(clipped, 1.0 / len(clipped))
            else:
                clipped = clipped / total
        return clipped.astype(np.float32)


class MultiAssetPortfolioEnv(PortfolioEnv):
    """Extension that incorporates cross-asset correlations and risk parity."""

    def __init__(self, data: Any, config: Dict[str, Any]):
        super().__init__(data, config)
        self.covariance_matrix = config.get("covariance_matrix")
        if isinstance(self.covariance_matrix, pd.DataFrame):
            self.covariance_matrix = self.covariance_matrix.to_numpy(dtype=np.float32)

    def step(self, action: Any) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """Extend the base portfolio step with covariance-aware risk penalties."""
        observation, reward, terminated, truncated, info = super().step(action)
        if self.covariance_matrix is not None and self.risk_penalty > 0:
            variance = float(self.weights.T @ self.covariance_matrix @ self.weights)
            penalty = self.risk_penalty * variance
            reward -= penalty
            info["variance"] = variance
            info["risk_penalty"] = penalty
            info["adjusted_reward"] = reward
        return observation, reward, terminated, truncated, info
