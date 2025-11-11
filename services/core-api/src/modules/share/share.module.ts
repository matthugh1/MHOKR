import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RBACModule } from '../rbac/rbac.module';
import { OkrModule } from '../okr/okr.module';

@Module({
  imports: [PrismaModule, AuditModule, RBACModule, OkrModule],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}


