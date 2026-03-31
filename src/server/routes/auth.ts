import { Router } from 'express';
import { telegramService } from '../services/telegram.js';
import logger from '../logger.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const router = Router();

/**
 * GET /auth/request
 * Request verification code from Telegram
 * Uses TELEGRAM_PHONE from .env (query param ignored)
 */
router.get('/request', async (req, res) => {
  try {
    // Always use phone from .env file
    const phone = process.env.TELEGRAM_PHONE || '';
    const apiId = process.env.TELEGRAM_API_ID || '';
    const apiHash = process.env.TELEGRAM_API_HASH || '';

    // Debug logging
    logger.info('Auth request - env values', { 
      phone: phone ? '***' + phone.slice(-4) : 'EMPTY',
      apiId: apiId || 'EMPTY',
      apiHash: apiHash ? '***' + apiHash.slice(-4) : 'EMPTY'
    });

    // Validate required credentials
    if (!apiId || !apiHash) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_API_ID or TELEGRAM_API_HASH not configured in .env'
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_PHONE not configured in .env'
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
