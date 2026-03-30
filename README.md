# XAU Copy Trade - Paper Trading Dashboard

A robust, real-time paper trading system that listens to Telegram channels for XAU/USD (Gold) trading signals, validates entry prices via live WebSocket feeds, executes paper trades, and displays real-time status on a high-performance React dashboard.

## Features

- **Telegram Signal Monitoring**: Uses MTProto (Telethon) to listen to Telegram channels for trading signals
- **Edited Message Detection**: Automatically detects when signals are edited to include SL/TP
- **Live Price Validation**: Validates entry prices against Binance Futures WebSocket feed
- **Paper Trading**: Executes simulated trades with automatic SL/TP management
- **Real-time Dashboard**: React dashboard with WebSocket updates for live P&L tracking
- **Single Container Deployment**: Multi-stage Docker build for easy deployment on Render

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  FastAPI Server                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐  │    │
│  │  │ REST    │  │ WebSocket│  │ Static Files        │  │    │
│  │  │ API     │  │ /ws     │  │ (React Build)       │  │    │
│  │  └─────────┘  └─────────┘  └─────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│           │                │                                 │
│           ▼                ▼                                 │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Telegram        │  │ Price Service   │                   │
│  │ Service         │  │ (Binance WS)    │                   │
│  │ (Telethon)      │  │                 │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, Telethon, websockets
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Price Feed**: Binance Futures WebSocket (XAUUSDT)
- **Deployment**: Docker (multi-stage build)

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ (for building frontend)
- Telegram API credentials (from my.telegram.org)

### 1. Get Telegram API Credentials

1. Go to https://my.telegram.org/apps
2. Log in with your phone number
3. Create a new application
4. Copy your **API ID** and **API Hash**

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=+1234567890
TELEGRAM_CHANNEL_ID=-1001234567890
```

**Note**: To get the channel ID, forward a message from the target channel to [@userinfobot](https://t.me/userinfobot) on Telegram.

### 3. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies (for frontend)
cd frontend
npm install
cd ..
```

### 4. Build Frontend

```bash
cd frontend
npm run build
cd ..
```

### 5. Run the Application

```bash
python -m uvicorn backend.main:app --reload --port 8001
```

The application will start on http://localhost:8001

### 6. First-Time Telegram Authentication

On first run, you may see a Telegram authentication error. The Telethon library requires interactive authentication to create the session file. 

**Option A: Run a simple auth script:**

```python
# auth_setup.py
from telethon import TelegramClient
from backend.config import get_telegram_config

config = get_telegram_config()
client = TelegramClient('backend/' + config['session_name'], config['api_id'], config['api_hash'])

async def main():
    await client.start(phone=config['phone'])
    print("Authentication complete! Session file created.")
    await client.disconnect()

import asyncio
asyncio.run(main())
```

Run it: `python auth_setup.py` and follow the prompts.

**Option B: The session will be created automatically** when you run the main application and enter the code in the console.

### 7. Verify Installation

Run the health check:

```bash
python test_app.py
```

Or open http://localhost:8001 in your browser.

