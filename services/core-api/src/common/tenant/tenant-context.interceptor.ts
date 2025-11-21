/**
 * Tenant Context Interceptor
 * 
 * Sets tenant context on the request AFTER all guards have run.
 * Interceptors run AFTER guards, so req.user is guaranteed to exist
 * for authenticated routes.
 * 
 * Responsibilities:
 * - Extract tenantId from req.user.tenantId (set by jwt.strategy)
 * - Set request.tenantId for use by TenantMutationGuard and Prisma middleware
 * - Handle superuser case (tenantId: null)
 * - Fallback lookup for edge cases (shouldn't happen in normal flow)
 * 
 * Note: This interceptor runs AFTER all guards, so req.user is guaranteed to exist
 * for authenticated routes. Public routes are handled by TenantContextMiddleware.
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantContext } from '../prisma/tenant-isolation.middleware';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Skip if already set (idempotent - allows middleware to set it for public routes)
    if ((request as any).tenantId !== undefined) {
      // Still need to set AsyncLocalStorage context for Prisma middleware
      const existingTenantId = (request as any).tenantId;
      return new Observable(observer => {
        withTenantContext(existingTenantId, () => {
          next.handle().subscribe({
            next: (value) => observer.next(value),
            error: (err) => observer.error(err),
            complete: () => observer.complete(),
          });
        });
      });
    }

    // Get user from request (set by JWT guard)
    const user = (request as any).user;
    
    // No user = public endpoint, no tenant context needed
    // TenantContextMiddleware will handle public routes
    if (!user) {
      return next.handle();
    }

    // Determine tenantId
    let tenantId: string | null | undefined = undefined;
    let isSuperuser = false;

    // Superuser => tenantId: null
    if (user.isSuperuser || user.tenantId === null) {
      tenantId = null;
      isSuperuser = true;
      this.logger.debug(`TenantContextInterceptor: Superuser detected, tenantId=null`);
    }
    // Normal user => use tenantId from JWT (already set by jwt.strategy.validate())
    else if (user.tenantId && typeof user.tenantId === 'string') {
      tenantId = user.tenantId;
      isSuperuser = false;
      this.logger.log(`TenantContextInterceptor: ✅ Tenant context set from JWT, tenantId=${tenantId} for user ${user.id}`);
    }
    // Fallback: Look up tenant from role assignments (shouldn't happen in normal flow)
    else {
      this.logger.warn(`TenantContextInterceptor: tenantId not in JWT, performing fallback lookup for user ${user.id}`);
      
      const orgAssignment = await this.prisma.roleAssignment.findFirst({
        where: {
          userId: user.id,
          scopeType: 'TENANT',
        },
        select: { scopeId: true },
        orderBy: { createdAt: 'asc' },
      });

      if (orgAssignment) {
        tenantId = orgAssignment.scopeId;
        isSuperuser = false;
        this.logger.debug(`TenantContextInterceptor: Tenant context set from fallback lookup, tenantId=${tenantId}`);
      } else {
        // No tenant found - but don't block here
        // TenantMutationGuard will handle mutations and throw appropriate error
        this.logger.debug(`TenantContextInterceptor: No tenant found for user ${user.id}, leaving undefined for TenantMutationGuard to handle`);
      }
    }

    // Set on request for other guards/interceptors
    (request as any).tenantId = tenantId;
    (request as any).isSuperuser = isSuperuser;

    // CRITICAL: Set AsyncLocalStorage context so Prisma middleware can read it
    // This ensures RLS session variables are set before Prisma queries execute
    return new Observable(observer => {
      withTenantContext(tenantId, () => {
        next.handle().subscribe({
          next: (value) => observer.next(value),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
      });
    });
  }
}
