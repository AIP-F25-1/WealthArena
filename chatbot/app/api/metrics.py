"""
WealthArena Metrics API
Endpoints for system metrics and monitoring
"""

from fastapi import APIRouter, Response, HTTPException
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
api_router = APIRouter()

# Try Prometheus integration if available
try:
    from app.metrics.prom import get_metrics_response  # type: ignore
    _HAS_PROM = True
except Exception:
    _HAS_PROM = False
    get_metrics_response = None  # type: ignore

@router.get("/metrics")
def metrics():
    """
    Prometheus metrics endpoint with fallback
    """
    if _HAS_PROM and callable(get_metrics_response):
        # Return Prometheus-formatted metrics
        return get_metrics_response()
    # JSON fallback keeps the app bootable without prom client
    return {"status": "ok", "metrics": "fallback", "note": "Prometheus client not available"}

# JSON endpoint: GET /v1/metrics/system
@api_router.get("/system")
async def get_system_metrics():
    """
    Get system-wide metrics
    """
    return {
        "message": "System metrics endpoint",
        "available_metrics": [
            "/metrics - Prometheus metrics"
        ]
    }

