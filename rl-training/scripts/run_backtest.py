"""Run event-driven backtests using BacktestEngine."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

from src.backtesting import BacktestEngine, CustomCommissionModel, CustomSlippageModel
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Execute event-driven backtests.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--strategy", type=str, default="rl_agent")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    backtest_config = yaml.safe_load(args.config.read_text())
    logger.info("Running backtest with config=%s", args.config)
    engine = BacktestEngine(cerebro=None)  # TODO: instantiate Backtrader cerebro
    engine.set_commission(backtest_config["transaction_costs"]["stocks"]["commission_rate"])
    engine.set_slippage(CustomSlippageModel())
    engine.run()
    results = engine.get_results()
    logger.info("Backtest results: %s", results)


if __name__ == "__main__":
    main()
