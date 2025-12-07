"""
PDF Ingestion Script
Processes PDF files from docs folder and ingests them into the vector database
"""

import os
import sys
import glob
import logging
import time
import traceback
import argparse
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock, Event
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.tools.pdf_processor import get_pdf_processor
from app.tools.document_processor import get_document_processor
from app.tools.vector_ingest import get_vector_ingestor

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


def find_pdf_files(docs_dir: Path) -> List[Path]:
    """
    Find all PDF files in the docs directory recursively
    
    Args:
        docs_dir: Path to docs directory
        
    Returns:
        List of PDF file paths (excluding 'kb' subdirectories)
    """
    pdf_files = []
    
    # Find all PDF files recursively (excluding kb subdirectory)
    for pdf_path in docs_dir.rglob("*.pdf"):
        # Filter out paths that contain 'kb' as a path component
        if 'kb' not in pdf_path.parts:
            pdf_files.append(pdf_path)
    
    return sorted(pdf_files)


def process_pdf_file(
    pdf_path: Path,
    pdf_processor,
    doc_processor,
    ingestor,
    batch_size: int = 100,
    duplicate_check_batch_size: Optional[int] = None,
    full_refresh: bool = False
) -> Dict[str, Any]:
    """
    Process a single PDF file and ingest into vector database
    
    Args:
        pdf_path: Path to PDF file
        pdf_processor: PDF processor instance
        doc_processor: Document processor instance
        ingestor: Vector ingestor instance
        batch_size: Batch size for ingestion
        duplicate_check_batch_size: Batch size for duplicate checking
        
    Returns:
        Dictionary with processing results
    """
    start_time = time.time()
    file_size = pdf_path.stat().st_size
    file_size_mb = file_size / (1024 * 1024)
    
    logger.info(f"Processing PDF: {pdf_path.name} ({file_size_mb:.2f} MB)")
    
    try:
        # Extract text from PDF
        text_extract_start = time.time()
        logger.info(f"Extracting text from {pdf_path.name}...")
        try:
            text = pdf_processor.extract_text(pdf_path)
            text_extract_time = time.time() - text_extract_start
            logger.info(f"Extracted {len(text)} characters from {pdf_path.name} in {text_extract_time:.2f}s")
        except Exception as e:
            logger.error(f"Text extraction failed for {pdf_path.name}: {type(e).__name__}: {e}")
            logger.debug(traceback.format_exc())
            return {
                "status": "error",
                "message": f"Text extraction failed: {type(e).__name__}: {e}",
                "filename": pdf_path.name,
                "file_size": file_size,
                "chunks": 0,
                "elapsed_time": time.time() - start_time
            }
        
        if not text or not text.strip():
            # Check if OCR is enabled and attempt it
            enable_ocr = os.getenv("ENABLE_PDF_OCR", "false").lower() in ("true", "1", "yes")
            if enable_ocr:
                logger.info(f"No selectable text found. Attempting OCR extraction for {pdf_path.name}...")
                try:
                    text = pdf_processor.extract_text_with_ocr(pdf_path)
                    if text and text.strip():
                        logger.info(f"OCR successfully extracted {len(text)} characters from {pdf_path.name}")
                        # Continue processing with OCR-extracted text
                    else:
                        logger.warning(f"OCR did not extract any text from {pdf_path.name}")
                        return {
                            "status": "error",
                            "message": "No text extracted - OCR attempted but returned no text.",
                            "filename": pdf_path.name,
                            "file_size": file_size,
                            "chunks": 0,
                            "elapsed_time": time.time() - start_time
                        }
                except Exception as ocr_error:
                    logger.error(f"OCR extraction failed for {pdf_path.name}: {ocr_error}")
                    return {
                        "status": "error",
                        "message": f"No selectable text extracted and OCR failed: {ocr_error}",
                        "filename": pdf_path.name,
                        "file_size": file_size,
                        "chunks": 0,
                        "elapsed_time": time.time() - start_time
                    }
            else:
                logger.warning(
                    f"No selectable text extracted from {pdf_path.name}. "
                    "This may be a scanned/image-only PDF. Enable OCR by setting ENABLE_PDF_OCR=true "
                    "and installing OCR dependencies (pytesseract, pdf2image)."
                )
                return {
                    "status": "error",
                    "message": "No selectable text extracted - PDF may be scanned/image-only. Enable OCR with ENABLE_PDF_OCR=true.",
                    "filename": pdf_path.name,
                    "file_size": file_size,
                    "chunks": 0,
                    "elapsed_time": time.time() - start_time
                }
        
        # Get PDF metadata
        logger.info(f"Extracting metadata from {pdf_path.name}...")
        try:
            pdf_metadata = pdf_processor.get_pdf_metadata(pdf_path)
        except Exception as e:
            logger.warning(f"Metadata extraction failed for {pdf_path.name}: {e}")
            logger.debug(traceback.format_exc())
            pdf_metadata = {
                "filename": pdf_path.name,
                "file_path": str(pdf_path),
                "file_size": file_size
            }
        
        # Process PDF into chunks
        chunk_start = time.time()
        logger.info(f"Chunking text from {pdf_path.name}...")
        try:
            # Create progress callback for chunking
            last_logged_pct = -1
            def chunking_progress_callback(chunk_num: int, total_chunks: int) -> None:
                """Log chunking progress every 5% or every 50 chunks"""
                nonlocal last_logged_pct
                if total_chunks > 0:
                    pct = int((chunk_num / total_chunks) * 100)
                    # Log every 5% or every 50 chunks, whichever comes first
                    if pct >= last_logged_pct + 5 or chunk_num % 50 == 0:
                        logger.info(f"  Chunking progress: {chunk_num}/{total_chunks} chunks ({pct}%)")
                        last_logged_pct = pct
            
            chunks = doc_processor.process_pdf_document(
                str(pdf_path),
                pdf_metadata,
                text,
                progress_callback=chunking_progress_callback
            )
            chunk_time = time.time() - chunk_start
        except Exception as e:
            logger.error(f"Chunking failed for {pdf_path.name}: {type(e).__name__}: {e}")
            logger.debug(traceback.format_exc())
            return {
                "status": "error",
                "message": f"Chunking failed: {type(e).__name__}: {e}",
                "filename": pdf_path.name,
                "file_size": file_size,
                "chunks": 0,
                "elapsed_time": time.time() - start_time
            }
        
        if not chunks:
            logger.warning(f"No chunks generated from {pdf_path.name}")
            return {
                "status": "error",
                "message": "No chunks generated",
                "filename": pdf_path.name,
                "file_size": file_size,
                "chunks": 0,
                "elapsed_time": time.time() - start_time
            }
        
        logger.info(f"Generated {len(chunks)} chunks from {pdf_path.name} in {chunk_time:.2f}s")
        
        # Ingest chunks into vector database
        ingest_start = time.time()
        logger.info(f"Starting ingestion of {len(chunks)} chunks into vector database...")
        logger.info(f"  This will check for duplicates and generate embeddings (may take several minutes)...")
        
        # Estimate time remaining based on average processing time (if available)
        # This will be improved with actual tracking in future iterations
        # Flush logs before potentially long operation
        for handler in logger.handlers:
            if hasattr(handler, 'flush'):
                handler.flush()
        root_logger = logging.getLogger()
        for handler in root_logger.handlers:
            if hasattr(handler, 'flush'):
                handler.flush()
        try:
            result = ingestor.ingest_pdf_documents(
                chunks,
                batch_size=batch_size,
                duplicate_check_batch_size=duplicate_check_batch_size,
                full_refresh=full_refresh
            )
            ingest_time = time.time() - ingest_start
        except Exception as e:
            logger.error(f"Ingestion failed for {pdf_path.name}: {type(e).__name__}: {e}")
            logger.debug(traceback.format_exc())
            return {
                "status": "error",
                "message": f"Ingestion failed: {type(e).__name__}: {e}",
                "filename": pdf_path.name,
                "file_size": file_size,
                "chunks": len(chunks),
                "elapsed_time": time.time() - start_time
            }
        
        elapsed_time = time.time() - start_time
        logger.info(
            f"PDF {pdf_path.name} completed in {elapsed_time:.2f}s: "
            f"{result.get('added', 0)} added, "
            f"{result.get('duplicates', 0)} duplicates, "
            f"{result.get('errors', 0)} errors"
        )
        
        return {
            "status": result.get("status", "unknown"),
            "message": result.get("message", ""),
            "filename": pdf_path.name,
            "file_size": file_size,
            "chunks": len(chunks),
            "added": result.get("added", 0),
            "duplicates": result.get("duplicates", 0),
            "errors": result.get("errors", 0),
            "elapsed_time": elapsed_time
        }
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        error_type = type(e).__name__
        error_msg = str(e)
        error_traceback = traceback.format_exc()
        
        logger.error(f"Error processing {pdf_path.name} ({file_size_mb:.2f} MB): {error_type}: {error_msg}")
        logger.debug(f"Full traceback:\n{error_traceback}")
        
        return {
            "status": "error",
            "message": f"{error_type}: {error_msg}",
            "filename": pdf_path.name,
            "file_size": file_size,
            "chunks": 0,
            "elapsed_time": elapsed_time,
            "error_type": error_type,
            "error_traceback": error_traceback
        }


