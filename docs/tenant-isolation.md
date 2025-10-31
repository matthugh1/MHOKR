# Tenant Isolation Model (Objectives + Key Results)

## Overview

Tenant isolation is enforced via organizationId on all OKR entities.

### req.user.organizationId semantics

- null        → superuser. Can READ all organisations. Read-only.

- <string>    → normal user. Can read/write only within that organisation.

- undefined   → user with no organisation membership. Cannot read or write tenant data. GET /objectives returns [].

## Objectives

- objective.service.findAll():

  - Superuser (null): no org filter, returns all OKRs.

  - Normal user (string): filtered by that org.

  - No-org (undefined): returns [].

- canEdit / canDelete:

  - Enforce org match between user and objective.

  - Reject superusers (read-only).

  - Reject objectives with no organizationId (system/global OKRs are immutable).

### System/global OKRs

- OKRs with no organizationId are platform-level or system/global.

- Always read-only. Changing this requires explicit policy approval.

## Key Results (interim)

- Controllers pass req.user.id and req.user.organizationId to KR write methods.

- KR service methods block if:

  - organizationId === null (superuser)

  - organizationId undefined/falsy

  - parent Objective orgId ≠ caller orgId

- Interim guard marked with // TODO [tenant-isolation-P1-KR].

- No KR mutation endpoint should ship without this guard.

## Legacy notes

- organizationId is canonical.

- tenantId is legacy. Do not use in new code.

- ResourceContext.tenantId remains only for backward compatibility.

## Follow-ups

- Unify KR RBAC with Objective RBAC (canEditKeyResult, canDeleteKeyResult).

- Remove legacy membership tables and TenantIsolationGuard.

- Add multi-org user support in jwt.strategy.ts.

- Add audit logging for permission-critical actions.


