"""
Performance evaluation utilities for trading strategies.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict

import numpy as np
import pandas as pd


logger = logging.getLogger(__name__)


@dataclass
class PerformanceEvaluator:
    """Compute comprehensive performance metrics."""

    risk_free_rate: float = 0.0

    def compute_returns(self, equity_curve: pd.Series) -> pd.Series:
        return equity_curve.pct_change().fillna(0)

    def compute_sharpe(self, returns: pd.Series) -> float:
        excess = returns - self.risk_free_rate / 252
        return float(excess.mean() / (excess.std() + 1e-9) * np.sqrt(252))

    def compute_sortino(self, returns: pd.Series) -> float:
        downside = returns[returns < 0]
        return float(returns.mean() / (downside.std() + 1e-9) * np.sqrt(252))

    def compute_calmar(self, equity_curve: pd.Series) -> float:
        ann_return = (equity_curve.iloc[-1] / equity_curve.iloc[0]) ** (252 / len(equity_curve)) - 1
        drawdown = self.compute_max_drawdown(equity_curve)
        return float(ann_return / (-drawdown + 1e-9))

    def compute_max_drawdown(self, equity_curve: pd.Series) -> float:
        rolling_max = equity_curve.cummax()
        drawdowns = (equity_curve - rolling_max) / rolling_max
        return float(drawdowns.min())

    def compute_turnover(self, weights: pd.DataFrame) -> float:
        return float(weights.diff().abs().sum(axis=1).mean())

    def compute_var_cvar(self, returns: pd.Series, alpha: float = 0.95) -> Dict[str, float]:
        var = np.percentile(returns, (1 - alpha) * 100)
        tail = returns[returns <= var]
        cvar = tail.mean()
        return {"var": float(var), "cvar": float(cvar)}

    def generate_report(self, equity_curve: pd.Series, weights: pd.DataFrame) -> Dict[str, float]:
        returns = self.compute_returns(equity_curve)
        report = {
            "sharpe": self.compute_sharpe(returns),
            "sortino": self.compute_sortino(returns),
            "calmar": self.compute_calmar(equity_curve),
            "max_drawdown": self.compute_max_drawdown(equity_curve),
            "turnover": self.compute_turnover(weights),
        }
        logger.info("Generated performance report %s", report)
        return report


@dataclass
class RegimeAwareEvaluator:
    """Evaluate strategy performance across regimes."""

    def evaluate_by_regime(self, returns: pd.Series, regimes: pd.Series) -> Dict[int, Dict[str, float]]:
        report = {}
        for regime in regimes.unique():
            regime_returns = returns[regimes == regime]
            report[int(regime)] = {
                "mean": float(regime_returns.mean()),
                "volatility": float(regime_returns.std()),
            }
        return report

    def compare_regimes(self, regime_metrics: Dict[int, Dict[str, float]]) -> Dict[str, float]:
        sharpe_diffs = [metrics["mean"] / (metrics["volatility"] + 1e-9) for metrics in regime_metrics.values()]
        return {"sharpe_range": max(sharpe_diffs) - min(sharpe_diffs)}

    def plot_regime_performance(self, regime_metrics: Dict[int, Dict[str, float]]) -> None:
        logger.info("Plotting regime performance (placeholder)")


@dataclass
class PerformanceAttributor:
    """Perform factor and allocation attribution analysis."""

    def factor_decomposition(self, returns: pd.Series, factors: pd.DataFrame) -> Dict[str, float]:
        logger.debug("Running factor decomposition")
        coefficients = np.linalg.lstsq(factors.values, returns.values, rcond=None)[0]
        return {factor: float(coeff) for factor, coeff in zip(factors.columns, coefficients)}

    def brinson_attribution(self, weights: pd.DataFrame, benchmark_weights: pd.DataFrame) -> Dict[str, float]:
        allocation = (weights - benchmark_weights).mean().sum()
        selection = ((weights - benchmark_weights) * (weights - benchmark_weights)).mean().sum()
        return {"allocation_effect": float(allocation), "selection_effect": float(selection)}

    def generate_attribution_report(self, attribution: Dict[str, float]) -> Dict[str, float]:
        return attribution
