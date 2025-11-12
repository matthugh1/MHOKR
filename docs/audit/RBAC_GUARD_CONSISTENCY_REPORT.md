# RBAC Guard Consistency Report
Generated: 2025-11-05T19:57:17.326Z

## CRITICAL Issues

### modules/rbac/rbac-assignment.controller.ts:288 - UseGuards

- **Route:** `rbac/assignmentsassign`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/rbac/rbac-assignment.controller.ts:317 - UseGuards

- **Route:** `rbac/assignments:assignmentId`
- **HTTP Method:** DELETE
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/rbac/rbac-assignment.controller.ts:362 - UseGuards

- **Route:** `rbac/assignments:tenantId/add`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/rbac/rbac-assignment.controller.ts:384 - UseGuards

- **Route:** `rbac/assignments:tenantId/remove`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/rbac/rbac-assignment.controller.ts:406 - UseGuards

- **Route:** `rbac/assignments:tenantId/set`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/rbac/rbac-assignment.controller.ts:428 - UseGuards

- **Route:** `rbac/assignments:tenantId`
- **HTTP Method:** DELETE
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/okr-overview.controller.ts:732 - UseGuards

- **Route:** `okrcreate-composite`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/okr-cycle.controller.ts:129 - ApiOperation

- **Route:** `okr/cycles`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/okr-cycle.controller.ts:143 - ApiOperation

- **Route:** `okr/cycles:id`
- **HTTP Method:** PATCH
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/okr-cycle.controller.ts:161 - ApiOperation

- **Route:** `okr/cycles:id/status`
- **HTTP Method:** PATCH
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/okr-cycle.controller.ts:183 - ApiOperation

- **Route:** `okr/cycles:id`
- **HTTP Method:** DELETE
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/objective.controller.ts:48 - UseGuards

- **Route:** `objectives`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/objective.controller.ts:73 - UseGuards

- **Route:** `objectives:id`
- **HTTP Method:** PATCH
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/objective.controller.ts:90 - UseGuards

- **Route:** `objectives:id`
- **HTTP Method:** DELETE
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/key-result.controller.ts:39 - UseGuards

- **Route:** `key-results`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/key-result.controller.ts:62 - UseGuards

- **Route:** `key-results:id`
- **HTTP Method:** PATCH
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/key-result.controller.ts:75 - UseGuards

- **Route:** `key-results:id`
- **HTTP Method:** DELETE
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/checkin-request.controller.ts:22 - UseGuards

- **Route:** `okrcheckin-requests`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/auth/auth.controller.ts:11 - ApiOperation

- **Route:** `authregister`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - Missing RBACGuard
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/auth/auth.controller.ts:26 - ApiOperation

- **Route:** `authlogin`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - Missing RBACGuard
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/auth/auth.controller.ts:32 - ApiOperation

- **Route:** `authverify`
- **HTTP Method:** POST
- **Issues:**
  - Missing @RequireAction decorator
  - Missing RBACGuard
  - No tenant guard assertion found in service methods
  - No audit log call found

## HIGH Issues

### modules/user/user.controller.ts:50 - RequireAction

- **Route:** `users`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/user/user.controller.ts:106 - RequireAction

- **Route:** `users:id`
- **HTTP Method:** PATCH
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/user/user.controller.ts:113 - RequireAction

- **Route:** `users:id/reset-password`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/workspace/workspace.controller.ts:38 - RequireAction

- **Route:** `workspaces`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/workspace/workspace.controller.ts:45 - RequireAction

- **Route:** `workspaces:id`
- **HTTP Method:** PATCH
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/workspace/workspace.controller.ts:52 - RequireAction

- **Route:** `workspaces:id`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/workspace/workspace.controller.ts:68 - RequireAction

- **Route:** `workspaces:id/members`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/workspace/workspace.controller.ts:79 - RequireAction

- **Route:** `workspaces:id/members/:userId`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/team/team.controller.ts:28 - RequireAction

- **Route:** `teams`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/team/team.controller.ts:35 - RequireAction

- **Route:** `teams:id`
- **HTTP Method:** PATCH
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/team/team.controller.ts:42 - RequireAction

- **Route:** `teams:id`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/team/team.controller.ts:49 - RequireAction

- **Route:** `teams:id/members`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/team/team.controller.ts:56 - RequireAction

- **Route:** `teams:id/members/:userId`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/superuser/superuser.controller.ts:37 - RequireAction

- **Route:** `superusercreate`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/superuser/superuser.controller.ts:56 - RequireAction

- **Route:** `superuserpromote/:userId`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/superuser/superuser.controller.ts:71 - RequireAction

- **Route:** `superuserrevoke/:userId`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/superuser/superuser.controller.ts:107 - RequireAction

- **Route:** `superuserorganizations`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/superuser/superuser.controller.ts:127 - RequireAction

- **Route:** `superuserorganizations/:organizationId/users/:userId`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/superuser/superuser.controller.ts:149 - RequireAction

- **Route:** `superuserorganizations/:organizationId/users/:userId`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/superuser/superuser.controller.ts:197 - RequireAction

- **Route:** `superuserimpersonate/:userId`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/rbac/rbac-inspector.controller.ts:36 - RequireAction

- **Route:** `rbac/inspectorenable`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/rbac/migration.controller.ts:22 - RequireAction

- **Route:** `rbac/migrationall`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/rbac/migration.controller.ts:36 - RequireAction

- **Route:** `rbac/migrationuser/:userId`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/organization/organization.controller.ts:35 - RequireAction

- **Route:** `organizations`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/organization/organization.controller.ts:42 - RequireAction

- **Route:** `organizations:id`
- **HTTP Method:** PATCH
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/organization/organization.controller.ts:49 - RequireAction

- **Route:** `organizations:id`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/organization/organization.controller.ts:68 - RequireAction

- **Route:** `organizations:id/members`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/organization/organization.controller.ts:79 - RequireAction

- **Route:** `organizations:id/members/:userId`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/key-result.controller.ts:97 - RequireAction

- **Route:** `key-results:id/check-in`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/initiative.controller.ts:42 - RequireAction

- **Route:** `initiatives`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/initiative.controller.ts:104 - RequireAction

- **Route:** `initiatives:id`
- **HTTP Method:** PATCH
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/initiative.controller.ts:116 - RequireAction

- **Route:** `initiatives:id`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/okr/checkin-request.controller.ts:75 - RequireAction

- **Route:** `okrcheckin-responses`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/layout/layout.controller.ts:15 - RequireAction

- **Route:** `layoutsave`
- **HTTP Method:** POST
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/layout/layout.controller.ts:37 - RequireAction

- **Route:** `layout:entityType/:entityId`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

### modules/layout/layout.controller.ts:49 - RequireAction

- **Route:** `layoutclear`
- **HTTP Method:** DELETE
- **Issues:**
  - No tenant guard assertion found in service methods
  - No audit log call found

