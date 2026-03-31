import { Router } from 'express';
import { telegramService } from '../services/telegram.js';
import logger from '../logger.js';

const router = Router();

/**
 * POST /auth/request
 * Request verification code from Telegram
 * Query: phone (optional, uses env if not provided)
 */
router.get('/request', async (req, res) => {
  try {
    const phone = req.query.phone as string || process.env.TELEGRAM_PHONE || '';
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number required. Provide via query param or .env' 
      });
    }

    logger.info('Auth code requested', { phone });
    const result = await telegramService.requestAuthCode(phone);

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (error) {
    logger.error('Auth request error', { error });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to request code' 
    });
  }
});

/**
 * GET /auth/verify
 * Verify the code and complete authentication
 * Query: code
 */
router.get('/verify', async (req, res) => {
  try {
    const code = req.query.code as string;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Verification code required' 
      });
    }

    logger.info('Auth code verification attempted');
    const result = await telegramService.verifyCode(code);

    if (result.success && result.session) {
      res.json({ 
        success: true, 
        message: 'Authentication successful',
        session: { authenticated: true }
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error || 'Invalid code' 
      });
    }
  } catch (error) {
    logger.error('Auth verify error', { error });
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Verification failed' 
    });
  }
});

/**
 * GET /auth/status
 * Get current authentication status
 */
router.get('/status', (req, res) => {
  const status = telegramService.getStatus();
  res.json({ success: true, status });
});

export default router;
