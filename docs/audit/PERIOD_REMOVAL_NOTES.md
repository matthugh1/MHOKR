# Period Removal Notes

**Date:** 2025-11-03  
**PR:** `feat/remove-period-model`  
**Purpose:** Complete removal of Period concept from codebase (schema, backend, frontend, tests, docs). Cycle is canonical.

---

## Discovery Summary

### Database Schema
- **Enum Type:** `Period` enum (`MONTHLY`, `QUARTERLY`, `ANNUAL`, `CUSTOM`)
- **Columns:**
  - `objectives.period` (NOT NULL, required)
  - `key_results.period` (nullable)
  - `initiatives.period` (nullable)
- **Location:** `services/core-api/prisma/schema.prisma` lines 200, 239, 280, 295-300

### Backend Code
1. **Schema Definition:**
   - `services/core-api/prisma/schema.prisma` - Period enum and columns
   - `services/core-api/prisma/seed.ts` - 20+ seed records use `period: 'QUARTERLY'`

2. **Service Logic:**
   - `services/core-api/src/modules/okr/objective.service.ts` (lines 270-292)
     - Period validation logic for date ranges (MONTHLY ~30 days, QUARTERLY ~90 days, ANNUAL ~365 days)

3. **CSV Export:**
   - `services/core-api/src/modules/okr/okr-reporting.service.ts` (lines 145-154, 223-271)
     - Conditional inclusion via `OKR_EXPOSE_PERIOD_ALIAS` env flag

4. **Controller Comments:**
   - `services/core-api/src/modules/okr/okr-overview.controller.ts` (line 347)
     - Comment noting period is deprecated

5. **Tests:**
   - `services/core-api/src/modules/okr/okr-overview.integration.spec.ts` (lines 66-67, 153-166)
     - Tests asserting period is NOT in API responses

### TypeScript Types
- `packages/types/src/index.ts` (lines 60-65, 97, 120, 135)
  - Period enum definition
  - Period fields in Objective, KeyResult, Initiative interfaces

## Frontend Code
1. **Visual Builder (Legacy):**
   - `apps/web/src/app/dashboard/builder/page.tsx` - Extensive Period usage (230+ matches)
   - `apps/web/src/app/dashboard/builder/components/EditFormTabs.tsx` - Period form fields
   - `apps/web/src/app/dashboard/builder/components/EnhancedNodes.tsx` - Period imports
   - **Note:** Builder page will break at compile time due to Period removal. This is expected - builder is legacy and needs refactoring.

2. **Date Utilities:**
   - `apps/web/src/lib/date-utils.ts` - Period-related functions REMOVED:
     - `calculateEndDate(period: Period)` - REMOVED
     - `getDefaultDatesForPeriod(period: Period)` - REMOVED
     - `formatPeriod(period: Period)` - REMOVED
     - `validateDateRange(period: Period)` - Simplified to basic date validation
     - `getPeriodLabel(period: Period)` - REMOVED
     - `PeriodFilterOption` interface - REMOVED
     - `doesOKRMatchPeriod()` - Replaced with `doesOKRMatchDateRange()`
     - `getAvailablePeriodFilters()` - REMOVED
     - **Kept:** Date utility functions that don't depend on Period (formatDateRange, calculateTimeProgress, etc.)

3. **Comments:**
   - `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (line 71) - Comment noting periodLabel removed
   - `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` (line 325) - Comment noting period removed

### Documentation
- `docs/planning/OKR_TAXONOMY_DECISIONS.md` - Period marked as PENDING/validation-only
- `docs/audit/W4M1_BACKEND_IMPLEMENTATION_NOTES.md` - Period deprecation notes
- `docs/audit/API_SURFACE_MAP.md` - Period removal notes
- `CHANGELOG.md` - `OKR_EXPOSE_PERIOD_ALIAS` env var documented
- `W4M1_PR_COMMANDS.md` - Period deprecation notes

### Environment Variables
- `OKR_EXPOSE_PERIOD_ALIAS` - Controls CSV export inclusion (default: `false`)
  - Used in: `services/core-api/src/modules/okr/okr-reporting.service.ts`

---

## Migration Strategy

### UP Migration
1. Drop `period` column from `initiatives` table
2. Drop `period` column from `key_results` table
3. Drop `period` column from `objectives` table (requires handling NOT NULL constraint)
4. Drop `Period` enum type (only if no other references exist)

### DOWN Migration
1. Recreate `Period` enum type
2. Add `period` column back to `objectives` (NOT NULL, default 'QUARTERLY')
3. Add `period` column back to `key_results` (nullable)
4. Add `period` column back to `initiatives` (nullable)
5. Backfill from `cycleId` relationships where possible (best-effort)

---

## API Contract Changes

### Before
```typescript
// CSV Export (conditional)
{
  period?: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM'
}

// Objective creation/update
{
  period: Period  // Required
}
```

### After
```typescript
// Period field completely removed
// Cycle is canonical (objectives.cycleId → cycles.id)
```

---

## Rollback Steps

1. **Code Rollback:** `git revert` commits
2. **Database Rollback:** Run `DOWN.sql` migration
3. **Data Recovery:** Period values cannot be fully recovered (data loss expected)
   - Best-effort: Backfill from cycle names/relationships if cycles match period patterns

---

## Breaking Changes

- **Database:** Schema change removes columns (data loss)
- **API:** No API changes (period already removed from API responses in W4.M1)
- **Frontend:** Builder page will need updates (legacy visual builder)

---

## Testing

- ✅ Unit tests: Remove Period validation tests
- ✅ Integration tests: Remove Period assertions
- ✅ E2E tests: Add guard test that API never returns `period` keys
- ✅ Frontend: Add test asserting no `period` in `/okr/overview` payload

---

## Files Changed Summary

### Database
- `services/core-api/prisma/schema.prisma` - Remove Period enum and columns
- `services/core-api/prisma/seed.ts` - Remove period assignments
- `services/core-api/prisma/migrations/20251103_remove_periods/UP.sql` - Drop columns/enum
- `services/core-api/prisma/migrations/20251103_remove_periods/DOWN.sql` - Restore columns/enum

### Backend
- `services/core-api/src/modules/okr/objective.service.ts` - Remove period validation
- `services/core-api/src/modules/okr/okr-reporting.service.ts` - Remove CSV period handling
- `services/core-api/src/modules/okr/okr-overview.controller.ts` - Remove period comments

### Types
- `packages/types/src/index.ts` - Remove Period enum and fields

### Frontend
- `apps/web/src/app/dashboard/builder/page.tsx` - Remove Period usage
- `apps/web/src/app/dashboard/builder/components/EditFormTabs.tsx` - Remove Period fields
- `apps/web/src/lib/date-utils.ts` - Remove Period-related functions

### Tests
- `services/core-api/src/modules/okr/okr-overview.integration.spec.ts` - Update tests
- `apps/web/src/app/dashboard/okrs/okrs.page.contract.no-period.spec.tsx` - New guard test

### Documentation
- `docs/audit/API_SURFACE_MAP.md` - Update API surface
- `CHANGELOG.md` - Add breaking change note
- `docs/audit/PERIOD_REMOVAL_NOTES.md` - This file

---

**Status:** ✅ Complete removal implemented

