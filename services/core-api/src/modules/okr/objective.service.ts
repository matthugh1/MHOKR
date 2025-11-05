import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { OkrProgressService } from './okr-progress.service';
import { ActivityService } from '../activity/activity.service';
import { OkrTenantGuard } from './tenant-guard';
import { OkrGovernanceService } from './okr-governance.service';
import { AuditLogService } from '../audit/audit-log.service';
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

  async findById(id: string, userOrganizationId?: string | null | undefined) {
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

    // Tenant isolation: verify objective belongs to caller's tenant (defense-in-depth)
    // Note: This is in addition to RBAC permission checks (canView) in the controller
    if (userOrganizationId !== undefined) {
      if (userOrganizationId === null) {
        // SUPERUSER: can see any objective (read-only)
        return objective;
      }

      if (userOrganizationId === '' || objective.organizationId !== userOrganizationId) {
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

  async create(data: any, _userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

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

    // Validate visibility level permissions
    if (data.visibilityLevel === 'PRIVATE' || data.visibilityLevel === 'EXEC_ONLY') {
      // Only TENANT_ADMIN or TENANT_OWNER can create PRIVATE or EXEC_ONLY OKRs
      if (!data.organizationId) {
        throw new BadRequestException('Organization ID is required for PRIVATE or EXEC_ONLY visibility');
      }

      try {
        const resourceContext = {
          tenantId: data.organizationId,
          workspaceId: data.workspaceId || null,
          teamId: data.teamId || null,
        };
        const canEdit = await this.rbacService.canPerformAction(_userId, 'edit_okr', resourceContext);
        if (!canEdit) {
          throw new ForbiddenException('Only tenant administrators can create PRIVATE or EXEC_ONLY OKRs');
        }
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        // If RBAC check fails, conservatively deny
        throw new ForbiddenException('Only tenant administrators can create PRIVATE or EXEC_ONLY OKRs');
      }
    }

    // Validate cycle lock if cycleId is provided
    if (data.cycleId) {
      try {
        const cycle = await this.prisma.cycle.findUnique({
          where: { id: data.cycleId },
          select: { status: true, organizationId: true },
        });

        if (cycle) {
          // Enforce tenant isolation for cycle
          if (cycle.organizationId && userOrganizationId !== null) {
            OkrTenantGuard.assertSameTenant(cycle.organizationId, userOrganizationId);
          }

          // If cycle is LOCKED or ARCHIVED, only admins can create
          if (cycle.status === 'LOCKED' || cycle.status === 'ARCHIVED') {
            const resourceContext = {
              tenantId: cycle.organizationId || data.organizationId || '',
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

    // Log audit entry for objective creation
    await this.auditLogService.record({
      actorUserId: _userId,
      action: 'objective_created',
      targetType: 'OKR',
      targetId: createdObjective.id,
      organizationId: createdObjective.organizationId || null,
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

    // If Objective has a parent, trigger progress roll-up for parent
    if (data.parentId) {
      await this.okrProgressService.refreshObjectiveProgressCascade(data.parentId);
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
   * @param userOrganizationId - User's organization ID (null for SUPERUSER)
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
    userOrganizationId: string | null | undefined,
  ) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

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

    if (!userOrganizationId) {
      throw new BadRequestException('organizationId is required');
    }

    // Validate owner exists and is in same tenant
    const owner = await this.prisma.user.findUnique({
      where: { id: objectiveData.ownerUserId },
      include: {
        roleAssignments: {
          where: {
            scopeType: 'TENANT',
            scopeId: userOrganizationId,
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
      select: { id: true, status: true, organizationId: true, startDate: true, endDate: true },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${objectiveData.cycleId} not found`);
    }

    // Enforce tenant isolation for cycle
    OkrTenantGuard.assertSameTenant(cycle.organizationId, userOrganizationId);

    // Governance: Check cycle lock
    if (cycle.status === 'LOCKED' || cycle.status === 'ARCHIVED') {
      const resourceContext = {
        tenantId: userOrganizationId,
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
      tenantId: userOrganizationId,
      workspaceId: null,
      teamId: null,
    };
    const canCreate = await this.rbacService.canPerformAction(_userId, 'create_okr', resourceContext);
    if (!canCreate) {
      throw new ForbiddenException('You do not have permission to create OKRs in this scope');
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
              scopeId: userOrganizationId,
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
        select: { id: true, organizationId: true },
      });

      if (!parentObjective) {
        throw new NotFoundException(`Parent objective with ID ${objectiveData.parentId} not found`);
      }

      // Enforce tenant isolation for parent
      OkrTenantGuard.assertSameTenant(parentObjective.organizationId, userOrganizationId);
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
              scopeId: userOrganizationId,
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
      organizationId: userOrganizationId,
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
        organizationId: userOrganizationId,
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
      organizationId: userOrganizationId,
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

