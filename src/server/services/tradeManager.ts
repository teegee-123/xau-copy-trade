import { db, Trade } from './database.js';
import { priceFeedService } from './priceFeed.js';
import { ParsedSignal } from './telegram.js';
import logger from '../logger.js';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { configService } from './configService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const DEFAULT_SYMBOL = process.env.DEFAULT_SYMBOL || 'XAUUSD';
const TRADING_ENABLED = process.env.TRADING_ENABLED !== 'false';

// Signal history for debugging (last 50 signals)
interface SignalHistoryEntry {
  timestamp: string;
  stage: 'received' | 'parsed' | 'processed' | 'error';
  signal?: ParsedSignal;
  tradeId?: number;
  error?: string;
}

interface SignalHistoryInput {
  stage: SignalHistoryEntry['stage'];
  signal?: ParsedSignal;
  tradeId?: number;
  error?: string;
}

const signalHistory: SignalHistoryEntry[] = [];

function addSignalHistory(input: SignalHistoryInput): void {
  signalHistory.push({
    ...input,
    timestamp: new Date().toISOString(),
  });
  // Keep last 50 entries
  if (signalHistory.length > 50) {
    signalHistory.shift();
  }
}

export function getSignalHistory(): SignalHistoryEntry[] {
  return [...signalHistory];
}

export function clearSignalHistory(): void {
  signalHistory.length = 0;
}

export interface TradeUpdate {
  trade: Trade;
  type: 'OPENED' | 'CLOSED' | 'UPDATED' | 'SL_TP_UPDATED';
}

/**
 * Trade Manager Service
 * 
 * Handles:
 * - Trade entry with price validation
 * - SL/TP updates from edited messages
 * - Position monitoring and auto-exit
 * - P&L calculations
 * - Faulted trade detection (missing SL/TP after timeout)
 */
export class TradeManagerService extends EventEmitter {
  private activeTrades: Map<number, Trade> = new Map();
  private priceCheckInterval: NodeJS.Timeout | null = null;
  private faultCheckInterval: NodeJS.Timeout | null = null;
  private isTradingEnabled = TRADING_ENABLED;
  private currentLotSize: number;
  private currentSlTpTimeout: number;

  constructor() {
    super();
    // Get initial config values
    const tradingConfig = configService.getTradingConfig();
    this.currentLotSize = tradingConfig.defaultLotSize;
    this.currentSlTpTimeout = tradingConfig.slTpTimeoutMinutes;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing trade manager');

    // Listen for config changes
    configService.on('tradingChange', (newConfig) => {
      this.currentLotSize = newConfig.defaultLotSize;
      this.currentSlTpTimeout = newConfig.slTpTimeoutMinutes;
      logger.info('Trading configuration updated', {
        lotSize: this.currentLotSize,
        slTpTimeout: this.currentSlTpTimeout
      });
    });

    // Load existing open trades from database
    const openTrades = db.getOpenTrades();
    openTrades.forEach(trade => {
      this.activeTrades.set(trade.id, trade);
    });

    logger.info(`Loaded ${openTrades.length} active trades from database`);

    // Start price monitoring for SL/TP checks
    this.startPriceMonitoring();

    // Start faulted trade checker
    this.startFaultChecking();

    logger.info('Trade manager initialization complete');
  }

  private startPriceMonitoring(): void {
    // Check prices every 500ms for faster SL/TP detection
    this.priceCheckInterval = setInterval(async () => {
      await this.checkOpenTrades();
    }, 500);

    logger.info('Price monitoring started');
  }

  private startFaultChecking(): void {
    // Check for faulted trades every minute
    this.faultCheckInterval = setInterval(() => {
      this.checkFaultedTrades();
    }, 60000);

    logger.info('Fault checking started');
  }

