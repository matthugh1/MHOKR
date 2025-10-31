import { Module, forwardRef } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { RBACModule } from '../rbac/rbac.module';
import { OkrModule } from '../okr/okr.module';

@Module({
  imports: [RBACModule, forwardRef(() => OkrModule)],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}



