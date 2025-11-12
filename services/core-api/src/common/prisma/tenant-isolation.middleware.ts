/**
 * Prisma Tenant Isolation Middleware
 * 
 * Automatically injects tenant filters into Prisma queries for defense-in-depth.
 * This middleware works alongside manual tenant validation in services.
 * 
 * Note: This is a safety net - services should still manually validate tenant context.
 */

import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

// Tenant context stored in AsyncLocalStorage
export const tenantContext = new AsyncLocalStorage<{
  tenantId: string | null | undefined;
}>();

/**
 * Get current tenant context from AsyncLocalStorage
 */
export function getTenantContext(): string | null | undefined {
  return tenantContext.getStore()?.tenantId;
}

/**
 * Run a function with tenant context
 */
export function withTenantContext<T>(
  tenantId: string | null | undefined,
  fn: () => T,
): T {
  return tenantContext.run({ tenantId }, fn);
}

/**
 * Prisma middleware to automatically inject tenant filters AND set PostgreSQL session variables for RLS
 * 
 * This middleware:
 * - Sets PostgreSQL session variables for RLS (defense-in-depth)
 * - Checks if query is on a tenant-scoped model
 * - Automatically adds tenantId filter if tenant context is available
 * - Skips filtering for SUPERUSER (tenantId === null)
 * - Does NOT filter if tenantId is undefined (user has no tenant)
 */
export function createTenantIsolationMiddleware() {
  return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
    // Note: PostgreSQL RLS session variables are set in PrismaService constructor
    // via a separate middleware that runs BEFORE this one (middleware order matters)
    
    // Tenant-scoped models that require filtering
    const tenantScopedModels = [
      'objective',
      'keyResult',
      'workspace',
      'team',
      'cycle',
      'initiative',
      'checkInRequest',
      'strategicPillar',
      'activity',      // ADD THIS
      'userLayout',    // ADD THIS
    ];

    // Skip if not a tenant-scoped model
    if (!tenantScopedModels.includes(params.model || '')) {
      return next(params);
    }

    // Skip for write operations - tenant validation should be explicit in services
    if (['create', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(params.action)) {
      return next(params);
    }

    // Only filter findMany, findUnique, findFirst queries
    if (!['findMany', 'findUnique', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
      return next(params);
    }

    // Get tenant context
    const tenantContextStore = tenantContext.getStore();
    const tenantId = tenantContextStore?.tenantId;

    // If no tenant context, skip (let service handle it)
    if (tenantId === undefined) {
      return next(params);
    }

    // SUPERUSER (null) - no filter, can see all
    if (tenantId === null) {
      return next(params);
    }

    // Normal user - inject tenant filter
    if (params.action === 'findMany' || params.action === 'count' || params.action === 'aggregate' || params.action === 'groupBy') {
      // For findMany, add tenantId to where clause
      if (!params.args) {
        params.args = {};
      }
      if (!params.args.where) {
        params.args.where = {};
      }

      // Add tenantId filter (merge with existing where clause)
      params.args.where = {
        ...params.args.where,
        tenantId,
      };
    } else if (params.action === 'findUnique' || params.action === 'findFirst') {
      // For findUnique/findFirst, we can't automatically filter by ID
      // This is handled by service-level validation after the query
      // But we can add it to the where clause if it's a compound query
      if (params.args?.where && typeof params.args.where === 'object' && !params.args.where.id) {
        params.args.where = {
          ...params.args.where,
          tenantId,
        };
      }
    }

    return next(params);
  };
}

