import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { calculateProgress } from '@okr-nexus/utils';
import { OkrProgressService } from './okr-progress.service';
import { ActivityService } from '../activity/activity.service';
import { OkrTenantGuard } from './tenant-guard';
import { OkrGovernanceService } from './okr-governance.service';
import { AuditLogService } from '../audit/audit-log.service';
import { OkrStateTransitionService } from './okr-state-transition.service';

/**
 * Key Result Service
 * 
 * NOTE: Reporting / analytics / check-in feed logic was moved to OkrReportingService in Phase 4.
 * This service now focuses on CRUD operations and orchestration only.
 */
@Injectable()
export class KeyResultService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private okrProgressService: OkrProgressService,
    private activityService: ActivityService,
    private okrGovernanceService: OkrGovernanceService,
    private auditLogService: AuditLogService,
    private stateTransitionService: OkrStateTransitionService,
  ) {}

  async findAll(_userId: string, objectiveId?: string) {
    // Return all key results globally - filtering happens in UI, not backend
    // Only PRIVATE OKRs are restricted (handled by canView() check on individual access)
    const where: any = {};

    // Optional objective filter for UI convenience (not access control)
    if (objectiveId) {
      where.objectives = {
        some: {
          objectiveId: objectiveId,
        },
      };
    }

    // Note: We no longer filter by parent objective visibility.
    // All KRs are globally visible by default.
    // VisibilityLevel = PRIVATE is the only exception (checked per-KR via canView())

    return this.prisma.keyResult.findMany({
      where,
      include: {
        objectives: {
          include: {
            objective: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id },
      include: {
        objectives: {
          include: {
            objective: true,
          },
        },
        checkIns: {
          orderBy: { createdAt: 'desc' },
        },
        integrations: true,
      },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${id} not found`);
    }

    return keyResult;
  }

  /**
   * Check if user can view a key result (via parent objective)
   */
  async canView(userId: string, keyResultId: string): Promise<boolean> {
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      include: {
        objectives: {
          include: {
            objective: true,
          },
        },
      },
    });

    if (!keyResult) {
      return false;
    }

    // Check access via any parent objective
    for (const objKr of keyResult.objectives) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, objKr.objectiveId);
        const canView = await this.rbacService.canPerformAction(userId, 'view_okr', resourceContext);
        if (canView) {
          return true;
        }
      } catch {
        // Continue to next objective
      }
    }

    // Also check if user owns the key result
    return keyResult.ownerId === userId;
  }

  /**
   * Check if user can edit a key result (via parent objective)
   * 
   * Tenant Isolation Rules (enforced before RBAC):
   * - Superusers (userOrganizationId === null) are read-only auditors → return false
   * - Users without an organisation (undefined/falsy) cannot mutate → return false
   * - You can only mutate KRs in your own organisation (objective's tenantId must match userOrganizationId) → return false if mismatch
   * - Owner shortcut applies only inside same org (after tenant check passes)
   * 
   * TODO [phase7-hardening]: This is a placeholder until formal KR RBAC is implemented.
   * The write methods (create/update/delete/createCheckIn) enforce the same tenant isolation rules.
   */
  async canEdit(userId: string, keyResultId: string, userOrganizationId: string | null | undefined): Promise<boolean> {
    // Tenant isolation: superuser is read-only
    if (userOrganizationId === null) {
      return false;
    }

    // Tenant isolation: users without an organisation cannot mutate
    if (!userOrganizationId) {
      return false;
    }

    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      include: {
        objectives: {
          include: {
            objective: true,
          },
        },
      },
    });

    if (!keyResult) {
      return false;
    }

    // Determine the objective's tenantId (use first parent objective)
    const objectiveOrgId = keyResult.objectives[0]?.objective?.tenantId;

    // Tenant isolation: verify org match (throws if mismatch or system/global)
    try {
      OkrTenantGuard.assertSameTenant(objectiveOrgId, userOrganizationId);
    } catch {
      return false;
    }

    // All tenant isolation checks passed - now check RBAC
    // Owner can always edit (within same org)
    if (keyResult.ownerId === userId) {
      return true;
    }

    // Check edit access via any parent objective
    for (const objKr of keyResult.objectives) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, objKr.objectiveId);
        const canEdit = await this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
        if (canEdit) {
          return true;
        }
      } catch {
        // Continue to next objective
      }
    }

    return false;
  }

  /**
   * Check if user can delete a key result (via parent objective)
   * 
   * Tenant Isolation Rules (enforced before RBAC):
   * - Superusers (userOrganizationId === null) are read-only auditors → return false
   * - Users without an organisation (undefined/falsy) cannot mutate → return false
   * - You can only mutate KRs in your own organisation (objective's tenantId must match userOrganizationId) → return false if mismatch
   * - Owner shortcut applies only inside same org (after tenant check passes)
   * 
   * TODO [phase7-hardening]: This is a placeholder until formal KR RBAC is implemented.
   * The write methods (create/update/delete/createCheckIn) enforce the same tenant isolation rules.
   */
  async canDelete(userId: string, keyResultId: string, userOrganizationId: string | null | undefined): Promise<boolean> {
    // Tenant isolation: superuser is read-only
    if (userOrganizationId === null) {
      return false;
    }

    // Tenant isolation: users without an organisation cannot mutate
    if (!userOrganizationId) {
      return false;
    }

    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      include: {
        objectives: {
          include: {
            objective: true,
          },
        },
      },
    });

    if (!keyResult) {
      return false;
    }

    // Determine the objective's tenantId (use first parent objective)
    const objectiveOrgId = keyResult.objectives[0]?.objective?.tenantId;

    // Tenant isolation: verify org match (throws if mismatch or system/global)
    try {
      OkrTenantGuard.assertSameTenant(objectiveOrgId, userOrganizationId);
    } catch {
      return false;
    }

    // All tenant isolation checks passed - now check RBAC
    // Owner can delete (within same org)
    if (keyResult.ownerId === userId) {
      return true;
    }

    // Check delete access via any parent objective
    for (const objKr of keyResult.objectives) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, objKr.objectiveId);
        const canDelete = await this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
        if (canDelete) {
          return true;
        }
      } catch {
        // Continue to next objective
      }
    }

    return false;
  }

  // Governance moved to OkrGovernanceService (Phase 3)

  /**
   * Check if user can edit the parent objective
   */
  async canEditObjective(userId: string, objectiveId: string): Promise<boolean> {
    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
      return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
    } catch {
      return false;
    }
  }

  async create(data: any, _userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Extract objectiveId before validation (Prisma will reject it from keyResult.create)
    const objectiveId = data.objectiveId;
    
    // Get parent objective's tenantId for validation
    if (objectiveId) {
      const objective = await this.prisma.objective.findUnique({
        where: { id: objectiveId },
        select: { tenantId: true },
      });

      if (!objective) {
        throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
      }

      // Tenant isolation: verify org match
      OkrTenantGuard.assertSameTenant(objective.tenantId, userOrganizationId);
    } else {
      // If no objectiveId provided, reject (for now - may need to allow standalone KRs later)
      // Tenant isolation already checked above, but need explicit org for standalone KRs
      if (!userOrganizationId) {
        throw new ForbiddenException('You do not have permission to create Key Results without an organization.');
      }
    }

    // Validate required fields
    if (!data.ownerId) {
      throw new BadRequestException('ownerId is required');
    }

    // Reject hardcoded/invalid values
    if (data.ownerId === 'temp-user' || data.ownerId === 'default') {
      throw new BadRequestException('Invalid ownerId: Please select a valid owner');
    }

    // Validate owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: data.ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`User with ID ${data.ownerId} not found`);
    }

    // Validate objective exists if provided and sync cycleId
    let parentCycleId: string | null = null;
    if (objectiveId) {
      const objective = await this.prisma.objective.findUnique({
        where: { id: objectiveId },
        select: { id: true, cycleId: true },
      });

      if (!objective) {
        throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
      }

      // Sync cycleId from parent Objective
      parentCycleId = objective.cycleId;
    }

    // Remove objectiveId from data since it's not a field on KeyResult model
    delete data.objectiveId;
    
    // Set tenantId from parent Objective if available, otherwise use userOrganizationId
    // CRITICAL: tenantId is required for tenant isolation
    if (!data.tenantId) {
      if (objectiveId) {
        // Get tenantId from parent Objective
        const objective = await this.prisma.objective.findUnique({
          where: { id: objectiveId },
          select: { tenantId: true },
        });
        if (objective?.tenantId) {
          data.tenantId = objective.tenantId;
        }
      }
      
      // Fallback to userOrganizationId if still not set
      if (!data.tenantId && userOrganizationId) {
        data.tenantId = userOrganizationId;
      }
    }
    
    // CRITICAL: tenantId is required - fail if still not set
    if (!data.tenantId) {
      throw new BadRequestException('tenantId is required for Key Result creation');
    }
    
    // Set cycleId from parent Objective if not explicitly provided
    // Note: cycleId is a direct field on KeyResult model, not a relation
    if (!data.cycleId && parentCycleId) {
      data.cycleId = parentCycleId;
    }

    // Validate visibility level: reject legacy deprecated values
    if (data.visibilityLevel) {
      const legacyVisibilityLevels = ['WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY'];
      if (legacyVisibilityLevels.includes(data.visibilityLevel)) {
        throw new BadRequestException(
          `Legacy visibility level '${data.visibilityLevel}' is no longer supported. Please use 'PUBLIC_TENANT' or 'PRIVATE' instead.`
        );
      }
    }

    // Set currentValue to startValue if not provided (required field)
    if (data.currentValue === undefined && data.startValue !== undefined) {
      data.currentValue = data.startValue;
    }

    // Calculate initial progress if currentValue is provided
    if (data.currentValue !== undefined && data.startValue !== undefined && data.targetValue !== undefined && data.metricType) {
      data.progress = calculateProgress(
        data.startValue,
        data.currentValue,
        data.targetValue,
        data.metricType as any,
      );
    }

    // Set initial state if not provided: calculate from status and isPublished
    if (data.state === undefined) {
      const status = data.status || 'ON_TRACK';
      const isPublished = data.isPublished || false;
      data.state = this.stateTransitionService.calculateKeyResultStateFromLegacy(status, isPublished);
    }

    const createdKr = await this.prisma.keyResult.create({
      data,
    }).catch((error) => {
      console.error('[KeyResultService] Error creating key result:', {
        error: error.message,
        errorCode: error.code,
        data: {
          ...data,
          cycleId: data.cycleId,
          tenantId: data.tenantId,
        },
      });
      throw error;
    });

    // Log activity for creation with full entity snapshot
    await this.activityService.createActivity({
      entityType: 'KEY_RESULT',
      entityId: createdKr.id,
      userId: _userId,
      tenantId: createdKr.tenantId,
      action: 'CREATED',
      metadata: {
        before: null, // No before state for creation
        after: {
          id: createdKr.id,
          title: createdKr.title,
          description: createdKr.description,
          ownerId: createdKr.ownerId,
          tenantId: createdKr.tenantId,
          metricType: createdKr.metricType,
          startValue: createdKr.startValue,
          targetValue: createdKr.targetValue,
          currentValue: createdKr.currentValue,
          unit: createdKr.unit,
          status: createdKr.status,
          progress: createdKr.progress,
          visibilityLevel: createdKr.visibilityLevel,
          isPublished: createdKr.isPublished,
          state: createdKr.state,
          checkInCadence: createdKr.checkInCadence,
          cycleId: createdKr.cycleId,
          startDate: createdKr.startDate,
          endDate: createdKr.endDate,
          positionX: createdKr.positionX,
          positionY: createdKr.positionY,
          createdAt: createdKr.createdAt,
          updatedAt: createdKr.updatedAt,
        },
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for key result creation:', err);
    });

    // Log audit entry for key result creation
    // Get tenantId from parent objective if available
    let tenantId: string | null = null;
    if (objectiveId) {
      try {
        const objective = await this.prisma.objective.findUnique({
          where: { id: objectiveId },
          select: { tenantId: true },
        });
        tenantId = objective?.tenantId || null;
      } catch (error) {
        // If lookup fails, continue without tenantId
      }
    }

    await this.auditLogService.record({
      actorUserId: _userId,
      action: 'key_result_created',
      targetType: 'OKR',
      targetId: createdKr.id,
      tenantId: tenantId,
      metadata: {
        title: createdKr.title,
        objectiveId: objectiveId || null,
        ownerId: createdKr.ownerId,
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log audit entry for key result creation:', err);
    });

    // If KR was linked to an Objective, create the junction table entry
    if (objectiveId) {
      await this.prisma.objectiveKeyResult.create({
        data: {
          objectiveId,
          keyResultId: createdKr.id,
          tenantId: createdKr.tenantId,
        },
      });

      // Trigger progress and status roll-up for the Objective
      await this.okrProgressService.refreshObjectiveProgressAndStatusCascade(objectiveId);
    }

    return createdKr;
  }

  async update(id: string, data: any, userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get full entity snapshot BEFORE update for audit logging
    const krBefore = await this.prisma.keyResult.findUnique({ where: { id } });
    
    if (!krBefore) {
      throw new NotFoundException(`Key Result with ID ${id} not found`);
    }

    const krWithParent = await this.prisma.keyResult.findUnique({
      where: { id },
      select: { 
        objectives: {
          select: {
            objective: { 
              select: { 
                id: true,
                tenantId: true,
                state: true, // Include state for governance checks
                isPublished: true, // Legacy support
                cycleId: true,
              } 
            }
          },
          take: 1,
        }
      },
    });

    if (!krWithParent) {
      throw new NotFoundException(`Key Result with ID ${id} not found`);
    }

    const objective = krWithParent.objectives[0]?.objective;
    const objectiveOrgId = objective?.tenantId;

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(objectiveOrgId, userOrganizationId);
    
    // Sync cycleId from parent Objective if not explicitly provided in update
    if (!data.cycleId && objective?.cycleId) {
      data.cycleId = objective.cycleId;
    }

    // Calculate current state if not set (for backward compatibility)
    const currentState = krBefore.state || 
      this.stateTransitionService.calculateKeyResultStateFromLegacy(
        krBefore.status,
        krBefore.isPublished
      );

    // Handle state transitions: if state is provided in update, validate transition
    if (data.state !== undefined) {
      this.stateTransitionService.assertKeyResultStateTransition(currentState, data.state);
    } else if (data.status !== undefined || data.isPublished !== undefined) {
      // If status or isPublished changed, calculate new state
      const newStatus = data.status !== undefined ? data.status : krBefore.status;
      const newIsPublished = data.isPublished !== undefined ? data.isPublished : krBefore.isPublished;
      const calculatedState = this.stateTransitionService.calculateKeyResultStateFromLegacy(newStatus, newIsPublished);
      
      // Validate transition if state would change
      if (calculatedState !== currentState) {
        this.stateTransitionService.assertKeyResultStateTransition(currentState, calculatedState);
        data.state = calculatedState;
      }
    }

    // Governance: Check all locks (cycle lock + publish lock) via OkrGovernanceService
    if (objective) {
      await this.okrGovernanceService.checkAllLocksForKeyResult({
        parentObjective: {
          id: objective.id,
          state: objective.state, // Use state if available
          isPublished: objective.isPublished, // Legacy support
        },
        actingUser: {
          id: userId,
          tenantId: userOrganizationId ?? null,
        },
        rbacService: this.rbacService,
      });
    }
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

    // Recalculate progress if values changed
    if (data.currentValue !== undefined) {
      data.progress = calculateProgress(
        krBefore.startValue,
        data.currentValue,
        krBefore.targetValue,
        krBefore.metricType as any,
      );
    }
    
    const updatedKr = await this.prisma.keyResult.update({
      where: { id },
      data,
    });

    // Detect state changes
    const statusChanged = krBefore.status !== updatedKr.status;
    const stateChanged = (krBefore.state || 
      this.stateTransitionService.calculateKeyResultStateFromLegacy(krBefore.status, krBefore.isPublished)) !== 
      (updatedKr.state || 
      this.stateTransitionService.calculateKeyResultStateFromLegacy(updatedKr.status, updatedKr.isPublished));
    const publishStateChanged = krBefore.isPublished !== updatedKr.isPublished;
    const wasPublish = krBefore.isPublished === false && updatedKr.isPublished === true;
    const wasUnpublish = krBefore.isPublished === true && updatedKr.isPublished === false;

    // Store status snapshot if status changed
    if (statusChanged) {
      await this.storeKeyResultStatusSnapshot(updatedKr.id, updatedKr.status, updatedKr.progress, 'KR_UPDATE');
    }

    // Determine action type based on state changes
    let action = 'UPDATED';
    const finalState = updatedKr.state || 
      this.stateTransitionService.calculateKeyResultStateFromLegacy(updatedKr.status, updatedKr.isPublished);
    
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
    } else if (statusChanged && updatedKr.status === 'COMPLETED') {
      action = 'COMPLETED';
    } else if (statusChanged && updatedKr.status === 'CANCELLED') {
      action = 'CANCELLED';
    }

    // Log activity for state transition if state changed
    if (stateChanged) {
      await this.activityService.createActivity({
        entityType: 'KEY_RESULT',
        entityId: updatedKr.id,
        userId: userId,
        tenantId: updatedKr.tenantId,
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
        entityType: 'KEY_RESULT',
        entityId: updatedKr.id,
        userId: userId,
        tenantId: updatedKr.tenantId,
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
      entityType: 'KEY_RESULT',
      entityId: updatedKr.id,
      userId: userId,
      tenantId: updatedKr.tenantId,
      action: action,
      metadata: {
        wasPublish: wasPublish,
        wasUnpublish: wasUnpublish,
        statusChanged: statusChanged,
        publishStateChanged: publishStateChanged,
        stateChanged: stateChanged,
        before: {
          id: krBefore.id,
          title: krBefore.title,
          description: krBefore.description,
          ownerId: krBefore.ownerId,
          tenantId: krBefore.tenantId,
          metricType: krBefore.metricType,
          startValue: krBefore.startValue,
          targetValue: krBefore.targetValue,
          currentValue: krBefore.currentValue,
          unit: krBefore.unit,
          status: krBefore.status,
          progress: krBefore.progress,
          visibilityLevel: krBefore.visibilityLevel,
          isPublished: krBefore.isPublished,
          state: krBefore.state || currentState,
          checkInCadence: krBefore.checkInCadence,
          cycleId: krBefore.cycleId,
          startDate: krBefore.startDate,
          endDate: krBefore.endDate,
          positionX: krBefore.positionX,
          positionY: krBefore.positionY,
          createdAt: krBefore.createdAt,
          updatedAt: krBefore.updatedAt,
        },
        after: {
          id: updatedKr.id,
          title: updatedKr.title,
          description: updatedKr.description,
          ownerId: updatedKr.ownerId,
          tenantId: updatedKr.tenantId,
          metricType: updatedKr.metricType,
          startValue: updatedKr.startValue,
          targetValue: updatedKr.targetValue,
          currentValue: updatedKr.currentValue,
          unit: updatedKr.unit,
          status: updatedKr.status,
          progress: updatedKr.progress,
          visibilityLevel: updatedKr.visibilityLevel,
          isPublished: updatedKr.isPublished,
          state: updatedKr.state || finalState,
          checkInCadence: updatedKr.checkInCadence,
          cycleId: updatedKr.cycleId,
          startDate: updatedKr.startDate,
          endDate: updatedKr.endDate,
          positionX: updatedKr.positionX,
          positionY: updatedKr.positionY,
          createdAt: updatedKr.createdAt,
          updatedAt: updatedKr.updatedAt,
        },
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for key result update:', err);
    });

    // Trigger Objective progress roll-up if progress changed
    if (data.progress !== undefined || data.currentValue !== undefined) {
      await this.okrProgressService.refreshObjectiveProgressForKeyResult(id);
    }

    // Trigger Objective status roll-up if status changed
    if (statusChanged) {
      await this.okrProgressService.refreshObjectiveStatusForKeyResult(id);
    }

    return updatedKr;
  }

  async delete(id: string, userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    const krWithParent = await this.prisma.keyResult.findUnique({
      where: { id },
      select: { 
        objectives: {
          select: {
            objective: { 
              select: { 
                id: true,
                tenantId: true,
                state: true, // Include state for governance checks
                isPublished: true, // Legacy support
                cycleId: true,
              } 
            }
          },
          take: 1,
        }
      },
    });

    if (!krWithParent) {
      throw new NotFoundException(`Key Result with ID ${id} not found`);
    }

    const objective = krWithParent.objectives[0]?.objective;
    const objectiveOrgId = objective?.tenantId;

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(objectiveOrgId, userOrganizationId);

    // Governance: Check all locks (cycle lock + publish lock) via OkrGovernanceService
    if (objective) {
      await this.okrGovernanceService.checkAllLocksForKeyResult({
        parentObjective: {
          id: objective.id,
          state: objective.state, // Use state if available
          isPublished: objective.isPublished, // Legacy support
        },
        actingUser: {
          id: userId,
          tenantId: userOrganizationId ?? null,
        },
        rbacService: this.rbacService,
      });
    }
    // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
    // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking

    try {
      // Get full entity snapshot BEFORE deletion for audit logging
      const keyResult = await this.prisma.keyResult.findUnique({
        where: { id },
      });

      if (!keyResult) {
        throw new NotFoundException(`Key Result with ID ${id} not found`);
      }

      // Get parent objectives before deletion (for progress roll-up)
      const parentObjectives = await this.prisma.objectiveKeyResult.findMany({
        where: { keyResultId: id },
        select: { objectiveId: true },
      });

      // Log activity for deletion (before deletion) with full entity snapshot
      await this.activityService.createActivity({
        entityType: 'KEY_RESULT',
        entityId: keyResult.id,
        userId: userId,
        tenantId: keyResult.tenantId,
        action: 'DELETED',
        metadata: {
          before: {
            id: keyResult.id,
            title: keyResult.title,
            description: keyResult.description,
            ownerId: keyResult.ownerId,
            tenantId: keyResult.tenantId,
            metricType: keyResult.metricType,
            startValue: keyResult.startValue,
            targetValue: keyResult.targetValue,
            currentValue: keyResult.currentValue,
            unit: keyResult.unit,
            status: keyResult.status,
            progress: keyResult.progress,
            visibilityLevel: keyResult.visibilityLevel,
            isPublished: keyResult.isPublished,
            state: keyResult.state,
            checkInCadence: keyResult.checkInCadence,
            cycleId: keyResult.cycleId,
            startDate: keyResult.startDate,
            endDate: keyResult.endDate,
            positionX: keyResult.positionX,
            positionY: keyResult.positionY,
            createdAt: keyResult.createdAt,
            updatedAt: keyResult.updatedAt,
          },
          after: null, // No after state for deletion
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log activity for key result deletion:', err);
      });

      // Log audit entry for key result deletion
      await this.auditLogService.record({
        actorUserId: userId,
        action: 'key_result_deleted',
        targetType: 'OKR',
        targetId: keyResult.id,
        tenantId: keyResult.tenantId || null,
        metadata: {
          title: keyResult.title,
          ownerId: keyResult.ownerId,
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log audit entry for key result deletion:', err);
      });

      // Delete key result (cascades will handle junction table and check-ins)
      await this.prisma.keyResult.delete({
        where: { id },
      });

      // Trigger progress and status roll-up for parent Objectives after deletion
      for (const objKr of parentObjectives) {
        await this.okrProgressService.refreshObjectiveProgressAndStatusCascade(objKr.objectiveId);
      }

      return { id };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Re-throw Prisma errors with more context
      throw new BadRequestException(
        `Failed to delete key result: ${error.message || 'Unknown error'}`
      );
    }
  }

  async createCheckIn(keyResultId: string, data: { userId: string; value: number; confidence: number; note?: string; blockers?: string }, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    const krWithParent = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: {
        id: true,
        tenantId: true, // ADD THIS - select tenantId directly
        objectives: {
          select: {
            objective: { 
              select: { 
                id: true,
                tenantId: true,
                state: true, // Include state for governance checks
                isPublished: true, // Legacy support
                cycleId: true,
              } 
            }
          },
          take: 1,
        }
      },
    });

    if (!krWithParent) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    const objective = krWithParent.objectives[0]?.objective;
    const objectiveOrgId = objective?.tenantId;

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(objectiveOrgId, userOrganizationId);

    // Governance: Check all locks (cycle lock + publish lock) via OkrGovernanceService
    // Rationale: after publish, individual contributors shouldn't be able to quietly change targets
    // or massage the numbers without admin-level visibility
    if (objective) {
      await this.okrGovernanceService.checkAllLocksForKeyResult({
        parentObjective: {
          id: objective.id,
          state: objective.state, // Use state if available
          isPublished: objective.isPublished, // Legacy support
        },
        actingUser: {
          id: data.userId,
          tenantId: userOrganizationId ?? null,
        },
        rbacService: this.rbacService,
      });
    }
    // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
    // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking

    // Create check-in
    const checkIn = await this.prisma.checkIn.create({
      data: {
        keyResultId,
        ...data,
      },
    });

    // Update key result with new value
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });

    if (keyResult) {
      // Get snapshot BEFORE check-in update
      const krBeforeCheckIn = {
        id: keyResult.id,
        title: keyResult.title,
        description: keyResult.description,
        ownerId: keyResult.ownerId,
        tenantId: keyResult.tenantId,
        metricType: keyResult.metricType,
        startValue: keyResult.startValue,
        targetValue: keyResult.targetValue,
        currentValue: keyResult.currentValue,
        unit: keyResult.unit,
        status: keyResult.status,
        progress: keyResult.progress,
        visibilityLevel: keyResult.visibilityLevel,
        isPublished: keyResult.isPublished,
        checkInCadence: keyResult.checkInCadence,
        cycleId: keyResult.cycleId,
        startDate: keyResult.startDate,
        endDate: keyResult.endDate,
        positionX: keyResult.positionX,
        positionY: keyResult.positionY,
        createdAt: keyResult.createdAt,
        updatedAt: keyResult.updatedAt,
      };

      const progress = calculateProgress(
        keyResult.startValue,
        data.value,
        keyResult.targetValue,
        keyResult.metricType as any,
      );

      const updatedKr = await this.prisma.keyResult.update({
        where: { id: keyResultId },
        data: {
          currentValue: data.value,
          progress,
        },
      });

      // Detect state changes from check-in
      const statusChanged = krBeforeCheckIn.status !== updatedKr.status;
      
      // Store status snapshot if status changed from check-in
      if (statusChanged) {
        await this.storeKeyResultStatusSnapshot(updatedKr.id, updatedKr.status, updatedKr.progress, 'KR_CHECKIN');
      }
      
      let action = 'UPDATED';
      if (statusChanged && updatedKr.status === 'COMPLETED') {
        action = 'COMPLETED';
      } else if (statusChanged && updatedKr.status === 'CANCELLED') {
        action = 'CANCELLED';
      }

      // Log activity for check-in with full entity snapshots
      await this.activityService.createActivity({
        entityType: 'KEY_RESULT',
        entityId: keyResultId,
        userId: data.userId,
        tenantId: krWithParent.tenantId,
        action: action,
        metadata: {
          checkIn: {
            id: checkIn.id,
            value: data.value,
            confidence: data.confidence,
            note: data.note,
            blockers: data.blockers,
            createdAt: checkIn.createdAt,
          },
          statusChanged: statusChanged,
          before: krBeforeCheckIn,
          after: {
            id: updatedKr.id,
            title: updatedKr.title,
            description: updatedKr.description,
            ownerId: updatedKr.ownerId,
            tenantId: updatedKr.tenantId,
            metricType: updatedKr.metricType,
            startValue: updatedKr.startValue,
            targetValue: updatedKr.targetValue,
            currentValue: updatedKr.currentValue,
            unit: updatedKr.unit,
            status: updatedKr.status,
            progress: updatedKr.progress,
            visibilityLevel: updatedKr.visibilityLevel,
            isPublished: updatedKr.isPublished,
            checkInCadence: updatedKr.checkInCadence,
            cycleId: updatedKr.cycleId,
            startDate: updatedKr.startDate,
            endDate: updatedKr.endDate,
            positionX: updatedKr.positionX,
            positionY: updatedKr.positionY,
            createdAt: updatedKr.createdAt,
            updatedAt: updatedKr.updatedAt,
          },
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log activity for check-in:', err);
      });

      // Trigger Objective progress roll-up after check-in updates KR progress
      await this.okrProgressService.refreshObjectiveProgressForKeyResult(keyResultId);

      // Trigger Objective status roll-up if status changed from check-in
      if (statusChanged) {
        await this.okrProgressService.refreshObjectiveStatusForKeyResult(keyResultId);
      }
    }

    return checkIn;
  }

  /**
   * Get paginated check-in history for a key result.
   * 
   * Tenant isolation: Verifies KR belongs to user's tenant via parent Objective.
   * RBAC: User must have view_okr permission (checked in controller).
   * 
   * @param keyResultId - Key Result ID
   * @param page - Page number (1-based)
   * @param limit - Items per page (max 50)
   * @param userTenantId - User's tenant ID for isolation check
   * @returns Paginated check-ins with author information
   */
  async getCheckIns(
    keyResultId: string,
    page: number,
    limit: number,
    userTenantId: string | null | undefined,
  ): Promise<{
    data: Array<{
      id: string;
      value: number;
      confidence: number;
      note: string | null;
      blockers: string | null;
      createdAt: Date;
      author: {
        id: string;
        name: string | null;
      };
    }>;
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    // Tenant isolation: enforce read rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId);

    // Verify key result exists and get tenant ID via parent objective
    const krWithParent = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: {
        id: true,
        tenantId: true,
        objectives: {
          select: {
            objective: {
              select: {
                id: true,
                tenantId: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!krWithParent) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    const objective = krWithParent.objectives[0]?.objective;
    const objectiveOrgId = objective?.tenantId;

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(objectiveOrgId, userTenantId);

    // Get total count
    const total = await this.prisma.checkIn.count({
      where: { keyResultId },
    });

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Fetch check-ins ordered by createdAt DESC
    const checkIns = await this.prisma.checkIn.findMany({
      where: { keyResultId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        value: true,
        confidence: true,
        note: true,
        blockers: true,
        createdAt: true,
        userId: true,
      },
    });

    // Fetch user names for all unique user IDs
    const userIds = [...new Set(checkIns.map(ci => ci.userId))];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Transform to response format
    const data = checkIns.map(checkIn => ({
      id: checkIn.id,
      value: checkIn.value,
      confidence: checkIn.confidence,
      note: checkIn.note,
      blockers: checkIn.blockers,
      createdAt: checkIn.createdAt,
      author: {
        id: checkIn.userId,
        name: userMap.get(checkIn.userId) || null,
      },
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  // ==========================================
  // Tags Management
  // ==========================================

  /**
   * Add a tag to a Key Result
   */
  async addTag(
    keyResultId: string,
    tagId: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load key result with tenantId for isolation check
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: { id: true, tenantId: true },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(keyResult.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, keyResultId, userTenantId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Key Result');
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

    // Check if tag already exists on key result
    const existing = await this.prisma.keyResultTag.findUnique({
      where: {
        tenantId_keyResultId_tagId: {
          tenantId: keyResult.tenantId!,
          keyResultId,
          tagId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException({
        message: `Tag "${tag.name}" is already assigned to this Key Result`,
        code: 'DUPLICATE_TAG',
      });
    }

    // Create tag link
    const keyResultTag = await this.prisma.keyResultTag.create({
      data: {
        tenantId: keyResult.tenantId!,
        keyResultId,
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
      entityType: 'KEY_RESULT',
      entityId: keyResultId,
      userId: userId,
      tenantId: keyResult.tenantId!,
      action: 'TAG_ADDED',
      metadata: {
        tagId: tag.id,
        tagName: tag.name,
      },
    }).catch(err => {
      console.error('Failed to log activity for tag addition:', err);
    });

    return {
      id: keyResultTag.id,
      tag: keyResultTag.tag,
      createdAt: keyResultTag.createdAt,
    };
  }

  /**
   * Remove a tag from a Key Result
   */
  async removeTag(
    keyResultId: string,
    tagId: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load key result with tenantId for isolation check
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: { id: true, tenantId: true },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(keyResult.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, keyResultId, userTenantId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Key Result');
    }

    // Load tag for activity log
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, name: true },
    });

    // Find and delete tag link
    const keyResultTag = await this.prisma.keyResultTag.findUnique({
      where: {
        tenantId_keyResultId_tagId: {
          tenantId: keyResult.tenantId!,
          keyResultId,
          tagId,
        },
      },
    });

    if (!keyResultTag) {
      throw new NotFoundException({
        message: `Tag is not assigned to this Key Result`,
        code: 'TAG_NOT_FOUND',
      });
    }

    await this.prisma.keyResultTag.delete({
      where: { id: keyResultTag.id },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'KEY_RESULT',
      entityId: keyResultId,
      userId: userId,
      tenantId: keyResult.tenantId!,
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
   * List tags for a Key Result
   */
  async listTags(
    keyResultId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load key result with tenantId for isolation check
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: { id: true, tenantId: true },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(keyResult.tenantId, userTenantId);

    const tags = await this.prisma.keyResultTag.findMany({
      where: {
        keyResultId,
        tenantId: keyResult.tenantId!,
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

    return tags.map(krt => ({
      id: krt.tag.id,
      name: krt.tag.name,
      color: krt.tag.color,
      addedAt: krt.createdAt,
      addedBy: krt.createdBy,
    }));
  }

  // ==========================================
  // Contributors Management
  // ==========================================

  /**
   * Add a contributor to a Key Result
   */
  async addContributor(
    keyResultId: string,
    userIdToAdd: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load key result with tenantId for isolation check
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: { id: true, tenantId: true },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(keyResult.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, keyResultId, userTenantId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Key Result');
    }

    // Verify user exists
    const userToAdd = await this.prisma.user.findUnique({
      where: { id: userIdToAdd },
      select: { id: true, email: true, name: true },
    });

    if (!userToAdd) {
      throw new NotFoundException(`User with ID ${userIdToAdd} not found`);
    }

    // Check if contributor already exists
    const existing = await this.prisma.keyResultContributor.findUnique({
      where: {
        tenantId_keyResultId_userId: {
          tenantId: keyResult.tenantId!,
          keyResultId,
          userId: userIdToAdd,
        },
      },
    });

    if (existing) {
      throw new BadRequestException({
        message: `User is already a contributor to this Key Result`,
        code: 'DUPLICATE_CONTRIBUTOR',
      });
    }

    // Create contributor link
    const contributor = await this.prisma.keyResultContributor.create({
      data: {
        tenantId: keyResult.tenantId!,
        keyResultId,
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
      entityType: 'KEY_RESULT',
      entityId: keyResultId,
      userId: userId,
      tenantId: keyResult.tenantId!,
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
   * Remove a contributor from a Key Result
   */
  async removeContributor(
    keyResultId: string,
    userIdToRemove: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load key result with tenantId for isolation check
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: { id: true, tenantId: true },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(keyResult.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, keyResultId, userTenantId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Key Result');
    }

    // Load user for activity log
    const userToRemove = await this.prisma.user.findUnique({
      where: { id: userIdToRemove },
      select: { id: true, email: true, name: true },
    });

    // Find and delete contributor link
    const contributor = await this.prisma.keyResultContributor.findUnique({
      where: {
        tenantId_keyResultId_userId: {
          tenantId: keyResult.tenantId!,
          keyResultId,
          userId: userIdToRemove,
        },
      },
    });

    if (!contributor) {
      throw new NotFoundException({
        message: `User is not a contributor to this Key Result`,
        code: 'CONTRIBUTOR_NOT_FOUND',
      });
    }

    await this.prisma.keyResultContributor.delete({
      where: { id: contributor.id },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'KEY_RESULT',
      entityId: keyResultId,
      userId: userId,
      tenantId: keyResult.tenantId!,
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
   * List contributors for a Key Result
   */
  async listContributors(
    keyResultId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load key result with tenantId for isolation check
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: { id: true, tenantId: true },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(keyResult.tenantId, userTenantId);

    const contributors = await this.prisma.keyResultContributor.findMany({
      where: {
        keyResultId,
        tenantId: keyResult.tenantId!,
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

  /**
   * Store a status snapshot for Key Result historical tracking.
   * 
   * Creates a snapshot record of Key Result status at a specific point in time.
   * Used for trend analysis and historical status visualization.
   * 
   * @param keyResultId - The Key Result ID
   * @param status - Status value
   * @param progress - Progress value (0-100), optional
   * @param triggeredBy - What triggered this snapshot (e.g., "KR_UPDATE", "KR_CHECKIN")
   */
  private async storeKeyResultStatusSnapshot(
    keyResultId: string,
    status: string,
    progress?: number,
    triggeredBy: string = 'KR_UPDATE',
  ): Promise<void> {
    try {
      await this.prisma.keyResultStatusSnapshot.create({
        data: {
          keyResultId,
          status: status as any,
          progress: progress !== undefined ? progress : null,
          triggeredBy,
        },
      });
    } catch (error) {
      // Log error but don't fail the operation if snapshot storage fails
      console.error(`Failed to store status snapshot for key result ${keyResultId}:`, error);
    }
  }

  /**
   * Get status trend data for a Key Result.
   * 
   * Returns historical status snapshots ordered by timestamp (ASC).
   * Tenant isolation: Verifies Key Result belongs to user's tenant.
   * 
   * @param keyResultId - Key Result ID
   * @param userTenantId - User's tenant ID for isolation check
   * @returns Array of trend points with timestamp, status, and progress
   */
  async getStatusTrend(
    keyResultId: string,
    userTenantId: string | null | undefined,
  ): Promise<Array<{
    timestamp: string;
    status: string;
    progress: number | null;
    triggeredBy: string | null;
  }>> {
    // Tenant isolation: enforce read rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId);

    // Verify key result exists and get tenant ID
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(keyResult.tenantId, userTenantId);

    // Fetch status snapshots ordered by timestamp (ASC)
    const snapshots = await this.prisma.keyResultStatusSnapshot.findMany({
      where: {
        keyResultId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        createdAt: true,
        status: true,
        progress: true,
        triggeredBy: true,
      },
    });

    return snapshots.map(snapshot => ({
      timestamp: snapshot.createdAt.toISOString(),
      status: snapshot.status,
      progress: snapshot.progress,
      triggeredBy: snapshot.triggeredBy,
    }));
  }

  // NOTE: Reporting / analytics / check-in feed methods moved to OkrReportingService in Phase 4
  // Removed methods: getRecentCheckInFeed, getOverdueCheckIns, getUserOwnedKeyResults
}
