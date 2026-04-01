import { formatTime } from '../hooks/useTradeAge';

interface StatusBadgeProps {
  status: 'OPEN' | 'CLOSED' | 'PENDING_SL_TP' | 'FAULTED';
  countdownSeconds?: number;
  showCountdown?: boolean;
}

export function StatusBadge({ status, countdownSeconds = 0, showCountdown = true }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    OPEN: 'bg-success text-black',
    CLOSED: 'bg-text-muted text-white',
    PENDING_SL_TP: 'bg-warning text-black',
    FAULTED: 'bg-error text-white',
  };

  const labels: Record<string, string> = {
    OPEN: 'Open',
    CLOSED: 'Closed',
    PENDING_SL_TP: 'Pending SL/TP',
    FAULTED: 'Faulted',
  };

  const hasActiveCountdown = showCountdown && countdownSeconds > 0;
  
  // Determine urgency color for countdown
  const getUrgencyColor = () => {
    if (countdownSeconds <= 60) return 'text-error';
    if (countdownSeconds <= 120) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
        {labels[status]}
      </span>
      {hasActiveCountdown && (
        <span className={`text-xs font-mono font-semibold ${getUrgencyColor()}`} title="Time until auto-close">
          ⏱️ {formatTime(countdownSeconds)}
        </span>
      )}
    </div>
  );
}
