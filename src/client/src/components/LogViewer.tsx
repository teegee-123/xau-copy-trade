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
        params: { level, limit: 200 }, // Increased limit for better search results
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

    // Apply search filter
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
        <mark key={i} className="bg-yellow-500/30 text-yellow-300 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, []);

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      INFO: 'text-info',
      WARN: 'text-warning',
      ERROR: 'text-error',
    };
    return colors[level] || 'text-white';
  };

  const filters: { value: typeof filter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'INFO', label: 'Info' },
    { value: 'WARN', label: 'Warn' },
    { value: 'ERROR', label: 'Error' },
  ];

  const hasActiveFilters = filter !== 'ALL' || debouncedSearch.trim();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-white">System Logs</h2>

        <div className="flex gap-2 items-center flex-wrap">
          {/* Level Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="input-field text-sm min-w-[100px]"
            aria-label="Filter by log level"
          >
            {filters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="input-field text-sm pl-8 pr-8 min-w-[200px]"
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
        <div className="mb-3 text-sm text-text-muted">
          Showing {filteredLogs.length} of {logs.length} logs
          {filter !== 'ALL' && <span className="ml-2">(filtered by: {filter})</span>}
          {debouncedSearch.trim() && (
            <span className="ml-2">
              {filter !== 'ALL' ? 'and' : 'filtered by'} search: "{debouncedSearch}"
            </span>
          )}
        </div>
      )}

      {/* Logs Display */}
      <div className="bg-background-light rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
        {loading && logs.length === 0 ? (
          <div className="text-text-muted">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-text-muted">
            {debouncedSearch.trim() || filter !== 'ALL'
              ? 'No logs match your filters'
              : 'No logs available'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="py-1 border-b border-border-color last:border-0 hover:bg-white/5 transition-colors">
              <span className="text-text-muted mr-2">{log.timestamp}</span>
              <span className={`mr-2 ${getLevelColor(log.level)}`}>[{log.level}]</span>
              <span className="text-white">
                {debouncedSearch.trim()
                  ? highlightMatch(log.message, debouncedSearch)
                  : log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="mt-2 text-xs text-text-muted text-right">
        Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">Esc</kbd> to clear search
      </div>
    </div>
  );
}
