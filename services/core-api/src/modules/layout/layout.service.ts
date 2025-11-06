import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async saveUserLayout(
    userId: string, 
    layouts: LayoutPosition[],
    userTenantId: string | null | undefined // ADD THIS parameter
  ) {
    if (!layouts || layouts.length === 0) {
      throw new BadRequestException('Layouts array cannot be empty');
    }

    // Tenant isolation check
    if (userTenantId === undefined || userTenantId === '') {
      throw new ForbiddenException('No tenant context available');
    }

    // Validate all entity types and IDs exist AND get their tenantIds
    const entityTenantIds: Map<string, string> = new Map();
    for (const layout of layouts) {
      const tenantId = await this.validateEntityExistsAndGetTenantId(
        layout.entityType, 
        layout.entityId
      );
      entityTenantIds.set(`${layout.entityType}:${layout.entityId}`, tenantId);
    }

    // Verify all entities belong to user's tenant (unless superuser)
    if (userTenantId !== null) {
      for (const layout of layouts) {
        const entityTenantId = entityTenantIds.get(`${layout.entityType}:${layout.entityId}`);
        if (entityTenantId !== userTenantId) {
          throw new ForbiddenException(
            `Entity ${layout.entityType}:${layout.entityId} does not belong to your organization`
          );
        }
      }
    }

    // Use upsert for each layout position - include tenantId
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
            tenantId: entityTenantIds.get(`${layout.entityType}:${layout.entityId}`)!, // ADD THIS
          },
          create: {
            userId,
            entityType: layout.entityType,
            entityId: layout.entityId,
            tenantId: entityTenantIds.get(`${layout.entityType}:${layout.entityId}`)!, // ADD THIS
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

  async getUserLayout(
    userId: string, 
    entityType?: EntityType, 
    entityIds?: string[],
    userTenantId?: string | null | undefined // ADD THIS parameter
  ) {
    const where: any = { userId };
    
    // ADD tenant filter
    if (userTenantId !== null && userTenantId !== undefined) {
      where.tenantId = userTenantId;
    }
    // Superuser (null): no tenant filter
    
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

  async deleteUserLayout(
    userId: string, 
    entityType: EntityType, 
    entityId: string,
    userTenantId?: string | null | undefined // ADD THIS
  ) {
    const where: any = { userId, entityType, entityId };
    
    // ADD tenant filter
    if (userTenantId !== null && userTenantId !== undefined) {
      where.tenantId = userTenantId;
    }
    
    const deleted = await this.prisma.userLayout.deleteMany({ where });

    return {
      message: 'Layout position deleted successfully',
      count: deleted.count,
    };
  }

  async clearUserLayouts(
    userId: string,
    userTenantId?: string | null | undefined // ADD THIS
  ) {
    const where: any = { userId };
    
    // ADD tenant filter
    if (userTenantId !== null && userTenantId !== undefined) {
      where.tenantId = userTenantId;
    }
    
    const deleted = await this.prisma.userLayout.deleteMany({ where });

    return {
      message: 'All user layouts cleared successfully',
      count: deleted.count,
    };
  }

  private async validateEntityExistsAndGetTenantId(
    entityType: EntityType, 
    entityId: string
  ): Promise<string> {
    let tenantId: string | null = null;

    switch (entityType) {
      case EntityType.OBJECTIVE:
        const objective = await this.prisma.objective.findUnique({
          where: { id: entityId },
          select: { id: true, tenantId: true },
        });
        if (!objective) {
          throw new NotFoundException(`Objective with ID ${entityId} not found`);
        }
        tenantId = objective.tenantId;
        break;
      case EntityType.KEY_RESULT:
        const keyResult = await this.prisma.keyResult.findUnique({
          where: { id: entityId },
          select: { id: true, tenantId: true },
        });
        if (!keyResult) {
          throw new NotFoundException(`KeyResult with ID ${entityId} not found`);
        }
        tenantId = keyResult.tenantId;
        break;
      case EntityType.INITIATIVE:
        const initiative = await this.prisma.initiative.findUnique({
          where: { id: entityId },
          select: { id: true, tenantId: true },
        });
        if (!initiative) {
          throw new NotFoundException(`Initiative with ID ${entityId} not found`);
        }
        tenantId = initiative.tenantId;
        break;
      default:
        throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    if (!tenantId) {
      throw new BadRequestException(`Entity ${entityType}:${entityId} has no tenant association`);
    }

    return tenantId;
  }
}






