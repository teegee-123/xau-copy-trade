import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { SystemStatus } from '../types';

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/status');
      if (response.data.success) {
        setStatus(response.data.status);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    
    // Poll status every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
  };
}
