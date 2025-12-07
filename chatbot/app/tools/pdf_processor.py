"""
PDF Processing Module
Handles extraction and processing of text from PDF documents
"""

import os
import sys
import logging
import time
import traceback
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable, Tuple
from datetime import datetime
import multiprocessing
from queue import Empty as QueueEmpty

try:
    import PyPDF2
    _HAS_PYPDF2 = True
except ImportError:
    PyPDF2 = None
    _HAS_PYPDF2 = False

try:
    import pdfplumber
    _HAS_PDFPLUMBER = True
except ImportError:
    pdfplumber = None
    _HAS_PDFPLUMBER = False

# Optional OCR support for scanned PDFs
try:
    import pytesseract
    from pdf2image import convert_from_path
    _HAS_OCR = True
except ImportError:
    pytesseract = None
    convert_from_path = None
    _HAS_OCR = False

logger = logging.getLogger(__name__)

# Multiprocessing setup for cross-platform compatibility
# Use 'spawn' method on Windows to ensure proper process isolation
# Use 'forkserver' or 'spawn' on non-Windows platforms for better isolation
_multiprocessing_initialized = False


def _initialize_multiprocessing():
    """
    Initialize multiprocessing start method if not already set.
    This should be called before any subprocess is launched.
    """
    global _multiprocessing_initialized
    if _multiprocessing_initialized:
        return
    
    try:
        # Check if start method is already set
        current_method = multiprocessing.get_start_method(allow_none=True)
        if current_method is not None:
            _multiprocessing_initialized = True
            return
    except RuntimeError:
        # Start method already set, which is fine
        _multiprocessing_initialized = True
        return
    
    # Set start method based on platform
    if sys.platform == "win32":
        try:
            multiprocessing.set_start_method("spawn")
        except RuntimeError:
            # Start method already set, which is fine
            pass
    else:
        # Non-Windows platforms: prefer 'forkserver' for better isolation, fallback to 'spawn'
        try:
            multiprocessing.set_start_method("forkserver")
        except (RuntimeError, ValueError):
            # If forkserver is not available or already set, try spawn
            try:
                multiprocessing.set_start_method("spawn")
            except RuntimeError:
                # Start method already set, which is fine
                pass
    
    _multiprocessing_initialized = True


class PDFTimeoutError(Exception):
    """Custom timeout exception for PDF processing"""
    pass


def _worker_wrapper(
    target: Callable,
    args: Tuple,
    result_queue: multiprocessing.Queue,
    error_queue: multiprocessing.Queue
) -> None:
    """
    Wrapper function that executes the target worker and puts result/error in queues
    
    Args:
        target: Worker function to execute
        args: Arguments tuple for the worker function
        result_queue: Queue to put successful results
        error_queue: Queue to put error information
    """
    try:
        result = target(*args)
        result_queue.put(("success", result))
    except Exception as e:
        # Capture exception type, message, and full traceback for re-raising
        error_info = {
            "type": type(e).__name__,
            "message": str(e),
            "args": e.args if hasattr(e, "args") else None,
            "traceback": traceback.format_exc()
        }
        error_queue.put(("error", error_info))


