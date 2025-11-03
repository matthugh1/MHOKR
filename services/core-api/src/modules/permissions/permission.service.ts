import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RoleService } from './role.service';
import { MemberRole } from '@prisma/client';

export enum Permission {
  // OKR Permissions
  OKR_VIEW = 'okr:view',
  OKR_CREATE = 'okr:create',
  OKR_EDIT_OWN = 'okr:edit:own',
  OKR_EDIT_TEAM = 'okr:edit:team',
  OKR_EDIT_WORKSPACE = 'okr:edit:workspace',
  OKR_DELETE_OWN = 'okr:delete:own',
  OKR_DELETE_TEAM = 'okr:delete:team',
  OKR_DELETE_WORKSPACE = 'okr:delete:workspace',

  // Team Permissions
  TEAM_VIEW = 'team:view',
  TEAM_MANAGE = 'team:manage',
  TEAM_INVITE = 'team:invite',

  // Workspace Permissions
  WORKSPACE_VIEW = 'workspace:view',
  WORKSPACE_MANAGE = 'workspace:manage',
  WORKSPACE_INVITE = 'workspace:invite',
  WORKSPACE_SETTINGS = 'workspace:settings',

  // Organization Permissions
  ORGANIZATION_VIEW = 'organization:view',
  ORGANIZATION_MANAGE = 'organization:manage',
  ORGANIZATION_INVITE = 'organization:invite',
}

/**
 * Map roles to their permissions
 */
const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  [MemberRole.SUPERUSER]: [
    // Superusers have ALL permissions
    Permission.OKR_VIEW,
    Permission.OKR_CREATE,
    Permission.OKR_EDIT_OWN,
    Permission.OKR_EDIT_TEAM,
    Permission.OKR_EDIT_WORKSPACE,
    Permission.OKR_DELETE_OWN,
    Permission.OKR_DELETE_TEAM,
    Permission.OKR_DELETE_WORKSPACE,
    Permission.TEAM_VIEW,
    Permission.TEAM_MANAGE,
    Permission.TEAM_INVITE,
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_MANAGE,
    Permission.WORKSPACE_INVITE,
    Permission.WORKSPACE_SETTINGS,
    Permission.ORGANIZATION_VIEW,
    Permission.ORGANIZATION_MANAGE,
    Permission.ORGANIZATION_INVITE,
  ],
  [MemberRole.ORG_ADMIN]: [
    // OKR Permissions
    Permission.OKR_VIEW,
    Permission.OKR_CREATE,
    Permission.OKR_EDIT_OWN,
    Permission.OKR_EDIT_TEAM,
    Permission.OKR_EDIT_WORKSPACE,
    Permission.OKR_DELETE_OWN,
    Permission.OKR_DELETE_TEAM,
    Permission.OKR_DELETE_WORKSPACE,
    // Team Permissions
    Permission.TEAM_VIEW,
    Permission.TEAM_MANAGE,
    Permission.TEAM_INVITE,
    // Workspace Permissions
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_MANAGE,
    Permission.WORKSPACE_INVITE,
    Permission.WORKSPACE_SETTINGS,
    // Organization Permissions
    Permission.ORGANIZATION_VIEW,
    Permission.ORGANIZATION_MANAGE,
    Permission.ORGANIZATION_INVITE,
  ],
  [MemberRole.WORKSPACE_OWNER]: [
    // OKR Permissions
    Permission.OKR_VIEW,
    Permission.OKR_CREATE,
    Permission.OKR_EDIT_OWN,
    Permission.OKR_EDIT_TEAM,
    Permission.OKR_EDIT_WORKSPACE,
    Permission.OKR_DELETE_OWN,
    Permission.OKR_DELETE_TEAM,
    Permission.OKR_DELETE_WORKSPACE,
    // Team Permissions
    Permission.TEAM_VIEW,
    Permission.TEAM_MANAGE,
    Permission.TEAM_INVITE,
    // Workspace Permissions
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_MANAGE,
    Permission.WORKSPACE_INVITE,
    Permission.WORKSPACE_SETTINGS,
  ],
  [MemberRole.TEAM_LEAD]: [
    // OKR Permissions
    Permission.OKR_VIEW,
    Permission.OKR_CREATE,
    Permission.OKR_EDIT_OWN,
    Permission.OKR_EDIT_TEAM,
    Permission.OKR_DELETE_TEAM,
    // Team Permissions
    Permission.TEAM_VIEW,
    Permission.TEAM_MANAGE,
    Permission.TEAM_INVITE,
    // Workspace Permissions
    Permission.WORKSPACE_VIEW,
  ],
  [MemberRole.MEMBER]: [
    // OKR Permissions
    Permission.OKR_VIEW,
    Permission.OKR_CREATE,
    Permission.OKR_EDIT_OWN,
    Permission.OKR_DELETE_OWN,
    // Team Permissions
    Permission.TEAM_VIEW,
    // Workspace Permissions
    Permission.WORKSPACE_VIEW,
  ],
  [MemberRole.VIEWER]: [
    // OKR Permissions
    Permission.OKR_VIEW,
    // Team Permissions
    Permission.TEAM_VIEW,
    // Workspace Permissions
    Permission.WORKSPACE_VIEW,
  ],
};

