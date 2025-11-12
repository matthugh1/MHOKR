# RBAC Enforcement Map
Generated: 2025-11-05T19:57:17.323Z

## modules/user/user.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `usersme` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `usersme/context` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `users` | `RequireAction` | GET | manage_users | ✓ | ✗ | ✗ | OK | - |
| `users:id` | `RequireAction` | GET | manage_users | ✓ | ✗ | ✗ | OK | - |
| `users` | `RequireAction` | POST | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `users:id` | `RequireAction` | PATCH | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `users:id/reset-password` | `RequireAction` | POST | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |

## modules/workspace/workspace.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `workspaces` | `RequireAction` | GET | manage_workspaces | ✓ | ✗ | ✗ | OK | - |
| `workspacesdefault` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `workspaces:id` | `RequireAction` | GET | manage_workspaces | ✓ | ✗ | ✗ | OK | - |
| `workspaces` | `RequireAction` | POST | manage_workspaces | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `workspaces:id` | `RequireAction` | PATCH | manage_workspaces | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `workspaces:id` | `RequireAction` | DELETE | manage_workspaces | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `workspaces:id/members` | `RequireAction` | GET | manage_users | ✓ | ✗ | ✗ | OK | - |
| `workspaces:id/members` | `RequireAction` | POST | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `workspaces:id/members/:userId` | `RequireAction` | DELETE | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `workspaceshierarchy/:organizationId` | `RequireAction` | GET | manage_workspaces | ✓ | ✗ | ✗ | OK | - |

## modules/team/team.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `teams` | `RequireAction` | GET | manage_teams | ✓ | ✗ | ✗ | OK | - |
| `teams:id` | `RequireAction` | GET | manage_teams | ✓ | ✗ | ✗ | OK | - |
| `teams` | `RequireAction` | POST | manage_teams | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `teams:id` | `RequireAction` | PATCH | manage_teams | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `teams:id` | `RequireAction` | DELETE | manage_teams | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `teams:id/members` | `RequireAction` | POST | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `teams:id/members/:userId` | `RequireAction` | DELETE | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |

## modules/system/system.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `systemstatus` | `ApiOperation` | GET | - | ✗ | ✗ | ✗ | OK | - |

## modules/superuser/superuser.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `superusercheck` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `superusercreate` | `RequireAction` | POST | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `superuserpromote/:userId` | `RequireAction` | POST | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `superuserrevoke/:userId` | `RequireAction` | POST | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `superuserlist` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `superuserorganizations` | `RequireAction` | POST | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `superuserorganizations/:organizationId/users/:userId` | `RequireAction` | POST | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `superuserorganizations/:organizationId/users/:userId` | `RequireAction` | DELETE | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `superuserorganizations` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `superuserusers` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `superuserimpersonate/:userId` | `RequireAction` | POST | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |

## modules/rbac/rbac-inspector.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `rbac/inspectorenable` | `RequireAction` | POST | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |

## modules/rbac/rbac-assignment.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `rbac/assignmentsme` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `rbac/assignmentseffective` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `rbac/assignments` | `RequireAction` | GET | manage_users | ✓ | ✗ | ✗ | OK | - |
| `rbac/assignmentsassign` | `UseGuards` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `rbac/assignments:assignmentId` | `UseGuards` | DELETE | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `rbac/assignments:tenantId` | `RequireAction` | GET | manage_tenant_settings | ✓ | ✗ | ✗ | OK | - |
| `rbac/assignments:tenantId/add` | `UseGuards` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `rbac/assignments:tenantId/remove` | `UseGuards` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `rbac/assignments:tenantId/set` | `UseGuards` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `rbac/assignments:tenantId` | `UseGuards` | DELETE | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |

## modules/rbac/migration.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `rbac/migrationall` | `RequireAction` | POST | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `rbac/migrationuser/:userId` | `RequireAction` | POST | impersonate_user | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `rbac/migrationverify` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |

