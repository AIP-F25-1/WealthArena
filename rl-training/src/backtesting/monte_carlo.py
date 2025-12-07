"""
Monte Carlo simulation and scenario analysis utilities.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Iterable, List

import numpy as np
import pandas as pd


logger = logging.getLogger(__name__)


@dataclass
class MonteCarloSimulator:
    """Run bootstrap and parametric simulations on return series."""

    returns: pd.Series
    num_simulations: int = 10_000
    seed: int = 123

    def bootstrap_returns(self) -> np.ndarray:
        logger.debug("Running IID bootstrap simulations")
        rng = np.random.default_rng(self.seed)
        indices = rng.choice(len(self.returns), (self.num_simulations, len(self.returns)))
        return self.returns.values[indices]

    def block_bootstrap(self, block_size: int = 20) -> np.ndarray:
        logger.debug("Running block bootstrap simulations (block_size=%d)", block_size)
        rng = np.random.default_rng(self.seed)
        blocks = []
        for _ in range(self.num_simulations):
            block_indices = rng.integers(0, len(self.returns) - block_size, len(self.returns) // block_size)
            paths = np.concatenate([self.returns.values[i : i + block_size] for i in block_indices])
            blocks.append(paths[: len(self.returns)])
        return np.array(blocks)

    def parametric_simulation(self, distribution: str = "student_t") -> np.ndarray:
        logger.debug("Running parametric simulation (%s)", distribution)
        rng = np.random.default_rng(self.seed)
        mean = self.returns.mean()
        std = self.returns.std()
        if distribution == "student_t":
            df = 5
            simulated = rng.standard_t(df, size=(self.num_simulations, len(self.returns)))
            simulated = mean + simulated * std / np.sqrt(df / (df - 2))
        else:
            simulated = rng.normal(mean, std, size=(self.num_simulations, len(self.returns)))
        return simulated

    def garch_simulation(self) -> np.ndarray:
        logger.debug("Running placeholder GARCH simulation")
        return self.parametric_simulation("student_t")

    def compute_var_cvar(self, simulations: np.ndarray, alpha: float = 0.95) -> Dict[str, float]:
        losses = -np.sort(simulations.sum(axis=1))
        var_idx = int((1 - alpha) * len(losses))
        var = losses[var_idx]
        cvar = losses[:var_idx].mean()
        return {"var": float(var), "cvar": float(cvar)}


@dataclass
class ScenarioGenerator:
    """Generate custom stress scenarios."""

    scenarios: Dict[str, Dict[str, float]]

    def create_scenario(self, name: str, shocks: Dict[str, float]) -> None:
        logger.debug("Creating scenario %s", name)
        self.scenarios[name] = shocks

    def simulate_scenario(self, weights: pd.Series, name: str) -> float:
        shocks = self.scenarios.get(name, {})
        impact = sum(weights.get(asset, 0.0) * shock for asset, shock in shocks.items())
        logger.info("Scenario %s impact %.4f", name, impact)
        return float(impact)

    def generate_scenario_report(self) -> Dict[str, Dict[str, float]]:
        return self.scenarios


@dataclass
class VaRCalculator:
    """Value-at-Risk and Expected Shortfall calculations."""

    def compute_var_parametric(self, mean: float, std: float, alpha: float = 0.95) -> float:
        z = np.abs(np.percentile(np.random.normal(size=10_000), (1 - alpha) * 100))
        return float(mean - z * std)

    def compute_var_historical(self, returns: pd.Series, alpha: float = 0.95) -> float:
        return float(np.percentile(returns, (1 - alpha) * 100))

    def compute_var_monte_carlo(self, simulations: np.ndarray, alpha: float = 0.95) -> float:
        losses = -simulations.sum(axis=1)
        return float(np.percentile(losses, alpha * 100))

    def compute_cvar(self, simulations: np.ndarray, alpha: float = 0.95) -> float:
        losses = -simulations.sum(axis=1)
        threshold = np.percentile(losses, alpha * 100)
        tail = losses[losses >= threshold]
        return float(tail.mean())

    def backtest_var(self, returns: pd.Series, var_series: pd.Series) -> Dict[str, float]:
        breaches = (returns < -var_series).sum()
        return {"breaches": float(breaches), "total": float(len(returns))}
