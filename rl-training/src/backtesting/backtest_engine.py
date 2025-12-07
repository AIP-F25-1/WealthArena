"""
Event-driven backtesting using Backtrader.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .transaction_costs import TransactionCostModel


def _safe_close(data: Any) -> float:
    try:
        return float(data.close[0])  # type: ignore[attr-defined]
    except Exception:  # pragma: no cover - defensive fallback
        return 0.0


def _safe_volatility(data: Any) -> float:
    return float(getattr(data, "volatility", 0.01))


logger = logging.getLogger(__name__)


@dataclass
class CustomSlippageModel:
    """Model slippage based on volatility and order size."""

    transaction_cost_model: Optional[TransactionCostModel] = None
    default_slippage: float = 0.0005

    def __call__(self, data: Any, order: Any, size: float) -> float:  # pragma: no cover - Backtrader integration
        price = _safe_close(data)
        volatility = _safe_volatility(data)
        if self.transaction_cost_model:
            return self.transaction_cost_model.slippage_model.compute_slippage(price, size, volatility)
        return abs(size) * price * self.default_slippage

    def compute_slippage(self, volatility: float, order_size: float) -> float:
        if self.transaction_cost_model:
            return self.transaction_cost_model.slippage_model.compute_slippage(1.0, order_size, volatility)
        return volatility * order_size * self.default_slippage


@dataclass
class CustomCommissionModel:
    """Commission structure per asset class."""

    commission: float = 0.001
    transaction_cost_model: Optional[TransactionCostModel] = None

    def __call__(self, size: float, price: float) -> float:  # pragma: no cover - Backtrader integration
        if self.transaction_cost_model:
            return self.transaction_cost_model.compute_commission(price, size)
        return abs(size) * price * self.commission

    def compute_commission(self, size: float, price: float) -> float:
        if self.transaction_cost_model:
            return self.transaction_cost_model.compute_commission(price, size)
        return abs(size) * price * self.commission


@dataclass
class BacktestEngine:
    """Wrapper around Backtrader for RL strategy evaluation."""

    cerebro: Any
    slippage_model: Optional[CustomSlippageModel] = None
    commission_model: Optional[CustomCommissionModel] = None
    transaction_cost_model: Optional[TransactionCostModel] = None

    def add_data(self, data_feed: Any) -> None:
        logger.debug("Adding data feed to BacktestEngine")
        self.cerebro.adddata(data_feed)

    def add_strategy(self, strategy_cls: Any, **kwargs: Any) -> None:
        logger.debug("Adding strategy %s", strategy_cls.__name__)
        self.cerebro.addstrategy(strategy_cls, **kwargs)

    def set_broker(self, **kwargs: Any) -> None:
        broker = self.cerebro.getbroker()
        for key, value in kwargs.items():
            setattr(broker, key, value)

    def set_commission(self, commission: float) -> None:
        self.commission_model = CustomCommissionModel(commission=commission, transaction_cost_model=self.transaction_cost_model)
        broker = self.cerebro.getbroker()
        if hasattr(broker, "setcommission"):
            broker.setcommission(commission=commission)

    def set_slippage(self, slippage_model: CustomSlippageModel) -> None:
        self.slippage_model = slippage_model
        broker = self.cerebro.getbroker()
        default_slippage = slippage_model.default_slippage
        if slippage_model.transaction_cost_model is not None:
            default_slippage = slippage_model.transaction_cost_model.slippage_model.base_slippage
        if hasattr(broker, "set_slippage_perc"):
            broker.set_slippage_perc(default_slippage)

    def set_transaction_cost_model(self, model: TransactionCostModel) -> None:
        self.transaction_cost_model = model
        self.set_commission(model.commission_rate)
        self.set_slippage(CustomSlippageModel(transaction_cost_model=model, default_slippage=model.slippage_model.base_slippage))

    def run(self) -> Any:
        logger.info("Running event-driven backtest")
        return self.cerebro.run()

    def get_results(self) -> Dict[str, Any]:
        logger.debug("Collecting backtest results")
        broker = self.cerebro.getbroker()
        results = {
            "final_value": float(getattr(broker, "getvalue", lambda: 0.0)()),
            "cash": float(getattr(broker, "getcash", lambda: 0.0)()),
        }
        return results


class RLAgentStrategy:  # pragma: no cover - requires Backtrader runtime
    """Backtrader strategy that wraps trained RL agents."""

    params = dict(agent=None)

    def __init__(self) -> None:
        self.agent = self.params.agent

    def next(self) -> None:
        observation = self._build_observation()
        action = self.agent.predict(observation)
        self._execute_action(action)

    def notify_order(self, order: Any) -> None:
        logger.debug("Order notification: %s", order)

    def notify_trade(self, trade: Any) -> None:
        logger.debug("Trade notification: %s", trade)

    def _build_observation(self) -> Any:
        return {}

    def _execute_action(self, action: Any) -> None:
        logger.debug("Executing action %s", action)
