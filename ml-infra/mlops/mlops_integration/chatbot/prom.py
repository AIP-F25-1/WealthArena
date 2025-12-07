"""
Prometheus Metrics for WealthArena
Defines and exports Prometheus metrics for monitoring
"""

from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response
from typing import Dict, Any

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
            "explain_latency_seconds"
        ],
        "description": "Prometheus metrics for WealthArena API monitoring"
    }
