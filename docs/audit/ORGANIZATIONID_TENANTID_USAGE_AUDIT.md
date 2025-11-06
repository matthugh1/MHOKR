# OrganizationId vs TenantId Usage Audit

**Generated**: 2025-01-06  
**Purpose**: Identify places where both `organizationId` and `tenantId` are used unnecessarily

---

## Executive Summary

After reviewing the codebase, here are the findings:

### ✅ **Legitimate Uses** (Backward Compatibility)
- **Middleware/Guards**: Normalising `organizationId` → `tenantId` (expected)
- **DTO Pipes**: Accepting both for backward compatibility (expected)
- **Tests**: Verifying normalisation logic (expected)
- **Database Schema**: `organizationId` column names (cannot change)

### ⚠️ **Problematic Uses** (Should Consolidate)

1. **Policy Controller** - Sets both fields in same object (redundant)
2. **RBAC Types** - `OKREntity` interface has both fields (should be `tenantId` only)
3. **JWT Strategy** - Only sets `organizationId` (should also set `tenantId` alias)
4. **RBAC Guard** - Uses both in error messages (should use `tenantId` consistently)
5. **Authorisation Service** - Maps `tenantId` back to `organizationId` (should keep `tenantId`)

---

## Detailed Findings

### 1. Policy Controller (`services/core-api/src/policy/policy.controller.ts`)

**Location**: Lines 239-240, 167-168

**Problem**: Setting both `organizationId` and `tenantId` in the same object

```typescript
resourceContext.okr = {
  id: body.resource.keyResultId,
  ownerId: objective.ownerId,
  organizationId: tenantId,  // ❌ Redundant
  tenantId: tenantId,         // ✅ Should be only this
  // ...
};
```

**Recommendation**: Remove `organizationId` field, keep only `tenantId`

**Impact**: Low - only affects internal resource context objects

---

### 2. RBAC Types (`services/core-api/src/modules/rbac/types.ts`)

**Location**: Lines 169-170

**Problem**: `OKREntity` interface has both fields with **BACKWARDS COMMENTS**

```typescript
export interface OKREntity {
  id: string;
  ownerId: string;
  organizationId: string;  // Comment says "primary field" ❌ WRONG
  tenantId: string;        // Comment says "deprecated" ❌ WRONG (should be primary!)
  // ...
}
```

**Critical Issue**: The comments are **reversed**! According to canonicalisation:
- `tenantId` should be PRIMARY (canonical term)
- `organizationId` should be DEPRECATED (legacy)

**Recommendation**: 
1. Fix comments (swap them)
2. Eventually remove `organizationId` field from interface
3. Update all usages to use `tenantId`

**Impact**: Medium - may break existing code that references `organizationId`

**Migration Strategy**:
1. Fix comments first (immediate)
2. Update all usages to use `tenantId`
3. Remove `organizationId` field
4. Update type definitions

---

### 3. JWT Strategy (`services/core-api/src/modules/auth/strategies/jwt.strategy.ts`)

**Location**: Line 118

**Problem**: Only sets `organizationId`, doesn't set `tenantId` alias

```typescript
return {
  ...user,
  organizationId: orgAssignment?.scopeId || undefined,  // ✅ Keep for backward compat
  tenantId: orgAssignment?.scopeId || undefined,       // ✅ ADD THIS
  // ...
};
```

**Recommendation**: Add `tenantId` alias alongside `organizationId`

**Impact**: Low - improves consistency, allows `req.user.tenantId` access

---

### 4. RBAC Guard (`services/core-api/src/modules/rbac/rbac.guard.ts`)

**Location**: Lines 163-164, 309

**Problem**: Uses both `user.organizationId` and `resourceContext.tenantId` inconsistently

```typescript
// Line 163-164: Uses user.organizationId
if (!tenantId && user.organizationId) {
  tenantId = user.organizationId;
}

// Line 309: Error message uses both
`User does not have permission to ${action}. TenantId: ${resourceContext.tenantId}, UserOrganizationId: ${user.organizationId}`
```

**Recommendation**: 
- Normalise `user.organizationId` → `user.tenantId` at start of method
- Use `tenantId` consistently throughout

**Impact**: Low - internal refactoring only

---

### 5. Authorisation Service (`services/core-api/src/policy/authorisation.service.ts`)

**Location**: Line 173

**Problem**: Maps `resourceContext.tenantId` back to `organizationId`

```typescript
const actingUser = {
  id: userContext.userId,
  organizationId: resourceContext.tenantId || null,  // ❌ Should be tenantId
};
```

**Recommendation**: Use `tenantId` instead of `organizationId`

```typescript
const actingUser = {
  id: userContext.userId,
  tenantId: resourceContext.tenantId || null,  // ✅ Use tenantId
};
```

**Impact**: Low - internal object only

---

### 6. RBAC Helpers (`services/core-api/src/modules/rbac/helpers.ts`)

**Location**: Lines 171-184 (`extractTenantId` function)

**Status**: ✅ **CORRECT** - This function normalises both to `tenantId`

```typescript
export function extractTenantId(request: any): string {
  return (
    params.tenantId ||
    params.organizationId ||  // ✅ Correct - normalises org → tenant
    body.tenantId ||
    body.organizationId ||
    // ...
  );
}
```

**Recommendation**: Keep as-is (this is the normalization layer)

---

## Consolidation Recommendations

### Priority 1: Quick Wins (Low Risk)

1. ✅ **JWT Strategy** - Add `tenantId` alias alongside `organizationId`
   - File: `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`
   - Change: Add `tenantId: orgAssignment?.scopeId || undefined`

2. ✅ **Policy Controller** - Remove redundant `organizationId` field
   - File: `services/core-api/src/policy/policy.controller.ts`
   - Change: Remove `organizationId: tenantId` from `resourceContext.okr`

3. ✅ **Authorisation Service** - Use `tenantId` instead of `organizationId`
   - File: `services/core-api/src/policy/authorisation.service.ts`
   - Change: `tenantId: resourceContext.tenantId || null`

### Priority 2: Medium Risk (Requires Testing)

4. ⚠️ **RBAC Guard** - Normalise to `tenantId` consistently
   - File: `services/core-api/src/modules/rbac/rbac.guard.ts`
   - Change: Normalise `user.organizationId` → `user.tenantId` at start
   - Impact: May require updating error messages/logging

5. ⚠️ **RBAC Types** - Remove `organizationId` from `OKREntity`
   - File: `services/core-api/src/modules/rbac/types.ts`
   - Change: Remove `organizationId` field from interface
   - Impact: May break code that references `okr.organizationId`

---

## Database Schema (No Change Needed)

**Database columns should remain as `organizationId`** because:
- Changing column names requires migration
- External tools may reference column names
- Prisma schema uses `organizationId` consistently

**Application layer** should use `tenantId` terminology.

---

## Migration Path

### Phase 1: Add Aliases (No Breaking Changes)
1. Add `tenantId` to JWT strategy return object
2. Update middleware to prefer `tenantId` over `organizationId`

### Phase 2: Remove Redundant Fields
1. Remove `organizationId` from `OKREntity` interface
2. Update all references to use `tenantId`
3. Remove redundant `organizationId` assignments

### Phase 3: Normalise Internally
1. Update RBAC guard to use `tenantId` consistently
2. Update error messages to use `tenantId`
3. Remove internal `organizationId` references

---

## Summary

**Total problematic locations**: 5  
**Quick wins**: 3 (low risk, can be done immediately)  
**Medium risk**: 2 (require testing)

**Recommendation**: Start with Priority 1 items (quick wins), then move to Priority 2 after testing.

