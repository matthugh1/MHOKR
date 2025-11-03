# RBAC Inspector

**Purpose:** Production-safe "Why can't I...?" permission reasoning tooltips for debugging RBAC issues.

**Status:** Production-gated via per-user toggle.

---

## Overview

The RBAC Inspector provides detailed permission reasoning when actions are denied. It shows which guards (RBAC, publish lock, visibility, tenant match) are preventing an action, helping users and admins understand access control decisions.

**Key Principles:**
- **Production SAFE**: Only visible when the current user has `debug.rbacInspectorEnabled = true`
- **Tenant-isolated**: Only Tenant Owner/Admin can toggle within their tenant
- **Audited**: Every enable/disable writes audit log event `toggle_rbac_inspector`
- **No secrets**: Never reveals cross-tenant resources or raw IDs the caller cannot already access

---

## Enabling for a User

### Via User Management Screen

1. Navigate to **Settings → People** (`/dashboard/settings/people`)
2. Click on a user to open the drawer
3. Scroll to **Troubleshooting** section
4. Toggle **"Enable RBAC Inspector for this user"**
5. Requires `manage_users` permission

### Via API

```bash
POST /rbac/inspector/enable
{
  "userId": "<uuid>",
  "enabled": true
}
```

**Requirements:**
- Authenticated
- `manage_users` permission for the target user's tenant
- Tenant isolation: target user must belong to caller's tenant
- Self-toggle allowed only if caller has `manage_users`

---

## What It Surfaces

When enabled and an action is denied, the inspector shows:

### Edit/Delete OKR
- **RBAC Permission**: ✅/❌ (role-based access)
- **Publish Lock**: ✅/❌ (published OKRs → admin-only)
- **Visibility (PRIVATE)**: ✅/❌ (if PRIVATE OKR)
- **EXEC_ONLY Flag**: ✅/❌ (if EXEC_ONLY and tenant setting blocks)
- **Tenant Match**: ✅/❌ (resource belongs to user's tenant)

### Publish OKR
- **RBAC Permission**: ✅/❌ (role-based access)

### Example Tooltip

```
Why can't I edit okr?

Published OKRs can only be edited by Tenant Owner/Admin.

✅ RBAC Permission
❌ Publish Lock
✅ Visibility (PRIVATE)
✅ Tenant Match
```

---

## Security Notes

1. **No Cross-Tenant Exposure**: Tooltip never shows resources from other tenants
2. **No Raw IDs**: Never exposes whitelist IDs or internal resource IDs
3. **Read-Only Data**: Inspector only explains permissions; it cannot modify access
4. **Audit Trail**: All toggles are logged with actor, target, and new state

---

## Implementation

### Backend
- **Storage**: `users.settings.debug.rbacInspectorEnabled` (JSONB)
- **Endpoint**: `POST /rbac/inspector/enable`
- **Session**: Exposed via `req.user.features.rbacInspector` (JWT strategy)
- **Audit**: `AuditLog` event `toggle_rbac_inspector`

### Frontend
- **Hook**: `useFeatureFlags().rbacInspector`
- **Component**: `<RbacWhyTooltip>` wraps disabled actions
- **Screens**: OKR list rows (edit/delete buttons)

---

## Testing

### Manual Test Steps

1. **Enable for user:**
   - Login as Tenant Admin
   - Go to People settings
   - Open user drawer
   - Enable RBAC Inspector toggle
   - Verify audit log entry created

2. **Verify tooltip appears:**
   - Login as user with inspector enabled
   - Navigate to OKRs page
   - Try to edit a published OKR (without admin role)
   - Hover over disabled Edit button
   - Should see tooltip with publish lock reason

3. **Verify tooltip hidden:**
   - Login as user with inspector disabled
   - Try same action
   - No tooltip should appear

---

## Troubleshooting

### Tooltip not appearing
- Check user has `debug.rbacInspectorEnabled = true` in database
- Check `req.user.features.rbacInspector` in session payload
- Verify action is actually denied (tooltip only shows for denied actions)

### Cannot toggle
- Verify caller has `manage_users` permission
- Verify target user belongs to caller's tenant
- Check audit log for errors

---

**Last Updated:** 2025-11-03  
**Related Documentation:** 
- [RBAC Matrix](../RBAC_MATRIX_AUTO.md)
- [RBAC Effective API](./RBAC_EFFECTIVE_API.md)

