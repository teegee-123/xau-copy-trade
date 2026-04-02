import React from 'react';
import axios from 'axios';

interface PnLSummary {
  totalPnlUsd: number;
  totalPnlPercent: number;
  todayPnlUsd: number;
}

interface PnLCardProps {
  title: string;
  value: string | React.ReactNode;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  delay?: number;
}

function PnLCard({ title, value, subtitle, icon, gradient, delay = 0 }: PnLCardProps) {
  return (
    <div 
      className="card group hover:scale-[1.02] transition-all duration-300"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-text-muted text-sm font-medium mb-1">{title}</div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
          {subtitle && <div className="text-xs text-text-muted mt-1">{subtitle}</div>}
        </div>
        <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl transition-shadow duration-300 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
    </div>
  );
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

    const interval = setInterval(fetchSummary, 10000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card h-32 rounded-lg skeleton" />
        ))}
      </div>
    );
  }

  const formatPnL = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    const color = value >= 0 ? 'text-success' : 'text-error';
    const gradient = value >= 0 ? 'from-success/20 to-success/5' : 'from-error/20 to-error/5';
    
    return (
      <span className={`bg-gradient-to-br ${gradient} px-2 py-1 rounded-lg ${color}`}>
        {sign}${Math.abs(value).toFixed(2)}
      </span>
    );
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    const color = value >= 0 ? 'text-success' : 'text-error';
    const gradient = value >= 0 ? 'from-success/20 to-success/5' : 'from-error/20 to-error/5';
    
    return (
      <span className={`bg-gradient-to-br ${gradient} px-2 py-1 rounded-lg ${color}`}>
        {sign}{value.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total P&L USD */}
      <PnLCard
        title="Total P&L"
        value={summary ? formatPnL(summary.totalPnlUsd) : '$0.00'}
        subtitle="USD"
        icon={
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        gradient="bg-gradient-to-br from-primary/20 to-primary/5"
        delay={0}
      />

      {/* Total P&L Percent */}
      <PnLCard
        title="Total Return"
        value={summary ? formatPercent(summary.totalPnlPercent) : '0.00%'}
        icon={
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
        gradient="bg-gradient-to-br from-info/20 to-info/5"
        delay={100}
      />

      {/* Today's P&L */}
      <PnLCard
        title="Today's P&L"
        value={summary ? formatPnL(summary.todayPnlUsd) : '$0.00'}
        subtitle="USD"
        icon={
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        gradient="bg-gradient-to-br from-warning/20 to-warning/5"
        delay={200}
      />
    </div>
  );
}
