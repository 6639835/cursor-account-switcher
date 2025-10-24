import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '../SettingsPage';

describe('SettingsPage Component', () => {
  beforeEach(() => {
    global.mockInvoke.mockReset();
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  it('should render settings page title', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
  });

  it('should detect cursor path on mount', async () => {
    const mockPath = '/test/cursor/path';
    global.mockInvoke.mockResolvedValue(mockPath);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('detect_cursor_path');
    });
  });

  it('should display detected cursor path', async () => {
    const mockPath = '/Applications/Cursor.app';
    const mockStoragePath = '/Users/test/storage';

    global.mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'detect_cursor_path') return Promise.resolve(mockPath);
      if (cmd === 'get_data_storage_path') return Promise.resolve(mockStoragePath);
      return Promise.resolve('');
    });

    render(<SettingsPage />);

    await waitFor(() => {
      const inputs = screen.getAllByDisplayValue(mockPath);
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('should handle path detection failure gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.mockInvoke.mockRejectedValue(new Error('Path not found'));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });
});
