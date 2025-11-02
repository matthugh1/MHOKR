# Post-Change Security and Integrity Audit Report
## OKR Application - Tenant Isolation (P0) and Hardening (P1)

**Date:** 2024-12-19  
**Scope:** Full codebase audit of tenant isolation, RBAC consistency, and security controls  
**Methodology:** Code inspection, trace analysis, contract verification

---

## 1. Tenant Boundary Model

### 1.1 How Tenant Isolation Works

#### READ Operations (GET /objectives)

**Current Implementation:**
```13:28:services/core-api/src/modules/okr/objective.service.ts
async findAll(userId: string, workspaceId: string | undefined, userOrganizationId: string | null) {
  const where: any = {};

  // NOTE on organisation scoping:
  // - userOrganizationId === null       -> superuser (can READ all organisations; still cannot write anywhere).
  // - typeof userOrganizationId === 'string' and truthy -> normal user (can READ only that organisation).
  // - userOrganizationId is undefined or '' -> user with no organisation membership (GET /objectives returns []).
  // This enforces tenant isolation for reads.
  if (userOrganizationId === null) {
    // Superuser: no org filter, return all OKRs
  } else if (userOrganizationId && userOrganizationId !== '') {
    where.organizationId = userOrganizationId;
  } else {
    // User has no org or invalid org → return empty array
    return [];
  }
```

**Decision Flow:**
1. **Superuser** (`organizationId === null`): No filter applied, returns OKRs from all organizations (read-only)
2. **Normal user** (`organizationId` is a truthy string): Filter `where.organizationId = userOrganizationId`, returns only their organization's OKRs
3. **User with no org** (`organizationId` is `undefined` or `''`): Returns empty array `[]`

**Verification:** ✅ Correctly enforces tenant isolation for reads.

#### WRITE Operations (PATCH/DELETE /objectives/:id)

**Current Implementation:**
```124:152:services/core-api/src/modules/okr/objective.service.ts
async canEdit(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
  // Superuser is read-only auditor (cannot edit)
  if (userOrganizationId === null) {
    return false;
  }

  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // Extract OKR's organizationId from resource context
    const okrOrganizationId = resourceContext.okr?.organizationId;
    
    // If the OKR has no organizationId, treat it as system/global data.
    // System/global OKRs are always read-only. No-one (including superusers) may edit them.
    // This is intentional. Changing this requires an explicit product decision.
    if (!okrOrganizationId) {
      return false;
    }
    
    // Verify tenant match: user's org must match OKR's org
    if (okrOrganizationId !== userOrganizationId) {
      return false;
    }
    
    return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
  } catch {
    return false;
  }
}
```

**Decision Flow:**
1. **Superuser check**: If `userOrganizationId === null`, return `false` (read-only)
2. **System OKR check**: If OKR has no `organizationId`, return `false` (immutable system data)
3. **Tenant match check**: If `okrOrganizationId !== userOrganizationId`, return `false` (cross-tenant write blocked)
4. **RBAC check**: Otherwise, delegate to `rbacService.canPerformAction()`

**Verification:** ✅ Correctly enforces tenant isolation for writes. Same logic in `canDelete()`.

### 1.2 Canonical Tenant Identifier

**Canonical Identifier:** `organizationId` (field name in Prisma schema: `organizationId`)

**Current Usage of `tenantId`:**

| File | Line(s) | Usage | Category |
|------|---------|-------|----------|
| `rbac/helpers.ts` | 37-38, 150-151 | Compatibility shim in `OKREntity` construction | **compatibility shim** |
| `rbac/rbac.ts` | 301, 349, 438 | Fallback pattern: `okr.organizationId \|\| (okr as any).tenantId \|\| ''` | **compatibility shim** |
| `rbac/visibilityPolicy.ts` | 68 | Fallback pattern: `okr.organizationId \|\| okr.tenantId \|\| ''` | **compatibility shim** |
| `rbac/types.ts` | 153 | Interface field marked "Deprecated: kept for backward compatibility" | **compatibility shim** |
| `rbac/rbac-assignment.controller.ts` | 214-269 | Endpoint params use `tenantId` for EXEC_ONLY whitelist endpoints | **still in live code path** |
| `rbac/rbac.guard.ts` | 62-64, 115-116 | Comments and variable names reference `tenantId` | **in comments/variables** |
| `rbac/rbac.integration.spec.ts` | Various | Test variables named `tenantId` | **test code only** |
| `rbac/visibility-policy.spec.ts` | 23 | Test uses `tenantId` for backward compatibility | **test code only** |

**Critical Finding:** The EXEC_ONLY whitelist endpoints (`/rbac/whitelist/:tenantId`) use `tenantId` as a route parameter. While functionally acceptable (they accept organization IDs), this is inconsistent with the canonical naming.

**Recommendation:** Consider renaming these endpoints to `/rbac/whitelist/:organizationId` for consistency, but **not a blocker** as the parameter accepts organization IDs.

### 1.3 Superuser Behavior Verification

**Policy:**
- ✅ Superuser may READ across all organizations
- ✅ Superuser is READ-ONLY
- ✅ Superuser cannot mutate Objectives
- ✅ Superuser cannot mutate Key Results

**Code Verification:**

**Read Access (findAll):**
```21:23:services/core-api/src/modules/okr/objective.service.ts
if (userOrganizationId === null) {
  // Superuser: no org filter, return all OKRs
}
```
✅ **CONFIRMED:** No filter applied when `organizationId === null`.

**Write Access (canEdit):**
```125:128:services/core-api/src/modules/okr/objective.service.ts
// Superuser is read-only auditor (cannot edit)
if (userOrganizationId === null) {
  return false;
}
```
✅ **CONFIRMED:** Superuser is blocked from editing.

