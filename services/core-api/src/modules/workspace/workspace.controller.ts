import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Workspaces')
@Controller('workspaces')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Get all workspaces for user or organization' })
  async getAll(@Query('organizationId') organizationId?: string, @Req() req?: any) {
    if (organizationId) {
      return this.workspaceService.findAll(organizationId);
    }
    // Return workspaces the user has access to
    return this.workspaceService.findByUserId(req.user.id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get user\'s default workspace' })
  async getDefault(@Req() req: any) {
    return this.workspaceService.getDefaultWorkspace(req.user.id);
  }

  @Get(':id')
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Get workspace by ID' })
  async getById(@Param('id') id: string) {
    return this.workspaceService.findById(id);
  }

  @Post()
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Create workspace (supports hierarchy with parentWorkspaceId)' })
  async create(@Body() data: { name: string; organizationId: string; parentWorkspaceId?: string }, @Req() req: any) {
    return this.workspaceService.create(data, req.user.organizationId, req.user.id);
  }

  @Patch(':id')
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Update workspace (supports changing parent workspace)' })
  async update(@Param('id') id: string, @Body() data: { name?: string; parentWorkspaceId?: string | null }, @Req() req: any) {
    return this.workspaceService.update(id, data, req.user.organizationId, req.user.id);
  }

  @Delete(':id')
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Delete workspace' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.workspaceService.delete(id, req.user.organizationId, req.user.id);
  }

  @Get(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get all members of workspace' })
  async getMembers(@Param('id') id: string) {
    return this.workspaceService.getMembers(id);
  }

  @Post(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Add user to workspace' })
  async addMember(
    @Param('id') workspaceId: string,
    @Body() data: { userId: string; role?: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER' },
    @Req() req: any,
  ) {
    return this.workspaceService.addMember(workspaceId, data.userId, data.role || 'MEMBER', req.user.organizationId, req.user.id);
  }

  @Delete(':id/members/:userId')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Remove user from workspace' })
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.workspaceService.removeMember(workspaceId, userId, req.user.organizationId, req.user.id);
  }

  @Get('hierarchy/:organizationId')
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Get workspace hierarchy tree for an organization' })
  async getHierarchy(@Param('organizationId') organizationId: string) {
    return this.workspaceService.getHierarchy(organizationId);
  }
}
