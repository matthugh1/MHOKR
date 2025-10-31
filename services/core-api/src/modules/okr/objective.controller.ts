import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ObjectiveService } from './objective.service';
import { KeyResultService } from './key-result.service';
import { ActivityService } from '../activity/activity.service';
import { RBACService } from '../rbac/rbac.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Objectives')
@Controller('objectives')
@UseGuards(JwtAuthGuard, RBACGuard) // Using RBACGuard instead of PermissionGuard
@ApiBearerAuth()
export class ObjectiveController {
  constructor(
    private readonly objectiveService: ObjectiveService,
    private readonly keyResultService: KeyResultService,
    private readonly activityService: ActivityService,
    private readonly rbacService: RBACService,
  ) {}

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all objectives' })
  async getAll(
    @Query('workspaceId') workspaceId: string | undefined,
    @Query('pillarId') pillarId: string | undefined,
    @Req() req: any
  ) {
    return this.objectiveService.findAll(
      req.user.id,
      workspaceId,
      req.user.organizationId, // null = superuser
      pillarId
    );
  }

  /**
   * Early reporting endpoints - will likely move under /reports/* in a later iteration
   * Note: These routes must come before @Get(':id') to avoid route conflicts
   */
  @Get('pillars')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get strategic pillars for the organization' })
  async getPillars(@Req() req: any) {
    // TODO: Frontend - use this to populate a 'filter by strategic bet' dropdown in analytics and OKR list
    return this.objectiveService.getPillarsForOrg(req.user.organizationId);
  }

  @Get('cycles/active')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get active cycles for the organization' })
  async getActiveCycles(@Req() req: any) {
    // TODO: Frontend - show active cycle name at the top of the OKR dashboard and mark locked cycles
    return this.objectiveService.getActiveCycleForOrg(req.user.organizationId);
  }

  @Get('pillars/coverage')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get strategic pillar coverage for active cycle' })
  async getPillarCoverage(@Req() req: any) {
    // TODO: Frontend: highlight rows where objectiveCountInActiveCycle === 0 as strategic gaps.
    return this.objectiveService.getPillarCoverageForActiveCycle(req.user.organizationId);
  }

  @Get('analytics/summary')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get organization summary statistics' })
  async getAnalyticsSummary(@Req() req: any) {
    return this.objectiveService.getOrgSummary(req.user.organizationId);
  }

  @Get('analytics/feed')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent check-in activity feed' })
  async getAnalyticsFeed(@Req() req: any) {
    return this.keyResultService.getRecentCheckInFeed(req.user.organizationId);
  }

  @Get('export/csv')
  @RequireAction('export_data')
  @ApiOperation({ summary: 'Export objectives and key results as CSV' })
  async exportCSV(@Req() req: any, @Res() res: Response) {
    const userOrganizationId = req.user.organizationId; // null for superuser, string for normal user

    // Authorize using RBAC: check export_data permission
    const resourceContext = {
      tenantId: userOrganizationId || null, // null for superuser
      workspaceId: null,
      teamId: null,
    };

    const canExport = await this.rbacService.canPerformAction(
      req.user.id,
      'export_data',
      resourceContext,
    );

    if (!canExport) {
      throw new ForbiddenException('You do not have permission to export data');
    }

    // Generate CSV
    const csv = await this.objectiveService.exportObjectivesCSV(userOrganizationId);

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="okr-export-${new Date().toISOString().split('T')[0]}.csv"`);
    
    // TODO: Frontend - add Export CSV button in analytics dashboard for TENANT_OWNER / TENANT_ADMIN
    return res.send(csv);
  }

  @Get(':id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get objective by ID' })
  async getById(@Param('id') id: string, @Req() req: any) {
    // Check if user can view this OKR
    const canView = await this.objectiveService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this OKR');
    }
    return this.objectiveService.findById(id);
  }

  @Post()
  @RequireAction('create_okr')
  @ApiOperation({ summary: 'Create objective' })
  async create(@Body() data: any, @Req() req: any) {
    // Ensure ownerId matches the authenticated user (or check permission)
    if (!data.ownerId) {
      data.ownerId = req.user.id;
    } else if (data.ownerId !== req.user.id) {
      // User can create OKRs for themselves, or need special permission
      // For now, only allow creating for self
      data.ownerId = req.user.id;
    }

    // Verify user has access to the workspace/team they're creating in
    if (data.workspaceId) {
      const canCreate = await this.objectiveService.canCreateInWorkspace(req.user.id, data.workspaceId);
      if (!canCreate) {
        throw new ForbiddenException('You do not have permission to create OKRs in this workspace');
      }
    }

    return this.objectiveService.create(data, req.user.id);
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update objective' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const canEdit = await this.objectiveService.canEdit(
      req.user.id,
      id,
      req.user.organizationId // null for superuser
    );
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this OKR');
    }
    // TODO: Frontend - show warning modal when attempting to edit published OKR
    return this.objectiveService.update(id, data, req.user.id, req.user.organizationId);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete objective' })
  async delete(@Param('id') id: string, @Req() req: any) {
    const canDelete = await this.objectiveService.canDelete(
      req.user.id,
      id,
      req.user.organizationId // null for superuser
    );
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this OKR');
    }
    // TODO: Frontend - show warning modal when attempting to delete published OKR
    return this.objectiveService.delete(id, req.user.id, req.user.organizationId);
  }

  @Get(':id/activity')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent activity for an objective' })
  async getObjectiveActivity(
    @Param('id') id: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') actionFilter?: string,
    @Query('userId') userIdFilter?: string,
  ) {
    // Verify user can view this objective (same check as getById)
    const canView = await this.objectiveService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this OKR');
    }
    
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.activityService.getRecentForObjective(
      id,
      req.user.organizationId,
      limitNum,
      offsetNum,
      actionFilter,
      userIdFilter,
    );
  }
}
