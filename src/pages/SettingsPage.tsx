import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ask } from '@tauri-apps/api/dialog';
import { Folder, RotateCcw, Power, PlayCircle, Info } from 'lucide-react';
import { APP_VERSION } from '../version';

function SettingsPage() {
  const [cursorPath, setCursorPath] = useState('');
  const [dataStoragePath, setDataStoragePath] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    detectPath();
    getStoragePath();
  }, []);

  const detectPath = async () => {
    try {
      const path = await invoke<string>('detect_cursor_path');
      setCursorPath(path);
    } catch (err) {
      console.error('Failed to detect path:', err);
    }
  };

  const getStoragePath = async () => {
    try {
      const path = await invoke<string>('get_data_storage_path');
      setDataStoragePath(path);
    } catch (err) {
      console.error('Failed to get storage path:', err);
    }
  };

  const handleResetMachineId = async () => {
    const confirmed = await ask(
      'Are you sure you want to reset the machine ID? This will close Cursor.',
      {
        title: 'Confirm Reset',
        type: 'warning',
      },
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      await invoke('reset_machine_id');
      alert('Machine ID reset successfully! Please restart Cursor to apply changes.');
    } catch (err) {
      alert('Failed to reset machine ID: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleKillCursor = async () => {
    const confirmed = await ask('Are you sure you want to close Cursor?', {
      title: 'Confirm Kill',
      type: 'warning',
    });

    if (!confirmed) {
      return;
    }

    try {
      await invoke('kill_cursor_process');
      alert('Cursor process has been terminated.');
    } catch (err) {
      alert('Failed to kill Cursor process: ' + err);
    }
  };

  const handleRestartCursor = async () => {
    const confirmed = await ask('Are you sure you want to restart Cursor?', {
      title: 'Confirm Restart',
      type: 'warning',
    });

    if (!confirmed) {
      return;
    }

    try {
      await invoke('restart_cursor_process', { cursorAppPath: null });
      alert('Cursor is starting...');
    } catch (err) {
      alert('Failed to restart Cursor: ' + err);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

      {/* System Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Info size={20} />
          System Information
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cursor Installation Path
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cursorPath}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
              <button
                onClick={detectPath}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Folder size={16} />
                Detect
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">Auto-detected Cursor globalStorage path</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Database Path</label>
            <input
              type="text"
              value={cursorPath ? `${cursorPath}/state.vscdb` : ''}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Storage Path</label>
            <input
              type="text"
              value={cursorPath ? `${cursorPath}/storage.json` : ''}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div className="pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Data Storage
            </label>
            <input
              type="text"
              value={dataStoragePath}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-mono text-sm"
            />
            <p className="mt-2 text-sm text-gray-500">
              Your imported accounts are stored here (persists across app updates)
            </p>
          </div>
        </div>
      </div>

      {/* Machine ID Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <RotateCcw size={20} />
          Machine ID Management
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Resetting the machine ID can help when switching accounts. This will modify the system
          registry (Windows) or configuration files (Mac/Linux) and close Cursor.
        </p>

        <button
          onClick={handleResetMachineId}
          disabled={loading}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Resetting...' : 'Reset Machine ID'}
        </button>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> On Windows, this operation may require administrator privileges.
            Cursor will be automatically closed during this process.
          </p>
        </div>
      </div>

      {/* Process Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Power size={20} />
          Process Management
        </h3>

        <div className="space-y-3">
          <button
            onClick={handleKillCursor}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <Power size={16} />
            Close Cursor
          </button>

          <button
            onClick={handleRestartCursor}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <PlayCircle size={16} />
            Restart Cursor
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Use these controls to manually manage the Cursor application process.
        </p>
      </div>

      {/* About */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-gray-800 mb-2">About</h4>
        <p className="text-sm text-gray-600">
          <strong>Cursor Account Switcher</strong> - Version {APP_VERSION}
        </p>
        <p className="text-sm text-gray-600 mt-1">Built with Tauri + React + Rust</p>
        <p className="text-sm text-gray-500 mt-2">
          Cross-platform account management tool for Cursor AI Editor
        </p>
      </div>
    </div>
  );
}

export default SettingsPage;
