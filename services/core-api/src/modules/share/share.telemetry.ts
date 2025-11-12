/**
 * Share Telemetry Helper
 * 
 * Lightweight telemetry for share link operations.
 * Uses NestJS Logger for structured logging.
 */

import { Logger } from '@nestjs/common';

class ShareTelemetry {
  private readonly logger = new Logger(ShareTelemetry.name);
  private readonly enabled: boolean;

  constructor() {
    // Enable telemetry by default; disable via env var if needed
    this.enabled = process.env.SHARE_TELEMETRY !== 'off';
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
}

export const shareTelemetry = new ShareTelemetry();

/**
 * Convenience functions for share link metrics
 */
export function recordShareCreated(tags?: Record<string, string | number>): void {
  shareTelemetry.recordCounter('share.create', 1, tags);
}

export function recordShareRevoked(tags?: Record<string, string | number>): void {
  shareTelemetry.recordCounter('share.revoke', 1, tags);
}

export function recordShareResolved(tags?: Record<string, string | number>): void {
  shareTelemetry.recordCounter('share.resolve', 1, tags);
}


