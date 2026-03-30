import { useState, useEffect, useCallback, useRef } from 'react';
import { WSMessage, BotStatus, Trade, ClosedTrade } from '../types';

interface UseWebSocketOptions {
  onTradeUpdate?: (trade: Trade) => void;
  onTradeOpened?: (trade: Trade) => void;
  onTradeClosed?: (trade: ClosedTrade) => void;
  onBotStatus?: (status: BotStatus) => void;
  onConnectionStatus?: (status: { telegram: { connected: boolean; error?: string }; price_feed: { connected: boolean; error?: string } }) => void;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onTradeUpdate,
    onTradeOpened,
    onTradeClosed,
    onBotStatus,
    onConnectionStatus,
    reconnectInterval = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/trades`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Route message to appropriate handler
          switch (message.type) {
            case 'trade_update':
              if (onTradeUpdate && message.data.trade) {
                onTradeUpdate(message.data.trade as Trade);
              }
              break;
            case 'trade_opened':
              if (onTradeOpened && message.data.trade) {
                onTradeOpened(message.data.trade as Trade);
              }
              break;
            case 'trade_closed':
              if (onTradeClosed && message.data.trade) {
                onTradeClosed(message.data.trade as ClosedTrade);
              }
              break;
            case 'bot_status':
              if (onBotStatus) {
                onBotStatus(message.data as unknown as BotStatus);
              }
              break;
            case 'connection_status':
              if (onConnectionStatus) {
                onConnectionStatus(message.data as { telegram: { connected: boolean; error?: string }; price_feed: { connected: boolean; error?: string } });
              }
              break;
            case 'pong':
              // Heartbeat response received
              break;
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, reconnectInterval);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      
      // Attempt reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, reconnectInterval);
    }
  }, [onTradeUpdate, onTradeOpened, onTradeClosed, onBotStatus, onConnectionStatus, reconnectInterval]);

  const disconnect = useCallback(() => {
    // Clear intervals
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    reconnect: connect,
    disconnect,
  };
}

export default useWebSocket;
