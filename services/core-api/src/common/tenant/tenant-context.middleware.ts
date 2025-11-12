/**
 * Tenant Context Middleware
 * 
 * Resolves tenantId for PUBLIC/NON-AUTHENTICATED routes only.
 * 
 * For authenticated routes, TenantContextGuard handles tenant resolution
 * after JWT authentication sets req.user.
 * 
 * Resolution order (for public routes):
 * 1. Header x-tenant-id
 * 2. Subdomain (e.g., tenant.example.com)
 * 3. Session (if applicable)
 * 4. Request body (legacy/edge cases)
 * 
 * Note: This middleware runs BEFORE routes and guards.
 * If req.user exists, it skips (guard will handle it).
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, NextFunction } from 'express';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  use(req: Request, _res: any, next: NextFunction) {
    // Skip if user exists - TenantContextGuard will handle authenticated routes
    // This middleware only handles public/non-authenticated routes
    if ((req as any).user) {
      this.logger.debug(`TenantContextMiddleware: User exists, skipping (guard will handle)`);
      return next();
    }

    // Extract tenantId from multiple sources (for public routes only)
    let tenantId: string | null | undefined = undefined;

    // 1. Header x-tenant-id
    if (!tenantId) {
      const headerTenantId = req.headers['x-tenant-id'] as string;
      if (headerTenantId && headerTenantId.trim() !== '') {
        tenantId = headerTenantId.trim();
        this.logger.debug(`Resolved tenantId from x-tenant-id header: ${tenantId}`);
      }
    }

    // 2. Subdomain extraction (e.g., tenant.example.com → tenant)
    if (!tenantId) {
      const host = req.headers.host || '';
      const subdomainMatch = host.match(/^([^.]+)\./);
      if (subdomainMatch && subdomainMatch[1] !== 'www' && subdomainMatch[1] !== 'api') {
        tenantId = subdomainMatch[1];
        this.logger.debug(`Resolved tenantId from subdomain: ${tenantId}`);
      }
    }

    // 3. Session (if session middleware is enabled)
    if (!tenantId && (req as any).session) {
      tenantId = (req as any).session?.tenantId;
      if (tenantId) {
        this.logger.debug(`Resolved tenantId from session: ${tenantId}`);
      }
    }

    // 4. Request body (LEGACY/EDGE CASE ONLY - for public endpoints)
    // This fallback is only for legacy users created before the fix, or edge cases
    // Normal flow: tenantId should always be present in user.tenantId from JWT
    // If tenantId is still undefined here, it indicates a data integrity issue
    if (!tenantId && req.body && typeof req.body === 'object' && req.body.tenantId) {
      tenantId = req.body.tenantId;
      if (tenantId && typeof tenantId === 'string' && tenantId.trim() !== '') {
        tenantId = tenantId.trim();
        this.logger.warn(`[LEGACY] Resolved tenantId from request body (should be in JWT): ${tenantId}`, {
          userId: (req as any).user?.id,
          userEmail: (req as any).user?.email,
        });
      } else {
        tenantId = undefined;
      }
    }

    // Note: No normalization needed - we only use tenantId now

    // Attach tenantId to request (for public endpoints only)
    (req as any).tenantId = tenantId;
    (req as any).isSuperuser = tenantId === null;

    // Log tenant resolution for debugging (only for public routes)
    // For authenticated routes, TenantContextInterceptor will handle tenant context
    if (tenantId !== undefined) {
      this.logger.debug(`TenantContextMiddleware: Tenant context resolved for public route: tenantId=${tenantId}, isSuperuser=${tenantId === null}`);
    }
    // Don't log "not resolved" - this is expected for authenticated routes (interceptor handles it)

    // Note: We don't throw here if tenantId is missing - TenantMutationGuard will handle mutations
    // This allows read-only endpoints to work without tenant context
    next();
  }
}

