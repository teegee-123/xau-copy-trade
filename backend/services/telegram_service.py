"""Telegram Service implementation using Telethon.

This service uses MTProto (via Telethon) to connect as a userbot,
which is required to read messages from channels and detect edits.
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Callable, Awaitable, Optional

from telethon import TelegramClient, events
from telethon.errors import SessionPasswordNeededError, AuthKeyUnregisteredError
from telethon.tl.types import Message

from ..models.signal import Signal
from ..services.interfaces import ITelegramService
from ..config import get_telegram_config

logger = logging.getLogger(__name__)


class TelegramService(ITelegramService):
    """Telegram userbot service using Telethon.
    
    Connects to Telegram via MTProto to:
    - Listen for new messages in configured channels
    - Detect edited messages (critical for SL/TP updates)
    - Forward messages to the signal processing pipeline
    
    Requires:
    - API ID and Hash from my.telegram.org
    - Phone number for the account
    - Session file for authentication persistence
    """
    
    def __init__(
        self,
        api_id: int,
        api_hash: str,
        phone: str,
        channel_id: int,
        session_name: str = "xau_copy_trade",
        session_path: Optional[str] = None,
    ):
        """Initialize Telegram service.
        
        Args:
            api_id: Telegram API ID from my.telegram.org
            api_hash: Telegram API Hash from my.telegram.org
            phone: Phone number for the account
            channel_id: Channel ID to monitor (negative for supergroups)
            session_name: Name for the session file
            session_path: Optional path for session file storage
        """
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.channel_id = channel_id
        self.session_name = session_name
        
        # Determine session path
        if session_path:
            self._session_path = os.path.join(session_path, session_name)
        else:
            self._session_path = session_name
        
        # Initialize Telethon client
        self._client: Optional[TelegramClient] = None
        self._is_connected = False
        self._is_listening = False
        self._listening_task: Optional[asyncio.Task] = None
        
        # Callbacks
        self._on_new_message: Optional[Callable[[Signal], Awaitable[None]]] = None
        self._on_edited_message: Optional[Callable[[Signal], Awaitable[None]]] = None
        
        # Reconnection settings
        self._reconnect_delay = 30  # seconds
        self._max_reconnect_attempts = 5
        self._reconnect_attempts = 0
    
    async def connect(self, timeout: float = 10.0) -> bool:
        """Establish connection to Telegram.

        Args:
            timeout: Connection timeout in seconds
            
        Returns:
            True if connection successful
        """
        try:
            logger.info(f"Connecting to Telegram (API ID: {self.api_id})...")

            # Create client
            self._client = TelegramClient(
                self._session_path,
                self.api_id,
                self.api_hash,
            )

            # Connect and authorize with timeout
            await asyncio.wait_for(
                self._client.connect(),
                timeout=timeout
            )

            if not await self._client.is_user_authorized():
                logger.warning("Not authorized. Session may be invalid.")
                self._is_connected = False
                return False

            self._is_connected = True
            self._reconnect_attempts = 0

            try:
                me = await asyncio.wait_for(
                    self._client.get_me(),
                    timeout=5.0
                )
                logger.info(f"Connected to Telegram as @{me.username}")
            except asyncio.TimeoutError:
                logger.warning("Could not get user info, but connection established")

            return True

        except asyncio.TimeoutError:
            logger.error(f"Telegram connection timed out after {timeout}s")
            self._is_connected = False
            return False
            
        except AuthKeyUnregisteredError:
            logger.error("Session expired. Need to re-authenticate.")
            self._is_connected = False
            return False

        except Exception as e:
            logger.error(f"Failed to connect to Telegram: {e}")
            self._is_connected = False
            return False
    
    async def disconnect(self) -> None:
        """Gracefully disconnect from Telegram."""
        logger.info("Disconnecting from Telegram...")
        
        self._is_listening = False
        
        if self._listening_task:
            self._listening_task.cancel()
            try:
                await self._listening_task
            except asyncio.CancelledError:
                pass
        
        if self._client:
            await self._client.disconnect()
        
        self._is_connected = False
        logger.info("Disconnected from Telegram")
    
    async def is_connected(self) -> bool:
        """Check if currently connected to Telegram."""
        if not self._client:
            return False
        
        try:
            return self._is_connected and await self._client.is_connected()
        except Exception:
            return False
    
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
        if not self._client:
            raise RuntimeError("Not connected to Telegram. Call connect() first.")
        
        self._on_new_message = on_new_message
        self._on_edited_message = on_edited_message
        self._is_listening = True
        
        logger.info(f"Starting to listen on channel {self.channel_id}...")
        
        # Register event handlers
        @self._client.on(events.NewMessage(chats=[self.channel_id]))
        async def handle_new_message(event: events.NewMessage.Event) -> None:
            if not self._on_new_message:
                return
            
            try:
                message = event.message
                signal = Signal(
                    message_id=message.id,
                    channel_id=str(self.channel_id),
                    raw_text=message.text or "",
                    is_edited=False,
                    received_at=datetime.utcnow(),
                )
                
                logger.info(f"New message received: ID={message.id}")
                await self._on_new_message(signal)
                
            except Exception as e:
                logger.error(f"Error processing new message: {e}")
        
        @self._client.on(events.MessageEdited(chats=[self.channel_id]))
        async def handle_edited_message(event: events.MessageEdited.Event) -> None:
            if not self._on_edited_message:
                return
            
            try:
                message = event.message
                signal = Signal(
                    message_id=message.id,
                    channel_id=str(self.channel_id),
                    raw_text=message.text or "",
                    is_edited=True,
                    edit_date=message.edit_date,
                    received_at=datetime.utcnow(),
                )
                
                logger.info(f"Edited message received: ID={message.id}")
                await self._on_edited_message(signal)
                
            except Exception as e:
                logger.error(f"Error processing edited message: {e}")
        
        # Start listening in background task
        self._listening_task = asyncio.create_task(self._run_listener())
    
    async def _run_listener(self) -> None:
        """Run the Telegram event listener loop."""
        while self._is_listening and self._is_connected:
            try:
                # Telethon runs its own event loop internally
                # We just need to keep the client running
                await self._client.run_until_disconnected()
            except asyncio.CancelledError:
                logger.info("Listener task cancelled")
                break
            except Exception as e:
                logger.error(f"Listener error: {e}")
                
                # Attempt reconnection
                if self._reconnect_attempts < self._max_reconnect_attempts:
                    self._reconnect_attempts += 1
                    logger.info(
                        f"Reconnecting in {self._reconnect_delay}s "
                        f"(attempt {self._reconnect_attempts}/{self._max_reconnect_attempts})"
                    )
                    await asyncio.sleep(self._reconnect_delay)
                    
                    try:
                        await self.connect()
                    except Exception as reconnect_error:
                        logger.error(f"Reconnection failed: {reconnect_error}")
                else:
                    logger.error("Max reconnection attempts reached")
                    self._is_listening = False
                    break
    
    async def stop_listening(self) -> None:
        """Stop listening for messages."""
        logger.info("Stopping message listener...")
        self._is_listening = False
        
        if self._listening_task:
            self._listening_task.cancel()
            try:
                await self._listening_task
            except asyncio.CancelledError:
                pass
            
            self._listening_task = None
    
    @property
    def is_listening(self) -> bool:
        """Whether the service is actively listening."""
        return self._is_listening
    
    async def get_channel_info(self) -> Optional[dict]:
        """Get information about the monitored channel.
        
        Returns:
            Channel info dict or None if not available
        """
        if not self._client:
            return None
        
        try:
            entity = await self._client.get_entity(self.channel_id)
            return {
                "id": entity.id,
                "title": getattr(entity, "title", None),
                "username": getattr(entity, "username", None),
                "type": type(entity).__name__,
            }
        except Exception as e:
            logger.error(f"Failed to get channel info: {e}")
            return None
    
    @classmethod
    def from_config(cls) -> "TelegramService":
        """Create TelegramService from configuration.
        
        Returns:
            Configured TelegramService instance
        """
        config = get_telegram_config()
        return cls(
            api_id=config["api_id"],
            api_hash=config["api_hash"],
            phone=config["phone"],
            channel_id=config["channel_id"],
            session_name=config["session_name"],
        )
