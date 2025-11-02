import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { TeamModule } from './modules/team/team.module';
import { OkrModule } from './modules/okr/okr.module';
import { ActivityModule } from './modules/activity/activity.module';
import { LayoutModule } from './modules/layout/layout.module';
import { RBACModule } from './modules/rbac/rbac.module';
import { SuperuserModule } from './modules/superuser/superuser.module';
import { AuditModule } from './modules/audit/audit.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    RBACModule, // RBAC system - loaded early for guards
    AuditModule, // Audit logging - make available globally
    AuthModule,
    UserModule,
    OrganizationModule,
    WorkspaceModule,
    TeamModule,
    OkrModule,
    ActivityModule,
    LayoutModule,
    SuperuserModule,
    SystemModule,
  ],
})
export class AppModule {}

