import { Module, forwardRef } from '@nestjs/common';
import { AuthorisationService } from './authorisation.service';
import { PolicyController } from './policy.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RBACModule } from '../rbac/rbac.module';
import { OkrModule } from '../okr/okr.module';
import { SuperuserModule } from '../superuser/superuser.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => RBACModule),
    forwardRef(() => OkrModule),
    SuperuserModule,
  ],
  providers: [AuthorisationService],
  controllers: [PolicyController],
  exports: [AuthorisationService],
})
export class PolicyModule {}

