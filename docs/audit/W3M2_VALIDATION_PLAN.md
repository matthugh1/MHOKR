# SERVER_PAGINATION_AND_VISIBILITY

# Validation Plan for W3.M2 – Backend-driven Pagination & Visibility Enforcement

## Overview

This milestone implements server-side pagination and visibility enforcement for the OKR list and analytics endpoints. After W3.M2:

1. The backend exposes a paginated OKR overview endpoint that enforces tenant isolation and per-objective visibility before serializing
2. The frontend OKRPageContainer requests `?page=N&pageSize=20` instead of fetching everything then slicing
3. Analytics/reporting endpoints filter their calculations to only include objectives/KRs the caller can view

## Validation Steps

### 1. Pagination Correctness

**Test Case:** Pagination works correctly with server-side slicing

**Steps:**
1. Log in as TENANT_ADMIN
2. Open `/dashboard/okrs`
3. Open browser Network tab (DevTools → Network)
4. Verify request shows: `/okr/overview?page=1&pageSize=20`
5. Click "Next" button
6. Verify request shows: `/okr/overview?page=2&pageSize=20`
7. Verify UI renders page 2 immediately using server data
8. Verify no client-side slicing is happening (check that the response contains exactly `pageSize` objectives, not all objectives)

**Expected Results:**
- Network requests show `page` and `pageSize` query parameters
- Page 1 loads with exactly 20 objectives (or fewer if totalCount < 20)
- Page 2 loads with next 20 objectives
- UI shows correct pagination info: "Showing X - Y of Z objectives"
- No client-side filtering/slicing of objectives (backend already filtered)

### 2. Visibility Correctness - WORKSPACE_LEAD

**Test Case:** WORKSPACE_LEAD cannot see PRIVATE exec-only objectives outside their scope

**Steps:**
1. Create a PRIVATE objective owned by a different workspace/team
2. Log in as WORKSPACE_LEAD (not TENANT_ADMIN)
3. Open `/dashboard/okrs`
4. Inspect network response for `/okr/overview?page=1&pageSize=20`
5. Search the JSON response for the PRIVATE objective ID

**Expected Results:**
- Network response JSON does NOT include PRIVATE objectives outside the user's scope
- UI does not show PRIVATE objectives the user cannot see
- No client-side filtering needed (backend already filtered)

### 3. Visibility Correctness - CONTRIBUTOR

**Test Case:** CONTRIBUTOR cannot see PRIVATE / exec-only objectives they shouldn't see

**Steps:**
1. Create a PRIVATE objective with ownerId != contributor's userId
2. Ensure contributor is NOT in the privateWhitelist or execOnlyWhitelist
3. Log in as CONTRIBUTOR
4. Open `/dashboard/okrs`
5. Inspect network response for `/okr/overview?page=1&pageSize=20`

**Expected Results:**
- Network response JSON does NOT include PRIVATE objectives the contributor cannot see
- UI does not show PRIVATE objectives
- No client-side filtering needed (backend already filtered)

### 4. Governance Correctness - Published/Locked OKRs

**Test Case:** canEdit/canDelete flags respect publish lock and cycle lock

**Steps:**
1. Create/pick an objective that is:
   - `isPublished: true` OR in a cycle with `status: 'LOCKED'` or `'ARCHIVED'`
2. Log in as WORKSPACE_LEAD (not TENANT_ADMIN)
3. Open `/dashboard/okrs`
4. Inspect network response for that objective
5. Verify `canEdit: false` and `canDelete: false` in the response
6. Verify UI does not show edit/delete buttons for that objective
7. Log in as TENANT_ADMIN
8. Inspect network response for the same objective
9. Verify `canEdit: true` and `canDelete: true` (admin override)

**Expected Results:**
- WORKSPACE_LEAD receives `canEdit: false` and `canDelete: false` for locked/published OKRs
- UI does not render destructive controls for WORKSPACE_LEAD
- TENANT_ADMIN receives `canEdit: true` and `canDelete: true` (admin override)
- UI renders destructive controls for TENANT_ADMIN

### 5. SUPERUSER Behavior

**Test Case:** SUPERUSER can see all objectives but cannot edit/delete

**Steps:**
1. Log in as SUPERUSER (user with `isSuperuser: true`, `organizationId: null`)
2. Open `/dashboard/okrs`
3. Inspect network response for `/okr/overview?page=1&pageSize=20`
4. Verify response includes objectives from all tenants
5. Verify each objective has `canEdit: false` and `canDelete: false`
6. Verify UI does not show edit/delete buttons

**Expected Results:**
- SUPERUSER receives all tenant objectives in the response (visibility bypass)
- SUPERUSER receives `canEdit: false` and `canDelete: false` for all objectives (read-only)
- UI does not show destructive actions to SUPERUSER

