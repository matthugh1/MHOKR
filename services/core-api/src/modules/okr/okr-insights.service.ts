import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';
import { OkrVisibilityService } from './okr-visibility.service';

/**
 * OKR Insights Service
 * 
 * W5.M2: Provides inline insights and cycle health summaries.
 * All methods respect server-side visibility and tenant isolation.
 * 
 * Responsibilities:
 * - Cycle health summary (objectives, KRs, check-ins)
 * - Objective-level insights (status trend, last update age, KR roll-ups)
 * - Attention feed (overdue check-ins, no updates, status downgrades)
 */
@Injectable()
export class OkrInsightsService {
  constructor(
    private prisma: PrismaService,
    private visibilityService: OkrVisibilityService,
  ) {}

  /**
   * Get cycle health summary for a specific cycle.
   * 
   * Returns aggregated counts for objectives and KRs visible to the requester.
   * All counts respect visibility filtering.
   * 
   * @param cycleId - Cycle ID to filter by
   * @param userOrganizationId - null for superuser (all orgs), string for specific org
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Cycle summary with objective, KR, and check-in counts
   */
  async getCycleSummary(
    cycleId: string,
    userOrganizationId: string | null | undefined,
    requesterUserId: string,
  ): Promise<{
    cycleId: string;
    objectives: { total: number; published: number; draft: number };
    krs: { total: number; onTrack: number; atRisk: number; blocked: number; completed: number };
    checkins: { upcoming7d: number; overdue: number; recent24h: number };
  }> {
    // Tenant isolation
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      return {
        cycleId,
        objectives: { total: 0, published: 0, draft: 0 },
        krs: { total: 0, onTrack: 0, atRisk: 0, blocked: 0, completed: 0 },
        checkins: { upcoming7d: 0, overdue: 0, recent24h: 0 },
      };
    }

    // Fetch objectives in this cycle
    const objectiveWhere: any = { cycleId };
    if (orgFilter) {
      objectiveWhere.tenantId = orgFilter.tenantId;
    }

