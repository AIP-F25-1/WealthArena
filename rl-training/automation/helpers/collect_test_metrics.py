"""
collect_test_metrics.py

Purpose:
    Parse pytest output and coverage reports to extract test metrics.

Author: Clifford Addison
Company: WealthArena
Year: 2025
"""

import argparse
import json
from pathlib import Path
from typing import Dict, Any, List, Optional


def parse_pytest_json(json_path: Path) -> Dict[str, Any]:
    if not json_path.exists():
        return {}
    with json_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    summary = data.get("summary", {})
    tests = data.get("tests", [])
    return {
        "summary": summary,
        "tests": tests,
    }


def parse_coverage_json(json_path: Path) -> Dict[str, Any]:
    if not json_path.exists():
        return {}
    with json_path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def categorize_test_results(tests: List[Dict[str, Any]]) -> Dict[str, Any]:
    modules: Dict[str, Dict[str, Any]] = {}
    for test in tests:
        nodeid = test.get("nodeid", "")
        outcome = test.get("outcome", "")
        module = nodeid.split("::")[0]
        module_entry = modules.setdefault(
            module,
            {
                "tests_passed": 0,
                "tests_failed": 0,
                "tests_skipped": 0,
                "failures": [],
            },
        )
        if outcome == "passed":
            module_entry["tests_passed"] += 1
        elif outcome == "failed":
            module_entry["tests_failed"] += 1
            module_entry["failures"].append(nodeid)
        elif outcome == "skipped":
            module_entry["tests_skipped"] += 1
    return modules


def compare_with_previous(current: Dict[str, Any], previous_path: Optional[Path]) -> Dict[str, List[str]]:
    if not previous_path or not previous_path.is_file():
        return {"fixed_since_last": [], "still_failing": current, "new_failures": current}

    with previous_path.open("r", encoding="utf-8") as fh:
        previous = json.load(fh)

    previous_failures = set(previous.get("still_failing", []))
    current_failures = set(current.get("still_failing", []))

    return {
        "fixed_since_last": sorted(previous_failures - current_failures),
        "still_failing": sorted(previous_failures & current_failures),
        "new_failures": sorted(current_failures - previous_failures),
    }


def collect_all_test_metrics(
    pytest_json: Path, coverage_json: Path, previous_metrics: Path = None
) -> Dict[str, Any]:
    pytest_data = parse_pytest_json(pytest_json)
    coverage_data = parse_coverage_json(coverage_json)

    summary = pytest_data.get("summary", {})
    modules = categorize_test_results(pytest_data.get("tests", []))

    still_failing = []
    for module, data in modules.items():
        still_failing.extend(data.get("failures", []))

    trends = compare_with_previous(
        {"still_failing": still_failing}, previous_metrics
    )

    return {
        "summary": {
            "total_tests": summary.get("total", 0),
            "passed": summary.get("passed", 0),
            "failed": summary.get("failed", 0),
            "skipped": summary.get("skipped", 0),
            "coverage_percent": coverage_data.get("totals", {}).get("percent_covered", 0),
        },
        "by_module": modules,
        "fixed_since_last": trends["fixed_since_last"],
        "still_failing": trends["still_failing"],
        "new_failures": trends["new_failures"],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect testing metrics")
    parser.add_argument("--test-report", required=True, help="Pytest JSON report path")
    parser.add_argument("--coverage-report", required=True, help="Coverage JSON report path")
    parser.add_argument("--previous", default="", help="Previous metrics JSON path")
    parser.add_argument("--output", required=True, help="Output JSON path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    previous_path = Path(args.previous) if args.previous else None
    metrics = collect_all_test_metrics(
        pytest_json=Path(args.test_report),
        coverage_json=Path(args.coverage_report),
        previous_metrics=previous_path,
    )
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)


if __name__ == "__main__":
    main()

