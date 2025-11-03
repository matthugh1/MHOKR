# Permissions System Test Plan

## 📋 Overview

This test plan verifies that the permission system correctly enforces access control for OKRs, Key Results, and Initiatives across different user roles.

## 🎯 Test Objectives

1. Verify role-based access control (RBAC) is enforced
2. Confirm data filtering works correctly
3. Validate permission inheritance from parent entities
4. Test permission escalation prevention
5. Ensure error messages are clear and helpful

## 🔧 Prerequisites

### 1. Database Setup

Ensure you have run the migrations and seed script:

```bash
cd services/core-api
npm run prisma:migrate dev
npm run prisma:seed
```

### 2. Test Users (from seed script)

| Email | Password | Role | Team |
|-------|----------|------|------|
| `john@acme.com` | (Keycloak) | ORG_ADMIN, WORKSPACE_OWNER, TEAM_LEAD | Engineering |
| `jane@acme.com` | (Keycloak) | MEMBER, TEAM_LEAD | Product |
| `newuser@example.com` | `test123` | MEMBER | Engineering |

### 3. Test Data

From seed script:
- **Organization**: Acme Corporation
- **Workspace**: Product Development
- **Teams**: Engineering, Product
- **Sample OKR**: "Launch MVP by Q2 2024" (owned by john@acme.com, Engineering team)

## 🧪 Test Scenarios

### Test Suite 1: VIEWER Role Access

**Setup**: Create or modify a user to have VIEWER role

**Test 1.1: VIEWER Can View OKRs**
- **Action**: GET `/api/objectives`
- **Expected**: Returns OKRs user has access to (based on workspace/team membership)
- **Status**: ⬜ Not Tested

**Test 1.2: VIEWER Cannot Create OKRs**
- **Action**: POST `/api/objectives` with valid data
- **Expected**: `403 Forbidden` - "Permission denied. Required: okr:create"
- **Status**: ⬜ Not Tested

**Test 1.3: VIEWER Cannot Edit OKRs**
- **Action**: PATCH `/api/objectives/{id}` with modifications
- **Expected**: `403 Forbidden` - "You do not have permission to edit this OKR"
- **Status**: ⬜ Not Tested

**Test 1.4: VIEWER Cannot Delete OKRs**
- **Action**: DELETE `/api/objectives/{id}`
- **Expected**: `403 Forbidden` - "You do not have permission to delete this OKR"
- **Status**: ⬜ Not Tested

**Test 1.5: VIEWER Can View Key Results**
- **Action**: GET `/api/key-results?objectiveId={objectiveId}`
- **Expected**: Returns key results if can view parent objective
- **Status**: ⬜ Not Tested

---

### Test Suite 2: MEMBER Role Access

**User**: `newuser@example.com` / `test123` (MEMBER in Engineering team)

**Test 2.1: MEMBER Can View Team OKRs**
- **Action**: GET `/api/objectives`
- **Expected**: Returns OKRs from Engineering team and owned OKRs
- **Status**: ⬜ Not Tested

**Test 2.2: MEMBER Can Create Own OKRs**
- **Action**: POST `/api/objectives` with:
  ```json
  {
    "title": "Learn TypeScript",
    "description": "Complete TypeScript course",
    "workspaceId": "{workspaceId}",
    "teamId": "{engineeringTeamId}",
    "ownerId": "{newuser@example.com userId}",
    "period": "QUARTERLY",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }
  ```
- **Expected**: `201 Created` - OKR created successfully
- **Status**: ⬜ Not Tested

**Test 2.3: MEMBER Can Edit Own OKRs**
- **Action**: PATCH `/api/objectives/{ownOkrId}` with:
  ```json
  {
    "title": "Learn TypeScript - Updated"
  }
  ```
- **Expected**: `200 OK` - OKR updated successfully
- **Status**: ⬜ Not Tested

