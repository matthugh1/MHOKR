import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType, MemberRole } from '@prisma/client';
import { RBACService } from '../rbac/rbac.service';
import { Role } from '../rbac/types';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    private rbacService: RBACService,
  ) {}

  async findAll() {
    return this.prisma.organization.findMany({
      include: {
        workspaces: {
          include: {
            teams: true,
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
            teams: true,
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
    // Find organizations through RBAC tenant role assignments (Phase 4: RBAC only)
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
    const directOrganizations = organizationIds.length > 0
      ? await this.prisma.organization.findMany({
          where: { id: { in: organizationIds } },
        })
      : [];

    // Also find organizations through team memberships (indirect)
    const teamAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TEAM',
        scopeId: { not: null },
      },
    });

    // Get team IDs and fetch teams with workspaces and organizations
    const teamIds = [...new Set(
      teamAssignments
        .map(ta => ta.scopeId)
        .filter((id): id is string => id !== null)
    )];

    const teamsWithOrgs = teamIds.length > 0
      ? await this.prisma.team.findMany({
          where: { id: { in: teamIds } },
          include: {
            workspace: {
              include: {
                organization: true,
              },
            },
          },
        })
      : [];

    const indirectOrganizations = teamsWithOrgs.map(t => t.workspace.organization);

    // Extract unique organizations
    const allOrganizations = [...directOrganizations, ...indirectOrganizations];
    const organizations = allOrganizations.filter((org, index, self) => 
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

  /**
   * Map RBAC role to legacy MemberRole for backward compatibility
   */
  private mapRBACRoleToLegacyRole(rbacRole: Role, scopeType: 'TEAM' | 'WORKSPACE' | 'TENANT'): MemberRole {
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

  async getMembers(organizationId: string) {
    // Get members from RBAC system (Phase 2 - primary source)
    const tenantAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
      include: {
        user: true,
      },
    });

    // Get team memberships from RBAC for teams in this organization
    const teams = await this.prisma.team.findMany({
      where: {
        workspace: {
          organizationId,
        },
      },
      include: {
        workspace: true,
      },
    });

    const teamAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        scopeType: 'TEAM',
        scopeId: { in: teams.map(t => t.id) },
      },
      include: {
        user: true,
      },
    });

    // Get team details for team assignments
    const teamDetails = new Map(
      teams.map(t => [t.id, t])
    );

    // Aggregate by user
    const userMap = new Map();
    
    // Add organization members from RBAC
    tenantAssignments.forEach(assignment => {
      const legacyRole = this.mapRBACRoleToLegacyRole(assignment.role as Role, 'TENANT');
      userMap.set(assignment.userId, {
        ...assignment.user,
        orgRole: legacyRole,
        teams: [],
        workspaces: new Set(),
      });
    });

    // Add team members from RBAC
    teamAssignments.forEach(assignment => {
      const team = teamDetails.get(assignment.scopeId!);
      if (!team) return;

      const legacyRole = this.mapRBACRoleToLegacyRole(assignment.role as Role, 'TEAM');
      
      if (!userMap.has(assignment.userId)) {
        userMap.set(assignment.userId, {
          ...assignment.user,
          orgRole: null,
          teams: [],
          workspaces: new Set(),
        });
      }
      const user = userMap.get(assignment.userId);
      user.teams.push({
        id: team.id,
        name: team.name,
        role: legacyRole,
        workspace: team.workspace.name,
      });
      user.workspaces.add(team.workspace.name);
    });

    return Array.from(userMap.values()).map(user => ({
      ...user,
      workspaces: Array.from(user.workspaces),
    }));
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

    // Map legacy role to RBAC role
    const rbacRole = this.mapLegacyOrgRoleToRBAC(role);

    // Check if user already has a role assignment (Phase 3: RBAC only)
    const existingAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
    });

    if (existingAssignment) {
      // Update RBAC role assignment
      await this.rbacService.assignRole(
        userId,
        rbacRole,
        'TENANT',
        organizationId,
        actorUserId,
        userOrganizationId || undefined,
      );

      await this.auditLogService.record({
        action: 'UPDATE_ORG_MEMBER_ROLE',
        actorUserId,
        targetUserId: userId,
        targetId: userId,
        targetType: AuditTargetType.USER,
        organizationId,
        metadata: { role, previousRole: existingAssignment.role },
      });

      // Return format compatible with legacy API
      return {
        userId,
        organizationId,
        role,
        user,
        organization: org,
      };
    }

    // Create new RBAC role assignment (Phase 3: RBAC only)
    await this.rbacService.assignRole(
      userId,
      rbacRole,
      'TENANT',
      organizationId,
      actorUserId,
      userOrganizationId || undefined,
    );

    await this.auditLogService.record({
      action: 'ADD_ORG_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId,
      metadata: { role },
    });

    // Return format compatible with legacy API
    return {
      userId,
      organizationId,
      role,
      user,
      organization: org,
    };
  }

  async removeMember(organizationId: string, userId: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify organization exists and tenant match
    const org = await this.findById(organizationId);
    OkrTenantGuard.assertSameTenant(org.id, userOrganizationId);

    // Check if user has role assignments (Phase 3: RBAC only)
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: organizationId,
      },
    });

    if (roleAssignments.length === 0) {
      throw new NotFoundException(`User is not a member of this organization`);
    }

    // Revoke all RBAC role assignments for this user at this organization (Phase 3: RBAC only)
    for (const assignment of roleAssignments) {
      await this.rbacService.revokeRole(
        userId,
        assignment.role as Role,
        'TENANT',
        organizationId,
        actorUserId,
        userOrganizationId || undefined,
      );
    }

    await this.auditLogService.record({
      action: 'REMOVE_ORG_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId,
    });

    return { success: true };
  }
}
