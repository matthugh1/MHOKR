# Seed Audit Preflight Report

**Generated:** 2025-01-XX  
**Purpose:** Preflight analysis for large-organisation seed suite design

---

## 1. Git Status

**Current Branch:** `feat/docs/okr-feature-requests`

**Last 3 Commits:**
- `ea4b21c` - fix(okr): resolve runtime errors (DrawerFormSkeleton export, api import, Select empty values)
- `cf2bf59` - docs(feature-requests): add OKR backlog stories + index
- `48fcbf0` - feat(okr): Mini Sprint 4.0 – context & governance refinement (attention polish + cycle management drawer)

---

## 2. Stack Detection

### Database Client
- **Type:** Prisma ORM
- **Provider:** PostgreSQL
- **Schema Location:** `services/core-api/prisma/schema.prisma`
- **Migration Tool:** Prisma Migrate (`prisma migrate dev`)
- **Client Generation:** `@prisma/client` (v5.8.1)

### Existing Seed Infrastructure
- **Location:** `services/core-api/prisma/seed.ts`
- **Execution:** `npm run db:seed` (root) or `npm run prisma:seed` (core-api)
- **Additional Scripts:**
  - `services/core-api/scripts/seed-activity.ts` - Activity seeding helper
  - `services/core-api/prisma/bootstrapOrg.ts` - Bootstrap script (referenced in package.json)

### Seed Configuration
- Prisma seed command configured in `services/core-api/package.json`:
  ```json
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
  ```

---

## 3. Core Tables Inventory

### Tenant & Organisation Structure
- **`organizations`** (Organization)
  - Fields: `id` (cuid), `name`, `slug` (unique), `allowTenantAdminExecVisibility`, `execOnlyWhitelist` (json), `metadata` (json)
  - Relationships: workspaces, objectives, strategicPillars, cycles, checkInRequests
  
- **`workspaces`** (Workspace)
  - Fields: `id` (cuid), `name`, `organizationId` (FK), `parentWorkspaceId` (FK, nullable)
  - Relationships: organization, teams, objectives, aiConversations
  - Indexes: `organizationId`, `parentWorkspaceId`
  
- **`teams`** (Team)
  - Fields: `id` (cuid), `name`, `workspaceId` (FK)
  - Relationships: workspace, objectives
  - Indexes: `workspaceId`

### User & RBAC
- **`users`** (User)
  - Fields: `id` (cuid), `email` (unique), `keycloakId` (unique, nullable), `name`, `passwordHash` (nullable), `isSuperuser`, `managerId` (FK, nullable), `settings` (json)
  - Relationships: manager, directReports, roleAssignments, objectives (as owner), checkInRequests, auditLogs
  - Indexes: `email`, `keycloakId`, `isSuperuser`, `managerId`
  
- **`role_assignments`** (RoleAssignment)
  - Fields: `id` (cuid), `userId` (FK), `role` (RBACRole enum), `scopeType` (ScopeType enum), `scopeId` (string?, nullable)
  - Unique constraint: `userId_role_scopeType_scopeId`
  - Indexes: `userId`, `scopeType_scopeId`, `role`
  - Roles: SUPERUSER, TENANT_OWNER, TENANT_ADMIN, TENANT_VIEWER, WORKSPACE_LEAD, WORKSPACE_ADMIN, WORKSPACE_MEMBER, TEAM_LEAD, TEAM_CONTRIBUTOR, TEAM_VIEWER

### OKR Models
- **`cycles`** (Cycle)
  - Fields: `id` (cuid), `organizationId` (FK), `name`, `status` (CycleStatus enum), `startDate`, `endDate`, `isStandard` (boolean)
  - Status: DRAFT, ACTIVE, LOCKED, ARCHIVED
  - Indexes: `organizationId`, `status`, `isStandard`
  
- **`objectives`** (Objective)
  - Fields: `id` (cuid), `title`, `description` (text), `organizationId` (FK, nullable), `workspaceId` (FK, nullable), `teamId` (FK, nullable), `pillarId` (FK, nullable), `cycleId` (FK, nullable), `ownerId` (FK), `parentId` (FK, nullable), `startDate`, `endDate`, `status` (OKRStatus enum), `progress` (float), `visibilityLevel` (VisibilityLevel enum), `isPublished` (boolean), `positionX`, `positionY`
  - VisibilityLevel: PUBLIC_TENANT (default), PRIVATE (whitelist only)
  - Indexes: `organizationId`, `workspaceId`, `teamId`, `ownerId`, `parentId`, `pillarId`, `cycleId`, `visibilityLevel`, `isPublished`
  
- **`key_results`** (KeyResult)
  - Fields: `id` (cuid), `title`, `description` (text), `ownerId` (FK), `metricType` (enum), `startValue`, `targetValue`, `currentValue` (float), `unit`, `status` (OKRStatus enum), `progress` (float), `visibilityLevel` (enum), `isPublished` (boolean), `checkInCadence` (enum, nullable), `cycleId` (FK, nullable), `startDate`, `endDate`
  - Indexes: `ownerId`, `visibilityLevel`, `isPublished`, `cycleId`
  
