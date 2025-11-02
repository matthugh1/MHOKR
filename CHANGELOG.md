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

## [Governance Alignment] W2.M1 Complete

- The UI now hides edit, delete, drag, and update actions when the user is not allowed to perform them.
- Publish-locked and cycle-locked OKRs are now effectively read-only in the UI for normal users, but remain editable for tenant admins.
- The visual OKR builder is now permission-aware: contributors and workspace leads cannot drag or edit locked objectives, and destructive actions are not displayed.
- All destructive controls are now aligned with backend RBAC and governance rules. Buttons that would 403 are no longer rendered.
- This prevents accidental or misleading actions during demos and enforces trust in what the user sees.

## [Visibility Enforcement] W2.M2 Complete

- Sensitive and executive-only OKRs are now fully suppressed from the UI for unauthorised users. They do not render at all.
- PRIVATE objectives are only visible to their owner, tenant admins/owners, or explicitly whitelisted viewers.
- Key Results inherit visibility from their parent Objective and are hidden when the Objective is hidden.
- The OKR list and visual builder both pre-filter data before rendering. Contributors and workspace leads no longer see exec/board objectives unless allowed.
- Tenant admins continue to see full strategic context.
- This prevents leakage of strategic and performance-sensitive objectives to unauthorised users.