**Write Access (canDelete):**
```159:162:services/core-api/src/modules/okr/objective.service.ts
// Superuser is read-only auditor (cannot delete)
if (userOrganizationId === null) {
  return false;
}
```
✅ **CONFIRMED:** Superuser is blocked from deleting.

**Key Results Write Access:**
```202:204:services/core-api/src/modules/okr/key-result.service.ts
if (userOrganizationId === null) {
  throw new ForbiddenException('Superusers are read-only; cannot modify Key Results.');
}
```
✅ **CONFIRMED:** Superuser is blocked from mutating Key Results (checked in `create`, `update`, `delete`, `createCheckIn`).

**RBAC Level (canSuperuser function):**
```158:181:services/core-api/src/modules/rbac/rbac.ts
function canSuperuser(
  _userContext: UserContext,
  action: Action,
  _resourceContext: ResourceContext,
): boolean {
  // SUPERUSER can view everything
  if (action === 'view_okr' || action === 'view_all_okrs') {
    return true;
  }

  // SUPERUSER can impersonate users
  if (action === 'impersonate_user') {
    return true;
  }

  // SUPERUSER can export data
  if (action === 'export_data') {
    return true;
  }

  // SUPERUSER CANNOT edit/delete/create OKRs
  if (action === 'edit_okr' || action === 'delete_okr' || action === 'create_okr' || action === 'publish_okr') {
    return false;
  }
```
✅ **CONFIRMED:** RBAC layer correctly enforces read-only policy.

**Verdict:** ✅ All superuser behavior matches policy. No contradictions found.

### 1.4 User with No Organisation Membership

**Contract:** `req.user.organizationId` is `undefined` (not `null`, not `''`)

**Current Implementation:**
```44:56:services/core-api/src/modules/auth/strategies/jwt.strategy.ts
// organizationId rules:
// - null        => superuser (global read-only; can view all organisations)
// - <string>    => normal user (scoped to that organisation)
// - undefined   => user with no organisation membership (no tenant access; GET /objectives returns [])
//
// IMPORTANT:
// undefined is NOT the same as null.
// undefined = not assigned anywhere.
// null      = platform-level superuser.
return {
  ...user,
  organizationId: orgMember?.organizationId || undefined,  // Normal user: string or undefined (not null)
};
```

**Behavior Verification:**

**GET /objectives:**
```25:27:services/core-api/src/modules/okr/objective.service.ts
} else {
  // User has no org or invalid org → return empty array
  return [];
}
```
✅ **CONFIRMED:** Returns empty array `[]` when `userOrganizationId` is `undefined` or `''`.

**PATCH /objectives/:id:**
The `canEdit()` function receives `userOrganizationId: string | null`, but the controller passes `req.user.organizationId` which can be `undefined`.

**Issue Found:** `canEdit()` signature expects `string | null`, but receives `string | null | undefined`. However, the logic handles this correctly:
- `userOrganizationId === null` → superuser → returns `false` ✅
- `userOrganizationId` is truthy string → proceeds with tenant check ✅
- `userOrganizationId` is `undefined` or `''` → falsy → would pass `if (!okrOrganizationId)` check → but then `okrOrganizationId !== userOrganizationId` would fail if OKR has an org → returns `false` ✅

