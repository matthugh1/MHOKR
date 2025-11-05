import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OkrCycleService, CreateCycleDto, UpdateCycleDto } from './okr-cycle.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../rbac';
import { RBACService } from '../rbac/rbac.service';
import { OkrTenantGuard } from './tenant-guard';

@ApiTags('OKR Cycles')
@Controller('okr/cycles')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class OkrCycleController {
  constructor(
    private readonly cycleService: OkrCycleService,
    private readonly rbacService: RBACService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all cycles for current tenant' })
  async getAll(@Req() req: any) {
    await this.checkCycleManagementPermission(req);
    
    const organizationId = req.user.organizationId;
    
    if (organizationId === undefined) {
      throw new BadRequestException('User must belong to an organization');
    }

    OkrTenantGuard.assertCanMutateTenant(organizationId);

    return this.cycleService.findAll(organizationId);
  }

  // IMPORTANT: Specific routes must come before parameterized routes in NestJS
  // This route must come before @Get(':id') to avoid route matching conflicts
  @Get('get-or-create-standard')
  @ApiOperation({ summary: 'Get or create a standard cycle (month/quarter/year) for a specific date' })
  async getOrCreateStandard(
    @Query('type') type: 'MONTH' | 'QUARTER' | 'YEAR',
    @Query('date') date: string,
    @Req() req: any,
  ) {
    console.log('[CYCLE CONTROLLER] get-or-create-standard endpoint hit', { type, date });
    
    await this.checkCycleManagementPermission(req);
    
    const organizationId = req.user.organizationId;
    
    if (organizationId === undefined) {
      throw new BadRequestException('User must belong to an organization');
    }

    if (!type || !date) {
      throw new BadRequestException('type and date query parameters are required');
    }

    if (!['MONTH', 'QUARTER', 'YEAR'].includes(type)) {
      throw new BadRequestException('type must be MONTH, QUARTER, or YEAR');
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Access cycleGenerator through the service
    const result = await this.cycleService.cycleGenerator.getOrCreateStandardCycle(organizationId, type, dateObj);
    console.log('[CYCLE CONTROLLER] get-or-create-standard result', { cycleId: result?.id, cycleName: result?.name });
    return result;
  }

  // This route must come after get-or-create-standard to avoid matching conflicts
  @Get(':id/summary')
  @ApiOperation({ summary: 'Get cycle summary (objectives count, published count, etc.)' })
  async getSummary(@Param('id') id: string, @Req() req: any) {
    // Guard: Don't allow 'get-or-create-standard' as an ID
    if (id === 'get-or-create-standard') {
      throw new BadRequestException('Invalid cycle ID');
    }
    
    await this.checkCycleManagementPermission(req);
    
    const organizationId = req.user.organizationId;
    
    if (organizationId === undefined) {
      throw new BadRequestException('User must belong to an organization');
    }

    return this.cycleService.getSummary(id, organizationId);
  }

  // This route must come last to avoid matching conflicts with specific routes
  @Get(':id')
  @ApiOperation({ summary: 'Get cycle by ID' })
  async getById(@Param('id') id: string, @Req() req: any) {
    console.log('[CYCLE CONTROLLER] getById endpoint hit', { id });
    
    // Guard: Don't allow 'get-or-create-standard' as an ID
    if (id === 'get-or-create-standard') {
      console.error('[CYCLE CONTROLLER] Route matching error: get-or-create-standard matched :id route instead of specific route');
      throw new BadRequestException('Invalid cycle ID. Use the get-or-create-standard endpoint instead.');
    }
    
    await this.checkCycleManagementPermission(req);
    
    const organizationId = req.user.organizationId;
    
    if (organizationId === undefined) {
      throw new BadRequestException('User must belong to an organization');
    }

    return this.cycleService.findById(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new cycle' })
  async create(@Body() data: CreateCycleDto, @Req() req: any) {
    await this.checkCycleManagementPermission(req);
    
    const organizationId = req.user.organizationId;
    
    if (organizationId === undefined) {
      throw new BadRequestException('User must belong to an organization');
    }

    return this.cycleService.create(data, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update cycle' })
  async update(
    @Param('id') id: string,
    @Body() data: UpdateCycleDto,
    @Req() req: any,
  ) {
    await this.checkCycleManagementPermission(req);
    
    const organizationId = req.user.organizationId;
    
    if (organizationId === undefined) {
      throw new BadRequestException('User must belong to an organization');
    }

    return this.cycleService.update(id, data, organizationId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update cycle status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED' },
    @Req() req: any,
  ) {
    await this.checkCycleManagementPermission(req);
    
    const organizationId = req.user.organizationId;
    
    if (organizationId === undefined) {
      throw new BadRequestException('User must belong to an organization');
    }

    if (!body.status) {
      throw new BadRequestException('status is required');
    }

    return this.cycleService.updateStatus(id, body.status, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete cycle (only if no linked OKRs)' })
  async delete(@Param('id') id: string, @Req() req: any) {
    await this.checkCycleManagementPermission(req);
    
    const organizationId = req.user.organizationId;
    
    if (organizationId === undefined) {
      throw new BadRequestException('User must belong to an organization');
    }

    await this.cycleService.delete(id, organizationId);
    return { success: true };
  }

  /**
   * Check if user has either manage_workspaces OR manage_tenant_settings permission
   * Allows both TENANT_OWNER and TENANT_ADMIN to manage cycles
   */
  private async checkCycleManagementPermission(req: any): Promise<void> {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;
    
    // Build user context to check roles
    const userContext = await this.rbacService.buildUserContext(userId, false);

    // Debug logging
    console.log('[CYCLE CONTROLLER] Permission check', {
      userId,
      userEmail: req.user.email,
      organizationId,
      isSuperuser: userContext.isSuperuser,
      tenantRoles: Array.from(userContext.tenantRoles.entries()),
    });

    // If user is superuser, allow (they can read but not write, but permission check passes)
    if (userContext.isSuperuser) {
      return;
    }

    // Check if user has TENANT_OWNER or TENANT_ADMIN role in any tenant
    let hasTenantAdminRole = false;
    let matchingTenantId: string | null = null;
    
    // First check the organizationId from JWT if it exists
    if (organizationId) {
      const roles = userContext.tenantRoles.get(organizationId) || [];
      if (roles.includes('TENANT_OWNER') || roles.includes('TENANT_ADMIN')) {
        hasTenantAdminRole = true;
        matchingTenantId = organizationId;
        console.log('[CYCLE CONTROLLER] Found admin role in JWT organizationId', { organizationId, roles });
      }
    }

    // Also check if user has admin role in any tenant (fallback - important if orgId mismatch)
    if (!hasTenantAdminRole) {
      for (const [tenantId, roles] of userContext.tenantRoles.entries()) {
        if (roles.includes('TENANT_OWNER') || roles.includes('TENANT_ADMIN')) {
          hasTenantAdminRole = true;
          matchingTenantId = tenantId;
          console.log('[CYCLE CONTROLLER] Found admin role in tenant (not matching JWT orgId)', { 
            tenantId, 
            roles,
            jwtOrganizationId: organizationId 
          });
          break;
        }
      }
    }

    // Check both actions using the matching tenantId (or empty string for "any tenant" check)
    const checkTenantId = matchingTenantId || organizationId || '';
    
    const canManageWorkspaces = await this.rbacService.canPerformAction(
      userId,
      'manage_workspaces',
      { tenantId: checkTenantId, workspaceId: null, teamId: null },
    );

    const canManageTenantSettings = await this.rbacService.canPerformAction(
      userId,
      'manage_tenant_settings',
      { tenantId: checkTenantId, workspaceId: null, teamId: null },
    );

    console.log('[CYCLE CONTROLLER] Permission results', {
      userId,
      userEmail: req.user.email,
      jwtOrganizationId: organizationId,
      matchingTenantId,
      hasTenantAdminRole,
      canManageWorkspaces,
      canManageTenantSettings,
      tenantRoles: Array.from(userContext.tenantRoles.entries()),
    });

    // Allow if user has admin role OR either permission check passes
    if (hasTenantAdminRole || canManageWorkspaces || canManageTenantSettings) {
      return;
    }

    // Deny access
    throw new ForbiddenException(
      `Cycle management requires manage_workspaces or manage_tenant_settings permission. User: ${req.user.email} (ID: ${userId}), JWT OrganizationId: ${organizationId}, TenantRoles: ${JSON.stringify(Array.from(userContext.tenantRoles.entries()))}`,
    );
  }
}

