import { Controller, Get, Query, UseGuards, Req, Res, ForbiddenException, BadRequestException, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { OkrReportingService } from './okr-reporting.service';
import { RBACService } from '../rbac/rbac.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { recordOverdueCheckInsFetch, recordTrendFetch, recordHeatmapFetch, recordAtRiskFetch, recordCycleHealthFetch } from './check-in-telemetry';
import { checkInTelemetry } from './check-in-telemetry';

/**
 * OKR Reporting Controller
 * 
 * Dedicated controller for analytics, reporting, and export endpoints.
 * 
 * Responsibilities:
 * - Analytics summary
 * - CSV export
 * - Recent check-in feed
 * - Strategic pillar coverage
 * - Active cycle queries
 * - Overdue check-ins
 * 
 * TODO Phase 2: Move the following endpoints from ObjectiveController:
 * - GET /objectives/analytics/summary → GET /reports/analytics/summary
 * - GET /objectives/analytics/feed → GET /reports/analytics/feed
 * - GET /objectives/export/csv → GET /reports/export/csv
 * - GET /objectives/pillars → GET /reports/pillars
 * - GET /objectives/cycles/active → GET /reports/cycles/active
 * - GET /objectives/pillars/coverage → GET /reports/pillars/coverage
 * 
 * TODO Phase 2: Move the following endpoints from KeyResultController:
 * - GET /key-results/overdue → GET /reports/check-ins/overdue
 */
@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class OkrReportingController {
  constructor(
    private readonly reportingService: OkrReportingService,
    private readonly rbacService: RBACService,
  ) {}

  /**
   * Get organization-level summary statistics for analytics.
   * 
   * Moved from ObjectiveController in Phase 4.
   */
  @Get('analytics/summary')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get organization summary statistics' })
  async getAnalyticsSummary(@Req() req: any) {
    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;
    return this.reportingService.getOrgSummary(userOrganizationId, requesterUserId);
  }

  /**
   * Get recent check-in activity feed.
   * 
   * Moved from ObjectiveController in Phase 4.
   * TODO [phase7-hardening]: Frontend - add this feed to analytics dashboard.
   * NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
   */
  @Get('analytics/feed')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent check-in activity feed' })
  async getAnalyticsFeed(@Req() req: any) {
    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;
    return this.reportingService.getRecentCheckInFeed(userOrganizationId, requesterUserId);
  }

  /**
   * Export objectives and key results as CSV.
   * 
   * Moved from ObjectiveController in Phase 4.
   * Enforces RBAC export_data permission check.
   * 
   * TODO [phase7-hardening]: Frontend - add Export CSV button in analytics dashboard for TENANT_OWNER / TENANT_ADMIN.
   * NOTE: This surface is admin-only and is not exposed to external design partners.
   */
  @Get('export/csv')
  @RequireAction('export_data')
  @ApiOperation({ summary: 'Export objectives and key results as CSV' })
  async exportCSV(@Req() req: any, @Res() res: Response) {
    const userId = req.user?.id;
    const userOrganizationId = req.user?.tenantId ?? null;

    // Authorize using RBAC: check export_data permission
    const resourceContext = {
      tenantId: userOrganizationId || '',
      workspaceId: null,
      teamId: null,
    };

    const canExport = await this.rbacService.canPerformAction(
      userId,
      'export_data',
      resourceContext,
    );

    if (!canExport) {
      throw new ForbiddenException('You do not have permission to export data');
    }

    // Generate CSV
    const csv = await this.reportingService.exportObjectivesCSV(userOrganizationId);

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="okr-export-${new Date().toISOString().split('T')[0]}.csv"`);

    return res.send(csv);
  }

  /**
   * Get active cycles for the organization.
   * 
   * Moved from ObjectiveController in Phase 4.
   * TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
   * 
   * NOTE: This route must come BEFORE @Get('cycles') to avoid route matching conflicts in NestJS.
   */
  @Get('cycles/active')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get active cycles for the organization' })
  async getActiveCycles(@Req() req: any) {
    const userOrganizationId = req.user?.tenantId ?? null;
    return this.reportingService.getActiveCycleForOrg(userOrganizationId);
  }

  /**
   * Get all cycles for the organization (ACTIVE, DRAFT, ARCHIVED, etc.).
   * 
   * Returns all cycles for filtering dropdowns and cycle selection.
   * 
   * NOTE: This route must come AFTER @Get('cycles/active') to avoid route matching conflicts in NestJS.
   */
  @Get('cycles')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all cycles for the organization' })
  async getAllCycles(@Req() req: any) {
    const userOrganizationId = req.user?.tenantId ?? null;
    return this.reportingService.getAllCyclesForOrg(userOrganizationId);
  }

  /**
   * Get strategic pillars for the organization.
   * 
   * Moved from ObjectiveController in Phase 4.
   * TODO [phase7-hardening]: Frontend - use this to populate a 'filter by strategic bet' dropdown in analytics and OKR list.
   * NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
   */
  @Get('pillars')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get strategic pillars for the organization' })
  async getPillars(@Req() req: any) {
    const userOrganizationId = req.user?.tenantId ?? null;
    return this.reportingService.getPillarsForOrg(userOrganizationId);
  }

  @Get('pillars/rollup')
  @RequireAction('view_okr')
  @ApiOperation({ 
    summary: 'Get pillar roll-up statistics', 
    description: 'Returns aggregated statistics (objective counts, averages, state breakdown) for each pillar.' 
  })
  @ApiQuery({ name: 'cycleId', required: false, description: 'Filter by cycle ID' })
  @ApiQuery({ name: 'teamId', required: false, description: 'Filter by team ID' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Filter by workspace ID' })
  @ApiResponse({ status: 200, description: 'Pillar roll-up statistics' })
  async getPillarRollup(
    @Query('cycleId') cycleId: string | undefined,
    @Query('teamId') teamId: string | undefined,
    @Query('workspaceId') workspaceId: string | undefined,
    @Req() req: any,
  ) {
    const userOrganizationId = req.user?.tenantId ?? null;
    return this.reportingService.getPillarRollup(userOrganizationId, {
      cycleId,
      teamId,
      workspaceId,
    });
  }

  /**
   * Get strategic pillar coverage for active cycle.
   * 
   * Moved from ObjectiveController in Phase 4.
   * TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
   */
  @Get('pillars/coverage')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get strategic pillar coverage for active cycle' })
  async getPillarCoverage(@Req() req: any) {
    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;
    return this.reportingService.getPillarCoverageForActiveCycle(userOrganizationId, requesterUserId);
  }

  /**
   * Get time-series trend data for a Key Result.
   * 
   * Returns all check-ins for the KR ordered by timestamp (ASC) with value and confidence.
   * Tenant isolation: Verifies KR belongs to user's tenant via parent Objective.
   * RBAC: User must have view_okr permission.
   * 
   * @param id - Key Result ID
   * @param req - Request object with user info
   * @returns Array of trend points with timestamp, value, and confidence
   */
  @Get('krs/:id/trend')
  @UseGuards(RateLimitGuard)
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get time-series trend data for a Key Result' })
  @ApiResponse({
    status: 200,
    description: 'Trend data array',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00Z' },
          value: { type: 'number', nullable: true, example: 75.5 },
          confidence: { type: 'number', nullable: true, example: 85 },
        },
        required: ['timestamp', 'value', 'confidence'],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission or cannot access this key result' })
  @ApiResponse({ status: 404, description: 'Key Result not found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - rate limit exceeded' })
  async getKeyResultTrend(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userOrganizationId = req.user?.tenantId ?? null;
    
    const result = await checkInTelemetry.time(
      'reports.trend.fetch',
      () => this.reportingService.getKeyResultTrend(id, userOrganizationId),
      {
        tenantId: userOrganizationId || 'unknown',
        keyResultId: id,
      },
    );

    recordTrendFetch({
      tenantId: userOrganizationId || 'unknown',
      keyResultId: id,
    });

    return result;
  }

  /**
   * Get at-risk Objectives and Key Results.
   * 
   * Returns entities that are at-risk based on status or confidence threshold.
   * Tenant isolation: Only includes entities visible to the requester.
   * RBAC: User must have view_okr permission.
   * 
   * @param cycleId - Optional cycle ID filter
   * @param ownerId - Optional owner ID filter
   * @param teamId - Optional team ID filter
   * @param pillarId - Optional pillar ID filter
   * @param req - Request object with user info
   * @returns Array of at-risk entities
   */
  @Get('at-risk')
  @UseGuards(RateLimitGuard)
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get at-risk Objectives and Key Results' })
  @ApiQuery({ name: 'cycleId', required: false, type: String, description: 'Filter by cycle ID' })
  @ApiQuery({ name: 'ownerId', required: false, type: String, description: 'Filter by owner user ID' })
  @ApiQuery({ name: 'teamId', required: false, type: String, description: 'Filter by team ID' })
  @ApiQuery({ name: 'pillarId', required: false, type: String, description: 'Filter by strategic pillar ID' })
  @ApiResponse({
    status: 200,
    description: 'Array of at-risk entities',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          entityType: { type: 'string', enum: ['OBJECTIVE', 'KEY_RESULT'] },
          id: { type: 'string', example: 'obj-123' },
          title: { type: 'string', example: 'Increase revenue' },
          owner: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'user-123' },
              name: { type: 'string', nullable: true, example: 'John Doe' },
            },
          },
          status: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'BLOCKED', 'COMPLETED', 'CANCELLED'] },
          confidence: { type: 'number', nullable: true, example: 45 },
          lastUpdatedAt: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00Z' },
          dimensionRefs: {
            type: 'object',
            properties: {
              objectiveId: { type: 'string', nullable: true },
              objectiveTitle: { type: 'string', nullable: true },
              teamId: { type: 'string', nullable: true },
              teamName: { type: 'string', nullable: true },
              pillarId: { type: 'string', nullable: true },
              pillarName: { type: 'string', nullable: true },
              cycleId: { type: 'string', nullable: true },
              cycleName: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - rate limit exceeded' })
  async getAtRisk(
    @Query('cycleId') cycleId: string | undefined,
    @Query('ownerId') ownerId: string | undefined,
    @Query('teamId') teamId: string | undefined,
    @Query('pillarId') pillarId: string | undefined,
    @Req() req: any,
  ) {
    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;
    
    const result = await checkInTelemetry.time(
      'reports.atRisk.fetch',
      () => this.reportingService.getAtRisk(
        {
          cycleId,
          ownerId,
          teamId,
          pillarId,
        },
        userOrganizationId,
        requesterUserId,
      ),
      {
        tenantId: userOrganizationId || 'unknown',
        cycleId: cycleId || 'none',
        ownerId: ownerId || 'none',
        teamId: teamId || 'none',
        pillarId: pillarId || 'none',
      },
    );

    recordAtRiskFetch({
      tenantId: userOrganizationId || 'unknown',
      cycleId: cycleId || 'none',
      ownerId: ownerId || 'none',
      teamId: teamId || 'none',
      pillarId: pillarId || 'none',
    });

    return result;
  }

  /**
   * Get cycle health summary for a specific cycle.
   * 
   * Returns four KPIs:
   * - Totals by status (objectives grouped by status)
   * - Average confidence (from latest check-ins)
   * - % objectives with ≥2 KRs
   * - % KRs with ≥1 check-in in last 14 days
   * 
   * Tenant isolation: Only includes entities visible to the requester.
   * RBAC: User must have view_okr permission.
   * 
   * @param cycleId - Cycle ID (required)
   * @param req - Request object with user info
   * @returns Cycle health summary
   */
  @Get('cycle-health')
  @UseGuards(RateLimitGuard)
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get cycle health summary' })
  @ApiQuery({ name: 'cycleId', required: true, type: String, description: 'Cycle ID' })
  @ApiResponse({
    status: 200,
    description: 'Cycle health summary',
    schema: {
      type: 'object',
      properties: {
        totalsByStatus: {
          type: 'object',
          properties: {
            ON_TRACK: { type: 'number', example: 10 },
            AT_RISK: { type: 'number', example: 3 },
            OFF_TRACK: { type: 'number', example: 1 },
            BLOCKED: { type: 'number', example: 0 },
            COMPLETED: { type: 'number', example: 5 },
            CANCELLED: { type: 'number', example: 0 },
          },
        },
        avgConfidence: { type: 'number', nullable: true, example: 75.5 },
        coverage: {
          type: 'object',
          properties: {
            objectivesWith2PlusKRsPct: { type: 'number', example: 85.5 },
            krsWithRecentCheckInPct: { type: 'number', example: 72.3 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Missing cycleId parameter' })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - rate limit exceeded' })
  async getCycleHealth(
    @Query('cycleId') cycleId: string | undefined,
    @Req() req: any,
  ) {
    if (!cycleId) {
      throw new BadRequestException('cycleId parameter is required');
    }
    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;
    
    const result = await checkInTelemetry.time(
      'reports.cycleHealth.fetch',
      () => this.reportingService.getCycleHealth(
        cycleId,
        userOrganizationId,
        requesterUserId,
      ),
      {
        tenantId: userOrganizationId || 'unknown',
        cycleId,
      },
    );

    recordCycleHealthFetch({
      tenantId: userOrganizationId || 'unknown',
      cycleId,
    });

    return result;
  }

  /**
   * Get health heatmap data grouped by dimension (team or pillar) and status.
   * 
   * Returns counts of objectives grouped by the chosen dimension and their status.
   * Tenant isolation: Only includes objectives visible to the requester.
   * RBAC: User must have view_okr permission.
   * 
   * @param by - Dimension to group by: 'team' or 'pillar'
   * @param cycleId - Optional cycle ID to filter objectives
   * @param req - Request object with user info
   * @returns Buckets with dimensionId, dimensionName, status, count, plus totals per dimension
   */
  @Get('health-heatmap')
  @UseGuards(RateLimitGuard)
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get health heatmap data grouped by dimension and status' })
  @ApiQuery({ name: 'by', required: true, enum: ['team', 'pillar'], description: 'Dimension to group by' })
  @ApiQuery({ name: 'cycleId', required: false, type: String, description: 'Optional cycle ID to filter objectives' })
  @ApiResponse({
    status: 200,
    description: 'Health heatmap data',
    schema: {
      type: 'object',
      properties: {
        buckets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dimensionId: { type: 'string', example: 'team-123' },
              dimensionName: { type: 'string', example: 'Engineering' },
              status: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED', 'CANCELLED'] },
              count: { type: 'number', example: 5 },
            },
          },
        },
        totals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dimensionId: { type: 'string', example: 'team-123' },
              dimensionName: { type: 'string', example: 'Engineering' },
              total: { type: 'number', example: 12 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid by parameter (must be team or pillar)' })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - rate limit exceeded' })
  async getHealthHeatmap(
    @Query('by') by: string,
    @Query('cycleId') cycleId: string | undefined,
    @Req() req: any,
  ) {
    if (by !== 'team' && by !== 'pillar') {
      throw new BadRequestException('by parameter must be "team" or "pillar"');
    }

    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;
    
    const result = await checkInTelemetry.time(
      'reports.heatmap.fetch',
      () => this.reportingService.getHealthHeatmap(
        by as 'team' | 'pillar',
        cycleId,
        userOrganizationId,
        requesterUserId,
      ),
      {
        tenantId: userOrganizationId || 'unknown',
        by,
        cycleId: cycleId || 'none',
      },
    );

    recordHeatmapFetch({
      tenantId: userOrganizationId || 'unknown',
      by,
      cycleId: cycleId || 'none',
    });

    return result;
  }

  /**
   * Get overdue check-ins for Key Results.
   * 
   * Returns Key Results that are due or overdue for check-ins based on their checkInCadence.
   * Supports filtering by cycleId, ownerId, teamId, pillarId, and limit.
   * 
   * RBAC: Requires view_okr permission. Results are filtered by tenant isolation and visibility rules.
   * Cadence rules: WEEKLY (7 days), BIWEEKLY (14 days), MONTHLY (30 days). Grace period: 2 days (configurable via OKR_CHECKIN_GRACE_DAYS).
   * Feature flag: Controlled by OKR_CHECKIN_REMINDERS_ENABLED (affects reminder scheduler, not this endpoint).
   * 
   * Moved from KeyResultController in Phase 4.
   */
  @Get('check-ins/overdue')
  @UseGuards(RateLimitGuard)
  @RequireAction('view_okr')
  @ApiOperation({
    summary: 'Get overdue check-ins for Key Results',
    description: 'Returns Key Results that are due or overdue for check-ins based on their checkInCadence (WEEKLY, BIWEEKLY, MONTHLY). Results respect tenant isolation and visibility rules. Requires view_okr permission. RBAC: User must have view_okr permission. Tenant isolation: Results are scoped to the user\'s tenant. Cadence rules: WEEKLY = 7 days, BIWEEKLY = 14 days, MONTHLY = 30 days. Grace period: 2 days (configurable via OKR_CHECKIN_GRACE_DAYS env var).',
  })
  @ApiQuery({ name: 'cycleId', required: false, type: String, description: 'Filter by cycle ID', example: 'cycle-q1-2025' })
  @ApiQuery({ name: 'ownerId', required: false, type: String, description: 'Filter by owner user ID', example: 'user-123' })
  @ApiQuery({ name: 'teamId', required: false, type: String, description: 'Filter by team ID', example: 'team-456' })
  @ApiQuery({ name: 'pillarId', required: false, type: String, description: 'Filter by strategic pillar ID', example: 'pillar-789' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of results (default: 50, max: 100)', example: 50 })
  @ApiResponse({
    status: 200,
    description: 'List of overdue Key Results',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          krId: { type: 'string', example: 'kr-123', description: 'Key Result ID' },
          krTitle: { type: 'string', example: 'Increase user engagement by 20%', description: 'Key Result title' },
          objectiveId: { type: 'string', example: 'obj-456', description: 'Parent Objective ID' },
          objectiveTitle: { type: 'string', example: 'Improve product engagement', description: 'Parent Objective title' },
          owner: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'user-123', description: 'Owner user ID' },
              name: { type: 'string', nullable: true, example: 'John Doe', description: 'Owner name' },
            },
            required: ['id'],
            description: 'Key Result owner information',
          },
          cadence: { 
            type: 'string', 
            nullable: true, 
            enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'NONE'], 
            example: 'WEEKLY',
            description: 'Check-in cadence for this Key Result',
          },
          lastCheckInAt: { 
            type: 'string', 
            format: 'date-time', 
            nullable: true, 
            example: '2025-01-08T10:30:00Z',
            description: 'Timestamp of last check-in (null if never checked in)',
          },
          daysOverdue: { 
            type: 'number', 
            example: 5,
            description: 'Number of days overdue (0 if due but not overdue)',
          },
          status: { 
            type: 'string', 
            enum: ['DUE', 'OVERDUE'], 
            example: 'OVERDUE',
            description: 'Status: DUE (within grace period) or OVERDUE (beyond grace period)',
          },
        },
        required: ['krId', 'krTitle', 'objectiveId', 'objectiveTitle', 'owner', 'cadence', 'lastCheckInAt', 'daysOverdue', 'status'],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid limit parameter (must be 1-100)' })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission' })
  async getOverdueCheckIns(
    @Req() req: any,
    @Query('cycleId') cycleId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('teamId') teamId?: string,
    @Query('pillarId') pillarId?: string,
    @Query('limit') limit?: string,
  ) {
    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;

    // Parse and validate limit
    let limitNum: number | undefined;
    if (limit) {
      limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1) {
        throw new BadRequestException('Limit must be a positive number');
      }
      if (limitNum > 100) {
        throw new BadRequestException('Limit cannot exceed 100');
      }
    }

    // Record telemetry with timing
    const result = await checkInTelemetry.time(
      'reports.checkins.overdue.fetch',
      () => this.reportingService.getOverdueCheckIns(
        userOrganizationId,
        requesterUserId,
        {
          cycleId,
          ownerId,
          teamId,
          pillarId,
          limit: limitNum,
        },
      ),
      {
        tenantId: userOrganizationId || 'unknown',
        cycleId: cycleId || 'none',
        ownerId: ownerId || 'none',
        limit: limitNum || 50,
      },
    );

    recordOverdueCheckInsFetch({
      tenantId: userOrganizationId || 'unknown',
      cycleId: cycleId || 'none',
      ownerId: ownerId || 'none',
      limit: limitNum || 50,
    });

    return result;
  }
}