def run_in_subprocess_with_timeout(
    target: Callable,
    args: Tuple,
    timeout_seconds: float,
    use_temp_file: bool = None
) -> Any:
    """
    Run a target function in a subprocess with timeout and forcible termination
    
    Args:
        target: Worker function to execute (must be picklable)
        args: Arguments tuple for the worker function
        timeout_seconds: Timeout in seconds
        use_temp_file: If True, use temp file for large results (default: True on Windows)
        
    Returns:
        Result from target function (or content read from temp file if use_temp_file=True)
        
    Raises:
        PDFTimeoutError: If function doesn't complete within timeout
        Exception: Re-raises any exception from the worker process
    """
    # Initialize multiprocessing start method before creating subprocess
    _initialize_multiprocessing()
    
    # Default to using temp files on Windows to avoid memory issues with large PDFs
    if use_temp_file is None:
        use_temp_file = sys.platform == "win32"
    
    # If using temp file, add the flag to args
    if use_temp_file and target in (_extract_text_pypdf2_worker, _extract_text_pdfplumber_worker):
        args = args + (True,)
    # Create queues for communication with subprocess
    result_queue = multiprocessing.Queue()
    error_queue = multiprocessing.Queue()
    
    # Extract file name from args if available for error messages
    file_name = None
    if args and len(args) > 0:
        try:
            # First arg is typically the PDF path
            pdf_path_str = str(args[0])
            file_name = Path(pdf_path_str).name
        except Exception:
            pass
    
    # Create and start the process
    proc = multiprocessing.Process(
        target=_worker_wrapper,
        args=(target, args, result_queue, error_queue)
    )
    proc.start()
    
    try:
        # Wait for process to complete with timeout
        proc.join(timeout=timeout_seconds)
        
        # Check if process is still alive after join
        if proc.is_alive():
            # Process timed out - forcibly terminate it
            logger.warning(
                f"PDF processing timed out after {timeout_seconds}s, "
                f"terminating worker process (file: {file_name or 'unknown'})"
            )
            proc.terminate()
            # Wait for termination to complete
            proc.join()
            
            # Ensure process is dead
            if proc.is_alive():
                logger.error("Process did not terminate, attempting kill")
                proc.kill()
                proc.join()
            
            # Raise timeout error with file name if available
            error_msg = f"Operation timed out after {timeout_seconds} seconds"
            if file_name:
                error_msg += f" (file: {file_name})"
            raise PDFTimeoutError(error_msg)
        
        # Process exited - check exit code
        if proc.exitcode != 0:
            logger.warning(f"Worker process exited with code {proc.exitcode}")
        
        # Try to read from error queue first (errors take precedence)
        try:
            error_type, error_info = error_queue.get_nowait()
            if error_type == "error":
                # Re-construct exception from captured info
                exc_type_name = error_info.get("type", "Exception")
                exc_message = error_info.get("message", "Unknown error")
                exc_traceback = error_info.get("traceback", "")
                
                # Log the traceback at DEBUG level for debugging
                if exc_traceback:
                    logger.debug(f"Worker process traceback:\n{exc_traceback}")
                
                # Try to re-raise with original type if it's a common exception
                if exc_type_name == "PDFTimeoutError":
                    raise PDFTimeoutError(exc_message)
                elif exc_type_name == "ImportError":
                    raise ImportError(exc_message)
                elif exc_type_name == "FileNotFoundError":
                    raise FileNotFoundError(exc_message)
                elif exc_type_name == "PermissionError":
                    raise PermissionError(exc_message)
                else:
                    # Generic exception with captured message and traceback
                    full_message = f"{exc_type_name}: {exc_message}"
                    if exc_traceback:
                        full_message += f"\n\nTraceback from worker process:\n{exc_traceback}"
                    raise Exception(full_message)
        except QueueEmpty:
            # Error queue is empty, check result queue
            pass
        except Exception as queue_error:
            # Some other queue error occurred
            logger.warning(f"Error reading from error queue: {queue_error}")
        
        # Read from result queue
        try:
            result_type, result = result_queue.get_nowait()
            if result_type == "success":
                # If result is a file path (temp file), read and delete it
                if use_temp_file and isinstance(result, str) and Path(result).exists():
                    try:
                        with open(result, 'r', encoding='utf-8') as f:
                            content = f.read()
                        # Clean up temp file
                        try:
                            os.unlink(result)
                        except Exception:
                            pass
                        return content
                    except Exception as e:
                        logger.warning(f"Error reading temp file {result}: {e}")
                        # Try to clean up even if read failed
                        try:
                            os.unlink(result)
                        except Exception:
                            pass
                        raise Exception(f"Failed to read temp file: {e}")
                return result
            else:
                raise Exception(f"Unexpected result type: {result_type}")
        except QueueEmpty:
            # Both queues empty - process may have crashed without writing
            logger.error(
                f"Worker process exited but no result or error found in queues "
                f"(exit code: {proc.exitcode}, file: {file_name or 'unknown'})"
            )
            raise Exception(
                f"Worker process exited unexpectedly "
                f"(exit code: {proc.exitcode})"
            )
    
    finally:
        # Clean up: drain queues to prevent deadlocks
        try:
            while not result_queue.empty():
                try:
                    result_queue.get_nowait()
                except QueueEmpty:
                    break
        except Exception:
            pass
        try:
            while not error_queue.empty():
                try:
                    error_queue.get_nowait()
                except QueueEmpty:
                    break
        except Exception:
            pass
        
        # Ensure process is terminated
        if proc.is_alive():
            logger.warning("Process still alive in finally block, terminating")
            proc.terminate()
            proc.join()
            if proc.is_alive():
                proc.kill()
                proc.join()


