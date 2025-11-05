# STEP 0 - Quick Audit Summary

**Date:** 2025-11-05  
**Sprint:** OKR Mini Sprint 3

---

## List Page Composition

- **Main Page:** `apps/web/src/app/dashboard/okrs/page.tsx` (1316 lines)
- **Extracted Components:**
  - `OKRFilterBar.tsx` (186 lines) - Search, status filters, cycle selector
  - `OKRToolbar.tsx` (154 lines) - Scope toggle, attention button, add dropdown
  - `ObjectiveRow.tsx` - Objective row rendering

---

## Insights Endpoints Usage

### GET /okr/insights/cycle-summary
- **Existing Usage:** `CycleHealthStrip.tsx` (line 38)
- **Current Implementation:** Fetches cycle summary with `cycleId` query param
- **Response Format:**
  ```typescript
  {
    cycleId: string
    objectives: { total: number; published: number; draft: number }
    krs: { total: number; onTrack: number; atRisk: number; blocked: number; completed: number }
    checkins: { upcoming7d: number; overdue: number; recent24h: number }
  }
  ```
- **Backend:** `services/core-api/src/modules/okr/okr-insights.controller.ts` (line 31)
- **Note:** Backend accepts `cycleId` query param but does NOT currently accept `scope` param

### GET /okr/insights/objective/:id
- **Existing Usage:** `InlineInsightBar.tsx` (line 62)
- **Current Implementation:** Lazy-loaded via IntersectionObserver when row visible
- **Response Format:**
  ```typescript
  {
    objectiveId: string
    statusTrend: 'IMPROVING' | 'DECLINING' | 'FLAT' | 'UNKNOWN'
    lastUpdateAgeHours: number
    krs: { onTrack: number; atRisk: number; blocked: number; completed: number }
    upcomingCheckins: number
    overdueCheckins: number
  }
  ```
- **Backend:** `services/core-api/src/modules/okr/okr-insights.controller.ts` (line 52)
- **Note:** Backend respects visibility filtering automatically

---

## "Why" Tooling

### RbacWhyTooltip.tsx
- **Location:** `apps/web/src/components/rbac/RbacWhyTooltip.tsx`
- **Current Feature Flag:** `featureFlags.rbacInspector` (from `user.features.rbacInspector`)
- **Current Behaviour:** Only renders when `rbacInspector` feature flag is enabled
- **Shows:** Detailed permission reasoning with checkmarks/crosses for various deny reasons

### useTenantPermissions.ts
- **Location:** `apps/web/src/hooks/useTenantPermissions.ts`
- **Provides:** `getLockInfoForObjective()` and `getLockInfoForKeyResult()`
- **Returns LockInfo:**
  ```typescript
  {
    isLocked: boolean
    reason: 'published' | 'cycle_locked' | null
    message: string
  }
  ```

---

## User Flag for Dev Inspector

### Source of Truth
- **Storage:** `users.settings.debug.rbacInspectorEnabled` (JSONB column)
- **Backend Service:** `services/core-api/src/modules/rbac/rbac-inspector.service.ts`
- **Controller:** `services/core-api/src/modules/rbac/rbac-inspector.controller.ts`

### Exposure Path
1. **JWT Strategy:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts` (line 105)
   - Calls `inspectorService.getInspectorEnabled(user.id)`
   - Exposes as `user.features.rbacInspector` in JWT payload

2. **Frontend Hook:** `apps/web/src/hooks/useFeatureFlags.ts`
   - Reads `user?.features?.rbacInspector === true`
   - Returns `{ rbacInspector: boolean }`

3. **Current Usage:** `RbacWhyTooltip.tsx` uses `featureFlags.rbacInspector`

### Toggle Location
- **UI:** `apps/web/src/app/dashboard/settings/people/page.tsx` (line 1415)
- **Endpoint:** `POST /rbac/inspector/enable` with `{ userId, enabled }`
- **Permission:** Requires `manage_users` action

---

## Cycle Health Strip Status

- **Component:** `CycleHealthStrip.tsx`
- **Usage:** Already rendered in `page.tsx` (line 848)
- **Current Props:** `{ cycleId: string | null }`
- **Current Behaviour:** Non-interactive summary strip (tooltip only)
- **Note:** Already matches requirement - non-interactive, summary-only

---

## Confirmation

✅ **ONE interactive filter bar** - Confirmed: `OKRFilterBar.tsx` is the only interactive filter set  
✅ **Cycle Health content remains non-interactive** - Confirmed: `CycleHealthStrip.tsx` is summary-only with tooltip  
✅ **No second filter set** - Confirmed: GovernanceStatusBar will be summary-only (similar to CycleHealthStrip)

---

## Next Steps

1. **Story A:** Create `GovernanceStatusBar.tsx` that accepts `scope` param and fetches cycle-summary
2. **Story B:** Enhance `RbacWhyTooltip.tsx` or create `WhyCantIInspector.tsx` for "Why?" links
3. **Story C:** Enhance `ObjectiveRow.tsx` to use `InlineInsightBar` or add inline health hints

---

**Backend Note:** The `/okr/insights/cycle-summary` endpoint does NOT currently accept a `scope` parameter. The backend filters by visibility automatically based on the requester's context. We may need to add `scope` support to the backend endpoint, or the frontend can add it as a query param and backend can ignore it if not needed (since visibility is already enforced server-side).

