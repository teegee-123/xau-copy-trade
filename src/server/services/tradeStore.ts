import { EventEmitter } from 'events';
import logger from '../logger.js';

export interface StoredTrade {
  id: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING_SL_TP';
  pnlUsd: number | null;
  pnlPercent: number | null;
  exitPrice: number | null;
  exitReason: string | null;
  telegramMessageId: number;
  createdAt: number; // timestamp in milliseconds
  updatedAt: number;
  closedAt: number | null;
}

export interface TradeCreateData {
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number;
  telegramMessageId: number;
}

export interface TradeUpdateData {
  stopLoss?: number | null;
  takeProfit?: number | null;
  status?: 'OPEN' | 'CLOSED' | 'PENDING_SL_TP';
  pnlUsd?: number | null;
  pnlPercent?: number | null;
}

export interface TradeCloseData {
  exitPrice: number;
  exitReason: string;
  pnlUsd: number;
  pnlPercent: number;
}

/**
 * In-Memory Trade Store
 * Replaces SQLite for open trade management
 * Trades are lost on server restart
 */
class TradeStore extends EventEmitter {
  private trades: Map<number, StoredTrade> = new Map();
  private closedTrades: StoredTrade[] = [];
  private nextId = 1;

  /**
   * Create a new trade
   */
  create(data: TradeCreateData): StoredTrade {
    const trade: StoredTrade = {
      id: this.nextId++,
      symbol: data.symbol,
      action: data.action,
      entryPrice: data.entryPrice,
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit,
      lotSize: data.lotSize,
      status: data.stopLoss && data.takeProfit ? 'OPEN' : 'PENDING_SL_TP',
      pnlUsd: 0,
      pnlPercent: 0,
      exitPrice: null,
      exitReason: null,
      telegramMessageId: data.telegramMessageId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
    };

    this.trades.set(trade.id, trade);
    logger.info('[TradeStore] Trade created', {
      id: trade.id,
      symbol: trade.symbol,
      action: trade.action,
      entryPrice: trade.entryPrice,
    });

    this.emit('tradeCreated', trade);
    return trade;
  }

  /**
   * Get trade by ID
   */
  getById(id: number): StoredTrade | null {
    return this.trades.get(id) || null;
  }

  /**
   * Get all open trades
   */
  getAllOpen(): StoredTrade[] {
    return Array.from(this.trades.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get all closed trades (for history)
   */
  getClosed(): StoredTrade[] {
    return [...this.closedTrades].sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
  }

  /**
   * Update trade
   */
  update(id: number, updates: TradeUpdateData): StoredTrade | null {
    const trade = this.trades.get(id);
    if (!trade) {
      logger.warn('[TradeStore] Trade not found for update', { id });
      return null;
    }

    const updatedTrade: StoredTrade = {
      ...trade,
      ...updates,
      updatedAt: Date.now(),
    };

    this.trades.set(id, updatedTrade);
    logger.debug('[TradeStore] Trade updated', {
      id,
      ...updates,
    });

    this.emit('tradeUpdated', updatedTrade);
    return updatedTrade;
  }

  /**
   * Close a trade
   */
  close(id: number, data: TradeCloseData): StoredTrade | null {
    const trade = this.trades.get(id);
    if (!trade) {
      logger.warn('[TradeStore] Trade not found for close', { id });
      return null;
    }

    const closedTrade: StoredTrade = {
      ...trade,
      exitPrice: data.exitPrice,
      exitReason: data.exitReason,
      pnlUsd: data.pnlUsd,
      pnlPercent: data.pnlPercent,
      status: 'CLOSED',
      closedAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.trades.delete(id);
    this.closedTrades.push(closedTrade);

    // Keep only last 100 closed trades in memory
    if (this.closedTrades.length > 100) {
      this.closedTrades.shift();
    }

    logger.info('[TradeStore] Trade closed', {
      id,
      exitPrice: data.exitPrice,
      exitReason: data.exitReason,
      pnlUsd: data.pnlUsd,
    });

    this.emit('tradeClosed', closedTrade);
    return closedTrade;
  }

  /**
   * Delete a trade (for cleanup)
   */
  delete(id: number): boolean {
    const deleted = this.trades.delete(id);
    if (deleted) {
      logger.debug('[TradeStore] Trade deleted', { id });
      this.emit('tradeDeleted', id);
    }
    return deleted;
  }

  /**
   * Get trades missing SL/TP older than timeoutMinutes
   */
  getFaultedTrades(timeoutMinutes: number): StoredTrade[] {
    const now = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    return this.getAllOpen().filter(trade =>
      (trade.status === 'OPEN' || trade.status === 'PENDING_SL_TP') &&
      (!trade.stopLoss || !trade.takeProfit) &&
      (now - trade.createdAt) >= timeoutMs
    );
  }

  /**
   * Get trade age in seconds
   */
  getTradeAgeInSeconds(id: number): number {
    const trade = this.trades.get(id);
    if (!trade) return 0;
    return Math.floor((Date.now() - trade.createdAt) / 1000);
  }

  /**
   * Get stats
   */
  getStats() {
    const openTrades = this.getAllOpen();
    const openWithSlTp = openTrades.filter(t => t.stopLoss && t.takeProfit).length;
    const openWithoutSlTp = openTrades.filter(t => !t.stopLoss || !t.takeProfit).length;

    return {
      totalOpen: openTrades.length,
      openWithSlTp,
      openWithoutSlTp,
      totalClosed: this.closedTrades.length,
    };
  }

  /**
   * Clear all trades (for testing)
   */
  clear(): void {
    this.trades.clear();
    this.closedTrades = [];
    this.nextId = 1;
    logger.info('[TradeStore] All trades cleared');
  }
}

export const tradeStore = new TradeStore();
