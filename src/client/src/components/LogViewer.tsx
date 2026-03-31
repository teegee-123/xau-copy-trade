import React from 'react';
import axios from 'axios';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface LogViewerProps {
  autoScroll?: boolean;
}

export function LogViewer({ autoScroll = true }: LogViewerProps) {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [filter, setFilter] = React.useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [loading, setLoading] = React.useState(false);
  const logsEndRef = React.useRef<HTMLDivElement>(null);

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const level = filter === 'ALL' ? undefined : filter;
      const response = await axios.get('/api/logs', {
        params: { level, limit: 100 },
      });
      
      if (response.data.success) {
        const parsedLogs = response.data.logs.map((line: string) => {
          const match = line.match(/\[(\w+)\]\s+(.+)/);
          return {
            timestamp: line.split(' ')[0] + ' ' + line.split(' ')[1],
            level: match?.[1] || 'INFO',
            message: match?.[2] || line,
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

  React.useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const clearLogs = async () => {
    try {
      await axios.post('/api/logs/clear');
      fetchLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

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

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">System Logs</h2>
        
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="input-field text-sm"
          >
            {filters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          
          <button onClick={clearLogs} className="btn-secondary text-sm">
            Clear
          </button>
        </div>
      </div>

      <div className="bg-background-light rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
        {loading && logs.length === 0 ? (
          <div className="text-text-muted">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-text-muted">No logs available</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="py-1 border-b border-border-color last:border-0">
              <span className="text-text-muted mr-2">{log.timestamp}</span>
              <span className={`mr-2 ${getLevelColor(log.level)}`}>[{log.level}]</span>
              <span className="text-white">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={() => {}} // Controlled by parent if needed
            className="rounded border-border-color bg-background-light"
          />
          Auto-scroll to latest
        </label>
      </div>
    </div>
  );
}
