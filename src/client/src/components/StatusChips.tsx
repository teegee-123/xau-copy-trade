import React from 'react';
import type { SystemStatus } from '../types';

interface StatusChipProps {
  label: string;
  status: 'connected' | 'disconnected' | 'warning';
  icon?: React.ReactNode;
}

function StatusChip({ label, status, icon }: StatusChipProps) {
  const statusConfig = {
    connected: {
      color: 'bg-success text-black',
      glow: 'shadow-success/50',
      pulse: 'animate-pulse-success',
      label: 'Connected',
    },
    disconnected: {
      color: 'bg-error text-white',
      glow: 'shadow-error/50',
      pulse: '',
      label: 'Disconnected',
    },
    warning: {
      color: 'bg-warning text-black',
      glow: 'shadow-warning/50',
      pulse: 'animate-pulse-warning',
      label: 'Warning',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className="text-text-muted text-sm font-medium">{label}:</span>
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${config.color} shadow-lg ${config.glow} ${config.pulse} transition-all duration-300 hover:scale-105`}
      >
        <div className={`w-2 h-2 rounded-full ${
          status === 'connected' ? 'bg-black animate-pulse' : 
          status === 'warning' ? 'bg-black animate-pulse' : 
          'bg-white'
        }`} />
        {icon}
        <span>{config.label}</span>
      </div>
    </div>
  );
}

interface StatusChipsProps {
  status: SystemStatus | null;
  loading?: boolean;
}

export function StatusChips({ status, loading }: StatusChipsProps) {
  if (loading || !status) {
    return (
      <div className="flex flex-wrap gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-9 w-40 rounded-full skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 sm:gap-4">
      <StatusChip
        label="Telegram"
        status={status.telegram.connected ? 'connected' : status.telegram.error ? 'disconnected' : 'warning'}
        icon={
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.44-.42-1.38-.88.03-.24.37-.49 1.03-.74 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.89 5.17-1.9.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.26z"/>
          </svg>
        }
      />

      <StatusChip
        label="Price API"
        status={
          status.price.warning ? 'warning' :
          status.price.connected ? 'connected' : 'disconnected'
        }
        icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />

      <StatusChip
        label="Trading"
        status={status.trading.enabled ? 'connected' : 'warning'}
        icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}
