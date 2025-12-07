@echo off
REM WealthArena - RL Inference Service Startup
REM This script starts the RL inference service on port 5002

echo ========================================
echo WealthArena - RL Inference Service
echo ========================================
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Set Python path (adjust if needed)
set PYTHON_EXE=python

REM Check if Python is available
%PYTHON_EXE% --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found in PATH
    echo Please install Python or add it to your PATH
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo WARNING: .env file not found
    echo Please create .env file with required configuration
    echo See .env.example for template
    pause
    exit /b 1
)

REM Display startup info
echo Starting RL inference service...
echo Port: 5002
echo Model Mode: Mock (until Phase 7 training completes)
echo.
echo Press CTRL+C to stop the service
echo.

REM Run the service
cd api
%PYTHON_EXE% inference_server.py

REM If service exits
echo.
echo ========================================
echo RL inference service stopped
echo ========================================
pause

