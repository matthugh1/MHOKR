import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';

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
  ) {}

  /**
   * Get organization-level summary statistics for analytics.
   * 
   * Moved from ObjectiveService.getOrgSummary() in Phase 4.
   * 
   * TODO [phase7-performance]: May need optimization for large datasets.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Summary object with total objectives, counts by status, and at-risk ratio
   */
  async getOrgSummary(userOrganizationId: string | null | undefined): Promise<{
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
      where.organizationId = orgFilter.organizationId;
    }
    // Superuser (null): aggregate across ALL organisations

    // Get all objectives with their status
    const objectives = await this.prisma.objective.findMany({
      where,
      select: {
        status: true,
      },
    });

    const totalObjectives = objectives.length;
    const byStatus: { [status: string]: number } = {};
    let atRiskCount = 0;

    // Count by status
    for (const obj of objectives) {
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
        'period',
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
      where.organizationId = orgFilter.organizationId;
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
      'period',
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
        escapeCSV(obj.period),
        escapeCSV(obj.startDate?.toISOString().split('T')[0] || ''),
        escapeCSV(obj.endDate?.toISOString().split('T')[0] || ''),
        escapeCSV(obj.parentId),
        escapeCSV(obj.organizationId),
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
   * Returns last ~10 check-ins across all Key Results in the user's organization.
   * Tenant isolation MUST apply - only includes check-ins for KRs whose parent objectives
   * are in the user's organization (or all orgs if superuser).
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of recent check-ins with KR title, user info, value, confidence, timestamp
   */
  async getRecentCheckInFeed(userOrganizationId: string | null | undefined): Promise<Array<{
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
      objectiveWhere.organizationId = orgFilter.organizationId;
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

    // Fetch user names for all unique user IDs
    const userIds = [...new Set(checkIns.map(ci => ci.userId))];
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
    return checkIns.map(checkIn => ({
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
      where.organizationId = orgFilter.organizationId;
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
   * @returns Array of active cycles with id, name, status, startDate, endDate, organizationId
   */
  async getActiveCycleForOrg(userOrganizationId: string | null | undefined): Promise<Array<{
    id: string;
    name: string;
    status: string;
    startDate: Date;
    endDate: Date;
    organizationId: string;
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
      where.organizationId = orgFilter.organizationId;
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
        organizationId: true,
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
   * Shows which pillars have active Objectives in the currently ACTIVE cycle.
   * Returns pillars with zero Objectives flagged for visibility.
   * 
   * Tenant isolation:
   * - If userOrganizationId === null (superuser): returns coverage for all orgs
   * - Else if userOrganizationId is a non-empty string: return coverage for that org
   * - Else (undefined/falsy): return []
   * 
   * TODO [phase7-hardening]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
   * TODO [phase6-polish]: Frontend - highlight strategic gaps (pillars with zero objectives).
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of pillars with id, name, and objectiveCountInActiveCycle
   */
  async getPillarCoverageForActiveCycle(userOrganizationId: string | null | undefined): Promise<Array<{
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
      cycleWhere.organizationId = cycleOrgFilter.organizationId;
    }
    // Superuser (null): no filter, see all orgs

    // Get active cycle(s) for this org
    const activeCycles = await this.prisma.cycle.findMany({
      where: cycleWhere,
      select: {
        id: true,
        organizationId: true,
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
      pillarWhere.organizationId = pillarOrgFilter.organizationId;
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

    // For each pillar, count Objectives in active cycle(s)
    const cycleIds = activeCycles.map((c: { id: string }) => c.id);
    const coverage = await Promise.all(
      pillars.map(async (pillar: { id: string; name: string }) => {
        // Count Objectives where:
        // - pillarId matches this pillar
        // - cycleId is in active cycle(s)
        const objectiveCount = await this.prisma.objective.count({
          where: {
            pillarId: pillar.id,
            cycleId: {
              in: cycleIds,
            },
          },
        });

        return {
          pillarId: pillar.id,
          pillarName: pillar.name,
          objectiveCountInActiveCycle: objectiveCount,
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
      where.organizationId = orgFilter.organizationId;
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
   * Returns Key Results that haven't been checked in within their expected cadence period.
   * Tenant isolation applies: null (superuser) sees all orgs, string sees that org only, undefined returns [].
   * 
   * TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
   * Future optimization: use SQL window functions or subqueries to calculate overdue in database.
   * 
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Array of overdue Key Results with KR details, owner info, last check-in, and days late
   */
  async getOverdueCheckIns(userOrganizationId: string | null | undefined): Promise<Array<{
    krId: string;
    krTitle: string;
    objectiveId: string;
    objectiveTitle: string;
    ownerId: string;
    ownerName: string | null;
    ownerEmail: string;
    lastCheckInAt: Date | null;
    daysLate: number;
    cadence: string | null;
  }>> {
    // Tenant isolation: if user has no org, return empty
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return [];
    }

    // Build where clause for objectives (tenant isolation)
    const objectiveWhere: any = {};
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter) {
      objectiveWhere.organizationId = orgFilter.organizationId;
    }
    // Superuser (null): no filter, see all orgs

    // TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
    // Future optimization: use SQL window functions or subqueries to calculate overdue in database.

    // Fetch all Key Results in scope with their objectives and latest check-in
    const keyResults = await this.prisma.keyResult.findMany({
      where: {
        objectives: {
          some: {
            objective: objectiveWhere,
          },
        },
        // Only include KRs with a cadence set (or filter out NONE)
        checkInCadence: {
          not: null,
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
        email: true,
      },
    });
    const ownerMap = new Map(owners.map(u => [u.id, u]));

    const now = new Date();
    const overdueResults: Array<{
      krId: string;
      krTitle: string;
      objectiveId: string;
      objectiveTitle: string;
      ownerId: string;
      ownerName: string | null;
      ownerEmail: string;
      lastCheckInAt: Date | null;
      daysLate: number;
      cadence: string | null;
    }> = [];

    for (const kr of keyResults) {
      // Skip if cadence is NONE or null
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
          continue; // Skip unknown cadence
      }

      // Get latest check-in timestamp
      const lastCheckIn = kr.checkIns[0];
      const lastCheckInAt = lastCheckIn?.createdAt || null;

      // If no check-in exists, consider it overdue (use KR creation date as baseline)
      let daysSinceLastCheckIn: number;
      if (!lastCheckInAt) {
        // No check-in ever - use KR creation date
        const daysSinceCreation = Math.floor((now.getTime() - kr.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        daysSinceLastCheckIn = daysSinceCreation;
      } else {
        // Calculate days since last check-in
        daysSinceLastCheckIn = Math.floor((now.getTime() - lastCheckInAt.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Check if overdue
      if (daysSinceLastCheckIn > maxAgeDays) {
        const objective = kr.objectives[0]?.objective;
        if (!objective) {
          continue; // Skip KRs without parent objective
        }

        const owner = ownerMap.get(kr.ownerId);
        if (!owner) {
          continue; // Skip if owner not found
        }

        overdueResults.push({
          krId: kr.id,
          krTitle: kr.title,
          objectiveId: objective.id,
          objectiveTitle: objective.title,
          ownerId: kr.ownerId,
          ownerName: owner.name,
          ownerEmail: owner.email,
          lastCheckInAt,
          daysLate: daysSinceLastCheckIn - maxAgeDays,
          cadence: kr.checkInCadence,
        });
      }
    }

    // Sort by days late (most overdue first)
    overdueResults.sort((a, b) => b.daysLate - a.daysLate);

    return overdueResults;
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
      objectiveWhere.organizationId = orgFilter.organizationId;
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
}
