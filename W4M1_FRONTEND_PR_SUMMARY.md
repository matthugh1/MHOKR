# W4.M1 Frontend PR Summary

## Files Changed

### Modified Files
1. `apps/web/src/app/dashboard/okrs/page.tsx` - Removed Period UI, updated button gating
2. `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` - Added publishState mapping, removed period references
3. `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx` - Added publishState to PreparedObjective interface
4. `apps/web/src/components/okr/ObjectiveRow.tsx` - Separated Status and Publish State chips
5. `apps/web/src/components/okr/NewObjectiveModal.tsx` - Removed pillar UI, updated Cycle label
6. `apps/web/src/components/okr/EditObjectiveModal.tsx` - Removed pillar UI
7. `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` - Updated STEP A skeleton, removed period/EXEC_ONLY

### New Files
1. `apps/web/src/components/okr/ObjectiveRow.w4m1.test.tsx` - Tests for chip separation
2. `apps/web/src/app/dashboard/okrs/components/CreateObjectiveDrawer.w4m1.test.tsx` - Tests for drawer STEP A

## Key Diffs

### 1. Removal of Period UI

**Before:**
```typescript
const [selectedPeriod, _setSelectedPeriod] = useState<string>(getCurrentPeriodFilter())
const _availablePeriods = getAvailablePeriodFilters()
// ... periodLabel references
```

**After:**
```typescript
// W4.M1: Period removed - Cycle is canonical
const legacyPeriods: Array<{ id: string; label: string }> = []
```

### 2. Separate Status vs Publish State Chips

**Before:**
```typescript
<OkrBadge tone={objective.isPublished ? 'neutral' : 'warn'}>
  {objective.isPublished ? 'Published' : 'Draft'}
</OkrBadge>
```

**After:**
```typescript
// Status chip - Progress state
<OkrBadge tone={statusBadge.tone}>
  {statusBadge.label}
</OkrBadge>

// Publish State chip - Governance state
<OkrBadge tone={publishStateBadge.tone}>
  {publishStateBadge.label}
</OkrBadge>
```

### 3. Permission-Gated New Objective Button

**Before:**
```typescript
{canCreateObjective && (
  <Button onClick={() => setIsCreateDrawerOpen(true)}>
    New Objective
  </Button>
)}
{!canCreateObjective && currentOrganization?.id && permissions.isTenantAdminOrOwner(...) && (
  <Button variant="outline" className="border-amber-300...">
    New Objective (Debug - Admin Override)
  </Button>
)}
```

**After:**
```typescript
{/* W4.M1: Permission-gated New Objective button */}
{canCreateObjective && (
  <Button onClick={() => setIsCreateDrawerOpen(true)}>
    <Plus className="h-4 w-4 mr-2" />
    New Objective
  </Button>
)}
```

### 4. Creation Drawer STEP A Skeleton

**Key Changes:**
- Removed "Save as Draft" from STEP A footer
- Added helper text "Publishing arrives in W5.M1"
- Changed "Cycle / Time Period" → "Cycle"
- Removed period field from API payloads
- Removed EXEC_ONLY from visibility options

## Tests Added

1. **ObjectiveRow.w4m1.test.tsx**
   - Status chip renders separately from Publish State chip
   - publishState derived from isPublished when not provided
   - Visibility chip NOT displayed (server-enforced)
   - Pillar badge NOT displayed (deprecated)

2. **CreateObjectiveDrawer.w4m1.test.tsx**
   - Drawer opens/closes correctly
   - STEP A form fields render
   - Helper text about W5.M1 displays
   - Pillar field NOT rendered

## Git Commands

```bash
git checkout -b feat/w4m1-frontend-taxonomy-alignment

git add apps/web/src/app/dashboard/okrs/page.tsx
git add apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx
git add apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx
git add apps/web/src/components/okr/ObjectiveRow.tsx
git add apps/web/src/components/okr/NewObjectiveModal.tsx
git add apps/web/src/components/okr/EditObjectiveModal.tsx
git add apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx
git add apps/web/src/components/okr/ObjectiveRow.w4m1.test.tsx
git add apps/web/src/app/dashboard/okrs/components/CreateObjectiveDrawer.w4m1.test.tsx

git commit -m "feat(okr-ui): W4.M1 taxonomy alignment (remove Period UI, split chips, permission-gated creation drawer skeleton)

- Remove Period UI: period selectors, filters, and state removed; Cycle is canonical
- Separate chips: Status (progress state) vs Publish State (governance state) displayed separately
- Remove pillar UI: strategic pillar badges/columns/filters removed from all components
- Permission-gated New Objective button: only shows when canCreateObjective=true from backend
- Creation drawer STEP A skeleton: form visible, submit disabled with helper text 'Publishing arrives in W5.M1'
- Visibility: EXEC_ONLY removed from creation context; only PUBLIC_TENANT and PRIVATE exposed
- Update copy: empty states reference cycles, not periods
- Add tests: chip rendering, drawer interaction, button gating

Refs: docs/planning/OKR_TAXONOMY_DECISIONS.md, docs/audit/W4M1_BACKEND_IMPLEMENTATION_NOTES.md"

# Push and create PR
gh repo view >/dev/null 2>&1 && gh pr create -t "W4.M1 (Frontend): OKR UI Taxonomy Alignment" -b "See docs/planning/OKR_TAXONOMY_DECISIONS.md and docs/audit/W4M1_BACKEND_IMPLEMENTATION_NOTES.md for canonical fields.

**Changes:**
- Removed Period UI (Cycle is canonical)
- Separated Status vs Publish State chips
- Removed pillar UI surfaces
- Permission-gated New Objective button
- Creation drawer STEP A skeleton (submit disabled, helper text added)
- EXEC_ONLY removed from visibility options
- Updated empty states and copy

**Tests:** Added unit tests for chip rendering and drawer interaction." -B main -H feat/w4m1-frontend-taxonomy-alignment || echo "GitHub CLI not available - create PR manually"
```

