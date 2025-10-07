"""
WealthArena Mobile Integration Main Application
FastAPI application with mobile SDK endpoints
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .api.chat import router as chat_router
from .api.chat_stream import router as chat_stream_router
from .api.history import router as history_router
from .api.feedback import router as feedback_router
from .api.export import router as export_router
from .api.context import router as context_router
from .api.metrics import router as metrics_router
from .api.game import router as game_router
from .api.game_stream import router as game_stream_router
from .api.search import router as search_router
from .api.explain import router as explain_router
from .api.market import router as market_router
from .middleware.metrics import MetricsMiddleware
from .metrics.prom import get_metrics_response

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="WealthArena Mobile API",
    description="Mobile SDK backend for WealthArena trading education platform",
    version="1.0.0"
)

# Add CORS middleware for mobile
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://10.0.2.2:8000",  # Android emulator
        "http://127.0.0.1:8000",
        "http://localhost:8080",
        "http://localhost:19006",  # Expo
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add metrics middleware
app.add_middleware(MetricsMiddleware)

# Include API routers
app.include_router(chat_router, prefix="/v1", tags=["chat"])
app.include_router(chat_stream_router, prefix="/v1", tags=["chat-stream"])
app.include_router(history_router, prefix="/v1", tags=["chat-history"])
app.include_router(feedback_router, prefix="/v1", tags=["chat-feedback"])
app.include_router(export_router, prefix="/v1", tags=["chat-export"])
app.include_router(context_router, prefix="/v1", tags=["context", "knowledge"])
app.include_router(metrics_router, prefix="/v1/metrics", tags=["metrics"])
app.include_router(game_router, prefix="/v1", tags=["game"])
app.include_router(game_stream_router, prefix="/v1", tags=["game-stream"])
app.include_router(search_router, prefix="/v1", tags=["search"])
app.include_router(explain_router, prefix="/v1", tags=["explain"])
app.include_router(market_router, prefix="/v1", tags=["market"])

# Prometheus metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return get_metrics_response()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "WealthArena Mobile API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/healthz")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "wealtharena-mobile-api",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

