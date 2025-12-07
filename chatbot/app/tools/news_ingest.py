"""
RSS News Ingestion Tool
Fetches RSS feeds from financial news sources with metrics tracking
"""

import time
import asyncio
import aiohttp
import feedparser
from typing import List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Default RSS sources for financial news
DEFAULT_RSS_SOURCES = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://feeds.reuters.com/news/wealth",
    "https://rss.cnn.com/rss/money_latest.rss",
    "https://feeds.bloomberg.com/markets/news.rss",
    "https://www.marketwatch.com/rss/topstories",
    "https://feeds.finance.yahoo.com/rss/2.0/headline",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://feeds.feedburner.com/TheMotleyFool",
]

@dataclass
class FeedMetrics:
    """Metrics for a single RSS feed"""
    source_url: str
    success_count: int = 0
    error_count: int = 0
    blocked_count: int = 0
    total_response_time_ms: float = 0.0
    last_fetch_time: datetime = field(default_factory=datetime.now)
    
    @property
    def avg_response_time_ms(self) -> float:
        """Calculate average response time"""
        if self.success_count == 0:
            return 0.0
        return self.total_response_time_ms / self.success_count
    
    @property
    def total_requests(self) -> int:
        """Total number of requests made"""
        return self.success_count + self.error_count + self.blocked_count

