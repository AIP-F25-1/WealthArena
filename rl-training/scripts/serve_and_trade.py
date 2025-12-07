"""Package models and run paper trading in a single workflow."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, Optional, Tuple, Union

import yaml

from src.serving import (
    AlpacaConnector,
    CCXTConnector,
    InferenceOptimizer,
    ModelRegistry,
    ModelServer,
    OrderExecutor,
    PaperTradingConnector,
    PaperTradingSimulator,
)
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)

TradingInterface = Union[PaperTradingConnector, PaperTradingSimulator]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve models and run paper trading.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--models-dir", type=Path, default=Path("./models"))
    parser.add_argument("--serve-only", action="store_true")
    parser.add_argument("--trade-only", action="store_true")
    parser.add_argument("--platform", choices=["alpaca", "ccxt", "simulator"], default="alpaca")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def _require_keys(section: Dict[str, str], required: Tuple[str, ...], section_name: str) -> bool:
    missing = [key for key in required if not section.get(key)]
    if missing:
        logger.error("Missing configuration values for %s: %s", section_name, ", ".join(missing))
        return False
    return True


def _build_trading_interface(platform: str, config: Dict[str, Dict[str, str]]) -> Optional[TradingInterface]:
    if platform == "alpaca":
        alpaca_cfg = config.get("alpaca", {})
        if not _require_keys(alpaca_cfg, ("api_key", "api_secret", "base_url"), "alpaca"):
            return None
        return AlpacaConnector(
            api_key=alpaca_cfg["api_key"],
            api_secret=alpaca_cfg["api_secret"],
            base_url=alpaca_cfg["base_url"],
        )

    if platform == "ccxt":
        ccxt_cfg = config.get("ccxt", {})
        if not _require_keys(ccxt_cfg, ("api_key", "api_secret", "base_url"), "ccxt"):
            return None
        connector = CCXTConnector(
            api_key=ccxt_cfg["api_key"],
            api_secret=ccxt_cfg["api_secret"],
            base_url=ccxt_cfg["base_url"],
            exchange_id=ccxt_cfg.get("exchange_id", "binance"),
        )
        connector.set_sandbox_mode(ccxt_cfg.get("sandbox", True))
        return connector

    if platform == "simulator":
        simulator_cfg = config.get("simulator", {})
        initial_value = float(simulator_cfg.get("initial_portfolio", 1_000_000.0))
        default_price = float(simulator_cfg.get("default_price", 1.0))
        return PaperTradingSimulator(portfolio_value=initial_value, default_price=default_price)

    logger.error("Unsupported trading platform '%s'.", platform)
    return None


def main() -> None:
    args = parse_args()
    load_environment()
    raw_config = yaml.safe_load(args.config.read_text())
    config = resolve_env_placeholders(raw_config)

    registry = ModelRegistry(store_path=str(args.models_dir))
    optimizer = InferenceOptimizer(cache={})
    server = ModelServer(registry=registry, optimizer=optimizer)

    if not args.trade_only:
        logger.info("Packaging and serving models")
        server.build_bento()
        if not args.serve_only:
            server.serve()

    if args.serve_only:
        return

    logger.info("Starting paper trading on platform=%s", args.platform)
    trading_interface = _build_trading_interface(args.platform, config)
    if trading_interface is None:
        logger.error("Unable to initialize trading interface; aborting trade loop.")
        return

    if args.dry_run:
        logger.info("Dry run enabled; skipping execution after initialization.")
        return

    if isinstance(trading_interface, PaperTradingSimulator):
        logger.info("Running in simulator mode. Portfolio value: %.2f", trading_interface.get_portfolio_value())
        sample_order = trading_interface.place_order(symbol="SIM", qty=1.0, side="buy")
        trading_interface.update_positions(sample_order)
        logger.info("Simulation completed. Remaining value: %.2f", trading_interface.get_portfolio_value())
    else:
        executor = OrderExecutor(connector=trading_interface)
        trading_interface.connect()
        try:
            logger.info("Executing trading loop (placeholder).")
            executor.execute_signal(symbol="AAPL", target_weight=0.01, portfolio_value=100_000.0)
        finally:
            trading_interface.disconnect()


if __name__ == "__main__":
    main()