  stop(): void {
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
    }
    if (this.faultCheckInterval) {
      clearInterval(this.faultCheckInterval);
    }
  }

  setTradingEnabled(enabled: boolean): void {
    this.isTradingEnabled = enabled;
    logger.info(`Trading ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('tradingStatusChange', { enabled });
  }

  isTradingEnabledStatus(): boolean {
    return this.isTradingEnabled;
  }

  /**
   * Process a signal from Telegram
   */
  async processSignal(signal: ParsedSignal): Promise<Trade | null> {
    // Log signal receipt
    logger.info('[TRADE_MANAGER] 📩 SIGNAL RECEIVED', {
      symbol: signal.symbol,
      action: signal.action,
      maxEntryPrice: signal.maxEntryPrice,
      messageId: signal.messageId,
      isEdit: signal.isEdit,
      rawMessage: signal.rawMessage.substring(0, 50) + (signal.rawMessage.length > 50 ? '...' : ''),
    });

    // Add to signal history
    addSignalHistory({ stage: 'received', signal });

    if (!this.isTradingEnabled) {
      logger.warn('[TRADE_MANAGER] ⏸️  Trading is disabled, ignoring signal');
      addSignalHistory({ stage: 'processed', signal, error: 'Trading disabled' });
      return null;
    }

    logger.info('[TRADE_MANAGER] ⚙️ Processing signal', { signal });

    try {
      // Check if this is an SL/TP update for an existing trade
      const existingTrade = this.findTradeByMessageId(signal.messageId);

      if (existingTrade) {
        logger.info('[TRADE_MANAGER] 🔄 Found existing trade for SL/TP update', {
          tradeId: existingTrade.id,
          messageId: signal.messageId,
        });
        // Update SL/TP for existing trade
        const result = this.updateTradeSLTP(existingTrade.id, signal);
        if (result) {
          addSignalHistory({ stage: 'processed', signal, tradeId: result.id });
        }
        return result;
      }

      logger.info('[TRADE_MANAGER] 🔍 No existing trade found, checking for new entry');

      // Check if this is a new entry signal
      if (signal.action && (signal.maxEntryPrice !== undefined || signal.entryPrice !== undefined)) {
        logger.info('[TRADE_MANAGER] 📈 Opening new trade from entry signal');
        const result = await this.openTrade(signal);
        if (result) {
          addSignalHistory({ stage: 'processed', signal, tradeId: result.id });
        }
        return result;
      }

      logger.warn('[TRADE_MANAGER] ⚠️ Signal does not match any trade action', { signal });
      addSignalHistory({ stage: 'processed', signal, error: 'No matching action' });
      return null;
    } catch (error) {
      logger.error('[TRADE_MANAGER] ❌ Error processing signal', { error, signal });
      addSignalHistory({ stage: 'error', signal, error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Open a new trade based on signal
   */
  private async openTrade(signal: ParsedSignal): Promise<Trade | null> {
    const currentPriceData = priceFeedService.getCurrentPrice();

    if (!currentPriceData) {
      logger.warn('No price data available, cannot open trade');
      return null;
    }

    const currentPrice = currentPriceData.price;
    const entryPrice = signal.entryPrice || signal.maxEntryPrice!;
    const symbol = signal.symbol || DEFAULT_SYMBOL;
    const lotSize = this.currentLotSize;

    // Validate entry price
    if (signal.maxEntryPrice) {
      if (signal.action === 'BUY' && currentPrice > signal.maxEntryPrice) {
        logger.warn('BUY signal rejected: current price exceeds max entry', {
          currentPrice,
          maxEntryPrice: signal.maxEntryPrice,
        });
        return null;
      }
      if (signal.action === 'SELL' && currentPrice < signal.maxEntryPrice) {
        logger.warn('SELL signal rejected: current price below min entry', {
          currentPrice,
          minEntryPrice: signal.maxEntryPrice,
        });
        return null;
      }
    }

    // Create trade
    const trade = db.createTrade({
      symbol,
      action: signal.action,
      entryPrice: currentPrice, // Use actual current price as entry
      stopLoss: signal.stopLoss || null,
      takeProfit: signal.takeProfit || null,
      lotSize,
      status: signal.stopLoss && signal.takeProfit ? 'OPEN' : 'PENDING_SL_TP',
      telegramMessageId: signal.messageId,
    });

    this.activeTrades.set(trade.id, trade);

    logger.info('Trade opened', {
      tradeId: trade.id,
      symbol: trade.symbol,
      action: trade.action,
      entryPrice: trade.entryPrice,
      sl: trade.stopLoss,
      tp: trade.takeProfit,
      lotSize,
    });

    this.emit('tradeUpdate', { trade, type: 'OPENED' } as TradeUpdate);
    return trade;
  }

  /**
   * Update SL/TP for an existing trade
   */
  private updateTradeSLTP(tradeId: number, signal: ParsedSignal): Trade | null {
    const trade = db.getTradeById(tradeId);
    
    if (!trade || trade.status === 'CLOSED') {
      logger.warn('Cannot update SL/TP - trade not found or closed', { tradeId });
      return null;
    }

    const updates: Partial<Trade> = {};
    
    if (signal.stopLoss !== undefined) {
      updates.stopLoss = signal.stopLoss;
    }
    
    if (signal.takeProfit !== undefined) {
      updates.takeProfit = signal.takeProfit;
    }

    // Update status if we now have both SL and TP
    if (trade.status === 'PENDING_SL_TP' && updates.stopLoss && updates.takeProfit) {
      updates.status = 'OPEN';
    }

    const updatedTrade = db.updateTrade(tradeId, updates);
    this.activeTrades.set(tradeId, updatedTrade);

    logger.info('Trade SL/TP updated', { 
      tradeId, 
      sl: updatedTrade.stopLoss, 
      tp: updatedTrade.takeProfit 
    });

    this.emit('tradeUpdate', { trade: updatedTrade, type: 'SL_TP_UPDATED' } as TradeUpdate);
    return updatedTrade;
  }

  /**
   * Find trade by Telegram message ID
   */
  private findTradeByMessageId(messageId: number): Trade | null {
    for (const trade of this.activeTrades.values()) {
      if (trade.telegramMessageId === messageId && trade.status !== 'CLOSED') {
        return trade;
      }
    }
    return null;
  }

  /**
   * Check all open trades against current price
   */
  private async checkOpenTrades(): Promise<void> {
    const currentPriceData = priceFeedService.getCurrentPrice();
    
    if (!currentPriceData) {
      return;
    }

    const currentPrice = currentPriceData.price;

    for (const [tradeId, trade] of this.activeTrades.entries()) {
      if (trade.status === 'CLOSED') {
        continue;
      }

      // Update current P&L
      const pnlData = this.calculatePnL(trade, currentPrice);
      
      // Check for SL/TP hit
      let shouldClose = false;
      let exitReason = '';

      if (trade.action === 'BUY') {
        if (trade.stopLoss && currentPrice <= trade.stopLoss) {
          shouldClose = true;
          exitReason = 'SL_HIT';
        } else if (trade.takeProfit && currentPrice >= trade.takeProfit) {
          shouldClose = true;
          exitReason = 'TP_HIT';
        }
      } else if (trade.action === 'SELL') {
        if (trade.stopLoss && currentPrice >= trade.stopLoss) {
          shouldClose = true;
          exitReason = 'SL_HIT';
        } else if (trade.takeProfit && currentPrice <= trade.takeProfit) {
          shouldClose = true;
          exitReason = 'TP_HIT';
        }
      }

      if (shouldClose && exitReason) {
        await this.closeTradeInternal(tradeId, currentPrice, exitReason, pnlData.pnlUsd, pnlData.pnlPercent);
      } else {
        // Update P&L without closing
        const updatedTrade = db.updateTrade(tradeId, {
          pnlUsd: pnlData.pnlUsd,
          pnlPercent: pnlData.pnlPercent,
        });
        this.activeTrades.set(tradeId, updatedTrade);
        
        // Emit update for real-time dashboard
        this.emit('tradeUpdate', { trade: updatedTrade, type: 'UPDATED' } as TradeUpdate);
      }
    }
  }

  /**
   * Check for faulted trades (missing SL/TP after timeout)
   */
  private checkFaultedTrades(): void {
    const faultedTrades = db.getFaultedTrades(this.currentSlTpTimeout);
    
    faultedTrades.forEach(trade => {
      if (trade.status !== 'FAULTED') {
        db.updateTrade(trade.id, { status: 'FAULTED' });
        const updatedTrade = db.getTradeById(trade.id);
        this.activeTrades.set(trade.id, updatedTrade);
        
        logger.warn('Trade marked as faulted (missing SL/TP)', { 
          tradeId: trade.id,
          age: new Date().getTime() - new Date(trade.createdAt).getTime(),
        });
        
        this.emit('tradeUpdate', { trade: updatedTrade, type: 'UPDATED' } as TradeUpdate);
      }
    });
  }

  /**
   * Close a trade manually or automatically
   */
  async closeTrade(tradeId: number, reason: string = 'MANUAL_CLOSE'): Promise<Trade | null> {
    const trade = db.getTradeById(tradeId);
    
    if (!trade || trade.status === 'CLOSED') {
      logger.warn('Cannot close trade - not found or already closed', { tradeId });
      return null;
    }

    // Use current price or last known price
    const currentPriceData = priceFeedService.getCurrentPrice();
    const exitPrice = currentPriceData?.price || trade.entryPrice;
    
    const pnlData = this.calculatePnL(trade, exitPrice);

    return this.closeTradeInternal(tradeId, exitPrice, reason, pnlData.pnlUsd, pnlData.pnlPercent);
  }

  private async closeTradeInternal(
    tradeId: number, 
    exitPrice: number, 
    exitReason: string, 
    pnlUsd: number, 
    pnlPercent: number
  ): Promise<Trade> {
    const closedTrade = db.closeTrade(tradeId, exitPrice, exitReason, pnlUsd, pnlPercent);
    this.activeTrades.delete(tradeId);

    logger.info('Trade closed', { 
      tradeId, 
      exitPrice, 
      exitReason, 
      pnlUsd, 
      pnlPercent 
    });

    this.emit('tradeUpdate', { trade: closedTrade, type: 'CLOSED' } as TradeUpdate);
    return closedTrade;
  }

  /**
   * Close all faulted trades
   */
  async closeAllFaultedTrades(): Promise<{ closed: number; failed: number }> {
    const faultedTrades = db.getFaultedTrades(this.currentSlTpTimeout);
    let closed = 0;
    let failed = 0;

    for (const trade of faultedTrades) {
      try {
        await this.closeTrade(trade.id, 'FAULT_TIMEOUT');
        closed++;
      } catch (error) {
        logger.error('Failed to close faulted trade', { tradeId: trade.id, error });
        failed++;
      }
    }

    return { closed, failed };
  }

  /**
   * Calculate P&L for a trade
   * 
   * P&L formula for XAU/USD:
   * P&L = (currentPrice - entryPrice) * lotSize * 100 (for BUY)
   * P&L = (entryPrice - currentPrice) * lotSize * 100 (for SELL)
   */
  private calculatePnL(trade: Trade, currentPrice: number): { pnlUsd: number; pnlPercent: number } {
    const priceDiff = currentPrice - trade.entryPrice;
    const contractSize = 100; // Standard XAU/USD contract size (1 lot = 100 oz)
    
    let pnlUsd: number;
    
    if (trade.action === 'BUY') {
      pnlUsd = priceDiff * trade.lotSize * contractSize;
    } else {
      pnlUsd = -priceDiff * trade.lotSize * contractSize;
    }

    const pnlPercent = (pnlUsd / (trade.entryPrice * trade.lotSize * contractSize)) * 100;

    return {
      pnlUsd: Math.round(pnlUsd * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
    };
  }

  /**
   * Get all open trades with current P&L
   */
  getOpenTrades(): Trade[] {
    return db.getOpenTrades();
  }

  /**
   * Get trade history
   */
  getTradeHistory(filters?: { from?: string; to?: string; symbol?: string; action?: string }): Trade[] {
    return db.getClosedTrades(filters);
  }

  /**
   * Get P&L summary
   */
  getPnLSummary(): { totalPnlUsd: number; totalPnlPercent: number; todayPnlUsd: number } {
    return db.getTotalPnL();
  }

  /**
   * Get active trades count
   */
  getActiveTradesCount(): number {
    return this.activeTrades.size;
  }
}

export const tradeManagerService = new TradeManagerService();
