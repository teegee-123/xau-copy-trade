import { useState, useEffect } from 'react';

const AUTO_CLOSE_TIMEOUT = 180; // 3 minutes in seconds

/**
 * Hook to calculate trade age and countdown
 * Returns age in seconds and countdown until auto-close
 */
export function useTradeAge(createdAtMs: number, hasSlTp: boolean) {
  const [ageSeconds, setAgeSeconds] = useState(() => {
    return Math.floor((Date.now() - createdAtMs) / 1000);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setAgeSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const countdownSeconds = hasSlTp ? 0 : Math.max(0, AUTO_CLOSE_TIMEOUT - ageSeconds);

  return {
    ageSeconds,
    countdownSeconds,
    hasSlTp,
  };
}

/**
 * Format seconds into human-readable string
 */
export function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m ${seconds}s`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  
  return `${seconds}s`;
}
