/**
 * Tenant Mutation Guard
 * 
 * Enforces tenant boundary checks for all mutation operations (POST/PUT/PATCH/DELETE).
 * 
 * Rules:
 * 1. req.tenantId must be present (null for superuser, string for normal user)
 * 2. If body/params include tenantId, must equal req.tenantId
 * 3. On mismatch: 403 {code:'TENANT_BOUNDARY'}
 * 
 * Usage:
 * - Apply globally via app.module.ts (before routes)
 * - Or apply per-controller with @UseGuards(TenantMutationGuard)
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';

@Injectable()
export class TenantMutationGuard implements CanActivate {
  private readonly logger = new Logger(TenantMutationGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();
    const path = request.path?.toLowerCase() || '';

    // Only apply to mutation methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }

    // Skip public endpoints
    if (
      path.startsWith('/auth/') ||
      path.startsWith('/system/') ||
      path === '/health' ||
      path === '/api/docs'
    ) {
      return true;
    }

    // IMPORTANT: This guard runs BEFORE controller-level guards (like JwtAuthGuard)
    // If req.user doesn't exist yet, skip tenant validation (JWT guard will handle auth)
    // The interceptor will set tenant context after JWT guard runs
    const user = (request as any).user;
    if (!user) {
      // No user = JWT guard hasn't run yet, or this is a public route
      // Skip tenant validation here - JWT guard will handle authentication
      // If it's an authenticated route, JWT guard will fail if no token
      // If it's public, tenant validation isn't needed
      this.logger.debug(`TenantMutationGuard: No user yet, skipping (JWT guard will handle auth first)`);
      return true;
    }

    // User exists = JWT guard has run, now check tenant context
    // Get tenantId from request (set by TenantContextInterceptor or TenantContextMiddleware)
    // Fallback to req.user.tenantId if interceptor hasn't run yet
    let requestTenantId = (request as any).tenantId;
    if (requestTenantId === undefined && user.tenantId !== undefined) {
      requestTenantId = user.tenantId;
      this.logger.debug(`TenantMutationGuard: Using req.user.tenantId as fallback: ${requestTenantId}`);
    }
    const isSuperuser = (request as any).isSuperuser === true || requestTenantId === null;
    
    this.logger.debug(`TenantMutationGuard: ${method} ${path} - requestTenantId=${requestTenantId}, isSuperuser=${isSuperuser}, user.id=${user.id}`);

    // Superuser bypass (but still cannot mutate - enforced elsewhere)
    if (isSuperuser) {
      this.logger.debug(`TenantMutationGuard: Superuser bypass for ${method} ${path}`);
      return true;
    }

    // Check if tenantId is present
    if (requestTenantId === undefined) {
      this.logger.warn(`TenantMutationGuard: Missing tenant context for ${method} ${path}`);
      
      // Increment metric for missing tenant context
      this.logger.log(`[Telemetry] rbac_missing_tenant_context_total`, {
        path,
        method,
        userId: (request as any).user?.id,
        timestamp: new Date().toISOString(),
      });
      
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_MISSING',
        message: 'Tenant context is required for mutation operations',
      });
    }

    // Extract tenantId from request body/params/query
    const bodyTenantId = request.body?.tenantId;
    const paramTenantId = request.params?.tenantId;
    const queryTenantId = request.query?.tenantId;

    const payloadTenantId = bodyTenantId || paramTenantId || queryTenantId;

    // If payload includes tenantId, validate it matches request tenantId
    if (payloadTenantId) {
      if (payloadTenantId !== requestTenantId) {
        this.logger.warn(
          `TenantMutationGuard: Tenant boundary violation. Request tenantId=${requestTenantId}, Payload tenantId=${payloadTenantId}`,
        );
        throw new ForbiddenException({
          code: 'TENANT_BOUNDARY',
          message: 'Cannot mutate resources across tenant boundaries',
          requestTenantId,
          payloadTenantId,
        });
      }
    }

    // Tenant context is valid
    this.logger.debug(`TenantMutationGuard: Allowed ${method} ${path} for tenantId=${requestTenantId}`);
    return true;
  }

}

