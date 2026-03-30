# Project Structure

```
xau-copy-trade/
├── backend/
│   ├── __init__.py
│   ├── main.py                    # FastAPI entry point with lifespan events
│   ├── config.py                  # Configuration loader from .env
│   ├── dependency_injection.py    # DI container setup
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── trade.py               # Trade, TradeStatus Pydantic models
│   │   ├── signal.py              # Signal, ParsedSignal models
│   │   └── websocket.py           # WS message schemas
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── interfaces.py          # Abstract Base Classes (ABC)
│   │   ├── signal_parser.py       # Regex-based signal parser
│   │   ├── telegram_service.py    # Telethon userbot implementation
│   │   ├── price_service.py       # WebSocket price feed (Binance)
│   │   └── trade_manager.py       # Trade execution & P&L calculation
│   │
│   ├── parsers/
│   │   ├── __init__.py
│   │   └── regex_patterns.py      # Configurable regex patterns
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py              # REST API endpoints
│   │   └── websocket_handler.py   # WebSocket broadcast handler
│   │
│   └── utils/
│       ├── __init__.py
│       └── logger.py              # Centralized logging setup
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       │
│       ├── components/
│       │   ├── ActiveTrades.tsx
│       │   ├── TradeHistory.tsx
│       │   ├── BotControls.tsx
│       │   ├── ConnectionStatus.tsx
│       │   └── ui/                # Reusable UI components
│       │
│       ├── hooks/
│       │   ├── useWebSocket.ts
│       │   └── useTrades.ts
│       │
│       ├── services/
│       │   └── api.ts             # API client
│       │
│       ├── types/
│       │   └── index.ts           # TypeScript types
│       │
│       └── context/
│           └── TradeContext.tsx   # Global state
│
├── docker/
│   └── entrypoint.sh              # Container startup script
│
├── .env.example
├── .gitignore
├── requirements.txt
├── Dockerfile
└── README.md
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Docker Container (Render)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Server                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ REST API    │  │ WebSocket   │  │ Static Files    │   │   │
│  │  │ /trades     │  │ /ws/trades  │  │ (React Build)   │   │   │
│  │  │ /health     │  │ (SSE fallback)│  │ /static/*      │   │   │
│  │  │ /control    │  │             │  │                 │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │ Telegram    │     │ Price       │     │ Trade       │       │
│  │ Service     │     │ Service     │     │ Manager     │       │
│  │ (Telethon)  │     │ (Binance WS)│     │ (In-Memory) │       │
│  │             │     │             │     │             │       │
│  │ - New Msg   │     │ - XAUUSD    │     │ - Execute   │       │
│  │ - Edited    │     │ - Stream    │     │ - P&L Calc  │       │
│  │ - Parse     │     │ - Validate  │     │ - History   │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ React Dashboard │
                    │ (Browser)       │
                    │                 │
                    │ - Active Trades │
                    │ - History       │
                    │ - Controls      │
                    │ - Status        │
                    └─────────────────┘
```

## Key Design Decisions

1. **Single Container**: All services run as async background tasks within FastAPI lifespan
2. **In-Memory State**: Thread-safe dict with asyncio.Lock for trade storage
3. **WebSocket First**: Real-time updates via WS, with REST polling fallback
4. **SOLID Architecture**: ABC interfaces allow easy extension (new channels, price providers)
5. **Render-Compatible**: Health endpoint + graceful reconnection handling
