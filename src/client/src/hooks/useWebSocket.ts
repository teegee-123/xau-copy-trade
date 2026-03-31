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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      isConnectedRef.current = true;
      options.onConnect?.();
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
              options.onPriceUpdate?.(initData.currentPrice);
            }
            break;

          case 'PRICE_UPDATE':
            options.onPriceUpdate?.(message.data as PriceData);
            break;

          case 'TRADE_UPDATE':
            options.onTradeUpdate?.(message.data as TradeUpdate);
            break;

          case 'STATUS_CHANGE':
            // Status changes are handled via polling for simplicity
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      isConnectedRef.current = false;
      options.onDisconnect?.();
      
      // Attempt reconnection
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    isConnectedRef.current = false;
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
