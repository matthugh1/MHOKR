# OKR Mini Sprint 4.0 – Implementation Notes

**Date:** 2025-01-XX  
**Sprint:** Mini Sprint 4.0 – Context & Governance Refinement

## Overview

This sprint combines attention drawer polish (Mini Sprint 3.2) and cycle management drawer (Mini Sprint 4.0) into one cohesive release. The goal is to improve governance clarity and actionable context on the OKR page by aligning scope/cycle behaviour, fixing cycle confusion, and completing the "Attention → Action" user loop.

## Story A: Attention Drawer Polish

### Changes Made

1. **Badge Count in Button Title**
   - Updated `OKRToolbar.tsx` to display badge count in button title (e.g., "Attention (4)")
   - Button now shows text label instead of icon-only
   - Badge count displayed as overlay badge when > 0

2. **Scope-Aware Filtering**
   - Added `scope` prop to `AttentionDrawer` component
   - Drawer now filters by current `scope` and `cycleId` when opened
   - Pre-fetches data using `/okr/insights/attention?scope={scope}&cycleId={cycleId}`

3. **Role-Aware Empty States**
   - Implemented `getUserRole()` helper function to detect user role
   - Empty state messages vary by role:
     - **Tenant Admin/Owner**: "No items need your attention. All OKRs are on track."
     - **Manager/Lead**: "No team items need attention right now."
     - **Contributor**: "Nothing needs your attention."
   - Added `data-testid="attention-empty"` for validation

4. **Telemetry**
   - Replaced `console.log` with `track()` calls
   - `attention_drawer_opened` event fired when drawer opens (includes scope + cycleId)
   - `attention_empty_state_viewed` event fired when empty state is shown (includes role + scope metadata)

### Files Modified

- `apps/web/src/components/okr/AttentionDrawer.tsx`
- `apps/web/src/app/dashboard/okrs/components/OKRToolbar.tsx`
- `apps/web/src/app/dashboard/okrs/page.tsx`

## Story B: Cycle Management Drawer

### Changes Made

1. **New Component: CycleManagementDrawer**
   - Created `apps/web/src/app/dashboard/okrs/components/CycleManagementDrawer.tsx`
   - Lists all cycles with name, start/end dates, and status
   - Inline form for creating/editing cycles:
     - Name (string input)
     - Start Date / End Date (date pickers)
     - Status (select: DRAFT, ACTIVE, LOCKED, ARCHIVED)
   - Actions:
     - "Set Active" button (sets cycle status to ACTIVE)
     - "Archive" button (sets cycle status to ARCHIVED)
     - "Delete" button (deletes cycle if no linked OKRs)
     - "+ New Cycle" button (opens inline creation form)

2. **Backend Integration**
   - Calls backend endpoints:
     - `GET /okr/cycles` - Fetch all cycles
     - `POST /okr/cycles` - Create new cycle
     - `PATCH /okr/cycles/:id` - Update cycle
     - `PATCH /okr/cycles/:id/status` - Update cycle status
     - `DELETE /okr/cycles/:id` - Delete cycle
   - All endpoints protected by RBAC (requires `manage_cycles` permission or TENANT_OWNER/TENANT_ADMIN role)

3. **RBAC Integration**
   - "Manage Cycles" button only visible to TENANT_OWNER / TENANT_ADMIN
   - Checks `permissions.isTenantAdminOrOwner(currentOrganization?.id)`
   - Backend guards enforce tenant isolation

4. **UI Integration**
   - Added "Manage Cycles" button to `OKRToolbar.tsx` (admin/owner only)
   - Added optional link in `CycleSelector` footer ("Manage cycles…")
   - Drawer integrated into `page.tsx` with state management

5. **State Updates**
   - No page reload required - state updates via `loadActiveCycles()` callback
   - Cycle dropdown refreshes immediately after create/update/delete

6. **Telemetry**
   - `cycle_drawer_opened` - Fired when drawer opens
   - `cycle_created` - Fired when cycle is created
   - `cycle_archived` - Fired when cycle is archived
   - `cycle_set_active` - Fired when cycle is set as active

### Files Created

- `apps/web/src/app/dashboard/okrs/components/CycleManagementDrawer.tsx`

### Files Modified

- `apps/web/src/app/dashboard/okrs/components/OKRToolbar.tsx`
- `apps/web/src/components/ui/CycleSelector.tsx`
- `apps/web/src/app/dashboard/okrs/components/OKRFilterBar.tsx`
- `apps/web/src/app/dashboard/okrs/page.tsx`

## Technical Details

### British English Copy

All user-facing text uses British English:
- "organisation" (not "organization")
- "Manage cycles" (not "Manage Cycles")
- "Nothing needs your attention." (not "No items need attention")

### Accessibility

- All buttons have `aria-label` attributes
- Drawer titles use `aria-labelledby` and `aria-describedby`
- Focus trap implemented for drawer accessibility
- Keyboard navigation support (ESC to close)

### Error Handling

- Backend validation errors mapped to user-friendly messages via `mapErrorToMessage()`
- Toast notifications for success/error states
- Graceful degradation if permission denied

### Performance

- No unnecessary re-renders
- State updates only when needed
- Drawer loads cycles on open (not on mount)

## Testing Notes

1. **Attention Drawer**
   - Verify badge count updates when scope changes
   - Verify empty state message matches user role
   - Verify drawer filters by scope and cycleId
   - Verify telemetry events fire correctly

2. **Cycle Management**
   - Verify "Manage Cycles" button only visible to admin/owner
   - Verify CRUD operations work correctly
   - Verify cycle dropdown updates immediately after changes
   - Verify RBAC enforcement (403 errors for non-admin users)
   - Verify telemetry events fire correctly

## Backend Endpoints

All endpoints already exist in `services/core-api/src/modules/okr/okr-cycle.controller.ts`:
- `GET /okr/cycles` ✅
- `POST /okr/cycles` ✅
- `PATCH /okr/cycles/:id` ✅
- `PATCH /okr/cycles/:id/status` ✅
- `DELETE /okr/cycles/:id` ✅

All endpoints protected by `checkCycleManagementPermission()` which requires:
- `manage_workspaces` OR `manage_tenant_settings` permission
- OR `TENANT_OWNER` / `TENANT_ADMIN` role

## Future Enhancements

- [ ] Add date range validation in frontend
- [ ] Add cycle overlap detection UI feedback
- [ ] Add bulk archive/delete operations
- [ ] Add cycle templates for common patterns (Q1, Q2, etc.)

