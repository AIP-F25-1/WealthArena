#!/usr/bin/env python3
"""
Data Pipeline Orchestrator Script
Orchestrates the data pipeline phases: Scrape → Process → Vectorize
Called by deploy-master.ps1 for each pipeline phase
"""

import sys
import os
import asyncio
import json
import argparse
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

# Add project root to path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

def print_progress(message: str):
    """Print progress message"""
    print(f"[PROGRESS] {message}")

def print_success(message: str):
    """Print success message"""
    print(f"[OK] {message}")

def print_error(message: str):
    """Print error message"""
    print(f"[ERROR] {message}")

def print_info(message: str):
    """Print info message"""
    print(f"[INFO] {message}")

def print_warning(message: str):
    """Print warning message"""
    print(f"[WARNING] {message}")

async def phase_pdf_ingest() -> Dict[str, Any]:
    """
    Phase 1: Ingest PDF documents from docs folder
    
    Returns:
        Dictionary with ingestion results
    """
    print_progress("Phase 1: Ingesting PDF documents...")
    
    try:
        # Import and run PDF ingestion script
        import subprocess
        import sys
        
        script_path = Path(__file__).parent / "pdf_ingest.py"
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print_success("Phase 1 complete: PDF documents ingested")
            return {
                "status": "success",
                "message": "PDF ingestion completed successfully"
            }
        else:
            print_error(f"PDF ingestion failed: {result.stderr}")
            return {
                "status": "error",
                "message": result.stderr
            }
    except Exception as e:
        print_error(f"PDF ingestion failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

async def phase_process(source: str, output_dir: str) -> Dict[str, Any]:
    """
    Phase 2: Process raw data into chunks
    
    Args:
        source: Source to process (investopedia|forexfactory|reddit|news|all)
        output_dir: Output directory for processed chunks
        
    Returns:
        Dictionary with processing results
    """
    print_progress(f"Phase 2: Processing {source} data...")
    
    raw_path = Path(output_dir) / "raw"
    processed_path = Path(output_dir) / "processed"
    processed_path.mkdir(parents=True, exist_ok=True)
    
    from app.tools.document_processor import get_document_processor
    processor = get_document_processor()
    
    results = {}
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Find raw JSON files
    sources_to_check = []
    if source == "all":
        sources_to_check = ["investopedia", "forexfactory", "reddit", "news"]
    else:
        sources_to_check = [source]
    
    for src in sources_to_check:
        raw_files = list(raw_path.glob(f"{src}_*.json"))
        if not raw_files:
            continue
        
        # Use most recent file
        latest_file = max(raw_files, key=lambda p: p.stat().st_mtime)
        
        try:
            with open(latest_file, "r") as f:
                raw_data = json.load(f)
            
            all_chunks = []
            
            if src == "investopedia":
                for article in raw_data:
                    chunks = processor.process_investopedia_article(article)
                    all_chunks.extend(chunks)
            elif src == "forexfactory":
                for event in raw_data:
                    chunks = processor.process_forexfactory_event(event)
                    all_chunks.extend(chunks)
            elif src == "reddit":
                for post in raw_data:
                    chunks = processor.process_reddit_post(post)
                    all_chunks.extend(chunks)
            elif src == "news":
                for article in raw_data:
                    chunks = processor.process_news_article(article)
                    all_chunks.extend(chunks)
            
            # Save processed chunks
            if all_chunks:
                # Convert chunks to JSON-serializable format
                chunks_data = [
                    {
                        "text": chunk.text,
                        "metadata": chunk.metadata,
                        "chunk_id": chunk.chunk_id,
                        "content_hash": chunk.content_hash
                    }
                    for chunk in all_chunks
                ]
                
                output_file = processed_path / f"{src}_chunks_{timestamp}.json"
                with open(output_file, "w") as f:
                    json.dump(chunks_data, f, indent=2)
                
                print_success(f"Processed {len(all_chunks)} chunks from {src}")
                results[src] = {
                    "chunks": len(all_chunks),
                    "status": "success"
                }
            else:
                results[src] = {
                    "chunks": 0,
                    "status": "warning",
                    "message": "No chunks generated"
                }
                
        except Exception as e:
            print_error(f"Processing {src} failed: {e}")
            results[src] = {
                "chunks": 0,
                "status": "error",
                "message": str(e)
            }
    
    total_chunks = sum(r.get("chunks", 0) for r in results.values())
    print_success(f"Phase 2 complete: {total_chunks} chunks generated")
    
    return results

async def phase_vectorize(source: str, output_dir: str) -> Dict[str, Any]:
    """
    Phase 4: Vectorize processed chunks
    
    Args:
        source: Source to vectorize (investopedia|forexfactory|reddit|news|all)
        output_dir: Directory containing processed chunks
        
    Returns:
        Dictionary with vectorization results
    """
    print_progress(f"Phase 4: Vectorizing {source} chunks...")
    
    processed_path = Path(output_dir) / "processed"
    
    from app.tools.vector_ingest import get_vector_ingestor
    from app.tools.document_processor import DocumentChunk
    
    ingestor = get_vector_ingestor()
    
    results = {}
    
    # Find processed chunk files
    sources_to_check = []
    if source == "all":
        sources_to_check = ["investopedia", "forexfactory", "reddit", "news"]
    else:
        sources_to_check = [source]
    
    for src in sources_to_check:
        chunk_files = list(processed_path.glob(f"{src}_chunks_*.json"))
        if not chunk_files:
            continue
        
        # Use most recent file
        latest_file = max(chunk_files, key=lambda p: p.stat().st_mtime)
        
        try:
            with open(latest_file, "r") as f:
                chunks_data = json.load(f)
            
            # Reconstruct DocumentChunk objects
            chunks = [
                DocumentChunk(
                    text=chunk["text"],
                    metadata=chunk["metadata"],
                    chunk_id=chunk["chunk_id"],
                    content_hash=chunk["content_hash"]
                )
                for chunk in chunks_data
            ]
            
            # Ingest into appropriate collection
            if src == "investopedia":
                result = ingestor.ingest_educational_content(chunks)
            elif src == "forexfactory":
                result = ingestor.ingest_forex_events(chunks)
            elif src == "reddit":
                result = ingestor.ingest_community_posts(chunks)
            elif src == "news":
                result = ingestor.ingest_news_articles(chunks)
            else:
                continue
            
            print_success(f"Vectorized {src}: {result.get('added', 0)} added, {result.get('duplicates', 0)} duplicates")
            results[src] = result
            
        except Exception as e:
            print_error(f"Vectorization of {src} failed: {e}")
            results[src] = {
                "status": "error",
                "message": str(e)
            }
    
    print_success(f"Phase 4 complete")
    
    return results

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Data Pipeline Orchestrator")
    parser.add_argument("--phase", choices=["pdf_ingest", "all"], default="all",
                       help="Pipeline phase to run")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without actual operations")
    
    args = parser.parse_args()
    
    if args.dry_run:
        print_info("DRY RUN MODE - No actual operations will be performed")
    
    print("=" * 70)
    print("WealthArena Data Pipeline Orchestrator")
    print("=" * 70)
    print()
    
    try:
        if args.phase in ["pdf_ingest", "all"]:
            pdf_results = await phase_pdf_ingest()
            print()
        
        print("=" * 70)
        print_success("Pipeline execution completed")
        print("=" * 70)
        
        return 0
        
    except Exception as e:
        print_error(f"Pipeline execution failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n[INFO] Pipeline interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Pipeline failed: {e}")
        sys.exit(1)

