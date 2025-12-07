"""
collect_pipeline_metrics.py

Purpose:
    Parse log files from script executions and extract performance metrics.

Author: Clifford Addison
Company: WealthArena
Year: 2025
"""

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional


START_PATTERN = re.compile(r"Started at (?P<timestamp>.+)")
END_PATTERN = re.compile(r"Completed at (?P<timestamp>.+)")
ERROR_PATTERN = re.compile(r"(ERROR|WARNING)")
RESOURCE_PATTERN = re.compile(r"CPU:(?P<cpu>\d+)%\s+MEM:(?P<mem>\d+\.\d+)GB\s+DISK:(?P<disk>\d+)")


def parse_timestamp(raw: str) -> Optional[datetime]:
    value = raw.strip()
    formats = (
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
    )
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def parse_log_file(log_path: Path) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {
        "response_time_seconds": 0.0,
        "error_rate_percent": 0.0,
        "cpu_utilization_percent": 0.0,
        "memory_utilization_gb": 0.0,
        "disk_io_mbps": 0.0,
        "errors": 0,
        "warnings": 0,
        "entries": 0,
    }

    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    with log_path.open("r", encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            metrics["entries"] += 1
            match = ERROR_PATTERN.search(line)
            if match:
                if match.group(1) == "ERROR":
                    metrics["errors"] += 1
                else:
                    metrics["warnings"] += 1

            resource = RESOURCE_PATTERN.search(line)
            if resource:
                metrics["cpu_utilization_percent"] = max(
                    metrics["cpu_utilization_percent"], int(resource.group("cpu"))
                )
                metrics["memory_utilization_gb"] = max(
                    metrics["memory_utilization_gb"], float(resource.group("mem"))
                )
                metrics["disk_io_mbps"] = max(
                    metrics["disk_io_mbps"], int(resource.group("disk"))
                )

            start_match = START_PATTERN.search(line)
            if start_match and not start_time:
                start_time = parse_timestamp(start_match.group("timestamp"))

            end_match = END_PATTERN.search(line)
            if end_match:
                parsed_end = parse_timestamp(end_match.group("timestamp"))
                if parsed_end:
                    end_time = parsed_end

    if metrics["entries"]:
        metrics["error_rate_percent"] = round(
            (metrics["errors"] / metrics["entries"]) * 100, 2
        )

    if start_time and end_time and end_time > start_time:
        duration = (end_time - start_time).total_seconds()
        metrics["response_time_seconds"] = round(duration, 2)

    return metrics


def collect_all_pipeline_metrics(logs_dir: Path) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    if not logs_dir.exists():
        return result

    durations = []
    for log_file in logs_dir.glob("*.log"):
        key = log_file.stem
        parsed = parse_log_file(log_file)
        result[key] = parsed
        if parsed.get("response_time_seconds"):
            durations.append(parsed["response_time_seconds"])

    if durations:
        result["_summary"] = {
            "average_response_time_seconds": round(sum(durations) / len(durations), 2),
            "max_response_time_seconds": max(durations),
        }

    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect pipeline metrics")
    parser.add_argument("--logs-dir", required=True, help="Directory containing logs")
    parser.add_argument("--output", required=True, help="Output JSON path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metrics = collect_all_pipeline_metrics(Path(args.logs_dir))
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)


if __name__ == "__main__":
    main()

