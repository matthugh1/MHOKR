# TENANT_ADMIN Test Plan
## OKR Nexus Platform

**Test User:** `founder@puzzelcx.local` (or `founder@puzzelcx.com`)  
**Role:** `TENANT_ADMIN`  
**Organization:** Puzzel CX  
**Test Date:** [To be filled]

---

## Test Environment Setup

### Prerequisites
- [ ] Application running at `http://localhost:5173`
- [ ] API Gateway running at `http://localhost:3000`
- [ ] User has `TENANT_ADMIN` role assigned in `role_assignments` table
- [ ] User belongs to organization (Puzzel CX)
- [ ] Database seeded with test data

### Test Credentials
- **Email:** `founder@puzzelcx.local` (or `founder@puzzelcx.com`)
- **Password:** `test123`

---

## 1. Authentication & Authorization

### 1.1 Login Flow
- [ ] **TC-AUTH-001**: Navigate to `/login`
- [ ] **TC-AUTH-002**: Enter email `founder@puzzelcx.local`
- [ ] **TC-AUTH-003**: Enter password `test123`
- [ ] **TC-AUTH-004**: Click "Sign in" button
- [ ] **TC-AUTH-005**: Verify redirect to `/dashboard`
- [ ] **TC-AUTH-006**: Verify user name displays as "Sarah Chen"
- [ ] **TC-AUTH-007**: Verify email displays as `founder@puzzelcx.local`
- [ ] **TC-AUTH-008**: Verify organization name displays as "Puzzel CX"

### 1.2 Session Management
- [ ] **TC-AUTH-009**: Verify JWT token stored in `localStorage.access_token`
- [ ] **TC-AUTH-010**: Refresh page - verify user remains logged in
- [ ] **TC-AUTH-011**: Logout - verify redirect to `/login`
- [ ] **TC-AUTH-012**: Verify token removed from localStorage after logout

### 1.3 Authorization Checks
- [ ] **TC-AUTH-013**: Verify user has `TENANT_ADMIN` role via API: `GET /api/users/me`
- [ ] **TC-AUTH-014**: Verify user context includes organization ID
- [ ] **TC-AUTH-015**: Attempt to access `/dashboard` without login - verify redirect to `/login`

---

## 2. Dashboard Functionality

### 2.1 Main Dashboard (`/dashboard`)
- [ ] **TC-DASH-001**: Navigate to `/dashboard`
- [ ] **TC-DASH-002**: Verify "Organisation health" section displays
- [ ] **TC-DASH-003**: Verify "Total Objectives" metric displays correctly
- [ ] **TC-DASH-004**: Verify "% On Track" metric displays correctly
- [ ] **TC-DASH-005**: Verify "% At Risk" metric displays correctly
- [ ] **TC-DASH-006**: Verify "Overdue Check-ins" metric displays correctly
- [ ] **TC-DASH-007**: Verify "Needs Attention" section displays
- [ ] **TC-DASH-008**: Verify "Execution health" section displays
- [ ] **TC-DASH-009**: Verify "Update discipline" shows user check-in activity
- [ ] **TC-DASH-010**: Verify "Gaps that need attention" section displays
- [ ] **TC-DASH-011**: Verify "Operating rhythm" section shows recent activity
- [ ] **TC-DASH-012**: Verify all data is filtered to user's organization only

### 2.2 My Dashboard (`/dashboard/me`)
- [ ] **TC-DASH-013**: Navigate to `/dashboard/me`
- [ ] **TC-DASH-014**: Verify page loads without errors
- [ ] **TC-DASH-015**: Verify personal OKRs display correctly
- [ ] **TC-DASH-016**: Verify assigned key results display correctly

---

## 3. OKR Management

