# Why We Have Both OrganizationId and TenantId - Complete Explanation

**Generated**: 2025-01-06  
**Purpose**: Explain the historical context and current state of organizationId vs tenantId usage

---

## The Root Cause: Historical Naming vs Conceptual Clarity

### Original System Design (Legacy)

The system was originally built using **"Organization"** terminology:

- Database tables: `organizations` table
- Database columns: `organizationId` in all tenant-scoped tables
- Application code: `req.user.organizationId`, `objective.organizationId`, etc.
- API routes: `/organizations/:id`
- TypeScript interfaces: `organizationId: string`

**Why "Organization"?**
- Initially, the concept was indeed an "organization" (company, business unit)
- Made sense from a business domain perspective
- Common terminology in enterprise software

### The Problem: Conceptual Confusion

As the system evolved, a distinction emerged:

| Term | Meaning | Context |
|------|---------|---------|
| **Organization** | The business entity/concept | "Acme Corp is an organization" |
| **Tenant** | The multi-tenancy boundary | "Acme Corp is a tenant in our SaaS platform" |

**The Issue**: 
- "Organization" describes the **business concept**
- "Tenant" describes the **technical multi-tenancy boundary**
- In a SaaS platform, these are often the same thing, but "tenant" is more accurate for multi-tenancy

### Recent Migration: Tenant Canonicalisation

A recent effort (Phase 0-5) was undertaken to **canonicalise to "tenant"** terminology:

**Goal**: Use "tenant" as the canonical term for multi-tenancy clarity

**Challenge**: Can't change database schema easily (migrations, external tools, Prisma)

**Solution**: Dual naming during transition period

---

## Current State: Transition Period

### Where We Are Now

We're in a **transitional state** where both exist:

1. **Database Layer** (Unchanged - Hard to Migrate)
   - Tables: `organizations`, `workspaces`, `objectives`, etc.
   - Columns: `organizationId` in all tenant-scoped tables
   - **Why unchanged?**: Database migrations are risky, external tools may reference column names

2. **Application Layer** (Migrating to Tenant)
   - New code uses `tenantId`
   - Old code still uses `organizationId`
   - Middleware normalises `organizationId` → `tenantId`

3. **API Layer** (Accepting Both)
   - Accepts both `organizationId` and `tenantId` in requests
   - Normalises to `tenantId` internally
   - Deprecation warnings for `organizationId`

---

## Why Both Exist Right Now

### ✅ Legitimate Reasons (Keep As-Is)

1. **Database Schema Immutability**
   ```sql
   -- Database column names are hard to change
   ALTER TABLE objectives RENAME COLUMN "organizationId" TO "tenantId";
   -- ❌ Risky: breaks external tools, migrations, views
   ```

2. **Backward Compatibility**
   ```typescript
   // Old API clients still send organizationId
   POST /objectives { organizationId: "tenant-123" }
   
   // We accept it and normalise internally
   tenantId = organizationId || tenantId
   ```

3. **Gradual Migration**
   ```typescript
   // Old code still works
   const orgId = req.user.organizationId;
   
   // New code uses tenantId
   const tenantId = req.tenantId;
   
   // Both resolve to the same value
   ```

4. **Prisma Schema Alignment**
   ```prisma
   // Prisma schema uses organizationId (matches database)
   model Objective {
     organizationId String?  // Can't change easily
   }
   ```

### ❌ Problematic Reasons (Should Fix)

1. **Redundant Assignment** (Policy Controller)
   ```typescript
   // Setting both is redundant
   resourceContext.okr = {
     organizationId: tenantId,  // ❌ Why set both?
     tenantId: tenantId,        // ✅ Only need this
   };
   ```

2. **Interface Confusion** (OKREntity)
   ```typescript
   // Interface has both, but comments say different things
   export interface OKREntity {
     organizationId: string;  // Comment says "primary field"
     tenantId: string;        // Comment says "deprecated"
   }
   // ❌ Which one is actually primary?
   ```

3. **Inconsistent Usage** (RBAC Guard)
   ```typescript
   // Uses both in same function
   const tenantId = user.organizationId;  // ❌ Mixed terminology
   resourceContext.tenantId = tenantId;   // ✅ Should use tenantId consistently
   ```

---

## The Real Answer: We Should Only Use One

### ✅ **Database Layer**: Keep `organizationId`
**Reason**: Too risky to change, external tools depend on it

### ✅ **Application Layer**: Use `tenantId` ONLY
**Reason**: Better terminology, clearer intent

### ✅ **API Layer**: Accept `organizationId`, Normalise to `tenantId`
**Reason**: Backward compatibility during migration

---

## What Needs to Change

### Priority 1: Remove Redundant Fields

**Problem**: Setting both `organizationId` and `tenantId` in same object

**Files to Fix**:
1. `policy.controller.ts` (lines 239-240, 167-168)
   - Remove `organizationId` field, keep only `tenantId`

2. `types.ts` (`OKREntity` interface, lines 169-170)
   - Remove `organizationId` field, keep only `tenantId`
   - Update all references

### Priority 2: Add Missing Aliases

**Problem**: JWT strategy only sets `organizationId`, doesn't set `tenantId` alias

**Files to Fix**:
1. `jwt.strategy.ts` (line 118)
   - Add `tenantId: orgAssignment?.scopeId || undefined`
   - Keep `organizationId` for backward compatibility

### Priority 3: Normalise Internally

**Problem**: Code uses both inconsistently

**Files to Fix**:
1. `rbac.guard.ts` (lines 163-164, 309)
   - Normalise `user.organizationId` → `user.tenantId` at start
   - Use `tenantId` consistently throughout

2. `authorisation.service.ts` (line 173)
   - Change `organizationId` → `tenantId` in `actingUser` object

---

## Migration Path Forward

### Phase 1: Clean Up Redundancy (Low Risk)
- Remove duplicate `organizationId` fields where `tenantId` exists
- Add `tenantId` alias in JWT strategy
- **Timeline**: Can do immediately

### Phase 2: Normalise Application Code (Medium Risk)
- Update all application code to use `tenantId` internally
- Keep `organizationId` only for:
  - Database column names
  - Prisma queries
  - API input normalisation
- **Timeline**: After testing

### Phase 3: Update Interfaces (Higher Risk)
- Remove `organizationId` from TypeScript interfaces
- Update all code that references `okr.organizationId`
- **Timeline**: After Phase 2 complete

### Phase 4: API Deprecation (Future)
- Deprecate `organizationId` in API responses
- Remove `organizationId` from API contracts
- **Timeline**: After all clients migrated

---

## Summary

**Why both exist**:
1. **Database**: Historical naming (`organizationId`) - too risky to change
2. **Application**: Migrating to `tenantId` for clarity
3. **Transition**: Both exist during migration period

**What to do**:
1. ✅ **Keep** `organizationId` in database schema
2. ✅ **Use** `tenantId` in application code
3. ✅ **Accept** `organizationId` in API inputs (normalise to `tenantId`)
4. ❌ **Remove** redundant `organizationId` fields where `tenantId` exists
5. ❌ **Don't** set both in same object

**The Rule**: 
- **Database/Prisma**: `organizationId` (unchanged)
- **Application logic**: `tenantId` (canonical)
- **API input**: Accept both, normalise to `tenantId`
- **API output**: Use `tenantId` only

**Current Status**: We're 80% there - just need to clean up redundant assignments and add missing aliases.

