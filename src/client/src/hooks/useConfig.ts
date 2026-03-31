import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import type { AppConfig, TemplateTestResult, HistoricalMessage } from '../types';

interface UseConfigReturn {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (section: keyof AppConfig, data: Record<string, unknown>) => Promise<boolean>;
  testTemplate: (templateType: 'entry' | 'sltp', message: string, template?: Record<string, unknown>) => Promise<TemplateTestResult | null>;
  getHistoricalMessages: (limit?: number) => Promise<HistoricalMessage[]>;
  getTemplateExamples: () => Promise<{ entry: Array<{ message: string; extracted: Record<string, unknown> }>; sltp: Array<{ message: string; extracted: Record<string, unknown> }> }>;
  refresh: () => Promise<void>;
}

export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await axios.get('/api/config');
      if (response.data.success) {
        setConfig(response.data.config);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (
    section: keyof AppConfig,
    data: Record<string, unknown>
  ): Promise<boolean> => {
    try {
      const response = await axios.put('/api/config', { section, data });
      if (response.data.success) {
        // Update local config
        setConfig(prev => prev ? {
          ...prev,
          [section]: {
            ...prev[section],
            ...data,
          },
        } : null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update config:', err);
      return false;
    }
  }, []);

  const testTemplate = useCallback(async (
    templateType: 'entry' | 'sltp',
    message: string,
    template?: Record<string, unknown>
  ): Promise<TemplateTestResult | null> => {
    try {
      const response = await axios.post('/api/config/test-template', {
        templateType,
        message,
        template,
      });
      if (response.data.success) {
        return response.data.result;
      }
      return null;
    } catch (err) {
      console.error('Failed to test template:', err);
      return null;
    }
  }, []);

  const getHistoricalMessages = useCallback(async (limit = 10): Promise<HistoricalMessage[]> => {
    try {
      const response = await axios.get(`/api/config/historical-messages?limit=${limit}`);
      if (response.data.success) {
        return response.data.messages;
      }
      return [];
    } catch (err) {
      console.error('Failed to get historical messages:', err);
      return [];
    }
  }, []);

  const getTemplateExamples = useCallback(async (): Promise<{
    entry: Array<{ message: string; extracted: Record<string, unknown> }>;
    sltp: Array<{ message: string; extracted: Record<string, unknown> }>;
  }> => {
    try {
      const response = await axios.get('/api/config/template-examples');
      if (response.data.success) {
        return response.data.examples;
      }
      return { entry: [], sltp: [] };
    } catch (err) {
      console.error('Failed to get template examples:', err);
      return { entry: [], sltp: [] };
    }
  }, []);

  // WebSocket connection for real-time config updates
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://${window.location.host}/ws`);
      
      ws.onopen = () => {
        console.log('Config WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'CONFIG_UPDATE') {
            const { section, config: newConfig } = message.data;
            setConfig(prev => prev ? {
              ...prev,
              [section]: newConfig,
            } : null);
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Config WebSocket disconnected');
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    updateConfig,
    testTemplate,
    getHistoricalMessages,
    getTemplateExamples,
    refresh: fetchConfig,
  };
}
