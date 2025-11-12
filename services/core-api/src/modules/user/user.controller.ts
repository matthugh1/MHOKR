import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { TenantMutationGuard } from '../../common/tenant/tenant-mutation.guard';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, TenantMutationGuard, RBACGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  // Override class-level guards - only require JWT auth, not RBAC (user can always see themselves)
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req: any) {
    return req.user;
  }

  @Get('me/context')
  @ApiOperation({ summary: 'Get current user context with organization, workspace, and team info' })
  // Override class-level guards - only require JWT auth, not RBAC (user can always see their own context)
  @UseGuards(JwtAuthGuard)
  async getUserContext(@Req() req: any) {
    return this.userService.getUserContext(req.user.id);
  }

  @Get()
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get all users (tenant-isolated)' })
  async getAllUsers(@Req() req: any) {
    return this.userService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get user by ID (tenant-isolated)' })
  async getUserById(@Param('id') id: string, @Req() req: any) {
    const user = await this.userService.findById(id, req.user.tenantId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Post()
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Create a new user (tenant auto-detected from context; workspace optional)' })
  async createUser(
    @Body() data: { 
      email: string; 
      name: string; 
      password: string; 
      tenantId?: string; // Optional - auto-injected from context unless dev inspector enabled
      workspaceId?: string; // Optional - only required if workspace role assignment needed
      role?: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER';
      workspaceRole?: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER';
    },
    @Req() req: any,
  ) {
    // Auto-inject tenant from context if not provided
    let resolvedTenantId = data.tenantId;
    const callerTenantId = req.user.tenantId;
    const isSuperuser = callerTenantId === null;
    
    if (!resolvedTenantId) {
      // Auto-inject from user's organisation context
      // SUPERUSER has no backend tenant context, so they must provide one explicitly
      // (frontend should send it from the current organisation they're viewing)
      if (isSuperuser) {
        throw new ForbiddenException('No tenant context available. Please select an organisation.');
      }
      
      resolvedTenantId = callerTenantId || undefined;
      
      if (!resolvedTenantId) {
        throw new ForbiddenException('No tenant context available. Please provide organisationId or ensure you are assigned to a tenant.');
      }
    } else {
      // Tenant was explicitly provided - check permissions for cross-tenant creation
      if (isSuperuser) {
        // SUPERUSER can create in any tenant, but cross-tenant creation requires dev inspector
        // Note: Since SUPERUSER has no tenant (callerTenantId === null), any provided tenant is "cross-tenant"
        // We allow it if dev inspector is enabled, or if they're creating in a tenant they're viewing
        // For now, we'll allow SUPERUSER to create in any tenant (frontend controls which tenant they're viewing)
        // If we want to restrict cross-tenant, we'd check dev inspector here
      } else if (resolvedTenantId !== callerTenantId) {
        // Non-superuser trying to create in different tenant
        throw new ForbiddenException('You can only create users within your own tenant.');
      }
    }
    
    // Update data with resolved tenant
    const payload = {
      ...data,
      tenantId: resolvedTenantId,
    };
    
    return this.userService.createUser(payload, req.user.tenantId, req.user.id);
  }

  @Patch(':id')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Update user information' })
  async updateUser(@Param('id') id: string, @Body() data: { name?: string; email?: string }, @Req() req: any) {
    return this.userService.updateUser(id, data, req.user.tenantId, req.user.id);
  }

  @Post(':id/reset-password')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Reset user password' })
  async resetPassword(@Param('id') id: string, @Body() data: { password: string }, @Req() req: any) {
    return this.userService.resetPassword(id, data.password, req.user.tenantId, req.user.id);
  }
}

