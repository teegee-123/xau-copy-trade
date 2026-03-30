import { TradeSummary } from '../../types';

interface SummaryCardsProps {
  summary: TradeSummary | null;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  if (!summary) {
    return null;
  }

  const cards = [
    {
      title: 'Realized P&L',
      value: `${summary.total_realized_pnl >= 0 ? '+' : ''}${summary.total_realized_pnl.toFixed(2)} USD`,
      change: `${summary.win_rate.toFixed(1)}% win rate`,
      color: summary.total_realized_pnl >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      title: 'Unrealized P&L',
      value: `${summary.total_unrealized_pnl >= 0 ? '+' : ''}${summary.total_unrealized_pnl.toFixed(2)} USD`,
      change: `${summary.active_trades} active`,
      color: summary.total_unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      title: 'Total Trades',
      value: summary.closed_trades.toString(),
      change: `${summary.winning_trades}W / ${summary.losing_trades}L`,
      color: 'text-white',
    },
    {
      title: 'Pending',
      value: summary.pending_trades.toString(),
      change: 'Waiting for entry',
      color: 'text-yellow-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-slate-800 rounded-lg p-4 border border-slate-700"
        >
          <h3 className="text-slate-400 text-sm mb-1">{card.title}</h3>
          <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          <p className="text-slate-500 text-xs mt-1">{card.change}</p>
        </div>
      ))}
    </div>
  );
}

export default SummaryCards;
