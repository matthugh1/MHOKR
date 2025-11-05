/**
 * Authorisation Service
 * 
 * Single decision centre for all permission checks.
 * Centralises RBAC, tenant isolation, publish/cycle locks, and visibility decisions.
 * 
 * This service wraps existing rbac.ts logic without changing business outcomes.
 */

import { Injectable } from '@nestjs/common';
import { UserContext, ResourceContext, Action } from '../rbac/types';
import { can } from '../rbac/rbac';
import { canViewOKR } from '../rbac/visibilityPolicy';
import { assertMutation, Decision, ReasonCode } from './tenant-boundary';
import { OkrGovernanceService } from '../okr/okr-governance.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';

@Injectable()
export class AuthorisationService {
  constructor(
    private prisma: PrismaService,
    private governanceService: OkrGovernanceService,
    private rbacService: RBACService,
  ) {}

  /**
   * Check if user can perform action on resource
   * 
   * Single decision path that combines:
   * - RBAC role checks (via rbac.ts)
   * - Tenant boundary checks (for mutations)
   * - Publish/cycle lock checks (for OKR mutations)
   * - Visibility checks (for reads)
   * 
   * @param userContext - User's context with roles
   * @param action - Action being performed
   * @param resourceContext - Resource context
   * @param userOrgId - User's organisation ID (for tenant boundary checks)
   * @returns Decision with allow/deny and reason code
   */
  async can(
    userContext: UserContext,
    action: Action,
    resourceContext: ResourceContext,
    userOrgId?: string | null,
  ): Promise<Decision> {
    // Check if this is a mutation action
    const isMutation = this.isMutationAction(action);

    // For mutations, check tenant boundary first
    if (isMutation) {
      const tenantDecision = assertMutation(userContext, resourceContext, userOrgId);
      if (!tenantDecision.allow) {
        return tenantDecision;
      }

      // For OKR mutations, check publish/cycle lock
      if (this.isOKRMutation(action) && resourceContext.okr) {
        const lockDecision = await this.checkPublishLock(userContext, action, resourceContext);
        if (!lockDecision.allow) {
          return lockDecision;
        }
      }
    }

    // Check RBAC role permissions
    const rbacAllowed = can(userContext, action, resourceContext);
    if (!rbacAllowed) {
      return {
        allow: false,
        reason: 'ROLE_DENY',
        details: { action, resourceContext: { tenantId: resourceContext.tenantId } },
      };
    }

    // For read actions, check visibility
    if (action === 'view_okr' && resourceContext.okr) {
      const visibilityAllowed = canViewOKR(userContext, resourceContext.okr, resourceContext.tenant);
      if (!visibilityAllowed) {
        return {
          allow: false,
          reason: 'PRIVATE_VISIBILITY',
          details: { okrId: resourceContext.okr.id, visibilityLevel: resourceContext.okr.visibilityLevel },
        };
      }
    }

    return {
      allow: true,
      reason: 'ALLOW',
    };
  }

  /**
   * Check if action is a mutation
   */
  private isMutationAction(action: Action): boolean {
    return [
      'edit_okr',
      'delete_okr',
      'create_okr',
      'publish_okr',
      'request_checkin',
      'manage_users',
      'manage_billing',
      'manage_workspaces',
      'manage_teams',
      'manage_tenant_settings',
      'impersonate_user',
    ].includes(action);
  }

  /**
   * Check if action is an OKR mutation
   */
  private isOKRMutation(action: Action): boolean {
    return ['edit_okr', 'delete_okr', 'create_okr', 'publish_okr'].includes(action);
  }

  /**
   * Check publish lock for OKR mutations
   */
  private async checkPublishLock(
    userContext: UserContext,
    action: Action,
    resourceContext: ResourceContext,
  ): Promise<Decision> {
    if (!resourceContext.okr) {
      return { allow: true, reason: 'ALLOW' };
    }

    // Build acting user from userContext
    const actingUser = {
      id: userContext.userId,
      organizationId: resourceContext.tenantId || null,
    };

    try {
      // For edit/delete of objectives, check publish lock
      if ((action === 'edit_okr' || action === 'delete_okr')) {
        // Try as objective first
        const objective = await this.prisma.objective.findUnique({
          where: { id: resourceContext.okr.id },
          select: { id: true, isPublished: true },
        });

        if (objective) {
          await this.governanceService.checkPublishLockForObjective({
            objective,
            actingUser,
            rbacService: this.rbacService,
          });
        } else {
          // Try as key result - check parent objective
          const keyResult = await this.prisma.keyResult.findUnique({
            where: { id: resourceContext.okr.id },
            select: { id: true, objectiveId: true },
          });

          if (keyResult) {
            const parentObjective = await this.prisma.objective.findUnique({
              where: { id: keyResult.objectiveId },
              select: { id: true, isPublished: true },
            });

            if (parentObjective) {
              await this.governanceService.checkPublishLockForKeyResult({
                parentObjective,
                actingUser,
                rbacService: this.rbacService,
              });
            }
          }
        }
      }

      return { allow: true, reason: 'ALLOW' };
    } catch (error: any) {
      if (error.message?.includes('published')) {
        return {
          allow: false,
          reason: 'PUBLISH_LOCK',
          details: { message: error.message },
        };
      }
      throw error;
    }
  }
}

