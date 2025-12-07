"""
PDF Ingestion Script for WealthArena Chatbot
Processes PDFs from docs/ folder and loads them into Chroma vector database

Usage:
    python scripts/ingest_pdfs.py

Prerequisites:
    - PDFs in chatbot/docs/ folder
    - chromadb and sentence-transformers packages installed
    - pypdf package installed
"""

import os
import sys
from pathlib import Path
from typing import List, Dict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Try to import required packages
try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    print("ERROR: chromadb package not installed")
    print("Install it with: pip install chromadb>=0.4.22")
    sys.exit(1)

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    print("ERROR: sentence-transformers package not installed")
    print("Install it with: pip install sentence-transformers>=2.7.0")
    sys.exit(1)

try:
    from pypdf import PdfReader
    PYPDF_AVAILABLE = True
except ImportError:
    print("ERROR: pypdf package not installed")
    print("Install it with: pip install pypdf>=3.17.0")
    sys.exit(1)


def extract_text_from_pdf(pdf_path: Path) -> str:
    """
    Extract text from all pages of a PDF file
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Extracted text as string
    """
    try:
        reader = PdfReader(pdf_path)
        text_parts = []
        
        for page_num, page in enumerate(reader.pages, 1):
            try:
                text = page.extract_text()
                if text.strip():
                    text_parts.append(text)
            except Exception as e:
                print(f"  Warning: Could not extract text from page {page_num} of {pdf_path.name}: {e}")
        
        return "\n\n".join(text_parts)
    
    except Exception as e:
        print(f"  Error extracting text from {pdf_path.name}: {e}")
        return ""


def chunk_document(text: str, chunk_size: int, overlap: int) -> List[Dict]:
    """
    Split text into overlapping chunks with metadata
    
    Args:
        text: Full document text
        chunk_size: Size of each chunk in characters
        overlap: Number of characters to overlap between chunks
        
    Returns:
        List of dictionaries with 'text' and 'metadata' keys
    """
    if not text.strip():
        return []
    
    chunks = []
    start = 0
    chunk_index = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk_text = text[start:end]
        
        # Try to break at sentence boundary if possible
        if end < len(text):
            # Look for sentence endings near the end
            last_period = chunk_text.rfind('.')
            last_newline = chunk_text.rfind('\n')
            break_point = max(last_period, last_newline)
            
            if break_point > chunk_size * 0.7:  # Only break if we're at least 70% through
                chunk_text = chunk_text[:break_point + 1]
                end = start + break_point + 1
        
        if chunk_text.strip():
            chunks.append({
                'text': chunk_text.strip(),
                'metadata': {
                    'chunk_index': chunk_index,
                    'start_char': start,
                    'end_char': end
                }
            })
            chunk_index += 1
        
        # Move start position with overlap
        start = end - overlap if end < len(text) else len(text)
    
    # Add total_chunks to metadata
    for chunk in chunks:
        chunk['metadata']['total_chunks'] = len(chunks)
    
    return chunks


def generate_embeddings(chunks: List[str], model: SentenceTransformer) -> List[List[float]]:
    """
    Generate embeddings for text chunks
    
    Args:
        chunks: List of chunk text strings
        model: SentenceTransformer model
        
    Returns:
        List of embedding vectors
    """
    if not chunks:
        return []
    
    # Generate embeddings in batches for efficiency
    batch_size = 32
    all_embeddings = []
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        embeddings = model.encode(batch, show_progress_bar=False)
        all_embeddings.extend(embeddings.tolist())
    
    return all_embeddings


def load_to_chroma(chunks: List[Dict], embeddings: List[List[float]], 
                   source_file: str, chroma_collection) -> int:
    """
    Load chunks and embeddings into Chroma collection
    
    Args:
        chunks: List of chunk dictionaries with text and metadata
        embeddings: List of embedding vectors
        source_file: Source PDF filename
        chroma_collection: Chroma collection object
        
    Returns:
        Number of chunks added
    """
    if not chunks or not embeddings:
        return 0
    
    # Prepare data for Chroma
    ids = []
    documents = []
    metadatas = []
    
    for i, chunk in enumerate(chunks):
        chunk_id = f"{source_file}_chunk_{chunk['metadata']['chunk_index']}"
        ids.append(chunk_id)
        documents.append(chunk['text'])
        
        # Prepare metadata
        metadata = {
            'source_file': source_file,
            'chunk_index': chunk['metadata']['chunk_index'],
            'total_chunks': chunk['metadata']['total_chunks']
        }
        
        # Add page info if available (we don't have page-level info from pypdf easily)
        # For now, we'll estimate page based on chunk position
        metadatas.append(metadata)
    
    # Add to collection in batches
    batch_size = 100
    total_added = 0
    
    for i in range(0, len(ids), batch_size):
        batch_ids = ids[i:i + batch_size]
        batch_documents = documents[i:i + batch_size]
        batch_embeddings = embeddings[i:i + batch_size]
        batch_metadatas = metadatas[i:i + batch_size]
        
        chroma_collection.add(
            ids=batch_ids,
            documents=batch_documents,
            embeddings=batch_embeddings,
            metadatas=batch_metadatas
        )
        
        total_added += len(batch_ids)
    
    return total_added


