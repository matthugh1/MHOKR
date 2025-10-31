import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { RoleService } from './role.service';

/**
 * @deprecated TenantIsolationGuard is not applied anywhere.
 * This logic is now enforced directly in:
 * - objective.service.findAll (read isolation)
 * - objective.service.canEdit / canDelete (write isolation)
 * TODO [phase7-hardening]: Cleanup/removal of legacy membership tables and TenantIsolationGuard after all controllers migrated
 * 
 * Tenant Isolation Guard
 * 
 * Automatically filters data access by user's organization(s).
 * Superusers bypass all tenant restrictions.
 * 
 * This guard should be used on endpoints that return data scoped to organizations.
 * It adds organization filtering context to the request for downstream services.
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(
    private permissionService: PermissionService,
    private roleService: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is superuser - superusers bypass tenant isolation
    const isSuperuser = await this.permissionService.isSuperuser(user.id);
    if (isSuperuser) {
      // Superusers can access everything - set flag on request
      request.isSuperuser = true;
      request.userOrganizations = null; // null means all organizations
      return true;
    }

    // Get user's organization memberships
    const userRoles = await this.roleService.getUserRoles(user.id);
    
    // Extract unique organization IDs
    const organizationIds = new Set<string>();
    for (const role of userRoles) {
      if (role.organizationId) {
        organizationIds.add(role.organizationId);
      }
    }

    if (organizationIds.size === 0) {
      // User has no organization memberships - they can't access anything
      request.userOrganizations = [];
      // Don't throw error here - let the service decide what to return
      return true;
    }

    // Attach user's organization IDs to request for filtering
    request.userOrganizations = Array.from(organizationIds);
    request.isSuperuser = false;

    return true;
  }
}


