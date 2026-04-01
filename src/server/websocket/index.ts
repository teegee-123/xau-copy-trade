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

// Configuration for Render free tier optimization
const WS_CONFIG = {
  MAX_CONNECTIONS: 10,           // Limit concurrent connections for 512MB RAM
  HEARTBEAT_INTERVAL: 15000,     // 15s heartbeat (shorter for faster cleanup)
  PING_TIMEOUT: 10000,           // 10s timeout for ping response
  ORIGIN_WHITIST: ['localhost', '127.0.0.1', '.onrender.com'],  // Allowed origins
};

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
      clientTracking: true,
      // Origin validation handled in connection handler
    });

    this.wss.on('connection', (ws: CustomWebSocket, request: IncomingMessage) => {
      const origin = request.headers.origin;
      const ip = request.socket.remoteAddress;
      
      // Validate origin
      if (!this.isOriginAllowed(origin)) {
        logger.warn('[WebSocket] Connection rejected - origin not allowed', { origin });
        ws.close(4003, 'Origin not allowed');
        return;
      }

      // Check connection limit
      if (this.clients.size >= WS_CONFIG.MAX_CONNECTIONS) {
        logger.warn('[WebSocket] Connection rejected - max connections reached', {
          current: this.clients.size,
          max: WS_CONFIG.MAX_CONNECTIONS,
          origin: origin || 'unknown'
        });
        ws.close(4004, 'Server at capacity');
        return;
      }

      logger.info('[WebSocket] Connection attempt', {
        origin: origin || 'unknown',
        ip: ip || 'unknown',
        url: request.url,
        currentConnections: this.clients.size
      });
      
      this.handleConnection(ws);
    });

    this.wss.on('error', (error) => {
      logger.error('[WebSocket] Server error', { error: error.message });
    });

    this.wss.on('close', () => {
      logger.info('[WebSocket] WebSocket server closed');
    });

    // Start heartbeat to clean up stale connections
    this.startHeartbeat();

    // Subscribe to service events
    this.subscribeToEvents();

    logger.info('[WebSocket] Server initialized', {
      maxConnections: WS_CONFIG.MAX_CONNECTIONS,
      heartbeatInterval: WS_CONFIG.HEARTBEAT_INTERVAL
    });
  }

  /**
   * Validate if origin is allowed
   */
  private isOriginAllowed(origin?: string): boolean {
    if (!origin) return true; // Allow requests without origin (e.g., mobile apps, curl)
    
    try {
      const url = new URL(origin);
      const hostname = url.hostname.toLowerCase();
      
      // Check whitelist
      return WS_CONFIG.ORIGIN_WHITIST.some(allowed => {
        if (allowed.startsWith('.')) {
          // Subdomain match (e.g., .onrender.com matches xau-copy-trade.onrender.com)
          return hostname.endsWith(allowed);
        }
        return hostname === allowed;
      });
    } catch {
      return false; // Invalid URL
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      const deadClients: string[] = [];
      this.clients.forEach((ws, id) => {
        if (ws.isAlive === false) {
          deadClients.push(id);
          ws.terminate();
          logger.debug('[WebSocket] Terminated stale client', { connectionId: id });
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });

      // Clean up dead clients
      deadClients.forEach((id) => {
        this.clients.delete(id);
      });

      if (deadClients.length > 0) {
        logger.info('[WebSocket] Cleaned up stale connections', {
          count: deadClients.length,
          remaining: this.clients.size
        });
      }
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
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
      logger.debug('[WebSocket] Client error', {
        error: error.message,
        connectionId,
        readyState: ws.readyState
      });
      // Don't immediately remove - let close handler do it
    });

    // Set ping timeout - close if no response within timeout
    const pingTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        logger.warn('[WebSocket] Client ping timeout, closing', { connectionId });
        ws.close(4001, 'Ping timeout');
      }
    }, WS_CONFIG.PING_TIMEOUT);

    ws.on('pong', () => {
      ws.isAlive = true;
      clearTimeout(pingTimeout);
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
