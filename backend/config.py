"""Configuration management from environment variables."""

import os
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = Field(default="XAU Copy Trade", description="Application name")
    debug: bool = Field(default=False, description="Debug mode")
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    
    # Telegram (Telethon)
    telegram_api_id: int = Field(..., description="Telegram API ID from my.telegram.org")
    telegram_api_hash: str = Field(..., description="Telegram API Hash from my.telegram.org")
    telegram_phone: str = Field(..., description="Phone number for Telegram account")
    telegram_channel_id: int = Field(..., description="Channel ID to monitor (negative for supergroups)")
    telegram_session_name: str = Field(default="xau_copy_trade", description="Session name for Telethon")
    
    # Signal parsing regex patterns (configurable per channel format)
    # These patterns are loaded from env and compiled at runtime
    signal_symbol_pattern: str = Field(
        default=r"(?i)(XAUUSD|XAU/USD|GOLD|GOLDUSD)\b",
        description="Regex pattern to match symbol"
    )
    signal_direction_pattern: str = Field(
        default=r"(?i)\b(BUY|SELL|LONG|SHORT)\b",
        description="Regex pattern to match direction"
    )
    signal_entry_pattern: str = Field(
        default=r"(?i)(?:entry|enter|@|around)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)",
        description="Regex pattern to match entry price"
    )
    signal_entry_range_pattern: str = Field(
        default=r"(?i)(?:entry|enter)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)\s*[-–]\s*(\d{4,}(?:\.\d+)?)",
        description="Regex pattern to match entry price range"
    )
    signal_sl_pattern: str = Field(
        default=r"(?i)(?:SL|Stop Loss|StopLoss|S\.L\.?)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)",
        description="Regex pattern to match stop loss"
    )
    signal_tp_pattern: str = Field(
        default=r"(?i)(?:TP|Take Profit|TakeProfit|T\.P\.?)\s*[:\-]?\s*(\d{4,}(?:\.\d+)?)",
        description="Regex pattern to match take profit (single)"
    )
    signal_tp_multi_pattern: str = Field(
        default=r"(?i)(?:TPs?|Take\s*Profits?)\s*[:\-]?\s*([\d.,\s]+)",
        description="Regex pattern to match multiple take profits"
    )
    
    # Trading defaults
    default_position_size: float = Field(default=0.01, description="Default position size in lots")
    default_leverage: int = Field(default=1, description="Default leverage")
    max_pending_time_minutes: int = Field(default=60, description="Max time for pending trades")
    
    # Binance WebSocket (price feed)
    binance_ws_url: str = Field(
        default="wss://fstream.binance.com/ws",
        description="Binance Futures WebSocket URL"
    )
    binance_symbol: str = Field(default="XAUUSDT", description="Binance symbol for XAU/USD")
    
    # Session/Storage
    session_secret: str = Field(default="change-me-in-production", description="Session secret key")
    
    # Render/Deployment
    render_deployed: bool = Field(default=False, description="Whether running on Render")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance.
    
    Returns:
        Settings instance (cached)
    """
    return Settings()


# Convenience accessors
def get_telegram_config() -> dict:
    """Get Telegram configuration dict."""
    settings = get_settings()
    return {
        "api_id": settings.telegram_api_id,
        "api_hash": settings.telegram_api_hash,
        "phone": settings.telegram_phone,
        "channel_id": settings.telegram_channel_id,
        "session_name": settings.telegram_session_name,
    }


def get_regex_patterns() -> dict[str, str]:
    """Get all regex patterns for signal parsing."""
    settings = get_settings()
    return {
        "symbol": settings.signal_symbol_pattern,
        "direction": settings.signal_direction_pattern,
        "entry": settings.signal_entry_pattern,
        "entry_range": settings.signal_entry_range_pattern,
        "sl": settings.signal_sl_pattern,
        "tp": settings.signal_tp_pattern,
        "tp_multi": settings.signal_tp_multi_pattern,
    }


def get_trading_config() -> dict:
    """Get trading configuration dict."""
    settings = get_settings()
    return {
        "default_position_size": settings.default_position_size,
        "default_leverage": settings.default_leverage,
        "max_pending_time_minutes": settings.max_pending_time_minutes,
    }


def get_binance_config() -> dict:
    """Get Binance configuration dict."""
    settings = get_settings()
    return {
        "ws_url": settings.binance_ws_url,
        "symbol": settings.binance_symbol,
    }
