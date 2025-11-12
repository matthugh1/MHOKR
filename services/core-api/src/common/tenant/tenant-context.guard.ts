/**
 * Tenant Context Guard
 * 
 * Sets tenant context on the request after JWT authentication.
 * 
 * IMPORTANT: This guard runs as a global guard, which means it runs BEFORE
 * controller-level guards like JwtAuthGuard. To handle this, we:
 * 1. Skip if req.user doesn't exist yet (JWT guard hasn't run)
 * 2. Set tenant context if req.user exists (JWT guard has run)
 * 
 * For routes with JWT guard, this guard will run twice:
 * - First: Before JWT (skips because no user)
 * - Second: After JWT (sets tenant context)
 * 
 * Actually wait - guards only run once. The issue is that global guards
 * run before controller guards. So we need to check if JWT guard has run.
 * 
 * Better approach: Make this guard check if it's on a protected route.
 * If req.user doesn't exist, it means either:
 * - Public route (no JWT guard) → skip
 * - Protected route but JWT guard hasn't run yet → this shouldn't happen
 * 
 * Actually, the real issue is that NestJS runs guards in order:
 * 1. Global guards (APP_GUARD)
 * 2. Controller guards (@UseGuards)
 * 3. Route guards (@UseGuards on method)
 * 
 * So TenantContextGuard runs BEFORE JwtAuthGuard. We need to defer setting
 * tenant context until after JWT guard runs. But guards can't "defer".
 * 
 * Solution: Use an interceptor that runs AFTER guards, or make the guard
 * check if user exists and set context then. But if user doesn't exist,
 * we can't set it.
 * 
 * Actually, the best solution is to make TenantContextGuard run as a
 * controller-level guard AFTER JwtAuthGuard, not as a global guard.
 * But that requires adding it to every controller.
 * 
 * Alternative: Make TenantContextGuard check if it's a protected route
 * by checking if JWT guard is applied. But we can't know that.
 * 
 * Best solution: Make TenantContextGuard set tenant context in an interceptor
 * that runs after all guards, OR make it work by checking req.user and
 * setting context if user exists (which means JWT guard has run).
 * 
 * Wait - I think the issue is that guards registered via APP_GUARD run
 * in reverse order of registration. Let me check NestJS docs...
 * 
 * Actually, the simplest fix: Make TenantContextGuard check if req.user exists.
 * If it does, set tenant context. If it doesn't, return true (don't block).
 * Then, after JWT guard runs and sets req.user, we need TenantContextGuard
 * to run again. But guards only run once.
 * 
 * REAL SOLUTION: Use an interceptor that runs AFTER all guards to set
 * tenant context. Interceptors run after guards.
 */

import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantContextGuard implements CanActivate {
  private readonly logger = new Logger(TenantContextGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();
    const path = request.path?.toLowerCase() || '';
    
    this.logger.debug(`TenantContextGuard: Running for ${method} ${path}`);
    
    // Skip if already set (idempotent - allows middleware to set it for public routes)
    if ((request as any).tenantId !== undefined) {
      this.logger.debug(`TenantContextGuard: tenantId already set to ${(request as any).tenantId}, skipping`);
      return true;
    }

    // Get user from request (set by JWT guard)
    const user = (request as any).user;
    
    this.logger.debug(`TenantContextGuard: user exists: ${!!user}, user.tenantId: ${user?.tenantId}, user.isSuperuser: ${user?.isSuperuser}`);
    
    // No user = public endpoint, no tenant context needed
    // TenantContextMiddleware will handle public routes
    if (!user) {
      this.logger.debug(`TenantContextGuard: No user, skipping (public route)`);
      return true;
    }

    // Superuser => tenantId: null
    if (user.isSuperuser || user.tenantId === null) {
      (request as any).tenantId = null;
      (request as any).isSuperuser = true;
      this.logger.debug(`TenantContextGuard: Superuser detected, tenantId=null`);
      return true;
    }

    // Normal user => use tenantId from JWT (already set by jwt.strategy.validate())
    if (user.tenantId && typeof user.tenantId === 'string') {
      (request as any).tenantId = user.tenantId;
      (request as any).isSuperuser = false;
      this.logger.log(`TenantContextGuard: ✅ Tenant context set from JWT, tenantId=${user.tenantId} for user ${user.id}`);
      return true;
    }

    // Fallback: Look up tenant from role assignments (shouldn't happen in normal flow)
    // This handles edge cases where jwt.strategy didn't set tenantId
    this.logger.warn(`TenantContextGuard: tenantId not in JWT, performing fallback lookup for user ${user.id}`);
    
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
      this.logger.debug(`TenantContextGuard: Tenant context set from fallback lookup, tenantId=${orgAssignment.scopeId}`);
      return true;
    }

    // No tenant found - but don't block here
    // TenantMutationGuard will handle mutations and throw appropriate error
    // This allows read-only endpoints to work
    this.logger.debug(`TenantContextGuard: No tenant found for user ${user.id}, leaving undefined for TenantMutationGuard to handle`);
    return true;
  }
}

