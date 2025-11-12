/**
 * RBAC Telemetry Helper
 * 
 * Lightweight telemetry for RBAC deny events.
 * No-op if RBAC_TELEMETRY=off (default: on for development).
 */

import { Logger } from '@nestjs/common';
import { Action, Role } from './types';

interface DenyEvent {
  action: Action;
  role: Role | string;
  route: string;
  reasonCode: string;
  userId?: string;
  tenantId?: string;
}

class RBACTelemetry {
  private readonly logger = new Logger(RBACTelemetry.name);
  private readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.RBAC_TELEMETRY !== 'off';
  }

  recordDeny(event: DenyEvent): void {
    if (!this.enabled) {
      return;
    }

    this.logger.warn('[RBAC Deny]', {
      action: event.action,
      role: event.role,
      route: event.route,
      reasonCode: event.reasonCode,
      userId: event.userId,
      tenantId: event.tenantId,
      timestamp: new Date().toISOString(),
    });

    // In production, you might send to external logging service:
    // await this.sendToExternalService(event);
  }

  // Placeholder for external service integration
  // private async sendToExternalService(event: DenyEvent): Promise<void> {
  //   // Send to DataDog, CloudWatch, etc.
  // }
}

export const rbacTelemetry = new RBACTelemetry();

export function recordDeny(event: DenyEvent): void {
  rbacTelemetry.recordDeny(event);
}

