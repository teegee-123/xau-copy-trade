import { Trade } from '../types';

interface ActiveTradesProps {
  trades: Trade[];
  onCloseTrade?: (tradeId: string) => void;
}

export function ActiveTrades({ trades, onCloseTrade }: ActiveTradesProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center text-slate-400">
        No active trades
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trades.map((trade) => (
        <div
          key={trade.id}
          className="bg-slate-800 rounded-lg p-4 border border-slate-700 animate-slide-in"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                trade.direction === 'BUY' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {trade.direction}
              </span>
              <span className="text-lg font-bold text-white">{trade.symbol}</span>
              <span className="text-xs text-slate-400">#{trade.id.slice(0, 8)}</span>
            </div>
            <div className={`text-lg font-bold ${
              trade.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {trade.unrealized_pnl >= 0 ? '+' : ''}{trade.unrealized_pnl.toFixed(2)} USD
              <span className="text-sm ml-1">
                ({trade.unrealized_pnl_percent >= 0 ? '+' : ''}{trade.unrealized_pnl_percent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Entry</span>
              <p className="text-white font-medium">
                {trade.actual_entry_price?.toFixed(2) || trade.entry_price_max?.toFixed(2) || '-'}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Current</span>
              <p className="text-white font-medium">{trade.current_price?.toFixed(2) || '-'}</p>
            </div>
            <div>
              <span className="text-slate-400">Stop Loss</span>
              <p className="text-red-400 font-medium">{trade.stop_loss?.toFixed(2) || '-'}</p>
            </div>
            <div>
              <span className="text-slate-400">Take Profit</span>
              <p className="text-green-400 font-medium">{trade.take_profit?.toFixed(2) || '-'}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${
                trade.status === 'ACTIVE' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {trade.status}
              </span>
              {trade.close_reason && (
                <span className="text-xs text-slate-400">
                  Closed: {trade.close_reason}
                </span>
              )}
            </div>
            {trade.status === 'ACTIVE' && onCloseTrade && (
              <button
                onClick={() => onCloseTrade(trade.id)}
                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActiveTrades;
