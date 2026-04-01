import { tradeStore, StoredTrade } from './tradeStore.js';
import { priceFeedService } from './priceFeed.js';
import { ParsedSignal } from './telegram.js';
import logger from '../logger.js';
import { EventEmitter } from 'events';
import { configService } from './configService.js';

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
  trade: StoredTrade;
  type: 'OPENED' | 'CLOSED' | 'UPDATED' | 'SL_TP_UPDATED';
}

/**
 * Trade Manager Service
 * Uses in-memory tradeStore instead of SQLite
 */
export class TradeManagerService extends EventEmitter {
  private priceCheckInterval: NodeJS.Timeout | null = null;
  private faultCheckInterval: NodeJS.Timeout | null = null;
  private isTradingEnabled = TRADING_ENABLED;
  private currentLotSize: number;
  private currentSlTpTimeout: number;

  constructor() {
    super();
    const tradingConfig = configService.getTradingConfig();
    this.currentLotSize = tradingConfig.defaultLotSize;
    this.currentSlTpTimeout = tradingConfig.slTpTimeoutMinutes;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing trade manager (in-memory mode)');

    configService.on('tradingChange', (newConfig) => {
      this.currentLotSize = newConfig.defaultLotSize;
      this.currentSlTpTimeout = newConfig.slTpTimeoutMinutes;
      logger.info('Trading configuration updated', {
        lotSize: this.currentLotSize,
        slTpTimeout: this.currentSlTpTimeout
      });
    });

    // Listen to tradeStore events and forward them
    tradeStore.on('tradeCreated', (trade) => {
      this.emit('tradeUpdate', { trade, type: 'OPENED' } as TradeUpdate);
    });

    tradeStore.on('tradeUpdated', (trade) => {
      this.emit('tradeUpdate', { trade, type: 'UPDATED' } as TradeUpdate);
    });

    tradeStore.on('tradeClosed', (trade) => {
      this.emit('tradeUpdate', { trade, type: 'CLOSED' } as TradeUpdate);
    });

    this.startPriceMonitoring();
    this.startFaultChecking();

    logger.info('Trade manager initialization complete');
  }

  private startPriceMonitoring(): void {
    this.priceCheckInterval = setInterval(async () => {
      await this.checkOpenTrades();
    }, 500);
    logger.info('Price monitoring started (500ms interval)');
  }

  private startFaultChecking(): void {
    this.faultCheckInterval = setInterval(() => {
      this.checkAndAutoCloseFaultedTrades();
    }, 30000); // Check every 30 seconds
    logger.info('Auto-close checking started (3-minute timeout)');
  }

