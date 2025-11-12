# How to Check User Organization Association

## Method 1: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for logs starting with `[OKR PAGE CONTAINER]`
4. Check these values:
   - `organizationId: <id>` - Which org the frontend is querying
   - `userEmail: c-level@hughes.com` - Confirms it's your user
   - `totalCount: 0` - How many objectives were found

## Method 2: Check API Response

1. Open browser DevTools (F12)
2. Go to Network tab
3. Find the request to `/okr/overview`
4. Check:
   - Request URL: What `tenantId` parameter is being sent?
   - Response: What does the response contain?

## Method 3: Check Database Directly

Run this SQL query to check the user's organization assignments:

```sql
-- Find user's tenant role assignments
SELECT 
  u.email,
  u.id as user_id,
  ra.scope_id as organization_id,
  o.name as organization_name,
  ra.role,
  ra.scope_type
FROM users u
LEFT JOIN role_assignments ra ON u.id = ra.user_id AND ra.scope_type = 'TENANT'
LEFT JOIN organizations o ON ra.scope_id = o.id
WHERE u.email = 'c-level@hughes.com';
```

## Method 4: Check Frontend Context

1. Open browser DevTools Console
2. Run this JavaScript:
```javascript
// Check what organization is selected in the frontend
localStorage.getItem('currentOrganizationId')

// Check user info (if available in window)
// This depends on your auth implementation
```

## Method 5: Check Backend Logs

Look for these log messages:
- `[JWT STRATEGY] User validated:` - Shows user's tenantId
- `[OKR OVERVIEW]` - Shows what org is being queried
- `[RBAC] buildUserContext:` - Shows user's role assignments

## Common Issues

1. **Frontend org doesn't match user's org**
   - User is assigned to Org A
   - Frontend is querying Org B
   - Solution: Select the correct organization in the UI

2. **No objectives exist**
   - User is correctly assigned
   - But no objectives exist in that organization
   - Solution: Create objectives or check if they exist

3. **Visibility filtering**
   - Objectives exist but are filtered out
   - User doesn't have permission to see them
   - Solution: Check visibility levels and user permissions

4. **Superuser viewing wrong org**
   - Superuser can view all orgs
   - But frontend might not be selecting one
   - Solution: Ensure an organization is selected

