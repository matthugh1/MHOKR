# RBAC Inspector Notes

## Purpose

The Policy Decision Explorer is a read-only, superuser-only tool for inspecting live permission decisions via the centralised `AuthorisationService`. It allows platform engineers to:

- Test permission logic without modifying data
- Debug permission denials
- Verify tenant isolation and visibility rules
- Understand how roles map to permissions

## Route

- **Frontend**: `/superuser/policy`
- **Backend**: `POST /policy/decide`

## Feature Flag

- **Name**: `RBAC_INSPECTOR`
- **Type**: Environment variable (backend)
- **Default**: `off` (disabled)
- **Backend**: `process.env.RBAC_INSPECTOR === 'true'`
- **Frontend**: Exposed via `GET /system/status` → `flags.rbacInspector`

## Role Restriction

- **Required**: `SUPERUSER` role
- **Guard**: Both frontend and backend check superuser status
- **Frontend**: Redirects to `/dashboard` if not superuser or flag disabled
- **Backend**: Returns `403 Forbidden` if not superuser, `404 Not Found` if flag disabled

## Telemetry Events

The page fires two telemetry events (if `window.track` is available):

1. **`policy_decide_submitted`**
   - Payload: `{ action, hasResource, evaluatedUserId != me }`
   - Fired when decision request is submitted

2. **`policy_decide_result`**
   - Payload: `{ allow, reason }`
   - Fired after decision response is received

Backend also records deny telemetry via `rbac.telemetry.recordDeny()` for denied decisions.

## Example Request/Response

### Request

```json
{
  "userId": "user-456",
  "action": "edit_okr",
  "resource": {
    "tenantId": "org-123",
    "workspaceId": "ws-456",
    "objectiveId": "obj-789"
  },
  "context": {
    "customField": "value"
  }
}
```

### Response (ALLOW)

```json
{
  "allow": true,
  "reason": "ALLOW",
  "details": {
    "userRoles": ["TENANT_ADMIN", "WORKSPACE_LEAD"],
    "scopes": {
      "tenantIds": ["org-123"],
      "workspaceIds": ["ws-456"],
      "teamIds": []
    },
    "resourceCtxEcho": {
      "tenantId": "org-123",
      "workspaceId": "ws-456",
      "teamId": null,
      "okr": {
        "id": "obj-789",
        "ownerId": "user-456",
        "organizationId": "org-123",
        "visibilityLevel": "PUBLIC_TENANT",
        "isPublished": true
      }
    },
    "ruleMatched": "ALLOW"
  },
  "meta": {
    "requestUserId": "user-123",
    "evaluatedUserId": "user-456",
    "action": "edit_okr",
    "timestamp": "2025-01-27T12:00:00.000Z"
  }
}
```

### Response (DENY)

```json
{
  "allow": false,
  "reason": "ROLE_DENY",
  "details": {
    "userRoles": ["TEAM_CONTRIBUTOR"],
    "scopes": {
      "tenantIds": ["org-123"],
      "workspaceIds": [],
      "teamIds": ["team-789"]
    },
    "resourceCtxEcho": {
      "tenantId": "org-123",
      "workspaceId": "ws-456",
      "teamId": null
    },
    "ruleMatched": "ROLE_DENY"
  },
  "meta": {
    "requestUserId": "user-123",
    "evaluatedUserId": "user-456",
    "action": "edit_okr",
    "timestamp": "2025-01-27T12:00:00.000Z"
  }
}
```

## Reason Codes

- **`ALLOW`**: Permission granted
- **`ROLE_DENY`**: User lacks required role
- **`TENANT_BOUNDARY`**: Cross-tenant access attempt
- **`PRIVATE_VISIBILITY`**: OKR is private and user not whitelisted
- **`PUBLISH_LOCK`**: OKR is published and user lacks publish unlock permission
- **`SUPERUSER_READ_ONLY`**: Superuser attempting mutation (read-only)

## Security Notes

- **No mutations**: Endpoint never modifies data
- **Read-only**: All OKR entity loading is for context only
- **Audit logging**: Deny events are logged for monitoring
- **Tenant isolation**: Respects tenant boundaries when evaluating different users
- **Feature flag**: Disabled by default; must be explicitly enabled

## Usage Tips

1. **Testing different users**: Set `userId` to evaluate permissions for another user
2. **Testing resources**: Provide `objectiveId` or `keyResultId` to load full OKR context
3. **Testing visibility**: Use `PRIVATE` visibility OKRs to test visibility rules
4. **Testing publish locks**: Use published OKRs to test publish lock enforcement
5. **Testing tenant boundaries**: Use `tenantId` from different organisation to test isolation

## Related Files

- Backend: `services/core-api/src/policy/policy.controller.ts`
- Frontend: `apps/web/src/app/superuser/policy/page.tsx`
- Service: `services/core-api/src/policy/authorisation.service.ts`
- Types: `services/core-api/src/modules/rbac/types.ts`



