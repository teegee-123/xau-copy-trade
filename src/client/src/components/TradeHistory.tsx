import React from 'react';
import type { StoredTrade } from '../types';

interface TradeHistoryProps {
  trades: StoredTrade[];
  loading?: boolean;
}

export function TradeHistory({ trades, loading }: TradeHistoryProps) {
  const [filter, setFilter] = React.useState<'all' | 'SL_HIT' | 'TP_HIT' | 'MANUAL_CLOSE' | 'SL_TP_TIMEOUT'>('all');

  const getExitReasonLabel = (reason: string | null) => {
    const labels: Record<string, string> = {
      SL_HIT: 'Stop Loss',
      TP_HIT: 'Take Profit',
      MANUAL_CLOSE: 'Manual Close',
      SL_TP_TIMEOUT: 'Timeout',
    };
    return labels[reason || ''] || reason || '-';
  };

  const getExitReasonBadge = (reason: string | null) => {
    const config: Record<string, { bg: string; color: string; label: string }> = {
      SL_HIT: { bg: 'bg-error/20', color: 'text-error', label: 'SL' },
      TP_HIT: { bg: 'bg-success/20', color: 'text-success', label: 'TP' },
      MANUAL_CLOSE: { bg: 'bg-info/20', color: 'text-info', label: 'Manual' },
      SL_TP_TIMEOUT: { bg: 'bg-warning/20', color: 'text-warning', label: 'Timeout' },
    };
    const cfg = config[reason || ''];
    return cfg || { bg: 'bg-white/10', color: 'text-text-muted', label: '-' };
  };

  const filteredTrades = filter === 'all' ? trades : trades.filter(t => t.exitReason === filter);

  // Calculate stats
  const stats = React.useMemo(() => {
    const total = trades.length;
    const wins = trades.filter(t => (t.pnlUsd || 0) > 0).length;
    const losses = trades.filter(t => (t.pnlUsd || 0) <= 0).length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnlUsd || 0), 0);
    
    return { total, wins, losses, winRate, totalPnl };
  }, [trades]);

  if (loading) {
    return (
      <div className="card">
        <div className="h-64 rounded-lg skeleton" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Trade History</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-text-muted text-xs font-bold">
            {trades.length} trades
          </span>
        </div>

        {/* Stats Summary */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10">
            <span className="text-text-muted">Wins:</span>
            <span className="text-success font-bold">{stats.wins}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10">
            <span className="text-text-muted">Losses:</span>
            <span className="text-error font-bold">{stats.losses}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10">
            <span className="text-text-muted">Win Rate:</span>
            <span className="text-primary font-bold">{stats.winRate}%</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${stats.totalPnl >= 0 ? 'bg-success/10' : 'bg-error/10'}`}>
            <span className="text-text-muted">Total P&L:</span>
            <span className={`font-bold ${stats.totalPnl >= 0 ? 'text-success' : 'text-error'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'All', count: trades.length },
          { value: 'TP_HIT', label: 'Take Profit', count: trades.filter(t => t.exitReason === 'TP_HIT').length },
          { value: 'SL_HIT', label: 'Stop Loss', count: trades.filter(t => t.exitReason === 'SL_HIT').length },
          { value: 'MANUAL_CLOSE', label: 'Manual', count: trades.filter(t => t.exitReason === 'MANUAL_CLOSE').length },
          { value: 'SL_TP_TIMEOUT', label: 'Timeout', count: trades.filter(t => t.exitReason === 'SL_TP_TIMEOUT').length },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as typeof filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              filter === f.value
                ? 'bg-primary text-black shadow-lg shadow-primary/30 scale-105'
                : 'bg-white/5 text-text-muted hover:text-white hover:bg-white/10'
            }`}
          >
            {f.label}
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
              filter === f.value ? 'bg-black/20' : 'bg-white/10'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {filteredTrades.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="text-text-secondary font-medium mb-1">No trade history</div>
          <div className="text-sm text-text-muted">
            {filter !== 'all' ? 'Try selecting a different filter' : 'Closed trades will appear here'}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Symbol</th>
                <th className="text-left">Action</th>
                <th className="text-left">Entry</th>
                <th className="text-left">Exit</th>
                <th className="text-left">P&L</th>
                <th className="text-left">Exit Reason</th>
                <th className="text-left">Closed At</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade) => {
                const exitReasonConfig = getExitReasonBadge(trade.exitReason);
                
                return (
                  <tr key={trade.id} className="group">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                        <span className="text-white font-medium">{trade.symbol}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${
                        trade.action === 'BUY' 
                          ? 'bg-success/20 text-success border border-success/30' 
                          : 'bg-error/20 text-error border border-error/30'
                      }`}>
                        {trade.action}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-text-secondary font-mono">{trade.entryPrice.toFixed(2)}</td>
                    <td className="py-4 px-4 text-text-secondary font-mono">
                      {trade.exitPrice?.toFixed(2) || '-'}
                    </td>
                    <td className="py-4 px-4">
                      <div className={trade.pnlUsd && trade.pnlUsd >= 0 ? 'text-success' : 'text-error'}>
                        <div className="font-bold text-base">
                          {trade.pnlUsd !== null ? `$${trade.pnlUsd.toFixed(2)}` : '-'}
                        </div>
                        {trade.pnlPercent !== null && (
                          <div className={`text-xs font-medium ${
                            trade.pnlPercent >= 0 ? 'text-success/80' : 'text-error/80'
                          }`}>
                            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${exitReasonConfig.bg} ${exitReasonConfig.color}`}>
                        {getExitReasonLabel(trade.exitReason)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-text-muted text-sm font-mono">
                      {trade.closedAt ? new Date(trade.closedAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