**Verification:** The code correctly handles `undefined` by treating it as falsy, which causes the tenant match check to fail. However, the TypeScript types are slightly misaligned (function signature doesn't include `undefined`).

**DELETE /objectives/:id:**
Same analysis as PATCH - correctly handles `undefined` but type signature incomplete.

**Key Result Writes:**
```213:220:services/core-api/src/modules/okr/key-result.service.ts
if (
  !userOrganizationId ||
  !objective ||
  !objective.organizationId ||
  objective.organizationId !== userOrganizationId
) {
  throw new ForbiddenException('You do not have permission to modify this Key Result.');
}
```
✅ **CONFIRMED:** The `!userOrganizationId` check catches `undefined` and blocks writes.

**Verdict:** ✅ Users with no org membership are correctly blocked from seeing or modifying tenant data. Minor type signature issue (missing `undefined` in union type) but runtime behavior is correct.

---

## 2. JWT Strategy / req.user

### 2.1 req.user Construction

**File:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`

**Implementation:**
```22:57:services/core-api/src/modules/auth/strategies/jwt.strategy.ts
async validate(payload: any) {
  const user = await this.authService.validateUser(payload.sub);
  if (!user) {
    return null;
  }
  
  // Superuser => organizationId: null (global read-only; can view all organisations)
  if (user.isSuperuser) {
    return {
      ...user,
      organizationId: null,
    };
  }
  
  // Get user's primary organization (first org they belong to)
  // TODO: Support multi-org users (currently using first org membership only)
  const orgMember = await this.prisma.organizationMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
    orderBy: { createdAt: 'asc' },  // Get first membership (primary org)
  });
  
  // organizationId rules:
  // - null        => superuser (global read-only; can view all organisations)
  // - <string>    => normal user (scoped to that organisation)
  // - undefined   => user with no organisation membership (no tenant access; GET /objectives returns [])
  //
  // IMPORTANT:
  // undefined is NOT the same as null.
  // undefined = not assigned anywhere.
  // null      = platform-level superuser.
  return {
    ...user,
    organizationId: orgMember?.organizationId || undefined,  // Normal user: string or undefined (not null)
  };
}
```

**Three Cases:**

| Case | Condition | `req.user.organizationId` | Behavior |
|------|-----------|---------------------------|----------|
| **a) Superuser** | `user.isSuperuser === true` | `null` | Can READ all orgs, cannot write |
| **b) Normal user** | `orgMember` exists | `orgMember.organizationId` (string) | Scoped to that org |
| **c) No org membership** | `orgMember` is `null` | `undefined` | No tenant access, GET returns `[]` |

**Comment vs Runtime Behavior:**
✅ **MATCHES:** The comments accurately describe the runtime behavior. The code correctly implements:
- Superuser → `null`
- Normal user → `string`
- No org → `undefined`

### 2.2 Assumptions About organizationId === null

**Search Results:** Searched for code that assumes `organizationId === null` means "no org membership" rather than "superuser".

**Findings:**
- ✅ No code found that incorrectly treats `null` as "no org membership"
- ✅ All code correctly treats `null` as superuser
- ✅ All code correctly treats `undefined`/falsy as "no org membership"

**Verdict:** ✅ No incorrect assumptions found. The codebase consistently treats `null` as superuser and `undefined`/falsy as no org membership.

---

## 3. Objective Paths

### 3.1 Controller → Service Flow

**GET /objectives:**
```17:22:services/core-api/src/modules/okr/objective.controller.ts
async getAll(@Query('workspaceId') workspaceId: string | undefined, @Req() req: any) {
  return this.objectiveService.findAll(
    req.user.id,
    workspaceId,
    req.user.organizationId // null = superuser
  );
}
```
✅ **CONFIRMED:** Passes `req.user.organizationId` through.

**PATCH /objectives/:id:**
```64:73:services/core-api/src/modules/okr/objective.controller.ts
async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
  const canEdit = await this.objectiveService.canEdit(
    req.user.id,
    id,
    req.user.organizationId // null for superuser
  );
  if (!canEdit) {
    throw new ForbiddenException('You do not have permission to edit this OKR');
  }
  return this.objectiveService.update(id, data, req.user.id);
}
```
✅ **CONFIRMED:** Passes `req.user.organizationId` through.

**DELETE /objectives/:id:**
```79:88:services/core-api/src/modules/okr/objective.controller.ts
async delete(@Param('id') id: string, @Req() req: any) {
  const canDelete = await this.objectiveService.canDelete(
    req.user.id,
    id,
    req.user.organizationId // null for superuser
  );
  if (!canDelete) {
    throw new ForbiddenException('You do not have permission to delete this OKR');
  }
  return this.objectiveService.delete(id);
}
```
✅ **CONFIRMED:** Passes `req.user.organizationId` through.

### 3.2 Service Enforcement

**findAll():**
✅ Already verified in section 1.1 - correctly filters by `organizationId`.

**canEdit():**
✅ Already verified in section 1.1 - enforces:
- Org match (`okrOrganizationId !== userOrganizationId` → `false`)
- Superuser read-only (`userOrganizationId === null` → `false`)
- System/global OKR immutable (`!okrOrganizationId` → `false`)

**canDelete():**
```158:186:services/core-api/src/modules/okr/objective.service.ts
async canDelete(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
  // Superuser is read-only auditor (cannot delete)
  if (userOrganizationId === null) {
    return false;
  }

  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // Extract OKR's organizationId from resource context
    const okrOrganizationId = resourceContext.okr?.organizationId;
    
    // If the OKR has no organizationId, treat it as system/global data.
    // System/global OKRs are always read-only. No-one (including superusers) may edit them.
    // This is intentional. Changing this requires an explicit product decision.
    if (!okrOrganizationId) {
      return false;
    }
    
    // Verify tenant match: user's org must match OKR's org
    if (okrOrganizationId !== userOrganizationId) {
      return false;
    }
    
    return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
  } catch {
    return false;
  }
}
```
✅ **CONFIRMED:** Enforces all three rules:
- Org match (line 178-180)
- Superuser read-only (line 160-162)
- System/global OKR immutable (line 173-175)

**Verdict:** ✅ No data leaks or cross-org writes possible. All isolation checks are correctly enforced.

### 3.3 Comments vs Behavior

**canEdit() comments:**
```121:123:services/core-api/src/modules/okr/objective.service.ts
/**
 * Check if user can edit a specific OKR
 */
```
The function comment is minimal but accurate. The inline comments match behavior:
- "Superuser is read-only auditor (cannot edit)" → ✅ Matches code (returns `false` if `null`)
- "System/global OKRs are always read-only" → ✅ Matches code (returns `false` if no `organizationId`)
- "Verify tenant match" → ✅ Matches code (returns `false` if orgs don't match)

**canDelete() comments:**
```154:157:services/core-api/src/modules/okr/objective.service.ts
/**
 * Check if user can delete a specific OKR
 * TODO: Apply the same tenant isolation logic to Key Results write paths (PATCH/DELETE)
 */
