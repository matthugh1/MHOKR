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

  /**
   * Get recent activity for an Objective
   * 
   * Enforces tenant isolation: only returns activities for objectives in the caller's organization.
   * Superusers (userOrganizationId === null) can view all activities.
   * 
   * @param objectiveId - The objective ID
   * @param userOrganizationId - User's organization ID (null for superuser)
   * @param limit - Maximum number of activities to return (default: 20, max: 100)
   * @param offset - Number of activities to skip for pagination (default: 0)
   * @param actionFilter - Optional filter by action type (CREATED, UPDATED, DELETED, etc.)
   * @param userIdFilter - Optional filter by user ID who performed the action
   */
  async getRecentForObjective(
    objectiveId: string,
    userOrganizationId: string | null | undefined,
    limit: number = 20,
    offset: number = 0,
    actionFilter?: string,
    userIdFilter?: string,
  ) {
    // First verify the objective exists and get its organizationId for tenant isolation
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { organizationId: true },
    });

    if (!objective) {
      return [];
    }

    // Tenant isolation check
    if (userOrganizationId === null) {
      // Superuser: can view all
    } else if (userOrganizationId && objective.organizationId === userOrganizationId) {
      // Normal user: must match org
    } else {
      // No access or org mismatch
      return [];
    }

    // Build where clause with filters
    const where: any = {
      entityType: 'OBJECTIVE',
      entityId: objectiveId,
    };

    if (actionFilter) {
      where.action = actionFilter;
    }

    if (userIdFilter) {
      where.userId = userIdFilter;
    }

    // Clamp limit to reasonable range
    const clampedLimit = Math.min(Math.max(1, limit || 20), 100);
    const clampedOffset = Math.max(0, offset || 0);

    return this.prisma.activity.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: clampedLimit,
      skip: clampedOffset,
    });
  }

  /**
   * Get recent activity for a Key Result
   * 
   * Enforces tenant isolation: only returns activities for KRs whose parent objectives
   * are in the caller's organization. Superusers (userOrganizationId === null) can view all activities.
   * 
   * @param keyResultId - The key result ID
   * @param userOrganizationId - User's organization ID (null for superuser)
   * @param limit - Maximum number of activities to return (default: 20, max: 100)
   * @param offset - Number of activities to skip for pagination (default: 0)
   * @param actionFilter - Optional filter by action type (CREATED, UPDATED, DELETED, etc.)
   * @param userIdFilter - Optional filter by user ID who performed the action
   */
  async getRecentForKeyResult(
    keyResultId: string,
    userOrganizationId: string | null | undefined,
    limit: number = 20,
    offset: number = 0,
    actionFilter?: string,
    userIdFilter?: string,
  ) {
    // First verify the key result exists and get its parent objective's organizationId
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: {
        objectives: {
          select: {
            objective: {
              select: { organizationId: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!keyResult || keyResult.objectives.length === 0) {
      return [];
    }

    const objectiveOrgId = keyResult.objectives[0].objective.organizationId;

    // Tenant isolation check
    if (userOrganizationId === null) {
      // Superuser: can view all
    } else if (userOrganizationId && objectiveOrgId === userOrganizationId) {
      // Normal user: must match org
    } else {
      // No access or org mismatch
      return [];
    }

    // Build where clause with filters
    const where: any = {
      entityType: 'KEY_RESULT',
      entityId: keyResultId,
    };

    if (actionFilter) {
      where.action = actionFilter;
    }

    if (userIdFilter) {
      where.userId = userIdFilter;
    }

    // Clamp limit to reasonable range
    const clampedLimit = Math.min(Math.max(1, limit || 20), 100);
    const clampedOffset = Math.max(0, offset || 0);

    return this.prisma.activity.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: clampedLimit,
      skip: clampedOffset,
    });
  }

  /**
   * Get recent activity for a user's scope (Objectives/KRs they own or activities they performed).
   * 
   * Returns activities where:
   * - userId = userId (activities performed by user), OR
   * - entityId is an Objective owned by userId, OR
   * - entityId is a KeyResult owned by userId
   * 
   * Tenant isolation still enforced: only include rows from objectives/KRs in the allowed org.
   * 
   * @param userId - The user ID to filter by
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of activities with timestamp, action, targetType, targetId, metadata summary
   */
  async getRecentActivityForUserScope(userId: string, userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    timestamp: Date;
    action: string;
    targetType: string;
    targetId: string;
    metadata: any;
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    // Build tenant isolation filter for objectives/KRs
    const objectiveWhere: any = {};
    if (userOrganizationId !== null) {
      // Normal user: only their org
      objectiveWhere.organizationId = userOrganizationId;
    }
    // Superuser (null): no filter, see all orgs

    // Get Objectives owned by user in scope
    const ownedObjectives = await this.prisma.objective.findMany({
      where: {
        ownerId: userId,
        ...(userOrganizationId !== null ? { organizationId: userOrganizationId } : {}),
      },
      select: {
        id: true,
      },
    });
    const ownedObjectiveIds = ownedObjectives.map((o) => o.id);

    // Get Key Results owned by user in scope (via parent objectives)
    const ownedKeyResults = await this.prisma.keyResult.findMany({
      where: {
        ownerId: userId,
        objectives: {
          some: {
            objective: objectiveWhere,
          },
        },
      },
      select: {
        id: true,
      },
    });
    const ownedKeyResultIds = ownedKeyResults.map((kr) => kr.id);

    // Query activities where:
    // - userId matches (user performed the action), OR
    // - entityId is in ownedObjectiveIds and entityType is OBJECTIVE, OR
    // - entityId is in ownedKeyResultIds and entityType is KEY_RESULT
    const activities = await this.prisma.activity.findMany({
      where: {
        OR: [
          { userId: userId },
          {
            entityType: 'OBJECTIVE',
            entityId: { in: ownedObjectiveIds },
          },
          {
            entityType: 'KEY_RESULT',
            entityId: { in: ownedKeyResultIds },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // Transform to match return type
    return activities.map((activity) => ({
      id: activity.id,
      timestamp: activity.createdAt,
      action: activity.action,
      targetType: activity.entityType,
      targetId: activity.entityId,
      metadata: activity.metadata,
    }));
  }
}



