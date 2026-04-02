import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  rawLine: string;
}

export function LogViewer() {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [filter, setFilter] = React.useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = React.useState(false);

  // Debounce search query (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Escape key to clear search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const level = filter === 'ALL' ? undefined : filter;
      const response = await axios.get('/api/logs', {
        params: { level, limit: 200 },
      });

      if (response.data.success) {
        const parsedLogs = response.data.logs.map((line: string) => {
          const match = line.match(/\[(\w+)\]\s+(.+)/);
          return {
            timestamp: line.split(' ')[0] + ' ' + line.split(' ')[1],
            level: match?.[1] || 'INFO',
            message: match?.[2] || line,
            rawLine: line,
          };
        });
        setLogs(parsedLogs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    fetchLogs();

    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const clearLogs = async () => {
    try {
      await axios.post('/api/logs/clear');
      fetchLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  // Filter logs by level and search query
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(log =>
        log.rawLine.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [logs, debouncedSearch]);

  // Highlight matching text in search results
  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-500/30 text-yellow-300 rounded px-1">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, []);

  const getLevelConfig = (level: string) => {
    const config: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
      INFO: {
        color: 'text-info',
        bg: 'bg-info/10',
        icon: (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        ),
      },
      WARN: {
        color: 'text-warning',
        bg: 'bg-warning/10',
        icon: (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ),
      },
      ERROR: {
        color: 'text-error',
        bg: 'bg-error/10',
        icon: (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        ),
      },
    };
    return config[level] || { color: 'text-white', bg: 'bg-white/10', icon: null };
  };

  const filters: { value: typeof filter; label: string; count: number }[] = [
    { value: 'ALL', label: 'All', count: logs.length },
    { value: 'INFO', label: 'Info', count: logs.filter(l => l.level === 'INFO').length },
    { value: 'WARN', label: 'Warn', count: logs.filter(l => l.level === 'WARN').length },
    { value: 'ERROR', label: 'Error', count: logs.filter(l => l.level === 'ERROR').length },
  ];

  const hasActiveFilters = filter !== 'ALL' || debouncedSearch.trim();

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          System Logs
        </h2>

        <div className="flex gap-2 items-center flex-wrap">
          {/* Level Filter */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                  filter === f.value
                    ? 'bg-primary text-black shadow-lg shadow-primary/30'
                    : 'text-text-muted hover:text-white hover:bg-white/10'
                }`}
              >
                {f.label}
                <span className={`px-1 py-0.5 rounded text-[10px] ${
                  filter === f.value ? 'bg-black/20' : 'bg-white/10'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="input-field text-sm pl-9 pr-8 w-48 sm:w-56"
              aria-label="Search logs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Clear Logs Button */}
          <button onClick={clearLogs} className="btn-secondary text-sm">
            Clear
          </button>
        </div>
      </div>

      {/* Result Count */}
      {hasActiveFilters && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg flex items-center justify-between text-sm">
          <span className="text-text-muted">
            Showing <span className="text-white font-semibold">{filteredLogs.length}</span> of <span className="text-white font-semibold">{logs.length}</span> logs
          </span>
          {(filter !== 'ALL' || debouncedSearch.trim()) && (
            <button
              onClick={() => { setFilter('ALL'); setSearchQuery(''); }}
              className="text-primary hover:text-primary-dark transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Logs Display */}
      <div className="bg-[#0d0d0d] rounded-xl p-4 h-96 overflow-y-auto font-mono text-sm border border-white/5">
        {loading && logs.length === 0 ? (
          <div className="flex items-center gap-3 text-text-muted">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {debouncedSearch.trim() || filter !== 'ALL'
              ? 'No logs match your filters'
              : 'No logs available'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, index) => {
              const levelConfig = getLevelConfig(log.level);
              return (
                <div 
                  key={index} 
                  className="py-2 px-3 rounded-lg hover:bg-white/5 transition-colors group animate-slide-up"
                  style={{ animationDelay: `${Math.min(index * 10, 500)}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-text-muted text-xs font-mono whitespace-nowrap mt-0.5">
                      {log.timestamp}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${levelConfig.bg} ${levelConfig.color}`}>
                      {levelConfig.icon}
                      [{log.level}]
                    </span>
                    <span className="text-text-secondary flex-1 break-all">
                      {debouncedSearch.trim()
                        ? highlightMatch(log.message, debouncedSearch)
                        : log.message}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="mt-3 flex items-center justify-end text-xs text-text-muted">
        <span>Press </span>
        <kbd className="mx-1.5 px-2 py-1 bg-white/10 rounded text-[10px] font-mono border border-white/5">Esc</kbd>
        <span>to clear search</span>
      </div>
    </div>
  );
}
