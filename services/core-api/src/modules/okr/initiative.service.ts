import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';

@Injectable()
export class InitiativeService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
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

    // Validate objectiveId if provided
    if (data.objectiveId) {
      const objective = await this.prisma.objective.findUnique({
        where: { id: data.objectiveId },
      });

      if (!objective) {
        throw new NotFoundException(`Objective with ID ${data.objectiveId} not found`);
      }
    }

    return this.prisma.initiative.create({
      data,
    });
  }

  async update(id: string, data: any, _userId: string) {
    return this.prisma.initiative.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    try {
      // Check if initiative exists
      const initiative = await this.prisma.initiative.findUnique({
        where: { id },
      });

      if (!initiative) {
        throw new NotFoundException(`Initiative with ID ${id} not found`);
      }

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
