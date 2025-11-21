import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';
import { PhasedTargetInterval } from '@prisma/client';

export interface CreatePhasedTargetDto {
  objectiveId?: string;
  keyResultId?: string;
  interval: PhasedTargetInterval;
  targetValue: number;
  targetDate: string | Date;
  order: number;
}

export interface UpdatePhasedTargetDto {
  interval?: PhasedTargetInterval;
  targetValue?: number;
  targetDate?: string | Date;
  order?: number;
}

/**
 * Phased Target Service
 * 
 * Manages phased targets (milestones) for Objectives and Key Results.
 * Phased targets allow setting intermediate goals with target values and dates.
 */
@Injectable()
export class PhasedTargetService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a phased target for an Objective or Key Result
   */
  async create(
    dto: CreatePhasedTargetDto,
    tenantId: string,
  ) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Validation: Must belong to either Objective or Key Result (not both, not neither)
    if (!dto.objectiveId && !dto.keyResultId) {
      throw new BadRequestException('Phased target must belong to either an Objective or Key Result');
    }
    if (dto.objectiveId && dto.keyResultId) {
      throw new BadRequestException('Phased target cannot belong to both an Objective and Key Result');
    }

    // Verify Objective or Key Result exists and belongs to tenant
    if (dto.objectiveId) {
      const objective = await this.prisma.objective.findFirst({
        where: {
          id: dto.objectiveId,
          tenantId,
        },
      });
      if (!objective) {
        throw new NotFoundException(`Objective with ID ${dto.objectiveId} not found`);
      }

      // Validate target date is within Objective date range
      const targetDate = new Date(dto.targetDate);
      if (targetDate < objective.startDate || targetDate > objective.endDate) {
        throw new BadRequestException(
          `Target date must be within Objective date range (${objective.startDate.toISOString()} to ${objective.endDate.toISOString()})`
        );
      }
    }

    if (dto.keyResultId) {
      const keyResult = await this.prisma.keyResult.findFirst({
        where: {
          id: dto.keyResultId,
          tenantId,
        },
      });
      if (!keyResult) {
        throw new NotFoundException(`Key Result with ID ${dto.keyResultId} not found`);
      }

      // Validate target date is within Key Result date range (if set)
      if (keyResult.startDate && keyResult.endDate) {
        const targetDate = new Date(dto.targetDate);
        if (targetDate < keyResult.startDate || targetDate > keyResult.endDate) {
          throw new BadRequestException(
            `Target date must be within Key Result date range (${keyResult.startDate.toISOString()} to ${keyResult.endDate.toISOString()})`
          );
        }
      }

      // Validate target value is within Key Result value range
      const minValue = Math.min(keyResult.startValue, keyResult.targetValue);
      const maxValue = Math.max(keyResult.startValue, keyResult.targetValue);
      if (dto.targetValue < minValue || dto.targetValue > maxValue) {
        throw new BadRequestException(
          `Target value must be within Key Result value range (${minValue} to ${maxValue})`
        );
      }
    }

    return this.prisma.phasedTarget.create({
      data: {
        tenantId,
        objectiveId: dto.objectiveId || null,
        keyResultId: dto.keyResultId || null,
        interval: dto.interval,
        targetValue: dto.targetValue,
        targetDate: new Date(dto.targetDate),
        order: dto.order,
      },
    });
  }

  /**
   * Get all phased targets for an Objective
   */
  async findByObjective(objectiveId: string, tenantId: string) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Verify objective exists
    const objective = await this.prisma.objective.findFirst({
      where: {
        id: objectiveId,
        tenantId,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    return this.prisma.phasedTarget.findMany({
      where: {
        objectiveId,
        tenantId,
      },
      orderBy: [
        { order: 'asc' },
        { targetDate: 'asc' },
      ],
    });
  }

  /**
   * Get all phased targets for a Key Result
   */
  async findByKeyResult(keyResultId: string, tenantId: string) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Verify key result exists
    const keyResult = await this.prisma.keyResult.findFirst({
      where: {
        id: keyResultId,
        tenantId,
      },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    return this.prisma.phasedTarget.findMany({
      where: {
        keyResultId,
        tenantId,
      },
      orderBy: [
        { order: 'asc' },
        { targetDate: 'asc' },
      ],
    });
  }

  /**
   * Get a phased target by ID
   */
  async findById(id: string, tenantId: string) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    const phasedTarget = await this.prisma.phasedTarget.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!phasedTarget) {
      throw new NotFoundException(`Phased target with ID ${id} not found`);
    }

    return phasedTarget;
  }

  /**
   * Update a phased target
   */
  async update(
    id: string,
    dto: UpdatePhasedTargetDto,
    tenantId: string,
  ) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    const existing = await this.findById(id, tenantId);

    // If updating target date or value, validate against parent OKR
    if (dto.targetDate || dto.targetValue) {
      if (existing.objectiveId) {
        const objective = await this.prisma.objective.findFirst({
          where: {
            id: existing.objectiveId,
            tenantId,
          },
        });
        if (objective) {
          const targetDate = dto.targetDate ? new Date(dto.targetDate) : existing.targetDate;
          if (targetDate < objective.startDate || targetDate > objective.endDate) {
            throw new BadRequestException(
              `Target date must be within Objective date range (${objective.startDate.toISOString()} to ${objective.endDate.toISOString()})`
            );
          }
        }
      }

      if (existing.keyResultId) {
        const keyResult = await this.prisma.keyResult.findFirst({
          where: {
            id: existing.keyResultId,
            tenantId,
          },
        });
        if (keyResult) {
          if (keyResult.startDate && keyResult.endDate) {
            const targetDate = dto.targetDate ? new Date(dto.targetDate) : existing.targetDate;
            if (targetDate < keyResult.startDate || targetDate > keyResult.endDate) {
              throw new BadRequestException(
                `Target date must be within Key Result date range (${keyResult.startDate.toISOString()} to ${keyResult.endDate.toISOString()})`
              );
            }
          }

          if (dto.targetValue !== undefined) {
            const minValue = Math.min(keyResult.startValue, keyResult.targetValue);
            const maxValue = Math.max(keyResult.startValue, keyResult.targetValue);
            if (dto.targetValue < minValue || dto.targetValue > maxValue) {
              throw new BadRequestException(
                `Target value must be within Key Result value range (${minValue} to ${maxValue})`
              );
            }
          }
        }
      }
    }

    return this.prisma.phasedTarget.update({
      where: { id },
      data: {
        ...(dto.interval && { interval: dto.interval }),
        ...(dto.targetValue !== undefined && { targetValue: dto.targetValue }),
        ...(dto.targetDate && { targetDate: new Date(dto.targetDate) }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  /**
   * Delete a phased target
   */
  async delete(id: string, tenantId: string) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    await this.findById(id, tenantId); // Verify exists

    await this.prisma.phasedTarget.delete({
      where: { id },
    });
  }
}

