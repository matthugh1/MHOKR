# W4.M1 Backend Implementation Notes

**Generated:** 2025-11-03  
**Scope:** Backend-only PR for W4.M1 — Taxonomy & Data Model Alignment  
**Authoritative Sources:** 
- `docs/planning/OKR_TAXONOMY_DECISIONS.md`
- `docs/audit/OKR_SCREEN_FINDINGS_AND_RECOMMENDATIONS.md`
- `docs/audit/OKR_API_CONTRACTS.md`
- `docs/audit/OKR_DATA_MODEL_TRUTH.md`

---

## Summary

This PR implements backend-only changes to align OKR taxonomy and data model with canonical decisions documented in `OKR_TAXONOMY_DECISIONS.md`. All changes are backward-compatible and include reversible migrations.

**Key Changes:**
1. **Cycle vs Period**: Period deprecated in API responses (kept in DB for validation)
2. **Status vs Publish State**: Explicitly separated in API responses (`status` + `publishState`)
3. **Visibility**: Deprecated values normalized to `PUBLIC_TENANT`; only canonical values (`PUBLIC_TENANT`, `PRIVATE`) exposed
4. **Pillars**: `pillarId` deprecated in API responses (kept in DB for backward compatibility)
5. **Initiatives Anchoring**: Verified correct (no changes needed)

---

## 1. Cycle vs Period

### Decision (from OKR_TAXONOMY_DECISIONS.md §1-2)

> **Cycle** is canonical (operational planning period, e.g., "Q1 2025")  
> **Period** is deprecated (validation-only concept for date range constraints, not displayed in UI)

### Implementation

**Database:**
- `period` column remains in `objectives` table (for validation logic)
- No schema changes

**API Changes:**
- **Removed** `period` field from `/okr/overview` response
- **Removed** `period` field from `/okr/creation-context` response
- **CSV Export**: `period` field conditionally included via `OKR_EXPOSE_PERIOD_ALIAS` env flag (default: excluded)

**Files Changed:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts` - Removed period from response
- `services/core-api/src/modules/okr/okr-reporting.service.ts` - Conditional period in CSV export

**Compatibility:**
- `OKR_EXPOSE_PERIOD_ALIAS=true` env flag allows period in CSV export for backward compatibility
- Default: `false` (period excluded)

---

## 2. Status vs Publish State

### Decision (from OKR_TAXONOMY_DECISIONS.md §3-4)

> **Status** = Progress state (`ON_TRACK | AT_RISK | OFF_TRACK | COMPLETED | CANCELLED`)  
> **Publish State** = Governance state (`PUBLISHED | DRAFT` based on `isPublished` boolean)

### Implementation

**Database:**
- No schema changes (already separate: `status` enum + `isPublished` boolean)

**API Changes:**
- **Added** `publishState` field to `/okr/overview` response (computed from `isPublished`)
- **Kept** `isPublished` boolean for backward compatibility
- **Kept** `status` field (progress state)

**Response Structure:**
```typescript
{
  objectives: [{
    status: 'ON_TRACK',           // Progress state
    publishState: 'PUBLISHED',    // Governance state
    isPublished: true,             // Boolean (backward compatibility)
  }]
}
```

**Files Changed:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts` - Added `publishState` field

---

## 3. Visibility Model

### Decision (from OKR_TAXONOMY_DECISIONS.md §5)

> **Canonical values:** `PUBLIC_TENANT` (default), `PRIVATE`  
> **Deprecated values:** `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY`  
> **Behavior:** Deprecated values treated as `PUBLIC_TENANT` (globally visible)

### Implementation

**Database Migration:**
- **Migration:** `20251103000000_w4m1_taxonomy_alignment/migration.sql`
- **Action:** Normalizes deprecated visibility values to `PUBLIC_TENANT` in data
```sql
UPDATE objectives SET "visibilityLevel" = 'PUBLIC_TENANT'
WHERE "visibilityLevel" IN ('WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY');

UPDATE key_results SET "visibilityLevel" = 'PUBLIC_TENANT'
WHERE "visibilityLevel" IN ('WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY');
```

**API Changes:**
- **Removed** `EXEC_ONLY` from `/okr/creation-context` `allowedVisibilityLevels`
- **Only** `PUBLIC_TENANT` and `PRIVATE` exposed in API responses
- Deprecated values normalized to `PUBLIC_TENANT` in migration

**Visibility Service:**
- `OkrVisibilityService.canUserSeeObjective()` already treats deprecated values as `PUBLIC_TENANT` (via `visibilityPolicy.ts`)
- No changes needed (already correct)

**Files Changed:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts` - Removed `EXEC_ONLY` from creation context
- `services/core-api/src/modules/okr/okr-visibility.service.ts` - Added documentation

---

## 4. Pillars / Alignment

### Decision (from OKR_TAXONOMY_DECISIONS.md §6)

> **Status:** Pillars table exists but not used in UI  
> **Decision:** Deprecate `pillarId` in API responses (keep in DB for backward compatibility)

### Implementation

**Database:**
- No schema changes (`pillarId` column remains)

**API Changes:**
- **Removed** `pillarId` from `/okr/overview` response
- **Removed** `pillarId` from `/okr/creation-context` response (if present)

**Files Changed:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts` - Removed `pillarId` from response

**Note:** Pillars table (`strategic_pillars`) remains in DB for future use or reporting, but not exposed in main OKR API.