**Test 2.4: MEMBER Cannot Edit Other Members' OKRs**
- **Action**: PATCH `/api/objectives/{johnsOkrId}` with modifications
- **Expected**: `403 Forbidden` - "You do not have permission to edit this OKR"
- **Status**: ⬜ Not Tested

**Test 2.5: MEMBER Can Delete Own OKRs**
- **Action**: DELETE `/api/objectives/{ownOkrId}`
- **Expected**: `200 OK` - OKR deleted successfully
- **Status**: ⬜ Not Tested

**Test 2.6: MEMBER Cannot Delete Team OKRs**
- **Action**: DELETE `/api/objectives/{teamOkrId}`
- **Expected**: `403 Forbidden` - "You do not have permission to delete this OKR"
- **Status**: ⬜ Not Tested

**Test 2.7: MEMBER Can Create Key Results for Own OKRs**
- **Action**: POST `/api/key-results` with:
  ```json
  {
    "title": "Complete 5 chapters",
    "objectiveId": "{ownOkrId}",
    "ownerId": "{newuser@example.com userId}",
    "metricType": "REACH",
    "startValue": 0,
    "targetValue": 5,
    "currentValue": 0
  }
  ```
- **Expected**: `201 Created` - Key result created
- **Status**: ⬜ Not Tested

---

### Test Suite 3: TEAM_LEAD Role Access

**User**: `john@acme.com` (TEAM_LEAD in Engineering team)

**Test 3.1: TEAM_LEAD Can View All Team OKRs**
- **Action**: GET `/api/objectives`
- **Expected**: Returns all Engineering team OKRs + owned OKRs
- **Status**: ⬜ Not Tested

**Test 3.2: TEAM_LEAD Can Edit Team OKRs**
- **Action**: PATCH `/api/objectives/{teamMemberOkrId}` with modifications
- **Expected**: `200 OK` - OKR updated successfully
- **Status**: ⬜ Not Tested

**Test 3.3: TEAM_LEAD Can Delete Team OKRs**
- **Action**: DELETE `/api/objectives/{teamMemberOkrId}`
- **Expected**: `200 OK` - OKR deleted successfully
- **Status**: ⬜ Not Tested

**Test 3.4: TEAM_LEAD Cannot Edit Other Teams' OKRs**
- **Action**: PATCH `/api/objectives/{productTeamOkrId}` with modifications
- **Expected**: `403 Forbidden` - "You do not have permission to edit this OKR"
- **Status**: ⬜ Not Tested

**Test 3.5: TEAM_LEAD Can Create Key Results for Team OKRs**
- **Action**: POST `/api/key-results` with objectiveId from team OKR
- **Expected**: `201 Created` - Key result created
- **Status**: ⬜ Not Tested

---

### Test Suite 4: WORKSPACE_OWNER Role Access

**User**: `john@acme.com` (WORKSPACE_OWNER in Product Development workspace)

**Test 4.1: WORKSPACE_OWNER Can View All Workspace OKRs**
- **Action**: GET `/api/objectives?workspaceId={workspaceId}`
- **Expected**: Returns all OKRs in the workspace
- **Status**: ⬜ Not Tested

**Test 4.2: WORKSPACE_OWNER Can Edit Any Workspace OKR**
- **Action**: PATCH `/api/objectives/{anyWorkspaceOkrId}` with modifications
- **Expected**: `200 OK` - OKR updated successfully
- **Status**: ⬜ Not Tested

**Test 4.3: WORKSPACE_OWNER Can Delete Any Workspace OKR**
- **Action**: DELETE `/api/objectives/{anyWorkspaceOkrId}`
- **Expected**: `200 OK` - OKR deleted successfully
- **Status**: ⬜ Not Tested

**Test 4.4: WORKSPACE_OWNER Can Create OKRs in Workspace**
- **Action**: POST `/api/objectives` with workspaceId
- **Expected**: `201 Created` - OKR created successfully
- **Status**: ⬜ Not Tested

---

