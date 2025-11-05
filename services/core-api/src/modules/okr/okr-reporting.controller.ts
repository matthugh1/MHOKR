import { Controller, Get, UseGuards, Req, Res, ForbiddenException } from '@nestjs/common';
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
    const userOrganizationId = req.user?.organizationId ?? null;
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
    const userOrganizationId = req.user?.organizationId ?? null;
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
    const userOrganizationId = req.user?.organizationId ?? null;

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
    const userOrganizationId = req.user?.organizationId ?? null;
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
    const userOrganizationId = req.user?.organizationId ?? null;
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
    const userOrganizationId = req.user?.organizationId ?? null;
    return this.reportingService.getPillarsForOrg(userOrganizationId);
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
    const userOrganizationId = req.user?.organizationId ?? null;
    const requesterUserId = req.user?.id;
    return this.reportingService.getPillarCoverageForActiveCycle(userOrganizationId, requesterUserId);
  }

  /**
   * Get overdue check-ins for Key Results.
   * 
   * Moved from KeyResultController in Phase 4.
   * TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
   */
  @Get('check-ins/overdue')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get overdue check-ins for Key Results' })
  async getOverdueCheckIns(@Req() req: any) {
    const userOrganizationId = req.user?.organizationId ?? null;
    const requesterUserId = req.user?.id;
    return this.reportingService.getOverdueCheckIns(userOrganizationId, requesterUserId);
  }
}

