import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  async getCurrentUser(@Req() req: any) {
    return req.user;
  }

  @Get('me/context')
  @ApiOperation({ summary: 'Get current user context with organization, workspace, and team info' })
  async getUserContext(@Req() req: any) {
    return this.userService.getUserContext(req.user.id);
  }

  @Get()
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get all users' })
  async getAllUsers() {
    return this.userService.findAll();
  }

  @Get(':id')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post()
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Create a new user (requires organization and workspace)' })
  async createUser(
    @Body() data: { 
      email: string; 
      name: string; 
      password: string; 
      organizationId: string; // REQUIRED
      workspaceId: string; // REQUIRED
      role?: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER';
      workspaceRole?: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER';
    },
    @Req() req: any,
  ) {
    return this.userService.createUser(data, req.user.organizationId, req.user.id);
  }

  @Patch(':id')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Update user information' })
  async updateUser(@Param('id') id: string, @Body() data: { name?: string; email?: string }, @Req() req: any) {
    return this.userService.updateUser(id, data, req.user.organizationId, req.user.id);
  }

  @Post(':id/reset-password')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Reset user password' })
  async resetPassword(@Param('id') id: string, @Body() data: { password: string }, @Req() req: any) {
    return this.userService.resetPassword(id, data.password, req.user.organizationId, req.user.id);
  }
}