  stop(): void {
    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);
    if (this.faultCheckInterval) clearInterval(this.faultCheckInterval);
  }

  setTradingEnabled(enabled: boolean): void {
    this.isTradingEnabled = enabled;
    logger.info(`Trading ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('tradingStatusChange', { enabled });
  }

  isTradingEnabledStatus(): boolean {
    return this.isTradingEnabled;
  }

  async processSignal(signal: ParsedSignal): Promise<StoredTrade | null> {
    logger.info('[TRADE_MANAGER] 📩 SIGNAL RECEIVED', {
      symbol: signal.symbol,
      action: signal.action,
      maxEntryPrice: signal.maxEntryPrice,
      messageId: signal.messageId,
      rawMessage: signal.rawMessage.substring(0, 50) + (signal.rawMessage.length > 50 ? '...' : ''),
    });

    addSignalHistory({ stage: 'received', signal });

    if (!this.isTradingEnabled) {
      logger.warn('[TRADE_MANAGER] ⏸️ Trading is disabled, ignoring signal');
      addSignalHistory({ stage: 'processed', signal, error: 'Trading disabled' });
      return null;
    }

    logger.info('[TRADE_MANAGER] ⚙️ Processing signal', { signal });

    try {
      const existingTrade = this.findTradeByMessageId(signal.messageId);

      if (existingTrade) {
        logger.info('[TRADE_MANAGER] 🔄 Found existing trade for SL/TP update', {
          tradeId: existingTrade.id,
          messageId: signal.messageId,
        });
        const result = this.updateTradeSLTP(existingTrade.id, signal);
        if (result) {
          addSignalHistory({ stage: 'processed', signal, tradeId: result.id });
        }
        return result;
      }

      logger.info('[TRADE_MANAGER] 🔍 No existing trade found, checking for new entry');

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

  private async openTrade(signal: ParsedSignal): Promise<StoredTrade | null> {
    const currentPriceData = priceFeedService.getCurrentPrice();

    if (!currentPriceData) {
      logger.warn('No price data available, cannot open trade');
      return null;
    }

    const currentPrice = currentPriceData.price;
    const symbol = signal.symbol || DEFAULT_SYMBOL;
    const lotSize = this.currentLotSize;

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

    const trade = tradeStore.create({
      symbol,
      action: signal.action,
      entryPrice: currentPrice,
      stopLoss: signal.stopLoss || null,
      takeProfit: signal.takeProfit || null,
      lotSize,
      telegramMessageId: signal.messageId,
    });

    logger.info('Trade opened', {
      tradeId: trade.id,
      symbol: trade.symbol,
      action: trade.action,
      entryPrice: trade.entryPrice,
      sl: trade.stopLoss,
      tp: trade.takeProfit,
      lotSize,
    });

    return trade;
  }

  private updateTradeSLTP(tradeId: number, signal: ParsedSignal): StoredTrade | null {
    const trade = tradeStore.getById(tradeId);

    if (!trade || trade.status === 'CLOSED') {
      logger.warn('Cannot update SL/TP - trade not found or closed', { tradeId });
      return null;
    }

    const updates: Partial<StoredTrade> = {};

    if (signal.stopLoss !== undefined) {
      updates.stopLoss = signal.stopLoss;
    }

    if (signal.takeProfit !== undefined) {
      updates.takeProfit = signal.takeProfit;
    }

    if ((trade.status === 'PENDING_SL_TP' || trade.status === 'OPEN') && updates.stopLoss && updates.takeProfit) {
      updates.status = 'OPEN';
    }

    const updatedTrade = tradeStore.update(tradeId, updates);

    if (updatedTrade) {
      logger.info('Trade SL/TP updated', {
        tradeId,
        sl: updatedTrade.stopLoss,
        tp: updatedTrade.takeProfit
      });

      this.emit('tradeUpdate', { trade: updatedTrade, type: 'SL_TP_UPDATED' } as TradeUpdate);
    }

    return updatedTrade;
  }

  private findTradeByMessageId(messageId: number): StoredTrade | null {
    const openTrades = tradeStore.getAllOpen();
    for (const trade of openTrades) {
      if (trade.telegramMessageId === messageId) {
        return trade;
      }
    }
    return null;
  }

  private async checkOpenTrades(): Promise<void> {
    const currentPriceData = priceFeedService.getCurrentPrice();
    if (!currentPriceData) return;

    const currentPrice = currentPriceData.price;
    const openTrades = tradeStore.getAllOpen();

    for (const trade of openTrades) {
      if (trade.status === 'CLOSED') continue;

      const pnlData = this.calculatePnL(trade, currentPrice);
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
        await this.closeTradeInternal(trade.id, currentPrice, exitReason, pnlData.pnlUsd, pnlData.pnlPercent);
      } else {
        tradeStore.update(trade.id, {
          pnlUsd: pnlData.pnlUsd,
          pnlPercent: pnlData.pnlPercent,
        });
      }
    }
  }

  private async checkAndAutoCloseFaultedTrades(): Promise<void> {
    const faultedTrades = tradeStore.getFaultedTrades(this.currentSlTpTimeout);

    for (const trade of faultedTrades) {
      try {
        const ageInMinutes = (Date.now() - trade.createdAt) / 1000 / 60;
        
        logger.warn('[AUTO-CLOSE] Trade missing SL/TP for 3+ minutes, auto-closing', {
          tradeId: trade.id,
          symbol: trade.symbol,
          action: trade.action,
          entryPrice: trade.entryPrice,
          ageMinutes: ageInMinutes.toFixed(2),
          timeoutMinutes: this.currentSlTpTimeout,
        });

        await this.closeTradeInternal(
          trade.id,
          trade.entryPrice,
          'SL_TP_TIMEOUT',
          0,
          0
        );
      } catch (error) {
        logger.error('[AUTO-CLOSE] Failed to close faulted trade', {
          tradeId: trade.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  async closeTrade(tradeId: number, reason: string = 'MANUAL_CLOSE'): Promise<StoredTrade | null> {
    const trade = tradeStore.getById(tradeId);
    if (!trade || trade.status === 'CLOSED') {
      logger.warn('Cannot close trade - not found or already closed', { tradeId });
      return null;
    }

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
  ): Promise<StoredTrade> {
    const closedTrade = tradeStore.close(tradeId, {
      exitPrice,
      exitReason,
      pnlUsd,
      pnlPercent,
    });

    if (!closedTrade) {
      throw new Error('Failed to close trade');
    }

    logger.info('Trade closed', {
      tradeId,
      exitPrice,
      exitReason,
      pnlUsd,
      pnlPercent
    });

    return closedTrade;
  }

  async closeAllFaultedTrades(): Promise<{ closed: number; failed: number }> {
    const faultedTrades = tradeStore.getFaultedTrades(this.currentSlTpTimeout);
    let closed = 0;
    let failed = 0;

    for (const trade of faultedTrades) {
      try {
        logger.info('[MANUAL AUTO-CLOSE] Closing trade missing SL/TP', {
          tradeId: trade.id,
          symbol: trade.symbol,
        });

        await this.closeTradeInternal(trade.id, trade.entryPrice, 'SL_TP_TIMEOUT', 0, 0);
        closed++;
      } catch (error) {
        logger.error('[MANUAL AUTO-CLOSE] Failed to close faulted trade', {
          tradeId: trade.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    return { closed, failed };
  }

  private calculatePnL(trade: StoredTrade, currentPrice: number): { pnlUsd: number; pnlPercent: number } {
    const priceDiff = currentPrice - trade.entryPrice;
    const contractSize = 100;
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

  getOpenTrades(): StoredTrade[] {
    return tradeStore.getAllOpen();
  }

  getClosedTrades(): StoredTrade[] {
    return tradeStore.getClosed();
  }

  getPnLSummary(): { totalPnlUsd: number; totalPnlPercent: number; todayPnlUsd: number } {
    const closedTrades = tradeStore.getClosed();
    const totalPnlUsd = closedTrades.reduce((sum, t) => sum + (t.pnlUsd || 0), 0);
    // Simplified - doesn't track today separately
    return { totalPnlUsd, totalPnlPercent: 0, todayPnlUsd: totalPnlUsd };
  }

  getActiveTradesCount(): number {
    return tradeStore.getAllOpen().length;
  }
}

export const tradeManagerService = new TradeManagerService();