## modules/organization/organization.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `organizationscurrent` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `organizations` | `RequireAction` | GET | manage_tenant_settings | ✓ | ✗ | ✗ | OK | - |
| `organizations:id` | `RequireAction` | GET | manage_tenant_settings | ✓ | ✗ | ✗ | OK | - |
| `organizations` | `RequireAction` | POST | manage_tenant_settings | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `organizations:id` | `RequireAction` | PATCH | manage_tenant_settings | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `organizations:id` | `RequireAction` | DELETE | manage_tenant_settings | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `organizations:id/members` | `RequireAction` | GET | manage_users | ✓ | ✗ | ✗ | OK | - |
| `organizations:id/members` | `RequireAction` | POST | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `organizations:id/members/:userId` | `RequireAction` | DELETE | manage_users | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |

## modules/okr/okr-reporting.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `reportsanalytics/summary` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `reportsanalytics/feed` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `reportsexport/csv` | `RequireAction` | GET | export_data | ✓ | ✗ | ✗ | OK | - |
| `reportscycles` | `Get` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `reportscycles/active` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `reportscycles/active` | `Get` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `reportscycles` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `reportspillars` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `reportspillars/coverage` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `reportscheck-ins/overdue` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |

## modules/okr/okr-overview.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `okroverview` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `okrcreation-context` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `okrcreate-composite` | `UseGuards` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |

## modules/okr/okr-insights.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `okr/insightscycle-summary` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `okr/insightsobjective/:id` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `okr/insightsattention` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |

## modules/okr/okr-cycle.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `okr/cycles` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `okr/cycles:id` | `Get` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `okr/cyclesget-or-create-standard` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `okr/cycles:id/summary` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `okr/cycles:id` | `ApiOperation` | GET | - | ✓ | ✗ | ✗ | OK | - |
| `okr/cycles` | `ApiOperation` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `okr/cycles:id` | `ApiOperation` | PATCH | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `okr/cycles:id/status` | `ApiOperation` | PATCH | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `okr/cycles:id` | `ApiOperation` | DELETE | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |

## modules/okr/objective.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `objectives` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `objectives:id` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `objectives` | `UseGuards` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `objectives:id` | `UseGuards` | PATCH | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `objectives:id` | `UseGuards` | DELETE | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |

## modules/okr/me.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `mesummary` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |

## modules/okr/key-result.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `key-results` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `key-results:id` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `key-results` | `UseGuards` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `key-results:id` | `UseGuards` | PATCH | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `key-results:id` | `UseGuards` | DELETE | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `key-results:id/check-in` | `RequireAction` | POST | edit_okr | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |

## modules/okr/initiative.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `initiatives` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `initiatives:id` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `initiatives` | `RequireAction` | POST | create_okr | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `initiatives:id` | `RequireAction` | PATCH | edit_okr | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `initiatives:id` | `RequireAction` | DELETE | delete_okr | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |

## modules/okr/checkin-request.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `okrcheckin-requests` | `UseGuards` | POST | - | ✓ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; No tenant guard assertion found in service methods; No audit log call found |
| `okrcheckin-requests/mine` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `okrcheckin-responses` | `RequireAction` | POST | edit_okr | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `okrcheckin-rollup` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |

## modules/layout/layout.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `layoutsave` | `RequireAction` | POST | view_okr | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `layout` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `layout:entityType/:entityId` | `RequireAction` | DELETE | view_okr | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |
| `layoutclear` | `RequireAction` | DELETE | view_okr | ✓ | ✗ | ✗ | HIGH | No tenant guard assertion found in service methods; No audit log call found |

## modules/auth/auth.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `authregister` | `ApiOperation` | POST | - | ✗ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; Missing RBACGuard; No tenant guard assertion found in service methods; No audit log call found |
| `authlogin` | `ApiOperation` | POST | - | ✗ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; Missing RBACGuard; No tenant guard assertion found in service methods; No audit log call found |
| `authverify` | `ApiOperation` | POST | - | ✗ | ✗ | ✗ | CRITICAL | Missing @RequireAction decorator; Missing RBACGuard; No tenant guard assertion found in service methods; No audit log call found |
| `authme` | `UseGuards` | GET | - | ✗ | ✗ | ✗ | OK | - |

## modules/activity/activity.controller.ts

| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |
|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|
| `activityobjectives/:id` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `activitykey-results/:id` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |
| `activityfeed` | `RequireAction` | GET | view_okr | ✓ | ✗ | ✗ | OK | - |

