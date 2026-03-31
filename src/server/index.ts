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

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files (React app)
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
  priceFeedService.stopPolling();
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
