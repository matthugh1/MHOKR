import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { calculateProgress } from '@okr-nexus/utils';

@Injectable()
export class KeyResultService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
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
   */
  async canEdit(userId: string, keyResultId: string): Promise<boolean> {
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

    // Owner can always edit
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
   */
  async canDelete(userId: string, keyResultId: string): Promise<boolean> {
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

    // Owner can delete
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

  async create(data: any, _userId: string) {
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

    // Validate objective exists if provided
    if (data.objectiveId) {
      const objective = await this.prisma.objective.findUnique({
        where: { id: data.objectiveId },
      });

      if (!objective) {
        throw new NotFoundException(`Objective with ID ${data.objectiveId} not found`);
      }
    }

    return this.prisma.keyResult.create({
      data,
    });
  }

  async update(id: string, data: any, _userId: string) {
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

    return this.prisma.keyResult.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    try {
      // Check if key result exists
      const keyResult = await this.prisma.keyResult.findUnique({
        where: { id },
      });

      if (!keyResult) {
        throw new NotFoundException(`Key Result with ID ${id} not found`);
      }

      // Delete key result (cascades will handle junction table and check-ins)
      return await this.prisma.keyResult.delete({
        where: { id },
      });
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

  async createCheckIn(keyResultId: string, data: { userId: string; value: number; confidence: number; note?: string; blockers?: string }) {
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
    }

    return checkIn;
  }
}
