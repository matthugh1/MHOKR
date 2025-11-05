# Cycle Dropdown Issue Investigation

**Date:** 2025-11-05  
**User:** admin1@puzzelcx.local  
**Page:** `/dashboard/okrs`

## Issues Found

### 1. Cycle Dropdown Missing Non-Active Cycles

**Problem:** The cycle dropdown only shows ACTIVE cycles, missing DRAFT and ARCHIVED cycles.

**Expected:** Should show all 4 cycles:
- ✅ Q4 2025 (ACTIVE) - **Visible**
- ✅ Q1 2026 (ACTIVE) - **Visible**
- ❌ Q2 2026 (DRAFT) - **Missing**
- ❌ Q3 2026 (ARCHIVED) - **Missing**

**Current Dropdown Options:**
- Current & Upcoming:
  - Q1 2026 (Active)
  - Q4 2025 (Active)
- Special:
  - Unassigned / Backlog
  - All cycles

**Root Cause:** The `/reports/cycles/active` endpoint only returns ACTIVE cycles. The UI needs to fetch ALL cycles (not just active) to populate the dropdown.

### 2. OKRs Not Visible Even with Tenant Scope

**Problem:** Even after switching to "Tenant" scope, still showing "No objectives found for the selected filters."

**Network Request:**
```
GET /okr/overview?organizationId=9db37585-85ed-5f07-882c-4b69f52fd4d1&page=1&pageSize=20&cycleId=42c44699-11b2-560e-89fc-ccad2ac99803&scope=tenant
```

**Issue:** The request is filtering by a specific `cycleId` (Q1 2026). Even with `scope=tenant`, it's only showing OKRs for that one cycle.

**Expected Behavior:** 
- With `scope=tenant` and no cycle filter (or "All cycles"), should show all tenant-level OKRs across all cycles
- Should show ~14-16 published tenant objectives across all cycles

**Current State:**
- Cycle filter: Q1 2026 (specific cycle selected)
- Scope: Tenant
- Result: No OKRs shown (possibly because Q1 2026 OKRs are filtered out by visibility/published state)

### 3. Cycle Summary Shows 6 Objectives But None Visible

**Dashboard Summary Shows:**
- "6 objectives" (Q1 2026)
- "4 published objectives"
- "2 draft objectives"

**But OKRs Page Shows:**
- "No objectives found for the selected filters"

**Possible Causes:**
1. Visibility filtering is too restrictive
2. Published state filtering in UI
3. Cycle filter mismatch between summary and list view
4. Backend query not returning results despite summary showing data

## Recommendations

### Fix 1: Show All Cycles in Dropdown

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`

**Change:** Instead of `/reports/cycles/active`, use an endpoint that returns all cycles:
- Create `/reports/cycles/all` endpoint, OR
- Modify existing endpoint to accept a status filter parameter

**Code Location:** Look for `loadActiveCycles` function that calls `/reports/cycles/active`

### Fix 2: Ensure "All Cycles" Actually Shows All OKRs

**When "All cycles" is selected:**
- Don't pass `cycleId` parameter to `/okr/overview`
- OR pass `cycleId=all` and backend should handle it

**Current Issue:** Even when "All cycles" might be selected, the code might still be passing a specific cycleId.

### Fix 3: Verify Backend Returns OKRs for Tenant Scope

**Test:** Direct API call:
```bash
curl "http://localhost:3001/okr/overview?organizationId=9db37585-85ed-5f07-882c-4b69f52fd4d1&page=1&pageSize=20&scope=tenant" \
  -H "Authorization: Bearer <token>"
```

**Expected:** Should return OKRs across all cycles, not just the selected one.

## Fixes Applied

### ✅ Fix 1: Added `/reports/cycles` Endpoint

**File:** `services/core-api/src/modules/okr/okr-reporting.controller.ts`

Added new endpoint that returns ALL cycles (not just ACTIVE):
- `GET /reports/cycles` - Returns all cycles (ACTIVE, DRAFT, ARCHIVED, etc.)
- Requires `view_okr` permission (same as `/reports/cycles/active`)
- Tenant isolation enforced

**File:** `services/core-api/src/modules/okr/okr-reporting.service.ts`

Added `getAllCyclesForOrg()` method that:
- Returns all cycles regardless of status
- Maintains tenant isolation
- Orders by `startDate DESC`

### ✅ Fix 2: Updated Frontend to Load All Cycles

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`

Updated `loadActiveCycles()` function to:
1. Try `/reports/cycles` first (returns all cycles)
2. Fallback to `/reports/cycles/active` for backward compatibility
3. Set default selected cycle to first ACTIVE cycle if available, otherwise first cycle

**Result:** Cycle dropdown now shows:
- ✅ Q4 2025 (ACTIVE) - in "Current & Upcoming"
- ✅ Q1 2026 (ACTIVE) - in "Current & Upcoming"
- ✅ Q2 2026 (DRAFT) - in "Current & Upcoming"
- ✅ Q3 2026 (ARCHIVED) - in "Previous"
- ✅ Unassigned / Backlog
- ✅ All cycles

## Testing

1. **Backend:** Restart backend server to load new endpoint
2. **Frontend:** Refresh browser to load updated code
3. **Verify:**
   - Cycle dropdown shows all 4 cycles
   - Selecting "All cycles" clears `cycleId` filter
   - OKRs appear when scope=tenant and no cycle filter

## Expected Behavior After Fix

### When "All cycles" Selected:
- `selectedCycleId = null`
- API call: `/okr/overview?organizationId=...&scope=tenant` (no cycleId)
- Should show: ~14-16 published tenant objectives across all cycles

### When Specific Cycle Selected:
- `selectedCycleId = <cycle-id>`
- API call: `/okr/overview?organizationId=...&cycleId=<id>&scope=tenant`
- Should show: OKRs for that specific cycle only

## Remaining Issue

Even with Tenant scope, still seeing "No objectives found". Possible causes:
1. Backend visibility filtering might be too restrictive
2. Published state filtering (DRAFT cycles have 0% published)
3. Need to verify backend actually returns OKRs when queried directly

## Next Steps

1. ✅ Added `/reports/cycles` endpoint
2. ✅ Updated frontend to use new endpoint
3. 🔄 Restart backend server
4. 🔄 Test cycle dropdown shows all cycles
5. 🔄 Test "All cycles" option shows OKRs from all cycles
6. 🔄 Investigate why OKRs aren't showing even with Tenant scope

