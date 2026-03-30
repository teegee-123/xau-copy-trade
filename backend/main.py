"""XAU Copy Trade - Main FastAPI Application.

Paper Trading Dashboard and Bot System

This application:
1. Listens to Telegram channels for trading signals (via Telethon userbot)
2. Parses signals and validates entry prices via Binance WebSocket
3. Executes paper trades with automatic SL/TP management
4. Serves a real-time React dashboard
5. Runs as a single Docker container on Render

Architecture:
- FastAPI serves both REST API and React static files
- Background tasks run within FastAPI lifespan events
- WebSocket provides real-time updates to dashboard
"""

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings, get_trading_config
from backend.utils.logger import setup_logger
from backend.services.signal_parser import SignalParserService
from backend.services.telegram_service import TelegramService
from backend.services.price_service import PriceService
from backend.services.trade_manager import TradeManagerService
from backend.services.bot_state_manager import BotStateManager
from backend.api.websocket_handler import WebSocketBroadcaster
from backend.api.routes import router as trading_router
from backend.api.routes import (
    get_trade_manager,
    get_websocket_broadcaster,
    get_bot_state_manager,
)
from backend.api.auth import router as auth_router
from backend.dependency_injection import (
    register_services,
    get_telegram_service,
    get_price_service,
    get_signal_parser,
    get_trade_manager as di_get_trade_manager,
    get_websocket_broadcaster as di_get_broadcaster,
    get_bot_state_manager as di_get_state_manager,
)
from backend.models.signal import Signal
from backend.models.websocket import WSMessage, WSMessageType
from backend.models.signal import SignalStatus

# Configure logging
settings = get_settings()
logger = setup_logger(
    __name__,
    level=logging.DEBUG if settings.debug else logging.INFO,
)


# Global service references
telegram_service: TelegramService | None = None
price_service: PriceService | None = None
signal_parser: SignalParserService | None = None
trade_manager: TradeManagerService | None = None
websocket_broadcaster: WebSocketBroadcaster | None = None
bot_state_manager: BotStateManager | None = None