@Injectable()
export class PermissionService {
  constructor(
    private prisma: PrismaService,
    private roleService: RoleService,
  ) {}

  /**
   * Check if user is a superuser
   */
  async isSuperuser(userId: string): Promise<boolean> {
    return this.roleService.isSuperuser(userId);
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string,
    permission: Permission | string,
    context?: {
      organizationId?: string;
      workspaceId?: string;
      teamId?: string;
      okrId?: string;
      okrOwnerId?: string;
    },
  ): Promise<boolean> {
    // Superusers have all permissions
    const isSuper = await this.isSuperuser(userId);
    if (isSuper) {
      return true;
    }

    const userRoles = await this.roleService.getUserRoles(userId);

    // Check each role for the permission
    for (const userRole of userRoles) {
      const rolePermissions = ROLE_PERMISSIONS[userRole.role] || [];
      if (rolePermissions.includes(permission as Permission)) {
        // If context is provided, verify entity access
        if (context) {
          if (await this.verifyEntityAccess(userId, userRole, context)) {
            return true;
          }
        } else {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Verify user has access to a specific entity
   */
  private async verifyEntityAccess(
    _userId: string, // Prefix with _ to indicate intentionally unused (used for future extensibility)
    userRole: { role: MemberRole; entityType: string; entityId: string },
    context: {
      organizationId?: string;
      workspaceId?: string;
      teamId?: string;
      okrId?: string;
      okrOwnerId?: string;
    },
  ): Promise<boolean> {
    // Check organization access
    if (context.organizationId) {
      if (userRole.entityType === 'ORGANIZATION') {
        return userRole.entityId === context.organizationId;
      }
      // Check if workspace/team belongs to organization
      if (userRole.entityType === 'WORKSPACE' || userRole.entityType === 'TEAM') {
        // This will be checked more thoroughly in specific methods
        return true; // Defer to more specific checks
      }
    }

    // Check workspace access
    if (context.workspaceId) {
      if (userRole.entityType === 'WORKSPACE') {
        return userRole.entityId === context.workspaceId;
      }
      if (userRole.entityType === 'TEAM') {
        // Verify team belongs to workspace
        const team = await this.prisma.team.findUnique({
          where: { id: userRole.entityId },
        });
        return team?.workspaceId === context.workspaceId;
      }
    }

    // Check team access
    if (context.teamId) {
      if (userRole.entityType === 'TEAM') {
        return userRole.entityId === context.teamId;
      }
    }

    return true; // Default to true for now, more specific checks will be done
  }

  /**
   * Check if user can view a specific OKR
   */
  async canViewOKR(userId: string, objectiveId: string): Promise<boolean> {
    // Superusers can view everything
    if (await this.isSuperuser(userId)) {
      return true;
    }

    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        organization: true,
        workspace: true,
        team: true,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Owner can always view
    if (objective.ownerId === userId) {
      return true;
    }

    // Check organization access
    if (objective.organizationId) {
      const orgRole = await this.roleService.getUserOrganizationRole(
        userId,
        objective.organizationId,
      );
      if (orgRole) return true;
    }

    // Check workspace access
    if (objective.workspaceId) {
      const workspaceRole = await this.roleService.getUserWorkspaceRole(
        userId,
        objective.workspaceId,
      );
      if (workspaceRole) return true;
    }

    // Check team access
    if (objective.teamId) {
      const teamRole = await this.roleService.getUserTeamRole(
        userId,
        objective.teamId,
      );
      if (teamRole) return true;
    }

    return false;
  }

  /**
   * Check if user can edit a specific OKR
   */
  async canEditOKR(userId: string, objectiveId: string): Promise<boolean> {
    // Superusers can edit everything
    if (await this.isSuperuser(userId)) {
      return true;
    }

    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        organization: true,
        workspace: true,
        team: true,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Owner can always edit
    if (objective.ownerId === userId) {
      return true;
    }

    // Check team role - TEAM_LEAD+ can edit team OKRs
    if (objective.teamId) {
      const teamRole = await this.roleService.getUserTeamRole(
        userId,
        objective.teamId,
      );
      if (
        teamRole &&
        this.roleService.hasHigherOrEqualRole(teamRole, MemberRole.TEAM_LEAD)
      ) {
        return true;
      }
    }

    // Check workspace role - WORKSPACE_OWNER+ can edit workspace OKRs
    if (objective.workspaceId) {
      const workspaceRole = await this.roleService.getUserWorkspaceRole(
        userId,
        objective.workspaceId,
      );
      if (
        workspaceRole &&
        this.roleService.hasHigherOrEqualRole(
          workspaceRole,
          MemberRole.WORKSPACE_OWNER,
        )
      ) {
        return true;
      }
    }

    // Check organization role - ORG_ADMIN can edit organization OKRs
    if (objective.organizationId) {
      const orgRole = await this.roleService.getUserOrganizationRole(
        userId,
        objective.organizationId,
      );
      if (orgRole === MemberRole.ORG_ADMIN) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user can delete a specific OKR
   */
  async canDeleteOKR(userId: string, objectiveId: string): Promise<boolean> {
    // Superusers can delete everything
    if (await this.isSuperuser(userId)) {
      return true;
    }

    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        organization: true,
        workspace: true,
        team: true,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Owner can delete their own OKRs
    if (objective.ownerId === userId) {
      return true;
    }

    // TEAM_LEAD+ can delete team OKRs
    if (objective.teamId) {
      const teamRole = await this.roleService.getUserTeamRole(
        userId,
        objective.teamId,
      );
      if (
        teamRole &&
        this.roleService.hasHigherOrEqualRole(teamRole, MemberRole.TEAM_LEAD)
      ) {
        return true;
      }
    }

    // WORKSPACE_OWNER+ can delete workspace OKRs
    if (objective.workspaceId) {
      const workspaceRole = await this.roleService.getUserWorkspaceRole(
        userId,
        objective.workspaceId,
      );
      if (
        workspaceRole &&
        this.roleService.hasHigherOrEqualRole(
          workspaceRole,
          MemberRole.WORKSPACE_OWNER,
        )
      ) {
        return true;
      }
    }

    // ORG_ADMIN can delete organization OKRs
    if (objective.organizationId) {
      const orgRole = await this.roleService.getUserOrganizationRole(
        userId,
        objective.organizationId,
      );
      if (orgRole === MemberRole.ORG_ADMIN) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user can create OKRs in a workspace
   */
  async canCreateOKRInWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const workspaceRole = await this.roleService.getUserWorkspaceRole(
      userId,
      workspaceId,
    );

    if (!workspaceRole) {
      // Check if user has team membership in workspace (Phase 4: RBAC only)
      const teamAssignments = await this.prisma.roleAssignment.findMany({
        where: {
          userId,
          scopeType: 'TEAM',
          scopeId: { not: null },
        },
      });

      const teamIds = teamAssignments
        .map(ta => ta.scopeId)
        .filter((id): id is string => id !== null);

      if (teamIds.length > 0) {
        const teamInWorkspace = await this.prisma.team.findFirst({
          where: {
            id: { in: teamIds },
            workspaceId,
          },
        });
        return !!teamInWorkspace; // MEMBER or higher can create
      }

      return false;
    }

    // VIEWER cannot create
    return workspaceRole !== MemberRole.VIEWER;
  }

  /**
   * Check if user can manage a team
   */
  async canManageTeam(userId: string, teamId: string): Promise<boolean> {
    const teamRole = await this.roleService.getUserTeamRole(userId, teamId);
    if (
      teamRole &&
      this.roleService.hasHigherOrEqualRole(teamRole, MemberRole.TEAM_LEAD)
    ) {
      return true;
    }

    // Check workspace role
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (team) {
      const workspaceRole = await this.roleService.getUserWorkspaceRole(
        userId,
        team.workspaceId,
      );
      if (
        workspaceRole &&
        this.roleService.hasHigherOrEqualRole(
          workspaceRole,
          MemberRole.WORKSPACE_OWNER,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user can manage a workspace
   */
  async canManageWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const workspaceRole = await this.roleService.getUserWorkspaceRole(
      userId,
      workspaceId,
    );

    return (
      workspaceRole === MemberRole.WORKSPACE_OWNER ||
      workspaceRole === MemberRole.ORG_ADMIN
    );
  }

  /**
   * Check if user can manage an organization
   */
  async canManageOrganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    // Superusers can manage all organizations
    if (await this.isSuperuser(userId)) {
      return true;
    }

    const orgRole = await this.roleService.getUserOrganizationRole(
      userId,
      organizationId,
    );

    return orgRole === MemberRole.ORG_ADMIN;
  }

  /**
   * Check if user can create organizations (superuser only)
   */
  async canCreateOrganization(userId: string): Promise<boolean> {
    return this.isSuperuser(userId);
  }

  /**
   * Check if user can assign users to organizations (superuser only)
   */
  async canAssignUserToOrganization(userId: string): Promise<boolean> {
    return this.isSuperuser(userId);
  }

  /**
   * Require permission or throw ForbiddenException
   */
  async requirePermission(
    userId: string,
    permission: Permission | string,
    context?: {
      organizationId?: string;
      workspaceId?: string;
      teamId?: string;
      okrId?: string;
      okrOwnerId?: string;
    },
  ): Promise<void> {
    const hasPermission = await this.hasPermission(userId, permission, context);
    if (!hasPermission) {
      throw new ForbiddenException(
        `Permission denied: ${permission} required`,
      );
    }
  }
}

