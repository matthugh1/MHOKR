/**
 * Visibility Policy
 * 
 * Implements object-level access control (OLAC) for OKRs based on visibility levels.
 * This enforces which users can view which OKRs based on the OKR's visibility_level
 * and the user's roles and relationships.
 */

import {
  UserContext,
  OKREntity,
  Tenant,
  Role,
} from './types';
import { getRolePriority } from './types';

/**
 * Check if a user can view an OKR based on visibility rules
 * 
 * Model: All OKRs are globally visible by default.
 * Only PRIVATE OKRs restrict read access.
 * Filters (workspace, team, owner, etc.) control UI display, NOT permissions.
 * 
 * @param userContext - The user's context with roles and relationships
 * @param okr - The OKR entity being accessed
 * @param tenant - The tenant configuration (for PRIVATE whitelist checks)
 * @returns true if the user can view the OKR, false otherwise
 */
export function canViewOKR(
  userContext: UserContext,
  okr: OKREntity,
  tenant?: Tenant,
): boolean {
  // SUPERUSER can view everything (but cannot edit/delete)
  if (userContext.isSuperuser) {
    return true;
  }

  // Owner can always view their own OKRs (regardless of visibility level)
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // Only PRIVATE OKRs restrict read access
  // All other visibility levels are globally visible (PUBLIC_TENANT and deprecated levels)
  if (okr.visibilityLevel === 'PRIVATE') {
    return canViewPrivate(userContext, okr, tenant);
  }

  // All other visibility levels are treated as globally visible
  // Legacy levels (WORKSPACE_ONLY, TEAM_ONLY, MANAGER_CHAIN, EXEC_ONLY) are kept
  // for backward compatibility but treated as PUBLIC_TENANT
  return true;
}

/**
 * PRIVATE: Only owner + explicit whitelist (HR, legal, M&A confidential OKRs)
 * 
 * This is the ONLY visibility level that restricts read access.
 * All other levels (PUBLIC_TENANT and deprecated ones) are globally visible.
 */
