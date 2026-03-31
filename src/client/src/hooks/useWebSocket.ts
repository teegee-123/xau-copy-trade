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
  const optionsRef = useRef(options);

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
      console.error('Max WebSocket reconnect attempts reached');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log(`Connecting to WebSocket: ${wsUrl} (attempt ${reconnectAttemptsRef.current + 1})`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      isConnectedRef.current = true;
      reconnectAttemptsRef.current = 0; // Reset on successful connection
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
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
      isConnectedRef.current = false;
      optionsRef.current.onDisconnect?.();

      // Only reconnect if not explicitly disconnected and haven't exceeded max attempts
      if (wsRef.current !== null && event.code !== 1000) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Attempting to reconnect... (attempt ${reconnectAttemptsRef.current})`);
          connect();
        }, reconnectDelay);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
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
  }, []);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
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