### 3.1 View OKRs (`/dashboard/okrs`)
- [ ] **TC-OKR-001**: Navigate to `/dashboard/okrs`
- [ ] **TC-OKR-002**: Verify OKRs list displays
- [ ] **TC-OKR-003**: Verify cycle filter shows "Q4 2025" and other cycles
- [ ] **TC-OKR-004**: Verify status filters work (All statuses, On track, At risk, Blocked, Completed, Cancelled)
- [ ] **TC-OKR-005**: Verify search functionality works
- [ ] **TC-OKR-006**: Verify workspace filter works
- [ ] **TC-OKR-007**: Verify team filter works
- [ ] **TC-OKR-008**: Verify owner filter works
- [ ] **TC-OKR-009**: Click on an objective to expand - verify key results display
- [ ] **TC-OKR-010**: Verify objective metadata displays (status, cycle, owner, progress)
- [ ] **TC-OKR-011**: Verify only organization's OKRs are visible (tenant isolation)

### 3.2 Create OKR
- [ ] **TC-OKR-012**: Click "New Objective" button
- [ ] **TC-OKR-013**: Verify modal/form opens
- [ ] **TC-OKR-014**: Fill in objective title
- [ ] **TC-OKR-015**: Select cycle (e.g., Q4 2025)
- [ ] **TC-OKR-016**: Select workspace (if applicable)
- [ ] **TC-OKR-017**: Add description
- [ ] **TC-OKR-018**: Set visibility level (PUBLIC_TENANT, TEAM_ONLY, MANAGER_CHAIN, PRIVATE)
- [ ] **TC-OKR-019**: Click "Save" or "Create"
- [ ] **TC-OKR-020**: Verify objective appears in OKRs list
- [ ] **TC-OKR-021**: Verify objective is in DRAFT status initially

### 3.3 Edit OKR
- [ ] **TC-OKR-022**: Click "Edit" button on a draft objective
- [ ] **TC-OKR-023**: Modify objective title
- [ ] **TC-OKR-024**: Modify description
- [ ] **TC-OKR-025**: Change cycle
- [ ] **TC-OKR-026**: Change visibility level
- [ ] **TC-OKR-027**: Save changes
- [ ] **TC-OKR-028**: Verify changes are reflected in the UI
- [ ] **TC-OKR-029**: Edit a published objective - verify TENANT_ADMIN can edit published OKRs
- [ ] **TC-OKR-030**: Edit an EXEC_ONLY objective - verify behavior (may depend on `allowTenantAdminExecVisibility` setting)

### 3.4 Delete OKR
- [ ] **TC-OKR-031**: Click "More actions" → "Delete" on a draft objective
- [ ] **TC-OKR-032**: Confirm deletion
- [ ] **TC-OKR-033**: Verify objective is removed from list
- [ ] **TC-OKR-034**: Delete a published objective - verify TENANT_ADMIN can delete published OKRs

### 3.5 Publish OKR
- [ ] **TC-OKR-035**: Click "Publish" button on a draft objective
- [ ] **TC-OKR-036**: Verify objective status changes to PUBLISHED
- [ ] **TC-OKR-037**: Verify publish date is recorded
- [ ] **TC-OKR-038**: Verify published OKRs are visible to appropriate users

### 3.6 Key Results Management
- [ ] **TC-OKR-039**: Click "Add Key Result" button on an objective
- [ ] **TC-OKR-040**: Fill in key result title
- [ ] **TC-OKR-041**: Set target value and unit
- [ ] **TC-OKR-042**: Set measurement type (percentage, number, currency, etc.)
- [ ] **TC-OKR-043**: Assign executor (if applicable)
- [ ] **TC-OKR-044**: Save key result
- [ ] **TC-OKR-045**: Verify key result appears under objective
- [ ] **TC-OKR-046**: Edit a key result
- [ ] **TC-OKR-047**: Delete a key result
- [ ] **TC-OKR-048**: Verify key result progress updates objective progress

### 3.7 Check-ins
- [ ] **TC-OKR-049**: Click "Check-in" on a key result
- [ ] **TC-OKR-050**: Enter current value
- [ ] **TC-OKR-051**: Set confidence level
- [ ] **TC-OKR-052**: Add notes/update
- [ ] **TC-OKR-053**: Submit check-in
- [ ] **TC-OKR-054**: Verify check-in appears in activity feed
- [ ] **TC-OKR-055**: Verify progress percentage updates
- [ ] **TC-OKR-056**: Request check-in from another user
- [ ] **TC-OKR-057**: Verify overdue check-ins are highlighted

