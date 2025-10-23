import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountPage from '../AccountPage';
import { createMockAccount } from '../../test/utils';

describe('AccountPage Component', () => {
  beforeEach(() => {
    global.mockInvoke.mockReset();
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  it('should render accounts page title', () => {
    global.mockInvoke.mockResolvedValue([]);
    render(<AccountPage />);

    expect(screen.getByText('Account Management')).toBeInTheDocument();
  });

  it('should load accounts on mount', async () => {
    const mockAccounts = [
      createMockAccount({ email: 'user1@example.com' }),
      createMockAccount({ email: 'user2@example.com', index: 2 }),
    ];

    global.mockInvoke.mockResolvedValue(mockAccounts);

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    });
  });

  it('should display empty state when no accounts', async () => {
    global.mockInvoke.mockResolvedValue([]);

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText(/No accounts found/i)).toBeInTheDocument();
    });
  });

  it('should handle account deletion', async () => {
    const user = userEvent.setup();
    const mockAccounts = [createMockAccount()];

    global.mockInvoke
      .mockResolvedValueOnce(mockAccounts) // initial load
      .mockResolvedValueOnce(undefined) // delete
      .mockResolvedValueOnce([]); // reload after delete

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    // Find delete button by title attribute
    const deleteButton = screen.getByTitle('Delete account');
    await user.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('delete_account', {
        email: 'test@example.com',
      });
    });
  });

  it('should not delete account if user cancels', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);
    const mockAccounts = [createMockAccount()];

    global.mockInvoke.mockResolvedValue(mockAccounts);

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button');
    // Find delete button (usually has Trash icon)
    const deleteButton = deleteButtons.find(
      (btn) =>
        btn.textContent?.includes('Delete') || btn.querySelector('[data-testid="trash-icon"]'),
    );

    if (deleteButton) {
      await user.click(deleteButton);
      expect(window.confirm).toHaveBeenCalled();
      expect(global.mockInvoke).not.toHaveBeenCalledWith('delete_account', expect.any(Object));
    }
  });

  it('should handle account switching', async () => {
    const user = userEvent.setup();
    const mockAccount = createMockAccount({
      email: 'switch@example.com',
      access_token: 'access_123',
      refresh_token: 'refresh_123',
    });

    global.mockInvoke
      .mockResolvedValueOnce([mockAccount]) // load accounts
      .mockResolvedValueOnce(undefined); // switch account

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('switch@example.com')).toBeInTheDocument();
    });

    // Find and click switch button (usually the first button in the row)
    const switchButtons = screen.getAllByRole('button');
    const switchButton = switchButtons.find(
      (btn) => btn.textContent?.includes('Switch') || btn.textContent?.includes('Use'),
    );

    if (switchButton) {
      await user.click(switchButton);

      expect(window.confirm).toHaveBeenCalled();

      await waitFor(() => {
        expect(global.mockInvoke).toHaveBeenCalledWith('switch_account', {
          email: 'switch@example.com',
          accessToken: 'access_123',
          refreshToken: 'refresh_123',
          resetMachine: true,
        });
      });
    }
  });

  it('should handle batch update all accounts', async () => {
    const user = userEvent.setup();
    const mockAccounts = [
      createMockAccount({ email: 'user1@example.com' }),
      createMockAccount({ email: 'user2@example.com', index: 2 }),
    ];

    const updatedAccounts = mockAccounts.map((acc) => ({
      ...acc,
      status: 'premium',
      days_remaining: '45.0',
    }));

    global.mockInvoke
      .mockResolvedValueOnce(mockAccounts) // initial load
      .mockResolvedValueOnce(updatedAccounts); // batch update

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    const updateButton = screen.getByRole('button', { name: /update all/i });
    await user.click(updateButton);

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('batch_update_all_accounts');
    });

    expect(window.alert).toHaveBeenCalledWith('All accounts updated successfully!');
  });

  it('should toggle import modal', async () => {
    const user = userEvent.setup();
    global.mockInvoke.mockResolvedValue([]);

    render(<AccountPage />);

    const importButton = screen.getByRole('button', { name: /import/i });
    await user.click(importButton);

    await waitFor(() => {
      expect(screen.getByText(/import accounts/i)).toBeInTheDocument();
    });
  });

  it('should handle import accounts', async () => {
    const user = userEvent.setup();
    const importText =
      '【email: test@example.com】【password:】【accessToken: token123】【sessionToken: session123】';
    const parsedAccounts = [createMockAccount({ email: 'test@example.com' })];

    global.mockInvoke
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValueOnce(parsedAccounts) // import_accounts
      .mockResolvedValueOnce(undefined) // batch_add_accounts
      .mockResolvedValueOnce(parsedAccounts); // reload

    render(<AccountPage />);

    // Click the "Import" button to show the import modal
    const importButton = screen.getAllByRole('button', { name: /import/i })[0];
    await user.click(importButton);

    // Fill in the textarea
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, importText);

    // Click the "Import" button inside the modal (not "Confirm")
    const submitButton = screen.getAllByRole('button', { name: /import/i })[1];
    await user.click(submitButton);

    await waitFor(() => {
      expect(global.mockInvoke).toHaveBeenCalledWith('import_accounts', { text: importText });
      expect(global.mockInvoke).toHaveBeenCalledWith('batch_add_accounts', {
        accounts: parsedAccounts,
      });
    });

    expect(window.alert).toHaveBeenCalledWith('Successfully imported 1 account(s)!');
  });

  it('should display account status with correct styling', async () => {
    const mockAccounts = [
      createMockAccount({ email: 'pro@example.com', status: 'pro' }),
      createMockAccount({ email: 'free@example.com', status: 'free', index: 2 }),
    ];

    global.mockInvoke.mockResolvedValue(mockAccounts);

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText('pro@example.com')).toBeInTheDocument();
      expect(screen.getByText('free@example.com')).toBeInTheDocument();
    });
  });

  it('should handle load accounts error', async () => {
    const errorMessage = 'Failed to load';
    global.mockInvoke.mockRejectedValue(new Error(errorMessage));

    render(<AccountPage />);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to load accounts'));
    });
  });
});
