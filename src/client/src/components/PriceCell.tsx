import { useEffect, useRef, useState } from 'react';

interface PriceCellProps {
  price: number | null;
  decimals?: number;
}

export function PriceCell({ price, decimals = 2 }: PriceCellProps) {
  const previousPriceRef = useRef<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (price === null) return;

    if (previousPriceRef.current !== null) {
      if (price > previousPriceRef.current) {
        setPriceDirection('up');
        setIsPulsing(true);
      } else if (price < previousPriceRef.current) {
        setPriceDirection('down');
        setIsPulsing(true);
      }
    }

    previousPriceRef.current = price;

    // Reset pulse after 1 second
    const timer = setTimeout(() => {
      setPriceDirection('neutral');
      setIsPulsing(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [price]);

  if (price === null) {
    return <span className="text-text-muted">---</span>;
  }

  const directionClass = isPulsing
    ? priceDirection === 'up'
      ? 'animate-pulse-up'
      : priceDirection === 'down'
        ? 'animate-pulse-down'
        : ''
    : '';

  const arrowDirection = priceDirection === 'up' ? '↑' : priceDirection === 'down' ? '↓' : '';

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${directionClass}`}>
      <span className={priceDirection === 'up' ? 'text-success' : priceDirection === 'down' ? 'text-error' : 'text-white'}>
        {price.toFixed(decimals)}
      </span>
      {isPulsing && (
        <span className={`text-xs ${priceDirection === 'up' ? 'text-success' : 'text-error'}`}>
          {arrowDirection}
        </span>
      )}
    </span>
  );
}
