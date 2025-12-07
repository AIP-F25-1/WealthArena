"""
Background Scheduler Module
Manages periodic scraping and ingestion tasks using asyncio
"""

import os
import asyncio
import logging
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

from ..tools.document_processor import get_document_processor
from ..tools.vector_ingest import get_vector_ingestor
from ..metrics.prom import (
    record_background_job,
    record_ingest_operation,
    update_vector_store_size
)

logger = logging.getLogger(__name__)

class JobStatus(str, Enum):
    """Job status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    DISABLED = "disabled"

@dataclass
class ScheduledJob:
    """Represents a scheduled background job"""
    name: str
    interval_seconds: int
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    status: JobStatus = JobStatus.PENDING
    error_message: Optional[str] = None
    run_count: int = 0
    success_count: int = 0
    error_count: int = 0
    lock: Optional[asyncio.Lock] = None
    
    def __post_init__(self):
        """Initialize lock after dataclass creation"""
        if self.lock is None:
            self.lock = asyncio.Lock()

class BackgroundScheduler:
    """Background scheduler for periodic tasks"""
    
    def __init__(self):
        """Initialize background scheduler"""
        self.jobs: Dict[str, ScheduledJob] = {}
        self.tasks: Dict[str, asyncio.Task] = {}
        self.running = False
        
        # Load configuration from environment
        self.pdf_ingest_interval_hours = int(os.getenv("PDF_INGEST_INTERVAL_HOURS", "24"))
        self.enable_pdf_ingest = os.getenv("ENABLE_PDF_INGESTION", "true").lower() == "true"
        
        # Initialize jobs
        if self.enable_pdf_ingest:
            self.jobs["pdf_ingestion"] = ScheduledJob(
                name="pdf_ingestion",
                interval_seconds=self.pdf_ingest_interval_hours * 3600,
                status=JobStatus.PENDING
            )
        
        logger.info(f"Background scheduler initialized with {len(self.jobs)} jobs")
    
    async def start(self):
        """Start all background tasks"""
        if self.running:
            logger.warning("Scheduler already running")
            return
        
        self.running = True
        logger.info("Starting background scheduler...")
        
        # Start each job
        for job_name, job in self.jobs.items():
            if job.status != JobStatus.DISABLED:
                task = asyncio.create_task(self._run_job_loop(job_name))
                self.tasks[job_name] = task
                logger.info(f"Started background job: {job_name}")
        
        logger.info(f"Background scheduler started with {len(self.tasks)} active jobs")
    
    async def stop(self):
        """Stop all background tasks"""
        if not self.running:
            return
        
        logger.info("Stopping background scheduler...")
        self.running = False
        
        # Cancel all tasks
        for job_name, task in self.tasks.items():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                logger.info(f"Cancelled background job: {job_name}")
        
        self.tasks.clear()
        logger.info("Background scheduler stopped")
    
    async def _run_job_loop(self, job_name: str):
        """Run a job in a loop with specified interval"""
        job = self.jobs.get(job_name)
        if not job:
            logger.error(f"Job {job_name} not found")
            return
        
        # Calculate initial delay (run immediately on startup)
        job.next_run = datetime.now()
        
        while self.running:
            try:
                # Wait until next run time
                now = datetime.now()
                if job.next_run and job.next_run > now:
                    wait_seconds = (job.next_run - now).total_seconds()
                    await asyncio.sleep(wait_seconds)
                
                # Acquire lock to prevent overlapping runs
                async with job.lock:
                    # Run the job
                    job.status = JobStatus.RUNNING
                    job.last_run = datetime.now()
                    job.run_count += 1
                    
                    logger.info(f"Running background job: {job_name}")
                    
                    job_start_time = time.time()
                    try:
                        if job_name == "pdf_ingestion":
                            await self._run_pdf_ingestion_job()
                        
                        job.status = JobStatus.SUCCESS
                        job.success_count += 1
                        job.error_message = None
                        duration = time.time() - job_start_time
                        record_background_job(job_name, "success", duration)
                        logger.info(f"Background job {job_name} completed successfully")
                        
                    except Exception as e:
                        job.status = JobStatus.ERROR
                        job.error_count += 1
                        job.error_message = str(e)
                        duration = time.time() - job_start_time
                        record_background_job(job_name, "error", duration)
                        logger.error(f"Background job {job_name} failed: {e}")
                
                # Schedule next run
                if job.interval_seconds > 0:
                    job.next_run = datetime.now() + timedelta(seconds=job.interval_seconds)
                else:
                    # If interval is 0, stop the job
                    break
                
            except asyncio.CancelledError:
                logger.info(f"Job {job_name} cancelled")
                break
            except Exception as e:
                logger.error(f"Unexpected error in job {job_name}: {e}")
                job.status = JobStatus.ERROR
                job.error_message = str(e)
                # Wait before retrying
                await asyncio.sleep(60)
    
    async def _run_pdf_ingestion_job(self):
        """Run PDF ingestion job"""
        logger.info("Starting PDF ingestion job...")
        
        try:
            import subprocess
            import sys
            from pathlib import Path
            
            # Get path to PDF ingestion script
            script_path = Path(__file__).parent.parent.parent / "scripts" / "pdf_ingest.py"
            
            if not script_path.exists():
                logger.error(f"PDF ingestion script not found: {script_path}")
                return
            
            # Run PDF ingestion script
            result = subprocess.run(
                [sys.executable, str(script_path)],
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )
            
            if result.returncode == 0:
                logger.info("PDF ingestion job completed successfully")
                # Update vector store size
                ingestor = get_vector_ingestor()
                stats = ingestor.get_collection_stats("pdf_documents")
                if stats.get("exists"):
                    update_vector_store_size("pdf_documents", stats.get("count", 0))
            else:
                logger.error(f"PDF ingestion job failed: {result.stderr}")
        except Exception as e:
            logger.error(f"Error running PDF ingestion job: {e}")
    
    def get_job_status(self) -> Dict[str, Any]:
        """
        Get status of all jobs
        
        Returns:
            Dictionary with job statuses
        """
        status = {
            "scheduler_running": self.running,
            "jobs": {}
        }
        
        for job_name, job in self.jobs.items():
            status["jobs"][job_name] = {
                "name": job.name,
                "status": job.status.value,
                "interval_seconds": job.interval_seconds,
                "last_run": job.last_run.isoformat() if job.last_run else None,
                "next_run": job.next_run.isoformat() if job.next_run else None,
                "run_count": job.run_count,
                "success_count": job.success_count,
                "error_count": job.error_count,
                "error_message": job.error_message
            }
        
        return status

# Global scheduler instance
_scheduler = None

def get_scheduler() -> Optional[BackgroundScheduler]:
    """Get the global scheduler instance"""
    return _scheduler

def set_scheduler(scheduler: BackgroundScheduler):
    """Set the global scheduler instance"""
    global _scheduler
    _scheduler = scheduler

