/**
 * RBAC Inspector Service
 * 
 * Service layer for managing RBAC Inspector feature flag (per-user toggle).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from './rbac.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType } from '@prisma/client';

@Injectable()
export class RBACInspectorService {
  private readonly logger = new Logger(RBACInspectorService.name);

  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Check if user can manage users (has manage_users permission)
   */
  async canManageUsers(userId: string, organizationId: string | null | undefined): Promise<boolean> {
    if (!organizationId) {
      // Superuser can manage (but self-toggle still requires explicit permission check)
      return false;
    }

    return await this.rbacService.canPerformAction(
      userId,
      'manage_users',
      { tenantId: organizationId },
    );
  }

  /**
   * Get user's primary tenant ID
   */
  async getUserTenantId(userId: string): Promise<string | null> {
    const roleAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: 'TENANT',
      },
      select: { scopeId: true },
      orderBy: { createdAt: 'asc' },
    });

    return roleAssignment?.scopeId || null;
  }

  /**
   * Get RBAC Inspector enabled state for a user
   */
  async getInspectorEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user || !user.settings) {
      return false;
    }

    const settings = user.settings as any;
    return settings?.debug?.rbacInspectorEnabled === true;
  }

  /**
   * Set RBAC Inspector enabled state for a user
   */
  async setInspectorEnabled(
    userId: string,
    enabled: boolean,
    actorUserId: string,
    organizationId: string | null,
  ): Promise<void> {
    // Get current state for audit log
    const currentState = await this.getInspectorEnabled(userId);

    // Get current settings and merge
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const currentSettings = (user?.settings as any) || {};
    const updatedSettings = {
      ...currentSettings,
      debug: {
        ...currentSettings.debug,
        rbacInspectorEnabled: enabled,
      },
    };

    // Update user settings (Prisma handles JSONB automatically)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        settings: updatedSettings as any, // Prisma Json type
      },
    });

    // Audit log
    await this.auditLogService.record({
      action: 'toggle_rbac_inspector',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId,
      metadata: {
        enabled,
        previousState: currentState,
      },
    });

    this.logger.log(`RBAC Inspector ${enabled ? 'enabled' : 'disabled'} for user ${userId} by ${actorUserId}`);
  }
}

