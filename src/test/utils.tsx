import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Custom render function that can be extended with providers
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { ...options });
}

// Helper to create mock accounts
export function createMockAccount(overrides = {}) {
  return {
    index: 1,
    email: 'test@example.com',
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    cookie: 'test_cookie',
    days_remaining: '30.0',
    status: 'premium',
    record_time: '2024-01-01 12:00:00',
    ...overrides,
  };
}

// Helper to create mock account info
export function createMockAccountInfo(overrides = {}) {
  return {
    email: 'test@example.com',
    membership_type: 'premium',
    days_remaining: 30,
    is_student: false,
    ...overrides,
  };
}

// Helper to create mock usage info
export function createMockUsageInfo(overrides = {}) {
  return {
    total_quota: 1000,
    used: 250,
    remaining: 750,
    usage_percentage: 25,
    ...overrides,
  };
}

// Helper to create mock machine IDs
export function createMockMachineIds(overrides = {}) {
  return {
    machine_id: 'test-machine-id',
    mac_machine_id: 'test-mac-machine-id',
    dev_device_id: 'test-dev-device-id',
    sqm_id: '{TEST-SQM-ID}',
    ...overrides,
  };
}
