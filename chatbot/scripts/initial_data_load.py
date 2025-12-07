#!/usr/bin/env python3
"""
Initial Data Load Script
One-time script to populate vector store with PDF documents from docs folder
"""

import sys
import os
import subprocess
from pathlib import Path

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

def print_warning(message: str):
    """Print warning message"""
    print(f"[WARNING] {message}")

def verify_pdf_load() -> dict:
    """Verify that PDF load was successful"""
    print_progress("Verifying PDF load...")
    
    try:
        from app.tools.vector_ingest import get_vector_ingestor
        
        ingestor = get_vector_ingestor()
        pdf_stats = ingestor.get_collection_stats("pdf_documents")
        
        pdf_count = pdf_stats.get("count", 0)
        min_pdfs = int(os.getenv("MIN_DOCUMENTS_PDF", "1"))
        
        if pdf_count >= min_pdfs:
            print_success(f"PDF documents: {pdf_count} chunks (minimum: {min_pdfs})")
            return {
                "status": "success",
                "count": pdf_count,
                "meets_threshold": True
            }
        else:
            print_error(f"PDF documents: {pdf_count} chunks (minimum: {min_pdfs} required)")
            return {
                "status": "warning",
                "count": pdf_count,
                "meets_threshold": False
            }
    except Exception as e:
        print_error(f"Verification failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

def main():
    """Main function to orchestrate initial PDF data load"""
    print("=" * 70)
    print("WealthArena Initial PDF Data Load")
    print("=" * 70)
    print()
    
    # Check if PDF collection already has documents
    from app.tools.vector_ingest import get_vector_ingestor
    
    ingestor = get_vector_ingestor()
    pdf_stats = ingestor.get_collection_stats("pdf_documents")
    pdf_count = pdf_stats.get("count", 0)
    min_pdfs = int(os.getenv("MIN_DOCUMENTS_PDF", "1"))
    
    # Check for --force flag
    force = "--force" in sys.argv
    
    if pdf_count >= min_pdfs and not force:
        print_success(f"PDF collection already populated ({pdf_count} chunks)")
        print_progress("Skipping initial load. Use --force to reload.")
        return 0
    
    # Run PDF ingestion script
    print_progress("Running PDF ingestion...")
    script_path = Path(__file__).parent / "pdf_ingest.py"
    
    if not script_path.exists():
        print_error(f"PDF ingestion script not found: {script_path}")
        return 1
    
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=False,
            text=True
        )
        
        if result.returncode != 0:
            print_error("PDF ingestion failed")
            return 1
        
        print()
        
        # Verify load
        verification = verify_pdf_load()
        print()
        
        # Summary
        print("=" * 70)
        if verification.get("meets_threshold"):
            print_success("Initial PDF data load completed successfully!")
            return 0
        else:
            print_warning("Initial PDF data load completed but threshold not met")
            return 1
            
    except Exception as e:
        print_error(f"PDF ingestion failed: {e}")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n[INFO] Initial load interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Initial load failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
