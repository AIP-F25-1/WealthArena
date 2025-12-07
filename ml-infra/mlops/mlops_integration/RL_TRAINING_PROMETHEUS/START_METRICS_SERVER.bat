@echo off
echo ========================================
echo RL Training Prometheus Metrics Server
echo ========================================
echo.
echo Starting metrics server on port 8011...
echo.

cd /d "%~dp0"
python run_metrics_server.py

pause