### 3.8 Initiatives
- [ ] **TC-OKR-058**: Click "Add Initiative" button
- [ ] **TC-OKR-059**: Fill in initiative details
- [ ] **TC-OKR-060**: Set status (NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED)
- [ ] **TC-OKR-061**: Save initiative
- [ ] **TC-OKR-062**: Verify initiative appears under objective
- [ ] **TC-OKR-063**: Edit an initiative
- [ ] **TC-OKR-064**: Delete an initiative

---

## 4. Visual Builder (`/dashboard/builder`)

### 4.1 Builder Access
- [ ] **TC-BUILD-001**: Navigate to `/dashboard/builder`
- [ ] **TC-BUILD-002**: Verify page loads without errors
- [ ] **TC-BUILD-003**: Verify ReactFlow graph displays
- [ ] **TC-BUILD-004**: Verify OKRs appear as nodes on the graph
- [ ] **TC-BUILD-005**: Verify connections between objectives and key results display

### 4.2 Graph Interaction
- [ ] **TC-BUILD-006**: Verify cycle selector works (Q4 2025, etc.)
- [ ] **TC-BUILD-007**: Click on a node - verify edit panel opens
- [ ] **TC-BUILD-008**: Double-click node title - verify inline editing works
- [ ] **TC-BUILD-009**: Drag a node - verify position updates
- [ ] **TC-BUILD-010**: Drag from circle on node to connect to another node
- [ ] **TC-BUILD-011**: Verify connection is created
- [ ] **TC-BUILD-012**: Click "Add Node" button
- [ ] **TC-BUILD-013**: Select node type (Objective, Key Result, Initiative)
- [ ] **TC-BUILD-014**: Fill in node details
- [ ] **TC-BUILD-015**: Verify new node appears on graph

### 4.3 Graph Controls
- [ ] **TC-BUILD-016**: Click zoom in button - verify graph zooms in
- [ ] **TC-BUILD-017**: Click zoom out button - verify graph zooms out
- [ ] **TC-BUILD-018**: Click "fit view" button - verify graph fits to viewport
- [ ] **TC-BUILD-019**: Click "toggle interactivity" button - verify nodes become interactive/non-interactive
- [ ] **TC-BUILD-020**: Verify minimap displays correctly

---

## 5. Analytics (`/dashboard/analytics`)

### 5.1 Analytics Dashboard
- [ ] **TC-ANAL-001**: Navigate to `/dashboard/analytics`
- [ ] **TC-ANAL-002**: Verify page loads without errors
- [ ] **TC-ANAL-003**: Verify "Q4 2025 Execution Health" heading displays
- [ ] **TC-ANAL-004**: Verify summary metrics display (Total Objectives, % On Track, % At Risk, Overdue Check-ins)
- [ ] **TC-ANAL-005**: Verify "Strategic Coverage" section displays
- [ ] **TC-ANAL-006**: Verify "Execution Risk" section displays
- [ ] **TC-ANAL-007**: Verify "Recent Activity" section displays

### 5.2 Data Export
- [ ] **TC-ANAL-008**: Verify TENANT_ADMIN can export data (if export feature exists)
- [ ] **TC-ANAL-009**: Export OKRs data - verify file downloads
- [ ] **TC-ANAL-010**: Verify exported data includes all organization OKRs

---

## 6. Workspace Management (`/dashboard/settings/workspaces`)

### 6.1 View Workspaces
- [ ] **TC-WS-001**: Navigate to `/dashboard/settings/workspaces`
- [ ] **TC-WS-002**: Verify page loads without errors
- [ ] **TC-WS-003**: Verify existing workspaces display (Customer Experience & AI, Revenue Operations)
- [ ] **TC-WS-004**: Verify workspace details display (name, organization, teams count)
- [ ] **TC-WS-005**: Verify only organization's workspaces are visible

