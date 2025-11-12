# Policy Decision Explorer - Test Examples

## Example Users

Use these user emails to test different roles and permissions:

### Superuser (Read-only)
- **Email:** `platform@puzzelcx.local` or `admin@test.com`
- **Role:** SUPERUSER
- **Expected:** Can view all OKRs, but mutations denied (SUPERUSER_READ_ONLY)

### Tenant Owner
- **Email:** `founder@puzzelcx.local`
- **Role:** TENANT_OWNER
- **Expected:** Full access to all actions within tenant

### Tenant Admin
- **Email:** `admin1@puzzelcx.local` or `admin2@puzzelcx.local`
- **Role:** TENANT_ADMIN
- **Expected:** Can edit/delete OKRs, manage users, etc.

### Workspace Lead
- **Email:** `workspace-lead-sales-1@puzzelcx.local`
- **Role:** WORKSPACE_LEAD
- **Expected:** Can edit OKRs in their workspace

### Team Lead
- **Email:** `team-lead-enterprise-sales@puzzelcx.local`
- **Role:** TEAM_LEAD
- **Expected:** Can edit OKRs in their team

### Team Contributor
- **Email:** `member-enterprise-sales-1@puzzelcx.local`
- **Role:** TEAM_CONTRIBUTOR
- **Expected:** Limited permissions, may be denied for mutations

### Regular Member
- **Email:** `member@org1.com`
- **Role:** MEMBER
- **Expected:** Basic view permissions

### Viewer
- **Email:** `viewer@org1.com`
- **Role:** VIEWER
- **Expected:** Read-only access

---

## Test Scenarios

### Scenario 1: SUPERUSER Read-Only Test
**User:** `platform@puzzelcx.local` (or your superuser email)
**Action:** `edit_okr`
**Resource:** Provide any `objectiveId` from your database
**Expected Result:** 
- `allow: false`
- `reason: "SUPERUSER_READ_ONLY"`
- Shows SUPERUSER in userRoles

### Scenario 2: Tenant Boundary Test
**User:** `founder@puzzelcx.local` (from org1)
**Action:** `edit_okr`
**Resource:** Provide `tenantId` from a different organisation
**Expected Result:**
- `allow: false`
- `reason: "TENANT_BOUNDARY"`
- Shows tenant mismatch in details

### Scenario 3: Role Permission Test
**User:** `member-enterprise-sales-1@puzzelcx.local` (TEAM_CONTRIBUTOR)
**Action:** `publish_okr`
**Resource:** Provide any `objectiveId`
**Expected Result:**
- `allow: false`
- `reason: "ROLE_DENY"`
- Shows only TEAM_CONTRIBUTOR in userRoles

### Scenario 4: Publish Lock Test
**User:** `member-enterprise-sales-1@puzzelcx.local`
**Action:** `edit_okr`
**Resource:** Provide `objectiveId` of a published OKR (`isPublished: true`)
**Expected Result:**
- `allow: false`
- `reason: "PUBLISH_LOCK"`
- Only TENANT_ADMIN/TENANT_OWNER can edit published OKRs

### Scenario 5: Visibility Test (PRIVATE OKR)
**User:** `member-enterprise-sales-1@puzzelcx.local`
**Action:** `view_okr`
**Resource:** Provide `objectiveId` of a PRIVATE OKR (not whitelisted)
**Expected Result:**
- `allow: false`
- `reason: "PRIVATE_VISIBILITY"`
- Only owner and whitelisted users can view

### Scenario 6: Successful ALLOW
**User:** `founder@puzzelcx.local` (TENANT_OWNER)
**Action:** `view_okr`
**Resource:** Provide any `objectiveId` from their tenant
**Expected Result:**
- `allow: true`
- `reason: "ALLOW"`
- Shows TENANT_OWNER in userRoles

### Scenario 7: Cross-User Evaluation
**User:** Your superuser account
**Action:** `edit_okr`
**Resource:** 
- `userId`: `member-enterprise-sales-1@puzzelcx.local`
- `objectiveId`: Any objective ID
**Expected Result:**
- Evaluates permissions for `member-enterprise-sales-1@puzzelcx.local`
- `meta.evaluatedUserId` shows the evaluated user
- `meta.requestUserId` shows your superuser ID

---

## Finding Real IDs

To get actual IDs from your database, you can:

1. **Get User IDs:**
   ```bash
   # Query users table
   SELECT id, email, name FROM users LIMIT 10;
   ```

2. **Get Objective IDs:**
   ```bash
   # Query objectives table
   SELECT id, title, "organizationId", "isPublished", "visibilityLevel" FROM objectives LIMIT 10;
   ```

3. **Get Key Result IDs:**
   ```bash
   # Query key results via junction table
   SELECT kr.id, kr.title, okr."objectiveId" 
   FROM "keyResults" kr
   JOIN "objective_key_results" okr ON kr.id = okr."keyResultId"
   LIMIT 10;
   ```

4. **Get Tenant/Organization IDs:**
   ```bash
   SELECT id, name, slug FROM organizations LIMIT 5;
   ```

5. **Get Workspace IDs:**
   ```bash
   SELECT id, name, "tenantId" FROM workspaces LIMIT 5;
   ```

6. **Get Team IDs:**
   ```bash
   SELECT id, name, "workspaceId" FROM teams LIMIT 5;
   ```

---

## Quick Test Cases

### Minimal Test (No Resource)
```
User: founder@puzzelcx.local
Action: view_okr
Resource: {} (empty)
```
Tests basic role-based permission without resource context.

### Full Context Test
```
User: admin1@puzzelcx.local
Action: edit_okr
Resource: {
  tenantId: "org-123",
  workspaceId: "ws-456",
  objectiveId: "obj-789"
}
```
Tests complete permission evaluation with all context.

### Key Result Test
```
User: team-lead-enterprise-sales@puzzelcx.local
Action: edit_okr
Resource: {
  keyResultId: "kr-123"
}
```
Tests permission check on a key result (loads parent objective automatically).

---

## Testing Tips

1. **Start Simple:** Test with `view_okr` action first (most permissive)
2. **Check Roles:** Look at `details.userRoles` to verify user's role assignments
3. **Test Boundaries:** Try cross-tenant actions to verify isolation
4. **Check Scopes:** Verify `details.scopes` shows correct tenant/workspace/team IDs
5. **Publish Lock:** Find published OKRs (`isPublished: true`) to test publish lock
6. **Visibility:** Test with PRIVATE OKRs to verify visibility rules

---

## Expected Reason Codes

- `ALLOW` - Permission granted
- `ROLE_DENY` - User lacks required role
- `TENANT_BOUNDARY` - Cross-tenant access attempt
- `PRIVATE_VISIBILITY` - OKR is private and user not whitelisted
- `PUBLISH_LOCK` - OKR is published and user lacks unlock permission
- `SUPERUSER_READ_ONLY` - Superuser attempting mutation (read-only)



