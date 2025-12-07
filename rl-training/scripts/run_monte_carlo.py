"""Run Monte Carlo simulations for portfolio stress testing."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml
import pandas as pd

from src.backtesting import MonteCarloSimulator, VaRCalculator
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Monte Carlo risk simulations.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--returns", type=Path, required=True)
    parser.add_argument("--simulations", type=int, default=10_000)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(args.config.read_text())
    returns = pd.read_parquet(args.returns)["returns"]
    simulator = MonteCarloSimulator(returns=returns, num_simulations=args.simulations)
    sims = simulator.parametric_simulation(distribution="student_t")
    metrics = simulator.compute_var_cvar(sims, alpha=config["monte_carlo"]["var_levels"][0])
    logger.info("Monte Carlo VaR/CVaR metrics: %s", metrics)
    var_calc = VaRCalculator()
    logger.info("Historical VaR: %.4f", var_calc.compute_var_historical(returns))


if __name__ == "__main__":
    main()
