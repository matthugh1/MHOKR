import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MemberRole } from '@prisma/client';

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
  constructor(private prisma: PrismaService) {}

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
   * Get all roles for a user across all organizations, workspaces, and teams
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

    // Get organization memberships
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });

    for (const member of orgMembers) {
      roles.push({
        role: member.role,
        entityType: 'ORGANIZATION',
        entityId: member.organizationId,
        organizationId: member.organizationId,
      });
    }

    // Get workspace memberships
    const workspaceMembers = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });

    for (const member of workspaceMembers) {
      roles.push({
        role: member.role,
        entityType: 'WORKSPACE',
        entityId: member.workspaceId,
        organizationId: member.workspace.organizationId,
        workspaceId: member.workspaceId,
      });
    }

    // Get team memberships
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            workspace: true,
          },
        },
      },
    });

    for (const member of teamMembers) {
      roles.push({
        role: member.role,
        entityType: 'TEAM',
        entityId: member.teamId,
        organizationId: member.team.workspace.organizationId,
        workspaceId: member.team.workspaceId,
      });
    }

    return roles;
  }

  /**
   * Get the highest role a user has for a specific organization
   */
  async getUserOrganizationRole(
    userId: string,
    organizationId: string,
  ): Promise<MemberRole | null> {
    // Check direct organization membership
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (orgMember && orgMember.role === MemberRole.ORG_ADMIN) {
      return MemberRole.ORG_ADMIN;
    }

    // Check workspace memberships in this organization
    const workspaceMember = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: {
          organizationId,
        },
      },
      orderBy: {
        role: 'desc', // Get highest role
      },
    });

    if (workspaceMember) {
      return workspaceMember.role;
    }

    // Check team memberships in this organization
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        team: {
          workspace: {
            organizationId,
          },
        },
      },
      orderBy: {
        role: 'desc',
      },
    });

    return teamMember?.role || null;
  }

  /**
   * Get the highest role a user has for a specific workspace
   */
  async getUserWorkspaceRole(
    userId: string,
    workspaceId: string,
  ): Promise<MemberRole | null> {
    // Check direct workspace membership
    const workspaceMember = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (workspaceMember) {
      return workspaceMember.role;
    }

    // Check team memberships in this workspace
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        team: {
          workspaceId,
        },
      },
      orderBy: {
        role: 'desc',
      },
    });

    return teamMember?.role || null;
  }

  /**
   * Get the role a user has for a specific team
   */
  async getUserTeamRole(
    userId: string,
    teamId: string,
  ): Promise<MemberRole | null> {
    const teamMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    return teamMember?.role || null;
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