class NewsIngest:
    """RSS news ingestion with metrics tracking"""
    
    def __init__(self):
        self.feed_metrics: Dict[str, FeedMetrics] = {}
        self.session_start_time = datetime.now()
        
    async def fetch_rss(self, sources: List[str] = None, limit_per_feed: int = 10) -> List[Dict[str, Any]]:
        """
        Fetch RSS feeds from multiple sources
        
        Args:
            sources: List of RSS feed URLs. If None, uses DEFAULT_RSS_SOURCES
            limit_per_feed: Maximum number of articles to fetch per feed
            
        Returns:
            List of article dictionaries with metadata
        """
        if sources is None:
            sources = DEFAULT_RSS_SOURCES.copy()
            
        all_articles = []
        
        # Create aiohttp session with timeout
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            tasks = []
            for source in sources:
                task = self._fetch_single_feed(session, source, limit_per_feed)
                tasks.append(task)
            
            # Execute all feed fetches concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Feed fetch failed: {result}")
                    continue
                if result:
                    all_articles.extend(result)
        
        logger.info(f"Fetched {len(all_articles)} articles from {len(sources)} sources")
        return all_articles
    
    async def _fetch_single_feed(self, session: aiohttp.ClientSession, source_url: str, limit: int) -> List[Dict[str, Any]]:
        """
        Fetch a single RSS feed with metrics tracking
        
        Args:
            session: aiohttp session
            source_url: RSS feed URL
            limit: Maximum articles to return
            
        Returns:
            List of article dictionaries
        """
        # Initialize metrics for this source if not exists
        if source_url not in self.feed_metrics:
            self.feed_metrics[source_url] = FeedMetrics(source_url=source_url)
        
        metrics = self.feed_metrics[source_url]
        start_time = time.time()
        
        try:
            # Set user agent to avoid blocking
            headers = {
                'User-Agent': 'WealthArena-NewsBot/1.0 (Educational Trading Platform)'
            }
            
            async with session.get(source_url, headers=headers) as response:
                response_time_ms = (time.time() - start_time) * 1000
                
                if response.status == 403 or response.status == 429:
                    # Blocked or rate limited
                    metrics.blocked_count += 1
                    logger.warning(f"Blocked/Rate limited for {source_url}: HTTP {response.status}")
                    return []
                
                if response.status != 200:
                    metrics.error_count += 1
                    logger.error(f"HTTP error for {source_url}: {response.status}")
                    return []
                
                # Parse RSS content
                content = await response.text()
                feed = feedparser.parse(content)
                
                if feed.bozo:
                    logger.warning(f"RSS parsing warning for {source_url}: {feed.bozo_exception}")
                
                # Update success metrics
                metrics.success_count += 1
                metrics.total_response_time_ms += response_time_ms
                metrics.last_fetch_time = datetime.now()
                
                # Extract articles
                articles = []
                for entry in feed.entries[:limit]:
                    article = self._parse_article(entry, source_url, feed.feed)
                    articles.append(article)
                
                logger.debug(f"Fetched {len(articles)} articles from {source_url} in {response_time_ms:.1f}ms")
                return articles
                
        except asyncio.TimeoutError:
            metrics.error_count += 1
            logger.error(f"Timeout fetching {source_url}")
            return []
        except Exception as e:
            metrics.error_count += 1
            logger.error(f"Error fetching {source_url}: {e}")
            return []
    
    def _parse_article(self, entry: Any, source_url: str, feed_info: Any) -> Dict[str, Any]:
        """
        Parse a single RSS entry into article dictionary
        
        Args:
            entry: RSS entry from feedparser
            source_url: Source RSS URL
            feed_info: Feed metadata
            
        Returns:
            Article dictionary
        """
        # Extract publication date
        pub_date = None
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            pub_date = datetime(*entry.published_parsed[:6]).isoformat()
        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            pub_date = datetime(*entry.updated_parsed[:6]).isoformat()
        
        # Extract summary/description
        summary = ""
        if hasattr(entry, 'summary'):
            summary = entry.summary
        elif hasattr(entry, 'description'):
            summary = entry.description
        
        # Extract source name from feed title or URL
        source_name = "Unknown"
        if hasattr(feed_info, 'title') and feed_info.title:
            source_name = feed_info.title
        else:
            # Extract domain from URL as fallback
            parsed_url = urlparse(source_url)
            source_name = parsed_url.netloc
        
        return {
            "title": getattr(entry, 'title', 'No Title'),
            "link": getattr(entry, 'link', ''),
            "summary": summary,
            "published_date": pub_date,
            "source_name": source_name,
            "source_url": source_url,
            "guid": getattr(entry, 'id', getattr(entry, 'link', '')),
            "fetched_at": datetime.now().isoformat()
        }
    
    def rss_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive RSS metrics
        
        Returns:
            Dictionary with success rate, error rate, throughput, and totals
        """
        total_success = sum(m.success_count for m in self.feed_metrics.values())
        total_errors = sum(m.error_count for m in self.feed_metrics.values())
        total_blocked = sum(m.blocked_count for m in self.feed_metrics.values())
        total_requests = total_success + total_errors + total_blocked
        
        # Calculate success percentage
        success_pct = (total_success / total_requests * 100) if total_requests > 0 else 0.0
        
        # Calculate error rate
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0.0
        
        # Calculate pages per minute (throughput)
        session_duration_minutes = (datetime.now() - self.session_start_time).total_seconds() / 60
        pages_per_min = total_success / session_duration_minutes if session_duration_minutes > 0 else 0.0
        
        # Calculate average response time across all feeds
        total_response_time = sum(m.total_response_time_ms for m in self.feed_metrics.values())
        avg_response_time_ms = total_response_time / total_success if total_success > 0 else 0.0
        
        # Per-feed metrics
        feed_details = {}
        for url, metrics in self.feed_metrics.items():
            feed_details[url] = {
                "success_count": metrics.success_count,
                "error_count": metrics.error_count,
                "blocked_count": metrics.blocked_count,
                "avg_response_time_ms": round(metrics.avg_response_time_ms, 2),
                "last_fetch_time": metrics.last_fetch_time.isoformat() if metrics.last_fetch_time else None,
                "total_requests": metrics.total_requests
            }
        
        return {
            "success_pct": round(success_pct, 2),
            "error_rate": round(error_rate, 2),
            "blocked_rate": round((total_blocked / total_requests * 100) if total_requests > 0 else 0.0, 2),
            "pages_per_min": round(pages_per_min, 2),
            "avg_response_time_ms": round(avg_response_time_ms, 2),
            "total": {
                "requests": total_requests,
                "success": total_success,
                "errors": total_errors,
                "blocked": total_blocked
            },
            "session_duration_minutes": round(session_duration_minutes, 2),
            "feeds_configured": len(DEFAULT_RSS_SOURCES),
            "feeds_attempted": len(self.feed_metrics),
            "feed_details": feed_details
        }

# Global instance for reuse
_news_ingest = None

def get_news_ingest() -> NewsIngest:
    """Get or create the global news ingest instance"""
    global _news_ingest
    if _news_ingest is None:
        _news_ingest = NewsIngest()
    return _news_ingest

async def fetch_rss(sources: List[str] = None, limit_per_feed: int = 10) -> List[Dict[str, Any]]:
    """
    Convenience function to fetch RSS feeds
    
    Args:
        sources: List of RSS feed URLs
        limit_per_feed: Maximum articles per feed
        
    Returns:
        List of article dictionaries
    """
    ingest = get_news_ingest()
    return await ingest.fetch_rss(sources, limit_per_feed)

def rss_metrics() -> Dict[str, Any]:
    """
    Convenience function to get RSS metrics
    
    Returns:
        Dictionary with RSS metrics
    """
    ingest = get_news_ingest()
    return ingest.rss_metrics()

