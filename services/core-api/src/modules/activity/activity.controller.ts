import { Controller, Get, Query, UseGuards, Req, Param } from '@nestjs/common';
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
 * TODO Phase 3: Move the following endpoints from ObjectiveController:
 * - GET /objectives/:id/activity → GET /activity/objectives/:id
 * 
 * TODO Phase 3: Move the following endpoints from KeyResultController:
 * - GET /key-results/:id/activity → GET /activity/key-results/:id
 */
@ApiTags('Activity')
@Controller('activity')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class ActivityController {
  constructor(
    // @ts-expect-error Phase 3: Will be used when implementing activity endpoints
    private readonly _activityService: ActivityService,
    // @ts-expect-error Phase 3: Will be used when implementing activity endpoints
    private readonly _objectiveService: ObjectiveService,
    // @ts-expect-error Phase 3: Will be used when implementing activity endpoints
    private readonly _keyResultService: KeyResultService,
  ) {}

  /**
   * Get recent activity for an objective.
   * 
   * TODO Phase 3: move logic from objective.controller.ts
   * This route will replace GET /objectives/:id/activity in Phase 3.
   */
  @Get('objectives/:id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent activity for an objective' })
  async getObjectiveActivity(
    @Param('id') id: string,
    @Req() _req: any,
    @Query('limit') _limit?: string,
    @Query('offset') _offset?: string,
    @Query('action') _actionFilter?: string,
    @Query('userId') _userIdFilter?: string,
  ) {
    // TODO Phase 3: move logic from objective.controller.ts
    return { todo: true, id };
  }

  /**
   * Get recent activity for a key result.
   * 
   * TODO Phase 3: move logic from key-result.controller.ts
   * This route will replace GET /key-results/:id/activity in Phase 3.
   */
  @Get('key-results/:id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get recent activity for a key result' })
  async getKeyResultActivity(
    @Param('id') id: string,
    @Req() _req: any,
    @Query('limit') _limit?: string,
    @Query('offset') _offset?: string,
    @Query('action') _actionFilter?: string,
    @Query('userId') _userIdFilter?: string,
  ) {
    // TODO Phase 3: move logic from key-result.controller.ts
    return { todo: true, id };
  }

  /**
   * Future: Get global activity feed for user's scope.
   * 
   * TODO: Future enhancement - show all activity across user's OKRs/KRs
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
    // TODO: Future implementation
    // - Call activityService.getRecentActivityForUserScope()
    // - Return global activity feed
    return { todo: true };
  }
}
