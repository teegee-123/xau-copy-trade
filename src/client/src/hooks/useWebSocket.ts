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
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;
  const initialReconnectDelay = 2000; // Longer initial delay after auth
  const optionsRef = useRef(options);
  const lastErrorTimeRef = useRef<number>(0);
  const errorCountRef = useRef(0);

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
      console.log(`[WebSocket] Disconnected (code: ${event.code}, reason: ${reason})`);
      isConnectedRef.current = false;
      optionsRef.current.onDisconnect?.();

      // Only reconnect if not explicitly disconnected and haven't exceeded max attempts
      // Code 1000 = normal closure, 1001 = going away
      if (wsRef.current !== null && event.code !== 1000 && event.code !== 1001) {
        reconnectAttemptsRef.current++;
        const delay = reconnectAttemptsRef.current === 1 
          ? initialReconnectDelay 
          : reconnectDelay * Math.min(reconnectAttemptsRef.current, 5);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`[WebSocket] Reconnecting... (attempt ${reconnectAttemptsRef.current})`);
          connect();
        }, delay);
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
      // (e.g., server restart, Render sleep, post-auth reconnection)
      if (errorCountRef.current <= 3 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        // Silent - expected reconnection
        console.debug('[WebSocket] Connection error, will retry...');
      } else if (errorCountRef.current === 4) {
        // Log once after several silent failures
        console.warn('[WebSocket] Multiple connection errors, server may be unavailable');
      }
      // Subsequent errors are silent until reset
    };

    wsRef.current = ws;
  }, [options]);

  const disconnect = useCallback(() => {
    // Prevent reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }

    isConnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    errorCountRef.current = 0;
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
    connect();

    return () => {
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