function canViewPrivate(
  userContext: UserContext,
  okr: OKREntity,
  tenant?: Tenant & { privateWhitelist?: string[] | null },
): boolean {
  // Use organizationId instead of tenantId
  const tenantId = okr.organizationId || okr.tenantId || '';
  
  // TENANT_OWNER can view private OKRs in their tenant
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  if (tenantRoles.includes('TENANT_OWNER')) {
    return true;
  }

  // Check explicit whitelist from tenant configuration
  // Support both top-level and metadata.execOnlyWhitelist for backward compatibility
  if (tenant?.privateWhitelist && Array.isArray(tenant.privateWhitelist)) {
    if (tenant.privateWhitelist.includes(userContext.userId)) {
      return true;
    }
  }

  // Also check execOnlyWhitelist for backward compatibility (if PRIVATE uses EXEC_ONLY whitelist)
  if (tenant?.execOnlyWhitelist && Array.isArray(tenant.execOnlyWhitelist)) {
    if (tenant.execOnlyWhitelist.includes(userContext.userId)) {
      return true;
    }
  }

  // Check metadata.privateWhitelist or metadata.execOnlyWhitelist
  if (tenant && 'metadata' in tenant && tenant.metadata) {
    const metadata = tenant.metadata as any;
    if (metadata.privateWhitelist && Array.isArray(metadata.privateWhitelist)) {
      if (metadata.privateWhitelist.includes(userContext.userId)) {
        return true;
      }
    }
    if (metadata.execOnlyWhitelist && Array.isArray(metadata.execOnlyWhitelist)) {
      if (metadata.execOnlyWhitelist.includes(userContext.userId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * DEPRECATED: This function is no longer used.
 * WORKSPACE_ONLY visibility level is now treated as globally visible (PUBLIC_TENANT).
 * Kept for backward compatibility reference only.
 * 
 * @deprecated Use canViewOKR() which now only restricts PRIVATE OKRs
 */
// @ts-ignore - Deprecated function kept for reference
function _canViewWorkspaceOnly(userContext: UserContext, okr: OKREntity): boolean {
  if (!okr.workspaceId) {
    return false; // Can't have workspace-only visibility without a workspace
  }

  // TENANT_OWNER and TENANT_ADMIN can view
  const tenantRoles = userContext.tenantRoles.get(okr.tenantId) || [];
  if (tenantRoles.includes('TENANT_OWNER') || tenantRoles.includes('TENANT_ADMIN')) {
    return true;
  }

  // Workspace members can view
  const workspaceRoles = userContext.workspaceRoles.get(okr.workspaceId);
  if (workspaceRoles && workspaceRoles.length > 0) {
    return true;
  }

  // Team members within the workspace can view (workspace contains teams)
  if (okr.teamId) {
    const teamRoles = userContext.teamRoles.get(okr.teamId);
    if (teamRoles && teamRoles.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * DEPRECATED: This function is no longer used.
 * TEAM_ONLY visibility level is now treated as globally visible (PUBLIC_TENANT).
 * Kept for backward compatibility reference only.
 * 
 * @deprecated Use canViewOKR() which now only restricts PRIVATE OKRs
 */
// @ts-ignore - Deprecated function kept for reference
function _canViewTeamOnly(userContext: UserContext, okr: OKREntity): boolean {
  if (!okr.teamId) {
    return false; // Can't have team-only visibility without a team
  }

  // TENANT_OWNER can view
  const tenantRoles = userContext.tenantRoles.get(okr.tenantId) || [];
  if (tenantRoles.includes('TENANT_OWNER')) {
    return true;
  }

  // WORKSPACE_LEAD of the workspace can view
  if (okr.workspaceId) {
    const workspaceRoles = userContext.workspaceRoles.get(okr.workspaceId) || [];
    if (workspaceRoles.includes('WORKSPACE_LEAD')) {
      return true;
    }
  }

  // Team members can view
  const teamRoles = userContext.teamRoles.get(okr.teamId);
  if (teamRoles && teamRoles.length > 0) {
    return true;
  }

  return false;
}

/**
 * DEPRECATED: This function is no longer used.
 * MANAGER_CHAIN visibility level is now treated as globally visible (PUBLIC_TENANT).
 * Kept for backward compatibility reference only.
 * 
 * @deprecated Use canViewOKR() which now only restricts PRIVATE OKRs
 */
// @ts-ignore - Deprecated function kept for reference
function _canViewManagerChain(
  userContext: UserContext,
  okr: OKREntity,
  tenant?: Tenant,
): boolean {
  // TENANT_OWNER can always view
  const tenantRoles = userContext.tenantRoles.get(okr.tenantId) || [];
  if (tenantRoles.includes('TENANT_OWNER')) {
    return true;
  }

  // TENANT_ADMIN can view if tenant allows it
  if (tenantRoles.includes('TENANT_ADMIN')) {
    if (tenant?.allowTenantAdminExecVisibility) {
      return true;
    }
  }

  // WORKSPACE_LEAD of the workspace can view
  if (okr.workspaceId) {
    const workspaceRoles = userContext.workspaceRoles.get(okr.workspaceId) || [];
    if (workspaceRoles.includes('WORKSPACE_LEAD')) {
      return true;
    }
  }

  // Direct TEAM_LEAD can view (if OKR owner is in their team)
  if (okr.teamId) {
    const teamRoles = userContext.teamRoles.get(okr.teamId) || [];
    if (teamRoles.includes('TEAM_LEAD')) {
      // Check if OKR owner reports to this user (they are TEAM_LEAD of owner's team)
      // This would require checking if okr.ownerId has userContext.userId as their manager
      // For now, if user is TEAM_LEAD and OKR is in their team, allow
      return true;
    }
  }

  // User is the manager of the OKR owner (checked via directReports)
  if (userContext.directReports?.includes(okr.ownerId)) {
    return true;
  }

  return false;
}

/**
 * DEPRECATED: This function is no longer used.
 * EXEC_ONLY visibility level is now treated as globally visible (PUBLIC_TENANT).
 * Kept for backward compatibility reference only.
 * 
 * @deprecated Use canViewOKR() which now only restricts PRIVATE OKRs
 */
// @ts-ignore - Deprecated function kept for reference
function _canViewExecOnly(
  userContext: UserContext,
  okr: OKREntity,
  tenant?: Tenant & { execOnlyWhitelist?: string[] | null },
): boolean {
  // TENANT_OWNER can view
  const tenantRoles = userContext.tenantRoles.get(okr.tenantId) || [];
  if (tenantRoles.includes('TENANT_OWNER')) {
    return true;
  }

  // Check explicit whitelist from tenant configuration
  if (tenant?.execOnlyWhitelist && Array.isArray(tenant.execOnlyWhitelist)) {
    if (tenant.execOnlyWhitelist.includes(userContext.userId)) {
      return true;
    }
  }

  // Also check metadata.execOnlyWhitelist for backward compatibility
  if (tenant && 'metadata' in tenant && tenant.metadata) {
    const metadata = tenant.metadata as any;
    if (metadata.execOnlyWhitelist && Array.isArray(metadata.execOnlyWhitelist)) {
      if (metadata.execOnlyWhitelist.includes(userContext.userId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if an OKR is published (not draft)
 * Some visibility rules may only apply to published OKRs.
 */
export function isOKRPublished(okr: OKREntity): boolean {
  return okr.isPublished === true;
}

/**
 * Check if user has the highest-priority role at a scope
 */
export function hasHighestPriorityRole(
  userContext: UserContext,
  scopeType: 'TENANT' | 'WORKSPACE' | 'TEAM',
  scopeId: string,
): boolean {
  // Get all roles at this scope
  let roles: Role[] = [];
  
  switch (scopeType) {
    case 'TENANT':
      roles = (userContext.tenantRoles.get(scopeId) || []) as Role[];
      break;
    case 'WORKSPACE':
      roles = (userContext.workspaceRoles.get(scopeId) || []) as Role[];
      break;
    case 'TEAM':
      roles = (userContext.teamRoles.get(scopeId) || []) as Role[];
      break;
  }

  if (roles.length === 0) {
    return false;
  }

  // Find the highest priority role
  const highestRole = roles.reduce((max, role) => {
    return getRolePriority(role) > getRolePriority(max) ? role : max;
  }, roles[0]);

  // Check if this is the highest possible role for this scope
  const possibleRoles: Role[] = 
    scopeType === 'TENANT' 
      ? ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_VIEWER']
      : scopeType === 'WORKSPACE'
      ? ['WORKSPACE_LEAD', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER']
      : ['TEAM_LEAD', 'TEAM_CONTRIBUTOR', 'TEAM_VIEWER'];

  const highestPossibleRole = possibleRoles.reduce((max, role) => {
    return getRolePriority(role) > getRolePriority(max) ? role : max;
  }, possibleRoles[0]);

  return highestRole === highestPossibleRole;
}

