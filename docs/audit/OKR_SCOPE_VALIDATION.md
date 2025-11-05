# OKR Scope Validation Report

**Generated:** 2025-11-05T11:08:02.911Z  
**Status:** Manual Testing Required

---

## Test Users

| Email | Password | Role | Organization ID |
|-------|----------|------|----------------|
| `superuser@puzzelcx.local` | `test123` | SUPERUSER | N/A (Platform scope) |
| `founder@puzzelcx.local` | `test123` | TENANT_OWNER | `cmhltw6mk0000sj3m875pm069` |
| `lead@puzzelcx.local` | `test123` | WORKSPACE_LEAD | `cmhltw6mk0000sj3m875pm069` |
| `contributor@puzzelcx.local` | `test123` | CONTRIBUTOR | `cmhltw6mk0000sj3m875pm069` |

---

## 1. Scope Parameter Persistence

### Expected Behaviour
- Scope parameter persists in URL: `/dashboard/okrs?scope=my`
- Scope persists across page reloads
- Scope is passed to backend API: `/okr/overview?scope=my`

### Manual Testing Steps

1. **Log in** as each test user (`http://localhost:5173/login`)
2. **Navigate** to `/dashboard/okrs?scope=my`
3. **Verify** scope appears in URL
4. **Refresh** page (F5)
5. **Verify** scope persists in URL after refresh
6. **Repeat** for `scope=team-workspace` and `scope=tenant`
7. **Toggle** scope using UI buttons
8. **Verify** URL updates accordingly

### Test Results Matrix

| Role | My Scope Persists | Team/Workspace Persists | Tenant Persists | Notes |
|------|------------------|------------------------|-----------------|-------|
| **SUPERUSER** | ⏳ Pending | ⏳ Pending | ⏳ Pending | Manual test required |
| **TENANT_OWNER** | ⏳ Pending | ⏳ Pending | ⏳ Pending | Manual test required |
| **WORKSPACE_LEAD** | ⏳ Pending | ⏳ Pending | N/A | Manual test required |
| **CONTRIBUTOR** | ⏳ Pending | N/A | N/A | Manual test required |

**Status:** ⏳ Manual testing required

---

## 2. Backend API Scope Filtering

### Expected Behaviour

- `scope=my` → filters by `ownerId = req.user.id`
- `scope=team-workspace` → filters by workspace/team IDs (prefers lead roles)
- `scope=tenant` → no additional filter (shows all tenant OKRs)

### Manual Testing Steps

1. **Log in** as each test user
2. **Open** browser DevTools → Network tab
3. **Navigate** to `/dashboard/okrs?scope=my`
4. **Find** request to `/okr/overview` in Network tab
5. **Verify** request includes `scope=my` query param
6. **Inspect** response payload - note first 2 objective IDs
7. **Repeat** for `scope=team-workspace` and `scope=tenant`
8. **Compare** objective IDs across scopes (should differ)

### API Test Results

#### SUPERUSER (`superuser@puzzelcx.local`)

**Scope: my**
- **Request URL:** `GET /okr/overview?organizationId=xxx&scope=my&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending
- **Note:** SUPERUSER has no organizationId - may need special handling

**Scope: team-workspace**
- **Request URL:** `GET /okr/overview?organizationId=xxx&scope=team-workspace&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending

**Scope: tenant**
- **Request URL:** `GET /okr/overview?organizationId=xxx&scope=tenant&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending

#### TENANT_OWNER (`founder@puzzelcx.local`)

**Scope: my**
- **Request URL:** `GET /okr/overview?organizationId=cmhltw6mk0000sj3m875pm069&scope=my&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending

**Scope: team-workspace**
- **Request URL:** `GET /okr/overview?organizationId=cmhltw6mk0000sj3m875pm069&scope=team-workspace&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending

**Scope: tenant**
- **Request URL:** `GET /okr/overview?organizationId=cmhltw6mk0000sj3m875pm069&scope=tenant&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending

#### WORKSPACE_LEAD (`lead@puzzelcx.local`)

**Scope: my**
- **Request URL:** `GET /okr/overview?organizationId=cmhltw6mk0000sj3m875pm069&scope=my&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending

**Scope: team-workspace**
- **Request URL:** `GET /okr/overview?organizationId=cmhltw6mk0000sj3m875pm069&scope=team-workspace&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending

**Scope: tenant**
- **Expected:** ❌ Not available (should not see Tenant scope option)

#### CONTRIBUTOR (`contributor@puzzelcx.local`)

**Scope: my**
- **Request URL:** `GET /okr/overview?organizationId=cmhltw6mk0000sj3m875pm069&scope=my&page=1&pageSize=20`
- **Status:** ⏳ Pending
- **Total Count:** ⏳ Pending
- **First 2 Objective IDs:** ⏳ Pending

