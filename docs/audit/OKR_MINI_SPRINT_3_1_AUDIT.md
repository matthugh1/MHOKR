# STEP 0 - Pre-Flight Audit Summary

**Date:** 2025-11-05  
**Sprint:** OKR Mini Sprint 3.1  
**Branch:** `chore/okr-mini-sprint-3-1`  
**Commit:** `aa11ef9` (from chore/okr-mini-sprint-3)

---

## 1. Current Branch & Commit
- **Branch:** `chore/okr-mini-sprint-3-1` ✅
- **Base Commit:** `aa11ef9` ✅

---

## 2. Component Summaries

### OKRToolbar.tsx
- **Location:** `apps/web/src/app/dashboard/okrs/components/OKRToolbar.tsx`
- **Exports:** `OKRToolbar` component
- **Key Props:**
  - `attentionCount: number` ✅ Already receives count
  - `selectedScope: 'my' | 'team-workspace' | 'tenant'` ✅ Already receives scope
  - `onOpenAttentionDrawer: () => void` ✅
- **Current Implementation:**
  - ✅ Badge already renders when `attentionCount > 0` (lines 101-109)
  - ✅ Badge shows count (capped at 99+)
  - ❌ **MISSING:** Badge doesn't update when scope changes (attentionCount comes from parent, not fetched in toolbar)
  - ❌ **MISSING:** `data-testid="attention-badge"` not present
  - ❌ **MISSING:** `cycleId` prop not received

### GovernanceStatusBar.tsx
- **Location:** `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx`
- **Exports:** `GovernanceStatusBar` component
- **Key Props:**
  - `cycleId: string` ✅
  - `scope: 'my' | 'team-workspace' | 'tenant'` ✅
- **Current Implementation:**
  - ✅ Non-interactive summary badges
  - ✅ `data-testid="gov-status-bar"` present
  - ❌ **MISSING:** No tooltip/hover hint explaining "summary only"
  - ❌ **MISSING:** No `aria-describedby` for accessibility

### page.tsx
- **Location:** `apps/web/src/app/dashboard/okrs/page.tsx`
- **Current Implementation:**
  - ✅ `loadAttentionCount()` function exists (line 344)
  - ✅ Fetches from `/okr/insights/attention` with `cycleId`
  - ❌ **MISSING:** `loadAttentionCount()` doesn't include `scope` parameter
  - ✅ Calls `loadAttentionCount()` in useEffect (line 286)
  - ❌ **MISSING:** useEffect doesn't depend on `selectedScope`

### OKRPageContainer.tsx
- **Location:** `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx`
- **Purpose:** Container component for OKR list
- **Key Props:** Receives `selectedScope` and `selectedCycleId` ✅

### analytics.ts
- **Location:** `apps/web/src/lib/analytics.ts`
- **Exports:** `track(name: string, payload: Record<string, unknown>)` ✅
- **Status:** Ready to use

---

## 3. Endpoint Verification

### GET /okr/insights/attention
- **Location:** `services/core-api/src/modules/okr/okr-insights.controller.ts` (line 80)
- **Query Params:**
  - `cycleId` (optional) ✅
  - `page` (optional, default: 1) ✅
  - `pageSize` (optional, default: 20, max: 50) ✅
  - ❌ **MISSING:** `scope` parameter not accepted
- **Response Format:**
  ```typescript
  {
    page: number
    pageSize: number
    totalCount: number ✅ // Available in response
    items: Array<AttentionItem>
  }
  ```
- **Note:** Backend respects visibility automatically; scope filtering happens server-side via user context

### GET /okr/insights/cycle-summary
- **Location:** `services/core-api/src/modules/okr/okr-insights.controller.ts` (line 31)
- **Query Params:**
  - `cycleId` (required) ✅
  - ❌ **MISSING:** `scope` parameter not accepted (but visibility enforced server-side)

---

## 4. Existing Implementations Check

### Attention Badge
- **Status:** ✅ **PARTIALLY IMPLEMENTED**
- **Location:** `OKRToolbar.tsx` lines 101-109
- **Current:** Badge renders when `attentionCount > 0`
- **Issues:**
  - Count doesn't update when scope changes (only depends on cycleId)
  - No `data-testid="attention-badge"`
  - No telemetry for badge load
  - `loadAttentionCount()` in page.tsx doesn't use scope

### Governance Status Bar Tooltip
- **Status:** ❌ **NOT IMPLEMENTED**
- **Needed:** Hover hint explaining "summary only"

---

## 5. Required Changes

### Story 3.1A: Attention Badge Count
1. Update `loadAttentionCount()` in `page.tsx` to accept scope (backend filters automatically)
2. Update useEffect dependency to include `selectedScope`
3. Add `data-testid="attention-badge"` to badge in `OKRToolbar.tsx`
4. Add telemetry: `attention_badge_loaded` event
5. Move attention count fetching to `OKRToolbar.tsx` OR keep in page.tsx but pass scope to API call

### Story 3.1B: Governance Status Bar Tooltip
1. Wrap GovernanceStatusBar container with Tooltip component
2. Add tooltip text: "Summary only — use the filters below to refine what you see."
3. Add `aria-describedby` for accessibility
4. Add `data-testid="gov-status-hint"`

---

## 6. Decision: Where to Fetch Attention Count?

**Option A:** Keep in `page.tsx`, update to include scope
- Pros: Centralized state management
- Cons: Need to update useEffect dependencies

**Option B:** Move to `OKRToolbar.tsx`
- Pros: Component owns its data fetching
- Cons: Duplicates logic if drawer also needs count

**Recommendation:** **Option A** - Update `loadAttentionCount()` in page.tsx to include scope parameter (even though backend doesn't accept it, it's good for future-proofing and clarity). Backend filters by user context automatically.

---

**Ready to proceed with implementation.**



