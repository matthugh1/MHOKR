import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { OkrTenantGuard } from './tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { ActivityService } from '../activity/activity.service';
import { AuditTargetType } from '@prisma/client';
import { OkrStateTransitionService } from './okr-state-transition.service';

@Injectable()
export class InitiativeService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private auditLogService: AuditLogService,
    private activityService: ActivityService,
    private stateTransitionService: OkrStateTransitionService,
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

    // Log activity for creation with full entity snapshot
    await this.activityService.createActivity({
      entityType: 'INITIATIVE',
      entityId: created.id,
      userId: userId,
      tenantId: created.tenantId,
      action: 'CREATED',
      metadata: {
        before: null, // No before state for creation
        after: {
          id: created.id,
          title: created.title,
          description: created.description,
          keyResultId: created.keyResultId,
          objectiveId: created.objectiveId,
          tenantId: created.tenantId,
          cycleId: created.cycleId,
          ownerId: created.ownerId,
          status: created.status,
          startDate: created.startDate,
          endDate: created.endDate,
          dueDate: created.dueDate,
          positionX: created.positionX,
          positionY: created.positionY,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for initiative creation:', err);
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

    // Get full entity snapshot BEFORE update for audit logging
    const initiativeBefore = await this.prisma.initiative.findUnique({
      where: { id },
    });

    if (!initiativeBefore) {
      throw new NotFoundException(`Initiative with ID ${id} not found`);
    }

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

    // Validate state transition if status is being changed
    if (data.status !== undefined && data.status !== initiativeBefore.status) {
      this.stateTransitionService.assertInitiativeStateTransition(
        initiativeBefore.status,
        data.status,
      );
    }

    const updated = await this.prisma.initiative.update({
      where: { id },
      data,
    });

    // Detect state changes
    const statusChanged = initiativeBefore.status !== updated.status;
    
    // Store status snapshot if status changed
    if (statusChanged) {
      await this.storeInitiativeStatusSnapshot(updated.id, updated.status, 'INITIATIVE_UPDATE');
    }
    
    let action = 'UPDATED';
    if (statusChanged && updated.status === 'COMPLETED') {
      action = 'COMPLETED';
    } else if (statusChanged && updated.status === 'BLOCKED') {
      action = 'UPDATED'; // Keep as UPDATED, but track statusChanged in metadata
    }

    // Emit STATE_CHANGE activity if status changed
    if (statusChanged) {
      await this.activityService.createActivity({
        entityType: 'INITIATIVE',
        entityId: updated.id,
        userId: userId,
        tenantId: updated.tenantId,
        action: 'STATE_CHANGE',
        metadata: {
          from: initiativeBefore.status,
          to: updated.status,
        },
      }).catch(err => {
        console.error('Failed to log STATE_CHANGE activity:', err);
      });
    }

    // Log activity for update with full entity snapshots
    await this.activityService.createActivity({
      entityType: 'INITIATIVE',
      entityId: updated.id,
      userId: userId,
      tenantId: updated.tenantId,
      action: action,
      metadata: {
        statusChanged: statusChanged,
        before: {
          id: initiativeBefore.id,
          title: initiativeBefore.title,
          description: initiativeBefore.description,
          keyResultId: initiativeBefore.keyResultId,
          objectiveId: initiativeBefore.objectiveId,
          tenantId: initiativeBefore.tenantId,
          cycleId: initiativeBefore.cycleId,
          ownerId: initiativeBefore.ownerId,
          status: initiativeBefore.status,
          startDate: initiativeBefore.startDate,
          endDate: initiativeBefore.endDate,
          dueDate: initiativeBefore.dueDate,
          positionX: initiativeBefore.positionX,
          positionY: initiativeBefore.positionY,
          createdAt: initiativeBefore.createdAt,
          updatedAt: initiativeBefore.updatedAt,
        },
        after: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          keyResultId: updated.keyResultId,
          objectiveId: updated.objectiveId,
          tenantId: updated.tenantId,
          cycleId: updated.cycleId,
          ownerId: updated.ownerId,
          status: updated.status,
          startDate: updated.startDate,
          endDate: updated.endDate,
          dueDate: updated.dueDate,
          positionX: updated.positionX,
          positionY: updated.positionY,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      },
    }).catch(err => {
      // Log error but don't fail the request
      console.error('Failed to log activity for initiative update:', err);
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
      // Get full entity snapshot BEFORE deletion for audit logging
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

      // Log activity for deletion (before deletion) with full entity snapshot
      await this.activityService.createActivity({
        entityType: 'INITIATIVE',
        entityId: initiative.id,
        userId: userId,
        tenantId: initiative.tenantId,
        action: 'DELETED',
        metadata: {
          before: {
            id: initiative.id,
            title: initiative.title,
            description: initiative.description,
            keyResultId: initiative.keyResultId,
            objectiveId: initiative.objectiveId,
            tenantId: initiative.tenantId,
            cycleId: initiative.cycleId,
            ownerId: initiative.ownerId,
            status: initiative.status,
            startDate: initiative.startDate,
            endDate: initiative.endDate,
            dueDate: initiative.dueDate,
            positionX: initiative.positionX,
            positionY: initiative.positionY,
            createdAt: initiative.createdAt,
            updatedAt: initiative.updatedAt,
          },
          after: null, // No after state for deletion
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Failed to log activity for initiative deletion:', err);
      });

      await this.auditLogService.record({
        action: 'initiative_deleted',
        actorUserId: userId,
        targetId: id,
        targetType: AuditTargetType.OKR,
        tenantId: initiative.objective?.tenantId || undefined,
        metadata: {
          title: initiative.title,
          ownerId: initiative.ownerId,
          objectiveId: initiative.objectiveId,
          keyResultId: initiative.keyResultId,
        },
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

  // ==========================================
  // Tags Management
  // ==========================================

  /**
   * Add a tag to an Initiative
   */
  async addTag(
    initiativeId: string,
    tagId: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load initiative with tenantId for isolation check
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, tenantId: true },
    });

    if (!initiative) {
      throw new NotFoundException(`Initiative with ID ${initiativeId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(initiative.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, initiativeId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Initiative');
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

    // Check if tag already exists on initiative
    const existing = await this.prisma.initiativeTag.findUnique({
      where: {
        tenantId_initiativeId_tagId: {
          tenantId: initiative.tenantId!,
          initiativeId,
          tagId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException({
        message: `Tag "${tag.name}" is already assigned to this Initiative`,
        code: 'DUPLICATE_TAG',
      });
    }

    // Create tag link
    const initiativeTag = await this.prisma.initiativeTag.create({
      data: {
        tenantId: initiative.tenantId!,
        initiativeId,
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
      entityType: 'INITIATIVE',
      entityId: initiativeId,
      userId: userId,
      tenantId: initiative.tenantId!,
      action: 'TAG_ADDED',
      metadata: {
        tagId: tag.id,
        tagName: tag.name,
      },
    }).catch(err => {
      console.error('Failed to log activity for tag addition:', err);
    });

    return {
      id: initiativeTag.id,
      tag: initiativeTag.tag,
      createdAt: initiativeTag.createdAt,
    };
  }

  /**
   * Remove a tag from an Initiative
   */
  async removeTag(
    initiativeId: string,
    tagId: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load initiative with tenantId for isolation check
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, tenantId: true },
    });

    if (!initiative) {
      throw new NotFoundException(`Initiative with ID ${initiativeId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(initiative.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, initiativeId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Initiative');
    }

    // Load tag for activity log
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, name: true },
    });

    // Find and delete tag link
    const initiativeTag = await this.prisma.initiativeTag.findUnique({
      where: {
        tenantId_initiativeId_tagId: {
          tenantId: initiative.tenantId!,
          initiativeId,
          tagId,
        },
      },
    });

    if (!initiativeTag) {
      throw new NotFoundException({
        message: `Tag is not assigned to this Initiative`,
        code: 'TAG_NOT_FOUND',
      });
    }

    await this.prisma.initiativeTag.delete({
      where: { id: initiativeTag.id },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'INITIATIVE',
      entityId: initiativeId,
      userId: userId,
      tenantId: initiative.tenantId!,
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
   * List tags for an Initiative
   */
  async listTags(
    initiativeId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load initiative with tenantId for isolation check
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, tenantId: true },
    });

    if (!initiative) {
      throw new NotFoundException(`Initiative with ID ${initiativeId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(initiative.tenantId, userTenantId);

    const tags = await this.prisma.initiativeTag.findMany({
      where: {
        initiativeId,
        tenantId: initiative.tenantId!,
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

    return tags.map(it => ({
      id: it.tag.id,
      name: it.tag.name,
      color: it.tag.color,
      addedAt: it.createdAt,
      addedBy: it.createdBy,
    }));
  }

  // ==========================================
  // Contributors Management
  // ==========================================

  /**
   * Add a contributor to an Initiative
   */
  async addContributor(
    initiativeId: string,
    userIdToAdd: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load initiative with tenantId for isolation check
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, tenantId: true },
    });

    if (!initiative) {
      throw new NotFoundException(`Initiative with ID ${initiativeId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(initiative.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, initiativeId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Initiative');
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
    const existing = await this.prisma.initiativeContributor.findUnique({
      where: {
        tenantId_initiativeId_userId: {
          tenantId: initiative.tenantId!,
          initiativeId,
          userId: userIdToAdd,
        },
      },
    });

    if (existing) {
      throw new BadRequestException({
        message: `User is already a contributor to this Initiative`,
        code: 'DUPLICATE_CONTRIBUTOR',
      });
    }

    // Create contributor link
    const contributor = await this.prisma.initiativeContributor.create({
      data: {
        tenantId: initiative.tenantId!,
        initiativeId,
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
      entityType: 'INITIATIVE',
      entityId: initiativeId,
      userId: userId,
      tenantId: initiative.tenantId!,
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
   * Remove a contributor from an Initiative
   */
  async removeContributor(
    initiativeId: string,
    userIdToRemove: string,
    userId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load initiative with tenantId for isolation check
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, tenantId: true },
    });

    if (!initiative) {
      throw new NotFoundException(`Initiative with ID ${initiativeId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(initiative.tenantId, userTenantId);

    // Check RBAC permission
    const canEdit = await this.canEdit(userId, initiativeId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this Initiative');
    }

    // Load user for activity log
    const userToRemove = await this.prisma.user.findUnique({
      where: { id: userIdToRemove },
      select: { id: true, email: true, name: true },
    });

    // Find and delete contributor link
    const contributor = await this.prisma.initiativeContributor.findUnique({
      where: {
        tenantId_initiativeId_userId: {
          tenantId: initiative.tenantId!,
          initiativeId,
          userId: userIdToRemove,
        },
      },
    });

    if (!contributor) {
      throw new NotFoundException({
        message: `User is not a contributor to this Initiative`,
        code: 'CONTRIBUTOR_NOT_FOUND',
      });
    }

    await this.prisma.initiativeContributor.delete({
      where: { id: contributor.id },
    });

    // Emit Activity log
    await this.activityService.createActivity({
      entityType: 'INITIATIVE',
      entityId: initiativeId,
      userId: userId,
      tenantId: initiative.tenantId!,
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
   * List contributors for an Initiative
   */
  async listContributors(
    initiativeId: string,
    userTenantId: string | null | undefined,
  ) {
    // Load initiative with tenantId for isolation check
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      select: { id: true, tenantId: true },
    });

    if (!initiative) {
      throw new NotFoundException(`Initiative with ID ${initiativeId} not found`);
    }

    // Enforce tenant isolation
    OkrTenantGuard.assertSameTenant(initiative.tenantId, userTenantId);

    const contributors = await this.prisma.initiativeContributor.findMany({
      where: {
        initiativeId,
        tenantId: initiative.tenantId!,
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
   * Store a status snapshot for Initiative historical tracking.
   * 
   * Creates a snapshot record of Initiative status at a specific point in time.
   * Used for trend analysis and historical status visualization.
   * 
   * @param initiativeId - The Initiative ID
   * @param status - Status value
   * @param triggeredBy - What triggered this snapshot (e.g., "INITIATIVE_UPDATE", "MANUAL_CHANGE")
   */
  private async storeInitiativeStatusSnapshot(
    initiativeId: string,
    status: string,
    triggeredBy: string = 'INITIATIVE_UPDATE',
  ): Promise<void> {
    try {
      await this.prisma.initiativeStatusSnapshot.create({
        data: {
          initiativeId,
          status: status as any,
          triggeredBy,
        },
      });
    } catch (error) {
      // Log error but don't fail the operation if snapshot storage fails
      console.error(`Failed to store status snapshot for initiative ${initiativeId}:`, error);
    }
  }

  /**
   * Get status trend data for an Initiative.
   * 
   * Returns historical status snapshots ordered by timestamp (ASC).
   * Tenant isolation: Verifies Initiative belongs to user's tenant.
   * 
   * @param initiativeId - Initiative ID
   * @param userTenantId - User's tenant ID for isolation check
   * @returns Array of trend points with timestamp and status
   */
  async getStatusTrend(
    initiativeId: string,
    userTenantId: string | null | undefined,
  ): Promise<Array<{
    timestamp: string;
    status: string;
    triggeredBy: string | null;
  }>> {
    // Tenant isolation: enforce read rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId);

    // Verify initiative exists and get tenant ID
    const initiative = await this.prisma.initiative.findUnique({
      where: { id: initiativeId },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!initiative) {
      throw new NotFoundException(`Initiative with ID ${initiativeId} not found`);
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(initiative.tenantId, userTenantId);

    // Fetch status snapshots ordered by timestamp (ASC)
    const snapshots = await this.prisma.initiativeStatusSnapshot.findMany({
      where: {
        initiativeId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        createdAt: true,
        status: true,
        triggeredBy: true,
      },
    });

    return snapshots.map(snapshot => ({
      timestamp: snapshot.createdAt.toISOString(),
      status: snapshot.status,
      triggeredBy: snapshot.triggeredBy,
    }));
  }
}
