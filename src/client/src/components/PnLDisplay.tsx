import React from 'react';
import axios from 'axios';

interface PnLSummary {
  totalPnlUsd: number;
  totalPnlPercent: number;
  todayPnlUsd: number;
}

export function PnLDisplay() {
  const [summary, setSummary] = React.useState<PnLSummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchSummary = React.useCallback(async () => {
    try {
      const response = await axios.get('/api/trades/summary');
      if (response.data.success) {
        setSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch P&L summary:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSummary();
    
    const interval = setInterval(fetchSummary, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card h-24 bg-background-card rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const formatPnL = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    const color = value >= 0 ? 'text-success' : 'text-error';
    return <span className={color}>{sign}{value.toFixed(2)}</span>;
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    const color = value >= 0 ? 'text-success' : 'text-error';
    return <span className={color}>{sign}{value.toFixed(2)}%</span>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total P&L USD */}
      <div className="card">
        <div className="text-text-muted text-sm mb-2">Total P&L</div>
        <div className="text-2xl font-bold">
          {summary ? formatPnL(summary.totalPnlUsd) : '$0.00'}
          <span className="text-text-muted text-lg ml-2">USD</span>
        </div>
      </div>

      {/* Total P&L Percent */}
      <div className="card">
        <div className="text-text-muted text-sm mb-2">Total Return</div>
        <div className="text-2xl font-bold">
          {summary ? formatPercent(summary.totalPnlPercent) : '0.00%'}
        </div>
      </div>

      {/* Today's P&L */}
      <div className="card">
        <div className="text-text-muted text-sm mb-2">Today's P&L</div>
        <div className="text-2xl font-bold">
          {summary ? formatPnL(summary.todayPnlUsd) : '$0.00'}
          <span className="text-text-muted text-lg ml-2">USD</span>
        </div>
      </div>
    </div>
  );
}