def _extract_text_pypdf2_worker(pdf_path_str: str, use_temp_file: bool = False) -> str:
    """
    Worker function for PyPDF2 extraction in subprocess
    
    Args:
        pdf_path_str: Path to PDF file as string
        use_temp_file: If True, write result to temp file and return path
        
    Returns:
        Extracted text content or path to temp file if use_temp_file=True
    """
    # Import inside worker to ensure availability in subprocess
    try:
        import PyPDF2
    except ImportError:
        raise ImportError("PyPDF2 not available in worker process")
    
    pdf_path = Path(pdf_path_str)
    text_content = []
    with open(pdf_path, "rb") as file:
        pdf_reader = PyPDF2.PdfReader(file)
        num_pages = len(pdf_reader.pages)
        
        for page_num in range(num_pages):
            page = pdf_reader.pages[page_num]
            text = page.extract_text()
            if text:
                text_content.append(text)
    
    result_text = "\n\n".join(text_content)
    
    # Optionally write to temp file for large content (especially on Windows)
    if use_temp_file:
        temp_file = tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False, suffix='.txt')
        temp_file.write(result_text)
        temp_file.close()
        return temp_file.name  # Return path instead of content
    
    return result_text


def _extract_text_pdfplumber_worker(pdf_path_str: str, use_temp_file: bool = False) -> str:
    """
    Worker function for pdfplumber extraction in subprocess
    
    Args:
        pdf_path_str: Path to PDF file as string
        use_temp_file: If True, write result to temp file and return path
        
    Returns:
        Extracted text content or path to temp file if use_temp_file=True
    """
    # Import inside worker to ensure availability in subprocess
    try:
        import pdfplumber
    except ImportError:
        raise ImportError("pdfplumber not available in worker process")
    
    pdf_path = Path(pdf_path_str)
    text_content = []
    with pdfplumber.open(pdf_path) as pdf:
        num_pages = len(pdf.pages)
        
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                text_content.append(text)
    
    result_text = "\n\n".join(text_content)
    
    # Optionally write to temp file for large content (especially on Windows)
    if use_temp_file:
        temp_file = tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False, suffix='.txt')
        temp_file.write(result_text)
        temp_file.close()
        return temp_file.name  # Return path instead of content
    
    return result_text


def _extract_metadata_worker(pdf_path_str: str) -> Dict[str, Any]:
    """
    Worker function for PDF metadata extraction in subprocess
    
    Args:
        pdf_path_str: Path to PDF file as string
        
    Returns:
        Dictionary with PDF metadata
    """
    # Import inside worker to ensure availability in subprocess
    try:
        import PyPDF2
    except ImportError:
        raise ImportError("PyPDF2 not available in worker process")
    
    pdf_path = Path(pdf_path_str)
    metadata = {}
    
    with open(pdf_path, "rb") as file:
        pdf_reader = PyPDF2.PdfReader(file)
        if pdf_reader.metadata:
            pdf_meta = pdf_reader.metadata
            if pdf_meta.get("/Title"):
                metadata["title"] = pdf_meta.get("/Title")
            if pdf_meta.get("/Author"):
                metadata["author"] = pdf_meta.get("/Author")
            if pdf_meta.get("/Subject"):
                metadata["subject"] = pdf_meta.get("/Subject")
            if pdf_meta.get("/CreationDate"):
                metadata["creation_date"] = str(pdf_meta.get("/CreationDate"))
    
    return metadata


def _run_with_timeout(worker_func, pdf_path: Path, timeout_seconds: int):
    """
    Run a worker function with a timeout using subprocess
    
    Args:
        worker_func: Worker function to execute (must be picklable)
        pdf_path: Path to PDF file
        timeout_seconds: Timeout in seconds
        
    Returns:
        Result from worker_func
        
    Raises:
        PDFTimeoutError: If function doesn't complete within timeout
    """
    # Delegate to the new multiprocessing-based timeout mechanism
    # This ensures proper process termination on timeout, especially on Windows
    return run_in_subprocess_with_timeout(
        target=worker_func,
        args=(str(pdf_path),),
        timeout_seconds=timeout_seconds
    )


