# XAU Copy Trade Dashboard - Project Context

## Project Overview

**XAU Copy Trade Dashboard** is a comprehensive paper trading system that monitors Telegram channels for XAU/USD (Gold) trading signals, executes virtual trades, and tracks performance in real-time. The application features a modern React dashboard with live WebSocket updates, SQLite persistence, and MTProto-based Telegram integration.

### Core Features

- **Telegram Signal Parsing**: MTProto-based authentication to consume signals from Telegram channels
- **Configurable Template Matching**: Regex or simple string matching (StartsWith/EndsWith/Contains) for parsing trade signals
- **Real-Time Price Feed**: 1-second polling for XAU/USD prices (simulated by default, or live via Twelve Data API)
- **Automated Trade Execution**: Parse signals and execute paper trades with configurable lot sizes
- **SL/TP Management**: Automatic position closing when stop loss or take profit levels are hit
- **Fault Detection**: 5-minute timeout for trades missing SL/TP levels
- **Live Dashboard**: React + Tailwind CSS with Green/Black theme and WebSocket real-time updates
- **Trade History**: Complete audit trail with filtering and exit reason tracking
- **P&L Tracking**: Real-time profit/loss calculations in USD and percentage
- **Equity Curve**: Recharts visualization showing account performance over time
- **In-App Configuration**: Runtime template editing and testing via ConfigPanel UI

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js 20+, Express.js, TypeScript (ESM) |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS |
| **Database** | SQLite (better-sqlite3) |
| **Telegram** | MTProto (telegram package), grammy |
| **Charts** | Recharts |
| **Logging** | Winston + Daily Rotate File |
| **WebSocket** | Native `ws` library |
| **Container** | Docker (node:20-alpine) |
| **Deployment** | Render.com (free tier optimized) |

## Project Structure

```
xau-copy-trade/
├── src/
│   ├── server/                    # Backend TypeScript
│   │   ├── index.ts               # Express app entry point
│   │   ├── logger.ts              # Winston logger configuration
│   │   ├── routes/                # API route handlers
│   │   │   ├── auth.ts            # Telegram auth endpoints
│   │   │   ├── trades.ts          # Trade CRUD operations
│   │   │   ├── price.ts           # Price feed endpoints
│   │   │   ├── system.ts          # System status/logs endpoints
│   │   │   └── config.ts          # Template config endpoints
│   │   ├── services/              # Business logic layer
│   │   │   ├── telegram.ts        # MTProto client, signal parsing
│   │   │   ├── priceFeed.ts       # Price polling service
│   │   │   ├── tradeManager.ts    # Trade execution/management
│   │   │   ├── configService.ts   # Template config & validation
│   │   │   └── database.ts        # SQLite ORM operations
│   │   └── websocket/             # WebSocket server
│   │       └── index.ts           # Real-time broadcast service
│   ├── client/                    # Frontend React app
│   │   ├── src/
│   │   │   ├── components/        # React components
│   │   │   │   ├── ConfigPanel.tsx      # Template config UI
│   │   │   │   ├── EquityChart.tsx      # Performance chart
│   │   │   │   ├── LogViewer.tsx        # System log viewer
│   │   │   │   ├── OpenTradesTable.tsx  # Active trades table
│   │   │   │   ├── PnLDisplay.tsx       # P&L summary display
│   │   │   │   ├── PriceDisplay.tsx     # Live price ticker
│   │   │   │   ├── StatusChips.tsx      # System status indicators
│   │   │   │   ├── TemplateTester.tsx   # Template test tool
│   │   │   │   └── TradeHistory.tsx     # Closed trades table
│   │   │   ├── hooks/             # Custom React hooks
│   │   │   │   ├── useConfig.ts   # Config API + WebSocket
│   │   │   │   ├── usePrice.ts    # Price polling hook
│   │   │   │   ├── useTrades.ts   # Trade data fetching
│   │   │   │   └── useWebSocket.ts# WebSocket connection manager
│   │   │   ├── types/             # TypeScript interfaces
│   │   │   │   └── index.ts       # Shared type definitions
│   │   │   ├── styles/            # Tailwind CSS
│   │   │   │   └── index.css      # Global styles
│   │   │   ├── App.tsx            # Main application component
│   │   │   └── main.tsx           # React entry point
│   │   ├── package.json           # Client dependencies
│   │   └── vite.config.ts         # Vite build config
│   └── config/
│       └── trade-templates.json   # Default signal parsing templates
├── data/                          # SQLite DB & session storage
├── logs/                          # Application log files
├── docs/
│   └── render-deployment.md       # Render.com deployment guide
├── .env.example                   # Environment variable template
├── docker-compose.yml             # Docker Compose configuration
├── Dockerfile                     # Container build instructions
├── render.yaml                    # Render.com blueprint config
├── render-healthcheck.js          # Health check script
├── package.json                   # Root dependencies & scripts
├── tsconfig.json                  # TypeScript config (main)
├── tsconfig.server.json           # TypeScript config (server only)
└── build.sh                       # Build script for Render
```

