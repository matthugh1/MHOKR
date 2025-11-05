/**
 * RBAC Inspector Service
 * 
 * Service layer for managing RBAC Inspector feature flag (per-user toggle).
 * Now uses FeatureFlagService internally for consistency.
 */

import { Injectable, Logger } from '@nestjs/common';
import { RBACService } from './rbac.service';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class RBACInspectorService {
  private readonly logger = new Logger(RBACInspectorService.name);

  constructor(
    private rbacService: RBACService,
    private featureFlagService: FeatureFlagService,
    private prisma: PrismaService,
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
   * Delegates to FeatureFlagService for consistency
   */
  async getInspectorEnabled(userId: string): Promise<boolean> {
    return await this.featureFlagService.getFeatureFlag(userId, 'rbacInspector');
  }

  /**
   * Set RBAC Inspector enabled state for a user
   * Delegates to FeatureFlagService for consistency
   */
  async setInspectorEnabled(
    userId: string,
    enabled: boolean,
    actorUserId: string,
    organizationId: string | null,
  ): Promise<void> {
    return await this.featureFlagService.setFeatureFlag(
      userId,
      'rbacInspector',
      enabled,
      actorUserId,
      organizationId,
    );
  }
}

