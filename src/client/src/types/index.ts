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
  type: 'INIT' | 'PRICE_UPDATE' | 'TRADE_UPDATE' | 'STATUS_CHANGE' | 'CONFIG_UPDATE';
  data: unknown;
}

export type EquityChartRange = '1D' | '1W' | '1M' | 'ALL';

// Configuration types
export interface ExtractionRule {
  group: number;
  transform: string;
  mapping?: Record<string, string>;
  description?: string;
  note?: string;
}

export interface SignalTemplate {
  description: string;
  pattern: string;
  flags: string;
  extractionRules: Record<string, ExtractionRule>;
  examples: Array<{
    message: string;
    extracted: Record<string, unknown>;
  }>;
}

export interface ChannelConfig {
  channelId: string;
  channelName: string;
}

export interface TradingConfig {
  defaultLotSize: number;
  slTpTimeoutMinutes: number;
}

export interface PriceFeedConfig {
  pollingIntervalMs: number;
}

export interface AppConfig {
  channel: ChannelConfig;
  entrySignalTemplate: SignalTemplate;
  sltpSignalTemplate: SignalTemplate;
  trading: TradingConfig;
  priceFeed: PriceFeedConfig;
}

export interface TemplateTestResult {
  matched: boolean;
  extracted: Record<string, unknown> | null;
  error?: string;
}

export interface HistoricalMessage {
  id: number;
  messageId: number | null;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  createdAt: string;
}
