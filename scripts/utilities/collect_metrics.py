#!/usr/bin/env python3
"""
Metrics Collection Script
Collects metrics from all services and generates progress report format
"""

import os
import sys
import json
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

# Add rl-training to path
project_root = Path(__file__).parent.parent
rl_training_path = project_root / 'rl-training'
if rl_training_path.exists():
    sys.path.insert(0, str(rl_training_path))

try:
    from src.metrics.comprehensive_metrics import MetricsCollector
    METRICS_COLLECTOR_AVAILABLE = True
except ImportError:
    METRICS_COLLECTOR_AVAILABLE = False
    print("Warning: comprehensive_metrics not available")

# Configuration
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:3000')
RL_SERVICE_URL = os.getenv('RL_SERVICE_URL', 'http://localhost:5002')
DATA_PIPELINE_DIR = project_root / 'data-pipeline'
RL_TRAINING_RESULTS = rl_training_path / 'results' / 'performance_metrics.json'


def fetch_backend_metrics() -> Optional[Dict[str, Any]]:
    """Fetch metrics from backend /api/metrics endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/metrics", timeout=5)
        if response.status_code == 200:
            # Parse Prometheus format
            metrics_text = response.text
            # Simple parsing - in production, use prometheus_client
            return {"status": "success", "metrics": metrics_text}
    except Exception as e:
        print(f"Error fetching backend metrics: {e}")
    return None


def fetch_rl_service_metrics() -> Optional[Dict[str, Any]]:
    """Fetch metrics from rl-service /api/metrics/summary endpoint"""
    try:
        response = requests.get(f"{RL_SERVICE_URL}/api/metrics/summary", timeout=5)
        if response.status_code == 200:
            if response.headers.get('content-type', '').startswith('text/plain'):
                # Prometheus format
                return {"status": "success", "metrics": response.text}
            else:
                # JSON format
                return response.json()
    except Exception as e:
        print(f"Error fetching RL service metrics: {e}")
    return None


def parse_data_pipeline_summaries() -> Dict[str, Any]:
    """Parse data pipeline JSON summaries"""
    summaries = {}
    
    if not DATA_PIPELINE_DIR.exists():
        return summaries
    
    summary_files = [
        'raw_download_summary.json',
        'crypto_download_summary.json',
        'forex_download_summary.json',
        'commodities_download_summary.json',
        'etf_download_summary.json',
        'orchestrator_summary.json'
    ]
    
    for filename in summary_files:
        filepath = DATA_PIPELINE_DIR / filename
        if filepath.exists():
            try:
                with open(filepath, 'r') as f:
                    summaries[filename.replace('_summary.json', '')] = json.load(f)
            except Exception as e:
                print(f"Error parsing {filename}: {e}")
    
    return summaries


def parse_rl_training_metrics() -> Optional[Dict[str, Any]]:
    """Parse RL training performance metrics"""
    if not RL_TRAINING_RESULTS.exists():
        return None
    
    try:
        with open(RL_TRAINING_RESULTS, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error parsing RL training metrics: {e}")
        return None


def generate_progress_report_metrics() -> str:
    """Generate progress report metrics in markdown format"""
    
    # Collect metrics
    backend_metrics = fetch_backend_metrics()
    rl_service_metrics = fetch_rl_service_metrics()
    data_pipeline_summaries = parse_data_pipeline_summaries()
    rl_training_metrics = parse_rl_training_metrics()
    
    # Use comprehensive_metrics if available
    if METRICS_COLLECTOR_AVAILABLE:
        collector = MetricsCollector()
        collector.export_progress_report_metrics("PROGRESS_REPORT_METRICS.md")
        return "PROGRESS_REPORT_METRICS.md"
    
    # Fallback: Generate basic report
    report_lines = [
        "# Progress Report Metrics",
        "",
        f"Generated: {datetime.now().isoformat()}",
        "",
        "## Data Store Metrics",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        "| Index Usage % | N/A |",
        "| Disk Usage % | N/A |",
        "| CPU % | N/A |",
        "| Memory % | N/A |",
        "| Connections | N/A |",
        "| Error Rate | N/A |",
        "",
        "## BE/Pipeline Metrics",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Backend Status | {'Connected' if backend_metrics else 'Not Available'} |",
        f"| RL Service Status | {'Connected' if rl_service_metrics else 'Not Available'} |",
        "",
        "## Code Metrics",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        "| Cyclomatic Complexity | N/A |",
        "| Duplication Rate | N/A |",
        "| Technical Debt | N/A |",
        "",
        "## ML Metrics",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        "| Inference Time | N/A |",
        "| RMSE | N/A |",
        "| AUC | N/A |",
        "| F1 Score | N/A |",
        "",
        "## Testing Metrics",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        "| Coverage % | N/A |",
        "| Failure Rate | N/A |",
        "| Bug Detection % | N/A |"
    ]
    
    report_content = "\n".join(report_lines)
    
    output_path = "PROGRESS_REPORT_METRICS.md"
    with open(output_path, "w") as f:
        f.write(report_content)
    
    # Save aggregated metrics as JSON
    aggregated = {
        "timestamp": datetime.now().isoformat(),
        "backend_metrics": backend_metrics,
        "rl_service_metrics": rl_service_metrics,
        "data_pipeline_summaries": data_pipeline_summaries,
        "rl_training_metrics": rl_training_metrics
    }
    
    with open("metrics_summary.json", "w") as f:
        json.dump(aggregated, f, indent=2, default=str)
    
    print(f"Metrics report generated: {output_path}")
    print(f"Metrics JSON saved: metrics_summary.json")
    
    return output_path


if __name__ == "__main__":
    generate_progress_report_metrics()

