#!/usr/bin/env python3
"""
Data Pipeline Verification Script
Comprehensive pre-deployment checks for RAG data pipeline
"""

import sys
import json
import os
from pathlib import Path
from typing import Dict, Any, List

# Add project root to path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

def print_success(message: str):
    """Print success message"""
    print(f"OK: {message}")

def print_error(message: str):
    """Print error message"""
    print(f"ERROR: {message}")

def print_warning(message: str):
    """Print warning message"""
    print(f"WARNING: {message}")

def print_info(message: str):
    """Print info message"""
    print(f"INFO: {message}")

def verify_vector_store() -> Dict[str, Any]:
    """Verify vector store and collections"""
    print_info("Verifying vector store...")
    
    try:
        from app.tools.vector_ingest import get_vector_ingestor
        
        ingestor = get_vector_ingestor()
        if not ingestor.client:
            return {
                "status": "error",
                "message": "ChromaDB not available",
                "collections": {}
            }
        
        collections = ["pdf_documents"]
        results = {}
        
        for collection_name in collections:
            stats = ingestor.get_collection_stats(collection_name)
            results[collection_name] = stats
            
            if stats.get("exists"):
                count = stats.get("count", 0)
                print_success(f"Collection '{collection_name}' exists with {count} documents")
            else:
                print_warning(f"Collection '{collection_name}' not found or empty")
        
        # Test retrieval from each collection
        for collection_name in collections:
            if results[collection_name].get("exists"):
                verification = ingestor.verify_ingestion(collection_name, "test query", k=1)
                if verification.get("verified"):
                    print_success(f"Collection '{collection_name}' is retrievable")
                else:
                    print_warning(f"Collection '{collection_name}' exists but retrieval test failed")
        
        return {
            "status": "success",
            "collections": results
        }
        
    except Exception as e:
        print_error(f"Vector store verification failed: {e}")
        return {
            "status": "error",
            "message": str(e),
            "collections": {}
        }

def verify_pdf_ingestion() -> Dict[str, Any]:
    """Verify PDF ingestion capability"""
    print_info("Verifying PDF ingestion...")
    
    results = {
        "pdf_processor": {"status": "unknown"},
        "pdf_files": {"status": "unknown"}
    }
    
    # Test PDF processor
    try:
        from app.tools.pdf_processor import get_pdf_processor
        
        pdf_processor = get_pdf_processor()
        print_success("PDF processor available")
        results["pdf_processor"] = {"status": "success"}
    except Exception as e:
        print_error(f"PDF processor test failed: {e}")
        results["pdf_processor"] = {"status": "error", "message": str(e)}
    
    # Check for PDF files in docs directory
    try:
        docs_dir = ROOT / "docs"
        pdf_files = list(docs_dir.glob("*.pdf"))
        
        if pdf_files:
            print_success(f"Found {len(pdf_files)} PDF file(s) in docs directory")
            results["pdf_files"] = {
                "status": "success",
                "count": len(pdf_files),
                "files": [f.name for f in pdf_files]
            }
        else:
            print_warning("No PDF files found in docs directory")
            results["pdf_files"] = {
                "status": "warning",
                "message": "No PDF files found - add PDFs to docs/ directory"
            }
    except Exception as e:
        print_error(f"PDF files check failed: {e}")
        results["pdf_files"] = {"status": "error", "message": str(e)}
    
    return results

def verify_ingestion_pipeline() -> Dict[str, Any]:
    """Test end-to-end PDF ingestion pipeline"""
    print_info("Testing PDF ingestion pipeline...")
    
    try:
        from app.tools.pdf_processor import get_pdf_processor
        from app.tools.document_processor import get_document_processor
        from app.tools.vector_ingest import get_vector_ingestor
        
        # Check if PDF files exist
        docs_dir = ROOT / "docs"
        pdf_files = list(docs_dir.glob("*.pdf"))
        
        if not pdf_files:
            return {
                "status": "warning",
                "message": "No PDF files found - add PDFs to docs/ directory to test ingestion"
            }
        
        # Test with first PDF file
        test_pdf = pdf_files[0]
        pdf_processor = get_pdf_processor()
        doc_processor = get_document_processor()
        
        # Try to extract text (quick test)
        try:
            text = pdf_processor.extract_text(test_pdf)
            if text and text.strip():
                print_success(f"PDF text extraction working - extracted {len(text)} characters from {test_pdf.name}")
                return {
                    "status": "success",
                    "message": f"PDF ingestion pipeline working - tested with {test_pdf.name}"
                }
            else:
                return {
                    "status": "warning",
                    "message": f"PDF {test_pdf.name} extracted but no text content found"
                }
        except Exception as e:
            return {
                "status": "error",
                "message": f"PDF extraction failed: {str(e)}"
            }
        
    except Exception as e:
        print_error(f"PDF ingestion pipeline test failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

def verify_configuration() -> Dict[str, Any]:
    """Verify required environment variables"""
    print_info("Verifying configuration...")
    
    required_vars = [
        "GROQ_API_KEY",
        "CHROMA_PERSIST_DIR"
    ]
    
    optional_vars = [
        "PDF_INGEST_INTERVAL_HOURS",
        "ENABLE_PDF_INGESTION"
    ]
    
    results = {
        "required": {},
        "optional": {},
        "status": "success"
    }
    
    # Check required vars
    for var in required_vars:
        value = os.getenv(var)
        if value:
            print_success(f"Required env var '{var}' is set")
            results["required"][var] = "set"
        else:
            print_error(f"Required env var '{var}' is missing")
            results["required"][var] = "missing"
            results["status"] = "error"
    
    # Check optional vars
    for var in optional_vars:
        value = os.getenv(var)
        if value:
            print_info(f"Optional env var '{var}' is set: {value[:20]}...")
            results["optional"][var] = "set"
        else:
            print_warning(f"Optional env var '{var}' is not set (using defaults)")
            results["optional"][var] = "not_set"
    
    return results

def main():
    """Run all verification checks"""
    print("=" * 70)
    print("WealthArena Data Pipeline Verification")
    print("=" * 70)
    print()
    
    report = {
        "timestamp": None,
        "vector_store": {},
        "pdf_ingestion": {},
        "ingestion_pipeline": {},
        "configuration": {},
        "overall_status": "unknown"
    }
    
    import datetime
    report["timestamp"] = datetime.datetime.now().isoformat()
    
    # Run checks
    report["vector_store"] = verify_vector_store()
    print()
    
    report["pdf_ingestion"] = verify_pdf_ingestion()
    print()
    
    report["ingestion_pipeline"] = verify_ingestion_pipeline()
    print()
    
    report["configuration"] = verify_configuration()
    print()
    
    # Determine overall status
    all_checks = [
        report["vector_store"].get("status"),
        report["configuration"].get("status")
    ]
    
    if "error" in all_checks:
        report["overall_status"] = "error"
        print_error("Data pipeline verification FAILED")
        return_code = 1
    elif "warning" in all_checks or report["pdf_ingestion"].get("pdf_files", {}).get("status") == "warning":
        report["overall_status"] = "warning"
        print_warning("Data pipeline verification completed with warnings")
        return_code = 0
    else:
        report["overall_status"] = "success"
        print_success("Data pipeline verification PASSED")
        return_code = 0
    
    # Save report
    report_path = ROOT / "logs" / "deployment_verification.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    print()
    print(f"Verification report saved to: {report_path}")
    print("=" * 70)
    
    return return_code

if __name__ == "__main__":
    sys.exit(main())

