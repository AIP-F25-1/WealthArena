#!/bin/bash
# ============================================================================
# Azure App Service Startup Script for WealthArena
# ============================================================================
# Purpose: Ensures proper Python path configuration and starts the application
#          with appropriate error handling and diagnostics.
#
# Requirements:
#   - GROQ_API_KEY must be set in Azure app settings
#   - PYTHONPATH must be set to /home/site/wwwroot
#   - PORT is automatically set by Azure App Service
#
# This script should be set as the startup command in Azure App Service:
#   az webapp config set --startup-file "bash startup.sh"
#
# Note: Ensure this file has execute permissions (chmod +x startup.sh)
# ============================================================================

set -e  # Exit on any error

# Change to application directory
cd /home/site/wwwroot || {
    echo "ERROR: Failed to change to /home/site/wwwroot directory"
    exit 1
}

# Set Python path for module imports (critical for relative imports)
export PYTHONPATH=/home/site/wwwroot:$PYTHONPATH
echo "INFO: PYTHONPATH set to: $PYTHONPATH"

# Get PORT from environment (Azure sets this automatically)
PORT=${PORT:-8000}
echo "INFO: Application will bind to port: $PORT"

# Validate required environment variables
if [ -z "$GROQ_API_KEY" ]; then
    echo "ERROR: GROQ_API_KEY environment variable is not set"
    echo "ERROR: Please configure GROQ_API_KEY in Azure app settings"
    exit 1
fi
echo "INFO: GROQ_API_KEY is set (validation passed)"

# Verify the main module can be imported (non-blocking - just log warnings)
echo "INFO: Verifying Python module can be imported..."
if python3 -c "import sys; sys.path.insert(0, '/home/site/wwwroot'); import app.main" 2>/dev/null; then
    echo "INFO: ✓ Module import successful"
else
    echo "WARNING: Pre-import check failed, but continuing startup (app may still work)"
    echo "WARNING: If app fails to start, check dependencies and PYTHONPATH"
fi

# Display startup configuration
echo "INFO: ============================================"
echo "INFO: Starting WealthArena API Server"
echo "INFO: ============================================"
echo "INFO: Working Directory: $(pwd)"
echo "INFO: Python Version: $(python3 --version)"
echo "INFO: PYTHONPATH: $PYTHONPATH"
echo "INFO: PORT: $PORT"
echo "INFO: Workers: 2"
echo "INFO: Worker Class: uvicorn.workers.UvicornWorker"
echo "INFO: Timeout: 120s"
echo "INFO: ============================================"

# Start gunicorn with uvicorn workers
# Using exec to replace shell process with gunicorn (proper signal handling)
# Note: Removed --preload to avoid import issues during startup
exec gunicorn \
    --bind "0.0.0.0:$PORT" \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    app.main:app

