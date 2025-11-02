import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MemberRole } from '@prisma/client';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType } from '@prisma/client';

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  async findAll(workspaceId?: string) {
    return this.prisma.team.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      include: {
        workspace: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        workspace: true,
        members: {
          include: {
            user: true,
          },
        },
        objectives: true,
      },
    });
  }

  async create(data: { name: string; workspaceId: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get workspace to verify tenant isolation
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: data.workspaceId },
      select: { organizationId: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${data.workspaceId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(workspace.organizationId, userOrganizationId);

    const created = await this.prisma.team.create({
      data,
    });

    await this.auditLogService.record({
      action: 'CREATE_TEAM',
      actorUserId,
      targetId: created.id,
      targetType: AuditTargetType.TEAM,
      organizationId: workspace.organizationId,
    });

    return created;
  }

  async update(id: string, data: { name?: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get team with workspace to verify tenant isolation
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { workspace: { select: { organizationId: true } } },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(team.workspace.organizationId, userOrganizationId);

    const updated = await this.prisma.team.update({
      where: { id },
      data,
    });

    await this.auditLogService.record({
      action: 'UPDATE_TEAM',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.TEAM,
      organizationId: team.workspace.organizationId,
    });

    return updated;
  }

  async delete(id: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get team with workspace to verify tenant isolation
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { workspace: { select: { organizationId: true } } },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(team.workspace.organizationId, userOrganizationId);

    await this.auditLogService.record({
      action: 'DELETE_TEAM',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.TEAM,
      organizationId: team.workspace.organizationId,
    });

    return this.prisma.team.delete({
      where: { id },
    });
  }

  async addMember(teamId: string, data: { userId: string; role: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get team with workspace to verify tenant isolation
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { workspace: { select: { organizationId: true } } },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(team.workspace.organizationId, userOrganizationId);

    const created = await this.prisma.teamMember.create({
      data: {
        teamId,
        userId: data.userId,
        role: data.role as MemberRole,
      },
    });

    await this.auditLogService.record({
      action: 'ADD_TEAM_MEMBER',
      actorUserId,
      targetUserId: data.userId,
      targetId: data.userId,
      targetType: AuditTargetType.USER,
      organizationId: team.workspace.organizationId,
      metadata: { role: data.role },
    });

    return created;
  }

  async removeMember(teamId: string, userId: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get team with workspace to verify tenant isolation
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { workspace: { select: { organizationId: true } } },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(team.workspace.organizationId, userOrganizationId);

    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
      },
    });

    if (teamMember) {
      await this.auditLogService.record({
        action: 'REMOVE_TEAM_MEMBER',
        actorUserId,
        targetUserId: userId,
        targetId: userId,
        targetType: AuditTargetType.USER,
        organizationId: team.workspace.organizationId,
      });

      return this.prisma.teamMember.delete({
        where: { id: teamMember.id },
      });
    }

    return null;
  }
}

