import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { OkrProgressService } from './okr-progress.service';
import { ActivityService } from '../activity/activity.service';
import { OkrTenantGuard } from './tenant-guard';
import { OkrGovernanceService } from './okr-governance.service';

/**
 * Objective Service
 * 
 * NOTE: Reporting / analytics / export logic was moved to OkrReportingService in Phase 4.
 * This service now focuses on CRUD operations and orchestration only.
 */
@Injectable()
export class ObjectiveService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private okrProgressService: OkrProgressService,
    private activityService: ActivityService,
    private okrGovernanceService: OkrGovernanceService,
  ) {}

  async findAll(_userId: string, workspaceId: string | undefined, userOrganizationId: string | null, pillarId?: string) {
    const where: any = {};

    // Tenant isolation: use OkrTenantGuard to build where clause
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      // User has no org or invalid org → return empty array
      return [];
    }
    if (orgFilter) {
      where.organizationId = orgFilter.organizationId;
    }
    // Superuser (null): no org filter, see all OKRs

    // Optional workspace filter for UI convenience (not access control)
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    // Optional pillar filter: filter objectives by strategic pillar
    if (pillarId) {
      where.pillarId = pillarId;
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
        pillar: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
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
        pillar: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
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
    // Tenant isolation: superuser is read-only
    if (userOrganizationId === null) {
      return false;
    }

    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      
      // Extract OKR's organizationId from resource context
      const okrOrganizationId = resourceContext.okr?.organizationId;
      
      // Tenant isolation: verify org match (throws if mismatch or system/global)
      try {
        OkrTenantGuard.assertSameTenant(okrOrganizationId, userOrganizationId);
      } catch {
        return false;
      }
      
      return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
    } catch {
      return false;
    }
  }

  // Governance moved to OkrGovernanceService (Phase 3)

  /**
   * Check if user can delete a specific OKR
   */
  async canDelete(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
    // Tenant isolation: superuser is read-only
    if (userOrganizationId === null) {
      return false;
    }

    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      
      // Extract OKR's organizationId from resource context
      const okrOrganizationId = resourceContext.okr?.organizationId;
      
      // Tenant isolation: verify org match (throws if mismatch or system/global)
      try {
        OkrTenantGuard.assertSameTenant(okrOrganizationId, userOrganizationId);
      } catch {
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

    const createdObjective = await this.prisma.objective.create({
      data,
      include: {
        keyResults: true,
      },
    });

    // Log activity for creation
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: createdObjective.id,
      userId: _userId,
      action: 'CREATED',
      metadata: {
        title: createdObjective.title,
        ownerId: createdObjective.ownerId,
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for objective creation:', err);
    });

    // If Objective has a parent, trigger progress roll-up for parent
    if (data.parentId) {
      await this.okrProgressService.refreshObjectiveProgressCascade(data.parentId);
    }

    return createdObjective;
  }

  async update(id: string, data: any, userId: string, userOrganizationId: string | null) {
    // Verify objective exists and user has permission (already checked in controller)
    const objective = await this.prisma.objective.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        isPublished: true,
        ownerId: true,
        workspaceId: true,
        parentId: true,
        progress: true,
        status: true,
        title: true,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${id} not found`);
    }

    // Governance: Check all locks (cycle lock + publish lock) via OkrGovernanceService
    await this.okrGovernanceService.checkAllLocksForObjective({
      objective: {
        id: objective.id,
        isPublished: objective.isPublished,
      },
      actingUser: {
        id: userId,
        organizationId: userOrganizationId,
      },
      rbacService: this.rbacService,
    });
    // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
    // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking

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

    const updatedObjective = await this.prisma.objective.update({
      where: { id },
      data,
      include: {
        keyResults: true,
      },
    });

    // Determine if this was a publish action
    const wasPublish = objective.isPublished === false && updatedObjective.isPublished === true;

    // Log activity for update
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: updatedObjective.id,
      userId: userId,
      action: 'UPDATED', // Using UPDATED for both regular updates and publish (isPublished change noted in metadata)
      metadata: {
        wasPublish: wasPublish,
        before: {
          progress: objective.progress,
          status: objective.status,
          isPublished: objective.isPublished,
          // Include minimal diff - title if changed
          ...(data.title && data.title !== objective.title ? { title: objective.title } : {}),
        },
        after: {
          progress: updatedObjective.progress,
          status: updatedObjective.status,
          isPublished: updatedObjective.isPublished,
          ...(data.title ? { title: updatedObjective.title } : {}),
        },
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for objective update:', err);
    });

    // If parentId changed or Objective itself changed, trigger roll-up
    if (data.parentId !== undefined || data.children !== undefined) {
      await this.okrProgressService.refreshObjectiveProgressCascade(id);
      // If parent changed, also update old and new parents
      if (objective.parentId && objective.parentId !== data.parentId) {
        await this.okrProgressService.refreshObjectiveProgressCascade(objective.parentId);
      }
      if (data.parentId && data.parentId !== objective.parentId) {
        await this.okrProgressService.refreshObjectiveProgressCascade(data.parentId);
      }
    }

    return updatedObjective;
  }

  async delete(id: string, userId: string, userOrganizationId: string | null) {
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

      // Governance: Check all locks (cycle lock + publish lock) via OkrGovernanceService
      await this.okrGovernanceService.checkAllLocksForObjective({
        objective: {
          id: objective.id,
          isPublished: objective.isPublished,
        },
        actingUser: {
          id: userId,
          organizationId: userOrganizationId,
        },
        rbacService: this.rbacService,
      });
      // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
      // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking

      // Get parent ID before deletion (for progress roll-up)
      const parentId = objective.parentId;

      // Log activity for deletion (before deletion)
      await this.activityService.createActivity({
        entityType: 'OBJECTIVE',
        entityId: objective.id,
        userId: userId,
        action: 'DELETED',
        metadata: {
          title: objective.title,
          ownerId: objective.ownerId,
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log activity for objective deletion:', err);
      });

      // Delete objective (cascades will handle related records)
      await this.prisma.objective.delete({
        where: { id },
      });

      // Trigger progress roll-up for parent Objective after deletion
      if (parentId) {
        await this.okrProgressService.refreshObjectiveProgressCascade(parentId);
      }

      return { id };
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

  // NOTE: Reporting / analytics / export methods moved to OkrReportingService in Phase 4
  // Removed methods: getOrgSummary, exportObjectivesCSV, getPillarsForOrg, getActiveCycleForOrg, getPillarCoverageForActiveCycle, getUserOwnedObjectives
}

