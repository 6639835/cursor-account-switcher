import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Account } from '../types';
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

function AccountPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await invoke<Account[]>('get_all_accounts');
      setAccounts(data);
    } catch (err) {
      alert('Failed to load accounts: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Delete account ${email}?`)) {
      return;
    }

    try {
      await invoke('delete_account', { email });
      await loadAccounts();
    } catch (err) {
      alert('Failed to delete account: ' + err);
    }
  };

  const handleSwitch = async (account: Account) => {
    if (!confirm(`Switch to account ${account.email}?`)) {
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
    } catch (err) {
      alert('Failed to switch account: ' + err);
    }
  };

  const handleBatchUpdate = async () => {
    setLoading(true);
    try {
      const updated = await invoke<Account[]>('batch_update_all_accounts');
      setAccounts(updated);
      alert('All accounts updated successfully!');
    } catch (err) {
      alert('Failed to update accounts: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      const parsed = await invoke<Account[]>('import_accounts', { text: importText });
      await invoke('batch_add_accounts', { accounts: parsed });
      await loadAccounts();
      setShowImport(false);
      setImportText('');
      alert(`Successfully imported ${parsed.length} account(s)!`);
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
        <h2 className="text-2xl font-bold text-gray-800">Account Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus size={16} />
            Import
          </button>
          <button
            onClick={handleBatchUpdate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Upload size={16} />
            Update All
          </button>
          <button
            onClick={loadAccounts}
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
            Format:{' '}
            <code className="bg-gray-100 px-2 py-1 rounded">email,accessToken,sessionToken</code>
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Enter one account per line. SessionToken is optional.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="user@example.com,eyJhbGc...,WorkosCursorSessionToken=...&#10;user2@example.com,eyJhbGc..."
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
                  Record Time
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
                    {account.email}
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
                    {account.record_time}
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
