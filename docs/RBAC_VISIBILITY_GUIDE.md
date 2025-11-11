# RBAC and Visibility Guide

## Overview

The OKR platform uses Role-Based Access Control (RBAC) combined with visibility levels to control who can view and edit OKRs. This guide explains how PRIVATE visibility and whitelists work, and how to use the "My OKRs" filter.

## Visibility Levels

### PUBLIC_TENANT (Default)

- **Who can view**: All users in the same tenant
- **Use case**: Standard OKRs visible to everyone in your organization
- **No restrictions**: No whitelist needed

### PRIVATE

- **Who can view**: 
  - Owner (always)
  - TENANT_OWNER (always)
  - Users explicitly whitelisted
- **Use case**: Confidential OKRs (HR, legal, M&A, executive-only)
- **Whitelist required**: Users must be added to the PRIVATE whitelist to view

## PRIVATE Visibility and Whitelist

### How PRIVATE Works

1. **Owner Access**: The OKR owner can always view their PRIVATE OKRs
2. **Tenant Owner Access**: TENANT_OWNER role automatically has access to all PRIVATE OKRs
3. **Whitelist Access**: Other users must be explicitly added to the whitelist

### Managing the Whitelist

**API Endpoints:**

- `GET /rbac/whitelist/:tenantId` - Get current whitelist
- `POST /rbac/whitelist/:tenantId/add` - Add user to whitelist
- `POST /rbac/whitelist/:tenantId/remove` - Remove user from whitelist
- `POST /rbac/whitelist/:tenantId/set` - Set entire whitelist
- `DELETE /rbac/whitelist/:tenantId` - Clear whitelist

**Permissions Required:** `manage_tenant_settings` (TENANT_OWNER or TENANT_ADMIN)

**Rate Limiting:** All mutation endpoints are rate-limited (30 requests per minute per user)

**Example:**

```bash
# Add user to whitelist
POST /rbac/whitelist/org-123/add
{
  "userId": "user-456"
}

# Remove user from whitelist
POST /rbac/whitelist/org-123/remove
{
  "userId": "user-456"
}
```

### Whitelist Storage

The whitelist is stored in the `Organization` model:
- Field: `execOnlyWhitelist` (JSON array of user IDs)
- Also supports `metadata.privateWhitelist` for backward compatibility
- Both fields are checked when determining PRIVATE access

## "My OKRs" Filter

The "My OKRs" filter is a one-click toggle that shows only OKRs where:
- You are the owner (`ownerId == yourUserId`)

**How it works:**

1. **UI**: Click the "My OKRs" button in the filter bar
2. **Backend**: Filters by `ownerId` query parameter
3. **URL**: Persists in URL as `?myOkrs=true`
4. **Scope**: Works with all other filters (cycle, status, visibility)

**Example:**

```
GET /okr/overview?tenantId=org-123&ownerId=user-456
```

This returns only OKRs owned by `user-456` (you).

**Note**: "My OKRs" is mutually exclusive with the Owner filter dropdown. When "My OKRs" is enabled, the Owner dropdown is hidden.

## List Filtering

The OKR list supports multiple filters:

- **My OKRs**: Toggle to show only your OKRs
- **Visibility**: Filter by visibility level (ALL, PUBLIC_TENANT, PRIVATE)
- **Owner**: Select specific owner (hidden when "My OKRs" is enabled)
- **Cycle**: Filter by OKR cycle
- **Status**: Filter by objective status (ON_TRACK, AT_RISK, etc.)

**Filter Persistence:**

All filters persist in the URL query string, allowing:
- Deep links with filter state
- Browser back/forward navigation
- Bookmarkable filtered views

**Example URL:**

```
/dashboard/okrs?myOkrs=true&visibility=PUBLIC_TENANT&cycleId=cycle-123&status=ON_TRACK
```

## Share Links

Share links provide tenant-scoped read-only access to OKR objects with expiry.

### Creating Share Links

**Endpoint:** `POST /okrs/:type/:id/share`

**Permissions:** Owner or tenant admin

**Parameters:**
- `expiresAt`: ISO 8601 date string (required)
- `note`: Optional note about the share link

**Example:**

```bash
POST /okrs/objectives/obj-123/share
{
  "expiresAt": "2025-12-31T23:59:59Z",
  "note": "Sharing with executive team for Q4 review"
}
```

**Response:**

```json
{
  "shareId": "clx123abc456",
  "url": "https://app.example.com/share/clx123abc456",
  "expiresAt": "2025-12-31T23:59:59Z",
  "note": "Sharing with executive team for Q4 review"
}
```

### Accessing Share Links

**Endpoint:** `GET /share/:shareId` (public, tenant-safe)

Share links are accessible to:
- Users in the same tenant (if authenticated)
- Unauthenticated users (public share)
- Always checks expiry and revocation

### Revoking Share Links

**Endpoint:** `DELETE /share/:shareId`

**Permissions:** Creator or tenant admin

**Rate Limiting:** 30 requests per minute per user

## Security Considerations

1. **Tenant Isolation**: All operations enforce tenant boundaries
2. **Expiry**: Share links automatically expire at the specified date
3. **Revocation**: Share links can be revoked at any time
4. **Read-Only**: Share links grant view access only (no edit/delete)
5. **Audit Trail**: All share link operations are logged in the audit log

## Telemetry

The following metrics are tracked:

- `share.create` - Share link created
- `share.revoke` - Share link revoked
- `whitelist.add` - User added to whitelist
- `whitelist.remove` - User removed from whitelist
- `list.filtered` - List filtered by visibility (when items are hidden)

Telemetry can be disabled via environment variables:
- `SHARE_TELEMETRY=off` - Disable share telemetry
- `WHITELIST_TELEMETRY=off` - Disable whitelist telemetry
- `LIST_TELEMETRY=off` - Disable list filtering telemetry

## Related Documentation

- [RBAC System](../rbac/README.md) - Complete RBAC documentation
- [Visibility Policy](../rbac/visibilityPolicy.ts) - Visibility level implementation
- [API Documentation](../../../api/docs) - Full API reference


