# UI Permissions Test Plan

## 🎯 Overview

This guide walks you through testing the permissions system using the web interface. We'll create test users, assign them different roles, and verify that permissions are enforced correctly.

---

## 📋 Phase 1: Setup & User Creation

### Step 1.1: Access the Application

1. **Start the application** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open browser** and navigate to: `http://localhost:5173`

3. **Verify you see the login page**

### Step 1.2: Create Admin User (First User)

**Path**: `/register`

1. Click **"Sign up"** or navigate to `/register`
2. Fill in the registration form:
   - **First Name**: `Admin`
   - **Last Name**: `User`
   - **Email**: `admin@test.com`
   - **Password**: `admin123` (or your preferred password)
3. Click **"Create account"**
4. You should be redirected to the dashboard

**✅ Expected Result**: Account created, logged in, redirected to dashboard

**📝 Note**: This first user will need admin privileges. You'll assign them in Step 1.4.

---

### Step 1.3: Access Settings to Create Additional Users

**Path**: `/dashboard/settings/people`

1. From the dashboard, navigate to **Settings** → **People**
   - Look for Settings in the sidebar navigation
   - Click on "People" or navigate to `/dashboard/settings/people`

2. **Verify you can see**:
   - List of existing users
   - "Create User" button or option

---

### Step 1.4: Create Test Users with Different Roles

Create the following test users using the **People** settings page:

#### User 1: MEMBER Role
1. Click **"Create User"** or **"Add User"** button
2. Fill in:
   - **Name**: `Member User`
   - **Email**: `member@test.com`
   - **Password**: `member123`
3. Click **"Create User"**
4. **Assign MEMBER role**:
   - Find the user in the list
   - Click **"Add to Team"** or manage team membership
   - Select a team (e.g., "Engineering")
   - Select role: **MEMBER**
   - Save

#### User 2: TEAM_LEAD Role
1. Click **"Create User"**
2. Fill in:
   - **Name**: `Team Lead User`
   - **Email**: `teamlead@test.com`
   - **Password**: `teamlead123`
3. Click **"Create User"**
4. **Assign TEAM_LEAD role**:
   - Add to team: "Engineering"
   - Select role: **TEAM_LEAD**
   - Save

#### User 3: WORKSPACE_ADMIN Role
1. Click **"Create User"**
2. Fill in:
   - **Name**: `Workspace Admin User`
   - **Email**: `workspaceadmin@test.com`
   - **Password**: `workspace123`
3. Click **"Create User"**
4. **Assign WORKSPACE_ADMIN role**:
   - Add to team: "Engineering"
   - Select role: **WORKSPACE_ADMIN**
   - Save

**📝 Note**: WORKSPACE_ADMIN role is available in the team assignment dropdown.

#### User 4: ORG_ADMIN Role
1. Click **"Create User"**
2. Fill in:
   - **Name**: `Org Admin User`
   - **Email**: `orgadmin@test.com`
   - **Password**: `orgadmin123`
3. Click **"Create User"**
4. **Assign ORG_ADMIN role**:
   - Add to team: "Engineering"
   - Select role: **ORG_ADMIN**
   - Save

**📝 Note**: ORG_ADMIN role is available in the team assignment dropdown.

---

## 📋 Phase 2: Test MEMBER Permissions

### Logout and Login as MEMBER

1. **Logout** from current account
2. **Login** as: `member@test.com` / `member123`
3. **Verify**: You're redirected to dashboard

### Test 2.1: MEMBER Can View OKRs

**Path**: `/dashboard` or OKRs page

1. Navigate to **OKRs** or **Dashboard**
2. **Verify**:
   - ✅ You can see OKRs from your team/workspace
   - ✅ OKR cards/details are visible
   - ✅ You can click to view OKR details

**✅ Expected**: Can view OKRs, details page loads

### Test 2.2: MEMBER Can Create OKRs

**Path**: OKRs page

1. Look for **"New OKR"**, **"Create OKR"**, or **"+"** button
2. **Verify**:
   - ✅ Button is **visible** and **enabled**
   - ✅ Clicking allows creating a new OKR

