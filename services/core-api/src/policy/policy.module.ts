import { Module, forwardRef } from '@nestjs/common';
import { AuthorisationService } from './authorisation.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RBACModule } from '../rbac/rbac.module';
import { OkrModule } from '../okr/okr.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => RBACModule),
    forwardRef(() => OkrModule),
  ],
  providers: [AuthorisationService],
  exports: [AuthorisationService],
})
export class PolicyModule {}

