/**
 * RBAC Service
 * 
 * Service layer for RBAC operations with Prisma database integration.
 * Provides methods to build user context, check permissions, and manage role assignments.
 */

import { Injectable, Optional } from '@nestjs/common';
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

@Injectable()
export class RBACService {
  private memoryCache = new Map<string, { context: UserContext; timestamp: number }>();

  constructor(
    private prisma: PrismaService,
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
    const userContext = await this.buildUserContext(userId);
    return can(userContext, action, resourceContext);
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
   * Assign a role to a user
   */
  async assignRole(
    userId: string,
    role: Role,
    scopeType: ScopeType,
    scopeId: string | null,
    _assignedBy: string,
  ): Promise<RoleAssignment> {
    // Validate scopeId requirement
    if (scopeType !== 'PLATFORM' && !scopeId) {
      throw new Error(`scopeId is required for ${scopeType} scope`);
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

    // TODO: Record audit log
    // await this.auditService.recordRoleChange(...)

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
    _revokedBy: string,
  ): Promise<void> {
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

    // TODO: Record audit log
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
