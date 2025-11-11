import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';
import { OkrVisibilityService } from './okr-visibility.service';
import { calculateCheckInDueStatus } from './check-in-due-calculator';
import { isAtRisk } from './risk-calculator';

/**
 * OKR Reporting Service
 * 
 * Centralized service for analytics, reporting, and export functionality.
 * 
 * Responsibilities:
 * - Analytics summary (status breakdown, at-risk ratio)
 * - CSV export
 * - Recent check-in feed
 * - Strategic pillar coverage
 * - Active cycle queries
 * - User-owned OKR/KR queries
 * 
 * NOTE: Reporting / analytics / export logic was moved from ObjectiveService and KeyResultService in Phase 4.
 */
@Injectable()
export class OkrReportingService {
  constructor(
    private prisma: PrismaService,
    private visibilityService: OkrVisibilityService,
    private configService: ConfigService,
  ) {}

  /**
   * Get organization-level summary statistics for analytics.
   * 
   * Moved from ObjectiveService.getOrgSummary() in Phase 4.
   * 
   * W3.M2: Now filters by visibility before aggregating.
   * Only includes objectives visible to the requester.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Summary object with total objectives, counts by status, and at-risk ratio
   */
  async getOrgSummary(userOrganizationId: string | null | undefined, requesterUserId: string): Promise<{
    totalObjectives: number;
    byStatus: { [status: string]: number };
    atRiskRatio: number;
  }> {
    const where: any = {};

    // Tenant isolation: use OkrTenantGuard to build where clause
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      // User has no org → return empty summary
      return {
        totalObjectives: 0,
        byStatus: {},
        atRiskRatio: 0,
      };
    }
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): aggregate across ALL organisations

    // Get all objectives with their status and visibility info
    const objectives = await this.prisma.objective.findMany({
      where,
      select: {
        id: true,
        status: true,
        ownerId: true,
        tenantId: true,
        visibilityLevel: true,
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

    const totalObjectives = visibleObjectives.length;
    const byStatus: { [status: string]: number } = {};
    let atRiskCount = 0;

    // Count by status
    for (const obj of visibleObjectives) {
      const status = obj.status || 'ON_TRACK';
      byStatus[status] = (byStatus[status] || 0) + 1;
      if (status === 'AT_RISK') {
        atRiskCount++;
      }
    }

    // Calculate at-risk ratio (0-1 float)
    const atRiskRatio = totalObjectives > 0 ? atRiskCount / totalObjectives : 0;

    return {
      totalObjectives,
      byStatus,
      atRiskRatio,
    };
  }

  /**
   * Export objectives and key results to CSV format.
   * 
   * Moved from ObjectiveService.exportObjectivesCSV() in Phase 4.
   * 
   * Early export MVP - exports all objectives visible to the caller with their key results flattened.
   * Each row represents one key result (objectives with multiple KRs appear multiple times).
   * Objectives with no KRs appear once with blank KR columns.
   * 
   * Tenant isolation: respects the same scoping rules as findAll().
   * - Superuser (userOrganizationId === null): includes all orgs
   * - Normal user (string): only their org
   * - No org (undefined/falsy): returns empty CSV with headers only
   * 
   * TODO [phase7-performance]: May need optimization for memory usage with large datasets.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns CSV string with headers
   */
  async exportObjectivesCSV(userOrganizationId: string | null | undefined): Promise<string> {
    const where: any = {};

    // Tenant isolation: use OkrTenantGuard to build where clause
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      // User has no org or invalid org → return empty CSV with headers only
      const headers = [
        'objectiveId',
        'title',
        'ownerName',
        'status',
        'progress',
        'isPublished',
        'startDate',
        'endDate',
        'parentId',
        'orgId',
        'keyResultId',
        'keyResultTitle',
        'keyResultOwnerName',
        'keyResultStatus',
        'keyResultProgress',
        'keyResultTargetValue',
        'keyResultCurrentValue',
      ];
      return headers.join(',') + '\n';
    }
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no org filter, return all OKRs

    // Fetch all objectives with their key results
    const objectives = await this.prisma.objective.findMany({
      where,
      include: {
        keyResults: {
          include: {
            keyResult: true,
          },
        },
        owner: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch all unique owner IDs for key results
    const krOwnerIds = new Set<string>();
    for (const obj of objectives) {
      if (obj.keyResults) {
        for (const objKr of obj.keyResults) {
          if (objKr.keyResult.ownerId) {
            krOwnerIds.add(objKr.keyResult.ownerId);
          }
        }
      }
    }

    // Fetch owner names for key results
    const krOwners = await this.prisma.user.findMany({
      where: {
        id: { in: Array.from(krOwnerIds) },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const krOwnerMap = new Map(krOwners.map(u => [u.id, u.name || '']));

    // Build CSV rows
    const rows: string[] = [];
    
    // CSV header row
    const headers = [
      'objectiveId',
      'title',
      'ownerName',
      'status',
      'progress',
      'isPublished',
      'startDate',
      'endDate',
      'parentId',
      'orgId',
      'keyResultId',
      'keyResultTitle',
      'keyResultOwnerName',
      'keyResultStatus',
      'keyResultProgress',
      'keyResultTargetValue',
      'keyResultCurrentValue',
    ];
    rows.push(headers.join(','));

    // Helper function to escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Process each objective
    for (const obj of objectives) {
      const ownerName = obj.owner?.name || '';
      const objRowBase = [
        escapeCSV(obj.id),
        escapeCSV(obj.title),
        escapeCSV(ownerName),
        escapeCSV(obj.status),
        escapeCSV(obj.progress),
        escapeCSV(obj.isPublished),
        escapeCSV(obj.startDate?.toISOString().split('T')[0] || ''),
        escapeCSV(obj.endDate?.toISOString().split('T')[0] || ''),
        escapeCSV(obj.parentId),
        escapeCSV(obj.tenantId),
      ];

      // If objective has key results, create one row per KR
      if (obj.keyResults && obj.keyResults.length > 0) {
        for (const objKr of obj.keyResults) {
          const kr = objKr.keyResult;
          const krOwnerName = krOwnerMap.get(kr.ownerId) || '';
          const row = [
            ...objRowBase,
            escapeCSV(kr.id),
            escapeCSV(kr.title),
            escapeCSV(krOwnerName),
            escapeCSV(kr.status),
            escapeCSV(kr.progress),
            escapeCSV(kr.targetValue),
            escapeCSV(kr.currentValue),
          ];
          rows.push(row.join(','));
        }
      } else {
        // Objective with no KRs: one row with blank KR columns
        const row = [
          ...objRowBase,
          '', // keyResultId
          '', // keyResultTitle
          '', // keyResultOwnerName
          '', // keyResultStatus
          '', // keyResultProgress
          '', // keyResultTargetValue
          '', // keyResultCurrentValue
        ];
        rows.push(row.join(','));
      }
    }

    return rows.join('\n');
  }

  /**
   * Get recent check-in feed for analytics.
   * 
   * Moved from KeyResultService.getRecentCheckInFeed() in Phase 4.
   * 
   * W3.M2: Now filters by visibility before returning check-ins.
   * Only includes check-ins for KRs whose parent objectives are visible to the requester.
   * 
   * Returns last ~10 check-ins across all Key Results in the user's organization.
   * Tenant isolation MUST apply - only includes check-ins for KRs whose parent objectives
   * are in the user's organization (or all orgs if superuser).
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Array of recent check-ins with KR title, user info, value, confidence, timestamp
   */
  async getRecentCheckInFeed(userOrganizationId: string | null | undefined, requesterUserId: string): Promise<Array<{
    id: string;
    krId: string;
    krTitle: string;
    userId: string;
    userName: string | null;
    value: number;
    confidence: number;
    createdAt: Date;
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    // Build where clause for objectives (tenant isolation)
    const objectiveWhere: any = {};
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter) {
      objectiveWhere.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no filter, see all orgs

    // Find Key Results that belong to Objectives in the user's org
    // We need to join: CheckIn -> KeyResult -> ObjectiveKeyResult -> Objective
    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        keyResult: {
          objectives: {
            some: {
              objective: objectiveWhere,
            },
          },
        },
      },
      include: {
        keyResult: {
          select: {
            id: true,
            title: true,
          },
        },
        // Join to User table to get user name
        // Note: Prisma doesn't support direct relation on CheckIn.userId, so we'll fetch separately
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Fetch parent objectives for visibility filtering
    const keyResultIds = checkIns.map(ci => ci.keyResult.id);
    const keyResultsWithObjectives = await this.prisma.keyResult.findMany({
      where: { id: { in: keyResultIds } },
      include: {
        objectives: {
          include: {
            objective: {
              select: {
                id: true,
                ownerId: true,
                tenantId: true,
                visibilityLevel: true,
              },
            },
          },
        },
      },
    });

    // Filter check-ins by visibility
    const visibleCheckIns = [];
    for (const checkIn of checkIns) {
      const kr = keyResultsWithObjectives.find(k => k.id === checkIn.keyResult.id);
      if (!kr || kr.objectives.length === 0) {
        continue;
      }

      const parentObjective = kr.objectives[0].objective;
      if (!parentObjective.tenantId) {
        continue;
      }
      const canSee = await this.visibilityService.canUserSeeObjective({
        objective: {
          id: parentObjective.id,
          ownerId: parentObjective.ownerId,
          tenantId: parentObjective.tenantId,
          visibilityLevel: parentObjective.visibilityLevel,
        },
        requesterUserId,
        requesterOrgId: userOrganizationId ?? null,
      });

      if (canSee) {
        visibleCheckIns.push(checkIn);
      }
    }

    // Fetch user names for all unique user IDs
    const userIds = [...new Set(visibleCheckIns.map(ci => ci.userId))];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Transform to response format
    return visibleCheckIns.map(checkIn => ({
      id: checkIn.id,
      krId: checkIn.keyResult.id,
      krTitle: checkIn.keyResult.title,
      userId: checkIn.userId,
      userName: userMap.get(checkIn.userId) || null,
      value: checkIn.value,
      confidence: checkIn.confidence,
      createdAt: checkIn.createdAt,
    }));
  }

  /**
   * Get strategic pillars for an organization.
   * 
   * Moved from ObjectiveService.getPillarsForOrg() in Phase 4.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns all pillars across all orgs
   * - Else if userOrganizationId is a non-empty string: return only pillars for that org
   * - Else (undefined/falsy): return []
   * 
   * TODO [phase7-hardening]: Frontend will use to populate 'filter by strategic bet' dropdown.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of pillars with id, name, color, description, and objectiveCount
   */
  async getPillarsForOrg(userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    name: string;
    color: string | null;
    description: string | null;
    objectiveCount: number;
  }>> {
    const where: any = {};

    // Tenant isolation: use OkrTenantGuard to build where clause
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      // User has no org or invalid org → return empty array
      return [];
    }
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no org filter, return all pillars across all orgs

    const pillars = await this.prisma.strategicPillar.findMany({
      where,
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        _count: {
          select: {
            objectives: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform to include objectiveCount
    return pillars.map((pillar: {
      id: string;
      name: string;
      color: string | null;
      description: string | null;
      _count: { objectives: number };
    }) => ({
      id: pillar.id,
      name: pillar.name,
      color: pillar.color,
      description: pillar.description,
      objectiveCount: pillar._count.objectives,
    }));
  }

  /**
   * Get pillar roll-up statistics.
   * 
   * Returns aggregated statistics for each pillar in the tenant:
   * - objectiveCount: number of non-archived objectives linked to the pillar
   * - byState: counts by ObjectiveState (or status if state not present)
   * - avgProgress: average Objective.progress
   * - avgConfidence: average Objective.confidence (if present)
   * - atRiskCount: count of objectives with AT_RISK status
   * 
   * Optional filters: cycleId, teamId, workspaceId
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org
   * @param filters - Optional filters: cycleId, teamId, workspaceId
   * @returns Array of pillar roll-up statistics
   */
  async getPillarRollup(
    userOrganizationId: string | null | undefined,
    filters?: { cycleId?: string; teamId?: string; workspaceId?: string },
  ): Promise<Array<{
    pillarId: string;
    pillarName: string;
    pillarColor: string | null;
    objectiveCount: number;
    byState: Record<string, number>;
    avgProgress: number | null;
    avgConfidence: number | null;
    atRiskCount: number;
  }>> {
    const where: any = {};
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      return [];
    }
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }

    // Build objective filter
    const objectiveWhere: any = {
      pillarId: { not: null },
      state: { not: 'ARCHIVED' },
    };

    if (filters?.cycleId) {
      objectiveWhere.cycleId = filters.cycleId;
    }
    if (filters?.teamId) {
      objectiveWhere.teamId = filters.teamId;
    }
    if (filters?.workspaceId) {
      objectiveWhere.workspaceId = filters.workspaceId;
    }

    // Get all pillars for tenant
    const pillars = await this.prisma.strategicPillar.findMany({
      where,
      select: {
        id: true,
        name: true,
        color: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get objectives grouped by pillarId with aggregations
    const objectives = await this.prisma.objective.groupBy({
      by: ['pillarId'],
      where: objectiveWhere,
      _count: {
        id: true,
      },
      _avg: {
        progress: true,
        confidence: true,
      },
    });

    // Get state/status breakdown per pillar
    const objectivesByPillar = await this.prisma.objective.findMany({
      where: objectiveWhere,
      select: {
        pillarId: true,
        state: true,
        status: true,
      },
    });

    // Build roll-up data
    const rollupMap = new Map<string, {
      pillarId: string;
      pillarName: string;
      pillarColor: string | null;
      objectiveCount: number;
      byState: Record<string, number>;
      progressSum: number;
      progressCount: number;
      confidenceSum: number;
      confidenceCount: number;
      atRiskCount: number;
    }>();

    // Initialize map with pillars
    for (const pillar of pillars) {
      rollupMap.set(pillar.id, {
        pillarId: pillar.id,
        pillarName: pillar.name,
        pillarColor: pillar.color,
        objectiveCount: 0,
        byState: {},
        progressSum: 0,
        progressCount: 0,
        confidenceSum: 0,
        confidenceCount: 0,
        atRiskCount: 0,
      });
    }

    // Aggregate from grouped data
    for (const group of objectives) {
      if (group.pillarId && rollupMap.has(group.pillarId)) {
        const rollup = rollupMap.get(group.pillarId)!;
        rollup.objectiveCount = group._count.id;
        if (group._avg.progress !== null && group._avg.progress !== undefined) {
          rollup.progressSum = (group._avg.progress || 0) * group._count.id;
          rollup.progressCount = group._count.id;
        }
        if (group._avg.confidence !== null && group._avg.confidence !== undefined) {
          rollup.confidenceSum = (group._avg.confidence || 0) * group._count.id;
          rollup.confidenceCount = group._count.id;
        }
      }
    }

    // Process state/status breakdown
    for (const obj of objectivesByPillar) {
      if (obj.pillarId && rollupMap.has(obj.pillarId)) {
        const rollup = rollupMap.get(obj.pillarId)!;
        const stateKey = obj.state || obj.status || 'UNKNOWN';
        rollup.byState[stateKey] = (rollup.byState[stateKey] || 0) + 1;
        if (obj.status === 'AT_RISK') {
          rollup.atRiskCount++;
        }
      }
    }

    // Convert to final format
    return Array.from(rollupMap.values()).map(rollup => ({
      pillarId: rollup.pillarId,
      pillarName: rollup.pillarName,
      pillarColor: rollup.pillarColor,
      objectiveCount: rollup.objectiveCount,
      byState: rollup.byState,
      avgProgress: rollup.progressCount > 0 ? rollup.progressSum / rollup.progressCount : null,
      avgConfidence: rollup.confidenceCount > 0 ? rollup.confidenceSum / rollup.confidenceCount : null,
      atRiskCount: rollup.atRiskCount,
    }));
  }

  /**
   * Get all cycles for an organization (ACTIVE, DRAFT, ARCHIVED, etc.).
   * 
   * Returns all cycles for filtering dropdowns and cycle selection.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns all cycles across all orgs
   * - Else if userOrganizationId is a non-empty string: return all cycles for that org
   * - Else (undefined/falsy): return []
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of cycles with id, name, status, startDate, endDate, tenantId
   */
  async getAllCyclesForOrg(userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    name: string;
    status: string;
    startDate: Date;
    endDate: Date;
    tenantId: string;
  }>> {
    const where: any = {};

    // Tenant isolation: use OkrTenantGuard to build where clause
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      // User has no org or invalid org → return empty array
      return [];
    }
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no org filter, return all cycles across all orgs

    const cycles = await this.prisma.cycle.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        tenantId: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return cycles;
  }

  /**
   * Get active cycles for an organization.
   * 
   * Moved from ObjectiveService.getActiveCycleForOrg() in Phase 4.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns all ACTIVE cycles across all orgs
   * - Else if userOrganizationId is a non-empty string: return ACTIVE cycle(s) for that org
   * - Else (undefined/falsy): return []
   * 
   * This is for UI to show "Current cycle" banner.
   * 
   * TODO [phase7-hardening]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of active cycles with id, name, status, startDate, endDate, tenantId
   */
  async getActiveCycleForOrg(userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    name: string;
    status: string;
    startDate: Date;
    endDate: Date;
    tenantId: string;
  }>> {
    const where: any = {
      status: 'ACTIVE',
    };

    // Tenant isolation: use OkrTenantGuard to build where clause
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      // User has no org or invalid org → return empty array
      return [];
    }
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no org filter, return all ACTIVE cycles across all orgs

    const cycles = await this.prisma.cycle.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        tenantId: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return cycles;
  }

  /**
   * Get strategic pillar coverage for the active cycle.
   * 
   * Moved from ObjectiveService.getPillarCoverageForActiveCycle() in Phase 4.
   * 
   * W3.M2: Now filters by visibility before counting objectives.
   * Only includes objectives visible to the requester.
   * 
   * Shows which pillars have active Objectives in the currently ACTIVE cycle.
   * Returns pillars with zero Objectives flagged for visibility.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns coverage for all orgs
   * - Else if userOrganizationId is a non-empty string: return coverage for that org
   * - Else (undefined/falsy): return []
   * 
   * TODO [phase7-hardening]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
   * TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Array of pillars with id, name, and objectiveCountInActiveCycle
   */
  async getPillarCoverageForActiveCycle(userOrganizationId: string | null | undefined, requesterUserId: string): Promise<Array<{
    pillarId: string;
    pillarName: string;
    objectiveCountInActiveCycle: number;
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    // Build where clause for cycles (tenant isolation)
    const cycleWhere: any = {
      status: 'ACTIVE',
    };
    const cycleOrgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (cycleOrgFilter) {
      cycleWhere.tenantId = cycleOrgFilter.tenantId;
    }
    // Superuser (null): no filter, see all orgs

    // Get active cycle(s) for this org
    const activeCycles = await this.prisma.cycle.findMany({
      where: cycleWhere,
      select: {
        id: true,
        tenantId: true,
      },
    });

    // If no active cycles, return empty array
    if (activeCycles.length === 0) {
      return [];
    }

    // Build where clause for pillars (tenant isolation)
    const pillarWhere: any = {};
    const pillarOrgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (pillarOrgFilter) {
      pillarWhere.tenantId = pillarOrgFilter.tenantId;
    }
    // Superuser (null): no filter, see all orgs

    // Get all pillars in scope
    const pillars = await this.prisma.strategicPillar.findMany({
      where: pillarWhere,
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // For each pillar, count Objectives in active cycle(s) - filter by visibility
    const cycleIds = activeCycles.map((c: { id: string }) => c.id);
    const coverage = await Promise.all(
      pillars.map(async (pillar: { id: string; name: string }) => {
        // Get all Objectives where:
        // - pillarId matches this pillar
        // - cycleId is in active cycle(s)
        const objectives = await this.prisma.objective.findMany({
          where: {
            pillarId: pillar.id,
            cycleId: {
              in: cycleIds,
            },
          },
          select: {
            id: true,
            ownerId: true,
            tenantId: true,
            visibilityLevel: true,
          },
        });

        // Filter by visibility
        let visibleCount = 0;
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
            visibleCount++;
          }
        }

        return {
          pillarId: pillar.id,
          pillarName: pillar.name,
          objectiveCountInActiveCycle: visibleCount,
        };
      })
    );

    return coverage;
  }

  /**
   * Get Objectives owned by a specific user.
   * 
   * Moved from ObjectiveService.getUserOwnedObjectives() in Phase 4.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns all Objectives owned by userId across all orgs
   * - Else if userOrganizationId is a non-empty string: return only Objectives owned by userId in that org
   * - Else (undefined/falsy): return []
   * 
   * @param userId - The user ID to filter by (ownerId)
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of Objectives with id, title, status, progress, isPublished, cycle status, pillar info, team/workspace names
   */
  async getUserOwnedObjectives(userId: string, userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    isPublished: boolean;
    cycleStatus: string | null;
    pillar: { id: string; name: string } | null;
    teamName: string | null;
    workspaceName: string | null;
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    const where: any = {
      ownerId: userId,
    };

    // Tenant isolation: use OkrTenantGuard to build where clause
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no org filter, see all orgs

    const objectives = await this.prisma.objective.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        isPublished: true,
        cycle: {
          select: {
            status: true,
          },
        },
        pillar: {
          select: {
            id: true,
            name: true,
          },
        },
        team: {
          select: {
            name: true,
          },
        },
        workspace: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform to match return type
    return objectives.map((obj) => ({
      id: obj.id,
      title: obj.title,
      status: obj.status,
      progress: obj.progress,
      isPublished: obj.isPublished,
      cycleStatus: obj.cycle?.status || null,
      pillar: obj.pillar,
      teamName: obj.team?.name || null,
      workspaceName: obj.workspace?.name || null,
    }));
  }

  /**
   * Get overdue check-ins for Key Results.
   * 
   * Moved from KeyResultService.getOverdueCheckIns() in Phase 4.
   * 
   * W3.M2: Now filters by visibility before returning overdue check-ins.
   * Only includes overdue KRs whose parent objectives are visible to the requester.
   * 
   * Returns Key Results that haven't been checked in within their expected cadence timeframe.
   * Tenant isolation applies: null (superuser) sees all orgs, string sees that org only, undefined returns [].
   * 
   * TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
   * Future optimization: use SQL window functions or subqueries to calculate overdue in database.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Array of overdue Key Results with KR details, owner info, last check-in, and days late
   */
  async getOverdueCheckIns(
    userOrganizationId: string | null | undefined,
    requesterUserId: string | undefined,
    filters?: {
      cycleId?: string;
      ownerId?: string;
      teamId?: string;
      pillarId?: string;
      limit?: number;
    },
  ): Promise<Array<{
    krId: string;
    krTitle: string;
    objectiveId: string;
    objectiveTitle: string;
    owner: {
      id: string;
      name: string | null;
    };
    cadence: string | null;
    lastCheckInAt: Date | null;
    daysOverdue: number;
    status: 'DUE' | 'OVERDUE';
  }>> {
    console.log('[OKR REPORTING] getOverdueCheckIns called:', { userOrganizationId, requesterUserId, filters });
    try {
      // Tenant isolation: if user has no org, return empty
      if (userOrganizationId === undefined || userOrganizationId === '') {
        return [];
      }

      // Build where clause for objectives (tenant isolation)
      const objectiveWhere: any = {};
      const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
      if (orgFilter) {
        objectiveWhere.tenantId = orgFilter.tenantId;
      }
      // Superuser (null): no filter, see all orgs

      // Apply filters
      if (filters?.cycleId) {
        objectiveWhere.cycleId = filters.cycleId;
      }
      if (filters?.pillarId) {
        objectiveWhere.pillarId = filters.pillarId;
      }
      if (filters?.teamId) {
        objectiveWhere.teamId = filters.teamId;
      }

      // Build KR where clause
      const krWhere: any = {
        objectives: {
          some: {
            objective: objectiveWhere,
          },
        },
        // Only include KRs with a cadence set (not NONE or null)
        checkInCadence: {
          not: null,
          notIn: ['NONE'],
        },
        // Only active KRs (not COMPLETED or CANCELLED)
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
      };

      // Apply owner filter
      if (filters?.ownerId) {
        krWhere.ownerId = filters.ownerId;
      }

      // TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
      // Future optimization: use SQL window functions or subqueries to calculate overdue in database.

      // Fetch all Key Results in scope with their objectives and latest check-in
      const keyResults = await this.prisma.keyResult.findMany({
        where: krWhere,
        include: {
          objectives: {
            include: {
              objective: {
                select: {
                  id: true,
                  title: true,
                  ownerId: true,
                  tenantId: true,
                  visibilityLevel: true,
                  cycleId: true,
                  pillarId: true,
                  teamId: true,
                },
              },
            },
            take: 1, // Use first parent objective for context
          },
          checkIns: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1, // Get latest check-in only
          },
        },
      });

      // Fetch owners for all unique owner IDs
      const ownerIds = [...new Set(keyResults.map(kr => kr.ownerId))];
      const owners = await this.prisma.user.findMany({
        where: {
          id: { in: ownerIds },
        },
        select: {
          id: true,
          name: true,
        },
      });
      const ownerMap = new Map(owners.map(u => [u.id, u]));

      const now = new Date();
      const graceDays = 2; // Default grace period
      const overdueResults: Array<{
        krId: string;
        krTitle: string;
        objectiveId: string;
        objectiveTitle: string;
        owner: {
          id: string;
          name: string | null;
        };
        cadence: string | null;
        lastCheckInAt: Date | null;
        daysOverdue: number;
        status: 'DUE' | 'OVERDUE';
      }> = [];

      for (const kr of keyResults) {
        const objective = kr.objectives[0]?.objective;
        if (!objective) {
          continue; // Skip KRs without parent objective
        }

        if (!objective.tenantId) {
          continue; // Skip objectives without tenantId
        }

        // Filter by visibility
        if (requesterUserId) {
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
            continue; // Skip KRs whose parent objective is not visible
          }
        }

        const owner = ownerMap.get(kr.ownerId);
        if (!owner) {
          continue; // Skip if owner not found
        }

        // Use shared calculator
        const lastCheckIn = kr.checkIns[0];
        const lastCheckInAt = lastCheckIn?.createdAt || null;
        const dueStatus = calculateCheckInDueStatus(
          kr.checkInCadence,
          lastCheckInAt,
          kr.createdAt,
          graceDays,
          now,
        );

        // Only include DUE or OVERDUE
        if (dueStatus.isDue || dueStatus.isOverdue) {
          overdueResults.push({
            krId: kr.id,
            krTitle: kr.title,
            objectiveId: objective.id,
            objectiveTitle: objective.title,
            owner: {
              id: kr.ownerId,
              name: owner.name,
            },
            cadence: kr.checkInCadence,
            lastCheckInAt,
            daysOverdue: Math.max(0, dueStatus.daysSinceLastCheckIn - dueStatus.cadenceDays),
            status: dueStatus.isOverdue ? 'OVERDUE' : 'DUE',
          });
        }
      }

      // Sort by days overdue (most overdue first)
      overdueResults.sort((a, b) => b.daysOverdue - a.daysOverdue);

      // Apply limit
      const limit = filters?.limit || 50;
      return overdueResults.slice(0, limit);
    } catch (error: any) {
      console.error('[OKR REPORTING] Error in getOverdueCheckIns:');
      console.error('[OKR REPORTING] Message:', error?.message || 'Unknown error');
      console.error('[OKR REPORTING] Name:', error?.name || 'Unknown');
      console.error('[OKR REPORTING] Code:', error?.code || 'N/A');
      console.error('[OKR REPORTING] Stack:', error?.stack || 'No stack trace');
      if (error?.meta) {
        console.error('[OKR REPORTING] Prisma Meta:', JSON.stringify(error.meta, null, 2));
      }
      try {
        console.error('[OKR REPORTING] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('[OKR REPORTING] Error object (non-serializable):', error);
      }
      throw error;
    }
  }

  /**
   * Get Key Results owned by a specific user.
   * 
   * Moved from KeyResultService.getUserOwnedKeyResults() in Phase 4.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns all KRs owned by userId across all orgs
   * - Else if userOrganizationId is a non-empty string: return only KRs owned by userId in that org
   * - Else (undefined/falsy): return []
   * 
   * @param userId - The user ID to filter by (ownerId)
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of Key Results with id, title, status, progress, checkInCadence, most recent check-in timestamp, parent objective id/title
   */
  async getUserOwnedKeyResults(userId: string, userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    checkInCadence: string | null;
    lastCheckInAt: Date | null;
    objectiveId: string | null;
    objectiveTitle: string | null;
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    // Build where clause for objectives (tenant isolation)
    const objectiveWhere: any = {};
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter) {
      objectiveWhere.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no filter, see all orgs

    // Find Key Results owned by user that belong to Objectives in scope
    const keyResults = await this.prisma.keyResult.findMany({
      where: {
        ownerId: userId,
        objectives: {
          some: {
            objective: objectiveWhere,
          },
        },
      },
      include: {
        objectives: {
          include: {
            objective: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          take: 1, // Use first parent objective for context
        },
        checkIns: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get latest check-in only
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform to match return type
    return keyResults.map((kr) => {
      const objective = kr.objectives[0]?.objective;
      const lastCheckIn = kr.checkIns[0];

      return {
        id: kr.id,
        title: kr.title,
        status: kr.status,
        progress: kr.progress,
        checkInCadence: kr.checkInCadence,
        lastCheckInAt: lastCheckIn?.createdAt || null,
        objectiveId: objective?.id || null,
        objectiveTitle: objective?.title || null,
      };
    });
  }

  /**
   * Get time-series trend data for a Key Result.
   * 
   * Returns all check-ins for the KR ordered by timestamp (ASC) with value and confidence.
   * Tenant isolation: Verifies KR belongs to user's tenant via parent Objective.
   * RBAC: User must have view_okr permission (checked in controller).
   * 
   * @param keyResultId - Key Result ID
   * @param userTenantId - User's tenant ID for isolation check
   * @returns Array of trend points with timestamp, value, and confidence
   */
  async getKeyResultTrend(
    keyResultId: string,
    userTenantId: string | null | undefined,
  ): Promise<Array<{
    timestamp: string;
    value: number | null;
    confidence: number | null;
  }>> {
    // Tenant isolation: enforce read rules
    OkrTenantGuard.assertCanMutateTenant(userTenantId);

    // Verify key result exists and get tenant ID via parent objective
    const krWithParent = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      select: {
        id: true,
        tenantId: true,
        cycleId: true,
        cycle: {
          select: {
            startDate: true,
            endDate: true,
          },
        },
        objectives: {
          select: {
            objective: {
              select: {
                id: true,
                tenantId: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!krWithParent) {
      throw new NotFoundException(`Key Result with ID ${keyResultId} not found`);
    }

    const objective = krWithParent.objectives[0]?.objective;
    const objectiveOrgId = objective?.tenantId;

    // Tenant isolation: verify org match
    OkrTenantGuard.assertSameTenant(objectiveOrgId, userTenantId);

    // Build where clause for check-ins
    const where: any = {
      keyResultId,
    };

    // Optionally filter by cycle dates if KR has a cycle
    if (krWithParent.cycle?.startDate && krWithParent.cycle?.endDate) {
      where.createdAt = {
        gte: krWithParent.cycle.startDate,
        lte: krWithParent.cycle.endDate,
      };
    }

    // Fetch all check-ins ordered by createdAt ASC (oldest first)
    const checkIns = await this.prisma.checkIn.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        value: true,
        confidence: true,
        createdAt: true,
      },
    });

    // Transform to response format
    return checkIns.map(checkIn => ({
      timestamp: checkIn.createdAt.toISOString(),
      value: checkIn.value,
      confidence: checkIn.confidence,
    }));
  }

  /**
   * Get health heatmap data grouped by dimension (team or pillar) and status.
   * 
   * Returns counts of objectives grouped by the chosen dimension and their status.
   * Tenant isolation: Only includes objectives visible to the requester.
   * RBAC: User must have view_okr permission (checked in controller).
   * 
   * @param by - Dimension to group by: 'team' or 'pillar'
   * @param cycleId - Optional cycle ID to filter objectives
   * @param userOrganizationId - null for superuser (all orgs), string for specific org
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Array of buckets with dimensionId, dimensionName, status, and count, plus totals per dimension
   */
  async getHealthHeatmap(
    by: 'team' | 'pillar',
    cycleId: string | undefined,
    userOrganizationId: string | null | undefined,
    requesterUserId: string,
  ): Promise<{
    buckets: Array<{
      dimensionId: string;
      dimensionName: string;
      status: string;
      count: number;
    }>;
    totals: Array<{
      dimensionId: string;
      dimensionName: string;
      total: number;
    }>;
  }> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return { buckets: [], totals: [] };
    }

    // Build where clause for objectives
    const where: any = {};
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter) {
      where.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no filter, see all orgs

    if (cycleId) {
      where.cycleId = cycleId;
    }

    // Fetch objectives with their dimension and status
    const objectives = await this.prisma.objective.findMany({
      where,
      select: {
        id: true,
        status: true,
        teamId: true,
        team: by === 'team' ? {
          select: {
            id: true,
            name: true,
          },
        } : undefined,
        pillarId: true,
        pillar: by === 'pillar' ? {
          select: {
            id: true,
            name: true,
          },
        } : undefined,
        ownerId: true,
        tenantId: true,
        visibilityLevel: true,
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

    // Group by dimension and status
    const bucketsMap = new Map<string, Map<string, number>>();
    const dimensionNames = new Map<string, string>();

    for (const obj of visibleObjectives) {
      const dimensionId = by === 'team' ? obj.teamId : obj.pillarId;
      const dimensionName = by === 'team' 
        ? (obj.team?.name || 'Unassigned')
        : (obj.pillar?.name || 'Unassigned');

      if (!dimensionId) {
        // Handle null dimension (unassigned)
        const key = 'unassigned';
        if (!dimensionNames.has(key)) {
          dimensionNames.set(key, 'Unassigned');
        }
        if (!bucketsMap.has(key)) {
          bucketsMap.set(key, new Map());
        }
        const statusMap = bucketsMap.get(key)!;
        const status = obj.status || 'ON_TRACK';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
        continue;
      }

      dimensionNames.set(dimensionId, dimensionName);
      if (!bucketsMap.has(dimensionId)) {
        bucketsMap.set(dimensionId, new Map());
      }
      const statusMap = bucketsMap.get(dimensionId)!;
      const status = obj.status || 'ON_TRACK';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    }

    // Convert to response format
    const buckets: Array<{
      dimensionId: string;
      dimensionName: string;
      status: string;
      count: number;
    }> = [];

    for (const [dimensionId, statusMap] of bucketsMap.entries()) {
      const dimensionName = dimensionNames.get(dimensionId) || 'Unknown';
      for (const [status, count] of statusMap.entries()) {
        buckets.push({
          dimensionId: dimensionId === 'unassigned' ? '' : dimensionId,
          dimensionName,
          status,
          count,
        });
      }
    }

    // Calculate totals per dimension
    const totalsMap = new Map<string, number>();
    for (const bucket of buckets) {
      const current = totalsMap.get(bucket.dimensionId) || 0;
      totalsMap.set(bucket.dimensionId, current + bucket.count);
    }

    const totals: Array<{
      dimensionId: string;
      dimensionName: string;
      total: number;
    }> = [];

    for (const [dimensionId, total] of totalsMap.entries()) {
      const dimensionName = dimensionNames.get(dimensionId === '' ? 'unassigned' : dimensionId) || 'Unknown';
      totals.push({
        dimensionId: dimensionId === 'unassigned' ? '' : dimensionId,
        dimensionName,
        total,
      });
    }

    return { buckets, totals };
  }

  /**
   * Get at-risk Objectives and Key Results.
   * 
   * Returns entities that are at-risk based on:
   * - Status in {AT_RISK, OFF_TRACK, BLOCKED}
   * - OR latest check-in confidence below threshold (default 50, configurable via CONFIDENCE_AT_RISK_THRESHOLD)
   * 
   * Tenant isolation: Only includes entities visible to the requester.
   * RBAC: User must have view_okr permission (checked in controller).
   * 
   * @param filters - Optional filters: cycleId, ownerId, teamId, pillarId
   * @param userOrganizationId - null for superuser (all orgs), string for specific org
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Array of at-risk entities with type, id, title, owner, status, confidence, lastUpdatedAt, dimensionRefs
   */
  async getAtRisk(
    filters: {
      cycleId?: string;
      ownerId?: string;
      teamId?: string;
      pillarId?: string;
    },
    userOrganizationId: string | null | undefined,
    requesterUserId: string,
  ): Promise<Array<{
    entityType: 'OBJECTIVE' | 'KEY_RESULT';
    id: string;
    title: string;
    owner: {
      id: string;
      name: string | null;
    };
    status: string;
    confidence: number | null;
    lastUpdatedAt: string;
    dimensionRefs: {
      objectiveId?: string;
      objectiveTitle?: string;
      teamId?: string;
      teamName?: string | null;
      pillarId?: string;
      pillarName?: string | null;
      cycleId?: string;
      cycleName?: string | null;
    };
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    // Get confidence threshold from config (default 50)
    const confidenceThreshold = parseInt(
      this.configService.get<string>('CONFIDENCE_AT_RISK_THRESHOLD') || '50',
      10,
    );

    // Build where clause for objectives
    const objectiveWhere: any = {};
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter) {
      objectiveWhere.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no filter, see all orgs

    if (filters.cycleId) {
      objectiveWhere.cycleId = filters.cycleId;
    }
    if (filters.ownerId) {
      objectiveWhere.ownerId = filters.ownerId;
    }
    if (filters.teamId) {
      objectiveWhere.teamId = filters.teamId;
    }
    if (filters.pillarId) {
      objectiveWhere.pillarId = filters.pillarId;
    }

    // Fetch objectives with their KRs and latest check-ins
    const objectives = await this.prisma.objective.findMany({
      where: objectiveWhere,
      select: {
        id: true,
        title: true,
        status: true,
        ownerId: true,
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        tenantId: true,
        visibilityLevel: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        pillarId: true,
        pillar: {
          select: {
            id: true,
            name: true,
          },
        },
        cycleId: true,
        cycle: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
        keyResults: {
          select: {
            keyResult: {
              select: {
                id: true,
                title: true,
                status: true,
                ownerId: true,
                updatedAt: true,
                checkIns: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: {
                    confidence: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Filter by visibility and check risk
    const atRiskEntities: Array<{
      entityType: 'OBJECTIVE' | 'KEY_RESULT';
      id: string;
      title: string;
      owner: { id: string; name: string | null };
      status: string;
      confidence: number | null;
      lastUpdatedAt: string;
      dimensionRefs: {
        objectiveId?: string;
        objectiveTitle?: string;
        teamId?: string;
        teamName?: string | null;
        pillarId?: string;
        pillarName?: string | null;
        cycleId?: string;
        cycleName?: string | null;
      };
    }> = [];

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

      // Check if objective is at-risk
      const objectiveRisk = isAtRisk({
        status: obj.status,
        latestConfidence: null, // Objectives don't have confidence
        confidenceThreshold,
      });

      if (objectiveRisk.isAtRisk) {
        atRiskEntities.push({
          entityType: 'OBJECTIVE',
          id: obj.id,
          title: obj.title,
          owner: obj.owner,
          status: obj.status,
          confidence: null,
          lastUpdatedAt: obj.updatedAt.toISOString(),
          dimensionRefs: {
            teamId: obj.teamId || undefined,
            teamName: obj.team?.name || null,
            pillarId: obj.pillarId || undefined,
            pillarName: obj.pillar?.name || null,
            cycleId: obj.cycleId || undefined,
            cycleName: obj.cycle?.name || null,
          },
        });
      }

      // Check Key Results
      for (const krLink of obj.keyResults) {
        const kr = krLink.keyResult;
        const latestConfidence = kr.checkIns[0]?.confidence ?? null;

        const krRisk = isAtRisk({
          status: kr.status,
          latestConfidence,
          confidenceThreshold,
        });

        if (krRisk.isAtRisk) {
          // Fetch owner separately since KeyResult doesn't have owner relation
          const krOwner = await this.prisma.user.findUnique({
            where: { id: kr.ownerId },
            select: { id: true, name: true },
          });

          atRiskEntities.push({
            entityType: 'KEY_RESULT',
            id: kr.id,
            title: kr.title,
            owner: krOwner || { id: kr.ownerId, name: null },
            status: kr.status,
            confidence: latestConfidence,
            lastUpdatedAt: kr.updatedAt.toISOString(),
            dimensionRefs: {
              objectiveId: obj.id,
              objectiveTitle: obj.title,
              teamId: obj.teamId || undefined,
              teamName: obj.team?.name || null,
              pillarId: obj.pillarId || undefined,
              pillarName: obj.pillar?.name || null,
              cycleId: obj.cycleId || undefined,
              cycleName: obj.cycle?.name || null,
            },
          });
        }
      }
    }

    return atRiskEntities;
  }

  /**
   * Get cycle health summary for a specific cycle.
   * 
   * Returns four KPIs:
   * 1. Totals by status (objectives grouped by status)
   * 2. Average confidence (from latest check-ins across all KRs)
   * 3. % objectives with ≥2 KRs
   * 4. % KRs with ≥1 check-in in last 14 days
   * 
   * Tenant isolation: Only includes entities visible to the requester.
   * RBAC: User must have view_okr permission (checked in controller).
   * 
   * @param cycleId - Cycle ID to filter by
   * @param userOrganizationId - null for superuser (all orgs), string for specific org
   * @param requesterUserId - User ID of the requester (for visibility checks)
   * @returns Cycle health summary with totalsByStatus, avgConfidence, coverage
   */
  async getCycleHealth(
    cycleId: string,
    userOrganizationId: string | null | undefined,
    requesterUserId: string,
  ): Promise<{
    totalsByStatus: {
      ON_TRACK: number;
      AT_RISK: number;
      OFF_TRACK: number;
      BLOCKED: number;
      COMPLETED: number;
      CANCELLED: number;
    };
    avgConfidence: number | null;
    coverage: {
      objectivesWith2PlusKRsPct: number;
      krsWithRecentCheckInPct: number;
    };
  }> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return {
        totalsByStatus: {
          ON_TRACK: 0,
          AT_RISK: 0,
          OFF_TRACK: 0,
          BLOCKED: 0,
          COMPLETED: 0,
          CANCELLED: 0,
        },
        avgConfidence: null,
        coverage: {
          objectivesWith2PlusKRsPct: 0,
          krsWithRecentCheckInPct: 0,
        },
      };
    }

    // Build where clause for objectives
    const objectiveWhere: any = { cycleId };
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter) {
      objectiveWhere.tenantId = orgFilter.tenantId;
    }
    // Superuser (null): no filter, see all orgs

    // Fetch objectives with their KRs and latest check-ins
    const objectives = await this.prisma.objective.findMany({
      where: objectiveWhere,
      select: {
        id: true,
        status: true,
        ownerId: true,
        tenantId: true,
        visibilityLevel: true,
        keyResults: {
          select: {
            keyResult: {
              select: {
                id: true,
                checkIns: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: {
                    confidence: true,
                    createdAt: true,
                  },
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

    // KPI 1: Totals by status
    const totalsByStatus = {
      ON_TRACK: 0,
      AT_RISK: 0,
      OFF_TRACK: 0,
      BLOCKED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const obj of visibleObjectives) {
      const status = obj.status || 'ON_TRACK';
      if (status in totalsByStatus) {
        totalsByStatus[status as keyof typeof totalsByStatus]++;
      }
    }

    // KPI 2: Average confidence (from latest check-ins)
    const confidences: number[] = [];
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    let krsWithRecentCheckIn = 0;
    let totalKRs = 0;

    for (const obj of visibleObjectives) {
      const krCount = obj.keyResults.length;
      totalKRs += krCount;

      for (const krLink of obj.keyResults) {
        const kr = krLink.keyResult;
        const latestCheckIn = kr.checkIns[0];

        if (latestCheckIn) {
          // Collect confidence for average
          if (latestCheckIn.confidence !== null && latestCheckIn.confidence !== undefined) {
            confidences.push(latestCheckIn.confidence);
          }

          // Check if check-in is within last 14 days
          if (latestCheckIn.createdAt >= fourteenDaysAgo) {
            krsWithRecentCheckIn++;
          }
        }
      }
    }

    const avgConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : null;

    // KPI 3: % objectives with ≥2 KRs
    const objectivesWith2PlusKRs = visibleObjectives.filter(
      (obj) => obj.keyResults.length >= 2
    ).length;
    const objectivesWith2PlusKRsPct = visibleObjectives.length > 0
      ? (objectivesWith2PlusKRs / visibleObjectives.length) * 100
      : 0;

    // KPI 4: % KRs with ≥1 check-in in last 14 days
    const krsWithRecentCheckInPct = totalKRs > 0
      ? (krsWithRecentCheckIn / totalKRs) * 100
      : 0;

    return {
      totalsByStatus,
      avgConfidence: avgConfidence !== null ? Math.round(avgConfidence * 100) / 100 : null,
      coverage: {
        objectivesWith2PlusKRsPct: Math.round(objectivesWith2PlusKRsPct * 100) / 100,
        krsWithRecentCheckInPct: Math.round(krsWithRecentCheckInPct * 100) / 100,
      },
    };
  }
}
