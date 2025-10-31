import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KeyResultService } from './key-result.service';
import { ActivityService } from '../activity/activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Key Results')
@Controller('key-results')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class KeyResultController {
  constructor(
    private readonly keyResultService: KeyResultService,
    private readonly activityService: ActivityService,
  ) {}

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all key results' })
  async getAll(@Query('objectiveId') objectiveId: string | undefined, @Req() req: any) {
    // Filter key results based on user's access to their parent objectives
    return this.keyResultService.findAll(req.user.id, objectiveId);
  }

  @Get('overdue')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get overdue check-ins for Key Results' })
  async getOverdueCheckIns(@Req() req: any) {
    // TODO: Frontend: show 'Check-ins overdue' widget in analytics.
    return this.keyResultService.getOverdueCheckIns(req.user.organizationId);
  }

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
  @RequireAction('create_okr')
  @ApiOperation({ summary: 'Create key result' })
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

    return this.keyResultService.create(data, req.user.id, req.user.organizationId);
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update key result' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user can edit this key result (via parent objective)
    const canEdit = await this.keyResultService.canEdit(req.user.id, id, req.user.organizationId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this key result');
    }
    return this.keyResultService.update(id, data, req.user.id, req.user.organizationId);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete key result' })
  async delete(@Param('id') id: string, @Req() req: any) {
    // Check if user can delete this key result (via parent objective)
    const canDelete = await this.keyResultService.canDelete(req.user.id, id, req.user.organizationId);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this key result');
    }
    
    console.log(`[KeyResultController] DELETE /key-results/${id} - Request received`);
    try {
      const result = await this.keyResultService.delete(id, req.user.id, req.user.organizationId);
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
    const canEdit = await this.keyResultService.canEdit(req.user.id, id, req.user.organizationId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to create check-ins for this key result');
    }
    
    // Ensure userId matches authenticated user
    data.userId = req.user.id;
    return this.keyResultService.createCheckIn(id, data, req.user.organizationId);
  }

  @Get(':id/activity')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent activity for a key result' })
  async getKeyResultActivity(
    @Param('id') id: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') actionFilter?: string,
    @Query('userId') userIdFilter?: string,
  ) {
    // Verify user can view this key result (same check as getById)
    const canView = await this.keyResultService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this key result');
    }
    
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.activityService.getRecentForKeyResult(
      id,
      req.user.organizationId,
      limitNum,
      offsetNum,
      actionFilter,
      userIdFilter,
    );
  }
}
