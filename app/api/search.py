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
from pydantic import BaseModel

# Try to import Chroma for vector search
try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

from ..tools.news_ingest import get_news_ingest
from ..metrics.prom import record_search_request

router = APIRouter()

class SearchResult(BaseModel):
    """Search result model"""
    id: str
    score: float
    title: str
    url: str
    source: str
    ts: str
    tickers: List[str] = []
    event_tags: List[str] = []

class SearchResponse(BaseModel):
    """Search response model"""
    query: str
    results: List[SearchResult]

class SearchService:
    """Search service with Chroma fallback to in-memory search"""
    
    def __init__(self):
        self.chroma_client = None
        self.chroma_collection = None
        self.news_ingest = get_news_ingest()
        self._setup_chroma()
    
    def _setup_chroma(self):
        """Setup Chroma client and collection if available"""
        if not CHROMA_AVAILABLE:
            return
        
        try:
            # Initialize Chroma client
            self.chroma_client = chromadb.Client(Settings(
                persist_directory="./data/chroma_db",
                anonymized_telemetry=False
            ))
            
            # Get or create collection
            self.chroma_collection = self.chroma_client.get_or_create_collection(
                name="news_articles",
                metadata={"hnsw:space": "cosine"}
            )
            
            print("Chroma client initialized successfully")
        except Exception as e:
            print(f"Failed to initialize Chroma: {e}")
            self.chroma_client = None
            self.chroma_collection = None
    
    async def search(self, query: str, k: int = 5) -> SearchResponse:
        """
        Search for articles using Chroma or fallback to in-memory search
        
        Args:
            query: Search query
            k: Number of results to return
            
        Returns:
            SearchResponse with results
        """
        start_time = time.time()
        if self.chroma_collection is not None:
            result = await self._chroma_search(query, k)
            latency = time.time() - start_time
            record_search_request("vector", latency)
            return result
        else:
            result = await self._in_memory_search(query, k)
            latency = time.time() - start_time
            record_search_request("fallback", latency)
            return result
    
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
                    
                    search_results.append(SearchResult(
                        id=metadata.get('id', f'chroma_{i}'),
                        score=score,
                        title=metadata.get('title', 'No Title'),
                        url=metadata.get('url', ''),
                        source=metadata.get('source', 'Unknown'),
                        ts=metadata.get('published_date', datetime.now().isoformat()),
                        tickers=self._extract_tickers(metadata.get('tickers', [])),
                        event_tags=self._extract_event_tags(metadata.get('event_tags', []))
                    ))
            
            return SearchResponse(query=query, results=search_results)
            
        except Exception as e:
            print(f"Chroma search failed: {e}")
            # Fallback to in-memory search
            return await self._in_memory_search(query, k)
    
    async def _in_memory_search(self, query: str, k: int) -> SearchResponse:
        """Fallback in-memory search over latest news items"""
        try:
            # Fetch latest news articles
            articles = await self.news_ingest.fetch_rss(limit_per_feed=5)
            
            if not articles:
                return SearchResponse(query=query, results=[])
            
            # Simple TF-based scoring
            query_terms = self._tokenize(query.lower())
            scored_articles = []
            
            for article in articles:
                # Combine title and summary for search
                text_content = f"{article.get('title', '')} {article.get('summary', '')}"
                text_terms = self._tokenize(text_content.lower())
                
                # Calculate simple TF score
                score = self._calculate_tf_score(query_terms, text_terms)
                
                if score > 0:
                    scored_articles.append({
                        'article': article,
                        'score': score
                    })
            
            # Sort by score and take top k
            scored_articles.sort(key=lambda x: x['score'], reverse=True)
            top_articles = scored_articles[:k]
            
            # Convert to SearchResult format
            search_results = []
            for item in top_articles:
                article = item['article']
                search_results.append(SearchResult(
                    id=article.get('guid', article.get('link', f'in_memory_{len(search_results)}')),
                    score=item['score'],
                    title=article.get('title', 'No Title'),
                    url=article.get('link', ''),
                    source=article.get('source_name', 'Unknown'),
                    ts=article.get('published_date', article.get('fetched_at', datetime.now().isoformat())),
                    tickers=self._extract_tickers_from_text(article.get('title', '') + ' ' + article.get('summary', '')),
                    event_tags=self._extract_event_tags_from_text(article.get('title', '') + ' ' + article.get('summary', ''))
                ))
            
            return SearchResponse(query=query, results=search_results)
            
        except Exception as e:
            print(f"In-memory search failed: {e}")
            return SearchResponse(query=query, results=[])
    
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
async def search_articles(
    q: str = Query(..., description="Search query"),
    k: int = Query(5, description="Number of results to return", ge=1, le=20)
):
    """
    Search for financial news articles
    
    Args:
        q: Search query string
        k: Number of results to return (1-20)
        
    Returns:
        SearchResponse with matching articles
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    search_service = get_search_service()
    return await search_service.search(q, k)
