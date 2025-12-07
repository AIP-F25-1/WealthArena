"""Generate performance reports, figures, and tables."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from src.backtesting import PerformanceEvaluator, RegimeAwareEvaluator
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate analytics reports.")
    parser.add_argument("--equity-curve", type=Path, required=True)
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--regimes", type=Path, required=False)
    parser.add_argument("--output-dir", type=Path, default=Path("./results/reports"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    equity = pd.read_parquet(args.equity_curve)["equity"]
    weights = pd.read_parquet(args.weights)
    evaluator = PerformanceEvaluator()
    report = evaluator.generate_report(equity, weights)
    logger.info("Performance report: %s", report)

    if args.regimes:
        regimes = pd.read_parquet(args.regimes)["regime"]
        regime_report = RegimeAwareEvaluator().evaluate_by_regime(equity.pct_change().fillna(0), regimes)
        logger.info("Regime report: %s", regime_report)


if __name__ == "__main__":
    main()