**Scope: team-workspace**
- **Expected:** ❌ Not available (should not see Team/Workspace scope option)

**Scope: tenant**
- **Expected:** ❌ Not available (should not see Tenant scope option)

---

## 3. Role-Aware Empty States

### Expected Behaviour Matrix

| Role | Empty State Message | Button Visible | Button Action |
|------|-------------------|----------------|---------------|
| **SUPERUSER** | "No OKRs found" | ❌ No | N/A (read-only) |
| **TENANT_ADMIN** | "No OKRs found. Create your first objective to get started." | ✅ Yes (if `canCreateObjective === true`) | Opens creation drawer |
| **TENANT_OWNER** | "No OKRs found. Create your first objective to get started." | ✅ Yes (if `canCreateObjective === true`) | Opens creation drawer |
| **WORKSPACE_LEAD** | "No OKRs found. Create your first objective to get started." | ✅ Yes (if `canCreateObjective === true`) | Opens creation drawer |
| **CONTRIBUTOR** | "No OKRs found" | ❌ No | N/A |

### Manual Testing Steps

1. **Log in** as each test user
2. **Navigate** to `/dashboard/okrs`
3. **Apply filters** that return no results (e.g., non-existent cycle, status filter that matches nothing)
4. **Verify** empty state message matches expected
5. **Verify** button presence/absence matches expected
6. **Click** button (if present) and verify creation drawer opens

### Test Results

| Role | Message Observed | Button Visible | Button Works | Notes |
|------|-----------------|----------------|--------------|-------|
| **SUPERUSER** | ⏳ Pending | ⏳ Pending | N/A | Manual test required |
| **TENANT_OWNER** | ⏳ Pending | ⏳ Pending | ⏳ Pending | Manual test required |
| **WORKSPACE_LEAD** | ⏳ Pending | ⏳ Pending | ⏳ Pending | Manual test required |
| **CONTRIBUTOR** | ⏳ Pending | ⏳ Pending | N/A | Manual test required |

**Status:** ⏳ Manual testing required

---

## 4. Telemetry Events

### Expected Events

#### scope_toggle
```javascript
{
  name: 'scope_toggle',
  scope: 'my' | 'team-workspace' | 'tenant',
  prev_scope: 'my' | 'team-workspace' | 'tenant',
  cycle_id: string | null,
  ts: string (ISO timestamp)
}
```

#### filter_applied
```javascript
{
  name: 'filter_applied',
  scope: 'my' | 'team-workspace' | 'tenant',
  status: 'ON_TRACK' | 'AT_RISK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED' | null,
  q: string (search query),
  cycle_id: string | null,
  ts: string (ISO timestamp)
}
```

#### cycle_changed
```javascript
{
  name: 'cycle_changed',
  scope: 'my' | 'team-workspace' | 'tenant',
  cycle_id_prev: string | null,
  cycle_id: string | null,
  ts: string (ISO timestamp)
}
```

### Manual Testing Steps

1. **Open** browser DevTools → Console
2. **Attach** listener:
   ```javascript
   window.addEventListener('analytics', (e) => {
     console.log('Analytics event:', e.detail);
   });
   ```
3. **Toggle scope** between My / Team/Workspace / Tenant
4. **Change status filter** (e.g., click "On track")
5. **Change search query** (type in search box)
6. **Change cycle selector** (select different cycle)
7. **Capture** 3 sample payloads from console output

### Sample Telemetry Payloads

**Sample 1: scope_toggle**
```javascript
// To be captured during manual testing
{
  name: 'scope_toggle',
  scope: 'tenant',
  prev_scope: 'my',
  cycle_id: 'cmhltw6rh0005sj3m7jvxvu4t',
  ts: '2025-11-05T10:30:00.000Z'
}
```

**Sample 2: filter_applied**
```javascript
// To be captured during manual testing
{
  name: 'filter_applied',
  scope: 'my',
  status: 'ON_TRACK',
  q: '',
  cycle_id: 'cmhltw6rh0005sj3m7jvxvu4t',
  ts: '2025-11-05T10:31:00.000Z'
}
```

**Sample 3: cycle_changed**
```javascript
// To be captured during manual testing
{
  name: 'cycle_changed',
  scope: 'tenant',
  cycle_id_prev: 'cmhltw6rh0005sj3m7jvxvu4t',
  cycle_id: 'cmhltw713000esj3mzek57oqm',
  ts: '2025-11-05T10:32:00.000Z'
}
```

**Status:** ⏳ Manual testing required

---

## 5. Scope Visibility Matrix

### Expected Scope Availability by Role

