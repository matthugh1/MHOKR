# Key Result Edit Drawer Implementation Plan

## Problem Statement

Users currently cannot comprehensively edit Key Results. Only basic fields (title, current/target values, owner, status) can be edited inline. Many important fields like description, metric type, check-in cadence, dates, and metadata cannot be edited.

## Current State

### What Exists:
- ✅ Inline editors for: title, current value, target value, owner, status
- ✅ `OKRCreationDrawer` supports creating KRs (mode='kr')
- ✅ `EditObjectiveModal` exists for Objectives
- ✅ Backend API supports updating KRs (`PATCH /key-results/:id`)

### What's Missing:
- ❌ No `EditKeyResultModal` or `EditKeyResultDrawer` component
- ❌ No way to edit: description, start value, metric type, unit, check-in cadence, cycle, dates, visibility, tags, contributors, weight
- ❌ No edit button/action in KR UI components

## Solution

Create a comprehensive Key Result edit drawer/modal similar to `EditObjectiveModal`, allowing users to edit all KR fields in one place.

---

## Implementation Plan

### Phase 1: Create EditKeyResultDrawer Component

**File:** `apps/web/src/components/okr/EditKeyResultDrawer.tsx`

**Features:**
- Full-screen drawer (similar to `OKRCreationDrawer`)
- Form sections:
  1. **Basic Info**: Title, Description
  2. **Metrics**: Start Value, Target Value, Current Value, Metric Type, Unit
  3. **Settings**: Owner, Check-in Cadence, Cycle, Start/End Dates
  4. **Visibility**: Visibility Level (if applicable)
  5. **Metadata**: Tags, Contributors, Weight (if linked to Objective)
- Validation for required fields
- RBAC checks (use `canEditKeyResult` permission)
- Lock/governance checks (cycle lock, etc.)
- Save/Cancel actions
- Loading states and error handling

**Dependencies:**
- Reuse form components from `OKRCreationDrawer` where possible
- Use `InlineStatusEditor` pattern for consistency
- Integrate with existing permission hooks

**Estimated Effort:** 4-6 hours

---

### Phase 2: Add Edit Action to KR UI Components

**Files to Modify:**
1. `apps/web/src/components/okr/ObjectiveRow.tsx`
   - Add edit button/icon next to KR title
   - Add `onEditKeyResult` handler
   - Pass KR data to edit drawer

2. `apps/web/src/app/dashboard/okrs/components/OKRTreeNode.tsx`
   - Add edit action for KR nodes in tree view
   - Similar edit button pattern

3. `apps/web/src/app/dashboard/okrs/page.tsx`
   - Add state for edit drawer (`showEditKeyResult`, `editKeyResultId`, `editKeyResultData`)
   - Add `handleEditKeyResult` function
   - Integrate `EditKeyResultDrawer` component
   - Handle drawer open/close and success callbacks

**Changes:**
- Add edit icon/button (similar to Objective edit button)
- Wire up click handler to open drawer
- Pass KR data and permissions to drawer
- Refresh data after successful edit

**Estimated Effort:** 2-3 hours

---

### Phase 3: Backend Integration

**Files to Check/Modify:**
1. `services/core-api/src/modules/okr/key-result.controller.ts`
   - Verify `PATCH /key-results/:id` endpoint exists
   - Ensure all fields can be updated
   - Verify RBAC enforcement

2. `services/core-api/src/modules/okr/key-result.service.ts`
   - Verify `update` method handles all fields
   - Ensure status snapshot is stored on status change
   - Ensure progress rollup is triggered on value changes

**Verification:**
- Test updating each field individually
- Test RBAC enforcement
- Test tenant isolation
- Test governance/lock enforcement

**Estimated Effort:** 1-2 hours (mostly verification)

---

### Phase 4: UI/UX Polish

**Enhancements:**
- Add keyboard shortcuts (e.g., `E` to edit when KR is selected)
- Add confirmation dialog for destructive changes (e.g., changing metric type)
- Add unsaved changes warning
- Add loading skeletons
- Add success/error toast notifications
- Ensure accessibility (ARIA labels, keyboard navigation, focus management)

**Estimated Effort:** 2-3 hours

---

