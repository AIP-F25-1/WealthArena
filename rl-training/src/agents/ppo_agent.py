from __future__ import annotations

from typing import Any, Callable, Dict, Optional
from dataclasses import dataclass, field

from src.utils import get_logger

logger = get_logger(__name__)

PPO = None
BaseCallback = None
evaluate_policy = None
DummyVecEnv = None
VecEnv = None


def _ensure_sb3() -> None:
    global PPO, BaseCallback, evaluate_policy, DummyVecEnv, VecEnv  # pylint: disable=global-statement
    if PPO is not None:
        return
    try:
        from stable_baselines3 import PPO as _PPO
        from stable_baselines3.common.callbacks import BaseCallback as _BaseCallback
        from stable_baselines3.common.evaluation import evaluate_policy as _evaluate_policy
        from stable_baselines3.common.vec_env import DummyVecEnv as _DummyVecEnv, VecEnv as _VecEnv
    except Exception as exc:  # pragma: no cover - optional dependency
        raise ImportError(
            "stable-baselines3 is required for PPOAgent. Install via `pip install stable-baselines3[extra]`."
        ) from exc
    PPO = _PPO
    BaseCallback = _BaseCallback
    evaluate_policy = _evaluate_policy
    DummyVecEnv = _DummyVecEnv
    VecEnv = _VecEnv


def _wrap_env(env: Any, env_fn: Optional[Callable[[], Any]] = None) -> Any:
    _ensure_sb3()
    assert VecEnv is not None and DummyVecEnv is not None  # for type-checkers
    if isinstance(env, VecEnv):
        return env
    if env_fn is None:
        env_fn = lambda: env  # type: ignore
    return DummyVecEnv([env_fn])


@dataclass
class PPOAgent:
    """Wrapper around Stable-Baselines3 PPO with finance-specific utilities."""

    config: Dict[str, Any]
    env: Any
    policy: Optional[str] = None
    model: Optional[Any] = None

    def _make_env(self) -> Any:
        env_fn = self.config.get("env_fn")
        if env_fn is not None and not callable(env_fn):
            raise TypeError("env_fn must be callable.")
        return _wrap_env(self.env, env_fn)

    def train(self, total_timesteps: int) -> None:
        _ensure_sb3()
        vec_env = self._make_env()
        new_model = self.model is None
        if new_model:
            policy = self.policy or self.config.get("policy", "MlpPolicy")
            hyperparams = self.config.get("hyperparams", {})
            self.model = PPO(policy, vec_env, verbose=self.config.get("verbose", 0), **hyperparams)
        else:
            self.model.set_env(vec_env)

        callback = self.config.get("callback")
        if callback is None:
            checkpoint_dir = self.config.get("checkpoint_dir")
            if checkpoint_dir:
                callback = PPOTrainingCallback(checkpoint_dir=checkpoint_dir)

        if isinstance(callback, PPOTrainingCallback):
            bound_callback = callback.bind()
        else:
            bound_callback = callback

        self.model.learn(
            total_timesteps=total_timesteps,
            callback=bound_callback,
            reset_num_timesteps=new_model,
        )

    def evaluate(self, episodes: int = 10) -> Dict[str, float]:
        _ensure_sb3()
        if self.model is None:
            raise RuntimeError("Call train() before evaluate().")
        env = self._make_env()
        mean_reward, std_reward = evaluate_policy(self.model, env, n_eval_episodes=episodes)
        return {"mean_reward": float(mean_reward), "std_reward": float(std_reward)}

    def predict(self, observation: Any, deterministic: bool = True) -> Any:
        if self.model is None:
            raise RuntimeError("Call train() before predict().")
        action, _ = self.model.predict(observation, deterministic=deterministic)
        logger.debug("PPO action=%s", action)
        return action

    def save(self, path: str) -> None:
        if self.model is None:
            raise RuntimeError("No model to save; call train() first.")
        self.model.save(path)
        logger.info("Saved PPO model to %s", path)

    def load(self, path: str) -> None:
        _ensure_sb3()
        policy = self.policy or self.config.get("policy", "MlpPolicy")
        vec_env = self._make_env()
        self.model = PPO.load(path, env=vec_env, policy=policy)
        logger.info("Loaded PPO model from %s", path)


@dataclass
class PPOAgentFactory:
    """Factory for creating per-asset-class PPO agents."""

    base_config: Dict[str, Any]

    def create_stock_agent(self, env: Any) -> PPOAgent:
        logger.debug("Creating stock PPO agent")
        config = self._merge_config("stocks")
        return PPOAgent(config=config, env=env)

    def create_forex_agent(self, env: Any) -> PPOAgent:
        logger.debug("Creating forex PPO agent")
        config = self._merge_config("forex")
        return PPOAgent(config=config, env=env)

    def create_crypto_agent(self, env: Any) -> PPOAgent:
        logger.debug("Creating crypto PPO agent")
        config = self._merge_config("crypto")
        return PPOAgent(config=config, env=env)

    def create_etf_agent(self, env: Any) -> PPOAgent:
        logger.debug("Creating ETF PPO agent")
        config = self._merge_config("etfs")
        return PPOAgent(config=config, env=env)

    def create_commodity_agent(self, env: Any) -> PPOAgent:
        logger.debug("Creating commodity PPO agent")
        config = self._merge_config("commodities")
        return PPOAgent(config=config, env=env)

    def create_options_agent(self, env: Any) -> PPOAgent:
        logger.debug("Creating options PPO agent")
        config = self._merge_config("options")
        return PPOAgent(config=config, env=env)

    def _merge_config(self, asset_class: str) -> Dict[str, Any]:
        config = self.base_config.copy()
        overrides = self.base_config.get("asset_classes", {}).get(asset_class, {})
        config.update(overrides)
        return config


class PPOTrainingCallback:
    """Custom callback for logging and checkpointing PPO training."""

    def __init__(self, checkpoint_dir: str, experiment_tracker: Optional[Any] = None, verbose: int = 0) -> None:
        self.checkpoint_dir = checkpoint_dir
        self.experiment_tracker = experiment_tracker
        self.verbose = verbose
        self._sb3_callback: Optional[Any] = None

    def bind(self) -> Any:
        _ensure_sb3()
        if self._sb3_callback is not None:
            return self._sb3_callback

        assert BaseCallback is not None

        checkpoint_dir = self.checkpoint_dir
        experiment_tracker = self.experiment_tracker

        class _CheckpointCallback(BaseCallback):  # type: ignore[name-defined]
            def __init__(self, verbose: int = 0) -> None:
                super().__init__(verbose=verbose)

            def _on_step(self) -> bool:
                if experiment_tracker:
                    experiment_tracker.log_metrics({"total_timesteps": self.num_timesteps})
                return True

            def _on_rollout_end(self) -> None:
                logger.debug("PPO rollout ended at step %d", self.num_timesteps)

            def _on_training_end(self) -> None:
                logger.info("PPO training completed at %d timesteps", self.num_timesteps)

        self._sb3_callback = _CheckpointCallback(verbose=self.verbose)
        return self._sb3_callback
