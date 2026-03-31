# XAU Copy Trade Dashboard

A comprehensive paper trading dashboard that consumes trading signals from Telegram channels, executes paper trades, tracks positions, and closes them when stop loss (SL) or take profit (TP) levels are hit.

![Dashboard Preview](./docs/dashboard-preview.png)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-username/xau-copy-trade)

## Features

- **Telegram Integration**: MTProto-based authentication for consuming signals from Telegram channels
- **Real-Time Price Feed**: 1-second polling interval for XAU/USD prices with fallback support
- **Automated Trade Execution**: Parse signals and execute paper trades automatically
- **SL/TP Management**: Automatic position closing when stop loss or take profit levels are hit
- **Fault Detection**: 5-minute timeout handling for trades missing SL/TP levels
- **Real-Time Dashboard**: Green/black programmer theme with live updates via WebSocket
- **Trade History**: Complete audit trail with filtering and exit reason tracking
- **P&L Tracking**: Real-time profit/loss calculations in USD and percentage
- **Equity Curve**: Visual chart showing account performance over time
- **Log Viewer**: In-dashboard system log viewing with level filtering

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express.js |
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite |
| Telegram | grammy + Telegram MTProto |
| Charts | Recharts |
| Logging | Winston + Daily Rotate |
| Container | Docker |

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Docker (optional, for containerized deployment)
- Telegram API credentials (from https://my.telegram.org/apps)

### 1. Clone and Install

```bash
cd xau-copy-trade
npm install
cd src/client && npm install && cd ../..
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Telegram Configuration (get from https://my.telegram.org/apps)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=+1234567890
TELEGRAM_CHANNEL_ID=-1001234567890

# Trade Configuration
DEFAULT_LOT_SIZE=0.1
DEFAULT_SYMBOL=XAUUSD

# Price API - WORKS WITHOUT API KEY (simulated prices)
# For real market data, get a FREE API key from:
# Twelve Data (RECOMMENDED): https://twelvedata.com/ (800 calls/day)
PRICE_API_KEY=your_twelvedata_api_key
```

**Note:** The application works immediately without an API key using realistic simulated prices. For real market data, sign up for a free Twelve Data API key.

### 3. Run Development Server

```bash
# Run both server and client
npm run dev

# Or run separately
npm run dev:server  # Backend on port 3000
npm run dev:client  # Frontend on port 5173
```

Open http://localhost:5173 to view the dashboard.

### 4. Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

Access the dashboard at http://localhost:3000

### 5. Deploy to Render (Cloud Hosting)

Deploy to Render.com's free tier in minutes:

```bash
# Push your code to GitHub/GitLab
git push origin main

# Then visit Render dashboard:
# https://dashboard.render.com → New + → Blueprint
# Or use the Deploy button at the top of this README
```

**Free Tier Includes:**
- 512 MB RAM
- 0.25 vCPU
- 750 hours/month (24/7 for one service)
- 100 GB bandwidth/month

See the complete guide: [docs/render-deployment.md](./docs/render-deployment.md)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `TELEGRAM_API_ID` | Telegram API ID | Required |
| `TELEGRAM_API_HASH` | Telegram API Hash | Required |
| `TELEGRAM_PHONE` | Telegram phone number | Required |
| `TELEGRAM_CHANNEL_ID` | Channel ID to monitor | Required |
| `DEFAULT_LOT_SIZE` | Default position size | `0.1` |
| `DEFAULT_SYMBOL` | Default trading symbol | `XAUUSD` |
| `PRICE_API_KEY` | Price API key (optional) | Optional |
| `SESSION_FILE_PATH` | Session storage path | `./data/session.json` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_MAX_LINES` | Max log lines before rotation | `1000` |
| `TRADING_ENABLED` | Enable/disable trading | `true` |
| `SL_TP_TIMEOUT_MINUTES` | Timeout for missing SL/TP | `5` |

**Price API Options (Free Tiers):**

| Provider | Free Tier | Requires Key | Website |
|----------|-----------|--------------|---------|
| **Simulated** | Unlimited | ❌ No | Built-in |
| Twelve Data | 800 calls/day | ✅ Yes | twelvedata.com |
| GoldAPI.io | 500 calls/month | ✅ Yes | goldapi.io |
| Metals-API | Free tier | ✅ Yes | metals-api.com |

The application works **immediately without configuration** using realistic simulated prices. For real market data, sign up for a free Twelve Data API key (recommended).

### Trade Signal Template Configuration

The application uses configurable regex templates to parse trade signals from Telegram messages. Templates are defined in `src/config/trade-templates.json`.

#### How to Configure Templates

See the detailed guide in [Template Configuration Guide](#template-configuration-guide) below.

## API Reference

### Authentication Endpoints

```
GET /auth/request?phone={phone}
  - Sends verification code to Telegram
  - Response: { success: true, message: "Code sent" }

GET /auth/verify?code={code}
  - Verifies code and completes authentication
  - Response: { success: true, session: {...} }

GET /auth/status
  - Get current auth status
  - Response: { success: true, status: {...} }
```

### Trade Endpoints

```
GET /api/trades/open
  - List all open trades

GET /api/trades/history?from=&to=&symbol=&action=
  - List closed trades with optional filters

POST /api/trades/:id/close
  - Manually close a trade
  - Body: { reason?: string }

POST /api/trades/close-faulted
  - Close all trades missing SL/TP after timeout

GET /api/trades/summary
  - Get P&L summary
```

### Price Endpoints

```
GET /api/price/current
  - Get current XAU/USD price

GET /api/price/status
  - Get price feed status
```

### System Endpoints

```
GET /api/status
  - Get overall system status

GET /api/logs?level=&limit=
  - Get recent logs with optional filter

POST /api/logs/clear
  - Clear all logs

GET /api/equity?range=1D|1W|1M|ALL
  - Get equity history for charts

POST /api/trading/toggle
  - Toggle trading on/off
  - Body: { enabled: boolean }
```

### WebSocket

Connect to `ws://localhost:3000/ws` for real-time updates:

```typescript
// Message types
{ type: 'INIT', data: { telegram, price, currentPrice } }
{ type: 'PRICE_UPDATE', data: { symbol, price, timestamp } }
{ type: 'TRADE_UPDATE', data: { trade, type } }
{ type: 'STATUS_CHANGE', data: { type, status } }
```

## Template Configuration Guide

### Understanding the Pattern Syntax

Patterns use JavaScript RegExp syntax:

- `^` and `$` - Start and end of message
- `\\s+` - One or more whitespace characters
- `([\\d.]+)` - Capture group for numbers (price values)
- `(buy|sell)` - Capture group for action keywords
- `i` flag - Case insensitive matching
- `[\\s\\S]*?` - Match any characters (including newlines) non-greedily

### Example Configuration

```json
{
  "entrySignalTemplate": {
    "description": "Pattern to detect initial trade signal",
    "pattern": "^(gold|xau(?:usd)?)\\s+(buy|sell)\\s+([\\d.]+)$",
    "flags": "i",
    "extractionRules": {
      "symbol": {
        "group": 1,
        "transform": "uppercase",
        "mapping": {
          "GOLD": "XAUUSD",
          "XAU": "XAUUSD"
        }
      },
      "action": {
        "group": 2,
        "transform": "uppercase"
      },
      "maxEntryPrice": {
        "group": 3,
        "transform": "parseFloat"
      }
    }
  }
}
```

### Common Patterns

**Simple Signal**: `gold buy 4556`
```regex
^(gold|xau)\\s+(buy|sell)\\s+([\\d.]+)$
```

**Detailed Signal**: `GOLD BUY NOW\nEntry: 4553-4556\nSL: 4546\nTP: 4559`
```regex
(gold|xau)\\s+(buy|sell)[\\s\\S]*?entry[\\s:]+([\\d.\\-]+)[\\s\\S]*?sl[\\s:]+([\\d.]+)[\\s\\S]*?tp[\\s:]+([\\d.]+)
```

### Testing Your Configuration

Add test cases to the `examples` array in your template:

```json
"examples": [
  {
    "message": "gold buy 4556",
    "extracted": { "symbol": "XAUUSD", "action": "BUY", "maxEntryPrice": 4556 }
  }
]
```

## Architecture

```
xau-copy-trade/
├── src/
│   ├── server/
│   │   ├── index.ts              # Express app entry
│   │   ├── routes/               # API route handlers
│   │   ├── services/             # Business logic
│   │   │   ├── telegram.ts       # MTProto client
│   │   │   ├── priceFeed.ts      # Price polling
│   │   │   ├── tradeManager.ts   # Trade execution
│   │   │   └── database.ts       # SQLite ORM
│   │   ├── websocket/            # WebSocket server
│   │   └── logger.ts             # Winston config
│   ├── client/
│   │   ├── src/
│   │   │   ├── components/       # React components
│   │   │   ├── hooks/            # Custom hooks
│   │   │   └── types/            # TypeScript types
│   │   └── package.json
│   └── config/
│       └── trade-templates.json  # Signal parsing config
├── data/                         # SQLite DB & sessions
├── logs/                         # Application logs
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Trading Logic

### Entry Rules

1. Parse initial signal to extract: action, symbol, max entry price
2. Validate entry price against current market price
3. Reject if price exceeds max entry (for BUY) or below min entry (for SELL)
4. Create trade with fixed lot size from `.env`

### SL/TP Handling

1. Parse edited messages to extract SL and TP levels
2. Update existing trade with new levels
3. Monitor price every 500ms for SL/TP hits
4. Close entire position when SL or TP is hit

### Timeout Handling

If SL/TP not received within 5 minutes:
- Mark trade as `FAULTED`
- Display warning in dashboard
- Enable "Close Trade" button
- Enable "Auto Close All Faulted" button

### P&L Calculation

```
P&L (USD) = (currentPrice - entryPrice) × lotSize × 100 (for BUY)
P&L (USD) = (entryPrice - currentPrice) × lotSize × 100 (for SELL)
P&L (%) = (P&L USD / positionValue) × 100
```

## Error Handling

### Telegram Disconnection
- Warning displayed via status chip
- Automatic reconnection with exponential backoff
- Event logged to system logs

### Price API / Feed Issues

**Application works without API key:**
- The app uses realistic simulated prices by default
- Prices fluctuate around current XAU/USD rate (~$2650/oz)
- No configuration needed for testing/development

**For real market data:**
1. Get a FREE API key from [Twelve Data](https://twelvedata.com/) (800 calls/day)
2. Add to `.env`: `PRICE_API_KEY=your_api_key`
3. Restart the application

**If API fails:**
- Warning displayed via status chip
- Automatically falls back to simulated prices
- Continues using last known price

### Trade Execution Errors
- Paper trades close using last known price
- Full error context logged
- Dashboard notification displayed

## Development

### Build for Production

```bash
# Build both client and server
npm run build

# Build separately
npm run build:client   # React app to src/client/dist
npm run build:server   # TypeScript to dist/server
```

### Run Production Build

```bash
npm start
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### Telegram Authentication Fails

1. Verify API credentials from https://my.telegram.org/apps
2. Ensure phone number format includes country code (e.g., +1234567890)
3. Check that session file is writable: `chmod 755 ./data`

### Price Feed Not Updating

1. Check `PRICE_API_KEY` is valid
2. Verify API endpoint is accessible
3. Check logs for rate limit errors
4. Application will fallback to simulated prices

### Trades Not Executing

1. Verify `TRADING_ENABLED=true` in `.env`
2. Check Telegram channel ID matches exactly
3. Review logs for signal parsing errors
4. Test template patterns with actual messages

### Database Errors

1. Ensure `./data` directory exists and is writable
2. Delete `./data/trades.db` to reset (loses trade history)
3. Check for WAL file locks: remove `trades.db-wal` and `trades.db-shm`

## Security Notes

- Never commit `.env` file with real credentials
- Session files contain authentication tokens - keep secure
- Use environment variables for sensitive data in production
- Consider adding API authentication for production deployments

## Future Enhancements

- [ ] Multi-channel support
- [ ] Position sizing from message parsing
- [ ] Partial TP closes
- [ ] Trailing stop loss
- [ ] Backtesting mode
- [ ] Risk management rules
- [ ] Webhook support for non-Telegram signals
- [ ] Multi-user support with authentication

## License

MIT

## Support

For issues and feature requests, please open an issue on GitHub.
