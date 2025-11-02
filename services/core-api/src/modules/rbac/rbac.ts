/**
 * RBAC (Role-Based Access Control) Authorization
 * 
 * Implements the authorization logic for the multi-tenant OKR platform.
 * Provides functions to check user permissions based on roles and visibility rules.
 */

import {
  UserContext,
  ResourceContext,
  Action,
  Role,
  getRolePriority,
} from './types';
import { canViewOKR } from './visibilityPolicy';

/**
 * Get effective roles for a user at a specific scope
 * 
 * Returns all roles that apply to the user at the given scope, considering:
 * - Direct role assignments
 * - Role inheritance (higher scopes inherit down)
 * - Role priority (most powerful role wins)
 * 
 * @param userContext - User's context with all role assignments
 * @param tenantId - Target tenant ID
 * @param workspaceId - Optional workspace ID
 * @param teamId - Optional team ID
 * @returns Array of effective roles, sorted by priority (highest first)
 */
export function getEffectiveRoles(
  userContext: UserContext,
  tenantId: string,
  workspaceId?: string | null,
  teamId?: string | null,
): Role[] {
  const roles: Role[] = [];

  // SUPERUSER applies at all scopes
  if (userContext.isSuperuser) {
    roles.push('SUPERUSER');
  }

  // Tenant-level roles
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  roles.push(...tenantRoles);

  // Workspace-level roles (if workspace specified)
  if (workspaceId) {
    const workspaceRoles = userContext.workspaceRoles.get(workspaceId) || [];
    roles.push(...workspaceRoles);
  }

  // Team-level roles (if team specified)
  if (teamId) {
    const teamRoles = userContext.teamRoles.get(teamId) || [];
    roles.push(...teamRoles);
  }

  // Remove duplicates and sort by priority (highest first)
  const uniqueRoles = Array.from(new Set(roles));
  return uniqueRoles.sort((a, b) => getRolePriority(b) - getRolePriority(a));
}

/**
 * Get the highest priority role for a user at a scope
 */
export function getHighestPriorityRole(
  userContext: UserContext,
  tenantId: string,
  workspaceId?: string | null,
  teamId?: string | null,
): Role | null {
  const effectiveRoles = getEffectiveRoles(userContext, tenantId, workspaceId, teamId);
  return effectiveRoles.length > 0 ? effectiveRoles[0] : null;
}

/**
 * Main authorization function
 * 
 * Checks if a user can perform an action on a resource based on:
 * - Role-based access control (RBAC)
 * - Object-level access control (visibility rules for OKRs)
 * - Resource context (scope, ownership, etc.)
 * 
 * @param userContext - User's context with roles and relationships
 * @param action - Action being performed
 * @param resourceContext - Context about the resource being accessed
 * @returns true if authorized, false otherwise
 */
export function can(
  userContext: UserContext,
  action: Action,
  resourceContext: ResourceContext,
): boolean {
  // SUPERUSER has special handling (can view but cannot edit/delete)
  if (userContext.isSuperuser) {
    return canSuperuser(userContext, action, resourceContext);
  }

  // Check action-specific permissions
  switch (action) {
    case 'view_okr':
      return canViewOKRAction(userContext, resourceContext);
    
    case 'edit_okr':
      return canEditOKRAction(userContext, resourceContext);
    
    case 'delete_okr':
      return canDeleteOKRAction(userContext, resourceContext);
    
    case 'create_okr':
      return canCreateOKRAction(userContext, resourceContext);
    
    case 'request_checkin':
      return canRequestCheckinAction(userContext, resourceContext);
    
    case 'publish_okr':
      return canPublishOKRAction(userContext, resourceContext);
    
    case 'manage_users':
      return canManageUsers(userContext, resourceContext);
    
    case 'manage_billing':
      return canManageBilling(userContext, resourceContext);
    
    case 'manage_workspaces':
      return canManageWorkspaces(userContext, resourceContext);
    
    case 'manage_teams':
      return canManageTeams(userContext, resourceContext);
    
    case 'impersonate_user':
      return canImpersonateUser(userContext, resourceContext);
    
    case 'manage_tenant_settings':
      return canManageTenantSettings(userContext, resourceContext);
    
    case 'view_all_okrs':
      return canViewAllOKRs(userContext, resourceContext);
    
    case 'export_data':
      return canExportData(userContext, resourceContext);
    
    default:
      return false;
  }
}

// ============================================================================
// ACTION-SPECIFIC PERMISSION CHECKS
// ============================================================================

/**
 * SUPERUSER capabilities
 * - Can view and administer ANY tenant, workspace, and user
 * - Can read ALL OKR data
 * - CANNOT create, edit, or delete OKR content (read-only access)
 * - CANNOT modify tenant strategy content
 */
