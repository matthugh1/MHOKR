import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ObjectiveService } from './objective.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction, RequireActionWithContext } from '../rbac';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { UpdateWeightDto } from './dto/update-weight.dto';
import { ReviewObjectiveDto } from './dto/review-objective.dto';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Objectives')
@Controller('objectives')
@UseGuards(JwtAuthGuard, RBACGuard) // Using RBACGuard instead of PermissionGuard
@ApiBearerAuth()
export class ObjectiveController {
  // Store prisma reference for use in decorator (workaround for decorator context limitation)
  private static prismaInstance: PrismaService | null = null;

  constructor(
    private readonly objectiveService: ObjectiveService,
    private readonly prisma: PrismaService,
    private readonly rbacService: RBACService,
  ) {
    // Store prisma instance for decorator access
    ObjectiveController.prismaInstance = prisma;
  }

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
      req.user.tenantId, // null = superuser
      pillarId
    );
  }

  // NOTE: Reporting/analytics endpoints were moved to OkrReportingController under /reports/* in Phase 4.

  @Get(':id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get objective by ID (tenant-isolated)' })
  async getById(@Param('id') id: string, @Req() req: any) {
    // Check if user can view this OKR (RBAC permission check)
    const canView = await this.objectiveService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this OKR');
    }
    // Tenant isolation validation (defense-in-depth)
    return this.objectiveService.findById(id, req.user.tenantId);
  }

  @Post()
  @UseGuards(RateLimitGuard)
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

    return this.objectiveService.create(data, req.user.id, req.user.tenantId);
  }

  @Patch(':id')
  @UseGuards(RateLimitGuard)
  @RequireActionWithContext('edit_okr', async (req) => {
    // Build resource context with OKR object for proper permission checking
    // Access prisma through static reference (workaround for decorator context limitation)
    console.log('[OBJECTIVE CONTROLLER] RequireActionWithContext function called', {
      objectiveId: req.params.id,
      hasPrismaInstance: !!ObjectiveController.prismaInstance,
    });
    
    const prisma = ObjectiveController.prismaInstance;
    
    if (!prisma) {
      console.error('[OBJECTIVE CONTROLLER] PrismaService not available!', {
        objectiveId: req.params.id,
      });
      throw new Error('PrismaService not available in ObjectiveController. This should not happen.');
    }
    
    const resourceContext = await buildResourceContextFromOKR(prisma, req.params.id);
    console.log('[OBJECTIVE CONTROLLER] Built resourceContext', {
      objectiveId: req.params.id,
      tenantId: resourceContext.tenantId,
      hasOkr: !!resourceContext.okr,
      okrId: resourceContext.okr?.id,
      isPublished: resourceContext.okr?.isPublished,
    });
    return resourceContext;
  })
  @ApiOperation({ summary: 'Update objective', description: 'Emits activity events (UPDATED, STATE_CHANGE if state transitions) and audit logs.' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user is superuser (read-only)
    if (req.user.tenantId === null) {
      throw new ForbiddenException('Superusers are read-only and cannot edit OKRs');
    }
    
    // Additional permission check is handled by the guard via RequireActionWithContext
    // But we still do a defensive check here for better error messages
    const resourceContext = await buildResourceContextFromOKR(this.prisma, id);
    const canEdit = await this.rbacService.canPerformAction(
      req.user.id,
      'edit_okr',
      resourceContext
    );
    
    if (!canEdit) {
      // Provide better error message based on OKR state
      if (resourceContext.okr && resourceContext.okr.isPublished) {
        throw new ForbiddenException('This OKR is published and can only be modified by organization administrators (Tenant Owner or Tenant Admin)');
      }
      throw new ForbiddenException('You do not have permission to edit this OKR. You must be the owner, or have a workspace/team lead role, or be an organization administrator.');
    }
    
    // TODO [phase7-hardening]: Frontend - show warning modal when attempting to edit published OKR
    return this.objectiveService.update(id, data, req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @UseGuards(RateLimitGuard)
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete objective', description: 'Emits activity event (DELETED) and audit log entry.' })
  async delete(@Param('id') id: string, @Req() req: any) {
    const canDelete = await this.objectiveService.canDelete(
      req.user.id,
      id,
      req.user.tenantId // null for superuser
    );
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this OKR');
    }
    // TODO [phase7-hardening]: Frontend - show warning modal when attempting to delete published OKR
    return this.objectiveService.delete(id, req.user.id, req.user.tenantId);
  }

  @Patch(':id/key-results/:keyResultId/weight')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ 
    summary: 'Update Key Result weight for Objective', 
    description: 'Updates the weight of a Key Result link, triggers progress recalculation, and emits Activity log on the Objective.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Weight updated successfully',
    schema: {
      type: 'object',
      properties: {
        objectiveId: { type: 'string' },
        keyResultId: { type: 'string' },
        weight: { type: 'number' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid weight value',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'string', example: 'INVALID_WEIGHT' },
      },
    },
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Objective, Key Result, or link not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'string', example: 'LINK_NOT_FOUND' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async updateKeyResultWeight(
    @Param('id') objectiveId: string,
    @Param('keyResultId') keyResultId: string,
    @Body() dto: UpdateWeightDto,
    @Req() req: any,
  ) {
    return this.objectiveService.updateKeyResultWeight(
      objectiveId,
      keyResultId,
      dto.weight,
      req.user.id,
      req.user.tenantId,
    );
  }

  // ==========================================
  // Tags Management
  // ==========================================

  @Post(':id/tags')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Add tag to objective', description: 'Adds a tag to an Objective and emits Activity log (TAG_ADDED).' })
  @ApiResponse({ status: 200, description: 'Tag added successfully' })
  @ApiResponse({ status: 400, description: 'Tag already exists on objective', schema: { properties: { code: { example: 'DUPLICATE_TAG' } } } })
  @ApiResponse({ status: 404, description: 'Objective or tag not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async addTag(
    @Param('id') objectiveId: string,
    @Body() body: { tagId: string },
    @Req() req: any,
  ) {
    return this.objectiveService.addTag(
      objectiveId,
      body.tagId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Delete(':id/tags/:tagId')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Remove tag from objective', description: 'Removes a tag from an Objective and emits Activity log (TAG_REMOVED).' })
  @ApiResponse({ status: 200, description: 'Tag removed successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found on objective', schema: { properties: { code: { example: 'TAG_NOT_FOUND' } } } })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async removeTag(
    @Param('id') objectiveId: string,
    @Param('tagId') tagId: string,
    @Req() req: any,
  ) {
    return this.objectiveService.removeTag(
      objectiveId,
      tagId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Get(':id/tags')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'List tags for objective', description: 'Returns all tags assigned to an Objective.' })
  @ApiResponse({ status: 200, description: 'List of tags' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  async listTags(
    @Param('id') objectiveId: string,
    @Req() req: any,
  ) {
    return this.objectiveService.listTags(objectiveId, req.user.tenantId);
  }

  // ==========================================
  // Contributors Management
  // ==========================================

  @Post(':id/contributors')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Add contributor to objective', description: 'Adds a contributor to an Objective and emits Activity log (CONTRIBUTOR_ADDED).' })
  @ApiResponse({ status: 200, description: 'Contributor added successfully' })
  @ApiResponse({ status: 400, description: 'User already a contributor', schema: { properties: { code: { example: 'DUPLICATE_CONTRIBUTOR' } } } })
  @ApiResponse({ status: 404, description: 'Objective or user not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async addContributor(
    @Param('id') objectiveId: string,
    @Body() body: { userId: string },
    @Req() req: any,
  ) {
    return this.objectiveService.addContributor(
      objectiveId,
      body.userId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Delete(':id/contributors/:userId')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Remove contributor from objective', description: 'Removes a contributor from an Objective and emits Activity log (CONTRIBUTOR_REMOVED).' })
  @ApiResponse({ status: 200, description: 'Contributor removed successfully' })
  @ApiResponse({ status: 404, description: 'Contributor not found', schema: { properties: { code: { example: 'CONTRIBUTOR_NOT_FOUND' } } } })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async removeContributor(
    @Param('id') objectiveId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.objectiveService.removeContributor(
      objectiveId,
      userId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Get(':id/contributors')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'List contributors for objective', description: 'Returns all contributors assigned to an Objective.' })
  @ApiResponse({ status: 200, description: 'List of contributors' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  async listContributors(
    @Param('id') objectiveId: string,
    @Req() req: any,
  ) {
    return this.objectiveService.listContributors(objectiveId, req.user.tenantId);
  }

  // ==========================================
  // Sponsor Management
  // ==========================================

  @Patch(':id/sponsor')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update objective sponsor', description: 'Sets or removes the sponsor for an Objective and emits Activity log (UPDATED).' })
  @ApiResponse({ status: 200, description: 'Sponsor updated successfully' })
  @ApiResponse({ status: 404, description: 'Objective or user not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async updateSponsor(
    @Param('id') objectiveId: string,
    @Body() body: { sponsorId: string | null },
    @Req() req: any,
  ) {
    return this.objectiveService.updateSponsor(
      objectiveId,
      body.sponsorId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Patch(':id/review')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ 
    summary: 'Review objective', 
    description: 'Updates confidence and sets lastReviewedAt. Emits activity event (REVIEWED) with confidence and note metadata.' 
  })
  @ApiResponse({ status: 200, description: 'Objective reviewed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid confidence value (must be 0-100)' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  async reviewObjective(
    @Param('id') id: string,
    @Body() dto: ReviewObjectiveDto,
    @Req() req: any,
  ) {
    const canEdit = await this.objectiveService.canEdit(
      req.user.id,
      id,
      req.user.tenantId,
    );
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this OKR');
    }
    return this.objectiveService.reviewObjective(
      id,
      dto,
      req.user.id,
      req.user.tenantId,
    );
  }

  /**
   * Get progress trend data for an Objective.
   * 
   * Returns historical progress snapshots ordered by timestamp (ASC).
   * Tenant isolation: Verifies Objective belongs to user's tenant.
   * RBAC: User must have view_okr permission.
   * 
   * @param id - Objective ID
   * @param req - Request object with user info
   * @returns Array of trend points with timestamp, progress, and status
   */
  @Get(':id/progress-trend')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get progress trend data for an Objective' })
  @ApiResponse({
    status: 200,
    description: 'Progress trend data array',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00Z' },
          progress: { type: 'number', example: 75.5 },
          status: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED', 'CANCELLED'] },
          triggeredBy: { type: 'string', nullable: true, example: 'PROGRESS_ROLLUP' },
        },
        required: ['timestamp', 'progress', 'status'],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission or cannot access this objective' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  async getProgressTrend(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.objectiveService.getProgressTrend(id, req.user.tenantId);
  }

  // NOTE: Activity timeline endpoints moved to ActivityController under /activity/* in Phase 4.
}
