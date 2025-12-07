from __future__ import annotations

import pytest

from src.agents import PPOAgentFactory
from src.agents import ppo_agent
from src.environments.trading_env import TradingEnv


@pytest.fixture()
def stub_sb3(monkeypatch: pytest.MonkeyPatch):
    class DummyVecEnv:
        def __init__(self, env_fns):
            self.envs = [fn() for fn in env_fns]

        def close(self) -> None:  # pragma: no cover - compatibility no-op
            for env in self.envs:
                close = getattr(env, "close", None)
                if callable(close):
                    close()

    class DummyPPO:
        def __init__(self, policy, env, verbose=0, **hyperparams):
            self.policy = policy
            self.env = env
            self.verbose = verbose
            self.hyperparams = hyperparams
            self.learn_calls: list[int] = []

        def learn(self, total_timesteps, callback=None, reset_num_timesteps=True):  # type: ignore[no-untyped-def]
            _ = (callback, reset_num_timesteps)
            self.learn_calls.append(int(total_timesteps))

        def set_env(self, env):
            self.env = env

        def predict(self, observation, deterministic=True):  # pragma: no cover - compatibility no-op
            _ = (observation, deterministic)
            return 0.0, {}

    monkeypatch.setattr(ppo_agent, "_ensure_sb3", lambda: None)
    monkeypatch.setattr(ppo_agent, "PPO", DummyPPO)
    monkeypatch.setattr(ppo_agent, "DummyVecEnv", DummyVecEnv)
    monkeypatch.setattr(ppo_agent, "VecEnv", DummyVecEnv)
    monkeypatch.setattr(ppo_agent, "evaluate_policy", lambda *args, **kwargs: (0.0, 0.0))
    monkeypatch.setattr(ppo_agent, "BaseCallback", object)

    return DummyPPO


@pytest.mark.parametrize("asset", ["stocks", "forex"])
def test_ppo_factory_trains_agent(asset: str, mock_ohlcv_df, stub_sb3) -> None:
    env = TradingEnv(mock_ohlcv_df, {"window_size": 32, "price_column": "close", "transaction_cost": 0.0005})
    factory = PPOAgentFactory(
        base_config={
            "policy": "MlpPolicy",
            "asset_classes": {
                "stocks": {"hyperparams": {"learning_rate": 3e-4}},
                "forex": {"hyperparams": {"learning_rate": 1e-4}},
            },
        }
    )

    method_name = {
        "stocks": "create_stock_agent",
        "forex": "create_forex_agent",
    }[asset]
    create_method = getattr(factory, method_name)
    agent = create_method(env)
    agent.train(1000)

    assert agent.model is not None
    assert getattr(agent.model, "learn_calls")[-1] == 1000

