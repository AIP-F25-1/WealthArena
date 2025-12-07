@echo off
REM WealthArena - RL Signal Generation
REM This script generates trading signals using RL model inference

echo ========================================
echo WealthArena - RL Signal Generation
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
echo Starting RL signal generation...
echo.
%PYTHON_EXE% 03_generate_rl_signals.py

REM Check exit code
if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Signal generation failed!
    echo Check logs for details
    echo ========================================
    exit /b 1
) else (
    echo.
    echo ========================================
    echo SUCCESS: Signal generation completed
    echo ========================================
    exit /b 0
)