- **`objective_key_results`** (ObjectiveKeyResult) - Junction table
  - Fields: `id` (cuid), `objectiveId` (FK), `keyResultId` (FK)
  - Unique constraint: `objectiveId_keyResultId`
  - Indexes: `objectiveId`, `keyResultId`
  
- **`initiatives`** (Initiative)
  - Fields: `id` (cuid), `title`, `description` (text), `keyResultId` (FK, nullable), `objectiveId` (FK, nullable), `cycleId` (FK, nullable), `ownerId` (FK), `status` (InitiativeStatus enum), `startDate`, `endDate`, `dueDate`, `positionX`, `positionY`
  - Indexes: `keyResultId`, `objectiveId`, `ownerId`, `cycleId`

### Check-ins & Attention
- **`check_ins`** (CheckIn)
  - Fields: `id` (cuid), `keyResultId` (FK), `userId` (FK), `value` (float), `confidence` (int), `note` (text), `blockers` (text)
  - Indexes: `keyResultId`, `userId`
  
- **`check_in_requests`** (CheckInRequest)
  - Fields: `id` (cuid), `requesterUserId` (FK), `targetUserId` (FK), `organizationId` (FK), `dueAt` (datetime), `status` (enum)
  - Indexes: `requesterUserId`, `targetUserId`, `organizationId`, `status`, `dueAt`
  
- **`check_in_responses`** (CheckInResponse)
  - Fields: `id` (cuid), `requestId` (FK, unique), `targetUserId` (FK), `summaryWhatMoved`, `summaryBlocked`, `summaryNeedHelp`, `submittedAt`
  - Indexes: `requestId`, `targetUserId`, `submittedAt`

### Audit & Activity
- **`audit_logs`** (AuditLog)
  - Fields: `id` (cuid), `actorUserId` (FK), `action` (string), `targetType` (enum), `targetId` (string), `previousRole`, `newRole`, `impersonatedUserId` (FK, nullable), `metadata` (json), `timestamp`
  - Indexes: `actorUserId`, `targetType_targetId`, `action`, `timestamp`
  
- **`activities`** (Activity)
  - Fields: `id` (cuid), `entityType` (enum), `entityId` (string), `userId` (FK), `action` (enum), `metadata` (json)
  - Indexes: `entityType_entityId`, `userId`

### Supporting Models
- **`strategic_pillars`** (StrategicPillar)
  - Fields: `id` (cuid), `organizationId` (FK), `name`, `description` (text), `color` (string)
  - Indexes: `organizationId`

---

## 4. Critical Constraints & Indexes

### Unique Constraints
- **`organizations.slug`** - Unique slug per tenant
- **`users.email`** - Unique email per user
- **`users.keycloakId`** - Unique Keycloak ID (nullable)
- **`role_assignments.userId_role_scopeType_scopeId`** - Prevent duplicate role assignments

### Foreign Key Constraints
- **Cascade Deletes:**
  - `workspaces.organizationId` → `organizations.id` (CASCADE)
  - `teams.workspaceId` → `workspaces.id` (CASCADE)
  - `objectives.organizationId` → `organizations.id` (CASCADE)
  - `objectives.workspaceId` → `workspaces.id` (CASCADE)
  - `objectives.ownerId` → `users.id` (CASCADE)
  - `key_results.ownerId` → `users.id` (CASCADE)
  - `initiatives.ownerId` → `users.id` (CASCADE)
  - `role_assignments.userId` → `users.id` (CASCADE)
  - `check_ins.keyResultId` → `key_results.id` (CASCADE)
  
- **Set Null on Delete:**
  - `users.managerId` → `users.id` (SET NULL)
  - `objectives.teamId` → `teams.id` (SET NULL)
  - `objectives.parentId` → `objectives.id` (SET NULL)
  - `objectives.cycleId` → `cycles.id` (SET NULL)
  - `initiatives.objectiveId` → `objectives.id` (SET NULL)

### Not Null Constraints
- **Critical:** `users.email`, `users.name`, `objectives.ownerId`, `key_results.ownerId`, `initiatives.ownerId`, `cycles.organizationId`, `workspaces.organizationId`, `teams.workspaceId`

---

## 5. Critical Endpoints & Services

### OKR Endpoints
- **`GET /okr/overview`**
  - Query params: `organizationId`, `cycleId`, `status`, `scope` (my|team-workspace|tenant), `page`, `pageSize`
  - Returns: Paginated objectives with nested KRs and initiatives
  - Visibility: Server-side filtered by requester's scope
  - Guards: `JwtAuthGuard`, `RBACGuard`, `@RequireAction('view_okr')`
  
