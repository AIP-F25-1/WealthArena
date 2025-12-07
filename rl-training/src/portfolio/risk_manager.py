"""
Risk management utilities for portfolio monitoring.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, Iterable

import numpy as np
import pandas as pd


logger = logging.getLogger(__name__)


@dataclass
class DrawdownTracker:
    """Track running drawdown statistics."""

    running_max: float = field(default=0.0)
    current_drawdown: float = field(default=0.0)
    max_drawdown: float = field(default=0.0)

    def update(self, value: float) -> None:
        self.running_max = max(self.running_max, value)
        self.current_drawdown = (value - self.running_max) / (self.running_max + 1e-9)
        self.max_drawdown = min(self.max_drawdown, self.current_drawdown)

    def get_current_drawdown(self) -> float:
        return self.current_drawdown

    def get_max_drawdown(self) -> float:
        return self.max_drawdown

    def check_threshold(self, threshold: float) -> bool:
        triggered = self.current_drawdown <= -abs(threshold)
        logger.debug("Drawdown threshold %s triggered=%s", threshold, triggered)
        return triggered


@dataclass
class ExposureAnalyzer:
    """Analyze portfolio exposures and concentrations."""

    def compute_exposures(self, weights: pd.Series) -> Dict[str, float]:
        logger.debug("Computing exposures")
        return {"gross": float(weights.abs().sum()), "net": float(weights.sum())}

    def compute_concentration(self, weights: pd.Series) -> float:
        logger.debug("Computing Herfindahl concentration index")
        return float((weights**2).sum())

    def compute_risk_contributions(self, weights: pd.Series, cov_matrix: pd.DataFrame) -> pd.Series:
        portfolio_vol = np.sqrt(weights.T @ cov_matrix @ weights)
        marginal = cov_matrix @ weights / portfolio_vol
        return weights * marginal / portfolio_vol


@dataclass
class StressTestor:
    """Perform scenario analysis and stress testing."""

    scenarios: Dict[str, Dict[str, float]]

    def run_historical_stress_test(self, returns: pd.DataFrame, scenario_name: str) -> pd.Series:
        logger.info("Running historical stress test %s", scenario_name)
        return returns.sum(axis=1)

    def run_custom_scenario(self, weights: pd.Series, scenario_name: str) -> float:
        logger.info("Running custom scenario %s", scenario_name)
        scenario = self.scenarios.get(scenario_name, {})
        shock = sum(value * weights.get(asset, 0.0) for asset, value in scenario.items())
        return float(shock)

    def generate_stress_report(self, results: Dict[str, float]) -> Dict[str, float]:
        logger.debug("Generating stress report")
        return results


@dataclass
class RiskManager:
    """Comprehensive risk monitoring for trading systems."""

    var_level: float = 0.95
    window: int = 252
    drawdown_threshold: float = 0.2
    tracker: DrawdownTracker = field(default_factory=DrawdownTracker)
    exposure_analyzer: ExposureAnalyzer = field(default_factory=ExposureAnalyzer)

    def compute_var(self, returns: pd.Series) -> float:
        var = -np.percentile(returns.dropna(), (1 - self.var_level) * 100)
        logger.debug("Computed VaR=%.4f", var)
        return float(var)

    def compute_cvar(self, returns: pd.Series) -> float:
        threshold = np.percentile(returns.dropna(), (1 - self.var_level) * 100)
        tail_losses = returns[returns <= threshold]
        cvar = -tail_losses.mean()
        logger.debug("Computed CVaR=%.4f", cvar)
        return float(cvar)

    def compute_max_drawdown(self, equity_curve: pd.Series) -> float:
        rolling_max = equity_curve.cummax()
        drawdown = (equity_curve - rolling_max) / rolling_max
        max_dd = drawdown.min()
        logger.debug("Computed max drawdown %.4f", max_dd)
        return float(max_dd)

    def check_risk_limits(self, equity_curve: pd.Series) -> Dict[str, bool]:
        current_value = equity_curve.iloc[-1]
        self.tracker.update(current_value)
        return {"drawdown_breached": self.tracker.check_threshold(self.drawdown_threshold)}

    def generate_risk_report(self, returns: pd.Series, equity_curve: pd.Series) -> Dict[str, float]:
        report = {
            "var": self.compute_var(returns),
            "cvar": self.compute_cvar(returns),
            "max_drawdown": self.compute_max_drawdown(equity_curve),
        }
        logger.info("Generated risk report %s", report)
        return report
