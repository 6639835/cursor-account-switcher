import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ask } from '@tauri-apps/api/dialog';
import { FileText, Trash2, Download, RefreshCw } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

function LogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [logFilePath, setLogFilePath] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const logData = await invoke<LogEntry[]>('get_logs');
      setLogs(logData.reverse()); // Show newest first
    } catch (err) {
      console.error('Failed to load logs:', err);
      alert('Failed to load logs: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const getLogPath = async () => {
    try {
      const path = await invoke<string>('get_log_file_path');
      setLogFilePath(path);
    } catch (err) {
      console.error('Failed to get log path:', err);
    }
  };

  useEffect(() => {
    loadLogs();
    getLogPath();
  }, []);

  const handleClearLogs = async () => {
    const confirmed = await ask('Are you sure you want to clear all logs?', {
      title: 'Confirm Clear',
      type: 'warning',
    });

    if (!confirmed) {
      return;
    }

    try {
      await invoke('clear_logs');
      setLogs([]);
      alert('Logs cleared successfully!');
    } catch (err) {
      alert('Failed to clear logs: ' + err);
    }
  };

  const handleExportLogs = () => {
    const logText = logs
      .map((log) => `[${log.timestamp}] [${log.level}] ${log.message}`)
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cursor-switcher-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'text-danger-fg bg-danger-bg';
      case 'WARNING':
      case 'WARN':
        return 'text-warning-fg bg-warning-bg';
      case 'INFO':
        return 'text-info-fg bg-info-bg';
      case 'DEBUG':
        return 'text-fg bg-code';
      default:
        return 'text-fg bg-code';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg">Application Logs</h2>
          {logFilePath && (
            <p className="text-sm text-muted mt-1">
              Log file: <code className="text-xs bg-code px-2 py-0.5 rounded">{logFilePath}</code>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportLogs}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Trash2 size={16} />
            Clear
          </button>
        </div>
      </div>

      <div className="bg-panel rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="p-4 bg-input border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted">
            <FileText size={16} />
            <span>Recent Activity</span>
          </div>
        </div>

        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted">No logs available</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="p-4 hover:bg-hover transition-colors">
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelColor(
                      log.level,
                    )}`}
                  >
                    {log.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg">{log.message}</p>
                    <p className="text-xs text-muted mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 p-4 bg-info-bg border border-info-border rounded-lg">
        <p className="text-sm text-info-fg">
          <strong>Tip:</strong> Logs are automatically generated as you use the application. They
          can help diagnose issues if something goes wrong.
        </p>
      </div>
    </div>
  );
}

export default LogPage;
