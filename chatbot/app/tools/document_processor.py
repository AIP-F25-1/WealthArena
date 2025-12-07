"""
Document Processing Module
Handles parsing, chunking, and metadata extraction for news articles and financial documents
"""

import os
import re
import hashlib
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
from collections import deque
import logging

try:
    from bs4 import BeautifulSoup
    _HAS_BS4 = True
except ImportError:
    _HAS_BS4 = False
    BeautifulSoup = None

logger = logging.getLogger(__name__)

@dataclass
class DocumentChunk:
    """Represents a processed document chunk"""
    text: str
    metadata: Dict[str, Any]
    chunk_id: str
    content_hash: str

class DocumentProcessor:
    """Document processor for chunking and metadata extraction"""
    
    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50
    ):
        """
        Initialize document processor
        
        Args:
            chunk_size: Target chunk size in tokens (approximate)
            chunk_overlap: Overlap between chunks in tokens
            
        Raises:
            ValueError: If chunk_overlap is not within [0, chunk_size-1]
        """
        self.chunk_size = chunk_size
        
        # Validate chunk_overlap is within [0, chunk_size-1]
        if chunk_overlap < 0 or chunk_overlap >= chunk_size:
            raise ValueError(
                f"chunk_overlap ({chunk_overlap}) must be within [0, chunk_size-1] "
                f"(chunk_size={chunk_size}). Use clamp: max(0, min(chunk_overlap, chunk_size-1)) "
                f"or fix the value."
            )
        
        self.chunk_overlap = chunk_overlap
        
        # Validate chunk size
        if chunk_size > 1000:
            logger.warning(
                f"Large chunk size ({chunk_size}) may cause slow embedding generation. "
                f"Optimal range: 300-500 words per chunk."
            )
        
        # Cache compiled regex patterns for better performance
        self._whitespace_pattern = re.compile(r'\s+')
        self._newline_pattern = re.compile(r'\n\s*\n')
        self._special_chars_pattern = re.compile(r'[^\w\s\.\,\!\?\;\:\-\(\)\[\]\"\']')
    
    def clean_text(self, text: str) -> str:
        """
        Clean text by removing HTML tags and excessive whitespace
        
        Args:
            text: Raw text content
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        # Optimize: Skip HTML parsing if no HTML tags detected (check for '<' character first)
        if _HAS_BS4 and BeautifulSoup and '<' in text:
            try:
                soup = BeautifulSoup(text, "lxml")
                text = soup.get_text(separator=" ")
            except Exception as e:
                logger.warning(f"HTML parsing failed, using raw text: {e}")
        
        # Use cached compiled regex patterns for better performance
        text = self._whitespace_pattern.sub(' ', text)
        text = self._newline_pattern.sub('\n\n', text)
        text = self._special_chars_pattern.sub(' ', text)
        
        return text.strip()
    
    def _tokenize_approximate(self, text: str) -> List[str]:
        """
        Approximate tokenization (simple word splitting)
        
        Args:
            text: Text to tokenize
            
        Returns:
            List of tokens
        """
        # Simple word splitting (approximation)
        words = text.split()
        return words
    
    def chunk_text(
        self, 
        text: str, 
        metadata: Dict[str, Any],
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> List[DocumentChunk]:
        """
        Split text into overlapping chunks
        
        Args:
            text: Text to chunk
            metadata: Metadata to attach to each chunk
            progress_callback: Optional callback function(chunk_num, total_chunks) for progress reporting
            
        Returns:
            List of DocumentChunk objects
        """
        if not text:
            return []
        
        cleaned_text = self.clean_text(text)
        
        # Early exit if text is empty after cleaning
        if not cleaned_text or not cleaned_text.strip():
            return []
        
        words = self._tokenize_approximate(cleaned_text)
        
        # Compute step size and validate to prevent non-advancing loops
        step = self.chunk_size - self.chunk_overlap
        if step <= 0:
            raise ValueError(
                f"Invalid chunk configuration: step size (chunk_size - chunk_overlap) "
                f"must be > 0, got {step} (chunk_size={self.chunk_size}, "
                f"chunk_overlap={self.chunk_overlap})"
            )
        
        if len(words) <= self.chunk_size:
            # Text fits in one chunk
            chunk_text = " ".join(words)
            content_hash = self._generate_hash(chunk_text)
            chunk_id = self._generate_chunk_id(metadata, content_hash, 0)
            
            return [DocumentChunk(
                text=chunk_text,
                metadata=metadata.copy(),
                chunk_id=chunk_id,
                content_hash=content_hash
            )]
        
        # Calculate total_chunks accounting for overlap
        # Formula: ((len(words) - chunk_overlap) + step - 1) // step
        # This accounts for the overlap between chunks
        total_chunks = ((len(words) - self.chunk_overlap) + step - 1) // step
        # Ensure at least 1 chunk
        total_chunks = max(1, total_chunks)
        
        # Use deque for better performance with large documents
        chunks = deque()
        start_idx = 0
        chunk_num = 0
        
        while start_idx < len(words):
            # Calculate end index
            end_idx = min(start_idx + self.chunk_size, len(words))
            
            # Extract chunk words
            chunk_words = words[start_idx:end_idx]
            chunk_text = " ".join(chunk_words)
            
            # Generate hash and ID
            content_hash = self._generate_hash(chunk_text)
            chunk_id = self._generate_chunk_id(metadata, content_hash, chunk_num)
            
            # Create chunk with metadata
            chunk_metadata = metadata.copy()
            chunk_metadata["chunk_index"] = chunk_num
            chunk_metadata["total_chunks"] = total_chunks
            
            chunks.append(DocumentChunk(
                text=chunk_text,
                metadata=chunk_metadata,
                chunk_id=chunk_id,
                content_hash=content_hash
            ))
            
            # Call progress callback if provided
            if progress_callback:
                progress_callback(chunk_num + 1, total_chunks)
            
            # Store end_idx to check if we've reached the end
            reached_end = (end_idx == len(words))
            
            # Move start index forward (with overlap)
            start_idx = end_idx - self.chunk_overlap
            # Defensive clamp to avoid negative start_idx when overlap misconfigured
            start_idx = max(0, start_idx)
            chunk_num += 1
            
            # Break if we've just processed the final chunk
            if reached_end:
                break
        
        # Convert deque back to list
        return list(chunks)
    
    def extract_tickers(self, text: str) -> List[str]:
        """
        Extract ticker symbols from text using regex
        
        Args:
            text: Text to search
            
        Returns:
            List of potential ticker symbols
        """
        # Pattern for tickers: 1-5 uppercase letters, possibly followed by numbers
        # Also handle Reddit-style $TICKER format
        ticker_pattern = r'\$?([A-Z]{1,5})\b'
        potential_tickers = re.findall(ticker_pattern, text)
        
        # Common words to filter out
        common_words = {
            'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER',
            'WAS', 'ONE', 'OUR', 'HAD', 'BY', 'WORD', 'WHAT', 'SOME', 'WE', 'IT',
            'IS', 'OR', 'AN', 'AS', 'BE', 'AT', 'HAVE', 'THIS', 'FROM', 'THEY',
            'SHE', 'WILL', 'MY', 'WOULD', 'THERE', 'THEIR', 'WHICH', 'EACH',
            'THESE', 'THOSE', 'WHEN', 'WHERE', 'WHY', 'HOW', 'WHO', 'WHOM'
        }
        
        # Finance abbreviations to filter out (common false positives)
        finance_abbreviations = {
            'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD',  # Currencies
            'CPI', 'GDP', 'PMI', 'ISM', 'FOMC', 'NFP',  # Economic indicators
            'RSI', 'MACD', 'EMA', 'SMA', 'BB', 'ATR', 'ADX',  # Technical indicators
            'ETF', 'IPO', 'SEC', 'FED', 'ECB', 'BOJ', 'BOE'  # Financial terms
        }
        
        # Filter and deduplicate
        tickers = []
        seen = set()
        for ticker in potential_tickers:
            # Filter out common words and finance abbreviations
            if (ticker not in common_words and 
                ticker not in finance_abbreviations and 
                len(ticker) >= 2 and 
                ticker not in seen):
                # For Reddit sources, optionally require $ prefix
                # (This check is done at extraction level via regex pattern)
                tickers.append(ticker)
                seen.add(ticker)
        
        return tickers[:10]  # Limit to 10 tickers
    
    def process_news_article(self, article: Dict[str, Any]) -> List[DocumentChunk]:
        """
        Process a news article into chunks (DEPRECATED - news ingestion removed)
        
        Args:
            article: Article dictionary with title, summary, link, etc.
            
        Returns:
            List of DocumentChunk objects
        """
        # Combine title and summary for processing
        title = article.get("title", "")
        summary = article.get("summary", "")
        full_text = f"{title}\n\n{summary}"
        
        # Extract metadata
        metadata = {
            "source_type": "news",
            "title": title,
            "url": article.get("link", ""),
            "source_name": article.get("source_name", "Unknown"),
            "published_date": article.get("published_date"),
            "fetched_at": article.get("fetched_at", datetime.now().isoformat()),
            "guid": article.get("guid", ""),
            "tickers": self.extract_tickers(full_text),
            "document_type": "news_article"
        }
        
        # Chunk the text
        chunks = self.chunk_text(full_text, metadata)
        
        return chunks
    
    def process_investopedia_article(self, article: Dict[str, Any]) -> List[DocumentChunk]:
        """
        Process an Investopedia article into chunks
        
        Args:
            article: Article dictionary with title, body, url, etc.
            
        Returns:
            List of DocumentChunk objects
        """
        # Combine title and body for processing
        title = article.get("title", "")
        body = article.get("body", "")
        full_text = f"{title}\n\n{body}"
        
        # Extract metadata
        metadata = {
            "source_type": "educational",
            "title": title,
            "url": article.get("url", ""),
            "author_name": article.get("author_name", ""),
            "author_url": article.get("author_url", ""),
            "category": article.get("category", ""),
            "published_date": article.get("published_date"),
            "fetched_at": article.get("fetched_at", datetime.now().isoformat()),
            "document_type": "investopedia_article",
            "tickers": self.extract_tickers(full_text)
        }
        
        # Chunk the text
        chunks = self.chunk_text(full_text, metadata)
        
        return chunks
    
    def process_forexfactory_event(self, event: Dict[str, Any]) -> List[DocumentChunk]:
        """
        Process a Forex Factory event into chunks
        
        Args:
            event: Event dictionary with title, summary, etc.
            
        Returns:
            List of DocumentChunk objects
        """
        # Combine title and summary for processing
        title = event.get("title", "")
        summary = event.get("summary", "")
        full_text = f"{title}\n\n{summary}"
        
        # Extract metadata
        metadata = {
            "source_type": "forex_news",
            "title": title,
            "url": event.get("url", ""),
            "currency": event.get("currency", ""),
            "impact_level": event.get("impact_level", ""),
            "event_type": event.get("event_type", ""),
            "published_date": event.get("published_date"),
            "fetched_at": event.get("fetched_at", datetime.now().isoformat()),
            "document_type": "forex_event",
            "time": event.get("time", ""),
            "actual": event.get("actual", ""),
            "forecast": event.get("forecast", ""),
            "previous": event.get("previous", "")
        }
        
        # Chunk the text
        chunks = self.chunk_text(full_text, metadata)
        
        return chunks
    
    def process_reddit_post(self, post: Dict[str, Any]) -> List[DocumentChunk]:
        """
        Process a Reddit post into chunks
        
        Args:
            post: Post dictionary with title, selftext, etc.
            
        Returns:
            List of DocumentChunk objects
        """
        # Combine title and selftext for processing
        title = post.get("title", "")
        selftext = post.get("selftext", "")
        full_text = f"{title}\n\n{selftext}"
        
        # Extract metadata
        metadata = {
            "source_type": "community",
            "title": title,
            "url": post.get("url", ""),
            "author": post.get("author", ""),
            "subreddit": post.get("subreddit", ""),
            "score": post.get("score", 0),
            "num_comments": post.get("num_comments", 0),
            "flair": post.get("flair", ""),
            "published_date": post.get("published_date"),
            "fetched_at": post.get("fetched_at", datetime.now().isoformat()),
            "document_type": "reddit_post",
            "tickers": self.extract_tickers(full_text)
        }
        
        # Chunk the text
        chunks = self.chunk_text(full_text, metadata)
        
        return chunks
    
    def process_sec_filing(
        self,
        filing: Dict[str, Any],
        text: str
    ) -> List[DocumentChunk]:
        """
        Process an SEC filing into chunks (DEPRECATED - kept for backward compatibility)
        
        Args:
            filing: Filing metadata dictionary
            text: Full filing text
            
        Returns:
            List of DocumentChunk objects
        """
        # Extract metadata
        ticker = filing.get("ticker", "")
        form_type = filing.get("form_type", "")
        filing_date = filing.get("filing_date", "")
        cik = filing.get("cik", "")
        accession_number = filing.get("accession_number", "")
        
        metadata = {
            "source_type": "financial",
            "ticker": ticker,
            "form_type": form_type,
            "filing_date": filing_date,
            "cik": cik,
            "accession_number": accession_number,
            "tickers": [ticker] if ticker else self.extract_tickers(text),
            "document_type": "sec_filing",
            "processed_at": datetime.now().isoformat()
        }
        
        # Chunk the text
        chunks = self.chunk_text(text, metadata)
        
        return chunks
    
    def process_pdf_document(
        self,
        pdf_path: str,
        pdf_metadata: Dict[str, Any],
        text: str,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> List[DocumentChunk]:
        """
        Process a PDF document into chunks
        
        Args:
            pdf_path: Path to the PDF file
            pdf_metadata: PDF metadata dictionary
            text: Extracted text content from PDF
            progress_callback: Optional callback function(chunk_num, total_chunks) for progress reporting
            
        Returns:
            List of DocumentChunk objects
        """
        # Extract metadata
        metadata = {
            "source_type": "pdf",
            "document_type": "pdf_document",
            "filename": pdf_metadata.get("filename", ""),
            "file_path": pdf_metadata.get("file_path", ""),
            "file_size": pdf_metadata.get("file_size", 0),
            "modified_time": pdf_metadata.get("modified_time", ""),
            "processed_at": datetime.now().isoformat()
        }
        
        # Add PDF-specific metadata if available
        if pdf_metadata.get("title"):
            metadata["title"] = pdf_metadata["title"]
        if pdf_metadata.get("author"):
            metadata["author"] = pdf_metadata["author"]
        if pdf_metadata.get("subject"):
            metadata["subject"] = pdf_metadata["subject"]
        if pdf_metadata.get("creation_date"):
            metadata["creation_date"] = pdf_metadata["creation_date"]
        
        # Extract tickers if any
        metadata["tickers"] = self.extract_tickers(text)
        
        # Chunk the text with progress callback
        chunks = self.chunk_text(text, metadata, progress_callback=progress_callback)
        
        return chunks
    
    def _generate_hash(self, text: str) -> str:
        """
        Generate content hash for deduplication
        
        Args:
            text: Text to hash
            
        Returns:
            SHA256 hash as hex string
        """
        return hashlib.sha256(text.encode("utf-8")).hexdigest()
    
    def _generate_chunk_id(
        self,
        metadata: Dict[str, Any],
        content_hash: str,
        chunk_index: int
    ) -> str:
        """
        Generate unique chunk ID
        
        Args:
            metadata: Chunk metadata
            content_hash: Content hash
            chunk_index: Chunk index
            
        Returns:
            Unique chunk ID
        """
        # Use source identifier + hash + index
        source_id = ""
        if metadata.get("source_type") == "news":
            source_id = metadata.get("guid", "") or metadata.get("url", "")
        elif metadata.get("source_type") == "financial":
            source_id = metadata.get("accession_number", "") or metadata.get("cik", "")
        elif metadata.get("source_type") == "educational":
            source_id = metadata.get("url", "") or metadata.get("guid", "")
        elif metadata.get("source_type") == "forex_news":
            source_id = metadata.get("guid", "") or metadata.get("url", "")
        elif metadata.get("source_type") == "community":
            source_id = metadata.get("guid", "") or metadata.get("url", "")
        elif metadata.get("source_type") == "pdf":
            # Prefer filename or normalized relative path instead of absolute file_path
            file_path = metadata.get("file_path", "")
            filename = metadata.get("filename", "")
            
            if filename:
                # Use filename as stable identifier
                source_id = filename
            elif file_path:
                # Normalize path: convert to relative path under docs/ if possible
                # Replace path separators and special characters with hyphens/underscores
                try:
                    # Try to make path relative to docs/ directory
                    docs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "docs")
                    if os.path.isabs(file_path) and file_path.startswith(docs_dir):
                        rel_path = os.path.relpath(file_path, docs_dir)
                        source_id = rel_path
                    else:
                        # Use filename from path if available
                        source_id = os.path.basename(file_path) if file_path else filename
                except Exception:
                    # Fallback to filename from path
                    source_id = os.path.basename(file_path) if file_path else filename
            
            # Normalize source_id: replace path separators and special chars
            if source_id:
                # Replace path separators with underscores
                source_id = source_id.replace("\\", "_").replace("/", "_")
                # Replace other special characters with hyphens
                source_id = re.sub(r'[^\w\-_.]', '-', source_id)
        
        if source_id:
            return f"{source_id}_{content_hash[:8]}_{chunk_index}"
        else:
            return f"{content_hash}_{chunk_index}"

# Global instance for reuse
_document_processor = None

def get_document_processor(
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> DocumentProcessor:
    """Get or create the global document processor instance"""
    global _document_processor
    if _document_processor is None:
        _document_processor = DocumentProcessor(chunk_size, chunk_overlap)
    return _document_processor

