import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import type { EquitySnapshot } from '../types';

interface EquityChartProps {
  range: '1D' | '1W' | '1M' | 'ALL';
  onRangeChange?: (range: '1D' | '1W' | '1M' | 'ALL') => void;
}

export function EquityChart({ range, onRangeChange }: EquityChartProps) {
  const [data, setData] = React.useState<EquitySnapshot[]>([]);
  const [currentEquity, setCurrentEquity] = React.useState<number>(10000);
  const [loading, setLoading] = React.useState(true);

  const fetchEquity = React.useCallback(async () => {
    try {
      const response = await axios.get(`/api/equity?range=${range}`);
      if (response.data.success) {
        setData(response.data.snapshots);
        setCurrentEquity(response.data.currentEquity);
      }
    } catch (error) {
      console.error('Failed to fetch equity data:', error);
    } finally {
      setLoading(false);
    }
  }, [range]);

  React.useEffect(() => {
    fetchEquity();
  }, [fetchEquity]);

  const ranges: { value: typeof range; label: string }[] = [
    { value: '1D', label: '1D' },
    { value: '1W', label: '1W' },
    { value: '1M', label: '1M' },
    { value: 'ALL', label: 'All' },
  ];

  // Transform data for chart
  const chartData = data.map((snapshot) => ({
    time: new Date(snapshot.timestamp).toLocaleTimeString(),
    equity: snapshot.totalEquity || currentEquity,
    pnl: snapshot.totalPnl,
  }));

  if (loading) {
    return (
      <div className="card">
        <div className="h-64 bg-background-light rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Equity Curve</h2>
          <div className="text-2xl font-bold text-primary mt-1">
            ${currentEquity.toFixed(2)}
          </div>
        </div>
        
        <div className="flex gap-2">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => onRangeChange?.(r.value)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                range === r.value
                  ? 'bg-primary text-black'
                  : 'bg-background-light text-text-muted hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              dataKey="time" 
              stroke="#666"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="#666"
              tick={{ fontSize: 12 }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px',
              }}
              labelStyle={{ color: '#888' }}
              formatter={(value) => {
                const numValue = typeof value === 'number' ? value : Number(value);
                return [`$${numValue.toFixed(2)}`, 'Equity'];
              }}
            />
            <Line
              type="monotone"
              dataKey="equity"
              stroke="#00ff00"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#00ff00' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
