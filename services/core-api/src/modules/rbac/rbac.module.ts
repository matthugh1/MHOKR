import { Module } from '@nestjs/common';
import { RBACService } from './rbac.service';
import { RBACGuard } from './rbac.guard';
import { RBACMigrationService } from './migration.service';
import { RBACMigrationController } from './migration.controller';
import { RBACAssignmentController, ExecWhitelistController } from './rbac-assignment.controller';
import { RBACInspectorController } from './rbac-inspector.controller';
import { RBACCacheService } from './rbac-cache.service';
import { ExecWhitelistService } from './exec-whitelist.service';
import { RBACInspectorService } from './rbac-inspector.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { UserService } from '../user/user.service';
import { AuditLogService } from '../audit/audit-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    RBACMigrationController,
    RBACAssignmentController,
    ExecWhitelistController,
    RBACInspectorController,
  ],
  providers: [
    RBACService,
    RBACGuard,
    RBACMigrationService,
    RBACCacheService,
    ExecWhitelistService,
    RBACInspectorService,
    UserService,
    AuditLogService,
  ],
  exports: [
    RBACService,
    RBACGuard,
    RBACMigrationService,
    RBACCacheService,
    ExecWhitelistService,
    RBACInspectorService,
  ],
})
export class RBACModule {}

