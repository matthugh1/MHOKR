/**
 * RBAC Migration Controller
 * 
 * REST endpoints for running RBAC migrations.
 * Should be protected and only accessible to superusers/admins.
 */

import { Controller, Post, Get, UseGuards, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RBACMigrationService } from './migration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from './rbac.guard';
import { RequireAction } from './rbac.decorator';

@ApiTags('RBAC Migration')
@Controller('rbac/migration')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class RBACMigrationController {
  constructor(private migrationService: RBACMigrationService) {}

  @Post('all')
  @RequireAction('impersonate_user')
  @ApiOperation({ summary: 'Migrate all memberships to RoleAssignment model' })
  async migrateAll(@Body() body: { migratedBy?: string }) {
    const result = await this.migrationService.migrateAllMemberships(
      body.migratedBy || 'system',
    );
    return {
      success: true,
      message: 'Migration completed',
      ...result,
    };
  }

  @Post('user/:userId')
  @RequireAction('impersonate_user')
  @ApiOperation({ summary: 'Migrate a single user\'s memberships' })
  async migrateUser(
    @Param('userId') userId: string,
    @Body() body: { migratedBy?: string },
  ) {
    await this.migrationService.migrateUserMemberships(
      userId,
      body.migratedBy || 'system',
    );
    return {
      success: true,
      message: `Migration completed for user ${userId}`,
    };
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify migration completeness' })
  async verify() {
    const result = await this.migrationService.verifyMigration();
    return {
      ...result,
      message: 'Check counts above. Non-zero values indicate unmigrated memberships.',
    };
  }
}

