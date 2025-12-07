"""
WealthArena Mobile Integration Main Application
FastAPI application with mobile SDK endpoints
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables before importing any modules that read them
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

from .api.chat import router as chat_router
from .api.chat_stream import router as chat_stream_router
from .api.history import router as history_router
from .api.feedback import router as feedback_router
from .api.export import router as export_router
from .api.context import router as context_router
from .api.metrics import router as metrics_router, api_router as metrics_api_router
from .api.game import router as game_router
from .api.game_stream import router as game_stream_router
from .api.search import router as search_router
from .api.explain import router as explain_router
from .api.market import router as market_router
from .api.background import router as background_router
from .api.onboarding import router as onboarding_router
from .middleware.metrics import MetricsMiddleware
from .background.scheduler import BackgroundScheduler, set_scheduler

# Lifespan context manager for background tasks
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    # Startup: initialize and start scheduler only if enabled
    logger = logging.getLogger(__name__)
    scheduler = None
    
    # Ensure required directories exist on startup (for Azure and other deployments)
    # Note: vectorstore directory creation is lazy - only created when ChromaDB is first used
    # This prevents ChromaDB initialization at startup, allowing faster app startup
    try:
        # Ensure game_state directory exists (lightweight, no ChromaDB dependency)
        # Use cross-platform path - Azure uses /home/data, local uses ./data
        if os.path.exists("/home/data"):
            game_state_dir = "/home/data/game_state"
        else:
            # Local development - use relative path
            script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_dir = os.path.join(script_dir, "data", "game_state")
            game_state_dir = data_dir
        os.makedirs(game_state_dir, exist_ok=True)
        logger.info(f"Ensured game_state directory exists: {game_state_dir}")
    except Exception as e:
        # Don't fail startup if directory creation fails - it's not critical
        logger.debug(f"Game state directory creation skipped (may already exist or not needed): {e}")
    
    enable_scheduler = os.getenv('ENABLE_BACKGROUND_SCHEDULER', 'false').lower() in ('true', '1', 'yes')
    if enable_scheduler:
        logger.info("Starting background scheduler...")
        scheduler = BackgroundScheduler()
        set_scheduler(scheduler)
        await scheduler.start()
        logger.info("Background scheduler started")
    else:
        logger.info("Background scheduler disabled (ENABLE_BACKGROUND_SCHEDULER not set to true)")
        set_scheduler(None)
    
    yield
    
    # Shutdown: stop scheduler if it was started
    if scheduler is not None:
        logger.info("Stopping background scheduler...")
        await scheduler.stop()
        logger.info("Background scheduler stopped")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="WealthArena Mobile API",
    description="Mobile SDK backend for WealthArena trading education platform",
    version="1.0.0",
    lifespan=lifespan
)

logging.info("WealthArena API booting...")
logging.info("CORS, routers, and metrics will be attached next.")

# Log port configuration
port = int(os.getenv("PORT", "8000"))
logging.info(f"Server will start on port {port} (from PORT env var or default 8000)")

# CORS origins from environment variable (comma-separated) or default to local dev origins
_cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
if _cors_origins_env:
    # Parse comma-separated origins from environment
    cors_origins = [origin.strip() for origin in _cors_origins_env.split(",") if origin.strip()]
    logging.info(f"CORS origins from environment: {cors_origins}")
else:
    # Default to local development origins
    # Note: HTTP is used for local development only. Production should use HTTPS.
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://10.0.2.2:8000",  # Android emulator - required for development
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:5173",  # Vite
        "http://127.0.0.1:5173",
        "http://localhost:19006",  # Expo
    ]
    logging.info(f"CORS origins using defaults for local dev: {cors_origins}")
    if not os.getenv("NODE_ENV") == "development":
        logging.warning("Using HTTP origins in non-development environment. Consider using HTTPS in production.")

# Add CORS middleware for mobile - restrict in production
# In production, CORS should be more restrictive
is_production = os.getenv("NODE_ENV") == "production" or os.getenv("ENVIRONMENT") == "production"

if is_production:
    # Production CORS - more restrictive
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,  # Should be specific domains in production
        allow_credentials=False,  # Disable credentials in production for security
        allow_methods=["GET", "POST"],  # Only allow necessary methods
        allow_headers=["Content-Type", "Authorization"],  # Only allow necessary headers
    )
else:
    # Development CORS - more permissive for local development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
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
app.include_router(metrics_router, prefix="", tags=["metrics"])  # No prefix for /metrics
app.include_router(metrics_api_router, prefix="/v1/metrics", tags=["metrics"])  # JSON endpoints under /v1/metrics
app.include_router(game_router, prefix="/v1", tags=["game"])
app.include_router(game_stream_router, prefix="/v1", tags=["game-stream"])
app.include_router(search_router, prefix="/v1", tags=["search"])
app.include_router(explain_router, prefix="/v1", tags=["explain"])
app.include_router(market_router, prefix="/v1", tags=["market"])
app.include_router(background_router, prefix="/v1", tags=["background"])
app.include_router(onboarding_router, prefix="/v1", tags=["onboarding"])

logging.info("Routers mounted. Health=/healthz Docs=/docs")

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
    """Lightweight health check endpoint - responds immediately without any dependencies"""
    # This endpoint should be as fast as possible - no imports, no database checks, no LLM initialization
    return {
        "status": "ok",
        "service": "chatbot"
    }

@app.get("/kanika")
async def test():
    """Health check endpoint"""
    return { "Hello World": "Kanika" }

@app.get("/llm-status")
async def llm_status():
    """Check LLM provider configuration"""
    from .llm.client import LLMClient
    client = LLMClient()
    return {
        "provider": client.provider,
        "deepseek_configured": bool(client.deepseek_api_key),
        "deepseek_model": client.deepseek_model if client.deepseek_api_key else None,
        "using_openrouter": client.use_openrouter if client.deepseek_api_key else None,
        "groq_configured": bool(client.groq_api_key and client.groq_api_key.startswith('gsk_')),
        "groq_model": client.groq_model if (client.groq_api_key and client.groq_api_key.startswith('gsk_')) else None
    }

# Register diagnostic endpoint only in dev environment
if os.getenv("ENV") == "dev":
    @app.get("/__diag")
    def diag():
        """Diagnostic endpoint for troubleshooting (dev only)"""
        status = {"app": "wealtharena", "ok": True}
        try:
            import chromadb  # optional
            status["chroma"] = True
        except Exception as e:
            status["chroma"] = False
            status["chroma_error"] = str(e)
        return status

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
