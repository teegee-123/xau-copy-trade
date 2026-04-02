import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  const [equityTrend, setEquityTrend] = React.useState<'up' | 'down' | 'neutral'>('neutral');

  const fetchEquity = React.useCallback(async () => {
    try {
      const response = await axios.get(`/api/equity?range=${range}`);
      if (response.data.success) {
        const newEquity = response.data.currentEquity;
        setCurrentEquity(newEquity);
        
        if (newEquity > currentEquity) setEquityTrend('up');
        else if (newEquity < currentEquity) setEquityTrend('down');
        else setEquityTrend('neutral');
        
        setData(response.data.snapshots);
      }
    } catch (error) {
      console.error('Failed to fetch equity data:', error);
    } finally {
      setLoading(false);
    }
  }, [range, currentEquity]);

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
    time: new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    equity: snapshot.totalEquity || currentEquity,
    pnl: snapshot.totalPnl,
  }));

  const equityChangePercent = ((currentEquity - 10000) / 10000) * 100;

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="h-5 w-24 bg-white/5 rounded mb-2 skeleton" />
            <div className="h-8 w-32 rounded skeleton" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 w-14 rounded skeleton" />
            ))}
          </div>
        </div>
        <div className="h-64 rounded skeleton" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-white">Equity Curve</h2>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              equityTrend === 'up' ? 'bg-success/20 text-success' : 
              equityTrend === 'down' ? 'bg-error/20 text-error' : 
              'bg-white/10 text-text-muted'
            }`}>
              {equityTrend === 'up' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              )}
              {equityTrend === 'down' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              )}
              {equityTrend === 'up' ? '+' : ''}{equityChangePercent.toFixed(2)}%
            </div>
          </div>
          <div className={`text-3xl font-bold tracking-tight transition-all duration-300 ${
            equityTrend === 'up' ? 'text-success' : 
            equityTrend === 'down' ? 'text-error' : 
            'text-white'
          }`}>
            ${currentEquity.toFixed(2)}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => onRangeChange?.(r.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                range === r.value
                  ? 'bg-primary text-black shadow-lg shadow-primary/30 scale-105'
                  : 'bg-white/5 text-text-muted hover:text-white hover:bg-white/10'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="equityStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00ff88"/>
                <stop offset="100%" stopColor="#00cc6a"/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#4b5563"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              stroke="#4b5563"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              tickMargin={8}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 17, 17, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              }}
              labelStyle={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}
              formatter={(value) => {
                const numValue = typeof value === 'number' ? value : Number(value);
                return [`$${numValue.toFixed(2)}`, 'Equity'];
              }}
              cursor={{ stroke: 'rgba(0, 255, 136, 0.3)', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="url(#equityStroke)"
              strokeWidth={2.5}
              fill="url(#equityGradient)"
              dot={false}
              activeDot={{ 
                r: 5, 
                fill: '#00ff88',
                stroke: '#000',
                strokeWidth: 2,
                filter: 'drop-shadow(0 0 8px rgba(0, 255, 136, 0.6))'
              }}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
