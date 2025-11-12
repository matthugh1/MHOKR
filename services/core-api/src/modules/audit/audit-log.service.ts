/**
 * Audit Log Service
 * 
 * Centralized service for recording audit logs for sensitive actions.
 * All privileged operations (role changes, user management, tenant mutations, etc.) 
 * must be logged via this service.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditTargetType, RBACRole } from '@prisma/client';

export interface AuditLogRecordParams {
  action: string;
  actorUserId: string;
  targetUserId?: string;
  targetId: string;
  targetType: AuditTargetType;
  tenantId?: string | null;
  previousRole?: RBACRole | null;
  newRole?: RBACRole | null;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  /**
   * Record an audit log entry
   * 
   * @param params - Audit log parameters
   */
  async record(params: AuditLogRecordParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: params.actorUserId,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          previousRole: params.previousRole || undefined,
          newRole: params.newRole || undefined,
          metadata: params.metadata || undefined,
        },
      });
    } catch (error) {
      // Log error but don't fail the operation
      // In production, consider sending to external logging service
      console.error('[AuditLogService] Failed to record audit log:', error);
    }
  }
}

