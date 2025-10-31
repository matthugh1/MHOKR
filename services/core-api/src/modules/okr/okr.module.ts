import { Module } from '@nestjs/common';
import { ObjectiveController } from './objective.controller';
import { KeyResultController } from './key-result.controller';
import { InitiativeController } from './initiative.controller';
import { MeController } from './me.controller';
import { ObjectiveService } from './objective.service';
import { KeyResultService } from './key-result.service';
import { InitiativeService } from './initiative.service';
import { OkrProgressService } from './okr-progress.service';
import { RBACModule } from '../rbac/rbac.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [RBACModule, ActivityModule],
  controllers: [ObjectiveController, KeyResultController, InitiativeController, MeController],
  providers: [ObjectiveService, KeyResultService, InitiativeService, OkrProgressService],
  exports: [ObjectiveService, KeyResultService, InitiativeService, OkrProgressService],
})
export class OkrModule {}


