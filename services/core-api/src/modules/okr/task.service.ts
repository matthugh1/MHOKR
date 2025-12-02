import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { OkrTenantGuard } from './tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { ActivityService } from '../activity/activity.service';
import { AuditTargetType } from '@prisma/client';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private auditLogService: AuditLogService,
    private activityService: ActivityService,
  ) {}

  async findAll(_userId: string, keyResultId?: string, initiativeId?: string) {
    const where: any = {};
    
    if (keyResultId) {
      where.keyResultId = keyResultId;
    }
    
    if (initiativeId) {
      where.initiativeId = initiativeId;
    }

    return this.prisma.task.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        keyResult: {
          include: {
            objectives: {
              take: 1,
              select: {
                objective: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        initiative: {
          include: {
            objective: {
              select: {
                id: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        keyResult: {
          include: {
            objectives: {
              take: 1,
              select: {
                objective: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        initiative: {
          include: {
            objective: {
              select: {
                id: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Check if user can view a task (via parent KR or Initiative)
   */
  async canView(userId: string, taskId: string): Promise<boolean> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        keyResult: {
          include: {
            objectives: {
              take: 1,
              select: {
                objective: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        initiative: {
          include: {
            objective: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return false;
    }

    // Owner can always view
    if (task.ownerId === userId) {
      return true;
    }

    // Check access via parent Key Result
    if (task.keyResultId && task.keyResult?.objectives.length > 0) {
      try {
        const objectiveId = task.keyResult.objectives[0].objective.id;
        const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
        return this.rbacService.canPerformAction(userId, 'view_okr', resourceContext);
      } catch {
        return false;
      }
    }

    // Check access via parent Initiative
    if (task.initiativeId && task.initiative?.objectiveId) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, task.initiative.objectiveId);
        return this.rbacService.canPerformAction(userId, 'view_okr', resourceContext);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if user can edit a task (via parent KR or Initiative)
   */
  async canEdit(userId: string, taskId: string): Promise<boolean> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        keyResult: {
          include: {
            objectives: {
              take: 1,
              select: {
                objective: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        initiative: {
          include: {
            objective: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return false;
    }

    // Owner can always edit
    if (task.ownerId === userId) {
      return true;
    }

    // Check edit access via parent Key Result
    if (task.keyResultId && task.keyResult?.objectives.length > 0) {
      try {
        const objectiveId = task.keyResult.objectives[0].objective.id;
        const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
        return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
      } catch {
        return false;
      }
    }

    // Check edit access via parent Initiative
    if (task.initiativeId && task.initiative?.objectiveId) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, task.initiative.objectiveId);
        return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if user can delete a task (via parent KR or Initiative)
   */
  async canDelete(userId: string, taskId: string): Promise<boolean> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        keyResult: {
          include: {
            objectives: {
              take: 1,
              select: {
                objective: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        initiative: {
          include: {
            objective: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return false;
    }

    // Owner can delete
    if (task.ownerId === userId) {
      return true;
    }

    // Check delete access via parent Key Result
    if (task.keyResultId && task.keyResult?.objectives.length > 0) {
      try {
        const objectiveId = task.keyResult.objectives[0].objective.id;
        const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
        return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
      } catch {
        return false;
      }
    }

    // Check delete access via parent Initiative
    if (task.initiativeId && task.initiative?.objectiveId) {
      try {
        const resourceContext = await buildResourceContextFromOKR(this.prisma, task.initiative.objectiveId);
        return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if user can edit the parent Key Result or Initiative
   */
  async canEditParent(userId: string, keyResultId?: string, initiativeId?: string): Promise<boolean> {
    if (keyResultId) {
      const keyResult = await this.prisma.keyResult.findUnique({
        where: { id: keyResultId },
        include: {
          objectives: {
            take: 1,
            select: {
              objectiveId: true,
            },
          },
        },
      });

      if (keyResult && keyResult.objectives.length > 0) {
        try {
          const resourceContext = await buildResourceContextFromOKR(this.prisma, keyResult.objectives[0].objectiveId);
          return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
        } catch {
          return false;
        }
      }
    }

    if (initiativeId) {
      const initiative = await this.prisma.initiative.findUnique({
        where: { id: initiativeId },
        select: {
          objectiveId: true,
        },
      });

      if (initiative?.objectiveId) {
        try {
          const resourceContext = await buildResourceContextFromOKR(this.prisma, initiative.objectiveId);
          return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
        } catch {
          return false;
        }
      }
    }

    return false;
  }

  async create(data: any, userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Validate that at least one parent is provided
    if (!data.keyResultId && !data.initiativeId) {
      throw new BadRequestException('At least one of keyResultId or initiativeId must be provided');
    }

    // Validate required fields
    if (!data.title) {
      throw new BadRequestException('title is required');
    }

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

    // Validate Key Result if provided
    let keyResultTenantId: string | null = null;
    if (data.keyResultId) {
      const keyResult = await this.prisma.keyResult.findUnique({
        where: { id: data.keyResultId },
        include: {
          objectives: {
            take: 1,
            select: {
              objective: {
                select: {
                  tenantId: true,
                },
              },
            },
          },
        },
      });

      if (!keyResult) {
        throw new NotFoundException(`Key Result with ID ${data.keyResultId} not found`);
      }

      // Get tenantId from Key Result's objective
      if (keyResult.objectives.length > 0) {
        keyResultTenantId = keyResult.objectives[0].objective.tenantId;
      } else {
        // Fallback to Key Result's tenantId if no objectives
        keyResultTenantId = keyResult.tenantId;
      }
    }

    // Validate Initiative if provided
    let initiativeTenantId: string | null = null;
    if (data.initiativeId) {
      const initiative = await this.prisma.initiative.findUnique({
        where: { id: data.initiativeId },
        select: {
          tenantId: true,
        },
      });

      if (!initiative) {
        throw new NotFoundException(`Initiative with ID ${data.initiativeId} not found`);
      }

      initiativeTenantId = initiative.tenantId;
    }

    // Determine tenantId from parent
    let tenantId: string | null = null;
    if (keyResultTenantId) {
      tenantId = keyResultTenantId;
    } else if (initiativeTenantId) {
      tenantId = initiativeTenantId;
    } else if (userOrganizationId) {
      tenantId = userOrganizationId;
    }

    // CRITICAL: tenantId is required
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for Task creation');
    }

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(tenantId, userOrganizationId);

    // Auto-populate createdBy from userId if not provided
    if (!data.createdBy) {
      data.createdBy = userId;
    }

    // Set default status if not provided
    if (!data.status) {
      data.status = 'NOT_STARTED';
    }

    // Set tenantId
    data.tenantId = tenantId;

    const created = await this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        ownerId: data.ownerId,
        keyResultId: data.keyResultId,
        initiativeId: data.initiativeId,
        tenantId: data.tenantId,
        createdBy: data.createdBy,
        status: data.status,
        dueDate: data.dueDate,
      },
    });

    // Log activity for creation
    await this.activityService.createActivity({
      entityType: 'TASK',
      entityId: created.id,
      userId: userId,
      tenantId: created.tenantId,
      action: 'CREATED',
      metadata: {
        before: null,
        after: {
          id: created.id,
          title: created.title,
          description: created.description,
          keyResultId: created.keyResultId,
          initiativeId: created.initiativeId,
          tenantId: created.tenantId,
          ownerId: created.ownerId,
          createdBy: created.createdBy,
          status: created.status,
          dueDate: created.dueDate,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      },
    }).catch(err => {
      this.logger.error('Failed to log activity for task creation', { error: err });
    });

    await this.auditLogService.record({
      action: 'CREATE_TASK',
      actorUserId: userId,
      targetId: created.id,
      targetType: AuditTargetType.OKR,
      tenantId: tenantId || undefined,
    });

    return created;
  }

  async update(id: string, data: any, userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Get full entity snapshot BEFORE update for audit logging
    const taskBefore = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!taskBefore) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Get existing task to check tenant isolation
    const existing = await this.prisma.task.findUnique({
      where: { id },
      include: {
        keyResult: {
          include: {
            objectives: {
              take: 1,
              select: {
                objective: {
                  select: {
                    tenantId: true,
                  },
                },
              },
            },
          },
        },
        initiative: {
          include: {
            objective: {
              select: {
                tenantId: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Tenant isolation: verify org match via parent
    let parentTenantId: string | null = null;
    if (existing.keyResultId && existing.keyResult?.objectives.length > 0) {
      parentTenantId = existing.keyResult.objectives[0].objective.tenantId;
    } else if (existing.initiativeId && existing.initiative?.objectiveId) {
      parentTenantId = existing.initiative.objective?.tenantId || null;
    } else {
      parentTenantId = existing.tenantId;
    }

    OkrTenantGuard.assertSameTenant(parentTenantId, userOrganizationId);

    // Validate owner if being changed
    if (data.ownerId) {
      if (data.ownerId === 'temp-user' || data.ownerId === 'default') {
        throw new BadRequestException('Invalid ownerId: Please select a valid owner');
      }

      const owner = await this.prisma.user.findUnique({
        where: { id: data.ownerId },
      });

      if (!owner) {
        throw new NotFoundException(`User with ID ${data.ownerId} not found`);
      }
    }

    // Validate Key Result if being changed
    if (data.keyResultId !== undefined) {
      if (data.keyResultId === null && !data.initiativeId && !existing.initiativeId) {
        throw new BadRequestException('At least one of keyResultId or initiativeId must be provided');
      }

      if (data.keyResultId) {
        const keyResult = await this.prisma.keyResult.findUnique({
          where: { id: data.keyResultId },
          select: {
            tenantId: true,
          },
        });

        if (!keyResult) {
          throw new NotFoundException(`Key Result with ID ${data.keyResultId} not found`);
        }

        OkrTenantGuard.assertSameTenant(keyResult.tenantId, userOrganizationId);
      }
    }

    // Validate Initiative if being changed
    if (data.initiativeId !== undefined) {
      if (data.initiativeId === null && !data.keyResultId && !existing.keyResultId) {
        throw new BadRequestException('At least one of keyResultId or initiativeId must be provided');
      }

      if (data.initiativeId) {
        const initiative = await this.prisma.initiative.findUnique({
          where: { id: data.initiativeId },
          select: {
            tenantId: true,
          },
        });

        if (!initiative) {
          throw new NotFoundException(`Initiative with ID ${data.initiativeId} not found`);
        }

        OkrTenantGuard.assertSameTenant(initiative.tenantId, userOrganizationId);
      }
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        ownerId: data.ownerId,
        keyResultId: data.keyResultId,
        initiativeId: data.initiativeId,
        status: data.status,
        dueDate: data.dueDate,
      },
    });

    // Log activity for update
    await this.activityService.createActivity({
      entityType: 'TASK',
      entityId: updated.id,
      userId: userId,
      tenantId: updated.tenantId,
      action: 'UPDATED',
      metadata: {
        before: {
          id: taskBefore.id,
          title: taskBefore.title,
          description: taskBefore.description,
          keyResultId: taskBefore.keyResultId,
          initiativeId: taskBefore.initiativeId,
          ownerId: taskBefore.ownerId,
          status: taskBefore.status,
          dueDate: taskBefore.dueDate,
        },
        after: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          keyResultId: updated.keyResultId,
          initiativeId: updated.initiativeId,
          ownerId: updated.ownerId,
          status: updated.status,
          dueDate: updated.dueDate,
        },
      },
    }).catch(err => {
      this.logger.error('Failed to log activity for task update', { error: err });
    });

    await this.auditLogService.record({
      action: 'UPDATE_TASK',
      actorUserId: userId,
      targetId: updated.id,
      targetType: AuditTargetType.OKR,
      tenantId: parentTenantId || undefined,
    });

    return updated;
  }

  async delete(id: string, userId: string, userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        keyResult: {
          include: {
            objectives: {
              take: 1,
              select: {
                objective: {
                  select: {
                    tenantId: true,
                  },
                },
              },
            },
          },
        },
        initiative: {
          include: {
            objective: {
              select: {
                tenantId: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Tenant isolation: verify org match via parent
    let parentTenantId: string | null = null;
    if (task.keyResultId && task.keyResult?.objectives.length > 0) {
      parentTenantId = task.keyResult.objectives[0].objective.tenantId;
    } else if (task.initiativeId && task.initiative?.objectiveId) {
      parentTenantId = task.initiative.objective?.tenantId || null;
    } else {
      parentTenantId = task.tenantId;
    }

    OkrTenantGuard.assertSameTenant(parentTenantId, userOrganizationId);

    await this.prisma.task.delete({
      where: { id },
    });

    // Log activity for deletion
    await this.activityService.createActivity({
      entityType: 'TASK',
      entityId: id,
      userId: userId,
      tenantId: task.tenantId,
      action: 'DELETED',
      metadata: {
        before: {
          id: task.id,
          title: task.title,
          description: task.description,
          keyResultId: task.keyResultId,
          initiativeId: task.initiativeId,
          ownerId: task.ownerId,
          status: task.status,
          dueDate: task.dueDate,
        },
        after: null,
      },
    }).catch(err => {
      this.logger.error('Failed to log activity for task deletion', { error: err });
    });

    await this.auditLogService.record({
      action: 'DELETE_TASK',
      actorUserId: userId,
      targetId: id,
      targetType: AuditTargetType.OKR,
      tenantId: parentTenantId || undefined,
    });

    return { success: true };
  }
}

