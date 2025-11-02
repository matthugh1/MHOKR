import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InitiativeService } from './initiative.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Initiatives')
@Controller('initiatives')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class InitiativeController {
  constructor(private readonly initiativeService: InitiativeService) {}

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
  @ApiOperation({ summary: 'Create initiative' })
  async create(@Body() data: any, @Req() req: any) {
    // Ensure ownerId matches the authenticated user
    if (!data.ownerId) {
      data.ownerId = req.user.id;
    } else if (data.ownerId !== req.user.id) {
      data.ownerId = req.user.id;
    }

    // Verify user can create initiatives for the parent objective
    if (data.objectiveId) {
      const canEdit = await this.initiativeService.canEditObjective(req.user.id, data.objectiveId);
      if (!canEdit) {
        throw new ForbiddenException('You do not have permission to create initiatives for this objective');
      }
    }

    return this.initiativeService.create(data, req.user.id, req.user.organizationId);
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update initiative' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user can edit this initiative (via parent objective)
    const canEdit = await this.initiativeService.canEdit(req.user.id, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this initiative');
    }
    return this.initiativeService.update(id, data, req.user.id, req.user.organizationId);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete initiative' })
  async delete(@Param('id') id: string, @Req() req: any) {
    // Check if user can delete this initiative (via parent objective)
    const canDelete = await this.initiativeService.canDelete(req.user.id, id);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this initiative');
    }
    return this.initiativeService.delete(id, req.user.id, req.user.organizationId);
  }
}
