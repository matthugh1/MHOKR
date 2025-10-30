import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntityType } from '@prisma/client';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async findActivities(filters: { entityType?: string; entityId?: string; userId?: string }) {
    return this.prisma.activity.findMany({
      where: {
        entityType: filters.entityType as EntityType,
        entityId: filters.entityId,
        userId: filters.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }

  async createActivity(data: {
    entityType: EntityType;
    entityId: string;
    userId: string;
    action: string;
    metadata?: any;
  }) {
    return this.prisma.activity.create({
      data: {
        ...data,
        action: data.action as any,
      },
    });
  }
}



