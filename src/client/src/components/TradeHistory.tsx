import React from 'react';
import type { Trade } from '../types';

interface TradeHistoryProps {
  trades: Trade[];
  loading?: boolean;
}

export function TradeHistory({ trades, loading }: TradeHistoryProps) {
  const [filter, setFilter] = React.useState<'all' | 'SL_HIT' | 'TP_HIT' | 'MANUAL_CLOSE' | 'FAULT_TIMEOUT'>('all');

  const getExitReasonLabel = (reason: string | null) => {
    const labels: Record<string, string> = {
      SL_HIT: 'Stop Loss',
      TP_HIT: 'Take Profit',
      MANUAL_CLOSE: 'Manual Close',
      FAULT_TIMEOUT: 'Timeout',
    };
    return labels[reason || ''] || reason || '-';
  };

  const getExitReasonColor = (reason: string | null) => {
    const colors: Record<string, string> = {
      SL_HIT: 'text-error',
      TP_HIT: 'text-success',
      MANUAL_CLOSE: 'text-info',
      FAULT_TIMEOUT: 'text-warning',
    };
    return colors[reason || ''] || 'text-text-muted';
  };

  const filteredTrades = filter === 'all' ? trades : trades.filter(t => t.exitReason === filter);

  if (loading) {
    return (
      <div className="card">
        <div className="h-64 bg-background-light rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white">Trade History</h2>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="input-field text-sm w-full sm:w-auto"
        >
          <option value="all">All Exits</option>
          <option value="TP_HIT">Take Profit</option>
          <option value="SL_HIT">Stop Loss</option>
          <option value="MANUAL_CLOSE">Manual Close</option>
          <option value="FAULT_TIMEOUT">Timeout</option>
        </select>
      </div>

      {filteredTrades.length === 0 ? (
        <div className="text-center text-text-muted py-12">
          <div>No trade history</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border-color">
                <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Symbol</th>
                <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Action</th>
                <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Entry</th>
                <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Exit</th>
                <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">P&L</th>
                <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Exit Reason</th>
                <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Closed At</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade) => (
                <tr key={trade.id} className="border-b border-border-color table-row-hover">
                  <td className="py-3 px-2 text-white font-medium">{trade.symbol}</td>
                  <td className="py-3 px-2">
                    <span className={trade.action === 'BUY' ? 'text-success' : 'text-error'}>
                      {trade.action}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-white">{trade.entryPrice.toFixed(2)}</td>
                  <td className="py-3 px-2 text-white">{trade.exitPrice?.toFixed(2) || '-'}</td>
                  <td className={`py-3 px-2 font-semibold ${trade.pnlUsd && trade.pnlUsd >= 0 ? 'text-success' : 'text-error'}`}>
                    {trade.pnlUsd !== null ? `$${trade.pnlUsd.toFixed(2)}` : '-'}
                    {trade.pnlPercent !== null && (
                      <div className="text-xs">{trade.pnlPercent.toFixed(2)}%</div>
                    )}
                  </td>
                  <td className={`py-3 px-2 ${getExitReasonColor(trade.exitReason)}`}>
                    {getExitReasonLabel(trade.exitReason)}
                  </td>
                  <td className="py-3 px-2 text-text-muted text-sm">
                    {trade.closedAt ? new Date(trade.closedAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
