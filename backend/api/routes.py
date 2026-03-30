"""REST API routes for the trading system."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from ..models.trade import Trade, TradeStatus, ClosedTrade
from ..models.websocket import WSMessage
from ..services.interfaces import ITradeManager, IWebSocketBroadcaster, IBotStateManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["trading"])


# Request/Response models
class TradeResponse(BaseModel):
    """Trade response model."""
    success: bool
    data: Optional[dict] = None
    message: Optional[str] = None


class ControlRequest(BaseModel):
    """Bot control request."""
    action: str = Field(..., description="Action: pause or resume")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    services: dict[str, bool]


# Dependency injection - imports from DI container
from backend.dependency_injection import (
    get_trade_manager as di_get_trade_manager,
    get_websocket_broadcaster as di_get_broadcaster,
    get_bot_state_manager as di_get_state_manager,
)


def get_trade_manager() -> ITradeManager:
    """Get trade manager instance."""
    return di_get_trade_manager()


def get_websocket_broadcaster() -> IWebSocketBroadcaster:
    """Get WebSocket broadcaster instance."""
    return di_get_broadcaster()


def get_bot_state_manager() -> IBotStateManager:
    """Get bot state manager instance."""
    return di_get_state_manager()


@router.get("/health", response_model=HealthResponse)
async def health_check(
    state_manager: IBotStateManager = Depends(get_bot_state_manager),
) -> HealthResponse:
    """Health check endpoint for Render keep-alive.
    
    Returns:
        Health status with service states
    """
    status = await state_manager.get_status()
    
    return HealthResponse(
        status="healthy" if status.get("is_running", False) else "degraded",
        version="1.0.0",
        services={
            "telegram": status.get("telegram", {}).get("connected", False),
            "price_feed": status.get("price_feed", {}).get("connected", False),
            "api": True,
        }
    )


@router.get("/trades/active", response_model=TradeResponse)
async def get_active_trades(
    trade_manager: ITradeManager = Depends(get_trade_manager),
) -> TradeResponse:
    """Get all active trades.
    
    Returns:
        List of active trades with current P&L
    """
    trades = await trade_manager.get_active_trades()
    
    return TradeResponse(
        success=True,
        data={
            "trades": [t.model_dump(mode="json") for t in trades],
            "count": len(trades),
            "total_unrealized_pnl": trade_manager.unrealized_pnl,
        }
    )


@router.get("/trades/pending", response_model=TradeResponse)
async def get_pending_trades(
    trade_manager: ITradeManager = Depends(get_trade_manager),
) -> TradeResponse:
    """Get all pending trades (waiting for entry).
    
    Returns:
        List of pending trades
    """
    trades = await trade_manager.get_pending_trades()
    
    return TradeResponse(
        success=True,
        data={
            "trades": [t.model_dump(mode="json") for t in trades],
            "count": len(trades),
        }
    )


@router.get("/trades/history", response_model=TradeResponse)
async def get_trade_history(
    limit: int = 50,
    trade_manager: ITradeManager = Depends(get_trade_manager),
) -> TradeResponse:
    """Get closed trade history.
    
    Args:
        limit: Maximum number of trades to return
        
    Returns:
        List of closed trades
    """
    trades = await trade_manager.get_closed_trades(limit)
    
    return TradeResponse(
        success=True,
        data={
            "trades": [t.model_dump(mode="json") for t in trades],
            "count": len(trades),
            "total_realized_pnl": trade_manager.total_pnl,
        }
    )


@router.get("/trades/{trade_id}", response_model=TradeResponse)
async def get_trade(
    trade_id: str,
    trade_manager: ITradeManager = Depends(get_trade_manager),
) -> TradeResponse:
    """Get a specific trade by ID.
    
    Args:
        trade_id: Trade identifier
        
    Returns:
        Trade details
    """
    trade = await trade_manager.get_trade_by_id(trade_id)
    
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    return TradeResponse(
        success=True,
        data=trade.model_dump(mode="json")
    )


@router.post("/trades/{trade_id}/close", response_model=TradeResponse)
async def close_trade(
    trade_id: str,
    trade_manager: ITradeManager = Depends(get_trade_manager),
    broadcaster: IWebSocketBroadcaster = Depends(get_websocket_broadcaster),
) -> TradeResponse:
    """Manually close a trade.
    
    Args:
        trade_id: Trade identifier
        
    Returns:
        Closed trade details
    """
    trade = await trade_manager.get_trade_by_id(trade_id)
    
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Use current price for manual close
    current_price = trade.current_price
    if not current_price:
        raise HTTPException(status_code=400, detail="No current price available")
    
    closed = await trade_manager.close_trade(trade_id, current_price, "MANUAL")
    
    if closed:
        # Broadcast update
        await broadcaster.broadcast(
            WSMessage.trade_closed(closed).model_dump(mode="json")
        )
        
        return TradeResponse(
            success=True,
            data=closed.model_dump(mode="json"),
            message=f"Trade closed manually at {current_price}"
        )
    
    raise HTTPException(status_code=500, detail="Failed to close trade")


@router.get("/summary", response_model=TradeResponse)
async def get_summary(
    trade_manager: ITradeManager = Depends(get_trade_manager),
) -> TradeResponse:
    """Get trading summary statistics.
    
    Returns:
        Summary statistics
    """
    if hasattr(trade_manager, 'get_summary'):
        summary = trade_manager.get_summary()
    else:
        # Fallback if method doesn't exist
        active = await trade_manager.get_active_trades()
        closed = await trade_manager.get_closed_trades(100)
        
        winning = sum(1 for t in closed if t.realized_pnl > 0)
        losing = sum(1 for t in closed if t.realized_pnl < 0)
        
        summary = {
            "active_trades": len(active),
            "pending_trades": len(await trade_manager.get_pending_trades()),
            "closed_trades": len(closed),
            "total_realized_pnl": trade_manager.total_pnl,
            "total_unrealized_pnl": trade_manager.unrealized_pnl,
            "winning_trades": winning,
            "losing_trades": losing,
            "win_rate": round((winning / len(closed) * 100) if closed else 0, 2),
        }
    
    return TradeResponse(
        success=True,
        data=summary
    )


@router.post("/control", response_model=TradeResponse)
async def control_bot(
    request: ControlRequest,
    state_manager: IBotStateManager = Depends(get_bot_state_manager),
    broadcaster: IWebSocketBroadcaster = Depends(get_websocket_broadcaster),
) -> TradeResponse:
    """Control bot execution (pause/resume).
    
    Args:
        request: Control request with action
        
    Returns:
        Updated bot status
    """
    if request.action.lower() == "pause":
        await state_manager.pause()
        message = "Bot paused"
    elif request.action.lower() == "resume":
        await state_manager.resume()
        message = "Bot resumed"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")
    
    # Broadcast status update
    status = await state_manager.get_status()
    await broadcaster.broadcast_bot_status(
        is_running=status.get("is_running", False),
        is_paused=status.get("is_paused", True),
    )
    
    return TradeResponse(
        success=True,
        data=status,
        message=message
    )


@router.get("/status", response_model=TradeResponse)
async def get_bot_status(
    state_manager: IBotStateManager = Depends(get_bot_state_manager),
) -> TradeResponse:
    """Get current bot status.
    
    Returns:
        Bot status including connection states
    """
    status = await state_manager.get_status()
    
    return TradeResponse(
        success=True,
        data=status
    )
