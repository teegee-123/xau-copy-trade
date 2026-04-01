import React from 'react';
import type { SystemStatus } from '../types';

interface StatusChipProps {
  label: string;
  status: 'connected' | 'disconnected' | 'warning';
  icon?: React.ReactNode;
}

function StatusChip({ label, status, icon }: StatusChipProps) {
  const statusColors = {
    connected: 'bg-success text-black',
    disconnected: 'bg-error text-white',
    warning: 'bg-warning text-black animate-pulse-warning',
  };

  const statusLabels = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    warning: 'Warning',
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-text-muted text-sm">{label}:</span>
      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${statusColors[status]}`}>
        {icon}
        <span>{statusLabels[status]}</span>
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
        <div className="h-8 w-32 bg-background-card rounded animate-pulse" />
        <div className="h-8 w-32 bg-background-card rounded animate-pulse" />
        <div className="h-8 w-32 bg-background-card rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 sm:gap-4">
      <StatusChip
        label="Telegram"
        status={status.telegram.connected ? 'connected' : status.telegram.error ? 'disconnected' : 'warning'}
        icon={
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.44-.42-1.38-.88.03-.24.37-.49 1.03-.74 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.89 5.17-1.9.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.26z"/>
          </svg>
        }
      />

      <StatusChip
        label="Price API"
        status={status.price.connected ? 'connected' : 'disconnected'}
        icon={
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />

      <StatusChip
        label="Trading"
        status={status.trading.enabled ? 'connected' : 'warning'}
        icon={
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}
