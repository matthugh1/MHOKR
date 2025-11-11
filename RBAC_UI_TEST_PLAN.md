# RBAC Migration UI Test Plan

## Test Environment Setup

### Prerequisites
- Frontend running on `http://localhost:5173`
- Core API running on `http://localhost:3001`
- Database seeded with test data
- Test users with different roles:
  - **Superuser**: `admin@test.com` / `password123`
  - **Tenant Owner**: `owner@test.com` / `password123`
  - **Tenant Admin**: `admin@org1.com` / `password123`
  - **Workspace Owner**: `workspace@org1.com` / `password123`
  - **Team Lead**: `teamlead@org1.com` / `password123`
  - **Member**: `member@org1.com` / `password123`
  - **Viewer**: `viewer@org1.com` / `password123`

---

## Test Suite 1: Authentication & Authorization

### Test 1.1: Login & User Context
**Objective**: Verify users can log in and see their correct role context

**Steps**:
1. Navigate to login page
2. Login as `admin@test.com` with password `password123`
3. Verify user is logged in successfully
4. Check user profile/context shows correct role (Superuser)
5. Logout

**Expected Results**:
- Login successful
- User context displays correct role information
- User can access appropriate dashboard sections

---

### Test 1.2: Role-Based Access Control
**Objective**: Verify users only see features they have permission to access

**Steps**:
1. Login as `member@org1.com` (Member role)
2. Verify user CAN:
   - View OKRs in their workspace/team
   - Create OKRs
   - Edit their own OKRs
3. Verify user CANNOT:
   - Access Admin/Settings pages
   - Manage users
   - Delete OKRs they don't own
4. Login as `viewer@org1.com` (Viewer role)
5. Verify user CAN:
   - View OKRs
6. Verify user CANNOT:
   - Create OKRs
   - Edit OKRs
   - Delete OKRs

**Expected Results**:
- Users only see features allowed by their role
- Forbidden actions are hidden or disabled
- Appropriate error messages shown for unauthorized actions

---

## Test Suite 2: User Management & Role Assignment

### Test 2.1: Add New User with Role Assignment
**Objective**: Verify the "Add User" form works correctly and assigns roles properly

**Steps**:
1. Login as `owner@org1.com` (Tenant Owner)
2. Navigate to Settings → People
3. Click "Add User" button
4. Fill in the form:
   - Name: `Test User`
   - Email: `testuser@org1.com`
   - Password: `password123`
   - Organization: Select organization
   - Organization Role: Select `MEMBER`
   - Workspace: Select a workspace
   - Workspace Role: Select `MEMBER`
5. Click "Create User"
6. Verify user appears in the users list
7. Verify the assigned roles are displayed correctly

**Expected Results**:
- Form opens successfully
- All dropdowns populate correctly
- User is created with correct roles
- User appears in list with correct role badges

---

### Test 2.2: Organization Dropdown Reset Behavior
**Objective**: Verify workspace dropdown resets when organization changes

**Steps**:
1. Navigate to Settings → People
2. Click "Add User"
3. Select an organization from Organization dropdown
4. Select a workspace from Workspace dropdown
5. Select a workspace role
6. Change the Organization dropdown to a different organization
7. Verify:
   - Workspace dropdown resets to empty/placeholder
   - Workspace Role resets to `MEMBER`
8. Close the dialog without saving
9. Reopen the dialog
10. Verify all fields are reset

**Expected Results**:
- When organization changes, workspace and workspace role reset
- Dialog close/reset clears all form fields
- Form state is properly managed

---

### Test 2.3: Update User Roles
**Objective**: Verify role updates work correctly

**Steps**:
1. Login as `owner@org1.com`
2. Navigate to Settings → People
3. Find an existing user in the list
4. Click edit/update button
5. Change their organization role from `MEMBER` to `ORG_ADMIN`
6. Change their workspace role from `MEMBER` to `WORKSPACE_OWNER`
7. Save changes
8. Verify updated roles are reflected in the UI
9. Logout and login as that updated user
10. Verify user has access to features matching their new roles

**Expected Results**:
- Role updates save successfully
- UI reflects new roles immediately
- User permissions update correctly

---

### Test 2.4: Remove User from Organization/Workspace
**Objective**: Verify user removal works correctly

**Steps**:
1. Login as `owner@org1.com`
2. Navigate to Settings → People
3. Find a user
4. Click remove/delete button
5. Confirm deletion
6. Verify user is removed from the list
7. Verify user can no longer access resources from that organization/workspace

