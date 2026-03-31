import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { priceFeedService } from '../services/priceFeed.js';
import { tradeManagerService } from '../services/tradeManager.js';
import { telegramService } from '../services/telegram.js';
import { configService } from '../services/configService.js';
import logger from '../logger.js';

interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
  id?: string;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, CustomWebSocket> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionCounter = 0;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: false,
    });

    this.wss.on('connection', (ws: CustomWebSocket) => {
      this.handleConnection(ws);
    });

    // Start heartbeat to clean up stale connections
    this.startHeartbeat();

    // Subscribe to service events
    this.subscribeToEvents();

    logger.info('WebSocket server initialized');
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      const deadClients: string[] = [];
      this.clients.forEach((ws, id) => {
        if (ws.isAlive === false) {
          deadClients.push(id);
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });

      // Clean up dead clients
      deadClients.forEach((id) => {
        this.clients.delete(id);
      });
    }, 30000);
  }

  private handleConnection(ws: CustomWebSocket): void {
    // Generate unique ID for this connection
    const connectionId = `client_${++this.connectionCounter}`;
    ws.id = connectionId;
    ws.isAlive = true;
    
    // Check if we already have this exact WebSocket (shouldn't happen, but safety check)
    if (this.clients.has(connectionId)) {
      logger.warn('Duplicate connection ID detected, closing');
      ws.terminate();
      return;
    }

    this.clients.set(connectionId, ws);
    logger.debug('WebSocket client connected', { totalClients: this.clients.size });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      if (this.clients.delete(connectionId)) {
        logger.debug('WebSocket client disconnected', { totalClients: this.clients.size });
      }
    });

    ws.on('error', (error) => {
      logger.debug('WebSocket client error', { error: error.message });
      this.clients.delete(connectionId);
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

    // Config changes
    configService.on('configChange', (configUpdate: { section: string; config: unknown }) => {
      this.broadcast({
        type: 'CONFIG_UPDATE',
        data: configUpdate,
      });
    });
  }

  private broadcast(message: object): void {
    const messageStr = JSON.stringify(message);
    const deadClients: string[] = [];

    this.clients.forEach((ws, id) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      } else {
        deadClients.push(id);
      }
    });

    // Clean up dead clients
    deadClients.forEach((id) => {
      this.clients.delete(id);
    });
  }

  private send(ws: CustomWebSocket, message: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.wss) {
      this.clients.forEach((client) => {
        client.close(1000, 'Server shutting down');
      });

      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
    }

    this.clients.clear();
  }
}

export const webSocketService = new WebSocketService();
