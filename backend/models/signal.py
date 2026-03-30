"""Signal models for Telegram message parsing."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from .trade import TradeDirection


class SignalStatus(str, Enum):
    """Status of a parsed signal."""
    RAW = "RAW"           # Initial message received
    PARSED = "PARSED"     # Successfully parsed
    PENDING_SL_TP = "PENDING_SL_TP"  # Waiting for edited message with SL/TP
    VALIDATED = "VALIDATED"  # Entry conditions met
    EXECUTED = "EXECUTED"  # Trade opened
    IGNORED = "IGNORED"    # Signal ignored (price conditions not met)
    EXPIRED = "EXPIRED"    # Signal expired without execution


class Signal(BaseModel):
    """Raw signal from Telegram before parsing."""
    message_id: int = Field(..., description="Telegram message ID")
    channel_id: str = Field(..., description="Source channel ID")
    raw_text: str = Field(..., description="Original message text")
    is_edited: bool = Field(default=False, description="Whether this is an edited message")
    edit_date: Optional[datetime] = Field(None, description="When message was edited")
    received_at: datetime = Field(default_factory=datetime.utcnow, description="When received")
    
    class Config:
        arbitrary_types_allowed = True


class ParsedSignal(BaseModel):
    """Parsed signal ready for trade execution."""
    id: str = Field(..., description="Unique signal identifier")
    message_id: int = Field(..., description="Original Telegram message ID")
    channel_id: str = Field(..., description="Source channel")
    
    # Core signal data
    symbol: str = Field(..., description="Trading symbol (normalized, e.g., XAUUSD)")
    direction: TradeDirection = Field(..., description="BUY or SELL")
    
    # Entry details (may come from edited message)
    entry_price_min: Optional[float] = Field(None, description="Min entry price if range")
    entry_price_max: Optional[float] = Field(None, description="Max entry price")
    entry_prices: list[float] = Field(default_factory=list, description="All mentioned entry prices")
    
    # Risk management (often in edited messages)
    stop_loss: Optional[float] = Field(None, description="Stop loss price")
    take_profit_levels: list[float] = Field(default_factory=list, description="All TP levels")
    
    # Additional info
    position_size: Optional[float] = Field(None, description="Suggested position size")
    leverage: Optional[int] = Field(None, description="Suggested leverage")
    
    # Status tracking
    status: SignalStatus = Field(default=SignalStatus.RAW, description="Current signal status")
    raw_message: str = Field(..., description="Original message text")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    def get_effective_entry_price(self) -> Optional[float]:
        """Get the effective max entry price for validation."""
        if self.entry_prices:
            return max(self.entry_prices)
        return self.entry_price_max
    
    def get_effective_tp(self) -> Optional[float]:
        """Get the lowest TP level (conservative target)."""
        if not self.take_profit_levels:
            return self.take_profit_levels[0] if self.take_profit_levels else None
        return min(self.take_profit_levels)
    
    def is_complete(self) -> bool:
        """Check if signal has all required fields for execution."""
        return (
            self.symbol is not None
            and self.direction is not None
            and self.entry_price_max is not None
            and self.stop_loss is not None
            and len(self.take_profit_levels) > 0
        )
