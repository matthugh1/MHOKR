import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MemberRole } from '@prisma/client';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType } from '@prisma/client';
import { RBACService } from '../rbac/rbac.service';
import { Role } from '../rbac/types';

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    private rbacService: RBACService,
  ) {}

  async findAll(userOrganizationId: string | null | undefined, filterWorkspaceId?: string) {
    // Tenant isolation: enforce tenant filtering
    if (userOrganizationId === undefined || userOrganizationId === '') {
      // User has no organisation - return empty array
      return [];
    }

    // If filterWorkspaceId provided, validate workspace belongs to caller's tenant
    if (filterWorkspaceId) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: filterWorkspaceId },
        select: { tenantId: true },
      });

      if (!workspace) {
        // Workspace doesn't exist - return empty (don't leak existence)
        return [];
      }

      if (userOrganizationId !== null) {
        // Normal user: verify workspace belongs to their tenant
        OkrTenantGuard.assertSameTenant(workspace.tenantId, userOrganizationId);
      }
      // SUPERUSER: can filter by any workspace

      return this.prisma.team.findMany({
        where: { workspaceId: filterWorkspaceId },
        include: {
          workspace: true,
        },
      });
    }

    // No filter provided: return teams for caller's tenant
    if (userOrganizationId === null) {
      // SUPERUSER: return all teams (but this is unusual - usually they'd provide workspaceId)
      return this.prisma.team.findMany({
        include: {
          workspace: true,
        },
      });
    }

    // Normal user: return teams in workspaces belonging to their tenant
    return this.prisma.team.findMany({
      where: {
        workspace: {
          tenantId: userOrganizationId,
        },
      },
      include: {
        workspace: true,
      },
    });
  }

  async findById(id: string, userOrganizationId: string | null | undefined) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        workspace: true,
        objectives: true,
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    // Tenant isolation: verify team's workspace belongs to caller's tenant
    if (userOrganizationId === undefined || userOrganizationId === '') {
      // Caller has no organisation - cannot access any team
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    if (userOrganizationId === null) {
      // SUPERUSER: can see any team (read-only)
      return team;
    }

    // Normal user: verify team's workspace belongs to caller's tenant
    if (team.workspace.tenantId !== userOrganizationId) {
      // Don't leak existence - return not found
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async create(data: { name: string; workspaceId: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get workspace to verify tenant isolation
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: data.workspaceId },
      select: { tenantId: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${data.workspaceId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(workspace.tenantId, userOrganizationId);

    const created = await this.prisma.team.create({
      data,
    });

    await this.auditLogService.record({
      action: 'CREATE_TEAM',
      actorUserId,
      targetId: created.id,
      targetType: AuditTargetType.TEAM,
      tenantId: workspace.tenantId,
    });

    return created;
  }

  async update(id: string, data: { name?: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get team with workspace to verify tenant isolation
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { workspace: { select: { tenantId: true } } },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(team.workspace.tenantId, userOrganizationId);

    const updated = await this.prisma.team.update({
      where: { id },
      data,
    });

    await this.auditLogService.record({
      action: 'UPDATE_TEAM',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.TEAM,
      tenantId: team.workspace.tenantId,
    });

    return updated;
  }

  async delete(id: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get team with workspace to verify tenant isolation
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { workspace: { select: { tenantId: true } } },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(team.workspace.tenantId, userOrganizationId);

    await this.auditLogService.record({
      action: 'DELETE_TEAM',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.TEAM,
      tenantId: team.workspace.tenantId,
    });

    return this.prisma.team.delete({
      where: { id },
    });
  }

  /**
   * Map legacy team role to RBAC role
   */
  private mapLegacyTeamRoleToRBAC(legacyRole: string): Role {
    switch (legacyRole) {
      case 'TEAM_LEAD':
        return 'TEAM_LEAD';
      case 'MEMBER':
        return 'TEAM_CONTRIBUTOR';
      case 'VIEWER':
        return 'TEAM_VIEWER';
      default:
        return 'TEAM_CONTRIBUTOR'; // Default fallback
    }
  }

  async addMember(teamId: string, data: { userId: string; role: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get team with workspace to verify tenant isolation
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { workspace: { select: { tenantId: true } } },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(team.workspace.tenantId, userOrganizationId);

    // Map legacy role to RBAC role
    const rbacRole = this.mapLegacyTeamRoleToRBAC(data.role);

    // Check if user already has a role assignment (Phase 3: RBAC only)
    const existingAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: data.userId,
        scopeType: 'TEAM',
        scopeId: teamId,
      },
    });

    if (existingAssignment) {
      // Update RBAC role assignment
      await this.rbacService.assignRole(
        data.userId,
        rbacRole,
        'TEAM',
        teamId,
        actorUserId,
        userOrganizationId || undefined,
      );

      await this.auditLogService.record({
        action: 'UPDATE_TEAM_MEMBER_ROLE',
        actorUserId,
        targetUserId: data.userId,
        targetId: data.userId,
        targetType: AuditTargetType.USER,
        tenantId: team.workspace.tenantId,
        metadata: { role: data.role, previousRole: existingAssignment.role },
      });

      // Return format compatible with legacy API
      return {
        userId: data.userId,
        teamId,
        role: data.role as MemberRole,
      };
    }

    // Create new RBAC role assignment (Phase 3: RBAC only)
    await this.rbacService.assignRole(
      data.userId,
      rbacRole,
      'TEAM',
      teamId,
      actorUserId,
      userOrganizationId || undefined,
    );

    await this.auditLogService.record({
      action: 'ADD_TEAM_MEMBER',
      actorUserId,
      targetUserId: data.userId,
      targetId: data.userId,
      targetType: AuditTargetType.USER,
      tenantId: team.workspace.tenantId,
      metadata: { role: data.role },
    });

    // Return format compatible with legacy API
    return {
      userId: data.userId,
      teamId,
      role: data.role as MemberRole,
    };
  }

  async removeMember(teamId: string, userId: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get team with workspace to verify tenant isolation
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { workspace: { select: { tenantId: true } } },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(team.workspace.tenantId, userOrganizationId);

    // Check if user has role assignments (Phase 3: RBAC only)
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TEAM',
        scopeId: teamId,
      },
    });

    if (roleAssignments.length === 0) {
      throw new NotFoundException(`User is not a member of this team`);
    }

    // Revoke all RBAC role assignments for this user at this team (Phase 3: RBAC only)
    for (const assignment of roleAssignments) {
      await this.rbacService.revokeRole(
        userId,
        assignment.role as Role,
        'TEAM',
        teamId,
        actorUserId,
        userOrganizationId || undefined,
      );
    }

    await this.auditLogService.record({
      action: 'REMOVE_TEAM_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      tenantId: team.workspace.tenantId,
    });

    return { success: true };
  }
}

