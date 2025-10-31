import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { OkrProgressService } from './okr-progress.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class ObjectiveService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private okrProgressService: OkrProgressService,
    private activityService: ActivityService,
  ) {}

  async findAll(_userId: string, workspaceId: string | undefined, userOrganizationId: string | null, pillarId?: string) {
    const where: any = {};

    // NOTE on organisation scoping:
    // - userOrganizationId === null       -> superuser (can READ all organisations; still cannot write anywhere).
    // - typeof userOrganizationId === 'string' and truthy -> normal user (can READ only that organisation).
    // - userOrganizationId is undefined or '' -> user with no organisation membership (GET /objectives returns []).
    // This enforces tenant isolation for reads.
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
    // Superuser is read-only auditor (cannot edit)
    if (userOrganizationId === null) {
      return false;
    }

    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      
      // Extract OKR's organizationId from resource context
      const okrOrganizationId = resourceContext.okr?.organizationId;
      
      // If the OKR has no organizationId, treat it as system/global data.
      // System/global OKRs are always read-only. No-one (including superusers) may edit them.
      // This is intentional. Changing this requires an explicit product decision.
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
   * Check if cycle lock prevents editing/deleting an objective.
   * Returns true if locked and user cannot bypass, false otherwise.
   * 
   * Cycle lock enforcement:
   * - If objective.cycle exists AND cycle.status === 'LOCKED' or 'ARCHIVED':
   *   - Superuser (userOrganizationId === null) => reject (read-only)
   *   - Require TENANT_OWNER or TENANT_ADMIN for that org
   *   - Else return true (locked)
   * - DRAFT and ACTIVE cycles allow normal edits
   */
  private async checkCycleLock(
    objectiveId: string,
    userId: string,
    userOrganizationId: string | null,
  ): Promise<{ locked: boolean; cycleName?: string }> {
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            status: true,
            organizationId: true,
          },
        },
      },
    });

    // No cycle assigned, no lock
    if (!objective?.cycle) {
      return { locked: false };
    }

    const cycle = objective.cycle;
    const cycleStatus = cycle.status;

    // DRAFT and ACTIVE cycles allow normal edits
    if (cycleStatus === 'DRAFT' || cycleStatus === 'ACTIVE') {
      return { locked: false };
    }

    // LOCKED or ARCHIVED cycles require admin override
    if (cycleStatus === 'LOCKED' || cycleStatus === 'ARCHIVED') {
      // Superuser is read-only, cannot bypass cycle lock
      if (userOrganizationId === null) {
        return { locked: true, cycleName: cycle.name };
      }

      // Check if user has TENANT_OWNER or TENANT_ADMIN role
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      const canEdit = await this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
      
      if (!canEdit) {
        return { locked: true, cycleName: cycle.name };
      }

      // User has admin role, can bypass cycle lock
      return { locked: false };
    }

    // Unknown status, default to not locked
    return { locked: false };
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
      
      // If the OKR has no organizationId, treat it as system/global data.
      // System/global OKRs are always read-only. No-one (including superusers) may edit them.
      // This is intentional. Changing this requires an explicit product decision.
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

    // CYCLE LOCK: Enforce cycle-level governance (stacks with publish lock)
    const cycleLock = await this.checkCycleLock(id, userId, userOrganizationId);
    if (cycleLock.locked) {
      // Superuser cannot bypass cycle lock (read-only)
      if (userOrganizationId === null) {
        throw new ForbiddenException(`This cycle (${cycleLock.cycleName || 'locked'}) is locked and can only be modified by admin roles`);
      }
      throw new ForbiddenException(`This cycle (${cycleLock.cycleName || 'locked'}) is locked and can only be modified by admin roles`);
    }

    // PUBLISH LOCK: Enforce edit restriction for published OKRs
    if (objective.isPublished === true) {
      // Superuser cannot edit even published OKRs (read-only)
      if (userOrganizationId === null) {
        throw new ForbiddenException('This OKR is published and can only be modified by admin roles');
      }
      
      // Check if user has elevated role (TENANT_OWNER or TENANT_ADMIN)
      const resourceContext = await buildResourceContextFromOKR(this.prisma, id);
      const canEdit = await this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
      
      if (!canEdit) {
        throw new ForbiddenException('This OKR is published and can only be modified by admin roles');
      }
    }
    // TODO: Future version will allow "propose change" workflow instead of hard blocking

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

      // CYCLE LOCK: Enforce cycle-level governance (stacks with publish lock)
      const cycleLock = await this.checkCycleLock(id, userId, userOrganizationId);
      if (cycleLock.locked) {
        // Superuser cannot bypass cycle lock (read-only)
        if (userOrganizationId === null) {
          throw new ForbiddenException(`This cycle (${cycleLock.cycleName || 'locked'}) is locked and can only be modified by admin roles`);
        }
        throw new ForbiddenException(`This cycle (${cycleLock.cycleName || 'locked'}) is locked and can only be modified by admin roles`);
      }

      // PUBLISH LOCK: Enforce delete restriction for published OKRs
      if (objective.isPublished === true) {
        // Superuser cannot delete even published OKRs (read-only)
        if (userOrganizationId === null) {
          throw new ForbiddenException('This OKR is published and can only be modified by admin roles');
        }
        
        // Check if user has elevated role (TENANT_OWNER or TENANT_ADMIN)
        const resourceContext = await buildResourceContextFromOKR(this.prisma, id);
        const canDelete = await this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
        
        if (!canDelete) {
          throw new ForbiddenException('This OKR is published and can only be modified by admin roles');
        }
      }
      // TODO: Future version will allow "propose change" workflow instead of hard blocking

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

  /**
   * Get organization-level summary statistics for analytics.
   * 
   * Early reporting endpoint - will likely move under /reports/* in a later iteration.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Summary object with total objectives, counts by status, and at-risk ratio
   */
  async getOrgSummary(userOrganizationId: string | null | undefined): Promise<{
    totalObjectives: number;
    byStatus: { [status: string]: number };
    atRiskRatio: number;
  }> {
    const where: any = {};

    // Tenant isolation: same logic as findAll()
    if (userOrganizationId === null) {
      // Superuser: aggregate across ALL organisations
    } else if (userOrganizationId && userOrganizationId !== '') {
      where.organizationId = userOrganizationId;
    } else {
      // User has no org → return empty summary
      return {
        totalObjectives: 0,
        byStatus: {},
        atRiskRatio: 0,
      };
    }

    // Get all objectives with their status
    const objectives = await this.prisma.objective.findMany({
      where,
      select: {
        status: true,
      },
    });

    const totalObjectives = objectives.length;
    const byStatus: { [status: string]: number } = {};
    let atRiskCount = 0;

    // Count by status
    for (const obj of objectives) {
      const status = obj.status || 'ON_TRACK';
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status === 'AT_RISK') {
        atRiskCount++;
      }
    }

    // Calculate at-risk ratio (0-1 float)
    const atRiskRatio = totalObjectives > 0 ? atRiskCount / totalObjectives : 0;

    return {
      totalObjectives,
      byStatus,
      atRiskRatio,
    };
  }

  /**
   * Export objectives and key results to CSV format
   * 
   * Early export MVP - exports all objectives visible to the caller with their key results flattened.
   * Each row represents one key result (objectives with multiple KRs appear multiple times).
   * Objectives with no KRs appear once with blank KR columns.
   * 
   * Tenant isolation: respects the same scoping rules as findAll().
   * - Superuser (userOrganizationId === null): includes all orgs
   * - Normal user (string): only their org
   * - No org (undefined/falsy): returns empty CSV with headers only
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns CSV string with headers
   */
  async exportObjectivesCSV(userOrganizationId: string | null | undefined): Promise<string> {
    const where: any = {};

    // Tenant isolation: same logic as findAll()
    if (userOrganizationId === null) {
      // Superuser: no org filter, return all OKRs
    } else if (userOrganizationId && userOrganizationId !== '') {
      where.organizationId = userOrganizationId;
    } else {
      // User has no org or invalid org → return empty CSV with headers only
      const headers = [
        'objectiveId',
        'title',
        'ownerName',
        'status',
        'progress',
        'isPublished',
        'period',
        'startDate',
        'endDate',
        'parentId',
        'orgId',
        'keyResultId',
        'keyResultTitle',
        'keyResultOwnerName',
        'keyResultStatus',
        'keyResultProgress',
        'keyResultTargetValue',
        'keyResultCurrentValue',
      ];
      return headers.join(',') + '\n';
    }

    // Fetch all objectives with their key results
    const objectives = await this.prisma.objective.findMany({
      where,
      include: {
        keyResults: {
          include: {
            keyResult: true,
          },
        },
        owner: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch all unique owner IDs for key results
    const krOwnerIds = new Set<string>();
    for (const obj of objectives) {
      if (obj.keyResults) {
        for (const objKr of obj.keyResults) {
          if (objKr.keyResult.ownerId) {
            krOwnerIds.add(objKr.keyResult.ownerId);
          }
        }
      }
    }

    // Fetch owner names for key results
    const krOwners = await this.prisma.user.findMany({
      where: {
        id: { in: Array.from(krOwnerIds) },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const krOwnerMap = new Map(krOwners.map(u => [u.id, u.name || '']));

    // Build CSV rows
    const rows: string[] = [];
    
    // CSV header row
    const headers = [
      'objectiveId',
      'title',
      'ownerName',
      'status',
      'progress',
      'isPublished',
      'period',
      'startDate',
      'endDate',
      'parentId',
      'orgId',
      'keyResultId',
      'keyResultTitle',
      'keyResultOwnerName',
      'keyResultStatus',
      'keyResultProgress',
      'keyResultTargetValue',
      'keyResultCurrentValue',
    ];
    rows.push(headers.join(','));

    // Helper function to escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Process each objective
    for (const obj of objectives) {
      const ownerName = obj.owner?.name || '';
      const objRowBase = [
        escapeCSV(obj.id),
        escapeCSV(obj.title),
        escapeCSV(ownerName),
        escapeCSV(obj.status),
        escapeCSV(obj.progress),
        escapeCSV(obj.isPublished),
        escapeCSV(obj.period),
        escapeCSV(obj.startDate?.toISOString().split('T')[0] || ''),
        escapeCSV(obj.endDate?.toISOString().split('T')[0] || ''),
        escapeCSV(obj.parentId),
        escapeCSV(obj.organizationId),
      ];

      // If objective has key results, create one row per KR
      if (obj.keyResults && obj.keyResults.length > 0) {
        for (const objKr of obj.keyResults) {
          const kr = objKr.keyResult;
          const krOwnerName = krOwnerMap.get(kr.ownerId) || '';
          const row = [
            ...objRowBase,
            escapeCSV(kr.id),
            escapeCSV(kr.title),
            escapeCSV(krOwnerName),
            escapeCSV(kr.status),
            escapeCSV(kr.progress),
            escapeCSV(kr.targetValue),
            escapeCSV(kr.currentValue),
          ];
          rows.push(row.join(','));
        }
      } else {
        // Objective with no KRs: one row with blank KR columns
        const row = [
          ...objRowBase,
          '', // keyResultId
          '', // keyResultTitle
          '', // keyResultOwnerName
          '', // keyResultStatus
          '', // keyResultProgress
          '', // keyResultTargetValue
          '', // keyResultCurrentValue
        ];
        rows.push(row.join(','));
      }
    }

    return rows.join('\n');
  }

  /**
   * Get strategic pillars for an organization.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns all pillars across all orgs
   * - Else if userOrganizationId is a non-empty string: return only pillars for that org
   * - Else (undefined/falsy): return []
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of pillars with id, name, color, description, and objectiveCount
   */
  async getPillarsForOrg(userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    name: string;
    color: string | null;
    description: string | null;
    objectiveCount: number;
  }>> {
    const where: any = {};

    // Tenant isolation: same logic as findAll()
    if (userOrganizationId === null) {
      // Superuser: no org filter, return all pillars across all orgs
    } else if (userOrganizationId && userOrganizationId !== '') {
      where.organizationId = userOrganizationId;
    } else {
      // User has no org or invalid org → return empty array
      return [];
    }

    const pillars = await this.prisma.strategicPillar.findMany({
      where,
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        _count: {
          select: {
            objectives: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform to include objectiveCount
    return pillars.map((pillar: {
      id: string;
      name: string;
      color: string | null;
      description: string | null;
      _count: { objectives: number };
    }) => ({
      id: pillar.id,
      name: pillar.name,
      color: pillar.color,
      description: pillar.description,
      objectiveCount: pillar._count.objectives,
    }));
  }

  /**
   * Get active cycles for an organization.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns all ACTIVE cycles across all orgs
   * - Else if userOrganizationId is a non-empty string: return ACTIVE cycle(s) for that org
   * - Else (undefined/falsy): return []
   * 
   * This is for UI to show "Current cycle" banner.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of active cycles with id, name, status, startDate, endDate
   */
  async getActiveCycleForOrg(userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    name: string;
    status: string;
    startDate: Date;
    endDate: Date;
    organizationId: string;
  }>> {
    const where: any = {
      status: 'ACTIVE',
    };

    // Tenant isolation: same logic as findAll()
    if (userOrganizationId === null) {
      // Superuser: no org filter, return all ACTIVE cycles across all orgs
    } else if (userOrganizationId && userOrganizationId !== '') {
      where.organizationId = userOrganizationId;
    } else {
      // User has no org or invalid org → return empty array
      return [];
    }

    const cycles = await this.prisma.cycle.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        organizationId: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return cycles;
  }

  /**
   * Get strategic pillar coverage for the active cycle.
   * 
   * Shows which pillars have active Objectives in the currently ACTIVE cycle.
   * Returns pillars with zero Objectives flagged for visibility.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns coverage for all orgs
   * - Else if userOrganizationId is a non-empty string: return coverage for that org
   * - Else (undefined/falsy): return []
   * 
   * TODO: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of pillars with id, name, and objectiveCountInActiveCycle
   */
  async getPillarCoverageForActiveCycle(userOrganizationId: string | null | undefined): Promise<Array<{
    pillarId: string;
    pillarName: string;
    objectiveCountInActiveCycle: number;
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    // Build where clause for cycles (tenant isolation)
    const cycleWhere: any = {
      status: 'ACTIVE',
    };
    if (userOrganizationId !== null) {
      // Normal user: only their org
      cycleWhere.organizationId = userOrganizationId;
    }
    // Superuser (null): no filter, see all orgs

    // Get active cycle(s) for this org
    const activeCycles = await this.prisma.cycle.findMany({
      where: cycleWhere,
      select: {
        id: true,
        organizationId: true,
      },
    });

    // If no active cycles, return empty array
    if (activeCycles.length === 0) {
      return [];
    }

    // Build where clause for pillars (tenant isolation)
    const pillarWhere: any = {};
    if (userOrganizationId !== null) {
      // Normal user: only their org
      pillarWhere.organizationId = userOrganizationId;
    }
    // Superuser (null): no filter, see all orgs

    // Get all pillars in scope
    const pillars = await this.prisma.strategicPillar.findMany({
      where: pillarWhere,
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // For each pillar, count Objectives in active cycle(s)
    const cycleIds = activeCycles.map((c: { id: string }) => c.id);
    const coverage = await Promise.all(
      pillars.map(async (pillar: { id: string; name: string }) => {
        // Count Objectives where:
        // - pillarId matches this pillar
        // - cycleId is in active cycle(s)
        const objectiveCount = await this.prisma.objective.count({
          where: {
            pillarId: pillar.id,
            cycleId: {
              in: cycleIds,
            },
          },
        });

        return {
          pillarId: pillar.id,
          pillarName: pillar.name,
          objectiveCountInActiveCycle: objectiveCount,
        };
      })
    );

    return coverage;
  }

  /**
   * Get Objectives owned by a specific user.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns all Objectives owned by userId across all orgs
   * - Else if userOrganizationId is a non-empty string: return only Objectives owned by userId in that org
   * - Else (undefined/falsy): return []
   * 
   * @param userId - The user ID to filter by (ownerId)
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of Objectives with id, title, status, progress, isPublished, cycle status, pillar info, team/workspace names
   */
  async getUserOwnedObjectives(userId: string, userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    isPublished: boolean;
    cycleStatus: string | null;
    pillar: { id: string; name: string } | null;
    teamName: string | null;
    workspaceName: string | null;
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    const where: any = {
      ownerId: userId,
    };

    // Tenant isolation: filter by org
    if (userOrganizationId !== null) {
      // Normal user: only their org
      where.organizationId = userOrganizationId;
    }
    // Superuser (null): no org filter, see all orgs

    const objectives = await this.prisma.objective.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        isPublished: true,
        cycle: {
          select: {
            status: true,
          },
        },
        pillar: {
          select: {
            id: true,
            name: true,
          },
        },
        team: {
          select: {
            name: true,
          },
        },
        workspace: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform to match return type
    return objectives.map((obj) => ({
      id: obj.id,
      title: obj.title,
      status: obj.status,
      progress: obj.progress,
      isPublished: obj.isPublished,
      cycleStatus: obj.cycle?.status || null,
      pillar: obj.pillar,
      teamName: obj.team?.name || null,
      workspaceName: obj.workspace?.name || null,
    }));
  }
}

