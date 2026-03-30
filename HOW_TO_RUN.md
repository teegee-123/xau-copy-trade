# How to Run XAU Copy Trade

## Quick Start (2 Steps)

### Step 1: Configure Your Telegram Credentials

Open the `.env` file and fill in these 4 values:

```
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE=+1234567890
TELEGRAM_CHANNEL_ID=-1001234567890
```

**Where to get these:**
1. Go to https://my.telegram.org/apps
2. Log in with your phone number
3. Create a new application
4. Copy the API ID and API Hash

**For Channel ID:**
- Forward a message from your signal channel to @userinfobot
- Use the ID it shows (include the negative sign, e.g., -1001234567890)

---

### Step 2: Run the Application

**Option A - Double-click (Easiest):**
```
Double-click run.bat
```

**Option B - Command Line:**
```bash
python -m uvicorn backend.main:app --port 8001
```

---

### Step 3: Open the Dashboard

Open your browser and go to:
```
http://localhost:8001
```

**Load time should be under 0.3 seconds!** ⚡

---

## First Time Setup (One Time Only)

If this is your first time running the app, run the setup script:

```
Double-click setup.bat
```

This will:
1. Create the .env file if needed
2. Install Python dependencies
3. Install Node.js dependencies
4. Build the frontend
5. Help you authenticate with Telegram

---

## Verify Everything Works

Run the test:
```bash
python test_app.py
```

You should see:
```
✓ All tests passed! The application is running correctly.
```

---

## Troubleshooting

### Dashboard loads slowly or not at all

1. Make sure no other program is using port 8001
2. Kill any existing Python processes:
   ```
   taskkill /F /IM python.exe
   ```
3. Restart with `run.bat`

### "Module not found" error

Install Python dependencies:
```bash
pip install -r requirements.txt
```

### Frontend shows blank page

Rebuild the frontend:
```bash
cd frontend
npm run build
cd ..
```

### Telegram not connecting

1. Check your credentials in `.env` are correct
2. Run the authentication script:
   ```bash
   python auth_setup.py
   ```

---

## What You'll See

When you open http://localhost:8001:

1. **Summary Cards** - P&L, win rate, trade counts
2. **Active Trades Tab** - Open positions with live updates
3. **Pending Trades Tab** - Signals waiting for entry
4. **History Tab** - Closed trades
5. **Connection Status** - Shows Telegram, Price Feed, and WebSocket status
6. **Bot Controls** - Pause/Resume buttons

---

## Stop the Application

Press `CTRL+C` in the command window where it's running.

---

**That's it! Happy (paper) trading! 📈**
