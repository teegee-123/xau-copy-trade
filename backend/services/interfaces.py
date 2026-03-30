"""Abstract Base Classes for all core services.

This module defines the interfaces that all services must implement,
following the Dependency Inversion Principle (DIP) of SOLID.
"""

from abc import ABC, abstractmethod
from typing import Callable, Awaitable, Optional, Any
from collections.abc import AsyncGenerator

from ..models.signal import Signal, ParsedSignal
from ..models.trade import Trade, ClosedTrade


class ISignalParser(ABC):
    """Interface for signal parsing services.
    
    Implementations parse raw Telegram messages into structured signals.
    New parsers can be added for different signal formats without modifying core logic.
    """
    
    @abstractmethod
    async def parse(self, raw_text: str, message_id: int, channel_id: str) -> Optional[ParsedSignal]:
        """Parse raw message text into a structured signal.
        
        Args:
            raw_text: The raw message text from Telegram
            message_id: Telegram message ID for tracking
            channel_id: Source channel identifier
            
        Returns:
            ParsedSignal if parsing successful, None otherwise
        """
        pass
    
    @abstractmethod
    async def update_from_edit(
        self, 
        signal_id: str, 
        edited_text: str
    ) -> Optional[ParsedSignal]:
        """Update an existing signal from an edited message.
        
        Args:
            signal_id: ID of the existing signal to update
            edited_text: New message text after edit
            
        Returns:
            Updated ParsedSignal or None if update failed
        """
        pass


class ITelegramService(ABC):
    """Interface for Telegram services.
    
    Implementations handle Telegram connections and message listening.
    Supports both new messages and edited messages (critical for SL/TP updates).
    """
    
    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to Telegram.
        
        Returns:
            True if connection successful
        """
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Gracefully disconnect from Telegram."""
        pass
    
    @abstractmethod
    async def is_connected(self) -> bool:
        """Check if currently connected to Telegram."""
        pass
    
    @abstractmethod
    async def start_listening(
        self,
        on_new_message: Callable[[Signal], Awaitable[None]],
        on_edited_message: Callable[[Signal], Awaitable[None]],
    ) -> None:
        """Start listening for messages on configured channels.
        
        Args:
            on_new_message: Callback for new messages
            on_edited_message: Callback for edited messages
        """
        pass
    
    @abstractmethod
    async def stop_listening(self) -> None:
        """Stop listening for messages."""
        pass
    
    @property
    @abstractmethod
    def is_listening(self) -> bool:
        """Whether the service is actively listening."""
        pass


