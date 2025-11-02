import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntityType } from '@prisma/client';

export interface LayoutPosition {
  entityType: EntityType;
  entityId: string;
  positionX: number;
  positionY: number;
}

export interface SaveLayoutRequest {
  layouts: LayoutPosition[];
}

@Injectable()
export class LayoutService {
  constructor(private prisma: PrismaService) {}

  async saveUserLayout(userId: string, layouts: LayoutPosition[]) {
    if (!layouts || layouts.length === 0) {
      throw new BadRequestException('Layouts array cannot be empty');
    }

    // Validate all entity types and IDs exist
    for (const layout of layouts) {
      await this.validateEntityExists(layout.entityType, layout.entityId);
    }

    // Use upsert for each layout position
    const results = await Promise.all(
      layouts.map(layout =>
        this.prisma.userLayout.upsert({
          where: {
            userId_entityType_entityId: {
              userId,
              entityType: layout.entityType,
              entityId: layout.entityId,
            },
          },
          update: {
            positionX: layout.positionX,
            positionY: layout.positionY,
          },
          create: {
            userId,
            entityType: layout.entityType,
            entityId: layout.entityId,
            positionX: layout.positionX,
            positionY: layout.positionY,
          },
        })
      )
    );

    return {
      message: `Successfully saved ${results.length} layout positions`,
      count: results.length,
    };
  }

  async getUserLayout(userId: string, entityType?: EntityType, entityIds?: string[]) {
    const where: any = { userId };
    
    if (entityType) {
      where.entityType = entityType;
    }
    
    if (entityIds && entityIds.length > 0) {
      where.entityId = { in: entityIds };
    }

    const layouts = await this.prisma.userLayout.findMany({
      where,
      select: {
        entityType: true,
        entityId: true,
        positionX: true,
        positionY: true,
      },
    });

    // Convert to a map for easy lookup
    const layoutMap: Record<string, { x: number; y: number }> = {};
    layouts.forEach(layout => {
      const key = `${layout.entityType}:${layout.entityId}`;
      layoutMap[key] = {
        x: layout.positionX,
        y: layout.positionY,
      };
    });

    return layoutMap;
  }

  async deleteUserLayout(userId: string, entityType: EntityType, entityId: string) {
    const deleted = await this.prisma.userLayout.deleteMany({
      where: {
        userId,
        entityType,
        entityId,
      },
    });

    return {
      message: 'Layout position deleted successfully',
      count: deleted.count,
    };
  }

  async clearUserLayouts(userId: string) {
    const deleted = await this.prisma.userLayout.deleteMany({
      where: { userId },
    });

    return {
      message: 'All user layouts cleared successfully',
      count: deleted.count,
    };
  }

  private async validateEntityExists(entityType: EntityType, entityId: string) {
    let exists = false;

    switch (entityType) {
      case EntityType.OBJECTIVE:
        exists = !!(await this.prisma.objective.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
        break;
      case EntityType.KEY_RESULT:
        exists = !!(await this.prisma.keyResult.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
        break;
      case EntityType.INITIATIVE:
        exists = !!(await this.prisma.initiative.findUnique({
          where: { id: entityId },
          select: { id: true },
        }));
        break;
      default:
        throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    if (!exists) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }
  }
}




