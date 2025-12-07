"""
Vectorized backtesting utilities using vectorbt-style workflows.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from .transaction_costs import TransactionCostModel


logger = logging.getLogger(__name__)


@dataclass
class VectorizedBacktester:
    """Vectorized backtester operating on array-based signals."""

    prices: pd.DataFrame
    signals: pd.DataFrame
    transaction_cost_model: Optional[TransactionCostModel] = None
    volatility_window: int = 20
    average_daily_volume: Optional[pd.DataFrame] = None

    def compute_signals(self) -> pd.DataFrame:
        logger.debug("Computing vectorized signals")
        return self.signals

    def _compute_transaction_costs(self, weights: pd.DataFrame, returns: pd.DataFrame) -> pd.Series:
        if self.transaction_cost_model is None:
            return pd.Series(0.0, index=returns.index)

        trade_weights = weights.diff().fillna(weights.iloc[0])
        volatility = returns.rolling(self.volatility_window).std().fillna(returns.std())
        if self.average_daily_volume is not None:
            adv = self.average_daily_volume.reindex_like(self.prices).fillna(method="ffill").fillna(1.0)
        else:
            adv = pd.DataFrame(1.0, index=self.prices.index, columns=self.prices.columns)

        costs = []
        for timestamp in returns.index:
            daily_cost = 0.0
            for column in returns.columns:
                change = float(trade_weights.at[timestamp, column])
                if change == 0.0:
                    continue
                price = float(self.prices.at[timestamp, column])
                vol = float(volatility.at[timestamp, column])
                adv_value = float(adv.at[timestamp, column])
                daily_cost += self.transaction_cost_model.compute_return_cost(change, price, vol, adv_value)
            costs.append(daily_cost)
        return pd.Series(costs, index=returns.index)

    def run(self) -> Dict[str, Any]:
        logger.info("Running vectorized backtest")
        weights = self.compute_signals().fillna(0)
        returns = self.prices.pct_change().fillna(0)
        lagged_weights = weights.shift().fillna(0)
        portfolio_returns = (returns * lagged_weights).sum(axis=1)

        cost_series = self._compute_transaction_costs(weights, returns)
        portfolio_returns -= cost_series

        return {"returns": portfolio_returns, "transaction_costs": cost_series}

    def get_results(self) -> Dict[str, Any]:
        logger.debug("Collecting vectorized backtest results")
        return self.run()


@dataclass
class PortfolioBacktester(VectorizedBacktester):
    """Backtester focusing on multi-asset portfolio rebalancing."""

    rebalance_frequency: str = "1d"

    def rebalance(self) -> None:
        logger.debug("Rebalancing portfolio at frequency %s", self.rebalance_frequency)

    def compute_portfolio_metrics(self) -> Dict[str, float]:
        results = self.run()
        returns = results["returns"]
        ann_return = (1 + returns).prod() ** (252 / len(returns)) - 1
        ann_vol = returns.std() * np.sqrt(252)
        sharpe = ann_return / (ann_vol + 1e-9)
        return {
            "annualized_return": float(ann_return),
            "annualized_volatility": float(ann_vol),
            "sharpe": float(sharpe),
        }


@dataclass
class PerformanceOptimizer:
    """Optimize vectorized computations via caching and acceleration."""

    cache: Dict[str, Any]

    def optimize_computation(self, key: str, generator: Any) -> Any:
        if key in self.cache:
            return self.cache[key]
        value = generator()
        self.cache[key] = value
        return value

    def cache_indicators(self, indicators: Dict[str, pd.Series]) -> None:
        self.cache.update(indicators)
