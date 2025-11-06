import { Controller, Get, Query, UseGuards, Req, Param, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { ObjectiveService } from '../okr/objective.service';
import { KeyResultService } from '../okr/key-result.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

/**
 * Activity Controller
 * 
 * Dedicated controller for activity timeline endpoints.
 * 
 * Responsibilities:
 * - Get activity for an objective
 * - Get activity for a key result
 * - Future: global activity feed, filtered activity
 * 
 * NOTE: Activity timeline endpoints were moved from ObjectiveController and KeyResultController under /activity/* in Phase 4.
 */
@ApiTags('Activity')
@Controller('activity')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly objectiveService: ObjectiveService,
    private readonly keyResultService: KeyResultService,
  ) {}

  /**
   * Get recent activity for an objective.
   * 
   * Moved from ObjectiveController in Phase 4.
   * TODO [phase7-hardening]: Frontend - expose this on the Objective detail view timeline.
   */
  @Get('objectives/:id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent activity for an objective' })
  async getObjectiveActivity(
    @Param('id') id: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') actionFilter?: string,
    @Query('userId') userIdFilter?: string,
  ) {
    // Verify user can view this objective (same check as getById)
    const canView = await this.objectiveService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this OKR');
    }
    
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.activityService.getRecentForObjective(
      id,
      req.user.tenantId,
      limitNum,
      offsetNum,
      actionFilter,
      userIdFilter,
    );
  }

  /**
   * Get recent activity for a key result.
   * 
   * Moved from KeyResultController in Phase 4.
   * TODO [phase7-hardening]: Frontend - expose this on the Key Result detail view timeline.
   */
  @Get('key-results/:id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent activity for a key result' })
  async getKeyResultActivity(
    @Param('id') id: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') actionFilter?: string,
    @Query('userId') userIdFilter?: string,
  ) {
    // Verify user can view this key result (same check as getById)
    const canView = await this.keyResultService.canView(req.user.id, id);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this key result');
    }
    
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.activityService.getRecentForKeyResult(
      id,
      req.user.tenantId,
      limitNum,
      offsetNum,
      actionFilter,
      userIdFilter,
    );
  }

  /**
   * Future: Get global activity feed for user's scope.
   * 
   * TODO [phase7-hardening]: Future enhancement - show all activity across user's OKRs/KRs
   * - Use activityService.getRecentActivityForUserScope()
   * - Support filtering by entity type, action, date range
   */
  @Get('feed')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get global activity feed (future)' })
  async getGlobalFeed(
    @Req() _req: any,
    @Query('limit') _limit?: string,
    @Query('offset') _offset?: string,
  ) {
    // TODO [phase7-hardening]: Future implementation
    // - Call activityService.getRecentActivityForUserScope()
    // - Return global activity feed
    return { todo: true };
  }
}
