import React from 'react';
import type { PriceData } from '../types';

interface PriceDisplayProps {
  price: PriceData | null;
  loading?: boolean;
}

export function PriceDisplay({ price, loading }: PriceDisplayProps) {
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

      {price && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span>Source: {price.source}</span>
          <span>•</span>
          <span>Updated: {new Date(price.timestamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