class PDFProcessor:
    """PDF processor for extracting text from PDF documents"""
    
    def __init__(self, timeout: int = 60, enable_ocr: bool = None):
        """
        Initialize PDF processor
        
        Args:
            timeout: Timeout in seconds for PDF extraction operations (default: 60)
            enable_ocr: Enable OCR fallback for scanned PDFs (default: from ENABLE_PDF_OCR env var or False)
        """
        self.timeout = timeout
        
        # Check OCR availability and enable flag
        if enable_ocr is None:
            enable_ocr = os.getenv("ENABLE_PDF_OCR", "false").lower() in ("true", "1", "yes")
        
        self.enable_ocr = enable_ocr and _HAS_OCR
        
        if not _HAS_PYPDF2 and not _HAS_PDFPLUMBER:
            logger.warning("No PDF libraries available. Install PyPDF2 or pdfplumber.")
        
        if self.enable_ocr:
            if not _HAS_OCR:
                logger.warning("OCR requested but not available. Install pytesseract and pdf2image: pip install pytesseract pdf2image")
                self.enable_ocr = False
            else:
                logger.info("OCR fallback enabled for scanned PDFs")
    
    def extract_text_pypdf2(self, pdf_path: Path) -> str:
        """
        Extract text from PDF using PyPDF2
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text content
        """
        if not _HAS_PYPDF2:
            raise ImportError("PyPDF2 not available")
        
        logger.info(f"Starting PyPDF2 extraction from {pdf_path.name} (timeout: {self.timeout}s)")
        
        try:
            result = _run_with_timeout(_extract_text_pypdf2_worker, pdf_path, self.timeout)
            logger.info(f"PyPDF2 extraction completed")
            return result
        except PDFTimeoutError as e:
            logger.error(f"PyPDF2 extraction timed out after {self.timeout}s: {e}")
            raise
        except Exception as e:
            logger.error(f"Error extracting text with PyPDF2 from {pdf_path}: {e}")
            logger.debug(traceback.format_exc())
            raise
    
    def extract_text_pdfplumber(self, pdf_path: Path) -> str:
        """
        Extract text from PDF using pdfplumber (better for complex layouts)
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text content
        """
        if not _HAS_PDFPLUMBER:
            raise ImportError("pdfplumber not available")
        
        logger.info(f"Starting pdfplumber extraction from {pdf_path.name} (timeout: {self.timeout}s)")
        
        try:
            result = _run_with_timeout(_extract_text_pdfplumber_worker, pdf_path, self.timeout)
            logger.info(f"pdfplumber extraction completed")
            return result
        except PDFTimeoutError as e:
            logger.error(f"pdfplumber extraction timed out after {self.timeout}s: {e}")
            raise
        except Exception as e:
            logger.error(f"Error extracting text with pdfplumber from {pdf_path}: {e}")
            logger.debug(traceback.format_exc())
            raise
    
    def extract_text_with_ocr(self, pdf_path: Path) -> str:
        """
        Extract text from PDF using OCR (for scanned/image-only PDFs)
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text content from OCR
        """
        if not _HAS_OCR:
            raise ImportError("OCR libraries not available. Install pytesseract and pdf2image.")
        
        logger.info(f"Attempting OCR extraction from {pdf_path.name}...")
        try:
            # Convert PDF pages to images
            images = convert_from_path(str(pdf_path))
            logger.info(f"Converted {len(images)} pages to images for OCR")
            
            # Extract text from each image using OCR
            text_parts = []
            for i, image in enumerate(images, 1):
                logger.info(f"Processing page {i}/{len(images)} with OCR...")
                page_text = pytesseract.image_to_string(image)
                if page_text.strip():
                    text_parts.append(page_text)
            
            result_text = "\n\n".join(text_parts)
            logger.info(f"OCR extraction completed: {len(result_text)} characters extracted")
            return result_text
            
        except Exception as e:
            logger.error(f"OCR extraction failed for {pdf_path.name}: {e}")
            logger.debug(traceback.format_exc())
            raise
    
    def extract_text(self, pdf_path: Path) -> str:
        """
        Extract text from PDF using available library (prefers pdfplumber)
        Falls back to OCR if enabled and no text is found
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Extracted text content
        """
        logger.info(f"Extracting text from {pdf_path.name}...")
        
        extracted_text = ""
        
        # Try pdfplumber first (better quality)
        if _HAS_PDFPLUMBER:
            try:
                extracted_text = self.extract_text_pdfplumber(pdf_path)
            except PDFTimeoutError:
                logger.warning(f"pdfplumber extraction timed out, trying PyPDF2...")
                if _HAS_PYPDF2:
                    try:
                        extracted_text = self.extract_text_pypdf2(pdf_path)
                    except Exception as e:
                        logger.error(f"Both pdfplumber and PyPDF2 failed: {e}")
                        # Try OCR if enabled and no text extracted
                        if self.enable_ocr and not extracted_text:
                            logger.info("Attempting OCR fallback...")
                            try:
                                return self.extract_text_with_ocr(pdf_path)
                            except Exception as ocr_error:
                                logger.error(f"OCR fallback also failed: {ocr_error}")
                        raise
            except Exception as e:
                logger.warning(f"pdfplumber extraction failed, trying PyPDF2: {e}")
                logger.debug(traceback.format_exc())
        
        # Fallback to PyPDF2 if pdfplumber didn't work
        if not extracted_text and _HAS_PYPDF2:
            try:
                extracted_text = self.extract_text_pypdf2(pdf_path)
            except PDFTimeoutError:
                logger.error(f"PyPDF2 extraction timed out after {self.timeout}s")
                # Try OCR if enabled
                if self.enable_ocr:
                    logger.info("Attempting OCR fallback after timeout...")
                    try:
                        return self.extract_text_with_ocr(pdf_path)
                    except Exception as ocr_error:
                        logger.error(f"OCR fallback also failed: {ocr_error}")
                raise
            except Exception as e:
                logger.error(f"PyPDF2 extraction also failed: {e}")
                logger.debug(traceback.format_exc())
        
        # If no text extracted and OCR is enabled, try OCR
        if not extracted_text or not extracted_text.strip():
            if self.enable_ocr:
                logger.info("No selectable text found. Attempting OCR fallback...")
                try:
                    ocr_text = self.extract_text_with_ocr(pdf_path)
                    if ocr_text and ocr_text.strip():
                        logger.info("OCR successfully extracted text from scanned PDF")
                        return ocr_text
                    else:
                        logger.warning("OCR did not extract any text")
                except Exception as ocr_error:
                    logger.warning(f"OCR fallback failed: {ocr_error}")
            else:
                logger.warning(
                    "No selectable text extracted. This may be a scanned/image-only PDF. "
                    "Enable OCR by setting ENABLE_PDF_OCR=true or installing OCR dependencies."
                )
        
        if not extracted_text:
            raise ImportError("No PDF extraction library available. Install PyPDF2 or pdfplumber.")
        
        return extracted_text
    
    def get_pdf_metadata(self, pdf_path: Path) -> Dict[str, Any]:
        """
        Extract metadata from PDF file
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Dictionary with PDF metadata
        """
        metadata = {
            "filename": pdf_path.name,
            "file_path": str(pdf_path),
            "file_size": pdf_path.stat().st_size,
            "modified_time": datetime.fromtimestamp(pdf_path.stat().st_mtime).isoformat()
        }
        
        # Try to extract PDF metadata if available (with timeout)
        if _HAS_PYPDF2:
            try:
                pdf_metadata = _run_with_timeout(_extract_metadata_worker, pdf_path, self.timeout)
                metadata.update(pdf_metadata)
            except PDFTimeoutError:
                logger.warning(f"PDF metadata extraction timed out for {pdf_path.name}, using basic metadata only")
            except Exception as e:
                logger.warning(f"Could not extract PDF metadata from {pdf_path.name}: {e}")
                logger.debug(traceback.format_exc())
        
        return metadata