### 6.2 Create Workspace
- [ ] **TC-WS-006**: Click "New Workspace" button
- [ ] **TC-WS-007**: Fill in workspace name
- [ ] **TC-WS-008**: Select parent workspace (if hierarchical workspaces supported)
- [ ] **TC-WS-009**: Add description (if applicable)
- [ ] **TC-WS-010**: Save workspace
- [ ] **TC-WS-011**: Verify workspace appears in list

### 6.3 Edit Workspace
- [ ] **TC-WS-012**: Click "Edit" button on a workspace
- [ ] **TC-WS-013**: Modify workspace name
- [ ] **TC-WS-014**: Change parent workspace (if applicable)
- [ ] **TC-WS-015**: Save changes
- [ ] **TC-WS-016**: Verify changes are reflected

### 6.4 Delete Workspace
- [ ] **TC-WS-017**: Attempt to delete a workspace - verify TENANT_ADMIN CANNOT delete (only TENANT_OWNER can)
- [ ] **TC-WS-018**: Verify delete button is disabled or shows appropriate message

### 6.5 Workspace Members
- [ ] **TC-WS-019**: Click on workspace to view members
- [ ] **TC-WS-020**: Verify members list displays
- [ ] **TC-WS-021**: Add user to workspace
- [ ] **TC-WS-022**: Assign workspace role (WORKSPACE_OWNER, MEMBER, VIEWER)
- [ ] **TC-WS-023**: Remove user from workspace
- [ ] **TC-WS-024**: Verify member changes are reflected

---

## 7. Team Management (`/dashboard/settings/teams`)

### 7.1 View Teams
- [ ] **TC-TEAM-001**: Navigate to `/dashboard/settings/teams`
- [ ] **TC-TEAM-002**: Verify page loads without errors
- [ ] **TC-TEAM-003**: Verify teams list displays
- [ ] **TC-TEAM-004**: Verify team details display (name, workspace, members count)
- [ ] **TC-TEAM-005**: Verify only organization's teams are visible

### 7.2 Create Team
- [ ] **TC-TEAM-006**: Click "New Team" button
- [ ] **TC-TEAM-007**: Fill in team name
- [ ] **TC-TEAM-008**: Select workspace
- [ ] **TC-TEAM-009**: Add description (if applicable)
- [ ] **TC-TEAM-010**: Save team
- [ ] **TC-TEAM-011**: Verify team appears in list

### 7.3 Edit Team
- [ ] **TC-TEAM-012**: Click "Edit" button on a team
- [ ] **TC-TEAM-013**: Modify team name
- [ ] **TC-TEAM-014**: Change workspace
- [ ] **TC-TEAM-015**: Save changes
- [ ] **TC-TEAM-016**: Verify changes are reflected

### 7.4 Delete Team
- [ ] **TC-TEAM-017**: Click "Delete" button on a team
- [ ] **TC-TEAM-018**: Confirm deletion
- [ ] **TC-TEAM-019**: Verify team is removed from list

### 7.5 Team Members
- [ ] **TC-TEAM-020**: Click on team to view members
- [ ] **TC-TEAM-021**: Verify members list displays
- [ ] **TC-TEAM-022**: Add user to team
- [ ] **TC-TEAM-023**: Assign team role (TEAM_LEAD, TEAM_CONTRIBUTOR, TEAM_VIEWER)
- [ ] **TC-TEAM-024**: Remove user from team
- [ ] **TC-TEAM-025**: Verify member changes are reflected

---

## 8. User Management (`/dashboard/settings/people`)

### 8.1 View Users
- [ ] **TC-USER-001**: Navigate to `/dashboard/settings/people`
- [ ] **TC-USER-002**: Verify page loads without errors
- [ ] **TC-USER-003**: Verify users list displays
- [ ] **TC-USER-004**: Verify user details display (name, email, role, organization)
- [ ] **TC-USER-005**: Verify only organization's users are visible
- [ ] **TC-USER-006**: Verify API call to `/api/users` succeeds (requires `manage_users` permission)

