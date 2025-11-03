import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MemberRole } from '@prisma/client';
import { Role as RBACRole, ScopeType } from '../rbac/types';

/**
 * Role hierarchy (higher number = more permissions):
 * SUPERUSER (5) > ORG_ADMIN (4) > WORKSPACE_OWNER (3) > TEAM_LEAD (2) > MEMBER (1) > VIEWER (0)
 */
const ROLE_HIERARCHY: Record<MemberRole, number> = {
  SUPERUSER: 5,
  ORG_ADMIN: 4,
  WORKSPACE_OWNER: 3,
  TEAM_LEAD: 2,
  MEMBER: 1,
  VIEWER: 0,
};

export interface UserRole {
  role: MemberRole;
  entityType: 'ORGANIZATION' | 'WORKSPACE' | 'TEAM';
  entityId: string;
  organizationId?: string;
  workspaceId?: string;
}

@Injectable()
export class RoleService {
  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * Check if user is a superuser
   */
  async isSuperuser(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperuser: true },
    });
    return user?.isSuperuser || false;
  }

  /**
   * Map RBAC role to legacy MemberRole for backward compatibility
   */
  private mapRBACRoleToLegacyRole(rbacRole: RBACRole, scopeType: ScopeType): MemberRole {
    // Team-level role mapping
    if (scopeType === 'TEAM') {
      switch (rbacRole) {
        case 'TEAM_LEAD':
          return MemberRole.TEAM_LEAD;
        case 'TEAM_CONTRIBUTOR':
          return MemberRole.MEMBER;
        case 'TEAM_VIEWER':
          return MemberRole.VIEWER;
        default:
          return MemberRole.MEMBER;
      }
    }

    // Workspace-level role mapping
    if (scopeType === 'WORKSPACE') {
      switch (rbacRole) {
        case 'WORKSPACE_LEAD':
        case 'WORKSPACE_ADMIN':
          return MemberRole.WORKSPACE_OWNER;
        case 'WORKSPACE_MEMBER':
          return MemberRole.MEMBER;
        default:
          return MemberRole.MEMBER;
      }
    }

    // Tenant-level role mapping
    if (scopeType === 'TENANT') {
      switch (rbacRole) {
        case 'TENANT_OWNER':
        case 'TENANT_ADMIN':
          return MemberRole.ORG_ADMIN;
        case 'TENANT_VIEWER':
          return MemberRole.VIEWER;
        default:
          return MemberRole.MEMBER;
      }
    }

    return MemberRole.MEMBER;
  }

  /**
   * Get all roles for a user across all organizations, workspaces, and teams
   * Now reads from RBAC system (Phase 2)
   */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    // Check if superuser first
    const isSuper = await this.isSuperuser(userId);
    if (isSuper) {
      // Superusers have implicit access to everything
      return [{
        role: MemberRole.SUPERUSER,
        entityType: 'ORGANIZATION' as const,
        entityId: 'system',
      }];
    }

    const roles: UserRole[] = [];

    // Get all role assignments from RBAC system
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: { userId },
    });

    for (const assignment of roleAssignments) {
      const legacyRole = this.mapRBACRoleToLegacyRole(
        assignment.role as RBACRole,
        assignment.scopeType as ScopeType,
      );

      if (assignment.scopeType === 'TENANT' && assignment.scopeId) {
        roles.push({
          role: legacyRole,
          entityType: 'ORGANIZATION',
          entityId: assignment.scopeId,
          organizationId: assignment.scopeId,
        });
      } else if (assignment.scopeType === 'WORKSPACE' && assignment.scopeId) {
        // Need to get workspace to find organizationId
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: assignment.scopeId },
          select: { organizationId: true },
        });
        if (workspace) {
          roles.push({
            role: legacyRole,
            entityType: 'WORKSPACE',
            entityId: assignment.scopeId,
            organizationId: workspace.organizationId,
            workspaceId: assignment.scopeId,
          });
        }
      } else if (assignment.scopeType === 'TEAM' && assignment.scopeId) {
        // Need to get team to find workspaceId and organizationId
        const team = await this.prisma.team.findUnique({
          where: { id: assignment.scopeId },
          include: {
            workspace: {
              select: { organizationId: true },
            },
          },
        });
        if (team) {
          roles.push({
            role: legacyRole,
            entityType: 'TEAM',
            entityId: assignment.scopeId,
            organizationId: team.workspace.organizationId,
            workspaceId: team.workspaceId,
          });
        }
      }
    }

    return roles;
  }

  /**
   * Get the highest role a user has for a specific organization
   * Now reads from RBAC system (Phase 2)
   */
  async getUserOrganizationRole(
    userId: string,
    organizationId: string,
  ): Promise<MemberRole | null> {
    // Check RBAC role assignments at tenant scope
    const tenantAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
    });

    if (tenantAssignments.length > 0) {
      // Get highest priority role (TENANT_ADMIN > TENANT_VIEWER)
      const highestRBACRole = tenantAssignments.reduce((highest, current) => {
        if (current.role === 'TENANT_ADMIN' || current.role === 'TENANT_OWNER') {
          return current;
        }
        return highest.role === 'TENANT_ADMIN' || highest.role === 'TENANT_OWNER' ? highest : current;
      });

      return this.mapRBACRoleToLegacyRole(
        highestRBACRole.role as RBACRole,
        'TENANT',
      );
    }

    // Fallback: Check workspace roles in this organization
    const workspaces = await this.prisma.workspace.findMany({
      where: { organizationId },
      select: { id: true },
    });

    for (const workspace of workspaces) {
      const workspaceRole = await this.getUserWorkspaceRole(userId, workspace.id);
      if (workspaceRole) {
        return workspaceRole;
      }
    }

    return null;
  }

  /**
   * Get the highest role a user has for a specific workspace
   * Now reads from RBAC system (Phase 2)
   */
  async getUserWorkspaceRole(
    userId: string,
    workspaceId: string,
  ): Promise<MemberRole | null> {
    // Check RBAC role assignments at workspace scope
    const workspaceAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'WORKSPACE',
        scopeId: workspaceId,
      },
    });

    if (workspaceAssignments.length > 0) {
      // Get highest priority role (WORKSPACE_LEAD > WORKSPACE_ADMIN > WORKSPACE_MEMBER)
      const highestRBACRole = workspaceAssignments.reduce((highest, current) => {
        if (current.role === 'WORKSPACE_LEAD' || current.role === 'WORKSPACE_ADMIN') {
          return current;
        }
        return highest.role === 'WORKSPACE_LEAD' || highest.role === 'WORKSPACE_ADMIN' ? highest : current;
      });

      return this.mapRBACRoleToLegacyRole(
        highestRBACRole.role as RBACRole,
        'WORKSPACE',
      );
    }

    // Fallback: Check team roles in this workspace
    const teams = await this.prisma.team.findMany({
      where: { workspaceId },
      select: { id: true },
    });

    for (const team of teams) {
      const teamRole = await this.getUserTeamRole(userId, team.id);
      if (teamRole) {
        return teamRole;
      }
    }

    return null;
  }

  /**
   * Get the role a user has for a specific team
   * Now reads from RBAC system (Phase 2)
   */
  async getUserTeamRole(
    userId: string,
    teamId: string,
  ): Promise<MemberRole | null> {
    // Check RBAC role assignments at team scope
    const teamAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TEAM',
        scopeId: teamId,
      },
    });

    if (teamAssignments.length > 0) {
      // Get highest priority role (TEAM_LEAD > TEAM_CONTRIBUTOR > TEAM_VIEWER)
      const highestRBACRole = teamAssignments.reduce((highest, current) => {
        if (current.role === 'TEAM_LEAD') {
          return current;
        }
        return highest.role === 'TEAM_LEAD' ? highest : current;
      });

      return this.mapRBACRoleToLegacyRole(
        highestRBACRole.role as RBACRole,
        'TEAM',
      );
    }

    return null;
  }

  /**
   * Check if role1 has higher or equal permissions than role2
   */
  hasHigherOrEqualRole(role1: MemberRole, role2: MemberRole): boolean {
    return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
  }

  /**
   * Check if role1 has strictly higher permissions than role2
   */
  hasHigherRole(role1: MemberRole, role2: MemberRole): boolean {
    return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
  }

  /**
   * Get role hierarchy value (for sorting/comparison)
   */
  getRoleHierarchy(role: MemberRole): number {
    return ROLE_HIERARCHY[role];
  }

  /**
   * Check if a role can grant another role (prevents role escalation)
   */
  canGrantRole(granterRole: MemberRole, targetRole: MemberRole): boolean {
    // Can only grant roles equal to or lower than your own
    return ROLE_HIERARCHY[granterRole] >= ROLE_HIERARCHY[targetRole];
  }

  /**
   * Get all roles that are lower than or equal to the given role
   */
  getRolesEqualOrLower(role: MemberRole): MemberRole[] {
    const hierarchyValue = ROLE_HIERARCHY[role];
    return Object.entries(ROLE_HIERARCHY)
      .filter(([_, value]) => value <= hierarchyValue)
      .map(([roleName]) => roleName as MemberRole);
  }

  /**
   * Get effective role for a user considering inheritance
   * Organization roles inherit to workspaces and teams
   * Workspace roles inherit to teams
   */
  async getEffectiveRole(
    userId: string,
    entityType: 'ORGANIZATION' | 'WORKSPACE' | 'TEAM',
    entityId: string,
  ): Promise<MemberRole | null> {
    if (entityType === 'ORGANIZATION') {
      return this.getUserOrganizationRole(userId, entityId);
    }

    if (entityType === 'WORKSPACE') {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: entityId },
        include: { organization: true },
      });

      if (!workspace) return null;

      // Check direct workspace role
      const workspaceRole = await this.getUserWorkspaceRole(userId, entityId);
      if (workspaceRole === MemberRole.WORKSPACE_OWNER) {
        return workspaceRole;
      }

      // Check organization role (ORG_ADMIN inherits)
      const orgRole = await this.getUserOrganizationRole(
        userId,
        workspace.organizationId,
      );
      if (orgRole === MemberRole.ORG_ADMIN) {
        return MemberRole.ORG_ADMIN;
      }

      return workspaceRole;
    }

    if (entityType === 'TEAM') {
      const team = await this.prisma.team.findUnique({
        where: { id: entityId },
        include: {
          workspace: {
            include: {
              organization: true,
            },
          },
        },
      });

      if (!team) return null;

      // Check direct team role
      const teamRole = await this.getUserTeamRole(userId, entityId);
      if (teamRole === MemberRole.TEAM_LEAD) {
        return teamRole;
      }

      // Check workspace role (WORKSPACE_OWNER inherits)
      const workspaceRole = await this.getUserWorkspaceRole(
        userId,
        team.workspaceId,
      );
      if (workspaceRole === MemberRole.WORKSPACE_OWNER) {
        return MemberRole.WORKSPACE_OWNER;
      }

      // Check organization role (ORG_ADMIN inherits)
      const orgRole = await this.getUserOrganizationRole(
        userId,
        team.workspace.organizationId,
      );
      if (orgRole === MemberRole.ORG_ADMIN) {
        return MemberRole.ORG_ADMIN;
      }

      return teamRole;
    }

    return null;
  }
}

