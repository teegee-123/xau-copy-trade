@echo off
REM XAU Copy Trade - Quick Start Script for Windows
REM Simply double-click this file to run the application

echo ============================================================
echo XAU Copy Trade - Starting...
echo ============================================================
echo.

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo Please run setup.bat first or copy .env.example to .env
    pause
    exit /b 1
)

REM Check if Python dependencies are installed
python -c "import fastapi" 2>nul
if errorlevel 1 (
    echo Installing Python dependencies...
    pip install -r requirements.txt
)

REM Check if frontend is built
if not exist frontend\dist\index.html (
    echo Building frontend...
    cd frontend
    call npm run build
    cd ..
)

echo.
echo ============================================================
echo Starting server on http://localhost:8001
echo Press CTRL+C to stop
echo ============================================================
echo.

python -m uvicorn backend.main:app --port 8001
