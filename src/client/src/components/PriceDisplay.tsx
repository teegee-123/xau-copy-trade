import React from 'react';
import type { PriceData } from '../types';

interface PriceDisplayProps {
  price: PriceData | null;
  warning?: string;
  loading?: boolean;
}

export function PriceDisplay({ price, warning, loading }: PriceDisplayProps) {
  const previousPriceRef = React.useRef<number | null>(null);
  const [priceDirection, setPriceDirection] = React.useState<'up' | 'down' | 'neutral'>('neutral');
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (price && previousPriceRef.current) {
      if (price.price > previousPriceRef.current) {
        setPriceDirection('up');
        setIsAnimating(true);
      } else if (price.price < previousPriceRef.current) {
        setPriceDirection('down');
        setIsAnimating(true);
      }
      
      // Reset animation state
      const timer = setTimeout(() => {
        setPriceDirection('neutral');
        setIsAnimating(false);
      }, 600);
      
      return () => clearTimeout(timer);
    }

    if (price) {
      previousPriceRef.current = price.price;
    }
  }, [price]);

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-5 w-20 bg-white/5 rounded mb-3 skeleton" />
            <div className="h-12 w-48 rounded skeleton" />
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <div className="h-4 w-10 bg-white/5 rounded mb-2 skeleton" />
              <div className="h-8 w-20 rounded skeleton" />
            </div>
            <div className="text-right">
              <div className="h-4 w-10 bg-white/5 rounded mb-2 skeleton" />
              <div className="h-8 w-20 rounded skeleton" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const priceChangeClass = priceDirection === 'up' 
    ? 'animate-flash-up text-success' 
    : priceDirection === 'down' 
      ? 'animate-flash-down text-error' 
      : 'text-white';

  return (
    <div className="card relative overflow-hidden">
      {/* Animated gradient border on price change */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
        priceDirection === 'up' ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-r from-success/10 via-transparent to-transparent" />
      </div>
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
        priceDirection === 'down' ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-r from-error/10 via-transparent to-transparent" />
      </div>

      {warning && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-3 animate-slide-down">
          <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-warning text-sm">{warning}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-text-muted text-sm font-medium tracking-wide">XAU/USD</span>
          </div>
          <div
            className={`text-4xl sm:text-5xl font-bold tracking-tight transition-all duration-300 ${priceChangeClass} ${
              isAnimating ? 'scale-105' : 'scale-100'
            }`}
          >
            {price?.price ? price.price.toFixed(2) : '---.---'}
          </div>
        </div>

        {price && (
          <div className="flex gap-6 sm:gap-8">
            <div className="text-right group">
              <div className="flex items-center gap-1.5 justify-end mb-1">
                <div className="w-2 h-2 rounded-full bg-success/50" />
                <span className="text-text-muted text-xs font-medium">BID</span>
              </div>
              <div className="text-xl font-bold text-success group-hover:scale-110 transition-transform duration-200">
                {price.bid?.toFixed(2) || (price.price - 0.10).toFixed(2)}
              </div>
            </div>
            <div className="text-right group">
              <div className="flex items-center gap-1.5 justify-end mb-1">
                <div className="w-2 h-2 rounded-full bg-error/50" />
                <span className="text-text-muted text-xs font-medium">ASK</span>
              </div>
              <div className="text-xl font-bold text-error group-hover:scale-110 transition-transform duration-200">
                {price.ask?.toFixed(2) || (price.price + 0.10).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-text-muted">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Updated: {price ? new Date(price.timestamp).toLocaleTimeString() : '--:--:--'}</span>
        </div>
        <span className="text-white/20">•</span>
        <div className="flex items-center gap-1.5 text-text-muted">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Source: {price?.source || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}
