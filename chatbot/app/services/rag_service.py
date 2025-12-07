"""
RAG Service for WealthArena Chatbot
Handles retrieval-augmented generation using Chroma vector database
"""

import os
import logging
from typing import List, Dict, Optional
from pathlib import Path

# Setup logger
logger = logging.getLogger(__name__)

# Try to import Chroma
try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

# Try to import sentence-transformers
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False


class RAGService:
    """RAG service for retrieving relevant context from PDF knowledge base"""
    
    def __init__(self):
        self.chroma_client = None
        self.chroma_collection = None
        self.embedding_model = None  # Deferred loading - will be loaded on first use
        # Validate and set collection name with explicit None check
        collection_name_env = os.getenv("RAG_COLLECTION_NAME")
        if collection_name_env is None:
            logger.warning("RAG_COLLECTION_NAME missing from env; using default financial_knowledge")
            self.collection_name = "financial_knowledge"
        elif not collection_name_env.strip():
            logger.warning("RAG_COLLECTION_NAME is empty; using default financial_knowledge")
            self.collection_name = "financial_knowledge"
        else:
            self.collection_name = collection_name_env
        
        self._setup_chroma()
        # Embedding model loading deferred to reduce cold-start time
        
        # Log initialization with configuration
        embedding_model = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        logger.info(f"RAG initialized with collection: {self.collection_name}, model: {embedding_model}")
    
    def _setup_chroma(self):
        """Setup Chroma client and collection if available"""
        if not CHROMA_AVAILABLE:
            return
        
        try:
            # Get persist directory from environment
            persist_dir = os.getenv("CHROMA_PERSIST_DIR", "data/vectorstore")
            persist_path = Path(persist_dir)
            persist_path.mkdir(parents=True, exist_ok=True)
            
            # Initialize Chroma client
            self.chroma_client = chromadb.Client(Settings(
                persist_directory=str(persist_path),
                anonymized_telemetry=False
            ))
            
            # Try to get existing collection
            try:
                self.chroma_collection = self.chroma_client.get_collection(
                    name=self.collection_name
                )
            except Exception:
                # Collection doesn't exist yet - this is OK, it will be created during ingestion
                self.chroma_collection = None
            
        except Exception as e:
            print(f"Failed to initialize Chroma: {e}")
            self.chroma_client = None
            self.chroma_collection = None
    
    def _load_embedding_model(self):
        """Load sentence-transformer model for query embeddings (lazy loading)"""
        if self.embedding_model is not None:
            return  # Already loaded
        
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            return
        
        try:
            embedding_model_env = os.getenv("EMBEDDING_MODEL")
            if embedding_model_env is None:
                logger.warning("EMBEDDING_MODEL missing from env; using default sentence-transformers/all-MiniLM-L6-v2")
                model_name = "sentence-transformers/all-MiniLM-L6-v2"
            else:
                model_name = embedding_model_env
            self.embedding_model = SentenceTransformer(model_name)
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self.embedding_model = None
    
    def retrieve_context(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        Retrieve relevant context from the knowledge base
        
        Args:
            query: User query string
            top_k: Number of chunks to retrieve
            
        Returns:
            List of dictionaries with 'text', 'metadata', and 'score' keys
        """
        if not self.chroma_collection:
            return []
        
        # Lazy load embedding model on first use
        self._load_embedding_model()
        
        if not self.embedding_model:
            return []
        
        try:
            # Generate query embedding
            query_embedding = self.embedding_model.encode(query).tolist()
            
            # Query Chroma collection
            results = self.chroma_collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"]
            )
            
            # Format results
            chunks = []
            if results['documents'] and results['documents'][0]:
                distances = results.get('distances', [[]])
                for i, (doc, metadata) in enumerate(zip(
                    results['documents'][0],
                    results['metadatas'][0]
                )):
                    # Convert distance to similarity score (1 - distance for cosine)
                    # Handle case where distances might not be present
                    if distances and distances[0] and i < len(distances[0]):
                        distance = distances[0][i]
                        score = 1.0 - distance if distance <= 1.0 else 0.0
                    else:
                        # Default score if distances not available
                        score = None
                    
                    chunks.append({
                        'text': doc,
                        'metadata': metadata,
                        'score': score
                    })
            
            return chunks
            
        except Exception as e:
            print(f"RAG retrieval failed: {e}")
            return []
    
    def format_context_for_prompt(self, chunks: List[Dict]) -> str:
        """
        Format retrieved chunks into a readable context string for LLM prompt
        
        Args:
            chunks: List of chunk dictionaries from retrieve_context
            
        Returns:
            Formatted context string
        """
        if not chunks:
            return ""
        
        formatted_parts = []
        for i, chunk in enumerate(chunks, 1):
            text = chunk.get('text', '')
            metadata = chunk.get('metadata', {})
            source = metadata.get('source_file', 'Unknown')
            chunk_index = metadata.get('chunk_index', '')
            
            # Build source reference (page not tracked during ingestion, using chunk index instead)
            source_ref = source
            if chunk_index is not None and chunk_index != '':
                source_ref += f" (chunk {chunk_index})"
            
            formatted_parts.append(f"[{i}] {text}\n(Source: {source_ref})")
        
        return "\n\n".join(formatted_parts)

