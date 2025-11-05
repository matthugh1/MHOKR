import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';
import { CycleGeneratorService } from './cycle-generator.service';

export interface CreateCycleDto {
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  status?: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';
}

export interface UpdateCycleDto {
  name?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  status?: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';
}

export interface CycleSummaryDto {
  cycleId: string;
  objectivesCount: number;
  publishedCount: number;
  draftCount: number;
}

@Injectable()
export class OkrCycleService {
  constructor(
    private prisma: PrismaService,
    public cycleGenerator: CycleGeneratorService, // Made public for controller access
  ) {}

  /**
   * Get all cycles for a tenant, ordered by startDate DESC
   * Returns both standard and custom cycles
   */
  async findAll(organizationId: string): Promise<any[]> {
    OkrTenantGuard.assertCanMutateTenant(organizationId);

    return this.prisma.cycle.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * Get a single cycle by ID
   */
  async findById(id: string, organizationId: string): Promise<any> {
    OkrTenantGuard.assertCanMutateTenant(organizationId);

    const cycle = await this.prisma.cycle.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            objectives: true,
            keyResults: true,
            initiatives: true,
          },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${id} not found`);
    }

    // Ensure cycle belongs to the same tenant
    if (cycle.organizationId !== organizationId) {
      throw new ForbiddenException('Cycle does not belong to your organization');
    }

    return cycle;
  }

  /**
   * Create a new cycle
   */
  async create(data: CreateCycleDto, organizationId: string): Promise<any> {
    OkrTenantGuard.assertCanMutateTenant(organizationId);

    // Validate dates
    const startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
    const endDate = typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate;

    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start date');
    }
    if (isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid end date');
    }

    // Validate date order
    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Check for overlapping cycles
    await this.validateNoOverlap(organizationId, startDate, endDate, null);

    // Create cycle (mark as custom since it's manually created)
    return this.prisma.cycle.create({
      data: {
        organizationId,
        name: data.name,
        startDate,
        endDate,
        status: data.status || 'DRAFT',
        isStandard: false, // Manually created cycles are custom
      } as any, // Type assertion needed until Prisma client is regenerated
    });
  }

  /**
   * Update a cycle
   */
  async update(
    id: string,
    data: UpdateCycleDto,
    organizationId: string,
  ): Promise<any> {
    OkrTenantGuard.assertCanMutateTenant(organizationId);

    // Fetch existing cycle
    const cycle = await this.findById(id, organizationId);

    // Prepare update data
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.startDate !== undefined) {
      updateData.startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate;
    }
    if (data.status !== undefined) {
      // Validate status transition
      this.validateStatusTransition(cycle.status, data.status);
      updateData.status = data.status;
    }

    // Validate dates if provided
    const startDate = updateData.startDate || cycle.startDate;
    const endDate = updateData.endDate || cycle.endDate;

    if (startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Check for overlapping cycles (excluding current cycle)
    if (updateData.startDate || updateData.endDate) {
      await this.validateNoOverlap(organizationId, startDate, endDate, id);
    }

    // Update cycle
    return this.prisma.cycle.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update cycle status only
   */
  async updateStatus(
    id: string,
    status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED',
    organizationId: string,
  ): Promise<any> {
    OkrTenantGuard.assertCanMutateTenant(organizationId);

    const cycle = await this.findById(id, organizationId);
    this.validateStatusTransition(cycle.status, status);

    return this.prisma.cycle.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete a cycle (only if no linked OKRs)
   */
  async delete(id: string, organizationId: string): Promise<void> {
    OkrTenantGuard.assertCanMutateTenant(organizationId);

    // Validate cycle exists and belongs to organization
    await this.findById(id, organizationId);

    // Check for linked objectives
    const objectiveCount = await this.prisma.objective.count({
      where: { cycleId: id },
    });

    if (objectiveCount > 0) {
      throw new BadRequestException(
        `Cannot delete cycle: ${objectiveCount} objective(s) are linked to this cycle`,
      );
    }

    // Delete cycle
    await this.prisma.cycle.delete({
      where: { id },
    });
  }

  /**
   * Get cycle summary (objectives count, published count, etc.)
   */
  async getSummary(id: string, organizationId: string): Promise<CycleSummaryDto> {
    OkrTenantGuard.assertCanMutateTenant(organizationId);

    // Validate cycle exists and belongs to organization
    await this.findById(id, organizationId);

    const objectivesCount = await this.prisma.objective.count({
      where: { cycleId: id },
    });

    const publishedCount = await this.prisma.objective.count({
      where: {
        cycleId: id,
        isPublished: true,
      },
    });

    const draftCount = objectivesCount - publishedCount;

    return {
      cycleId: id,
      objectivesCount,
      publishedCount,
      draftCount,
    };
  }

  /**
   * Validate no overlapping cycles (excluding a specific cycle ID)
   */
  private async validateNoOverlap(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    excludeCycleId: string | null,
  ): Promise<void> {
    const where: any = {
      organizationId,
      OR: [
        // New cycle starts during existing cycle
        {
          startDate: { lte: startDate },
          endDate: { gte: startDate },
        },
        // New cycle ends during existing cycle
        {
          startDate: { lte: endDate },
          endDate: { gte: endDate },
        },
        // New cycle fully contains existing cycle
        {
          startDate: { gte: startDate },
          endDate: { lte: endDate },
        },
      ],
    };

    if (excludeCycleId) {
      where.id = { not: excludeCycleId };
    }

    const overlapping = await this.prisma.cycle.findFirst({
      where,
    });

    if (overlapping) {
      throw new BadRequestException(
        `Cycle overlaps with existing cycle "${overlapping.name}" (${overlapping.startDate.toISOString().split('T')[0]} - ${overlapping.endDate.toISOString().split('T')[0]})`,
      );
    }
  }

  /**
   * Validate status transitions
   * Allowed: DRAFT → ACTIVE → LOCKED → ARCHIVED
   * No backward transitions
   */
  private validateStatusTransition(
    currentStatus: string,
    newStatus: string,
  ): void {
    if (currentStatus === newStatus) {
      return; // No change, allow
    }

    const validTransitions: Record<string, string[]> = {
      DRAFT: ['ACTIVE'],
      ACTIVE: ['LOCKED'],
      LOCKED: ['ARCHIVED'],
      ARCHIVED: [], // No transitions from ARCHIVED
    };

    const allowed = validTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: cannot change from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'none'}`,
      );
    }
  }
}

