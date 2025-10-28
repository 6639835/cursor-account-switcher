import { confirm as tauriConfirm } from '@tauri-apps/api/dialog';

/**
 * Show a success notification
 */
export const showSuccess = (message: string): void => {
  alert(message);
};

/**
 * Show an error notification
 */
export const showError = (error: unknown): void => {
  alert(`Error: ${error}`);
};

/**
 * Show a confirmation dialog
 */
export const showConfirm = async (
  message: string,
  title: string = 'Confirm',
  type: 'info' | 'warning' | 'error' = 'warning',
): Promise<boolean> => {
  return await tauriConfirm(message, { title, type });
};
