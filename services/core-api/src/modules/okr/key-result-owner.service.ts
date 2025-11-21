import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';

/**
 * Key Result Owner Service
 * 
 * Manages multiple owners for Key Results (in addition to primary ownerId).
 * All owners have equal permissions.
 */
@Injectable()
export class KeyResultOwnerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add an owner to a Key Result
   * 
   * @param keyResultId - Key Result ID
   * @param userId - User ID to add as owner
   * @param tenantId - Tenant ID for isolation
   * @param createdBy - User ID who is adding this owner
   * @returns Created KeyResultOwner record
   */
  async addOwner(
    keyResultId: string,
    userId: string,
    tenantId: string,
    createdBy: string,
  ) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Verify key result exists and belongs to tenant
    const keyResult = await this.prisma.keyResult.findFirst({
      where: {
        id: keyResultId,
        tenantId,
      },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Check if user is already the primary owner
    if (keyResult.ownerId === userId) {
      throw new BadRequestException('User is already the primary owner');
    }

    // Check if user is already an additional owner
    const existing = await this.prisma.keyResultOwner.findUnique({
      where: {
        tenantId_keyResultId_userId: {
          tenantId,
          keyResultId,
          userId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('User is already an owner of this key result');
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
    return this.prisma.keyResultOwner.create({
      data: {
        tenantId,
        keyResultId,
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
   * Remove an owner from a Key Result
   * 
   * @param keyResultId - Key Result ID
   * @param userId - User ID to remove as owner
   * @param tenantId - Tenant ID for isolation
   */
  async removeOwner(
    keyResultId: string,
    userId: string,
    tenantId: string,
  ) {
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

    // Cannot remove primary owner via this method
    if (keyResult.ownerId === userId) {
      throw new BadRequestException('Cannot remove primary owner. Update ownerId field instead.');
    }

    // Find and delete owner record
    const owner = await this.prisma.keyResultOwner.findUnique({
      where: {
        tenantId_keyResultId_userId: {
          tenantId,
          keyResultId,
          userId,
        },
      },
    });

    if (!owner) {
      throw new NotFoundException('User is not an owner of this key result');
    }

    await this.prisma.keyResultOwner.delete({
      where: {
        id: owner.id,
      },
    });
  }

  /**
   * Get all owners for a Key Result (including primary owner)
   * 
   * @param keyResultId - Key Result ID
   * @param tenantId - Tenant ID for isolation
   * @returns Array of owners with user info and isPrimary flag
   */
  async getOwners(keyResultId: string, tenantId: string) {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Get key result with primary owner
    const keyResult = await this.prisma.keyResult.findFirst({
      where: {
        id: keyResultId,
        tenantId,
      },
      include: {
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

    if (!keyResult) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    // Get primary owner user
    const primaryOwner = await this.prisma.user.findUnique({
      where: { id: keyResult.ownerId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!primaryOwner) {
      throw new NotFoundException(`Primary owner with ID ${keyResult.ownerId} not found`);
    }

    // Build owners list: primary owner + additional owners
    const owners = [
      {
        id: `primary-${keyResult.ownerId}`,
        userId: keyResult.ownerId,
        userName: primaryOwner.name,
        userEmail: primaryOwner.email,
        isPrimary: true,
        createdAt: keyResult.createdAt,
      },
      ...keyResult.owners.map(owner => ({
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
   * Check if a user is an owner of a Key Result
   * 
   * @param keyResultId - Key Result ID
   * @param userId - User ID to check
   * @param tenantId - Tenant ID for isolation
   * @returns true if user is owner (primary or additional)
   */
  async isOwner(keyResultId: string, userId: string, tenantId: string): Promise<boolean> {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Check if primary owner
    const keyResult = await this.prisma.keyResult.findFirst({
      where: {
        id: keyResultId,
        tenantId,
        ownerId: userId,
      },
    });

    if (keyResult) {
      return true;
    }

    // Check if additional owner
    const owner = await this.prisma.keyResultOwner.findFirst({
      where: {
        keyResultId,
        userId,
        tenantId,
      },
    });

    return !!owner;
  }

  /**
   * Get all Key Result IDs owned by a user (including primary and additional ownership)
   * 
   * @param userId - User ID
   * @param tenantId - Tenant ID for isolation
   * @returns Array of Key Result IDs
   */
  async getOwnedKeyResultIds(userId: string, tenantId: string): Promise<string[]> {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Get key results where user is primary owner
    const primaryOwned = await this.prisma.keyResult.findMany({
      where: {
        ownerId: userId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    // Get key results where user is additional owner
    const additionalOwned = await this.prisma.keyResultOwner.findMany({
      where: {
        userId,
        tenantId,
      },
      select: {
        keyResultId: true,
      },
    });

    // Combine and deduplicate
    const allIds = new Set<string>();
    primaryOwned.forEach(kr => allIds.add(kr.id));
    additionalOwned.forEach(owner => allIds.add(owner.keyResultId));

    return Array.from(allIds);
  }
}

