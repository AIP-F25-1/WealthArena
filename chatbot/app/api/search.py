"""
Search API endpoint
Provides search functionality with Chroma fallback to in-memory search
"""

import os
import re
import math
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

# Try to import Chroma for vector search
try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    embedding_functions = None

from ..metrics.prom import record_search_request

router = APIRouter()

class SearchResult(BaseModel):
    """Search result model"""
    id: str
    score: float
    text: str  # PDF chunk text content
    title: str
    url: str
    source: str
    ts: str
    metadata: Dict[str, Any] = Field(default_factory=dict)  # Include full metadata with filename, page_number, collection_type
    tickers: List[str] = Field(default_factory=list)
    event_tags: List[str] = Field(default_factory=list)

class SearchResponse(BaseModel):
    """Search response model"""
    query: str
    results: List[SearchResult]
    count: int  # Number of results returned

class SearchService:
    """Search service using Chroma vector database for PDF documents"""
    
    def __init__(self):
        """Initialize search service - ChromaDB is lazy loaded on first use"""
        self.chroma_client = None
        self.chroma_collection = None
        self._chroma_initialized = False
    
    def _setup_chroma(self):
        """Lazy setup of Chroma client and collection - only called when needed"""
        if self._chroma_initialized:
            return
        
        if not CHROMA_AVAILABLE:
            self._chroma_initialized = True
            return
        
        try:
            # Use shared path helper for consistent path resolution
            from ..utils.paths import get_vectorstore_path
            db_dir = get_vectorstore_path()
            
            # Ensure directory exists (lazy creation)
            os.makedirs(db_dir, exist_ok=True)
            
            # Initialize Chroma client
            self.chroma_client = chromadb.PersistentClient(path=db_dir)
            
            # Get or create PDF documents collection
            self.chroma_collection = self.chroma_client.get_or_create_collection(
                name="pdf_documents",
                embedding_function=embedding_functions.DefaultEmbeddingFunction(),
                metadata={"hnsw:space": "cosine"}
            )
            
            print(f"Chroma client initialized successfully at {db_dir}")
            self._chroma_initialized = True
        except Exception as e:
            print(f"Failed to initialize Chroma: {e}")
            self.chroma_client = None
            self.chroma_collection = None
            self._chroma_initialized = True  # Mark as attempted to avoid retry loops
    
    async def search(self, query: str, k: int = 5) -> SearchResponse:
        """
        Search for PDF documents using Chroma vector database
        
        Args:
            query: Search query
            k: Number of results to return
            
        Returns:
            SearchResponse with results
            
        Raises:
            HTTPException: 503 if vector store is unavailable
        """
        # Lazy initialize ChromaDB on first search request
        self._setup_chroma()
        
        start_time = time.time()
        if self.chroma_collection is not None:
            result = await self._chroma_search(query, k)
            latency = time.time() - start_time
            record_search_request("vector", latency)
            return result
        else:
            # Return 503 Service Unavailable if Chroma not available
            latency = time.time() - start_time
            record_search_request("error", latency)
            raise HTTPException(
                status_code=503,
                detail="Vector store is currently unavailable. The search service cannot process requests at this time."
            )
    
    async def _chroma_search(self, query: str, k: int) -> SearchResponse:
        """Search using Chroma vector database"""
        try:
            # Query Chroma collection
            results = self.chroma_collection.query(
                query_texts=[query],
                n_results=k
            )
            
            search_results = []
            if results['documents'] and results['documents'][0]:
                for i, (doc, metadata, distance) in enumerate(zip(
                    results['documents'][0],
                    results['metadatas'][0],
                    results['distances'][0]
                )):
                    # Convert distance to similarity score (1 - distance for cosine)
                    score = 1.0 - distance if distance <= 1.0 else 0.0
                    
                    # Get document ID from results
                    doc_id = f'chroma_{i}'
                    if results.get('ids') and results['ids'][0] and i < len(results['ids'][0]):
                        doc_id = results['ids'][0][i]
                    elif metadata.get('id'):
                        doc_id = metadata.get('id')
                    
                    # Build metadata dict with required fields
                    result_metadata = {
                        'filename': metadata.get('filename', metadata.get('title', 'PDF Document')),
                        'page_number': metadata.get('page_number', None),
                        'collection_type': metadata.get('collection_type', 'pdf_documents'),
                        'file_path': metadata.get('file_path', ''),
                        'id': doc_id
                    }
                    
                    search_results.append(SearchResult(
                        id=doc_id,
                        score=score,
                        text=doc,  # Include the actual PDF chunk text
                        title=metadata.get('filename', metadata.get('title', 'PDF Document')),
                        url=metadata.get('file_path', ''),
                        source=metadata.get('filename', 'PDF Document'),
                        ts=metadata.get('modified_time', metadata.get('processed_at', datetime.now().isoformat())),
                        metadata=result_metadata,
                        tickers=self._extract_tickers(metadata.get('tickers', [])),
                        event_tags=[]
                    ))
            
            return SearchResponse(query=query, results=search_results, count=len(search_results))
            
        except Exception as e:
            print(f"Chroma search failed: {e}")
            return SearchResponse(query=query, results=[], count=0)
    
    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization"""
        # Remove punctuation and split on whitespace
        text = re.sub(r'[^\w\s]', ' ', text)
        return [word for word in text.split() if len(word) > 2]
    
    def _calculate_tf_score(self, query_terms: List[str], text_terms: List[str]) -> float:
        """Calculate simple TF score"""
        if not query_terms or not text_terms:
            return 0.0
        
        # Count term frequencies
        query_tf = {}
        for term in query_terms:
            query_tf[term] = query_tf.get(term, 0) + 1
        
        text_tf = {}
        for term in text_terms:
            text_tf[term] = text_tf.get(term, 0) + 1
        
        # Calculate score based on matching terms
        score = 0.0
        for term in query_tf:
            if term in text_tf:
                # Weight by query term frequency and text term frequency
                score += query_tf[term] * text_tf[term]
        
        # Normalize by query length
        return score / len(query_terms) if query_terms else 0.0
    
    def _extract_tickers(self, tickers: List[str]) -> List[str]:
        """Extract ticker symbols from metadata"""
        if isinstance(tickers, list):
            return tickers
        return []
    
    def _extract_tickers_from_text(self, text: str) -> List[str]:
        """Extract potential ticker symbols from text"""
        # Simple regex to find potential tickers (1-5 uppercase letters)
        ticker_pattern = r'\b[A-Z]{1,5}\b'
        potential_tickers = re.findall(ticker_pattern, text)
        
        # Filter out common words that aren't tickers
        common_words = {'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'BY', 'WORD', 'BUT', 'WHAT', 'SOME', 'WE', 'IT', 'IS', 'OR', 'AN', 'AS', 'BE', 'AT', 'HAVE', 'THIS', 'FROM', 'THEY', 'SHE', 'OR', 'WILL', 'MY', 'ONE', 'ALL', 'WOULD', 'THERE', 'THEIR'}
        
        tickers = []
        for ticker in potential_tickers:
            if ticker not in common_words and len(ticker) >= 2:
                tickers.append(ticker)
        
        return tickers[:5]  # Limit to 5 tickers
    
    def _extract_event_tags(self, event_tags: List[str]) -> List[str]:
        """Extract event tags from metadata"""
        if isinstance(event_tags, list):
            return event_tags
        return []
    
    def _extract_event_tags_from_text(self, text: str) -> List[str]:
        """Extract potential event tags from text"""
        # Simple keyword-based event detection
        event_keywords = {
            'earnings': ['earnings', 'quarterly', 'revenue', 'profit'],
            'merger': ['merger', 'acquisition', 'takeover', 'buyout'],
            'ipo': ['ipo', 'initial public offering', 'going public'],
            'dividend': ['dividend', 'payout', 'yield'],
            'guidance': ['guidance', 'forecast', 'outlook', 'projection'],
            'regulation': ['regulation', 'regulatory', 'sec', 'compliance'],
            'partnership': ['partnership', 'collaboration', 'alliance', 'deal']
        }
        
        text_lower = text.lower()
        detected_events = []
        
        for event_type, keywords in event_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                detected_events.append(event_type)
        
        return detected_events[:3]  # Limit to 3 event tags

# Global search service instance
_search_service = None

def get_search_service() -> SearchService:
    """Get or create the global search service instance"""
    global _search_service
    if _search_service is None:
        _search_service = SearchService()
    return _search_service

@router.get("/search", response_model=SearchResponse)
async def search_documents(
    q: str = Query(..., description="Search query"),
    k: int = Query(5, description="Number of results to return", ge=1, le=20)
):
    """
    Search for PDF documents in the knowledge base
    
    Args:
        q: Search query string
        k: Number of results to return (1-20)
        
    Returns:
        SearchResponse with matching PDF document chunks
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    search_service = get_search_service()
    return await search_service.search(q, k)
