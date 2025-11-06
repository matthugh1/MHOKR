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

  async findAll(userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce tenant filtering for all organisations
    if (userOrganizationId === undefined || userOrganizationId === '') {
      // User has no organisation - return empty array
      return [];
    }

    if (userOrganizationId === null) {
      // SUPERUSER: can see all organisations (read-only access)
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

    // Normal user: only return their organisation(s)
    // For now, userOrganizationId is the primary organisation ID
    // TODO: Support multi-org users by fetching from role assignments
    return this.prisma.organization.findMany({
      where: {
        id: userOrganizationId,
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

  async findByUserOrganizations(tenantIds: string[]) {
    if (tenantIds.length === 0) {
      return [];
    }
    
    return this.prisma.organization.findMany({
      where: {
        id: { in: tenantIds },
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

  async findById(id: string, userOrganizationId: string | null | undefined) {
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

    // Tenant isolation: verify organisation belongs to caller's tenant
    if (userOrganizationId === undefined || userOrganizationId === '') {
      // Caller has no organisation - cannot access any organisation
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    if (userOrganizationId === null) {
      // SUPERUSER: can see any organisation (read-only)
      return organization;
    }

    // Normal user: verify organisation matches caller's tenant
    if (organization.id !== userOrganizationId) {
      // Don't leak existence - return not found
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
    const tenantIds = [...new Set(
      tenantAssignments
        .map(ta => ta.scopeId)
        .filter((id): id is string => id !== null)
    )];

    // Fetch organizations
    const directOrganizations = tenantIds.length > 0
      ? await this.prisma.organization.findMany({
          where: { id: { in: tenantIds } },
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
                tenant: true,
              },
            },
          },
        })
      : [];

    const indirectOrganizations = teamsWithOrgs.map(t => t.workspace.tenant);

    // Extract unique organizations
    const allOrganizations = [...directOrganizations, ...indirectOrganizations];
    const organizations = allOrganizations.filter((org, index, self) => 
      index === self.findIndex(o => o.id === org.id)
    );

    return organizations;
  }

  async getCurrentOrganization(userId: string, userOrganizationId?: string | null | undefined) {
    const organizations = await this.findByUserId(userId);
    
    // For now, return the first organization (users belong to one org)
    if (organizations.length === 0) {
      throw new NotFoundException('User is not a member of any organization');
    }

    return this.findById(organizations[0].id, userOrganizationId);
  }

  async create(data: { name: string; slug: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Check if user is superuser from database (source of truth)
    const user = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { isSuperuser: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${actorUserId} not found`);
    }

    // Explicitly check for true (handle null, undefined, false cases)
    const isSuperuser = Boolean(user.isSuperuser === true);

    // Tenant isolation: enforce mutation rules (unless superuser)
    // Superusers can create any organization (they have manage_tenant_settings permission)
    if (!isSuperuser) {
      OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
    }

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
      tenantId: created.id,
    });

    return created;
  }

  async update(id: string, data: { name?: string; slug?: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Check if user is superuser from database (source of truth)
    const user = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { isSuperuser: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${actorUserId} not found`);
    }

    const isSuperuser = user.isSuperuser || false;

    // Tenant isolation: enforce mutation rules (unless superuser)
    // Superusers can update any organization (they have manage_tenant_settings permission)
    if (!isSuperuser) {
      OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
    }

    // Get existing organization to check tenant isolation
    const existing = await this.findById(id, userOrganizationId);
    
    // Skip tenant match check for superusers
    if (!isSuperuser) {
      OkrTenantGuard.assertSameTenant(existing.id, userOrganizationId);
    }

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
      tenantId: id,
    });

    return updated;
  }

  async delete(id: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Check if user is superuser from database (source of truth)
    const user = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { isSuperuser: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${actorUserId} not found`);
    }

    // Explicitly check for true (handle null, undefined, false cases)
    const isSuperuser = Boolean(user.isSuperuser === true);
    
    // Log for debugging
    console.log(`[OrganizationService.delete] User ${actorUserId}: isSuperuser=${user.isSuperuser} (type: ${typeof user.isSuperuser}), userOrganizationId=${userOrganizationId}, isSuperuser flag=${isSuperuser}`);

    // Tenant isolation: enforce mutation rules (unless superuser)
    // Superusers can delete any organization (they have manage_tenant_settings permission)
    // IMPORTANT: We skip the tenant guard check for superusers because they have manage_tenant_settings permission
    if (isSuperuser) {
      console.log(`[OrganizationService.delete] Superuser detected - bypassing all tenant guard checks`);
      // Skip all tenant isolation checks for superusers
    } else {
      console.log(`[OrganizationService.delete] Non-superuser - enforcing tenant isolation`);
      OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
    }

    // Get existing organization to check tenant isolation
    const existing = await this.findById(id, userOrganizationId);
    
    // Skip tenant match check for superusers
    if (!isSuperuser) {
      OkrTenantGuard.assertSameTenant(existing.id, userOrganizationId);
    }

    // Get all workspaces in this organization to find related RoleAssignments
    const workspaces = await this.prisma.workspace.findMany({
      where: { tenantId: id },
      select: { id: true },
    });
    const workspaceIds = workspaces.map(w => w.id);

    // Get all teams in workspaces of this organization
    const teams = workspaceIds.length > 0
      ? await this.prisma.team.findMany({
          where: { workspaceId: { in: workspaceIds } },
          select: { id: true },
        })
      : [];
    const teamIds = teams.map(t => t.id);

    // Delete all RoleAssignments related to this organization
    // 1. TENANT scope assignments for this organization
    // 2. WORKSPACE scope assignments for workspaces in this organization
    // 3. TEAM scope assignments for teams in workspaces of this organization
    const deleteConditions: any[] = [
      { scopeType: 'TENANT' as const, scopeId: id },
    ];
    
    if (workspaceIds.length > 0) {
      deleteConditions.push({ scopeType: 'WORKSPACE' as const, scopeId: { in: workspaceIds } });
    }
    
    if (teamIds.length > 0) {
      deleteConditions.push({ scopeType: 'TEAM' as const, scopeId: { in: teamIds } });
    }
    
    await this.prisma.roleAssignment.deleteMany({
      where: {
        OR: deleteConditions,
      },
    });

    await this.auditLogService.record({
      action: 'DELETE_ORG',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.TENANT,
      tenantId: id,
    });

    // Delete organization (cascades will handle workspaces, teams, objectives, cycles, etc.)
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

  async getMembers(tenantId: string) {
    // Get members from RBAC system (Phase 2 - primary source)
    const tenantAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        scopeType: 'TENANT',
        scopeId: tenantId,
      },
      include: {
        user: true,
      },
    });

    // Get team memberships from RBAC for teams in this organization
    const teams = await this.prisma.team.findMany({
      where: {
        workspace: {
          tenantId,
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

  async addMember(tenantId: string, userId: string, role: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER', userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify organization exists and tenant match
    const org = await this.findById(tenantId, userOrganizationId);
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
        scopeId: tenantId,
      },
    });

    if (existingAssignment) {
      // Update RBAC role assignment
      await this.rbacService.assignRole(
        userId,
        rbacRole,
        'TENANT',
        tenantId,
        actorUserId,
        userOrganizationId || undefined,
      );

      await this.auditLogService.record({
        action: 'UPDATE_ORG_MEMBER_ROLE',
        actorUserId,
        targetUserId: userId,
        targetId: userId,
        targetType: AuditTargetType.USER,
        tenantId,
        metadata: { role, previousRole: existingAssignment.role },
      });

      // Return format compatible with legacy API
      return {
        userId,
        tenantId,
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
      tenantId,
      actorUserId,
      userOrganizationId || undefined,
    );

    await this.auditLogService.record({
      action: 'ADD_ORG_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      tenantId,
      metadata: { role },
    });

    // Return format compatible with legacy API
    return {
      userId,
      tenantId,
      role,
      user,
      organization: org,
    };
  }

  async removeMember(tenantId: string, userId: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify organization exists and tenant match
    const org = await this.findById(tenantId, userOrganizationId);
    OkrTenantGuard.assertSameTenant(org.id, userOrganizationId);

    // Check if user has role assignments (Phase 3: RBAC only)
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: tenantId,
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
        tenantId,
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
      tenantId,
    });

    return { success: true };
  }
}
