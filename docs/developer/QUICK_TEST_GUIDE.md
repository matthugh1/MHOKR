# Quick Test Guide - Permissions System

## 🚀 Quick Start

### 1. Get Test User IDs

```bash
# Connect to database
psql postgresql://okr_user:your_password@localhost:5432/okr_nexus

# Get user IDs
SELECT id, email, name FROM users;

# Get workspace/team IDs
SELECT id, name FROM workspaces;
SELECT id, name, workspace_id FROM teams;

# Get organization ID
SELECT id, name FROM organizations;
```

### 2. Login and Get Token

```bash
# Login as MEMBER user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "test123"
  }'

# Copy the accessToken from response
export TOKEN="paste-token-here"
```

### 3. Test Permissions

```bash
# Test 1: Can view OKRs (should work)
curl -X GET http://localhost:3000/api/objectives \
  -H "Authorization: Bearer $TOKEN" | jq

# Test 2: Try to create OKR (should work for MEMBER)
curl -X POST http://localhost:3000/api/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test OKR",
    "description": "Testing permissions",
    "workspaceId": "YOUR_WORKSPACE_ID",
    "teamId": "YOUR_TEAM_ID",
    "ownerId": "YOUR_USER_ID",
    "period": "QUARTERLY",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-03-31T23:59:59Z"
  }'

# Test 3: Try to edit someone else's OKR (should fail with 403)
curl -X PATCH http://localhost:3000/api/objectives/SOMEONE_ELSES_OKR_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked!"}'
```

## 📋 Test Scenarios Checklist

### ✅ Basic Permission Checks

- [ ] Login as MEMBER (`newuser@example.com` / `test123`)
- [ ] GET `/api/objectives` - Should see only accessible OKRs
- [ ] POST `/api/objectives` - Should create OKR successfully
- [ ] Try to edit someone else's OKR - Should get 403 Forbidden
- [ ] Try to delete someone else's OKR - Should get 403 Forbidden

### ✅ Role Hierarchy Tests

- [ ] Login as VIEWER (need to create one)
- [ ] GET `/api/objectives` - Should work
- [ ] POST `/api/objectives` - Should get 403 Forbidden
- [ ] Login as TEAM_LEAD (`john@acme.com`)
- [ ] Should be able to edit team OKRs
- [ ] Should NOT be able to edit other teams' OKRs

### ✅ Inheritance Tests

- [ ] Create OKR as MEMBER
- [ ] Add Key Result to that OKR
- [ ] Login as TEAM_LEAD
- [ ] Should be able to edit the Key Result (inherits from Objective)

## 🔍 Common Issues

### Issue: "Permission denied" but user should have access

**Check:**
1. User's role assignment in database:
   ```sql
   SELECT tm.user_id, tm.team_id, tm.role, t.name as team_name
   FROM team_members tm
   JOIN teams t ON tm.team_id = t.id
   WHERE tm.user_id = 'USER_ID';
   ```

2. OKR's workspace/team assignment:
   ```sql
   SELECT id, title, workspace_id, team_id, owner_id
   FROM objectives
   WHERE id = 'OKR_ID';
   ```

### Issue: Empty array returned instead of 403

**This is expected behavior** - Users without access get empty results rather than errors to prevent information leakage.

### Issue: Can edit but shouldn't be able to

**Check:**
1. User's effective role using RoleService
2. Objective's team/workspace assignment
3. Permission check logic in PermissionService

## 📝 Expected Responses

### Success (200/201)
```json
{
  "id": "...",
  "title": "...",
  ...
}
```

### Permission Denied (403)
```json
{
  "statusCode": 403,
  "message": "You do not have permission to edit this OKR",
  "error": "Forbidden"
}
```

### Missing Token (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## 🎯 Priority Tests

If you're short on time, focus on these critical tests:

1. **MEMBER cannot edit others' OKRs** ⚠️ CRITICAL
2. **Users only see accessible OKRs** ⚠️ CRITICAL
3. **VIEWER cannot create/edit/delete** ⚠️ CRITICAL
4. **TEAM_LEAD can manage team OKRs** ✅ Important
5. **Permission inheritance works** ✅ Important

---

**Quick Reference**: See `PERMISSIONS_TEST_PLAN.md` for detailed test scenarios.

