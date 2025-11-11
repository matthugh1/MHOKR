# OKR Trio Audit - Network & Logging Capture (ALL)

**Date:** 2025-01-XX  
**Reviewers:** Product Director, Product Manager, Tech Lead  
**Scope:** Network requests and logging analysis

---

## A. HAR File Capture

**Status:** ⚠️ HAR file not captured (requires live browser testing)

**Recommendation:**
- Capture HAR file during live testing:
  1. Open browser DevTools → Network tab
  2. Enable "Preserve log" option
  3. Perform actions:
     - Toggle scope segments (My → Team/Workspace → Tenant)
     - Apply filters (status, cycle, search)
     - Expand rows (click objective to show KRs)
     - Navigate to Builder view (if feature flag enabled)
  4. Export HAR: Right-click → "Save all as HAR with content"
  5. Save to: `docs/audit/artifacts/okr_audit.har`

**Expected Network Calls:**
- `GET /okr/overview?organizationId=xxx&page=1&pageSize=20`
- `GET /reports/cycles/active`
- `GET /reports/check-ins/overdue`
- `GET /okr/insights/attention?cycleId=xxx`
- `GET /users` (if user has manage_users permission)

---

## B. Notable Network Findings (Placeholder)

### B.1 4xx/5xx Errors

**Status:** ⚠️ Requires live testing

**Expected Issues:**
- 403 Forbidden: User lacks permission (should show error message)
- 404 Not Found: Service not found (should show error message)
- 400 Bad Request: Invalid query params (should validate client-side)

**Recommendation:**
- Capture all 4xx/5xx errors during testing
- Verify error handling: show user-friendly messages
- Document error scenarios

---

### B.2 Slow Calls (>300ms)

**Status:** ⚠️ Requires live testing

**Expected Slow Calls:**
- `/okr/overview` - May be slow with large datasets (visibility filtering per objective)
- `/okr/insights/cycle-summary` - May be slow (aggregation query)
- `/okr/insights/attention` - May be slow (complex query)

**Recommendation:**
- Measure response times during testing
- Identify slow endpoints (>300ms)
- Optimize slow queries (add indexes, cache results)

---

### B.3 Noisy Chatter

**Status:** ⚠️ Requires live testing

**Expected Noisy Calls:**
- Multiple `/okr/overview` calls on filter changes (should debounce)
- `/reports/check-ins/overdue` called on every render (should memoize)
- `/okr/insights/attention` called on every cycle change (should debounce)

**Recommendation:**
- Identify unnecessary API calls
- Add debouncing/throttling for filter changes
- Memoize API calls (don't refetch if params unchanged)

---

## C. Audit Log Events

### C.1 Sensitive Actions

**Expected Audit Log Events:**
- `view_user_access` - User views another user's OKRs (PRIVATE visibility)
- `create_okr` - User creates new objective
- `publish_okr` - User publishes objective
- `edit_okr` - User edits objective (if published, should log lock bypass)
- `delete_okr` - User deletes objective

**Status:** ⚠️ Requires backend verification

**Recommendation:**
- Verify audit log events fire for sensitive actions
- Document audit log events in `AUDIT_LOGS.md`
- Add frontend telemetry to complement audit logs

**Files:**
- `services/core-api/src/modules/rbac/audit.ts` (audit log service)

---

## D. Network Performance Budgets

### D.1 Page Load Performance

**Target:** < 1s for 20 objectives

**Measured:** ⚠️ Requires live testing

**Recommendation:**
- Measure page load time during testing
- Identify bottlenecks (API calls, rendering)
- Optimize slow operations

---

### D.2 API Response Times

**Target:** < 200ms for `/okr/overview`

**Measured:** ⚠️ Requires live testing

**Recommendation:**
- Measure API response times during testing
- Identify slow queries (add indexes, optimize)
- Add performance monitoring (track response times)

---

### D.3 Scroll Performance

**Target:** 60 FPS during virtualised list scroll

**Measured:** ⚠️ Requires live testing

**Recommendation:**
- Measure scroll FPS during testing
- Verify virtualisation maintains 60 FPS
- Optimize row rendering if FPS drops

---

## E. Network Request Patterns

### E.1 Scope Toggle

**Expected Pattern:**
```
GET /okr/overview?organizationId=xxx&scope=my&page=1&pageSize=20
GET /okr/overview?organizationId=xxx&scope=team-workspace&page=1&pageSize=20
GET /okr/overview?organizationId=xxx&scope=tenant&page=1&pageSize=20
```

**Actual Pattern:** ⚠️ Requires live testing

**Issue:** Scope not sent as query param (relies on backend visibility)

**Recommendation:**
- Add `scope` query param to backend
- Verify scope toggle triggers new API call

---

### E.2 Filter Changes

**Expected Pattern:**
```
GET /okr/overview?organizationId=xxx&cycleId=abc&status=ON_TRACK&page=1&pageSize=20
```

**Actual Pattern:** ⚠️ Requires live testing

**Issue:** Some filters applied client-side (workspace, team, owner, search)

**Recommendation:**
- Move all filters to backend query params
- Verify filter changes trigger new API call (not client-side filtering)

---

### E.3 Row Expansion

**Expected Pattern:**
- No new API call (data already fetched in `/okr/overview`)

**Actual Pattern:** ⚠️ Requires live testing

**Recommendation:**
- Verify row expansion doesn't trigger new API call
- Verify KRs and Initiatives already included in response

---

## F. Logging Analysis

### F.1 Console.log Statements

**Found:** 42 `console.log`/`console.error` statements in production code

**Impact:**
- Production noise
- Performance overhead
- Security risk (may leak sensitive data)

**Recommendation:**
- Remove all `console.log` statements (except telemetry)
- Replace telemetry `console.log` with analytics service
- Add ESLint rule: `no-console` (allow `console.error` for errors only)

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx` (16 instances)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` (19 instances)
- `services/core-api/src/modules/okr/okr-overview.controller.ts` (debug logging)

---

### F.2 Backend Debug Logging

**Found:** Extensive debug logging in `okr-overview.controller.ts`

**Impact:**
- Production noise
- Performance overhead
- May leak sensitive data (user IDs, objective IDs)

**Recommendation:**
- Remove debug logging (lines 157, 178-189, 206-234)
- Use structured logging (Winston/Pino) with log levels
- Only log errors and warnings in production

**Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts:157, 178-189, 206-234`

---

## G. Acceptance Criteria for Network Fixes

1. ✅ HAR file captured and analyzed
2. ✅ All 4xx/5xx errors documented and handled
3. ✅ Slow calls (>300ms) identified and optimized
4. ✅ Noisy chatter reduced (debouncing, memoization)
5. ✅ Audit log events verified for sensitive actions
6. ✅ Performance budgets met (< 1s page load, < 200ms API, 60 FPS scroll)
7. ✅ Console.log statements removed (except telemetry via analytics service)

---

## H. Next Steps

1. ⏭️ Capture HAR file during live testing
2. ⏭️ Analyze network requests (4xx/5xx, slow calls, noisy chatter)
3. ⏭️ Verify audit log events fire for sensitive actions
4. ⏭️ Measure performance (page load, API response, scroll FPS)
5. ⏭️ Optimize slow operations (add indexes, cache, debounce)



