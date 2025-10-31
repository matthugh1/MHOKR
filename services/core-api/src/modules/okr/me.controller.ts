import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ObjectiveService } from './objective.service';
import { KeyResultService } from './key-result.service';
import { ActivityService } from '../activity/activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@ApiTags('My Dashboard')
@Controller('me')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class MeController {
  constructor(
    private readonly objectiveService: ObjectiveService,
    private readonly keyResultService: KeyResultService,
    private readonly activityService: ActivityService,
  ) {}

  @Get('summary')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get user dashboard summary' })
  async getSummary(@Req() req: any) {
    // TODO: Frontend: this powers a 'My dashboard' view; later we can add widgets for only-my-team.
    const userId = req.user.id;
    const userOrganizationId = req.user.organizationId;

    // Get user's owned Objectives and Key Results
    const [ownedObjectives, ownedKeyResults, recentActivity, allOverdueCheckIns] = await Promise.all([
      this.objectiveService.getUserOwnedObjectives(userId, userOrganizationId),
      this.keyResultService.getUserOwnedKeyResults(userId, userOrganizationId),
      this.activityService.getRecentActivityForUserScope(userId, userOrganizationId),
      this.keyResultService.getOverdueCheckIns(userOrganizationId),
    ]);

    // Filter overdue check-ins to only those owned by this user
    const overdueCheckIns = allOverdueCheckIns.filter((item) => item.ownerId === userId);

    return {
      ownedObjectives,
      ownedKeyResults,
      recentActivity,
      overdueCheckIns,
    };
  }
}