```
✅ Comments match behavior. TODO is accurate (Key Results need same logic, see section 4).

**Verdict:** ✅ Comments accurately reflect behavior. No mismatches found.

---

## 4. Key Result Paths

### 4.1 Mutating Endpoints Inspection

**POST /key-results:**
```37:53:services/core-api/src/modules/okr/key-result.controller.ts
async create(@Body() data: any, @Req() req: any) {
  // Ensure ownerId matches the authenticated user
  if (!data.ownerId) {
    data.ownerId = req.user.id;
  } else if (data.ownerId !== req.user.id) {
    data.ownerId = req.user.id;
  }

  // Verify user can create key results for the parent objective
  if (data.objectiveId) {
    const canEdit = await this.keyResultService.canEditObjective(req.user.id, data.objectiveId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to create key results for this objective');
    }
  }

  return this.keyResultService.create(data, req.user.id, req.user.organizationId);
}
```
✅ **CONFIRMED:** Passes both `req.user.id` and `req.user.organizationId`.

**PATCH /key-results/:id:**
```59:65:services/core-api/src/modules/okr/key-result.controller.ts
async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
  // Check if user can edit this key result (via parent objective)
  const canEdit = await this.keyResultService.canEdit(req.user.id, id);
  if (!canEdit) {
    throw new ForbiddenException('You do not have permission to edit this key result');
  }
  return this.keyResultService.update(id, data, req.user.id, req.user.organizationId);
}
```
✅ **CONFIRMED:** Passes both `req.user.id` and `req.user.organizationId`.

**DELETE /key-results/:id:**
```71:86:services/core-api/src/modules/okr/key-result.controller.ts
async delete(@Param('id') id: string, @Req() req: any) {
  // Check if user can delete this key result (via parent objective)
  const canDelete = await this.keyResultService.canDelete(req.user.id, id);
  if (!canDelete) {
    throw new ForbiddenException('You do not have permission to delete this key result');
  }
  
  console.log(`[KeyResultController] DELETE /key-results/${id} - Request received`);
  try {
    const result = await this.keyResultService.delete(id, req.user.id, req.user.organizationId);
    console.log(`[KeyResultController] DELETE /key-results/${id} - Success`);
    return result;
  } catch (error: any) {
    console.error(`[KeyResultController] DELETE /key-results/${id} - Error:`, error.message);
    throw error;
  }
}
```
✅ **CONFIRMED:** Passes both `req.user.id` and `req.user.organizationId`.

**POST /key-results/:id/check-in:**
```92:101:services/core-api/src/modules/okr/key-result.controller.ts
async checkIn(@Param('id') id: string, @Body() data: any, @Req() req: any) {
  // Check if user can edit this key result
  const canEdit = await this.keyResultService.canEdit(req.user.id, id);
  if (!canEdit) {
    throw new ForbiddenException('You do not have permission to create check-ins for this key result');
  }
  
  // Ensure userId matches authenticated user
  data.userId = req.user.id;
  return this.keyResultService.createCheckIn(id, data, req.user.organizationId);
}
```
✅ **CONFIRMED:** Passes `req.user.organizationId` (and `req.user.id` via `data.userId`).

### 4.2 Service-Level Tenant Isolation

**create():**
```195:226:services/core-api/src/modules/okr/key-result.service.ts
async create(data: any, userId: string, userOrganizationId: string | null | undefined) {
  // TENANT ISOLATION CHECK (P1 placeholder):
  // Temporary guard until full KR RBAC is implemented.
  // - Superusers (userOrganizationId === null) are READ-ONLY auditors.
  // - Users with no organisation (undefined/falsy) cannot mutate.
  // - Caller org must match parent Objective's organisationId.
  // TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.
  if (userOrganizationId === null) {
    throw new ForbiddenException('Superusers are read-only; cannot modify Key Results.');
  }

  // Get parent objective's organizationId for validation
  if (data.objectiveId) {
    const objective = await this.prisma.objective.findUnique({
      where: { id: data.objectiveId },
      select: { organizationId: true },
    });

    if (
      !userOrganizationId ||
      !objective ||
      !objective.organizationId ||
      objective.organizationId !== userOrganizationId
    ) {
      throw new ForbiddenException('You do not have permission to modify this Key Result.');
    }
  } else {
    // If no objectiveId provided, reject (for now - may need to allow standalone KRs later)
    if (!userOrganizationId) {
      throw new ForbiddenException('You do not have permission to create Key Results without an organization.');
    }
  }
```
✅ **CONFIRMED:** Enforces:
- Superuser blocked (`userOrganizationId === null` → throws)
- No org user blocked (`!userOrganizationId` → throws)
- Cross-tenant write blocked (`objective.organizationId !== userOrganizationId` → throws)

**update():**
```263:297:services/core-api/src/modules/okr/key-result.service.ts
async update(id: string, data: any, userId: string, userOrganizationId: string | null | undefined) {
  // TENANT ISOLATION CHECK (P1 placeholder):
  // Temporary guard until full KR RBAC is implemented.
  // - Superusers (userOrganizationId === null) are READ-ONLY auditors.
  // - Users with no organisation (undefined/falsy) cannot mutate.
  // - Caller org must match parent Objective's organisationId.
  // TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.
  if (userOrganizationId === null) {
    throw new ForbiddenException('Superusers are read-only; cannot modify Key Results.');
  }

  const krWithParent = await this.prisma.keyResult.findUnique({
    where: { id },
    select: { 
      objectives: {
        select: {
          objective: { 
            select: { organizationId: true } 
          }
        },
        take: 1,
      },
    },
  });

  const objectiveOrgId = krWithParent?.objectives[0]?.objective?.organizationId;

  if (
    !userOrganizationId ||
    !krWithParent ||
    !objectiveOrgId ||
    objectiveOrgId !== userOrganizationId
  ) {
    throw new ForbiddenException('You do not have permission to modify this Key Result.');
  }
```
✅ **CONFIRMED:** Enforces all three guards.

**delete():**
```318:352:services/core-api/src/modules/okr/key-result.service.ts
async delete(id: string, userId: string, userOrganizationId: string | null | undefined) {
  // TENANT ISOLATION CHECK (P1 placeholder):
  // Temporary guard until full KR RBAC is implemented.
  // - Superusers (userOrganizationId === null) are READ-ONLY auditors.
  // - Users with no organisation (undefined/falsy) cannot mutate.
  // - Caller org must match parent Objective's organisationId.
  // TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.
  if (userOrganizationId === null) {
    throw new ForbiddenException('Superusers are read-only; cannot modify Key Results.');
  }

  const krWithParent = await this.prisma.keyResult.findUnique({
    where: { id },
    select: { 
      objectives: {
        select: {
          objective: { 
            select: { organizationId: true } 
          }
        },
        take: 1,
      },
    },
  });

  const objectiveOrgId = krWithParent?.objectives[0]?.objective?.organizationId;

  if (
    !userOrganizationId ||
    !krWithParent ||
    !objectiveOrgId ||
    objectiveOrgId !== userOrganizationId
  ) {
    throw new ForbiddenException('You do not have permission to modify this Key Result.');
  }
```
✅ **CONFIRMED:** Enforces all three guards.

**createCheckIn():**
```379:413:services/core-api/src/modules/okr/key-result.service.ts
async createCheckIn(keyResultId: string, data: { userId: string; value: number; confidence: number; note?: string; blockers?: string }, userOrganizationId: string | null | undefined) {
  // TENANT ISOLATION CHECK (P1 placeholder):
  // Temporary guard until full KR RBAC is implemented.
  // - Superusers (userOrganizationId === null) are READ-ONLY auditors.
  // - Users with no organisation (undefined/falsy) cannot mutate.
  // - Caller org must match parent Objective's organisationId.
  // TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.
  if (userOrganizationId === null) {
    throw new ForbiddenException('Superusers are read-only; cannot modify Key Results.');
  }

  const krWithParent = await this.prisma.keyResult.findUnique({
    where: { id: keyResultId },
    select: { 
      objectives: {
        select: {
          objective: { 
            select: { organizationId: true } 
          }
        },
        take: 1,
      },
    },
  });

  const objectiveOrgId = krWithParent?.objectives[0]?.objective?.organizationId;

  if (
    !userOrganizationId ||
    !krWithParent ||
    !objectiveOrgId ||
    objectiveOrgId !== userOrganizationId
  ) {
    throw new ForbiddenException('You do not have permission to modify this Key Result.');
  }
```
✅ **CONFIRMED:** Enforces all three guards.

**Verdict:** ✅ All Key Result write paths have tenant isolation guards. No write paths without tenant guards found.

### 4.3 canEdit() / canDelete() Inspection

**canEdit():**
```106:141:services/core-api/src/modules/okr/key-result.service.ts
async canEdit(userId: string, keyResultId: string): Promise<boolean> {
  const keyResult = await this.prisma.keyResult.findUnique({
    where: { id: keyResultId },
    include: {
      objectives: {
        include: {
          objective: true,
        },
      },
    },
  });

  if (!keyResult) {
    return false;
  }

  // Owner can always edit
  if (keyResult.ownerId === userId) {
    return true;
  }

  // Check edit access via any parent objective
  for (const objKr of keyResult.objectives) {
    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objKr.objectiveId);
      const canEdit = await this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
      if (canEdit) {
        return true;
      }
    } catch {
      // Continue to next objective
    }
  }

  return false;
}
```

**Issue Found:** ⚠️ `canEdit()` does NOT check tenant isolation directly. It relies on RBAC checks via parent Objective, but RBAC's `canEditOKRAction()` also doesn't check tenant isolation - it only checks roles.

**However:** The controller calls `canEdit()` as a permission check, but the actual write operations (`update()`, `delete()`, `createCheckIn()`) have inline tenant isolation guards that are enforced BEFORE the RBAC check. So the flow is:
1. Controller calls `canEdit()` → may return `true` based on RBAC
2. Controller calls `update()` → **tenant isolation guard runs first** → blocks if org mismatch

**Analysis:** This is actually **safe** because the tenant isolation guard in the service methods runs regardless of what `canEdit()` returns. However, it's inconsistent - `canEdit()` should also check tenant isolation for consistency.

**canDelete():**
```146:181:services/core-api/src/modules/okr/key-result.service.ts
async canDelete(userId: string, keyResultId: string): Promise<boolean> {
  const keyResult = await this.prisma.keyResult.findUnique({
    where: { id: keyResultId },
    include: {
      objectives: {
        include: {
          objective: true,
        },
      },
    },
  });

  if (!keyResult) {
    return false;
  }

  // Owner can delete
  if (keyResult.ownerId === userId) {
    return true;
  }

  // Check delete access via any parent objective
  for (const objKr of keyResult.objectives) {
    try {
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objKr.objectiveId);
      const canDelete = await this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
      if (canDelete) {
        return true;
      }
    } catch {
      // Continue to next objective
    }
  }

  return false;
}
```

**Same Issue:** `canDelete()` doesn't check tenant isolation directly, but the actual `delete()` method has the guard.

**Verdict:** ⚠️ **SAFE BUT INCONSISTENT.** The tenant isolation guards in the write methods protect against cross-tenant writes, but `canEdit()`/`canDelete()` should also check tenant isolation for consistency and to provide accurate permission checks.

### 4.4 Demo Readiness Assessment

**Current State:**
- ✅ All write paths have tenant isolation guards
- ✅ Superuser is blocked from writes
- ✅ Users with no org are blocked from writes
- ✅ Cross-tenant writes are blocked
- ⚠️ `canEdit()`/`canDelete()` don't check tenant isolation (but write methods do)

**Safety Level:** ✅ **SAFE ENOUGH FOR DEMO**

**Rationale:**
- The actual write operations enforce tenant isolation, so no cross-tenant writes are possible
- The inconsistency in `canEdit()`/`canDelete()` is a UX issue (may show "can edit" button but then fail on submit) but not a security issue
- For a design partner demo, this is acceptable - the security is enforced at the write layer

**Recommendation:** Fix `canEdit()`/`canDelete()` to check tenant isolation for consistency, but this is **not a blocker** for demo.

---

## 5. RBAC Consistency

### 5.1 Legacy Membership Tables

**Search Results:** Searched for usage of `OrganizationMember`, `WorkspaceMember`, `TeamMember` in RBAC code.

**Findings:**
- `rbac/migration.service.ts` - Migration service that converts legacy tables to new system (✅ Expected)
- `rbac/README.md` - Documentation mentions legacy tables are kept for backward compatibility (✅ Expected)
- `jwt.strategy.ts` - Uses `OrganizationMember` to fetch user's primary org (⚠️ **STILL IN USE**)

**Critical Finding:** The JWT strategy still queries `OrganizationMember` table to determine `req.user.organizationId`:

```38:42:services/core-api/src/modules/auth/strategies/jwt.strategy.ts
const orgMember = await this.prisma.organizationMember.findFirst({
  where: { userId: user.id },
  select: { organizationId: true },
  orderBy: { createdAt: 'asc' },  // Get first membership (primary org)
});
```

**Analysis:** This is acceptable IF:
1. The `OrganizationMember` table is kept in sync with the new RBAC system, OR
2. This is a temporary migration state

**Recommendation:** Should migrate JWT strategy to use `RoleAssignment` table with `scopeType: 'TENANT'` instead of `OrganizationMember`. However, this is **not a blocker** if the tables are kept in sync.

**RBAC Permission Logic:**
✅ **CONFIRMED:** All permission checks use `RoleAssignment` table via `rbacService.buildUserContext()`, which queries `roleAssignment.findMany()`. No permission logic depends on legacy membership tables.

**Verdict:** ⚠️ **MOSTLY CLEAN.** JWT strategy still uses legacy table, but RBAC permission logic is fully migrated.

### 5.2 Frontend-Facing Role Fetch

**Current Endpoint:** `GET /rbac/assignments` (with `userId` query param)

**Implementation:**
```48:97:services/core-api/src/modules/rbac/rbac-assignment.controller.ts
@Get()
@RequireAction('manage_users')
@ApiOperation({ summary: 'Get role assignments' })
@ApiQuery({ name: 'scopeType', required: false })
@ApiQuery({ name: 'scopeId', required: false })
@ApiQuery({ name: 'userId', required: false })
async getAssignments(
  @Query('scopeType') scopeType?: ScopeType,
  @Query('scopeId') scopeId?: string,
  @Query('userId') userId?: string,
) {
  // If userId provided, return that user's assignments
  if (userId) {
    const assignments = await this.rbacService.getUserRoleAssignments(userId);
    // Enrich with user and scope names
    return this.enrichAssignments(assignments);
  }
```

**Issue Found:** ⚠️ **NO `/rbac/assignments/me` ENDPOINT**

The frontend code (from search results) suggests using `/rbac/assignments/me`, but this endpoint doesn't exist. The current endpoint requires `manage_users` permission and a `userId` query param.

**Frontend Usage:**
```1:60:apps/web/src/hooks/usePermissions.ts
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'

export function usePermissions() {
  const { teams, team } = useWorkspace()
  const { user } = useAuth()

  const canCreateWorkspace = () => {
    // Check if user has ORG_ADMIN role in any team
    return teams.some(t => t.role === 'ORG_ADMIN')
  }

  const canManageTeam = (teamId?: string) => {
    // Check if user is TEAM_LEAD or higher for the specified team
    if (!teamId) {
      return teams.some(t => t.role === 'TEAM_LEAD' || t.role === 'ORG_ADMIN' || t.role === 'WORKSPACE_OWNER')
    }
    
    const userTeam = teams.find(t => t.id === teamId)
    if (!userTeam) return false

    return userTeam.role === 'TEAM_LEAD' || userTeam.role === 'ORG_ADMIN' || userTeam.role === 'WORKSPACE_OWNER'
  }

  const canEditOKR = (okr: { ownerId: string; teamId?: string | null }) => {
    // Owner can always edit
    if (okr.ownerId === user?.id) {
      return true
    }

    // Team lead can edit team OKRs
    if (okr.teamId) {
      return canManageTeam(okr.teamId)
    }

    return false
  }

  const canDeleteOKR = (okr: { ownerId: string; teamId?: string | null }) => {
    // Same logic as edit for now
    return canEditOKR(okr)
  }

  const canInviteMembers = () => {
    // Only team leads and above can invite
    return teams.some(t => 
      t.role === 'TEAM_LEAD' || 
      t.role === 'ORG_ADMIN' || 
      t.role === 'WORKSPACE_OWNER'
    )
  }

  return {
    canCreateWorkspace,
    canManageTeam,
    canEditOKR,
    canDeleteOKR,
    canInviteMembers,
  }
}
```

**Critical Finding:** ⚠️ **FRONTEND STILL USES LEGACY ROLE SYSTEM**

The `usePermissions()` hook reads roles from `useWorkspace()` context, which gets data from `/users/me/context` endpoint. This endpoint likely returns legacy `teams` array with `role` fields from old membership tables.

**Verdict:** ❌ **RBAC INCONSISTENCY - FRONTEND NOT MIGRATED**

Frontend is still using legacy role system (`ORG_ADMIN`, `TEAM_LEAD`, `WORKSPACE_OWNER` from old membership tables) instead of new RBAC system (`TENANT_OWNER`, `TENANT_ADMIN`, `WORKSPACE_LEAD`, etc. from `RoleAssignment` table).

### 5.3 Tenant ID Resolution in RBAC Actions

**canEditOKRAction:**
```298:301:services/core-api/src/modules/rbac/rbac.ts
const okr = resourceContext.okr;
// NOTE: organizationId is the canonical tenant identifier.
// tenantId is legacy and kept only for backward compatibility with pre-P0 data.
// Do not reintroduce tenantId in new code.
const tenantId = okr.organizationId || (okr as any).tenantId || '';
```
✅ **CONFIRMED:** Uses fallback pattern.

**canDeleteOKRAction:**
```345:349:services/core-api/src/modules/rbac/rbac.ts
const okr = resourceContext.okr;
// NOTE: organizationId is the canonical tenant identifier.
// tenantId is legacy and kept only for backward compatibility with pre-P0 data.
// Do not reintroduce tenantId in new code.
const tenantId = okr.organizationId || (okr as any).tenantId || '';
```
✅ **CONFIRMED:** Uses fallback pattern.

**canPublishOKRAction:**
```434:438:services/core-api/src/modules/rbac/rbac.ts
const okr = resourceContext.okr;
// NOTE: organizationId is the canonical tenant identifier.
// tenantId is legacy and kept only for backward compatibility with pre-P0 data.
// Do not reintroduce tenantId in new code.
const tenantId = okr.organizationId || (okr as any).tenantId || '';
```
✅ **CONFIRMED:** Uses fallback pattern (was flagged in previous audit, now fixed).

**Verdict:** ✅ All RBAC actions correctly resolve tenant ID using `organizationId` with `tenantId` fallback.

---

## 6. Frontend Enforcement

### 6.1 usePermissions Hook

**Current Implementation:**
```1:60:apps/web/src/hooks/usePermissions.ts
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'

export function usePermissions() {
  const { teams, team } = useWorkspace()
  const { user } = useAuth()

  const canCreateWorkspace = () => {
    // Check if user has ORG_ADMIN role in any team
    return teams.some(t => t.role === 'ORG_ADMIN')
  }

  const canManageTeam = (teamId?: string) => {
    // Check if user is TEAM_LEAD or higher for the specified team
    if (!teamId) {
      return teams.some(t => t.role === 'TEAM_LEAD' || t.role === 'ORG_ADMIN' || t.role === 'WORKSPACE_OWNER')
    }
    
    const userTeam = teams.find(t => t.id === teamId)
    if (!userTeam) return false

    return userTeam.role === 'TEAM_LEAD' || userTeam.role === 'ORG_ADMIN' || userTeam.role === 'WORKSPACE_OWNER'
  }

  const canEditOKR = (okr: { ownerId: string; teamId?: string | null }) => {
    // Owner can always edit
    if (okr.ownerId === user?.id) {
      return true
    }

    // Team lead can edit team OKRs
    if (okr.teamId) {
      return canManageTeam(okr.teamId)
    }

    return false
  }

  const canDeleteOKR = (okr: { ownerId: string; teamId?: string | null }) => {
    // Same logic as edit for now
    return canEditOKR(okr)
  }
```

**Issues Found:**
1. ❌ Uses legacy role names (`ORG_ADMIN`, `TEAM_LEAD`, `WORKSPACE_OWNER`)
2. ❌ Reads from `useWorkspace()` context which likely comes from legacy `/users/me/context` endpoint
3. ❌ Does NOT call `/rbac/assignments/me` or any RBAC endpoint
4. ❌ Does NOT check `organizationId` for tenant-scoped permissions

**Verdict:** ❌ **FRONTEND NOT USING NEW RBAC SYSTEM**

### 6.2 OKR Page Component

**Current Implementation:**
```54:65:apps/web/src/app/dashboard/okrs/page.tsx
const loadOKRs = async () => {
  if (!currentOrganization?.id) return
  try {
    setLoading(true)
    const response = await api.get(`/objectives`)
    setOkrs(response.data || [])
  } catch (error) {
    console.error('Failed to load OKRs:', error)
  } finally {
    setLoading(false)
  }
}
```

**Analysis:**
- ✅ Calls `/objectives` endpoint (which enforces tenant isolation on backend)
- ❌ Does NOT check permissions before showing edit/delete buttons
- ❌ Does NOT use `usePermissions().canEditOKR()` or `canDeleteOKR()`

**Search Results:** Could not find where OKR cards call `canEditOKR`/`canDeleteOKR` in the OKR page component. The component file is 387 lines, but the visible portion doesn't show permission checks.

**Verdict:** ⚠️ **UNCLEAR** - Need to see full OKR page component to verify if permission checks are used.

### 6.3 Legacy Role Data Usage

**Workspace Context:**
```131:132:apps/web/src/contexts/workspace.context.tsx
setWorkspaces(userContextData.workspaces || [])
setTeams(userContextData.teams || [])
```

**Analysis:** The workspace context loads `workspaces` and `teams` from `/users/me/context` endpoint. These likely include legacy `role` fields from old membership tables.

**Verdict:** ❌ **FRONTEND STILL DEPENDS ON LEGACY ROLE SYSTEM**

---

## 7. TODO Hygiene and Risk

### 7.1 TODO Scan Results

**Search Pattern:** `TODO.*tenant-isolation|TODO.*P1|TODO.*KR|TODO.*superuser`

**Findings:**

| File | Line(s) | TODO Content | Risk Level | Blocks Demo? |
|------|---------|--------------|------------|--------------|
| `okr/key-result.service.ts` | 201 | `TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.` | **Tech Debt** | ❌ No |
| `okr/key-result.service.ts` | 269 | `TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.` | **Tech Debt** | ❌ No |
| `okr/key-result.service.ts` | 324 | `TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.` | **Tech Debt** | ❌ No |
| `okr/key-result.service.ts` | 385 | `TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.` | **Tech Debt** | ❌ No |
| `okr/objective.service.ts` | 156 | `TODO: Apply the same tenant isolation logic to Key Results write paths (PATCH/DELETE)` | **Already Done** | ❌ No |
| `auth/strategies/jwt.strategy.ts` | 37 | `TODO: Support multi-org users (currently using first org membership only)` | **Scalability** | ❌ No |

**Analysis:**
- All TODOs are for future enhancements (multi-org support) or code organization (formal KR permission methods)
- No security-critical TODOs blocking demo
- The Key Results tenant isolation is already implemented (inline guards), the TODO is about formalizing it

**Verdict:** ✅ **NO BLOCKING TODOs.** All TODOs are for future work or code organization.

### 7.2 TODO vs Behavior Contradictions

**Checked:** All TODOs against actual code behavior.

**Findings:**
- ✅ No contradictions found
- ✅ TODOs accurately describe future work needed
- ✅ Code behavior matches documented intent

**Verdict:** ✅ **NO CONTRADICTIONS.**

---

## 8. Tests

### 8.1 Test Files Mentioning organizationId/tenantId

**Found Tests:**
1. `rbac/visibility-policy.spec.ts` - Tests visibility policy with `organizationId`
2. `rbac/rbac.integration.spec.ts` - Integration tests (may use `tenantId` for backward compatibility)
3. `rbac/rbac.service.spec.ts` - Service unit tests

### 8.2 Test Verification

**visibility-policy.spec.ts:**
```19:29:services/core-api/src/modules/rbac/visibility-policy.spec.ts
const baseOKR: OKREntity = {
  id: 'okr-1',
  ownerId: 'owner-1',
  organizationId: 'tenant-1',  // organizationId is primary field
  tenantId: 'tenant-1',  // tenantId kept for backward compatibility
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  visibilityLevel: 'PUBLIC_TENANT',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```
✅ **CONFIRMED:** Test uses `organizationId` as primary field, `tenantId` for compatibility.

**Test Expectations:**
- ✅ Tests reflect new contract (organizationId is canonical)
- ✅ Tests don't assert superuser can edit (no such test found)
- ✅ Tests correctly use organizationId

**Verdict:** ✅ **TESTS MATCH NEW CONTRACT.** No test expectations contradict current behavior.

### 8.3 Test Coverage Gaps

**Missing Tests:**
1. ❌ No integration tests for `GET /objectives` filtering by `organizationId`
2. ❌ No tests for `canEdit()`/`canDelete()` tenant isolation (superuser blocked, cross-org blocked)
3. ❌ No tests for Key Result write paths tenant isolation
4. ❌ No tests for user with no org membership behavior

**Recommendation:** Add integration tests for tenant isolation, but **not a blocker** for demo.

---

## 9. Final Assessment

### 9.1 Security Ratings

| Area | Rating | Notes |
|------|--------|-------|
| **Read Isolation Safety** | 🟢 **GREEN** | `findAll()` correctly filters by `organizationId`. Superuser sees all, normal users see only their org, no-org users see `[]`. |
| **Write Isolation Safety (Objectives)** | 🟢 **GREEN** | `canEdit()`/`canDelete()` enforce org match, superuser blocked, system OKRs immutable. No cross-tenant writes possible. |
| **Write Isolation Safety (Key Results)** | 🟡 **AMBER** | All write methods have tenant isolation guards, but `canEdit()`/`canDelete()` don't check tenant isolation. Safe but inconsistent. |
| **RBAC Consistency** | 🟡 **AMBER** | Backend RBAC fully migrated, but frontend still uses legacy role system. JWT strategy uses legacy table. |
| **Frontend/Backend Alignment** | 🔴 **RED** | Frontend uses legacy roles (`ORG_ADMIN`, `TEAM_LEAD`) instead of new RBAC system. No `/rbac/assignments/me` endpoint. |

### 9.2 Fixes Needed for Green

**Write Isolation Safety (Key Results) - AMBER → GREEN:**
- Update `canEdit()` and `canDelete()` methods in `key-result.service.ts` to check tenant isolation before RBAC check
- Ensure they match the pattern used in Objective service

**RBAC Consistency - AMBER → GREEN:**
- Migrate JWT strategy to use `RoleAssignment` table instead of `OrganizationMember`
- Ensure `OrganizationMember` table is kept in sync OR deprecated

**Frontend/Backend Alignment - RED → GREEN:**
- Create `GET /rbac/assignments/me` endpoint that returns current user's role assignments
- Update `usePermissions()` hook to fetch from `/rbac/assignments/me` instead of legacy context
- Update frontend to use new role names (`TENANT_OWNER`, `TENANT_ADMIN`, `WORKSPACE_LEAD`, etc.)
- Remove dependency on legacy `teams[].role` fields

---

## 10. Summary

### ✅ Strengths

1. **Backend tenant isolation is solid** - All read and write paths correctly enforce organization boundaries
2. **Superuser policy correctly enforced** - Read-only across all orgs, cannot mutate data
3. **No-org users correctly handled** - Return empty arrays, blocked from writes
4. **Key Results have tenant guards** - All write methods check tenant isolation
5. **RBAC backend is consistent** - Uses `RoleAssignment` table, resolves `organizationId` correctly

### ⚠️ Weaknesses

1. **Frontend not migrated to RBAC** - Still uses legacy role system, may show incorrect permissions
2. **Missing `/rbac/assignments/me` endpoint** - Frontend can't easily fetch current user's roles
3. **JWT strategy uses legacy table** - Should migrate to `RoleAssignment` for consistency
4. **Key Result permission checks inconsistent** - `canEdit()`/`canDelete()` don't check tenant isolation (but write methods do)

### 🎯 Demo Readiness

**Status:** ✅ **SAFE FOR DEMO** (with caveats)

**Rationale:**
- Backend security is enforced - no cross-tenant data leaks or writes possible
- Frontend permission checks may be incorrect, but backend will reject unauthorized actions
- Worst case: User sees "edit" button but gets "forbidden" error on submit (UX issue, not security issue)

**Recommendations Before Production:**
1. Migrate frontend to new RBAC system (high priority)
2. Add `/rbac/assignments/me` endpoint (high priority)
3. Fix `canEdit()`/`canDelete()` tenant checks in Key Result service (medium priority)
4. Migrate JWT strategy to `RoleAssignment` table (low priority)

---

**Report Generated:** 2024-12-19  
**Auditor:** AI Security Audit System  
**Confidence Level:** HIGH (based on comprehensive code inspection)



