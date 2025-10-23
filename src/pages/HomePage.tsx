import { invoke } from '@tauri-apps/api/tauri';
import { AccountInfo, UsageInfo } from '../types';
import { RefreshCw, User, Calendar, TrendingUp, DollarSign } from 'lucide-react';

interface HomePageProps {
  accountInfo: AccountInfo | null;
  usageInfo: UsageInfo | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

function HomePage({ accountInfo, usageInfo, loading, error, onRefresh }: HomePageProps) {
  const handleResetMachineId = async () => {
    if (!confirm('Are you sure you want to reset the machine ID? This will close Cursor.')) {
      return;
    }

    try {
      await invoke('reset_machine_id');
      alert('Machine ID reset successfully! Please restart Cursor.');
    } catch (err) {
      alert('Failed to reset machine ID: ' + err);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Account Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Account</h3>

        {accountInfo ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="text-blue-600" size={20} />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-800">{accountInfo.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <TrendingUp className="text-green-600" size={20} />
              <div>
                <p className="text-sm text-gray-500">Account Type</p>
                <p className="font-medium text-gray-800 capitalize">
                  {accountInfo.membership_type}
                  {accountInfo.is_student && ' (Student)'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="text-purple-600" size={20} />
              <div>
                <p className="text-sm text-gray-500">Days Remaining</p>
                <p className="font-medium text-gray-800">
                  {accountInfo.days_remaining < 0 ? (
                    <span className="text-gray-400 italic">—</span>
                  ) : (
                    `${accountInfo.days_remaining.toFixed(1)} days`
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading account information...</p>
        )}
      </div>

      {/* Usage Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Usage Statistics</h3>

        {usageInfo ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <DollarSign className="text-blue-600" size={20} />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Quota Usage</p>
                <div className="mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">
                      {usageInfo.used.toFixed(2)} / {usageInfo.total_quota.toFixed(2)}
                    </span>
                    <span className="font-medium text-gray-800">
                      {usageInfo.usage_percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(usageInfo.usage_percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-500">Used</p>
                <p className="text-lg font-semibold text-gray-800">${usageInfo.used.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Remaining</p>
                <p className="text-lg font-semibold text-green-600">
                  ${usageInfo.remaining.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading usage information...</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>

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
