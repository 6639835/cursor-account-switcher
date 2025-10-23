import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { createMockAccountInfo, createMockUsageInfo } from '../test/utils';

describe('App Component', () => {
  beforeEach(() => {
    global.mockInvoke.mockReset();
    // Default mocks for HomePage (which loads by default)
    global.mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'detect_cursor_path') return Promise.resolve('/mock/cursor/path');
      if (cmd === 'set_cursor_path') return Promise.resolve(undefined);
      if (cmd === 'get_current_account_info') return Promise.resolve(createMockAccountInfo());
      if (cmd === 'get_usage_info') return Promise.resolve(createMockUsageInfo());
      if (cmd === 'get_all_accounts') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  it('should render the application with sidebar', async () => {
    render(<App />);

    expect(screen.getByText('Cursor Switcher')).toBeInTheDocument();
    expect(screen.getByText('Account Manager')).toBeInTheDocument();
  });

  it('should display all navigation tabs', () => {
    render(<App />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should detect Cursor path on mount', async () => {
    render(<App />);

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('detect_cursor_path');
    });
  });

  it('should switch tabs when clicked', async () => {
    const user = userEvent.setup();

    render(<App />);

    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    });

    // Find the Accounts tab button
    const accountsTab = screen.getByRole('button', { name: /accounts/i });

    // Initially should not have blue background (Home tab is active)
    expect(accountsTab).not.toHaveClass('bg-blue-50');

    await user.click(accountsTab);

    // After clicking, should have blue background
    await waitFor(() => {
      expect(accountsTab).toHaveClass('bg-blue-50');
      expect(accountsTab).toHaveClass('text-blue-600');
    });

    // Verify we're on the accounts page
    await waitFor(() => {
      expect(screen.getByText('Account Management')).toBeInTheDocument();
    });
  });

  it('should display version in footer', () => {
    render(<App />);

    const versionText = screen.getByText(/Version/i);
    expect(versionText).toBeInTheDocument();
  });

  it('should handle cursor path detection failure gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Only reject detect_cursor_path, allow other calls
    global.mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'detect_cursor_path') return Promise.reject(new Error('Path not found'));
      if (cmd === 'set_cursor_path') return Promise.resolve(undefined);
      if (cmd === 'get_current_account_info') return Promise.resolve(createMockAccountInfo());
      if (cmd === 'get_usage_info') return Promise.resolve(createMockUsageInfo());
      return Promise.resolve(undefined);
    });

    render(<App />);

    // Wait for the component to attempt path detection
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should set cursor path after detecting it', async () => {
    const mockPath = '/test/cursor/path';
    let detectCalled = false;
    let setPathCalled = false;

    global.mockInvoke.mockImplementation((cmd: string, args?: { path?: string }) => {
      if (cmd === 'detect_cursor_path') {
        detectCalled = true;
        return Promise.resolve(mockPath);
      }
      if (cmd === 'set_cursor_path') {
        setPathCalled = true;
        expect(args).toEqual({ path: mockPath });
        return Promise.resolve(undefined);
      }
      return Promise.resolve(undefined);
    });

    render(<App />);

    await waitFor(
      () => {
        expect(detectCalled).toBe(true);
        expect(setPathCalled).toBe(true);
      },
      { timeout: 3000 },
    );
  });
});
