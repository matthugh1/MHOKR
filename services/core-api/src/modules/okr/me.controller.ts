import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OkrReportingService } from './okr-reporting.service';
import { ActivityService } from '../activity/activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('My Dashboard')
@Controller('me')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class MeController {
  constructor(
    private readonly reportingService: OkrReportingService,
    private readonly activityService: ActivityService,
  ) {}

  @Get('summary')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get user dashboard summary' })
  async getSummary(@Req() req: any) {
    // TODO [phase7-hardening]: Expose this data in a dedicated 'My dashboard' view in frontend
    const userId = req.user.id;
    const userOrganizationId = req.user.organizationId;

    // Get user's owned Objectives and Key Results
    const [ownedObjectives, ownedKeyResults, recentActivity, allOverdueCheckIns] = await Promise.all([
      this.reportingService.getUserOwnedObjectives(userId, userOrganizationId),
      this.reportingService.getUserOwnedKeyResults(userId, userOrganizationId),
      this.activityService.getRecentActivityForUserScope(userId, userOrganizationId),
      this.reportingService.getOverdueCheckIns(userOrganizationId),
    ]);

    // Filter overdue check-ins to only those owned by this user
    const overdueCheckIns = allOverdueCheckIns.filter((item: { ownerId: string }) => item.ownerId === userId);

    return {
      ownedObjectives,
      ownedKeyResults,
      recentActivity,
      overdueCheckIns,
    };
  }
}


