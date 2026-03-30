// API client for communicating with the backend

const API_BASE = '/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Health check
  health: () => fetchApi<Record<string, unknown>>('/health'),

  // Trades
  getActiveTrades: () => fetchApi<{ trades: unknown[]; count: number; total_unrealized_pnl: number }>('/trades/active'),
  getPendingTrades: () => fetchApi<{ trades: unknown[]; count: number }>('/trades/pending'),
  getTradeHistory: (limit = 50) => fetchApi<{ trades: unknown[]; count: number; total_realized_pnl: number }>(`/trades/history?limit=${limit}`),
  getTrade: (tradeId: string) => fetchApi<Record<string, unknown>>(`/trades/${tradeId}`),
  closeTrade: (tradeId: string) => fetchApi<Record<string, unknown>>(`/trades/${tradeId}/close`, { method: 'POST' }),

  // Summary
  getSummary: () => fetchApi<Record<string, unknown>>('/summary'),

  // Control
  pauseBot: () => fetchApi<Record<string, unknown>>('/control', {
    method: 'POST',
    body: JSON.stringify({ action: 'pause' }),
  }),
  resumeBot: () => fetchApi<Record<string, unknown>>('/control', {
    method: 'POST',
    body: JSON.stringify({ action: 'resume' }),
  }),

  // Status
  getStatus: () => fetchApi<Record<string, unknown>>('/status'),
};

export default api;
