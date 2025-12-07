"""Run walk-forward optimization and parameter stability analysis."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml
import pandas as pd

from src.backtesting import OverfittingDetector, ParameterStabilityAnalyzer, WalkForwardOptimizer
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Execute walk-forward optimization.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(args.config.read_text())
    data = pd.read_parquet(args.data)
    wf_cfg = config["walk_forward"]

    optimizer = WalkForwardOptimizer(
        in_sample_window=wf_cfg["in_sample_window_days"],
        out_sample_window=wf_cfg["out_of_sample_window_days"],
        step_size=wf_cfg["step_size_days"],
        purge=wf_cfg["purge_days"],
        embargo=wf_cfg["embargo_days"],
    )
    results = optimizer.run(data)
    stability = ParameterStabilityAnalyzer().track_parameters(results)
    pbo = OverfittingDetector().compute_pbo([fold["performance"] for fold in results])
    logger.info("Walk-forward completed. Stability=%s PBO=%.4f", stability, pbo)


if __name__ == "__main__":
    main()
