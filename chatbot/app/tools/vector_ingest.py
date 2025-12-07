"""
Vector Store Ingestion Module
Handles adding processed documents to ChromaDB collections
"""

import os
import logging
import time
import threading
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    import chromadb
    from chromadb.utils import embedding_functions
    _HAS_CHROMADB = True
except ImportError:
    chromadb = None
    embedding_functions = None
    _HAS_CHROMADB = False

from .document_processor import DocumentChunk
from app.metrics.prom import record_ingest_operation, update_vector_store_size

# Import timeout utilities from pdf_processor
try:
    from app.tools.pdf_processor import run_in_subprocess_with_timeout, PDFTimeoutError
    _HAS_TIMEOUT_UTILS = True
except ImportError:
    run_in_subprocess_with_timeout = None
    PDFTimeoutError = Exception
    _HAS_TIMEOUT_UTILS = False

logger = logging.getLogger(__name__)

# Use shared path helper for consistent path resolution
from ..utils.paths import get_vectorstore_path
DB_DIR = get_vectorstore_path()


def _add_batch_worker(
    db_dir: str,
    collection_name: str,
    batch_ids: List[str],
    batch_texts: List[str],
    batch_metadatas: List[Dict[str, Any]]
) -> None:
    """
    Worker function to add a batch to ChromaDB collection in a subprocess.
    This function recreates the collection connection in the worker process.
    
    Args:
        db_dir: Path to ChromaDB database directory
        collection_name: Name of the collection
        batch_ids: List of document IDs
        batch_texts: List of document texts
        batch_metadatas: List of metadata dictionaries
    """
    # Import inside worker to ensure availability in subprocess
    try:
        import chromadb
        from chromadb.utils import embedding_functions
    except ImportError:
        raise ImportError("ChromaDB not available in worker process")
    
    # Recreate collection connection in worker process
    client = chromadb.PersistentClient(path=db_dir)
    embedding_function = embedding_functions.DefaultEmbeddingFunction()
    collection = client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_function
    )
    
    # Add batch to collection
    collection.add(
        documents=batch_texts,
        ids=batch_ids,
        metadatas=batch_metadatas
    )