### 6. Analytics Correctness

**Test Case:** Analytics endpoints filter by visibility

**Endpoints to test:**
- `/reports/analytics/summary`
- `/reports/analytics/feed`
- `/reports/check-ins/overdue`
- `/reports/pillars/coverage`

**Steps:**

**A. Test as WORKSPACE_LEAD:**
1. Create a PRIVATE objective with `status: 'AT_RISK'`
2. Log in as WORKSPACE_LEAD
3. Call `/reports/analytics/summary`
4. Verify `totalObjectives` does NOT include the PRIVATE objective
5. Verify `byStatus.AT_RISK` does NOT include the PRIVATE objective
6. Call `/reports/analytics/feed`
7. Verify feed does NOT include check-ins for KRs under the PRIVATE objective
8. Call `/reports/check-ins/overdue`
9. Verify overdue list does NOT include KRs under the PRIVATE objective
10. Call `/reports/pillars/coverage`
11. Verify pillar coverage does NOT include the PRIVATE objective

**B. Test as TENANT_ADMIN:**
1. Log in as TENANT_ADMIN
2. Call `/reports/analytics/summary`
3. Verify `totalObjectives` includes ALL objectives (including PRIVATE)
4. Verify analytics numbers match full tenant scope

**Expected Results:**
- WORKSPACE_LEAD analytics exclude PRIVATE/exec-only OKRs they cannot view
- TENANT_ADMIN analytics include all OKRs (full visibility)
- No sensitive data leaks through aggregate numbers

### 7. Regression Testing

**Test Case:** Large tenant performance and UI correctness

**Steps:**
1. Create a tenant with 200+ objectives / 600+ KRs
2. Log in as TENANT_ADMIN
3. Open `/dashboard/okrs`
4. Verify:
   - Page 1 loads fast (< 2 seconds)
   - Scrolling is smooth (virtualisation still active)
   - No flicker or "ghost row then disappear" issues
   - No console errors in browser related to undefined props or missing fields
   - Pagination controls work correctly (Next/Previous buttons)

**Expected Results:**
- Page 1 loads quickly (only 20 objectives fetched)
- Virtualisation works smoothly
- No UI flicker or ghost rows
- No console errors
- Pagination works correctly

### 8. Code Quality Checks

**Test Case:** No TODO/FIXME/HACK comments

**Steps:**
1. Search backend codebase for:
   - `TODO` in `okr-overview.controller.ts`
   - `TODO` in `okr-visibility.service.ts`
   - `TODO` in `okr-reporting.service.ts`
   - `FIXME` or `HACK` in any of these files
2. Search frontend codebase for:
   - `TODO` in `OKRPageContainer.tsx` related to pagination/visibility
   - `FIXME` or `HACK` in `OKRPageContainer.tsx`

**Expected Results:**
- No TODO/FIXME/HACK comments related to W3.M2 implementation
- All logic is implemented or wrapped in real helpers/services

## Summary Checklist

- [ ] Pagination works correctly (page/pageSize params, correct slicing)
- [ ] WORKSPACE_LEAD cannot see PRIVATE objectives outside scope
- [ ] CONTRIBUTOR cannot see PRIVATE/exec-only objectives
- [ ] canEdit/canDelete flags respect publish/cycle locks
- [ ] SUPERUSER sees all but cannot edit/delete
- [ ] Analytics endpoints filter by visibility (summary, feed, overdue, pillars)
- [ ] Large tenant performance is acceptable
- [ ] No console errors or UI flicker
- [ ] No TODO/FIXME/HACK comments

## Files Changed

### Backend:
- `services/core-api/src/modules/okr/okr-visibility.service.ts` (NEW)
- `services/core-api/src/modules/okr/okr-overview.controller.ts` (UPDATED)
- `services/core-api/src/modules/okr/okr-reporting.service.ts` (UPDATED)
- `services/core-api/src/modules/okr/okr-reporting.controller.ts` (UPDATED)
- `services/core-api/src/modules/okr/okr.module.ts` (UPDATED - added OkrVisibilityService)

### Frontend:
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (UPDATED)

## Key Changes Summary

1. **New OkrVisibilityService**: Server-side visibility enforcement matching frontend logic
2. **Pagination**: Backend now accepts `page` and `pageSize` (default 20, max 50), filters by visibility BEFORE pagination
3. **Response Envelope**: Backend returns `{ page, pageSize, totalCount, objectives }` with `canEdit`/`canDelete`/`canCheckIn` flags
4. **Frontend**: Uses paginated API, removes client-side slicing and visibility filtering
5. **Analytics**: All analytics endpoints now filter by visibility before aggregating


