"""
collect_scraping_metrics.py

Purpose:
    Analyze data collection logs to extract scraping performance metrics.

Author: Clifford Addison
Company: WealthArena
Year: 2025
"""

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional


SUCCESS_PATTERN = re.compile(r"Successfully collected (?P<source>\w+)")
FAILURE_PATTERN = re.compile(r"Failed to fetch (?P<source>\w+).+status (?P<status>\d+)")
BLOCK_PATTERN = re.compile(r"Blocked request (?P<source>\w+)")
RESPONSE_PATTERN = re.compile(r"Response time (?P<value>\d+\.\d+)s")
TIMESTAMP_PATTERN = re.compile(r"(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})")


def parse_timestamp(value: str) -> Optional[datetime]:
    value = value.strip()
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


def parse_collection_logs(log_dir: Path) -> Dict[str, Any]:
    metrics: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "success_count": 0,
            "failure_count": 0,
            "blocked_count": 0,
            "status_codes": defaultdict(int),
            "response_times": [],
            "first_timestamp": None,
            "last_timestamp": None,
        }
    )

    for log_file in log_dir.glob("*.log"):
        current_source: Optional[str] = None
        with log_file.open("r", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                ts = None
                ts_match = TIMESTAMP_PATTERN.search(line)
                if ts_match:
                    ts = parse_timestamp(ts_match.group("ts"))

                success = SUCCESS_PATTERN.search(line)
                if success:
                    source = success.group("source").lower()
                    metrics[source]["success_count"] += 1
                    current_source = source
                    if ts:
                        entry = metrics[source]
                        if not entry["first_timestamp"] or ts < entry["first_timestamp"]:
                            entry["first_timestamp"] = ts
                        if not entry["last_timestamp"] or ts > entry["last_timestamp"]:
                            entry["last_timestamp"] = ts
                    continue

                failure = FAILURE_PATTERN.search(line)
                if failure:
                    source = failure.group("source").lower()
                    metrics[source]["failure_count"] += 1
                    metrics[source]["status_codes"][failure.group("status")] += 1
                    current_source = source
                    if ts:
                        entry = metrics[source]
                        if not entry["first_timestamp"] or ts < entry["first_timestamp"]:
                            entry["first_timestamp"] = ts
                        if not entry["last_timestamp"] or ts > entry["last_timestamp"]:
                            entry["last_timestamp"] = ts
                    continue

                blocked = BLOCK_PATTERN.search(line)
                if blocked:
                    source = blocked.group("source").lower()
                    metrics[source]["blocked_count"] += 1
                    current_source = source
                    if ts:
                        entry = metrics[source]
                        if not entry["first_timestamp"] or ts < entry["first_timestamp"]:
                            entry["first_timestamp"] = ts
                        if not entry["last_timestamp"] or ts > entry["last_timestamp"]:
                            entry["last_timestamp"] = ts
                    continue

                response = RESPONSE_PATTERN.search(line)
                if response and current_source:
                    try:
                        metrics[current_source]["response_times"].append(
                            float(response.group("value"))
                        )
                    except ValueError:
                        continue

    return metrics


def load_expected_counts(audit_dir: Path) -> Dict[str, int]:
    expected: Dict[str, int] = {}
    if not audit_dir.exists():
        return expected

    for json_file in audit_dir.glob("*.json"):
        try:
            with json_file.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception:
            continue

        if isinstance(data, dict):
            for key, value in data.items():
                key_lower = str(key).lower()
                if isinstance(value, dict):
                    for candidate in ("expected", "expected_count", "expected_items", "total_expected"):
                        if candidate in value and isinstance(value[candidate], (int, float)):
                            expected[key_lower] = int(value[candidate])
                            break
                elif isinstance(value, (int, float)):
                    expected[key_lower] = int(value)
    return expected


def calculate_throughput(metrics: Dict[str, Any], expected_counts: Dict[str, int]) -> Dict[str, Any]:
    result = {}
    for source, values in metrics.items():
        if source.startswith("_"):
            continue

        total = values["success_count"] + values["failure_count"]
        expected_total = expected_counts.get(source, total)
        if expected_total < total:
            expected_total = total

        if total == 0:
            success_percent = 0.0
            error_rate = 0.0
        else:
            success_percent = round((values["success_count"] / total) * 100, 2)
            error_rate = round((values["failure_count"] / total) * 100, 2)

        first_ts = values.get("first_timestamp")
        last_ts = values.get("last_timestamp")
        duration_minutes = 0.0
        if first_ts and last_ts and last_ts > first_ts:
            duration_minutes = (last_ts - first_ts).total_seconds() / 60
        throughput = values["success_count"]
        if duration_minutes > 0:
            throughput = round(values["success_count"] / duration_minutes, 2)

        if expected_total > 0:
            data_loss_percent = round(
                max(expected_total - values["success_count"], 0) / expected_total * 100, 2
            )
        else:
            data_loss_percent = 0.0

        response_times = values.get("response_times", [])
        result[source] = {
            "success_percent": success_percent,
            "blocked_percent": 0.0 if expected_total == 0 else round((values["blocked_count"] / expected_total) * 100, 2),
            "error_rate_percent": error_rate,
            "error_breakdown": dict(values["status_codes"]),
            "throughput_per_minute": throughput,
            "data_loss_percent": data_loss_percent,
            "avg_response_time_seconds": (
                round(sum(response_times) / len(response_times), 2)
                if response_times
                else 0.0
            ),
            "ip_blocks": values["blocked_count"],
            "pages_scraped": values["success_count"],
            "duration_minutes": round(duration_minutes, 2),
            "expected_records": expected_total,
        }
    return result


def collect_all_scraping_metrics(log_dir: Path, audit_dir: Optional[Path] = None) -> Dict[str, Any]:
    raw_metrics = parse_collection_logs(log_dir)
    expected_counts = load_expected_counts(audit_dir) if audit_dir and audit_dir.exists() else {}
    return calculate_throughput(raw_metrics, expected_counts)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect scraping metrics")
    parser.add_argument("--logs-dir", required=True, help="Directory with scraping logs")
    parser.add_argument("--audit-dir", default="", help="Audit directory (unused placeholder)")
    parser.add_argument("--output", required=True, help="Output JSON path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    audit_path = Path(args.audit_dir) if args.audit_dir else None
    metrics = collect_all_scraping_metrics(Path(args.logs_dir), audit_path)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)


if __name__ == "__main__":
    main()

