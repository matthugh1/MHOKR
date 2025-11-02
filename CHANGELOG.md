## [Security Hardening] W1.M1 Complete

- All tenant-scoped mutations are now protected by tenant isolation checks.
- SUPERUSER is read-only across tenant data and cannot perform write operations.
- All mutating endpoints are now wrapped in JwtAuthGuard + RBACGuard + @RequireAction().
- Role assignment, workspace/team membership changes, exec visibility whitelist changes, and other privileged actions are now logged through a central AuditLogService.
- There are no remaining TODO/FIXME/HACK placeholders in these security-sensitive services and controllers.
- A validation plan has been documented (docs/audit/W1M1_TEST_VALIDATION_PLAN.md) describing expected behaviour per role (TENANT_ADMIN, WORKSPACE_LEAD, TEAM_LEAD, CONTRIBUTOR, SUPERUSER).

## [Security Hardening] W1.M2 Complete

- Check-in request creation is now restricted to authorised roles only (direct managers, tenant admins/owners, workspace leads, and team leads).
- SUPERUSER cannot request check-ins. SUPERUSER is read-only and cannot initiate performance-style escalation.
- All check-in request creation events are now logged through AuditLogService with actor, target, org, and due date context.
- Cross-tenant escalation is blocked; you cannot request an update from someone in another organisation.
- A dedicated RBAC action ('request_checkin') and guard path have been added so this capability is explicitly permissioned.
- Manual validation steps are defined in W1.M2's validation plan (manager allowed, peer blocked, superuser blocked).

