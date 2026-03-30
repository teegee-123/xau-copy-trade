"""Telegram Authentication API routes.

Provides endpoints for two-step Telegram authentication:
1. GET /tg-auth - Initiates auth and sends code to Telegram
2. GET /tg-auth-code?code={code} - Completes auth with the code
"""

import asyncio
import logging
import os
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

from ..config import get_telegram_config

logger = logging.getLogger(__name__)

router = APIRouter(tags=["authentication"])


class AuthSession:
    """Manages pending authentication sessions."""

    def __init__(self):
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._session_ttl = timedelta(minutes=10)  # Sessions expire after 10 minutes

    def create_session(self, phone: str) -> str:
        """Create a new auth session.

        Args:
            phone: Phone number for authentication

        Returns:
            Session ID
        """
        session_id = f"{phone}_{datetime.utcnow().timestamp()}"
        self._sessions[session_id] = {
            "phone": phone,
            "created_at": datetime.utcnow(),
            "client": None,
            "code_hash": None,
        }
        logger.info(f"Created auth session: {session_id}")
        return session_id

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID.

        Args:
            session_id: Session identifier

        Returns:
            Session data or None
        """
        session = self._sessions.get(session_id)
        if session:
            # Check expiration
            if datetime.utcnow() - session["created_at"] > self._session_ttl:
                del self._sessions[session_id]
                logger.warning(f"Session {session_id} expired")
                return None
        return session

    def update_session(self, session_id: str, **kwargs) -> None:
        """Update session data.

        Args:
            session_id: Session identifier
            **kwargs: Data to update
        """
        session = self._sessions.get(session_id)
        if session:
            session.update(kwargs)
            logger.debug(f"Updated session {session_id}")

    def remove_session(self, session_id: str) -> None:
        """Remove session.

        Args:
            session_id: Session identifier
        """
        if session_id in self._sessions:
            del self._sessions[session_id]
            logger.debug(f"Removed session {session_id}")

    def cleanup_expired(self) -> None:
        """Remove expired sessions."""
        now = datetime.utcnow()
        expired = [
            sid for sid, data in self._sessions.items()
            if now - data["created_at"] > self._session_ttl
        ]
        for sid in expired:
            del self._sessions[sid]
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")


# Global auth session manager
_auth_sessions = AuthSession()


class AuthInitiateResponse(BaseModel):
    """Response for auth initiation."""
    success: bool
    message: str
    session_id: Optional[str] = None
    phone_hash: Optional[str] = None


class AuthCompleteResponse(BaseModel):
    """Response for auth completion."""
    success: bool
    message: str
    session_file: Optional[str] = None


@router.get("/tg-auth", response_model=AuthInitiateResponse)
async def initiate_telegram_auth() -> AuthInitiateResponse:
    """Initiate Telegram authentication.

    Sends a verification code to the configured Telegram phone number.
    Returns a session ID to be used in the second step.

    Returns:
        AuthInitiateResponse with session ID
    """
    config = get_telegram_config()
    phone = config["phone"]
    session_name = config["session_name"]
    
    # Use absolute path based on backend directory
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    session_path = os.path.join(backend_dir, session_name)

    # Check if already authorized
    try:
        test_client = TelegramClient(
            session_path,
            config["api_id"],
            config["api_hash"],
        )
        await test_client.connect()
        if await test_client.is_user_authorized():
            await test_client.disconnect()
            return AuthInitiateResponse(
                success=True,
                message="Already authorized. Session file exists.",
                session_id=None,
                phone_hash=phone[:2] + "***" + phone[-2:] if len(phone) > 4 else "***",
            )
        await test_client.disconnect()
    except Exception as e:
        logger.info(f"Existing session check: {e}")

    # Create auth session
    session_id = _auth_sessions.create_session(phone)

    # Create Telegram client
    client = TelegramClient(
        session_path,
        config["api_id"],
        config["api_hash"],
    )

    try:
        # Connect to Telegram
        await client.connect()
        logger.info(f"Connected to Telegram for auth initiation")

        # Send code request
        sent = await client.send_code_request(phone)
        logger.info(f"Code sent to {phone}")

        # Store client in session
        _auth_sessions.update_session(
            session_id,
            client=client,
            code_hash=sent.phone_code_hash if hasattr(sent, 'phone_code_hash') else None,
        )

        # Mask phone for display
        phone_hash = phone[:2] + "***" + phone[-2:] if len(phone) > 4 else "***"

        return AuthInitiateResponse(
            success=True,
            message=f"Verification code sent to {phone_hash}. Use /tg-auth-code?code=YOUR_CODE to complete authentication.",
            session_id=session_id,
            phone_hash=phone_hash,
        )

    except Exception as e:
        logger.error(f"Failed to initiate Telegram auth: {e}", exc_info=True)
        _auth_sessions.remove_session(session_id)
        await client.disconnect()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send verification code: {str(e)}"
        )


@router.get("/tg-auth-code", response_model=AuthCompleteResponse)
async def complete_telegram_auth(
    code: str = Query(..., description="Verification code from Telegram"),
    password: Optional[str] = Query(None, description="2FA password (if required)"),
) -> AuthCompleteResponse:
    """Complete Telegram authentication.

    Use this endpoint after receiving the verification code from Telegram.

    Args:
        code: Verification code received from Telegram
        password: Optional 2FA password if enabled on the account

    Returns:
        AuthCompleteResponse with session file path
    """
    config = get_telegram_config()
    phone = config["phone"]
    session_name = config["session_name"]
    
    # Use absolute path based on backend directory
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    session_path = os.path.join(backend_dir, session_name)

    # Find active session for this phone
    active_session = None
    active_session_id = None

    for sid, data in _auth_sessions._sessions.items():
        if data.get("phone") == phone and data.get("client") is not None:
            active_session = data
            active_session_id = sid
            break

    if not active_session:
        # No active session, create new client
        logger.info("No active session found, creating new client for code verification")
        client = TelegramClient(
            session_path,
            config["api_id"],
            config["api_hash"],
        )
        await client.connect()
    else:
        client = active_session["client"]

    try:
        # Sign in with the code
        logger.info(f"Attempting to sign in with code for {phone}")

        try:
            await client.sign_in(
                phone=phone,
                code=code,
            )
        except SessionPasswordNeededError:
            # 2FA required
            if not password:
                await client.disconnect()
                raise HTTPException(
                    status_code=400,
                    detail="Two-factor authentication required. Provide 'password' parameter."
                )

            logger.info(f"2FA required, attempting with password")
            await client.sign_in(password=password)

        # Verify authorization
        if not await client.is_user_authorized():
            await client.disconnect()
            raise HTTPException(
                status_code=401,
                detail="Authentication failed. Invalid code or password."
            )

        # Get user info
        me = await client.get_me()
        logger.info(f"Successfully authenticated as @{me.username} ({me.first_name})")

        # Disconnect client (session is saved to file)
        await client.disconnect()

        # Clean up session
        if active_session_id:
            _auth_sessions.remove_session(active_session_id)

        session_file = f"backend/{session_name}.session"
        logger.info(f"Session file saved to: {session_path}.session")

        return AuthCompleteResponse(
            success=True,
            message=f"Successfully authenticated as @{me.username}. Session file saved.",
            session_file=session_file,
        )

    except HTTPException:
        raise
    except SessionPasswordNeededError:
        await client.disconnect()
        raise HTTPException(
            status_code=400,
            detail="Two-factor authentication required. Provide 'password' parameter."
        )
    except Exception as e:
        logger.error(f"Authentication failed: {e}", exc_info=True)
        await client.disconnect()
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}"
        )


@router.get("/tg-auth-status")
async def get_auth_status() -> dict:
    """Check Telegram authentication status.

    Returns:
        Auth status including session file existence
    """
    config = get_telegram_config()
    session_name = config["session_name"]
    
    # Use absolute path based on backend directory
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    session_path = os.path.join(backend_dir, f"{session_name}.session")

    session_exists = os.path.exists(session_path)
    session_file_size = os.path.getsize(session_path) if session_exists else 0

    return {
        "authenticated": session_exists,
        "session_file": session_path,
        "session_file_size": session_file_size,
        "phone": config["phone"][:2] + "***" + config["phone"][-2:] if len(config["phone"]) > 4 else "***",
        "active_sessions": len([
            s for s in _auth_sessions._sessions.values()
            if s.get("client") is not None
        ]),
    }
