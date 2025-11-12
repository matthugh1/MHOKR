# OKR Mini Sprint 4.0 – Validation Guide

**Date:** 2025-01-XX  
**Sprint:** Mini Sprint 4.0 – Context & Governance Refinement

## Pre-Validation Checklist

- [ ] Backend services running (`services/core-api`)
- [ ] Frontend dev server running (`apps/web`)
- [ ] User logged in with appropriate role (TENANT_ADMIN, TENANT_OWNER, or CONTRIBUTOR for testing)
- [ ] At least one cycle exists in the system
- [ ] At least one OKR exists with attention items (overdue check-ins, no updates, etc.)

## Story A: Attention Drawer Polish

### Test 1: Badge Count in Button Title

**Steps:**
1. Navigate to `/dashboard/okrs`
2. Observe the "Attention" button in the toolbar
3. If attention count > 0, verify button shows "Attention (X)" where X is the count
4. Verify badge overlay appears on button when count > 0

**Expected:**
- Button displays "Attention (4)" if count is 4
- Badge overlay shows count number
- Button accessible via keyboard (Tab key)

**Validation:**
- [ ] Button title shows count when > 0
- [ ] Badge overlay visible
- [ ] Accessibility: `aria-label` includes count

### Test 2: Scope-Aware Filtering

**Steps:**
1. Navigate to `/dashboard/okrs`
2. Select different scopes (My, Team/Workspace, Tenant)
3. Click "Attention" button to open drawer
4. Verify drawer shows items filtered by current scope and cycleId

**Expected:**
- Drawer fetches data with `scope` and `cycleId` parameters
- Items shown match current scope selection
- Different scopes show different items (if applicable)

**Validation:**
- [ ] Drawer filters by scope
- [ ] Drawer filters by cycleId
- [ ] Network request includes both parameters

### Test 3: Role-Aware Empty States

**Test as Tenant Admin/Owner:**
1. Log in as user with TENANT_OWNER or TENANT_ADMIN role
2. Navigate to `/dashboard/okrs`
3. Ensure no attention items exist (or select scope/cycle with no items)
4. Open Attention drawer
5. Verify empty state message

**Expected:**
- Message: "No items need your attention. All OKRs are on track."

**Test as Manager/Lead:**
1. Log in as user with WORKSPACE_LEAD or TEAM_LEAD role
2. Navigate to `/dashboard/okrs`
3. Ensure no attention items exist
4. Open Attention drawer
5. Verify empty state message

**Expected:**
- Message: "No team items need attention right now."

**Test as Contributor:**
1. Log in as user with CONTRIBUTOR role (no admin/lead roles)
2. Navigate to `/dashboard/okrs`
3. Ensure no attention items exist
4. Open Attention drawer
5. Verify empty state message

**Expected:**
- Message: "Nothing needs your attention."

**Validation:**
- [ ] Empty state message matches role (Tenant Admin/Owner)
- [ ] Empty state message matches role (Manager/Lead)
- [ ] Empty state message matches role (Contributor)
- [ ] `data-testid="attention-empty"` present

### Test 4: Telemetry Events

**Steps:**
1. Open browser DevTools → Network tab
2. Navigate to `/dashboard/okrs`
3. Click "Attention" button
4. Check console/network for telemetry events

**Expected Events:**
- `attention_drawer_opened` fired when drawer opens
  - Includes: `userId`, `cycleId`, `scope`, `timestamp`
- `attention_empty_state_viewed` fired when empty state shown
  - Includes: `userId`, `cycleId`, `scope`, `role`, `timestamp`

**Validation:**
- [ ] `attention_drawer_opened` event fires
- [ ] `attention_empty_state_viewed` event fires (if empty)
- [ ] Events include correct metadata

## Story B: Cycle Management Drawer

### Test 5: "Manage Cycles" Button Visibility

**Test as Tenant Admin/Owner:**
1. Log in as user with TENANT_OWNER or TENANT_ADMIN role
2. Navigate to `/dashboard/okrs`
3. Verify "Manage Cycles" button appears in toolbar

**Expected:**
- Button visible in toolbar
- Button clickable

