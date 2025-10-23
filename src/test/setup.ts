import { expect, afterEach, vi } from 'vitest';
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
global.mockInvoke = mockInvoke;

// Extend expect with custom matchers
declare global {
  var mockInvoke: typeof mockInvoke;
}
