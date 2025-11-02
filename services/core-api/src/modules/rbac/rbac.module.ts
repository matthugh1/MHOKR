import { Module } from '@nestjs/common';
import { RBACService } from './rbac.service';
import { RBACGuard } from './rbac.guard';
import { RBACMigrationService } from './migration.service';
import { RBACMigrationController } from './migration.controller';
import { RBACAssignmentController, ExecWhitelistController } from './rbac-assignment.controller';
import { RBACCacheService } from './rbac-cache.service';
import { ExecWhitelistService } from './exec-whitelist.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { UserService } from '../user/user.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    RBACMigrationController,
    RBACAssignmentController,
    ExecWhitelistController,
  ],
  providers: [
    RBACService,
    RBACGuard,
    RBACMigrationService,
    RBACCacheService,
    ExecWhitelistService,
    UserService,
  ],
  exports: [
    RBACService,
    RBACGuard,
    RBACMigrationService,
    RBACCacheService,
    ExecWhitelistService,
  ],
})
export class RBACModule {}

