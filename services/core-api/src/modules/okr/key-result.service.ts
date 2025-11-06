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

    // Log activity for creation
    await this.activityService.createActivity({
      entityType: 'KEY_RESULT',
      entityId: createdKr.id,
      userId: _userId,
      tenantId: createdKr.tenantId, // ADD THIS
      action: 'CREATED',
      metadata: {
        title: createdKr.title,
        ownerId: createdKr.ownerId,
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
        },
      });

      // Trigger progress roll-up for the Objective
      await this.okrProgressService.refreshObjectiveProgressCascade(objectiveId);
    }

    return createdKr;
  }

  async update(id: string, data: any, userId: string, userOrganizationId: string | null | undefined) {
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
                isPublished: true,
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

    // Governance: Check all locks (cycle lock + publish lock) via OkrGovernanceService
    if (objective) {
      await this.okrGovernanceService.checkAllLocksForKeyResult({
        parentObjective: {
          id: objective.id,
          isPublished: objective.isPublished,
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

    // Recalculate progress if values changed
    if (data.currentValue !== undefined) {
      const kr = await this.prisma.keyResult.findUnique({ where: { id } });
      if (kr) {
        data.progress = calculateProgress(
          kr.startValue,
          data.currentValue,
          kr.targetValue,
          kr.metricType as any,
        );
      }
    }

    // Get old values for activity logging
    const oldKr = await this.prisma.keyResult.findUnique({ where: { id } });
    
    const updatedKr = await this.prisma.keyResult.update({
      where: { id },
      data,
    });

    // Log activity for update
    if (oldKr) {
      await this.activityService.createActivity({
        entityType: 'KEY_RESULT',
        entityId: updatedKr.id,
        userId: userId,
        tenantId: updatedKr.tenantId, // ADD THIS
        action: 'UPDATED',
        metadata: {
          before: {
            progress: oldKr.progress,
            currentValue: oldKr.currentValue,
            targetValue: oldKr.targetValue,
            status: oldKr.status,
          },
          after: {
            progress: updatedKr.progress,
            currentValue: updatedKr.currentValue,
            targetValue: updatedKr.targetValue,
            status: updatedKr.status,
          },
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log activity for key result update:', err);
      });
    }

    // Trigger Objective progress roll-up if progress changed
    if (data.progress !== undefined || data.currentValue !== undefined) {
      await this.okrProgressService.refreshObjectiveProgressForKeyResult(id);
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
                isPublished: true,
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
          isPublished: objective.isPublished,
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
      // Check if key result exists
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

      // Log activity for deletion (before deletion)
      await this.activityService.createActivity({
        entityType: 'KEY_RESULT',
        entityId: keyResult.id,
        userId: userId,
        tenantId: keyResult.tenantId, // ADD THIS
        action: 'DELETED',
        metadata: {
          title: keyResult.title,
          ownerId: keyResult.ownerId,
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log activity for key result deletion:', err);
      });

      // Delete key result (cascades will handle junction table and check-ins)
      await this.prisma.keyResult.delete({
        where: { id },
      });

      // Trigger progress roll-up for parent Objectives after deletion
      for (const objKr of parentObjectives) {
        await this.okrProgressService.refreshObjectiveProgressCascade(objKr.objectiveId);
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
                isPublished: true,
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
          isPublished: objective.isPublished,
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

    // Log activity for check-in
    await this.activityService.createActivity({
      entityType: 'KEY_RESULT',
      entityId: keyResultId,
      userId: data.userId,
      tenantId: krWithParent.tenantId, // ADD THIS - get from key result
      action: 'UPDATED', // Using UPDATED for check-ins (we track CHECK_IN via entityType/action distinction in future)
      metadata: {
        checkIn: {
          value: data.value,
          confidence: data.confidence,
          note: data.note,
          createdAt: checkIn.createdAt,
        },
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for check-in:', err);
    });

    // Update key result with new value
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });

    if (keyResult) {
      const progress = calculateProgress(
        keyResult.startValue,
        data.value,
        keyResult.targetValue,
        keyResult.metricType as any,
      );

      await this.prisma.keyResult.update({
        where: { id: keyResultId },
        data: {
          currentValue: data.value,
          progress,
        },
      });

      // Trigger Objective progress roll-up after check-in updates KR progress
      await this.okrProgressService.refreshObjectiveProgressForKeyResult(keyResultId);
    }

    return checkIn;
  }

  // NOTE: Reporting / analytics / check-in feed methods moved to OkrReportingService in Phase 4
  // Removed methods: getRecentCheckInFeed, getOverdueCheckIns, getUserOwnedKeyResults
}
