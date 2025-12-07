@echo off
REM WealthArena - Daily Market Data Refresh
REM This script downloads the latest market data for all asset classes

echo ========================================
echo WealthArena - Daily Market Data Refresh
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
    exit /b 1
)

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Run the script
echo Starting market data refresh...
echo.
%PYTHON_EXE% 01_daily_market_data_refresh.py

REM Check exit code
if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Market data refresh failed!
    echo Check logs for details
    echo ========================================
    exit /b 1
) else (
    echo.
    echo ========================================
    echo SUCCESS: Market data refresh completed
    echo ========================================
    exit /b 0
)

