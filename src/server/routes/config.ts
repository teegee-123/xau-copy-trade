import { Router } from 'express';
import { configService } from '../services/configService.js';
import { db } from '../services/database.js';
import logger from '../logger.js';

const router = Router();

/**
 * GET /api/config
 * Get all current configurations
 */
router.get('/', (req, res) => {
  try {
    const config = configService.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    logger.error('Error getting config', { error });
    res.status(500).json({ success: false, error: 'Failed to get configuration' });
  }
});

/**
 * GET /api/config/:section
 * Get specific configuration section
 * Params: section (channel, entrySignalTemplate, sltpSignalTemplate, trading, priceFeed)
 */
router.get('/:section', (req, res) => {
  try {
    const section = req.params.section;
    const validSections = ['channel', 'entrySignalTemplate', 'sltpSignalTemplate', 'trading', 'priceFeed'];
    
    if (!validSections.includes(section)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid section. Valid sections: channel, entrySignalTemplate, sltpSignalTemplate, trading, priceFeed' 
      });
    }

    const configSection = configService.getConfigSection(section as any);
    res.json({ success: true, config: configSection });
  } catch (error) {
    logger.error('Error getting config section', { error });
    res.status(500).json({ success: false, error: 'Failed to get configuration section' });
  }
});

/**
 * PUT /api/config
 * Update configuration (partial updates supported)
 * Body: { section: string, data: object }
 */
router.put('/', (req, res) => {
  try {
    const { section, data } = req.body;

    if (!section || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: section and data' 
      });
    }

    const validSections = ['channel', 'entrySignalTemplate', 'sltpSignalTemplate', 'trading', 'priceFeed'];
    if (!validSections.includes(section)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid section. Valid sections: ${validSections.join(', ')}` 
      });
    }

    // Validate trading config
    if (section === 'trading') {
      if (data.defaultLotSize !== undefined) {
        const lotSize = parseFloat(data.defaultLotSize);
        if (isNaN(lotSize) || lotSize <= 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'defaultLotSize must be a positive number' 
          });
        }
      }
      if (data.slTpTimeoutMinutes !== undefined) {
        const timeout = parseInt(data.slTpTimeoutMinutes, 10);
        if (isNaN(timeout) || timeout <= 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'slTpTimeoutMinutes must be a positive number' 
          });
        }
      }
    }

    // Validate price feed config
    if (section === 'priceFeed') {
      if (data.pollingIntervalMs !== undefined) {
        const interval = parseInt(data.pollingIntervalMs, 10);
        if (isNaN(interval) || interval < 500 || interval > 10000) {
          return res.status(400).json({ 
            success: false, 
            error: 'pollingIntervalMs must be between 500 and 10000 milliseconds' 
          });
        }
      }
    }

    // Validate template pattern if provided
    if (section === 'entrySignalTemplate' || section === 'sltpSignalTemplate') {
      if (data.pattern !== undefined) {
        const flags = data.flags || 'i';
        const validation = configService.validatePattern(data.pattern, flags);
        if (!validation.valid) {
          return res.status(400).json({ 
            success: false, 
            error: `Invalid regex pattern: ${validation.error}` 
          });
        }
      }
    }

    // Apply the update
    configService.updateConfig(section, data);

    logger.info('Configuration updated via API', { section, changes: Object.keys(data) });

    res.json({ 
      success: true, 
      message: 'Configuration updated successfully',
      config: configService.getConfigSection(section)
    });
  } catch (error) {
    logger.error('Error updating config', { error });
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

/**
 * POST /api/config/test-template
 * Test a template against a message
 * Body: { templateType: 'entry' | 'sltp', message: string, template?: object }
 */
router.post('/test-template', (req, res) => {
  try {
    const { templateType, message, template } = req.body;

    if (!templateType || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: templateType and message' 
      });
    }

    if (!['entry', 'sltp'].includes(templateType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid templateType. Must be "entry" or "sltp"' 
      });
    }

    const result = configService.testTemplate(templateType, message, template);

    res.json({ success: true, result });
  } catch (error) {
    logger.error('Error testing template', { error });
    res.status(500).json({ success: false, error: 'Failed to test template' });
  }
});

/**
 * GET /api/config/historical-messages
 * Get recent parsed signals for testing
 * Query: limit (default: 10, max: 50)
 */
router.get('/historical-messages', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 50);
    
    // Get recent trades from database which contain the original signal info
    const trades = db.getRecentTrades(limit);
    
    const messages = trades.map(trade => ({
      id: trade.id,
      messageId: trade.telegramMessageId,
      symbol: trade.symbol,
      action: trade.action,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      createdAt: trade.createdAt,
      // Note: We don't have the original message text stored, 
      // but we can show the trade details for reference
    }));

    res.json({ success: true, messages });
  } catch (error) {
    logger.error('Error getting historical messages', { error });
    res.status(500).json({ success: false, error: 'Failed to get historical messages' });
  }
});

/**
 * GET /api/config/template-examples
 * Get example messages from current templates
 */
router.get('/template-examples', (req, res) => {
  try {
    const config = configService.getConfig();
    
    const examples = {
      entry: config.entrySignalTemplate.examples,
      sltp: config.sltpSignalTemplate.examples,
    };

    res.json({ success: true, examples });
  } catch (error) {
    logger.error('Error getting template examples', { error });
    res.status(500).json({ success: false, error: 'Failed to get template examples' });
  }
});

export default router;