**Test as Contributor:**
1. Log in as user without admin/owner role
2. Navigate to `/dashboard/okrs`
3. Verify "Manage Cycles" button does NOT appear

**Expected:**
- Button hidden
- CycleSelector footer link also hidden

**Validation:**
- [ ] Button visible for admin/owner
- [ ] Button hidden for non-admin users

### Test 6: Cycle Management Drawer - List View

**Steps:**
1. Log in as TENANT_ADMIN or TENANT_OWNER
2. Navigate to `/dashboard/okrs`
3. Click "Manage Cycles" button
4. Verify drawer opens and displays list of cycles

**Expected:**
- Drawer opens from right side
- Cycles listed with:
  - Name
  - Start Date and End Date (formatted as "DD MMM YYYY")
  - Status badge (Active, Locked, Archived, Draft)
- Actions available: Set Active, Edit, Archive, Delete

**Validation:**
- [ ] Drawer opens correctly
- [ ] Cycles displayed with all fields
- [ ] Date formatting correct (British format)
- [ ] Status badges display correctly

### Test 7: Create Cycle

**Steps:**
1. Open Cycle Management drawer
2. Click "+ New Cycle" button
3. Fill in form:
   - Name: "Q1 2025"
   - Start Date: 2025-01-01
   - End Date: 2025-03-31
   - Status: DRAFT
4. Click "Create" button
5. Verify cycle created and appears in list

**Expected:**
- Form appears inline
- Cycle created successfully
- Toast notification: "Cycle created"
- Cycle appears in list immediately
- Cycle dropdown updates (if viewing OKRs page)

**Validation:**
- [ ] Form validation works (required fields)
- [ ] Date validation works (start < end)
- [ ] Cycle created successfully
- [ ] List updates immediately
- [ ] Dropdown updates immediately

### Test 8: Edit Cycle

**Steps:**
1. Open Cycle Management drawer
2. Click "Edit" button on a cycle
3. Modify form fields:
   - Change name
   - Change dates
   - Change status
4. Click "Update" button
5. Verify cycle updated

**Expected:**
- Form pre-filled with cycle data
- Updates applied successfully
- Toast notification: "Cycle updated"
- List updates immediately

**Validation:**
- [ ] Form pre-filled correctly
- [ ] Updates applied successfully
- [ ] List updates immediately

### Test 9: Set Active

**Steps:**
1. Open Cycle Management drawer
2. Find a cycle with status != ACTIVE
3. Click "Set Active" button
4. Verify cycle status changes to ACTIVE

**Expected:**
- Status changes to ACTIVE
- Toast notification: "Cycle activated"
- List updates immediately
- Other cycles may change status (if backend enforces single active cycle)

**Validation:**
- [ ] Status changes correctly
- [ ] List updates immediately
- [ ] Toast notification appears

### Test 10: Archive Cycle

**Steps:**
1. Open Cycle Management drawer
2. Find a cycle with status != ARCHIVED
3. Click "Archive" button
4. Verify cycle status changes to ARCHIVED

**Expected:**
- Status changes to ARCHIVED
- Toast notification: "Cycle archived"
- List updates immediately

**Validation:**
- [ ] Status changes correctly
- [ ] List updates immediately
- [ ] Toast notification appears

### Test 11: Delete Cycle

**Test Case A: Cycle with No Linked OKRs**
1. Open Cycle Management drawer
2. Find a cycle with no linked OKRs
3. Click "Delete" button
4. Confirm deletion in dialog
5. Verify cycle deleted

**Expected:**
- Confirmation dialog appears
- Cycle deleted successfully
- Toast notification: "Cycle deleted"
- List updates immediately

**Test Case B: Cycle with Linked OKRs**
1. Open Cycle Management drawer
2. Find a cycle with linked OKRs
3. Click "Delete" button
4. Confirm deletion in dialog
5. Verify error message

**Expected:**
- Error message: "Cannot delete cycle: X objective(s) are linked to this cycle"
- Toast notification with error
- Cycle NOT deleted

**Validation:**
- [ ] Delete works for cycles without OKRs
- [ ] Delete fails for cycles with OKRs
- [ ] Error messages clear

### Test 12: CycleSelector Footer Link