### Test Suite 5: ORG_ADMIN Role Access

**User**: `john@acme.com` (ORG_ADMIN in Acme Corporation)

**Test 5.1: ORG_ADMIN Can View All Organization OKRs**
- **Action**: GET `/api/objectives`
- **Expected**: Returns all OKRs in the organization
- **Status**: ⬜ Not Tested

**Test 5.2: ORG_ADMIN Can Edit Any Organization OKR**
- **Action**: PATCH `/api/objectives/{anyOrgOkrId}` with modifications
- **Expected**: `200 OK` - OKR updated successfully
- **Status**: ⬜ Not Tested

**Test 5.3: ORG_ADMIN Can Delete Any Organization OKR**
- **Action**: DELETE `/api/objectives/{anyOrgOkrId}`
- **Expected**: `200 OK` - OKR deleted successfully
- **Status**: ⬜ Not Tested

**Test 5.4: ORG_ADMIN Can Change OKR Ownership**
- **Action**: PATCH `/api/objectives/{okrId}` with:
  ```json
  {
    "ownerId": "{differentUserId}"
  }
  ```
- **Expected**: `200 OK` - Ownership changed successfully
- **Status**: ⬜ Not Tested

---

### Test Suite 6: Permission Inheritance

**Test 6.1: Key Result Inherits Parent Objective Permissions**
- **Setup**: Create OKR owned by MEMBER, add Key Result
- **Action**: TEAM_LEAD tries to edit Key Result
- **Expected**: `200 OK` - Can edit (inherits from Objective)
- **Status**: ⬜ Not Tested

**Test 6.2: Initiative Inherits Parent Objective Permissions**
- **Setup**: Create OKR owned by MEMBER, add Initiative
- **Action**: TEAM_LEAD tries to edit Initiative
- **Expected**: `200 OK` - Can edit (inherits from Objective)
- **Status**: ⬜ Not Tested

**Test 6.3: Viewing Key Results Requires Parent Objective Access**
- **Action**: MEMBER tries to GET `/api/key-results/{keyResultId}` for another team's OKR
- **Expected**: `403 Forbidden` - Cannot view (no access to parent objective)
- **Status**: ⬜ Not Tested

---

### Test Suite 7: Data Filtering

**Test 7.1: Users Only See Accessible OKRs**
- **User**: MEMBER in Engineering team
- **Action**: GET `/api/objectives`
- **Expected**: Only returns Engineering team OKRs + owned OKRs (no Product team OKRs)
- **Status**: ⬜ Not Tested

**Test 7.2: Empty Results for Unauthorized Access**
- **Action**: GET `/api/objectives?workspaceId={workspaceId}` (user not in workspace)
- **Expected**: `200 OK` with empty array `[]`
- **Status**: ⬜ Not Tested

**Test 7.3: Owned OKRs Always Visible**
- **User**: MEMBER
- **Action**: GET `/api/objectives`
- **Expected**: Returns OKRs owned by user, even if not in same team/workspace
- **Status**: ⬜ Not Tested

---

### Test Suite 8: Error Handling

**Test 8.1: Missing Authentication Token**
- **Action**: GET `/api/objectives` without Authorization header
- **Expected**: `401 Unauthorized`
- **Status**: ⬜ Not Tested

**Test 8.2: Invalid Permission**
- **Action**: VIEWER tries to POST `/api/objectives`
- **Expected**: `403 Forbidden` with clear error message
- **Status**: ⬜ Not Tested

**Test 8.3: Non-existent OKR Access**
- **Action**: GET `/api/objectives/{nonExistentId}`
- **Expected**: `404 Not Found` or `403 Forbidden` (depending on implementation)
- **Status**: ⬜ Not Tested

**Test 8.4: Clear Permission Denial Messages**
- **Action**: MEMBER tries to edit team OKR they don't own
- **Expected**: `403 Forbidden` - "You do not have permission to edit this OKR"
- **Status**: ⬜ Not Tested

