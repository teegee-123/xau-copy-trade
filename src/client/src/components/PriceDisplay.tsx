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

  React.useEffect(() => {
    if (price && previousPriceRef.current) {
      if (price.price > previousPriceRef.current) {
        setPriceDirection('up');
      } else if (price.price < previousPriceRef.current) {
        setPriceDirection('down');
      }
    }

    if (price) {
      previousPriceRef.current = price.price;

      // Reset direction after animation
      const timer = setTimeout(() => setPriceDirection('neutral'), 500);
      return () => clearTimeout(timer);
    }
  }, [price]);

  if (loading) {
    return (
      <div className="card">
        <div className="h-20 bg-background-light rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card">
      {warning && (
        <div className="mb-3 p-2 bg-warning bg-opacity-10 border border-warning rounded flex items-start gap-2">
          <svg className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-warning text-xs">{warning}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-4">
        <div className="flex-1">
          <div className="text-text-muted text-sm mb-1">XAU/USD</div>
          <div
            className={`text-3xl sm:text-4xl font-bold transition-colors duration-300 ${
              priceDirection === 'up' ? 'text-success' :
              priceDirection === 'down' ? 'text-error' : 'text-white'
            }`}
          >
            {price?.price ? price.price.toFixed(2) : '---.---'}
          </div>
        </div>

        {price && (
          <>
            <div className="text-right">
              <div className="text-text-muted text-xs">Bid</div>
              <div className="text-lg font-semibold text-success">
                {price.bid?.toFixed(2) || (price.price - 0.10).toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-text-muted text-xs">Ask</div>
              <div className="text-lg font-semibold text-error">
                {price.ask?.toFixed(2) || (price.price + 0.10).toFixed(2)}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
        {price ? (
          <>
            <span>Source: {price.source}</span>
            <span>•</span>
            <span>Updated: {new Date(price.timestamp).toLocaleTimeString()}</span>
          </>
        ) : (
          <span className="text-error">No price data available</span>
        )}
      </div>
    </div>
  );
}
