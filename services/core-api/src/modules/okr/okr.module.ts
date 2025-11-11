import { Module, forwardRef } from '@nestjs/common';
import { ObjectiveController } from './objective.controller';
import { KeyResultController } from './key-result.controller';
import { InitiativeController } from './initiative.controller';
import { PillarController } from './pillar.controller';
import { PillarService } from './pillar.service';
import { MeController } from './me.controller';
import { OkrReportingController } from './okr-reporting.controller';
import { OkrOverviewController } from './okr-overview.controller';
import { CheckInRequestController } from './checkin-request.controller';
import { OkrInsightsController } from './okr-insights.controller';
import { OkrCycleController } from './okr-cycle.controller';
import { ObjectiveService } from './objective.service';
import { KeyResultService } from './key-result.service';
import { InitiativeService } from './initiative.service';
import { OkrProgressService } from './okr-progress.service';
import { OkrGovernanceService } from './okr-governance.service';
import { OkrReportingService } from './okr-reporting.service';
import { OkrVisibilityService } from './okr-visibility.service';
import { OkrInsightsService } from './okr-insights.service';
import { CheckInRequestService } from './checkin-request.service';
import { OkrCycleService } from './okr-cycle.service';
import { CycleGeneratorService } from './cycle-generator.service';
import { OkrStateTransitionService } from './okr-state-transition.service';
import { CheckInReminderService } from './check-in-reminder.service';
import { CheckInReminderScheduler } from './check-in-reminder.scheduler';
import { LoggingNotificationAdapter } from './logging-notification.adapter';
import { NOTIFICATION_PORT_TOKEN } from './notification.constants';
import { RBACModule } from '../rbac/rbac.module';
import { ActivityModule } from '../activity/activity.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [forwardRef(() => RBACModule), forwardRef(() => ActivityModule), AuditModule],
  controllers: [ObjectiveController, KeyResultController, InitiativeController, PillarController, MeController, OkrReportingController, OkrOverviewController, CheckInRequestController, OkrInsightsController, OkrCycleController],
  providers: [
    ObjectiveService,
    KeyResultService,
    InitiativeService,
    PillarService,
    OkrProgressService,
    OkrGovernanceService,
    OkrReportingService,
    OkrVisibilityService,
    OkrInsightsService,
    CheckInRequestService,
    OkrCycleService,
    CycleGeneratorService,
    OkrStateTransitionService,
    CheckInReminderService,
    CheckInReminderScheduler,
    {
      provide: NOTIFICATION_PORT_TOKEN,
      useClass: LoggingNotificationAdapter, // Default: logging adapter; replace with EmailNotificationAdapter in production
    },
  ],
  exports: [ObjectiveService, KeyResultService, InitiativeService, OkrProgressService, OkrGovernanceService, OkrReportingService, OkrVisibilityService, OkrInsightsService, CheckInRequestService, OkrCycleService, CycleGeneratorService, OkrStateTransitionService, CheckInReminderService],
})
export class OkrModule {}


