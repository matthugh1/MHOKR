import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KeyResultService } from './key-result.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Key Results')
@Controller('key-results')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class KeyResultController {
  constructor(private readonly keyResultService: KeyResultService) {}

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get all key results' })
  async getAll(@Query('objectiveId') objectiveId: string | undefined, @Req() req: any) {
    // Filter key results based on user's access to their parent objectives
    return this.keyResultService.findAll(req.user.id, objectiveId);
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

    return this.keyResultService.create(data, req.user.id);
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update key result' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user can edit this key result (via parent objective)
    const canEdit = await this.keyResultService.canEdit(req.user.id, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this key result');
    }
    return this.keyResultService.update(id, data, req.user.id);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete key result' })
  async delete(@Param('id') id: string, @Req() req: any) {
    // Check if user can delete this key result (via parent objective)
    const canDelete = await this.keyResultService.canDelete(req.user.id, id);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this key result');
    }
    
    console.log(`[KeyResultController] DELETE /key-results/${id} - Request received`);
    try {
      const result = await this.keyResultService.delete(id);
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
    const canEdit = await this.keyResultService.canEdit(req.user.id, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to create check-ins for this key result');
    }
    
    // Ensure userId matches authenticated user
    data.userId = req.user.id;
    return this.keyResultService.createCheckIn(id, data);
  }
}
