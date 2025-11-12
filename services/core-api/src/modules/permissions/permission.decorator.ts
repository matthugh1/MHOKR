import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to require specific permissions for a route
 * Usage: @RequirePermission(Permission.OKR_VIEW)
 *        @RequirePermission(Permission.OKR_EDIT, Permission.OKR_DELETE)
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);