---

### Test Suite 9: Check-in Permissions

**Test 9.1: MEMBER Can Create Check-ins for Own Key Results**
- **Action**: POST `/api/key-results/{ownKeyResultId}/check-in`
- **Expected**: `201 Created` - Check-in created
- **Status**: ⬜ Not Tested

**Test 9.2: MEMBER Cannot Create Check-ins for Team Key Results**
- **Action**: POST `/api/key-results/{teamKeyResultId}/check-in`
- **Expected**: `403 Forbidden` - "You do not have permission to create check-ins for this key result"
- **Status**: ⬜ Not Tested

**Test 9.3: TEAM_LEAD Can Create Check-ins for Team Key Results**
- **Action**: POST `/api/key-results/{teamKeyResultId}/check-in`
- **Expected**: `201 Created` - Check-in created
- **Status**: ⬜ Not Tested

---

## 🧰 Testing Tools

### Option 1: Using cURL

```bash
# Login first
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"test123"}'

# Save the access_token from response, then:
export TOKEN="your-access-token-here"

# Test GET request
curl -X GET http://localhost:3000/api/objectives \
  -H "Authorization: Bearer $TOKEN"

# Test POST request
curl -X POST http://localhost:3000/api/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test OKR",
    "workspaceId": "workspace-id",
    "ownerId": "user-id",
    "period": "QUARTERLY",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }'
```

### Option 2: Using Postman/Insomnia

1. Create a collection with:
   - Login request
   - Variable for `access_token`
   - All test endpoints
2. Set Authorization header: `Bearer {{access_token}}`
3. Run test scenarios sequentially

### Option 3: Using the Frontend

1. Login with different users
2. Navigate to OKR pages
3. Try to create/edit/delete OKRs
4. Verify UI hides/disabled unauthorized actions
5. Check console for API errors

---

## 📝 Test Execution Checklist

- [ ] **Phase 1: Setup**
  - [ ] Database migrated and seeded
  - [ ] Test users created/verified
  - [ ] API Gateway running (port 3000)
  - [ ] Core API running (port 3001)

- [ ] **Phase 2: VIEWER Tests** (Test Suite 1)
  - [ ] Test 1.1: Can view OKRs
  - [ ] Test 1.2: Cannot create OKRs
  - [ ] Test 1.3: Cannot edit OKRs
  - [ ] Test 1.4: Cannot delete OKRs
  - [ ] Test 1.5: Can view Key Results

- [ ] **Phase 3: MEMBER Tests** (Test Suite 2)
  - [ ] Test 2.1: Can view team OKRs
  - [ ] Test 2.2: Can create own OKRs
  - [ ] Test 2.3: Can edit own OKRs
  - [ ] Test 2.4: Cannot edit others' OKRs
  - [ ] Test 2.5: Can delete own OKRs
  - [ ] Test 2.6: Cannot delete team OKRs
  - [ ] Test 2.7: Can create Key Results

- [ ] **Phase 4: TEAM_LEAD Tests** (Test Suite 3)
  - [ ] Test 3.1: Can view all team OKRs
  - [ ] Test 3.2: Can edit team OKRs
  - [ ] Test 3.3: Can delete team OKRs
  - [ ] Test 3.4: Cannot edit other teams' OKRs
  - [ ] Test 3.5: Can create Key Results for team OKRs

- [ ] **Phase 5: WORKSPACE_OWNER Tests** (Test Suite 4)
  - [ ] Test 4.1: Can view all workspace OKRs
  - [ ] Test 4.2: Can edit any workspace OKR
  - [ ] Test 4.3: Can delete any workspace OKR
  - [ ] Test 4.4: Can create OKRs in workspace

- [ ] **Phase 6: ORG_ADMIN Tests** (Test Suite 5)
  - [ ] Test 5.1: Can view all organization OKRs
  - [ ] Test 5.2: Can edit any organization OKR
  - [ ] Test 5.3: Can delete any organization OKR
  - [ ] Test 5.4: Can change OKR ownership

