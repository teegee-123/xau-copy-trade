"""Price Service implementation using Binance WebSocket.

Provides real-time XAU/USD price data via Binance Futures WebSocket stream.
This is a free, reliable price feed that doesn't require API keys.
"""

import asyncio
import json
import logging
import time
from collections import defaultdict
from datetime import datetime
from typing import Callable, Awaitable, Optional, Set
from collections.abc import AsyncGenerator

import websockets
from websockets.client import WebSocketClientProtocol

from ..services.interfaces import IPriceService
from ..config import get_binance_config

logger = logging.getLogger(__name__)


class PriceService(IPriceService):
    """Real-time price feed service using Binance Futures WebSocket.
    
    Connects to Binance Futures WebSocket stream to receive
    real-time price updates for XAU/USDT (proxy for XAU/USD).
    
    Features:
    - Non-blocking WebSocket connection
    - Automatic reconnection on disconnect
    - Price caching for quick access
    - Multiple subscriber support
    - Async generator for streaming
    """
    
    # Binance Futures XAU/USDT symbol
    DEFAULT_SYMBOL = "XAUUSDT"
    
    def __init__(
        self,
        ws_url: str = "wss://fstream.binance.com/ws",
        symbol: str = DEFAULT_SYMBOL,
        reconnect_delay: float = 5.0,
        ping_interval: float = 20.0,
        ping_timeout: float = 10.0,
    ):
        """Initialize price service.
        
        Args:
            ws_url: Binance WebSocket URL
            symbol: Trading symbol (e.g., XAUUSDT)
            reconnect_delay: Delay between reconnection attempts
            ping_interval: WebSocket ping interval in seconds
            ping_timeout: WebSocket ping timeout in seconds
        """
        self.ws_url = ws_url
        self.symbol = symbol.upper()
        self.reconnect_delay = reconnect_delay
        self.ping_interval = ping_interval
        self.ping_timeout = ping_timeout
        
        # Connection state
        self._ws: Optional[WebSocketClientProtocol] = None
        self._is_connected = False
        self._listen_task: Optional[asyncio.Task] = None
        self._ping_task: Optional[asyncio.Task] = None
        
        # Price data
        self._prices: dict[str, float] = {}  # symbol -> price
        self._last_update_time: dict[str, float] = {}  # symbol -> timestamp
        self._last_update_time_value: float = 0.0
        
        # Subscribers
        self._subscribers: dict[str, Set[Callable[[str, float], Awaitable[None]]]] = defaultdict(set)
        
        # Async generators for price_stream
        self._stream_queues: dict[str, asyncio.Queue[float]] = defaultdict(lambda: asyncio.Queue(maxsize=100))
        
        # Reconnection tracking
        self._reconnect_attempts = 0
        self._max_reconnect_attempts = 10
    
    async def connect(self) -> bool:
        """Connect to the Binance WebSocket.
        
        Returns:
            True if connection successful
        """
        try:
            # Build stream URL for the symbol
            # Binance uses lowercase symbol with @trade or @ticker stream
            stream_name = f"{self.symbol.lower()}@trade"
            full_url = f"{self.ws_url}/{stream_name}"
            
            logger.info(f"Connecting to Binance WebSocket: {full_url}")
            
            self._ws = await websockets.connect(
                full_url,
                ping_interval=self.ping_interval,
                ping_timeout=self.ping_timeout,
                close_timeout=5,
            )
            
            self._is_connected = True
            self._reconnect_attempts = 0
            
            logger.info(f"Connected to Binance WebSocket for {self.symbol}")
            
            # Start listening task
            self._listen_task = asyncio.create_task(self._listen_loop())
            
            # Start ping task
            self._ping_task = asyncio.create_task(self._ping_loop())
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Binance WebSocket: {e}")
            self._is_connected = False
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from the WebSocket."""
        logger.info("Disconnecting from Binance WebSocket...")
        
        # Cancel tasks
        if self._listen_task:
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
        
        if self._ping_task:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass
        
        # Close WebSocket
        if self._ws:
            await self._ws.close()
        
        self._is_connected = False
        self._ws = None
        
        logger.info("Disconnected from Binance WebSocket")
    
    async def is_connected(self) -> bool:
        """Check if connected to price feed."""
        return self._is_connected and self._ws is not None
    
    def get_current_price(self, symbol: str) -> Optional[float]:
        """Get the latest cached price for a symbol.
        
        Args:
            symbol: Trading symbol (e.g., XAUUSD)
            
        Returns:
            Current price or None if not available
        """
        # Normalize symbol (handle XAUUSD vs XAUUSDT)
        normalized = self._normalize_symbol(symbol)
        return self._prices.get(normalized)
    
    async def subscribe(
        self, 
        symbol: str,
        on_price_update: Callable[[str, float], Awaitable[None]]
    ) -> None:
        """Subscribe to price updates for a symbol.
        
        Args:
            symbol: Trading symbol to subscribe to
            on_price_update: Callback when price updates
        """
        normalized = self._normalize_symbol(symbol)
        self._subscribers[normalized].add(on_price_update)
        logger.debug(f"Subscriber added for {normalized}")
    
    async def unsubscribe(self, symbol: str) -> None:
        """Unsubscribe from price updates.
        
        Args:
            symbol: Trading symbol to unsubscribe from
        """
        normalized = self._normalize_symbol(symbol)
        subscribers = self._subscribers.get(normalized, set())
        
        # Remove all subscribers for this symbol
        self._subscribers[normalized].clear()
        logger.debug(f"All subscribers removed for {normalized}")
    
    async def price_stream(self, symbol: str) -> AsyncGenerator[float, None]:
        """Async generator for price updates.
        
        Args:
            symbol: Trading symbol
            
        Yields:
            Price updates as they arrive
        """
        normalized = self._normalize_symbol(symbol)
        queue = self._stream_queues[normalized]
        
        while True:
            try:
                price = await asyncio.wait_for(queue.get(), timeout=60.0)
                yield price
            except asyncio.TimeoutError:
                # Yield last known price if no update
                if normalized in self._prices:
                    yield self._prices[normalized]
            except asyncio.CancelledError:
                break
    
    async def _listen_loop(self) -> None:
        """Main loop for listening to WebSocket messages."""
        while self._is_connected and self._ws:
            try:
                message = await self._ws.recv()
                await self._process_message(message)
                
            except asyncio.CancelledError:
                logger.info("Listen task cancelled")
                break
                
            except websockets.ConnectionClosed as e:
                logger.warning(f"WebSocket connection closed: {e}")
                await self._handle_disconnect()
                break
                
            except Exception as e:
                logger.error(f"Error in listen loop: {e}")
                await asyncio.sleep(1)
    
    async def _process_message(self, message: str) -> None:
        """Process incoming WebSocket message.
        
        Args:
            message: Raw WebSocket message
        """
        try:
            data = json.loads(message)
            
            # Binance trade stream format:
            # {"e":"trade","E":timestamp,"s":"XAUUSDT","t":tradeId,"p":"price","q":"qty",...}
            if data.get("e") == "trade":
                symbol = data.get("s", "")
                price_str = data.get("p", "0")
                price = float(price_str)
                
                # Update cached price
                self._prices[symbol] = price
                timestamp = time.time()
                self._last_update_time[symbol] = timestamp
                self._last_update_time_value = timestamp
                
                # Notify subscribers
                await self._notify_subscribers(symbol, price)
                
                # Put in stream queue
                try:
                    self._stream_queues[symbol].put_nowait(price)
                except asyncio.QueueFull:
                    pass  # Skip if queue full
                
                logger.debug(f"Price update: {symbol} = {price}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def _notify_subscribers(self, symbol: str, price: float) -> None:
        """Notify all subscribers of a price update.
        
        Args:
            symbol: Trading symbol
            price: New price
        """
        subscribers = self._subscribers.get(symbol, set())
        
        if subscribers:
            # Call all subscribers concurrently
            await asyncio.gather(
                *[callback(symbol, price) for callback in subscribers],
                return_exceptions=True
            )
    
    async def _handle_disconnect(self) -> None:
        """Handle WebSocket disconnection with reconnection."""
        self._is_connected = False
        
        if self._reconnect_attempts >= self._max_reconnect_attempts:
            logger.error("Max reconnection attempts reached")
            return
        
        self._reconnect_attempts += 1
        logger.info(
            f"Attempting reconnection ({self._reconnect_attempts}/{self._max_reconnect_attempts}) "
            f"in {self.reconnect_delay}s..."
        )
        
        await asyncio.sleep(self.reconnect_delay)
        
        try:
            await self.connect()
        except Exception as e:
            logger.error(f"Reconnection failed: {e}")
    
    async def _ping_loop(self) -> None:
        """Send periodic pings to keep connection alive."""
        while self._is_connected and self._ws:
            try:
                await asyncio.sleep(self.ping_interval)
                
                if self._ws and self._is_connected:
                    # Send ping
                    pong = await asyncio.wait_for(
                        self._ws.ping(),
                        timeout=self.ping_timeout
                    )
                    await pong
                    
            except asyncio.CancelledError:
                break
            except asyncio.TimeoutError:
                logger.warning("Ping timeout - connection may be stale")
                await self._handle_disconnect()
                break
            except Exception as e:
                logger.error(f"Ping error: {e}")
    
    def _normalize_symbol(self, symbol: str) -> str:
        """Normalize symbol to match Binance format.
        
        Args:
            symbol: Raw symbol (e.g., XAUUSD, XAU/USD)
            
        Returns:
            Normalized symbol (e.g., XAUUSDT)
        """
        normalized = symbol.upper().replace("/", "").replace("USD", "USDT")
        
        # Handle common variations
        if normalized == "XAUUSDT":
            return "XAUUSDT"
        
        return normalized
    
    @property
    def last_update_time(self) -> Optional[float]:
        """Timestamp of last price update (for health checking)."""
        return self._last_update_time_value if self._last_update_time_value > 0 else None
    
    def get_price_age(self, symbol: str) -> float:
        """Get age of last price update in seconds.
        
        Args:
            symbol: Trading symbol
            
        Returns:
            Age in seconds (0 if no price)
        """
        normalized = self._normalize_symbol(symbol)
        last_update = self._last_update_time.get(normalized, 0)
        
        if last_update == 0:
            return float('inf')
        
        return time.time() - last_update
    
    @classmethod
    def from_config(cls) -> "PriceService":
        """Create PriceService from configuration.
        
        Returns:
            Configured PriceService instance
        """
        config = get_binance_config()
        return cls(
            ws_url=config["ws_url"],
            symbol=config["symbol"],
        )
