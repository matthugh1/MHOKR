import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';

/**
 * Objective Owner Service
 * 
 * Manages multiple owners for Objectives (in addition to primary ownerId).
 * All owners have equal permissions.
 */
@Injectable()
export class ObjectiveOwnerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add an owner to an Objective
   * 
   * @param objectiveId - Objective ID
   * @param userId - User ID to add as owner
   * @param tenantId - Tenant ID for isolation
   * @param createdBy - User ID who is adding this owner
   * @returns Created ObjectiveOwner record
   */
  async addOwner(
    objectiveId: string,
    userId: string,
    tenantId: string,
    createdBy: string,
  ) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Verify objective exists and belongs to tenant
    const objective = await this.prisma.objective.findFirst({
      where: {
        id: objectiveId,
        tenantId,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Check if user is already the primary owner
    if (objective.ownerId === userId) {
      throw new BadRequestException('User is already the primary owner');
    }

    // Check if user is already an additional owner
    const existing = await this.prisma.objectiveOwner.findUnique({
      where: {
        tenantId_objectiveId_userId: {
          tenantId,
          objectiveId,
          userId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('User is already an owner of this objective');
    }

    // Verify user exists and belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        primaryOrganizationId: tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found in tenant`);
    }

    // Create owner record
    return this.prisma.objectiveOwner.create({
      data: {
        tenantId,
        objectiveId,
        userId,
        createdBy,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Remove an owner from an Objective
   * 
   * @param objectiveId - Objective ID
   * @param userId - User ID to remove as owner
   * @param tenantId - Tenant ID for isolation
   */
  async removeOwner(
    objectiveId: string,
    userId: string,
    tenantId: string,
  ) {
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

    // Cannot remove primary owner via this method
    if (objective.ownerId === userId) {
      throw new BadRequestException('Cannot remove primary owner. Update ownerId field instead.');
    }

    // Find and delete owner record
    const owner = await this.prisma.objectiveOwner.findUnique({
      where: {
        tenantId_objectiveId_userId: {
          tenantId,
          objectiveId,
          userId,
        },
      },
    });

    if (!owner) {
      throw new NotFoundException('User is not an owner of this objective');
    }

    await this.prisma.objectiveOwner.delete({
      where: {
        id: owner.id,
      },
    });
  }

  /**
   * Get all owners for an Objective (including primary owner)
   * 
   * @param objectiveId - Objective ID
   * @param tenantId - Tenant ID for isolation
   * @returns Array of owners with user info and isPrimary flag
   */
  async getOwners(objectiveId: string, tenantId: string) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Get objective with primary owner
    const objective = await this.prisma.objective.findFirst({
      where: {
        id: objectiveId,
        tenantId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        owners: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective with ID ${objectiveId} not found`);
    }

    // Build owners list: primary owner + additional owners
    const owners = [
      {
        id: `primary-${objective.ownerId}`,
        userId: objective.ownerId,
        userName: objective.owner.name,
        userEmail: objective.owner.email,
        isPrimary: true,
        createdAt: objective.createdAt,
      },
      ...objective.owners.map(owner => ({
        id: owner.id,
        userId: owner.userId,
        userName: owner.user.name,
        userEmail: owner.user.email,
        isPrimary: false,
        createdAt: owner.createdAt,
      })),
    ];

    return owners;
  }

  /**
   * Check if a user is an owner of an Objective
   * 
   * @param objectiveId - Objective ID
   * @param userId - User ID to check
   * @param tenantId - Tenant ID for isolation
   * @returns true if user is owner (primary or additional)
   */
  async isOwner(objectiveId: string, userId: string, tenantId: string): Promise<boolean> {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Check if primary owner
    const objective = await this.prisma.objective.findFirst({
      where: {
        id: objectiveId,
        tenantId,
        ownerId: userId,
      },
    });

    if (objective) {
      return true;
    }

    // Check if additional owner
    const owner = await this.prisma.objectiveOwner.findFirst({
      where: {
        objectiveId,
        userId,
        tenantId,
      },
    });

    return !!owner;
  }

  /**
   * Get all Objective IDs owned by a user (including primary and additional ownership)
   * 
   * @param userId - User ID
   * @param tenantId - Tenant ID for isolation
   * @returns Array of Objective IDs
   */
  async getOwnedObjectiveIds(userId: string, tenantId: string): Promise<string[]> {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Get objectives where user is primary owner
    const primaryOwned = await this.prisma.objective.findMany({
      where: {
        ownerId: userId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    // Get objectives where user is additional owner
    const additionalOwned = await this.prisma.objectiveOwner.findMany({
      where: {
        userId,
        tenantId,
      },
      select: {
        objectiveId: true,
      },
    });

    // Combine and deduplicate
    const allIds = new Set<string>();
    primaryOwned.forEach(obj => allIds.add(obj.id));
    additionalOwned.forEach(owner => allIds.add(owner.objectiveId));

    return Array.from(allIds);
  }
}