### 8.2 Create User
- [ ] **TC-USER-007**: Click "Add User" or "Invite User" button
- [ ] **TC-USER-008**: Fill in user email
- [ ] **TC-USER-009**: Fill in user name (first name, last name)
- [ ] **TC-USER-010**: Set password (if creating directly)
- [ ] **TC-USER-011**: Assign organization role (ORG_ADMIN, MEMBER, VIEWER) - Note: TENANT_ADMIN maps to TENANT_ADMIN
- [ ] **TC-USER-012**: Select workspace (if required)
- [ ] **TC-USER-013**: Select team (if applicable)
- [ ] **TC-USER-014**: Save user
- [ ] **TC-USER-015**: Verify user appears in list

### 8.3 Edit User
- [ ] **TC-USER-016**: Click "Edit" button on a user
- [ ] **TC-USER-017**: Modify user name
- [ ] **TC-USER-018**: Modify user email
- [ ] **TC-USER-019**: Change organization role
- [ ] **TC-USER-020**: Save changes
- [ ] **TC-USER-021**: Verify changes are reflected

### 8.4 Remove User
- [ ] **TC-USER-022**: Click "Remove" button on a user
- [ ] **TC-USER-023**: Confirm removal
- [ ] **TC-USER-024**: Verify user is removed from organization
- [ ] **TC-USER-025**: Attempt to remove TENANT_OWNER - verify TENANT_ADMIN cannot remove TENANT_OWNER (should fail or show warning)

### 8.5 Reset Password
- [ ] **TC-USER-026**: Click "Reset Password" on a user
- [ ] **TC-USER-027**: Set new password
- [ ] **TC-USER-028**: Verify password reset succeeds
- [ ] **TC-USER-029**: Test login with new password

---

## 9. Organization Settings (`/dashboard/settings/organization`)

### 9.1 View Organization
- [ ] **TC-ORG-001**: Navigate to `/dashboard/settings/organization`
- [ ] **TC-ORG-002**: Verify page loads without errors
- [ ] **TC-ORG-003**: Verify organization name displays (Puzzel CX)
- [ ] **TC-ORG-004**: Verify organization ID displays (puzzel-cx)
- [ ] **TC-ORG-005**: Verify workspace count displays
- [ ] **TC-ORG-006**: Verify member count displays

### 9.2 Edit Organization
- [ ] **TC-ORG-007**: Click "Edit" button
- [ ] **TC-ORG-008**: Modify organization name
- [ ] **TC-ORG-009**: Modify organization slug (if allowed)
- [ ] **TC-ORG-010**: Save changes
- [ ] **TC-ORG-011**: Verify TENANT_ADMIN can edit organization settings (may require `manage_tenant_settings` permission)
- [ ] **TC-ORG-012**: Verify changes are reflected

### 9.3 Organization Members
- [ ] **TC-ORG-013**: Verify organization members section displays
- [ ] **TC-ORG-014**: Verify members list shows all organization members
- [ ] **TC-ORG-015**: Verify API call to `/api/organizations/:id/members` succeeds

### 9.4 Private OKR Access
- [ ] **TC-ORG-016**: Verify "Private OKR Access" section displays
- [ ] **TC-ORG-017**: Select users for private OKR whitelist
- [ ] **TC-ORG-018**: Click "Save Whitelist"
- [ ] **TC-ORG-019**: Verify whitelist is saved
- [ ] **TC-ORG-020**: Verify selected users can access private OKRs

---

## 10. AI Assistant (`/dashboard/ai`)

### 10.1 AI Assistant Access
- [ ] **TC-AI-001**: Navigate to `/dashboard/ai`
- [ ] **TC-AI-002**: Verify page loads without errors
- [ ] **TC-AI-003**: Verify AI chat interface displays
- [ ] **TC-AI-004**: Verify conversation history displays (if applicable)

