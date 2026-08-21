import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import {
  BillingCycle,
  DetailedUserInfo,
  UsageEventsResponse,
  InvoicesResponse,
  UsageEvent,
  Invoice,
} from '../types';
import {
  RefreshCw,
  DollarSign,
  Calendar,
  TrendingUp,
  FileText,
  User,
  CreditCard,
  Activity,
  ChevronRight,
} from 'lucide-react';

interface DetailedUsagePageProps {
  onRefresh?: () => void;
}

function DetailedUsagePage({ onRefresh }: DetailedUsagePageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [usageEvents, setUsageEvents] = useState<UsageEventsResponse | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle | null>(null);
  const [userInfo, setUserInfo] = useState<DetailedUserInfo | null>(null);
  const [invoices, setInvoices] = useState<InvoicesResponse | null>(null);

  const [activeTab, setActiveTab] = useState<'usage' | 'billing' | 'invoices'>('usage');

  const loadAllData = async () => {
    setLoading(true);
    setError('');

    try {
      const [eventsData, cycleData, infoData, invoicesData] = await Promise.all([
        invoke<UsageEventsResponse>('get_usage_events').catch(() => null),
        invoke<BillingCycle>('get_billing_cycle').catch(() => null),
        invoke<DetailedUserInfo>('get_detailed_user_info').catch(() => null),
        invoke<InvoicesResponse>('get_invoices').catch(() => null),
      ]);

      setUsageEvents(eventsData);
      setBillingCycle(cycleData);
      setUserInfo(infoData);
      setInvoices(invoicesData);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleRefresh = () => {
    loadAllData();
    onRefresh?.();
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return 'N/A';
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const renderUsageEvents = () => {
    if (!usageEvents || !usageEvents.events) {
      return <div className="text-center py-12 text-muted">No usage events available</div>;
    }

    const events = usageEvents.events;
    if (events.length === 0) {
      return <div className="text-center py-12 text-muted">No usage events found</div>;
    }

    return (
      <div className="space-y-4">
        {events.slice(0, 20).map((event: UsageEvent, idx: number) => (
          <div
            key={idx}
            className="bg-panel border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-icon" />
                  <span className="font-medium text-fg">
                    {event.model || event.type || 'Usage Event'}
                  </span>
                  {event.cost && (
                    <span className="ml-auto text-sm font-semibold text-success">
                      {formatCurrency(event.cost)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted">
                  {event.timestamp && (
                    <div>
                      <span className="font-medium">Time:</span> {formatDate(event.timestamp)}
                    </div>
                  )}
                  {event.tokens && (
                    <div>
                      <span className="font-medium">Tokens:</span> {event.tokens.toLocaleString()}
                    </div>
                  )}
                  {event.request_type && (
                    <div>
                      <span className="font-medium">Type:</span> {event.request_type}
                    </div>
                  )}
                  {event.usage_type && (
                    <div>
                      <span className="font-medium">Usage:</span> {event.usage_type}
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted mt-1" />
            </div>
          </div>
        ))}
        {events.length > 20 && (
          <div className="text-center text-sm text-muted pt-4">
            Showing 20 of {events.length} events
          </div>
        )}
      </div>
    );
  };

  const renderBillingCycle = () => {
    if (!billingCycle) {
      return (
        <div className="text-center py-12 text-muted">No billing cycle information available</div>
      );
    }

    const usagePercentage =
      billingCycle.usage && billingCycle.limit
        ? (billingCycle.usage / billingCycle.limit) * 100
        : 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Billing Period */}
          <div className="bg-panel border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="text-icon" size={24} />
              <h3 className="text-lg font-semibold text-fg">Billing Period</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted">Start Date</div>
                <div className="text-lg font-medium text-fg">
                  {formatDate(billingCycle.start_date)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted">End Date</div>
                <div className="text-lg font-medium text-fg">
                  {formatDate(billingCycle.end_date)}
                </div>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-panel border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="text-icon" size={24} />
              <h3 className="text-lg font-semibold text-fg">Usage Statistics</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">Current Usage</span>
                  <span className="font-medium text-fg">
                    {formatCurrency(billingCycle.usage)} / {formatCurrency(billingCycle.limit)}
                  </span>
                </div>
                <div className="w-full bg-track rounded-full h-2.5">
                  <div
                    className="bg-accent h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted mt-1">{usagePercentage.toFixed(1)}% used</div>
              </div>
            </div>
          </div>
        </div>

        {/* User Info */}
        {userInfo && (
          <div className="bg-panel border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <User className="text-icon" size={24} />
              <h3 className="text-lg font-semibold text-fg">Account Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userInfo.email && (
                <div>
                  <div className="text-sm text-muted">Email</div>
                  <div className="text-base font-medium text-fg">{userInfo.email}</div>
                </div>
              )}
              {userInfo.user_id && (
                <div>
                  <div className="text-sm text-muted">User ID</div>
                  <div className="text-base font-medium text-fg font-mono text-xs">
                    {userInfo.user_id}
                  </div>
                </div>
              )}
              {userInfo.membership_type && (
                <div>
                  <div className="text-sm text-muted">Membership Type</div>
                  <div className="text-base font-medium text-fg">{userInfo.membership_type}</div>
                </div>
              )}
              {userInfo.subscription_status && (
                <div>
                  <div className="text-sm text-muted">Subscription Status</div>
                  <div className="text-base font-medium text-fg">
                    {userInfo.subscription_status}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInvoices = () => {
    if (!invoices || !invoices.invoices) {
      return <div className="text-center py-12 text-muted">No invoice data available</div>;
    }

    const invoiceList = invoices.invoices;
    if (invoiceList.length === 0) {
      return <div className="text-center py-12 text-muted">No invoices found</div>;
    }

    return (
      <div className="space-y-4">
        {invoiceList.map((invoice: Invoice, idx: number) => (
          <div
            key={idx}
            className="bg-panel border border-border rounded-lg p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <CreditCard className="text-icon mt-1" size={20} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-fg">
                      Invoice #{invoice.id || invoice.number || idx + 1}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-success-bg text-success-fg'
                          : invoice.status === 'pending'
                            ? 'bg-warning-bg text-warning-fg'
                            : 'bg-code text-fg'
                      }`}
                    >
                      {invoice.status || 'Unknown'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted">
                    <div>
                      <span className="font-medium">Amount:</span>{' '}
                      <span className="text-fg font-semibold">
                        {formatCurrency(invoice.amount)}
                      </span>
                    </div>
                    {invoice.created && (
                      <div>
                        <span className="font-medium">Date:</span> {formatDate(invoice.created)}
                      </div>
                    )}
                    {invoice.period_start && (
                      <div>
                        <span className="font-medium">Period Start:</span>{' '}
                        {formatDate(invoice.period_start)}
                      </div>
                    )}
                    {invoice.period_end && (
                      <div>
                        <span className="font-medium">Period End:</span>{' '}
                        {formatDate(invoice.period_end)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg">Detailed Usage & Billing</h2>
          <p className="text-sm text-muted mt-1">
            View your usage events, billing cycle, and invoice history
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('usage')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'usage'
                ? 'border-selected-fg text-selected-fg'
                : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            <Activity size={18} />
            Usage Events
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'billing'
                ? 'border-selected-fg text-selected-fg'
                : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            <DollarSign size={18} />
            Billing Cycle
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'invoices'
                ? 'border-selected-fg text-selected-fg'
                : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            <FileText size={18} />
            Invoices
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw size={32} className="animate-spin text-icon mx-auto mb-3" />
          <p className="text-muted">Loading data...</p>
        </div>
      ) : (
        <div>
          {activeTab === 'usage' && renderUsageEvents()}
          {activeTab === 'billing' && renderBillingCycle()}
          {activeTab === 'invoices' && renderInvoices()}
        </div>
      )}
    </div>
  );
}

export default DetailedUsagePage;
