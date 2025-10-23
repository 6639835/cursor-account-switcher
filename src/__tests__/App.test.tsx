import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('App Component', () => {
  beforeEach(() => {
    global.mockInvoke.mockReset();
    // Mock detect_cursor_path by default
    global.mockInvoke.mockResolvedValue('/mock/cursor/path');
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

    // Find the Accounts tab button
    const accountsTab = screen.getByRole('button', { name: /accounts/i });
    await user.click(accountsTab);

    // Check that the Accounts tab is now active (has blue background)
    await waitFor(() => {
      expect(accountsTab).toHaveClass('bg-blue-50');
    });
  });

  it('should display version in footer', () => {
    render(<App />);

    const versionText = screen.getByText(/Version/i);
    expect(versionText).toBeInTheDocument();
  });

  it('should handle cursor path detection failure gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.mockInvoke.mockRejectedValue(new Error('Path not found'));

    render(<App />);

    // Wait for the component to attempt path detection
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should set cursor path after detecting it', async () => {
    const mockPath = '/test/cursor/path';
    global.mockInvoke
      .mockResolvedValueOnce(mockPath) // detect_cursor_path
      .mockResolvedValue(undefined); // set_cursor_path

    render(<App />);

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('detect_cursor_path');
    });

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('set_cursor_path', { path: mockPath });
    });
  });
});
