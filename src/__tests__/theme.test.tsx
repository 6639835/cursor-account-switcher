import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, resolveTheme, THEME_STORAGE_KEY, useTheme } from '../theme';

function ThemeProbe() {
  const { preference, resolved } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
    </div>
  );
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('resolves explicit light and dark preferences', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('resolves auto from the system preference', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
  });

  it('defaults to auto and applies the light theme when the system is light', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('preference')).toHaveTextContent('auto');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('restores a stored dark preference', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('preference')).toHaveTextContent('dark');
      expect(document.documentElement).toHaveClass('dark');
    });
  });

  it('throws when useTheme is used outside a provider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeProbe />)).toThrow('useTheme must be used within a ThemeProvider');
    consoleErrorSpy.mockRestore();
  });
});
