import { Module, Global } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { RoleService } from './role.service';
import { PermissionGuard } from './permission.guard';
import { TenantIsolationGuard } from './tenant-isolation.guard';
// PrismaModule is Global, so we don't need to import it

@Global() // Make available to all modules
@Module({
  providers: [PermissionService, RoleService, PermissionGuard, TenantIsolationGuard],
  exports: [PermissionService, RoleService, PermissionGuard, TenantIsolationGuard],
})
export class PermissionModule {}

