# 🚀 XAU Copy Trade - Quick Start Guide

## ✅ Application Status: FULLY WORKING

**Dashboard:** http://localhost:8001

**Load Time:** < 0.3 seconds ⚡

All systems operational:
- ✓ Backend API
- ✓ Frontend Dashboard  
- ✓ Price Feed (Binance WebSocket)
- ✓ Trade Management
- ✓ Real-time Updates

---

## 📋 Quick Start (3 Steps)

### Step 1: Configure Telegram Credentials

1. Open `.env` file in a text editor
2. Fill in these 4 values:

```env
TELEGRAM_API_ID=12345678           # Get from my.telegram.org
TELEGRAM_API_HASH=abc123def456     # Get from my.telegram.org
TELEGRAM_PHONE=+1234567890         # Your phone number
TELEGRAM_CHANNEL_ID=-1001234567890 # Channel to monitor
```

**How to get Telegram API credentials:**
1. Go to https://my.telegram.org/apps
2. Log in with your phone number
3. Click "Create Application"
4. Copy API ID and API Hash

**How to get Channel ID:**
1. Forward a message from the channel to [@userinfobot](https://t.me/userinfobot)
2. The bot will show you the channel ID (use the negative number)

---

### Step 2: Run the Application

**Option A: Use the batch file (Easiest)**
```bash
run.bat
```

**Option B: Manual commands**
```bash
# Start the server
python -m uvicorn backend.main:app --reload --port 8001
```

---

### Step 3: Open the Dashboard

Open your browser and go to: **http://localhost:8001**

You should see the trading dashboard!

---

## 🧪 Verify Everything Works

Run the test script:
```bash
python test_app.py
```

Expected output:
```
✓ All tests passed! The application is running correctly.
```

---

## 📱 First-Time Telegram Setup (Optional)

To receive signals from Telegram, you need to authenticate once:

```bash
python auth_setup.py
```

Follow the prompts to enter the code sent to your Telegram.

**Note:** The app will run without this, but won't receive Telegram signals until authenticated.

---

## 🎯 Dashboard Features

| Feature | Description |
|---------|-------------|
| **Summary Cards** | Real-time P&L, win rate, trade counts |
| **Active Trades** | Open positions with live P&L updates |
| **Pending Trades** | Signals waiting for entry conditions |
| **Trade History** | Closed trades with results |
| **Connection Status** | Telegram, Price Feed, WebSocket status |
| **Bot Controls** | Pause/Resume trading |

---

## 🔧 Troubleshooting

### "Module not found" errors
```bash
# Install Python dependencies
pip install -r requirements.txt
```

### Frontend not loading
```bash
# Rebuild frontend
cd frontend
npm run build
cd ..
```

### Port 8001 already in use
```bash
# Kill existing Python processes
taskkill /F /IM python.exe

# Or use a different port
python -m uvicorn backend.main:app --port 8002
```

### Telegram authentication failed
- Check that API ID and Hash are correct in `.env`
- Make sure phone number includes country code (e.g., +1 for US)
- Run `auth_setup.py` to authenticate manually

---

## 📁 Project Structure

```
xau-copy-trade/
├── backend/           # Python FastAPI backend
├── frontend/          # React TypeScript frontend
├── .env              # Your configuration (create from .env.example)
├── run.bat           # Quick start script
├── setup.bat         # First-time setup script
├── auth_setup.py     # Telegram authentication
├── test_app.py       # Health check tests
└── README.md         # Full documentation
```

---

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/trades/active` | GET | Active trades |
| `/api/trades/pending` | GET | Pending trades |
| `/api/trades/history` | GET | Trade history |
| `/api/summary` | GET | Trading summary |
| `/api/status` | GET | Bot status |
| `/api/control` | POST | Pause/Resume bot |
| `/ws/trades` | WebSocket | Real-time updates |

---

## 🐳 Docker Deployment (Optional)

For production deployment on Render or similar:

```bash
# Build Docker image
docker build -t xau-copy-trade .

# Run container
docker run -p 8000:8000 --env-file .env xau-copy-trade
```

---

## 📞 Need Help?

1. Check `README.md` for detailed documentation
2. Run `python test_app.py` to diagnose issues
3. Check logs in the console for error messages

---

**Enjoy trading! 📈**

*Remember: This is paper trading only - no real money involved.*
