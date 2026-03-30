"""Bot State Manager implementation.

Controls global bot state (pause/resume) and connection status.
"""

import asyncio
import logging
from typing import Any, Optional

from ..services.interfaces import IBotStateManager

logger = logging.getLogger(__name__)


class BotStateManager(IBotStateManager):
    """Service for managing global bot state.
    
    Features:
    - Pause/resume control
    - Connection status tracking
    - Thread-safe state updates
    """
    
    def __init__(self):
        """Initialize state manager."""
        self._lock = asyncio.Lock()
        
        self._is_paused = False
        self._is_running = False
        
        # Connection status
        self._telegram_connected = False
        self._telegram_error: Optional[str] = None
        self._price_feed_connected = False
        self._price_feed_error: Optional[str] = None
    
    async def pause(self) -> None:
        """Pause all bot operations."""
        async with self._lock:
            self._is_paused = True
            logger.info("Bot paused")
    
    async def resume(self) -> None:
        """Resume bot operations."""
        async with self._lock:
            self._is_paused = False
            logger.info("Bot resumed")
    
    async def is_paused(self) -> bool:
        """Check if bot is paused."""
        return self._is_paused
    
    async def is_running(self) -> bool:
        """Check if bot is running (connected and not paused)."""
        async with self._lock:
            return self._is_running and not self._is_paused
    
    async def set_running(self, running: bool) -> None:
        """Set the running state.
        
        Args:
            running: Whether bot should be running
        """
        async with self._lock:
            self._is_running = running
    
    async def set_telegram_status(
        self, 
        connected: bool, 
        error: Optional[str] = None
    ) -> None:
        """Update Telegram connection status.
        
        Args:
            connected: Connection status
            error: Optional error message
        """
        async with self._lock:
            self._telegram_connected = connected
            self._telegram_error = error
            
            if error:
                logger.warning(f"Telegram error: {error}")
            elif connected:
                logger.info("Telegram connected")
    
    async def set_price_feed_status(
        self, 
        connected: bool, 
        error: Optional[str] = None
    ) -> None:
        """Update price feed connection status.
        
        Args:
            connected: Connection status
            error: Optional error message
        """
        async with self._lock:
            self._price_feed_connected = connected
            self._price_feed_error = error
            
            if error:
                logger.warning(f"Price feed error: {error}")
            elif connected:
                logger.info("Price feed connected")
    
    async def get_status(self) -> dict[str, Any]:
        """Get complete bot status.
        
        Returns:
            Dict with all status information
        """
        async with self._lock:
            return {
                "is_running": self._is_running,
                "is_paused": self._is_paused,
                "telegram": {
                    "connected": self._telegram_connected,
                    "error": self._telegram_error,
                },
                "price_feed": {
                    "connected": self._price_feed_connected,
                    "error": self._price_feed_error,
                },
                "uptime_status": "active" if self._is_running and not self._is_paused else "inactive",
            }
