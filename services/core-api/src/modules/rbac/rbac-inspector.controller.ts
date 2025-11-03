/**
 * RBAC Inspector Controller
 * 
 * REST endpoints for managing RBAC inspector feature flag (per-user toggle).
 * Production-safe: only visible when explicitly enabled per user.
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RBACInspectorService } from './rbac-inspector.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from './rbac.guard';
import { RequireAction } from './rbac.decorator';

interface ToggleInspectorDto {
  userId: string;
  enabled: boolean;
}

@ApiTags('RBAC Inspector')
@Controller('rbac/inspector')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class RBACInspectorController {
  constructor(
    private inspectorService: RBACInspectorService,
  ) {}

  @Post('enable')
  @RequireAction('manage_users')
  @ApiOperation({ 
    summary: 'Toggle RBAC Inspector for a user',
    description: 'Enable or disable the RBAC Inspector feature for a specific user. Requires manage_users permission. Tenant isolation enforced.'
  })
  async toggleInspector(
    @Body() dto: ToggleInspectorDto,
    @Request() req: any,
  ) {
    // Allow self-toggle only if caller has manage_users permission
    if (dto.userId === req.user.id) {
      const canManage = await this.inspectorService.canManageUsers(req.user.id, req.user.organizationId);
      if (!canManage) {
        throw new NotFoundException('Permission denied: manage_users required to toggle inspector');
      }
    }

    // Verify tenant isolation: target user must belong to caller's tenant
    const targetUserTenantId = await this.inspectorService.getUserTenantId(dto.userId);
    if (!targetUserTenantId) {
      throw new NotFoundException('User not found');
    }

    if (req.user.organizationId && targetUserTenantId !== req.user.organizationId) {
      throw new NotFoundException('User not found in specified tenant');
    }

    // Update settings and audit log
    await this.inspectorService.setInspectorEnabled(
      dto.userId,
      dto.enabled,
      req.user.id,
      targetUserTenantId,
    );

    return { success: true, enabled: dto.enabled };
  }
}

