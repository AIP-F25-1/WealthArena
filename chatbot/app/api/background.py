"""
Background Job Status API
Endpoints for monitoring background job health and status
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from pydantic import BaseModel
import logging

from ..background.scheduler import get_scheduler, JobStatus
from ..tools.vector_ingest import get_vector_ingestor

logger = logging.getLogger(__name__)

router = APIRouter()

class JobStatusResponse(BaseModel):
    """Job status response model"""
    name: str
    status: str
    interval_seconds: int
    last_run: str = None
    next_run: str = None
    run_count: int
    success_count: int
    error_count: int
    error_message: str = None

class BackgroundStatusResponse(BaseModel):
    """Background scheduler status response"""
    scheduler_running: bool
    jobs: Dict[str, JobStatusResponse]
    collections: Dict[str, Dict[str, Any]]

@router.get("/background/status", response_model=BackgroundStatusResponse)
async def get_background_status():
    """
    Get status of all background jobs and vector store collections
    
    Returns:
        BackgroundStatusResponse with job statuses and collection stats
    """
    scheduler = get_scheduler()
    
    if not scheduler:
        raise HTTPException(
            status_code=503,
            detail="Background scheduler not initialized"
        )
    
    # Get job status
    job_status = scheduler.get_job_status()
    
    # Get collection stats
    ingestor = get_vector_ingestor()
    collections = {
        "pdf_documents": ingestor.get_collection_stats("pdf_documents")
    }
    
    # Format response
    jobs_dict = {}
    for job_name, job_data in job_status.get("jobs", {}).items():
        jobs_dict[job_name] = JobStatusResponse(**job_data)
    
    return BackgroundStatusResponse(
        scheduler_running=job_status.get("scheduler_running", False),
        jobs=jobs_dict,
        collections=collections
    )

@router.post("/background/trigger/pdf")
async def trigger_pdf_job():
    """
    Manually trigger PDF ingestion job (admin only)
    
    Returns:
        Success message
    """
    scheduler = get_scheduler()
    
    if not scheduler:
        raise HTTPException(
            status_code=503,
            detail="Background scheduler not initialized"
        )
    
    job = scheduler.jobs.get("pdf_ingestion")
    if not job:
        raise HTTPException(
            status_code=404,
            detail="PDF ingestion job not found"
        )
    
    # Check if job is already running
    if job.status == JobStatus.RUNNING:
        raise HTTPException(
            status_code=409,
            detail="PDF ingestion job is already running"
        )
    
    # Try to acquire lock (non-blocking check)
    if job.lock.locked():
        raise HTTPException(
            status_code=409,
            detail="PDF ingestion job is already running"
        )
    
    try:
        async with job.lock:
            await scheduler._run_pdf_ingestion_job()
        return {
            "status": "success",
            "message": "PDF ingestion job completed"
        }
    except Exception as e:
        logger.error(f"Error triggering PDF job: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"PDF ingestion job failed: {str(e)}"
        )


