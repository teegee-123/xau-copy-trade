"""Regex pattern definitions for signal parsing.

Patterns are designed to be configurable via environment variables
to support different channel message formats.
"""

import re
from typing import Optional, Pattern


class RegexPatterns:
    """Container for compiled regex patterns used in signal parsing."""
    
    def __init__(
        self,
        symbol_pattern: str,
        direction_pattern: str,
        entry_pattern: str,
        entry_range_pattern: str,
        sl_pattern: str,
        tp_pattern: str,
        tp_multi_pattern: str,
    ):
        """Initialize and compile all regex patterns.
        
        Args:
            symbol_pattern: Pattern for matching trading symbols
            direction_pattern: Pattern for matching BUY/SELL
            entry_pattern: Pattern for matching single entry price
            entry_range_pattern: Pattern for matching entry price ranges
            sl_pattern: Pattern for matching stop loss
            tp_pattern: Pattern for matching single take profit
            tp_multi_pattern: Pattern for matching multiple take profits
        """
        self._symbol_pattern = symbol_pattern
        self._direction_pattern = direction_pattern
        self._entry_pattern = entry_pattern
        self._entry_range_pattern = entry_range_pattern
        self._sl_pattern = sl_pattern
        self._tp_pattern = tp_pattern
        self._tp_multi_pattern = tp_multi_pattern
        
        # Compile patterns
        self.symbol: Pattern = re.compile(symbol_pattern)
        self.direction: Pattern = re.compile(direction_pattern)
        self.entry: Pattern = re.compile(entry_pattern)
        self.entry_range: Pattern = re.compile(entry_range_pattern)
        self.sl: Pattern = re.compile(sl_pattern)
        self.tp: Pattern = re.compile(tp_pattern)
        self.tp_multi: Pattern = re.compile(tp_multi_pattern)
    
    @classmethod
    def from_dict(cls, patterns: dict[str, str]) -> "RegexPatterns":
        """Create RegexPatterns from a dictionary of pattern strings.
        
        Args:
            patterns: Dict with keys matching constructor parameters
            
        Returns:
            Configured RegexPatterns instance
        """
        return cls(
            symbol_pattern=patterns.get("symbol", r"(?i)(XAUUSD|XAU/USD|GOLD|GOLDUSD)\b"),
            direction_pattern=patterns.get("direction", r"(?i)\b(BUY|SELL|LONG|SHORT)\b"),
            entry_pattern=patterns.get("entry", r"(?i)(?:entry|enter|@|around)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)"),
            entry_range_pattern=patterns.get("entry_range", r"(?i)(?:entry|enter)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)\s*[-–]\s*(\d{4,}(?:\.\d+)?)"),
            sl_pattern=patterns.get("sl", r"(?i)(?:SL|Stop Loss|StopLoss|S\.L\.?)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)"),
            tp_pattern=patterns.get("tp", r"(?i)(?:TP|Take Profit|TakeProfit|T\.P\.?)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)"),
            tp_multi_pattern=patterns.get("tp_multi", r"(?i)(?:TPs?|Take\s*Profits?)\s*[:\-]?\s*([\d.,\s]+)"),
        )
    
    def normalize_symbol(self, symbol: str) -> str:
        """Normalize symbol to standard format (XAUUSD).
        
        Args:
            symbol: Raw symbol string
            
        Returns:
            Normalized symbol
        """
        symbol_upper = symbol.upper().strip()
        
        # Map common variations
        symbol_map = {
            "XAU/USD": "XAUUSD",
            "XAUUSD": "XAUUSD",
            "GOLD": "XAUUSD",
            "GOLDUSD": "XAUUSD",
            "XAUGOLD": "XAUUSD",
        }
        
        return symbol_map.get(symbol_upper, symbol_upper.replace("/", ""))
    
    def normalize_direction(self, direction: str) -> str:
        """Normalize direction to BUY or SELL.
        
        Args:
            direction: Raw direction string
            
        Returns:
            Normalized direction (BUY/SELL)
        """
        direction_upper = direction.upper().strip()
        
        if direction_upper in ("BUY", "LONG"):
            return "BUY"
        elif direction_upper in ("SELL", "SHORT"):
            return "SELL"
        
        return direction_upper


def extract_numbers(text: str) -> list[float]:
    """Extract all numbers from text.
    
    Useful for parsing TP levels like "TP1 4560, TP2 4570, TP3 4580"
    
    Args:
        text: Text containing numbers
        
    Returns:
        List of extracted numbers
    """
    # Match decimal numbers with 1-4 decimal places
    pattern = r"\d{4,}(?:\.\d{1,4})?"
    matches = re.findall(pattern, text)
    return [float(m) for m in matches if m]


def parse_tp_levels(text: str) -> list[float]:
    """Parse multiple TP levels from text.
    
    Handles formats like:
    - "TP: 4560, 4570, 4580"
    - "TP1 4560 TP2 4570 TP3 4580"
    - "Targets: 4560/4570/4580"
    
    Args:
        text: Text containing TP levels
        
    Returns:
        List of TP prices
    """
    levels = []
    
    # Try comma-separated first
    comma_pattern = r"(?:TP|Target)[s]?\s*[:\-]?\s*([\d.,\s]+)"
    match = re.search(comma_pattern, text, re.IGNORECASE)
    if match:
        levels = extract_numbers(match.group(1))
    
    # Try slash-separated
    if not levels:
        slash_pattern = r"(?:TP|Target)[s]?\s*[:\-]?\s*([\d/.]+)"
        match = re.search(slash_pattern, text, re.IGNORECASE)
        if match:
            levels = [float(x) for x in match.group(1).split("/") if x.isdigit() or "." in x]
    
    # Try finding all TP mentions
    if not levels:
        tp_individual = r"(?:TP\d?\s*[:\-]?\s*)(\d{4,}(?:\.\d+)?)"
        matches = re.findall(tp_individual, text, re.IGNORECASE)
        levels = [float(m) for m in matches]
    
    return sorted(set(levels))  # Remove duplicates and sort