## Running Locally

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** (for frontend development)
- **Telegram API credentials** from [my.telegram.org](https://my.telegram.org)

### Step 1: Clone and Setup Environment

```bash
# Clone the repository (if not already done)
git clone <your-repo-url>
cd xau-copy-trade

# Copy environment file
cp .env.example .env
```

### Step 2: Configure Environment Variables

Edit `.env` with your credentials:

```env
# Telegram credentials (get from my.telegram.org)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=+1234567890
TELEGRAM_CHANNEL_ID=-1001234567890

# Optional: Signal parsing patterns
SIGNAL_SYMBOL_PATTERN=(?i)(XAUUSD|XAU/USD|GOLD|GOLDUSD)\b
SIGNAL_DIRECTION_PATTERN=(?i)\b(BUY|SELL|LONG|SHORT)\b
```

**Getting Channel ID**: Forward a message from the target channel to [@userinfobot](https://t.me/userinfobot) on Telegram.

### Step 3: Install Backend Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 4: First-Time Telegram Authentication

Run the backend once to authenticate with Telegram:

```bash
python -m uvicorn backend.main:app --reload
```

- Check the terminal for authentication prompts
- Enter the code sent to your Telegram account
- A session file will be created at `./backend/xau_copy_trade.session`

### Step 5: Run Backend Server

```bash
# With auto-reload for development
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at http://localhost:8000

### Step 6: Run Frontend Development Server

Open a new terminal:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Run development server with Vite
npm run dev
```

The frontend will be available at http://localhost:5173 (or the port shown in terminal)

### Step 7: Access the Dashboard

- **Frontend (Vite dev server)**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Local Development Tips

- **Backend auto-reload**: The `--reload` flag enables hot-reload on code changes
- **Frontend hot-module-replacement**: Vite provides instant updates on changes
- **Session persistence**: The Telegram session file is stored in `./backend/`
- **Logs**: Check both terminal windows for backend and frontend logs

### Troubleshooting Local Setup

**Telegram authentication fails:**
- Ensure phone number includes country code (e.g., +1 for US)
- Verify API ID and Hash are correct (no extra spaces)
- Check that your Telegram account is active

**Port already in use:**
```bash
# Use a different port for backend
python -m uvicorn backend.main:app --reload --port 8001

# Update frontend proxy in frontend/vite.config.ts to match
```

**Module not found errors:**
```bash
# Ensure you're in the project root and venv is activated
pip install -r requirements.txt
```

## Local Development

### Backend

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run with hot reload
python -m uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server (proxies to backend)
npm run dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check for Render keep-alive |
| `/api/trades/active` | GET | Get all active trades |
| `/api/trades/pending` | GET | Get pending trades (waiting for entry) |
| `/api/trades/history` | GET | Get closed trade history |
| `/api/trades/{id}` | GET | Get specific trade |
| `/api/trades/{id}/close` | POST | Manually close a trade |
| `/api/summary` | GET | Get trading summary statistics |
| `/api/control` | POST | Pause/Resume bot |
| `/api/status` | GET | Get bot status |
| `/ws/trades` | WebSocket | Real-time trade updates |

## Signal Format

The parser supports configurable regex patterns. Default expected format:

```
GOLD BUY Entry 4553-4556 SL 4546 TP 4559/4569/4579
```

Or edited message flow:
1. Initial: `GOLD BUY 4556`
2. Edited: `GOLD BUY NOW, Entry 4553-4556, SL 4546, TP 4559`

### Customizing Regex Patterns

Edit these in `.env` to match your signal channel format:

```env
SIGNAL_SYMBOL_PATTERN=(?i)(XAUUSD|XAU/USD|GOLD|GOLDUSD)\b
SIGNAL_DIRECTION_PATTERN=(?i)\b(BUY|SELL|LONG|SHORT)\b
SIGNAL_ENTRY_PATTERN=(?i)(?:entry|enter|@|around)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)
SIGNAL_SL_PATTERN=(?i)(?:SL|Stop Loss|StopLoss|S\.L\.?)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)
SIGNAL_TP_PATTERN=(?i)(?:TP|Take Profit|TakeProfit|T\.P\.?)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)
```

## Deploy to Render

### Steps

1. **Create a new Web Service** on [Render](https://render.com)

2. **Connect your repository** (GitHub/GitLab)

3. **Configure build settings**:
   - **Build Command**: `docker build -t xau-copy-trade .`
   - **Start Command**: `docker run -p $PORT:$PORT --env-file .env xau-copy-trade`

4. **Set environment variables** (all from `.env.example`):
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `TELEGRAM_PHONE`
   - `TELEGRAM_CHANNEL_ID`
   - `RENDER_DEPLOYED=true`

5. **Choose instance type**: Free tier is available but note:
   - Service sleeps after 15 minutes of inactivity
   - First request after sleep takes ~30 seconds to wake up

### Keep-Alive for Render Free Tier

The free tier sleeps after inactivity. Options to prevent sleep:

1. **External Ping Service**: Use a service like [UptimeRobot](https://uptimerobot.com) to ping `/api/health` every 5 minutes

2. **Frontend Heartbeat**: The dashboard automatically reconnects WebSocket, which can help keep the connection alive while open

3. **Upgrade to Paid Tier**: For production use, consider the paid tier

### Docker Deploy Command

Alternatively, use Render's Docker deployment:

```yaml
# render.yaml
services:
  - type: web
    name: xau-copy-trade
    env: docker
    region: oregon
    plan: free
    envVars:
      - key: TELEGRAM_API_ID
        sync: false
      - key: TELEGRAM_API_HASH
        sync: false
      - key: TELEGRAM_PHONE
        sync: false
      - key: TELEGRAM_CHANNEL_ID
        sync: false
      - key: RENDER_DEPLOYED
        value: true
```

## Trading Logic

### Entry Conditions

- **BUY**: Entry only if `Current Price <= Max Entry Price`
- **SELL**: Entry only if `Current Price >= Min Entry Price`

### Stop Loss / Take Profit

- If multiple TPs are provided, the **lowest TP** is used for the target
- SL and TP are checked every second against live price
- Trades auto-close when SL or TP is hit

### Position Sizing

Default: 0.01 lots with 1x leverage
- P&L calculated as: `(Exit - Entry) * Position * 100` for BUY
- P&L calculated as: `(Entry - Exit) * Position * 100` for SELL

## Project Structure

```
xau-copy-trade/
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Environment configuration
│   ├── dependency_injection.py # DI container
│   ├── models/                 # Pydantic models
│   ├── services/               # Business logic services
│   ├── parsers/                # Signal parsing logic
│   ├── api/                    # REST & WebSocket handlers
│   └── utils/                  # Utilities
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   ├── context/            # React context
│   │   ├── services/           # API client
│   │   └── types/              # TypeScript types
│   └── dist/                   # Built static files
├── Dockerfile
├── requirements.txt
├── .env.example
└── README.md
```

## Extensibility

The system follows SOLID principles with Abstract Base Classes:

- **Add new signal sources**: Implement `ITelegramService`
- **Add new price providers**: Implement `IPriceService`
- **Add new parsing formats**: Extend `SignalParserService`
- **Add persistence**: Implement trade storage in `TradeManager`

## Troubleshooting

### Telegram Authentication Failed

- Ensure you've run locally first to create the session file
- Check that API ID/Hash are correct
- Verify phone number format includes country code

### No Signals Detected

- Verify channel ID is correct (negative for channels/supergroups)
- Check that the Telegram account is a member of the channel
- Ensure regex patterns match your signal format

### Price Feed Disconnected

- Binance WebSocket may have rate limits
- Check network connectivity
- The service auto-reconnects on disconnect

### Render Deployment Issues

- Check logs in Render dashboard
- Ensure all environment variables are set
- Session file needs to persist - consider using Render's persistent disk

## Disclaimer

**This is a PAPER TRADING system only.** No real money is involved. This software is for educational and testing purposes only and should not be used for actual trading without significant modifications and proper risk management.

## License

MIT License - See LICENSE file for details.