def main():
    """Main execution function"""
    print("=" * 60)
    print("WealthArena - PDF Ingestion Script")
    print("=" * 60)
    print()
    
    # Get configuration from environment
    docs_dir = Path(__file__).parent.parent / "docs"
    persist_dir = os.getenv("CHROMA_PERSIST_DIR", "data/vectorstore")
    collection_name = os.getenv("RAG_COLLECTION_NAME", "financial_knowledge")
    chunk_size = int(os.getenv("RAG_CHUNK_SIZE", "1000"))
    chunk_overlap = int(os.getenv("RAG_CHUNK_OVERLAP", "200"))
    embedding_model_name = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    
    # Log configuration to confirm env vars are loaded correctly
    print(f"Configuration loaded from environment:")
    print(f"  Collection name: {collection_name}")
    print(f"  Chunk size: {chunk_size}")
    print(f"  Chunk overlap: {chunk_overlap}")
    print(f"  Embedding model: {embedding_model_name}")
    print(f"  Persist directory: {persist_dir}")
    
    # Check for defaults and provide user feedback
    default_warnings = []
    if os.getenv("RAG_COLLECTION_NAME") is None:
        default_warnings.append("RAG_COLLECTION_NAME")
    if os.getenv("RAG_CHUNK_SIZE") is None:
        default_warnings.append("RAG_CHUNK_SIZE")
    if os.getenv("RAG_CHUNK_OVERLAP") is None:
        default_warnings.append("RAG_CHUNK_OVERLAP")
    if os.getenv("EMBEDDING_MODEL") is None:
        default_warnings.append("EMBEDDING_MODEL")
    
    if default_warnings:
        print()
        for var in default_warnings:
            default_value = {
                "RAG_COLLECTION_NAME": "financial_knowledge",
                "RAG_CHUNK_SIZE": "1000",
                "RAG_CHUNK_OVERLAP": "200",
                "EMBEDDING_MODEL": "sentence-transformers/all-MiniLM-L6-v2"
            }.get(var, "default")
            print(f"  [INFO] Using default {var}={default_value}; consider setting in .env for customization")
    print()
    
    # Check if docs directory exists
    if not docs_dir.exists():
        print(f"ERROR: Docs directory not found: {docs_dir}")
        sys.exit(1)
    
    # Find all PDF files
    pdf_files = list(docs_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"WARNING: No PDF files found in {docs_dir}")
        sys.exit(0)
    
    print(f"Found {len(pdf_files)} PDF file(s) to process")
    print(f"Chunk size: {chunk_size}, Overlap: {chunk_overlap}")
    print()
    
    # Initialize Chroma client
    persist_path = Path(persist_dir)
    persist_path.mkdir(parents=True, exist_ok=True)
    
    print(f"Initializing Chroma client at: {persist_path}")
    client = chromadb.Client(Settings(
        persist_directory=str(persist_path),
        anonymized_telemetry=False
    ))
    
    # Create or get collection
    print(f"Creating/updating collection: {collection_name}")
    try:
        # Try to get existing collection
        collection = client.get_collection(name=collection_name)
        print(f"Collection '{collection_name}' already exists. Clearing existing data...")
        client.delete_collection(name=collection_name)
    except Exception:
        pass  # Collection doesn't exist, which is fine
    
    # Create new collection
    collection = client.create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )
    
    # Load embedding model
    print(f"Loading embedding model: {embedding_model_name}")
    try:
        embedding_model = SentenceTransformer(embedding_model_name)
    except Exception as e:
        print(f"ERROR: Failed to load embedding model: {e}")
        sys.exit(1)
    
    print()
    
    # Process each PDF
    total_chunks = 0
    successful_files = 0
    failed_files = 0
    
    for pdf_file in pdf_files:
        print(f"Processing: {pdf_file.name}")
        
        try:
            # Extract text
            text = extract_text_from_pdf(pdf_file)
            if not text.strip():
                print(f"  Warning: No text extracted from {pdf_file.name}")
                failed_files += 1
                continue
            
            # Chunk document
            chunks = chunk_document(text, chunk_size, chunk_overlap)
            if not chunks:
                print(f"  Warning: No chunks created from {pdf_file.name}")
                failed_files += 1
                continue
            
            print(f"  Extracted {len(chunks)} chunks")
            
            # Generate embeddings
            chunk_texts = [chunk['text'] for chunk in chunks]
            print(f"  Generating embeddings...")
            embeddings = generate_embeddings(chunk_texts, embedding_model)
            
            # Load to Chroma
            added_count = load_to_chroma(chunks, embeddings, pdf_file.name, collection)
            total_chunks += added_count
            
            print(f"  [OK] Successfully added {added_count} chunks to Chroma")
            successful_files += 1
            
        except Exception as e:
            print(f"  [ERROR] Error processing {pdf_file.name}: {e}")
            failed_files += 1
        
        print()
    
    # Summary
    print("=" * 60)
    print("Ingestion Summary")
    print("=" * 60)
    print(f"Total PDFs processed: {len(pdf_files)}")
    print(f"Successful: {successful_files}")
    print(f"Failed: {failed_files}")
    print(f"Total chunks added: {total_chunks}")
    
    # Verify collection
    final_count = collection.count()
    print(f"Total chunks in collection: {final_count}")
    print(f"[INFO] Chroma database persisted at: {persist_path}")
    print()
    print("[SUCCESS] PDF ingestion completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()

