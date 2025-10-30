/**
 * RBAC Type Definitions
 * 
 * This file contains all type definitions for the Role-Based Access Control (RBAC)
 * and visibility rules system for the multi-tenant OKR platform.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Platform-level role (internal only, not assignable by customers)
 */
export type PlatformRole = 'SUPERUSER';

/**
 * Tenant-level roles
 */
export type TenantRole = 'TENANT_OWNER' | 'TENANT_ADMIN' | 'TENANT_VIEWER';

/**
 * Workspace-level roles
 */
export type WorkspaceRole = 'WORKSPACE_LEAD' | 'WORKSPACE_ADMIN' | 'WORKSPACE_MEMBER';

/**
 * Team-level roles
 */
export type TeamRole = 'TEAM_LEAD' | 'TEAM_CONTRIBUTOR' | 'TEAM_VIEWER';

/**
 * All roles in the system
 */
export type Role = PlatformRole | TenantRole | WorkspaceRole | TeamRole;

/**
 * Scope types for role assignments
 */
export type ScopeType = 'PLATFORM' | 'TENANT' | 'WORKSPACE' | 'TEAM';

/**
 * Visibility levels for OKRs (Objectives and Key Results)
 * 
 * Note: PUBLIC_TENANT is the default. All OKRs are globally visible by default.
 * Filters (workspace, team, owner, etc.) control what is shown in the UI, NOT permissions.
 * Only PRIVATE OKRs restrict read access at the backend level.
 */
export type VisibilityLevel = 
  | 'PUBLIC_TENANT'     // Default: Visible to everyone (filtered in UI, not blocked by backend)
  | 'PRIVATE'           // Only owner + explicit whitelist (HR, legal, M&A confidential OKRs)
  | 'WORKSPACE_ONLY'    // DEPRECATED: Kept for backward compatibility, treated as PUBLIC_TENANT
  | 'TEAM_ONLY'         // DEPRECATED: Kept for backward compatibility, treated as PUBLIC_TENANT
  | 'MANAGER_CHAIN'     // DEPRECATED: Kept for backward compatibility, treated as PUBLIC_TENANT
  | 'EXEC_ONLY';        // DEPRECATED: Kept for backward compatibility, treated as PUBLIC_TENANT

/**
 * Actions that can be performed in the system
 */
export type Action =
  | 'view_okr'          // View an OKR (subject to visibility rules)
  | 'edit_okr'          // Edit an OKR
  | 'delete_okr'        // Delete an OKR
  | 'publish_okr'       // Publish/approve an OKR for visibility
  | 'create_okr'        // Create a new OKR
  | 'manage_users'      // Invite/remove users, assign roles
  | 'manage_billing'    // Manage tenant billing and contracts
  | 'manage_workspaces' // Create/edit/delete workspaces
  | 'manage_teams'      // Create/edit/delete teams
  | 'impersonate_user'  // Impersonate another user (superuser only)
  | 'manage_tenant_settings' // Configure tenant-wide policies
  | 'view_all_okrs'     // View all OKRs regardless of visibility (for reporting)
  | 'export_data';      // Export data for reporting/analytics

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * User entity
 */
