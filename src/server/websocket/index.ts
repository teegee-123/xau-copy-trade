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

// Configuration - Read from environment variables with sensible defaults
const WS_CONFIG = {
  MAX_CONNECTIONS: parseInt(process.env.WS_MAX_CONNECTIONS || '10', 10),
  HEARTBEAT_INTERVAL: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '15000', 10),
  PING_TIMEOUT: parseInt(process.env.WS_PING_TIMEOUT || '30000', 10),
  ORIGIN_WHITELIST: process.env.WS_ORIGIN_WHITELIST
    ? process.env.WS_ORIGIN_WHITELIST.split(',').map(s => s.trim())
    : ['localhost', '127.0.0.1', '.onrender.com'],
};

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, CustomWebSocket> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionCounter = 0;

  /**
   * Get current connection count (for monitoring/debugging)
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Get connection limit
   */
  getConnectionLimit(): number {
    return WS_CONFIG.MAX_CONNECTIONS;
  }

  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: false,
      clientTracking: true,
    });

    this.wss.on('connection', (ws: CustomWebSocket, request: IncomingMessage) => {
      const origin = request.headers.origin;
      const ip = request.socket.remoteAddress;

      logger.info('[WebSocket] Connection attempt', {
        origin: origin || 'unknown',
        ip: ip || 'unknown',
        url: request.url,
        currentConnections: this.clients.size,
        maxConnections: WS_CONFIG.MAX_CONNECTIONS,
      });

      this.handleConnection(ws, origin);
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
      heartbeatInterval: WS_CONFIG.HEARTBEAT_INTERVAL,
      pingTimeout: WS_CONFIG.PING_TIMEOUT,
      originWhitelist: WS_CONFIG.ORIGIN_WHITELIST,
    });
  }

  /**
   * Validate if origin is allowed
   */
  private isOriginAllowed(origin?: string): boolean {
    if (!origin) return true;

    try {
      const url = new URL(origin);
      const hostname = url.hostname.toLowerCase();

      return WS_CONFIG.ORIGIN_WHITELIST.some(allowed => {
        if (allowed.startsWith('.')) {
          return hostname.endsWith(allowed);
        }
        return hostname === allowed;
      });
    } catch {
      return false;
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

      deadClients.forEach((id) => {
        this.clients.delete(id);
      });

      if (deadClients.length > 0) {
        logger.info('[WebSocket] Cleaned up stale connections', {
          count: deadClients.length,
          remaining: this.clients.size,
        });
      }

      const currentSize = this.clients.size;
      if (currentSize > WS_CONFIG.MAX_CONNECTIONS) {
        logger.warn('[WebSocket] Connection map size exceeds limit', {
          current: currentSize,
          max: WS_CONFIG.MAX_CONNECTIONS,
        });
      } else if (currentSize > 0) {
        logger.debug('[WebSocket] Connection map health', {
          activeConnections: currentSize,
        });
      }
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
  }

  private handleConnection(ws: CustomWebSocket, origin?: string): void {
    // Validate origin first
    if (!this.isOriginAllowed(origin)) {
      logger.warn('[WebSocket] Connection rejected - origin not allowed', { origin });
      ws.close(4003, 'Origin not allowed');
      return;
    }

    // Generate unique ID for this connection
    const connectionId = `client_${++this.connectionCounter}`;
    ws.id = connectionId;
    ws.isAlive = true;

    // Check connection limit BEFORE adding to map (fix: prevent over-capacity connections)
    if (this.clients.size >= WS_CONFIG.MAX_CONNECTIONS) {
      logger.warn('[WebSocket] Connection rejected - max connections reached', {
        current: this.clients.size,
        max: WS_CONFIG.MAX_CONNECTIONS,
        origin: origin || 'unknown',
        connectionId,
      });

      // Close immediately WITHOUT adding to clients map
      // This prevents the race condition where client reconnects before cleanup
      ws.close(4004, 'Server at capacity');
      
      // Log that we're NOT tracking this connection (no cleanup needed)
      logger.debug('[WebSocket] Rejected connection not tracked (no cleanup needed)', {
        connectionId,
      });
      return;
    }

    // Add to clients map (we've verified capacity above)
    this.clients.set(connectionId, ws);
    logger.debug('[WebSocket] Connection added to Map', {
      connectionId,
      totalClients: this.clients.size,
    });

    logger.info('[WebSocket] Client connected', {
      totalClients: this.clients.size,
      connectionId,
      timestamp: new Date().toISOString(),
    });

    // Track cleanup state to prevent double-cleanup
    let isCleanedUp = false;
    const safeCleanup = () => {
      if (!isCleanedUp) {
        isCleanedUp = true;
        if (this.clients.delete(connectionId)) {
          logger.info('[WebSocket] Client cleaned up', {
            totalClients: this.clients.size,
            connectionId,
          });
        } else {
          logger.debug('[WebSocket] Client already removed from Map', { connectionId });
        }
      }
    };

    ws.on('close', (code, reason) => {
      logger.debug('[WebSocket] Close event received', {
        connectionId,
        code,
        reason: reason?.toString() || 'none',
      });
      safeCleanup();
    });

    ws.on('error', (error) => {
      logger.debug('[WebSocket] Error event received', {
        error: error.message,
        connectionId,
        readyState: ws.readyState,
      });
      // Cleanup on error (close event should also fire, but this is a safety net)
      safeCleanup();
    });

    // Connection timeout - clean up if handshake doesn't complete
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        logger.warn('[WebSocket] Connection timeout, cleaning up', { connectionId });
        ws.terminate();
        safeCleanup();
      }
    }, 10000);

    // Ping timeout - close if no response
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

    // Send initial status, then clear connection timeout
    this.sendInitialStatus(ws)
      .then(() => {
        clearTimeout(connectionTimeout);
      })
      .catch((error) => {
        clearTimeout(connectionTimeout);
        logger.error('[WebSocket] Failed to send initial status, closing connection', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
        ws.close(1011, 'Server initialization error');
        safeCleanup();
      });
  }

  private async sendInitialStatus(ws: CustomWebSocket): Promise<void> {
    const telegramStatus = telegramService.getStatus();
    const priceStatus = priceFeedService.getStatus();
    const currentPrice = priceFeedService.getCurrentPrice();

    logger.debug('[WebSocket] Sending initial status', {
      telegramConnected: telegramStatus.connected,
      priceConnected: priceStatus.connected,
      hasCurrentPrice: !!currentPrice,
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
  }

  private subscribeToEvents(): void {
    priceFeedService.on('priceUpdate', (priceData: unknown) => {
      this.broadcast({
        type: 'PRICE_UPDATE',
        data: priceData,
      });
    });

    tradeManagerService.on('tradeUpdate', (update: unknown) => {
      this.broadcast({
        type: 'TRADE_UPDATE',
        data: update,
      });
    });

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
