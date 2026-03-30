import React from 'react';
import { api } from '../services/api';

interface BotControlsProps {
  isPaused: boolean;
  isRunning: boolean;
  onStatusChange?: () => void;
}

export function BotControls({ isPaused, isRunning, onStatusChange }: BotControlsProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      if (isPaused) {
        await api.resumeBot();
      } else {
        await api.pauseBot();
      }
      onStatusChange?.();
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Bot Status:</span>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          isRunning && !isPaused
            ? 'bg-green-500/20 text-green-400'
            : isPaused
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-red-500/20 text-red-400'
        }`}>
          {isRunning && !isPaused ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
        </span>
      </div>

      <button
        onClick={handleToggle}
        disabled={isLoading || !isRunning}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isPaused
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-yellow-600 hover:bg-yellow-500 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? 'Processing...' : isPaused ? 'Resume Bot' : 'Pause Bot'}
      </button>
    </div>
  );
}

export default BotControls;
