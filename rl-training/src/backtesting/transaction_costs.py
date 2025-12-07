"""
Transaction cost modeling, spreads, and market impact utilities.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Optional

import numpy as np
import pandas as pd


logger = logging.getLogger(__name__)


@dataclass
class SpreadEstimator:
    """Estimate bid-ask spreads from OHLCV data or configurable heuristics."""

    method: str = "fixed"
    fixed_spread_bps: float = 5.0

    def estimate_roll(self, returns: pd.Series) -> float:
        cov = (returns * returns.shift(1)).mean()
        roll = 2 * np.sqrt(-cov) if cov < 0 else 0.0
        return float(roll)

    def estimate_corwin_schultz(self, highs: pd.Series, lows: pd.Series) -> float:
        beta = (np.log(highs / lows) ** 2).rolling(2).mean()
        gamma = (np.log(highs.shift(-1) / lows) ** 2).rolling(1).mean()
        alpha = (beta - gamma).clip(lower=0).mean()
        return float(2 * (np.exp(alpha) - 1) / (1 + np.exp(alpha)))

    def estimate_from_price(self, price: float) -> float:
        if price <= 0:
            return 0.0
        if self.method == "fixed":
            return float(price * self.fixed_spread_bps / 10_000)
        # Default fallback
        return float(0.0005 * price)


@dataclass
class SlippageModel:
    """Model slippage as a function of order size, volatility, and ADV participation."""

    base_slippage: float = 0.0005
    volatility_beta: float = 0.001

    def compute_slippage(self, price: float, size: float, volatility: float) -> float:
        slippage = price * abs(size) * (self.base_slippage + volatility * self.volatility_beta)
        logger.debug("Slippage %.6f", slippage)
        return float(slippage)

    def adjust_for_participation(self, slippage: float, participation_rate: float) -> float:
        return float(slippage * (1 + participation_rate))


@dataclass
class MarketImpactModel:
    """Estimate market impact using configurable models."""

    method: str = "square_root"
    lambda_estimate: float = 0.1
    square_root_coefficient: float = 0.1
    adv_participation_limit: float = 0.2

    def estimate_lambda(self, returns: pd.Series, volume: pd.Series) -> float:
        cov = np.cov(returns, volume)[0, 1]
        var = np.var(volume)
        self.lambda_estimate = cov / (var + 1e-9)
        return float(self.lambda_estimate)

    def compute_kyle_impact(self, size: float) -> float:
        return float(self.lambda_estimate * abs(size))

    def compute_sqrt_impact(self, participation_rate: float, volatility: float) -> float:
        capped_participation = min(participation_rate, self.adv_participation_limit)
        return float(self.square_root_coefficient * np.sqrt(capped_participation) * (1 + volatility))

    def compute_impact(self, size: float, adv: float, volatility: float) -> float:
        if adv <= 0:
            adv = 1.0
        participation_rate = abs(size) / (adv + 1e-9)
        if self.method == "kyle_lambda":
            return self.compute_kyle_impact(size)
        return self.compute_sqrt_impact(participation_rate, volatility)


@dataclass
class TransactionCostModel:
    """Aggregate transaction cost model combining spread, commission, slippage, impact."""

    spread_estimator: SpreadEstimator
    commission_rate: float
    slippage_model: SlippageModel
    market_impact_model: MarketImpactModel

    def compute_total_cost(self, price: float, size: float, volatility: float, adv: float) -> float:
        spread_cost = self.compute_spread_cost(price, size)
        commission_cost = self.compute_commission(price, size)
        slippage_cost = self.compute_slippage(price, size, volatility)
        impact_cost = self.compute_market_impact(size, adv, volatility)
        total = spread_cost + commission_cost + slippage_cost + impact_cost
        logger.debug("Total transaction cost=%.6f", total)
        return total

    def compute_spread_cost(self, price: float, size: float) -> float:
        spread = self.spread_estimator.estimate_from_price(price)
        return float(spread * abs(size))

    def compute_commission(self, price: float, size: float) -> float:
        return float(price * abs(size) * self.commission_rate)

    def compute_slippage(self, price: float, size: float, volatility: float) -> float:
        return self.slippage_model.compute_slippage(price, size, volatility)

    def compute_market_impact(self, size: float, adv: float, volatility: float) -> float:
        return self.market_impact_model.compute_impact(size, adv, volatility)

    def compute_return_cost(self, weight_change: float, price: float, volatility: float, adv: float = 1.0) -> float:
        """Approximate cost as a percentage return based on weight turnover."""
        if weight_change == 0 or price <= 0:
            return 0.0
        spread_rate = self.spread_estimator.estimate_from_price(price) / price
        slippage_rate = self.slippage_model.compute_slippage(price, 1.0, volatility) / price
        impact_rate = self.market_impact_model.compute_impact(1.0, adv, volatility)
        total_rate = self.commission_rate + spread_rate + slippage_rate + impact_rate
        return float(abs(weight_change) * total_rate)


def build_transaction_cost_model(
    asset_class: str,
    cost_config: Dict[str, Dict[str, float]],
    impact_config: Dict[str, float],
) -> TransactionCostModel:
    asset_cfg = cost_config.get(asset_class, cost_config.get("default", {}))

    spread_estimator = SpreadEstimator(
        method=asset_cfg.get("spread_method", "fixed"),
        fixed_spread_bps=float(asset_cfg.get("spread_bps", 5.0)),
    )
    slippage_model = SlippageModel(
        base_slippage=float(asset_cfg.get("slippage_rate", 0.0005)),
        volatility_beta=float(asset_cfg.get("volatility_beta", 0.001)),
    )
    market_impact_model = MarketImpactModel(
        method=impact_config.get("method", "square_root"),
        lambda_estimate=float(impact_config.get("lambda_estimate", impact_config.get("square_root_coefficient", 0.1))),
        square_root_coefficient=float(impact_config.get("square_root_coefficient", 0.1)),
        adv_participation_limit=float(impact_config.get("adv_participation_limit", 0.2)),
    )
    commission_rate = float(asset_cfg.get("commission_rate", 0.001))

    return TransactionCostModel(
        spread_estimator=spread_estimator,
        commission_rate=commission_rate,
        slippage_model=slippage_model,
        market_impact_model=market_impact_model,
    )
