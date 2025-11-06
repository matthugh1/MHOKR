/**
 * Authorisation Service
 * 
 * Single decision centre for all permission checks.
 * Centralises RBAC, tenant isolation, publish/cycle locks, and visibility decisions.
 * 
 * This service wraps existing rbac.ts logic without changing business outcomes.
 */

import { Injectable } from '@nestjs/common';
import { UserContext, ResourceContext, Action } from '../modules/rbac/types';
import { can } from '../modules/rbac/rbac';
import { canViewOKR } from '../modules/rbac/visibilityPolicy';
import { assertMutation, Decision } from './tenant-boundary';
import { OkrGovernanceService } from '../modules/okr/okr-governance.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RBACService } from '../modules/rbac/rbac.service';

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

    // For create_okr, ensure resourceContext.tenantId matches the tenant where user has roles
    // (resource doesn't exist yet, so tenantId may be empty or mismatched)
    // Users can only create OKRs in their own tenant
    // CRITICAL: Always use tenantId from userContext.tenantRoles (source of truth) rather than JWT
    // The JWT tenantId should match, but role assignments are the authoritative source
    if (action === 'create_okr') {
      // Get tenantId from role assignments (source of truth)
      let effectiveUserTenantId: string | undefined;
      
      if (userContext.tenantRoles && userContext.tenantRoles.size > 0) {
        // Use first tenant where user has roles (this is the authoritative source)
        effectiveUserTenantId = Array.from(userContext.tenantRoles.keys())[0];
        
        // If userOrgId is provided, prefer it IF it matches a tenant in role assignments
        // This handles the case where user has multiple tenants but we want to use the one from JWT
        if (userOrgId && userContext.tenantRoles.has(userOrgId)) {
          effectiveUserTenantId = userOrgId;
        }
      } else if (userOrgId) {
        // Fallback: use userOrgId if no role assignments found (shouldn't happen for authenticated users)
        effectiveUserTenantId = userOrgId;
        console.warn('[AUTHORISATION] create_okr: Using userOrgId as fallback (no role assignments found)', {
          userId: userContext.userId,
          userOrgId,
        });
      }
      
      // CRITICAL: If we still don't have a tenantId, deny access
      // This should never happen for authenticated users (login should have failed)
      if (!effectiveUserTenantId) {
        console.error('[AUTHORISATION] create_okr: No tenantId found for user', {
          userId: userContext.userId,
          userOrgId,
          tenantRolesSize: userContext.tenantRoles?.size || 0,
          tenantRolesKeys: userContext.tenantRoles ? Array.from(userContext.tenantRoles.keys()) : [],
        });
        return {
          allow: false,
          reason: 'TENANT_BOUNDARY',
          details: { message: 'User account is not properly configured. Please contact support.' },
        };
      }
      
      // Always override resourceContext.tenantId to ensure it matches where user has roles
      // This prevents tenant leaks and ensures RBAC checks use the correct tenant
      if (!resourceContext.tenantId || resourceContext.tenantId === '' || resourceContext.tenantId !== effectiveUserTenantId) {
        console.log('[AUTHORISATION] create_okr: Overriding resourceContext.tenantId', {
          originalTenantId: resourceContext.tenantId,
          effectiveUserTenantId,
          userOrgId,
          userId: userContext.userId,
          tenantRolesKeys: Array.from(userContext.tenantRoles.keys()),
        });
        resourceContext = {
          ...resourceContext,
          tenantId: effectiveUserTenantId,
        };
      }
    }

    // For mutations, check tenant boundary first
    if (isMutation) {
      const tenantDecision = assertMutation(userContext, resourceContext, userOrgId, action);
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

    // For read actions with resources, check tenant boundary
    // (Visibility checks don't enforce tenant boundaries, so we must do it here)
    if (!isMutation && resourceContext.tenantId && userOrgId !== undefined) {
      // SUPERUSER can read across tenants (read-only access)
      if (userContext.isSuperuser) {
        // Allow superuser to read (but not mutate)
      } else if (userOrgId === null || userOrgId === '') {
        // User has no organisation - deny access
        return {
          allow: false,
          reason: 'TENANT_BOUNDARY',
          details: { message: 'You do not have permission to access resources without an organization.' },
        };
      } else if (resourceContext.tenantId !== userOrgId) {
        // Cross-tenant access attempt - deny
        return {
          allow: false,
          reason: 'TENANT_BOUNDARY',
          details: {
            message: 'You do not have permission to access resources outside your organization.',
            resourceTenantId: resourceContext.tenantId,
            userTenantId: userOrgId,
          },
        };
      }
    }

    // Check RBAC role permissions
    const rbacAllowed = can(userContext, action, resourceContext);
    if (!rbacAllowed) {
      // Enhanced error details for debugging
      const tenantRoles = resourceContext.tenantId 
        ? userContext.tenantRoles.get(resourceContext.tenantId) || []
        : [];
      
      console.error('[AUTHORISATION] RBAC check failed', {
        userId: userContext.userId,
        action,
        resourceContext,
        userOrgId,
        tenantId: resourceContext.tenantId,
        tenantRoles,
        allTenantRoles: Array.from(userContext.tenantRoles.entries()),
        isSuperuser: userContext.isSuperuser,
      });
      
      return {
        allow: false,
        reason: 'ROLE_DENY',
        details: { 
          action, 
          resourceContext: { tenantId: resourceContext.tenantId },
          tenantRoles,
          message: `User does not have permission to ${action} in tenant ${resourceContext.tenantId}`,
        },
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
      tenantId: resourceContext.tenantId || null,
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
          // Try as key result - check parent objective via junction table
          const objectiveKeyResult = await this.prisma.objectiveKeyResult.findFirst({
            where: { keyResultId: resourceContext.okr.id },
            include: {
              objective: {
                select: { id: true, isPublished: true },
              },
            },
          });

          if (objectiveKeyResult?.objective) {
            await this.governanceService.checkPublishLockForKeyResult({
              parentObjective: objectiveKeyResult.objective,
              actingUser,
              rbacService: this.rbacService,
            });
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

