"""
Paper trading connectors for Alpaca, CCXT, and local simulation.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional


logger = logging.getLogger(__name__)


@dataclass
class PaperTradingConnector:
    """Abstract connector interface for paper trading platforms."""

    api_key: str = ""
    api_secret: str = ""
    base_url: str = ""

    def connect(self) -> None:
        logger.info("Connecting to paper trading platform %s", self.base_url)

    def disconnect(self) -> None:
        logger.info("Disconnecting from paper trading platform")

    def get_account(self) -> Dict[str, Any]:
        return {}

    def place_order(self, symbol: str, qty: float, side: str, order_type: str = "market") -> Dict[str, Any]:
        logger.debug("Placing %s order for %s qty %.2f", order_type, symbol, qty)
        return {"status": "submitted"}

    def cancel_order(self, order_id: str) -> None:
        logger.debug("Canceling order %s", order_id)

    def get_positions(self) -> Dict[str, Any]:
        return {}

    def get_orders(self) -> Dict[str, Any]:
        return {}

    def get_market_data(self, symbol: str) -> Dict[str, Any]:
        return {}


@dataclass
class AlpacaConnector(PaperTradingConnector):
    """Alpaca paper trading connector."""

    def place_market_order(self, symbol: str, qty: float, side: str) -> Dict[str, Any]:
        return self.place_order(symbol, qty, side, order_type="market")

    def place_limit_order(self, symbol: str, qty: float, side: str, limit_price: float) -> Dict[str, Any]:
        order = self.place_order(symbol, qty, side, order_type="limit")
        order["limit_price"] = limit_price
        return order

    def get_account_info(self) -> Dict[str, Any]:
        return self.get_account()


@dataclass
class CCXTConnector(PaperTradingConnector):
    """CCXT connector for crypto exchange sandboxes."""

    exchange_id: str = "binance"

    def set_sandbox_mode(self, enabled: bool) -> None:
        logger.info("Setting sandbox mode %s on %s", enabled, self.exchange_id)

    def get_balance(self) -> Dict[str, Any]:
        return {"balance": {}}

    def fetch_ohlcv(self, symbol: str, timeframe: str = "1h") -> Any:
        logger.debug("Fetching OHLCV for %s %s", symbol, timeframe)
        return []


@dataclass
class OrderExecutor:
    """Execute RL agent signals into paper trading orders."""

    connector: PaperTradingConnector
    risk_manager: Optional[Any] = None

    def execute_signal(self, symbol: str, target_weight: float, portfolio_value: float) -> Dict[str, Any]:
        qty = target_weight * portfolio_value
        logger.info("Executing signal %s target_weight %.4f", symbol, target_weight)
        return self.connector.place_order(symbol, qty, side="buy" if target_weight > 0 else "sell")

    def size_order(self, symbol: str, target_weight: float, price: float, portfolio_value: float) -> float:
        return target_weight * portfolio_value / max(price, 1e-9)

    def check_risk_limits(self, symbol: str, order: Dict[str, Any]) -> bool:
        return True

    def track_order(self, order: Dict[str, Any]) -> None:
        logger.debug("Tracking order %s", order)


@dataclass
class PaperTradingSimulator(PaperTradingConnector):
    """Local simulator for executing trades without external APIs."""

    portfolio_value: float = 1_000_000.0
    default_price: float = 1.0

    def __post_init__(self) -> None:
        if not self.base_url:
            self.base_url = "local-simulator"
        if not self.api_key:
            self.api_key = "SIMULATOR"
        if not self.api_secret:
            self.api_secret = "SIMULATOR"

    def simulate_order(self, symbol: str, qty: float, price: float) -> Dict[str, Any]:
        cost = qty * price
        self.portfolio_value -= cost
        logger.debug("Simulated order cost %.2f new portfolio value %.2f", cost, self.portfolio_value)
        return {"symbol": symbol, "qty": qty, "price": price, "remaining_value": self.portfolio_value}

    def place_order(self, symbol: str, qty: float, side: str, order_type: str = "market") -> Dict[str, Any]:
        signed_qty = qty if side.lower() == "buy" else -qty
        trade = self.simulate_order(symbol, signed_qty, self.default_price)
        trade.update({"side": side, "order_type": order_type})
        return trade

    def update_positions(self, order: Dict[str, Any]) -> None:
        logger.debug("Updating positions with order %s", order)

    def get_portfolio_value(self) -> float:
        return self.portfolio_value
