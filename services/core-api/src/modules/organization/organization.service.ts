import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType } from '@prisma/client';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.organization.findMany({
      include: {
        workspaces: {
          include: {
            teams: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByUserOrganizations(organizationIds: string[]) {
    if (organizationIds.length === 0) {
      return [];
    }
    
    return this.prisma.organization.findMany({
      where: {
        id: { in: organizationIds },
      },
      include: {
        workspaces: {
          include: {
            teams: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        workspaces: {
          include: {
            teams: {
              include: {
                members: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return organization;
  }

  async findByUserId(userId: string) {
    // Find organizations through team memberships
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            workspace: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });

    // Extract unique organizations
    const organizations = teamMembers
      .map(tm => tm.team.workspace.organization)
      .filter((org, index, self) => 
        index === self.findIndex(o => o.id === org.id)
      );

    return organizations;
  }

  async getCurrentOrganization(userId: string) {
    const organizations = await this.findByUserId(userId);
    
    // For now, return the first organization (users belong to one org)
    if (organizations.length === 0) {
      throw new NotFoundException('User is not a member of any organization');
    }

    return this.findById(organizations[0].id);
  }

  async create(data: { name: string; slug: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    const created = await this.prisma.organization.create({
      data,
      include: {
        workspaces: true,
      },
    });

    await this.auditLogService.record({
      action: 'CREATE_ORG',
      actorUserId,
      targetId: created.id,
      targetType: AuditTargetType.TENANT,
      organizationId: created.id,
    });

    return created;
  }

  async update(id: string, data: { name?: string; slug?: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get existing organization to check tenant isolation
    const existing = await this.findById(id);
    OkrTenantGuard.assertSameTenant(existing.id, userOrganizationId);

    const updated = await this.prisma.organization.update({
      where: { id },
      data,
      include: {
        workspaces: true,
      },
    });

    await this.auditLogService.record({
      action: 'UPDATE_ORG',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.TENANT,
      organizationId: id,
    });

    return updated;
  }

  async delete(id: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get existing organization to check tenant isolation
    const existing = await this.findById(id);
    OkrTenantGuard.assertSameTenant(existing.id, userOrganizationId);

    await this.auditLogService.record({
      action: 'DELETE_ORG',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.TENANT,
      organizationId: id,
    });

    return this.prisma.organization.delete({
      where: { id },
    });
  }

  async getMembers(organizationId: string) {
    // Get direct organization members first
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: true,
      },
    });

    // Get all users who are members of teams in this organization
    const teamMembers = await this.prisma.teamMember.findMany({
      where: {
        team: {
          workspace: {
            organizationId,
          },
        },
      },
      include: {
        user: true,
        team: {
          include: {
            workspace: true,
          },
        },
      },
    });

    // Aggregate by user
    const userMap = new Map();
    
    // Add organization members first
    orgMembers.forEach(om => {
      userMap.set(om.userId, {
        ...om.user,
        orgRole: om.role,
        teams: [],
        workspaces: new Set(),
      });
    });

    // Add team members
    teamMembers.forEach(tm => {
      if (!userMap.has(tm.userId)) {
        userMap.set(tm.userId, {
          ...tm.user,
          orgRole: null,
          teams: [],
          workspaces: new Set(),
        });
      }
      const user = userMap.get(tm.userId);
      user.teams.push({
        id: tm.team.id,
        name: tm.team.name,
        role: tm.role,
        workspace: tm.team.workspace.name,
      });
      user.workspaces.add(tm.team.workspace.name);
    });

    return Array.from(userMap.values()).map(user => ({
      ...user,
      workspaces: Array.from(user.workspaces),
    }));
  }

  async addMember(organizationId: string, userId: string, role: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER', userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify organization exists and tenant match
    const org = await this.findById(organizationId);
    OkrTenantGuard.assertSameTenant(org.id, userOrganizationId);
    
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if user is already a member
    const existing = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (existing) {
      // Update role if already exists
      const updated = await this.prisma.organizationMember.update({
        where: { id: existing.id },
        data: { role },
        include: {
          user: true,
          organization: true,
        },
      });

      await this.auditLogService.record({
        action: 'UPDATE_ORG_MEMBER_ROLE',
        actorUserId,
        targetUserId: userId,
        targetId: userId,
        targetType: AuditTargetType.USER,
        organizationId,
        metadata: { role, previousRole: existing.role },
      });

      return updated;
    }

    // Create new membership
    const created = await this.prisma.organizationMember.create({
      data: {
        userId,
        organizationId,
        role,
      },
      include: {
        user: true,
        organization: true,
      },
    });

    await this.auditLogService.record({
      action: 'ADD_ORG_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId,
      metadata: { role },
    });

    return created;
  }

  async removeMember(organizationId: string, userId: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify organization exists and tenant match
    const org = await this.findById(organizationId);
    OkrTenantGuard.assertSameTenant(org.id, userOrganizationId);

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!membership) {
      throw new NotFoundException(`User is not a member of this organization`);
    }

    await this.auditLogService.record({
      action: 'REMOVE_ORG_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId,
    });

    return this.prisma.organizationMember.delete({
      where: { id: membership.id },
    });
  }
}
