"""Trade models for the paper trading system."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class TradeDirection(str, Enum):
    """Direction of the trade."""
    BUY = "BUY"
    SELL = "SELL"


class TradeStatus(str, Enum):
    """Status of an active trade."""
    PENDING = "PENDING"  # Waiting for entry conditions
    ACTIVE = "ACTIVE"    # Trade is open
    CLOSED = "CLOSED"    # Trade closed (SL/TP/Manual)


class Trade(BaseModel):
    """Represents an active or pending trade."""
    id: str = Field(..., description="Unique trade identifier")
    signal_message_id: Optional[int] = Field(None, description="Telegram message ID")
    symbol: str = Field(..., description="Trading symbol (e.g., XAUUSD)")
    direction: TradeDirection = Field(..., description="Trade direction")
    status: TradeStatus = Field(default=TradeStatus.PENDING, description="Current trade status")
    
    # Entry details
    entry_price_min: Optional[float] = Field(None, description="Minimum entry price (range)")
    entry_price_max: Optional[float] = Field(None, description="Maximum entry price (range)")
    actual_entry_price: Optional[float] = Field(None, description="Actual filled entry price")
    entry_timestamp: Optional[datetime] = Field(None, description="When trade was entered")
    
    # Risk management
    stop_loss: Optional[float] = Field(None, description="Stop loss price")
    take_profit: Optional[float] = Field(None, description="Take profit price (lowest if multiple)")
    take_profit_levels: list[float] = Field(default_factory=list, description="All TP levels if provided")
    
    # Position details
    position_size: float = Field(default=1.0, description="Position size in lots")
    leverage: int = Field(default=1, description="Leverage used")
    
    # P&L tracking
    unrealized_pnl: float = Field(default=0.0, description="Current unrealized P&L")
    unrealized_pnl_percent: float = Field(default=0.0, description="P&L as percentage")
    current_price: Optional[float] = Field(None, description="Current market price")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Trade creation time")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update time")
    closed_at: Optional[datetime] = Field(None, description="Trade close time")
    close_reason: Optional[str] = Field(None, description="Reason for closing (SL/TP/MANUAL)")
    realized_pnl: Optional[float] = Field(None, description="Realized P&L upon close")
    
    # Source tracking
    source_channel: Optional[str] = Field(None, description="Telegram channel ID")
    raw_message: Optional[str] = Field(None, description="Original signal message text")
    
    def model_post_init(self, __context) -> None:
        """Post-initialization validation."""
        # Ensure TP is the lowest of all TP levels if multiple provided
        if self.take_profit_levels and not self.take_profit:
            self.take_profit = min(self.take_profit_levels)
    
    def calculate_pnl(self, current_price: float) -> tuple[float, float]:
        """
        Calculate unrealized P&L based on current price.
        
        Returns:
            Tuple of (pnl_value, pnl_percent)
        """
        if self.actual_entry_price is None:
            return 0.0, 0.0
        
        price_diff = current_price - self.actual_entry_price
        
        if self.direction == TradeDirection.BUY:
            pnl = price_diff * self.position_size * 100  # XAUUSD contract multiplier
        else:  # SELL
            pnl = -price_diff * self.position_size * 100
        
        pnl_percent = (pnl / (self.actual_entry_price * self.position_size * 100)) * 100 if self.actual_entry_price else 0.0
        
        return round(pnl, 2), round(pnl_percent, 2)
    
    def is_entry_valid(self, current_price: float) -> bool:
        """Check if current price satisfies entry conditions."""
        if self.entry_price_max is None:
            return True  # No entry restriction
        
        # For BUY: price must be <= max entry
        # For SELL: price must be >= min entry (or <= max entry for simplicity)
        if self.direction == TradeDirection.BUY:
            return current_price <= self.entry_price_max
        else:
            return current_price >= (self.entry_price_min or self.entry_price_max or current_price)
    
    def check_stop_loss(self, current_price: float) -> bool:
        """Check if stop loss has been hit."""
        if self.stop_loss is None:
            return False
        
        if self.direction == TradeDirection.BUY:
            return current_price <= self.stop_loss
        else:
            return current_price >= self.stop_loss
    
    def check_take_profit(self, current_price: float) -> bool:
        """Check if take profit has been hit."""
        if self.take_profit is None:
            return False
        
        if self.direction == TradeDirection.BUY:
            return current_price >= self.take_profit
        else:
            return current_price <= self.take_profit


class ClosedTrade(BaseModel):
    """Represents a closed trade for history."""
    id: str
    symbol: str
    direction: TradeDirection
    entry_price: float
    exit_price: float
    stop_loss: Optional[float]
    take_profit: Optional[float]
    position_size: float
    realized_pnl: float
    realized_pnl_percent: float
    close_reason: str
    entry_timestamp: datetime
    close_timestamp: datetime
    duration_seconds: float
    
    @classmethod
    def from_trade(cls, trade: Trade, exit_price: float) -> "ClosedTrade":
        """Create a ClosedTrade from an active Trade."""
        close_time = datetime.utcnow()
        entry_time = trade.entry_timestamp or trade.created_at
        
        return cls(
            id=trade.id,
            symbol=trade.symbol,
            direction=trade.direction,
            entry_price=trade.actual_entry_price or 0.0,
            exit_price=exit_price,
            stop_loss=trade.stop_loss,
            take_profit=trade.take_profit,
            position_size=trade.position_size,
            realized_pnl=trade.realized_pnl or 0.0,
            realized_pnl_percent=trade.unrealized_pnl_percent,
            close_reason=trade.close_reason or "UNKNOWN",
            entry_timestamp=entry_time,
            close_timestamp=close_time,
            duration_seconds=(close_time - entry_time).total_seconds()
        )
