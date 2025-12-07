"""
Prometheus Metrics for WealthArena
Defines and exports Prometheus metrics for monitoring
"""

from typing import Dict, Any

# Try to import Prometheus and FastAPI dependencies with fallbacks
try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
    _HAS_PROMETHEUS = True
except ImportError:
    _HAS_PROMETHEUS = False
    # Create no-op classes for when prometheus_client is not available
    class Counter:
        def __init__(self, *args, **kwargs):
            pass
        def labels(self, **kwargs):
            return self
        def inc(self, value=1):
            pass
    
    class Histogram:
        def __init__(self, *args, **kwargs):
            pass
        def labels(self, **kwargs):
            return self
        def observe(self, value):
            pass
    
    class Gauge:
        def __init__(self, *args, **kwargs):
            pass
        def labels(self, **kwargs):
            return self
        def set(self, value):
            pass
        def inc(self, value=1):
            pass
    
    def generate_latest():
        return b""
    
    CONTENT_TYPE_LATEST = "text/plain"

try:
    from fastapi import Response
    _HAS_FASTAPI = True
except ImportError:
    _HAS_FASTAPI = False
    # Create a simple Response class for when FastAPI is not available
    class Response:
        def __init__(self, content, media_type="text/plain"):
            self.content = content
            self.media_type = media_type

# Chat metrics
CHAT_REQ_TOTAL = Counter(
    "chat_requests_total",
    "Total number of chat requests",
    ["status"]  # status: success, error
)

CHAT_LATENCY = Histogram(
    "chat_latency_seconds",
    "Chat request latency in seconds",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Game metrics
GAME_TICK_LAT = Histogram(
    "game_tick_latency_seconds",
    "Game tick processing latency in seconds",
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

GAME_TRADES_TOTAL = Counter(
    "game_trades_total",
    "Total number of game trades",
    ["side"]  # side: buy, sell
)

# Search metrics
SEARCH_LAT = Histogram(
    "vector_or_fallback_search_seconds",
    "Search latency in seconds",
    ["mode"],  # mode: vector, fallback
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]
)

# Additional useful metrics
ACTIVE_GAMES = Gauge(
    "active_games_total",
    "Number of currently active games"
)

SEARCH_REQUESTS_TOTAL = Counter(
    "search_requests_total",
    "Total number of search requests",
    ["mode"]  # mode: vector, fallback
)

EXPLAIN_REQUESTS_TOTAL = Counter(
    "explain_requests_total",
    "Total number of explain requests",
    ["status"]  # status: success, error
)

EXPLAIN_LATENCY = Histogram(
    "explain_latency_seconds",
    "Explain request latency in seconds",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Scraping metrics (DEPRECATED - scraping removed, kept for backward compatibility)
SCRAPE_REQUESTS_TOTAL = Counter(
    "scrape_requests_total",
    "Total number of scraping requests (deprecated)",
    ["source_type", "status"]  # source_type: rss/sec, status: success/error
)

SCRAPE_LATENCY = Histogram(
    "scrape_latency_seconds",
    "Scraping operation latency in seconds (deprecated)",
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0]
)

SCRAPE_DOCUMENTS_TOTAL = Counter(
    "scrape_documents_total",
    "Total number of documents fetched (deprecated)",
    ["source_type"]  # source_type: rss/sec
)

# Ingestion metrics
INGEST_DOCUMENTS_TOTAL = Counter(
    "ingest_documents_total",
    "Total number of documents ingested",
    ["collection", "status"]  # collection: news_articles/educational_content/forex_events/community_posts, status: added/duplicate/error
)

INGEST_LATENCY = Histogram(
    "ingest_latency_seconds",
    "Ingestion operation latency in seconds",
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0]
)

VECTOR_STORE_DOCUMENTS = Gauge(
    "vector_store_documents",
    "Total number of documents in vector store",
    ["collection"]  # collection: wealtharena_kb/news_articles/educational_content/forex_events/community_posts
)

# Background job metrics
BACKGROUND_JOB_RUNS_TOTAL = Counter(
    "background_job_runs_total",
    "Total number of background job runs",
    ["job_name", "status"]  # job_name: news_ingestion/sec_ingestion, status: success/error
)

BACKGROUND_JOB_LAST_SUCCESS = Gauge(
    "background_job_last_success_timestamp",
    "Timestamp of last successful background job run",
    ["job_name"]  # job_name: news_ingestion/sec_ingestion
)