class IPriceService(ABC):
    """Interface for price feed services.
    
    Implementations provide real-time price data via WebSocket.
    New price providers (Binance, Forex, etc.) can be added without modifying core logic.
    """
    
    @abstractmethod
    async def connect(self) -> bool:
        """Connect to the price feed WebSocket.
        
        Returns:
            True if connection successful
        """
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the price feed."""
        pass
    
    @abstractmethod
    async def is_connected(self) -> bool:
        """Check if connected to price feed."""
        pass
    
    @abstractmethod
    def get_current_price(self, symbol: str) -> Optional[float]:
        """Get the latest cached price for a symbol.
        
        Args:
            symbol: Trading symbol (e.g., XAUUSD)
            
        Returns:
            Current price or None if not available
        """
        pass
    
    @abstractmethod
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
        pass
    
    @abstractmethod
    async def unsubscribe(self, symbol: str) -> None:
        """Unsubscribe from price updates.
        
        Args:
            symbol: Trading symbol to unsubscribe from
        """
        pass
    
    @abstractmethod
    async def price_stream(self, symbol: str) -> AsyncGenerator[float, None]:
        """Async generator for price updates.
        
        Args:
            symbol: Trading symbol
            
        Yields:
            Price updates as they arrive
        """
        pass
    
    @property
    @abstractmethod
    def last_update_time(self) -> Optional[float]:
        """Timestamp of last price update (for health checking)."""
        pass


class ITradeManager(ABC):
    """Interface for trade management services.
    
    Handles trade execution, P&L calculation, and position tracking.
    """
    
    @abstractmethod
    async def create_trade(self, signal: ParsedSignal, entry_price: float) -> Trade:
        """Create and execute a new trade from a signal.
        
        Args:
            signal: The parsed signal to execute
            entry_price: Price at which to enter the trade
            
        Returns:
            Created Trade object
        """
        pass
    
    @abstractmethod
    async def close_trade(
        self, 
        trade_id: str, 
        exit_price: float, 
        reason: str
    ) -> Optional[ClosedTrade]:
        """Close an active trade.
        
        Args:
            trade_id: ID of trade to close
            exit_price: Price at which to exit
            reason: Reason for closing (SL/TP/MANUAL)
            
        Returns:
            ClosedTrade if successful, None if trade not found
        """
        pass
    
    @abstractmethod
    async def update_trade_pnl(self, trade_id: str, current_price: float) -> Optional[Trade]:
        """Update P&L for a trade based on current price.
        
        Args:
            trade_id: ID of trade to update
            current_price: Current market price
            
        Returns:
            Updated Trade or None if not found
        """
        pass
    
    @abstractmethod
    async def get_active_trades(self) -> list[Trade]:
        """Get all active trades.
        
        Returns:
            List of active trades
        """
        pass
    
    @abstractmethod
    async def get_trade_by_id(self, trade_id: str) -> Optional[Trade]:
        """Get a specific trade by ID.
        
        Args:
            trade_id: Trade identifier
            
        Returns:
            Trade if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def get_closed_trades(self, limit: int = 50) -> list[ClosedTrade]:
        """Get closed trade history.
        
        Args:
            limit: Maximum number of trades to return
            
        Returns:
            List of closed trades (most recent first)
        """
        pass
    
    @abstractmethod
    async def get_pending_trades(self) -> list[Trade]:
        """Get trades pending entry conditions.
        
        Returns:
            List of pending trades
        """
        pass
    
    @abstractmethod
    async def check_all_positions(self, current_prices: dict[str, float]) -> list[tuple[str, str]]:
        """Check all active trades for SL/TP hits.
        
        Args:
            current_prices: Map of symbol to current price
            
        Returns:
            List of (trade_id, close_reason) tuples for trades to close
        """
        pass
    
    @property
    @abstractmethod
    def total_pnl(self) -> float:
        """Total realized P&L from all closed trades."""
        pass
    
    @property
    @abstractmethod
    def unrealized_pnl(self) -> float:
        """Total unrealized P&L from all active trades."""
        pass


class IBotStateManager(ABC):
    """Interface for bot state management.
    
    Controls global bot state (pause/resume) and connection status.
    """
    
    @abstractmethod
    async def pause(self) -> None:
        """Pause all bot operations."""
        pass
    
    @abstractmethod
    async def resume(self) -> None:
        """Resume bot operations."""
        pass
    
    @abstractmethod
    async def is_paused(self) -> bool:
        """Check if bot is paused."""
        pass
    
    @abstractmethod
    async def is_running(self) -> bool:
        """Check if bot is running (connected and not paused)."""
        pass
    
    @abstractmethod
    async def set_telegram_status(self, connected: bool, error: Optional[str] = None) -> None:
        """Update Telegram connection status."""
        pass
    
    @abstractmethod
    async def set_price_feed_status(self, connected: bool, error: Optional[str] = None) -> None:
        """Update price feed connection status."""
        pass
    
    @abstractmethod
    async def get_status(self) -> dict[str, Any]:
        """Get complete bot status.
        
        Returns:
            Dict with all status information
        """
        pass


class IWebSocketBroadcaster(ABC):
    """Interface for WebSocket broadcast service.
    
    Manages client connections and broadcasts updates to all connected clients.
    """
    
    @abstractmethod
    async def connect(self, websocket: Any) -> None:
        """Register a new WebSocket client.
        
        Args:
            websocket: The WebSocket connection
        """
        pass
    
    @abstractmethod
    async def disconnect(self, websocket: Any) -> None:
        """Remove a WebSocket client.
        
        Args:
            websocket: The WebSocket connection to remove
        """
        pass
    
    @abstractmethod
    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast a message to all connected clients.
        
        Args:
            message: Message dict to broadcast
        """
        pass
    
    @abstractmethod
    async def send_to_client(self, websocket: Any, message: dict[str, Any]) -> bool:
        """Send a message to a specific client.
        
        Args:
            websocket: Target client WebSocket
            message: Message to send
            
        Returns:
            True if sent successfully
        """
        pass
    
    @property
    @abstractmethod
    def client_count(self) -> int:
        """Number of connected clients."""
        pass
