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
// Auto-refresh interval (30 seconds) - only when on home tab and visible
const AUTO_REFRESH_INTERVAL = 30 * 1000;

function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');

  // Lift account/usage state to App level to prevent re-fetching on navigation
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Cache timestamp to avoid unnecessary refetches
  const lastFetchTime = useRef<number>(0);
  const autoRefreshTimer = useRef<number | null>(null);
  const isFirstMount = useRef(true);

  const detectPath = async () => {
    try {
      const path = await invoke<string>('detect_cursor_path');
      await invoke('set_cursor_path', { path });
    } catch (error) {
      console.error('Failed to detect Cursor path:', error);
    }
  };

  const loadAccountInfo = useCallback(async (forceRefresh = false) => {
    // Check cache - skip if data is fresh and not forcing refresh
    const now = Date.now();
    const hasValidCache = lastFetchTime.current > 0 && now - lastFetchTime.current < CACHE_DURATION;

    if (!forceRefresh && hasValidCache) {
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
      setLastRefreshTime(new Date());
    } catch (err) {
      setError(String(err));
      // On error, clear the last fetch time so next attempt won't be blocked by cache
      lastFetchTime.current = 0;
    } finally {
      setLoading(false);
    }
  }, []); // Remove accountInfo from dependencies to prevent recreation

  // Setup auto-refresh interval when on home tab
  useEffect(() => {
    // Clear any existing timer
    if (autoRefreshTimer.current) {
      clearInterval(autoRefreshTimer.current);
      autoRefreshTimer.current = null;
    }

    // Only auto-refresh when on home tab
    if (currentTab === 'home') {
      autoRefreshTimer.current = setInterval(() => {
        // Only auto-refresh if document is visible
        if (!document.hidden) {
          loadAccountInfo(false); // Use cache logic
        }
      }, AUTO_REFRESH_INTERVAL);
    }

    return () => {
      if (autoRefreshTimer.current) {
        clearInterval(autoRefreshTimer.current);
        autoRefreshTimer.current = null;
      }
    };
  }, [currentTab, loadAccountInfo]);

  // Handle visibility change - refresh when becoming visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentTab === 'home') {
        // Check if cache is stale before refreshing
        const now = Date.now();
        if (now - lastFetchTime.current > CACHE_DURATION) {
          loadAccountInfo(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentTab, loadAccountInfo]);

  // Initial load and path detection
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      // Detect Cursor path on startup
      detectPath();
      // Load account info on startup
      loadAccountInfo(true);
    }
  }, []); // Empty dependency array - only run once on mount

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
            lastRefreshTime={lastRefreshTime}
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