- [ ] **Phase 7: Inheritance Tests** (Test Suite 6)
  - [ ] Test 6.1: Key Results inherit permissions
  - [ ] Test 6.2: Initiatives inherit permissions
  - [ ] Test 6.3: Viewing requires parent access

- [ ] **Phase 8: Data Filtering Tests** (Test Suite 7)
  - [ ] Test 7.1: Users only see accessible OKRs
  - [ ] Test 7.2: Empty results for unauthorized access
  - [ ] Test 7.3: Owned OKRs always visible

- [ ] **Phase 9: Error Handling Tests** (Test Suite 8)
  - [ ] Test 8.1: Missing token returns 401
  - [ ] Test 8.2: Invalid permission returns 403
  - [ ] Test 8.3: Non-existent OKR handled correctly
  - [ ] Test 8.4: Clear error messages

- [ ] **Phase 10: Check-in Tests** (Test Suite 9)
  - [ ] Test 9.1: MEMBER can create check-ins for own KRs
  - [ ] Test 9.2: MEMBER cannot create check-ins for team KRs
  - [ ] Test 9.3: TEAM_LEAD can create check-ins for team KRs

---

## 🐛 Known Issues & Edge Cases to Test

### Edge Case 1: User in Multiple Teams
- **Scenario**: User is MEMBER in Team A and TEAM_LEAD in Team B
- **Test**: Verify user can manage Team B OKRs but only view Team A OKRs

### Edge Case 2: OKR Without Team Assignment
- **Scenario**: OKR assigned to workspace but not team
- **Test**: Verify WORKSPACE_OWNER can manage it

### Edge Case 3: Cross-Workspace Access
- **Scenario**: User in Workspace A tries to access Workspace B OKR
- **Test**: Verify access denied even if same organization

### Edge Case 4: Deleted Team Member
- **Scenario**: User removed from team
- **Test**: Verify they lose access to team OKRs but keep own OKRs

---

## 📊 Test Results Template

```
Test Suite: [Name]
Tester: [Your Name]
Date: [Date]
Environment: Development

| Test ID | Description | Status | Notes |
|---------|-------------|--------|-------|
| 1.1 | VIEWER can view OKRs | ✅ PASS | Returns OKRs correctly |
| 1.2 | VIEWER cannot create | ✅ PASS | 403 returned as expected |
| ... | ... | ... | ... |

Summary:
- Total Tests: X
- Passed: Y
- Failed: Z
- Issues Found: [List any issues]
```

---

## 🚨 Critical Tests (Must Pass)

These tests are critical for security and must pass:

1. ✅ VIEWER cannot create/edit/delete OKRs
2. ✅ MEMBER cannot edit/delete other members' OKRs
3. ✅ Users cannot access OKRs outside their workspace/team
4. ✅ Permission inheritance works for Key Results and Initiatives
5. ✅ Ownership changes require admin permissions

---

## 💡 Tips for Testing

1. **Start with low-privilege roles** (VIEWER, MEMBER) before testing higher roles
2. **Test both positive and negative cases** (can do X, cannot do Y)
3. **Verify API responses and error messages** are clear
4. **Check database** to ensure no unauthorized changes occurred
5. **Test with multiple users simultaneously** to check isolation
6. **Use browser dev tools** to inspect API calls and responses
7. **Test boundary conditions** (empty arrays, null values, etc.)

---

## 📞 Support

If you encounter issues during testing:

1. Check API Gateway logs (`services/api-gateway`)
2. Check Core API logs (`services/core-api`)
3. Verify database migrations are up to date
4. Confirm test users have correct roles assigned
5. Review `PERMISSIONS_PHASE1_IMPLEMENTATION.md` and `PHASE2_IMPLEMENTATION_SUMMARY.md`

---

**Good luck with testing! 🎉**





