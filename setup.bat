@echo off
REM XAU Copy Trade - First Time Setup Script
REM Run this ONCE to set up the application

echo ============================================================
echo XAU Copy Trade - First Time Setup
echo ============================================================
echo.

REM Step 1: Create .env file
echo [Step 1] Creating .env file...
if exist .env (
    echo .env file already exists, skipping...
) else (
    copy .env.example .env
    echo Created .env from .env.example
    echo.
    echo IMPORTANT: Edit .env and add your Telegram credentials:
    echo   - TELEGRAM_API_ID
    echo   - TELEGRAM_API_HASH
    echo   - TELEGRAM_PHONE
    echo   - TELEGRAM_CHANNEL_ID
    echo.
    echo Get these from: https://my.telegram.org/apps
    echo.
    pause
)
echo.

REM Step 2: Install Python dependencies
echo [Step 2] Installing Python dependencies...
pip install -r requirements.txt
echo.

REM Step 3: Install Node.js dependencies
echo [Step 3] Installing Node.js dependencies...
cd frontend
call npm install
cd ..
echo.

REM Step 4: Build frontend
echo [Step 4] Building frontend...
cd frontend
call npm run build
cd ..
echo.

REM Step 5: Telegram authentication
echo [Step 5] Telegram Authentication Setup
echo.
echo You need to authenticate with Telegram once to create a session file.
echo.
set /p AUTH="Do you want to authenticate now? (Y/N): "
if /i "%AUTH%"=="Y" (
    python auth_setup.py
)
echo.

echo ============================================================
echo Setup Complete!
echo ============================================================
echo.
echo To run the application:
echo   1. Run: run.bat
echo   2. Open: http://localhost:8001
echo.
echo Or directly:
echo   python -m uvicorn backend.main:app --reload --port 8001
echo.
pause
