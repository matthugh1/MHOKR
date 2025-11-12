/**
 * Tenant Boundary Helper
 * 
 * Centralised tenant isolation checks for mutations.
 * Used by AuthorisationService ONLY for mutation actions.
 */

import { ForbiddenException } from '@nestjs/common';
import { UserContext, ResourceContext, Action } from '../modules/rbac/types';

export type ReasonCode = 'ALLOW' | 'ROLE_DENY' | 'TENANT_BOUNDARY' | 'PRIVATE_VISIBILITY' | 'PUBLISH_LOCK' | 'SUPERUSER_READ_ONLY';

export type Decision = 
  | { allow: true; reason: 'ALLOW'; details?: object }
  | { allow: false; reason: Exclude<ReasonCode, 'ALLOW'>; details?: object };

/**
 * Assert tenant boundary for mutations
 * 
 * Checks:
 * - Same tenant (user org matches resource org)
 * - User can mutate (not superuser read-only, has org)
 * 
 * For create operations (create_okr), resourceContext.tenantId should be set
 * by the authorization service to match the tenant where user has roles.
 * 
 * @param userContext - User's context
 * @param resourceContext - Resource context
 * @param userOrgId - User's organisation ID from JWT (may be undefined/null)
 * @param action - Action being performed (optional, used to handle create operations)
 * @returns Decision with allow/deny and reason
 */
export function assertMutation(
  userContext: UserContext,
  resourceContext: ResourceContext,
  userOrgId?: string | null,
  action?: Action,
): Decision {
  // Check superuser read-only (superuser cannot mutate)
  if (userContext.isSuperuser) {
    return {
      allow: false,
      reason: 'SUPERUSER_READ_ONLY',
      details: { message: 'Superusers are read-only; cannot modify resources.' },
    };
  }

  // For create_okr, use tenantId from resourceContext (already set by authorization service)
  // The authorization service ensures resourceContext.tenantId matches where user has roles
  if (action === 'create_okr') {
    if (!resourceContext.tenantId || resourceContext.tenantId === '') {
      // This should never happen - authorization service should have set it
      return {
        allow: false,
        reason: 'TENANT_BOUNDARY',
        details: { message: 'Tenant context is required for creating resources.' },
      };
    }
    
    // Verify user has roles in this tenant (defense-in-depth)
    if (!userContext.tenantRoles.has(resourceContext.tenantId)) {
      return {
        allow: false,
        reason: 'TENANT_BOUNDARY',
        details: { 
          message: 'You do not have permission to create resources in this tenant.',
          tenantId: resourceContext.tenantId,
          userTenants: Array.from(userContext.tenantRoles.keys()),
        },
      };
    }
    
    // Allow - tenantId matches where user has roles
    return {
      allow: true,
      reason: 'ALLOW',
    };
  }

  // For other mutations, check resource has organisation
  if (!resourceContext.tenantId) {
    return {
      allow: false,
      reason: 'TENANT_BOUNDARY',
      details: { message: 'System/global resources are immutable.' },
    };
  }

  // Determine effective user tenant: prefer tenantId from role assignments
  let effectiveUserOrgId: string | null = null;
  
  // First, try to get tenantId from role assignments (source of truth)
  if (userContext.tenantRoles && userContext.tenantRoles.size > 0) {
    // Check if resourceContext.tenantId matches a tenant where user has roles
    if (userContext.tenantRoles.has(resourceContext.tenantId)) {
      effectiveUserOrgId = resourceContext.tenantId;
    } else {
      // User doesn't have roles in resource tenant - deny
      return {
        allow: false,
        reason: 'TENANT_BOUNDARY',
        details: { 
          message: 'You do not have permission to modify resources outside your organization.',
          resourceTenantId: resourceContext.tenantId,
          userTenants: Array.from(userContext.tenantRoles.keys()),
        },
      };
    }
  } else if (userOrgId) {
    // Fallback: use userOrgId from JWT if no role assignments (shouldn't happen)
    effectiveUserOrgId = userOrgId;
  }

  // Check user has organisation
  if (!effectiveUserOrgId || effectiveUserOrgId === '') {
    return {
      allow: false,
      reason: 'TENANT_BOUNDARY',
      details: { message: 'You do not have permission to modify resources without an organization.' },
    };
  }

  // Check same tenant (should already be verified above, but double-check)
  if (resourceContext.tenantId !== effectiveUserOrgId) {
    return {
      allow: false,
      reason: 'TENANT_BOUNDARY',
      details: { 
        message: 'You do not have permission to modify resources outside your organization.',
        resourceTenantId: resourceContext.tenantId,
        userTenantId: effectiveUserOrgId,
      },
    };
  }

  return {
    allow: true,
    reason: 'ALLOW',
  };
}

/**
 * Service entry check for tenant boundary
 * 
 * Call at the TOP of every mutating service method to assert tenant boundary.
 * Idempotent: can be called multiple times safely.
 * 
 * @param userCtx - User context (req.user.tenantId or req.tenantId)
 * @param resourceCtx - Resource context (tenantId from resource or payload)
 * @throws ForbiddenException if tenant boundary is violated
 */
export function assertMutationBoundary(
  userCtx: string | null | undefined,
  resourceCtx: string | null | undefined,
): void {
  // Superuser bypass (but mutations are blocked elsewhere)
  if (userCtx === null) {
    return; // Superuser check passed
  }

  // User has no tenant
  if (userCtx === undefined || userCtx === '') {
    throw new ForbiddenException({
      code: 'TENANT_BOUNDARY',
      message: 'You do not have permission to modify resources without a tenant context.',
    });
  }

  // Resource has no tenant (system/global resources)
  if (!resourceCtx || resourceCtx === '') {
    throw new ForbiddenException({
      code: 'TENANT_BOUNDARY',
      message: 'System/global resources are immutable.',
    });
  }

  // Tenant mismatch
  if (resourceCtx !== userCtx) {
    throw new ForbiddenException({
      code: 'TENANT_BOUNDARY',
      message: 'Cannot mutate resources across tenant boundaries.',
      userTenantId: userCtx,
      resourceTenantId: resourceCtx,
    });
  }

  // Tenant boundary check passed
}

