/**
 * RBAC Service
 * 
 * Service layer for RBAC operations with Prisma database integration.
 * Provides methods to build user context, check permissions, and manage role assignments.
 */

import { Injectable, Optional, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  UserContext,
  RoleAssignment,
  Role,
  ScopeType,
  TenantRole,
  WorkspaceRole,
  TeamRole,
} from './types';
import { can, getEffectiveRoles } from './rbac';
import { ResourceContext, Action } from './types';
import { RBACCacheService } from './rbac-cache.service';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType, RBACRole } from '@prisma/client';

@Injectable()
export class RBACService {
  private readonly logger = new Logger(RBACService.name);
  private memoryCache = new Map<string, { context: UserContext; timestamp: number }>();

  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Optional() private cacheService?: RBACCacheService,
  ) {}

  /**
   * Build user context from database
   * 
   * Loads all role assignments for a user and builds the UserContext object
   * needed for authorization checks. Results are cached for performance.
   */
  async buildUserContext(userId: string, useCache: boolean = true): Promise<UserContext> {
    // Check cache first
    if (useCache && this.cacheService) {
      const cached = await this.cacheService.get(userId);
      if (cached) {
        // Reconstruct Maps from cached data (Maps get serialized to plain objects)
        return {
          ...cached,
          tenantRoles: cached.tenantRoles instanceof Map 
            ? cached.tenantRoles 
            : new Map(Object.entries(cached.tenantRoles || {})),
          workspaceRoles: cached.workspaceRoles instanceof Map 
            ? cached.workspaceRoles 
            : new Map(Object.entries(cached.workspaceRoles || {})),
          teamRoles: cached.teamRoles instanceof Map 
            ? cached.teamRoles 
            : new Map(Object.entries(cached.teamRoles || {})),
        };
      }
    } else if (useCache) {
      // Fallback to in-memory cache if cache service not available
      const cached = this.memoryCache.get(userId);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        const context = cached.context;
        // Reconstruct Maps if they were serialized
        return {
          ...context,
          tenantRoles: context.tenantRoles instanceof Map 
            ? context.tenantRoles 
            : new Map(Object.entries(context.tenantRoles || {})),
          workspaceRoles: context.workspaceRoles instanceof Map 
            ? context.workspaceRoles 
            : new Map(Object.entries(context.workspaceRoles || {})),
          teamRoles: context.teamRoles instanceof Map 
            ? context.teamRoles 
            : new Map(Object.entries(context.teamRoles || {})),
        };
      }
    }

    // Check if user is superuser
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isSuperuser: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const isSuperuser = user.isSuperuser || false;

    // Load all role assignments for this user
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: { userId },
    });

    // Log role assignments for debugging
    this.logger.log(`[RBAC] buildUserContext: Found ${roleAssignments.length} role assignments for user ${userId}`, {
      userId,
      roleAssignments: roleAssignments.map(ra => ({
        id: ra.id,
        role: ra.role,
        scopeType: ra.scopeType,
        scopeId: ra.scopeId,
      })),
    });

    // Build maps of roles by scope
    const tenantRoles = new Map<string, TenantRole[]>();
    const workspaceRoles = new Map<string, WorkspaceRole[]>();
    const teamRoles = new Map<string, TeamRole[]>();

    for (const assignment of roleAssignments) {
      const role = assignment.role as Role;

      switch (assignment.scopeType) {
        case 'TENANT':
          if (assignment.scopeId) {
            const existing = tenantRoles.get(assignment.scopeId) || [];
            tenantRoles.set(assignment.scopeId, [...existing, role as TenantRole]);
          }
          break;

        case 'WORKSPACE':
          if (assignment.scopeId) {
            const existing = workspaceRoles.get(assignment.scopeId) || [];
            workspaceRoles.set(assignment.scopeId, [...existing, role as WorkspaceRole]);
          }
          break;

        case 'TEAM':
          if (assignment.scopeId) {
            const existing = teamRoles.get(assignment.scopeId) || [];
            teamRoles.set(assignment.scopeId, [...existing, role as TeamRole]);
          }
          break;

        case 'PLATFORM':
          // SUPERUSER is handled separately via isSuperuser flag
          break;
      }
    }

    // Log built maps for debugging
    this.logger.log(`[RBAC] buildUserContext: Built role maps`, {
      userId,
      tenantRolesCount: tenantRoles.size,
      tenantRoles: Array.from(tenantRoles.entries()),
      workspaceRolesCount: workspaceRoles.size,
      teamRolesCount: teamRoles.size,
    });

    // Load manager relationships (for MANAGER_CHAIN visibility)
    const directReportsResult = await this.prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    const directReports = directReportsResult.map(u => u.id);

    // Load manager ID
    const userWithManager = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { managerId: true },
    });
    const managerId = userWithManager?.managerId;

    const userContext: UserContext = {
      userId,
      isSuperuser,
      tenantRoles,
      workspaceRoles,
      teamRoles,
      roleAssignments: roleAssignments.map(this.mapPrismaToRoleAssignment),
      directReports,
      managerId: managerId || undefined,
    };

    // Cache the result
    if (useCache) {
      if (this.cacheService) {
        await this.cacheService.set(userId, userContext);
      } else {
        // Fallback to in-memory cache
        this.memoryCache.set(userId, {
          context: userContext,
          timestamp: Date.now(),
        });
      }
    }

    return userContext;
  }

  /**
   * Invalidate user context cache
   * 
   * Call this when user roles change to ensure fresh data.
   */
  async invalidateUserContextCache(userId: string): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.invalidate(userId);
    }
    this.memoryCache.delete(userId);
  }

  /**
   * Clear all cached user contexts
   */
  async clearCache(): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.clear();
    }
    this.memoryCache.clear();
  }

  /**
   * Check if user can perform an action
   * 
   * Convenience method that builds user context and checks authorization.
   */
  async canPerformAction(
    userId: string,
    action: Action,
    resourceContext: ResourceContext,
  ): Promise<boolean> {
    // Don't use cache for authorization checks to ensure we have fresh role data
    // Cache might be stale if roles were recently assigned
    const userContext = await this.buildUserContext(userId, false);
    
    // Debug logging
    this.logger.log(`canPerformAction check`, {
      userId,
      action,
      resourceContext,
      userContext: {
        userId: userContext.userId,
        isSuperuser: userContext.isSuperuser,
        tenantRoles: Array.from(userContext.tenantRoles.entries()),
        hasTenantRoleForContext: resourceContext.tenantId 
          ? userContext.tenantRoles.has(resourceContext.tenantId)
          : false,
      },
    });
    
    const result = can(userContext, action, resourceContext);
    
    this.logger.log(`canPerformAction result`, {
      userId,
      action,
      tenantId: resourceContext.tenantId,
      authorized: result,
    });
    
    return result;
  }

  /**
   * Get effective roles for a user at a scope
   */
  async getEffectiveRolesForScope(
    userId: string,
    tenantId: string,
    workspaceId?: string | null,
    teamId?: string | null,
  ): Promise<Role[]> {
    const userContext = await this.buildUserContext(userId);
    return getEffectiveRoles(userContext, tenantId, workspaceId, teamId);
  }

  /**
   * Get effective permissions for a user
   * 
   * Returns all actions the user can perform at different scopes.
   * Used for debugging, auditing, and RBAC visualization.
   */
  async getEffectivePermissions(
    userId: string,
    filterTenantId?: string,
    filterWorkspaceId?: string,
    filterTeamId?: string,
  ): Promise<{
    userId: string;
    isSuperuser: boolean;
    scopes: Array<{
      tenantId: string;
      workspaceId?: string;
      teamId?: string;
      effectiveRoles: Role[];
      actionsAllowed: Action[];
      actionsDenied: Action[];
    }>;
  }> {
    const userContext = await this.buildUserContext(userId, false);
    
    // Define all possible actions to test
    const allActions: Action[] = [
      'view_okr',
      'edit_okr',
      'delete_okr',
      'create_okr',
      'request_checkin',
      'publish_okr',
      'manage_users',
      'manage_billing',
      'manage_workspaces',
      'manage_teams',
      'impersonate_user',
      'manage_tenant_settings',
      'view_all_okrs',
      'export_data',
    ];

    const scopes: Array<{
      tenantId: string;
      workspaceId?: string;
      teamId?: string;
      effectiveRoles: Role[];
      actionsAllowed: Action[];
      actionsDenied: Action[];
    }> = [];

    // Get all tenants user has roles in
    const tenantIds = filterTenantId 
      ? [filterTenantId] 
      : Array.from(userContext.tenantRoles.keys());

    for (const tenantId of tenantIds) {
      // Tenant-level scope
      if (!filterWorkspaceId && !filterTeamId) {
        const effectiveRoles = getEffectiveRoles(userContext, tenantId);
        const actionsAllowed: Action[] = [];
        const actionsDenied: Action[] = [];

        for (const action of allActions) {
          const resourceContext: ResourceContext = { tenantId };
          const allowed = can(userContext, action, resourceContext);
          
          if (allowed) {
            actionsAllowed.push(action);
          } else {
            actionsDenied.push(action);
          }
        }

        scopes.push({
          tenantId,
          effectiveRoles,
          actionsAllowed,
          actionsDenied,
        });
      }

      // Workspace-level scopes
      const workspaceIds = filterWorkspaceId 
        ? [filterWorkspaceId] 
        : Array.from(userContext.workspaceRoles.keys());

      for (const workspaceId of workspaceIds) {
        if (!filterTeamId) {
          const effectiveRoles = getEffectiveRoles(userContext, tenantId, workspaceId);
          const actionsAllowed: Action[] = [];
          const actionsDenied: Action[] = [];

          for (const action of allActions) {
            const resourceContext: ResourceContext = { 
              tenantId, 
              workspaceId 
            };
            const allowed = can(userContext, action, resourceContext);
            
            if (allowed) {
              actionsAllowed.push(action);
            } else {
              actionsDenied.push(action);
            }
          }

          scopes.push({
            tenantId,
            workspaceId,
            effectiveRoles,
            actionsAllowed,
            actionsDenied,
          });
        }
      }

      // Team-level scopes
      const teamIds = filterTeamId 
        ? [filterTeamId] 
        : Array.from(userContext.teamRoles.keys());

      for (const teamId of teamIds) {
        const effectiveRoles = getEffectiveRoles(userContext, tenantId, null, teamId);
        const actionsAllowed: Action[] = [];
        const actionsDenied: Action[] = [];

        for (const action of allActions) {
          const resourceContext: ResourceContext = { 
            tenantId, 
            teamId 
          };
          const allowed = can(userContext, action, resourceContext);
          
          if (allowed) {
            actionsAllowed.push(action);
          } else {
            actionsDenied.push(action);
          }
        }

        scopes.push({
          tenantId,
          teamId,
          effectiveRoles,
          actionsAllowed,
          actionsDenied,
        });
      }
    }

    return {
      userId,
      isSuperuser: userContext.isSuperuser,
      scopes,
    };
  }

  /**
   * Assign a role to a user
   */
  async assignRole(
    userId: string,
    role: Role,
    scopeType: ScopeType,
    scopeId: string | null,
    assignedBy: string,
    userOrganizationId: string | null | undefined,
  ): Promise<RoleAssignment> {
    // Validate scopeId requirement
    if (scopeType !== 'PLATFORM' && !scopeId) {
      throw new Error(`scopeId is required for ${scopeType} scope`);
    }

    // Tenant isolation: enforce mutation rules (except PLATFORM scope which is superuser-only)
    if (scopeType !== 'PLATFORM') {
      OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

      // Tenant isolation based on scopeType
      if (scopeType === 'TENANT') {
        // Verify scopeId matches caller's org
        OkrTenantGuard.assertSameTenant(scopeId, userOrganizationId);
      } else if (scopeType === 'WORKSPACE') {
        // Verify workspace belongs to caller's org
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: scopeId! },
          select: { tenantId: true },
        });
        if (!workspace) {
          throw new NotFoundException(`Workspace with ID ${scopeId} not found`);
        }
        OkrTenantGuard.assertSameTenant(workspace.tenantId, userOrganizationId);
      } else if (scopeType === 'TEAM') {
        // Verify team's workspace belongs to caller's org
        const team = await this.prisma.team.findUnique({
          where: { id: scopeId! },
          include: { workspace: { select: { tenantId: true } } },
        });
        if (!team) {
          throw new NotFoundException(`Team with ID ${scopeId} not found`);
        }
        OkrTenantGuard.assertSameTenant(team.workspace.tenantId, userOrganizationId);
      }
    }

    // Create or update role assignment
    // Handle PLATFORM scope (null scopeId) separately
    if (scopeType === 'PLATFORM') {
      // For PLATFORM scope, find or create with null scopeId
      const existing = await this.prisma.roleAssignment.findFirst({
        where: {
          userId,
          role,
          scopeType: 'PLATFORM',
          scopeId: null,
        },
      });

      if (existing) {
        const updated = await this.prisma.roleAssignment.update({
          where: { id: existing.id },
          data: { updatedAt: new Date() },
        });
        this.invalidateUserContextCache(userId);
        
        await this.auditLogService.record({
          action: 'GRANT_ROLE',
          actorUserId: assignedBy,
          targetUserId: userId,
          targetId: userId,
          targetType: AuditTargetType.ROLE_ASSIGNMENT,
          newRole: role as RBACRole,
          metadata: { scopeType: 'PLATFORM', scopeId: null },
        });
        
        return this.mapPrismaToRoleAssignment(updated);
      }

      const created = await this.prisma.roleAssignment.create({
        data: {
          userId,
          role,
          scopeType: 'PLATFORM',
          scopeId: null,
        },
      });
      this.invalidateUserContextCache(userId);
      
      await this.auditLogService.record({
        action: 'GRANT_ROLE',
        actorUserId: assignedBy,
        targetUserId: userId,
        targetId: userId,
        targetType: AuditTargetType.ROLE_ASSIGNMENT,
        newRole: role as RBACRole,
        metadata: { scopeType: 'PLATFORM', scopeId: null },
      });
      
      return this.mapPrismaToRoleAssignment(created);
    }

    // For non-PLATFORM scopes, scopeId is required
    const assignment = await this.prisma.roleAssignment.upsert({
      where: {
        userId_role_scopeType_scopeId: {
          userId,
          role,
          scopeType,
          scopeId: scopeId!,
        },
      },
      create: {
        userId,
        role,
        scopeType,
        scopeId: scopeId!,
      },
      update: {
        // Role assignment exists, update timestamp
        updatedAt: new Date(),
      },
    });

    // Invalidate cache for this user
    this.invalidateUserContextCache(userId);

    await this.auditLogService.record({
      action: 'GRANT_ROLE',
      actorUserId: assignedBy,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.ROLE_ASSIGNMENT,
      newRole: role as RBACRole,
      tenantId: scopeType === 'TENANT' ? (scopeId || undefined) : undefined,
      metadata: { scopeType, scopeId },
    });

    return this.mapPrismaToRoleAssignment(assignment);
  }

  /**
   * Revoke a role from a user
   */
  async revokeRole(
    userId: string,
    role: Role,
    scopeType: ScopeType,
    scopeId: string | null,
    revokedBy: string,
    userOrganizationId: string | null | undefined,
  ): Promise<void> {
    // Tenant isolation: enforce mutation rules (except PLATFORM scope which is superuser-only)
    if (scopeType !== 'PLATFORM') {
      OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

      // Tenant isolation based on scopeType
      if (scopeType === 'TENANT') {
        // Verify scopeId matches caller's org
        OkrTenantGuard.assertSameTenant(scopeId, userOrganizationId);
      } else if (scopeType === 'WORKSPACE') {
        // Verify workspace belongs to caller's org
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: scopeId! },
          select: { tenantId: true },
        });
        if (!workspace) {
          throw new NotFoundException(`Workspace with ID ${scopeId} not found`);
        }
        OkrTenantGuard.assertSameTenant(workspace.tenantId, userOrganizationId);
      } else if (scopeType === 'TEAM') {
        // Verify team's workspace belongs to caller's org
        const team = await this.prisma.team.findUnique({
          where: { id: scopeId! },
          include: { workspace: { select: { tenantId: true } } },
        });
        if (!team) {
          throw new NotFoundException(`Team with ID ${scopeId} not found`);
        }
        OkrTenantGuard.assertSameTenant(team.workspace.tenantId, userOrganizationId);
      }
    }

    await this.prisma.roleAssignment.deleteMany({
      where: {
        userId,
        role,
        scopeType,
        scopeId: scopeId ?? undefined,
      },
    });

    // Invalidate cache for this user
    this.invalidateUserContextCache(userId);

    await this.auditLogService.record({
      action: 'REVOKE_ROLE',
      actorUserId: revokedBy,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.ROLE_ASSIGNMENT,
      previousRole: role as RBACRole,
      tenantId: scopeType === 'TENANT' ? (scopeId || undefined) : undefined,
      metadata: { scopeType, scopeId },
    });
  }

  /**
   * Get all role assignments for a user
   */
  async getUserRoleAssignments(userId: string): Promise<RoleAssignment[]> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: { userId },
    });

    return assignments.map(this.mapPrismaToRoleAssignment);
  }

  /**
   * Get all users with a specific role at a scope
   */
  async getUsersWithRole(
    role: Role,
    scopeType: ScopeType,
    scopeId: string | null,
  ): Promise<string[]> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: {
        role,
        scopeType,
        scopeId: scopeId || undefined,
      },
      select: { userId: true },
    });

    return assignments.map(a => a.userId);
  }

  /**
   * Map Prisma RoleAssignment to our RoleAssignment type
   */
  private mapPrismaToRoleAssignment(prismaAssignment: any): RoleAssignment {
    return {
      id: prismaAssignment.id,
      userId: prismaAssignment.userId,
      role: prismaAssignment.role as Role,
      scopeType: prismaAssignment.scopeType as ScopeType,
      scopeId: prismaAssignment.scopeId,
      createdAt: prismaAssignment.createdAt,
      updatedAt: prismaAssignment.updatedAt,
    };
  }
}
