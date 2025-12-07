#!/usr/bin/env python3
"""Validate the integrity of metrics/runtime_http.json"""

import sys

# Fix Unicode/Emoji support (Python 3.7+)
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    # Python 3.6 or earlier - reconfigure() not available
    # Fall back to environment variable or accept default encoding
    pass

import json
from pathlib import Path
from datetime import datetime, timedelta


def validate_metrics_file(filepath="metrics/runtime_http.json"):
    """Validate metrics file and return (is_valid, issues, recommendations)"""
    metrics_path = Path(filepath)
    
    # Check if file exists
    if not metrics_path.exists():
        return False, ["Metrics file not found"], ["Generate metrics with: python scripts/print_metrics.py"]
    
    # Try to parse JSON
    try:
        with open(metrics_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, [f"Invalid JSON format: {e}"], ["Regenerate metrics with: python scripts/print_metrics.py"]
    except Exception as e:
        return False, [f"Error reading file: {e}"], ["Check file permissions and try again"]
    
    issues = []
    recommendations = []
    
    # Check overall success rate
    overall = data.get("overall", {})
    success_rate = overall.get("success_rate_pct", 0.0)
    successful_requests = overall.get("successful_requests", 0)
    total_requests = overall.get("total_requests", 0)
    
    if success_rate == 0.0:
        issues.append(f"Success rate is 0% ({total_requests} failed requests)")
        if successful_requests == 0:
            issues.append("All endpoints show 0 successful requests")
            issues.append("This indicates the server was not running during the test")
    
    if successful_requests == 0 and total_requests > 0:
        issues.append("All requests failed - server was likely down")
    
    # Check timestamp (should be recent, within last 24 hours)
    timestamp_str = data.get("timestamp", "")
    if timestamp_str:
        try:
            # Try parsing ISO format
            if "T" in timestamp_str:
                timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            else:
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S")
            
            age = datetime.now() - timestamp.replace(tzinfo=None) if timestamp.tzinfo else datetime.now() - timestamp
            if age > timedelta(days=1):
                issues.append(f"Metrics file is {age.days} days old (may be stale)")
        except:
            pass  # Ignore timestamp parsing errors
    
    # Check latency values (should be > 0 if requests succeeded)
    if successful_requests > 0:
        avg_latency = overall.get("avg_latency_ms", 0.0)
        if avg_latency == 0.0:
            issues.append("Average latency is 0.0ms despite successful requests (unusual)")
    
    # Check validation metadata if present
    validation = data.get("validation", {})
    if validation:
        if not validation.get("server_reachable", False):
            issues.append("Validation metadata indicates server was not reachable")
        if not validation.get("test_run_valid", True):
            issues.append("Validation metadata indicates test run was invalid")
            error_msg = validation.get("error_message")
            if error_msg:
                issues.append(f"  Error: {error_msg}")
            recommendation = validation.get("recommendation")
            if recommendation:
                recommendations.append(recommendation)
    
    # Check endpoint success rates
    endpoints = data.get("endpoints", {})
    all_endpoints_zero = True
    for endpoint_name, endpoint_data in endpoints.items():
        endpoint_success_rate = endpoint_data.get("success_rate_pct", 0.0)
        if endpoint_success_rate > 0:
            all_endpoints_zero = False
            break
    
    if all_endpoints_zero and endpoints:
        issues.append("All endpoint success rates are 0%")
    
    # Determine if valid
    is_valid = len(issues) == 0 and success_rate > 0
    
    # Build recommendations if invalid
    if not is_valid:
        if not recommendations:
            recommendations.append("1. Start server: powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1")
            recommendations.append("2. Verify health: python scripts/check_server.py")
            recommendations.append("3. Regenerate metrics: python scripts/print_metrics.py")
    
    return is_valid, issues, recommendations


def main():
    """Main validation function"""
    print("=" * 70)
    print("WealthArena Metrics File Validation")
    print("=" * 70)
    print()
    
    is_valid, issues, recommendations = validate_metrics_file()
    
    if is_valid:
        print("✅ VALID METRICS FILE")
        print()
        print("Metrics file is valid and contains successful test results.")
        return 0
    else:
        print("❌ INVALID METRICS FILE")
        print()
        
        if issues:
            print("Issues found:")
            for issue in issues:
                print(f"  • {issue}")
            print()
        
        if recommendations:
            print("Recommendation:")
            for rec in recommendations:
                print(f"  {rec}")
            print()
        
        return 1


if __name__ == "__main__":
    sys.exit(main())

