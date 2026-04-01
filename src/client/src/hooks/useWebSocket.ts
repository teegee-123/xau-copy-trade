import { useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage, PriceData, SystemStatus, TradeUpdate } from '../types';

interface UseWebSocketOptions {
  onPriceUpdate?: (price: PriceData) => void;
  onTradeUpdate?: (update: TradeUpdate) => void;
  onStatusChange?: (status: SystemStatus) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// ============================================================================
// SINGLETON PATTERN - Shared WebSocket instance across all hook consumers
// ============================================================================

// Module-level shared state (persists across hook instances)
let sharedWebSocket: WebSocket | null = null;
let sharedConnectionCount = 0;  // Reference count
let sharedIsConnected = false;
let sharedReconnectAttempts = 0;
let sharedReconnectTimeout: NodeJS.Timeout | null = null;
let sharedLastErrorCode: number | null = null;

// Shared callbacks - we'll merge callbacks from all hook instances
type CallbackKey = 'onPriceUpdate' | 'onTradeUpdate' | 'onStatusChange' | 'onConnect' | 'onDisconnect';
const sharedCallbacks = new Map<CallbackKey, Set<Function>>();

// Constants
const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY = 5000;
const CAPACITY_ERROR_DELAY = 30000;  // 30s delay for 4004 errors

/**
 * Register a callback for a specific event type
 */
function registerCallback<T extends CallbackKey>(type: T, callback: Function): () => void {
  if (!sharedCallbacks.has(type)) {
    sharedCallbacks.set(type, new Set());
  }
  sharedCallbacks.get(type)!.add(callback);
  
  // Return cleanup function
  return () => {
    sharedCallbacks.get(type)?.delete(callback);
  };
}

/**
 * Invoke all callbacks for a specific event type
 */
function invokeCallbacks<T extends CallbackKey>(type: T, ...args: unknown[]) {
  sharedCallbacks.get(type)?.forEach(callback => {
    try {
      callback(...args);
    } catch (error) {
      console.error(`[WebSocket] Error in ${type} callback:`, error);
    }
  });
}

/**
 * Create and configure the WebSocket connection
 */
function createWebSocketConnection(): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  console.log(`[WebSocket] Creating connection to ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WebSocket] Connected');
    sharedIsConnected = true;
    sharedReconnectAttempts = 0;
    sharedLastErrorCode = null;
    invokeCallbacks('onConnect');
  };

  ws.onmessage = (event) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'INIT': {
          const initData = message.data as {
            telegram: SystemStatus['telegram'];
            price: SystemStatus['price'];
            currentPrice: PriceData;
          };
          if (initData.currentPrice) {
            invokeCallbacks('onPriceUpdate', initData.currentPrice);
          }
          break;
        }

        case 'PRICE_UPDATE':
          invokeCallbacks('onPriceUpdate', message.data as PriceData);
          break;

        case 'TRADE_UPDATE':
          invokeCallbacks('onTradeUpdate', message.data as TradeUpdate);
          break;

        case 'STATUS_CHANGE':
          // Status changes are handled via polling for simplicity
          break;

        case 'CONFIG_UPDATE':
          // Config updates are handled by ConfigPanel
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error);
    }
  };

  ws.onclose = (event) => {
    const code = event.code;
    const reason = event.reason || 'none';
    console.log(`[WebSocket] Disconnected (code: ${code}, reason: ${reason})`);
    
    sharedIsConnected = false;
    sharedLastErrorCode = code;
    invokeCallbacks('onDisconnect');

    // Handle capacity errors (4004) - DO NOT auto-reconnect immediately
    if (code === 4004) {
      console.error('[WebSocket] Server at capacity - waiting 30s before retry');
      sharedReconnectAttempts = MAX_RECONNECT_ATTEMPTS;  // Prevent normal reconnection
      // Schedule a delayed retry after 30 seconds
      sharedReconnectTimeout = setTimeout(() => {
        console.log('[WebSocket] Retrying after capacity error...');
        sharedReconnectAttempts = 0;
        if (sharedConnectionCount > 0 && !sharedWebSocket) {
          sharedWebSocket = createWebSocketConnection();
        }
      }, CAPACITY_ERROR_DELAY);
      return;
    }

    // Handle origin not allowed (4003) - DO NOT auto-reconnect
    if (code === 4003) {
      console.error('[WebSocket] Origin not allowed - stopping reconnection');
      sharedReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
      return;
    }

    // Only reconnect for abnormal closures (not 1000=normal, 1001=going away)
    if (code !== 1000 && code !== 1001) {
      if (sharedReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn('[WebSocket] Max reconnect attempts reached');
        return;
      }

      sharedReconnectAttempts++;

      // Exponential backoff: 5s, 15s, 30s
      const delay = sharedReconnectAttempts === 1
        ? BASE_RECONNECT_DELAY
        : sharedReconnectAttempts === 2
          ? BASE_RECONNECT_DELAY * 3
          : BASE_RECONNECT_DELAY * 6;

      const jitter = Math.random() * 2000;
      const totalDelay = delay + jitter;

      console.log(`[WebSocket] Scheduling reconnect in ${Math.round(totalDelay)}ms (attempt ${sharedReconnectAttempts})`);

      sharedReconnectTimeout = setTimeout(() => {
        if (sharedConnectionCount > 0 && !sharedWebSocket) {
          sharedWebSocket = createWebSocketConnection();
        }
      }, totalDelay);
    } else {
      console.log('[WebSocket] Normal closure, not reconnecting');
    }
  };

  ws.onerror = (error) => {
    console.debug('[WebSocket] Connection error:', error);
  };

  return ws;
}

/**
 * Initialize the shared WebSocket connection
 */
function initializeSharedConnection(): void {
  if (sharedWebSocket) {
    // Connection already exists
    return;
  }

  sharedWebSocket = createWebSocketConnection();
}

/**
 * Cleanup the shared WebSocket connection
 */
function cleanupSharedConnection(): void {
  if (sharedReconnectTimeout) {
    clearTimeout(sharedReconnectTimeout);
    sharedReconnectTimeout = null;
  }

  if (sharedWebSocket) {
    if (sharedWebSocket.readyState === WebSocket.OPEN) {
      sharedWebSocket.close(1000, 'Client disconnecting');
    }
    sharedWebSocket = null;
  }

  sharedIsConnected = false;
  sharedReconnectAttempts = 0;
  sharedLastErrorCode = null;
}

// ============================================================================
// REACT HOOK - Uses the shared singleton connection
// ============================================================================

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const optionsRef = useRef(options);
  const cleanupFnsRef = useRef<Set<() => void>>(new Set());

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Register callbacks on mount
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    if (options.onPriceUpdate) {
      cleanups.push(registerCallback('onPriceUpdate', options.onPriceUpdate));
    }
    if (options.onTradeUpdate) {
      cleanups.push(registerCallback('onTradeUpdate', options.onTradeUpdate));
    }
    if (options.onStatusChange) {
      cleanups.push(registerCallback('onStatusChange', options.onStatusChange));
    }
    if (options.onConnect) {
      cleanups.push(registerCallback('onConnect', options.onConnect));
    }
    if (options.onDisconnect) {
      cleanups.push(registerCallback('onDisconnect', options.onDisconnect));
    }

    cleanupFnsRef.current = new Set(cleanups);

    return () => {
      cleanupFnsRef.current.forEach(cleanup => cleanup());
    };
  }, [options.onPriceUpdate, options.onTradeUpdate, options.onStatusChange, options.onConnect, options.onDisconnect]);

  // Manage connection reference count
  useEffect(() => {
    // Increment reference count on mount
    sharedConnectionCount++;
    console.log(`[WebSocket] Hook mounted, connection count: ${sharedConnectionCount}`);

    // Initialize connection if this is the first hook
    if (sharedConnectionCount === 1) {
      initializeSharedConnection();
    }

    return () => {
      // Decrement reference count on unmount
      sharedConnectionCount--;
      console.log(`[WebSocket] Hook unmounting, connection count: ${sharedConnectionCount}`);

      // Clean up callbacks
      cleanupFnsRef.current.forEach(cleanup => cleanup());

      // Close connection if this was the last hook
      if (sharedConnectionCount === 0) {
        console.log('[WebSocket] Last hook unmounted, cleaning up connection');
        cleanupSharedConnection();
      }
    };
  }, []);

  const sendMessage = useCallback((data: unknown) => {
    if (sharedWebSocket?.readyState === WebSocket.OPEN) {
      sharedWebSocket.send(JSON.stringify(data));
    } else {
      console.debug('[WebSocket] Cannot send message - not connected');
    }
  }, []);

  const reconnect = useCallback(() => {
    if (!sharedWebSocket || sharedWebSocket.readyState !== WebSocket.OPEN) {
      console.log('[WebSocket] Manual reconnect requested');
      sharedReconnectAttempts = 0;
      if (sharedReconnectTimeout) {
        clearTimeout(sharedReconnectTimeout);
        sharedReconnectTimeout = null;
      }
      sharedWebSocket = createWebSocketConnection();
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('[WebSocket] Manual disconnect requested');
    cleanupSharedConnection();
  }, []);

  return {
    isConnected: sharedIsConnected,
    sendMessage,
    reconnect,
    disconnect,
    lastErrorCode: sharedLastErrorCode,
  };
}