### 10.2 AI Interactions
- [ ] **TC-AI-005**: Send a message to AI assistant
- [ ] **TC-AI-006**: Verify AI responds appropriately
- [ ] **TC-AI-007**: Ask AI to suggest OKRs
- [ ] **TC-AI-008**: Ask AI to analyze OKR progress
- [ ] **TC-AI-009**: Verify AI has access to organization's OKR data
- [ ] **TC-AI-010**: Verify AI responses are tenant-isolated

---

## 11. Permission & Security Tests

### 11.1 Tenant Isolation
- [ ] **TC-PERM-001**: Verify user can only see their organization's OKRs
- [ ] **TC-PERM-002**: Verify user can only see their organization's workspaces
- [ ] **TC-PERM-003**: Verify user can only see their organization's teams
- [ ] **TC-PERM-004**: Verify user can only see their organization's users
- [ ] **TC-PERM-005**: Attempt to access another organization's data via API - verify 403 Forbidden

### 11.2 Role-Based Permissions
- [ ] **TC-PERM-006**: Verify TENANT_ADMIN can create OKRs
- [ ] **TC-PERM-007**: Verify TENANT_ADMIN can edit published OKRs
- [ ] **TC-PERM-008**: Verify TENANT_ADMIN can delete published OKRs
- [ ] **TC-PERM-009**: Verify TENANT_ADMIN can publish OKRs
- [ ] **TC-PERM-010**: Verify TENANT_ADMIN can manage users
- [ ] **TC-PERM-011**: Verify TENANT_ADMIN can manage workspaces
- [ ] **TC-PERM-012**: Verify TENANT_ADMIN can manage teams
- [ ] **TC-PERM-013**: Verify TENANT_ADMIN CANNOT delete workspaces (only TENANT_OWNER can)
- [ ] **TC-PERM-014**: Verify TENANT_ADMIN CANNOT manage billing (only TENANT_OWNER can)
- [ ] **TC-PERM-015**: Verify TENANT_ADMIN CANNOT remove TENANT_OWNER
- [ ] **TC-PERM-016**: Verify TENANT_ADMIN can export data

### 11.3 EXEC_ONLY Visibility
- [ ] **TC-PERM-017**: Verify TENANT_ADMIN can view EXEC_ONLY OKRs if `allowTenantAdminExecVisibility` is true
- [ ] **TC-PERM-018**: Verify TENANT_ADMIN CANNOT view EXEC_ONLY OKRs if `allowTenantAdminExecVisibility` is false
- [ ] **TC-PERM-019**: Verify TENANT_ADMIN can edit EXEC_ONLY OKRs if `allowTenantAdminExecVisibility` is true

### 11.4 Publish Lock
- [ ] **TC-PERM-020**: Verify TENANT_ADMIN can edit published OKRs (bypass publish lock)
- [ ] **TC-PERM-021**: Verify TENANT_ADMIN can delete published OKRs (bypass publish lock)
- [ ] **TC-PERM-022**: Verify regular MEMBER users cannot edit published OKRs

### 11.5 Cycle Lock
- [ ] **TC-PERM-023**: Verify TENANT_ADMIN can modify OKRs in locked cycles
- [ ] **TC-PERM-024**: Verify TENANT_ADMIN can create OKRs in locked cycles

---

## 12. API Endpoint Tests

### 12.1 Authentication Endpoints
- [ ] **TC-API-001**: `POST /api/auth/login` - Verify returns access token
- [ ] **TC-API-002**: `GET /api/users/me` - Verify returns user with organizationId
- [ ] **TC-API-003**: `GET /api/users/me/context` - Verify returns user context

### 12.2 User Management Endpoints
- [ ] **TC-API-004**: `GET /api/users` - Verify returns users list (requires `manage_users`)
- [ ] **TC-API-005**: `GET /api/users/:id` - Verify returns specific user
- [ ] **TC-API-006**: `POST /api/users` - Verify can create user
- [ ] **TC-API-007**: `PATCH /api/users/:id` - Verify can update user
- [ ] **TC-API-008**: `POST /api/users/:id/reset-password` - Verify can reset password

