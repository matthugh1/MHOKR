import { Module, forwardRef } from '@nestjs/common';
import { ObjectiveController } from './objective.controller';
import { KeyResultController } from './key-result.controller';
import { InitiativeController } from './initiative.controller';
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
import { RBACModule } from '../rbac/rbac.module';
import { ActivityModule } from '../activity/activity.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RBACModule, forwardRef(() => ActivityModule), AuditModule],
  controllers: [ObjectiveController, KeyResultController, InitiativeController, MeController, OkrReportingController, OkrOverviewController, CheckInRequestController, OkrInsightsController, OkrCycleController],
  providers: [ObjectiveService, KeyResultService, InitiativeService, OkrProgressService, OkrGovernanceService, OkrReportingService, OkrVisibilityService, OkrInsightsService, CheckInRequestService, OkrCycleService],
  exports: [ObjectiveService, KeyResultService, InitiativeService, OkrProgressService, OkrGovernanceService, OkrReportingService, OkrVisibilityService, OkrInsightsService, CheckInRequestService, OkrCycleService],
})
export class OkrModule {}