**✅ Expected**: Can create OKRs (MEMBER has create permissions)

### Test 2.3: MEMBER Can Edit Own OKRs

**Path**: OKR detail page

1. Click on an OKR you created (owned by you)
2. Look for **Edit** button or pencil icon
3. **Verify**:
   - ✅ Edit button is **visible** and **enabled** for your own OKRs
   - ✅ Clicking allows editing the OKR

**✅ Expected**: Can edit own OKRs

### Test 2.4: MEMBER Cannot Edit Others' OKRs

**Path**: OKR detail page

1. Click on an OKR created by someone else
2. Look for **Edit** button or pencil icon
3. **Verify**:
   - ❌ Edit button is **hidden** or **disabled**, OR
   - If visible, clicking shows permission error

**✅ Expected**: Cannot edit others' OKRs

### Test 2.5: MEMBER Can Delete Own OKRs

**Path**: OKR detail page

1. View an OKR you created (owned by you)
2. Look for **Delete** button or trash icon
3. **Verify**:
   - ✅ Delete button is **visible** and **enabled** for your own OKRs

**✅ Expected**: Can delete own OKRs

### Test 2.6: MEMBER Can Create Key Results

**Path**: OKR detail page

1. View an OKR
2. Look for **"Add Key Result"** button
3. **Verify**:
   - ❌ Button is **hidden** or **disabled**

**✅ Expected**: Cannot create Key Results

---

## 📋 Phase 3: Test MEMBER Permissions

### Logout and Login as MEMBER

1. **Logout**
2. **Login** as: `member@test.com` / `member123`

### Test 3.1: MEMBER Can View Team OKRs

**Path**: `/dashboard` or OKRs page

1. Navigate to OKRs page
2. **Verify**:
   - ✅ Can see OKRs from Engineering team
   - ✅ Can see OKRs owned by you
   - ❌ Cannot see OKRs from other teams (e.g., Product team)

**✅ Expected**: Only sees accessible OKRs

### Test 3.2: MEMBER Can Create Own OKRs

**Path**: OKRs page

1. Click **"New OKR"** or **"Create OKR"** button
2. **Verify**:
   - ✅ Button is visible and enabled
   - ✅ Can fill in OKR form
   - ✅ Can save/create OKR

**✅ Expected**: Can create OKRs

**Action**: Create a test OKR titled "My First OKR"

### Test 3.3: MEMBER Can Edit Own OKRs

**Path**: OKR detail page (your OKR)

1. Open the OKR you just created
2. Click **Edit** button or pencil icon
3. **Verify**:
   - ✅ Can edit title, description, etc.
   - ✅ Changes save successfully

**✅ Expected**: Can edit own OKRs

### Test 3.4: MEMBER Cannot Edit Others' OKRs

