import { Module } from '@nestjs/common';
import { ObjectiveController } from './objective.controller';
import { KeyResultController } from './key-result.controller';
import { InitiativeController } from './initiative.controller';
import { ObjectiveService } from './objective.service';
import { KeyResultService } from './key-result.service';
import { InitiativeService } from './initiative.service';
import { RBACModule } from '../rbac/rbac.module';

@Module({
  imports: [RBACModule],
  controllers: [ObjectiveController, KeyResultController, InitiativeController],
  providers: [ObjectiveService, KeyResultService, InitiativeService],
  exports: [ObjectiveService, KeyResultService, InitiativeService],
})
export class OkrModule {}


