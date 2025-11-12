/**
 * Feature Flag Service
 * 
 * Generic service for managing per-user feature flags stored in users.settings JSONB.
 * All feature flags are stored under settings.features.*
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType } from '@prisma/client';

export type FeatureFlagName = 'rbacInspector' | 'okrTreeView';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Get feature flag enabled state for a user
   */
  async getFeatureFlag(userId: string, flagName: FeatureFlagName): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user || !user.settings) {
      return false;
    }

    const settings = user.settings as any;
    
    // Support legacy rbacInspector location for backward compatibility
    if (flagName === 'rbacInspector') {
      return settings?.debug?.rbacInspectorEnabled === true || settings?.features?.rbacInspector === true;
    }
    
    // All other flags under features.*
    return settings?.features?.[flagName] === true;
  }

  /**
   * Set feature flag enabled state for a user
   */
  async setFeatureFlag(
    userId: string,
    flagName: FeatureFlagName,
    enabled: boolean,
    actorUserId: string,
    tenantId: string | null,
  ): Promise<void> {
    // Get current state for audit log
    const currentState = await this.getFeatureFlag(userId, flagName);

    // Get current settings and merge
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const currentSettings = (user?.settings as any) || {};
    
    // Migrate rbacInspector from debug.* to features.* if needed
    let updatedSettings: any = {
      ...currentSettings,
    };

    if (flagName === 'rbacInspector') {
      // Migrate from debug.rbacInspectorEnabled to features.rbacInspector
      updatedSettings = {
        ...currentSettings,
        debug: {
          ...currentSettings.debug,
          // Keep legacy for backward compatibility during migration
          rbacInspectorEnabled: enabled,
        },
        features: {
          ...currentSettings.features,
          rbacInspector: enabled,
        },
      };
    } else {
      // All other flags go under features.*
      updatedSettings = {
        ...currentSettings,
        features: {
          ...currentSettings.features,
          [flagName]: enabled,
        },
      };
    }

    // Update user settings (Prisma handles JSONB automatically)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        settings: updatedSettings as any, // Prisma Json type
      },
    });

    // Audit log
    await this.auditLogService.record({
      action: `toggle_feature_flag_${flagName}`,
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      tenantId,
      metadata: {
        flagName,
        enabled,
        previousState: currentState,
      },
    });

    this.logger.log(`Feature flag ${flagName} ${enabled ? 'enabled' : 'disabled'} for user ${userId} by ${actorUserId}`);
  }

  /**
   * Get all feature flags for a user
   */
  async getAllFeatureFlags(userId: string): Promise<Record<FeatureFlagName, boolean>> {
    return {
      rbacInspector: await this.getFeatureFlag(userId, 'rbacInspector'),
      okrTreeView: await this.getFeatureFlag(userId, 'okrTreeView'),
    };
  }
}

