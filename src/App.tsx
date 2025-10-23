import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Home, Users, Settings, FileText } from 'lucide-react';
import HomePage from './pages/HomePage';
import AccountPage from './pages/AccountPage';
import SettingsPage from './pages/SettingsPage';
import LogPage from './pages/LogPage';
import { APP_VERSION } from './version';
import { AccountInfo, UsageInfo } from './types';

type TabType = 'home' | 'accounts' | 'settings' | 'logs';

// Cache duration constant (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [cursorPath, setCursorPath] = useState<string>('');

  // Lift account/usage state to App level to prevent re-fetching on navigation
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cache timestamp to avoid unnecessary refetches
  const lastFetchTime = useRef<number>(0);

  const detectPath = async () => {
    try {
      const path = await invoke<string>('detect_cursor_path');
      setCursorPath(path);
      await invoke('set_cursor_path', { path });
    } catch (error) {
      console.error('Failed to detect Cursor path:', error);
    }
  };

  const loadAccountInfo = useCallback(
    async (forceRefresh = false) => {
      // Check cache - skip if data is fresh and not forcing refresh
      const now = Date.now();
      if (!forceRefresh && accountInfo && now - lastFetchTime.current < CACHE_DURATION) {
        return; // Use cached data
      }

      setLoading(true);
      setError('');

      try {
        // Fetch both API calls in parallel for better performance
        const [info, usage] = await Promise.all([
          invoke<AccountInfo>('get_current_account_info'),
          invoke<UsageInfo>('get_usage_info'),
        ]);

        setAccountInfo(info);
        setUsageInfo(usage);
        lastFetchTime.current = now;
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [accountInfo],
  );

  useEffect(() => {
    // Detect Cursor path on startup
    detectPath();
    // Load account info on startup
    loadAccountInfo();
  }, [loadAccountInfo]);

  const tabs = [
    { id: 'home' as TabType, name: 'Home', icon: Home },
    { id: 'accounts' as TabType, name: 'Accounts', icon: Users },
    { id: 'logs' as TabType, name: 'Logs', icon: FileText },
    { id: 'settings' as TabType, name: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Cursor Switcher</h1>
          <p className="text-sm text-gray-500 mt-1">Account Manager</p>
        </div>

        <nav className="flex-1 p-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                  currentTab === tab.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{tab.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">Version {APP_VERSION}</p>
          {cursorPath && (
            <p className="text-xs text-gray-400 mt-1 truncate" title={cursorPath}>
              Path: {cursorPath}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {currentTab === 'home' && (
          <HomePage
            accountInfo={accountInfo}
            usageInfo={usageInfo}
            loading={loading}
            error={error}
            onRefresh={() => loadAccountInfo(true)}
          />
        )}
        {currentTab === 'accounts' && <AccountPage />}
        {currentTab === 'settings' && <SettingsPage />}
        {currentTab === 'logs' && <LogPage />}
      </div>
    </div>
  );
}

export default App;
