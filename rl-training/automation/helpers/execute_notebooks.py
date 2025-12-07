"""
execute_notebooks.py

Purpose:
    Execute Jupyter notebooks in order using papermill and capture outputs.

Author: Clifford Addison
Company: WealthArena
Year: 2025
"""

import argparse
import json
import time
from pathlib import Path
from typing import Dict, List, Any

import papermill as pm  # type: ignore


DEFAULT_ORDER = [
    "01_data_exploration.ipynb",
    "02_feature_analysis.ipynb",
    "03_sentiment_analysis.ipynb",
    "04_regime_detection.ipynb",
    "05_agent_training.ipynb",
    "06_backtest_analysis.ipynb",
    "07_portfolio_optimization.ipynb",
    "08_risk_analysis.ipynb",
    "09_paper_results.ipynb",
]


def execute_notebook(input_path: Path, output_path: Path, parameters: Dict[str, Any]) -> Dict[str, Any]:
    start_time = time.time()
    pm.execute_notebook(
        input_path=str(input_path),
        output_path=str(output_path),
        parameters=parameters,
        log_output=True,
        progress_bar=False,
    )
    duration = time.time() - start_time
    return {
        "notebook": input_path.name,
        "output": str(output_path),
        "duration_seconds": round(duration, 2),
    }


def execute_notebook_batch(notebook_list: List[str], notebooks_dir: Path, output_dir: Path) -> Dict[str, Any]:
    results: Dict[str, Any] = {
        "notebooks_executed": 0,
        "notebooks_failed": 0,
        "execution_times": {},
        "outputs": {},
        "errors": [],
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    for notebook_name in notebook_list:
        input_path = notebooks_dir / notebook_name
        output_path = output_dir / f"{input_path.stem}_output.ipynb"
        try:
            info = execute_notebook(input_path, output_path, parameters={})
            results["notebooks_executed"] += 1
            results["execution_times"][input_path.stem] = info["duration_seconds"]
            results["outputs"][input_path.stem] = info["output"]
        except Exception as exc:
            results["notebooks_failed"] += 1
            results["errors"].append({"notebook": notebook_name, "error": str(exc)})
    return results


def validate_notebook_outputs(output_path: Path) -> bool:
    return output_path.exists()


def extract_notebook_metrics(report: Dict[str, Any], output_path: Path) -> Dict[str, Any]:
    metrics = report.copy()
    metrics["validated_outputs"] = {
        name: validate_notebook_outputs(Path(path)) for name, path in report["outputs"].items()
    }
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Execute notebooks via papermill")
    parser.add_argument("--notebooks-dir", required=True, help="Directory containing notebooks")
    parser.add_argument("--output-dir", required=True, help="Directory for executed notebooks")
    parser.add_argument("--report", required=True, help="JSON report output path")
    parser.add_argument("--single", default="", help="Execute a single notebook by name")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    notebooks_dir = Path(args.notebooks_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.single:
        notebooks = [args.single]
    else:
        notebooks = DEFAULT_ORDER

    report = execute_notebook_batch(notebooks, notebooks_dir, output_dir)
    report = extract_notebook_metrics(report, output_dir)

    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    with open(args.report, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)


if __name__ == "__main__":
    main()