## Building and Running

### Prerequisites

- **Node.js 20+** (check with `node --version`)
- **npm** or **yarn**
- **Docker** (optional, for containerized deployment)
- **Telegram API credentials** from [my.telegram.org/apps](https://my.telegram.org/apps)

### Development Setup

```bash
# Install root dependencies
npm install

# Install client dependencies
npm run install:client

# Copy environment template
cp .env.example .env

# Edit .env with your Telegram credentials
# TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE, TELEGRAM_CHANNEL_ID

# Run both server and client concurrently
npm run dev
```

This starts:
- **Backend** on `http://localhost:3000` (Express API + WebSocket)
- **Frontend** on `http://localhost:5173` (Vite dev server with HMR)

### Build Commands

```bash
# Build both client and server
npm run build

# Build separately
npm run build:client   # React app → src/client/dist
npm run build:server   # TypeScript → dist/server

# Run production build locally
npm start
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in detached mode
docker-compose up -d --build

# Access dashboard at http://localhost:3000
```

### Render.com Deployment

The project includes a `render.yaml` blueprint for one-click deployment:

1. Push code to GitHub/GitLab
2. Visit [Render Dashboard](https://dashboard.render.com) → **New+** → **Blueprint**
3. Connect repository and set required environment variables:
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `TELEGRAM_PHONE`
   - `TELEGRAM_CHANNEL_ID`
4. Deploy completes in ~3-5 minutes

See [docs/render-deployment.md](./docs/render-deployment.md) for detailed instructions.

## Key Configuration

### Environment Variables (.env)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `TELEGRAM_API_ID` | Telegram API ID | - | **Yes** |
| `TELEGRAM_API_HASH` | Telegram API Hash | - | **Yes** |
| `TELEGRAM_PHONE` | Phone number (with country code) | - | **Yes** |
| `TELEGRAM_CHANNEL_ID` | Channel ID to monitor | - | **Yes** |
| `DEFAULT_LOT_SIZE` | Default position size | `0.1` | No |
| `DEFAULT_SYMBOL` | Trading symbol | `XAUUSD` | No |
| `PRICE_API_KEY` | Twelve Data API key (optional) | - | No |
| `SESSION_FILE_PATH` | Session storage path | `./data/session.json` | No |
| `DATABASE_PATH` | SQLite database path | `./data/trades.db` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `TRADING_ENABLED` | Enable/disable trading | `true` | No |
| `SL_TP_TIMEOUT_MINUTES` | Timeout for missing SL/TP | `5` | No |

### Signal Template Configuration

Templates are defined in `src/config/trade-templates.json` and can be edited at runtime via the ConfigPanel UI.

**Entry Signal Example:**
```json
{
  "matchType": "regex",
  "pattern": "^(gold|xau(?:usd)?)\\s+(buy|sell)\\s+([\\d.]+)$",
  "flags": "i",
  "extractionRules": {
    "symbol": { "group": 1, "transform": "uppercase", "mapping": { "GOLD": "XAUUSD" } },
    "action": { "group": 2, "transform": "uppercase" },
    "maxEntryPrice": { "group": 3, "transform": "parseFloat" }
  }
}
```

**SL/TP Signal Example:**
```json
{
  "matchType": "regex",
  "pattern": "(?:GOLD|XAU)\\s+(?:BUY|SELL)[\\s\\S]*?SL[\\s\\n]+([\\d.]+)[\\s\\S]*?TP[\\s\\n]+([\\d.]+)",
  "flags": "i",
  "extractionRules": {
    "stopLoss": { "group": 1, "transform": "parseFloat" },
    "takeProfit": { "group": 2, "transform": "parseFloat" }
  }
}
```

**Supported Match Types:**
- `regex` - Full regex pattern matching (default)
- `startswith` - Simple string prefix matching
- `endswith` - Simple string suffix matching
- `contains` - Simple substring matching

**Supported Extraction Transforms:**
- `uppercase`, `lowercase` - Case transformation
- `parseFloat`, `parseInt` - Numeric parsing
- `parseRange` - Parse ranges like "4553-4556"
- `substring` - Extract by start/end index
- `split` - Split by marker and take index
- `after`, `before` - Extract relative to marker
- `trim` - Remove whitespace

## API Reference

### Authentication

```
GET  /auth/request?phone={phone}    # Send verification code
GET  /auth/verify?code={code}       # Verify code, complete auth
GET  /auth/status                   # Get auth status
```

### Trades

```
GET  /api/trades/open                           # List open trades
GET  /api/trades/history?from=&to=&symbol=      # List closed trades (filtered)
POST /api/trades/:id/close                       # Manually close trade
POST /api/trades/close-faulted                  # Close all faulted trades
GET  /api/trades/summary                        # Get P&L summary
```

### Price

```
GET  /api/price/current     # Get current XAU/USD price
GET  /api/price/status      # Get price feed status
```

### System

```
GET  /api/status            # Overall system status
GET  /api/logs?level=&limit=# Get recent logs
POST /api/logs/clear        # Clear all logs
GET  /api/equity?range=1D|1W|1M|ALL  # Equity history for charts
POST /api/trading/toggle    # Toggle trading on/off
GET  /health                # Health check (for Render)
```

### Configuration

```
GET    /api/config                      # Get full config
PUT    /api/config                      # Update config section
POST   /api/config/test-template        # Test template against message
GET    /api/config/template-examples    # Get template examples
GET    /api/config/historical-messages  # Get historical signals
```

### WebSocket

Connect to `ws://localhost:3000/ws` for real-time updates:

```typescript
// Message types received:
{ type: 'INIT', data: { telegram, price, currentPrice } }
{ type: 'PRICE_UPDATE', data: { symbol, price, timestamp } }
{ type: 'TRADE_UPDATE', data: { trade, type: 'OPENED'|'CLOSED'|'UPDATED' } }
{ type: 'STATUS_CHANGE', data: { type, status } }
{ type: 'CONFIG_UPDATE', data: { section, config } }
```

## Development Conventions

### Coding Style

- **TypeScript**: Strict mode enabled, ES2022 target
- **Modules**: ES Modules (`import`/`export`), not CommonJS
- **Naming**: 
  - Files: `camelCase.ts` for modules, `PascalCase.tsx` for React components
  - Types/Interfaces: `PascalCase`
  - Functions/Variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`

### Testing Practices

- Template testing via built-in `TemplateTester` component
- Manual testing of Telegram authentication flow
- Health check endpoint for automated monitoring

### Git Workflow

- Main branch: `new` (feature branch)
- Commit format: Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)
- `.env` files ignored (use `.env.example` as template)

### Logging

- Winston logger with daily rotation
- Log levels: `error`, `warn`, `info`, `debug`
- Logs stored in `logs/` directory
- In-dashboard log viewer with level filtering

## Architecture Notes

### Data Flow

1. **Telegram Service** connects via MTProto, listens for new messages
2. **Config Service** parses messages using configured templates
3. **Trade Manager** executes paper trades based on parsed signals
4. **Price Feed** polls XAU/USD prices every 1 second
5. **WebSocket Service** broadcasts updates to connected clients
6. **React Dashboard** displays real-time data via custom hooks

### Database Schema (SQLite)

- **trades**: Stores all trade records (open/closed)
  - Fields: id, symbol, action, entryPrice, stopLoss, takeProfit, lotSize, status, pnlUsd, pnlPercent, exitPrice, exitReason, createdAt, updatedAt, closedAt

### Memory Management (Render Free Tier)

- Limited to 512 MB RAM
- `NODE_OPTIONS=--max-old-space-size=400` prevents OOM crashes
- Session and database files stored in `/tmp/` (ephemeral)
- Health check monitors memory usage

## Common Issues & Solutions

### Telegram Authentication Fails
- Verify credentials from my.telegram.org/apps
- Ensure phone format includes country code (+1234567890)
- Check session file is writable: `chmod 755 ./data`

### Price Feed Not Updating
- App works without API key (uses simulated prices)
- For live data, get free Twelve Data key (800 calls/day)
- Falls back to simulated prices on API failure

### Trades Not Executing
- Verify `TRADING_ENABLED=true` in .env
- Check channel ID matches exactly (including `-` prefix)
- Review logs for signal parsing errors

### Database Errors
- Ensure `./data` directory exists and is writable
- Delete `./data/trades.db` to reset (loses history)
- Remove WAL locks: delete `trades.db-wal` and `trades.db-shm`

## File Purposes Summary

| File | Purpose |
|------|---------|
| `package.json` | Root dependencies, npm scripts |
| `src/server/index.ts` | Express app entry, route registration |
| `src/server/services/telegram.ts` | MTProto client, message handling |
| `src/server/services/configService.ts` | Template config, validation, testing |
| `src/server/services/tradeManager.ts` | Trade execution, SL/TP monitoring |
| `src/server/websocket/index.ts` | WebSocket broadcast service |
| `src/client/src/App.tsx` | Main React component, layout |
| `src/client/src/components/ConfigPanel.tsx` | Template editing UI |
| `src/client/src/hooks/useWebSocket.ts` | WebSocket connection management |
| `src/config/trade-templates.json` | Default signal parsing templates |
| `render.yaml` | Render.com deployment blueprint |
| `docker-compose.yml` | Docker Compose configuration |
