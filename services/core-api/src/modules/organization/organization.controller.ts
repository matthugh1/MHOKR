import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current user\'s organization' })
  async getCurrentOrganization(@Req() req: any) {
    return this.organizationService.getCurrentOrganization(req.user.id);
  }

  @Get()
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Get user\'s organizations' })
  async getAll() {
    return this.organizationService.findAll();
  }

  @Get(':id')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Get organization by ID' })
  async getById(@Param('id') id: string) {
    return this.organizationService.findById(id);
  }

  @Post()
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Create organization' })
  async create(@Body() data: { name: string; slug: string }, @Req() req: any) {
    return this.organizationService.create(data, req.user.organizationId, req.user.id);
  }

  @Patch(':id')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Update organization' })
  async update(@Param('id') id: string, @Body() data: { name?: string; slug?: string }, @Req() req: any) {
    return this.organizationService.update(id, data, req.user.organizationId, req.user.id);
  }

  @Delete(':id')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Delete organization' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.organizationService.delete(id, req.user.organizationId, req.user.id);
  }

  @Get(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get all members of organization' })
  async getMembers(@Param('id') id: string) {
    return this.organizationService.getMembers(id);
  }

  @Post(':id/members')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Add user to organization' })
  async addMember(
    @Param('id') organizationId: string,
    @Body() data: { userId: string; role?: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' },
    @Req() req: any,
  ) {
    return this.organizationService.addMember(organizationId, data.userId, data.role || 'MEMBER', req.user.organizationId, req.user.id);
  }

  @Delete(':id/members/:userId')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Remove user from organization' })
  async removeMember(
    @Param('id') organizationId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.organizationService.removeMember(organizationId, userId, req.user.organizationId, req.user.id);
  }
}
