@echo off
REM WealthArena - Full Data Pipeline
REM This script runs the complete data pipeline:
REM 1. Download latest market data
REM 2. Compute technical indicators
REM 3. Generate RL trading signals

echo ========================================
echo WealthArena - Full Data Pipeline
echo ========================================
echo.
echo This will execute:
echo   1. Market data refresh (10-15 min)
echo   2. Technical indicators (5-8 min)
echo   3. RL signal generation (3-5 min)
echo.
echo Total estimated time: 20-30 minutes
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Set Python path
set PYTHON_EXE=python

REM Check if Python is available
%PYTHON_EXE% --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found in PATH
    exit /b 1
)

REM Create logs directory
if not exist "logs" mkdir logs

REM Record start time
echo Pipeline started at %date% %time%
echo.

REM ========================================
REM Step 1: Market Data Refresh
REM ========================================
echo ========================================
echo Step 1/3: Market Data Refresh
echo ========================================
echo.
%PYTHON_EXE% 01_daily_market_data_refresh.py
if errorlevel 1 (
    echo.
    echo ERROR: Market data refresh failed!
    echo Pipeline aborted.
    exit /b 1
)
echo.
echo Step 1/3 completed successfully
echo.

REM ========================================
REM Step 2: Technical Indicators
REM ========================================
echo ========================================
echo Step 2/3: Technical Indicators
echo ========================================
echo.
%PYTHON_EXE% 02_compute_technical_indicators.py
if errorlevel 1 (
    echo.
    echo ERROR: Technical indicators computation failed!
    echo Pipeline aborted.
    exit /b 1
)
echo.
echo Step 2/3 completed successfully
echo.

REM ========================================
REM Step 3: RL Signal Generation
REM ========================================
echo ========================================
echo Step 3/3: RL Signal Generation
echo ========================================
echo.
%PYTHON_EXE% 03_generate_rl_signals.py
if errorlevel 1 (
    echo.
    echo ERROR: Signal generation failed!
    echo Pipeline aborted.
    exit /b 1
)
echo.
echo Step 3/3 completed successfully
echo.

REM ========================================
REM Pipeline Complete
REM ========================================
echo ========================================
echo SUCCESS: Full Pipeline Completed!
echo ========================================
echo.
echo Pipeline finished at %date% %time%
echo.
echo All steps completed successfully:
echo   [OK] Market data refresh
echo   [OK] Technical indicators
echo   [OK] RL signal generation
echo.
echo Check logs directory for detailed execution logs
echo.
exit /b 0

