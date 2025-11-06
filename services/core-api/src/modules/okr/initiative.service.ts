import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { OkrTenantGuard } from './tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType } from '@prisma/client';

@Injectable()
export class InitiativeService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private auditLogService: AuditLogService,
  ) {}

  async findAll(_userId: string, objectiveId?: string, keyResultId?: string) {
    // Return all initiatives globally - filtering happens in UI, not backend
    // Only PRIVATE OKRs are restricted (handled by canView() check on individual access)
    const where: any = {};
    
    // Optional filters for UI convenience (not access control)
    if (objectiveId) {
      where.objectiveId = objectiveId;
    }
    
    if (keyResultId) {
      where.keyResultId = keyResultId;
    }

    // Note: We no longer filter by parent objective visibility.
    // All initiatives are globally visible by default.
    // VisibilityLevel = PRIVATE is the only exception (checked per-initiative via canView())
    
    return this.prisma.initiative.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        objective: true,
      },
    });
  }

  async findById(id: string) {
    const initiative = await this.prisma.initiative.findUnique({
      where: { id },
      include: {
        objective: true,
      },
    });

    if (!initiative) {
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    }

    return initiative;
  }

  /**
   * Check if user can view an initiative (via parent objective)
   */
  async canView(userId: string, initiativeId: string): Promise<boolean> {
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      include: {
        objective: true,
      },
    });

    if (!initiative) {
      return false;
    }

    // Owner can always view
    if (initiative.ownerId === userId) {
      return true;
    }

    // Check access via parent objective
    if (initiative.objectiveId) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, initiative.objectiveId);
        return this.rbacService.canPerformAction(userId, 'view_okr', resourceContext);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if user can edit an initiative (via parent objective)
   */
  async canEdit(userId: string, initiativeId: string): Promise<boolean> {
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      include: {
        objective: true,
      },
    });

    if (!initiative) {
      return false;
    }

    // Owner can always edit
    if (initiative.ownerId === userId) {
      return true;
    }

    // Check edit access via parent objective
    if (initiative.objectiveId) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, initiative.objectiveId);
        return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if user can delete an initiative (via parent objective)
   */
  async canDelete(userId: string, initiativeId: string): Promise<boolean> {
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      include: {
        objective: true,
      },
    });

    if (!initiative) {
      return false;
    }

    // Owner can delete
    if (initiative.ownerId === userId) {
      return true;
    }

    // Check delete access via parent objective
    if (initiative.objectiveId) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, initiative.objectiveId);
        return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
      } catch {
        return false;
      }
    }

    return false;
  }

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

  async create(data: any, userId: string, userOrganizationId: string | null | undefined) {
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

    // Validate owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: data.ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`User with ID ${data.ownerId} not found`);
    }

    // Validate objectiveId if provided and sync cycleId
    let objective: { tenantId: string | null; cycleId: string | null } | null = null;
    let parentCycleId: string | null = null;
    
    if (data.objectiveId) {
      objective = await this.prisma.objective.findUnique({
        where: { id: data.objectiveId },
        select: { tenantId: true, cycleId: true },
      });

      if (!objective) {
        throw new NotFoundException(`Objective with ID ${data.objectiveId} not found`);
      }

      // Tenant isolation: verify org match
      OkrTenantGuard.assertSameTenant(objective.tenantId, userOrganizationId);
      
      // Sync cycleId from parent Objective
      parentCycleId = objective.cycleId;
    }
    
    // If linked to KeyResult, validate it exists and optionally belongs to the Objective
    if (data.keyResultId) {
      const keyResult = await this.prisma.keyResult.findUnique({
        where: { id: data.keyResultId },
        select: {
          id: true,
          objectives: {
            select: {
              objectiveId: true,
              objective: {
                select: {
                  id: true,
                  tenantId: true,
                  cycleId: true,
                },
              },
            },
          },
        },
      });

      if (!keyResult) {
        throw new NotFoundException(`Key Result with ID ${data.keyResultId} not found`);
      }

      // IMPORTANT: If keyResultId is provided, do NOT also set objectiveId
      // The Objective relationship can be inferred from the KR's relationship
      // This avoids data redundancy and prevents confusion in rollups
      if (data.objectiveId) {
        // Remove objectiveId to avoid redundancy
        delete data.objectiveId;
      }

      // Tenant isolation: verify Key Result belongs to same tenant
      if (keyResult.objectives.length > 0) {
        const krObjective = keyResult.objectives[0].objective;
        if (krObjective) {
          OkrTenantGuard.assertSameTenant(krObjective.tenantId, userOrganizationId);
          // Use cycleId from KR's objective if we don't have one yet
          if (!parentCycleId && krObjective.cycleId) {
            parentCycleId = krObjective.cycleId;
          }
          // If we don't have an objective yet, use the KR's objective for tenantId
          if (!objective && krObjective.tenantId) {
            objective = { tenantId: krObjective.tenantId, cycleId: krObjective.cycleId };
          }
        }
      } else {
        // KeyResult has no linked objectives - this shouldn't happen in normal flow
        throw new BadRequestException(
          `Key Result ${data.keyResultId} is not linked to any Objective`
        );
      }
    }
    
    // Set cycleId from parent if not explicitly provided
    if (!data.cycleId && parentCycleId) {
      data.cycleId = parentCycleId;
    }

    // Set tenantId from parent Objective if available, otherwise use userOrganizationId
    // CRITICAL: tenantId is required for tenant isolation
    if (!data.tenantId) {
      if (objective?.tenantId) {
        data.tenantId = objective.tenantId;
      } else if (data.keyResultId) {
        // Get tenantId from parent KeyResult
        const keyResult = await this.prisma.keyResult.findUnique({
          where: { id: data.keyResultId },
          select: { tenantId: true },
        });
        if (keyResult?.tenantId) {
          data.tenantId = keyResult.tenantId;
        }
      }
      
      // Fallback to userOrganizationId if still not set
      if (!data.tenantId && userOrganizationId) {
        data.tenantId = userOrganizationId;
      }
    }
    
    // CRITICAL: tenantId is required - fail if still not set
    if (!data.tenantId) {
      throw new BadRequestException('tenantId is required for Initiative creation');
    }

    // Remove fields that don't exist on the Initiative model
    // tenantId is now a field, so keep it
    const { ...prismaData } = data;

    const created = await this.prisma.initiative.create({
      data: prismaData,
    });

    await this.auditLogService.record({
      action: 'CREATE_INITIATIVE',
      actorUserId: userId,
      targetId: created.id,
      targetType: AuditTargetType.OKR,
      tenantId: objective?.tenantId || undefined,
    });

    return created;
  }

  async update(id: string, data: any, userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get existing initiative to check tenant isolation
    const existing = await this.prisma.initiative.findUnique({
      where: { id },
      include: { 
        objective: {
          select: {
            tenantId: true,
            cycleId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    }

    // Tenant isolation: verify org match via parent objective
    if (existing.objectiveId) {
      const objective = existing.objective;
      OkrTenantGuard.assertSameTenant(objective?.tenantId, userOrganizationId);
    }
    
    // Sync cycleId when parent changes or if not set
    let parentCycleId: string | null = null;
    
    // Check new or existing objectiveId
    const objectiveId = data.objectiveId ?? existing.objectiveId;
    if (objectiveId) {
      const objective = await this.prisma.objective.findUnique({
        where: { id: objectiveId },
        select: { cycleId: true },
      });
      parentCycleId = objective?.cycleId ?? null;
    }
    
    // If linked to KeyResult (but not Objective), get cycleId via KR's objective
    if (!parentCycleId) {
      const keyResultId = data.keyResultId ?? existing.keyResultId;
      if (keyResultId) {
        const keyResult = await this.prisma.keyResult.findUnique({
          where: { id: keyResultId },
          select: {
            objectives: {
              select: {
                objective: {
                  select: {
                    cycleId: true,
                  },
                },
              },
              take: 1,
            },
          },
        });
        
        if (keyResult?.objectives[0]?.objective?.cycleId) {
          parentCycleId = keyResult.objectives[0].objective.cycleId;
        }
      }
    }
    
    // Update cycleId if parent provides one and it's not explicitly set in update
    if (!data.cycleId && parentCycleId) {
      data.cycleId = parentCycleId;
    }

    const updated = await this.prisma.initiative.update({
      where: { id },
      data,
    });

    await this.auditLogService.record({
      action: 'UPDATE_INITIATIVE',
      actorUserId: userId,
      targetId: id,
      targetType: AuditTargetType.OKR,
      tenantId: existing.objective?.tenantId || undefined,
    });

    return updated;
  }

  async delete(id: string, userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    try {
      // Get existing initiative to check tenant isolation
      const initiative = await this.prisma.initiative.findUnique({
        where: { id },
        include: { objective: true },
      });

      if (!initiative) {
        throw new NotFoundException(`Initiative with ID ${id} not found`);
      }

      // Tenant isolation: verify org match via parent objective
      if (initiative.objectiveId) {
        const objective = initiative.objective;
        OkrTenantGuard.assertSameTenant(objective?.tenantId, userOrganizationId);
      }

      await this.auditLogService.record({
        action: 'DELETE_INITIATIVE',
        actorUserId: userId,
        targetId: id,
        targetType: AuditTargetType.OKR,
        tenantId: initiative.objective?.tenantId || undefined,
      });

      // Delete initiative
      return await this.prisma.initiative.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Re-throw Prisma errors with more context
      throw new BadRequestException(
        `Failed to delete initiative: ${error.message || 'Unknown error'}`
      );
    }
  }
}
