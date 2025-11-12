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

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Skip if already set (idempotent - allows middleware to set it for public routes)
    if ((request as any).tenantId !== undefined) {
      return next.handle();
    }

    // Get user from request (set by JWT guard)
    const user = (request as any).user;
    
    // No user = public endpoint, no tenant context needed
    // TenantContextMiddleware will handle public routes
    if (!user) {
      return next.handle();
    }

    // Superuser => tenantId: null
    if (user.isSuperuser || user.tenantId === null) {
      (request as any).tenantId = null;
      (request as any).isSuperuser = true;
      this.logger.debug(`TenantContextInterceptor: Superuser detected, tenantId=null`);
      return next.handle();
    }

    // Normal user => use tenantId from JWT (already set by jwt.strategy.validate())
    if (user.tenantId && typeof user.tenantId === 'string') {
      (request as any).tenantId = user.tenantId;
      (request as any).isSuperuser = false;
      this.logger.log(`TenantContextInterceptor: ✅ Tenant context set from JWT, tenantId=${user.tenantId} for user ${user.id}`);
      return next.handle();
    }

    // Fallback: Look up tenant from role assignments (shouldn't happen in normal flow)
    // This handles edge cases where jwt.strategy didn't set tenantId
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
      (request as any).tenantId = orgAssignment.scopeId;
      (request as any).isSuperuser = false;
      this.logger.debug(`TenantContextInterceptor: Tenant context set from fallback lookup, tenantId=${orgAssignment.scopeId}`);
    } else {
      // No tenant found - but don't block here
      // TenantMutationGuard will handle mutations and throw appropriate error
      this.logger.debug(`TenantContextInterceptor: No tenant found for user ${user.id}, leaving undefined for TenantMutationGuard to handle`);
    }
    
    return next.handle();
  }
}