**Path**: OKR detail page (someone else's OKR)

1. Navigate to an OKR owned by another user (e.g., Team Lead's OKR)
2. Look for **Edit** button
3. **Verify**:
   - ❌ Edit button is **hidden** or **disabled**, OR
   - If visible, clicking shows: "You do not have permission to edit this OKR"

**✅ Expected**: Cannot edit others' OKRs

### Test 3.5: MEMBER Can Delete Own OKRs

**Path**: OKR detail page (your OKR)

1. Open your own OKR
2. Click **Delete** button
3. **Verify**:
   - at least one of these:
     - ✅ Confirmation dialog appears
     - ✅ OKR is deleted after confirmation

**✅ Expected**: Can delete own OKRs

### Test 3.6: MEMBER Cannot Delete Team OKRs

**Path**: OKR detail page (team OKR)

1. Navigate to a team OKR owned by someone else
2. Look for **Delete** button
3. **Verify**:
   - ❌ Delete button is **hidden** or **disabled**, OR
   - Shows permission error

**✅ Expected**: Cannot delete team OKRs

### Test 3.7: MEMBER Can Create Key Results for Own OKRs

**Path**: OKR detail page (your OKR)

1. Open your own OKR
2. Look for **"Add Key Result"** or **"+"** button
3. **Verify**:
   - ✅ Button is visible
   - ✅ Can create Key Result
   - ✅ Key Result appears in the OKR

**✅ Expected**: Can create Key Results for own OKRs

### Test 3.8: MEMBER Cannot Create Key Results for Others' OKRs

**Path**: OKR detail page (others' OKR)

1. Open an OKR owned by someone else
2. Look for **"Add Key Result"** button
3. **Verify**:
   - ❌ Button is **hidden** or **disabled**

**✅ Expected**: Cannot create Key Results for others' OKRs

---

## 📋 Phase 4: Test TEAM_LEAD Permissions

### Logout and Login as TEAM_LEAD

1. **Logout**
2. **Login** as: `teamlead@test.com` / `teamlead123`

### Test 4.1: TEAM_LEAD Can View All Team OKRs

**Path**: OKRs page

1. Navigate to OKRs
2. **Verify**:
   - ✅ Can see all Engineering team OKRs
   - ✅ Can see OKRs owned by team members
   - ✅ Can see own OKRs

**✅ Expected**: Sees all team OKRs

### Test 4.2: TEAM_LEAD Can Edit Team OKRs

**Path**: OKR detail page (team member's OKR)

1. Open an OKR owned by a MEMBER in your team
2. Click **Edit** button
3. **Verify**:
   - ✅ Can edit the OKR
   - ✅ Changes save successfully

**✅ Expected**: Can edit team OKRs

### Test 4.3: TEAM_LEAD Can Delete Team OKRs

**Path**: OKR detail page (team member's OKR)

1. Open a team member's OKR
2. Click **Delete** button
3. **Verify**:
   - ✅ Can delete the OKR (with confirmation)

**✅ Expected**: Can delete team OKRs

### Test 4.4: TEAM_LEAD Cannot Edit Other Teams' OKRs

**Path**: OKR detail page (Product team OKR)

1. Try to access an OKR from Product team
2. **Verify**:
   - ❌ Cannot view it (404 or empty), OR
   - If visible, cannot edit/delete

**✅ Expected**: Cannot manage other teams' OKRs

### Test 4.5: TEAM_LEAD Can Manage Team Members

**Path**: Settings → Teams

1. Navigate to **Settings** → **Teams**
2. **Verify**:
   - ✅ Can see team members
   - ✅ Can add members to team
   - ✅ Can remove members from team
   - ✅ Can change member roles

**✅ Expected**: Can manage team membership

---

## 📋 Phase 5: Test WORKSPACE_OWNER Permissions

### Logout and Login as WORKSPACE_OWNER

**Note**: Use `john@acme.com` from seed data, or your admin account if you assigned the role.

1. **Logout**
2. **Login** as workspace owner

### Test 5.1: WORKSPACE_OWNER Can View All Workspace OKRs

**Path**: OKRs page

1. Navigate to OKRs
2. Filter by workspace (if option available)
3. **Verify**:
   - ✅ Can see all OKRs in the workspace
   - ✅ Can see OKRs from all teams

**✅ Expected**: Sees all workspace OKRs

### Test 5.2: WORKSPACE_OWNER Can Edit Any Workspace OKR

**Path**: OKR detail page (any workspace OKR)

1. Open any OKR in the workspace
2. Click **Edit**
3. **Verify**:
   - ✅ Can edit any OKR

**✅ Expected**: Can edit any workspace OKR

### Test 5.3: WORKSPACE_OWNER Can Delete Any Workspace OKR

**Path**: OKR detail page

1. Open any workspace OKR
2. Click **Delete**
3. **Verify**:
   - ✅ Can delete any OKR

**✅ Expected**: Can delete any workspace OKR

### Test 5.4: WORKSPACE_OWNER Can Manage Workspace Settings

**Path**: Settings → Workspaces

1. Navigate to **Settings** → **Workspaces**
2. **Verify**:
   - ✅ Can edit workspace name
   - ✅ Can manage workspace members
   - ✅ Can create teams

**✅ Expected**: Can manage workspace

---

## 📋 Phase 6: Test ORG_ADMIN Permissions

### Logout and Login as ORG_ADMIN

**Note**: Use `john@acme.com` from seed data, or assign ORG_ADMIN role.

1. **Logout**
2. **Login** as org admin

### Test 6.1: ORG_ADMIN Can View All Organization OKRs

**Path**: OKRs page

1. Navigate to OKRs
2. **Verify**:
   - ✅ Can see OKRs from all workspaces
   - ✅ Can see OKRs from all teams

**✅ Expected**: Sees all organization OKRs

### Test 6.2: ORG_ADMIN Can Edit Any Organization OKR

**Path**: OKR detail page (any OKR)

1. Open any OKR in the organization
2. Click **Edit**
3. **Verify**:
   - ✅ Can edit any OKR

**✅ Expected**: Can edit any organization OKR

### Test 6.3: ORG_ADMIN Can Delete Any Organization OKR

**Path**: OKR detail page

1. Open any organization OKR
2. Click **Delete**
3. **Verify**:
   - ✅ Can delete any OKR

**✅ Expected**: Can delete any organization OKR

### Test 6.4: ORG_ADMIN Can Manage Organization

**Path**: Settings → Organization

1. Navigate to **Settings** → **Organization**
2. **Verify**:
   - ✅ Can edit organization settings
   - ✅ Can manage organization members
   - ✅ Can create workspaces

**✅ Expected**: Can manage organization

---

## 📋 Phase 7: Test Permission Inheritance

### Test 7.1: Key Results Inherit Parent Objective Permissions

**Setup**:
1. Login as MEMBER
2. Create an OKR
3. Add a Key Result to that OKR
4. Logout

**Test**:
1. Login as TEAM_LEAD (same team)
2. Navigate to the MEMBER's OKR
3. **Verify**:
   - ✅ Can view the Key Result
   - ✅ Can edit the Key Result
   - ✅ Can add check-ins to the Key Result

**✅ Expected**: TEAM_LEAD can manage Key Results of team OKRs

### Test 7.2: Initiatives Inherit Parent Objective Permissions

**Setup**:
1. Login as MEMBER
2. Create an OKR
3. Add an Initiative to that OKR
4. Logout

**Test**:
1. Login as TEAM_LEAD
2. Navigate to the MEMBER's OKR
3. **Verify**:
   - ✅ Can view the Initiative
   - ✅ Can edit the Initiative
   - ✅ Can delete the Initiative

**✅ Expected**: TEAM_LEAD can manage Initiatives of team OKRs

---

## 📋 Phase 8: Test Data Filtering

### Test 8.1: Users Only See Accessible OKRs

**Setup**:
1. Login as MEMBER (Engineering team)
2. Note which OKRs are visible
3. Logout
4. Login as MEMBER (Product team - if exists)
5. Compare visible OKRs

**Verify**:
- ✅ Engineering team member sees Engineering OKRs
- ✅ Product team member sees Product OKRs
- ❌ No cross-team OKRs visible

**✅ Expected**: OKRs are filtered by team/workspace membership

### Test 8.2: Owned OKRs Always Visible

**Setup**:
1. Login as MEMBER (Engineering team)
2. Create an OKR
3. Note the OKR is visible
4. Verify it's in your OKR list

**✅ Expected**: Own OKRs are always visible, regardless of team

---

## 📋 Phase 9: Test Error Messages

### Test 9.1: Clear Permission Denial Messages

**Actions**:
1. Login as MEMBER
2. Try to edit someone else's OKR (via direct URL if needed)
3. **Verify**:
   - ✅ Error message appears: "You do not have permission to edit this OKR"
   - ✅ Message is clear and helpful

**✅ Expected**: Clear, user-friendly error messages

### Test 9.2: Missing Authentication

**Actions**:
1. Logout
2. Try to access `/dashboard` directly
3. **Verify**:
   - ✅ Redirected to login page, OR
   - ✅ Shows "Unauthorized" message

**✅ Expected**: Unauthenticated users are redirected or shown error

---

## 📋 Phase 10: Test UI Element Visibility

### Test 10.1: Create Buttons Available for MEMBER

**Actions**:
1. Login as MEMBER
2. Navigate through the UI
3. **Verify**:
   - ✅ "New OKR" button is visible
   - ✅ "Add Key Result" buttons are visible
   - ✅ "Create Initiative" buttons are visible

**✅ Expected**: Create actions are available for MEMBER role

### Test 10.2: Edit/Delete Buttons Conditionally Shown

**Actions**:
1. Login as MEMBER
2. View your own OKR
3. **Verify**: Edit/Delete buttons visible
4. View someone else's OKR
5. **Verify**: Edit/Delete buttons hidden

**✅ Expected**: Action buttons shown based on permissions

---

## 📊 Test Results Checklist

Use this checklist to track your testing progress:

### Phase 1: Setup
- [ ] Admin user created
- [ ] MEMBER user created
- [ ] TEAM_LEAD user created
- [ ] WORKSPACE_OWNER user ready
- [ ] ORG_ADMIN user ready

### Phase 2: MEMBER Tests
- [ ] Can view OKRs
- [ ] Can create OKRs
- [ ] Can edit own OKRs
- [ ] Cannot edit others' OKRs
- [ ] Can delete own OKRs
- [ ] Can create Key Results

### Phase 3: TEAM_LEAD Tests
- [ ] Can view team OKRs
- [ ] Can create team OKRs
- [ ] Can edit team OKRs
- [ ] Cannot edit others' OKRs
- [ ] Can delete own OKRs
- [ ] Cannot delete team OKRs
- [ ] Can create Key Results for own OKRs
- [ ] Cannot create Key Results for others' OKRs

### Phase 4: TEAM_LEAD Tests
- [ ] Can view all team OKRs
- [ ] Can edit team OKRs
- [ ] Can delete team OKRs
- [ ] Cannot edit other teams' OKRs
- [ ] Can manage team members

### Phase 5: WORKSPACE_OWNER Tests
- [ ] Can view all workspace OKRs
- [ ] Can edit any workspace OKR
- [ ] Can delete any workspace OKR
- [ ] Can manage workspace settings

### Phase 6: ORG_ADMIN Tests
- [ ] Can view all organization OKRs
- [ ] Can edit any organization OKR
- [ ] Can delete any organization OKR
- [ ] Can manage organization

### Phase 7: Inheritance Tests
- [ ] Key Results inherit permissions
- [ ] Initiatives inherit permissions

### Phase 8: Data Filtering Tests
- [ ] Users only see accessible OKRs
- [ ] Owned OKRs always visible

### Phase 9: Error Handling Tests
- [ ] Clear permission denial messages
- [ ] Missing authentication handled

### Phase 10: UI Visibility Tests
- [ ] Create buttons visible for MEMBER
- [ ] Edit/Delete buttons conditionally shown

---

## 🐛 Common Issues & Solutions

### Issue: Cannot assign roles in UI

**Solution**: 
- Check if you're logged in as admin/org admin
- Verify role assignment UI exists in Settings → Teams or Settings → People
- If UI not available, use database or API directly

### Issue: User sees OKRs they shouldn't

**Check**:
1. User's team membership
2. OKR's team/workspace assignment
3. Browser cache (try incognito mode)

### Issue: Edit button visible but doesn't work

**Expected**: This is correct behavior - permission checked on backend
- Button may be visible but API will return 403
- Or button should be hidden based on `usePermissions()` hook

### Issue: Cannot access Settings pages

**Check**:
- You need appropriate permissions (admin/workspace owner)
- Settings pages may require specific roles

---

## 📝 Notes

- **Test with multiple browser windows** to compare different user views
- **Use incognito mode** for easier role switching
- **Check browser console** for API errors
- **Check Network tab** to see permission-denied responses (403)
- **Take screenshots** of permission errors for documentation

---

## 🎯 Priority Tests (If Short on Time)

Focus on these critical tests:

1. ✅ **MEMBER can create/edit own, cannot edit others** - Most important
2. ✅ **MEMBER cannot edit others' OKRs** - Security critical
3. ✅ **Users only see accessible OKRs** - Data privacy
4. ✅ **TEAM_LEAD can manage team OKRs** - Core functionality
5. ✅ **Permission inheritance works** - Consistency

---

**Happy Testing! 🎉**