**Expected Results**:
- User removal confirmation works
- User is removed from UI
- User permissions are revoked

---

## Test Suite 3: OKR Access Control

### Test 3.1: View OKRs by Role
**Objective**: Verify users only see OKRs they have permission to view

**Steps**:
1. Login as `member@org1.com`
2. Navigate to OKRs/Objectives page
3. Verify only accessible OKRs are displayed:
   - OKRs in user's workspace/team
   - OKRs owned by the user
   - Public tenant OKRs (if applicable)
4. Login as `viewer@org1.com`
5. Verify viewer can see OKRs but cannot edit/delete

**Expected Results**:
- Users only see OKRs they have permission to view
- Filtering works correctly by workspace/team
- Visibility levels are respected

---

### Test 3.2: Create OKR Permissions
**Objective**: Verify OKR creation respects role permissions

**Steps**:
1. Login as `member@org1.com`
2. Navigate to create OKR page
3. Verify user can select workspace/team they belong to
4. Create a new OKR
5. Verify OKR is created successfully
6. Login as `viewer@org1.com`
7. Navigate to create OKR page
8. Verify create button is disabled or user cannot access create page

**Expected Results**:
- Members can create OKRs in their workspace/team
- Viewers cannot create OKRs
- Appropriate error messages shown

---

### Test 3.3: Edit OKR Permissions
**Objective**: Verify edit permissions work correctly

**Steps**:
1. Login as `member@org1.com`
2. Navigate to an OKR the user owns
3. Verify edit button is available
4. Edit the OKR and save
5. Navigate to an OKR owned by another user
6. Verify:
   - If user has edit permission: edit button available
   - If user doesn't have permission: edit button disabled/hidden
7. Login as workspace owner
8. Verify workspace owner can edit OKRs in their workspace

**Expected Results**:
- Owners can edit their own OKRs
- Workspace owners can edit workspace OKRs
- Members cannot edit others' OKRs (unless permitted)
- Edit permissions are correctly enforced

---

### Test 3.4: Delete OKR Permissions
**Objective**: Verify delete permissions work correctly

**Steps**:
1. Login as `member@org1.com`
2. Navigate to an OKR the user owns
3. Verify delete button is available
4. Delete the OKR
5. Verify OKR is removed
6. Navigate to an OKR owned by another user
7. Verify delete button is disabled/hidden
8. Login as workspace owner
9. Verify workspace owner can delete OKRs in their workspace

**Expected Results**:
- Owners can delete their own OKRs
- Workspace owners can delete workspace OKRs
- Appropriate permissions are enforced

---

## Test Suite 4: Workspace & Team Hierarchy

### Test 4.1: Workspace Navigation
**Objective**: Verify workspace switching works correctly

**Steps**:
1. Login as user with access to multiple workspaces
2. Verify workspace selector/switcher is visible
3. Switch between workspaces
4. Verify:
   - OKR list updates to show OKRs from selected workspace
   - User context updates
   - Permissions reflect current workspace role

**Expected Results**:
- Workspace switching works smoothly
- Data updates correctly
- UI reflects current workspace context

---

### Test 4.2: Team Hierarchy Display
**Objective**: Verify team hierarchy is displayed correctly

**Steps**:
1. Login as `teamlead@org1.com`
2. Navigate to Teams section
3. Verify team hierarchy is displayed:
   - Organization → Workspace → Team
4. Verify user can see their team
5. Verify user can navigate team structure

**Expected Results**:
- Hierarchy displays correctly
- Navigation works
- User can access their team resources

---

## Test Suite 5: Error Handling & Edge Cases

### Test 5.1: Unauthorized Access Attempts
**Objective**: Verify appropriate error messages for unauthorized actions

**Steps**:
1. Login as `viewer@org1.com`
2. Try to access admin settings (via direct URL if possible)
3. Verify appropriate error/forbidden message
4. Try to edit an OKR
5. Verify error message or disabled state
6. Try to delete an OKR
7. Verify error message or disabled state

**Expected Results**:
- Clear error messages for unauthorized actions
- UI prevents unauthorized actions
- Error messages are user-friendly

---

### Test 5.2: Form Validation
**Objective**: Verify form validation works correctly

**Steps**:
1. Navigate to Add User form
2. Try to submit without filling required fields
3. Verify validation errors appear
4. Try invalid email format
5. Verify email validation error
6. Try weak password
7. Verify password validation (if implemented)

**Expected Results**:
- Required field validation works
- Email format validation works
- Password validation works (if implemented)
- Errors are clear and helpful

