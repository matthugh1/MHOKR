import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LayoutService, SaveLayoutRequest } from './layout.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { EntityType } from '@prisma/client';

@ApiTags('User Layouts')
@Controller('layout')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class LayoutController {
  constructor(private readonly layoutService: LayoutService) {}

  @Post('save')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Save user layout positions' })
  async saveLayout(@Request() req: any, @Body() body: SaveLayoutRequest) {
    const userId = req.user.id;
    return this.layoutService.saveUserLayout(userId, body.layouts);
  }

  @Get()
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get user layout positions' })
  @ApiQuery({ name: 'entityType', required: false, enum: EntityType })
  @ApiQuery({ name: 'entityIds', required: false, type: String, isArray: true })
  async getUserLayout(
    @Request() req: any,
    @Query('entityType') entityType?: EntityType,
    @Query('entityIds') entityIds?: string[]
  ) {
    const userId = req.user.id;
    return this.layoutService.getUserLayout(userId, entityType, entityIds);
  }

  @Delete(':entityType/:entityId')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Delete specific layout position' })
  async deleteLayout(
    @Request() req: any,
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string
  ) {
    const userId = req.user.id;
    return this.layoutService.deleteUserLayout(userId, entityType, entityId);
  }

  @Delete('clear')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Clear all user layout positions' })
  async clearLayouts(@Request() req: any) {
    const userId = req.user.id;
    return this.layoutService.clearUserLayouts(userId);
  }
}


