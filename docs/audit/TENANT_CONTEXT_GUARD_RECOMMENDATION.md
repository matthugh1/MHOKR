# Long-term Solution: Move Tenant Context to Guard

## Recommendation: **Option 1 - Convert Middleware to Guard**

Move tenant context resolution from middleware to a guard that runs **after** JWT authentication.

---

## Why This Approach?

### ✅ Advantages

1. **Correct Execution Order**
   - Guards run **after** middleware
   - JWT guard sets `req.user` first
   - Tenant guard can reliably access `req.user.tenantId`

2. **No Token Refresh Required**
   - Works with existing tokens
   - No user disruption
   - Immediate deployment possible

3. **Better Security Model**
   - Tenant access can be revoked without waiting for token expiry
   - Database lookup ensures current tenant assignments
   - Supports multi-tenant users (can check all assignments)

4. **Cleaner Architecture**
   - Guards are designed for authorization logic
   - Clear separation: middleware = request processing, guards = authorization
   - Easier to test and reason about

5. **Flexibility**
   - Can still do database lookups if needed
   - Can handle complex scenarios (multi-tenant, role changes)
   - Can set tenant context for Prisma middleware

### ❌ Why Not Include tenantId in JWT Token?

1. **Token Staleness**
   - If user's tenant changes, token becomes stale until refresh
   - Requires token refresh mechanism
   - Users may need to re-login

2. **Security Concerns**
   - Tenant access can't be revoked without token expiry
   - Token becomes larger (minor concern)

3. **Multi-Tenant Complexity**
   - Which tenantId to include? Primary? All?
   - Token would need frequent updates

---

## Implementation Plan

### Step 1: Create TenantContextGuard

```typescript
// services/core-api/src/common/tenant/tenant-context.guard.ts
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Skip if already set (idempotent)
    if ((request as any).tenantId !== undefined) {
      return true;
    }

    // Get user from request (set by JWT guard)
    const user = (request as any).user;
    
    if (!user) {
      // No user = public endpoint, no tenant context needed
      return true;
    }

    // Superuser => tenantId: null
    if (user.isSuperuser || user.tenantId === null) {
      (request as any).tenantId = null;
      (request as any).isSuperuser = true;
      return true;
    }

    // Normal user => use tenantId from JWT (already set by jwt.strategy)
    if (user.tenantId) {
      (request as any).tenantId = user.tenantId;
      (request as any).isSuperuser = false;
      
      // Set tenant context for Prisma middleware
      withTenantContext(user.tenantId, () => {
        return true;
      });
      
      return true;
    }

    // Fallback: Look up tenant from role assignments (shouldn't happen)
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
      return true;
    }

    // No tenant found - but don't block (let TenantMutationGuard handle it)
    return true;
  }
}
```

### Step 2: Register Guard Globally (After JWT)

```typescript
// services/core-api/src/app.module.ts
providers: [
  // Order matters: TenantContextGuard runs after JWT guard
  {
    provide: APP_GUARD,
    useClass: TenantContextGuard,
  },
  {
    provide: APP_GUARD,
    useClass: TenantMutationGuard,
  },
],
```

### Step 3: Keep Middleware for Non-Authenticated Routes

```typescript
// Keep middleware for public endpoints that might need tenant context
// But make it optional/skip if user exists
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: any, next: NextFunction) {
    // Skip if user exists (guard will handle it)
    if ((req as any).user) {
      return next();
    }

    // Only handle public endpoints (headers, subdomain, etc.)
    // ... existing logic for non-authenticated routes
  }
}
```

### Step 4: Update TenantMutationGuard

```typescript
// Already fixed - uses req.user.tenantId as fallback
// Can simplify further once guard is in place
```

---

## Migration Path

1. **Phase 1**: Add guard alongside middleware (both run)
   - Guard sets tenant context for authenticated routes
   - Middleware handles public routes
   - No breaking changes

2. **Phase 2**: Remove middleware dependency on `req.user`
   - Middleware only handles headers/subdomain
   - Guard handles all authenticated routes

3. **Phase 3**: Cleanup
   - Remove middleware if not needed
   - Simplify guard logic

---

## Alternative: Hybrid Approach

Keep middleware but make it **idempotent**:

```typescript
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: any, next: NextFunction) {
    // Skip if already set by guard
    if ((request as any).tenantId !== undefined) {
      return next();
    }

    // Only set for non-authenticated routes
    // Authenticated routes handled by guard
  }
}
```

---

## Recommendation Summary

**Use Option 1 (Guard-based approach)** because:
- ✅ Correct execution order
- ✅ No token refresh needed
- ✅ Better security model
- ✅ Cleaner architecture
- ✅ More flexible

The guard approach aligns with NestJS best practices and solves the root cause rather than working around it.