**Steps:**
1. Log in as TENANT_ADMIN or TENANT_OWNER
2. Navigate to `/dashboard/okrs`
3. Click cycle selector dropdown
4. Scroll to bottom
5. Verify "Manage cycles…" link appears
6. Click link
7. Verify Cycle Management drawer opens

**Expected:**
- Link appears in footer of dropdown
- Link clickable
- Drawer opens when clicked
- Dropdown closes when link clicked

**Validation:**
- [ ] Link visible for admin/owner
- [ ] Link hidden for non-admin users
- [ ] Drawer opens correctly

### Test 13: RBAC Enforcement

**Test as Non-Admin User:**
1. Log in as user without admin/owner role
2. Try to access `/okr/cycles` endpoint directly (via Postman/curl)
3. Verify 403 Forbidden response

**Expected:**
- 403 Forbidden error
- Error message mentions permission requirement

**Validation:**
- [ ] Backend enforces RBAC
- [ ] Frontend hides controls for non-admin users

### Test 14: Telemetry Events

**Steps:**
1. Open browser DevTools → Network tab
2. Navigate to `/dashboard/okrs`
3. Perform cycle management actions:
   - Open drawer
   - Create cycle
   - Archive cycle
   - Set active
4. Check console/network for telemetry events

**Expected Events:**
- `cycle_drawer_opened` - When drawer opens
- `cycle_created` - When cycle created
- `cycle_archived` - When cycle archived
- `cycle_set_active` - When cycle set active

**Validation:**
- [ ] All telemetry events fire correctly
- [ ] Events include correct metadata

## Integration Tests

### Test 15: End-to-End Flow

**Steps:**
1. Create a new cycle via Cycle Management drawer
2. Set cycle as ACTIVE
3. Create an OKR linked to this cycle
4. Navigate to OKRs page
5. Verify cycle appears in dropdown
6. Select cycle from dropdown
7. Verify OKRs filtered by cycle

**Expected:**
- Cycle creation → Active status → OKR creation → Filtering all work together

**Validation:**
- [ ] Complete flow works end-to-end

## Edge Cases

### Test 16: Date Validation

**Steps:**
1. Open Cycle Management drawer
2. Click "+ New Cycle"
3. Set Start Date > End Date
4. Click "Create"
5. Verify error message

**Expected:**
- Error: "Start date must be before end date."

**Validation:**
- [ ] Date validation works correctly

### Test 17: Overlapping Cycles

**Steps:**
1. Create cycle with dates: 2025-01-01 to 2025-03-31
2. Try to create another cycle with overlapping dates
3. Verify error message

**Expected:**
- Error message about overlapping cycles

**Validation:**
- [ ] Overlap detection works (backend validation)

## Accessibility Tests

### Test 18: Keyboard Navigation

**Steps:**
1. Navigate to `/dashboard/okrs`
2. Use Tab key to navigate
3. Verify all buttons accessible
4. Open drawers using keyboard
5. Verify ESC key closes drawers

**Expected:**
- All interactive elements accessible via keyboard
- ESC closes drawers
- Focus trap works in drawers

**Validation:**
- [ ] Keyboard navigation works
- [ ] Focus trap works
- [ ] ESC key closes drawers

### Test 19: Screen Reader Support

**Steps:**
1. Enable screen reader (VoiceOver/NVDA)
2. Navigate to `/dashboard/okrs`
3. Verify all buttons have aria-labels
4. Verify drawer announcements work

**Expected:**
- All buttons announced correctly
- Drawer titles announced
- Status changes announced

**Validation:**
- [ ] Screen reader support works
- [ ] aria-labels present

## Performance Tests

### Test 20: Large Cycle Lists

**Steps:**
1. Create 50+ cycles
2. Open Cycle Management drawer
3. Verify performance
4. Verify pagination (if implemented)

**Expected:**
- Drawer opens quickly
- List renders efficiently
- No lag when scrolling

**Validation:**
- [ ] Performance acceptable with large lists

## Summary

After completing all tests, verify:
- [ ] All attention drawer features work correctly
- [ ] All cycle management features work correctly
- [ ] RBAC enforcement works
- [ ] Telemetry events fire correctly
- [ ] Accessibility requirements met
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] ESLint passes

