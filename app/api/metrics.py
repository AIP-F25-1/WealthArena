"""
WealthArena Metrics API
Endpoints for system metrics and monitoring
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from ..tools.news_ingest import rss_metrics

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/rss", response_model=Dict[str, Any])
async def get_rss_metrics():
    """
    Get RSS feed ingestion metrics
    
    Returns comprehensive metrics about RSS feed fetching including:
    - Success percentage
    - Error rates
    - Throughput (pages per minute)
    - Response times
    - Per-feed statistics
    """
    try:
        metrics = rss_metrics()
        return metrics
    except Exception as e:
        logger.error(f"Error retrieving RSS metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve RSS metrics: {str(e)}"
        )

@router.get("/system")
async def get_system_metrics():
    """
    Get system-wide metrics (placeholder for future expansion)
    """
    return {
        "message": "System metrics endpoint - to be implemented",
        "available_metrics": [
            "/metrics/rss - RSS feed ingestion metrics"
        ]
    }

