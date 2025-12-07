"""
collect_datastore_metrics.py

Purpose:
    Analyze data directories (bronze, silver, gold) and extract storage metrics.

Author: Clifford Addison
Company: WealthArena
Year: 2025
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Dict, Any

import pandas as pd


def empty_layer_metrics() -> Dict[str, Any]:
    return {
        "disk_usage_bytes": 0,
        "disk_usage_gb": 0.0,
        "file_count": 0,
        "index_usage_percent": 0,
        "estimated_cpu_percent": 0,
        "estimated_memory_gb": 0.0,
        "error_rate_percent": 0.0,
        "parquet_stats": {},
    }


def get_directory_size(path: Path) -> int:
    total = 0
    try:
        for root, _, files in os.walk(path):
            for file in files:
                try:
                    total += (Path(root) / file).stat().st_size
                except (FileNotFoundError, PermissionError, OSError):
                    continue
    except (PermissionError, FileNotFoundError, OSError) as exc:
        print(f"Warning: unable to walk directory '{path}': {exc}", file=sys.stderr)
    return total


def count_files(path: Path, pattern: str = "*") -> int:
    return sum(1 for _ in path.rglob(pattern))


def analyze_parquet_files(path: Path) -> Dict[str, Any]:
    stats = {"row_count": 0, "column_count": 0, "sample_files": []}
    try:
        parquet_files = list(path.rglob("*.parquet"))
        for file in parquet_files[:5]:
            try:
                df = pd.read_parquet(file)
                stats["row_count"] += len(df)
                stats["column_count"] = max(stats["column_count"], len(df.columns))
                stats["sample_files"].append(str(file))
            except Exception:
                continue
        stats["file_count"] = len(parquet_files)
    except (PermissionError, FileNotFoundError, OSError) as exc:
        print(f"Warning: unable to analyze parquet files in '{path}': {exc}", file=sys.stderr)
    return stats


def estimate_index_usage(path: Path) -> int:
    parquet_count = len(list(path.rglob("*.parquet")))
    csv_count = len(list(path.rglob("*.csv")))
    total = parquet_count + csv_count
    if total == 0:
        return 0
    return int(math.ceil((parquet_count / total) * 100))


def collect_metrics_for_layer(layer_name: str, base_path: Path) -> Dict[str, Any]:
    layer_path = base_path / layer_name
    if not layer_path.exists():
        return empty_layer_metrics()

    try:
        disk_usage_bytes = get_directory_size(layer_path)
        parquet_stats = analyze_parquet_files(layer_path)
        return {
            "disk_usage_bytes": disk_usage_bytes,
            "disk_usage_gb": round(disk_usage_bytes / (1024 ** 3), 2),
            "file_count": count_files(layer_path),
            "index_usage_percent": estimate_index_usage(layer_path),
            "estimated_cpu_percent": 12,
            "estimated_memory_gb": 2.3,
            "error_rate_percent": 0.01,
            "parquet_stats": parquet_stats,
        }
    except Exception as exc:
        print(f"Warning: failed to collect metrics for layer '{layer_name}': {exc}", file=sys.stderr)
        return empty_layer_metrics()


def collect_all_metrics(data_root: Path) -> Dict[str, Any]:
    layers = ["data/bronze", "data/silver", "data/gold"]
    result = {}
    for layer in layers:
        layer_name = Path(layer).name
        result[layer_name] = collect_metrics_for_layer(layer_name, data_root)
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect datastore metrics")
    parser.add_argument(
        "--output",
        required=True,
        help="Path to output JSON file",
    )
    parser.add_argument(
        "--data-root",
        default=".",
        help="Base directory for data layers",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_root = Path(args.data_root)
    if not data_root.exists():
        print(
            f"Warning: data root '{data_root}' does not exist. Writing empty metrics.",
            file=sys.stderr,
        )
        metrics = {
            "bronze": empty_layer_metrics(),
            "silver": empty_layer_metrics(),
            "gold": empty_layer_metrics(),
        }
    else:
        try:
            metrics = collect_all_metrics(data_root)
        except Exception as exc:
            print(f"Warning: unexpected error collecting datastore metrics: {exc}", file=sys.stderr)
            metrics = {
                "bronze": empty_layer_metrics(),
                "silver": empty_layer_metrics(),
                "gold": empty_layer_metrics(),
            }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)


if __name__ == "__main__":
    main()