    const objectives = await this.prisma.objective.findMany({
      where: objectiveWhere,
      select: {
        id: true,
        status: true,
        ownerId: true,
        tenantId: true,
        visibilityLevel: true,
        isPublished: true,
        keyResults: {
          select: {
            keyResult: {
              select: {
                id: true,
                status: true,
                checkInCadence: true,
                checkIns: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { createdAt: true },
                },
              },
            },
          },
        },
      },
    });

    // Filter by visibility
    const visibleObjectives = [];
    for (const obj of objectives) {
      if (!obj.tenantId) {
        continue;
      }
      const canSee = await this.visibilityService.canUserSeeObjective({
        objective: {
          id: obj.id,
          ownerId: obj.ownerId,
          tenantId: obj.tenantId,
          visibilityLevel: obj.visibilityLevel,
        },
        requesterUserId,
        requesterOrgId: userOrganizationId ?? null,
      });

      if (canSee) {
        visibleObjectives.push(obj);
      }
    }

    // Count objectives
    const totalObjectives = visibleObjectives.length;
    const published = visibleObjectives.filter((o) => o.isPublished).length;
    const draft = totalObjectives - published;

    // Count KRs
    const allKRs: Array<{
      status: string;
      checkInCadence: string | null;
      lastCheckIn: Date | null;
    }> = [];
    for (const obj of visibleObjectives) {
      for (const krLink of obj.keyResults || []) {
        allKRs.push({
          status: krLink.keyResult.status || 'ON_TRACK',
          checkInCadence: krLink.keyResult.checkInCadence || null,
          lastCheckIn: krLink.keyResult.checkIns[0]?.createdAt || null,
        });
      }
    }

    const totalKRs = allKRs.length;
    const onTrack = allKRs.filter((kr) => kr.status === 'ON_TRACK').length;
    const atRisk = allKRs.filter((kr) => kr.status === 'AT_RISK').length;
    const blocked = allKRs.filter((kr) => kr.status === 'BLOCKED' || kr.status === 'OFF_TRACK').length;
    const completed = allKRs.filter((kr) => kr.status === 'COMPLETED').length;

    // Calculate check-in metrics
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let upcoming7d = 0;
    let overdue = 0;
    let recent24h = 0;

    for (const kr of allKRs) {
      if (!kr.checkInCadence || kr.checkInCadence === 'NONE') {
        continue;
      }

      // Determine max age based on cadence
      let maxAgeDays: number;
      switch (kr.checkInCadence) {
        case 'WEEKLY':
          maxAgeDays = 7;
          break;
        case 'BIWEEKLY':
          maxAgeDays = 14;
          break;
        case 'MONTHLY':
          maxAgeDays = 31;
          break;
        default:
          continue;
      }

      const lastCheckInAt = kr.lastCheckIn;
      const daysSinceLastCheckIn = lastCheckInAt
        ? Math.floor((now.getTime() - lastCheckInAt.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity; // No check-in ever = overdue

      // Check if overdue
      if (daysSinceLastCheckIn > maxAgeDays) {
        overdue++;
      }

      // Check if upcoming (next check-in due within 7 days)
      const nextCheckInDue = lastCheckInAt
        ? new Date(lastCheckInAt.getTime() + maxAgeDays * 24 * 60 * 60 * 1000)
        : now; // If no check-in, consider due now
      if (nextCheckInDue <= sevenDaysFromNow && nextCheckInDue > now) {
        upcoming7d++;
      }

      // Check if recent (within 24h)
      if (lastCheckInAt && lastCheckInAt >= oneDayAgo) {
        recent24h++;
      }
    }

    return {
      cycleId,
      objectives: { total: totalObjectives, published, draft },
      krs: { total: totalKRs, onTrack, atRisk, blocked, completed },
      checkins: { upcoming7d, overdue, recent24h },
    };
  }

  /**
   * Get objective-level insights.
   * 
   * Returns compact facts for a single objective that the caller can see.
   * Includes status trend, last update age, KR roll-ups, and check-in counts.
   * 
   * @param objectiveId - Objective ID
   * @param userOrganizationId - null for superuser (all orgs), string for specific org
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Objective insights or null if not visible
   */
  async getObjectiveInsights(
    objectiveId: string,
    userOrganizationId: string | null | undefined,
    requesterUserId: string,
  ): Promise<{
    objectiveId: string;
    statusTrend: 'IMPROVING' | 'DECLINING' | 'FLAT' | 'UNKNOWN';
    lastUpdateAgeHours: number;
    krs: { onTrack: number; atRisk: number; blocked: number; completed: number };
    upcomingCheckins: number;
    overdueCheckins: number;
  } | null> {
    // Fetch objective
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      select: {
        id: true,
        status: true,
        ownerId: true,
        tenantId: true,
        visibilityLevel: true,
        updatedAt: true,
        keyResults: {
          select: {
            keyResult: {
              select: {
                id: true,
                status: true,
                checkInCadence: true,
                ownerId: true,
                checkIns: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { createdAt: true },
                },
              },
            },
          },
        },
      },
    });

    if (!objective || !objective.tenantId) {
      return null;
    }

    // Check visibility
    const canSee = await this.visibilityService.canUserSeeObjective({
      objective: {
        id: objective.id,
        ownerId: objective.ownerId,
        tenantId: objective.tenantId,
        visibilityLevel: objective.visibilityLevel,
      },
      requesterUserId,
      requesterOrgId: userOrganizationId ?? null,
    });

    if (!canSee) {
      return null;
    }

    // Calculate status trend (compare current status with previous status from history)
    // For now, use UNKNOWN (can be enhanced with check-in history later)
    const statusTrend: 'IMPROVING' | 'DECLINING' | 'FLAT' | 'UNKNOWN' = 'UNKNOWN';

    // TODO: Enhance with historical status changes from audit logs or check-ins
    // For now, we'll use UNKNOWN

    // Calculate last update age
    const now = new Date();
    const updatedAt = objective.updatedAt;
    const lastUpdateAgeHours = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60));

    // Count KRs by status
    const krs = objective.keyResults || [];
    const onTrack = krs.filter((kr) => kr.keyResult.status === 'ON_TRACK').length;
    const atRisk = krs.filter((kr) => kr.keyResult.status === 'AT_RISK').length;
    const blocked = krs.filter(
      (kr) => kr.keyResult.status === 'OFF_TRACK',
    ).length;
    const completed = krs.filter((kr) => kr.keyResult.status === 'COMPLETED').length;

    // Calculate check-in metrics
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let upcomingCheckins = 0;
    let overdueCheckins = 0;

    for (const krLink of krs) {
      const kr = krLink.keyResult;
      if (!kr.checkInCadence || kr.checkInCadence === 'NONE') {
        continue;
      }

      let maxAgeDays: number;
      switch (kr.checkInCadence) {
        case 'WEEKLY':
          maxAgeDays = 7;
          break;
        case 'BIWEEKLY':
          maxAgeDays = 14;
          break;
        case 'MONTHLY':
          maxAgeDays = 31;
          break;
        default:
          continue;
      }

      const lastCheckInAt = kr.checkIns[0]?.createdAt || null;
      const daysSinceLastCheckIn = lastCheckInAt
        ? Math.floor((now.getTime() - lastCheckInAt.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;

      // Check if overdue
      if (daysSinceLastCheckIn > maxAgeDays) {
        overdueCheckins++;
      }

      // Check if upcoming (next check-in due within 7 days)
      const nextCheckInDue = lastCheckInAt
        ? new Date(lastCheckInAt.getTime() + maxAgeDays * 24 * 60 * 60 * 1000)
        : now;
      if (nextCheckInDue <= sevenDaysFromNow && nextCheckInDue > now) {
        upcomingCheckins++;
      }
    }

    return {
      objectiveId: objective.id,
      statusTrend,
      lastUpdateAgeHours,
      krs: { onTrack, atRisk, blocked, completed },
      upcomingCheckins,
      overdueCheckins,
    };
  }

  /**
   * Get attention feed (paginated list of items requiring attention).
   * 
   * Returns visibility-aware list of attention items:
   * - OVERDUE_CHECKIN: KRs with overdue check-ins
   * - NO_UPDATE_14D: Objectives not updated in 14+ days
   * - STATUS_DOWNGRADE: Objectives that changed status from ON_TRACK to AT_RISK/BLOCKED
   * 
   * @param cycleId - Optional cycle ID to filter by
   * @param page - Page number (1-indexed)
   * @param pageSize - Items per page
   * @param userOrganizationId - null for superuser (all orgs), string for specific org
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Paginated attention items
   */
  async getAttentionFeed(
    cycleId: string | undefined,
    page: number,
    pageSize: number,
    userOrganizationId: string | null | undefined,
    requesterUserId: string,
  ): Promise<{
    page: number;
    pageSize: number;
    totalCount: number;
    items: Array<{
      type: 'OVERDUE_CHECKIN' | 'NO_UPDATE_14D' | 'STATUS_DOWNGRADE';
      objectiveId: string;
      keyResultId?: string;
      ageDays?: number;
      from?: string;
      to?: string;
    }>;
  }> {
    // Tenant isolation
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      return {
        page,
        pageSize,
        totalCount: 0,
        items: [],
      };
    }

    const objectiveWhere: any = {};
    if (orgFilter) {
      objectiveWhere.tenantId = orgFilter.tenantId;
    }
    if (cycleId) {
      objectiveWhere.cycleId = cycleId;
    }

    // Fetch objectives
    const objectives = await this.prisma.objective.findMany({
      where: objectiveWhere,
      select: {
        id: true,
        title: true,
        status: true,
        ownerId: true,
        tenantId: true,
        visibilityLevel: true,
        updatedAt: true,
        createdAt: true,
        keyResults: {
          select: {
            keyResult: {
              select: {
                id: true,
                title: true,
                status: true,
                checkInCadence: true,
                checkIns: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { createdAt: true },
                },
              },
            },
          },
        },
      },
    });

    // Filter by visibility and build attention items
    const attentionItems: Array<{
      type: 'OVERDUE_CHECKIN' | 'NO_UPDATE_14D' | 'STATUS_DOWNGRADE';
      objectiveId: string;
      keyResultId?: string;
      ageDays?: number;
      from?: string;
      to?: string;
    }> = [];

    const now = new Date();
    // const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // TODO: Use this for trending analysis

    for (const obj of objectives) {
      if (!obj.tenantId) {
        continue;
      }

      const canSee = await this.visibilityService.canUserSeeObjective({
        objective: {
          id: obj.id,
          ownerId: obj.ownerId,
          tenantId: obj.tenantId,
          visibilityLevel: obj.visibilityLevel,
        },
        requesterUserId,
        requesterOrgId: userOrganizationId ?? null,
      });

      if (!canSee) {
        continue;
      }

      // Check for NO_UPDATE_14D
      const updatedAt = obj.updatedAt || obj.createdAt;
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate >= 14) {
        attentionItems.push({
          type: 'NO_UPDATE_14D',
          objectiveId: obj.id,
          ageDays: daysSinceUpdate,
        });
      }

      // Check for STATUS_DOWNGRADE (simplified: current status is AT_RISK/BLOCKED)
      // TODO: Enhance with audit log to detect actual status changes
      if (obj.status === 'AT_RISK' || obj.status === 'OFF_TRACK') {
        attentionItems.push({
          type: 'STATUS_DOWNGRADE',
          objectiveId: obj.id,
          from: 'ON_TRACK', // Simplified assumption
          to: obj.status,
        });
      }

      // Check for OVERDUE_CHECKIN
      for (const krLink of obj.keyResults || []) {
        const kr = krLink.keyResult;
        if (!kr.checkInCadence || kr.checkInCadence === 'NONE') {
          continue;
        }

        let maxAgeDays: number;
        switch (kr.checkInCadence) {
          case 'WEEKLY':
            maxAgeDays = 7;
            break;
          case 'BIWEEKLY':
            maxAgeDays = 14;
            break;
          case 'MONTHLY':
            maxAgeDays = 31;
            break;
          default:
            continue;
        }

        const lastCheckInAt = kr.checkIns[0]?.createdAt || null;
        const daysSinceLastCheckIn = lastCheckInAt
          ? Math.floor((now.getTime() - lastCheckInAt.getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;

        if (daysSinceLastCheckIn > maxAgeDays) {
          attentionItems.push({
            type: 'OVERDUE_CHECKIN',
            objectiveId: obj.id,
            keyResultId: kr.id,
            ageDays: daysSinceLastCheckIn,
          });
        }
      }
    }

    // Sort by ageDays (descending) for most urgent first
    attentionItems.sort((a, b) => (b.ageDays || 0) - (a.ageDays || 0));

    // Paginate
    const totalCount = attentionItems.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedItems = attentionItems.slice(startIndex, endIndex);

    return {
      page,
      pageSize,
      totalCount,
      items: paginatedItems,
    };
  }
}

