import React from 'react';
import type { Trade } from '../types';

interface OpenTradesTableProps {
  trades: Trade[];
  onCloseTrade: (id: number) => Promise<void>;
  loading?: boolean;
}

export function OpenTradesTable({ trades, onCloseTrade, loading }: OpenTradesTableProps) {
  const [closingId, setClosingId] = React.useState<number | null>(null);

  const handleManualClose = async (tradeId: number) => {
    setClosingId(tradeId);
    try {
      await onCloseTrade(tradeId);
    } catch (error) {
      console.error('Failed to close trade:', error);
    } finally {
      setClosingId(null);
    }
  };

  const getStatusBadge = (status: Trade['status']) => {
    const styles: Record<Trade['status'], string> = {
      OPEN: 'bg-success text-black',
      CLOSED: 'bg-text-muted text-white',
      PENDING_SL_TP: 'bg-warning text-black',
      FAULTED: 'bg-error text-white',
    };

    const labels: Record<Trade['status'], string> = {
      OPEN: 'Open',
      CLOSED: 'Closed',
      PENDING_SL_TP: 'Pending SL/TP',
      FAULTED: 'Faulted',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getPnLColor = (pnl: number | null) => {
    if (pnl === null) return 'text-text-muted';
    return pnl >= 0 ? 'text-success' : 'text-error';
  };

  if (loading) {
    return (
      <div className="card">
        <div className="h-64 bg-background-light rounded animate-pulse" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="card">
        <div className="text-center text-text-muted py-12">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <div>No open trades</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white">Open Trades ({trades.length})</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border-color">
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Symbol</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Action</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Entry</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Current</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">SL</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">TP</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Lots</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">P&L</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Status</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-b border-border-color table-row-hover">
                <td className="py-3 px-2 text-white font-medium">{trade.symbol}</td>
                <td className="py-3 px-2">
                  <span className={trade.action === 'BUY' ? 'text-success' : 'text-error'}>
                    {trade.action}
                  </span>
                </td>
                <td className="py-3 px-2 text-white">{trade.entryPrice.toFixed(2)}</td>
                <td className="py-3 px-2 text-white">
                  {trade.pnlUsd !== null ? trade.entryPrice.toFixed(2) : '---'}
                </td>
                <td className="py-3 px-2 text-error">
                  {trade.stopLoss?.toFixed(2) || <span className="text-text-muted">-</span>}
                </td>
                <td className="py-3 px-2 text-success">
                  {trade.takeProfit?.toFixed(2) || <span className="text-text-muted">-</span>}
                </td>
                <td className="py-3 px-2 text-white">{trade.lotSize}</td>
                <td className={`py-3 px-2 font-semibold ${getPnLColor(trade.pnlUsd)}`}>
                  {trade.pnlUsd !== null ? `$${trade.pnlUsd.toFixed(2)}` : '-'}
                  {trade.pnlPercent !== null && (
                    <div className="text-xs">{trade.pnlPercent.toFixed(2)}%</div>
                  )}
                </td>
                <td className="py-3 px-2">{getStatusBadge(trade.status)}</td>
                <td className="py-3 px-2">
                  <button
                    onClick={() => handleManualClose(trade.id)}
                    disabled={closingId === trade.id || trade.status === 'CLOSED'}
                    className="btn-secondary text-xs py-1 px-3 whitespace-nowrap"
                  >
                    {closingId === trade.id ? 'Closing...' : 'Close'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {trades.some(t => t.status === 'FAULTED' || t.status === 'PENDING_SL_TP') && (
        <div className="mt-4 p-3 bg-warning bg-opacity-10 border border-warning rounded">
          <div className="flex items-center justify-between">
            <div className="text-warning text-sm">
              ⚠️ Some trades are missing SL/TP levels
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