- **`GET /okr/insights/attention`**
  - Query params: `organizationId`, `cycleId`, `scope`, `page`, `pageSize`
  - Returns: Paginated attention feed (overdue check-ins, no updates, status downgrades)
  - Guards: `JwtAuthGuard`, `RBACGuard`, `@RequireAction('view_okr')`
  
- **`GET /okr/insights/cycle-summary`**
  - Query params: `organizationId`, `cycleId`
  - Returns: Cycle health summary (objectives, KRs, check-ins counts)
  - Guards: `JwtAuthGuard`, `RBACGuard`, `@RequireAction('view_okr')`
  
- **`POST /okr/create-composite`**
  - Body: Objective + Key Results (atomic creation)
  - Guards: `JwtAuthGuard`, `RBACGuard`, `RateLimitGuard`, `@RequireAction('create_okr')`

### RBAC Endpoints
- **`GET /rbac/assignments/me`**
  - Returns: Current user's role assignments grouped by scope
  - Guards: `JwtAuthGuard`, `RBACGuard`, `@RequireAction('view_okr')`
  
- **`GET /rbac/assignments/effective`**
  - Query params: `tenantId`, `workspaceId`, `teamId` (optional)
  - Returns: Effective permissions (all actions with allow/deny status)
  - Guards: `JwtAuthGuard`, `RBACGuard`, `@RequireAction('view_okr')`
  
- **`POST /rbac/assignments/assign`**
  - Body: `userEmail`, `role`, `scopeType`, `scopeId`
  - Assigns role to user (uses `RBACService.assignRole()`)
  - Guards: `JwtAuthGuard`, `RBACGuard`, `RateLimitGuard`, `@RequireAction('manage_users')`

### System Endpoints
- **`GET /system/status`** (if exists)
  - Health check endpoint

### RBAC Service Methods
- **`RBACService.assignRole()`** - Assign role to user (respects tenant isolation)
- **`RBACService.revokeRole()`** - Revoke role assignment
- **`RBACService.buildUserContext()`** - Build user context with all role assignments
- **`RBACService.canPerformAction()`** - Check if user can perform action on resource

---

## 6. Seed-Specific Considerations

### Idempotency Requirements
- Use deterministic UUIDv5 generation from natural keys (email, slug)
- Upsert by natural keys (email, slug) to allow re-runs
- Existing seed script uses `findFirst` + `create`/`update` pattern (not fully idempotent)

### Tenant Isolation
- **OkrTenantGuard** - Ensures all operations respect tenant boundaries
- SUPERUSER read-only enforced in RBAC logic
- All seed operations must set `organizationId` correctly

### Governance Rules
- **Publish Locks:** `isPublished = true` prevents edits (except TENANT_OWNER/TENANT_ADMIN)
- **Cycle Locks:** `Cycle.status = LOCKED` prevents edits (except TENANT_OWNER/TENANT_ADMIN)
- **Visibility:** PRIVATE OKRs require whitelist (`Organization.execOnlyWhitelist`)

### Performance Considerations
- Use `createMany()` for bulk inserts (chunk at 1000 rows)
- Transaction wrapping for related entities (Objective + KRs + Initiatives)
- Referential integrity: Insert parents first (Organization → Workspace → Team → User → Cycle → Objective → KeyResult → Initiative)

### Audit Logging
- Seed should bypass rate limits where appropriate
- Minimal audit footprint during seed (but maintain critical audit trails)
- Use `AuditLogService` for role assignments

---

## 7. Seed Script Locations

**Existing Seeds:**
- `services/core-api/prisma/seed.ts` - Main seed (uses hardcoded IDs, not fully idempotent)
- `services/core-api/scripts/seed-activity.ts` - Activity seeding helper

**Proposed New Structure:**
- `scripts/seed/` - New seed suite directory (root level)
- `prisma/factories/` - Data builder factories (inside `services/core-api/prisma/`)

---

## 8. Environment Configuration

**Database Connection:**
- Environment variable: `DATABASE_URL` (PostgreSQL connection string)
- Prisma Client: Auto-generated from schema

**Seed Execution:**
- Root: `npm run db:seed`
- Core API: `npm run prisma:seed`
- Requires: `ts-node` available in PATH

---

## Summary

- **Database:** Prisma + PostgreSQL ✅
- **Schema:** Well-defined with proper constraints ✅
- **RBAC:** Fully implemented with RoleAssignment model ✅
- **Seed Infrastructure:** Basic seed exists, needs enhancement for large-scale idempotent seeding ✅
- **Endpoints:** Well-documented OKR and RBAC endpoints ✅
- **Tenant Isolation:** Enforced via OkrTenantGuard and RBAC ✅

**Next Steps:**
1. Create deterministic ID generation strategy
2. Build seed suite with idempotent upserts
3. Implement bulk operations with proper chunking
4. Add validation probes and dry-run capabilities

