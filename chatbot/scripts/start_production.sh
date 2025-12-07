#!/bin/bash
# Production startup script for WealthArena
# Uses gunicorn with uvicorn workers for better performance

set -e

# Get port from environment or default to 8000
PORT=${PORT:-8000}
WORKERS=${WORKERS:-2}
TIMEOUT=${TIMEOUT:-120}

echo "Starting WealthArena API in production mode..."
echo "Port: $PORT"
echo "Workers: $WORKERS"
echo "Timeout: $TIMEOUT"

# Start gunicorn with uvicorn workers
exec gunicorn \
    --bind "0.0.0.0:$PORT" \
    --workers "$WORKERS" \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout "$TIMEOUT" \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    app.main:app