export interface User {
  id: string;
  email: string;
  name: string;
  isSuperuser?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant (Organization) entity
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  allowTenantAdminExecVisibility?: boolean; // Config flag for TENANT_ADMIN access to EXEC_ONLY
  execOnlyWhitelist?: string[] | null; // Array of user IDs allowed to view EXEC_ONLY OKRs
  metadata?: Record<string, any> | null; // Additional tenant configuration
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workspace entity
 */
export interface Workspace {
  id: string;
  name: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team entity
 */
export interface Team {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role assignment record
 * 
 * A user can have multiple role assignments across different scopes.
 * For example:
 * - TENANT_ADMIN at tenant scope
 * - WORKSPACE_MEMBER at workspace scope
 * - TEAM_VIEWER at team scope
 */
export interface RoleAssignment {
  id: string;
  userId: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null; // null for PLATFORM scope, required for others
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OKR entity (Objective or Key Result)
 */
export interface OKREntity {
  id: string;
  ownerId: string; // User who owns this OKR
  organizationId: string;  // Standardized organization ID (primary field)
  tenantId: string;  // Deprecated: kept for backward compatibility, maps to organizationId
  workspaceId?: string | null;
  teamId?: string | null;
  visibilityLevel: VisibilityLevel;
  isPublished?: boolean; // Whether the OKR is published (draft vs published)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User context for authorization checks
 * 
 * Contains the user's effective roles at different scopes, computed
 * from all their role assignments.
 */
export interface UserContext {
  userId: string;
  isSuperuser: boolean;
  
  // Effective roles at tenant level
  tenantRoles: Map<string, TenantRole[]>; // tenantId -> roles[]
  
  // Effective roles at workspace level
  workspaceRoles: Map<string, WorkspaceRole[]>; // workspaceId -> roles[]
  
  // Effective roles at team level
  teamRoles: Map<string, TeamRole[]>; // teamId -> roles[]
  
  // All role assignments (for detailed checks)
  roleAssignments: RoleAssignment[];
  
  // Manager relationships (for MANAGER_CHAIN visibility)
  directReports?: string[]; // User IDs that report to this user
  managerId?: string; // User ID of this user's manager
}

/**
 * Resource context for authorization checks
 * 
 * Describes the resource being accessed and the context needed
 * to determine permissions.
 */
export interface ResourceContext {
  // Target scope
  tenantId: string;
  workspaceId?: string | null;
  teamId?: string | null;
  
  // For OKR operations
  okr?: OKREntity;
  
  // For user management operations
  targetUserId?: string;
  
  // For workspace/team management
  targetWorkspaceId?: string;
  targetTeamId?: string;
  
  // Tenant configuration (for visibility rule checks)
  tenant?: Tenant;
}

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string;
  actorUserId: string; // User who performed the action
  action: string; // Action performed (e.g., 'GRANT_ROLE', 'PUBLISH_OKR', 'IMPERSONATE_USER')
  targetType: 'USER' | 'ROLE_ASSIGNMENT' | 'OKR' | 'WORKSPACE' | 'TEAM' | 'TENANT' | 'VISIBILITY_CHANGE';
  targetId: string; // ID of the target entity
  timestamp: Date;
  metadata?: Record<string, any>; // Additional context (JSON)
  
  // For role changes
  previousRole?: Role;
  newRole?: Role;
  
  // For impersonation
  impersonatedUserId?: string;
}

/**
 * Result of an authorization check
 */
export type AuthorizationResult = 
  | { allowed: true }
  | { allowed: false; reason: string };

// ============================================================================
// ROLE PRIORITY
// ============================================================================

/**
 * Role priority order (higher number = more permissions)
 * Used to determine the most powerful role when multiple roles apply.
 */
export const ROLE_PRIORITY: Record<Role, number> = {
  // Platform level
  SUPERUSER: 100,
  
  // Tenant level
  TENANT_OWNER: 90,
  TENANT_ADMIN: 80,
  TENANT_VIEWER: 10,
  
  // Workspace level
  WORKSPACE_LEAD: 70,
  WORKSPACE_ADMIN: 60,
  WORKSPACE_MEMBER: 40,
  
  // Team level
  TEAM_LEAD: 50,
  TEAM_CONTRIBUTOR: 30,
  TEAM_VIEWER: 20,
};

/**
 * Get priority of a role
 */
export function getRolePriority(role: Role): number {
  return ROLE_PRIORITY[role] || 0;
}

/**
 * Compare two roles and return the higher priority one
 */
export function getHigherPriorityRole(role1: Role, role2: Role): Role {
  return getRolePriority(role1) >= getRolePriority(role2) ? role1 : role2;
}

