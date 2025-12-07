# syntax=docker/dockerfile:1

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# System deps (yfinance, chromadb deps, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p /app/data/vectorstore /app/data/game_state

EXPOSE 8000

# Production: Use gunicorn with uvicorn workers
# Development: Override CMD to use uvicorn directly
# PORT environment variable is read by the application (app/main.py)
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-", "app.main:app"]
