import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { OkrTenantGuard } from '../okr/tenant-guard';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current user\'s organization' })
  async getCurrentOrganization(@Req() req: any) {
    return this.organizationService.getCurrentOrganization(req.user.id, req.user.tenantId);
  }

  @Get()
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Get user\'s organizations (tenant-isolated)' })
  async getAll(@Req() req: any) {
    return this.organizationService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Get organization by ID (tenant-isolated)' })
  async getById(@Param('id') id: string, @Req() req: any) {
    return this.organizationService.findById(id, req.user.tenantId);
  }

  @Post()
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Create organization' })
  async create(@Body() data: { name: string; slug: string }, @Req() req: any) {
    return this.organizationService.create(data, req.user.tenantId, req.user.id);
  }

  @Patch(':id')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Update organization' })
  async update(@Param('id') id: string, @Body() data: { name?: string; slug?: string }, @Req() req: any) {
    return this.organizationService.update(id, data, req.user.tenantId, req.user.id);
  }

  @Delete(':id')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Delete organization' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.organizationService.delete(id, req.user.tenantId, req.user.id);
  }

  @Get(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get all members of organization (tenant-isolated)' })
  async getMembers(@Param('id') id: string, @Req() req: any) {
    // Tenant isolation: verify organisation belongs to caller's tenant
    // SUPERUSER (null) can view members of any organization
    if (req.user.tenantId !== null) {
      OkrTenantGuard.assertSameTenant(id, req.user.tenantId);
    }
    return this.organizationService.getMembers(id);
  }

  @Post(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Add user to organization' })
  async addMember(
    @Param('id') tenantId: string,
    @Body() data: { userId: string; role?: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' },
    @Req() req: any,
  ) {
    return this.organizationService.addMember(tenantId, data.userId, data.role || 'MEMBER', req.user.tenantId, req.user.id);
  }

  @Delete(':id/members/:userId')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Remove user from organization' })
  async removeMember(
    @Param('id') tenantId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.organizationService.removeMember(tenantId, userId, req.user.tenantId, req.user.id);
  }
}
