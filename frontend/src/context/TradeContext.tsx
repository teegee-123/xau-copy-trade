import React, { createContext, useContext, ReactNode } from 'react';
import { Trade, ClosedTrade, TradeSummary, BotStatus } from '../types';
import { useTrades } from '../hooks/useTrades';
import { useWebSocket } from '../hooks/useWebSocket';

interface TradeContextType {
  activeTrades: Trade[];
  pendingTrades: Trade[];
  closedTrades: ClosedTrade[];
  summary: TradeSummary | null;
  botStatus: BotStatus | null;
  connectionStatus: {
    telegram: { connected: boolean; error?: string };
    price_feed: { connected: boolean; error?: string };
  } | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isWebSocketConnected: boolean;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

interface TradeProviderProps {
  children: ReactNode;
}

export function TradeProvider({ children }: TradeProviderProps) {
  const {
    activeTrades,
    pendingTrades,
    closedTrades,
    summary,
    isLoading,
    error,
    refresh,
    updateTrade,
    addTrade,
    addClosedTrade,
  } = useTrades();

  const [botStatus, setBotStatus] = React.useState<BotStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<{
    telegram: { connected: boolean; error?: string };
    price_feed: { connected: boolean; error?: string };
  } | null>(null);

  const { isConnected: isWebSocketConnected } = useWebSocket({
    onTradeUpdate: updateTrade,
    onTradeOpened: addTrade,
    onTradeClosed: addClosedTrade,
    onBotStatus: setBotStatus,
    onConnectionStatus: setConnectionStatus,
  });

  const value: TradeContextType = {
    activeTrades,
    pendingTrades,
    closedTrades,
    summary,
    botStatus,
    connectionStatus,
    isLoading,
    error,
    refresh,
    isWebSocketConnected,
  };

  return (
    <TradeContext.Provider value={value}>
      {children}
    </TradeContext.Provider>
  );
}

export function useTradeContext() {
  const context = useContext(TradeContext);
  if (context === undefined) {
    throw new Error('useTradeContext must be used within a TradeProvider');
  }
  return context;
}

export default TradeContext;
