import { Router } from 'express';
import { tradeManagerService } from '../services/tradeManager.js';
import logger from '../logger.js';

const router = Router();

/**
 * GET /api/trades/open
 * Get all open trades
 */
router.get('/open', (req, res) => {
  try {
    const trades = tradeManagerService.getOpenTrades();
    res.json({ success: true, trades });
  } catch (error) {
    logger.error('Error getting open trades', { error });
    res.status(500).json({ success: false, error: 'Failed to get open trades' });
  }
});

/**
 * GET /api/trades/history
 * Get closed trade history with optional filters
 * Query: from, to, symbol, action
 */
router.get('/history', (req, res) => {
  try {
    const filters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      symbol: req.query.symbol as string | undefined,
      action: req.query.action as string | undefined,
    };

    const trades = tradeManagerService.getTradeHistory(filters);
    res.json({ success: true, trades });
  } catch (error) {
    logger.error('Error getting trade history', { error });
    res.status(500).json({ success: false, error: 'Failed to get trade history' });
  }
});

/**
 * POST /api/trades/:id/close
 * Manually close a trade
 */
router.post('/:id/close', async (req, res) => {
  try {
    const tradeId = parseInt(req.params.id, 10);
    const reason = req.body.reason || 'MANUAL_CLOSE';

    if (isNaN(tradeId)) {
      return res.status(400).json({ success: false, error: 'Invalid trade ID' });
    }

    const trade = await tradeManagerService.closeTrade(tradeId, reason);
    
    if (trade) {
      res.json({ success: true, trade });
    } else {
      res.status(404).json({ success: false, error: 'Trade not found or already closed' });
    }
  } catch (error) {
    logger.error('Error closing trade', { error });
    res.status(500).json({ success: false, error: 'Failed to close trade' });
  }
});

/**
 * POST /api/trades/close-faulted
 * Close all faulted trades (missing SL/TP after timeout)
 */
router.post('/close-faulted', async (req, res) => {
  try {
    const result = await tradeManagerService.closeAllFaultedTrades();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error closing faulted trades', { error });
    res.status(500).json({ success: false, error: 'Failed to close faulted trades' });
  }
});

/**
 * GET /api/trades/summary
 * Get P&L summary
 */
router.get('/summary', (req, res) => {
  try {
    const summary = tradeManagerService.getPnLSummary();
    res.json({ success: true, summary });
  } catch (error) {
    logger.error('Error getting P&L summary', { error });
    res.status(500).json({ success: false, error: 'Failed to get P&L summary' });
  }
});

export default router;
