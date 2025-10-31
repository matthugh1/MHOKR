/**
 * RBAC Utility Functions
 * 
 * Common utility functions for RBAC operations.
 */

import { ForbiddenException } from '@nestjs/common';
import { RBACService } from './rbac.service';
import { Action, ResourceContext, Role } from './types';

/**
 * Check if user has any of the specified roles at a scope
 */
export async function hasAnyRole(
  rbacService: RBACService,
  userId: string,
  roles: Role[],
  tenantId: string,
  workspaceId?: string | null,
  teamId?: string | null,
): Promise<boolean> {
  const effectiveRoles = await rbacService.getEffectiveRolesForScope(
    userId,
    tenantId,
    workspaceId,
    teamId,
  );

  return roles.some(role => effectiveRoles.includes(role));
}

/**
 * Check if user has all of the specified roles at a scope
 */
export async function hasAllRoles(
  rbacService: RBACService,
  userId: string,
  roles: Role[],
  tenantId: string,
  workspaceId?: string | null,
  teamId?: string | null,
): Promise<boolean> {
  const effectiveRoles = await rbacService.getEffectiveRolesForScope(
    userId,
    tenantId,
    workspaceId,
    teamId,
  );

  return roles.every(role => effectiveRoles.includes(role));
}

/**
 * Check if user has a specific role at a scope
 */
export async function hasRole(
  rbacService: RBACService,
  userId: string,
  role: Role,
  tenantId: string,
  workspaceId?: string | null,
  teamId?: string | null,
): Promise<boolean> {
  const effectiveRoles = await rbacService.getEffectiveRolesForScope(
    userId,
    tenantId,
    workspaceId,
    teamId,
  );

  return effectiveRoles.includes(role);
}

/**
 * Check multiple actions and return which ones are allowed
 */
export async function checkMultipleActions(
  rbacService: RBACService,
  userId: string,
  actions: Action[],
  resourceContext: ResourceContext,
): Promise<Record<Action, boolean>> {
  const results: Record<string, boolean> = {};

  await Promise.all(
    actions.map(async action => {
      results[action] = await rbacService.canPerformAction(
        userId,
        action,
        resourceContext,
      );
    }),
  );

  return results as Record<Action, boolean>;
}

/**
 * Require specific action or throw ForbiddenException
 */
export async function requireAction(
  rbacService: RBACService,
  userId: string,
  action: Action,
  resourceContext: ResourceContext,
  errorMessage?: string,
): Promise<void> {
  const allowed = await rbacService.canPerformAction(userId, action, resourceContext);

  if (!allowed) {
    throw new ForbiddenException(
      errorMessage || `User does not have permission to ${action}`,
    );
  }
}

/**
 * Get the highest priority role for a user at a scope
 */
export async function getHighestPriorityRole(
  rbacService: RBACService,
  userId: string,
  tenantId: string,
  workspaceId?: string | null,
  teamId?: string | null,
): Promise<Role | null> {
  const roles = await rbacService.getEffectiveRolesForScope(
    userId,
    tenantId,
    workspaceId,
    teamId,
  );

  return roles.length > 0 ? roles[0] : null;
}

/**
 * Check if user is owner of a resource
 */
export function isOwner(userId: string, resourceOwnerId: string): boolean {
  return userId === resourceOwnerId;
}

/**
 * Check if user can view OKR (combines ownership + visibility check)
 */
export async function canViewOKRAsOwnerOrByVisibility(
  rbacService: RBACService,
  userId: string,
  okr: {
    id: string;
    ownerId: string;
    tenantId: string;
    workspaceId?: string | null;
    teamId?: string | null;
    visibilityLevel: string;
  },
  tenant?: { allowTenantAdminExecVisibility?: boolean },
): Promise<boolean> {
  // Owner can always view
  if (isOwner(userId, okr.ownerId)) {
    return true;
  }

  // Check visibility-based access
  return rbacService.canPerformAction(userId, 'view_okr', {
    tenantId: okr.tenantId,
    workspaceId: okr.workspaceId,
    teamId: okr.teamId,
    okr: {
      id: okr.id,
      ownerId: okr.ownerId,
      organizationId: okr.tenantId, // Standardized field (tenantId is deprecated)
      tenantId: okr.tenantId, // Deprecated, kept for backward compatibility
      workspaceId: okr.workspaceId,
      teamId: okr.teamId,
      visibilityLevel: okr.visibilityLevel as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    tenant: tenant ? {
      id: okr.tenantId,
      name: '',
      slug: '',
      allowTenantAdminExecVisibility: tenant.allowTenantAdminExecVisibility || false,
      execOnlyWhitelist: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
  });
}

