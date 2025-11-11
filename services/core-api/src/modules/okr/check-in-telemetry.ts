/**
 * Check-in Telemetry Helper
 * 
 * Lightweight telemetry for check-in related operations.
 * Uses NestJS Logger for structured logging.
 */

import { Logger } from '@nestjs/common';

// TelemetryEvent interface removed - unused

class CheckInTelemetry {
  private readonly logger = new Logger(CheckInTelemetry.name);
  private readonly enabled: boolean;

  constructor() {
    // Enable telemetry by default; disable via env var if needed
    this.enabled = process.env.CHECKIN_TELEMETRY !== 'off';
  }

  /**
   * Record a counter metric
   */
  recordCounter(metric: string, value: number = 1, tags?: Record<string, string | number>): void {
    if (!this.enabled) {
      return;
    }

    this.logger.log(`[TELEMETRY] Counter: ${metric}`, {
      metric,
      value,
      tags: tags || {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a timer/duration metric
   */
  recordTimer(metric: string, durationMs: number, tags?: Record<string, string | number>): void {
    if (!this.enabled) {
      return;
    }

    this.logger.log(`[TELEMETRY] Timer: ${metric}`, {
      metric,
      durationMs,
      tags: tags || {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Time an async operation
   */
  async time<T>(metric: string, operation: () => Promise<T>, tags?: Record<string, string | number>): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.recordTimer(metric, duration, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTimer(metric, duration, { ...tags, error: 'true' });
      throw error;
    }
  }
}

export const checkInTelemetry = new CheckInTelemetry();

/**
 * Convenience functions for common metrics
 */
export function recordCheckInHistoryFetch(tags?: Record<string, string | number>): void {
  checkInTelemetry.recordCounter('checkin.history.fetch', 1, tags);
}

export function recordCheckInReminderScan(tags?: Record<string, string | number>): void {
  checkInTelemetry.recordCounter('checkin.reminder.scan', 1, tags);
}

export function recordCheckInReminderSent(tags?: Record<string, string | number>): void {
  checkInTelemetry.recordCounter('checkin.reminder.sent', 1, tags);
}

export function recordOverdueCheckInsFetch(tags?: Record<string, string | number>): void {
  checkInTelemetry.recordCounter('reports.checkins.overdue.fetch', 1, tags);
}

export function recordTrendFetch(tags?: Record<string, string | number>): void {
  checkInTelemetry.recordCounter('reports.trend.fetch', 1, tags);
}

export function recordHeatmapFetch(tags?: Record<string, string | number>): void {
  checkInTelemetry.recordCounter('reports.heatmap.fetch', 1, tags);
}

export function recordAtRiskFetch(tags?: Record<string, string | number>): void {
  checkInTelemetry.recordCounter('reports.atRisk.fetch', 1, tags);
}

export function recordCycleHealthFetch(tags?: Record<string, string | number>): void {
  checkInTelemetry.recordCounter('reports.cycleHealth.fetch', 1, tags);
}

