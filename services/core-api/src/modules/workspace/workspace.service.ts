import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  async findAll(organizationId?: string) {
    return this.prisma.workspace.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        organization: true,
        parentWorkspace: true,
        childWorkspaces: true,
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
    });
  }

  async findById(id: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        organization: true,
        parentWorkspace: true,
        childWorkspaces: true,
        teams: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
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

    return workspace;
  }

  async findByUserId(userId: string) {
    // Find workspaces through direct workspace memberships (primary)
    const workspaceMembers = await this.prisma.workspaceMember.findMany({
      where: { userId },
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
    });

    // Also find workspaces through team memberships (secondary)
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
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
        },
      },
    });

    // Combine direct and indirect workspace memberships
    const directWorkspaces = workspaceMembers.map(wm => wm.workspace);
    const indirectWorkspaces = teamMembers.map(tm => tm.team.workspace);
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
        members: {
          include: {
            user: true,
          },
        },
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
    const workspace = await this.findById(id);
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

  async getMembers(workspaceId: string) {
    // Get workspace to find organization
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { organization: true },
    });

    if (!workspace) {
      return [];
    }

    // Get all users who are members of teams in this workspace
    const teamMembers = await this.prisma.teamMember.findMany({
      where: {
        team: {
          workspaceId,
        },
      },
      include: {
        user: true,
        team: true,
      },
    });

    // Get workspace-level members
    const workspaceMembers = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
      },
      include: {
        user: true,
      },
    });

    // Get organization-level members (they have access to all workspaces)
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: workspace.organizationId,
      },
      include: {
        user: true,
      },
    });

    // Aggregate by user
    const userMap = new Map();
    
    // Add team members
    teamMembers.forEach(tm => {
      if (!userMap.has(tm.userId)) {
        userMap.set(tm.userId, {
          ...tm.user,
          teams: [],
          workspaceRole: null,
          orgRole: null,
        });
      }
      const user = userMap.get(tm.userId);
      user.teams.push({
        id: tm.team.id,
        name: tm.team.name,
        role: tm.role,
      });
    });

    // Add workspace members (if not already in map)
    workspaceMembers.forEach(wm => {
      if (!userMap.has(wm.userId)) {
        userMap.set(wm.userId, {
          ...wm.user,
          teams: [],
          workspaceRole: wm.role,
          orgRole: null,
        });
      } else {
        const user = userMap.get(wm.userId);
        user.workspaceRole = wm.role;
      }
    });

    // Add organization members (if not already in map)
    orgMembers.forEach(om => {
      if (!userMap.has(om.userId)) {
        userMap.set(om.userId, {
          ...om.user,
          teams: [],
          workspaceRole: null,
          orgRole: om.role,
        });
      } else {
        const user = userMap.get(om.userId);
        user.orgRole = om.role;
      }
    });

    return Array.from(userMap.values());
  }

  async verifyUserAccess(workspaceId: string, userId: string): Promise<boolean> {
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        team: {
          workspaceId,
        },
      },
    });

    return !!teamMember;
  }

  async addMember(workspaceId: string, userId: string, role: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER' = 'MEMBER', userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify workspace exists and tenant match
    const workspace = await this.findById(workspaceId);
    OkrTenantGuard.assertSameTenant(workspace.organizationId, userOrganizationId);
    
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if user is already a member
    const existing = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (existing) {
      // Update role if already exists
      const updated = await this.prisma.workspaceMember.update({
        where: { id: existing.id },
        data: { role },
        include: {
          user: true,
          workspace: true,
        },
      });

      await this.auditLogService.record({
        action: 'UPDATE_WORKSPACE_MEMBER_ROLE',
        actorUserId,
        targetUserId: userId,
        targetId: userId,
        targetType: AuditTargetType.USER,
        organizationId: workspace.organizationId,
        metadata: { role, previousRole: existing.role },
      });

      return updated;
    }

    // Create new membership
    const created = await this.prisma.workspaceMember.create({
      data: {
        userId,
        workspaceId,
        role,
      },
      include: {
        user: true,
        workspace: {
          include: {
            organization: true,
          },
        },
      },
    });

    await this.auditLogService.record({
      action: 'ADD_WORKSPACE_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId: workspace.organizationId,
      metadata: { role },
    });

    return created;
  }

  async removeMember(workspaceId: string, userId: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Verify workspace exists and tenant match
    const workspace = await this.findById(workspaceId);
    OkrTenantGuard.assertSameTenant(workspace.organizationId, userOrganizationId);

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (!membership) {
      throw new NotFoundException(`User is not a member of this workspace`);
    }

    await this.auditLogService.record({
      action: 'REMOVE_WORKSPACE_MEMBER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      organizationId: workspace.organizationId,
    });

    return this.prisma.workspaceMember.delete({
      where: { id: membership.id },
    });
  }
}