def load_progress(progress_file: Path) -> Dict[str, Any]:
    """
    Load processed PDF tracking from JSON file
    
    Args:
        progress_file: Path to progress tracking file
        
    Returns:
        Dictionary with processed files and metadata
    """
    if not progress_file.exists():
        return {
            "processed_files": [],
            "last_updated": None,
            "version": "1.0"
        }
    
    try:
        with open(progress_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data
    except Exception as e:
        logger.warning(f"Could not load progress file {progress_file}: {e}. Starting fresh.")
        return {
            "processed_files": [],
            "last_updated": None,
            "version": "1.0"
        }


def save_progress(progress_file: Path, filename: str) -> None:
    """
    Save processed PDF name to tracking file
    
    Args:
        progress_file: Path to progress tracking file
        filename: Name of successfully processed PDF
    """
    try:
        # Load existing progress
        progress = load_progress(progress_file)
        
        # Add filename if not already present
        if filename not in progress["processed_files"]:
            progress["processed_files"].append(filename)
            progress["last_updated"] = datetime.now().isoformat()
            
            # Ensure directory exists
            progress_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Save to file
            with open(progress_file, 'w', encoding='utf-8') as f:
                json.dump(progress, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save progress for {filename}: {e}")


def is_already_processed(progress_file: Path, filename: str) -> bool:
    """
    Check if PDF was already successfully processed
    
    Args:
        progress_file: Path to progress tracking file
        filename: Name of PDF file to check
        
    Returns:
        True if PDF was already processed, False otherwise
    """
    progress = load_progress(progress_file)
    return filename in progress.get("processed_files", [])


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Process PDF files and ingest into vector database")
    parser.add_argument("--skip-on-error", action="store_true", 
                       help="Skip problematic PDFs automatically and continue processing")
    parser.add_argument("--timeout", type=int, default=None,
                       help="Timeout in seconds for PDF processing (default: 150)")
    parser.add_argument("--allow-partial-success", action="store_true",
                       help="Treat partial ingestions as success for exit code purposes")
    parser.add_argument("--full-refresh", action="store_true",
                       help="Delete existing chunks before re-adding (full refresh mode)")
    parser.add_argument("--batch-size", type=int, default=None,
                       help="Batch size for ingestion (default: 100)")
    parser.add_argument("--duplicate-check-batch-size", type=int, default=None,
                       help="Batch size for duplicate checking (default: same as --batch-size)")
    parser.add_argument("--parallel", action="store_true",
                       help="Enable parallel processing of multiple PDFs (default: False)")
    parser.add_argument("--max-workers", type=int, default=2,
                       help="Number of parallel workers (default: 2)")
    parser.add_argument("--resume", action="store_true",
                       help="Skip already processed PDFs based on tracking file")
    parser.add_argument("--progress-file", type=str, default=None,
                       help="Path to file tracking processed PDFs (default: data/pdf_progress.json)")
    # Set default for resume_partial to True
    parser.set_defaults(resume_partial=True)
    parser.add_argument("--no-resume-partial", dest="resume_partial", action="store_false",
                       help="Do not treat partial ingestions as processed in resume mode (default: partials are saved)")
    parser.add_argument("--chunk-size", type=int, default=None,
                       help="Chunk size in tokens (default: from DOCUMENT_CHUNK_SIZE env var or 500)")
    parser.add_argument("--chunk-overlap", type=int, default=None,
                       help="Chunk overlap in tokens (default: from DOCUMENT_CHUNK_OVERLAP env var or 50)")
    
    args = parser.parse_args()
    
    # Get paths
    root_dir = Path(__file__).parent.parent
    docs_dir = root_dir / "docs"
    
    if not docs_dir.exists():
        logger.error(f"Docs directory not found: {docs_dir}")
        sys.exit(1)
    
    logger.info(f"Looking for PDF files in: {docs_dir}")
    
    # Find all PDF files
    pdf_files = find_pdf_files(docs_dir)
    
    if not pdf_files:
        logger.warning(f"No PDF files found in {docs_dir}")
        sys.exit(0)
    
    logger.info(f"Found {len(pdf_files)} PDF file(s) to process")
    
    # Initialize processors
    timeout = args.timeout or int(os.getenv("PDF_PROCESSING_TIMEOUT", "150"))
    pdf_processor = get_pdf_processor(timeout=timeout)
    
    # Get chunk size and overlap from args, env vars, or defaults
    chunk_size = args.chunk_size or int(os.getenv("DOCUMENT_CHUNK_SIZE", "500"))
    chunk_overlap = args.chunk_overlap or int(os.getenv("DOCUMENT_CHUNK_OVERLAP", "50"))
    doc_processor = get_document_processor(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    ingestor = get_vector_ingestor()
    
    # Get batch sizes from args or environment
    # Reduced default batch size from 100 to 50 for better progress feedback
    batch_size = args.batch_size or int(os.getenv("INGESTION_BATCH_SIZE", "50"))
    duplicate_check_batch_size = args.duplicate_check_batch_size
    if duplicate_check_batch_size is None:
        # Increased default duplicate check batch size to 200 to reduce round trips
        duplicate_check_batch_size = int(os.getenv("DUPLICATE_CHECK_BATCH_SIZE", "200"))
    
    # Batch size recommendations
    if len(pdf_files) > 10 and batch_size > 50:
        logger.warning(
            f"Large batch size ({batch_size}) with many PDFs ({len(pdf_files)}) may cause slow progress. "
            f"Consider using --batch-size 30-50 for better feedback."
        )
    
    logger.info(f"PDF processing timeout set to {timeout} seconds")
    logger.info(f"Ingestion batch size: {batch_size}, Duplicate check batch size: {duplicate_check_batch_size}")
    if args.skip_on_error:
        logger.info("Skip-on-error mode enabled: will continue processing even if individual PDFs fail")
    
    # Setup progress tracking
    if args.progress_file:
        progress_file = Path(args.progress_file)
    else:
        progress_file = root_dir / "data" / "pdf_progress.json"
    
    # Load progress if resume is enabled
    if args.resume:
        progress = load_progress(progress_file)
        logger.info(f"Resume mode enabled: {len(progress.get('processed_files', []))} PDFs already processed")
        if args.resume_partial:
            logger.info("Partial ingestions will be treated as processed (use --no-resume-partial to retry partials)")
        else:
            logger.info("Partial ingestions will NOT be treated as processed (will be retried on next run)")
    
    # Filter out already processed PDFs if resume is enabled
    if args.resume:
        original_count = len(pdf_files)
        pdf_files = [pdf for pdf in pdf_files if not is_already_processed(progress_file, pdf.name)]
        skipped_count = original_count - len(pdf_files)
        if skipped_count > 0:
            logger.info(f"Skipping {skipped_count} already processed PDF(s)")
    
    # Process each PDF file
    results = []
    overall_start_time = time.time()
    unprocessed_pdfs = []
    progress_lock = Lock()  # Thread-safe progress tracking
    
    def process_single_pdf(pdf_path: Path, idx: int, total: int) -> Dict[str, Any]:
        """Process a single PDF file (used for both sequential and parallel processing)"""
        logger.info("=" * 70)
        logger.info(f"Processing PDF {idx}/{total}: {pdf_path.name}")
        logger.info("=" * 70)
        
        try:
            # In parallel mode, create a new VectorIngestor per thread to avoid sharing PersistentClient
            # In sequential mode, reuse the shared ingestor from get_vector_ingestor()
            if args.parallel:
                from app.tools.vector_ingest import VectorIngestor
                thread_ingestor = VectorIngestor()
            else:
                thread_ingestor = ingestor
            
            result = process_pdf_file(
                pdf_path, pdf_processor, doc_processor, thread_ingestor,
                batch_size=batch_size,
                duplicate_check_batch_size=duplicate_check_batch_size,
                full_refresh=args.full_refresh
            )
            
            # Save progress if resume is enabled
            if args.resume:
                result_status = result.get("status")
                if result_status == "success":
                    # Always save successful ingestions
                    with progress_lock:
                        save_progress(progress_file, pdf_path.name)
                        logger.info(f"Saved progress for {pdf_path.name} (success)")
                elif result_status == "partial":
                    # Save partial ingestions only if resume_partial is True
                    if args.resume_partial:
                        with progress_lock:
                            save_progress(progress_file, pdf_path.name)
                            logger.info(f"Saved progress for {pdf_path.name} (partial - will be skipped on next resume)")
                    else:
                        logger.info(f"Skipped saving progress for {pdf_path.name} (partial - will be retried on next resume)")
            
            # Summary after each PDF
            if result.get("status") == "success":
                logger.info(
                    f"✓ Successfully processed {pdf_path.name} in {result.get('elapsed_time', 0):.2f}s: "
                    f"{result.get('chunks', 0)} chunks, {result.get('added', 0)} added"
                )
            else:
                logger.warning(
                    f"✗ Failed to process {pdf_path.name} in {result.get('elapsed_time', 0):.2f}s: "
                    f"{result.get('message', 'Unknown error')}"
                )
            
            return result
        except Exception as e:
            logger.error(f"Unexpected error processing {pdf_path.name}: {e}")
            logger.debug(traceback.format_exc())
            return {
                "status": "error",
                "message": f"Unexpected error: {type(e).__name__}: {e}",
                "filename": pdf_path.name,
                "chunks": 0
            }
    
    if args.parallel:
        # Parallel processing mode
        logger.info(f"Parallel processing enabled with {args.max_workers} workers")
        # Shared event to signal workers to abort early
        abort_event = Event()
        
        with ThreadPoolExecutor(max_workers=args.max_workers) as executor:
            # Submit all tasks
            future_to_pdf = {
                executor.submit(process_single_pdf, pdf_path, idx, len(pdf_files)): pdf_path
                for idx, pdf_path in enumerate(pdf_files, 1)
            }
            
            # Process completed tasks
            for future in as_completed(future_to_pdf):
                pdf_path = future_to_pdf[future]
                try:
                    # Check if abort was signaled
                    if abort_event.is_set():
                        logger.info(f"Skipping remaining tasks due to abort signal")
                        break
                    
                    result = future.result()
                    results.append(result)
                    
                    # Check skip_on_error flag
                    if result.get("status") not in ("success", "partial") and not args.skip_on_error:
                        logger.error(f"Error processing {pdf_path.name} and --skip-on-error not set. Stopping processing.")
                        # Signal abort and cancel remaining tasks
                        abort_event.set()
                        # Cancel remaining tasks and shutdown executor
                        for remaining_future in future_to_pdf:
                            if remaining_future != future:
                                remaining_future.cancel()
                        executor.shutdown(wait=False, cancel_futures=True)
                        break
                except Exception as e:
                    logger.error(f"Exception in parallel processing for {pdf_path.name}: {e}")
                    results.append({
                        "status": "error",
                        "message": f"Exception: {type(e).__name__}: {e}",
                        "filename": pdf_path.name,
                        "chunks": 0
                    })
                    if not args.skip_on_error:
                        # Signal abort and cancel remaining tasks
                        abort_event.set()
                        for remaining_future in future_to_pdf:
                            if remaining_future != future:
                                remaining_future.cancel()
                        executor.shutdown(wait=False, cancel_futures=True)
                        break
    else:
        # Sequential processing mode (default)
        for idx, pdf_path in enumerate(pdf_files, 1):
            # Check if already processed (resume mode)
            if args.resume and is_already_processed(progress_file, pdf_path.name):
                logger.info(f"Skipping {pdf_path.name} (already processed)")
                continue
            
            result = process_single_pdf(pdf_path, idx, len(pdf_files))
            results.append(result)
            
            # Check skip_on_error flag
            if result.get("status") not in ("success", "partial"):
                if not args.skip_on_error:
                    # Mark remaining PDFs as unprocessed
                    remaining_pdfs = pdf_files[idx:]
                    for remaining_pdf in remaining_pdfs:
                        unprocessed_pdfs.append(remaining_pdf.name)
                    logger.error(f"Error encountered and --skip-on-error not set. Stopping processing.")
                    remaining_names = [p.name for p in remaining_pdfs]
                    logger.error(f"Remaining {len(remaining_pdfs)} PDF(s) not processed: {', '.join(remaining_names)}")
                    break
    
    overall_elapsed = time.time() - overall_start_time
    
    # Summary
    total_added = sum(r.get("added", 0) for r in results)
    total_duplicates = sum(r.get("duplicates", 0) for r in results)
    # Include ingestion errors from successful/partial ingestions
    total_errors = sum(r.get("errors", 0) for r in results if r.get("status") in ("success", "partial"))
    # Count each failed PDF (status not in success/partial) as 1 error
    total_errors += sum(1 for r in results if r.get("status") not in ("success", "partial"))
    successful = sum(1 for r in results if r.get("status") == "success")
    partial = sum(1 for r in results if r.get("status") == "partial")
    failed = [r for r in results if r.get("status") not in ("success", "partial")]
    
    logger.info("")
    logger.info("=" * 70)
    logger.info("PDF Ingestion Summary")
    logger.info("=" * 70)
    logger.info(f"Total PDFs processed: {len(results)}")
    if unprocessed_pdfs:
        logger.info(f"Unprocessed PDFs: {len(unprocessed_pdfs)}")
    logger.info(f"Successful: {successful}")
    logger.info(f"Partial: {partial}")
    logger.info(f"Failed: {len(failed)}")
    logger.info(f"Total chunks added: {total_added}")
    logger.info(f"Total duplicates: {total_duplicates}")
    logger.info(f"Total errors: {total_errors}")
    logger.info(f"Total time: {overall_elapsed:.2f}s")
    logger.info("=" * 70)
    
    # List unprocessed PDFs
    if unprocessed_pdfs:
        logger.info("")
        logger.info("Unprocessed PDFs:")
        for pdf_name in unprocessed_pdfs:
            logger.info(f"  - {pdf_name}")
    
    # List failed PDFs
    if failed:
        logger.info("")
        logger.info("Failed PDFs:")
        for result in failed:
            file_size_mb = result.get("file_size", 0) / (1024 * 1024) if result.get("file_size") else 0
            logger.info(f"  - {result.get('filename')} ({file_size_mb:.2f} MB): {result.get('message', 'Unknown error')}")
    
    # Verify ingestion
    stats = ingestor.get_collection_stats("pdf_documents")
    if stats.get("exists"):
        logger.info(f"Vector store now contains {stats.get('count', 0)} PDF document chunks")
    else:
        logger.warning("Could not verify vector store contents")
    
    # Exit code logic:
    # - By default: return 0 unless all PDFs failed (partials are acceptable)
    # - With --allow-partial-success: explicitly treats partials as success (same as default, for clarity)
    # - Without flag: partials are still acceptable by default, but errors are reported in summary
    if len(results) == 0:
        return 1  # No PDFs processed at all
    
    # Exit 0 unless all PDFs failed (partials count as success)
    # The --allow-partial-success flag makes this behavior explicit
    return 0 if len(failed) < len(results) else 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