class VectorIngestor:
    """Vector store ingestor for ChromaDB collections"""
    
    def __init__(self):
        """Initialize vector ingestor"""
        if not _HAS_CHROMADB:
            logger.warning("ChromaDB not available - vector ingestion disabled")
            self.client = None
            return
        
        try:
            os.makedirs(DB_DIR, exist_ok=True)
            logger.info(f"Initializing ChromaDB client at {DB_DIR}...")
            self.client = chromadb.PersistentClient(path=DB_DIR)
            logger.info("Initializing embedding function (this may download models on first use)...")
            self.embedding_function = embedding_functions.DefaultEmbeddingFunction()
            logger.info(f"Vector ingestor initialized at {DB_DIR}")
            
            # Per-ingestor lock for thread-safe collection operations
            self._collection_lock = threading.Lock()
            
            # Warm up embedding model to trigger download and caching
            self.warmup_embedding_model()
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            self.client = None
            self._collection_lock = threading.Lock()
    
    def warmup_embedding_model(self) -> None:
        """
        Warm up embedding model by generating embeddings for a small test batch.
        This triggers model download and caching before processing actual PDFs.
        """
        if not self.client or not self.embedding_function:
            return
        
        try:
            logger.info("Warming up embedding model (downloading if needed)...")
            # Create a small test batch to trigger model download
            test_texts = ["This is a test document for embedding model warmup."]
            # Generate embeddings (this will download the model if not cached)
            _ = self.embedding_function(test_texts)
            logger.info("Embedding model warmup completed")
        except Exception as e:
            logger.warning(f"Embedding model warmup failed (non-critical): {e}")
    
    def _get_collection(self, collection_name: str):
        """
        Get or create a ChromaDB collection
        Returns a fresh collection object each call to avoid sharing across threads.
        
        Args:
            collection_name: Name of the collection
            
        Returns:
            ChromaDB collection or None
        """
        if not self.client:
            return None
        
        try:
            # Always return a fresh collection object (not stored/reused)
            collection = self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=self.embedding_function
            )
            return collection
        except Exception as e:
            logger.error(f"Failed to get/create collection {collection_name}: {e}")
            return None
    
    def ingest_news_articles(
        self,
        chunks: List[DocumentChunk],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Ingest news article chunks into news_articles collection (DEPRECATED - news ingestion removed)
        
        Args:
            chunks: List of DocumentChunk objects
            batch_size: Batch size for ingestion
            
        Returns:
            Dictionary with ingestion statistics
        """
        if not self.client:
            return {
                "status": "error",
                "message": "ChromaDB not available",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        collection = self._get_collection("news_articles")
        if not collection:
            return {
                "status": "error",
                "message": "Failed to get collection",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        return self._ingest_chunks(collection, chunks, batch_size, "news_articles")
    
    def ingest_educational_content(
        self,
        chunks: List[DocumentChunk],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Ingest educational content chunks into educational_content collection
        
        Args:
            chunks: List of DocumentChunk objects
            batch_size: Batch size for ingestion
            
        Returns:
            Dictionary with ingestion statistics
        """
        if not self.client:
            return {
                "status": "error",
                "message": "ChromaDB not available",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        collection = self._get_collection("educational_content")
        if not collection:
            return {
                "status": "error",
                "message": "Failed to get collection",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        return self._ingest_chunks(collection, chunks, batch_size, "educational_content")
    
    def ingest_forex_events(
        self,
        chunks: List[DocumentChunk],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Ingest Forex Factory event chunks into forex_events collection
        
        Args:
            chunks: List of DocumentChunk objects
            batch_size: Batch size for ingestion
            
        Returns:
            Dictionary with ingestion statistics
        """
        if not self.client:
            return {
                "status": "error",
                "message": "ChromaDB not available",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        collection = self._get_collection("forex_events")
        if not collection:
            return {
                "status": "error",
                "message": "Failed to get collection",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        return self._ingest_chunks(collection, chunks, batch_size, "forex_events")
    
    def ingest_community_posts(
        self,
        chunks: List[DocumentChunk],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Ingest Reddit post chunks into community_posts collection
        
        Args:
            chunks: List of DocumentChunk objects
            batch_size: Batch size for ingestion
            
        Returns:
            Dictionary with ingestion statistics
        """
        if not self.client:
            return {
                "status": "error",
                "message": "ChromaDB not available",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        collection = self._get_collection("community_posts")
        if not collection:
            return {
                "status": "error",
                "message": "Failed to get collection",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        return self._ingest_chunks(collection, chunks, batch_size, "community_posts")
    
    def ingest_financial_docs(
        self,
        chunks: List[DocumentChunk],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        Ingest financial document chunks into financial_docs collection (DEPRECATED)
        
        Args:
            chunks: List of DocumentChunk objects
            batch_size: Batch size for ingestion
            
        Returns:
            Dictionary with ingestion statistics
        """
        if not self.client:
            return {
                "status": "error",
                "message": "ChromaDB not available",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        collection = self._get_collection("financial_docs")
        if not collection:
            return {
                "status": "error",
                "message": "Failed to get collection",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        return self._ingest_chunks(collection, chunks, batch_size, "financial_docs")
    
    def ingest_pdf_documents(
        self,
        chunks: List[DocumentChunk],
        batch_size: int = 100,
        duplicate_check_batch_size: Optional[int] = None,
        full_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Ingest PDF document chunks into pdf_documents collection
        
        Args:
            chunks: List of DocumentChunk objects
            batch_size: Batch size for ingestion
            duplicate_check_batch_size: Batch size for duplicate checking (defaults to batch_size if not provided)
            
        Returns:
            Dictionary with ingestion statistics
        """
        if not self.client:
            return {
                "status": "error",
                "message": "ChromaDB not available",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        collection = self._get_collection("pdf_documents")
        if not collection:
            return {
                "status": "error",
                "message": "Failed to get collection",
                "added": 0,
                "duplicates": 0,
                "errors": len(chunks)
            }
        
        return self._ingest_chunks(collection, chunks, batch_size, "pdf_documents", duplicate_check_batch_size, full_refresh)
    
    def _ingest_chunks(
        self,
        collection,
        chunks: List[DocumentChunk],
        batch_size: int,
        collection_name: str,
        duplicate_check_batch_size: Optional[int] = None,
        full_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Internal method to ingest chunks into a collection
        
        Args:
            collection: ChromaDB collection
            chunks: List of DocumentChunk objects
            batch_size: Batch size for ingestion
            collection_name: Collection name for logging
            duplicate_check_batch_size: Batch size for duplicate checking (defaults to batch_size if not provided)
            
        Returns:
            Dictionary with statistics
        """
        start_time = time.time()
        
        if not chunks:
            ingest_latency = time.time() - start_time
            record_ingest_operation(collection_name, "added", ingest_latency, 0)
            return {
                "status": "success",
                "message": "No chunks to ingest",
                "added": 0,
                "duplicates": 0,
                "errors": 0
            }
        
        # Use provided duplicate_check_batch_size or default to batch_size
        if duplicate_check_batch_size is None:
            duplicate_check_batch_size = batch_size
        
        chunk_ids = [chunk.chunk_id for chunk in chunks]
        existing_ids = set()
        
        # Full refresh mode: delete existing chunks by ids before re-adding
        if full_refresh:
            logger.info(f"Full refresh mode: deleting existing chunks before re-adding...")
            try:
                # Get existing documents in batches to find what to delete
                total_batches = (len(chunk_ids) + duplicate_check_batch_size - 1) // duplicate_check_batch_size
                for i in range(0, len(chunk_ids), duplicate_check_batch_size):
                    batch_num = (i // duplicate_check_batch_size) + 1
                    batch_ids = chunk_ids[i:i + duplicate_check_batch_size]
                    progress_pct = int((batch_num / total_batches) * 100)
                    logger.info(f"Checking batch {batch_num}/{total_batches} ({progress_pct}%) for existing chunks to delete...")
                    # Thread-safe collection.get()
                    with self._collection_lock:
                        existing = collection.get(ids=batch_ids)
                    if existing and "ids" in existing:
                        existing_ids.update(existing["ids"])
                
                # Delete existing chunks by ids
                if existing_ids:
                    logger.info(f"Deleting {len(existing_ids)} existing chunks...")
                    # Thread-safe collection.delete()
                    with self._collection_lock:
                        collection.delete(ids=list(existing_ids))
                    logger.info(f"Deleted {len(existing_ids)} existing chunks")
                else:
                    logger.info("No existing chunks found to delete")
            except Exception as e:
                logger.warning(f"Could not delete existing chunks in full refresh mode: {e}. Proceeding with ingestion.")
        
        # Check existing IDs to avoid duplicates (if not in full refresh mode)
        if not full_refresh:
            # Early exit if collection is empty (no need to check duplicates)
            try:
                collection_count = collection.count()
                if collection_count == 0:
                    logger.info("Collection is empty, skipping duplicate check")
                else:
                    logger.info(f"Checking for duplicates among {len(chunks)} chunks (collection has {collection_count} existing chunks)...")
                    logger.info(f"  This may take a while if the collection is large...")
                    # Flush logs before potentially long operation
                    for handler in logger.handlers:
                        if hasattr(handler, 'flush'):
                            handler.flush()
                    root_logger = logging.getLogger()
                    for handler in root_logger.handlers:
                        if hasattr(handler, 'flush'):
                            handler.flush()
                    try:
                        # Get existing documents in batches (using duplicate_check_batch_size)
                        total_batches = (len(chunk_ids) + duplicate_check_batch_size - 1) // duplicate_check_batch_size
                        for i in range(0, len(chunk_ids), duplicate_check_batch_size):
                            batch_num = (i // duplicate_check_batch_size) + 1
                            batch_ids = chunk_ids[i:i + duplicate_check_batch_size]
                            progress_pct = int((batch_num / total_batches) * 100)
                            logger.info(f"Checking batch {batch_num}/{total_batches} ({progress_pct}%) for duplicates...")
                            # Thread-safe collection.get()
                            with self._collection_lock:
                                existing = collection.get(ids=batch_ids)
                            if existing and "ids" in existing:
                                existing_ids.update(existing["ids"])
                        logger.info(f"Duplicate check completed: found {len(existing_ids)} existing chunks")
                    except Exception as e:
                        logger.warning(f"Could not check existing IDs: {e}. Proceeding without duplicate check.")
            except Exception as e:
                logger.warning(f"Could not get collection count: {e}. Proceeding with duplicate check.")
                # Fallback to original duplicate check logic
                logger.info(f"Checking for duplicates among {len(chunks)} chunks...")
                try:
                    total_batches = (len(chunk_ids) + duplicate_check_batch_size - 1) // duplicate_check_batch_size
                    for i in range(0, len(chunk_ids), duplicate_check_batch_size):
                        batch_num = (i // duplicate_check_batch_size) + 1
                        batch_ids = chunk_ids[i:i + duplicate_check_batch_size]
                        progress_pct = int((batch_num / total_batches) * 100)
                        logger.info(f"Checking batch {batch_num}/{total_batches} ({progress_pct}%) for duplicates...")
                        # Thread-safe collection.get()
                        with self._collection_lock:
                            existing = collection.get(ids=batch_ids)
                        if existing and "ids" in existing:
                            existing_ids.update(existing["ids"])
                    logger.info(f"Duplicate check completed: found {len(existing_ids)} existing chunks")
                except Exception as e2:
                    logger.warning(f"Could not check existing IDs: {e2}. Proceeding without duplicate check.")
        
        # Filter out duplicates (in non-full-refresh mode)
        if full_refresh:
            new_chunks = chunks  # In full refresh mode, all chunks are new
            duplicates_count = 0
        else:
            new_chunks = [chunk for chunk in chunks if chunk.chunk_id not in existing_ids]
            duplicates_count = len(chunks) - len(new_chunks)
        
        if not new_chunks:
            ingest_latency = time.time() - start_time
            record_ingest_operation(collection_name, "duplicate", ingest_latency, 0)
            return {
                "status": "success",
                "message": "All chunks already exist",
                "added": 0,
                "duplicates": duplicates_count,
                "errors": 0
            }
        
        # Ingest in batches
        logger.info(f"Ingesting {len(new_chunks)} new chunks into {collection_name}...")
        added_count = 0
        error_count = 0
        total_batches = (len(new_chunks) + batch_size - 1) // batch_size
        batch_times = []
        
        for i in range(0, len(new_chunks), batch_size):
            batch = new_chunks[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            batch_start_time = time.time()
            progress_pct = int((batch_num / total_batches) * 100)
            
            try:
                logger.info(f"Processing batch {batch_num}/{total_batches} ({progress_pct}%) - {len(batch)} chunks...")
                
                # Prepare batch data
                logger.info(f"Preparing batch data for {len(batch)} chunks...")
                batch_ids = [chunk.chunk_id for chunk in batch]
                batch_texts = [chunk.text for chunk in batch]
                
                # Optimize metadata preparation: pre-allocate list and use list comprehension
                ingestion_timestamp = datetime.now().isoformat()
                batch_metadatas = []
                for chunk in batch:
                    metadata = chunk.metadata.copy()
                    # Add ingestion timestamp
                    metadata["ingested_at"] = ingestion_timestamp
                    # Ensure all metadata values are strings, numbers, or booleans
                    cleaned_metadata = {
                        key: (value if isinstance(value, (str, int, float, bool)) else ("" if value is None else str(value)))
                        for key, value in metadata.items()
                    }
                    batch_metadatas.append(cleaned_metadata)
                
                # Add to collection (this may take time for embedding generation)
                # Use direct collection.add for small batches to reuse client/embedding function
                # Use subprocess with timeout protection for large batches
                logger.info(f"Generating embeddings and adding batch {batch_num}/{total_batches} to vector store...")
                logger.info(f"  This may take a while - generating embeddings for {len(batch)} chunks (first batch may download model)...")
                embed_start_time = time.time()
                
                # Threshold for using subprocess: batches larger than this use subprocess for timeout protection
                # Reduced from 500 to 200 to enable timeout protection for more batches
                # Lower threshold = safer but slightly slower (more subprocess overhead)
                subprocess_threshold = int(os.getenv("VECTOR_INGEST_SUBPROCESS_THRESHOLD", "200"))
                
                if len(batch) > subprocess_threshold and _HAS_TIMEOUT_UTILS and run_in_subprocess_with_timeout:
                    # Large batch: use subprocess with timeout protection
                    batch_timeout = 600  # 10 minutes per batch
                    try:
                        logger.info(f"  Using subprocess for large batch (timeout: {batch_timeout}s)...")
                        run_in_subprocess_with_timeout(
                            target=_add_batch_worker,
                            args=(DB_DIR, collection_name, batch_ids, batch_texts, batch_metadatas),
                            timeout_seconds=batch_timeout
                        )
                        embed_time = time.time() - embed_start_time
                    except PDFTimeoutError as e:
                        embed_time = time.time() - embed_start_time
                        logger.error(f"Batch {batch_num}/{total_batches} timed out after {batch_timeout}s: {e}")
                        raise
                else:
                    # Small batch: use direct call to reuse pre-initialized client and embedding function
                    logger.info(f"  Using direct call (reusing pre-initialized embedding function)...")
                    logger.info(f"  Generating embeddings for {len(batch)} chunks (this may take 30-120 seconds for first batch)...")
                    
                    # Start progress indicator thread
                    progress_stop = threading.Event()
                    progress_thread = None
                    
                    def progress_indicator():
                        """Background thread to show progress during embedding generation"""
                        elapsed = 0
                        while not progress_stop.is_set():
                            time.sleep(5)  # Update every 5 seconds
                            elapsed += 5
                            if not progress_stop.is_set():
                                logger.info(f"  Still generating embeddings... {elapsed}s elapsed")
                    
                    try:
                        progress_thread = threading.Thread(target=progress_indicator, daemon=True)
                        progress_thread.start()
                        
                        # Flush logs before potentially long operation
                        for handler in logger.handlers:
                            if hasattr(handler, 'flush'):
                                handler.flush()
                        root_logger = logging.getLogger()
                        for handler in root_logger.handlers:
                            if hasattr(handler, 'flush'):
                                handler.flush()
                        
                        # Add to collection (this generates embeddings)
                        # Thread-safe collection.add() with timeout protection
                        # Use timeout mechanism if configured
                        timeout_seconds = int(os.getenv("VECTOR_INGEST_BATCH_TIMEOUT", "0"))
                        if timeout_seconds > 0 and _HAS_TIMEOUT_UTILS and run_in_subprocess_with_timeout:
                            # Use subprocess with timeout for direct path too
                            try:
                                logger.info(f"  Using subprocess with timeout ({timeout_seconds}s) for batch...")
                                run_in_subprocess_with_timeout(
                                    target=_add_batch_worker,
                                    args=(DB_DIR, collection_name, batch_ids, batch_texts, batch_metadatas),
                                    timeout_seconds=timeout_seconds
                                )
                            except PDFTimeoutError as e:
                                logger.error(f"Batch {batch_num}/{total_batches} timed out after {timeout_seconds}s: {e}")
                                logger.error(f"  Consider reducing --batch-size to avoid timeouts")
                                raise
                        else:
                            # Direct call with lock protection
                            with self._collection_lock:
                                collection.add(
                                    documents=batch_texts,
                                    ids=batch_ids,
                                    metadatas=batch_metadatas
                                )
                        
                        # Stop progress indicator
                        progress_stop.set()
                        if progress_thread:
                            progress_thread.join(timeout=1)
                        
                        embed_time = time.time() - embed_start_time
                        logger.info(f"  Embedding generation completed in {embed_time:.2f}s")
                    except Exception as e:
                        # Stop progress indicator on error
                        progress_stop.set()
                        if progress_thread:
                            progress_thread.join(timeout=1)
                        raise
                
                batch_time = time.time() - batch_start_time
                batch_times.append(batch_time)
                avg_batch_time = sum(batch_times) / len(batch_times)
                remaining_batches = total_batches - batch_num
                estimated_remaining = avg_batch_time * remaining_batches
                
                # Calculate chunks per second rate
                chunks_per_sec = len(batch) / batch_time if batch_time > 0 else 0
                
                # Calculate cumulative progress
                total_processed = added_count + len(batch)
                total_chunks = len(new_chunks)
                cumulative_pct = int((total_processed / total_chunks) * 100) if total_chunks > 0 else 0
                
                added_count += len(batch)
                logger.info(
                    f"✓ Successfully added batch {batch_num}/{total_batches} ({len(batch)} chunks) "
                    f"in {batch_time:.2f}s (embedding: {embed_time:.2f}s, {chunks_per_sec:.1f} chunks/s). "
                    f"Processed {total_processed}/{total_chunks} chunks total ({cumulative_pct}%). "
                    f"Estimated remaining: {estimated_remaining:.1f}s"
                )
                
                # Flush log output if possible (both module logger and root logger)
                for handler in logger.handlers:
                    if hasattr(handler, 'flush'):
                        handler.flush()
                # Also flush root logger handlers to ensure immediate console output
                root_logger = logging.getLogger()
                for handler in root_logger.handlers:
                    if hasattr(handler, 'flush'):
                        handler.flush()
                
            except Exception as e:
                batch_time = time.time() - batch_start_time
                logger.error(f"Error ingesting batch {batch_num}/{total_batches} to {collection_name} (took {batch_time:.2f}s): {e}")
                import traceback
                logger.debug(traceback.format_exc())
                error_count += len(batch)
        
        # Compute latency
        ingest_latency = time.time() - start_time
        
        # Derive status for metrics
        if added_count > 0:
            status = "added"
        elif duplicates_count > 0 and error_count == 0:
            status = "duplicate"
        else:
            status = "error"
        
        # Record ingestion metrics
        record_ingest_operation(collection_name, status, ingest_latency, added_count)
        
        # Update vector store size
        try:
            count = collection.count()
            update_vector_store_size(collection_name, count)
        except Exception as e:
            logger.warning(f"Could not update vector store size for {collection_name}: {e}")
        
        return {
            "status": "success" if error_count == 0 else "partial",
            "message": f"Ingested {added_count} chunks, {duplicates_count} duplicates, {error_count} errors",
            "added": added_count,
            "duplicates": duplicates_count,
            "errors": error_count
        }
    
    def get_collection_stats(self, collection_name: str) -> Dict[str, Any]:
        """
        Get statistics for a collection
        
        Args:
            collection_name: Name of the collection
            
        Returns:
            Dictionary with collection statistics
        """
        if not self.client:
            return {
                "exists": False,
                "count": 0,
                "message": "ChromaDB not available"
            }
        
        try:
            collection = self._get_collection(collection_name)
            if not collection:
                return {
                    "exists": False,
                    "count": 0,
                    "message": "Collection not found"
                }
            
            count = collection.count()
            return {
                "exists": True,
                "count": count,
                "collection_name": collection_name
            }
        except Exception as e:
            logger.error(f"Error getting stats for {collection_name}: {e}")
            return {
                "exists": False,
                "count": 0,
                "message": str(e)
            }
    
    def verify_ingestion(
        self,
        collection_name: str,
        sample_query: str = "financial markets",
        k: int = 3
    ) -> Dict[str, Any]:
        """
        Verify that documents are retrievable from a collection
        
        Args:
            collection_name: Name of the collection
            sample_query: Sample query to test retrieval
            k: Number of results to retrieve
            
        Returns:
            Dictionary with verification results
        """
        if not self.client:
            return {
                "verified": False,
                "message": "ChromaDB not available"
            }
        
        try:
            collection = self._get_collection(collection_name)
            if not collection:
                return {
                    "verified": False,
                    "message": "Collection not found"
                }
            
            # Try to query the collection
            results = collection.query(
                query_texts=[sample_query],
                n_results=k
            )
            
            if results and results.get("documents") and results["documents"][0]:
                return {
                    "verified": True,
                    "message": f"Successfully retrieved {len(results['documents'][0])} documents",
                    "results_count": len(results["documents"][0])
                }
            else:
                return {
                    "verified": False,
                    "message": "Collection exists but query returned no results",
                    "results_count": 0
                }
                
        except Exception as e:
            logger.error(f"Error verifying {collection_name}: {e}")
            return {
                "verified": False,
                "message": str(e)
            }

# Global instance for reuse
_vector_ingestor = None

def get_vector_ingestor() -> VectorIngestor:
    """Get or create the global vector ingestor instance"""
    global _vector_ingestor
    if _vector_ingestor is None:
        _vector_ingestor = VectorIngestor()
    return _vector_ingestor

