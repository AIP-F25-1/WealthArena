"""Run paper trading loop using Alpaca/CCXT connectors."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import yaml

from src.serving import AlpacaConnector, CCXTConnector, OrderExecutor, PaperTradingSimulator
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Execute paper trading session.")
    parser.add_argument("--config", type=str, required=True)
    parser.add_argument("--platform", choices=["alpaca", "ccxt", "simulator"], default="simulator")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(Path(args.config).read_text())
    logger.info("Starting paper trading platform=%s", args.platform)

    if args.platform == "alpaca":
        connector = AlpacaConnector(
            api_key=config["alpaca"]["api_key"],
            api_secret=config["alpaca"]["api_secret"],
            base_url=config["alpaca"]["base_url"],
        )
    elif args.platform == "ccxt":
        connector = CCXTConnector(
            api_key=config["ccxt"]["api_key"],
            api_secret=config["ccxt"]["api_secret"],
            base_url=config["ccxt"]["base_url"],
            exchange_id=config["ccxt"]["exchange_id"],
        )
    else:
        connector = PaperTradingSimulator()  # type: ignore[assignment]

    executor = OrderExecutor(connector=connector)  # type: ignore[arg-type]

    if args.dry_run:
        logger.info("Dry run enabled. Exiting without live orders.")
        return

    for _ in range(5):  # Placeholder trading loop
        logger.debug("Polling for signals...")
        time.sleep(1.0)


if __name__ == "__main__":
    main()

