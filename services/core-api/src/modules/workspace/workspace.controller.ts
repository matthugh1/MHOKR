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
  @ApiOperation({ summary: 'Get all workspaces for user or organization (tenant-isolated)' })
  async getAll(@Query('tenantId') tenantId?: string, @Req() req?: any) {
    if (tenantId) {
      return this.workspaceService.findAll(req.user.tenantId, tenantId);
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
  @ApiOperation({ summary: 'Get workspace by ID (tenant-isolated)' })
  async getById(@Param('id') id: string, @Req() req: any) {
    return this.workspaceService.findById(id, req.user.tenantId);
  }

  @Post()
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Create workspace (supports hierarchy with parentWorkspaceId)' })
  async create(@Body() data: { name: string; tenantId: string; parentWorkspaceId?: string }, @Req() req: any) {
    return this.workspaceService.create(data, req.user.tenantId, req.user.id);
  }

  @Patch(':id')
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Update workspace (supports changing parent workspace)' })
  async update(@Param('id') id: string, @Body() data: { name?: string; parentWorkspaceId?: string | null }, @Req() req: any) {
    return this.workspaceService.update(id, data, req.user.tenantId, req.user.id);
  }

  @Delete(':id')
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Delete workspace' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.workspaceService.delete(id, req.user.tenantId, req.user.id);
  }

  @Get(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get all members of workspace (tenant-isolated)' })
  async getMembers(@Param('id') id: string, @Req() req: any) {
    // Tenant isolation: verify workspace belongs to caller's tenant
    await this.workspaceService.findById(id, req.user.tenantId);
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
    return this.workspaceService.addMember(workspaceId, data.userId, data.role || 'MEMBER', req.user.tenantId, req.user.id);
  }

  @Delete(':id/members/:userId')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Remove user from workspace' })
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.workspaceService.removeMember(workspaceId, userId, req.user.tenantId, req.user.id);
  }

  @Get('hierarchy/:tenantId')
  @RequireAction('manage_workspaces')
  @ApiOperation({ summary: 'Get workspace hierarchy tree for an organization' })
  async getHierarchy(@Param('tenantId') tenantId: string) {
    return this.workspaceService.getHierarchy(tenantId);
  }
}
