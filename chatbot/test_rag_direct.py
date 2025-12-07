"""Direct test of RAG service functionality"""
import os
import sys
from pathlib import Path

# Set environment
os.environ['CHROMA_PERSIST_DIR'] = 'data/vectorstore'
os.environ['RAG_COLLECTION_NAME'] = 'financial_knowledge'
os.environ['EMBEDDING_MODEL'] = 'sentence-transformers/all-MiniLM-L6-v2'

from app.services.rag_service import RAGService

print("=" * 60)
print("RAG Service Direct Test")
print("=" * 60)
print()

# Initialize service
print("Initializing RAG service...")
service = RAGService()

print(f"Collection available: {service.chroma_collection is not None}")
print(f"Embedding model available: {service.embedding_model is not None}")
print()

# Test retrieval
if service.chroma_collection and service.embedding_model:
    print("Testing retrieval with query: 'What is RSI?'")
    chunks = service.retrieve_context('What is RSI?', top_k=3)
    
    print(f"Retrieved {len(chunks)} chunks")
    print()
    
    if chunks:
        print("Sample chunks:")
        for i, chunk in enumerate(chunks[:2], 1):
            print(f"\nChunk {i}:")
            print(f"  Source: {chunk['metadata'].get('source_file', 'unknown')}")
            print(f"  Score: {chunk['score']:.3f}")
            print(f"  Text preview: {chunk['text'][:100]}...")
        
        # Test formatting
        print("\n" + "=" * 60)
        print("Testing context formatting:")
        print("=" * 60)
        formatted = service.format_context_for_prompt(chunks)
        print(formatted[:300] + "..." if len(formatted) > 300 else formatted)
        print("\n[SUCCESS] RAG service is working correctly!")
    else:
        print("[WARNING] No chunks retrieved - collection may be empty")
else:
    print("[WARNING] RAG service not fully initialized")
    if not service.chroma_collection:
        print("  - Chroma collection not available")
    if not service.embedding_model:
        print("  - Embedding model not available")

print()
print("=" * 60)

