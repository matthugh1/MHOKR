import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LayoutService, SaveLayoutRequest } from './layout.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { EntityType } from '@prisma/client';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('User Layouts')
@Controller('layout')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class LayoutController {
  constructor(private readonly layoutService: LayoutService) {}

  @Post('save')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Save user layout positions' })
  async saveLayout(@Request() req: AuthenticatedRequest, @Body() body: SaveLayoutRequest) {
    const userId = req.user.id;
    const userTenantId = req.user?.tenantId; // Get from JWT
    return this.layoutService.saveUserLayout(userId, body.layouts, userTenantId);
  }

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get user layout positions' })
  @ApiQuery({ name: 'entityType', required: false, enum: EntityType })
  @ApiQuery({ name: 'entityIds', required: false, type: String, isArray: true })
  async getUserLayout(
    @Request() req: AuthenticatedRequest,
    @Query('entityType') entityType?: EntityType,
    @Query('entityIds') entityIds?: string[]
  ) {
    const userId = req.user.id;
    const userTenantId = req.user?.tenantId; // Get from JWT
    return this.layoutService.getUserLayout(userId, entityType, entityIds, userTenantId);
  }

  @Delete(':entityType/:entityId')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Delete specific layout position' })
  async deleteLayout(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string
  ) {
    const userId = req.user.id;
    const userTenantId = req.user?.tenantId; // Get from JWT
    return this.layoutService.deleteUserLayout(userId, entityType, entityId, userTenantId);
  }

  @Delete('clear')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Clear all user layout positions' })
  async clearLayouts(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const userTenantId = req.user?.tenantId; // Get from JWT
    return this.layoutService.clearUserLayouts(userId, userTenantId);
  }
}