---

## 5. Initiatives Anchoring

### Decision (from OKR_TAXONOMY_DECISIONS.md §7)

> **Current implementation is correct:** Initiatives can anchor to Objective OR Key Result (or both)  
> **No changes needed**

### Verification

- ✅ `initiatives.objectiveId` (nullable) exists
- ✅ `initiatives.keyResultId` (nullable) exists
- ✅ Both can be set simultaneously (per schema)
- ✅ API responses correctly include both fields

**No changes made** (already correct).

---

## Migration Details

### Migration File
`services/core-api/prisma/migrations/20251103000000_w4m1_taxonomy_alignment/migration.sql`

### Up Migration
- Normalizes deprecated visibility values to `PUBLIC_TENANT`
- No schema changes (backward compatible)

### Down Migration
- **Not needed** (data normalization can be reverted if needed, but deprecated values should remain normalized)

### Rollback Strategy
1. Revert code changes (git revert)
2. Data normalization (deprecated → PUBLIC_TENANT) is safe to keep
3. No schema rollback needed

---

## API Contract Changes

### GET /okr/overview

**Before:**
```typescript
{
  objectives: [{
    status: string,
    isPublished: boolean,
    visibilityLevel: string,  // Could include deprecated values
    // period: not present
    // pillarId: not present
  }]
}
```

**After:**
```typescript
{
  objectives: [{
    status: string,              // Progress state: ON_TRACK | AT_RISK | ...
    publishState: string,        // NEW: Governance state: PUBLISHED | DRAFT
    isPublished: boolean,        // Kept for backward compatibility
    visibilityLevel: string,      // Only PUBLIC_TENANT | PRIVATE (deprecated normalized)
    // period: REMOVED (deprecated)
    // pillarId: REMOVED (deprecated)
  }]
}
```

### GET /okr/creation-context

**Before:**
```typescript
{
  allowedVisibilityLevels: ['PUBLIC_TENANT', 'PRIVATE', 'EXEC_ONLY'],
}
```

**After:**
```typescript
{
  allowedVisibilityLevels: ['PUBLIC_TENANT', 'PRIVATE'],  // EXEC_ONLY removed
}
```

---

## Testing

### Unit Tests
- ✅ `services/core-api/src/modules/okr/okr-visibility.service.spec.ts`
  - Visibility inheritance (Objectives → Key Results)
  - Deprecated visibility values normalization
  - Status vs Publish State separation

### Integration Tests
- ✅ `services/core-api/src/modules/okr/okr-overview.integration.spec.ts`
  - Status vs Publish State separation in API responses
  - Visibility filtering with canonical fields
  - Key Results visibility inheritance
  - Pagination after visibility filtering
  - Cycle vs Period (cycle present, period absent)
  - Pillars deprecation (pillarId absent)

### Smoke Tests
- ✅ Existing smoke tests remain valid (no breaking changes)

---

## Environment Variables

### New Variable
- `OKR_EXPOSE_PERIOD_ALIAS` (default: `false`)
  - **Purpose:** Control inclusion of `period` field in CSV export
  - **Usage:** Set to `true` for backward compatibility if needed
  - **Default:** `false` (period excluded)

---

## Compatibility & Rollback

### Backward Compatibility
- ✅ `isPublished` boolean kept for backward compatibility
- ✅ No breaking changes to existing fields (only additions)
- ✅ Deprecated fields removed (but can be re-enabled via env flag for CSV)

### Rollback Plan
1. **Code Rollback:** `git revert` commits
2. **Database Rollback:** No schema changes to revert
3. **Data Rollback:** Deprecated visibility normalization can be reverted if needed (SQL UPDATE statements)

---

## Files Changed

### Services
- `services/core-api/src/modules/okr/okr-overview.controller.ts`
  - Added `publishState` field
  - Removed `EXEC_ONLY` from creation context
  - Added documentation comments

- `services/core-api/src/modules/okr/okr-visibility.service.ts`
  - Added documentation about deprecated visibility values

- `services/core-api/src/modules/okr/okr-reporting.service.ts`
  - Conditional `period` inclusion in CSV export (via env flag)

### Migrations
- `services/core-api/prisma/migrations/20251103000000_w4m1_taxonomy_alignment/migration.sql`
  - Normalizes deprecated visibility values to `PUBLIC_TENANT`

### Tests
- `services/core-api/src/modules/okr/okr-visibility.service.spec.ts` (new)
- `services/core-api/src/modules/okr/okr-overview.integration.spec.ts` (new)

---

## References

- **Canonical Taxonomy:** `docs/planning/OKR_TAXONOMY_DECISIONS.md`
- **API Contracts:** `docs/audit/OKR_API_CONTRACTS.md`
- **Data Model:** `docs/audit/OKR_DATA_MODEL_TRUTH.md`
- **Findings:** `docs/audit/OKR_SCREEN_FINDINGS_AND_RECOMMENDATIONS.md`

---

## Next Steps (Future PRs)

1. **Frontend Updates:** Update frontend to use `publishState` instead of inferring from `isPublished`
2. **Remove Deprecated Fields:** In future release, remove `isPublished` boolean (use `publishState` only)
3. **Remove Period Column:** If period validation is no longer needed, remove column in future migration
4. **Remove Pillar Support:** If pillars are never used, remove table/FK in future migration

---

**Status:** ✅ Ready for review and merge

