import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OkrReportingService } from './okr-reporting.service';
import { ActivityService } from '../activity/activity.service';
import { IntelligenceService } from './intelligence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('My Dashboard')
@Controller('me')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class MeController {
  constructor(
    private readonly reportingService: OkrReportingService,
    private readonly activityService: ActivityService,
    private readonly intelligenceService: IntelligenceService,
  ) {}

  @Get('summary')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get user dashboard summary with todos and intelligence' })
  async getSummary(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const userOrganizationId = req.user.tenantId;

    // Get user's owned work items - fetch todos/intelligence separately to handle errors gracefully
    const [
      ownedObjectives,
      ownedKeyResults,
      ownedInitiatives,
      ownedTasks,
      recentActivity,
      allOverdueCheckIns,
    ] = await Promise.all([
      this.reportingService.getUserOwnedObjectives(userId, userOrganizationId),
      this.reportingService.getUserOwnedKeyResults(userId, userOrganizationId),
      this.reportingService.getUserOwnedInitiatives(userId, userOrganizationId),
      this.reportingService.getUserOwnedTasks(userId, userOrganizationId),
      this.activityService.getRecentActivityForUserScope(userId, userOrganizationId),
      this.reportingService.getOverdueCheckIns(userOrganizationId, userId, { ownerId: userId }),
    ]);

    // Fetch todos and intelligence separately with error handling
    let myTodos: any[] = [];
    let intelligence: any = null;
    
    try {
      myTodos = await this.reportingService.getMyTodos(userId, userOrganizationId);
      console.log(`[MeController] Successfully fetched ${myTodos.length} todos`);
    } catch (err: any) {
      console.error('[MeController] Error fetching todos:', err);
      console.error('[MeController] Error message:', err?.message);
      console.error('[MeController] Error stack:', err?.stack);
      myTodos = [];
    }

    try {
      intelligence = await this.intelligenceService.getUserWorkInsights(userId, userOrganizationId);
      console.log(`[MeController] Successfully fetched intelligence:`, !!intelligence);
    } catch (err: any) {
      console.error('[MeController] Error fetching intelligence:', err);
      console.error('[MeController] Intelligence error message:', err?.message);
      console.error('[MeController] Intelligence error stack:', err?.stack);
      intelligence = {
        overdueCount: 0,
        dueThisWeekCount: 0,
        atRiskCount: 0,
        staleCount: 0,
        blockedCount: 0,
        focusSuggestion: null,
        patterns: [],
        workloadDistribution: { byType: {}, byStatus: {} },
      };
    }

    // Filter overdue check-ins to only those owned by this user (already filtered by ownerId above, but keep for safety)
    const overdueCheckIns = allOverdueCheckIns.filter((item: { owner: { id: string } }) => item.owner.id === userId);

    // Debug logging
    console.log(`[MeController] Summary for user ${userId} (org: ${userOrganizationId}):`, {
      ownedObjectives: ownedObjectives.length,
      ownedKeyResults: ownedKeyResults.length,
      ownedInitiatives: ownedInitiatives.length,
      ownedTasks: ownedTasks.length,
      myTodos: myTodos.length,
      hasIntelligence: !!intelligence,
    });

    return {
      ownedObjectives,
      ownedKeyResults,
      ownedInitiatives,
      ownedTasks,
      recentActivity,
      overdueCheckIns,
      myTodos,
      intelligence,
    };
  }

  @Get('quick-actions')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get available quick actions based on user work' })
  async getQuickActions(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const userOrganizationId = req.user.tenantId;

    const todos = await this.reportingService.getMyTodos(userId, userOrganizationId);
    const overdueCheckIns = todos.filter(t => t.type === 'CHECK_IN' && t.reason.includes('Overdue'));
    const tasksDueToday = todos.filter(t => t.type === 'TASK' && t.reason.includes('Due today'));
    const atRiskItems = todos.filter(t => t.reason.includes('At Risk') || t.reason.includes('Off Track'));

    return {
      canCheckInBulk: overdueCheckIns.length > 0,
      overdueCheckInCount: overdueCheckIns.length,
      canCompleteTasksToday: tasksDueToday.length > 0,
      tasksDueTodayCount: tasksDueToday.length,
      canUpdateAtRiskItems: atRiskItems.length > 0,
      atRiskItemsCount: atRiskItems.length,
    };
  }
}