### Phase 5: Testing

**Test Cases:**
1. **Happy Path:**
   - Open edit drawer
   - Edit all fields
   - Save successfully
   - Verify changes persist

2. **Permissions:**
   - User without edit permission cannot open drawer
   - Locked cycle prevents editing
   - Tenant isolation enforced

3. **Validation:**
   - Required fields validation
   - Numeric field validation (start/target/current values)
   - Date validation (start < end)

4. **Edge Cases:**
   - Editing KR that's linked to multiple Objectives
   - Editing KR with existing check-ins
   - Editing KR with initiatives
   - Network errors during save

5. **Integration:**
   - Status rollup triggers after edit
   - Progress rollup triggers after value changes
   - Activity log records changes

**Estimated Effort:** 2-3 hours

---

## Technical Details

### Component Structure

```typescript
interface EditKeyResultDrawerProps {
  isOpen: boolean
  keyResultId: string | null
  keyResultData: KeyResultData | null
  availableUsers: Array<{ id: string; name: string; email?: string }>
  activeCycles: Array<{ id: string; name: string; status: string }>
  currentOrganization: { id: string } | null
  onClose: () => void
  onSuccess: () => void
}

interface KeyResultData {
  id: string
  title: string
  description?: string
  ownerId: string
  metricType: 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'PERCENTAGE' | 'CUSTOM'
  startValue: number
  targetValue: number
  currentValue: number
  unit?: string
  status: OKRStatus
  checkInCadence?: CheckInCadence
  cycleId?: string
  startDate?: Date
  endDate?: Date
  visibilityLevel: VisibilityLevel
  tags?: Array<{ id: string; name: string }>
  contributors?: Array<{ id: string; user: { id: string; name: string } }>
  weight?: number // If linked to Objective
  objectiveIds?: string[] // Linked Objectives
}
```

### API Integration

```typescript
// Update KR
const response = await api.patch(`/key-results/${keyResultId}`, {
  title: formData.title,
  description: formData.description,
  ownerId: formData.ownerId,
  metricType: formData.metricType,
  startValue: formData.startValue,
  targetValue: formData.targetValue,
  currentValue: formData.currentValue,
  unit: formData.unit,
  checkInCadence: formData.checkInCadence,
  cycleId: formData.cycleId,
  startDate: formData.startDate,
  endDate: formData.endDate,
  visibilityLevel: formData.visibilityLevel,
  // Tags and contributors handled separately
})
```

### Permission Checks

```typescript
const canEdit = tenantPermissions.canEditKeyResult({
  id: keyResultId,
  ownerId: keyResultData.ownerId,
  tenantId: keyResultData.tenantId,
  // ... other fields
})

const lockInfo = tenantPermissions.getLockInfoForKeyResult(keyResultData)
if (lockInfo.isLocked) {
  // Show lock dialog
  return
}
```

---

## Dependencies

### External:
- None (all dependencies exist)

### Internal:
- `EditObjectiveModal` (for reference/pattern)
- `OKRCreationDrawer` (for form components reuse)
- `useTenantPermissions` hook
- `usePermissions` hook
- API client (`api` from `@/lib/api`)

---

## Success Criteria

1. ✅ Users can open edit drawer from KR row/tree node
2. ✅ All KR fields can be edited in the drawer
3. ✅ Changes persist after save
4. ✅ RBAC and governance rules are enforced
5. ✅ Status and progress rollups trigger correctly
6. ✅ Activity log records changes
7. ✅ UI is accessible and responsive
8. ✅ Error handling works correctly

---

## Estimated Total Effort

- **Phase 1:** 4-6 hours
- **Phase 2:** 2-3 hours
- **Phase 3:** 1-2 hours
- **Phase 4:** 2-3 hours
- **Phase 5:** 2-3 hours

**Total:** 11-17 hours

---

## Priority

**P1 (High)** - This is a core functionality gap. Users need to be able to edit Key Results comprehensively.

---

## Notes

- Consider reusing form components from `OKRCreationDrawer` to reduce duplication
- Ensure consistency with `EditObjectiveModal` patterns
- Test thoroughly with various permission scenarios
- Consider adding bulk edit capabilities in future (Phase 6)

