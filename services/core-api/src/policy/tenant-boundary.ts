/**
 * Tenant Boundary Helper
 * 
 * Centralised tenant isolation checks for mutations.
 * Used by AuthorisationService ONLY for mutation actions.
 */

import { UserContext, ResourceContext } from '../rbac/types';
import { OkrTenantGuard } from '../okr/tenant-guard';

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
 * @param userContext - User's context
 * @param resourceContext - Resource context
 * @returns Decision with allow/deny and reason
 */
export function assertMutation(
  userContext: UserContext,
  resourceContext: ResourceContext,
  userOrgId?: string | null,
): Decision {
  // Use provided userOrgId or try to derive from resource context
  const effectiveUserOrgId = userOrgId !== undefined ? userOrgId : resourceContext.tenantId || null;
  
  // Check superuser read-only (superuser cannot mutate)
  if (userContext.isSuperuser) {
    return {
      allow: false,
      reason: 'SUPERUSER_READ_ONLY',
      details: { message: 'Superusers are read-only; cannot modify resources.' },
    };
  }

  // Check user has organisation (null means superuser, empty means no org)
  if (!effectiveUserOrgId || effectiveUserOrgId === '') {
    return {
      allow: false,
      reason: 'TENANT_BOUNDARY',
      details: { message: 'You do not have permission to modify resources without an organization.' },
    };
  }

  // Check resource has organisation
  if (!resourceContext.tenantId) {
    return {
      allow: false,
      reason: 'TENANT_BOUNDARY',
      details: { message: 'System/global resources are immutable.' },
    };
  }

  // Check same tenant
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

