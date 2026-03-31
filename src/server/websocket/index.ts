import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { priceFeedService } from '../services/priceFeed.js';
import { tradeManagerService } from '../services/tradeManager.js';
import { telegramService } from '../services/telegram.js';
import logger from '../logger.js';

interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<CustomWebSocket> = new Set();

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      perMessageDeflate: false,
    });

    this.wss.on('connection', (ws: CustomWebSocket) => {
      this.handleConnection(ws);
    });

    // Subscribe to service events
    this.subscribeToEvents();

    logger.info('WebSocket server initialized');
  }

  private handleConnection(ws: CustomWebSocket): void {
    this.clients.add(ws);
    logger.info('WebSocket client connected', { totalClients: this.clients.size });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info('WebSocket client disconnected', { totalClients: this.clients.size });
    });

    ws.on('error', (error) => {
      logger.warn('WebSocket client error', { error: error.message });
      this.clients.delete(ws);
    });

    // Send initial status
    this.sendInitialStatus(ws);
  }

  private sendInitialStatus(ws: CustomWebSocket): void {
    try {
      const telegramStatus = telegramService.getStatus();
      const priceStatus = priceFeedService.getStatus();
      const currentPrice = priceFeedService.getCurrentPrice();

      this.send(ws, {
        type: 'INIT',
        data: {
          telegram: telegramStatus,
          price: priceStatus,
          currentPrice,
        },
      });
    } catch (error) {
      logger.warn('Error sending initial status', { error });
    }
  }

  private subscribeToEvents(): void {
    // Price updates
    priceFeedService.on('priceUpdate', (priceData: unknown) => {
      this.broadcast({
        type: 'PRICE_UPDATE',
        data: priceData,
      });
    });

    // Trade updates
    tradeManagerService.on('tradeUpdate', (update: unknown) => {
      this.broadcast({
        type: 'TRADE_UPDATE',
        data: update,
      });
    });

    // Status changes
    telegramService.on('statusChange', (status: unknown) => {
      this.broadcast({
        type: 'STATUS_CHANGE',
        data: {
          type: 'telegram',
          status,
        },
      });
    });

    priceFeedService.on('statusChange', (status: unknown) => {
      this.broadcast({
        type: 'STATUS_CHANGE',
        data: {
          type: 'price',
          status,
        },
      });
    });
  }

  private broadcast(message: object): void {
    const messageStr = JSON.stringify(message);
    const deadClients: Set<CustomWebSocket> = new Set();

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      } else {
        deadClients.add(client);
      }
    }

    // Clean up dead clients
    deadClients.forEach((client) => {
      this.clients.delete(client);
    });
  }

  private send(ws: CustomWebSocket, message: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        client.close(1000, 'Server shutting down');
      });
      
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
    }
  }
}

export const webSocketService = new WebSocketService();
