# RBAC Effective Permissions API

**Endpoint:** `GET /rbac/assignments/effective`

**Purpose:** Returns effective permissions (all actions with allow/deny status) for a user at specified scopes. Supports both self-inspection and admin inspection of other users.

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string (UUID) | No | User ID to inspect. If omitted, returns current user permissions. Admin users with `manage_users` permission can inspect other users. |
| `tenantId` | string (UUID) | No | Filter by tenant ID. Scopes returned will be limited to this tenant. |
| `workspaceId` | string (UUID) | No | Filter by workspace ID. Scopes returned will be limited to this workspace. |
| `teamId` | string (UUID) | No | Filter by team ID. Scopes returned will be limited to this team. |

---

## Authorization Rules

### Self-Inspection
- Any authenticated user can query their own effective permissions by omitting `userId` or setting `userId` to their own ID.
- No additional permissions required.

### Admin Inspection
- Requires `manage_users` action at the tenant scope.
- Tenant isolation enforced: caller and target user must belong to the same tenant if `tenantId` is provided.
- Cross-tenant inspection is blocked (returns 403/404).

### Audit Logging
- When inspecting another user (`userId` ≠ caller's ID), an audit log entry is created:
  - Action: `view_user_access`
  - Target Type: `USER`
  - Metadata includes: `inspectedUserId`, `tenantId`, `workspaceId`, `teamId`

---

## Request Examples

### Get Current User Permissions

```bash
curl -X GET "http://localhost:3001/rbac/assignments/effective" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Get Current User Permissions (Filtered by Tenant)

```bash
curl -X GET "http://localhost:3001/rbac/assignments/effective?tenantId=$TENANT_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Admin Inspecting Another User

```bash
# Requires manage_users permission
curl -X GET "http://localhost:3001/rbac/assignments/effective?userId=$TARGET_USER_ID&tenantId=$TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Admin Inspecting User at Specific Scope

```bash
curl -X GET "http://localhost:3001/rbac/assignments/effective?userId=$TARGET_USER_ID&tenantId=$TENANT_ID&workspaceId=$WORKSPACE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Response Format

```typescript
{
  userId: string;
  isSuperuser: boolean;
  scopes: Array<{
    tenantId: string;
    workspaceId?: string;
    teamId?: string;
    effectiveRoles: string[];  // Roles that apply at this scope
    actionsAllowed: string[];  // Actions the user can perform
    actionsDenied: string[];   // Actions the user cannot perform
  }>;
}
```

### Response Fields

- **userId**: The user ID whose permissions are being inspected
- **isSuperuser**: Whether the user is a platform superuser (read-only for OKRs)
- **scopes**: Array of permission scopes. Each scope represents a combination of tenant/workspace/team where the user has roles.

#### Scope Object

- **tenantId**: Required. The tenant/organization ID.
- **workspaceId**: Optional. The workspace ID if scope is workspace-level.
- **teamId**: Optional. The team ID if scope is team-level.
- **effectiveRoles**: Array of role names (e.g., `["TENANT_ADMIN", "WORKSPACE_LEAD"]`). Sorted by priority (highest first).
- **actionsAllowed**: Array of action names the user can perform at this scope.
- **actionsDenied**: Array of action names the user cannot perform at this scope.

---

## Available Actions

The following actions are evaluated for each scope:

### OKR Actions
- `view_okr`: View an OKR
- `edit_okr`: Edit an OKR
- `delete_okr`: Delete an OKR
- `create_okr`: Create a new OKR
- `publish_okr`: Publish/approve an OKR
- `view_all_okrs`: View all OKRs (reporting access)

### Governance Actions
- `request_checkin`: Request a check-in from another user

### Admin Actions
- `manage_users`: Manage user roles and memberships
- `manage_workspaces`: Create/edit/archive workspaces
- `manage_teams`: Create/edit teams
- `manage_tenant_settings`: Configure tenant-wide policies
- `export_data`: Export data
- `manage_billing`: Manage billing (TENANT_OWNER only)

### Platform Actions
- `impersonate_user`: Impersonate another user (SUPERUSER only)

---

## Response Examples

### TENANT_ADMIN User

```json
{
  "userId": "user-123",
  "isSuperuser": false,
  "scopes": [
    {
      "tenantId": "tenant-abc",
      "effectiveRoles": ["TENANT_ADMIN"],
      "actionsAllowed": [
        "view_okr",
        "edit_okr",
        "delete_okr",
        "create_okr",
        "publish_okr",
        "request_checkin",
        "manage_users",
        "manage_workspaces",
        "manage_teams",
        "view_all_okrs",
        "export_data"
      ],
      "actionsDenied": [
        "manage_billing",
        "manage_tenant_settings",
        "impersonate_user"
      ]
    },
    {
      "tenantId": "tenant-abc",
      "workspaceId": "workspace-xyz",
      "effectiveRoles": ["TENANT_ADMIN", "WORKSPACE_LEAD"],
      "actionsAllowed": [
        "view_okr",
        "edit_okr",
        "delete_okr",
        "create_okr",
        "publish_okr",
        "request_checkin",
        "manage_users",
        "manage_workspaces",
        "manage_teams",
        "view_all_okrs",
        "export_data"
      ],
      "actionsDenied": [
        "manage_billing",
        "manage_tenant_settings",
        "impersonate_user"
      ]
    }
  ]
}
```

### SUPERUSER User

```json
{
  "userId": "superuser-456",
  "isSuperuser": true,
  "scopes": [
    {
      "tenantId": "tenant-abc",
      "effectiveRoles": ["SUPERUSER"],
      "actionsAllowed": [
        "view_okr",
        "view_all_okrs",
        "impersonate_user",
        "export_data",
        "manage_users",
        "manage_workspaces",
        "manage_teams",
        "manage_tenant_settings"
      ],
      "actionsDenied": [
        "edit_okr",
        "delete_okr",
        "create_okr",
        "publish_okr",
        "request_checkin",
        "manage_billing"
      ]
    }
  ]
}
```

---

## Error Responses

### 401 Unauthorized
- Missing or invalid JWT token.

### 403 Forbidden / 404 Not Found
- Inspecting another user without `manage_users` permission.
- Cross-tenant inspection (target user not in specified tenant).
- User not found.

**Example:**
```json
{
  "statusCode": 404,
  "message": "Permission denied: manage_users required to inspect other users"
}
```

---

## Use Cases

1. **User Self-Inspection**: Users can see what actions they can perform.
2. **Admin User Management**: Admins can inspect user permissions to diagnose access issues.
3. **RBAC Debugging**: Developers can verify role assignments and permission calculations.
4. **Audit and Compliance**: Track who can access what resources.

---

## Implementation Notes

- **Performance**: The endpoint builds user context without cache to ensure fresh data.
- **Tenant Isolation**: All queries respect tenant boundaries. Cross-tenant inspection is explicitly blocked.
- **Audit Trail**: Admin inspections are logged for compliance.
- **Scope Filtering**: If `tenantId`, `workspaceId`, or `teamId` are provided, only scopes matching those filters are returned.

---

**Last Updated:** 2025-11-03  
**Related Documentation:** 
- [RBAC Matrix](../RBAC_MATRIX_AUTO.md)
- [RBAC Smoke Tests](./RBAC_SMOKE_TESTS.md)




