import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';
import { ActivityService } from '../activity/activity.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreatePillarDto } from './dto/create-pillar.dto';
import { UpdatePillarDto } from './dto/update-pillar.dto';

@Injectable()
export class PillarService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
    private auditLogService: AuditLogService,
  ) {}

  async create(dto: CreatePillarDto, userId: string, userTenantId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId, userId);

    // Validate owner if provided
    if (dto.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
        select: { id: true },
      });

      if (!owner) {
        throw new NotFoundException(`User with ID ${dto.ownerId} not found`);
      }

      // Ensure owner belongs to same tenant by checking role assignments
      const ownerTenantAssignment = await this.prisma.roleAssignment.findFirst({
        where: {
          userId: dto.ownerId,
          scopeType: 'TENANT',
          scopeId: userTenantId,
        },
      });

      if (!ownerTenantAssignment) {
        throw new BadRequestException('Owner must belong to the same tenant');
      }
    }

    // Create pillar
    const pillar = await this.prisma.strategicPillar.create({
      data: {
        tenantId: userTenantId!,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        ownerId: dto.ownerId,
      },
    });

    // Emit Activity 'CREATED'
    await this.activityService.createActivity({
      entityType: 'PILLAR',
      entityId: pillar.id,
      userId,
      tenantId: userTenantId!,
      action: 'CREATED',
      metadata: {
        after: {
          id: pillar.id,
          name: pillar.name,
          description: pillar.description,
          color: pillar.color,
          ownerId: pillar.ownerId,
        },
      },
    }).catch(err => {
      console.error('Failed to log activity for pillar creation:', err);
    });

    // Emit AuditLog
    await this.auditLogService.record({
      action: 'pillar_created',
      actorUserId: userId,
      targetId: pillar.id,
      targetType: 'OKR',
      tenantId: userTenantId!,
      metadata: {
        pillarName: pillar.name,
      },
    }).catch(err => {
      console.error('Failed to log audit for pillar creation:', err);
    });

    return pillar;
  }

  async findAll(userTenantId: string | null | undefined) {
    const where: any = {};
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userTenantId);
    if (orgFilter === null && userTenantId !== null) {
      return [];
    }
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }

    return this.prisma.strategicPillar.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string, userTenantId: string | null | undefined) {
    const pillar = await this.prisma.strategicPillar.findUnique({
      where: { id },
      include: {
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

    if (!pillar) {
      throw new NotFoundException(`Pillar with ID ${id} not found`);
    }

    // Tenant isolation check
    OkrTenantGuard.assertSameTenant(pillar.tenantId, userTenantId);

    return pillar;
  }

  async update(id: string, dto: UpdatePillarDto, userId: string, userTenantId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId, userId);

    // Get pillar before update for activity log
    const pillarBefore = await this.prisma.strategicPillar.findUnique({
      where: { id },
    });

    if (!pillarBefore) {
      throw new NotFoundException(`Pillar with ID ${id} not found`);
    }

    // Tenant isolation check
    OkrTenantGuard.assertSameTenant(pillarBefore.tenantId, userTenantId);

    // Validate owner if provided
    if (dto.ownerId !== undefined && dto.ownerId !== null) {
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
        select: { id: true },
      });

      if (!owner) {
        throw new NotFoundException(`User with ID ${dto.ownerId} not found`);
      }

      // Ensure owner belongs to same tenant by checking role assignments
      const ownerTenantAssignment = await this.prisma.roleAssignment.findFirst({
        where: {
          userId: dto.ownerId,
          scopeType: 'TENANT',
          scopeId: userTenantId,
        },
      });

      if (!ownerTenantAssignment) {
        throw new BadRequestException('Owner must belong to the same tenant');
      }
    }

    // Build update data
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.ownerId !== undefined) updateData.ownerId = dto.ownerId;

    // Update pillar
    const pillarAfter = await this.prisma.strategicPillar.update({
      where: { id },
      data: updateData,
      include: {
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

    // Determine changed fields
    const changedFields: string[] = [];
    if (dto.name !== undefined && dto.name !== pillarBefore.name) changedFields.push('name');
    if (dto.description !== undefined && dto.description !== pillarBefore.description) changedFields.push('description');
    if (dto.color !== undefined && dto.color !== pillarBefore.color) changedFields.push('color');
    if (dto.ownerId !== undefined && dto.ownerId !== pillarBefore.ownerId) changedFields.push('ownerId');

    // Emit Activity 'UPDATED'
    if (changedFields.length > 0) {
      await this.activityService.createActivity({
        entityType: 'PILLAR',
        entityId: id,
        userId,
        tenantId: userTenantId!,
        action: 'UPDATED',
        metadata: {
          before: {
            id: pillarBefore.id,
            name: pillarBefore.name,
            description: pillarBefore.description,
            color: pillarBefore.color,
            ownerId: pillarBefore.ownerId,
          },
          after: {
            id: pillarAfter.id,
            name: pillarAfter.name,
            description: pillarAfter.description,
            color: pillarAfter.color,
            ownerId: pillarAfter.ownerId,
          },
          changedFields,
        },
      }).catch(err => {
        console.error('Failed to log activity for pillar update:', err);
      });

      // Emit AuditLog
      await this.auditLogService.record({
        action: 'pillar_updated',
        actorUserId: userId,
        targetId: id,
        targetType: 'OKR',
        tenantId: userTenantId!,
        metadata: {
          changedFields,
          pillarName: pillarAfter.name,
        },
      }).catch(err => {
        console.error('Failed to log audit for pillar update:', err);
      });
    }

    return pillarAfter;
  }

  async remove(id: string, userId: string, userTenantId: string | null | undefined) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId, userId);

    // Get pillar before deletion for activity log
    const pillarBefore = await this.prisma.strategicPillar.findUnique({
      where: { id },
    });

    if (!pillarBefore) {
      throw new NotFoundException(`Pillar with ID ${id} not found`);
    }

    // Tenant isolation check
    OkrTenantGuard.assertSameTenant(pillarBefore.tenantId, userTenantId);

    // Delete pillar
    await this.prisma.strategicPillar.delete({
      where: { id },
    });

    // Emit Activity 'DELETED'
    await this.activityService.createActivity({
      entityType: 'PILLAR',
      entityId: id,
      userId,
      tenantId: userTenantId!,
      action: 'DELETED',
      metadata: {
        before: {
          id: pillarBefore.id,
          name: pillarBefore.name,
          description: pillarBefore.description,
          color: pillarBefore.color,
          ownerId: pillarBefore.ownerId,
        },
      },
    }).catch(err => {
      console.error('Failed to log activity for pillar deletion:', err);
    });

    // Emit AuditLog
    await this.auditLogService.record({
      action: 'pillar_deleted',
      actorUserId: userId,
      targetId: id,
      targetType: 'OKR',
      tenantId: userTenantId!,
      metadata: {
        pillarName: pillarBefore.name,
      },
    }).catch(err => {
      console.error('Failed to log audit for pillar deletion:', err);
    });

    return { success: true };
  }
}

