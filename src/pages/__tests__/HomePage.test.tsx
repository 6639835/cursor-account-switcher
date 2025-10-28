import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../HomePage';
import { createMockAccountInfo, createMockUsageInfo } from '../../test/utils';

// Mock Tauri dialog API
vi.mock('@tauri-apps/api/dialog', () => ({
  confirm: vi.fn(),
}));

describe('HomePage Component', () => {
  beforeEach(async () => {
    global.mockInvoke.mockReset();
    // Set up default mock implementation
    global.mockInvoke.mockResolvedValue(undefined);
    // Reset window methods
    window.alert = vi.fn();
    const { confirm } = await import('@tauri-apps/api/dialog');
    vi.mocked(confirm).mockResolvedValue(true);
  });

  it('should render dashboard title', () => {
    const mockRefresh = vi.fn();
    render(
      <HomePage
        accountInfo={null}
        usageInfo={null}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should display account info when provided', () => {
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    expect(screen.getByText(mockAccountInfo.email)).toBeInTheDocument();
    expect(screen.getByText(mockAccountInfo.membership_type)).toBeInTheDocument();
  });

  it('should display loading state when loading prop is true', () => {
    const mockRefresh = vi.fn();
    render(
      <HomePage
        accountInfo={null}
        usageInfo={null}
        loading={true}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    expect(screen.getByText('Loading account information...')).toBeInTheDocument();
    expect(screen.getByText('Loading usage information...')).toBeInTheDocument();
  });

  it('should display error message when error prop is provided', () => {
    const errorMessage = 'Failed to load account';
    const mockRefresh = vi.fn();

    render(
      <HomePage
        accountInfo={null}
        usageInfo={null}
        loading={false}
        error={errorMessage}
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    expect(screen.getByText(/Failed to load account/i)).toBeInTheDocument();
  });

  it('should display usage statistics correctly', () => {
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo({
      total_quota: 1000,
      used: 250,
      remaining: 750,
      usage_percentage: 25,
    });
    const mockRefresh = vi.fn();

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText(/\$250\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$750\.00/)).toBeInTheDocument();
  });

  it('should call onRefresh when refresh button is clicked', async () => {
    const user = userEvent.setup();
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('should handle machine ID reset with confirmation', async () => {
    const user = userEvent.setup();
    const { confirm } = await import('@tauri-apps/api/dialog');
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();

    global.mockInvoke.mockResolvedValue(undefined);

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    const resetButton = screen.getByRole('button', { name: /reset machine id/i });
    await user.click(resetButton);

    expect(confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('reset_machine_id');
    });

    expect(window.alert).toHaveBeenCalledWith(
      'Machine ID reset successfully! Please restart Cursor to apply changes.',
    );
  });

  it('should not reset machine ID if user cancels', async () => {
    const user = userEvent.setup();
    const { confirm } = await import('@tauri-apps/api/dialog');
    vi.mocked(confirm).mockResolvedValue(false);
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    const resetButton = screen.getByRole('button', { name: /reset machine id/i });
    await user.click(resetButton);

    expect(confirm).toHaveBeenCalled();
    expect(global.mockInvoke).not.toHaveBeenCalledWith('reset_machine_id');
  });

  it('should handle machine ID reset failure', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Reset failed';
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();

    global.mockInvoke.mockRejectedValue(new Error(errorMessage));

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    const resetButton = screen.getByRole('button', { name: /reset machine id/i });
    await user.click(resetButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reset machine ID'),
      );
    });
  });

  it('should display student badge when is_student is true', () => {
    const mockAccountInfo = createMockAccountInfo({
      is_student: true,
      membership_type: 'premium',
    });
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    expect(screen.getByText(/premium \(Student\)/i)).toBeInTheDocument();
  });

  it('should display days remaining with correct precision', () => {
    const mockAccountInfo = createMockAccountInfo({
      days_remaining: 15.6,
    });
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    expect(screen.getByText('15.6 days')).toBeInTheDocument();
  });

  it('should display last refresh time when provided', () => {
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();
    const lastRefresh = new Date(Date.now() - 30000); // 30 seconds ago

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={lastRefresh}
        onRefresh={mockRefresh}
      />,
    );

    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.getByText(/seconds ago/)).toBeInTheDocument();
  });

  it('should not display last refresh time when null', () => {
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();
    const mockRefresh = vi.fn();

    render(
      <HomePage
        accountInfo={mockAccountInfo}
        usageInfo={mockUsageInfo}
        loading={false}
        error=""
        lastRefreshTime={null}
        onRefresh={mockRefresh}
      />,
    );

    expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument();
  });
});
