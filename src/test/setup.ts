import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const localStorageStore = new Map<string, string>();

const localStorageMock: Storage = {
  get length() {
    return localStorageStore.size;
  },
  clear() {
    localStorageStore.clear();
  },
  getItem(key: string) {
    return localStorageStore.get(key) ?? null;
  },
  key(index: number) {
    return Array.from(localStorageStore.keys())[index] ?? null;
  },
  removeItem(key: string) {
    localStorageStore.delete(key);
  },
  setItem(key: string, value: string) {
    localStorageStore.set(String(key), String(value));
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Tauri API
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}));

// Type declaration for global mockInvoke
declare global {
  // eslint-disable-next-line no-var
  var mockInvoke: ReturnType<typeof vi.fn>;
}

// Make mockInvoke available globally for tests
(globalThis as typeof global).mockInvoke = mockInvoke;
