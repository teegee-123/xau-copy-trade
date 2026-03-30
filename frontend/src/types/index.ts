// TypeScript types for the trading system

export interface Trade {
  id: string;
  signal_message_id?: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  entry_price_min?: number;
  entry_price_max?: number;
  actual_entry_price?: number;
  entry_timestamp?: string;
  stop_loss?: number;
  take_profit?: number;
  take_profit_levels: number[];
  position_size: number;
  leverage: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  current_price?: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  close_reason?: string;
  realized_pnl?: number;
  source_channel?: string;
  raw_message?: string;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number;
  stop_loss?: number;
  take_profit?: number;
  position_size: number;
  realized_pnl: number;
  realized_pnl_percent: number;
  close_reason: string;
  entry_timestamp: string;
  close_timestamp: string;
  duration_seconds: number;
}

export interface BotStatus {
  is_running: boolean;
  is_paused: boolean;
  telegram: {
    connected: boolean;
    error?: string;
  };
  price_feed: {
    connected: boolean;
    error?: string;
  };
  uptime_status: string;
}

export interface WSMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface TradeSummary {
  active_trades: number;
  pending_trades: number;
  closed_trades: number;
  total_realized_pnl: number;
  total_unrealized_pnl: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
}
