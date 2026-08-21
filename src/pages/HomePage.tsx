import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ask } from '@tauri-apps/api/dialog';
import { AccountInfo, UsageInfo } from '../types';
import { RefreshCw, User, Calendar, TrendingUp, DollarSign, Clock } from 'lucide-react';

interface HomePageProps {
  accountInfo: AccountInfo | null;
  usageInfo: UsageInfo | null;
  loading: boolean;
  error: string;
  lastRefreshTime: Date | null;
  onRefresh: () => void;
}

/**
 * Formats a timestamp as a short relative string such as "3 minutes ago".
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 10) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  return date.toLocaleString();
}

function HomePage({
  accountInfo,
  usageInfo,
  loading,
  error,
  lastRefreshTime,
  onRefresh,
}: HomePageProps) {
  const [, setNow] = useState(new Date());

  // Update the current time every second to make the relative time dynamic
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

    try {
      await invoke('reset_machine_id');
      alert('Machine ID reset successfully! Please restart Cursor to apply changes.');
    } catch (err) {
      alert('Failed to reset machine ID: ' + err);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg">Dashboard</h2>
          {lastRefreshTime && (
            <div className="flex items-center gap-2 mt-1 text-sm text-muted">
              <Clock size={14} />
              <span>Last updated: {formatRelativeTime(lastRefreshTime)}</span>
            </div>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          title="Manually refresh data (Auto-refresh every 30s)"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger-bg border border-danger-border rounded-lg text-danger-fg">
          {error}
        </div>
      )}

      {/* Account Info Card */}
      <div className="bg-panel rounded-lg shadow-sm border border-border p-6 mb-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Current Account</h3>

        {accountInfo ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="text-icon" size={20} />
              <div>
                <p className="text-sm text-muted">Email</p>
                <p className="font-medium text-fg">{accountInfo.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <TrendingUp className="text-icon" size={20} />
              <div>
                <p className="text-sm text-muted">Account Type</p>
                <p className="font-medium text-fg capitalize">
                  {accountInfo.membership_type}
                  {accountInfo.is_student && ' (Student)'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="text-icon" size={20} />
              <div>
                <p className="text-sm text-muted">Days Remaining</p>
                <p className="font-medium text-fg">
                  {accountInfo.days_remaining < 0 ? (
                    <span className="text-muted italic">—</span>
                  ) : (
                    `${accountInfo.days_remaining.toFixed(1)} days`
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted">Loading account information...</p>
        )}
      </div>

      {/* Usage Info Card */}
      <div className="bg-panel rounded-lg shadow-sm border border-border p-6 mb-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Usage Statistics</h3>

        {usageInfo ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <DollarSign className="text-icon" size={20} />
              <div className="flex-1">
                <p className="text-sm text-muted">Quota Usage</p>
                <div className="mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted">
                      {usageInfo.used.toFixed(2)} / {usageInfo.total_quota.toFixed(2)}
                    </span>
                    <span className="font-medium text-fg">
                      {usageInfo.usage_percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-track rounded-full h-2.5">
                    <div
                      className="bg-accent h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(usageInfo.usage_percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-sm text-muted">Used</p>
                <p className="text-lg font-semibold text-fg">${usageInfo.used.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Remaining</p>
                <p className="text-lg font-semibold text-success">
                  ${usageInfo.remaining.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted">Loading usage information...</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-panel rounded-lg shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Quick Actions</h3>

        <button
          onClick={handleResetMachineId}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Reset Machine ID
        </button>
      </div>
    </div>
  );
}

export default HomePage;
