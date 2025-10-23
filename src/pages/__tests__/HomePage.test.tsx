import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../HomePage';
import { createMockAccountInfo, createMockUsageInfo } from '../../test/utils';

describe('HomePage Component', () => {
  beforeEach(() => {
    global.mockInvoke.mockReset();
    // Reset window methods
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  it('should render dashboard title', () => {
    render(<HomePage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should load account info on mount', async () => {
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();

    global.mockInvoke.mockResolvedValueOnce(mockAccountInfo).mockResolvedValueOnce(mockUsageInfo);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(mockAccountInfo.email)).toBeInTheDocument();
    });

    expect(screen.getByText(mockAccountInfo.membership_type)).toBeInTheDocument();
  });

  it('should display loading state initially', () => {
    global.mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<HomePage />);

    expect(screen.getByText('Loading account information...')).toBeInTheDocument();
    expect(screen.getByText('Loading usage information...')).toBeInTheDocument();
  });

  it('should display error message on load failure', async () => {
    const errorMessage = 'Failed to load account';
    global.mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load account/i)).toBeInTheDocument();
    });
  });

  it('should display usage statistics correctly', async () => {
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo({
      total_quota: 1000,
      used: 250,
      remaining: 750,
      usage_percentage: 25,
    });

    global.mockInvoke.mockResolvedValueOnce(mockAccountInfo).mockResolvedValueOnce(mockUsageInfo);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    expect(screen.getByText(/\$250\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$750\.00/)).toBeInTheDocument();
  });

  it('should refresh data when refresh button is clicked', async () => {
    const user = userEvent.setup();
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();

    global.mockInvoke.mockResolvedValue(mockAccountInfo).mockResolvedValue(mockUsageInfo);

    render(<HomePage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    // Should call the invoke functions again
    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('get_current_account_info');
    });
  });

  it('should handle machine ID reset with confirmation', async () => {
    const user = userEvent.setup();
    global.mockInvoke.mockResolvedValue(undefined);

    render(<HomePage />);

    const resetButton = screen.getByRole('button', { name: /reset machine id/i });
    await user.click(resetButton);

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('reset_machine_id');
    });

    expect(window.alert).toHaveBeenCalledWith(
      'Machine ID reset successfully! Please restart Cursor.',
    );
  });

  it('should not reset machine ID if user cancels', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);

    render(<HomePage />);

    const resetButton = screen.getByRole('button', { name: /reset machine id/i });
    await user.click(resetButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(global.mockInvoke).not.toHaveBeenCalledWith('reset_machine_id');
  });

  it('should handle machine ID reset failure', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Reset failed';
    const mockAccountInfo = createMockAccountInfo();
    const mockUsageInfo = createMockUsageInfo();

    global.mockInvoke
      .mockResolvedValueOnce(mockAccountInfo)
      .mockResolvedValueOnce(mockUsageInfo)
      .mockRejectedValueOnce(new Error(errorMessage));

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(mockAccountInfo.email)).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: /reset machine id/i });
    await user.click(resetButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reset machine ID'),
      );
    });
  });

  it('should display student badge when is_student is true', async () => {
    const mockAccountInfo = createMockAccountInfo({
      is_student: true,
      membership_type: 'premium',
    });
    const mockUsageInfo = createMockUsageInfo();

    global.mockInvoke.mockResolvedValueOnce(mockAccountInfo).mockResolvedValueOnce(mockUsageInfo);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/premium \(Student\)/i)).toBeInTheDocument();
    });
  });

  it('should display days remaining with correct precision', async () => {
    const mockAccountInfo = createMockAccountInfo({
      days_remaining: 15.6,
    });
    const mockUsageInfo = createMockUsageInfo();

    global.mockInvoke.mockResolvedValueOnce(mockAccountInfo).mockResolvedValueOnce(mockUsageInfo);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('15.6 days')).toBeInTheDocument();
    });
  });
});
