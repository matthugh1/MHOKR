import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Teams')
@Controller('teams')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Get all teams, optionally filtered by workspace (tenant-isolated)' })
  async getAll(@Query('workspaceId') workspaceId?: string, @Req() req?: any) {
    return this.teamService.findAll(req.user.tenantId, workspaceId);
  }

  @Get(':id')
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Get team by ID (tenant-isolated)' })
  async getById(@Param('id') id: string, @Req() req: any) {
    return this.teamService.findById(id, req.user.tenantId);
  }

  @Post()
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Create team' })
  async create(@Body() data: { name: string; workspaceId: string }, @Req() req: any) {
    return this.teamService.create(data, req.user.tenantId, req.user.id);
  }

  @Patch(':id')
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Update team' })
  async update(@Param('id') id: string, @Body() data: { name?: string }, @Req() req: any) {
    return this.teamService.update(id, data, req.user.tenantId, req.user.id);
  }

  @Delete(':id')
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Delete team' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.teamService.delete(id, req.user.tenantId, req.user.id);
  }

  @Post(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Add team member' })
  async addMember(@Param('id') teamId: string, @Body() data: { userId: string; role: string }, @Req() req: any) {
    return this.teamService.addMember(teamId, data, req.user.tenantId, req.user.id);
  }

  @Delete(':id/members/:userId')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Remove team member' })
  async removeMember(@Param('id') teamId: string, @Param('userId') userId: string, @Req() req: any) {
    return this.teamService.removeMember(teamId, userId, req.user.tenantId, req.user.id);
  }
}

