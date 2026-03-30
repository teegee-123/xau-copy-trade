"""WebSocket message schemas for real-time updates."""

from datetime import datetime
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field

from .trade import Trade, ClosedTrade


class WSMessageType(str, Enum):
    """Types of WebSocket messages."""
    TRADE_UPDATE = "trade_update"
    TRADE_OPENED = "trade_opened"
    TRADE_CLOSED = "trade_closed"
    SIGNAL_RECEIVED = "signal_received"
    BOT_STATUS = "bot_status"
    CONNECTION_STATUS = "connection_status"
    ERROR = "error"
    PING = "ping"
    PONG = "pong"


class WSMessage(BaseModel):
    """Standard WebSocket message envelope."""
    type: WSMessageType = Field(..., description="Message type")
    data: dict[str, Any] = Field(default_factory=dict, description="Message payload")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")
    
    @classmethod
    def trade_update(cls, trade: Trade) -> "WSMessage":
        """Create a trade update message."""
        return cls(
            type=WSMessageType.TRADE_UPDATE,
            data={
                "trade": trade.model_dump(mode="json"),
            }
        )
    
    @classmethod
    def trade_opened(cls, trade: Trade) -> "WSMessage":
        """Create a trade opened message."""
        return cls(
            type=WSMessageType.TRADE_OPENED,
            data={
                "trade": trade.model_dump(mode="json"),
            }
        )
    
    @classmethod
    def trade_closed(cls, closed_trade: ClosedTrade) -> "WSMessage":
        """Create a trade closed message."""
        return cls(
            type=WSMessageType.TRADE_CLOSED,
            data={
                "trade": closed_trade.model_dump(mode="json"),
            }
        )
    
    @classmethod
    def signal_received(cls, signal_id: str, symbol: str, direction: str) -> "WSMessage":
        """Create a signal received message."""
        return cls(
            type=WSMessageType.SIGNAL_RECEIVED,
            data={
                "signal_id": signal_id,
                "symbol": symbol,
                "direction": direction,
            }
        )
    
    @classmethod
    def bot_status(cls, is_running: bool, is_paused: bool) -> "WSMessage":
        """Create a bot status message."""
        return cls(
            type=WSMessageType.BOT_STATUS,
            data={
                "is_running": is_running,
                "is_paused": is_paused,
            }
        )
    
    @classmethod
    def connection_status(
        cls,
        telegram_connected: bool,
        price_feed_connected: bool,
        telegram_error: Optional[str] = None,
        price_feed_error: Optional[str] = None
    ) -> "WSMessage":
        """Create a connection status message."""
        return cls(
            type=WSMessageType.CONNECTION_STATUS,
            data={
                "telegram": {
                    "connected": telegram_connected,
                    "error": telegram_error,
                },
                "price_feed": {
                    "connected": price_feed_connected,
                    "error": price_feed_error,
                }
            }
        )
    
    @classmethod
    def error(cls, message: str, error_type: str = "GENERAL") -> "WSMessage":
        """Create an error message."""
        return cls(
            type=WSMessageType.ERROR,
            data={
                "error_type": error_type,
                "message": message,
            }
        )
    
    @classmethod
    def pong(cls) -> "WSMessage":
        """Create a pong response."""
        return cls(type=WSMessageType.PONG)


class WSClientMessage(BaseModel):
    """Messages received from WebSocket clients."""
    type: str = Field(..., description="Message type")
    data: dict[str, Any] = Field(default_factory=dict, description="Message payload")
