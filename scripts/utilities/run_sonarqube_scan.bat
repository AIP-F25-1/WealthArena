@echo off
REM SonarQube Scan Script
REM Runs tests, generates coverage, and executes SonarQube scan

setlocal enabledelayedexpansion

echo ========================================
echo SonarQube Scan Script
echo ========================================
echo.

set PROJECT_ROOT=%~dp0..
cd /d "%PROJECT_ROOT%"

REM Check if sonar-scanner is available
where sonar-scanner >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: sonar-scanner not found in PATH
    echo Please install SonarQube Scanner and add it to PATH
    exit /b 1
)

echo Step 1: Running Backend Tests...
cd backend
if exist package.json (
    call npm test
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Backend tests failed, but continuing...
    )
    if not exist coverage\lcov.info (
        echo ERROR: Backend coverage file not found: coverage\lcov.info
        exit /b 1
    )
    echo Backend coverage generated: coverage\lcov.info
) else (
    echo WARNING: Backend package.json not found, skipping...
)
cd ..

echo.
echo Step 2: Running Frontend Tests...
cd frontend
if exist package.json (
    call npm test
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Frontend tests failed, but continuing...
    )
    if not exist coverage\lcov.info (
        echo ERROR: Frontend coverage file not found: coverage\lcov.info
        exit /b 1
    )
    echo Frontend coverage generated: coverage\lcov.info
) else (
    echo WARNING: Frontend package.json not found, skipping...
)
cd ..

echo.
echo Step 3: Running Python Service Tests...
echo.

REM Chatbot
echo Running Chatbot tests...
cd chatbot
if exist requirements.txt (
    python -m pytest --cov=app --cov-report=xml --cov-report=term
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Chatbot tests failed, but continuing...
    )
    if not exist coverage.xml (
        echo ERROR: Chatbot coverage file not found: coverage.xml
        exit /b 1
    )
    echo Chatbot coverage generated: coverage.xml
) else (
    echo WARNING: Chatbot requirements.txt not found, skipping...
)
cd ..

REM RL Training
echo Running RL Training tests...
cd rl-training
if exist requirements.txt (
    python -m pytest --cov=src --cov-report=xml --cov-report=term
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: RL Training tests failed, but continuing...
    )
    if not exist coverage.xml (
        echo ERROR: RL Training coverage file not found: coverage.xml
        exit /b 1
    )
    echo RL Training coverage generated: coverage.xml
) else (
    echo WARNING: RL Training requirements.txt not found, skipping...
)
cd ..

REM RL Service
echo Running RL Service tests...
cd rl-service
if exist requirements.txt (
    python -m pytest --cov=api --cov-report=xml --cov-report=term
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: RL Service tests failed, but continuing...
    )
    if exist coverage.xml (
        echo RL Service coverage generated: coverage.xml
    )
) else (
    echo WARNING: RL Service requirements.txt not found, skipping...
)
cd ..

echo.
echo Step 4: Running SonarQube Scan...
echo.

REM Get project key from command line arguments or environment
REM Usage: run_sonarqube_scan.bat <group_id> <repo_name>
REM Example: run_sonarqube_scan.bat F25 WealthArena
REM This will create project key: AIP-F25-WealthArena

set GROUP_ID=%1
set REPO_NAME=%2

if "%GROUP_ID%"=="" (
    echo ERROR: Group ID required as first argument
    echo Usage: run_sonarqube_scan.bat ^<group_id^> ^<repo_name^>
    echo Example: run_sonarqube_scan.bat F25 WealthArena
    exit /b 1
)

if "%REPO_NAME%"=="" (
    echo ERROR: Repository name required as second argument
    echo Usage: run_sonarqube_scan.bat ^<group_id^> ^<repo_name^>
    echo Example: run_sonarqube_scan.bat F25 WealthArena
    exit /b 1
)

REM Construct project key: AIP-F25-{group_id}_{repo_name}
set SONAR_PROJECT_KEY=AIP-F25-%GROUP_ID%_%REPO_NAME%

REM Check for SONAR_TOKEN in environment
if "%SONAR_TOKEN%"=="" (
    echo WARNING: SONAR_TOKEN not set in environment
    echo You may need to set it or use -Dsonar.login=your_token
)

echo Using SonarQube project key: %SONAR_PROJECT_KEY%
echo Group ID: %GROUP_ID%
echo Repository Name: %REPO_NAME%
echo.

REM Run sonar-scanner with project key
REM If SONAR_TOKEN is set, it will be used automatically
if "%SONAR_TOKEN%"=="" (
    sonar-scanner -Dsonar.projectKey=%SONAR_PROJECT_KEY%
) else (
    sonar-scanner -Dsonar.projectKey=%SONAR_PROJECT_KEY% -Dsonar.login=%SONAR_TOKEN%
)

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: SonarQube scan failed
    exit /b 1
)

echo.
echo ========================================
echo SonarQube Scan Complete!
echo ========================================
echo.
echo View results on SonarCloud:
echo https://sonarcloud.io/project/overview?id=%SONAR_PROJECT_KEY%
echo.
echo IMPORTANT: Add SonarQube screenshots to your progress report!
echo.

endlocal