def get_metrics_response() -> Response:
    """
    Generate Prometheus metrics response
    
    Returns:
        FastAPI Response with metrics data
    """
    return Response(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

def record_chat_request(status: str, latency: float):
    """
    Record a chat request metric
    
    Args:
        status: Request status (success, error)
        latency: Request latency in seconds
    """
    CHAT_REQ_TOTAL.labels(status=status).inc()
    CHAT_LATENCY.observe(latency)

def record_game_tick(latency: float):
    """
    Record a game tick metric
    
    Args:
        latency: Tick processing latency in seconds
    """
    GAME_TICK_LAT.observe(latency)

def record_game_trade(side: str):
    """
    Record a game trade metric
    
    Args:
        side: Trade side (buy, sell)
    """
    GAME_TRADES_TOTAL.labels(side=side).inc()

def record_search_request(mode: str, latency: float):
    """
    Record a search request metric
    
    Args:
        mode: Search mode (vector, fallback)
        latency: Search latency in seconds
    """
    SEARCH_REQUESTS_TOTAL.labels(mode=mode).inc()
    SEARCH_LAT.labels(mode=mode).observe(latency)

def record_explain_request(status: str, latency: float):
    """
    Record an explain request metric
    
    Args:
        status: Request status (success, error)
        latency: Request latency in seconds
    """
    EXPLAIN_REQUESTS_TOTAL.labels(status=status).inc()
    EXPLAIN_LATENCY.observe(latency)

def set_active_games(count: int):
    """
    Set the number of active games
    
    Args:
        count: Number of active games
    """
    ACTIVE_GAMES.set(count)

def record_scrape_request(source_type: str, status: str, latency: float, doc_count: int = 0):
    """
    Record a scraping request metric (DEPRECATED - scraping removed)
    
    Args:
        source_type: Source type (rss/sec)
        status: Request status (success/error)
        latency: Request latency in seconds
        doc_count: Number of documents fetched
    """
    SCRAPE_REQUESTS_TOTAL.labels(source_type=source_type, status=status).inc()
    SCRAPE_LATENCY.observe(latency)
    if doc_count > 0:
        SCRAPE_DOCUMENTS_TOTAL.labels(source_type=source_type).inc(doc_count)

def record_ingest_operation(collection: str, status: str, latency: float, doc_count: int = 0):
    """
    Record an ingestion operation metric
    
    Args:
        collection: Collection name (news_articles/educational_content/forex_events/community_posts)
        status: Operation status (added/duplicate/error)
        latency: Operation latency in seconds
        doc_count: Number of documents processed
    """
    if not _HAS_PROMETHEUS:
        return  # No-op when prometheus_client is not available
    INGEST_DOCUMENTS_TOTAL.labels(collection=collection, status=status).inc(doc_count)
    INGEST_LATENCY.observe(latency)

def record_background_job(job_name: str, status: str, duration: float):
    """
    Record a background job execution metric
    
    Args:
        job_name: Job name (news_ingestion/sec_ingestion)
        status: Job status (success/error)
        duration: Job duration in seconds
    """
    BACKGROUND_JOB_RUNS_TOTAL.labels(job_name=job_name, status=status).inc()
    if status == "success":
        import time
        BACKGROUND_JOB_LAST_SUCCESS.labels(job_name=job_name).set(time.time())

def update_vector_store_size(collection: str, count: int):
    """
    Update vector store document count gauge
    
    Args:
        collection: Collection name
        count: Document count
    """
    if not _HAS_PROMETHEUS:
        return  # No-op when prometheus_client is not available
    VECTOR_STORE_DOCUMENTS.labels(collection=collection).set(count)

def get_metrics_summary() -> Dict[str, Any]:
    """
    Get a summary of current metrics (for debugging/monitoring)
    
    Returns:
        Dictionary with metrics summary
    """
    return {
        "metrics_available": [
            "chat_requests_total",
            "chat_latency_seconds", 
            "game_tick_latency_seconds",
            "game_trades_total",
            "vector_or_fallback_search_seconds",
            "active_games_total",
            "search_requests_total",
            "explain_requests_total",
            "explain_latency_seconds",
            "scrape_requests_total",
            "scrape_latency_seconds",
            "scrape_documents_total",
            "ingest_documents_total",
            "ingest_latency_seconds",
            "vector_store_documents",
            "background_job_runs_total",
            "background_job_last_success_timestamp"
        ],
        "description": "Prometheus metrics for WealthArena API monitoring"
    }
