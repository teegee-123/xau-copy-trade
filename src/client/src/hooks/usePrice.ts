import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { PriceData, PriceStatus } from '../types';
import { useWebSocket } from './useWebSocket';

export function usePrice() {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [status, setStatus] = useState<PriceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const response = await axios.get('/api/price/current');
      if (response.data.success) {
        setPrice(response.data.price);
        setStatus(response.data.status);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/price/status');
      if (response.data.success) {
        setStatus(response.data.status);
      }
    } catch (err) {
      console.error('Failed to fetch price status:', err);
    }
  }, []);

  // WebSocket for real-time updates
  useWebSocket({
    onPriceUpdate: (newPrice) => {
      setPrice(newPrice);
      setLoading(false);
    },
  });

  useEffect(() => {
    fetchPrice();
    fetchStatus();
    
    // Fallback polling if WebSocket fails
    const interval = setInterval(() => {
      if (!price) {
        fetchPrice();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchPrice, fetchStatus, price]);

  return {
    price,
    status,
    loading,
    error,
    refresh: fetchPrice,
  };
}
