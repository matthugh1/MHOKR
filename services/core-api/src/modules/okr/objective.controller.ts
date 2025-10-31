import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ObjectiveService } from './objective.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Objectives')
@Controller('objectives')
@UseGuards(JwtAuthGuard, RBACGuard) // Using RBACGuard instead of PermissionGuard
@ApiBearerAuth()
export class ObjectiveController {
  constructor(
    private readonly objectiveService: ObjectiveService,
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

  // NOTE: Reporting/analytics endpoints were moved to OkrReportingController under /reports/* in Phase 4.

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

  // NOTE: Activity timeline endpoints moved to ActivityController under /activity/* in Phase 4.
}
