import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType, MemberRole } from '@prisma/client';
import { RBACService } from '../rbac/rbac.service';
import { Role } from '../rbac/types';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    private rbacService: RBACService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    // Normalize email to lowercase for case-insensitive lookup
    const normalizedEmail = email.toLowerCase().trim();
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  async findByKeycloakId(keycloakId: string) {
    return this.prisma.user.findUnique({
      where: { keycloakId },
    });
  }

  /**
   * Map RBAC role to legacy MemberRole for backward compatibility
   * Used during migration period to maintain compatibility with frontend
   */
  private mapRBACRoleToLegacyRole(rbacRole: Role, scopeType: 'TEAM' | 'WORKSPACE' | 'TENANT'): MemberRole {
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
          return MemberRole.MEMBER; // Default fallback
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
          return MemberRole.MEMBER; // Default fallback
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
          return MemberRole.MEMBER; // Default fallback
      }
    }

    return MemberRole.MEMBER; // Default fallback
  }

  async getUserContext(userId: string) {
    // Get user basic info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Build RBAC user context to get role assignments (Phase 4: RBAC only)
    const rbacContext = await this.rbacService.buildUserContext(userId, true);

    // Get organizations from RBAC tenant role assignments
    const tenantAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: { not: null },
      },
    });

    // Get unique organization IDs
    const organizationIds = [...new Set(
      tenantAssignments
        .map(ta => ta.scopeId)
        .filter((id): id is string => id !== null)
    )];

    // Fetch organizations
    const organizations = organizationIds.length > 0
      ? await this.prisma.organization.findMany({
          where: { id: { in: organizationIds } },
        })
      : [];

    // Get workspaces from RBAC workspace role assignments
    const workspaceAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'WORKSPACE',
        scopeId: { not: null },
      },
    });

    // Get unique workspace IDs
    const workspaceIds = [...new Set(
      workspaceAssignments
        .map(wa => wa.scopeId)
        .filter((id): id is string => id !== null)
    )];

    // Fetch workspaces with relations
    const directWorkspaces = workspaceIds.length > 0
      ? await this.prisma.workspace.findMany({
          where: { id: { in: workspaceIds } },
          include: {
            organization: true,
            parentWorkspace: true,
            childWorkspaces: true,
          },
        })
      : [];

    // Get teams from RBAC team role assignments
    const teamAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TEAM',
        scopeId: { not: null },
      },
    });

    // Get unique team IDs
    const teamIds = [...new Set(
      teamAssignments
        .map(ta => ta.scopeId)
        .filter((id): id is string => id !== null)
    )];

    // Fetch teams with workspace relations
    const teamsWithWorkspaces = teamIds.length > 0
      ? await this.prisma.team.findMany({
          where: { id: { in: teamIds } },
          include: {
            workspace: {
              include: {
                organization: true,
                parentWorkspace: true,
                childWorkspaces: true,
              },
            },
          },
        })
      : [];

    // Extract indirect workspaces from teams
    const indirectWorkspaces = teamsWithWorkspaces
      .map(t => t.workspace)
      .filter((ws, index, self) => 
        index === self.findIndex(w => w.id === ws.id)
      );

    // Combine direct and indirect workspaces
    const allWorkspaces = [...directWorkspaces, ...indirectWorkspaces];
    const workspaces = allWorkspaces.filter((ws, index, self) => 
      index === self.findIndex(w => w.id === ws.id)
    );

    // Get teams with their roles from RBAC system (Phase 4: RBAC only)
    const teams = await Promise.all(
      teamsWithWorkspaces.map(async (team) => {
        // Get role from RBAC
        const teamRoles = rbacContext.teamRoles.get(team.id);
        let role: MemberRole;

        if (teamRoles && teamRoles.length > 0) {
          // Use highest priority role from RBAC (TEAM_LEAD > TEAM_CONTRIBUTOR > TEAM_VIEWER)
          const rbacRole = teamRoles.includes('TEAM_LEAD') 
            ? 'TEAM_LEAD' 
            : teamRoles.includes('TEAM_CONTRIBUTOR')
            ? 'TEAM_CONTRIBUTOR'
            : teamRoles[0];
          role = this.mapRBACRoleToLegacyRole(rbacRole as Role, 'TEAM');
        } else {
          // Fallback to MEMBER if no role found (shouldn't happen in Phase 4)
          role = MemberRole.MEMBER;
        }

        return {
          id: team.id,
          name: team.name,
          role: role as string, // Frontend expects string
          workspaceId: team.workspaceId,
          workspace: team.workspace.name,
        };
      })
    );

    // Default context for OKR creation
    // Prioritize direct workspace membership over indirect
    const defaultOrganization = organizations[0] || null;
    const defaultWorkspace = directWorkspaces[0] || indirectWorkspaces[0] || null;
    const defaultTeam = teams[0] || null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: defaultOrganization,
      organizations,
      workspace: defaultWorkspace,
      workspaces,
      team: defaultTeam,
      teams,
      defaultOKRContext: {
        workspaceId: defaultWorkspace?.id || null,
        teamId: defaultTeam?.id || null,
        ownerId: user.id,
      },
    };
  }

  /**
   * Map legacy organization role to RBAC role
   */
  private mapLegacyOrgRoleToRBAC(legacyRole: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER'): Role {
    switch (legacyRole) {
      case 'ORG_ADMIN':
        return 'TENANT_ADMIN';
      case 'VIEWER':
        return 'TENANT_VIEWER';
      case 'MEMBER':
      default:
        return 'TENANT_VIEWER'; // Default to VIEWER for MEMBER
    }
  }

  /**
   * Map legacy workspace role to RBAC role
   */
  private mapLegacyWorkspaceRoleToRBAC(legacyRole: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER'): Role {
    switch (legacyRole) {
      case 'WORKSPACE_OWNER':
        return 'WORKSPACE_LEAD';
      case 'MEMBER':
        return 'WORKSPACE_MEMBER';
      case 'VIEWER':
      default:
        return 'WORKSPACE_MEMBER'; // VIEWER becomes MEMBER in RBAC
    }
  }

  async createUser(
    data: { 
      email: string; 
      name: string; 
      password: string; 
      organizationId: string; // REQUIRED - all users must belong to an organization
      workspaceId: string; // REQUIRED - all users must belong to a workspace
      role?: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER';
      workspaceRole?: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER';
    },
    userOrganizationId: string | null | undefined,
    actorUserId: string,
  ) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Tenant isolation: verify caller's org matches the org being created in
    OkrTenantGuard.assertSameTenant(data.organizationId, userOrganizationId);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${data.organizationId} not found`);
    }

    // Verify workspace exists and belongs to the organization
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: data.workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${data.workspaceId} not found`);
    }

    if (workspace.organizationId !== data.organizationId) {
      throw new ConflictException(`Workspace ${data.workspaceId} does not belong to organization ${data.organizationId}`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user (Phase 3: RBAC only - no legacy membership writes)
    const user = await this.prisma.$transaction(async (tx) => {
      // Create user only - no legacy membership writes
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return newUser;
    });

    // Create RBAC role assignments after transaction (Phase 3: RBAC only)
    try {
      // Map legacy roles to RBAC roles
      const orgRBACRole = this.mapLegacyOrgRoleToRBAC(data.role || 'MEMBER');
      const workspaceRBACRole = this.mapLegacyWorkspaceRoleToRBAC(data.workspaceRole || 'MEMBER');

      // Assign organization role
      await this.rbacService.assignRole(
        user.id,
        orgRBACRole,
        'TENANT',
        data.organizationId,
        actorUserId,
        userOrganizationId || undefined,
      );

      // Assign workspace role
      await this.rbacService.assignRole(
        user.id,
        workspaceRBACRole,
        'WORKSPACE',
        data.workspaceId,
        actorUserId,
        userOrganizationId || undefined,
      );
    } catch (error) {
      // If RBAC assignment fails, log error but don't rollback user creation
      // User exists but may not have proper role assignments
      console.error(`Failed to assign RBAC roles for new user ${user.id}:`, error);
      // Consider throwing error if you want to enforce RBAC assignment success
      // For now, we'll allow user creation to succeed even if RBAC assignment fails
      // This allows manual recovery if needed
    }

    await this.auditLogService.record({
      action: 'CREATE_USER',
      actorUserId,
      targetUserId: user.id,
      targetId: user.id,
      targetType: AuditTargetType.USER,
      organizationId: data.organizationId,
    });

    return user;
  }

  async resetPassword(userId: string, newPassword: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Check if user exists and belongs to caller's org (Phase 4: RBAC only)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Tenant isolation: verify user belongs to caller's org via RBAC
    const tenantAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: userOrganizationId || undefined,
      },
    });

    if (!tenantAssignment) {
      throw new NotFoundException('User not found in your organization');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    await this.auditLogService.record({
      action: 'RESET_PASSWORD',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId: userOrganizationId || undefined,
    });

    return { message: 'Password reset successfully' };
  }

  async updateUser(userId: string, data: { name?: string; email?: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Check if user exists and belongs to caller's org (Phase 4: RBAC only)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Tenant isolation: verify user belongs to caller's org via RBAC
    const tenantAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: userOrganizationId || undefined,
      },
    });

    if (!tenantAssignment) {
      throw new NotFoundException('User not found in your organization');
    }

    // Check if email is being changed and if it already exists
    if (data.email && data.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditLogService.record({
      action: 'UPDATE_USER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId: userOrganizationId || undefined,
    });

    return updatedUser;
  }
}

