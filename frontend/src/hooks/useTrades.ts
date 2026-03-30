import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Trade, ClosedTrade, TradeSummary } from '../types';

interface UseTradesResult {
  activeTrades: Trade[];
  pendingTrades: Trade[];
  closedTrades: ClosedTrade[];
  summary: TradeSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateTrade: (trade: Trade) => void;
  addTrade: (trade: Trade) => void;
  removeTrade: (tradeId: string) => void;
  addClosedTrade: (trade: ClosedTrade) => void;
}

export function useTrades(): UseTradesResult {
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [pendingTrades, setPendingTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [summary, setSummary] = useState<TradeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      const [activeRes, pendingRes, historyRes, summaryRes] = await Promise.all([
        api.getActiveTrades(),
        api.getPendingTrades(),
        api.getTradeHistory(50),
        api.getSummary(),
      ]);

      if (activeRes.success && activeRes.data) {
        setActiveTrades(activeRes.data.trades as Trade[]);
      }

      if (pendingRes.success && pendingRes.data) {
        setPendingTrades(pendingRes.data.trades as Trade[]);
      }

      if (historyRes.success && historyRes.data) {
        setClosedTrades(historyRes.data.trades as ClosedTrade[]);
      }

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data as unknown as TradeSummary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateTrade = useCallback((trade: Trade) => {
    if (trade.status === 'CLOSED') {
      setActiveTrades(prev => prev.filter(t => t.id !== trade.id));
    } else {
      setActiveTrades(prev => prev.map(t => t.id === trade.id ? trade : t));
    }
  }, []);

  const addTrade = useCallback((trade: Trade) => {
    if (trade.status === 'PENDING') {
      setPendingTrades(prev => [...prev, trade]);
    } else if (trade.status === 'ACTIVE') {
      setActiveTrades(prev => [...prev, trade]);
      setPendingTrades(prev => prev.filter(t => t.id !== trade.id));
    }
  }, []);

  const removeTrade = useCallback((tradeId: string) => {
    setActiveTrades(prev => prev.filter(t => t.id !== tradeId));
    setPendingTrades(prev => prev.filter(t => t.id !== tradeId));
  }, []);

  const addClosedTrade = useCallback((trade: ClosedTrade) => {
    setClosedTrades(prev => [trade, ...prev].slice(0, 100));
    setSummary(prev => {
      if (!prev) return null;
      return {
        ...prev,
        closed_trades: prev.closed_trades + 1,
        total_realized_pnl: prev.total_realized_pnl + trade.realized_pnl,
        winning_trades: prev.winning_trades + (trade.realized_pnl > 0 ? 1 : 0),
        losing_trades: prev.losing_trades + (trade.realized_pnl <= 0 ? 1 : 0),
      };
    });
  }, []);

  return {
    activeTrades,
    pendingTrades,
    closedTrades,
    summary,
    isLoading,
    error,
    refresh: loadData,
    updateTrade,
    addTrade,
    removeTrade,
    addClosedTrade,
  };
}

export default useTrades;
