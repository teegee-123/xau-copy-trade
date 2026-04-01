import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import logger from './logger.js';
import { db } from './services/database.js';
import { telegramService } from './services/telegram.js';
import { priceFeedService } from './services/priceFeed.js';
import { tradeManagerService } from './services/tradeManager.js';
import { webSocketService } from './websocket/index.js';

import authRoutes from './routes/auth.js';
import tradesRoutes from './routes/trades.js';
import priceRoutes from './routes/price.js';
import systemRoutes from './routes/system.js';
import configRoutes from './routes/config.js';

import { configService } from './services/configService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from project root
// When running from dist/server/index.js, go up 3 levels to reach project root
const envPath = path.join(__dirname, '../../../.env');
logger.info(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const PORT = parseInt(process.env.PORT || '3000', 10);

// Create Express app
const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/price', priceRoutes);
app.use('/api', systemRoutes);
app.use('/api/config', configRoutes);

// Health check with memory info for Render monitoring
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const healthStatus = {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
    },
  };
  res.json(healthStatus);
});

// Serve static files (React app)
// When running from dist/server/index.js, go up two levels to reach project root, then into src/client/dist
const clientPath = path.join(__dirname, '../../src/client/dist');
app.use(express.static(clientPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Initialize services and start server
async function bootstrap(): Promise<void> {
  try {
    logger.info('Starting Paper Trading Dashboard...');

    // Initialize config service first
    logger.info('Initializing config service...');
    configService.initialize();

    // Initialize database
    logger.info('Initializing database...');
    db;

    // Initialize price feed
    logger.info('Initializing price feed...');
    await priceFeedService.initialize();

    // Initialize trade manager
    logger.info('Initializing trade manager...');
    await tradeManagerService.initialize();

    // Initialize Telegram (non-blocking - will auth in background)
    logger.info('Initializing Telegram service...');
    telegramService.initialize().catch((err) => {
      logger.warn('Telegram initialization failed (will retry on auth)', { err });
    });

    // Connect Telegram signal handler to trade manager
    telegramService.on('signal', async (signal) => {
      logger.info('[INDEX] 📡 SIGNAL EVENT RECEIVED from telegramService', {
        symbol: signal.symbol,
        action: signal.action,
        messageId: signal.messageId,
      });
      await tradeManagerService.processSignal(signal);
    });

    // Initialize WebSocket
    logger.info('Initializing WebSocket...');
    webSocketService.initialize(httpServer);

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Dashboard: http://localhost:${PORT}`);
      logger.info(`API: http://localhost:${PORT}/api`);
      
      // Log memory usage for Render free tier monitoring (512MB limit)
      const memUsage = process.memoryUsage();
      logger.info(`Memory usage - Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB, RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
    });

    // Graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down server...');

  // Stop services
  tradeManagerService.stop();
  priceFeedService.shutdown();
  await telegramService.disconnect();
  webSocketService.shutdown();
  db.close();

  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    logger.warn('Forcing exit...');
    process.exit(1);
  }, 10000);
}

// Start the application
bootstrap();

export default app;
