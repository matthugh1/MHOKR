import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Get all teams, optionally filtered by workspace' })
  async getAll(@Query('workspaceId') workspaceId?: string) {
    return this.teamService.findAll(workspaceId);
  }

  @Get(':id')
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Get team by ID' })
  async getById(@Param('id') id: string) {
    return this.teamService.findById(id);
  }

  @Post()
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Create team' })
  async create(@Body() data: { name: string; workspaceId: string }) {
    return this.teamService.create(data);
  }

  @Patch(':id')
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Update team' })
  async update(@Param('id') id: string, @Body() data: { name?: string }) {
    return this.teamService.update(id, data);
  }

  @Delete(':id')
  @RequireAction('manage_teams')
  @ApiOperation({ summary: 'Delete team' })
  async delete(@Param('id') id: string) {
    return this.teamService.delete(id);
  }

  @Post(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Add team member' })
  async addMember(@Param('id') teamId: string, @Body() data: { userId: string; role: string }) {
    return this.teamService.addMember(teamId, data);
  }

  @Delete(':id/members/:userId')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Remove team member' })
  async removeMember(@Param('id') teamId: string, @Param('userId') userId: string) {
    return this.teamService.removeMember(teamId, userId);
  }
}

