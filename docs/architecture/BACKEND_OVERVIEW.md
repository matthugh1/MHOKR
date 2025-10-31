# Backend Architecture Overview

## Core API Module Structure

The `core-api` service is built on NestJS and organized into domain modules with clear separation of concerns.

### Module Organization

```
services/core-api/src/
├── app.module.ts                 # Root module, imports all feature modules
├── common/                       # Shared infrastructure
│   ├── prisma/                   # Database access layer
│   └── redis/                    # Caching layer
└── modules/
    ├── auth/                     # Authentication (JWT, Keycloak integration)
    ├── user/                     # User management
    ├── organization/             # Tenant/organization management
    ├── workspace/                # Workspace management
    ├── team/                     # Team management
    ├── okr/                      # OKR domain (objectives, key results, reporting)
    ├── activity/                 # Activity feed and audit logging
    ├── rbac/                     # Role-Based Access Control system
    ├── permissions/              # Permission decorators and guards
    ├── layout/                   # UI layout data
    └── superuser/                # Superuser management
```

## Key Domain Modules

### OKR Module (`modules/okr/`)

The OKR module handles all objectives, key results, and reporting functionality.

**Core Services:**

- **`objective.service.ts`**: CRUD operations for objectives, tenant isolation, visibility checks
- **`key-result.service.ts`**: CRUD operations for key results, check-ins, progress tracking
- **`okr-governance.service.ts`**: Centralized publish lock and cycle lock enforcement
  - `checkPublishLockForObjective()`: Prevents editing published OKRs (admin-only override)
  - `checkCycleLockForObjective()`: Prevents editing OKRs in locked/archived cycles
  - Mirror methods for key results
- **`okr-reporting.service.ts`**: Analytics, summaries, pillar coverage, export functionality
- **`okr-progress.service.ts`**: Progress calculation and aggregation
- **`tenant-guard.ts`**: Utility for tenant isolation, superuser read-only rules, org match enforcement

**Controllers:**

- `objective.controller.ts`: REST endpoints for objectives
- `key-result.controller.ts`: REST endpoints for key results
- `okr-reporting.controller.ts`: Analytics and export endpoints (`/reports/*`)
- `me.controller.ts`: User-specific OKR views

**Dependencies:**

- Requires `RBACModule` for permission checks
- Requires `ActivityModule` for audit logging

### RBAC Module (`modules/rbac/`)

The RBAC system provides role-based access control with tenant isolation.

**Core Components:**

- **`rbac.service.ts`**: Main authorization service
  - Role resolution (10 roles across 4 scopes)
  - Action authorization (`canPerformAction()`)
  - Visibility policy enforcement
- **`rbac.guard.ts`**: NestJS guard for route protection
- **`rbac.decorator.ts`**: Decorators for route annotations (`@RequireAction()`)
- **`visibilityPolicy.ts`**: OKR visibility rules (PUBLIC_TENANT, WORKSPACE_ONLY, TEAM_ONLY)
- **`tenant-isolation.guard.ts`**: Tenant boundary enforcement

**Roles:**

- Platform: `SUPERUSER`
- Tenant: `TENANT_OWNER`, `TENANT_ADMIN`, `TENANT_VIEWER`
- Workspace: `WORKSPACE_LEAD`, `WORKSPACE_ADMIN`, `WORKSPACE_MEMBER`
- Team: `TEAM_LEAD`, `TEAM_CONTRIBUTOR`, `TEAM_VIEWER`

**See:** `modules/rbac/README.md` for detailed documentation

### Auth Module (`modules/auth/`)

Handles JWT authentication and Keycloak integration.

- **`auth.service.ts`**: Token validation, user lookup
- **`jwt.strategy.ts`**: Passport JWT strategy
- **`jwt-auth.guard.ts`**: Global authentication guard

## Dependency Graph

```
app.module.ts
├── RBACModule (loaded early for guards)
├── AuthModule
│   └── Requires: PrismaModule
├── UserModule
│   └── Requires: PrismaModule, RBACModule
├── OrganizationModule
│   └── Requires: PrismaModule, RBACModule
├── WorkspaceModule
│   └── Requires: PrismaModule, RBACModule
├── TeamModule
│   └── Requires: PrismaModule, RBACModule
├── OkrModule
│   ├── Requires: RBACModule, ActivityModule
│   └── Exports: ObjectiveService, KeyResultService, OkrGovernanceService, OkrReportingService
└── ActivityModule
    └── Requires: PrismaModule
```

## Tenant Isolation Pattern

All tenant-scoped resources enforce isolation via `OkrTenantGuard`:

1. **Superuser (userOrganizationId === null)**: Can READ all organizations, cannot WRITE
2. **Normal user (userOrganizationId === string)**: Can read/write only within their organization
3. **No org (userOrganizationId === undefined)**: Cannot access tenant data

Methods:
- `buildTenantWhereClause()`: Creates Prisma where filter
- `assertCanMutate()`: Rejects superuser writes
- `assertTenantMatch()`: Ensures user and resource share organization

## Governance Rules

**Publish Lock:**
- When `objective.isPublished === true`, only `TENANT_OWNER` or `TENANT_ADMIN` can edit/delete
- Enforced by `OkrGovernanceService.checkPublishLockForObjective()`

**Cycle Lock:**
- When `cycle.status === 'LOCKED'` or `'ARCHIVED'`, only admins can edit/delete
- Enforced by `OkrGovernanceService.checkCycleLockForObjective()`

## Interaction Summary

1. **Request Flow:**
   - Incoming request → `JwtAuthGuard` validates token
   - `RBACGuard` checks action permissions via `RBACService`
   - `TenantIsolationGuard` enforces tenant boundaries
   - Service layer executes business logic with governance checks

2. **OKR Operations:**
   - Create/Update/Delete → Check tenant isolation → Check publish lock → Check cycle lock → Execute

3. **Reporting:**
   - Analytics endpoints → Aggregate data within tenant scope → Return summaries

4. **Activity Logging:**
   - All mutations → `ActivityService` records audit trail

## Database Schema

Primary tables (via Prisma):
- `User`, `Organization`, `Workspace`, `Team`
- `Objective`, `KeyResult`, `CheckIn`
- `Cycle`, `Pillar`
- `RBACAssignment`, `ExecWhitelist`

See `services/core-api/prisma/schema.prisma` for full schema.