### 12.3 Organization Endpoints
- [ ] **TC-API-009**: `GET /api/organizations/current` - Verify returns current organization
- [ ] **TC-API-010**: `GET /api/organizations/:id` - Verify returns organization details
- [ ] **TC-API-011**: `GET /api/organizations/:id/members` - Verify returns members list
- [ ] **TC-API-012**: `POST /api/organizations/:id/members` - Verify can add member
- [ ] **TC-API-013**: `DELETE /api/organizations/:id/members/:userId` - Verify can remove member

### 12.4 Workspace Endpoints
- [ ] **TC-API-014**: `GET /api/workspaces?organizationId=:id` - Verify returns workspaces list
- [ ] **TC-API-015**: `GET /api/workspaces/:id` - Verify returns workspace details
- [ ] **TC-API-016**: `POST /api/workspaces` - Verify can create workspace
- [ ] **TC-API-017**: `PATCH /api/workspaces/:id` - Verify can update workspace
- [ ] **TC-API-018**: `DELETE /api/workspaces/:id` - Verify CANNOT delete (should return 403 or be disabled)

### 12.5 Team Endpoints
- [ ] **TC-API-019**: `GET /api/teams?organizationId=:id` - Verify returns teams list
- [ ] **TC-API-020**: `GET /api/teams/:id` - Verify returns team details
- [ ] **TC-API-021**: `POST /api/teams` - Verify can create team
- [ ] **TC-API-022**: `PATCH /api/teams/:id` - Verify can update team
- [ ] **TC-API-023**: `DELETE /api/teams/:id` - Verify can delete team

### 12.6 OKR Endpoints
- [ ] **TC-API-024**: `GET /api/objectives` - Verify returns objectives list
- [ ] **TC-API-025**: `GET /api/objectives/:id` - Verify returns objective details
- [ ] **TC-API-026**: `POST /api/objectives` - Verify can create objective
- [ ] **TC-API-027**: `PATCH /api/objectives/:id` - Verify can update objective
- [ ] **TC-API-028**: `DELETE /api/objectives/:id` - Verify can delete objective
- [ ] **TC-API-029**: `POST /api/objectives/:id/publish` - Verify can publish objective
- [ ] **TC-API-030**: `GET /api/key-results` - Verify returns key results list
- [ ] **TC-API-031**: `POST /api/key-results` - Verify can create key result
- [ ] **TC-API-032**: `POST /api/key-results/:id/check-ins` - Verify can create check-in

### 12.7 RBAC Endpoints
- [ ] **TC-API-033**: `GET /api/rbac/assignments/me` - Verify returns user's role assignments
- [ ] **TC-API-034**: `GET /api/rbac/assignments` - Verify returns role assignments (if accessible)
- [ ] **TC-API-035**: `POST /api/rbac/assignments/assign` - Verify can assign roles (if permitted)

---

## 13. Edge Cases & Error Handling

### 13.1 Invalid Input
- [ ] **TC-EDGE-001**: Attempt to create OKR with empty title - verify error message
- [ ] **TC-EDGE-002**: Attempt to create user with invalid email - verify error message
- [ ] **TC-EDGE-003**: Attempt to create workspace with duplicate name - verify error handling
- [ ] **TC-EDGE-004**: Attempt to assign invalid role - verify error message

### 13.2 Missing Data
- [ ] **TC-EDGE-005**: Attempt to access non-existent OKR - verify 404 error
- [ ] **TC-EDGE-006**: Attempt to access non-existent workspace - verify 404 error
- [ ] **TC-EDGE-007**: Attempt to access non-existent user - verify 404 error

### 13.3 Network Errors
- [ ] **TC-EDGE-008**: Simulate network failure - verify error message displays
- [ ] **TC-EDGE-009**: Verify retry mechanism works (if implemented)
- [ ] **TC-EDGE-010**: Verify user-friendly error messages display

### 13.4 Concurrent Operations
- [ ] **TC-EDGE-011**: Edit same OKR from multiple tabs - verify last write wins or conflict handling
- [ ] **TC-EDGE-012**: Delete OKR while another user is editing - verify appropriate handling

