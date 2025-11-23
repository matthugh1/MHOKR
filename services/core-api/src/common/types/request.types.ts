/**
 * Shared TypeScript types for authenticated requests
 * 
 * These types ensure type safety when accessing user information
 * from request objects in controllers.
 */

import { Request } from 'express';

/**
 * User object structure as set by JwtAuthGuard
 * Based on the return value from jwt.strategy.ts validate() method
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  tenantId: string | null; // null for superusers
  isSuperuser: boolean;
  features?: {
    rbacInspector?: boolean;
    okrTreeView?: boolean;
  };
}

/**
 * Authenticated request interface extending Express Request
 * 
 * Use this instead of `req: any` in controller methods to get
 * proper type safety and IDE autocomplete.
 * 
 * Example:
 * ```typescript
 * async getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
 *   const userId = req.user.id; // TypeScript knows this exists
 *   const tenantId = req.user.tenantId; // TypeScript knows this is string | null
 * }
 * ```
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}