# Global instance for reuse
_pdf_processor = None


def get_pdf_processor(timeout: Optional[int] = None, enable_ocr: Optional[bool] = None) -> PDFProcessor:
    """
    Get or create the global PDF processor instance
    
    Args:
        timeout: Optional timeout in seconds (uses default if not provided)
        enable_ocr: Optional flag to enable OCR (uses env var if not provided)
        
    Returns:
        PDFProcessor instance
    """
    global _pdf_processor
    if _pdf_processor is None:
        # Get timeout from environment variable if available
        if timeout is None:
            env_timeout = os.getenv("PDF_PROCESSING_TIMEOUT")
            if env_timeout:
                try:
                    timeout = int(env_timeout)
                except ValueError:
                    logger.warning(f"Invalid PDF_PROCESSING_TIMEOUT value: {env_timeout}, using default")
        
        # Get OCR flag from environment variable if not provided
        if enable_ocr is None:
            enable_ocr = os.getenv("ENABLE_PDF_OCR", "false").lower() in ("true", "1", "yes")
        
        _pdf_processor = PDFProcessor(timeout=timeout or 60, enable_ocr=enable_ocr)
    else:
        # Update timeout if provided
        if timeout is not None:
            _pdf_processor.timeout = timeout
        # Update OCR flag if provided
        if enable_ocr is not None:
            _pdf_processor.enable_ocr = enable_ocr and _HAS_OCR
    return _pdf_processor

