import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { KeyResultService } from './key-result.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { recordCheckInHistoryFetch, checkInTelemetry } from './check-in-telemetry';

@ApiTags('Key Results')
@Controller('key-results')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class KeyResultController {
  constructor(
    private readonly keyResultService: KeyResultService,
  ) {}

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all key results' })
  async getAll(@Query('objectiveId') objectiveId: string | undefined, @Req() req: any) {
    // Filter key results based on user's access to their parent objectives
    return this.keyResultService.findAll(req.user.id, objectiveId);
  }

  // NOTE: Reporting/analytics endpoints were moved to OkrReportingController under /reports/* in Phase 4.

  @Get(':id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get key result by ID' })
  async getById(@Param('id') id: string, @Req() req: any) {
    // Check if user can view this key result (via parent objective)
    const canView = await this.keyResultService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this key result');
    }
    return this.keyResultService.findById(id);
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @RequireAction('create_okr')
  @ApiOperation({ summary: 'Create key result', description: 'Emits activity event (CREATED) and audit log entry.' })
  async create(@Body() data: any, @Req() req: any) {
    // Ensure ownerId matches the authenticated user
    if (!data.ownerId) {
      data.ownerId = req.user.id;
    } else if (data.ownerId !== req.user.id) {
      data.ownerId = req.user.id;
    }

    // Verify user can create key results for the parent objective
    if (data.objectiveId) {
      const canEdit = await this.keyResultService.canEditObjective(req.user.id, data.objectiveId);
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to create key results for this objective');
      }
    }

    return this.keyResultService.create(data, req.user.id, req.user.tenantId);
  }

  @Patch(':id')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update key result', description: 'Emits activity events (UPDATED, STATE_CHANGE if state transitions) and audit logs.' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user can edit this key result (via parent objective)
    const canEdit = await this.keyResultService.canEdit(req.user.id, id, req.user.tenantId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this key result');
    }
    return this.keyResultService.update(id, data, req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @UseGuards(RateLimitGuard)
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete key result', description: 'Emits activity event (DELETED) and audit log entry.' })
  async delete(@Param('id') id: string, @Req() req: any) {
    // Check if user can delete this key result (via parent objective)
    const canDelete = await this.keyResultService.canDelete(req.user.id, id, req.user.tenantId);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this key result');
    }
    
    console.log(`[KeyResultController] DELETE /key-results/${id} - Request received`);
    try {
      const result = await this.keyResultService.delete(id, req.user.id, req.user.tenantId);
      console.log(`[KeyResultController] DELETE /key-results/${id} - Success`);
      return result;
    } catch (error: any) {
      console.error(`[KeyResultController] DELETE /key-results/${id} - Error:`, error.message);
      throw error;
    }
  }

  @Post(':id/check-in')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Create check-in' })
  async checkIn(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user can edit this key result
    const canEdit = await this.keyResultService.canEdit(req.user.id, id, req.user.tenantId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to create check-ins for this key result');
    }
    
    // Ensure userId matches authenticated user
    data.userId = req.user.id;
    return this.keyResultService.createCheckIn(id, data, req.user.tenantId);
  }

  @Get(':id/check-ins')
  @UseGuards(RateLimitGuard)
  @RequireAction('view_okr')
  @ApiOperation({
    summary: 'Get paginated check-in history for a key result',
    description: 'Returns paginated check-in history ordered by creation date (newest first). Requires view_okr permission and access to the parent objective. Tenant isolation enforced. RBAC: User must have view_okr permission and visibility access to the parent objective.',
  })
  @ApiParam({ name: 'id', description: 'Key Result ID', type: String, example: 'clx1234567890' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1, minimum: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, maximum: 50)', example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated check-in history',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'clx1234567890' },
              value: { type: 'number', example: 75.5 },
              confidence: { type: 'number', example: 85, description: 'Confidence percentage (0-100)' },
              note: { type: 'string', nullable: true, example: 'Making good progress' },
              blockers: { type: 'string', nullable: true, example: 'Waiting on design review' },
              createdAt: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00Z' },
              author: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'user-123' },
                  name: { type: 'string', nullable: true, example: 'John Doe' },
                },
                required: ['id'],
              },
            },
            required: ['id', 'value', 'confidence', 'createdAt', 'author'],
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 42, description: 'Total number of check-ins' },
            page: { type: 'number', example: 1, description: 'Current page number' },
            limit: { type: 'number', example: 20, description: 'Items per page' },
            totalPages: { type: 'number', example: 3, description: 'Total number of pages' },
          },
          required: ['total', 'page', 'limit', 'totalPages'],
        },
      },
      required: ['data', 'meta'],
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid pagination parameters (page < 1 or limit not in 1-50 range)' })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission or cannot access this key result' })
  @ApiResponse({ status: 404, description: 'Key Result not found' })
  async getCheckIns(
    @Param('id') id: string,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    // Check if user can view this key result (via parent objective)
    const canView = await this.keyResultService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view check-ins for this key result');
    }

    // Parse pagination parameters
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    // Validate pagination parameters
    if (pageNum < 1) {
      throw new BadRequestException('Page must be >= 1');
    }
    if (limitNum < 1 || limitNum > 50) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }

    // Record telemetry with timing
    const result = await checkInTelemetry.time(
      'checkin.history.fetch',
      () => this.keyResultService.getCheckIns(id, pageNum, limitNum, req.user.tenantId),
      {
        krId: id,
        tenantId: req.user.tenantId || 'unknown',
        page: pageNum,
        limit: limitNum,
      },
    );

    recordCheckInHistoryFetch({
      krId: id,
      tenantId: req.user.tenantId || 'unknown',
      page: pageNum,
      limit: limitNum,
    });

    return result;
  }

  // ==========================================
  // Tags Management
  // ==========================================

  @Post(':id/tags')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Add tag to key result', description: 'Adds a tag to a Key Result and emits Activity log (TAG_ADDED).' })
  @ApiResponse({ status: 200, description: 'Tag added successfully' })
  @ApiResponse({ status: 400, description: 'Tag already exists on key result', schema: { properties: { code: { example: 'DUPLICATE_TAG' } } } })
  @ApiResponse({ status: 404, description: 'Key Result or tag not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async addTag(
    @Param('id') keyResultId: string,
    @Body() body: { tagId: string },
    @Req() req: any,
  ) {
    return this.keyResultService.addTag(
      keyResultId,
      body.tagId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Delete(':id/tags/:tagId')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Remove tag from key result', description: 'Removes a tag from a Key Result and emits Activity log (TAG_REMOVED).' })
  @ApiResponse({ status: 200, description: 'Tag removed successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found on key result', schema: { properties: { code: { example: 'TAG_NOT_FOUND' } } } })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async removeTag(
    @Param('id') keyResultId: string,
    @Param('tagId') tagId: string,
    @Req() req: any,
  ) {
    return this.keyResultService.removeTag(
      keyResultId,
      tagId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Get(':id/tags')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'List tags for key result', description: 'Returns all tags assigned to a Key Result.' })
  @ApiResponse({ status: 200, description: 'List of tags' })
  @ApiResponse({ status: 404, description: 'Key Result not found' })
  async listTags(
    @Param('id') keyResultId: string,
    @Req() req: any,
  ) {
    return this.keyResultService.listTags(keyResultId, req.user.tenantId);
  }

  // ==========================================
  // Contributors Management
  // ==========================================

  @Post(':id/contributors')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Add contributor to key result', description: 'Adds a contributor to a Key Result and emits Activity log (CONTRIBUTOR_ADDED).' })
  @ApiResponse({ status: 200, description: 'Contributor added successfully' })
  @ApiResponse({ status: 400, description: 'User already a contributor', schema: { properties: { code: { example: 'DUPLICATE_CONTRIBUTOR' } } } })
  @ApiResponse({ status: 404, description: 'Key Result or user not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async addContributor(
    @Param('id') keyResultId: string,
    @Body() body: { userId: string },
    @Req() req: any,
  ) {
    return this.keyResultService.addContributor(
      keyResultId,
      body.userId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Delete(':id/contributors/:userId')
  @UseGuards(RateLimitGuard)
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Remove contributor from key result', description: 'Removes a contributor from a Key Result and emits Activity log (CONTRIBUTOR_REMOVED).' })
  @ApiResponse({ status: 200, description: 'Contributor removed successfully' })
  @ApiResponse({ status: 404, description: 'Contributor not found', schema: { properties: { code: { example: 'CONTRIBUTOR_NOT_FOUND' } } } })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async removeContributor(
    @Param('id') keyResultId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.keyResultService.removeContributor(
      keyResultId,
      userId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Get(':id/contributors')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'List contributors for key result', description: 'Returns all contributors assigned to a Key Result.' })
  @ApiResponse({ status: 200, description: 'List of contributors' })
  @ApiResponse({ status: 404, description: 'Key Result not found' })
  async listContributors(
    @Param('id') keyResultId: string,
    @Req() req: any,
  ) {
    return this.keyResultService.listContributors(keyResultId, req.user.tenantId);
  }

  /**
   * Get status trend data for a Key Result.
   * 
   * Returns historical status snapshots ordered by timestamp (ASC).
   * Tenant isolation: Verifies Key Result belongs to user's tenant.
   * RBAC: User must have view_okr permission.
   * 
   * @param id - Key Result ID
   * @param req - Request object with user info
   * @returns Array of trend points with timestamp, status, and progress
   */
  @Get(':id/status-trend')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get status trend data for a Key Result' })
  @ApiResponse({
    status: 200,
    description: 'Status trend data array',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00Z' },
          status: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED', 'CANCELLED'] },
          progress: { type: 'number', nullable: true, example: 75.5 },
          triggeredBy: { type: 'string', nullable: true, example: 'KR_UPDATE' },
        },
        required: ['timestamp', 'status'],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission or cannot access this key result' })
  @ApiResponse({ status: 404, description: 'Key Result not found' })
  async getStatusTrend(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.keyResultService.getStatusTrend(id, req.user.tenantId);
  }

  // NOTE: Activity timeline endpoints moved to ActivityController under /activity/* in Phase 4.
}
