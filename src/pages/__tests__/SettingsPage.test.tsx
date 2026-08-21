import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '../SettingsPage';
import { ThemeProvider, THEME_STORAGE_KEY } from '../../theme';

// Mock Tauri dialog API
vi.mock('@tauri-apps/api/dialog', () => ({
  confirm: vi.fn(),
}));

function renderSettings() {
  return render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>,
  );
}

describe('SettingsPage Component', () => {
  beforeEach(async () => {
    global.mockInvoke.mockReset();
    global.mockInvoke.mockResolvedValue('');
    window.alert = vi.fn();
    const { confirm } = await import('@tauri-apps/api/dialog');
    vi.mocked(confirm).mockResolvedValue(true);
  });

  it('should render settings page title', () => {
    renderSettings();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
  });

  it('should detect cursor path on mount', async () => {
    const mockPath = '/test/cursor/path';
    global.mockInvoke.mockResolvedValue(mockPath);

    renderSettings();

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

    renderSettings();

    await waitFor(() => {
      const inputs = screen.getAllByDisplayValue(mockPath);
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('should handle path detection failure gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.mockInvoke.mockRejectedValue(new Error('Path not found'));

    renderSettings();

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it('should render light, dark, and auto theme options', () => {
    renderSettings();

    expect(screen.getByRole('radio', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /auto/i })).toBeInTheDocument();
  });

  it('should apply dark theme and persist the preference', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('radio', { name: /dark/i }));

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('radio', { name: /dark/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('navigates theme options with arrow keys and wraps at the ends', async () => {
    const user = userEvent.setup();
    renderSettings();

    const light = screen.getByRole('radio', { name: /light/i });
    const dark = screen.getByRole('radio', { name: /dark/i });
    const auto = screen.getByRole('radio', { name: /auto/i });

    expect(auto).toHaveAttribute('tabIndex', '0');
    expect(light).toHaveAttribute('tabIndex', '-1');
    expect(dark).toHaveAttribute('tabIndex', '-1');

    auto.focus();
    await user.keyboard('{ArrowRight}');

    expect(light).toHaveFocus();
    expect(light).toHaveAttribute('aria-checked', 'true');
    expect(light).toHaveAttribute('tabIndex', '0');
    expect(auto).toHaveAttribute('tabIndex', '-1');

    await user.keyboard('{ArrowLeft}');

    expect(auto).toHaveFocus();
    expect(auto).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowUp}');

    expect(dark).toHaveFocus();
    expect(dark).toHaveAttribute('aria-checked', 'true');
  });
});
