import { Module, forwardRef, Global } from '@nestjs/common';
import { AuthorisationService } from './authorisation.service';
import { PolicyController } from './policy.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RBACModule } from '../modules/rbac/rbac.module';
import { OkrModule } from '../modules/okr/okr.module';
import { SuperuserModule } from '../modules/superuser/superuser.module';

@Global()
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

