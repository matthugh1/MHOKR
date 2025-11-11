/**
 * Risk Calculator Unit Tests
 * 
 * Tests for isAtRisk() function:
 * - Status-based risk detection
 * - Confidence threshold edge cases
 * - Combined status + confidence logic
 */

import { isAtRisk } from '../risk-calculator';

describe('Risk Calculator', () => {
  describe('isAtRisk', () => {
    it('should return true for AT_RISK status', () => {
      const result = isAtRisk({
        status: 'AT_RISK',
        latestConfidence: null,
      });

      expect(result.isAtRisk).toBe(true);
      expect(result.reason).toBe('status');
    });

    it('should return true for OFF_TRACK status', () => {
      const result = isAtRisk({
        status: 'OFF_TRACK',
        latestConfidence: null,
      });

      expect(result.isAtRisk).toBe(true);
      expect(result.reason).toBe('status');
    });

    it('should return true for BLOCKED status', () => {
      const result = isAtRisk({
        status: 'BLOCKED',
        latestConfidence: null,
      });

      expect(result.isAtRisk).toBe(true);
      expect(result.reason).toBe('status');
    });

    it('should return false for ON_TRACK status with no confidence', () => {
      const result = isAtRisk({
        status: 'ON_TRACK',
        latestConfidence: null,
      });

      expect(result.isAtRisk).toBe(false);
      expect(result.reason).toBe(null);
    });

    it('should return true for confidence below default threshold (50)', () => {
      const result = isAtRisk({
        status: 'ON_TRACK',
        latestConfidence: 45,
      });

      expect(result.isAtRisk).toBe(true);
      expect(result.reason).toBe('confidence');
    });

    it('should return false for confidence at default threshold (50)', () => {
      const result = isAtRisk({
        status: 'ON_TRACK',
        latestConfidence: 50,
      });

      expect(result.isAtRisk).toBe(false);
      expect(result.reason).toBe(null);
    });

    it('should return false for confidence above default threshold', () => {
      const result = isAtRisk({
        status: 'ON_TRACK',
        latestConfidence: 75,
      });

      expect(result.isAtRisk).toBe(false);
      expect(result.reason).toBe(null);
    });

    it('should use custom threshold when provided', () => {
      const result = isAtRisk({
        status: 'ON_TRACK',
        latestConfidence: 60,
        confidenceThreshold: 70,
      });

      expect(result.isAtRisk).toBe(true);
      expect(result.reason).toBe('confidence');
    });

    it('should prioritize status over confidence', () => {
      const result = isAtRisk({
        status: 'AT_RISK',
        latestConfidence: 80, // High confidence but status is at-risk
      });

      expect(result.isAtRisk).toBe(true);
      expect(result.reason).toBe('status');
    });

    it('should handle undefined confidence', () => {
      const result = isAtRisk({
        status: 'ON_TRACK',
        latestConfidence: undefined,
      });

      expect(result.isAtRisk).toBe(false);
      expect(result.reason).toBe(null);
    });

    it('should handle edge case: confidence exactly at threshold', () => {
      const result = isAtRisk({
        status: 'ON_TRACK',
        latestConfidence: 50,
        confidenceThreshold: 50,
      });

      expect(result.isAtRisk).toBe(false);
      expect(result.reason).toBe(null);
    });

    it('should handle edge case: confidence just below threshold', () => {
      const result = isAtRisk({
        status: 'ON_TRACK',
        latestConfidence: 49,
        confidenceThreshold: 50,
      });

      expect(result.isAtRisk).toBe(true);
      expect(result.reason).toBe('confidence');
    });
  });
});


