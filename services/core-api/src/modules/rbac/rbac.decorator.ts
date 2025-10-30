/**
 * RBAC Decorators
 * 
 * Decorators for specifying RBAC requirements on routes.
 */

import { SetMetadata } from '@nestjs/common';
import { Action, ResourceContext } from './types';

export const RBAC_ACTION_KEY = 'rbac:action';
export const RBAC_RESOURCE_CONTEXT_KEY = 'rbac:resourceContext';

/**
 * Require specific action permission
 * 
 * @example
 * @RequireAction('view_okr')
 * @Get(':id')
 * async getOKR(@Param('id') id: string) { ... }
 */
export const RequireAction = (action: Action) =>
  SetMetadata(RBAC_ACTION_KEY, action);

/**
 * Require action with resource context function
 * 
 * The function receives the request and returns ResourceContext.
 * 
 * @example
 * @RequireActionWithContext('view_okr', (req) => ({
 *   tenantId: req.params.tenantId,
 *   okr: { id: req.params.id, ... }
 * }))
 * @Get(':tenantId/okrs/:id')
 * async getOKR(@Param('id') id: string) { ... }
 */
export const RequireActionWithContext = (
  action: Action,
  resourceContextFn: (request: any) => ResourceContext | Promise<ResourceContext>,
) => {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey !== undefined && descriptor !== undefined) {
      SetMetadata(RBAC_ACTION_KEY, action)(target, propertyKey, descriptor);
      SetMetadata(RBAC_RESOURCE_CONTEXT_KEY, resourceContextFn)(
        target,
        propertyKey,
        descriptor,
      );
    }
  };
};

/**
 * Public route (bypasses RBAC)
 */
export const Public = () => SetMetadata('isPublic', true);

