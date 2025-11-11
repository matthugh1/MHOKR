import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { InitiativeService } from './initiative.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Initiatives')
@Controller('initiatives')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class InitiativeController {
  constructor(
    private readonly initiativeService: InitiativeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all initiatives' })
  async getAll(
    @Query('objectiveId') objectiveId: string | undefined,
    @Query('keyResultId') keyResultId: string | undefined,
    @Req() req: any,
  ) {
    // Filter initiatives based on user's access to their parent objectives
    return this.initiativeService.findAll(req.user.id, objectiveId, keyResultId);
  }

  @Get(':id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get initiative by ID' })
  async getById(@Param('id') id: string, @Req() req: any) {
    // Check if user can view this initiative (via parent objective)
    const canView = await this.initiativeService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this initiative');
    }
    return this.initiativeService.findById(id);
  }

  @Post()
  @RequireAction('create_okr')
  @ApiOperation({ summary: 'Create initiative', description: 'Emits activity event (CREATED) and audit log entry.' })
  async create(@Body() data: any, @Req() req: any) {
    try {
      // Ensure ownerId matches the authenticated user
      if (!data.ownerId) {
        data.ownerId = req.user.id;
      } else if (data.ownerId !== req.user.id) {
        data.ownerId = req.user.id;
      }

      // Verify user can create initiatives for the parent objective
      let objectiveIdToCheck: string | undefined = data.objectiveId;
      
      // If creating from a Key Result, get the objectiveId from the KR's relationship
      if (!objectiveIdToCheck && data.keyResultId) {
        const keyResult = await this.prisma.keyResult.findUnique({
          where: { id: data.keyResultId },
          include: {
            objectives: {
              take: 1,
              select: {
                objectiveId: true,
              },
            },
          },
        });
        
        if (!keyResult) {
          throw new NotFoundException(`Key Result with ID ${data.keyResultId} not found`);
        }
        
        if (keyResult.objectives.length === 0) {
          throw new BadRequestException(`Key Result ${data.keyResultId} is not linked to any Objective`);
        }
        
        objectiveIdToCheck = keyResult.objectives[0].objectiveId;
      }
      
      // Check permissions if we have an objectiveId
      if (objectiveIdToCheck) {
        const canEdit = await this.initiativeService.canEditObjective(req.user.id, objectiveIdToCheck);
        if (!canEdit) {
          throw new ForbiddenException('You do not have permission to create initiatives for this objective');
        }
      }

      return await this.initiativeService.create(data, req.user.id, req.user.tenantId);
    } catch (error: any) {
      // Re-throw known HTTP exceptions
      if (error instanceof ForbiddenException || error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Log unexpected errors and return internal server error
      console.error('Error creating initiative:', error);
      throw new InternalServerErrorException(
        error.message || 'An error occurred while creating the initiative'
      );
    }
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update initiative', description: 'Emits activity events (UPDATED, STATE_CHANGE if status transitions) and audit logs.' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user can edit this initiative (via parent objective)
    const canEdit = await this.initiativeService.canEdit(req.user.id, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this initiative');
    }
    return this.initiativeService.update(id, data, req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete initiative', description: 'Emits activity event (DELETED) and audit log entry.' })
  async delete(@Param('id') id: string, @Req() req: any) {
    // Check if user can delete this initiative (via parent objective)
    const canDelete = await this.initiativeService.canDelete(req.user.id, id);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this initiative');
    }
    return this.initiativeService.delete(id, req.user.id, req.user.tenantId);
  }

  // ==========================================
  // Tags Management
  // ==========================================

  @Post(':id/tags')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Add tag to initiative', description: 'Adds a tag to an Initiative and emits Activity log (TAG_ADDED).' })
  @ApiResponse({ status: 200, description: 'Tag added successfully' })
  @ApiResponse({ status: 400, description: 'Tag already exists on initiative', schema: { properties: { code: { example: 'DUPLICATE_TAG' } } } })
  @ApiResponse({ status: 404, description: 'Initiative or tag not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async addTag(
    @Param('id') initiativeId: string,
    @Body() body: { tagId: string },
    @Req() req: any,
  ) {
    return this.initiativeService.addTag(
      initiativeId,
      body.tagId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Delete(':id/tags/:tagId')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Remove tag from initiative', description: 'Removes a tag from an Initiative and emits Activity log (TAG_REMOVED).' })
  @ApiResponse({ status: 200, description: 'Tag removed successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found on initiative', schema: { properties: { code: { example: 'TAG_NOT_FOUND' } } } })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async removeTag(
    @Param('id') initiativeId: string,
    @Param('tagId') tagId: string,
    @Req() req: any,
  ) {
    return this.initiativeService.removeTag(
      initiativeId,
      tagId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Get(':id/tags')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'List tags for initiative', description: 'Returns all tags assigned to an Initiative.' })
  @ApiResponse({ status: 200, description: 'List of tags' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  async listTags(
    @Param('id') initiativeId: string,
    @Req() req: any,
  ) {
    return this.initiativeService.listTags(initiativeId, req.user.tenantId);
  }

  // ==========================================
  // Contributors Management
  // ==========================================

  @Post(':id/contributors')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Add contributor to initiative', description: 'Adds a contributor to an Initiative and emits Activity log (CONTRIBUTOR_ADDED).' })
  @ApiResponse({ status: 200, description: 'Contributor added successfully' })
  @ApiResponse({ status: 400, description: 'User already a contributor', schema: { properties: { code: { example: 'DUPLICATE_CONTRIBUTOR' } } } })
  @ApiResponse({ status: 404, description: 'Initiative or user not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async addContributor(
    @Param('id') initiativeId: string,
    @Body() body: { userId: string },
    @Req() req: any,
  ) {
    return this.initiativeService.addContributor(
      initiativeId,
      body.userId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Delete(':id/contributors/:userId')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Remove contributor from initiative', description: 'Removes a contributor from an Initiative and emits Activity log (CONTRIBUTOR_REMOVED).' })
  @ApiResponse({ status: 200, description: 'Contributor removed successfully' })
  @ApiResponse({ status: 404, description: 'Contributor not found', schema: { properties: { code: { example: 'CONTRIBUTOR_NOT_FOUND' } } } })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async removeContributor(
    @Param('id') initiativeId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.initiativeService.removeContributor(
      initiativeId,
      userId,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Get(':id/contributors')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'List contributors for initiative', description: 'Returns all contributors assigned to an Initiative.' })
  @ApiResponse({ status: 200, description: 'List of contributors' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  async listContributors(
    @Param('id') initiativeId: string,
    @Req() req: any,
  ) {
    return this.initiativeService.listContributors(initiativeId, req.user.tenantId);
  }

  /**
   * Get status trend data for an Initiative.
   * 
   * Returns historical status snapshots ordered by timestamp (ASC).
   * Tenant isolation: Verifies Initiative belongs to user's tenant.
   * RBAC: User must have view_okr permission.
   * 
   * @param id - Initiative ID
   * @param req - Request object with user info
   * @returns Array of trend points with timestamp and status
   */
  @Get(':id/status-trend')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get status trend data for an Initiative' })
  @ApiResponse({
    status: 200,
    description: 'Status trend data array',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00Z' },
          status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'] },
          triggeredBy: { type: 'string', nullable: true, example: 'INITIATIVE_UPDATE' },
        },
        required: ['timestamp', 'status'],
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission or cannot access this initiative' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  async getStatusTrend(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.initiativeService.getStatusTrend(id, req.user.tenantId);
  }
}