| Role | My | Team/Workspace | Tenant |
|------|-----|---------------|--------|
| **SUPERUSER** | ✅ | ✅ | ✅ (all read-only) |
| **TENANT_ADMIN** | ✅ | ✅ (if has workspace/team roles) | ✅ |
| **TENANT_OWNER** | ✅ | ✅ (if has workspace/team roles) | ✅ |
| **WORKSPACE_LEAD** | ✅ | ✅ | ❌ |
| **CONTRIBUTOR** | ✅ | ❌ | ❌ |

### Observed Scope Availability

| Role | My Visible | Team/Workspace Visible | Tenant Visible | Notes |
|------|-----------|----------------------|---------------|-------|
| **SUPERUSER** | ⏳ Pending | ⏳ Pending | ⏳ Pending | Manual test required |
| **TENANT_OWNER** | ⏳ Pending | ⏳ Pending | ⏳ Pending | Manual test required |
| **WORKSPACE_LEAD** | ⏳ Pending | ⏳ Pending | ❌ Expected | Manual test required |
| **CONTRIBUTOR** | ⏳ Pending | ❌ Expected | ❌ Expected | Manual test required |

**Status:** ⏳ Manual testing required

---

## 6. Network Capture (HAR File)

### Instructions

1. **Open** browser DevTools → Network tab
2. **Clear** network log
3. **Navigate** to `/dashboard/okrs?scope=my`
4. **Toggle** scope between My / Team/Workspace / Tenant
5. **Change** status filter
6. **Change** search query
7. **Change** cycle selector
8. **Right-click** in Network tab → "Save all as HAR"
9. **Save** to `docs/audit/artifacts/okr_scope.har`

### Expected Network Requests

- `GET /okr/overview?organizationId=xxx&scope=my&page=1&pageSize=20`
- `GET /okr/overview?organizationId=xxx&scope=team-workspace&page=1&pageSize=20`
- `GET /okr/overview?organizationId=xxx&scope=tenant&page=1&pageSize=20`
- `GET /okr/overview?organizationId=xxx&scope=my&status=ON_TRACK&page=1&pageSize=20`
- `GET /okr/overview?organizationId=xxx&scope=my&cycleId=xxx&page=1&pageSize=20`

**Status:** ⏳ Manual capture required

---

## 7. Inconsistencies

**None observed** - Automated testing was not possible due to authentication requirements. Full manual browser testing required to verify:
- URL persistence
- Empty state rendering
- Telemetry event firing
- Network request structure

---

## 8. Testing Checklist

### For Each Role (SUPERUSER, TENANT_OWNER, WORKSPACE_LEAD, CONTRIBUTOR):

- [ ] **Login** successfully
- [ ] **Navigate** to `/dashboard/okrs?scope=my`
- [ ] **Verify** scope persists in URL after refresh
- [ ] **Toggle** scope using UI buttons
- [ ] **Verify** URL updates correctly
- [ ] **Open** Network tab in DevTools
- [ ] **Verify** `/okr/overview` requests include `scope` param
- [ ] **Document** first 2 objective IDs for each scope
- [ ] **Apply filters** that return no results
- [ ] **Verify** empty state message matches expected
- [ ] **Verify** button presence/absence matches expected
- [ ] **Attach** analytics event listener
- [ ] **Perform** scope toggle, filter changes, cycle changes
- [ ] **Capture** 3 telemetry payloads

---

## 9. Quick Reference: Browser Console Commands

### Attach Analytics Listener
```javascript
window.addEventListener('analytics', (e) => {
  console.log('📊 Analytics:', e.detail);
});
```

### Check Current Scope from URL
```javascript
new URLSearchParams(window.location.search).get('scope')
```

### Check Network Requests
```javascript
// In Network tab, filter by: /okr/overview
// Look for scope parameter in query string
```

### Test API Directly (with auth token)
```javascript
// Get token from localStorage
const token = localStorage.getItem('access_token');

// Test scope=my
fetch('http://localhost:3001/okr/overview?organizationId=cmhltw6mk0000sj3m875pm069&scope=my&page=1&pageSize=20', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

---

## 10. Next Steps

1. **Complete manual browser testing** for all 4 roles
2. **Capture HAR file** → `docs/audit/artifacts/okr_scope.har`
3. **Capture 3 telemetry payloads** and update Section 4
4. **Update test results** in Sections 1, 2, 3, 5 with actual observations
5. **Document any inconsistencies** in Section 7

---

**Report Template Generated:** 2025-11-05T11:08:02.911Z  
**API Base URL:** http://localhost:3001  
**Web Base URL:** http://localhost:5173

**Note:** This is a validation template. Manual browser testing is required to populate test results.
