import { ClosedTrade } from '../types';

interface TradeHistoryProps {
  trades: ClosedTrade[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center text-slate-400">
        No trade history
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Time</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Symbol</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Direction</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Entry</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Exit</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">P&L</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/50">
              <td className="py-3 px-4 text-slate-300">
                {new Date(trade.close_timestamp).toLocaleString()}
              </td>
              <td className="py-3 px-4 text-white font-medium">{trade.symbol}</td>
              <td className="py-3 px-4">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  trade.direction === 'BUY' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {trade.direction}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-300">{trade.entry_price.toFixed(2)}</td>
              <td className="py-3 px-4 text-slate-300">{trade.exit_price.toFixed(2)}</td>
              <td className={`py-3 px-4 font-medium ${
                trade.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {trade.realized_pnl >= 0 ? '+' : ''}{trade.realized_pnl.toFixed(2)}
                <span className="text-xs ml-1">
                  ({trade.realized_pnl_percent >= 0 ? '+' : ''}{trade.realized_pnl_percent.toFixed(2)}%)
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  trade.close_reason === 'TP' 
                    ? 'bg-green-500/20 text-green-400' 
                    : trade.close_reason === 'SL'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {trade.close_reason}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TradeHistory;