# Background tasks
background_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan manager for startup/shutdown.
    
    Handles:
    - Service initialization
    - Background task startup
    - Graceful shutdown
    """
    global telegram_service, price_service, signal_parser, trade_manager
    global websocket_broadcaster, bot_state_manager, background_tasks
    
    logger.info("=" * 60)
    logger.info("XAU Copy Trade - Starting up")
    logger.info("=" * 60)
    
    try:
        # Initialize services
        logger.info("Initializing services...")
        
        # Signal Parser
        signal_parser = SignalParserService()
        logger.info("Signal Parser initialized")
        
        # Trade Manager
        trade_manager = TradeManagerService.from_config()
        logger.info("Trade Manager initialized")
        
        # Bot State Manager
        bot_state_manager = BotStateManager()
        logger.info("Bot State Manager initialized")
        
        # WebSocket Broadcaster
        websocket_broadcaster = WebSocketBroadcaster()
        logger.info("WebSocket Broadcaster initialized")
        
        # Telegram Service
        try:
            telegram_service = TelegramService.from_config()
            logger.info("Telegram Service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Telegram Service: {e}")
            telegram_service = None
        
        # Price Service
        price_service = PriceService.from_config()
        logger.info("Price Service initialized")
        
        # Register services in DI container
        register_services(
            telegram_service=telegram_service,
            price_service=price_service,
            signal_parser=signal_parser,
            trade_manager=trade_manager,
            websocket_broadcaster=websocket_broadcaster,
            bot_state_manager=bot_state_manager,
        )

        # Start background tasks
        logger.info("Starting background tasks...")
        
        # Mark bot as running
        await bot_state_manager.set_running(True)
        
        # Start price service
        if price_service:
            price_task = asyncio.create_task(start_price_service())
            background_tasks.append(price_task)
        
        # Start Telegram service
        if telegram_service:
            telegram_task = asyncio.create_task(start_telegram_service())
            background_tasks.append(telegram_task)
        
        # Start trade monitoring
        monitor_task = asyncio.create_task(monitor_trades())
        background_tasks.append(monitor_task)
        
        logger.info("All background tasks started")
        logger.info("=" * 60)
        
        yield  # Application runs here
        
    except Exception as e:
        logger.error(f"Startup error: {e}", exc_info=True)
        raise
    
    finally:
        # Shutdown
        logger.info("=" * 60)
        logger.info("XAU Copy Trade - Shutting down")
        logger.info("=" * 60)
        
        # Cancel background tasks
        logger.info("Cancelling background tasks...")
        for task in background_tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        # Disconnect services
        logger.info("Disconnecting services...")
        
        if telegram_service:
            await telegram_service.disconnect()
        
        if price_service:
            await price_service.disconnect()
        
        logger.info("Shutdown complete")


async def start_price_service() -> None:
    """Start the price service and handle reconnections."""
    global price_service, bot_state_manager, websocket_broadcaster
    
    if not price_service:
        return
    
    while True:
        try:
            # Connect to price feed
            connected = await price_service.connect()
            
            if connected:
                await bot_state_manager.set_price_feed_status(True)
                logger.info("Price service connected")
                
                # Subscribe to price updates
                await price_service.subscribe(
                    "XAUUSD",
                    on_price_update
                )
                
                # Keep running until disconnected
                while await price_service.is_connected():
                    await asyncio.sleep(1)
            else:
                await bot_state_manager.set_price_feed_status(
                    False, 
                    "Failed to connect"
                )
                
        except asyncio.CancelledError:
            logger.info("Price service task cancelled")
            break
        except Exception as e:
            logger.error(f"Price service error: {e}")
            await bot_state_manager.set_price_feed_status(False, str(e))
            
            if websocket_broadcaster:
                await websocket_broadcaster.update_connection_status(
                    telegram_connected=(
                        await telegram_service.is_connected() 
                        if telegram_service else False
                    ),
                    price_feed_connected=False,
                    price_feed_error=str(e),
                )
        
        # Reconnect delay
        if not await price_service.is_connected():
            logger.info("Reconnecting price service in 5s...")
            await asyncio.sleep(5)


async def start_telegram_service() -> None:
    """Start the Telegram service and handle reconnections."""
    global telegram_service, bot_state_manager, websocket_broadcaster, signal_parser
    
    if not telegram_service:
        return
    
    while True:
        try:
            # Connect to Telegram
            connected = await telegram_service.connect()
            
            if connected:
                await bot_state_manager.set_telegram_status(True)
                logger.info("Telegram service connected")
                
                # Start listening
                await telegram_service.start_listening(
                    on_new_message=handle_new_signal,
                    on_edited_message=handle_edited_signal,
                )
                
                # Keep running until disconnected
                while telegram_service.is_listening:
                    await asyncio.sleep(1)
            else:
                await bot_state_manager.set_telegram_status(
                    False, 
                    "Failed to connect"
                )
                
        except asyncio.CancelledError:
            logger.info("Telegram service task cancelled")
            break
        except Exception as e:
            logger.error(f"Telegram service error: {e}")
            await bot_state_manager.set_telegram_status(False, str(e))
            
            if websocket_broadcaster:
                await websocket_broadcaster.update_connection_status(
                    telegram_connected=False,
                    telegram_error=str(e),
                    price_feed_connected=(
                        await price_service.is_connected() 
                        if price_service else False
                    ),
                )
        
        # Reconnect delay
        if telegram_service and not await telegram_service.is_connected():
            logger.info("Reconnecting Telegram service in 10s...")
            await asyncio.sleep(10)


async def on_price_update(symbol: str, price: float) -> None:
    """Handle price updates from the price service.
    
    Args:
        symbol: Trading symbol
        price: New price
    """
    global trade_manager, websocket_broadcaster
    
    if not trade_manager or not websocket_broadcaster:
        return
    
    # Update P&L for all active trades
    active_trades = await trade_manager.get_active_trades()
    
    for trade in active_trades:
        if trade.symbol == symbol or trade.symbol == "XAUUSD":
            await trade_manager.update_trade_pnl(trade.id, price)
            
            # Broadcast update
            updated_trade = await trade_manager.get_trade_by_id(trade.id)
            if updated_trade:
                await websocket_broadcaster.broadcast(
                    WSMessage.trade_update(updated_trade).model_dump(mode="json")
                )


async def handle_new_signal(signal: Signal) -> None:
    """Handle new signal from Telegram.
    
    Args:
        signal: Raw signal from Telegram
    """
    global signal_parser, trade_manager, websocket_broadcaster, bot_state_manager
    
    if not signal_parser or not trade_manager or not websocket_broadcaster:
        return
    
    # Check if bot is paused
    if await bot_state_manager.is_paused():
        logger.info("Bot paused, ignoring new signal")
        return
    
    try:
        # Parse signal
        parsed = await signal_parser.parse(
            raw_text=signal.raw_text,
            message_id=signal.message_id,
            channel_id=signal.channel_id,
        )
        
        if not parsed:
            logger.warning(f"Failed to parse signal {signal.message_id}")
            return
        
        # Broadcast signal received
        await websocket_broadcaster.broadcast(
            WSMessage.signal_received(
                signal_id=parsed.id,
                symbol=parsed.symbol,
                direction=parsed.direction.value,
            ).model_dump(mode="json")
        )
        
        # Check if signal is complete
        if not parsed.is_complete():
            logger.info(f"Signal {parsed.id} incomplete, waiting for edit")
            return
        
        # Check entry conditions
        current_price = price_service.get_current_price(parsed.symbol) if price_service else None
        
        if current_price is None:
            logger.warning(f"No price available for {parsed.symbol}, adding as pending")
            await trade_manager.add_pending_trade(parsed)
            return
        
        # Validate entry
        if parsed.is_entry_valid(current_price):
            # Execute trade
            trade = await trade_manager.create_trade(parsed, current_price)
            
            await websocket_broadcaster.broadcast(
                WSMessage.trade_opened(trade).model_dump(mode="json")
            )
            
            logger.info(f"Trade executed: {trade.id} @ {current_price}")
        else:
            # Add as pending
            logger.info(
                f"Entry conditions not met (price={current_price}, "
                f"max_entry={parsed.entry_price_max}), adding as pending"
            )
            await trade_manager.add_pending_trade(parsed)
            
    except Exception as e:
        logger.error(f"Error handling new signal: {e}", exc_info=True)


async def handle_edited_signal(signal: Signal) -> None:
    """Handle edited signal from Telegram.
    
    Args:
        signal: Edited signal from Telegram
    """
    global signal_parser, trade_manager, websocket_broadcaster, bot_state_manager
    
    if not signal_parser or not trade_manager or not websocket_broadcaster:
        return
    
    try:
        # Find existing signal by message_id
        existing_signal = signal_parser.get_signal_by_message_id(signal.message_id)
        
        if not existing_signal:
            logger.warning(f"Edited message {signal.message_id} has no matching signal")
            return
        
        # Update signal from edit
        updated = await signal_parser.update_from_edit(
            signal_id=existing_signal.id,
            edited_text=signal.raw_text,
        )
        
        if not updated:
            return
        
        # Check if signal is now complete
        if updated.status == SignalStatus.VALIDATED:
            # Find associated trade
            trades = await trade_manager.get_pending_trades()
            
            for trade in trades:
                if trade.signal_message_id == signal.message_id:
                    # Check entry conditions
                    current_price = (
                        price_service.get_current_price(updated.symbol) 
                        if price_service else None
                    )
                    
                    if current_price and updated.is_entry_valid(current_price):
                        # Activate pending trade
                        await trade_manager.activate_pending_trade(
                            trade.id, 
                            current_price
                        )
                        
                        active_trade = await trade_manager.get_trade_by_id(trade.id)
                        if active_trade:
                            await websocket_broadcaster.broadcast(
                                WSMessage.trade_opened(active_trade).model_dump(mode="json")
                            )
                        
                        logger.info(f"Pending trade {trade.id} activated @ {current_price}")
                    break
        
    except Exception as e:
        logger.error(f"Error handling edited signal: {e}", exc_info=True)


async def monitor_trades() -> None:
    """Monitor trades for SL/TP hits and pending entries."""
    global trade_manager, price_service, websocket_broadcaster
    
    if not trade_manager or not price_service:
        return
    
    while True:
        try:
            await asyncio.sleep(1)  # Check every second
            
            current_price = price_service.get_current_price("XAUUSDT")
            
            if current_price is None:
                continue
            
            prices = {"XAUUSD": current_price, "XAUUSDT": current_price}
            
            # Check for SL/TP hits
            trades_to_close = await trade_manager.check_all_positions(prices)
            
            for trade_id, reason in trades_to_close:
                close_reason = "SL" if reason == "SL" else "TP"
                closed = await trade_manager.close_trade(
                    trade_id, 
                    current_price, 
                    close_reason
                )
                
                if closed and websocket_broadcaster:
                    await websocket_broadcaster.broadcast(
                        WSMessage.trade_closed(closed).model_dump(mode="json")
                    )
            
            # Check pending entries
            trades_to_activate = await trade_manager.check_pending_entries(prices)
            
            for trade_id, entry_price in trades_to_activate:
                await trade_manager.activate_pending_trade(trade_id, entry_price)
                
                active_trade = await trade_manager.get_trade_by_id(trade_id)
                if active_trade and websocket_broadcaster:
                    await websocket_broadcaster.broadcast(
                        WSMessage.trade_opened(active_trade).model_dump(mode="json")
                    )
            
            # Expire old pending trades
            await trade_manager.expire_old_pending_trades()
            
        except asyncio.CancelledError:
            logger.info("Trade monitor task cancelled")
            break
        except Exception as e:
            logger.error(f"Trade monitor error: {e}")


# Create FastAPI app
app = FastAPI(
    title="XAU Copy Trade",
    description="Paper Trading Dashboard and Bot System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(trading_router)
app.include_router(auth_router)

# Mount static files (React build)
dist_path = Path(__file__).parent.parent / "frontend" / "dist"
if dist_path.exists():
    # Serve assets from /assets
    app.mount("/assets", StaticFiles(directory=str(dist_path / "assets")), name="assets")
    
    # Serve index.html at root - must be before catch-all
    @app.get("/")
    async def serve_root():
        """Serve React index.html at root."""
        from fastapi.responses import FileResponse
        return FileResponse(str(dist_path / "index.html"))
    
    # Catch-all for React router (SPA)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React frontend for SPA routing."""
        # Skip API routes and WebSocket
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        
        from fastapi.responses import FileResponse
        index_path = dist_path / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Frontend not found")
