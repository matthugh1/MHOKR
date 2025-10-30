import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';

@Injectable()
export class ObjectiveService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
  ) {}

  async findAll(userId: string, workspaceId: string | undefined, userOrganizationId: string | null) {
    const where: any = {};

    // Tenant isolation: filter by organizationId
    // If userOrganizationId === null, that means superuser → no org filter, return all OKRs
    // If userOrganizationId is a string, add org filter
    // If userOrganizationId is '' or undefined, return [] (safety)
    if (userOrganizationId === null) {
      // Superuser: no org filter, return all OKRs
    } else if (userOrganizationId && userOrganizationId !== '') {
      where.organizationId = userOrganizationId;
    } else {
      // User has no org or invalid org → return empty array
      return [];
    }

    // Optional workspace filter for UI convenience (not access control)
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    return this.prisma.objective.findMany({
      where,
      include: {
        keyResults: {
          include: {
            keyResult: true,
          },
        },
        team: true,
        organization: true,
        workspace: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            title: true,
          },
        },
        children: true,
      },
    });
  }

  async findById(id: string) {
    const objective = await this.prisma.objective.findUnique({
      where: { id },
      include: {
        keyResults: {
          include: {
            keyResult: {
              include: {
                checkIns: {
                  orderBy: { createdAt: 'desc' },
                  take: 5,
                },
                integrations: true,
              },
            },
          },
        },
        initiatives: true,
        team: true,
        organization: true,
        workspace: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            title: true,
          },
        },
        children: true,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${id} not found`);
    }

    return objective;
  }

  /**
   * Check if user can view a specific OKR
   */
  async canView(userId: string, objectiveId: string): Promise<boolean> {
    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      return this.rbacService.canPerformAction(userId, 'view_okr', resourceContext);
    } catch {
      return false;
    }
  }

  /**
   * Check if user can edit a specific OKR
   */
  async canEdit(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
    // Superuser is read-only auditor (cannot edit)
    if (userOrganizationId === null) {
      return false;
    }

    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      
      // Extract OKR's organizationId from resource context
      const okrOrganizationId = resourceContext.okr?.organizationId;
      
      // TODO: Define explicit behavior for OKRs that have no organizationId (currently treated as system data, blocks writes)
      if (!okrOrganizationId) {
        return false;
      }
      
      // Verify tenant match: user's org must match OKR's org
      if (okrOrganizationId !== userOrganizationId) {
        return false;
      }
      
      return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
    } catch {
      return false;
    }
  }

  /**
   * Check if user can delete a specific OKR
   * TODO: Apply the same tenant isolation logic to Key Results write paths (PATCH/DELETE)
   */
  async canDelete(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
    // Superuser is read-only auditor (cannot delete)
    if (userOrganizationId === null) {
      return false;
    }

    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      
      // Extract OKR's organizationId from resource context
      const okrOrganizationId = resourceContext.okr?.organizationId;
      
      // TODO: Define explicit behavior for OKRs that have no organizationId (currently treated as system data, blocks writes)
      if (!okrOrganizationId) {
        return false;
      }
      
      // Verify tenant match: user's org must match OKR's org
      if (okrOrganizationId !== userOrganizationId) {
        return false;
      }
      
      return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
    } catch {
      return false;
    }
  }

  /**
   * Check if user can create OKRs in a workspace
   */
  async canCreateInWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { organizationId: true },
      });
      if (!workspace) return false;
      
      const resourceContext = {
        tenantId: workspace.organizationId,
        workspaceId,
        teamId: null,
      };
      return this.rbacService.canPerformAction(userId, 'create_okr', resourceContext);
    } catch {
      return false;
    }
  }

  async create(data: any, _userId: string) {
    // Validate required fields
    if (!data.ownerId) {
      throw new BadRequestException('ownerId is required');
    }

    // Reject hardcoded/invalid values
    if (data.ownerId === 'temp-user' || data.ownerId === 'default') {
      throw new BadRequestException('Invalid ownerId: Please select a valid owner');
    }

    // At least one of organizationId, workspaceId, or teamId must be set
    if (!data.organizationId && !data.workspaceId && !data.teamId) {
      throw new BadRequestException('OKR must be assigned to an organization, workspace, or team');
    }

    // Validate dates
    if (!data.startDate || !data.endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    // Validate period-specific date ranges
    if (data.period) {
      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (data.period) {
        case 'MONTHLY':
          if (durationDays < 25 || durationDays > 35) {
            throw new BadRequestException('Monthly period should be approximately 30 days');
          }
          break;
        case 'QUARTERLY':
          if (durationDays < 85 || durationDays > 95) {
            throw new BadRequestException('Quarterly period should be approximately 90 days');
          }
          break;
        case 'ANNUAL':
          if (durationDays < 360 || durationDays > 370) {
            throw new BadRequestException('Annual period should be approximately 365 days');
          }
          break;
        // CUSTOM has no constraints
      }
    }

    // Validate owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: data.ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`User with ID ${data.ownerId} not found`);
    }

    // Validate organization if provided
    if (data.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: data.organizationId },
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${data.organizationId} not found`);
      }
    }

    // Validate workspace if provided
    if (data.workspaceId) {
      // Reject hardcoded/invalid values
      if (data.workspaceId === 'default' || data.workspaceId === 'temp') {
        throw new BadRequestException('Invalid workspaceId: Please select a valid workspace');
      }

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: data.workspaceId },
      });

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${data.workspaceId} not found`);
      }
    }

    // Validate team if provided
    if (data.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: data.teamId },
      });

      if (!team) {
        throw new NotFoundException(`Team with ID ${data.teamId} not found`);
      }

      // Verify team belongs to the workspace (if workspace is specified)
      if (data.workspaceId && team.workspaceId !== data.workspaceId) {
        throw new BadRequestException('Team does not belong to the specified workspace');
      }
    }

    return this.prisma.objective.create({
      data,
      include: {
        keyResults: true,
      },
    });
  }

  async update(id: string, data: any, userId: string) {
    // Verify objective exists and user has permission (already checked in controller)
    const objective = await this.prisma.objective.findUnique({
      where: { id },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${id} not found`);
    }

    // Additional validation: prevent changing ownership without permission
    if (data.ownerId && data.ownerId !== objective.ownerId) {
      // Only allow if user can manage workspace or tenant
      let canManage = false;
      
      if (objective.workspaceId) {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: objective.workspaceId },
          select: { organizationId: true },
        });
        if (workspace) {
          const resourceContext = {
            tenantId: workspace.organizationId,
            workspaceId: objective.workspaceId,
            teamId: null,
          };
          canManage = await this.rbacService.canPerformAction(userId, 'manage_workspaces', resourceContext);
        }
      }
      
      if (!canManage && objective.organizationId) {
        const resourceContext = {
          tenantId: objective.organizationId,
          workspaceId: null,
          teamId: null,
        };
        canManage = await this.rbacService.canPerformAction(userId, 'manage_tenant_settings', resourceContext);
      }
      
      if (!canManage) {
        throw new ForbiddenException('You do not have permission to change OKR ownership');
      }
    }

    return this.prisma.objective.update({
      where: { id },
      data,
      include: {
        keyResults: true,
      },
    });
  }

  async delete(id: string) {
    try {
      // Check if objective exists
      const objective = await this.prisma.objective.findUnique({
        where: { id },
        include: {
          keyResults: true,
          initiatives: true,
          children: true,
        },
      });

      if (!objective) {
        throw new NotFoundException(`Objective with ID ${id} not found`);
      }

      // Delete objective (cascades will handle related records)
      return await this.prisma.objective.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Re-throw Prisma errors with more context
      throw new BadRequestException(
        `Failed to delete objective: ${error.message || 'Unknown error'}`
      );
    }
  }
}

