import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
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
      // Allow all origins for development and Render
      // In production behind a proxy, you may want to validate origin header
    });

    this.wss.on('connection', (ws: CustomWebSocket, request: IncomingMessage) => {
      const origin = request.headers.origin;
      const ip = request.socket.remoteAddress;
      logger.info('[WebSocket] Connection attempt', { 
        origin: origin || 'unknown',
        ip: ip || 'unknown',
        url: request.url
      });
      this.handleConnection(ws);
    });

    this.wss.on('error', (error) => {
      logger.error('[WebSocket] Server error', { error: error.message });
    });

    // Start heartbeat to clean up stale connections
    this.startHeartbeat();

    // Subscribe to service events
    this.subscribeToEvents();

    logger.info('[WebSocket] Server initialized');
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
      logger.warn('[WebSocket] Duplicate connection ID detected, closing');
      ws.terminate();
      return;
    }

    this.clients.set(connectionId, ws);
    logger.info('[WebSocket] Client connected', { 
      totalClients: this.clients.size,
      connectionId,
      timestamp: new Date().toISOString()
    });

    ws.on('pong', () => {
      ws.isAlive = true;
      logger.debug('[WebSocket] Received pong', { connectionId });
    });

    ws.on('close', (code, reason) => {
      if (this.clients.delete(connectionId)) {
        logger.info('[WebSocket] Client disconnected', { 
          totalClients: this.clients.size,
          connectionId,
          code,
          reason: reason?.toString() || 'none'
        });
      }
    });

    ws.on('error', (error) => {
      // Log WebSocket errors for debugging
      logger.warn('[WebSocket] Client error', {
        error: error.message,
        connectionId,
        readyState: ws.readyState
      });
      // Don't immediately remove - let close handler do it
    });

    // Send initial status
    this.sendInitialStatus(ws);
  }

  private sendInitialStatus(ws: CustomWebSocket): void {
    try {
      const telegramStatus = telegramService.getStatus();
      const priceStatus = priceFeedService.getStatus();
      const currentPrice = priceFeedService.getCurrentPrice();

      logger.debug('[WebSocket] Sending initial status', {
        telegramConnected: telegramStatus.connected,
        priceConnected: priceStatus.connected,
        hasCurrentPrice: !!currentPrice
      });

      this.send(ws, {
        type: 'INIT',
        data: {
          telegram: telegramStatus,
          price: priceStatus,
          currentPrice,
        },
      });
      
      logger.info('[WebSocket] Initial status sent successfully');
    } catch (error) {
      logger.error('[WebSocket] Failed to send initial status', { 
        error: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Close with server error code to prevent infinite reconnect
      ws.close(1011, 'Server initialization error');
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
