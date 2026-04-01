import { useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage, PriceData, SystemStatus, TradeUpdate } from '../types';

interface UseWebSocketOptions {
  onPriceUpdate?: (price: PriceData) => void;
  onTradeUpdate?: (update: TradeUpdate) => void;
  onStatusChange?: (status: SystemStatus) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;  // Reduced for Render free tier
  const reconnectDelay = 5000;     // 5s base delay
  const optionsRef = useRef(options);
  const lastErrorTimeRef = useRef<number>(0);
  const errorCountRef = useRef(0);
  const isTabVisibleRef = useRef(true);

  // Track tab visibility to pause reconnection when hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
      
      // Reconnect when tab becomes visible again
      if (isTabVisibleRef.current && !isConnectedRef.current) {
        console.log('[WebSocket] Tab visible, attempting reconnection');
        reconnectAttemptsRef.current = 0;  // Reset attempts
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    // Clean up any existing connection first
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Reconnecting');
      }
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Don't reconnect if tab is hidden (save resources)
    if (!isTabVisibleRef.current) {
      console.debug('[WebSocket] Skipping connection - tab is hidden');
      return;
    }

    // Check max reconnect attempts
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.warn('[WebSocket] Max reconnect attempts reached, will retry on next user interaction');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const attempt = reconnectAttemptsRef.current + 1;
    console.log(`[WebSocket] Connecting to ${wsUrl} (attempt ${attempt})`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      isConnectedRef.current = true;
      reconnectAttemptsRef.current = 0;
      errorCountRef.current = 0;
      optionsRef.current.onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'INIT':
            const initData = message.data as {
              telegram: SystemStatus['telegram'];
              price: SystemStatus['price'];
              currentPrice: PriceData;
            };
            if (initData.currentPrice) {
              optionsRef.current.onPriceUpdate?.(initData.currentPrice);
            }
            break;

          case 'PRICE_UPDATE':
            optionsRef.current.onPriceUpdate?.(message.data as PriceData);
            break;

          case 'TRADE_UPDATE':
            optionsRef.current.onTradeUpdate?.(message.data as TradeUpdate);
            break;

          case 'STATUS_CHANGE':
            // Status changes are handled via polling for simplicity
            break;
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };

    ws.onclose = (event) => {
      const reason = event.reason || 'none';
      const code = event.code;
      console.log(`[WebSocket] Disconnected (code: ${code}, reason: ${reason})`);
      isConnectedRef.current = false;

      // Clear the reference to the closed WebSocket
      wsRef.current = null;

      optionsRef.current.onDisconnect?.();

      // Handle capacity errors (4004) - DO NOT auto-reconnect
      // User must manually refresh or the server will keep rejecting
      if (code === 4004) {
        console.error('[WebSocket] Server at capacity - stopping reconnection attempts');
        console.error('[WebSocket] Please wait a few moments and refresh the page');
        reconnectAttemptsRef.current = maxReconnectAttempts;  // Prevent further attempts
        return;
      }

      // Handle origin not allowed (4003) - DO NOT auto-reconnect
      if (code === 4003) {
        console.error('[WebSocket] Origin not allowed - stopping reconnection attempts');
        reconnectAttemptsRef.current = maxReconnectAttempts;  // Prevent further attempts
        return;
      }

      // Only reconnect for abnormal closures
      // Code 1000 = normal closure, 1001 = going away, 1006 = abnormal (no close frame)
      if (code !== 1000 && code !== 1001) {
        // Check max reconnect attempts BEFORE incrementing
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.warn('[WebSocket] Max reconnect attempts reached, stopping reconnection');
          return;
        }

        reconnectAttemptsRef.current++;

        // Exponential backoff: 5s, 15s, 30s
        const baseDelay = reconnectAttemptsRef.current === 1
          ? reconnectDelay
          : reconnectAttemptsRef.current === 2
            ? reconnectDelay * 3
            : reconnectDelay * 6;

        // Add random jitter (0-2 seconds) to prevent thundering herd
        const jitter = Math.random() * 2000;
        const delay = baseDelay + jitter;

        console.log(`[WebSocket] Scheduling reconnect in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        console.log('[WebSocket] Normal closure, not reconnecting');
      }
    };

    ws.onerror = () => {
      // Rate limit error logging to avoid spam
      const now = Date.now();
      const timeSinceLastError = now - lastErrorTimeRef.current;

      // Only log if it's been more than 5 seconds or it's a new error burst
      if (timeSinceLastError > 5000) {
        errorCountRef.current = 0;
      }

      lastErrorTimeRef.current = now;
      errorCountRef.current++;

      // Suppress error logging during expected reconnection scenarios
      if (errorCountRef.current <= 3 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        console.debug('[WebSocket] Connection error, will retry...');
      } else if (errorCountRef.current === 4) {
        console.warn('[WebSocket] Multiple connection errors, server may be unavailable');
      }
    };

    wsRef.current = ws;
  }, [options]);

  const disconnect = useCallback(() => {
    console.log('[WebSocket] Disconnecting...');
    
    // Prevent reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
      console.log('[WebSocket] Reconnect timeout cleared');
    }

    if (wsRef.current) {
      const readyState = wsRef.current.readyState;
      console.log('[WebSocket] Closing WebSocket, readyState:', readyState);
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }

    isConnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    errorCountRef.current = 0;
    console.log('[WebSocket] Disconnected');
  }, []);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Reset error tracking periodically
  useEffect(() => {
    const interval = setInterval(() => {
      errorCountRef.current = 0;
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log('[WebSocket] Hook mounted, connecting...');
    connect();

    return () => {
      console.log('[WebSocket] Hook unmounting, cleaning up...');
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: isConnectedRef.current,
    sendMessage,
    reconnect: connect,
    disconnect,
  };
}
