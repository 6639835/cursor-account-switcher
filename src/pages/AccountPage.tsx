import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ask } from '@tauri-apps/api/dialog';
import { Account, AccountInfo } from '../types';
import {
  RefreshCw,
  Plus,
  Trash2,
  RotateCcw,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface AccountPageProps {
  accountInfo: AccountInfo | null;
  accounts: Account[];
  loading: boolean;
  lastRefreshTime: Date | null;
  onRefresh: () => void;
  onAccountsUpdate: (accounts: Account[]) => void;
  onRefreshTimeUpdate: (time: Date) => void;
  onRefreshHome: () => void;
}

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

function AccountPage({
  accountInfo,
  accounts,
  loading,
  lastRefreshTime,
  onRefresh,
  onAccountsUpdate,
  onRefreshTimeUpdate,
  onRefreshHome,
}: AccountPageProps) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [, setNow] = useState(new Date());

  // Update the current time every second to make the relative time dynamic
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (email: string) => {
    const confirmed = await ask(`Delete account ${email}?`, {
      title: 'Confirm Delete',
      type: 'warning',
    });

    if (!confirmed) {
      return;
    }

    try {
      await invoke('delete_account', { email });
      alert(`Account ${email} deleted successfully!`);
      onRefresh();
    } catch (err) {
      alert('Failed to delete account: ' + err);
    }
  };

  const handleSwitch = async (account: Account) => {
    // Check if switching to the already active account
    if (accountInfo && accountInfo.email === account.email) {
      alert('This account is already active!');
      return;
    }

    const confirmed = await ask(`Switch to account ${account.email}?`, {
      title: 'Confirm Switch',
      type: 'info',
    });

    if (!confirmed) {
      return;
    }

    try {
      await invoke('switch_account', {
        email: account.email,
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        resetMachine: true,
      });
      alert('Account switched successfully! Cursor has been closed. Please restart it.');

      // Auto-refresh after account switch
      setTimeout(() => {
        onRefreshHome(); // Refresh home page data
        onRefresh(); // Refresh accounts list
      }, 1000); // Small delay to ensure DB is updated
    } catch (err) {
      alert('Failed to switch account: ' + err);
    }
  };

  const handleBatchUpdate = async (silent: boolean = false) => {
    try {
      const updated = await invoke<Account[]>('batch_update_all_accounts');
      onAccountsUpdate(updated);
      onRefreshTimeUpdate(new Date());
      if (!silent) {
        alert('All accounts updated successfully!');
      }
    } catch (err) {
      if (!silent) {
        alert('Failed to update accounts: ' + err);
      }
    }
  };

  const handleImport = async () => {
    try {
      const parsed = await invoke<Account[]>('import_accounts', { text: importText });
      await invoke('batch_add_accounts', { accounts: parsed });
      setShowImport(false);
      setImportText('');
      alert(`Successfully imported ${parsed.length} account(s)!`);

      // Refresh the list to show new accounts without fetching API data
      onRefresh();
    } catch (err) {
      alert('Failed to import accounts: ' + err);
    }
  };

  const getStatusIcon = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === 'pro' || lower === 'ultra') {
      return <CheckCircle className="text-green-500" size={16} />;
    } else if (lower === 'free') {
      return <XCircle className="text-gray-400" size={16} />;
    } else if (lower === 'used') {
      return <Clock className="text-orange-500" size={16} />;
    }
    return <Clock className="text-gray-400" size={16} />;
  };

  const getStatusColor = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === 'pro') return 'text-green-600 bg-green-50';
    if (lower === 'ultra') return 'text-purple-600 bg-purple-50';
    if (lower === 'free') return 'text-gray-600 bg-gray-50';
    if (lower === 'used') return 'text-orange-600 bg-orange-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Account Management</h2>
          {lastRefreshTime && (
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <Clock size={14} />
              <span>Last updated: {formatRelativeTime(lastRefreshTime)}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus size={16} />
            Import
          </button>
          <button
            onClick={() => handleBatchUpdate()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Upload size={16} />
            Update All
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Import Accounts</h3>
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-medium">Auto-Detection Enabled!</span> Paste your account info in
            any format.
          </p>
          <p className="text-xs text-gray-500 mb-2">Supported formats:</p>
          <ul className="text-xs text-gray-500 mb-3 ml-4 space-y-1">
            <li>
              • CSV:{' '}
              <code className="bg-gray-100 px-1 rounded">email,accessToken,sessionToken</code>
            </li>
            <li>
              • Chinese brackets:{' '}
              <code className="bg-gray-100 px-1 rounded">【email：...】【accessToken：...】</code>
            </li>
            <li>
              • Plain text:{' '}
              <code className="bg-gray-100 px-1 rounded">email@domain.com eyJhbGc...</code>
            </li>
            <li>
              • Labeled: <code className="bg-gray-100 px-1 rounded">email: xxx, token: xxx</code>
            </li>
            <li>• JSON and more!</li>
          </ul>
          <p className="text-xs text-gray-500 mb-4">
            Enter one account per line. SessionToken is optional and will be auto-detected if
            present.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste your account info here in any format...&#10;Example: user@example.com,eyJhbGc...&#10;Or: 【email：user@example.com】【accessToken：eyJhbGc...】"
            className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Import
            </button>
            <button
              onClick={() => {
                setShowImport(false);
                setImportText('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Left
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage Statistics
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accounts.map((account) => (
                <tr key={account.email} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.index}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{account.email}</span>
                      {accountInfo && accountInfo.email === account.email && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-green-700 bg-green-100 border border-green-200">
                          Active
                        </span>
                      )}
                      {account.source === 'web_login' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200">
                          Web Login
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}
                    >
                      {getStatusIcon(account.status)}
                      {account.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.days_remaining === 'N/A' || account.days_remaining === '-1.0' ? (
                      <span className="text-gray-400 italic">—</span>
                    ) : (
                      account.days_remaining
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.usage_used !== undefined && account.usage_total !== undefined ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            ${account.usage_used.toFixed(2)} / ${account.usage_total.toFixed(2)}
                          </span>
                          <span className="text-xs font-medium text-gray-800">
                            {account.usage_percentage?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(account.usage_percentage || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSwitch(account)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Switch to this account"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(account.email)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete account"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {accounts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No accounts found. Click &quot;Import&quot; to add accounts.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500">Total: {accounts.length} account(s)</div>
    </div>
  );
}

export default AccountPage;
