import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
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
import { PolicyModule } from './policy/policy.module';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TenantMutationGuard } from './common/tenant/tenant-mutation.guard';
import { TenantContextInterceptor } from './common/tenant/tenant-context.interceptor';

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
    PolicyModule, // Policy decision centre
  ],
  providers: [
    // Note: TenantMutationGuard is now applied at controller level (after JwtAuthGuard)
    // Keeping it here as a fallback for any routes without explicit guards
    // But it will skip if req.user doesn't exist (meaning JWT guard hasn't run)
    {
      provide: APP_GUARD,
      useClass: TenantMutationGuard,
    },
    // Register interceptor globally
    // Interceptors run AFTER guards, so req.user is guaranteed to exist
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Register TenantContextMiddleware globally (before routes)
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes('*');
  }
}