---

## 14. Performance & Load Tests

### 14.1 Page Load Performance
- [ ] **TC-PERF-001**: Measure dashboard load time - verify < 3 seconds
- [ ] **TC-PERF-002**: Measure OKRs page load time - verify < 2 seconds
- [ ] **TC-PERF-003**: Measure Visual Builder load time - verify < 5 seconds
- [ ] **TC-PERF-004**: Measure Analytics page load time - verify < 3 seconds

### 14.2 API Response Times
- [ ] **TC-PERF-005**: Measure API response times - verify < 500ms for simple queries
- [ ] **TC-PERF-006**: Measure API response times for complex queries - verify < 2 seconds

### 14.3 Large Data Sets
- [ ] **TC-PERF-007**: Test with 100+ OKRs - verify performance acceptable
- [ ] **TC-PERF-008**: Test with 50+ workspaces - verify performance acceptable
- [ ] **TC-PERF-009**: Test with 200+ users - verify performance acceptable

---

## 15. UI/UX Tests

### 15.1 Navigation
- [ ] **TC-UX-001**: Verify sidebar navigation works correctly
- [ ] **TC-UX-002**: Verify breadcrumbs display correctly
- [ ] **TC-UX-003**: Verify active menu item is highlighted
- [ ] **TC-UX-004**: Verify mobile responsive design works

### 15.2 Forms & Modals
- [ ] **TC-UX-005**: Verify form validation displays errors correctly
- [ ] **TC-UX-006**: Verify modals can be closed via X button
- [ ] **TC-UX-007**: Verify modals can be closed via Escape key
- [ ] **TC-UX-008**: Verify modals close on outside click (if applicable)

### 15.3 Notifications
- [ ] **TC-UX-009**: Verify success notifications display after actions
- [ ] **TC-UX-010**: Verify error notifications display for failures
- [ ] **TC-UX-011**: Verify notifications auto-dismiss after timeout

### 15.4 Accessibility
- [ ] **TC-UX-012**: Verify keyboard navigation works
- [ ] **TC-UX-013**: Verify screen reader compatibility (if applicable)
- [ ] **TC-UX-014**: Verify color contrast meets WCAG standards

---

## 16. Data Integrity Tests

### 16.1 Data Consistency
- [ ] **TC-DATA-001**: Create OKR - verify all related data is created correctly
- [ ] **TC-DATA-002**: Delete OKR - verify related key results are handled correctly
- [ ] **TC-DATA-003**: Delete workspace - verify related teams are handled correctly
- [ ] **TC-DATA-004**: Delete user - verify related assignments are handled correctly

### 16.2 Audit Trail
- [ ] **TC-DATA-005**: Create OKR - verify audit log entry created
- [ ] **TC-DATA-006**: Edit OKR - verify audit log entry created
- [ ] **TC-DATA-007**: Delete OKR - verify audit log entry created
- [ ] **TC-DATA-008**: Assign role - verify audit log entry created

---

## Test Execution Summary

### Test Results Template
```
Test Case ID | Status | Notes | Date
-------------|--------|-------|------
TC-AUTH-001  |   [ ]  |       |
TC-AUTH-002  |   [ ]  |       |
...
```

### Bug Report Template
```
Bug ID: BUG-001
Title: [Brief description]
Severity: [Critical/High/Medium/Low]
Priority: [P0/P1/P2/P3]
Steps to Reproduce:
1. [Step 1]
2. [Step 2]
Expected Result: [What should happen]
Actual Result: [What actually happens]
Screenshots: [If applicable]
```

---

## Notes

- All test cases should be executed with the `founder@puzzelcx.local` account
- Any failures should be documented with screenshots and console logs
- API calls should be verified using browser DevTools Network tab
- Database state should be verified using direct SQL queries when needed
- Test data should be cleaned up after test execution (or use separate test environment)

---

**Document Version:** 1.0  
**Created:** 2025-11-02  
**Last Updated:** 2025-11-02

