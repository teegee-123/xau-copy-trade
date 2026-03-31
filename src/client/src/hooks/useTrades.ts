import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { Trade, TradeUpdate } from '../types';
import { useWebSocket } from './useWebSocket';

export function useTrades() {
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpenTrades = useCallback(async () => {
    try {
      const response = await axios.get('/api/trades/open');
      if (response.data.success) {
        setOpenTrades(response.data.trades);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch open trades');
    }
  }, []);

  const fetchClosedTrades = useCallback(async () => {
    try {
      const response = await axios.get('/api/trades/history');
      if (response.data.success) {
        setClosedTrades(response.data.trades);
      }
    } catch (err) {
      console.error('Failed to fetch closed trades:', err);
    }
  }, []);

  const closeTrade = useCallback(async (tradeId: number, reason?: string) => {
    try {
      const response = await axios.post(`/api/trades/${tradeId}/close`, {
        reason: reason || 'MANUAL_CLOSE',
      });
      
      if (response.data.success) {
        await fetchOpenTrades();
        await fetchClosedTrades();
        return response.data.trade;
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to close trade');
    }
  }, [fetchOpenTrades, fetchClosedTrades]);

  const closeFaultedTrades = useCallback(async () => {
    try {
      const response = await axios.post('/api/trades/close-faulted');
      
      if (response.data.success) {
        await fetchOpenTrades();
        await fetchClosedTrades();
        return response.data;
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to close faulted trades');
    }
  }, [fetchOpenTrades, fetchClosedTrades]);

  // WebSocket for real-time updates
  useWebSocket({
    onTradeUpdate: (update: TradeUpdate) => {
      console.log('Trade update received:', update);
      
      if (update.type === 'OPENED') {
        setOpenTrades(prev => [update.trade, ...prev]);
      } else if (update.type === 'CLOSED') {
        setOpenTrades(prev => prev.filter(t => t.id !== update.trade.id));
        setClosedTrades(prev => [update.trade, ...prev]);
      } else if (update.type === 'UPDATED' || update.type === 'SL_TP_UPDATED') {
        setOpenTrades(prev => 
          prev.map(t => t.id === update.trade.id ? update.trade : t)
        );
      }
      
      setLoading(false);
    },
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchOpenTrades(), fetchClosedTrades()]);
      setLoading(false);
    };
    
    loadData();
  }, [fetchOpenTrades, fetchClosedTrades]);

  return {
    openTrades,
    closedTrades,
    loading,
    error,
    refresh: () => {
      fetchOpenTrades();
      fetchClosedTrades();
    },
    closeTrade,
    closeFaultedTrades,
  };
}
