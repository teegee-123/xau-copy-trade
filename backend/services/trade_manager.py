"""Trade Manager Service implementation.

Handles trade execution, P&L calculation, and position tracking.
Uses thread-safe in-memory storage for ephemeral state.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from ..models.signal import ParsedSignal, SignalStatus
from ..models.trade import Trade, TradeStatus, TradeDirection, ClosedTrade
from ..services.interfaces import ITradeManager
from ..config import get_trading_config

logger = logging.getLogger(__name__)


class TradeManagerService(ITradeManager):
    """Service for managing paper trades.
    
    Features:
    - Thread-safe in-memory trade storage
    - Automatic P&L calculation
    - SL/TP monitoring
    - Trade history tracking
    - Pending trade validation
    
    All operations are protected by asyncio.Lock for thread safety.
    """
    
    def __init__(
        self,
        default_position_size: float = 0.01,
        default_leverage: int = 1,
        max_pending_time_minutes: int = 60,
        max_history_size: int = 100,
    ):
        """Initialize trade manager.
        
        Args:
            default_position_size: Default position size in lots
            default_leverage: Default leverage
            max_pending_time_minutes: Max time for pending trades before expiry
            max_history_size: Maximum closed trades to keep in history
        """
        self.default_position_size = default_position_size
        self.default_leverage = default_leverage
        self.max_pending_time = timedelta(minutes=max_pending_time_minutes)
        self.max_history_size = max_history_size
        
        # Thread-safe storage
        self._lock = asyncio.Lock()
        
        # Active trades: trade_id -> Trade
        self._active_trades: dict[str, Trade] = {}
        
        # Pending trades: trade_id -> Trade (waiting for entry conditions)
        self._pending_trades: dict[str, Trade] = {}
        
        # Closed trades history (FIFO, limited size)
        self._closed_trades: list[ClosedTrade] = []
        
        # Signal to trade mapping
        self._signal_trades: dict[str, str] = {}  # signal_id -> trade_id
        
        # P&L tracking
        self._total_realized_pnl = 0.0
    
    async def create_trade(self, signal: ParsedSignal, entry_price: float) -> Trade:
        """Create and execute a new trade from a signal.
        
        Args:
            signal: The parsed signal to execute
            entry_price: Price at which to enter the trade
            
        Returns:
            Created Trade object
        """
        async with self._lock:
            trade_id = str(uuid.uuid4())
            now = datetime.utcnow()
            
            trade = Trade(
                id=trade_id,
                signal_message_id=signal.message_id,
                symbol=signal.symbol,
                direction=signal.direction,
                status=TradeStatus.ACTIVE,
                entry_price_min=signal.entry_price_min,
                entry_price_max=signal.entry_price_max,
                actual_entry_price=entry_price,
                entry_timestamp=now,
                stop_loss=signal.stop_loss,
                take_profit=signal.get_effective_tp(),
                take_profit_levels=signal.take_profit_levels,
                position_size=signal.position_size or self.default_position_size,
                leverage=signal.leverage or self.default_leverage,
                created_at=now,
                updated_at=now,
                source_channel=signal.channel_id,
                raw_message=signal.raw_message,
            )
            
            # Calculate initial P&L (should be ~0 at entry)
            trade.unrealized_pnl, trade.unrealized_pnl_percent = trade.calculate_pnl(entry_price)
            trade.current_price = entry_price
            
            # Store trade
            self._active_trades[trade_id] = trade
            self._signal_trades[signal.id] = trade_id
            
            logger.info(
                f"Trade created: {trade_id} | {signal.symbol} {signal.direction} "
                f"@ {entry_price} | SL: {signal.stop_loss} TP: {trade.take_profit}"
            )
            
            return trade
    
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
        async with self._lock:
            # Check active trades
            trade = self._active_trades.get(trade_id)
            
            # Check pending trades (close without entry)
            if not trade:
                trade = self._pending_trades.get(trade_id)
                if trade:
                    # Pending trade cancelled before entry
                    del self._pending_trades[trade_id]
                    logger.info(f"Pending trade {trade_id} cancelled: {reason}")
                    return None
            
            if not trade:
                logger.warning(f"Trade {trade_id} not found")
                return None
            
            # Calculate final P&L
            pnl, pnl_percent = trade.calculate_pnl(exit_price)
            trade.realized_pnl = pnl
            trade.unrealized_pnl = pnl
            trade.unrealized_pnl_percent = pnl_percent
            trade.realized_pnl = pnl
            
            # Update trade status
            trade.status = TradeStatus.CLOSED
            trade.current_price = exit_price
            trade.closed_at = datetime.utcnow()
            trade.close_reason = reason
            trade.updated_at = trade.closed_at
            
            # Create closed trade record
            closed_trade = ClosedTrade.from_trade(trade, exit_price)
            
            # Move to history
            self._closed_trades.insert(0, closed_trade)
            self._total_realized_pnl += pnl
            
            # Trim history if needed
            if len(self._closed_trades) > self.max_history_size:
                removed = self._closed_trades.pop()
                self._total_realized_pnl -= removed.realized_pnl
            
            # Remove from active
            del self._active_trades[trade_id]
            
            logger.info(
                f"Trade closed: {trade_id} | {reason} @ {exit_price} | "
                f"P&L: ${pnl:.2f} ({pnl_percent:.2f}%)"
            )
            
            return closed_trade
    
    async def update_trade_pnl(self, trade_id: str, current_price: float) -> Optional[Trade]:
        """Update P&L for a trade based on current price.
        
        Args:
            trade_id: ID of trade to update
            current_price: Current market price
            
        Returns:
            Updated Trade or None if not found
        """
        async with self._lock:
            trade = self._active_trades.get(trade_id)
            
            if not trade:
                return None
            
            # Calculate new P&L
            pnl, pnl_percent = trade.calculate_pnl(current_price)
            trade.unrealized_pnl = pnl
            trade.unrealized_pnl_percent = pnl_percent
            trade.current_price = current_price
            trade.updated_at = datetime.utcnow()
            
            return trade
    
    async def get_active_trades(self) -> list[Trade]:
        """Get all active trades.
        
        Returns:
            List of active trades
        """
        async with self._lock:
            return list(self._active_trades.values())
    
    async def get_trade_by_id(self, trade_id: str) -> Optional[Trade]:
        """Get a specific trade by ID.
        
        Args:
            trade_id: Trade identifier
            
        Returns:
            Trade if found, None otherwise
        """
        async with self._lock:
            return self._active_trades.get(trade_id)
    
    async def get_closed_trades(self, limit: int = 50) -> list[ClosedTrade]:
        """Get closed trade history.
        
        Args:
            limit: Maximum number of trades to return
            
        Returns:
            List of closed trades (most recent first)
        """
        async with self._lock:
            return self._closed_trades[:limit]
    
    async def get_pending_trades(self) -> list[Trade]:
        """Get trades pending entry conditions.
        
        Returns:
            List of pending trades
        """
        async with self._lock:
            return list(self._pending_trades.values())
    
    async def check_all_positions(
        self, 
        current_prices: dict[str, float]
    ) -> list[tuple[str, str]]:
        """Check all active trades for SL/TP hits.
        
        Args:
            current_prices: Map of symbol to current price
            
        Returns:
            List of (trade_id, close_reason) tuples for trades to close
        """
        trades_to_close = []
        
        async with self._lock:
            for trade_id, trade in list(self._active_trades.items()):
                price = current_prices.get(trade.symbol)
                
                if price is None:
                    continue
                
                # Check SL
                if trade.check_stop_loss(price):
                    trades_to_close.append((trade_id, "SL"))
                    continue
                
                # Check TP
                if trade.check_take_profit(price):
                    trades_to_close.append((trade_id, "TP"))
                    continue
        
        return trades_to_close
    
    async def add_pending_trade(self, signal: ParsedSignal) -> Trade:
        """Add a trade as pending (waiting for entry conditions).
        
        Args:
            signal: The parsed signal
            
        Returns:
            Created pending Trade object
        """
        async with self._lock:
            trade_id = str(uuid.uuid4())
            now = datetime.utcnow()
            
            trade = Trade(
                id=trade_id,
                signal_message_id=signal.message_id,
                symbol=signal.symbol,
                direction=signal.direction,
                status=TradeStatus.PENDING,
                entry_price_min=signal.entry_price_min,
                entry_price_max=signal.entry_price_max,
                stop_loss=signal.stop_loss,
                take_profit=signal.get_effective_tp(),
                take_profit_levels=signal.take_profit_levels,
                position_size=signal.position_size or self.default_position_size,
                leverage=signal.leverage or self.default_leverage,
                created_at=now,
                updated_at=now,
                source_channel=signal.channel_id,
                raw_message=signal.raw_message,
            )
            
            self._pending_trades[trade_id] = trade
            self._signal_trades[signal.id] = trade_id
            
            logger.info(
                f"Pending trade created: {trade_id} | {signal.symbol} {signal.direction} "
                f"Waiting for entry <= {signal.entry_price_max}"
            )
            
            return trade
    
    async def activate_pending_trade(
        self, 
        trade_id: str, 
        entry_price: float
    ) -> Optional[Trade]:
        """Activate a pending trade (convert to active).
        
        Args:
            trade_id: ID of pending trade
            entry_price: Entry price
            
        Returns:
            Activated Trade or None if not found
        """
        async with self._lock:
            trade = self._pending_trades.get(trade_id)
            
            if not trade:
                return None
            
            now = datetime.utcnow()
            trade.status = TradeStatus.ACTIVE
            trade.actual_entry_price = entry_price
            trade.entry_timestamp = now
            trade.current_price = entry_price
            trade.updated_at = now
            
            # Calculate initial P&L
            trade.unrealized_pnl, trade.unrealized_pnl_percent = trade.calculate_pnl(entry_price)
            
            # Move to active
            del self._pending_trades[trade_id]
            self._active_trades[trade_id] = trade
            
            logger.info(f"Pending trade {trade_id} activated @ {entry_price}")
            
            return trade
    
    async def expire_old_pending_trades(self) -> list[str]:
        """Remove pending trades that have exceeded max pending time.
        
        Returns:
            List of expired trade IDs
        """
        expired = []
        now = datetime.utcnow()
        
        async with self._lock:
            for trade_id, trade in list(self._pending_trades.items()):
                age = now - trade.created_at
                
                if age > self.max_pending_time:
                    expired.append(trade_id)
                    del self._pending_trades[trade_id]
                    logger.info(f"Pending trade {trade_id} expired after {age}")
        
        return expired
    
    async def check_pending_entries(
        self, 
        current_prices: dict[str, float]
    ) -> list[tuple[str, float]]:
        """Check pending trades for entry conditions.
        
        Args:
            current_prices: Map of symbol to current price
            
        Returns:
            List of (trade_id, entry_price) tuples for trades to activate
        """
        trades_to_activate = []
        
        async with self._lock:
            for trade_id, trade in list(self._pending_trades.items()):
                price = current_prices.get(trade.symbol)
                
                if price is None:
                    continue
                
                if trade.is_entry_valid(price):
                    trades_to_activate.append((trade_id, price))
        
        return trades_to_activate
    
    @property
    def total_pnl(self) -> float:
        """Total realized P&L from all closed trades."""
        return self._total_realized_pnl
    
    @property
    def unrealized_pnl(self) -> float:
        """Total unrealized P&L from all active trades."""
        return sum(t.unrealized_pnl for t in self._active_trades.values())
    
    def get_summary(self) -> dict:
        """Get trade summary statistics.
        
        Returns:
            Dict with summary statistics
        """
        active = len(self._active_trades)
        pending = len(self._pending_trades)
        closed = len(self._closed_trades)
        
        winning_trades = sum(1 for t in self._closed_trades if t.realized_pnl > 0)
        losing_trades = sum(1 for t in self._closed_trades if t.realized_pnl < 0)
        
        win_rate = (winning_trades / closed * 100) if closed > 0 else 0
        
        return {
            "active_trades": active,
            "pending_trades": pending,
            "closed_trades": closed,
            "total_realized_pnl": round(self._total_realized_pnl, 2),
            "total_unrealized_pnl": round(self.unrealized_pnl, 2),
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "win_rate": round(win_rate, 2),
        }
    
    @classmethod
    def from_config(cls) -> "TradeManagerService":
        """Create TradeManagerService from configuration.
        
        Returns:
            Configured TradeManagerService instance
        """
        config = get_trading_config()
        return cls(
            default_position_size=config["default_position_size"],
            default_leverage=config["default_leverage"],
            max_pending_time_minutes=config["max_pending_time_minutes"],
        )
