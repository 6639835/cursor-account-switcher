import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
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
    if (!confirm('Clear all logs?')) {
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
        return 'text-red-600 bg-red-50';
      case 'WARNING':
      case 'WARN':
        return 'text-yellow-600 bg-yellow-50';
      case 'INFO':
        return 'text-blue-600 bg-blue-50';
      case 'DEBUG':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Application Logs</h2>
          {logFilePath && (
            <p className="text-sm text-gray-500 mt-1">
              Log file: <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{logFilePath}</code>
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText size={16} />
            <span>Recent Activity</span>
          </div>
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No logs available</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelColor(
                      log.level,
                    )}`}
                  >
                    {log.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{log.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Logs are automatically generated as you use the application. They
          can help diagnose issues if something goes wrong.
        </p>
      </div>
    </div>
  );
}

export default LogPage;
