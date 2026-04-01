import { Router } from 'express';
import { tradeManagerService } from '../services/tradeManager.js';
import { tradeStore } from '../services/tradeStore.js';
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
 * Get closed trade history
 */
router.get('/history', (req, res) => {
  try {
    const trades = tradeManagerService.getClosedTrades();
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
 * GET /api/trades/:id/age
 * Get trade age in seconds and formatted string
 */
router.get('/:id/age', (req, res) => {
  try {
    const tradeId = parseInt(req.params.id, 10);
    
    if (isNaN(tradeId)) {
      return res.status(400).json({ success: false, error: 'Invalid trade ID' });
    }

    const ageInSeconds = tradeStore.getTradeAgeInSeconds(tradeId);
    const minutes = Math.floor(ageInSeconds / 60);
    const seconds = ageInSeconds % 60;
    const ageFormatted = `${minutes}m ${seconds}s`;

    res.json({
      success: true,
      tradeId,
      ageInSeconds,
      ageFormatted,
    });
  } catch (error) {
    logger.error('Error getting trade age', { error });
    res.status(500).json({ success: false, error: 'Failed to get trade age' });
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

/**
 * GET /api/trades/stats
 * Get trade store stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = tradeStore.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error getting trade stats', { error });
    res.status(500).json({ success: false, error: 'Failed to get trade stats' });
  }
});

/**
 * GET /api/trades/seed
 * Create random sample trades for testing (dev only)
 * Creates 1-3 random trades with varying SL/TP configurations
 */
router.get('/seed', (req, res) => {
  try {
    const basePrice = 2650 + Math.random() * 50; // Random base price between 2650-2700
    
    // Randomly decide how many trades to create (1-3)
    const numTrades = Math.floor(Math.random() * 3) + 1;
    const createdTrades = [];

    for (let i = 0; i < numTrades; i++) {
      const isBuy = Math.random() > 0.5;
      const entryPrice = basePrice + (Math.random() * 10 - 5);
      const hasSlTp = Math.random() > 0.3; // 70% chance to have SL/TP
      
      const trade = tradeStore.create({
        symbol: 'XAUUSD',
        action: isBuy ? 'BUY' : 'SELL',
        entryPrice: Math.round(entryPrice * 100) / 100,
        stopLoss: hasSlTp ? Math.round((entryPrice - (isBuy ? 10 : -10)) * 100) / 100 : null,
        takeProfit: hasSlTp ? Math.round((entryPrice + (isBuy ? 20 : -20)) * 100) / 100 : null,
        lotSize: 0.1 + Math.round(Math.random() * 0.2 * 10) / 10,
        telegramMessageId: 99900 + i + 1,
      });

      createdTrades.push(trade);
    }

    const stats = tradeStore.getStats();
    res.json({ 
      success: true, 
      message: `Created ${createdTrades.length} random trade(s)`,
      count: createdTrades.length,
      stats,
      trades: createdTrades 
    });
  } catch (error) {
    logger.error('Error seeding trades', { error });
    res.status(500).json({ success: false, error: 'Failed to seed trades' });
  }
});

export default router;
