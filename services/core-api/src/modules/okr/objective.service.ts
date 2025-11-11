import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { OkrProgressService } from './okr-progress.service';
import { ActivityService } from '../activity/activity.service';
import { OkrTenantGuard } from './tenant-guard';
import { OkrGovernanceService } from './okr-governance.service';
import { AuditLogService } from '../audit/audit-log.service';
import { OkrStateTransitionService } from './okr-state-transition.service';
import { calculateProgress } from '@okr-nexus/utils';

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
    private auditLogService: AuditLogService,
    private stateTransitionService: OkrStateTransitionService,
  ) {}

  async findAll(_userId: string, workspaceId: string | undefined, userTenantId: string | null, pillarId?: string) {
    const where: any = {};

    // Tenant isolation: use OkrTenantGuard to build where clause
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userTenantId);
    if (orgFilter === null && userTenantId !== null) {
      // User has no org or invalid org → return empty array
      return [];
    }
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
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
          select: {
            id: true,
            weight: true,
            keyResult: {
              select: {
                id: true,
                title: true,
                status: true,
                progress: true,
                startValue: true,
                targetValue: true,
                currentValue: true,
                unit: true,
                ownerId: true,
                tenantId: true,
                visibilityLevel: true,
                isPublished: true,
                state: true,
                checkInCadence: true,
                cycleId: true,
                startDate: true,
                endDate: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        team: true,
        tenant: true,
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

  async findById(id: string, userTenantId?: string | null | undefined) {
    const objective = await this.prisma.objective.findUnique({
      where: { id },
      include: {
        keyResults: {
          select: {
            id: true,
            weight: true,
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
        tenant: true,
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

    // Tenant isolation: verify objective belongs to caller's tenant (defense-in-depth)
    // Note: This is in addition to RBAC permission checks (canView) in the controller
    if (userTenantId !== undefined) {
      if (userTenantId === null) {
        // SUPERUSER: can see any objective (read-only)
        return objective;
      }

      if (userTenantId === '' || objective.tenantId !== userTenantId) {
        // Normal user: verify objective belongs to caller's tenant
        // Don't leak existence - return not found
        throw new NotFoundException(`Objective with ID ${id} not found`);
      }
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
  async canEdit(userId: string, objectiveId: string, userTenantId: string | null): Promise<boolean> {
    // Tenant isolation: superuser is read-only
    if (userTenantId === null) {
      console.log('[OBJECTIVE SERVICE] canEdit: Superuser is read-only', { userId, objectiveId });
      return false;
    }

    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      
      // Extract OKR's tenantId from resource context
      const okrOrganizationId = resourceContext.okr?.tenantId;
      
      console.log('[OBJECTIVE SERVICE] canEdit: Checking permissions', {
        userId,
        objectiveId,
        userTenantId,
        okrTenantId: okrOrganizationId,
        isPublished: resourceContext.okr?.isPublished,
        ownerId: resourceContext.okr?.ownerId,
      });
      
      // Tenant isolation: verify org match (throws if mismatch or system/global)
      try {
        OkrTenantGuard.assertSameTenant(okrOrganizationId, userTenantId);
      } catch (error) {
        console.log('[OBJECTIVE SERVICE] canEdit: Tenant mismatch', {
          okrTenantId: okrOrganizationId,
          userTenantId,
          error: (error as Error).message,
        });
        return false;
      }
      
      // Build user context to check roles
      const userContext = await this.rbacService.buildUserContext(userId, false);
      console.log('[OBJECTIVE SERVICE] canEdit: User context', {
        userId,
        isSuperuser: userContext.isSuperuser,
        tenantRoles: Array.from(userContext.tenantRoles.entries()),
        okrTenantId: okrOrganizationId,
      });
      
      const canEdit = this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
      console.log('[OBJECTIVE SERVICE] canEdit: RBAC result', { canEdit, userId, objectiveId });
      
      return canEdit;
    } catch (error) {
      console.error('[OBJECTIVE SERVICE] canEdit: Error', {
        userId,
        objectiveId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return false;
    }
  }

  // Governance moved to OkrGovernanceService (Phase 3)

  /**
   * Check if user can delete a specific OKR
   */
  async canDelete(userId: string, objectiveId: string, userTenantId: string | null): Promise<boolean> {
    // Tenant isolation: superuser is read-only
    if (userTenantId === null) {
      return false;
    }

    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      
      // Extract OKR's tenantId from resource context
      const okrOrganizationId = resourceContext.okr?.tenantId;
      
      // Tenant isolation: verify org match (throws if mismatch or system/global)
      try {
        OkrTenantGuard.assertSameTenant(okrOrganizationId, userTenantId);
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
        select: { tenantId: true },
      });
      if (!workspace) return false;
      
      const resourceContext = {
        tenantId: workspace.tenantId,
        workspaceId,
        teamId: null,
      };
      return this.rbacService.canPerformAction(userId, 'create_okr', resourceContext);
    } catch {
      return false;
    }
  }

  async create(data: any, _userId: string, userTenantId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId);

    // Validate required fields
    if (!data.ownerId) {
      throw new BadRequestException('ownerId is required');
    }

    // Reject hardcoded/invalid values
    if (data.ownerId === 'temp-user' || data.ownerId === 'default') {
      throw new BadRequestException('Invalid ownerId: Please select a valid owner');
    }

    // At least one of tenantId, workspaceId, or teamId must be set
    if (!data.tenantId && !data.workspaceId && !data.teamId) {
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

    // Validate alignment with parent Objective if parentId is provided
    if (data.parentId) {
      await this.validateAlignment(
        {
          startDate: startDate,
          endDate: endDate,
          cycleId: data.cycleId,
        },
        data.parentId,
        userTenantId,
      );
    }

    // Validate owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: data.ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`User with ID ${data.ownerId} not found`);
    }

    // Validate organization if provided
    if (data.tenantId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: data.tenantId },
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${data.tenantId} not found`);
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

    // Validate visibility level: reject legacy deprecated values
    const legacyVisibilityLevels = ['WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY'];
    if (data.visibilityLevel && legacyVisibilityLevels.includes(data.visibilityLevel)) {
      throw new BadRequestException(
        `Legacy visibility level '${data.visibilityLevel}' is no longer supported. Please use 'PUBLIC_TENANT' or 'PRIVATE' instead.`
      );
    }

    // Validate visibility level permissions
    if (data.visibilityLevel === 'PRIVATE') {
      // Only TENANT_ADMIN or TENANT_OWNER can create PRIVATE OKRs
      if (!data.tenantId) {
        throw new BadRequestException('Organization ID is required for PRIVATE visibility');
      }

      try {
        const resourceContext = {
          tenantId: data.tenantId,
          workspaceId: data.workspaceId || null,
          teamId: data.teamId || null,
        };
        const canEdit = await this.rbacService.canPerformAction(_userId, 'edit_okr', resourceContext);
        if (!canEdit) {
          throw new ForbiddenException('Only tenant administrators can create PRIVATE OKRs');
        }
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        // If RBAC check fails, conservatively deny
        throw new ForbiddenException('Only tenant administrators can create PRIVATE OKRs');
      }
    }

    // Validate cycle lock if cycleId is provided
    if (data.cycleId) {
      try {
        const cycle = await this.prisma.cycle.findUnique({
          where: { id: data.cycleId },
          select: { status: true, tenantId: true },
        });

        if (cycle) {
          // Enforce tenant isolation for cycle
          if (cycle.tenantId && userTenantId !== null) {
            OkrTenantGuard.assertSameTenant(cycle.tenantId, userTenantId);
          }

          // If cycle is LOCKED or ARCHIVED, only admins can create
          if (cycle.status === 'LOCKED' || cycle.status === 'ARCHIVED') {
            const resourceContext = {
              tenantId: cycle.tenantId || data.tenantId || '',
              workspaceId: data.workspaceId || null,
              teamId: data.teamId || null,
            };
            const canEdit = await this.rbacService.canPerformAction(_userId, 'edit_okr', resourceContext);
            if (!canEdit) {
              throw new ForbiddenException(
                `This cycle is locked or archived and can only be modified by admin roles`
              );
            }
          }
        }
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        // If cycle lookup fails, don't block creation (cycle might not exist yet)
      }
    }

    // Set initial state if not provided: calculate from status and isPublished
    if (data.state === undefined) {
      const status = data.status || 'ON_TRACK';
      const isPublished = data.isPublished || false;
      data.state = this.stateTransitionService.calculateObjectiveStateFromLegacy(status, isPublished);
    }

    const createdObjective = await this.prisma.objective.create({
      data,
      include: {
        keyResults: true,
      },
    });

    // Log activity for creation with full entity snapshot
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: createdObjective.id,
      userId: _userId,
      tenantId: createdObjective.tenantId!,
      action: 'CREATED',
      metadata: {
        before: null, // No before state for creation
        after: {
          id: createdObjective.id,
          title: createdObjective.title,
          description: createdObjective.description,
          tenantId: createdObjective.tenantId,
          workspaceId: createdObjective.workspaceId,
          teamId: createdObjective.teamId,
          pillarId: createdObjective.pillarId,
          cycleId: createdObjective.cycleId,
          ownerId: createdObjective.ownerId,
          parentId: createdObjective.parentId,
          startDate: createdObjective.startDate,
          endDate: createdObjective.endDate,
          status: createdObjective.status,
          progress: createdObjective.progress,
          visibilityLevel: createdObjective.visibilityLevel,
          isPublished: createdObjective.isPublished,
          state: createdObjective.state,
          positionX: createdObjective.positionX,
          positionY: createdObjective.positionY,
          createdAt: createdObjective.createdAt,
          updatedAt: createdObjective.updatedAt,
        },
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for objective creation:', err);
    });

    // Log audit entry for objective creation
    await this.auditLogService.record({
      actorUserId: _userId,
      action: 'objective_created',
      targetType: 'OKR',
      targetId: createdObjective.id,
      tenantId: createdObjective.tenantId || null,
      metadata: {
        title: createdObjective.title,
        ownerId: createdObjective.ownerId,
        cycleId: createdObjective.cycleId,
        isPublished: createdObjective.isPublished,
        visibilityLevel: createdObjective.visibilityLevel,
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log audit entry for objective creation:', err);
    });

    // If Objective has a parent, trigger progress and status roll-up for parent
    if (data.parentId) {
      await this.okrProgressService.refreshObjectiveProgressAndStatusCascade(data.parentId);
    }

    return createdObjective;
  }

  /**
   * W5.M1: Composite OKR Creation
   * 
   * Atomically creates an Objective and its Key Results with validation, RBAC, governance, and AuditLog.
   * 
   * @param objectiveData - Objective data
   * @param keyResultsData - Array of Key Result data
   * @param _userId - User ID creating the OKR
   * @param userTenantId - User's organization ID (null for SUPERUSER)
   * @returns Created objective with key result IDs
   */
  async createComposite(
    objectiveData: {
      title: string;
      description?: string;
      ownerUserId: string;
      cycleId: string;
      visibilityLevel: 'PUBLIC_TENANT' | 'PRIVATE';
      whitelistUserIds?: string[];
      parentId?: string;
    },
    keyResultsData: Array<{
      title: string;
      metricType: 'NUMERIC' | 'PERCENT' | 'BOOLEAN' | 'CUSTOM';
      targetValue: number | string | boolean | null;
      ownerUserId: string;
      updateCadence?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
      startValue?: number;
      unit?: string;
    }>,
    _userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId);

    // Validate required fields
    if (!objectiveData.title || objectiveData.title.trim() === '') {
      throw new BadRequestException('Objective title is required');
    }

    if (!objectiveData.ownerUserId) {
      throw new BadRequestException('ownerUserId is required');
    }

    if (!objectiveData.cycleId) {
      throw new BadRequestException('cycleId is required');
    }

    if (!userTenantId) {
      throw new BadRequestException('tenantId is required');
    }

    // Validate owner exists and is in same tenant
    const owner = await this.prisma.user.findUnique({
      where: { id: objectiveData.ownerUserId },
      include: {
        roleAssignments: {
          where: {
            scopeType: 'TENANT',
            scopeId: userTenantId,
          },
        },
      },
    });

    if (!owner) {
      throw new NotFoundException(`User with ID ${objectiveData.ownerUserId} not found`);
    }

    // Validate cycle exists and user has access
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: objectiveData.cycleId },
      select: { id: true, status: true, tenantId: true, startDate: true, endDate: true },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${objectiveData.cycleId} not found`);
    }

    // Enforce tenant isolation for cycle
    OkrTenantGuard.assertSameTenant(cycle.tenantId, userTenantId);

    // Governance: Check cycle lock
    if (cycle.status === 'LOCKED' || cycle.status === 'ARCHIVED') {
      const resourceContext = {
        tenantId: userTenantId,
        workspaceId: null,
        teamId: null,
      };
      const canEdit = await this.rbacService.canPerformAction(_userId, 'edit_okr', resourceContext);
      if (!canEdit) {
        throw new ForbiddenException(
          `This cycle is ${cycle.status.toLowerCase()} and can only be modified by admin roles`
        );
      }
    }

    // RBAC: Check if user can create OKRs
    const resourceContext = {
      tenantId: userTenantId,
      workspaceId: null,
      teamId: null,
    };
    const canCreate = await this.rbacService.canPerformAction(_userId, 'create_okr', resourceContext);
    if (!canCreate) {
      throw new ForbiddenException('You do not have permission to create OKRs in this scope');
    }

    // Validate visibility level: reject legacy deprecated values
    if (objectiveData.visibilityLevel) {
      const legacyVisibilityLevels = ['WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY'];
      if (legacyVisibilityLevels.includes(objectiveData.visibilityLevel)) {
        throw new BadRequestException(
          `Legacy visibility level '${objectiveData.visibilityLevel}' is no longer supported. Please use 'PUBLIC_TENANT' or 'PRIVATE' instead.`
        );
      }
    }

    // Validate visibility level permissions
    if (objectiveData.visibilityLevel === 'PRIVATE') {
      // Only TENANT_ADMIN or TENANT_OWNER can create PRIVATE OKRs
      const canEdit = await this.rbacService.canPerformAction(_userId, 'edit_okr', resourceContext);
      if (!canEdit) {
        throw new ForbiddenException('Only tenant administrators can create PRIVATE OKRs');
      }

      // Validate whitelist (required for PRIVATE)
      if (!objectiveData.whitelistUserIds || objectiveData.whitelistUserIds.length === 0) {
        throw new BadRequestException('whitelistUserIds is required when visibilityLevel is PRIVATE');
      }

      // Validate all whitelist users are in same tenant
      const whitelistUsers = await this.prisma.user.findMany({
        where: {
          id: { in: objectiveData.whitelistUserIds },
        },
        include: {
          roleAssignments: {
            where: {
              scopeType: 'TENANT',
              scopeId: userTenantId,
            },
          },
        },
      });

      if (whitelistUsers.length !== objectiveData.whitelistUserIds.length) {
        throw new BadRequestException('All whitelist users must belong to the same tenant');
      }
    }

    // Validate parent objective if provided
    if (objectiveData.parentId) {
      const parentObjective = await this.prisma.objective.findUnique({
        where: { id: objectiveData.parentId },
        select: { id: true, tenantId: true },
      });

      if (!parentObjective) {
        throw new NotFoundException(`Parent objective with ID ${objectiveData.parentId} not found`);
      }

      // Enforce tenant isolation for parent
      OkrTenantGuard.assertSameTenant(parentObjective.tenantId, userTenantId);
    }

    // Validate Key Results
    // Minimum: at least one KR required for publish (allow draft with zero KRs)
    // For now, we'll require at least one KR (draft mode can be added later)
    if (!keyResultsData || keyResultsData.length === 0) {
      throw new BadRequestException('At least one Key Result is required');
    }

    // Validate each KR
    for (const kr of keyResultsData) {
      if (!kr.title || kr.title.trim() === '') {
        throw new BadRequestException('Key Result title is required');
      }

      if (!kr.ownerUserId) {
        throw new BadRequestException('Key Result ownerUserId is required');
      }

      // Validate KR owner exists and is in same tenant
      const krOwner = await this.prisma.user.findUnique({
        where: { id: kr.ownerUserId },
        include: {
          roleAssignments: {
            where: {
              scopeType: 'TENANT',
              scopeId: userTenantId,
            },
          },
        },
      });

      if (!krOwner) {
        throw new NotFoundException(`Key Result owner with ID ${kr.ownerUserId} not found`);
      }

      // KR ownership: Check if creator can assign owner (fall back to objective owner if not permitted)
      // For now, we'll allow assignment if user can create OKRs (can be refined later)
      // This matches the existing behavior in key-result.controller.ts
    }

    // Prepare objective data
    const objectiveCreateData: any = {
      title: objectiveData.title,
      description: objectiveData.description || null,
      ownerId: objectiveData.ownerUserId,
      cycleId: objectiveData.cycleId,
      tenantId: userTenantId,
      visibilityLevel: objectiveData.visibilityLevel,
      parentId: objectiveData.parentId || null,
      status: 'ON_TRACK',
      isPublished: true, // For now, always publish (draft mode can be added later)
      startDate: cycle.startDate || new Date(),
      endDate: cycle.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Default 90 days
    };

    // Store whitelist in organization metadata if PRIVATE
    if (objectiveData.visibilityLevel === 'PRIVATE' && objectiveData.whitelistUserIds) {
      // Update organization metadata to store whitelist
      // For now, we'll store it in a separate whitelist table if it exists
      // Or we can store it in objective metadata (if we add a metadata field)
      // For W5.M1, we'll keep it simple and validate but not store separately
      // (The visibility service already handles whitelist lookup from organization metadata)
    }

    // Use transaction to create Objective and Key Results atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // Create Objective
      const createdObjective = await tx.objective.create({
        data: objectiveCreateData,
      });

      // Create Key Results
      const createdKeyResults = [];
      for (const krData of keyResultsData) {
        // Prepare KR data
        const krCreateData: any = {
          title: krData.title,
          ownerId: krData.ownerUserId,
          metricType: krData.metricType,
          targetValue: krData.targetValue,
          startValue: krData.startValue ?? 0,
          currentValue: krData.startValue ?? 0,
          unit: krData.unit || null,
          status: 'ON_TRACK',
          cycleId: objectiveData.cycleId, // Sync cycleId from parent Objective
          tenantId: userTenantId!, // Use userTenantId (already validated, cannot be null/undefined here)
        };

        // Calculate initial progress
        if (krCreateData.currentValue !== undefined && krCreateData.startValue !== undefined && krCreateData.targetValue !== undefined && krCreateData.metricType) {
          krCreateData.progress = calculateProgress(
            krCreateData.startValue,
            krCreateData.currentValue,
            krCreateData.targetValue,
            krCreateData.metricType,
          );
        }

        const createdKr = await tx.keyResult.create({
          data: krCreateData,
        });

        // Create junction table entry
        await tx.objectiveKeyResult.create({
          data: {
            objectiveId: createdObjective.id,
            keyResultId: createdKr.id,
            tenantId: userTenantId!,
          },
        });

        createdKeyResults.push(createdKr);
      }

      return {
        objective: createdObjective,
        keyResults: createdKeyResults,
      };
    });

    // Log audit entries after transaction (don't fail if audit logging fails)
    for (const kr of result.keyResults) {
      await this.auditLogService.record({
        actorUserId: _userId,
        action: 'key_result_created',
        targetType: 'OKR',
        targetId: kr.id,
        tenantId: userTenantId,
        metadata: {
          title: kr.title,
          objectiveId: result.objective.id,
          ownerId: kr.ownerId,
        },
      }).catch(err => {
        console.error('Failed to log audit entry for key result creation:', err);
      });
    }

    await this.auditLogService.record({
      actorUserId: _userId,
      action: 'objective_created',
      targetType: 'OKR',
      targetId: result.objective.id,
      tenantId: userTenantId,
      metadata: {
        title: result.objective.title,
        ownerId: result.objective.ownerId,
        cycleId: result.objective.cycleId,
        isPublished: result.objective.isPublished,
        visibilityLevel: result.objective.visibilityLevel,
        keyResultIds: result.keyResults.map(kr => kr.id),
      },
    }).catch(err => {
      console.error('Failed to log audit entry for objective creation:', err);
    });

    // Trigger progress roll-up for the Objective (don't fail if this fails)
    await this.okrProgressService.refreshObjectiveProgressCascade(result.objective.id).catch(err => {
      console.error('Failed to refresh objective progress:', err);
    });

    // Return response matching the API contract
    return {
      objectiveId: result.objective.id,
      keyResultIds: result.keyResults.map(kr => kr.id),
      publishState: result.objective.isPublished ? 'PUBLISHED' : 'DRAFT',
      status: result.objective.status,
      visibilityLevel: result.objective.visibilityLevel,
    };
  }

  async update(id: string, data: any, userId: string, userTenantId: string | null) {
    // Verify objective exists and user has permission (already checked in controller)
    // Get full entity snapshot BEFORE update for audit logging
    const objectiveBefore = await this.prisma.objective.findUnique({
      where: { id },
    });

    if (!objectiveBefore) {
      throw new NotFoundException(`Objective with ID ${id} not found`);
    }

    // Extract key fields for governance checks
    const objective = {
      id: objectiveBefore.id,
      tenantId: objectiveBefore.tenantId,
      state: objectiveBefore.state,
      isPublished: objectiveBefore.isPublished, // Legacy support
      ownerId: objectiveBefore.ownerId,
      workspaceId: objectiveBefore.workspaceId,
      parentId: objectiveBefore.parentId,
      progress: objectiveBefore.progress,
      status: objectiveBefore.status,
      title: objectiveBefore.title,
    };

    // Calculate current state if not set (for backward compatibility)
    const currentState = objectiveBefore.state || 
      this.stateTransitionService.calculateObjectiveStateFromLegacy(
        objectiveBefore.status,
        objectiveBefore.isPublished
      );

    // Handle state transitions: if state is provided in update, validate transition
    if (data.state !== undefined) {
      this.stateTransitionService.assertObjectiveStateTransition(currentState, data.state);
    } else if (data.status !== undefined || data.isPublished !== undefined) {
      // If status or isPublished changed, calculate new state
      const newStatus = data.status !== undefined ? data.status : objectiveBefore.status;
      const newIsPublished = data.isPublished !== undefined ? data.isPublished : objectiveBefore.isPublished;
      const calculatedState = this.stateTransitionService.calculateObjectiveStateFromLegacy(newStatus, newIsPublished);
      
      // Validate transition if state would change
      if (calculatedState !== currentState) {
        this.stateTransitionService.assertObjectiveStateTransition(currentState, calculatedState);
        data.state = calculatedState;
      }
    }

    // Governance: Check all locks (cycle lock + publish lock) via OkrGovernanceService
    await this.okrGovernanceService.checkAllLocksForObjective({
      objective: {
        id: objective.id,
        state: currentState,
        isPublished: objective.isPublished, // Legacy support
      },
      actingUser: {
        id: userId,
        tenantId: userTenantId,
      },
      rbacService: this.rbacService,
    });
    // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
    // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking

    // Validate visibility level: reject legacy deprecated values
    if (data.visibilityLevel) {
      const legacyVisibilityLevels = ['WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY'];
      if (legacyVisibilityLevels.includes(data.visibilityLevel)) {
        throw new BadRequestException(
          `Legacy visibility level '${data.visibilityLevel}' is no longer supported. Please use 'PUBLIC_TENANT' or 'PRIVATE' instead.`
        );
      }
    }

    // Validate alignment with parent Objective if parentId is being set or changed
    const parentIdToValidate = data.parentId !== undefined ? data.parentId : objectiveBefore.parentId;
    if (parentIdToValidate) {
      const childData = {
        startDate: data.startDate !== undefined ? new Date(data.startDate) : objectiveBefore.startDate,
        endDate: data.endDate !== undefined ? new Date(data.endDate) : objectiveBefore.endDate,
        cycleId: data.cycleId !== undefined ? data.cycleId : objectiveBefore.cycleId,
      };
      await this.validateAlignment(childData, parentIdToValidate, userTenantId);
    }

    // Additional validation: prevent changing ownership without permission
    if (data.ownerId && data.ownerId !== objective.ownerId) {
      // Only allow if user can manage workspace or tenant
      let canManage = false;
      
      if (objective.workspaceId) {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: objective.workspaceId },
          select: { tenantId: true },
        });
        if (workspace) {
          const resourceContext = {
            tenantId: workspace.tenantId,
            workspaceId: objective.workspaceId,
            teamId: null,
          };
          canManage = await this.rbacService.canPerformAction(userId, 'manage_workspaces', resourceContext);
        }
      }
      
      if (!canManage && objective.tenantId) {
        const resourceContext = {
          tenantId: objective.tenantId,
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

    // Detect state changes
    const statusChanged = objectiveBefore.status !== updatedObjective.status;
    const stateChanged = (objectiveBefore.state || 
      this.stateTransitionService.calculateObjectiveStateFromLegacy(objectiveBefore.status, objectiveBefore.isPublished)) !== 
      (updatedObjective.state || 
      this.stateTransitionService.calculateObjectiveStateFromLegacy(updatedObjective.status, updatedObjective.isPublished));
    const publishStateChanged = objectiveBefore.isPublished !== updatedObjective.isPublished;
    const wasPublish = objectiveBefore.isPublished === false && updatedObjective.isPublished === true;
    const wasUnpublish = objectiveBefore.isPublished === true && updatedObjective.isPublished === false;

    // Determine action type based on state changes
    let action = 'UPDATED';
    const finalState = updatedObjective.state || 
      this.stateTransitionService.calculateObjectiveStateFromLegacy(updatedObjective.status, updatedObjective.isPublished);
    
    if (stateChanged) {
      if (finalState === 'COMPLETED') {
        action = 'COMPLETED';
      } else if (finalState === 'CANCELLED') {
        action = 'CANCELLED';
      } else if (finalState === 'PUBLISHED' && currentState === 'DRAFT') {
        action = 'PUBLISHED'; // New action type for publish transition
      } else if (finalState === 'DRAFT' && currentState === 'PUBLISHED') {
        action = 'UNPUBLISHED'; // New action type for unpublish transition
      }
    } else if (statusChanged && updatedObjective.status === 'COMPLETED') {
      action = 'COMPLETED';
    } else if (statusChanged && updatedObjective.status === 'CANCELLED') {
      action = 'CANCELLED';
    }

    // Log activity for state transition if state changed
    if (stateChanged) {
      await this.activityService.createActivity({
        entityType: 'OBJECTIVE',
        entityId: updatedObjective.id,
        userId: userId,
        tenantId: updatedObjective.tenantId!,
        action: action,
        metadata: {
          stateTransition: {
            from: currentState,
            to: finalState,
          },
          wasPublish: wasPublish,
          wasUnpublish: wasUnpublish,
          statusChanged: statusChanged,
          publishStateChanged: publishStateChanged,
        },
      }).catch(err => {
        console.error('Failed to log activity for state transition:', err);
      });

      // Emit separate STATE_CHANGE activity alongside the transition-specific action
      await this.activityService.createActivity({
        entityType: 'OBJECTIVE',
        entityId: updatedObjective.id,
        userId: userId,
        tenantId: updatedObjective.tenantId!,
        action: 'STATE_CHANGE',
        metadata: {
          from: currentState,
          to: finalState,
        },
      }).catch(err => {
        console.error('Failed to log STATE_CHANGE activity:', err);
      });
    }

    // Log activity for update with full entity snapshots
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: updatedObjective.id,
      userId: userId,
      tenantId: updatedObjective.tenantId!,
      action: action,
      metadata: {
        wasPublish: wasPublish,
        wasUnpublish: wasUnpublish,
        statusChanged: statusChanged,
        publishStateChanged: publishStateChanged,
        stateChanged: stateChanged,
        before: {
          id: objectiveBefore.id,
          title: objectiveBefore.title,
          description: objectiveBefore.description,
          tenantId: objectiveBefore.tenantId,
          workspaceId: objectiveBefore.workspaceId,
          teamId: objectiveBefore.teamId,
          pillarId: objectiveBefore.pillarId,
          cycleId: objectiveBefore.cycleId,
          ownerId: objectiveBefore.ownerId,
          parentId: objectiveBefore.parentId,
          startDate: objectiveBefore.startDate,
          endDate: objectiveBefore.endDate,
          status: objectiveBefore.status,
          progress: objectiveBefore.progress,
          visibilityLevel: objectiveBefore.visibilityLevel,
          isPublished: objectiveBefore.isPublished,
          state: objectiveBefore.state || currentState,
          positionX: objectiveBefore.positionX,
          positionY: objectiveBefore.positionY,
          createdAt: objectiveBefore.createdAt,
          updatedAt: objectiveBefore.updatedAt,
        },
        after: {
          id: updatedObjective.id,
          title: updatedObjective.title,
          description: updatedObjective.description,
          tenantId: updatedObjective.tenantId,
          workspaceId: updatedObjective.workspaceId,
          teamId: updatedObjective.teamId,
          pillarId: updatedObjective.pillarId,
          cycleId: updatedObjective.cycleId,
          ownerId: updatedObjective.ownerId,
          parentId: updatedObjective.parentId,
          startDate: updatedObjective.startDate,
          endDate: updatedObjective.endDate,
          status: updatedObjective.status,
          progress: updatedObjective.progress,
          visibilityLevel: updatedObjective.visibilityLevel,
          isPublished: updatedObjective.isPublished,
          state: updatedObjective.state || finalState,
          positionX: updatedObjective.positionX,
          positionY: updatedObjective.positionY,
          createdAt: updatedObjective.createdAt,
          updatedAt: updatedObjective.updatedAt,
        },
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for objective update:', err);
    });

    // If parentId changed or Objective itself changed, trigger roll-up
    if (data.parentId !== undefined || data.children !== undefined) {
      await this.okrProgressService.refreshObjectiveProgressAndStatusCascade(id);
      // If parent changed, also update old and new parents
      if (objective.parentId && objective.parentId !== data.parentId) {
        await this.okrProgressService.refreshObjectiveProgressAndStatusCascade(objective.parentId);
      }
      if (data.parentId && data.parentId !== objective.parentId) {
        await this.okrProgressService.refreshObjectiveProgressAndStatusCascade(data.parentId);
      }
    }

    // If status changed, trigger status roll-up for parent (if exists)
    if (statusChanged && updatedObjective.parentId) {
      await this.okrProgressService.recalculateObjectiveStatus(updatedObjective.parentId);
    }

    return updatedObjective;
  }

  async delete(id: string, userId: string, userTenantId: string | null) {
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
          tenantId: userTenantId,
        },
        rbacService: this.rbacService,
      });
      // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
      // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking

      // Get parent ID before deletion (for progress roll-up)
      const parentId = objective.parentId;

      // Log activity for deletion (before deletion) with full entity snapshot
      await this.activityService.createActivity({
        entityType: 'OBJECTIVE',
        entityId: objective.id,
        userId: userId,
        tenantId: objective.tenantId!,
        action: 'DELETED',
        metadata: {
          before: {
            id: objective.id,
            title: objective.title,
            description: objective.description,
            tenantId: objective.tenantId,
            workspaceId: objective.workspaceId,
            teamId: objective.teamId,
            pillarId: objective.pillarId,
            cycleId: objective.cycleId,
            ownerId: objective.ownerId,
            parentId: objective.parentId,
            startDate: objective.startDate,
            endDate: objective.endDate,
            status: objective.status,
            progress: objective.progress,
            visibilityLevel: objective.visibilityLevel,
            isPublished: objective.isPublished,
            positionX: objective.positionX,
            positionY: objective.positionY,
            createdAt: objective.createdAt,
            updatedAt: objective.updatedAt,
          },
          after: null, // No after state for deletion
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log activity for objective deletion:', err);
      });

      // Log audit entry for objective deletion
      await this.auditLogService.record({
        actorUserId: userId,
        action: 'objective_deleted',
        targetType: 'OKR',
        targetId: objective.id,
        tenantId: objective.tenantId || null,
        metadata: {
          title: objective.title,
          ownerId: objective.ownerId,
          cycleId: objective.cycleId,
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log audit entry for objective deletion:', err);
      });

      // Delete objective (cascades will handle related records)
      await this.prisma.objective.delete({
        where: { id },
      });

      // Trigger progress and status roll-up for parent Objective after deletion
      if (parentId) {
        await this.okrProgressService.refreshObjectiveProgressAndStatusCascade(parentId);
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
   * Validate alignment between child and parent Objectives.
   * 
   * Ensures:
   * - Child dates fall within parent date range: parent.startDate ≤ child.startDate ≤ child.endDate ≤ parent.endDate
   * - If both cycles are set, they must match: child.cycleId === parent.cycleId
   * 
   * @param childData - Child Objective data with startDate, endDate, cycleId
   * @param parentId - Parent Objective ID
   * @param userTenantId - User's tenant ID for tenant isolation check
   * @throws BadRequestException with code 'ALIGNMENT_DATE_OUT_OF_RANGE' or 'ALIGNMENT_CYCLE_MISMATCH'
   */
  private async validateAlignment(
    childData: { startDate: Date | string; endDate: Date | string; cycleId?: string | null },
    parentId: string,
    userTenantId: string | null | undefined,
  ): Promise<void> {
    // Load parent Objective
    const parent = await this.prisma.objective.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        cycleId: true,
        tenantId: true,
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent Objective with ID ${parentId} not found`);
    }

    // Enforce tenant isolation: parent must belong to user's tenant
    OkrTenantGuard.assertSameTenant(parent.tenantId, userTenantId);

    // Convert dates to Date objects if strings
    const parentStartDate = new Date(parent.startDate);
    const parentEndDate = new Date(parent.endDate);
    const childStartDate = new Date(childData.startDate);
    const childEndDate = new Date(childData.endDate);

    // Validate date alignment: parent.startDate ≤ child.startDate ≤ child.endDate ≤ parent.endDate
    if (childStartDate < parentStartDate) {
      throw new BadRequestException({
        message: `Child Objective start date (${childStartDate.toISOString().split('T')[0]}) must be on or after parent start date (${parentStartDate.toISOString().split('T')[0]})`,
        code: 'ALIGNMENT_DATE_OUT_OF_RANGE',
      });
    }

    if (childEndDate > parentEndDate) {
      throw new BadRequestException({
        message: `Child Objective end date (${childEndDate.toISOString().split('T')[0]}) must be on or before parent end date (${parentEndDate.toISOString().split('T')[0]})`,
        code: 'ALIGNMENT_DATE_OUT_OF_RANGE',
      });
    }

    // Validate cycle alignment: if both cycles are set, they must match
    if (childData.cycleId && parent.cycleId && childData.cycleId !== parent.cycleId) {
      throw new BadRequestException({
        message: `Child Objective cycle must match parent Objective cycle`,
        code: 'ALIGNMENT_CYCLE_MISMATCH',
      });
    }
  }

  /**
   * Update the weight of a Key Result link to an Objective.
   * 
   * Updates the weight field in the ObjectiveKeyResult junction table and triggers progress recalculation.
   * Emits Activity log on the Objective with UPDATED action.
   * 
   * @param objectiveId - The Objective ID
   * @param keyResultId - The Key Result ID
   * @param weight - The weight value (0.0-3.0, default 1.0)
   * @param userId - User ID performing the update
   * @param userTenantId - User's tenant ID for isolation check
   * @returns Updated junction record { objectiveId, keyResultId, weight }
   */
  async updateKeyResultWeight(
    objectiveId: string,
    keyResultId: string,
    weight: number,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Validate weight is finite number
    if (typeof weight !== 'number' || !isFinite(weight)) {
      throw new BadRequestException({
        message: 'Weight must be a finite number',
        code: 'INVALID_WEIGHT',
      });
    }

    // Validate weight range (0.0 to MAX_WEIGHT)
    const MAX_WEIGHT = parseFloat(process.env.OKR_MAX_LINK_WEIGHT || '3.0');
    if (weight < 0 || weight > MAX_WEIGHT) {
      throw new BadRequestException({
        message: `Weight must be between 0.0 and ${MAX_WEIGHT}`,
        code: 'INVALID_WEIGHT',
      });
    }

    // Load objective with tenantId for isolation check
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, tenantId: true },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Load key result with tenantId for isolation check
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: { id: true, tenantId: true },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Enforce tenant isolation: both Objective and KR must belong to user's tenant
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);
    OkrTenantGuard.assertSameTenant(keyResult.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, objectiveId, userTenantId ?? null);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Objective');
    }

    // Verify junction exists and get current weight
    const junction = await this.prisma.objectiveKeyResult.findUnique({
      where: {
        objectiveId_keyResultId: {
          objectiveId,
          keyResultId,
        },
      },
      select: {
        weight: true,
      },
    });

    if (!junction) {
      throw new NotFoundException({
        message: `Key Result ${keyResultId} is not linked to Objective ${objectiveId}`,
        code: 'LINK_NOT_FOUND',
      });
    }

    const prevWeight = junction.weight;
    const nextWeight = weight;

    // Skip update if weight hasn't changed
    if (prevWeight === nextWeight) {
      return {
        objectiveId,
        keyResultId,
        weight: prevWeight,
      };
    }

    // Update weight
    const updated = await this.prisma.objectiveKeyResult.update({
      where: {
        objectiveId_keyResultId: {
          objectiveId,
          keyResultId,
        },
      },
      data: { weight: nextWeight },
      select: {
        objectiveId: true,
        keyResultId: true,
        weight: true,
      },
    });

    // Emit Activity log on Objective with UPDATED action
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: objectiveId,
      userId: userId,
      tenantId: objective.tenantId!,
      action: 'UPDATED',
      metadata: {
        changedFields: ['weight'],
        link: {
          keyResultId,
          prev: prevWeight,
          next: nextWeight,
        },
      },
    }).catch(err => {
      console.error('Failed to log activity for weight update:', err);
    });

    // Trigger progress recalculation
    await this.okrProgressService.refreshObjectiveProgressCascade(objectiveId);

    return updated;
  }

  // ==========================================
  // Tags Management
  // ==========================================

  /**
   * Add a tag to an Objective
   */
  async addTag(
    objectiveId: string,
    tagId: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load objective with tenantId for isolation check
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, tenantId: true },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, objectiveId, userTenantId ?? null);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Objective');
    }

    // Verify tag exists and belongs to same tenant
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, tenantId: true, name: true },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${tagId} not found`);
    }

    OkrTenantGuard.assertSameTenant(tag.tenantId, userTenantId);

    // Check if tag already exists on objective
    const existing = await this.prisma.objectiveTag.findUnique({
      where: {
        tenantId_objectiveId_tagId: {
          tenantId: objective.tenantId!,
          objectiveId,
          tagId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException({
        message: `Tag "${tag.name}" is already assigned to this Objective`,
        code: 'DUPLICATE_TAG',
      });
    }

    // Create tag link
    const objectiveTag = await this.prisma.objectiveTag.create({
      data: {
        tenantId: objective.tenantId!,
        objectiveId,
        tagId,
        createdBy: userId,
      },
      include: {
        tag: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: objectiveId,
      userId: userId,
      tenantId: objective.tenantId!,
      action: 'TAG_ADDED',
      metadata: {
        tagId: tag.id,
        tagName: tag.name,
      },
    }).catch(err => {
      console.error('Failed to log activity for tag addition:', err);
    });

    return {
      id: objectiveTag.id,
      tag: objectiveTag.tag,
      createdAt: objectiveTag.createdAt,
    };
  }

  /**
   * Remove a tag from an Objective
   */
  async removeTag(
    objectiveId: string,
    tagId: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load objective with tenantId for isolation check
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, tenantId: true },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, objectiveId, userTenantId ?? null);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Objective');
    }

    // Load tag for activity log
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, name: true },
    });

    // Find and delete tag link
    const objectiveTag = await this.prisma.objectiveTag.findUnique({
      where: {
        tenantId_objectiveId_tagId: {
          tenantId: objective.tenantId!,
          objectiveId,
          tagId,
        },
      },
    });

    if (!objectiveTag) {
      throw new NotFoundException({
        message: `Tag is not assigned to this Objective`,
        code: 'TAG_NOT_FOUND',
      });
    }

    await this.prisma.objectiveTag.delete({
      where: { id: objectiveTag.id },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: objectiveId,
      userId: userId,
      tenantId: objective.tenantId!,
      action: 'TAG_REMOVED',
      metadata: {
        tagId: tag?.id || tagId,
        tagName: tag?.name || 'Unknown',
      },
    }).catch(err => {
      console.error('Failed to log activity for tag removal:', err);
    });

    return { success: true };
  }

  /**
   * List tags for an Objective
   */
  async listTags(
    objectiveId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load objective with tenantId for isolation check
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, tenantId: true },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);

    const tags = await this.prisma.objectiveTag.findMany({
      where: {
        objectiveId,
        tenantId: objective.tenantId!,
      },
      include: {
        tag: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return tags.map(ot => ({
      id: ot.tag.id,
      name: ot.tag.name,
      color: ot.tag.color,
      addedAt: ot.createdAt,
      addedBy: ot.createdBy,
    }));
  }

  // ==========================================
  // Contributors Management
  // ==========================================

  /**
   * Add a contributor to an Objective
   */
  async addContributor(
    objectiveId: string,
    userIdToAdd: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load objective with tenantId for isolation check
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, tenantId: true },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, objectiveId, userTenantId ?? null);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Objective');
    }

    // Verify user exists and belongs to same tenant (users don't have tenantId, but we can check via organization membership)
    const userToAdd = await this.prisma.user.findUnique({
      where: { id: userIdToAdd },
      select: { id: true, email: true, name: true },
    });

    if (!userToAdd) {
      throw new NotFoundException(`User with ID ${userIdToAdd} not found`);
    }

    // Check if contributor already exists
    const existing = await this.prisma.objectiveContributor.findUnique({
      where: {
        tenantId_objectiveId_userId: {
          tenantId: objective.tenantId!,
          objectiveId,
          userId: userIdToAdd,
        },
      },
    });

    if (existing) {
      throw new BadRequestException({
        message: `User is already a contributor to this Objective`,
        code: 'DUPLICATE_CONTRIBUTOR',
      });
    }

    // Create contributor link
    const contributor = await this.prisma.objectiveContributor.create({
      data: {
        tenantId: objective.tenantId!,
        objectiveId,
        userId: userIdToAdd,
        role: 'CONTRIBUTOR',
        createdBy: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: objectiveId,
      userId: userId,
      tenantId: objective.tenantId!,
      action: 'CONTRIBUTOR_ADDED',
      metadata: {
        userId: userIdToAdd,
        userEmail: userToAdd.email,
        userName: userToAdd.name,
      },
    }).catch(err => {
      console.error('Failed to log activity for contributor addition:', err);
    });

    return {
      id: contributor.id,
      user: contributor.user,
      role: contributor.role,
      addedAt: contributor.createdAt,
    };
  }

  /**
   * Remove a contributor from an Objective
   */
  async removeContributor(
    objectiveId: string,
    userIdToRemove: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load objective with tenantId for isolation check
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, tenantId: true },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, objectiveId, userTenantId ?? null);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Objective');
    }

    // Load user for activity log
    const userToRemove = await this.prisma.user.findUnique({
      where: { id: userIdToRemove },
      select: { id: true, email: true, name: true },
    });

    // Find and delete contributor link
    const contributor = await this.prisma.objectiveContributor.findUnique({
      where: {
        tenantId_objectiveId_userId: {
          tenantId: objective.tenantId!,
          objectiveId,
          userId: userIdToRemove,
        },
      },
    });

    if (!contributor) {
      throw new NotFoundException({
        message: `User is not a contributor to this Objective`,
        code: 'CONTRIBUTOR_NOT_FOUND',
      });
    }

    await this.prisma.objectiveContributor.delete({
      where: { id: contributor.id },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: objectiveId,
      userId: userId,
      tenantId: objective.tenantId!,
      action: 'CONTRIBUTOR_REMOVED',
      metadata: {
        userId: userIdToRemove,
        userEmail: userToRemove?.email || 'Unknown',
        userName: userToRemove?.name || 'Unknown',
      },
    }).catch(err => {
      console.error('Failed to log activity for contributor removal:', err);
    });

    return { success: true };
  }

  /**
   * List contributors for an Objective
   */
  async listContributors(
    objectiveId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load objective with tenantId for isolation check
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, tenantId: true },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);

    const contributors = await this.prisma.objectiveContributor.findMany({
      where: {
        objectiveId,
        tenantId: objective.tenantId!,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return contributors.map(c => ({
      id: c.id,
      user: c.user,
      role: c.role,
      addedAt: c.createdAt,
      addedBy: c.createdBy,
    }));
  }

  // ==========================================
  // Sponsor Management
  // ==========================================

  /**
   * Update sponsor for an Objective
   */
  async reviewObjective(
    objectiveId: string,
    dto: { confidence?: number; note?: string },
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Verify objective exists and user has permission
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: {
        id: true,
        tenantId: true,
        title: true,
        confidence: true,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Tenant isolation check
    OkrTenantGuard.assertSameTenant(
      objective.tenantId,
      userTenantId,
    );

    // Validate confidence if provided
    if (dto.confidence !== undefined) {
      if (dto.confidence < 0 || dto.confidence > 100) {
        throw new BadRequestException('Confidence must be between 0 and 100');
      }
    }

    // Get previous confidence for activity log (before update)
    const previousConfidence = objective.confidence ?? null;

    // Update objective with confidence and lastReviewedAt
    const updateData: any = {
      lastReviewedAt: new Date(),
    };

    if (dto.confidence !== undefined) {
      updateData.confidence = dto.confidence;
    }

    const updatedObjective = await this.prisma.objective.update({
      where: { id: objectiveId },
      data: updateData,
    });

    // Emit Activity 'REVIEWED'
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: objectiveId,
      userId,
      tenantId: objective.tenantId,
      action: 'REVIEWED',
      metadata: {
        confidence: dto.confidence ?? updatedObjective.confidence ?? null,
        note: dto.note || null,
        previousConfidence: previousConfidence,
      },
    }).catch(err => {
      console.error('Failed to log activity for objective review:', err);
    });

    return updatedObjective;
  }

  async updateSponsor(
    objectiveId: string,
    sponsorId: string | null,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load objective with tenantId for isolation check
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { id: true, tenantId: true, sponsorId: true },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, objectiveId, userTenantId ?? null);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Objective');
    }

    // Verify sponsor user exists if provided
    if (sponsorId) {
      const sponsor = await this.prisma.user.findUnique({
        where: { id: sponsorId },
        select: { id: true, email: true, name: true },
      });

      if (!sponsor) {
        throw new NotFoundException(`User with ID ${sponsorId} not found`);
      }
    }

    const prevSponsorId = objective.sponsorId;

    // Update sponsor
    const updated = await this.prisma.objective.update({
      where: { id: objectiveId },
      data: { sponsorId },
      select: {
        id: true,
        sponsorId: true,
        sponsor: sponsorId ? {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        } : undefined,
      },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'OBJECTIVE',
      entityId: objectiveId,
      userId: userId,
      tenantId: objective.tenantId!,
      action: 'UPDATED',
      metadata: {
        changedFields: ['sponsorId'],
        sponsor: {
          from: prevSponsorId,
          to: sponsorId,
        },
      },
    }).catch(err => {
      console.error('Failed to log activity for sponsor update:', err);
    });

    return {
      id: updated.id,
      sponsorId: updated.sponsorId,
      sponsor: updated.sponsor || null,
    };
  }

  /**
   * Get progress trend data for an Objective.
   * 
   * Returns historical progress snapshots ordered by timestamp (ASC).
   * Tenant isolation: Verifies Objective belongs to user's tenant.
   * 
   * @param objectiveId - Objective ID
   * @param userTenantId - User's tenant ID for isolation check
   * @returns Array of trend points with timestamp, progress, and status
   */
  async getProgressTrend(
    objectiveId: string,
    userTenantId: string | null | undefined,
  ): Promise<Array<{
    timestamp: string;
    progress: number;
    status: string;
    triggeredBy: string | null;
  }>> {
    // Tenant isolation: enforce read rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId);

    // Verify objective exists and get tenant ID
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(objective.tenantId, userTenantId);

    // Fetch progress snapshots ordered by timestamp (ASC)
    const snapshots = await this.prisma.objectiveProgressSnapshot.findMany({
      where: {
        objectiveId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        createdAt: true,
        progress: true,
        status: true,
        triggeredBy: true,
      },
    });

    return snapshots.map(snapshot => ({
      timestamp: snapshot.createdAt.toISOString(),
      progress: snapshot.progress,
      status: snapshot.status,
      triggeredBy: snapshot.triggeredBy,
    }));
  }

  // NOTE: Reporting / analytics / export methods moved to OkrReportingService in Phase 4
  // Removed methods: getOrgSummary, exportObjectivesCSV, getPillarsForOrg, getActiveCycleForOrg, getPillarCoverageForActiveCycle, getUserOwnedObjectives
}

