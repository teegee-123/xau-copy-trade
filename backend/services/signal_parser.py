"""Signal Parser Service implementation.

Parses raw Telegram messages into structured ParsedSignal objects
using configurable regex patterns.
"""

import logging
import re
import uuid
from datetime import datetime
from typing import Optional

from ..models.signal import ParsedSignal, SignalStatus
from ..models.trade import TradeDirection
from ..parsers.regex_patterns import RegexPatterns, parse_tp_levels
from ..services.interfaces import ISignalParser
from ..config import get_regex_patterns

logger = logging.getLogger(__name__)


class SignalParserService(ISignalParser):
    """Service for parsing trading signals from Telegram messages.
    
    Uses configurable regex patterns to extract:
    - Symbol (XAUUSD, GOLD, etc.)
    - Direction (BUY/SELL/LONG/SHORT)
    - Entry price (single or range)
    - Stop Loss
    - Take Profit levels (single or multiple)
    
    Supports incremental parsing - initial message may only have
    symbol/direction/entry, with SL/TP added via edited messages.
    """
    
    def __init__(self, patterns: Optional[RegexPatterns] = None):
        """Initialize the parser with regex patterns.
        
        Args:
            patterns: RegexPatterns instance. If None, loads from config.
        """
        self.patterns = patterns or RegexPatterns.from_dict(get_regex_patterns())
        self._signal_cache: dict[int, ParsedSignal] = {}  # message_id -> signal
    
    async def parse(
        self, 
        raw_text: str, 
        message_id: int, 
        channel_id: str
    ) -> Optional[ParsedSignal]:
        """Parse raw message text into a structured signal.
        
        Args:
            raw_text: The raw message text from Telegram
            message_id: Telegram message ID for tracking
            channel_id: Source channel identifier
            
        Returns:
            ParsedSignal if parsing successful, None otherwise
        """
        logger.info(f"Parsing signal from message {message_id}: {raw_text[:100]}...")
        
        # Extract symbol
        symbol = self._extract_symbol(raw_text)
        if not symbol:
            logger.warning(f"No symbol found in message {message_id}")
            return None
        
        # Extract direction
        direction = self._extract_direction(raw_text)
        if not direction:
            logger.warning(f"No direction found in message {message_id}")
            return None
        
        # Extract entry prices
        entry_min, entry_max, entry_prices = self._extract_entry_prices(raw_text)
        
        # Extract SL
        stop_loss = self._extract_stop_loss(raw_text)
        
        # Extract TP levels
        take_profit_levels = self._extract_take_profits(raw_text)
        
        # Create signal
        signal = ParsedSignal(
            id=str(uuid.uuid4()),
            message_id=message_id,
            channel_id=str(channel_id),
            symbol=symbol,
            direction=direction,
            entry_price_min=entry_min,
            entry_price_max=entry_max,
            entry_prices=entry_prices,
            stop_loss=stop_loss,
            take_profit_levels=take_profit_levels,
            status=self._determine_status(entry_max, stop_loss, take_profit_levels),
            raw_message=raw_text,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        # Cache for potential updates
        self._signal_cache[message_id] = signal
        
        logger.info(
            f"Parsed signal: {signal.symbol} {signal.direction} "
            f"Entry: {entry_max} SL: {stop_loss} TP: {take_profit_levels}"
        )
        
        return signal
    
    async def update_from_edit(
        self, 
        signal_id: str, 
        edited_text: str
    ) -> Optional[ParsedSignal]:
        """Update an existing signal from an edited message.
        
        This is critical for signals that arrive without SL/TP initially
        and have them added via message edits.
        
        Args:
            signal_id: ID of the existing signal to update
            edited_text: New message text after edit
            
        Returns:
            Updated ParsedSignal or None if signal not found
        """
        # Find signal by ID in cache
        signal = None
        for cached in self._signal_cache.values():
            if cached.id == signal_id:
                signal = cached
                break
        
        if not signal:
            logger.warning(f"Signal {signal_id} not found for update")
            return None
        
        logger.info(f"Updating signal {signal_id} from edited message")
        
        # Re-extract all fields (edited message may have changed anything)
        entry_min, entry_max, entry_prices = self._extract_entry_prices(edited_text)
        stop_loss = self._extract_stop_loss(edited_text)
        take_profit_levels = self._extract_take_profits(edited_text)
        
        # Update signal fields
        if entry_min is not None:
            signal.entry_price_min = entry_min
        if entry_max is not None:
            signal.entry_price_max = entry_max
        if entry_prices:
            signal.entry_prices = entry_prices
        if stop_loss is not None:
            signal.stop_loss = stop_loss
        if take_profit_levels:
            signal.take_profit_levels = take_profit_levels
        
        # Update status
        signal.status = self._determine_status(
            signal.entry_price_max,
            signal.stop_loss,
            signal.take_profit_levels
        )
        signal.raw_message = edited_text
        signal.updated_at = datetime.utcnow()
        
        # Update cache
        self._signal_cache[signal.message_id] = signal
        
        logger.info(
            f"Updated signal {signal_id}: "
            f"Entry: {signal.entry_price_max} SL: {signal.stop_loss} TP: {signal.take_profit_levels}"
        )
        
        return signal
    
    def get_signal_by_message_id(self, message_id: int) -> Optional[ParsedSignal]:
        """Get a cached signal by Telegram message ID.
        
        Args:
            message_id: Telegram message ID
            
        Returns:
            ParsedSignal if found, None otherwise
        """
        return self._signal_cache.get(message_id)
    
    def _extract_symbol(self, text: str) -> Optional[str]:
        """Extract trading symbol from text."""
        match = self.patterns.symbol.search(text)
        if match:
            return self.patterns.normalize_symbol(match.group(1))
        return None
    
    def _extract_direction(self, text: str) -> Optional[str]:
        """Extract trade direction from text."""
        match = self.patterns.direction.search(text)
        if match:
            return self.patterns.normalize_direction(match.group(1))
        return None
    
    def _extract_entry_prices(self, text: str) -> tuple[Optional[float], Optional[float], list[float]]:
        """Extract entry price(s) from text.
        
        Returns:
            Tuple of (min_price, max_price, all_prices)
        """
        all_prices = []
        min_price = None
        max_price = None
        
        # Try range pattern first (e.g., "Entry 4553-4556")
        range_match = self.patterns.entry_range.search(text)
        if range_match:
            min_price = float(range_match.group(1))
            max_price = float(range_match.group(2))
            all_prices = [min_price, max_price]
            return min_price, max_price, all_prices
        
        # Try single entry pattern
        entry_match = self.patterns.entry.search(text)
        if entry_match:
            price = float(entry_match.group(1))
            max_price = price
            all_prices = [price]
        
        # Fallback: extract all numbers and use the one closest to typical XAU price
        if not all_prices:
            numbers = re.findall(r"\d{4,}(?:\.\d+)?", text)
            xau_prices = [float(n) for n in numbers if 1000 < float(n) < 10000]
            if xau_prices:
                max_price = max(xau_prices)  # Use highest as max entry for BUY
                all_prices = xau_prices
        
        return min_price, max_price, all_prices
    
    def _extract_stop_loss(self, text: str) -> Optional[float]:
        """Extract stop loss price from text."""
        match = self.patterns.sl.search(text)
        if match:
            return float(match.group(1))
        return None
    
    def _extract_take_profits(self, text: str) -> list[float]:
        """Extract take profit levels from text."""
        # Try multi-TP pattern first
        levels = parse_tp_levels(text)
        if levels:
            return levels
        
        # Fallback to single TP pattern
        match = self.patterns.tp.search(text)
        if match:
            return [float(match.group(1))]
        
        return []
    
    def _determine_status(
        self,
        entry_max: Optional[float],
        stop_loss: Optional[float],
        take_profit_levels: list[float]
    ) -> SignalStatus:
        """Determine signal status based on available data."""
        if not entry_max:
            return SignalStatus.RAW
        
        if stop_loss and take_profit_levels:
            return SignalStatus.VALIDATED
        
        if stop_loss or take_profit_levels:
            return SignalStatus.PENDING_SL_TP
        
        return SignalStatus.PARSED
