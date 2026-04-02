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
    <span className="text-text-secondary font-mono text-sm" title="Trade age">
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
      <div className="font-bold text-base">
        {pnlUsd !== null ? `$${pnlUsd.toFixed(2)}` : '-'}
      </div>
      {pnlPercent !== null && (
        <div className={`text-xs font-medium ${
          pnlPercent >= 0 ? 'text-success/80' : 'text-error/80'
        }`}>
          {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
        </div>
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
        <div className="h-64 rounded-lg skeleton" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div className="text-text-secondary font-medium mb-2">No open trades</div>
          <div className="text-sm text-text-muted">
            Trades are stored in-memory and will be lost on server restart
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Open Trades</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
            {trades.length}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="text-text-muted">{trades.filter(t => t.stopLoss && t.takeProfit).length} with SL/TP</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-text-muted">{trades.filter(t => !t.stopLoss || !t.takeProfit).length} without</span>
          </span>
        </div>
      </div>

      {/* Auto-close warning banner */}
      {hasTradesApproachingAutoClose && (
        <div className="mb-5 p-4 bg-warning/10 border border-warning/30 rounded-xl flex items-start gap-3 animate-slide-up">
          <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-warning text-sm flex-1">
            <strong className="font-semibold">Auto-Close Warning:</strong> Trades missing SL/TP will be automatically closed after 3 minutes.
            The countdown shows time remaining until auto-close.
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table-modern">
          <thead>
            <tr>
              <th className="text-left">Symbol</th>
              <th className="text-left">Action</th>
              <th className="text-left">Entry</th>
              <th className="text-left">Current</th>
              <th className="text-left">SL</th>
              <th className="text-left">TP</th>
              <th className="text-left">Lots</th>
              <th className="text-left">P&L</th>
              <th className="text-left">Status</th>
              <th className="text-left">Age</th>
              <th className="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => {
              const hasSlTp = trade.stopLoss !== null && trade.takeProfit !== null;
              const countdownSeconds = hasSlTp ? 0 : Math.max(0, 180 - Math.floor((Date.now() - trade.createdAt) / 1000));

              return (
                <tr key={trade.id} className="group">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                      <span className="text-white font-semibold">{trade.symbol}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${
                      trade.action === 'BUY' 
                        ? 'bg-success/20 text-success border border-success/30' 
                        : 'bg-error/20 text-error border border-error/30'
                    }`}>
                      {trade.action}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-white font-mono">{trade.entryPrice.toFixed(2)}</td>
                  <td className="py-4 px-4">
                    <PriceCell price={currentPrice?.price || null} />
                  </td>
                  <td className="py-4 px-4">
                    {trade.stopLoss ? (
                      <span className="text-error font-mono font-medium">{trade.stopLoss.toFixed(2)}</span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {trade.takeProfit ? (
                      <span className="text-success font-mono font-medium">{trade.takeProfit.toFixed(2)}</span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-white font-mono">{trade.lotSize}</td>
                  <td className="py-4 px-4">
                    <PnLCell pnlUsd={trade.pnlUsd} pnlPercent={trade.pnlPercent} />
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge
                      status={trade.status}
                      countdownSeconds={countdownSeconds}
                      showCountdown={true}
                    />
                  </td>
                  <td className="py-4 px-4">
                    <AgeCell createdAtMs={trade.createdAt} />
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleManualClose(trade.id)}
                      disabled={closingId === trade.id || trade.status === 'CLOSED'}
                      className={`btn-secondary text-xs py-1.5 px-4 rounded-lg transition-all duration-200 ${
                        closingId === trade.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-error/20 hover:border-error/50'
                      }`}
                    >
                      {closingId === trade.id ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Closing...
                        </span>
                      ) : (
                        'Close'
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {trades.some(t => !t.stopLoss || !t.takeProfit) && (
        <div className="mt-5 p-4 bg-error/10 border border-error/30 rounded-xl flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-error/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-error text-sm">
              <strong className="font-semibold">{trades.filter(t => !t.stopLoss || !t.takeProfit).length}</strong> trade(s) missing SL/TP
            </div>
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
            className="btn-danger text-sm py-1.5 px-4 rounded-lg"
          >
            Close All Now
          </button>
        </div>
      )}
    </div>
  );
}
