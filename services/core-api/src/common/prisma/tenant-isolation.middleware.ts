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
  organizationId: string | null | undefined;
}>();

/**
 * Get current tenant context from AsyncLocalStorage
 */
export function getTenantContext(): string | null | undefined {
  return tenantContext.getStore()?.organizationId;
}

/**
 * Run a function with tenant context
 */
export function withTenantContext<T>(
  organizationId: string | null | undefined,
  fn: () => T,
): T {
  return tenantContext.run({ organizationId }, fn);
}

/**
 * Prisma middleware to automatically inject tenant filters AND set PostgreSQL session variables for RLS
 * 
 * This middleware:
 * - Sets PostgreSQL session variables for RLS (defense-in-depth)
 * - Checks if query is on a tenant-scoped model
 * - Automatically adds organizationId filter if tenant context is available
 * - Skips filtering for SUPERUSER (organizationId === null)
 * - Does NOT filter if organizationId is undefined (user has no org)
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
    const organizationId = tenantContextStore?.organizationId;

    // If no tenant context, skip (let service handle it)
    if (organizationId === undefined) {
      return next(params);
    }

    // SUPERUSER (null) - no filter, can see all
    if (organizationId === null) {
      return next(params);
    }

    // Normal user - inject tenant filter
    if (params.action === 'findMany' || params.action === 'count' || params.action === 'aggregate' || params.action === 'groupBy') {
      // For findMany, add organizationId to where clause
      if (!params.args) {
        params.args = {};
      }
      if (!params.args.where) {
        params.args.where = {};
      }

      // Add organizationId filter (merge with existing where clause)
      params.args.where = {
        ...params.args.where,
        organizationId,
      };
    } else if (params.action === 'findUnique' || params.action === 'findFirst') {
      // For findUnique/findFirst, we can't automatically filter by ID
      // This is handled by service-level validation after the query
      // But we can add it to the where clause if it's a compound query
      if (params.args?.where && typeof params.args.where === 'object' && !params.args.where.id) {
        params.args.where = {
          ...params.args.where,
          organizationId,
        };
      }
    }

    return next(params);
  };
}

