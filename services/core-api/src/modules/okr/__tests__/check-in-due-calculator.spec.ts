/**
 * Check-in Due Calculator Tests
 * 
 * Unit tests for check-in due/overdue calculation logic.
 */

import { getCadenceDays, calculateCheckInDueStatus } from '../check-in-due-calculator';

describe('Check-in Due Calculator', () => {
  describe('getCadenceDays', () => {
    it('should return 7 for WEEKLY', () => {
      expect(getCadenceDays('WEEKLY')).toBe(7);
    });

    it('should return 14 for BIWEEKLY', () => {
      expect(getCadenceDays('BIWEEKLY')).toBe(14);
    });

    it('should return 30 for MONTHLY', () => {
      expect(getCadenceDays('MONTHLY')).toBe(30);
    });

    it('should return 0 for NONE', () => {
      expect(getCadenceDays('NONE')).toBe(0);
    });

    it('should return 0 for null', () => {
      expect(getCadenceDays(null)).toBe(0);
    });

    it('should return 0 for undefined', () => {
      expect(getCadenceDays(undefined)).toBe(0);
    });
  });

  describe('calculateCheckInDueStatus', () => {
    const now = new Date('2025-01-15T10:00:00Z');
    const krCreatedAt = new Date('2025-01-01T10:00:00Z');

    it('should return ON_TIME for KR with check-in within cadence', () => {
      const lastCheckInAt = new Date('2025-01-10T10:00:00Z'); // 5 days ago (WEEKLY = 7 days)
      const result = calculateCheckInDueStatus('WEEKLY', lastCheckInAt, krCreatedAt, 2, now);
      
      expect(result.status).toBe('ON_TIME');
      expect(result.isDue).toBe(false);
      expect(result.isOverdue).toBe(false);
      expect(result.daysSinceLastCheckIn).toBe(5);
    });

    it('should return DUE for KR with check-in exactly at cadence', () => {
      const lastCheckInAt = new Date('2025-01-08T10:00:00Z'); // 7 days ago (WEEKLY = 7 days)
      const result = calculateCheckInDueStatus('WEEKLY', lastCheckInAt, krCreatedAt, 2, now);
      
      expect(result.status).toBe('DUE');
      expect(result.isDue).toBe(true);
      expect(result.isOverdue).toBe(false);
      expect(result.daysSinceLastCheckIn).toBe(7);
    });

    it('should return OVERDUE for KR with check-in beyond cadence + grace', () => {
      const lastCheckInAt = new Date('2025-01-05T10:00:00Z'); // 10 days ago (WEEKLY = 7, grace = 2, so overdue after 9)
      const result = calculateCheckInDueStatus('WEEKLY', lastCheckInAt, krCreatedAt, 2, now);
      
      expect(result.status).toBe('OVERDUE');
      expect(result.isDue).toBe(true);
      expect(result.isOverdue).toBe(true);
      expect(result.daysSinceLastCheckIn).toBe(10);
    });

    it('should return DUE (not OVERDUE) for KR with check-in at cadence + 1 day (within grace)', () => {
      const lastCheckInAt = new Date('2025-01-07T10:00:00Z'); // 8 days ago (WEEKLY = 7, grace = 2, so overdue after 9)
      const result = calculateCheckInDueStatus('WEEKLY', lastCheckInAt, krCreatedAt, 2, now);
      
      expect(result.status).toBe('DUE');
      expect(result.isDue).toBe(true);
      expect(result.isOverdue).toBe(false);
      expect(result.daysSinceLastCheckIn).toBe(8);
    });

    it('should use KR creation date if no check-in exists', () => {
      const result = calculateCheckInDueStatus('WEEKLY', null, krCreatedAt, 2, now);
      
      expect(result.daysSinceLastCheckIn).toBe(14); // 14 days since creation
      expect(result.isDue).toBe(true);
      expect(result.isOverdue).toBe(true); // 14 > 7 + 2
    });

    it('should handle BIWEEKLY cadence correctly', () => {
      const lastCheckInAt = new Date('2024-12-30T10:00:00Z'); // 16 days ago (BIWEEKLY = 14, grace = 2, so overdue after 16)
      const result = calculateCheckInDueStatus('BIWEEKLY', lastCheckInAt, krCreatedAt, 2, now);
      
      expect(result.status).toBe('OVERDUE');
      expect(result.cadenceDays).toBe(14);
      expect(result.daysSinceLastCheckIn).toBe(16);
    });

    it('should handle MONTHLY cadence correctly', () => {
      const lastCheckInAt = new Date('2024-12-10T10:00:00Z'); // 36 days ago (MONTHLY = 30, grace = 2, so overdue after 32)
      const result = calculateCheckInDueStatus('MONTHLY', lastCheckInAt, krCreatedAt, 2, now);
      
      expect(result.status).toBe('OVERDUE');
      expect(result.cadenceDays).toBe(30);
      expect(result.daysSinceLastCheckIn).toBe(36);
    });

    it('should return ON_TIME for NONE cadence', () => {
      const result = calculateCheckInDueStatus('NONE', null, krCreatedAt, 2, now);
      
      expect(result.status).toBe('ON_TIME');
      expect(result.isDue).toBe(false);
      expect(result.isOverdue).toBe(false);
      expect(result.cadenceDays).toBe(0);
    });

    it('should respect custom grace days', () => {
      const lastCheckInAt = new Date('2025-01-05T10:00:00Z'); // 10 days ago
      const resultWithGrace2 = calculateCheckInDueStatus('WEEKLY', lastCheckInAt, krCreatedAt, 2, now);
      const resultWithGrace5 = calculateCheckInDueStatus('WEEKLY', lastCheckInAt, krCreatedAt, 5, now);
      
      expect(resultWithGrace2.status).toBe('OVERDUE'); // 10 > 7 + 2
      expect(resultWithGrace5.status).toBe('DUE'); // 10 <= 7 + 5
    });
  });
});

