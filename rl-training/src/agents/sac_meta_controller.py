from __future__ import annotations

from typing import Any, Dict, Optional
from dataclasses import dataclass, field

import numpy as np

from src.utils import get_logger

logger = get_logger(__name__)

SAC = None
evaluate_policy = None
DummyVecEnv = None
VecEnv = None


def _ensure_sb3() -> None:
    global SAC, evaluate_policy, DummyVecEnv, VecEnv  # pylint: disable=global-statement
    if SAC is not None:
        return
    try:
        from stable_baselines3 import SAC as _SAC
        from stable_baselines3.common.evaluation import evaluate_policy as _evaluate_policy
        from stable_baselines3.common.vec_env import DummyVecEnv as _DummyVecEnv, VecEnv as _VecEnv
    except Exception as exc:  # pragma: no cover
        raise ImportError(
            "stable-baselines3 is required for SACMetaController. Install via `pip install stable-baselines3[extra]`."
        ) from exc
    SAC = _SAC
    evaluate_policy = _evaluate_policy
    DummyVecEnv = _DummyVecEnv
    VecEnv = _VecEnv


def _wrap_env(env: Any, env_fn: Optional[Any] = None) -> Any:
    _ensure_sb3()
    assert VecEnv is not None and DummyVecEnv is not None  # for type-checkers
    if isinstance(env, VecEnv):
        return env
    if env_fn is None:
        env_fn = lambda: env  # type: ignore
    return DummyVecEnv([env_fn])


@dataclass
class PortfolioActionMapper:
    """Map raw SAC outputs to valid portfolio weights."""

    leverage_limit: float = 1.5
    allow_short: bool = True

    def map_to_weights(self, actions: Any) -> np.ndarray:
        logger.debug("Mapping raw actions to weights")
        raw = np.asarray(actions, dtype=np.float32).squeeze()
        if raw.ndim != 1:
            raise ValueError("Actions must be a one-dimensional array.")
        bounded = np.tanh(raw)
        if self.allow_short:
            leverage = np.sum(np.abs(bounded))
            if leverage == 0:
                return np.zeros_like(bounded)
            scale = min(self.leverage_limit, leverage) / leverage
            return bounded * scale
        weights = np.exp(bounded - np.max(bounded))
        weights /= weights.sum()
        return weights

    def apply_constraints(self, weights: np.ndarray) -> np.ndarray:
        logger.debug("Applying portfolio constraints")
        if self.allow_short:
            leverage = np.sum(np.abs(weights))
            if leverage > self.leverage_limit:
                weights *= self.leverage_limit / leverage
            return weights
        return self.project_to_simplex(weights)

    def project_to_simplex(self, weights: np.ndarray) -> np.ndarray:
        logger.debug("Projecting weights onto simplex")
        if weights.ndim != 1:
            raise ValueError("Weights must be a one-dimensional array.")
        sorted_weights = np.sort(weights)[::-1]
        cumulative = np.cumsum(sorted_weights)
        rho = np.nonzero(sorted_weights + (1 - cumulative) / (np.arange(len(weights)) + 1) > 0)[0]
        if len(rho) == 0:
            return np.zeros_like(weights)
        rho_value = rho[-1]
        theta = (cumulative[rho_value] - 1) / float(rho_value + 1)
        projected = np.maximum(weights + theta, 0.0)
        projected_sum = projected.sum()
        return projected / projected_sum if projected_sum > 0 else np.full_like(projected, 1.0 / len(projected))


@dataclass
class SACMetaController:
    """Meta-controller responsible for portfolio allocation decisions."""

    config: Dict[str, Any]
    env: Any
    mapper: PortfolioActionMapper = field(default_factory=PortfolioActionMapper)
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
            policy = self.config.get("policy", "MlpPolicy")
            hyperparams = self.config.get("hyperparams", {})
            self.model = SAC(policy, vec_env, verbose=self.config.get("verbose", 0), **hyperparams)
        else:
            self.model.set_env(vec_env)
        self.model.learn(total_timesteps=total_timesteps, reset_num_timesteps=new_model)
        logger.info("Completed SAC training for %d timesteps", total_timesteps)

    def evaluate(self, episodes: int = 10) -> Dict[str, float]:
        _ensure_sb3()
        if self.model is None:
            raise RuntimeError("Call train() before evaluate().")
        if evaluate_policy is None:
            raise RuntimeError("stable-baselines3 evaluate_policy unavailable.")
        env = self._make_env()
        episode_reward, std_reward = evaluate_policy(self.model, env, n_eval_episodes=episodes)
        return {"mean_reward": float(episode_reward), "std_reward": float(std_reward)}

    def allocate_portfolio(self, observation: Any) -> np.ndarray:
        logger.debug("Allocating portfolio based on observation")
        if self.model is None:
            raise RuntimeError("Call train() before allocate_portfolio().")
        action, _ = self.model.predict(observation, deterministic=True)
        weights = self.mapper.map_to_weights(action)
        weights = self.mapper.apply_constraints(weights)
        return weights

    def save(self, path: str) -> None:
        if self.model is None:
            raise RuntimeError("No model to save; call train() first.")
        self.model.save(path)
        logger.info("Saved SAC meta-controller to %s", path)

    def load(self, path: str) -> None:
        _ensure_sb3()
        policy = self.config.get("policy", "MlpPolicy")
        vec_env = self._make_env()
        self.model = SAC.load(path, env=vec_env, policy=policy)
        logger.info("Loaded SAC meta-controller from %s", path)


class MetaControllerCallback:
    """Callback to monitor SAC training metrics and portfolio state."""

    def __init__(self, tracker: Optional[Any] = None) -> None:
        self.tracker = tracker

    def on_step(self, info: Dict[str, Any]) -> None:
        logger.debug("Meta-controller step info: %s", info)
        if self.tracker:
            self.tracker.log_metrics(info)
