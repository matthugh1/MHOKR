# OKR Mini Sprint 3 - Quick Validation Guide

This guide helps you quickly validate the OKR Mini Sprint 3 features.

## Prerequisites

1. **Branch Checked Out:** `chore/okr-mini-sprint-3`
2. **Services Running:** All services (API Gateway, Core API, Web) running
3. **Test Users:** TENANT_ADMIN, WORKSPACE_LEAD, CONTRIBUTOR seeded

## Step 1: Preflight Checks

### Check Branch
```bash
git branch --show-current
# Should show: chore/okr-mini-sprint-3
```

### Check ESLint
```bash
npm run lint | grep -i "no-console"
# Should show: No violations (or only console.error allowed)
```

### Check CHANGELOG
```bash
grep -A 20 "OKR Mini Sprint 3" CHANGELOG.md
# Should show Sprint 3 entry
```

## Step 2: Enable Feature Flag

### Option A: Via UI
1. Log in as TENANT_ADMIN (or user with `manage_users` permission)
2. Navigate to `/dashboard/settings/people`
3. Select a test user
4. Scroll to "Troubleshooting Section"
5. Toggle "Enable RBAC Inspector for this user"
6. Save

### Option B: Via API
```bash
curl -X POST "http://localhost:3001/rbac/inspector/enable" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "<USER_ID>", "enabled": true}'
```

## Step 3: Load Validation Helper

1. Open browser DevTools (F12)
2. Go to Console tab
3. Copy and paste contents of `docs/audit/OKR_MINI_SPRINT_3_VALIDATION_HELPER.js`
4. Press Enter

You should see:
```
✅ OKR Mini Sprint 3 Validation Helper loaded
```

## Step 4: Enable Telemetry Logging

In the same console, run:
```javascript
window.addEventListener('analytics', e => console.log('📊 ANALYTICS:', e.detail))
```

## Step 5: Test Governance Status Bar

1. Navigate to `/dashboard/okrs?scope=tenant&cycleId=<active_cycle_id>`
2. Look for Governance Status Bar (above filter bar, below title)
3. Verify it shows: Published, Draft, At Risk, Off Track badges
4. Run in console:
   ```javascript
   OKRValidation.checkGovernanceStatusBar()
   ```
5. Take screenshot: `docs/audit/artifacts/gov-status-tenant.png`
6. Repeat for `scope=my` and `scope=team-workspace`

**Expected:** Status bar visible, non-interactive (no click handlers)

## Step 6: Test Why Inspector

1. Log in as user with `rbacInspector` flag enabled
2. Navigate to `/dashboard/okrs`
3. Find an OKR where edit is blocked (published, cycle locked, or not owner)
4. Look for small "Why?" link next to blocked action
5. Click "Why?" link
6. Verify popover shows:
   - Reason code (e.g., `publish_lock`, `cycle_locked`)
   - Human-readable message (British English)
7. Run in console:
   ```javascript
   OKRValidation.checkWhyInspector()
   ```
8. Take screenshot: `docs/audit/artifacts/why-inspector-edit.png`
9. Log in as user WITHOUT flag → verify "Why?" links NOT visible

**Expected:** "Why?" links only visible when flag enabled AND action blocked

## Step 7: Test Inline Health Signals

1. Navigate to `/dashboard/okrs`
2. Enable network monitoring:
   ```javascript
   const stopMonitoring = OKRValidation.monitorInlineInsights()
   ```
3. Scroll down the list
4. Verify inline insight bars appear when rows become visible
5. Check for hints:
   - "X KRs at risk"
   - "Overdue check-ins"
   - "No progress 14 days"
6. Scroll back up → verify no re-fetch (cached)
7. Run in console:
   ```javascript
   OKRValidation.checkInlineHealthSignals()
   ```
8. Take screenshots of 3 different inline signals

**Expected:** Signals lazy-load when visible, cached per session

## Step 8: Verify Telemetry

Check console for analytics events:
- `governance_status_viewed` (should fire once per mount)
- `inline_insight_loaded` (should fire when insights load)
- `scope_toggle` (regression check - should still work)

Copy 3 sample payloads to validation report.

## Step 9: Performance Check

1. Navigate to `/dashboard/okrs`
2. Open Performance tab in DevTools
3. Record page load
4. Check for long tasks (>200ms)
5. Run in console:
   ```javascript
   OKRValidation.checkPerformance()
   ```

**Expected:** Initial render <150ms, no long tasks >200ms

## Step 10: Regression Checks

1. Verify no duplicate filter bars:
   ```javascript
   OKRValidation.checkDuplicateFilters()
   ```
2. Verify no visual builder references on `/dashboard/okrs`
3. Test existing features still work:
   - Scope toggle
   - Filter bar
   - Cycle selector
   - Attention drawer

## Step 11: Fill Validation Report

1. Open `docs/audit/OKR_MINI_SPRINT_3_VALIDATION.md`
2. Fill in all sections with results
3. Attach screenshots to `docs/audit/artifacts/`
4. Update status to ✅ PASS / ⚠️ PASS WITH NOTES / ❌ FAIL

## Troubleshooting

### Why Inspector Not Showing
- Check feature flag is enabled: `user.features.rbacInspector === true`
- Check action is actually blocked (not just hidden)
- Check browser console for errors

### Governance Status Bar Not Showing
- Check `cycleId` is valid and active
- Check network tab for `/okr/insights/cycle-summary` request
- Check console for errors

### Inline Signals Not Loading
- Check network tab for `/okr/insights/objective/:id` requests
- Verify IntersectionObserver is working (check DevTools Performance)
- Check visibility: PRIVATE/EXEC_ONLY objectives may not show hints

## Quick Checklist

- [ ] Branch: `chore/okr-mini-sprint-3`
- [ ] ESLint: No no-console violations
- [ ] CHANGELOG: Sprint 3 entry present
- [ ] Feature Flag: Enabled for test user
- [ ] Governance Status Bar: Visible, non-interactive, 3 scopes tested
- [ ] Why Inspector: Visible with flag, hidden without flag
- [ ] Inline Signals: Lazy-loading, caching, 3 samples
- [ ] Telemetry: 3 payloads captured
- [ ] Performance: <150ms initial render
- [ ] Regressions: None found
- [ ] Screenshots: All captured
- [ ] Report: Completed

---

**Ready for Merge:** `[ ] Yes` / `[ ] No`