function canSuperuser(
  _userContext: UserContext,
  action: Action,
  _resourceContext: ResourceContext,
): boolean {
  // SUPERUSER can view everything
  if (action === 'view_okr' || action === 'view_all_okrs') {
    return true;
  }

  // SUPERUSER can impersonate users
  if (action === 'impersonate_user') {
    return true;
  }

  // SUPERUSER can export data
  if (action === 'export_data') {
    return true;
  }

  // SUPERUSER CANNOT edit/delete/create OKRs or request check-ins
  if (action === 'edit_okr' || action === 'delete_okr' || action === 'create_okr' || action === 'publish_okr' || action === 'request_checkin') {
    return false;
  }

  // SUPERUSER can manage users/workspaces/teams for administration
  if (
    action === 'manage_users' ||
    action === 'manage_workspaces' ||
    action === 'manage_teams' ||
    action === 'manage_tenant_settings'
  ) {
    return true;
  }

  // SUPERUSER cannot manage billing (not in their scope)
  if (action === 'manage_billing') {
    return false;
  }

  return false;
}

/**
 * TENANT_OWNER capabilities
 * - Full commercial/contractual/security owner
 * - Manage tenant billing, contract, legal entity info
 * - Create, archive, and rename workspaces
 * - Invite/remove any user from the tenant
 * - Assign tenant-level roles, workspace roles, team roles
 * - View and report on EVERY workspace and team in the tenant
 * - View ALL OKRs across the tenant, including restricted and "exec only"
 * - Configure tenant-wide policy
 */
function hasTenantOwnerRole(userContext: UserContext, tenantId: string): boolean {
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  return tenantRoles.includes('TENANT_OWNER');
}

/**
 * TENANT_ADMIN capabilities
 * - Operational admin for the tenant
 * - Invite/remove users from the tenant
 * - Assign workspace and team roles
 * - Create/close OKR periods / quarters
 * - Run reporting across the whole tenant
 * - View all PUBLIC / TEAM / MANAGER-CHAIN OKRs across the tenant
 * - May or may not see EXEC_ONLY OKRs depending on tenant setting
 * - Cannot access billing/contract settings
 * - Cannot delete workspaces
 * - Cannot demote/remove the TENANT_OWNER
 */
function hasTenantAdminRole(userContext: UserContext, tenantId: string): boolean {
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  return tenantRoles.includes('TENANT_ADMIN');
}

/**
 * WORKSPACE_LEAD capabilities
 * - Department head / functional leader
 * - Create and edit workspace-level OKRs
 * - Approve/publish OKRs for that workspace
 * - Create/manage teams within that workspace
 * - Add/remove EXISTING tenant users into that workspace
 * - View ALL OKRs in that workspace, including TEAM_ONLY and MANAGER_CHAIN
 * - Control visibility of "draft vs published" for that workspace
 */
function hasWorkspaceLeadRole(userContext: UserContext, workspaceId: string): boolean {
  const workspaceRoles = userContext.workspaceRoles.get(workspaceId) || [];
  return workspaceRoles.includes('WORKSPACE_LEAD');
}

/**
 * TEAM_LEAD capabilities
 * - Create/edit team OKRs
 * - Approve/publish team OKRs for visibility to the whole workspace
 * - See all personal OKRs of members of that team, including MANAGER_CHAIN
 * - Add/remove EXISTING workspace members to/from the team
 * - Update status / confidence / RAG on team KRs
 */
function hasTeamLeadRole(userContext: UserContext, teamId: string): boolean {
  const teamRoles = userContext.teamRoles.get(teamId) || [];
  return teamRoles.includes('TEAM_LEAD');
}

/**
 * Check if user can view an OKR (combines RBAC + visibility rules)
 * 
 * For list endpoints (no specific OKR), all authenticated users can access lists.
 * Filtering happens in the UI, not via backend access control.
 * 
 * For specific OKR endpoints, checks visibility policy (only PRIVATE OKRs are restricted).
 */
function canViewOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  // For list endpoints (no specific OKR), allow all authenticated users
  // The actual visibility filtering happens in the UI, not here
  if (!resourceContext.okr) {
    return true; // All authenticated users can see lists
  }

  // For specific OKR, check visibility policy
  // Only PRIVATE OKRs are restricted; all others are globally visible
  return canViewOKR(userContext, resourceContext.okr, resourceContext.tenant);
}

/**
 * Check if user can edit an OKR
 * 
 * Governs post-publish edit control: once an OKR is published (isPublished === true),
 * only TENANT_OWNER and TENANT_ADMIN can edit it. All other roles are blocked.
 */
function canEditOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  // NOTE: organizationId is the canonical tenant identifier.
  // tenantId is legacy and kept only for backward compatibility with pre-P0 data.
  // Do not reintroduce tenantId in new code.
  const tenantId = okr.organizationId || (okr as any).tenantId || '';

  // PUBLISH LOCK: If OKR is published, only TENANT_OWNER and TENANT_ADMIN can edit
  if (okr.isPublished === true) {
    if (hasTenantOwnerRole(userContext, tenantId)) {
      return true;
    }
    if (hasTenantAdminRole(userContext, tenantId)) {
      // TENANT_ADMIN can edit published OKRs (but not EXEC_ONLY unless allowed)
      if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
        return false;
      }
      return true;
    }
    // All other roles (including owner) cannot edit published OKRs
    return false;
  }

  // For draft (unpublished) OKRs, apply normal RBAC rules
  // Owner can always edit their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // TENANT_OWNER can edit any OKR in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can edit OKRs in their tenant (but not EXEC_ONLY unless allowed)
  if (hasTenantAdminRole(userContext, tenantId)) {
    if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
      return false;
    }
    return true;
  }

  // WORKSPACE_LEAD can edit workspace-level OKRs
  if (okr.workspaceId && hasWorkspaceLeadRole(userContext, okr.workspaceId)) {
    return true;
  }

  // TEAM_LEAD can edit team-level OKRs
  if (okr.teamId && hasTeamLeadRole(userContext, okr.teamId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can delete an OKR
 * 
 * Governs post-publish edit control: once an OKR is published (isPublished === true),
 * only TENANT_OWNER and TENANT_ADMIN can delete it. All other roles are blocked.
 */
function canDeleteOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  // NOTE: organizationId is the canonical tenant identifier.
  // tenantId is legacy and kept only for backward compatibility with pre-P0 data.
  // Do not reintroduce tenantId in new code.
  const tenantId = okr.organizationId || (okr as any).tenantId || '';

  // PUBLISH LOCK: If OKR is published, only TENANT_OWNER and TENANT_ADMIN can delete
  if (okr.isPublished === true) {
    if (hasTenantOwnerRole(userContext, tenantId)) {
      return true;
    }
    if (hasTenantAdminRole(userContext, tenantId)) {
      // TENANT_ADMIN can delete published OKRs (but not EXEC_ONLY unless allowed)
      if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
        return false;
      }
      return true;
    }
    // All other roles (including owner) cannot delete published OKRs
    return false;
  }

  // For draft (unpublished) OKRs, apply normal RBAC rules
  // Owner can delete their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // TENANT_OWNER can delete any OKR in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can delete OKRs (but not EXEC_ONLY unless allowed)
  if (hasTenantAdminRole(userContext, tenantId)) {
    if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
      return false;
    }
    return true;
  }

  // WORKSPACE_LEAD can delete workspace-level OKRs
  if (okr.workspaceId && hasWorkspaceLeadRole(userContext, okr.workspaceId)) {
    return true;
  }

  // TEAM_LEAD can delete team-level OKRs (not personal OKRs of members)
  if (okr.teamId && hasTeamLeadRole(userContext, okr.teamId)) {
    // Only if it's a team-level OKR, not a personal OKR
    if (okr.teamId) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user can create an OKR
 */
function canCreateOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // Check if user has any role in the tenant
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  if (tenantRoles.length > 0) {
    // TENANT_VIEWER cannot create OKRs
    if (tenantRoles.includes('TENANT_VIEWER') && tenantRoles.length === 1) {
      return false;
    }
    return true;
  }

  // Check workspace membership
  if (resourceContext.workspaceId) {
    const workspaceRoles = userContext.workspaceRoles.get(resourceContext.workspaceId) || [];
    if (workspaceRoles.length > 0) {
      return true;
    }
  }

  // Check team membership
  if (resourceContext.teamId) {
    const teamRoles = userContext.teamRoles.get(resourceContext.teamId) || [];
    if (teamRoles.length > 0 && !teamRoles.includes('TEAM_VIEWER')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user can request a check-in from another user.
 * 
 * Basic RBAC check: user must have tenant membership.
 * Detailed authorization (manager relationship, workspace/team leads) is handled
 * in the service layer via canRequestCheckinForUser().
 */
function canRequestCheckinAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  if (!tenantId) {
    return false;
  }

  // Check if user has any role in the tenant (except TENANT_VIEWER alone)
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  if (tenantRoles.length > 0) {
    // TENANT_VIEWER alone cannot request check-ins
    if (tenantRoles.includes('TENANT_VIEWER') && tenantRoles.length === 1) {
      return false;
    }
    return true;
  }

  // Check workspace membership
  if (resourceContext.workspaceId) {
    const workspaceRoles = userContext.workspaceRoles.get(resourceContext.workspaceId) || [];
    if (workspaceRoles.length > 0) {
      return true;
    }
  }

  // Check team membership
  if (resourceContext.teamId) {
    const teamRoles = userContext.teamRoles.get(resourceContext.teamId) || [];
    if (teamRoles.length > 0 && !teamRoles.includes('TEAM_VIEWER')) {
      return true;
    }
  }

  // User has no tenant/workspace/team membership - cannot request check-ins
  return false;
}

/**
 * Check if user can publish an OKR
 */
function canPublishOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  // NOTE: organizationId is the canonical tenant identifier.
  // tenantId is legacy and kept only for backward compatibility with pre-P0 data.
  // Do not reintroduce tenantId in new code.
  const tenantId = okr.organizationId || (okr as any).tenantId || '';

  // TENANT_OWNER can publish any OKR
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can publish OKRs
  if (hasTenantAdminRole(userContext, tenantId)) {
    return true;
  }

  // WORKSPACE_LEAD can publish workspace-level OKRs
  if (okr.workspaceId && hasWorkspaceLeadRole(userContext, okr.workspaceId)) {
    return true;
  }

  // TEAM_LEAD can publish team-level OKRs
  if (okr.teamId && hasTeamLeadRole(userContext, okr.teamId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can manage users (invite/remove, assign roles)
 */
function canManageUsers(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // TENANT_OWNER can manage any user in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can manage users in their tenant
  if (hasTenantAdminRole(userContext, tenantId)) {
    // Cannot demote/remove TENANT_OWNER
    if (resourceContext.targetUserId) {
      // Would need to check if target user is TENANT_OWNER (would require DB lookup)
      // For now, allow but this should be checked in the service layer
    }
    return true;
  }
  
  // WORKSPACE_LEAD can add/remove EXISTING tenant users to/from workspace
  if (resourceContext.workspaceId && hasWorkspaceLeadRole(userContext, resourceContext.workspaceId)) {
    // Can only add existing users, not create new ones
    return true;
  }

  // TEAM_LEAD can add/remove EXISTING workspace members to/from team
  if (resourceContext.teamId && hasTeamLeadRole(userContext, resourceContext.teamId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can manage billing
 */
function canManageBilling(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // Only TENANT_OWNER can manage billing
  return hasTenantOwnerRole(userContext, tenantId);
}

/**
 * Check if user can manage workspaces
 */
function canManageWorkspaces(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // If no tenantId specified, check if user has permission in any tenant
  if (!tenantId) {
    // User can manage workspaces if they're TENANT_OWNER or TENANT_ADMIN in any tenant
    for (const [_, roles] of userContext.tenantRoles) {
      if (roles.includes('TENANT_OWNER') || roles.includes('TENANT_ADMIN')) {
        return true;
      }
    }
    return false;
  }

  // TENANT_OWNER can create, archive, rename workspaces
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can create/edit workspaces (but cannot delete)
  if (hasTenantAdminRole(userContext, tenantId)) {
    return true;
  }

  // WORKSPACE_LEAD can create/manage teams within workspace

  return false;
}

/**
 * Check if user can manage teams
 */
function canManageTeams(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // TENANT_OWNER can manage teams
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can manage teams
  if (hasTenantAdminRole(userContext, tenantId)) {
    return true;
  }

  // WORKSPACE_LEAD can create/manage teams within their workspace
  if (resourceContext.workspaceId && hasWorkspaceLeadRole(userContext, resourceContext.workspaceId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can impersonate another user
 */
function canImpersonateUser(
  userContext: UserContext,
  _resourceContext: ResourceContext,
): boolean {
  // Only SUPERUSER can impersonate users
  return userContext.isSuperuser;
}

/**
 * Check if user can manage tenant settings
 */
function canManageTenantSettings(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // If no tenantId specified or empty, check if user has TENANT_OWNER role in any tenant
  if (!tenantId || tenantId === '') {
    // User can manage tenant settings if they're a TENANT_OWNER in any tenant
    for (const [_, roles] of userContext.tenantRoles) {
      if (roles.includes('TENANT_OWNER')) {
        return true;
      }
    }
    // Also allow superusers
    return userContext.isSuperuser;
  }

  // Only TENANT_OWNER can configure tenant-wide policy for a specific tenant
  return hasTenantOwnerRole(userContext, tenantId);
}

/**
 * Check if user can view all OKRs (for reporting)
 */
function canViewAllOKRs(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // TENANT_OWNER can view all OKRs
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can view all public/team/manager-chain OKRs
  if (hasTenantAdminRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_VIEWER can view all published/public OKRs
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  if (tenantRoles.includes('TENANT_VIEWER')) {
    return true;
  }

  return false;
}

/**
 * Check if user can export data
 */
function canExportData(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // TENANT_OWNER can export
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can export
  if (hasTenantAdminRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_VIEWER can export (read-only)
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  if (tenantRoles.includes('TENANT_VIEWER')) {
    return true;
  }

  return false;
}

