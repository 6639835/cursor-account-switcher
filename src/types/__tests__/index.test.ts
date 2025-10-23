import { describe, it, expect } from 'vitest';
import type { Account, AccountInfo, UsageInfo, MachineIds } from '../index';

describe('Type Definitions', () => {
  describe('Account', () => {
    it('should have all required properties', () => {
      const account: Account = {
        index: 1,
        email: 'test@example.com',
        access_token: 'token',
        refresh_token: 'refresh',
        cookie: 'cookie',
        days_remaining: '30',
        status: 'premium',
        record_time: '2024-01-01',
      };

      expect(account).toHaveProperty('index');
      expect(account).toHaveProperty('email');
      expect(account).toHaveProperty('access_token');
      expect(account).toHaveProperty('refresh_token');
      expect(account).toHaveProperty('cookie');
      expect(account).toHaveProperty('days_remaining');
      expect(account).toHaveProperty('status');
      expect(account).toHaveProperty('record_time');
    });
  });

  describe('AccountInfo', () => {
    it('should have all required properties', () => {
      const accountInfo: AccountInfo = {
        email: 'test@example.com',
        membership_type: 'premium',
        days_remaining: 30,
        is_student: false,
      };

      expect(accountInfo).toHaveProperty('email');
      expect(accountInfo).toHaveProperty('membership_type');
      expect(accountInfo).toHaveProperty('days_remaining');
      expect(accountInfo).toHaveProperty('is_student');
      expect(typeof accountInfo.is_student).toBe('boolean');
      expect(typeof accountInfo.days_remaining).toBe('number');
    });
  });

  describe('UsageInfo', () => {
    it('should have all required properties', () => {
      const usageInfo: UsageInfo = {
        total_quota: 1000,
        used: 250,
        remaining: 750,
        usage_percentage: 25,
      };

      expect(usageInfo).toHaveProperty('total_quota');
      expect(usageInfo).toHaveProperty('used');
      expect(usageInfo).toHaveProperty('remaining');
      expect(usageInfo).toHaveProperty('usage_percentage');
      expect(typeof usageInfo.total_quota).toBe('number');
    });

    it('should calculate usage correctly', () => {
      const usageInfo: UsageInfo = {
        total_quota: 1000,
        used: 250,
        remaining: 750,
        usage_percentage: 25,
      };

      expect(usageInfo.used + usageInfo.remaining).toBe(usageInfo.total_quota);
      expect(usageInfo.usage_percentage).toBe((usageInfo.used / usageInfo.total_quota) * 100);
    });
  });

  describe('MachineIds', () => {
    it('should have all required properties', () => {
      const machineIds: MachineIds = {
        machine_id: 'test-id',
        mac_machine_id: 'mac-id',
        dev_device_id: 'dev-id',
        sqm_id: '{SQM-ID}',
      };

      expect(machineIds).toHaveProperty('machine_id');
      expect(machineIds).toHaveProperty('mac_machine_id');
      expect(machineIds).toHaveProperty('dev_device_id');
      expect(machineIds).toHaveProperty('sqm_id');
    });
  });
});
