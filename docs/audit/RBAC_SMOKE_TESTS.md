# RBAC Smoke Tests

**Purpose:** Curl-based smoke tests to verify RBAC deny/allow cases for the OKR platform.

**Target Endpoint:** `GET /rbac/assignments/effective`

**Base URL:** `http://localhost:3001` (adjust for your environment)

---

## Table of Contents

1. [Setup](#setup)
2. [Test Cases](#test-cases)
   - [SUPERUSER Deny Cases](#superuser-deny-cases)
   - [Publish Lock (Cycle Lock) Deny](#publish-lock-cycle-lock-deny)
   - [PRIVATE Visibility Deny](#private-visibility-deny)
   - [Tenant Boundary Deny](#tenant-boundary-deny)
   - [TENANT_VIEWER Restrictions](#tenant_viewer-restrictions)
   - [EXEC_ONLY TENANT_ADMIN Deny](#exec_only-tenant_admin-deny)
3. [Allow Cases (Positive Tests)](#allow-cases-positive-tests)
4. [Debugging Tips](#debugging-tips)

---

## Setup

### Prerequisites

1. **Running Services:**
   ```bash
   # Start all services
   docker-compose up -d
   
   # Or run core-api directly
   cd services/core-api
   npm run start:dev
   ```

2. **Environment Variables:**
   ```bash
   export API_URL="http://localhost:3001"
   export JWT_TOKEN="your-jwt-token-here"
   ```

3. **Get JWT Token:**
   ```bash
   # Login as a user
   curl -X POST "$API_URL/auth/login" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@acmecorp.com",
       "password": "password123"
     }' | jq -r '.accessToken'
   ```

### Test Users Setup

Create test users with specific roles for testing:

```bash
# SUPERUSER
export SUPERUSER_TOKEN="..."

# TENANT_OWNER in Tenant A
export TENANT_OWNER_TOKEN="..."

# TENANT_ADMIN in Tenant A
export TENANT_ADMIN_TOKEN="..."

# TEAM_LEAD in Tenant A
export TEAM_LEAD_TOKEN="..."

# WORKSPACE_MEMBER in Tenant A
export WORKSPACE_MEMBER_TOKEN="..."

# TENANT_VIEWER (only) in Tenant A
export TENANT_VIEWER_TOKEN="..."

# User with no roles in Tenant A (but roles in Tenant B)
export CROSS_TENANT_TOKEN="..."
```

---

## Test Cases

### SUPERUSER Deny Cases

**Reference:** `services/core-api/src/modules/rbac/rbac.ts:182-184`

SUPERUSER should be denied OKR mutation actions.

#### Test 1.1: SUPERUSER Cannot Edit OKR

```bash
# Get effective permissions for SUPERUSER
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.scopes[0].actionsDenied | map(select(. == "edit_okr"))'

# Expected: ["edit_okr"]
```

**Verify:**
- ✅ `edit_okr` is in `actionsDenied` array
- ❌ `edit_okr` is NOT in `actionsAllowed` array

#### Test 1.2: SUPERUSER Cannot Create OKR

```bash
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.scopes[0].actionsDenied | map(select(. == "create_okr"))'

# Expected: ["create_okr"]
```

#### Test 1.3: SUPERUSER Cannot Delete OKR

```bash
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.scopes[0].actionsDenied | map(select(. == "delete_okr"))'

# Expected: ["delete_okr"]
```

#### Test 1.4: SUPERUSER Cannot Publish OKR

```bash
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.scopes[0].actionsDenied | map(select(. == "publish_okr"))'

# Expected: ["publish_okr"]
```

#### Test 1.5: SUPERUSER Cannot Request Check-in

```bash
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.scopes[0].actionsDenied | map(select(. == "request_checkin"))'

# Expected: ["request_checkin"]
```

#### Test 1.6: SUPERUSER CAN View OKRs (Allow Case)

```bash
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.scopes[0].actionsAllowed | map(select(. == "view_okr"))'

# Expected: ["view_okr"]
```

#### Test 1.7: SUPERUSER CAN Impersonate (Allow Case)

```bash
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.scopes[0].actionsAllowed | map(select(. == "impersonate_user"))'

# Expected: ["impersonate_user"]
```

---

### Publish Lock (Cycle Lock) Deny

**Reference:** `services/core-api/src/modules/rbac/rbac.ts:310-323`

Once an OKR is published, only TENANT_OWNER and TENANT_ADMIN can edit/delete it.

#### Test 2.1: Setup - Create Published OKR

```bash
# Create OKR as TEAM_LEAD
OKR_ID=$(curl -X POST "$API_URL/okrs" \
  -H "Authorization: Bearer $TEAM_LEAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test OKR for Publish Lock",
    "type": "OBJECTIVE",
    "organizationId": "'"$TENANT_A_ID"'",
    "teamId": "'"$TEAM_ID"'",
    "isPublished": false
  }' | jq -r '.id')

echo "Created OKR: $OKR_ID"

# Publish the OKR
curl -X PATCH "$API_URL/okrs/$OKR_ID/publish" \
  -H "Authorization: Bearer $TEAM_LEAD_TOKEN"
```

#### Test 2.2: TEAM_LEAD Cannot Edit Published OKR (Owner)

```bash
# Attempt to edit published OKR
curl -X PATCH "$API_URL/okrs/$OKR_ID" \
  -H "Authorization: Bearer $TEAM_LEAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title (Should Fail)"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden
```

**Expected Error:**
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Insufficient permissions to edit published OKR"
}
```

#### Test 2.3: WORKSPACE_MEMBER Cannot Edit Published OKR

```bash
curl -X PATCH "$API_URL/okrs/$OKR_ID" \
  -H "Authorization: Bearer $WORKSPACE_MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title (Should Fail)"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden
```

#### Test 2.4: TENANT_ADMIN CAN Edit Published OKR (Allow Case)

```bash
curl -X PATCH "$API_URL/okrs/$OKR_ID" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated by TENANT_ADMIN (Should Succeed)"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 200 OK
```

#### Test 2.5: Verify Effective Permissions

```bash
# Check TEAM_LEAD permissions for this specific OKR
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_A_ID&teamId=$TEAM_ID" \
  -H "Authorization: Bearer $TEAM_LEAD_TOKEN" \
  | jq '.scopes[] | select(.teamId == "'"$TEAM_ID"'")'

# Verify: edit_okr should be in actionsDenied when OKR is published
# (Note: This endpoint shows general permissions, not OKR-specific)
```

---

### PRIVATE Visibility Deny

**Reference:** `services/core-api/src/modules/rbac/visibilityPolicy.ts:46-48, 62-107`

PRIVATE OKRs can only be viewed by owner, SUPERUSER, TENANT_OWNER, or whitelisted users.

#### Test 3.1: Setup - Create PRIVATE OKR

```bash
# Create PRIVATE OKR as TENANT_OWNER
PRIVATE_OKR_ID=$(curl -X POST "$API_URL/okrs" \
  -H "Authorization: Bearer $TENANT_OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Confidential M&A OKR",
    "type": "OBJECTIVE",
    "organizationId": "'"$TENANT_A_ID"'",
    "visibilityLevel": "PRIVATE",
    "isPublished": true
  }' | jq -r '.id')

echo "Created PRIVATE OKR: $PRIVATE_OKR_ID"
```

#### Test 3.2: WORKSPACE_MEMBER Cannot View PRIVATE OKR

```bash
# Attempt to view PRIVATE OKR
curl -X GET "$API_URL/okrs/$PRIVATE_OKR_ID" \
  -H "Authorization: Bearer $WORKSPACE_MEMBER_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden or 404 Not Found
```

#### Test 3.3: TEAM_LEAD Cannot View PRIVATE OKR

```bash
curl -X GET "$API_URL/okrs/$PRIVATE_OKR_ID" \
  -H "Authorization: Bearer $TEAM_LEAD_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden or 404 Not Found
```

#### Test 3.4: TENANT_ADMIN Cannot View PRIVATE OKR (Not Whitelisted)

```bash
curl -X GET "$API_URL/okrs/$PRIVATE_OKR_ID" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden (unless TENANT_ADMIN is whitelisted)
```

#### Test 3.5: TENANT_OWNER CAN View PRIVATE OKR (Allow Case)

```bash
curl -X GET "$API_URL/okrs/$PRIVATE_OKR_ID" \
  -H "Authorization: Bearer $TENANT_OWNER_TOKEN" \
  | jq '.id, .title, .visibilityLevel'

# Expected: HTTP 200 OK
# Output:
# "..."
# "Confidential M&A OKR"
# "PRIVATE"
```

#### Test 3.6: SUPERUSER CAN View PRIVATE OKR (Allow Case)

```bash
curl -X GET "$API_URL/okrs/$PRIVATE_OKR_ID" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.id, .title, .visibilityLevel'

# Expected: HTTP 200 OK
```

#### Test 3.7: Add User to Whitelist and Verify Access

```bash
# Add TENANT_ADMIN to private whitelist
curl -X POST "$API_URL/organizations/$TENANT_A_ID/private-whitelist" \
  -H "Authorization: Bearer $TENANT_OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$TENANT_ADMIN_USER_ID"'"
  }'

# Now TENANT_ADMIN should be able to view
curl -X GET "$API_URL/okrs/$PRIVATE_OKR_ID" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  | jq '.id, .title'

# Expected: HTTP 200 OK
```

---

### Tenant Boundary Deny

**Reference:** `services/core-api/src/modules/rbac/rbac.service.ts:270-298, 406-435`

Users cannot perform actions across tenant boundaries.

#### Test 4.1: TENANT_ADMIN Cannot Assign Roles in Different Tenant

```bash
# Attempt to assign role in Tenant B while authenticated as Tenant A admin
curl -X POST "$API_URL/rbac/assignments/assign" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$SOME_USER_ID"'",
    "role": "WORKSPACE_MEMBER",
    "scopeType": "WORKSPACE",
    "scopeId": "'"$TENANT_B_WORKSPACE_ID"'"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden or 404 Not Found
```

**Expected Error:**
```json
{
  "statusCode": 403,
  "message": "Tenant isolation violation",
  "error": "Forbidden"
}
```

#### Test 4.2: WORKSPACE_LEAD Cannot View OKR in Different Tenant

```bash
# Attempt to view OKR in Tenant B
curl -X GET "$API_URL/okrs/$TENANT_B_OKR_ID" \
  -H "Authorization: Bearer $TEAM_LEAD_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden or 404 Not Found
```

#### Test 4.3: Check Effective Permissions (Should Not Show Other Tenants)

```bash
# Get all effective permissions
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  | jq '.scopes | map(.tenantId) | unique'

# Expected: Only shows Tenant A, not Tenant B
# ["<tenant-a-id>"]
```

#### Test 4.4: SUPERUSER CAN Access Multiple Tenants (Allow Case)

```bash
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.scopes | length'

# Expected: May show 0 scopes (SUPERUSER has global access, not tenant-specific)
# But can view OKRs across all tenants
```

---

### TENANT_VIEWER Restrictions

**Reference:** `services/core-api/src/modules/rbac/rbac.ts:441-443, 486-489`

Users with ONLY TENANT_VIEWER role cannot create OKRs or request check-ins.

#### Test 5.1: TENANT_VIEWER Cannot Create OKR

```bash
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_A_ID" \
  -H "Authorization: Bearer $TENANT_VIEWER_TOKEN" \
  | jq '.scopes[0].actionsDenied | map(select(. == "create_okr"))'

# Expected: ["create_okr"]
```

#### Test 5.2: Attempt to Create OKR as TENANT_VIEWER

```bash
curl -X POST "$API_URL/okrs" \
  -H "Authorization: Bearer $TENANT_VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test OKR (Should Fail)",
    "type": "OBJECTIVE",
    "organizationId": "'"$TENANT_A_ID"'"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden
```

#### Test 5.3: TENANT_VIEWER Cannot Request Check-in

```bash
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_A_ID" \
  -H "Authorization: Bearer $TENANT_VIEWER_TOKEN" \
  | jq '.scopes[0].actionsDenied | map(select(. == "request_checkin"))'

# Expected: ["request_checkin"]
```

#### Test 5.4: TENANT_VIEWER CAN View OKRs (Allow Case)

```bash
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_A_ID" \
  -H "Authorization: Bearer $TENANT_VIEWER_TOKEN" \
  | jq '.scopes[0].actionsAllowed | map(select(. == "view_okr" or . == "view_all_okrs"))'

# Expected: ["view_okr", "view_all_okrs"]
```

#### Test 5.5: TENANT_VIEWER CAN Export Data (Allow Case)

```bash
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_A_ID" \
  -H "Authorization: Bearer $TENANT_VIEWER_TOKEN" \
  | jq '.scopes[0].actionsAllowed | map(select(. == "export_data"))'

# Expected: ["export_data"]
```

---

### EXEC_ONLY TENANT_ADMIN Deny

**Reference:** `services/core-api/src/modules/rbac/rbac.ts:316-319, 338-341`

TENANT_ADMIN cannot edit EXEC_ONLY OKRs unless `allowTenantAdminExecVisibility = true`.

#### Test 6.1: Setup - Create EXEC_ONLY OKR

```bash
# Create EXEC_ONLY OKR as TENANT_OWNER
EXEC_OKR_ID=$(curl -X POST "$API_URL/okrs" \
  -H "Authorization: Bearer $TENANT_OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Executive Strategy OKR",
    "type": "OBJECTIVE",
    "organizationId": "'"$TENANT_A_ID"'",
    "visibilityLevel": "EXEC_ONLY",
    "isPublished": true
  }' | jq -r '.id')

echo "Created EXEC_ONLY OKR: $EXEC_OKR_ID"
```

#### Test 6.2: Verify Tenant Setting

```bash
# Check tenant allowTenantAdminExecVisibility setting
curl -X GET "$API_URL/organizations/$TENANT_A_ID" \
  -H "Authorization: Bearer $TENANT_OWNER_TOKEN" \
  | jq '.allowTenantAdminExecVisibility'

# Expected: false (or null, defaults to false)
```

#### Test 6.3: TENANT_ADMIN Cannot Edit EXEC_ONLY OKR

```bash
curl -X PATCH "$API_URL/okrs/$EXEC_OKR_ID" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated by TENANT_ADMIN (Should Fail)"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 403 Forbidden
```

#### Test 6.4: TENANT_OWNER CAN Edit EXEC_ONLY OKR (Allow Case)

```bash
curl -X PATCH "$API_URL/okrs/$EXEC_OKR_ID" \
  -H "Authorization: Bearer $TENANT_OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated by TENANT_OWNER (Should Succeed)"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 200 OK
```

#### Test 6.5: Enable allowTenantAdminExecVisibility

```bash
# Update tenant setting
curl -X PATCH "$API_URL/organizations/$TENANT_A_ID" \
  -H "Authorization: Bearer $TENANT_OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowTenantAdminExecVisibility": true
  }'
```

#### Test 6.6: TENANT_ADMIN CAN Now Edit EXEC_ONLY OKR

```bash
curl -X PATCH "$API_URL/okrs/$EXEC_OKR_ID" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated by TENANT_ADMIN After Flag Enabled"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 200 OK
```

---

## Allow Cases (Positive Tests)

### Test 7.1: TENANT_OWNER Full Access

```bash
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_A_ID" \
  -H "Authorization: Bearer $TENANT_OWNER_TOKEN" \
  | jq '.scopes[0].actionsAllowed | length'

# Expected: 14 (all actions allowed at tenant level)
```

### Test 7.2: WORKSPACE_MEMBER Can Create Own OKR

```bash
curl -X POST "$API_URL/okrs" \
  -H "Authorization: Bearer $WORKSPACE_MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Personal OKR",
    "type": "OBJECTIVE",
    "organizationId": "'"$TENANT_A_ID"'",
    "workspaceId": "'"$WORKSPACE_ID"'"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 201 Created
```

### Test 7.3: TEAM_LEAD Can Publish Team OKR

```bash
# Create team OKR
TEAM_OKR_ID=$(curl -X POST "$API_URL/okrs" \
  -H "Authorization: Bearer $TEAM_LEAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Q4 OKR",
    "type": "OBJECTIVE",
    "organizationId": "'"$TENANT_A_ID"'",
    "teamId": "'"$TEAM_ID"'",
    "isPublished": false
  }' | jq -r '.id')

# Publish it
curl -X PATCH "$API_URL/okrs/$TEAM_OKR_ID/publish" \
  -H "Authorization: Bearer $TEAM_LEAD_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 200 OK
```

### Test 7.4: WORKSPACE_LEAD Can Manage Teams

```bash
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_A_ID&workspaceId=$WORKSPACE_ID" \
  -H "Authorization: Bearer $WORKSPACE_LEAD_TOKEN" \
  | jq '.scopes[] | select(.workspaceId == "'"$WORKSPACE_ID"'") | .actionsAllowed | map(select(. == "manage_teams"))'

# Expected: ["manage_teams"]
```

---

## Debugging Tips

### 1. Check User Context

Get current user's full context:

```bash
curl -X GET "$API_URL/rbac/assignments/me" \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  | jq '.'
```

### 2. Check Effective Permissions

Get all permissions for a user:

```bash
curl -X GET "$API_URL/rbac/assignments/effective" \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  | jq '.scopes[] | {tenantId, roles: .effectiveRoles, allowed: .actionsAllowed | length, denied: .actionsDenied | length}'
```

### 3. Filter by Scope

```bash
# Tenant-level only
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_ID" \
  -H "Authorization: Bearer $YOUR_TOKEN"

# Workspace-level
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_ID&workspaceId=$WORKSPACE_ID" \
  -H "Authorization: Bearer $YOUR_TOKEN"

# Team-level
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_ID&teamId=$TEAM_ID" \
  -H "Authorization: Bearer $YOUR_TOKEN"
```

### 4. Admin Inspecting Another User (NEW)

**Requires:** `manage_users` permission

#### Test 4.1: TENANT_ADMIN Inspecting Another User (Same Tenant)

```bash
# TENANT_ADMIN can inspect users in their tenant
curl -X GET "$API_URL/rbac/assignments/effective?userId=$TARGET_USER_ID&tenantId=$TENANT_A_ID" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  | jq '.'

# Expected: HTTP 200 OK with target user's effective permissions
# Audit log entry created: action="view_user_access"
```

#### Test 4.2: TENANT_ADMIN Inspecting User (Cross-Tenant) - Should Fail

```bash
# Attempting to inspect user in different tenant
curl -X GET "$API_URL/rbac/assignments/effective?userId=$USER_IN_TENANT_B&tenantId=$TENANT_B_ID" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 404 Not Found ("User not found in specified tenant")
```

#### Test 4.3: WORKSPACE_MEMBER Inspecting Another User - Should Fail

```bash
# Regular user without manage_users cannot inspect others
curl -X GET "$API_URL/rbac/assignments/effective?userId=$TARGET_USER_ID" \
  -H "Authorization: Bearer $WORKSPACE_MEMBER_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: HTTP 404 Not Found ("Permission denied: manage_users required")
```

#### Test 4.4: Admin Inspecting User at Specific Scope

```bash
# Inspect user's permissions at workspace scope
curl -X GET "$API_URL/rbac/assignments/effective?userId=$TARGET_USER_ID&tenantId=$TENANT_A_ID&workspaceId=$WORKSPACE_ID" \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  | jq '.scopes[] | select(.workspaceId == "'"$WORKSPACE_ID"'")'

# Expected: HTTP 200 OK, scopes filtered to specified workspace
```

### 4. Check Specific Action

```bash
# Check if user can perform specific action
curl -X GET "$API_URL/rbac/assignments/effective?tenantId=$TENANT_ID" \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  | jq '.scopes[0].actionsAllowed | map(select(. == "edit_okr"))'

# Empty array [] means denied
# ["edit_okr"] means allowed
```

### 5. Verify OKR Visibility

```bash
# Try to fetch OKR
curl -X GET "$API_URL/okrs/$OKR_ID" \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

# 200 = allowed
# 403 = forbidden
# 404 = not found (could be visibility restriction)
```

### 6. Check Audit Logs

```bash
# View recent authorization events
curl -X GET "$API_URL/audit-logs?action=AUTHORIZATION_CHECK&limit=20" \
  -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  | jq '.items[] | {timestamp, action, userId, result}'
```

---

## Test Automation Script

Create a shell script to run all tests:

```bash
#!/bin/bash
# run-rbac-smoke-tests.sh

set -e

API_URL="${API_URL:-http://localhost:3001}"
PASSED=0
FAILED=0

echo "🧪 RBAC Smoke Tests"
echo "=================="
echo ""

# Function to run a test
run_test() {
  local test_name="$1"
  local curl_cmd="$2"
  local expected="$3"
  
  echo -n "Testing: $test_name ... "
  
  result=$(eval "$curl_cmd" 2>&1)
  
  if echo "$result" | grep -q "$expected"; then
    echo "✅ PASS"
    ((PASSED++))
  else
    echo "❌ FAIL"
    echo "   Expected: $expected"
    echo "   Got: $result"
    ((FAILED++))
  fi
}

# Run tests
run_test "SUPERUSER cannot edit OKR" \
  "curl -s -X GET '$API_URL/rbac/assignments/effective' -H 'Authorization: Bearer $SUPERUSER_TOKEN' | jq -r '.scopes[0].actionsDenied | map(select(. == \"edit_okr\")) | .[0]'" \
  "edit_okr"

run_test "TENANT_OWNER can manage billing" \
  "curl -s -X GET '$API_URL/rbac/assignments/effective?tenantId=$TENANT_A_ID' -H 'Authorization: Bearer $TENANT_OWNER_TOKEN' | jq -r '.scopes[0].actionsAllowed | map(select(. == \"manage_billing\")) | .[0]'" \
  "manage_billing"

# Add more tests...

echo ""
echo "=================="
echo "Results: $PASSED passed, $FAILED failed"
echo ""

if [ $FAILED -gt 0 ]; then
  exit 1
fi
```

**Usage:**
```bash
chmod +x run-rbac-smoke-tests.sh
./run-rbac-smoke-tests.sh
```

---

## Summary

**Critical Deny Cases Tested:**

| Test | Rule | Reference |
|------|------|-----------|
| SUPERUSER OKR Edit | SUPERUSER cannot edit OKRs | rbac.ts:182 |
| Publish Lock | Non-admin cannot edit published OKRs | rbac.ts:310-323 |
| PRIVATE Visibility | Non-owner cannot view PRIVATE OKRs | visibilityPolicy.ts:46-48 |
| Tenant Boundary | Cannot access other tenants | rbac.service.ts:270-298 |
| TENANT_VIEWER Create | Cannot create OKRs | rbac.ts:441-443 |
| EXEC_ONLY TENANT_ADMIN | Cannot edit EXEC_ONLY (without flag) | rbac.ts:338-341 |

**Allow Cases Verified:**

| Test | Rule | Reference |
|------|------|-----------|
| TENANT_OWNER Full Access | All actions allowed | rbac.ts:204-218 |
| SUPERUSER View | Can view all OKRs | rbac.ts:167 |
| WORKSPACE_MEMBER Create | Can create own OKRs | rbac.ts:438-452 |
| TEAM_LEAD Publish | Can publish team OKRs | rbac.ts:545-548 |

---

**End of RBAC Smoke Tests**

*For issues or questions, refer to `docs/audit/RBAC_MATRIX_AUTO.md` for detailed authorization logic.*

