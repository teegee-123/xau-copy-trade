import { formatTime } from '../hooks/useTradeAge';

interface StatusBadgeProps {
  status: 'OPEN' | 'CLOSED' | 'PENDING_SL_TP' | 'FAULTED';
  countdownSeconds?: number;
  showCountdown?: boolean;
}

export function StatusBadge({ status, countdownSeconds = 0, showCountdown = true }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    OPEN: 'bg-success text-black shadow-success/30',
    CLOSED: 'bg-text-muted text-white shadow-white/10',
    PENDING_SL_TP: 'bg-warning text-black shadow-warning/30',
    FAULTED: 'bg-error text-white shadow-error/30',
  };

  const labels: Record<string, string> = {
    OPEN: 'Open',
    CLOSED: 'Closed',
    PENDING_SL_TP: 'Pending SL/TP',
    FAULTED: 'Faulted',
  };

  const hasActiveCountdown = showCountdown && countdownSeconds > 0;

  // Determine urgency color and animation for countdown
  const getUrgencyConfig = () => {
    if (countdownSeconds <= 60) {
      return { color: 'text-error', bg: 'bg-error/20', pulse: 'animate-pulse' };
    }
    if (countdownSeconds <= 120) {
      return { color: 'text-warning', bg: 'bg-warning/20', pulse: '' };
    }
    return { color: 'text-success', bg: 'bg-success/20', pulse: '' };
  };

  const urgencyConfig = getUrgencyConfig();

  return (
    <div className="flex items-center gap-2">
      <span 
        className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${styles[status]} transition-all duration-200 hover:scale-105`}
      >
        {labels[status]}
      </span>
      {hasActiveCountdown && (
        <span 
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${urgencyConfig.bg} ${urgencyConfig.color} ${urgencyConfig.pulse}`}
          title="Time until auto-close"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatTime(countdownSeconds)}
        </span>
      )}
    </div>
  );
}
