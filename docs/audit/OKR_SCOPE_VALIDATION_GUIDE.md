# OKR Scope Validation - Quick Testing Guide

## Browser Testing Checklist

### Setup
1. Open browser DevTools (F12)
2. Go to Console tab
3. Paste this listener:
   ```javascript
   window.addEventListener('analytics', (e) => {
     console.log('📊 Analytics:', JSON.stringify(e.detail, null, 2));
   });
   ```
4. Go to Network tab
5. Filter by: `/okr/overview`

### Test Each User

#### SUPERUSER (`superuser@puzzelcx.local` / `test123`)
- [ ] Login → Navigate to `/dashboard/okrs?scope=my`
- [ ] Refresh → Verify scope persists
- [ ] Check Network: verify `scope=my` in request
- [ ] Note first 2 objective IDs from response
- [ ] Toggle to `scope=tenant` → Verify URL updates
- [ ] Note first 2 objective IDs (should differ from `my` scope)
- [ ] Apply filters to get empty state → Verify message and no button

#### TENANT_OWNER (`founder@puzzelcx.local` / `test123`)
- [ ] Login → Navigate to `/dashboard/okrs?scope=my`
- [ ] Refresh → Verify scope persists
- [ ] Check Network: verify `scope=my` in request
- [ ] Note first 2 objective IDs from response
- [ ] Toggle to `scope=tenant` → Verify URL updates
- [ ] Note first 2 objective IDs
- [ ] Apply filters to get empty state → Verify message and button (if `canCreateObjective === true`)

#### WORKSPACE_LEAD (`lead@puzzelcx.local` / `test123`)
- [ ] Login → Verify only "My" and "Team/Workspace" scopes visible
- [ ] Navigate to `/dashboard/okrs?scope=my`
- [ ] Refresh → Verify scope persists
- [ ] Check Network: verify `scope=my` in request
- [ ] Note first 2 objective IDs from response
- [ ] Toggle to `scope=team-workspace` → Verify URL updates
- [ ] Note first 2 objective IDs

#### CONTRIBUTOR (`contributor@puzzelcx.local` / `test123`)
- [ ] Login → Verify only "My" scope visible
- [ ] Navigate to `/dashboard/okrs?scope=my`
- [ ] Refresh → Verify scope persists
- [ ] Check Network: verify `scope=my` in request
- [ ] Note first 2 objective IDs from response
- [ ] Apply filters to get empty state → Verify message and no button

### Capture Telemetry Events

1. Keep Console tab open with listener attached
2. Toggle scope → Copy payload from console
3. Change status filter → Copy payload from console
4. Change cycle → Copy payload from console

### Export HAR File

1. In Network tab, right-click → "Save all as HAR"
2. Save to: `docs/audit/artifacts/okr_scope.har`

