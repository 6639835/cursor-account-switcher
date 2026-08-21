import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ask } from '@tauri-apps/api/dialog';
import {
  Folder,
  RotateCcw,
  Power,
  PlayCircle,
  Info,
  Sun,
  Moon,
  Monitor,
  Palette,
} from 'lucide-react';
import { APP_VERSION } from '../version';
import { useTheme, type ThemePreference } from '../theme';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'Auto', icon: Monitor },
];

/**
 * Returns the adjacent theme option, wrapping at both ends of the group.
 * @param current - Currently selected theme preference
 * @param direction - `1` for next, `-1` for previous
 */
function adjacentTheme(current: ThemePreference, direction: 1 | -1): ThemePreference {
  const index = THEME_OPTIONS.findIndex((option) => option.value === current);
  const nextIndex = (index + direction + THEME_OPTIONS.length) % THEME_OPTIONS.length;
  return THEME_OPTIONS[nextIndex].value;
}

/**
 * Settings page for theme, Cursor paths, machine ID reset, and process control.
 */
function SettingsPage() {
  const [cursorPath, setCursorPath] = useState('');
  const [dataStoragePath, setDataStoragePath] = useState('');
  const [loading, setLoading] = useState(false);
  const { preference, setPreference } = useTheme();
  const themeButtonRefs = useRef<Partial<Record<ThemePreference, HTMLButtonElement | null>>>({});

  useEffect(() => {
    detectPath();
    getStoragePath();
  }, []);

  /**
   * Detects the Cursor installation path and stores it in local state.
   */
  const detectPath = async () => {
    try {
      const path = await invoke<string>('detect_cursor_path');
      setCursorPath(path);
    } catch (err) {
      console.error('Failed to detect path:', err);
    }
  };

  /**
   * Loads the local directory used to persist imported accounts.
   */
  const getStoragePath = async () => {
    try {
      const path = await invoke<string>('get_data_storage_path');
      setDataStoragePath(path);
    } catch (err) {
      console.error('Failed to get storage path:', err);
    }
  };

  /**
   * Confirms with the user, then resets Cursor's machine ID.
   */
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

  /**
   * Confirms with the user, then terminates the Cursor process.
   */
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

  /**
   * Confirms with the user, then relaunches Cursor.
   */
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
      <h2 className="text-2xl font-bold text-fg mb-6">Settings</h2>

      {/* Appearance */}
      <div className="bg-panel rounded-lg shadow-sm border border-border p-6 mb-6">
        <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
          <Palette size={20} />
          Appearance
        </h3>

        <p className="text-sm text-muted mb-4">
          Choose a light or dark theme, or follow your system preference.
        </p>

        <div
          role="radiogroup"
          aria-label="Theme"
          className="inline-flex rounded-lg border border-border p-1 bg-canvas"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = preference === option.value;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  themeButtonRefs.current[option.value] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setPreference(option.value)}
                onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                  let direction: 1 | -1 | null = null;
                  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    direction = 1;
                  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    direction = -1;
                  }
                  if (direction === null) {
                    return;
                  }
                  event.preventDefault();
                  const next = adjacentTheme(option.value, direction);
                  setPreference(next);
                  themeButtonRefs.current[next]?.focus();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selected ? 'bg-selected text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                <Icon size={16} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* System Information */}
      <div className="bg-panel rounded-lg shadow-sm border border-border p-6 mb-6">
        <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
          <Info size={20} />
          System Information
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg mb-2">
              Cursor Installation Path
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cursorPath}
                readOnly
                className="flex-1 px-4 py-2 border border-input-border rounded-lg bg-input text-fg"
              />
              <button
                onClick={detectPath}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Folder size={16} />
                Detect
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">Auto-detected Cursor globalStorage path</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-2">Database Path</label>
            <input
              type="text"
              value={cursorPath ? `${cursorPath}/state.vscdb` : ''}
              readOnly
              className="w-full px-4 py-2 border border-input-border rounded-lg bg-input text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-2">Storage Path</label>
            <input
              type="text"
              value={cursorPath ? `${cursorPath}/storage.json` : ''}
              readOnly
              className="w-full px-4 py-2 border border-input-border rounded-lg bg-input text-fg"
            />
          </div>

          <div className="pt-4 border-t border-border">
            <label className="block text-sm font-medium text-fg mb-2">Account Data Storage</label>
            <input
              type="text"
              value={dataStoragePath}
              readOnly
              className="w-full px-4 py-2 border border-input-border rounded-lg bg-input text-fg font-mono text-sm"
            />
            <p className="mt-2 text-sm text-muted">
              Your imported accounts are stored here (persists across app updates)
            </p>
          </div>
        </div>
      </div>

      {/* Machine ID Management */}
      <div className="bg-panel rounded-lg shadow-sm border border-border p-6 mb-6">
        <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
          <RotateCcw size={20} />
          Machine ID Management
        </h3>

        <p className="text-sm text-muted mb-4">
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

        <div className="mt-4 p-4 bg-warning-bg border border-warning-border rounded-lg">
          <p className="text-sm text-warning-fg">
            <strong>Note:</strong> On Windows, this operation may require administrator privileges.
            Cursor will be automatically closed during this process.
          </p>
        </div>
      </div>

      {/* Process Management */}
      <div className="bg-panel rounded-lg shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-fg mb-4 flex items-center gap-2">
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

        <p className="mt-4 text-sm text-muted">
          Use these controls to manually manage the Cursor application process.
        </p>
      </div>

      {/* About */}
      <div className="mt-6 p-4 bg-panel rounded-lg border border-border">
        <h4 className="font-semibold text-fg mb-2">About</h4>
        <p className="text-sm text-muted">
          <strong>Cursor Account Switcher</strong> - Version {APP_VERSION}
        </p>
        <p className="text-sm text-muted mt-1">Built with Tauri + React + Rust</p>
        <p className="text-sm text-muted mt-2">
          Cross-platform account management tool for Cursor AI Editor
        </p>
      </div>
    </div>
  );
}

export default SettingsPage;
