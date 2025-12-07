from __future__ import annotations

import numpy as np
import pandas as pd

from src.environments.portfolio_env import MultiAssetPortfolioEnv, PortfolioEnv


def _make_returns_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "asset_a": [0.01, -0.005, 0.002, 0.007, -0.001],
            "asset_b": [-0.002, 0.004, 0.003, -0.001, 0.0],
        }
    )


def test_portfolio_env_normalizes_weights() -> None:
    data = _make_returns_frame()
    env = PortfolioEnv(
        data=data,
        config={
            "window_size": 2,
            "transaction_cost": 0.0,
            "allow_short": False,
        },
    )
    observation, _ = env.reset()
    assert observation.shape[0] == env.observation_space.shape[0]
    _, reward, _, _, info = env.step(np.array([0.8, 0.2], dtype=np.float32))
    assert np.isclose(np.sum(info["weights"]), 1.0)
    assert reward != 0.0


def test_multi_asset_env_applies_risk_penalty() -> None:
    data = _make_returns_frame()
    cov = data.cov().to_numpy()
    env = MultiAssetPortfolioEnv(
        data=data,
        config={
            "window_size": 2,
            "transaction_cost": 0.0,
            "allow_short": True,
            "risk_penalty": 10.0,
            "covariance_matrix": cov,
        },
    )
    env.reset()
    observation, reward, *_ , info = env.step(np.array([0.5, -0.5], dtype=np.float32))
    assert "variance" in info
    assert "risk_penalty" in info
    assert reward <= info["portfolio_return"]  # penalty lowers reward

