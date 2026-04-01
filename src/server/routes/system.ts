import { Router } from 'express';
import { telegramService } from '../services/telegram.js';
import { priceFeedService } from '../services/priceFeed.js';
import { tradeManagerService, getSignalHistory, clearSignalHistory } from '../services/tradeManager.js';
import { getRecentLogs, clearLogs } from '../logger.js';
import { db } from '../services/database.js';
import { webSocketService } from '../websocket/index.js';
import logger from '../logger.js';

const router = Router();

/**
 * GET /api/status
 * Get overall system status
 */
router.get('/status', (req, res) => {
  try {
    const telegramStatus = telegramService.getStatus();
    const priceStatus = priceFeedService.getStatus();
    const tradingEnabled = tradeManagerService.isTradingEnabledStatus();
    const activeTradesCount = tradeManagerService.getActiveTradesCount();

    res.json({
      success: true,
      status: {
        telegram: telegramStatus,
        price: priceStatus,
        trading: {
          enabled: tradingEnabled,
          activeTrades: activeTradesCount,
        },
        overall: telegramStatus.connected && priceStatus.connected ? 'healthy' : 'degraded',
      },
    });
  } catch (error) {
    logger.error('Error getting system status', { error });
    res.status(500).json({ success: false, error: 'Failed to get system status' });
  }
});

/**
 * GET /api/logs
 * Get recent logs with optional level filter
 * Query: level (INFO, WARN, ERROR), limit (default 100)
 */
router.get('/logs', (req, res) => {
  try {
    const level = req.query.level as string | undefined;
    const limit = parseInt(req.query.limit as string || '100', 10);

    const logs = getRecentLogs(level, Math.min(limit, 500));
    res.json({ success: true, logs });
  } catch (error) {
    logger.error('Error getting logs', { error });
    res.status(500).json({ success: false, error: 'Failed to get logs' });
  }
});

/**
 * POST /api/logs/clear
 * Clear all logs
 */
router.post('/logs/clear', (req, res) => {
  try {
    const result = clearLogs();
    res.json({ success: true, cleared: result });
  } catch (error) {
    logger.error('Error clearing logs', { error });
    res.status(500).json({ success: false, error: 'Failed to clear logs' });
  }
});

/**
 * POST /api/trading/toggle
 * Toggle trading on/off
 * Body: enabled (boolean)
 */
router.post('/trading/toggle', (req, res) => {
  try {
    const enabled = req.body.enabled;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    tradeManagerService.setTradingEnabled(enabled);
    res.json({ success: true, enabled });
  } catch (error) {
    logger.error('Error toggling trading', { error });
    res.status(500).json({ success: false, error: 'Failed to toggle trading' });
  }
});

/**
 * GET /api/equity
 * Get equity history for charts
 * Query: range (1D, 1W, 1M, ALL)
 */
router.get('/equity', (req, res) => {
  try {
    const range = (req.query.range as '1D' | '1W' | '1M' | 'ALL') || '1W';
    const snapshots = db.getEquityHistory(range);

    // Calculate total equity from P&L
    const pnlSummary = tradeManagerService.getPnLSummary();
    const currentEquity = 10000 + pnlSummary.totalPnlUsd; // Starting equity 10000

    res.json({
      success: true,
      snapshots,
      currentEquity,
    });
  } catch (error) {
    logger.error('Error getting equity history', { error });
    res.status(500).json({ success: false, error: 'Failed to get equity history' });
  }
});

/**
 * GET /api/ws/status
 * Get WebSocket connection status (for debugging)
 */
router.get('/ws/status', (req, res) => {
  try {
    const connectionCount = webSocketService.getConnectionCount();
    const connectionLimit = webSocketService.getConnectionLimit();

    res.json({
      success: true,
      status: {
        activeConnections: connectionCount,
        maxConnections: connectionLimit,
        availableSlots: Math.max(0, connectionLimit - connectionCount),
        isAtCapacity: connectionCount >= connectionLimit,
      },
    });
  } catch (error) {
    logger.error('Error getting WebSocket status', { error });
    res.status(500).json({ success: false, error: 'Failed to get WebSocket status' });
  }
});

/**
 * GET /api/debug/signals
 * Get signal processing history (for debugging)
 */
router.get('/debug/signals', (req, res) => {
  try {
    const history = getSignalHistory();
    const telegramStatus = telegramService.getStatus();
    const config = telegramService.getStatus(); // Gets current channel config

    res.json({
      success: true,
      data: {
        signalHistory: history,
        telegramStatus: {
          connected: telegramStatus.connected,
          authenticated: telegramStatus.authenticated,
          channelId: telegramStatus.channelId,
        },
        listenerCount: {
          telegramSignalListeners: 'N/A (internal EventEmitter)',
        },
      },
    });
  } catch (error) {
    logger.error('Error getting signal history', { error });
    res.status(500).json({ success: false, error: 'Failed to get signal history' });
  }
});

/**
 * POST /api/debug/signals/clear
 * Clear signal history
 */
router.post('/debug/signals/clear', (req, res) => {
  try {
    clearSignalHistory();
    res.json({ success: true, message: 'Signal history cleared' });
  } catch (error) {
    logger.error('Error clearing signal history', { error });
    res.status(500).json({ success: false, error: 'Failed to clear signal history' });
  }
});

export default router;
