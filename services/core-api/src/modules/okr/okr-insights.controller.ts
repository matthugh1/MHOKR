import { Controller, Get, Query, UseGuards, Req, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { OkrInsightsService } from './okr-insights.service';

/**
 * OKR Insights Controller
 * 
 * W5.M2: Provides inline insights and cycle health endpoints.
 * All endpoints respect server-side visibility and tenant isolation.
 * 
 * Endpoints:
 * - GET /okr/insights/cycle-summary - Cycle health summary
 * - GET /okr/insights/objective/:id - Objective-level insights
 * - GET /okr/insights/attention - Attention feed (paginated)
 */
@ApiTags('OKR Insights')
@Controller('okr/insights')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class OkrInsightsController {
  constructor(private readonly insightsService: OkrInsightsService) {}

  /**
   * Get cycle health summary.
   * 
   * Returns aggregated counts for objectives, KRs, and check-ins for a specific cycle.
   * All counts respect visibility filtering.
   */
  @Get('cycle-summary')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get cycle health summary' })
  @ApiQuery({ name: 'cycleId', required: true, type: String, description: 'Cycle ID' })
  async getCycleSummary(@Query('cycleId') cycleId: string | undefined, @Req() req: any) {
    if (!cycleId) {
      throw new BadRequestException('cycleId query parameter is required');
    }

    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;

    return this.insightsService.getCycleSummary(cycleId, userOrganizationId, requesterUserId);
  }

  /**
   * Get objective-level insights.
   * 
   * Returns compact facts for a single objective that the caller can see.
   * Includes status trend, last update age, KR roll-ups, and check-in counts.
   */
  @Get('objective/:id')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get objective-level insights' })
  async getObjectiveInsights(@Param('id') objectiveId: string, @Req() req: any) {
    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;

    const insights = await this.insightsService.getObjectiveInsights(
      objectiveId,
      userOrganizationId,
      requesterUserId,
    );

    if (!insights) {
      throw new BadRequestException('Objective not found or not visible');
    }

    return insights;
  }

  /**
   * Get attention feed (paginated).
   * 
   * Returns visibility-aware list of attention items:
   * - OVERDUE_CHECKIN: KRs with overdue check-ins
   * - NO_UPDATE_14D: Objectives not updated in 14+ days
   * - STATUS_DOWNGRADE: Objectives that changed status from ON_TRACK to AT_RISK/BLOCKED
   */
  @Get('attention')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get attention feed (paginated)' })
  @ApiQuery({ name: 'cycleId', required: false, type: String, description: 'Optional cycle ID filter' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Items per page (default: 20, max: 50)' })
  async getAttentionFeed(
    @Query('cycleId') cycleId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req: any,
  ) {
    const userOrganizationId = req.user?.tenantId ?? null;
    const requesterUserId = req.user?.id;

    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    if (pageNum < 1) {
      throw new BadRequestException('page must be >= 1');
    }
    if (pageSizeNum < 1 || pageSizeNum > 50) {
      throw new BadRequestException('pageSize must be between 1 and 50');
    }

    return this.insightsService.getAttentionFeed(
      cycleId,
      pageNum,
      pageSizeNum,
      userOrganizationId,
      requesterUserId,
    );
  }
}

