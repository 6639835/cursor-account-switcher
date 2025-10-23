import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Tauri API
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}));

// Make mockInvoke available globally for tests
(globalThis as any).mockInvoke = mockInvoke;

// Type declaration for global mockInvoke
declare global {
  // eslint-disable-next-line no-var
  var mockInvoke: ReturnType<typeof vi.fn>;
}