---

### Test 5.3: Role Assignment Edge Cases
**Objective**: Verify edge cases in role assignment

**Steps**:
1. Login as `owner@org1.com`
2. Try to assign a user to a workspace they don't belong to
3. Verify appropriate handling
4. Try to assign invalid role combinations
5. Verify validation prevents invalid assignments
6. Try to remove a user who is the only admin
7. Verify appropriate warning (if implemented)

**Expected Results**:
- Invalid role assignments are prevented
- Appropriate warnings/errors shown
- Edge cases handled gracefully

---

## Test Suite 6: UI/UX Behavior

### Test 6.1: Dropdown Interactions
**Objective**: Verify all dropdowns work correctly

**Steps**:
1. Navigate to Add User form
2. Test Organization dropdown:
   - Opens and closes correctly
   - Shows available organizations
   - Selection works
3. Test Workspace dropdown:
   - Populates based on selected organization
   - Shows available workspaces
   - Selection works
   - Resets when organization changes
4. Test Role dropdowns:
   - Show appropriate roles
   - Selection works
   - Default values are correct

**Expected Results**:
- All dropdowns function correctly
- Dependencies between dropdowns work
- States update correctly

---

### Test 6.2: Loading States
**Objective**: Verify loading indicators appear during async operations

**Steps**:
1. Navigate to OKRs page
2. Verify loading indicator appears while fetching data
3. Create a new user
4. Verify loading state during creation
5. Update a user role
6. Verify loading state during update

**Expected Results**:
- Loading indicators appear for async operations
- UI doesn't freeze during operations
- Smooth transitions

---

### Test 6.3: Success/Error Notifications
**Objective**: Verify notifications appear for user actions

**Steps**:
1. Create a new user
2. Verify success notification appears
3. Try invalid form submission
4. Verify error notification appears
5. Update user role
6. Verify success notification appears
7. Try unauthorized action
8. Verify error notification appears

**Expected Results**:
- Success notifications appear for successful actions
- Error notifications appear for errors
- Notifications are clear and actionable
- Notifications dismiss automatically (if implemented)

---

## Test Suite 7: Superuser Functionality

### Test 7.1: Superuser Access
**Objective**: Verify superuser has full access

**Steps**:
1. Login as `admin@test.com` (Superuser)
2. Verify superuser can:
   - Access all organizations
   - View all OKRs
   - Access admin settings
   - Manage all users
3. Verify superuser cannot:
   - Edit/delete OKRs (read-only for OKR content)
   - Create OKRs (if policy restricts)

**Expected Results**:
- Superuser has appropriate access
- Read-only restrictions for OKR content are enforced
- Superuser can manage system-wide settings

---

### Test 7.2: Superuser User Management
**Objective**: Verify superuser can manage users across organizations

**Steps**:
1. Login as `admin@test.com`
2. Navigate to user management
3. Verify superuser can see users from all organizations
4. Create a user in any organization
5. Assign roles across different organizations
6. Verify all operations succeed

**Expected Results**:
- Superuser can manage users across organizations
- Role assignments work correctly
- Superuser bypasses normal restrictions

---

## Test Reporting Checklist

After running all tests, report:

- [ ] Total tests executed
- [ ] Tests passed
- [ ] Tests failed
- [ ] Critical issues found
- [ ] Minor issues found
- [ ] UI/UX improvements needed
- [ ] Performance issues
- [ ] Browser compatibility (test in Chrome, Firefox, Safari)
- [ ] Mobile responsiveness (if applicable)

---

## Notes for Test Execution

1. **Test Data**: Ensure test database is seeded with appropriate test data
2. **Clean State**: Consider resetting database between test runs
3. **Browser Console**: Check browser console for errors during testing
4. **Network Tab**: Monitor network requests to verify API calls
5. **Screenshots**: Capture screenshots of failures for documentation
6. **Test Environment**: Document any environment-specific issues

---

## Priority Levels

- **P0 (Critical)**: Authentication, authorization, role assignment
- **P1 (High)**: OKR access control, user management
- **P2 (Medium)**: UI/UX behaviors, edge cases
- **P3 (Low)**: Nice-to-have features, optimizations

---

## Regression Test Checklist

After fixes, re-run these critical tests:

1. User login and authentication
2. Role-based access control
3. Add/update user with role assignment
4. Organization/workspace dropdown reset behavior
5. OKR view/edit/delete permissions
6. Superuser functionality

---

*Last Updated: [Current Date]*
*Test Plan Version: 1.0*







