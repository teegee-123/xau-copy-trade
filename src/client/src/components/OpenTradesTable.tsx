import { useState } from 'react';
import type { StoredTrade } from '../types';
import { usePrice } from '../hooks/usePrice';
import { useTradeAge, formatTime } from '../hooks/useTradeAge';
import { PriceCell } from '../components/PriceCell';
import { StatusBadge } from '../components/StatusBadge';

interface OpenTradesTableProps {
  trades: StoredTrade[];
  onCloseTrade: (id: number) => Promise<void>;
  loading?: boolean;
}

function AgeCell({ createdAtMs }: { createdAtMs: number }) {
  const { ageSeconds } = useTradeAge(createdAtMs, true);

  return (
    <span className="text-white font-mono text-sm" title="Trade age">
      {formatTime(ageSeconds)}
    </span>
  );
}

function PnLCell({ pnlUsd, pnlPercent }: { pnlUsd: number | null; pnlPercent: number | null }) {
  const getPnLColor = (pnl: number | null) => {
    if (pnl === null) return 'text-text-muted';
    return pnl >= 0 ? 'text-success' : 'text-error';
  };

  return (
    <div className={getPnLColor(pnlUsd)}>
      <div className="font-semibold">
        {pnlUsd !== null ? `$${pnlUsd.toFixed(2)}` : '-'}
      </div>
      {pnlPercent !== null && (
        <div className="text-xs">{pnlPercent.toFixed(2)}%</div>
      )}
    </div>
  );
}

export function OpenTradesTable({ trades, onCloseTrade, loading }: OpenTradesTableProps) {
  const [closingId, setClosingId] = useState<number | null>(null);
  const { price: currentPrice } = usePrice();

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

  // Check if any trades are approaching auto-close
  const hasTradesApproachingAutoClose = trades.some(
    t => !t.stopLoss || !t.takeProfit
  );

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
          <div className="text-sm mt-2">Trades are stored in-memory and will be lost on server restart</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white">Open Trades ({trades.length})</h2>
        <div className="text-sm text-text-muted">
          {trades.filter(t => t.stopLoss && t.takeProfit).length} with SL/TP · {trades.filter(t => !t.stopLoss || !t.takeProfit).length} without
        </div>
      </div>

      {/* Auto-close warning banner */}
      {hasTradesApproachingAutoClose && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning rounded">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-warning text-sm">
              <strong>⚠️ Auto-Close Warning:</strong> Trades missing SL/TP will be automatically closed after 3 minutes.
              The countdown shows time remaining until auto-close.
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
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
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Age</th>
              <th className="text-left py-3 px-2 text-text-muted text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => {
              const hasSlTp = trade.stopLoss !== null && trade.takeProfit !== null;
              
              return (
                <tr key={trade.id} className="border-b border-border-color table-row-hover">
                  <td className="py-3 px-2 text-white font-medium">{trade.symbol}</td>
                  <td className="py-3 px-2">
                    <span className={trade.action === 'BUY' ? 'text-success' : 'text-error'}>
                      {trade.action}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-white">{trade.entryPrice.toFixed(2)}</td>
                  <td className="py-3 px-2">
                    <PriceCell price={currentPrice?.price || null} />
                  </td>
                  <td className="py-3 px-2 text-error">
                    {trade.stopLoss?.toFixed(2) || <span className="text-text-muted">-</span>}
                  </td>
                  <td className="py-3 px-2 text-success">
                    {trade.takeProfit?.toFixed(2) || <span className="text-text-muted">-</span>}
                  </td>
                  <td className="py-3 px-2 text-white">{trade.lotSize}</td>
                  <td className="py-3 px-2">
                    <PnLCell pnlUsd={trade.pnlUsd} pnlPercent={trade.pnlPercent} />
                  </td>
                  <td className="py-3 px-2">
                    <StatusBadge 
                      status={trade.status} 
                      countdownSeconds={hasSlTp ? 0 : Math.max(0, 180 - Math.floor((Date.now() - trade.createdAt) / 1000))}
                    />
                  </td>
                  <td className="py-3 px-2">
                    <AgeCell createdAtMs={trade.createdAt} />
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {trades.some(t => !t.stopLoss || !t.takeProfit) && (
        <div className="mt-4 p-3 bg-warning bg-opacity-10 border border-warning rounded">
          <div className="flex items-center justify-between">
            <div className="text-warning text-sm">
              ⚠️ {trades.filter(t => !t.stopLoss || !t.takeProfit).length} trade(s) missing SL/TP
            </div>
            <button
              onClick={async () => {
                if (confirm('Close all trades missing SL/TP now?')) {
                  try {
                    const response = await fetch('/api/trades/close-faulted', { method: 'POST' });
                    const result = await response.json();
                    if (result.success) {
                      console.log(`Closed ${result.closed} trades`);
                    }
                  } catch (error) {
                    console.error('Failed to close faulted trades:', error);
                  }
                }
              }}
              className="btn-secondary text-xs py-1 px-3"
            >
              Close All Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
