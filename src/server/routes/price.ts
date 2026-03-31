import { Router } from 'express';
import { priceFeedService } from '../services/priceFeed.js';
import logger from '../logger.js';

const router = Router();

/**
 * GET /api/price/current
 * Get current XAU/USD price
 */
router.get('/current', (req, res) => {
  try {
    const priceData = priceFeedService.getCurrentPrice();
    const status = priceFeedService.getStatus();
    
    res.json({ 
      success: true, 
      price: priceData,
      status: {
        connected: status.connected,
        source: status.source,
        lastUpdate: status.lastUpdate,
      }
    });
  } catch (error) {
    logger.error('Error getting current price', { error });
    res.status(500).json({ success: false, error: 'Failed to get price' });
  }
});

/**
 * GET /api/price/status
 * Get price feed status
 */
router.get('/status', (req, res) => {
  try {
    const status = priceFeedService.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    logger.error('Error getting price status', { error });
    res.status(500).json({ success: false, error: 'Failed to get price status' });
  }
});

export default router;
