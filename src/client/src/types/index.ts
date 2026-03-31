export interface Trade {
  id: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING_SL_TP' | 'FAULTED';
  pnlUsd: number | null;
  pnlPercent: number | null;
  exitPrice: number | null;
  exitReason: string | null;
  telegramMessageId: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface PriceData {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  timestamp: string;
  source: string;
}

export interface TelegramStatus {
  connected: boolean;
  authenticated: boolean;
  phoneNumber?: string;
  channelId?: string;
  error?: string;
}

export interface PriceStatus {
  connected: boolean;
  lastPrice: number | null;
  lastUpdate: string | null;
  error?: string;
  source: string;
}

export interface SystemStatus {
  telegram: TelegramStatus;
  price: PriceStatus;
  trading: {
    enabled: boolean;
    activeTrades: number;
  };
  overall: 'healthy' | 'degraded';
}

export interface EquitySnapshot {
  id: number;
  totalEquity: number;
  totalPnl: number;
  timestamp: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface TradeUpdate {
  trade: Trade;
  type: 'OPENED' | 'CLOSED' | 'UPDATED' | 'SL_TP_UPDATED';
}

export interface WebSocketMessage {
  type: 'INIT' | 'PRICE_UPDATE' | 'TRADE_UPDATE' | 'STATUS_CHANGE';
  data: unknown;
}

export type EquityChartRange = '1D' | '1W' | '1M' | 'ALL';