else:
    logger.warning(f"Static files not found at {dist_path}")
    # Fallback root endpoint
    @app.get("/")
    async def serve_root():
        return {"message": "XAU Copy Trade API", "status": "running", "frontend": "not built"}


@app.websocket("/ws/trades")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time trade updates.
    
    Clients connect here to receive:
    - Trade updates (P&L changes)
    - Trade opened/closed notifications
    - Connection status updates
    - Bot status updates
    """
    global websocket_broadcaster, bot_state_manager
    
    if not websocket_broadcaster:
        await websocket.close(code=1011, reason="Service not initialized")
        return
    
    await websocket.accept()
    logger.info(f"WebSocket client connected: {websocket.client}")
    
    try:
        # Register client
        await websocket_broadcaster.connect(websocket)
        
        # Send initial status
        if bot_state_manager:
            status = await bot_state_manager.get_status()
            await websocket.send_json(
                WSMessage.bot_status(
                    is_running=status.get("is_running", False),
                    is_paused=status.get("is_paused", True),
                ).model_dump(mode="json")
            )
        
        # Handle incoming messages (ping/pong)
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                
                # Handle ping
                if data.get("type") == "ping":
                    await websocket.send_json(WSMessage.pong().model_dump(mode="json"))
                    
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_json(
                        WSMessage(type=WSMessageType.PING).model_dump(mode="json")
                    )
                except Exception:
                    break
                    
            except WebSocketDisconnect:
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {websocket.client}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket_broadcaster.disconnect(websocket)


@app.get("/")
async def root() -> dict:
    """Root endpoint - serves React app."""
    return {
        "name": "XAU Copy Trade",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/api")
async def api_info() -> dict:
    """API information endpoint."""
    return {
        "name": "XAU Copy Trade API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "trades": "/api/trades",
            "control": "/api/control",
            "status": "/api/status",
            "websocket": "/ws/trades",
            "auth": {
                "initiate": "/tg-auth",
                "complete": "/tg-auth-code",
                "status": "/tg-auth-status",
            },
        }
    }


# Entry point
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
