from __future__ import annotations

import numpy as np

from src.environments.trading_env import TradingEnv


def test_trading_env_step_generates_pnl_and_costs(mock_ohlcv_df) -> None:
    env = TradingEnv(
        data=mock_ohlcv_df,
        config={
            "window_size": 32,
            "price_column": "close",
            "transaction_cost": 0.0005,
            "reward_scaling": 1.0,
        },
    )

    observation, _ = env.reset()
    assert observation.shape == env.observation_space.shape

    _, first_reward, terminated, truncated, first_info = env.step(np.array([0.5], dtype=np.float32))
    assert isinstance(terminated, bool) and isinstance(truncated, bool)
    assert first_info["trade_cost"] > 0.0
    assert first_reward < 0.0

    _, second_reward, _, _, second_info = env.step(np.array([0.5], dtype=np.float32))
    assert second_reward > 0.0
    assert second_info["portfolio_value"] > env.initial_cash
