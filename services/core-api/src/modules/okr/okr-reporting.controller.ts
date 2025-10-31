import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { OkrReportingService } from './okr-reporting.service';
import { RBACService } from '../rbac/rbac.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

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
    // @ts-expect-error Phase 2: Will be used when implementing endpoints
    private readonly _reportingService: OkrReportingService,
    // @ts-expect-error Phase 2: Will be used when implementing export endpoint
    private readonly _rbacService: RBACService,
  ) {}

  /**
   * Get organization-level summary statistics for analytics.
   * 
   * TODO Phase 2: move logic from objective.controller.ts
   */
  @Get('analytics/summary')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get organization summary statistics' })
  async getAnalyticsSummary(@Req() _req: any) {
    // TODO Phase 2: move logic from objective.controller.ts
    return { todo: true };
  }

  /**
   * Get recent check-in activity feed.
   * 
   * TODO Phase 2: move logic from objective.controller.ts
   */
  @Get('analytics/feed')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent check-in activity feed' })
  async getAnalyticsFeed(@Req() _req: any) {
    // TODO Phase 2: move logic from objective.controller.ts
    return { todo: true };
  }

  /**
   * Export objectives and key results as CSV.
   * 
   * TODO Phase 2: move logic from objective.controller.ts
   * TODO Phase 2: IMPORTANT - Enforce RBAC export_data check (currently in objective.controller.ts lines 87-102)
   */
  @Get('export/csv')
  @RequireAction('export_data')
  @ApiOperation({ summary: 'Export objectives and key results as CSV' })
  async exportCSV(@Req() _req: any, @Res() _res: Response) {
    // TODO Phase 2: move logic from objective.controller.ts
    return { todo: true };
  }

  /**
   * Get active cycles for the organization.
   * 
   * TODO Phase 2: move logic from objective.controller.ts
   */
  @Get('cycles/active')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get active cycles for the organization' })
  async getActiveCycles(@Req() _req: any) {
    // TODO Phase 2: move logic from objective.controller.ts
    return { todo: true };
  }

  /**
   * Get strategic pillars for the organization.
   * 
   * TODO Phase 2: move logic from objective.controller.ts
   */
  @Get('pillars')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get strategic pillars for the organization' })
  async getPillars(@Req() _req: any) {
    // TODO Phase 2: move logic from objective.controller.ts
    return { todo: true };
  }

  /**
   * Get strategic pillar coverage for active cycle.
   * 
   * TODO Phase 2: move logic from objective.controller.ts
   */
  @Get('pillars/coverage')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get strategic pillar coverage for active cycle' })
  async getPillarCoverage(@Req() _req: any) {
    // TODO Phase 2: move logic from objective.controller.ts
    return { todo: true };
  }

  /**
   * Get overdue check-ins for Key Results.
   * 
   * TODO Phase 2: move logic from key-result.controller.ts
   */
  @Get('check-ins/overdue')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get overdue check-ins for Key Results' })
  async getOverdueCheckIns(@Req() _req: any) {
    // TODO Phase 2: move logic from key-result.controller.ts
    return { todo: true };
  }
}

