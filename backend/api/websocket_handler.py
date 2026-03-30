"""WebSocket broadcast service for real-time updates.

Manages client connections and broadcasts trade updates
to all connected dashboard clients.
"""

import asyncio
import json
import logging
from typing import Any, Set, Optional

from fastapi import WebSocket

from ..services.interfaces import IWebSocketBroadcaster
from ..models.websocket import WSMessage, WSMessageType

logger = logging.getLogger(__name__)


class WebSocketBroadcaster(IWebSocketBroadcaster):
    """Service for broadcasting updates to WebSocket clients.
    
    Features:
    - Multiple client support
    - Automatic disconnect handling
    - Message queuing for slow clients
    - Connection state tracking
    """
    
    def __init__(self, max_queue_size: int = 100):
        """Initialize broadcaster.
        
        Args:
            max_queue_size: Max messages to queue per client
        """
        self.max_queue_size = max_queue_size
        
        # Connected clients
        self._clients: Set[WebSocket] = set()
        self._client_queues: dict[WebSocket, asyncio.Queue[dict]] = {}
        
        # Connection status
        self._telegram_connected = False
        self._price_feed_connected = False
        self._telegram_error: Optional[str] = None
        self._price_feed_error: Optional[str] = None
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        # Background task for sending
        self._send_tasks: dict[WebSocket, asyncio.Task] = {}
    
    async def connect(self, websocket: WebSocket) -> None:
        """Register a new WebSocket client.
        
        Args:
            websocket: The WebSocket connection
        """
        async with self._lock:
            self._clients.add(websocket)
            
            # Create message queue for this client
            queue = asyncio.Queue(maxsize=self.max_queue_size)
            self._client_queues[websocket] = queue
            
            # Start send task
            task = asyncio.create_task(self._send_loop(websocket, queue))
            self._send_tasks[websocket] = task
            
            logger.info(f"WebSocket client connected. Total: {len(self._clients)}")
            
            # Send current connection status
            await self.send_to_client(
                websocket,
                WSMessage.connection_status(
                    telegram_connected=self._telegram_connected,
                    price_feed_connected=self._price_feed_connected,
                    telegram_error=self._telegram_error,
                    price_feed_error=self._price_feed_error,
                ).model_dump(mode="json")
            )
    
    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket client.
        
        Args:
            websocket: The WebSocket connection to remove
        """
        async with self._lock:
            if websocket in self._clients:
                self._clients.discard(websocket)
                
                # Cancel send task
                if websocket in self._send_tasks:
                    self._send_tasks[websocket].cancel()
                    del self._send_tasks[websocket]
                
                # Remove queue
                if websocket in self._client_queues:
                    del self._client_queues[websocket]
                
                logger.info(f"WebSocket client disconnected. Total: {len(self._clients)}")
    
    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast a message to all connected clients.
        
        Args:
            message: Message dict to broadcast
        """
        async with self._lock:
            clients = list(self._clients)
        
        # Send to all clients concurrently
        tasks = []
        for client in clients:
            tasks.append(self._queue_message(client, message))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def send_to_client(self, websocket: WebSocket, message: dict[str, Any]) -> bool:
        """Send a message to a specific client.
        
        Args:
            websocket: Target client WebSocket
            message: Message to send
            
        Returns:
            True if sent successfully
        """
        return await self._queue_message(websocket, message)
    
    async def _queue_message(self, websocket: WebSocket, message: dict) -> bool:
        """Queue a message for sending to a client.
        
        Args:
            websocket: Target client
            message: Message to queue
            
        Returns:
            True if queued successfully
        """
        async with self._lock:
            queue = self._client_queues.get(websocket)
        
        if queue is None:
            return False
        
        try:
            # Non-blocking put - drop message if queue full
            queue.put_nowait(message)
            return True
        except asyncio.QueueFull:
            logger.warning(f"Message queue full for client, dropping message")
            return False
    
    async def _send_loop(self, websocket: WebSocket, queue: asyncio.Queue) -> None:
        """Send messages from queue to client.
        
        Args:
            websocket: Client WebSocket
            queue: Message queue
        """
        try:
            while True:
                message = await queue.get()
                
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to client: {e}")
                    # Client will be removed by disconnect handler
                    break
                    
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Send loop error: {e}")
    
    @property
    def client_count(self) -> int:
        """Number of connected clients."""
        return len(self._clients)
    
    async def update_connection_status(
        self,
        telegram_connected: bool,
        price_feed_connected: bool,
        telegram_error: Optional[str] = None,
        price_feed_error: Optional[str] = None,
    ) -> None:
        """Update and broadcast connection status.
        
        Args:
            telegram_connected: Telegram connection status
            price_feed_connected: Price feed connection status
            telegram_error: Optional Telegram error message
            price_feed_error: Optional price feed error message
        """
        self._telegram_connected = telegram_connected
        self._price_feed_connected = price_feed_connected
        self._telegram_error = telegram_error
        self._price_feed_error = price_feed_error
        
        # Broadcast status update
        await self.broadcast(
            WSMessage.connection_status(
                telegram_connected=telegram_connected,
                price_feed_connected=price_feed_connected,
                telegram_error=telegram_error,
                price_feed_error=price_feed_error,
            ).model_dump(mode="json")
        )
    
    async def broadcast_bot_status(self, is_running: bool, is_paused: bool) -> None:
        """Broadcast bot status update.
        
        Args:
            is_running: Whether bot is running
            is_paused: Whether bot is paused
        """
        await self.broadcast(
            WSMessage.bot_status(
                is_running=is_running,
                is_paused=is_paused,
            ).model_dump(mode="json")
        )
