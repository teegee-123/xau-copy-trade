#!/bin/bash
# Docker entrypoint script for XAU Copy Trade

set -e

echo "Starting XAU Copy Trade..."

# Create session directory if it doesn't exist
mkdir -p /app/sessions

# Check if required environment variables are set
if [ -z "$TELEGRAM_API_ID" ] || [ -z "$TELEGRAM_API_HASH" ] || [ -z "$TELEGRAM_PHONE" ]; then
    echo "ERROR: Missing required Telegram environment variables"
    echo "Please set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_PHONE"
    exit 1
fi

# Start the application
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
