"""
collect_ml_metrics.py

Purpose:
    Extract training and evaluation metrics from experiment tracking outputs.

Author: Clifford Addison
Company: WealthArena
Year: 2025
"""

import argparse
import json
from pathlib import Path
from typing import Dict, Any

try:
    import wandb  # type: ignore
except Exception:  # pragma: no cover
    wandb = None

try:
    from tensorboard.backend.event_processing.event_accumulator import (
        EventAccumulator,
    )
except Exception:  # pragma: no cover
    EventAccumulator = None


def parse_wandb_logs(project_name: str) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    if not wandb:
        return metrics
    try:
        api = wandb.Api()
        runs = api.runs(project_name)
        for run in runs:
            metrics[run.name] = {
                "sharpe_ratio": run.summary.get("sharpe_ratio"),
                "max_drawdown_percent": run.summary.get("max_drawdown"),
                "win_rate_percent": run.summary.get("win_rate"),
                "final_reward": run.summary.get("final_reward"),
            }
    except Exception:
        return {}
    return metrics


def parse_tensorboard_logs(log_dir: Path) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    if not EventAccumulator or not log_dir.exists():
        return metrics

    for run_dir in log_dir.iterdir():
        if not run_dir.is_dir():
            continue
        try:
            accumulator = EventAccumulator(str(run_dir))
            accumulator.Reload()
            tags = accumulator.Tags().get("scalars", [])
            run_metrics = {}
            for tag in tags:
                events = accumulator.Scalars(tag)
                if events:
                    run_metrics[tag] = events[-1].value
            metrics[run_dir.name] = run_metrics
        except Exception:
            continue
    return metrics


def parse_experiment_logs(experiments_dir: Path) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    if not experiments_dir.exists():
        return metrics

    for json_file in experiments_dir.glob("**/*.json"):
        try:
            with json_file.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            metrics[json_file.stem] = data
        except Exception:
            continue
    return metrics


def collect_all_ml_metrics(
    experiments_dir: Path, results_dir: Path, wandb_project: str = ""
) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    if wandb_project:
        metrics["wandb"] = parse_wandb_logs(wandb_project)
    tensorboard_dir = experiments_dir / "tensorboard"
    metrics["tensorboard"] = parse_tensorboard_logs(tensorboard_dir)
    metrics["experiments"] = parse_experiment_logs(experiments_dir)
    backtest_metrics_file = results_dir / "backtests" / "metrics.json"
    if backtest_metrics_file.exists():
        try:
            with backtest_metrics_file.open("r", encoding="utf-8") as fh:
                metrics["backtests"] = json.load(fh)
        except Exception:
            metrics["backtests"] = {}
    else:
        metrics["backtests"] = {}
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect ML metrics")
    parser.add_argument("--experiments-dir", required=True, help="Experiments base directory")
    parser.add_argument("--results-dir", required=True, help="Results directory")
    parser.add_argument("--wandb-project", default="", help="Weights & Biases project name")
    parser.add_argument("--output", required=True, help="Output JSON path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metrics = collect_all_ml_metrics(
        experiments_dir=Path(args.experiments_dir),
        results_dir=Path(args.results_dir),
        wandb_project=args.wandb_project,
    )
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)


if __name__ == "__main__":
    main()

