import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType, MemberRole } from '@prisma/client';
import { RBACService } from '../rbac/rbac.service';
import { Role } from '../rbac/types';

@Injectable()
export class WorkspaceService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    private rbacService: RBACService,
  ) {}

  async findAll(userOrganizationId: string | null | undefined, filterOrganizationId?: string) {
    // Tenant isolation: enforce tenant filtering
    if (userOrganizationId === undefined || userOrganizationId === '') {
      // User has no organisation - return empty array
      return [];
    }

    // If filterOrganizationId provided, validate it matches caller's tenant
    if (filterOrganizationId) {
      if (userOrganizationId !== null) {
        // Normal user: must match their tenant
        OkrTenantGuard.assertSameTenant(filterOrganizationId, userOrganizationId);
      }
      // SUPERUSER: can filter by any organisation
      return this.prisma.workspace.findMany({
        where: { organizationId: filterOrganizationId },
        include: {
          organization: true,
          parentWorkspace: true,
          childWorkspaces: true,
          teams: true,
        },
      });
    }

    // No filter provided: return workspaces for caller's tenant
    if (userOrganizationId === null) {
      // SUPERUSER: no filter means return all (but this is unusual - usually they'd provide orgId)
      return this.prisma.workspace.findMany({
        include: {
          organization: true,
          parentWorkspace: true,
          childWorkspaces: true,
          teams: true,
        },
      });
    }

    // Normal user: return workspaces in their tenant
    return this.prisma.workspace.findMany({
      where: { organizationId: userOrganizationId },
      include: {
        organization: true,
        parentWorkspace: true,
        childWorkspaces: true,
        teams: true,
      },
    });
  }

  async findById(id: string, userOrganizationId: string | null | undefined) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        organization: true,
        parentWorkspace: true,
        childWorkspaces: true,
        teams: true,
        objectives: {
          include: {
            keyResults: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    // Tenant isolation: verify workspace belongs to caller's tenant
    if (userOrganizationId === undefined || userOrganizationId === '') {
      // Caller has no organisation - cannot access any workspace
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    if (userOrganizationId === null) {
      // SUPERUSER: can see any workspace (read-only)
      return workspace;
    }

    // Normal user: verify workspace belongs to caller's tenant
    if (workspace.organizationId !== userOrganizationId) {
      // Don't leak existence - return not found
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    return workspace;
  }

  async findByUserId(userId: string) {
    // Find workspaces through RBAC workspace role assignments (Phase 4: RBAC only)
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

    // Fetch direct workspaces
    const directWorkspaces = workspaceIds.length > 0
      ? await this.prisma.workspace.findMany({
          where: { id: { in: workspaceIds } },
          include: {
            organization: true,
            parentWorkspace: true,
            childWorkspaces: true,
            teams: true,
          },
        })
      : [];

    // Also find workspaces through team memberships (Phase 4: RBAC only)
    const teamAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'TEAM',
        scopeId: { not: null },
      },
    });

    // Get team IDs and fetch teams with workspaces
    const teamIds = [...new Set(
      teamAssignments
        .map(ta => ta.scopeId)
        .filter((id): id is string => id !== null)
    )];

    const teamsWithWorkspaces = teamIds.length > 0
      ? await this.prisma.team.findMany({
          where: { id: { in: teamIds } },
          include: {
            workspace: {
              include: {
                organization: true,
                parentWorkspace: true,
                childWorkspaces: true,
                teams: true,
              },
            },
          },
        })
      : [];

    const indirectWorkspaces = teamsWithWorkspaces.map(t => t.workspace);

    // Combine direct and indirect workspace memberships
    const allWorkspaces = [...directWorkspaces, ...indirectWorkspaces];

    // Extract unique workspaces (prioritize direct memberships)
    const uniqueWorkspaces = allWorkspaces.filter((workspace, index, self) => 
      index === self.findIndex(w => w.id === workspace.id)
    );

    return uniqueWorkspaces;
  }

  async getDefaultWorkspace(userId: string) {
    const workspaces = await this.findByUserId(userId);
    
    if (workspaces.length === 0) {
      throw new NotFoundException('User is not a member of any workspace');
    }

    // Return first workspace for now; later can add user preference
    return workspaces[0];
  }

  async create(data: { name: string; organizationId: string; parentWorkspaceId?: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(data.organizationId, userOrganizationId);

    // If parent workspace is provided, validate it belongs to the same organization
    if (data.parentWorkspaceId) {
      const parentWorkspace = await this.prisma.workspace.findUnique({
        where: { id: data.parentWorkspaceId },
      });

      if (!parentWorkspace) {
        throw new NotFoundException(`Parent workspace with ID ${data.parentWorkspaceId} not found`);
      }

      if (parentWorkspace.organizationId !== data.organizationId) {
        throw new ConflictException(`Parent workspace must belong to the same organization`);
      }
    }

    const created = await this.prisma.workspace.create({
      data: {
        name: data.name,
        organizationId: data.organizationId,
        parentWorkspaceId: data.parentWorkspaceId || null,
      },
      include: {
        organization: true,
        parentWorkspace: true,
        childWorkspaces: true,
        teams: true,
      },
    });

    await this.auditLogService.record({
      action: 'CREATE_WORKSPACE',
      actorUserId,
      targetId: created.id,
      targetType: AuditTargetType.WORKSPACE,
      organizationId: data.organizationId,
    });

    return created;
  }

  /**
   * Check if setting newParentId as parent of workspaceId would create a cycle
   * Returns true if newParentId is already a descendant of workspaceId
   */
  private async wouldCreateCycle(workspaceId: string, newParentId: string): Promise<boolean> {
    // If trying to set self as parent, that's a cycle
    if (workspaceId === newParentId) {
      return true;
    }

    // Walk up the tree from newParentId to see if we reach workspaceId
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        // Cycle detected in existing hierarchy
        return true;
      }
      visited.add(currentId);

      if (currentId === workspaceId) {
        // Found workspaceId in the parent chain of newParentId
        // This would create a cycle: workspaceId -> ... -> newParentId -> workspaceId
        return true;
      }

      const current: { parentWorkspaceId: string | null } | null = await this.prisma.workspace.findUnique({
        where: { id: currentId },
        select: { parentWorkspaceId: true },
      });

      currentId = current?.parentWorkspaceId || null;
    }

    return false;
  }

  async update(id: string, data: { name?: string; parentWorkspaceId?: string | null }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get existing workspace to check tenant isolation
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(workspace.organizationId, userOrganizationId);

    // If parent workspace is being updated, validate it
    if (data.parentWorkspaceId !== undefined) {
      if (data.parentWorkspaceId) {
        const parentWorkspace = await this.prisma.workspace.findUnique({
          where: { id: data.parentWorkspaceId },
        });

        if (!parentWorkspace) {
          throw new NotFoundException(`Parent workspace with ID ${data.parentWorkspaceId} not found`);
        }

        if (parentWorkspace.organizationId !== workspace.organizationId) {
          throw new ConflictException(`Parent workspace must belong to the same organization`);
        }

        // Prevent circular references
        const wouldCycle = await this.wouldCreateCycle(id, data.parentWorkspaceId);
        if (wouldCycle) {
          throw new ConflictException(`Cannot create circular workspace hierarchy`);
        }
      }
    }

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: {
        name: data.name,
        parentWorkspaceId: data.parentWorkspaceId === null ? null : data.parentWorkspaceId,
      },
      include: {
        organization: true,
        parentWorkspace: true,
        childWorkspaces: true,
        teams: true,
      },
    });

    await this.auditLogService.record({
      action: 'UPDATE_WORKSPACE',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.WORKSPACE,
      organizationId: workspace.organizationId,
    });

    return updated;
  }

  /**
   * Get workspace hierarchy tree starting from root workspaces
   */
  async getHierarchy(organizationId: string) {
    const allWorkspaces = await this.prisma.workspace.findMany({
      where: { organizationId },
      include: {
        parentWorkspace: true,
        childWorkspaces: true,
      },
      orderBy: { name: 'asc' },
    });

    // Find root workspaces (no parent)
    const rootWorkspaces = allWorkspaces.filter(ws => !ws.parentWorkspaceId);

    return rootWorkspaces;
  }

  async delete(id: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get existing workspace to check tenant isolation
    const workspace = await this.findById(id, userOrganizationId);
    OkrTenantGuard.assertSameTenant(workspace.organizationId, userOrganizationId);

    await this.auditLogService.record({
      action: 'DELETE_WORKSPACE',
      actorUserId,
      targetId: id,
      targetType: AuditTargetType.WORKSPACE,
      organizationId: workspace.organizationId,
    });

    return this.prisma.workspace.delete({
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

  async getMembers(workspaceId: string) {
    // Get workspace to find organization
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { organization: true },
    });

    if (!workspace) {
      return [];
    }

    // Get members from RBAC system (Phase 2 - primary source)
    // Get workspace-level role assignments
    const workspaceAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        scopeType: 'WORKSPACE',
        scopeId: workspaceId,
      },
      include: {
        user: true,
      },
    });

    // Get team-level role assignments for teams in this workspace
    const teams = await this.prisma.team.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
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

    // Get organization-level role assignments (they have access to all workspaces)
    const orgAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        scopeType: 'TENANT',
        scopeId: workspace.organizationId,
      },
      include: {
        user: true,
      },
    });

    // Create team details map
    const teamDetails = new Map(teams.map(t => [t.id, t]));

    // Aggregate by user
    const userMap = new Map();
    
    // Add team members from RBAC
    teamAssignments.forEach(assignment => {
      const team = teamDetails.get(assignment.scopeId!);
      if (!team) return;

      const legacyRole = this.mapRBACRoleToLegacyRole(assignment.role as Role, 'TEAM');
      
      if (!userMap.has(assignment.userId)) {
        userMap.set(assignment.userId, {
          ...assignment.user,
          teams: [],
          workspaceRole: null,
          orgRole: null,
        });
      }
      const user = userMap.get(assignment.userId);
      user.teams.push({
        id: team.id,
        name: team.name,
        role: legacyRole,
      });
    });

    // Add workspace members from RBAC (if not already in map)
    workspaceAssignments.forEach(assignment => {
      const legacyRole = this.mapRBACRoleToLegacyRole(assignment.role as Role, 'WORKSPACE');
      
      if (!userMap.has(assignment.userId)) {
        userMap.set(assignment.userId, {
          ...assignment.user,
          teams: [],
          workspaceRole: legacyRole,
          orgRole: null,
        });
      } else {
        const user = userMap.get(assignment.userId);
        user.workspaceRole = legacyRole;
      }
    });

    // Add organization members from RBAC (if not already in map)
    orgAssignments.forEach(assignment => {
      const legacyRole = this.mapRBACRoleToLegacyRole(assignment.role as Role, 'TENANT');
      
      if (!userMap.has(assignment.userId)) {
        userMap.set(assignment.userId, {
          ...assignment.user,
          teams: [],
          workspaceRole: null,
          orgRole: legacyRole,
        });
      } else {
        const user = userMap.get(assignment.userId);
        user.orgRole = legacyRole;
      }
    });

    return Array.from(userMap.values());
  }

  async verifyUserAccess(workspaceId: string, userId: string): Promise<boolean> {
    // Phase 4: Check RBAC for workspace or team access
    const workspaceAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: 'WORKSPACE',
        scopeId: workspaceId,
      },
    });

    if (workspaceAssignment) {
      return true;
    }

    // Check if user has team access in this workspace
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
      const teamsInWorkspace = await this.prisma.team.findFirst({
        where: {
          id: { in: teamIds },
          workspaceId,
        },
      });

      return !!teamsInWorkspace;
    }

    return false;
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

  async addMember(workspaceId: string, userId: string, role: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER' = 'MEMBER', userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify workspace exists and tenant match
    const workspace = await this.findById(workspaceId, userOrganizationId);
    OkrTenantGuard.assertSameTenant(workspace.organizationId, userOrganizationId);
    
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Map legacy role to RBAC role
    const rbacRole = this.mapLegacyWorkspaceRoleToRBAC(role);

    // Check if user already has a role assignment (Phase 3: RBAC only)
    const existingAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: 'WORKSPACE',
        scopeId: workspaceId,
      },
    });

    if (existingAssignment) {
      // Update RBAC role assignment
      await this.rbacService.assignRole(
        userId,
        rbacRole,
        'WORKSPACE',
        workspaceId,
        actorUserId,
        userOrganizationId || undefined,
      );

      await this.auditLogService.record({
        action: 'UPDATE_WORKSPACE_MEMBER_ROLE',
        actorUserId,
        targetUserId: userId,
        targetId: userId,
        targetType: AuditTargetType.USER,
        organizationId: workspace.organizationId,
        metadata: { role, previousRole: existingAssignment.role },
      });

      // Return format compatible with legacy API
      return {
        userId,
        workspaceId,
        role,
        user,
        workspace,
      };
    }

    // Create new RBAC role assignment (Phase 3: RBAC only)
    await this.rbacService.assignRole(
      userId,
      rbacRole,
      'WORKSPACE',
      workspaceId,
      actorUserId,
      userOrganizationId || undefined,
    );

    await this.auditLogService.record({
      action: 'ADD_WORKSPACE_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId: workspace.organizationId,
      metadata: { role },
    });

    // Return format compatible with legacy API
    return {
      userId,
      workspaceId,
      role,
      user,
      workspace,
    };
  }

  async removeMember(workspaceId: string, userId: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify workspace exists and tenant match
    const workspace = await this.findById(workspaceId, userOrganizationId);
    OkrTenantGuard.assertSameTenant(workspace.organizationId, userOrganizationId);

    // Check if user has role assignments (Phase 3: RBAC only)
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        scopeType: 'WORKSPACE',
        scopeId: workspaceId,
      },
    });

    if (roleAssignments.length === 0) {
      throw new NotFoundException(`User is not a member of this workspace`);
    }

    // Revoke all RBAC role assignments for this user at this workspace (Phase 3: RBAC only)
    for (const assignment of roleAssignments) {
      await this.rbacService.revokeRole(
        userId,
        assignment.role as Role,
        'WORKSPACE',
        workspaceId,
        actorUserId,
        userOrganizationId || undefined,
      );
    }

    await this.auditLogService.record({
      action: 'REMOVE_WORKSPACE_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId: workspace.organizationId,
    });

    return { success: true };
  }
}
