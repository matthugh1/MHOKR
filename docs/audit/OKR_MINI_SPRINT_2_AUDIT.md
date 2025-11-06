# STEP 0 - Quick Audit Summary

**Date:** 2025-11-05  
**Scope:** OKR list code paths (page.tsx, containers, components)

---

## Files to Touch

### Frontend (OKR List)
- ✅ `apps/web/src/app/dashboard/okrs/page.tsx` (1597 lines)
- ✅ `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (empty state)
- ✅ `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx` (no console.log found)
- ✅ `apps/web/src/components/okr/ObjectiveRow.tsx` (uses lockInfo.message)
- ✅ `apps/web/src/components/okr/KeyResultRow.tsx` (if exists - need to check)
- ✅ `apps/web/src/lib/analytics.ts` (already created)

### Governance Helpers/Hooks
- ✅ `apps/web/src/hooks/useTenantPermissions.ts` (getLockInfoForObjective, getLockInfoForKeyResult)
- ✅ `apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx` (lock modal)

### ESLint Config
- ✅ `.eslintrc.js` (root level)

---

## Current Lock Warning/Tooltip Locations

### 1. PublishLockWarningModal.tsx
- **Lines:** 21-65
- **Current messages:**
  - Publish lock: `"This OKR is published and locked. You cannot change targets after publish. Only tenant administrators can edit or delete published OKRs."`
  - Cycle lock: `"This OKR is locked because its cycle is locked. You cannot change targets during a locked cycle. Only tenant administrators can edit or delete OKRs in locked cycles."`

### 2. useTenantPermissions.ts
- **Lines:** 333-417
- **getLockInfoForObjective:** Returns lock messages (lines 346-368)
- **getLockInfoForKeyResult:** Returns lock messages (lines 394-408)
- **Current messages:** Same as modal (needs enhancement)

### 3. ObjectiveRow.tsx
- **Lines:** 750, 765, 803, 1072, 1151, 1164, 1185
- **Usage:** Passes `lockReason={lockInfo.isLocked ? lockInfo.message : undefined}` to inline editors
- **No tooltips currently** - only disables editing

### 4. page.tsx
- **Lines:** 1316-1348
- **Usage:** Shows PublishLockWarningModal when user tries to edit locked OKR

---

## Console.log Locations

### In OKR List Code Paths:
- ✅ `apps/web/src/app/dashboard/okrs/components/OKRTreeView.tsx`
  - Line 65: `console.log('[Telemetry] okr.tree.expand', ...)`
  - Line 73: `console.log('[Telemetry] okr.tree.collapse', ...)`

### Outside OKR List (but should be cleaned):
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` (13 instances)
- `apps/web/src/components/okr/InlineInsightBar.tsx` (2 instances)
- `apps/web/src/components/okr/AttentionDrawer.tsx` (2 instances)

**Note:** Stories 4-6 focus on OKR list code paths. Creation drawer cleanup can be separate.

---

## page.tsx Structure Analysis

### Current Structure (1597 lines):

1. **Imports** (lines 1-73)
2. **Component declaration** (line 75)
3. **State management** (lines 76-226)
4. **Helper functions** (lines 228-262)
5. **Effects & data loading** (lines 264-350)
6. **Handler functions** (lines 352-800)
7. **Render** (lines 800-1596):
   - Header (lines 802-856)
   - **Filter Bar** (lines 858-1062) ← Extract to OKRFilterBar.tsx
   - **Toolbar** (lines 1064-1150) ← Extract to OKRToolbar.tsx
   - Main content (lines 1152-1305)
   - Modals/Drawers (lines 1307-1596)

### Extraction Targets:

#### OKRFilterBar.tsx (~200 lines)
- Search input (lines 863-881)
- Status filter buttons (lines 883-1023)
- Cycle selector (lines 1025-1054)
- Clear filters button (lines 1056-1061)

#### OKRToolbar.tsx (~90 lines)
- Scope toggle (lines 1066-1118)
- Attention drawer button (lines 1119-1140)
- Add button dropdown (lines 1142-1150)

#### EmptyState.tsx
- Already in OKRPageContainer.tsx (lines 469-517)
- May need minor refactor for reuse

---

## ESLint Configuration

### Current State:
- `.eslintrc.js` (root)
- Rule: `'no-console': ['warn', { allow: ['warn', 'error'] }]`
- **Action:** Change to `'error'` for stricter enforcement

---

## Summary

- **page.tsx:** 1597 lines → Split into FilterBar (~200) + Toolbar (~90) = ~1300 lines remaining
- **console.log:** 2 instances in OKRTreeView.tsx (list code path)
- **Lock messages:** 3 locations need enhancement (PublishLockWarningModal, useTenantPermissions, ObjectiveRow tooltips)
- **ESLint:** Already configured, needs severity upgrade

