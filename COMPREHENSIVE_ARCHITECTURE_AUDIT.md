# Comprehensive Architecture Audit Report
## OKR Nexus Platform

**Date:** 2025-01-XX  
**Auditor:** Staff+ Engineer & Product Architect  
**Scope:** Full codebase architecture, domain model, security, technical debt, and production readiness assessment

---

## 1. High-level Summary

### 1.1 What is this product?

OKR Nexus is an enterprise-grade OKR (Objectives and Key Results) management platform designed for leadership teams who require strict governance, accountability, auditability, and strategic alignment. The platform goes beyond basic OKR tracking by providing:

- **Visual OKR Builder**: ReactFlow-based drag-and-drop interface for creating and visualizing OKR hierarchies
- **AI-Powered Assistance**: Three AI personas (OKR Coach, Cascade Assistant, Progress Analyst) powered by OpenAI/Anthropic
- **Governance Model**: Publish locks, cycle locks, and controlled rollout mechanisms
- **Enterprise Multi-Tenancy**: Strict tenant isolation with comprehensive audit trails
- **Reporting & Analytics**: Executive dashboards, strategic pillar coverage, progress rollups, and CSV export
- **Async Check-in Workflow**: Manager-driven check-in requests with deadline tracking and overdue alerts

### 1.2 What problem does it solve for the user / organisation?

**For Leadership Teams:**
- **Rollout Control**: Prevents ad-hoc changes to published OKRs through governance locks
- **Strategic Alignment**: Visual builder and cascade features help connect team OKRs to organizational objectives
- **Accountability**: Async check-in workflow ensures timely updates from contributors
- **Auditability**: Comprehensive activity logs and permission audit trails for compliance

**For Individual Contributors:**
- **Clear Priorities**: Visual representation of how their work connects to broader goals
- **AI Guidance**: OKR Coach helps write better objectives and key results
- **Progress Tracking**: Easy check-in interface with confidence ratings and blocker identification

**For Organizations:**
- **Multi-Tenant Isolation**: Enterprise-grade security ensures tenant data is completely isolated
- **Executive Reporting**: Strategic pillar coverage and progress analytics for leadership reviews
- **Integration Ready**: Architecture supports future integrations with Jira, GitHub, Slack, Salesforce

### 1.3 Who are the main user types / roles in the system today?

**Platform Level:**
- **SUPERUSER**: System-wide read-only auditor (can view all tenants, cannot modify data)

**Tenant Level (Organization):**
- **TENANT_OWNER**: Full control over organization settings, OKR governance, user management
- **TENANT_ADMIN**: Can bypass publish/cycle locks, manage users and workspaces
- **TENANT_VIEWER**: Read-only access to organization OKRs

**Workspace Level:**
- **WORKSPACE_LEAD**: Primary owner of workspace OKRs, can create/edit workspace-level objectives
- **WORKSPACE_ADMIN**: Administrative control within workspace
- **WORKSPACE_MEMBER**: Contributor access to workspace OKRs

**Team Level:**
- **TEAM_LEAD**: Owner of team OKRs, can create/edit team-level objectives
- **TEAM_CONTRIBUTOR**: Can update key results, submit check-ins
- **TEAM_VIEWER**: Read-only access to team OKRs

**Legacy Roles (MemberRole enum):**
- `SUPERUSER`, `ORG_ADMIN`, `WORKSPACE_OWNER`, `TEAM_LEAD`, `MEMBER`, `VIEWER` - Still present in `TeamMember`, `WorkspaceMember`, `OrganizationMember` junction tables but deprecated in favor of RBAC `RoleAssignment` model.

### 1.4 Current maturity state: **MVP / In Active Build** (preparing for design partner demos)

**Justification:**
- ✅ Core OKR CRUD operations functional
- ✅ Multi-tenant architecture with tenant isolation implemented
- ✅ RBAC system migrated and operational
- ✅ Governance locks (publish/cycle) implemented
- ✅ AI service integrated with multiple personas
- ✅ Visual builder functional
- ✅ Reporting/analytics endpoints operational
- ⚠️ Many `[phase7-hardening]` TODOs indicate security/permission gaps
- ⚠️ Integration service scaffolded but not fully implemented
- ⚠️ Test coverage minimal (only smoke tests exist)
- ⚠️ Some RBAC enforcement incomplete (check-in requests, visibility policies)
- ⚠️ Multi-org user support not implemented (JWT strategy only uses first org)

**Status:** Internal pre-release platform preparing for design partner demos. Codebase has been refactored for maintainability but requires hardening before production deployment.

---

## 2. Architecture Overview

### 2.1 Monorepo / multi-repo layout

**Structure:** Monorepo using npm workspaces (`package.json` defines workspaces: `apps/*`, `services/*`, `packages/*`)

**Root Folders:**

- **`/apps/web`**: Next.js 14 frontend application
  - Framework: Next.js App Router + React 18 + TypeScript
  - Styling: Tailwind CSS + shadcn/ui components
  - State: React Context (auth, workspace) + Zustand (some stores)
  - Port: 5173 (dev), 5173 (prod)

- **`/services/core-api`**: NestJS backend API service
  - Framework: NestJS 10 + Express + TypeScript
  - Database: PostgreSQL via Prisma ORM
  - Auth: JWT (HS256) + Keycloak (RS256) via JWKS
  - Port: 3001

- **`/services/api-gateway`**: Express API gateway / reverse proxy
  - Framework: Express + http-proxy-middleware
  - Responsibilities: Request routing, JWT validation, rate limiting, CORS
  - Port: 3000

- **`/services/ai-service`**: NestJS AI service
  - Framework: NestJS + TypeScript
  - LLM Providers: OpenAI (GPT-4) + Anthropic (Claude)
  - Responsibilities: AI personas, conversation management, tool calling
  - Port: 3002

- **`/services/integration-service`**: NestJS integration service (scaffolded)
  - Framework: NestJS + TypeScript
  - Status: Scaffolded but not fully implemented (TODOs indicate Jira/GitHub/Slack integration pending)
  - Port: 3003

- **`/packages/types`**: Shared TypeScript types package
  - Exports: Type definitions shared across frontend/backend
  - Usage: Imported via `@okr-nexus/types` workspace reference

- **`/packages/utils`**: Shared utility functions
  - Exports: Common utilities (date formatting, validation, etc.)
  - Usage: Imported via `@okr-nexus/utils` workspace reference

- **`/keycloak`**: Keycloak configuration
  - Files: `realm-export.json`, `README.md`
  - Purpose: SSO/auth provider configuration (optional, dev uses local JWT)

- **`/docs`**: Architecture documentation
  - Files: `BACKEND_OVERVIEW.md`, `FRONTEND_OVERVIEW.md`, `DESIGN_SYSTEM.md`, `tenant-isolation.md`

- **`/scripts`**: Build and maintenance scripts
  - `todo-audit.js`: Scans for TODO/FIXME compliance
  - `check-phase-commit.ts`: Validates commit messages and TODO tags
  - `pre-merge-audit.js`: Pre-merge validation

- **Root Documentation Files**: Multiple markdown files documenting phases, migrations, security audits, etc.

### 2.2 How services talk to each other

**Frontend → Backend:**
- **Protocol**: REST API via HTTP/HTTPS
- **Gateway Pattern**: Frontend calls API Gateway (`http://localhost:3000/api/*`), which proxies to Core API
- **Authentication**: JWT token stored in `localStorage` (`access_token`), sent as `Authorization: Bearer <token>` header
- **API Client**: Axios instance in `apps/web/src/lib/api.ts` with interceptors for auth and error handling
- **Routes**: All API calls prefixed with `/api/*` (gateway rewrites to backend services)

**Backend Service Communication:**
- **Core API ↔ AI Service**: HTTP calls (AI service calls Core API for OKR context)
- **Core API ↔ Integration Service**: HTTP calls (integration service calls Core API for data sync)
- **API Gateway → Services**: Reverse proxy via `http-proxy-middleware` (no direct service-to-service calls through gateway)
- **Shared Database**: Core API and Integration Service both connect to PostgreSQL (only Core API writes, Integration Service reads)

**Service Discovery:**
- **Hardcoded URLs**: Services configured via environment variables (`CORE_API_URL`, `AI_SERVICE_URL`, etc.)
- **No Service Mesh**: Direct HTTP calls between services
- **Docker Network**: `okr-network` bridge network for container-to-container communication

### 2.3 Runtime / deployment assumptions

**Local Development:**
- **Pattern**: `npm run dev` runs all services concurrently via `concurrently` package
- **Database**: PostgreSQL 16 via Docker Compose (`postgres` service)
- **Cache**: Redis 7 via Docker Compose (`redis` service)
- **Auth**: Keycloak 23 via Docker Compose (`keycloak` service) - optional, can use local JWT
- **Ports**: 3000 (gateway), 3001 (core-api), 3002 (ai-service), 3003 (integration-service), 5173 (web), 5433 (postgres), 6379 (redis), 8080 (keycloak)

**Docker Support:**
- **docker-compose.yml**: Defines all services (postgres, redis, keycloak, core-api, ai-service, integration-service, api-gateway, web)
- **Dockerfiles**: Each service has its own Dockerfile (`services/*/Dockerfile`, `apps/web/Dockerfile`)
- **Volume Mounts**: Source code mounted for hot-reload in dev mode
- **Health Checks**: Postgres, Redis, and Keycloak have healthcheck configurations

**Production Assumptions:**
- **Kubernetes**: Not configured (no Helm charts, no k8s manifests)
- **Infrastructure as Code**: Not implemented (no Terraform, CloudFormation, etc.)
- **Deployment**: Manual Docker Compose deployment assumed, or manual container orchestration

**Environment Variables:**
- **Database**: `DATABASE_URL` (PostgreSQL connection string)
- **Redis**: `REDIS_URL` (Redis connection string)
- **Auth**: `JWT_SECRET`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`
- **AI**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_DEFAULT_PROVIDER`
- **Integration**: `JIRA_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` (scaffolded)
- **CORS**: `CORS_ORIGINS` (comma-separated list)
- **Rate Limiting**: `RATE_LIMIT_TTL`, `RATE_LIMIT_MAX`

### 2.4 External dependencies / platforms

**Databases:**
- **PostgreSQL 16**: Primary data store (via Prisma ORM)
  - Connection: `services/core-api/src/common/prisma/prisma.service.ts`
  - Migrations: Prisma migrations in `services/core-api/prisma/migrations/`
  - Schema: `services/core-api/prisma/schema.prisma`

- **Redis 7**: Caching layer (optional, used by RBAC cache service)
  - Connection: `services/core-api/src/common/redis/redis.service.ts`
  - Usage: RBAC user context caching (`services/core-api/src/modules/rbac/rbac-cache.service.ts`)

**Auth/Identity Providers:**
- **Keycloak 23**: SSO provider (optional, dev can use local JWT)
  - Configuration: `keycloak/realm-export.json`
  - Integration: `services/core-api/src/modules/auth/utils/jwks-verifier.ts`
  - JWKS Verification: RS256 token verification via JWKS endpoint

- **Local JWT**: Primary auth method (HS256 tokens signed with `JWT_SECRET`)
  - Implementation: `services/core-api/src/modules/auth/auth.service.ts`
  - Strategy: `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`

**3rd Party APIs / SDKs:**
- **OpenAI API**: GPT-4 Turbo for AI personas
  - Usage: `services/ai-service/src/adapters/openai.adapter.ts`
  - Model: `gpt-4-turbo-preview` (configurable via `OPENAI_MODEL`)

- **Anthropic API**: Claude 3 Sonnet for AI personas
  - Usage: `services/ai-service/src/adapters/anthropic.adapter.ts`
  - Model: `claude-3-sonnet-20240229` (configurable via `ANTHROPIC_MODEL`)

- **Jira Integration**: Scaffolded but not implemented
  - Placeholder: `services/integration-service/src/connectors/jira/jira.service.ts`
  - TODO: Implement Jira issue sync

- **GitHub Integration**: Scaffolded but not implemented
  - Placeholder: `services/integration-service/src/connectors/github/github.service.ts`
  - TODO: Implement GitHub API calls

- **Slack Integration**: Scaffolded but not implemented
  - Placeholder: `services/integration-service/src/connectors/slack/slack.service.ts`
  - TODO: Implement Slack API calls

**Critical Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection (required)
- `JWT_SECRET`: JWT signing secret (required, must be strong in production)
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: AI service requires at least one (required for AI features)
- `KEYCLOAK_CLIENT_SECRET`: Required if using Keycloak SSO
- `POSTGRES_USER`, `POSTGRES_PASSWORD`: Database credentials (docker-compose defaults)

**Secrets Management:**
- **No Secrets Manager**: Environment variables assumed to be injected via `.env` files or container environment
- **No Hardcoded Secrets**: Code checks indicate no hardcoded passwords/tokens found
- **⚠️ Risk**: `.env` files may be committed if not properly gitignored (need to verify `.gitignore`)

---

## 3. Domain Model & Core Concepts

### 3.1 Core business objects

**Organization (Tenant):**
- **What**: Top-level tenant/organization entity
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 17-34)
- **Key Fields**:
  - `id` (String, cuid)
  - `name` (String)
  - `slug` (String, unique)
  - `allowTenantAdminExecVisibility` (Boolean): Config flag for TENANT_ADMIN access to EXEC_ONLY OKRs
  - `execOnlyWhitelist` (Json): Array of user IDs allowed to view EXEC_ONLY OKRs
  - `metadata` (Json): Additional tenant configuration
- **Relationships**: Has many Workspaces, OrganizationMembers, Objectives, StrategicPillars, Cycles, CheckInRequests

**Workspace:**
- **What**: Sub-organization unit (e.g., department, division)
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 36-54)
- **Key Fields**:
  - `id` (String, cuid)
  - `name` (String)
  - `organizationId` (String, FK to Organization)
  - `parentWorkspaceId` (String?, FK to Workspace): Supports hierarchical workspaces
- **Relationships**: Belongs to Organization, has many Teams, WorkspaceMembers, Objectives, AIConversations

**Team:**
- **What**: Smallest organizational unit (e.g., engineering team, product team)
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 56-68)
- **Key Fields**:
  - `id` (String, cuid)
  - `name` (String)
  - `workspaceId` (String, FK to Workspace)
- **Relationships**: Belongs to Workspace, has many TeamMembers, Objectives

**User:**
- **What**: System user account
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 70-101)
- **Key Fields**:
  - `id` (String, cuid)
  - `email` (String, unique)
  - `keycloakId` (String?, unique): SSO provider ID
  - `name` (String)
  - `passwordHash` (String?): bcrypt hash (null if SSO-only)
  - `isSuperuser` (Boolean): Platform-level superuser flag
  - `managerId` (String?, FK to User): Manager relationship for MANAGER_CHAIN visibility
- **Relationships**: Has many directReports (manager chain), TeamMembers, WorkspaceMembers, OrganizationMembers, RoleAssignments, Objectives (as owner), CheckInRequests (as requester/target), CheckInResponses

**Objective (OKR):**
- **What**: High-level objective with associated key results
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 232-275)
- **Key Fields**:
  - `id` (String, cuid)
  - `title` (String)
  - `description` (String?, Text)
  - `organizationId` (String?, FK to Organization): For org-level OKRs
  - `workspaceId` (String?, FK to Workspace): For workspace-level OKRs
  - `teamId` (String?, FK to Team): For team-level OKRs
  - `pillarId` (String?, FK to StrategicPillar): Optional strategic pillar alignment
  - `cycleId` (String?, FK to Cycle): Optional cycle/quarter assignment
  - `ownerId` (String, FK to User): Always has an owner
  - `parentId` (String?, FK to Objective): Supports OKR hierarchies/cascading
  - `period` (Period enum): MONTHLY, QUARTERLY, ANNUAL, CUSTOM
  - `startDate`, `endDate` (DateTime)
  - `status` (OKRStatus enum): ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED, CANCELLED
  - `progress` (Float): Calculated from key results
  - `visibilityLevel` (VisibilityLevel enum): PUBLIC_TENANT, PRIVATE, deprecated levels
  - `isPublished` (Boolean): Governance lock flag
  - `positionX`, `positionY` (Float?): Visual builder coordinates
- **Relationships**: Belongs to Organization/Workspace/Team, has many KeyResults (via ObjectiveKeyResult junction), Initiatives, Children (hierarchical), owned by User

**KeyResult:**
- **What**: Measurable outcome tied to an objective
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 277-307)
- **Key Fields**:
  - `id` (String, cuid)
  - `title` (String)
  - `description` (String?, Text)
  - `ownerId` (String, FK to User)
  - `metricType` (MetricType enum): INCREASE, DECREASE, REACH, MAINTAIN
  - `startValue`, `targetValue`, `currentValue` (Float)
  - `unit` (String?)
  - `status` (OKRStatus enum)
  - `progress` (Float)
  - `visibilityLevel` (VisibilityLevel enum)
  - `isPublished` (Boolean)
  - `checkInCadence` (CheckInCadence enum?): WEEKLY, BIWEEKLY, MONTHLY, NONE
  - `period`, `startDate`, `endDate` (optional)
  - `positionX`, `positionY` (Float?): Visual builder coordinates
- **Relationships**: Many-to-many with Objectives (via ObjectiveKeyResult), has many CheckIns, KRIntegrations

**StrategicPillar:**
- **What**: High-level strategic bet/theme that OKRs align to
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 187-200)
- **Key Fields**:
  - `id` (String, cuid)
  - `organizationId` (String, FK to Organization): Tenant-scoped
  - `name` (String)
  - `description` (String?, Text)
  - `color` (String?): Hex color for badge/visual representation
- **Relationships**: Belongs to Organization, has many Objectives

**Cycle:**
- **What**: OKR period/quarter (e.g., "Q1 2025")
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 208-223)
- **Key Fields**:
  - `id` (String, cuid)
  - `organizationId` (String, FK to Organization): Tenant-scoped
  - `name` (String): e.g., "Q1 2025"
  - `status` (CycleStatus enum): DRAFT, ACTIVE, LOCKED, ARCHIVED
  - `startDate`, `endDate` (DateTime)
- **Relationships**: Belongs to Organization, has many Objectives
- **⚠️ TODO**: Admin endpoint to update cycle.status not implemented (line 206 in schema.prisma)

**CheckInRequest:**
- **What**: Async check-in request from manager to contributor
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 508-528)
- **Key Fields**:
  - `id` (String, cuid)
  - `requesterUserId` (String, FK to User): Manager who requested
  - `targetUserId` (String, FK to User): User who needs to submit
  - `organizationId` (String, FK to Organization): Tenant scoping
  - `dueAt` (DateTime): Deadline
  - `status` (CheckInRequestStatus enum): OPEN, SUBMITTED, LATE, CANCELLED
- **Relationships**: Belongs to Organization, requester User, target User, has one CheckInResponse
- **⚠️ TODO**: RBAC checks for manager permissions not implemented (line 15 in checkin-request.service.ts)

**CheckInResponse:**
- **What**: Response to a check-in request
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 537-553)
- **Key Fields**:
  - `id` (String, cuid)
  - `requestId` (String, unique, FK to CheckInRequest)
  - `targetUserId` (String, FK to User)
  - `summaryWhatMoved` (String?, Text): "What moved?"
  - `summaryBlocked` (String?, Text): "What's blocked?"
  - `summaryNeedHelp` (String?, Text): "What do you need?"
  - `submittedAt` (DateTime)
- **Relationships**: Belongs to CheckInRequest, target User

**RoleAssignment (RBAC):**
- **What**: Role assignment at a specific scope (platform/tenant/workspace/team)
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 401-416)
- **Key Fields**:
  - `id` (String, cuid)
  - `userId` (String, FK to User)
  - `role` (RBACRole enum): SUPERUSER, TENANT_OWNER, TENANT_ADMIN, TENANT_VIEWER, WORKSPACE_LEAD, WORKSPACE_ADMIN, WORKSPACE_MEMBER, TEAM_LEAD, TEAM_CONTRIBUTOR, TEAM_VIEWER
  - `scopeType` (ScopeType enum): PLATFORM, TENANT, WORKSPACE, TEAM
  - `scopeId` (String?): null for PLATFORM, required for others
- **Relationships**: Belongs to User
- **Unique Constraint**: `userId_role_scopeType_scopeId` prevents duplicate assignments

**AuditLog:**
- **What**: Audit trail for permission-critical actions
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 449-472)
- **Key Fields**:
  - `id` (String, cuid)
  - `actorUserId` (String, FK to User): Who performed the action
  - `action` (String): e.g., 'GRANT_ROLE', 'PUBLISH_OKR', 'IMPERSONATE_USER'
  - `targetType` (AuditTargetType enum): USER, ROLE_ASSIGNMENT, OKR, WORKSPACE, TEAM, TENANT, VISIBILITY_CHANGE
  - `targetId` (String): ID of target entity
  - `previousRole`, `newRole` (RBACRole?): For role changes
  - `impersonatedUserId` (String?, FK to User): For impersonation actions
  - `metadata` (Json?): Additional context
  - `timestamp` (DateTime)
- **Relationships**: Belongs to actor User, optional impersonated User

**PermissionAudit:**
- **What**: Dedicated audit log for permission changes (GRANT_ROLE, REVOKE_ROLE, CHANGE_ROLE)
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 160-178)
- **Key Fields**:
  - `id` (String, cuid)
  - `userId` (String, FK to User): User whose permissions changed
  - `action` (String): "GRANT_ROLE", "REVOKE_ROLE", "CHANGE_ROLE"
  - `entityType` (String): "ORGANIZATION", "WORKSPACE", "TEAM"
  - `entityId` (String)
  - `previousRole`, `newRole` (MemberRole?): Legacy role enum
  - `performedBy` (String, FK to User): Who made the change
  - `metadata` (Json?)
  - `createdAt` (DateTime)
- **Relationships**: Belongs to User (whose permissions changed), performedBy User
- **⚠️ Note**: Uses legacy `MemberRole` enum, may need migration to `RBACRole`

**AIConversation:**
- **What**: AI chat conversation with a persona
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 589-603)
- **Key Fields**:
  - `id` (String, cuid)
  - `userId` (String, FK to User)
  - `workspaceId` (String, FK to Workspace)
  - `persona` (AIPersona enum): OKR_COACH, CASCADE_ASSISTANT, PROGRESS_ANALYST
  - `context` (Json?): Additional context for AI
- **Relationships**: Belongs to User, Workspace, has many AIMessages

**KRIntegration:**
- **What**: Integration between Key Result and external system (Jira, GitHub, etc.)
- **Defined**: `services/core-api/prisma/schema.prisma` (lines 628-641)
- **Key Fields**:
  - `id` (String, cuid)
  - `keyResultId` (String, FK to KeyResult)
  - `source` (IntegrationSource enum): JIRA, GITHUB, SALESFORCE, CUSTOM_WEBHOOK
  - `externalId` (String): External system ID
  - `config` (Json): Integration configuration
  - `lastSync` (DateTime?)
- **Relationships**: Belongs to KeyResult

### 3.2 Relationships

**Hierarchical Structure:**
- **Organization → Workspaces** (one-to-many): An organization has many workspaces
- **Workspace → Teams** (one-to-many): A workspace has many teams
- **Workspace → Workspaces** (self-referential, hierarchical): Workspaces can have parent workspaces
- **Objective → Objectives** (self-referential, hierarchical): Objectives can have parent objectives (cascading OKRs)

**OKR Scoping:**
- **Objective** can belong to: Organization (org-level), Workspace (workspace-level), or Team (team-level)
- **KeyResult** belongs to Objectives via many-to-many junction (`ObjectiveKeyResult`)
- **Initiative** can belong to Objective or KeyResult (optional)

**User Membership:**
- **User → OrganizationMembers** (many-to-many): User can belong to multiple organizations
- **User → WorkspaceMembers** (many-to-many): User can belong to multiple workspaces
- **User → TeamMembers** (many-to-many): User can belong to multiple teams
- **⚠️ Current Limitation**: JWT strategy only uses first org membership (TODO at line 107 in jwt.strategy.ts)

**RBAC:**
- **User → RoleAssignments** (one-to-many): User can have multiple role assignments at different scopes
- **RoleAssignment** scoped to: PLATFORM (no scopeId), TENANT (organizationId), WORKSPACE (workspaceId), TEAM (teamId)

**OKR Ownership:**
- **Objective.ownerId → User**: Every objective has an owner
- **KeyResult.ownerId → User**: Every key result has an owner
- **Initiative.ownerId → User**: Every initiative has an owner

**Manager Chain:**
- **User.managerId → User**: Manager relationship for MANAGER_CHAIN visibility (deprecated but still in schema)

**Activity & Audit:**
- **Activity** tracks changes to Objectives, KeyResults, Initiatives, CheckIns
- **AuditLog** tracks permission-critical actions (role changes, impersonation, OKR publishes)
- **PermissionAudit** tracks legacy permission changes (may need migration to AuditLog)

### 3.3 RBAC / permissions model

**Roles by Scope:**

**Platform Level:**
- **SUPERUSER**: System-wide read-only auditor
  - **Allowed**: View all tenants/workspaces/teams/OKRs, impersonate users, export data, manage users/workspaces/teams/tenant settings
  - **NOT Allowed**: Create/edit/delete OKRs, manage billing

**Tenant Level (Organization):**
- **TENANT_OWNER**: Full control over organization
  - **Allowed**: All tenant operations, bypass publish/cycle locks, manage users/workspaces/teams, export data, manage tenant settings
- **TENANT_ADMIN**: Administrative control within organization
  - **Allowed**: Similar to TENANT_OWNER (can bypass locks, manage users/workspaces), export data
  - **⚠️ Note**: `allowTenantAdminExecVisibility` flag controls access to EXEC_ONLY OKRs (deprecated visibility level)
- **TENANT_VIEWER**: Read-only access
  - **Allowed**: View organization OKRs (subject to visibility rules)

**Workspace Level:**
- **WORKSPACE_LEAD**: Primary owner of workspace OKRs
  - **Allowed**: Create/edit/delete workspace-level OKRs, view workspace OKRs
- **WORKSPACE_ADMIN**: Administrative control within workspace
  - **Allowed**: Manage workspace members, create/edit workspace OKRs
- **WORKSPACE_MEMBER**: Contributor access
  - **Allowed**: View workspace OKRs, contribute to OKRs

**Team Level:**
- **TEAM_LEAD**: Owner of team OKRs
  - **Allowed**: Create/edit/delete team-level OKRs, view team OKRs
- **TEAM_CONTRIBUTOR**: Contributor access
  - **Allowed**: Update key results, submit check-ins, view team OKRs
- **TEAM_VIEWER**: Read-only access
  - **Allowed**: View team OKRs (subject to visibility rules)

**Permission Enforcement:**

**Backend Enforcement:**
- **RBACGuard**: Applied to all protected routes (`@UseGuards(JwtAuthGuard, RBACGuard)`)
- **@RequireAction()**: Decorator specifies required action (e.g., `@RequireAction('edit_okr')`)
- **RBACService.canPerformAction()**: Core authorization logic in `services/core-api/src/modules/rbac/rbac.service.ts`
- **OkrTenantGuard**: Tenant isolation enforcement (read/write boundaries)
- **OkrGovernanceService**: Publish lock and cycle lock enforcement

**Frontend Enforcement:**
- **useTenantPermissions()**: Hook combines RBAC checks with governance rules
- **Permission-aware UI**: Buttons/actions conditionally rendered based on `canEditObjective()`, `canDeleteObjective()`, etc.
- **⚠️ Gap**: Frontend visibility checks not fully aligned with backend (TODOs in `useTenantPermissions.ts`)

**Visibility Levels:**
- **PUBLIC_TENANT**: Default, visible to all users in tenant (filtered in UI, not blocked by backend)
- **PRIVATE**: Only owner + explicit whitelist (TENANT_OWNER, or users in `execOnlyWhitelist`/`privateWhitelist`)
- **Deprecated Levels**: WORKSPACE_ONLY, TEAM_ONLY, MANAGER_CHAIN, EXEC_ONLY (kept for backward compatibility, treated as PUBLIC_TENANT)

**Missing / Inconsistent:**

1. **Check-in Request RBAC**: Manager permission checks not implemented (TODO at line 15 in checkin-request.service.ts)
2. **Visibility Policy Alignment**: Frontend visibility checks don't fully mirror backend (TODOs in useTenantPermissions.ts lines 105-124)
3. **Multi-org User Support**: JWT strategy only uses first org membership (TODO at line 107 in jwt.strategy.ts)
4. **Legacy Permission Tables**: `TeamMember`, `WorkspaceMember`, `OrganizationMember` still use `MemberRole` enum, but RBAC uses `RoleAssignment` with `RBACRole` enum
5. **Audit Logging**: RBAC changes not always logged to AuditLog (TODOs in rbac.service.ts lines 323, 351)

---

## 4. Frontend Application

### 4.1 Tech stack

**Framework:**
- **Next.js 14**: App Router architecture (`apps/web/src/app/`)
- **React 18**: Component library
- **TypeScript**: Type safety (some loose typing with `Record<string, unknown>`)

**State Management:**
- **React Context**: Auth (`contexts/auth.context.tsx`), Workspace (`contexts/workspace.context.tsx`)
- **Zustand**: Some stores (`store/auth.store.ts`)
- **Local State**: `useState`/`useEffect` in components (not using React Query/SWR yet)

**Styling:**
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library (Radix UI primitives)
- **Design Tokens**: Standardized spacing, colors, typography (Phase 9 design system)

**Component Library:**
- **Radix UI**: Accessible primitives (Dialog, Dropdown, Select, Tabs, Toast, Tooltip)
- **Framer Motion**: Animations (used in some components)
- **ReactFlow**: Visual builder graph visualization
- **Dagre**: Graph layout algorithm for visual builder

**API Client:**
- **Axios**: HTTP client with interceptors (`lib/api.ts`)
- **Base URL**: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'`
- **Auth**: JWT token added via interceptor from `localStorage.access_token`

### 4.2 Key routes / pages / views

**Public Routes:**
- **`/`**: Landing page (redirects to dashboard if authenticated)
- **`/login`**: Login page (`apps/web/src/app/login/page.tsx`)
- **`/register`**: Registration page (`apps/web/src/app/register/page.tsx`)

**Protected Routes (Dashboard):**
- **`/dashboard`**: Main dashboard (`apps/web/src/app/dashboard/page.tsx`)
  - **Data**: User's OKRs, at-risk items, recent activity
  - **Access**: All authenticated users

- **`/dashboard/okrs`**: OKRs list/view (`apps/web/src/app/dashboard/okrs/page.tsx`)
  - **Data**: All OKRs for user's organization (filtered by workspace/team/owner/period)
  - **Access**: All authenticated users (filtered by tenant isolation)
  - **Features**: Grid/list view, filter, create/edit/delete OKRs, activity drawer

- **`/dashboard/builder`**: Visual OKR builder (`apps/web/src/app/dashboard/builder/page.tsx`)
  - **Data**: OKRs loaded into ReactFlow graph
  - **Access**: All authenticated users (⚠️ TODO: should be restricted to admin/strategy roles - line 929)
  - **Features**: Drag-and-drop nodes, connect OKRs, form-based editing

- **`/dashboard/analytics`**: Analytics dashboard (`apps/web/src/app/dashboard/analytics/page.tsx`)
  - **Data**: KPI stats, strategic coverage, execution risk, recent activity
  - **Access**: All authenticated users (export restricted to `export_data` permission)
  - **Features**: CSV export, strategic pillar coverage, overdue check-ins

- **`/dashboard/checkins`**: Check-in management (`apps/web/src/app/dashboard/checkins/page.tsx`)
  - **Data**: Check-in requests (as requester or target), rollup view
  - **Access**: All authenticated users (⚠️ TODO: Meeting Mode should be restricted to managers - line 459)
  - **Features**: Create check-in requests, submit responses, rollup view, meeting mode

- **`/dashboard/me`**: My OKRs (`apps/web/src/app/dashboard/me/page.tsx`)
  - **Data**: User's owned OKRs and key results
  - **Access**: All authenticated users
  - **Features**: Check-in submission, overdue tracking

- **`/dashboard/ai`**: AI assistant (`apps/web/src/app/dashboard/ai/page.tsx`)
  - **Data**: AI conversations, persona selection
  - **Access**: All authenticated users
  - **Features**: Chat with OKR Coach, Cascade Assistant, Progress Analyst

**Settings Routes:**
- **`/dashboard/settings/organization`**: Organization settings (`apps/web/src/app/dashboard/settings/organization/page.tsx`)
- **`/dashboard/settings/workspaces`**: Workspace management (`apps/web/src/app/dashboard/settings/workspaces/page.tsx`)
- **`/dashboard/settings/teams`**: Team management (`apps/web/src/app/dashboard/settings/teams/page.tsx`)
- **`/dashboard/settings/people`**: User management (`apps/web/src/app/dashboard/settings/people/page.tsx`)

### 4.3 Notable UI flows implemented

**OKR Creation Flow:**
- **Location**: `apps/web/src/app/dashboard/okrs/page.tsx` (lines 1400-1450)
- **Steps**: Click "New Objective" → Modal opens → Fill form → Submit → OKR created
- **Components**: `NewObjectiveModal` (`components/okr/NewObjectiveModal.tsx`)
- **⚠️ TODO**: Field-level error handling not implemented (line 1439)

**Check-in Submission Flow:**
- **Location**: `apps/web/src/app/dashboard/me/page.tsx` (lines 150-250)
- **Steps**: View owned KRs → Click check-in → Fill form (value, confidence, note, blockers) → Submit
- **Components**: `NewCheckInModal` (`components/okr/NewCheckInModal.tsx`)
- **⚠️ TODO**: Fade-out animation after submit not implemented (line 185)

**Visual Builder Flow:**
- **Location**: `apps/web/src/app/dashboard/builder/page.tsx`
- **Steps**: Load OKRs → Render as nodes → Drag to position → Click node → Edit panel opens → Edit → Save
- **Components**: `EnhancedNodes`, `EditPanel`, `EditFormTabs`
- **Auto-save**: `hooks/useAutoSave.ts` saves positions automatically
- **⚠️ TODO**: Confirm modal before destructive actions not implemented (line 56 in EditPanel.tsx)

**Check-in Request Flow:**
- **Location**: `apps/web/src/app/dashboard/checkins/page.tsx` (lines 100-200)
- **Steps**: Click "Request Update" → Select target user → Set due date → Submit → Request created
- **Components**: `NewAsyncUpdateModal` (`components/okr/NewAsyncUpdateModal.tsx`)
- **⚠️ TODO**: Manager validation not implemented (backend TODO at checkin-request.service.ts:49)

### 4.4 Known frontend problems

**TypeScript Errors:**
- **None Found**: Frontend TypeScript build passes (only backend has 2 unused variable errors)

**Prop Drilling:**
- **OKRs Page**: Large component (1682 lines) with many props passed down (lines 50-200)
- **Builder Components**: Some prop drilling in `EditFormTabs` and `EditPanel`

**Missing Null Checks:**
- **Workspace Context**: `currentOrganization` may be null but not always checked (assumed to exist)
- **User Context**: `user` may be null during loading but some components don't check

**TODO Comments:**
- **200+ TODOs**: See section 9 for full list
- **Critical**: RBAC gaps, validation error mapping, visibility alignment

**Dead Components:**
- **None Identified**: All components appear to be used

**Hard-coded IDs:**
- **None Found**: No hard-coded user/org/workspace IDs

**State Management Issues:**
- **Large Components**: `okrs/page.tsx` is 1682 lines - needs refactoring (TODO at line 124)
- **Multiple useState**: Many useState hooks - should use reducer (TODO at line 124)
- **No Caching**: API calls not cached - should use SWR/React Query (TODO at line 75)

**Performance Issues:**
- **No Virtualization**: OKR list not virtualized - will be slow with 50+ items (TODO at line 617)
- **No Pagination**: All OKRs loaded at once - will fail with large datasets (TODO at line 1361)

---

## 5. Backend / API Layer

### 5.1 Tech stack & structure

**Framework:**
- **NestJS 10**: Modular architecture with dependency injection
- **Express**: HTTP server (via NestJS platform-express)
- **TypeScript**: Type safety

**Module Organization:**
- **Domain Modules**: Each domain has its own module (auth, user, organization, workspace, team, okr, rbac, etc.)
- **Common Modules**: Shared infrastructure (prisma, redis)
- **Guards**: Authentication (`JwtAuthGuard`), Authorization (`RBACGuard`), Tenant Isolation (`TenantIsolationGuard` - deprecated)

**Routing:**
- **Controller-Based**: Each module has a controller (`*.controller.ts`)
- **Service Layer**: Business logic in services (`*.service.ts`)
- **DTOs**: Not consistently used (some endpoints use `any` types)

### 5.2 Important services / modules

**ObjectiveService** (`services/core-api/src/modules/okr/objective.service.ts`):
- **Purpose**: CRUD operations for objectives, tenant isolation, visibility checks
- **Key Methods**:
  - `findAll()`: List objectives with tenant filtering
  - `findById()`: Get single objective
  - `create()`: Create new objective
  - `update()`: Update objective (checks governance locks)
  - `delete()`: Delete objective (checks governance locks)
  - `canView()`, `canEdit()`, `canDelete()`: Permission checks
- **Frontend Usage**: Called by `/dashboard/okrs` page, `/dashboard/builder` page

**KeyResultService** (`services/core-api/src/modules/okr/key-result.service.ts`):
- **Purpose**: CRUD operations for key results, check-ins, progress tracking
- **Key Methods**:
  - `create()`, `update()`, `delete()`: CRUD operations
  - `createCheckIn()`: Submit check-in for key result
  - `canEditKeyResult()`, `canDeleteKeyResult()`: Permission checks (⚠️ placeholders)
- **Frontend Usage**: Called by OKR forms, check-in modals

**OkrGovernanceService** (`services/core-api/src/modules/okr/okr-governance.service.ts`):
- **Purpose**: Centralized publish lock and cycle lock enforcement
- **Key Methods**:
  - `checkPublishLockForObjective()`: Prevents editing published OKRs
  - `checkCycleLockForObjective()`: Prevents editing OKRs in locked cycles
  - `checkAllLocksForObjective()`: Convenience method
- **Frontend Usage**: Mirrored in `useTenantPermissions()` hook

**OkrReportingService** (`services/core-api/src/modules/okr/okr-reporting.service.ts`):
- **Purpose**: Analytics, summaries, pillar coverage, export functionality
- **Key Methods**:
  - `getOrgSummary()`: KPI stats (total objectives, % on track, % at risk, overdue check-ins)
  - `getPillarCoverageForActiveCycle()`: Strategic pillar coverage
  - `exportObjectivesCSV()`: CSV export
  - `getOverdueCheckIns()`: Overdue check-in tracking
- **Frontend Usage**: Called by `/dashboard/analytics` page

**CheckInRequestService** (`services/core-api/src/modules/okr/checkin-request.service.ts`):
- **Purpose**: Async check-in request/response management
- **Key Methods**:
  - `createRequest()`: Create check-in request (⚠️ no manager validation)
  - `submitResponse()`: Submit check-in response
  - `getMyRequests()`: Get requests for current user
  - `getRollup()`: Manager rollup view
  - `markLateRequests()`: Auto-mark overdue requests (⚠️ not scheduled)
- **Frontend Usage**: Called by `/dashboard/checkins` page

**RBACService** (`services/core-api/src/modules/rbac/rbac.service.ts`):
- **Purpose**: Role-based access control, permission checks
- **Key Methods**:
  - `buildUserContext()`: Load user's role assignments
  - `canPerformAction()`: Check if user can perform action
  - `assignRole()`, `revokeRole()`: Manage role assignments (⚠️ audit logging TODO)
- **Frontend Usage**: Called by `usePermissions()` hook

**AuthService** (`services/core-api/src/modules/auth/auth.service.ts`):
- **Purpose**: Authentication, token validation
- **Key Methods**:
  - `register()`: Create new user account
  - `login()`: Authenticate user, return JWT
  - `verifyKeycloakToken()`: Verify SSO token
  - `validateUser()`: Validate user from token
- **Frontend Usage**: Called by login/register pages

### 5.3 Validation, business rules, lifecycle logic

**Governance Rules:**
- **Publish Lock**: When `objective.isPublished === true`, only TENANT_OWNER/TENANT_ADMIN can edit/delete
- **Cycle Lock**: When `cycle.status === 'LOCKED'` or `'ARCHIVED'`, only admins can edit/delete
- **Enforcement**: `OkrGovernanceService` checks locks before mutations
- **Location**: `services/core-api/src/modules/okr/okr-governance.service.ts`

**Progress Calculation:**
- **Automatic**: Progress calculated from key results (weighted average)
- **Service**: `OkrProgressService` (`services/core-api/src/modules/okr/okr-progress.service.ts`)
- **⚠️ TODO**: Weighting support not implemented (line 10)

**Check-in Request Lifecycle:**
- **Status Transitions**: OPEN → SUBMITTED (when response submitted), OPEN → LATE (when due date passes)
- **Auto-marking**: `markLateRequests()` method exists but not scheduled (TODO)
- **Location**: `services/core-api/src/modules/okr/checkin-request.service.ts`

**Tenant Isolation:**
- **Read**: Filtered by `organizationId` in Prisma queries
- **Write**: Verified via `OkrTenantGuard.assertSameTenant()`
- **Superuser**: Read-only access (can read all, cannot write)
- **Location**: `services/core-api/src/modules/okr/tenant-guard.ts`

### 5.4 Auth & access control enforcement

**Authentication:**
- **JwtAuthGuard**: Applied globally to protected routes
- **Token Validation**: `jwt.strategy.ts` validates token and builds `req.user`
- **Location**: `services/core-api/src/modules/auth/guards/jwt-auth.guard.ts`

**Authorization:**
- **RBACGuard**: Applied to all protected routes (`@UseGuards(JwtAuthGuard, RBACGuard)`)
- **@RequireAction()**: Decorator specifies required action
- **Enforcement**: `RBACService.canPerformAction()` checks permissions
- **Location**: `services/core-api/src/modules/rbac/rbac.guard.ts`

**Tenant Isolation:**
- **Read**: `OkrTenantGuard.buildTenantWhereClause()` filters queries
- **Write**: `OkrTenantGuard.assertSameTenant()` verifies org match
- **Superuser**: `OkrTenantGuard.assertCanMutateTenant()` rejects superuser writes
- **Location**: `services/core-api/src/modules/okr/tenant-guard.ts`

**Missing Checks:**
- **Check-in Requests**: Manager validation not implemented (`checkin-request.service.ts:49`)
- **Some Endpoints**: Not all endpoints have `@RequireAction()` decorators

### 5.5 Error handling & logging

**Error Handling:**
- **Custom Exceptions**: NestJS exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`)
- **Validation**: Class-validator DTOs (not consistently used)
- **Global Handler**: NestJS exception filter (default)

**Logging:**
- **Console.log**: Used throughout codebase (not centralized)
- **Logger Service**: NestJS Logger used in some modules
- **⚠️ Gap**: No centralized logging/monitoring (no DataDog/CloudWatch)

**Error Responses:**
- **Standard Format**: NestJS default error responses
- **Field-level Errors**: Not implemented (TODO in frontend)

### 5.6 Known backend problems

**TODOs:**
- **200+ TODOs**: See section 9 for full list
- **Critical**: RBAC gaps, audit logging, performance optimization

**Commented-out Logic:**
- **None Found**: No commented-out code blocks identified

**Obvious Bugs:**
- **Double Proxy Route**: `/api/reports` proxied twice in API Gateway (`api-gateway/src/index.ts:162,204`)
- **TypeScript Errors**: 2 unused variable errors (`check-phase-commit.ts:13,62`)

**Scale Issues:**
- **No Pagination**: OKR list endpoints return all results
- **N+1 Queries**: Objective queries include many relations
- **JS Filtering**: Reporting queries fetch all data then filter in JS (TODO at okr-reporting.service.ts:694)

**Missing Indexes:**
- **Schema Reviewed**: Prisma schema has indexes on foreign keys and commonly queried fields
- **May Need**: Indexes on `organizationId` + `status` for filtered queries

**Blocking Calls:**
- **markLateRequests()**: May block if called synchronously (should be background job)

---

## 6. Database & Persistence

### 6.1 Which databases are in use

**PostgreSQL 16:**
- **Primary Database**: All application data stored in PostgreSQL
- **Connection**: `services/core-api/src/common/prisma/prisma.service.ts`
- **Connection String**: `DATABASE_URL` environment variable
- **Docker**: PostgreSQL 16 Alpine image in docker-compose.yml

**Redis 7:**
- **Caching Layer**: Optional caching for RBAC user context
- **Connection**: `services/core-api/src/common/redis/redis.service.ts`
- **Connection String**: `REDIS_URL` environment variable
- **Docker**: Redis 7 Alpine image in docker-compose.yml
- **Usage**: RBAC cache service (`services/core-api/src/modules/rbac/rbac-cache.service.ts`)

### 6.2 ORM / query layer

**Prisma ORM:**
- **ORM**: Prisma 5.8.1 used for database access
- **Schema**: `services/core-api/prisma/schema.prisma`
- **Client**: Generated Prisma Client imported in services
- **Migrations**: Prisma migrations in `services/core-api/prisma/migrations/`

**Query Pattern:**
- **Type-safe**: Prisma provides type-safe queries
- **Relations**: Eager loading via `include` option
- **Raw SQL**: Not used (all queries via Prisma)

### 6.3 Schema summary

**Core Tables:**

**organizations** (Organization):
- Columns: `id`, `name`, `slug` (unique), `allowTenantAdminExecVisibility`, `execOnlyWhitelist` (json), `metadata` (json), `createdAt`, `updatedAt`
- Relationships: Has many workspaces, organization_members, objectives, strategic_pillars, cycles, check_in_requests

**workspaces** (Workspace):
- Columns: `id`, `name`, `organizationId` (FK), `parentWorkspaceId` (FK, nullable), `createdAt`, `updatedAt`
- Relationships: Belongs to organization, has many teams, workspace_members, objectives
- Indexes: `organizationId`, `parentWorkspaceId`

**teams** (Team):
- Columns: `id`, `name`, `workspaceId` (FK), `createdAt`, `updatedAt`
- Relationships: Belongs to workspace, has many team_members, objectives
- Indexes: `workspaceId`

**users** (User):
- Columns: `id`, `email` (unique), `keycloakId` (unique, nullable), `name`, `passwordHash` (nullable), `isSuperuser`, `managerId` (FK, nullable), `createdAt`, `updatedAt`
- Relationships: Has many direct_reports (manager chain), team_members, workspace_members, organization_members, role_assignments, objectives (as owner)
- Indexes: `email`, `keycloakId`, `isSuperuser`, `managerId`

**objectives** (Objective):
- Columns: `id`, `title`, `description` (text), `organizationId` (FK, nullable), `workspaceId` (FK, nullable), `teamId` (FK, nullable), `pillarId` (FK, nullable), `cycleId` (FK, nullable), `ownerId` (FK), `parentId` (FK, nullable), `period` (enum), `startDate`, `endDate`, `status` (enum), `progress` (float), `visibilityLevel` (enum), `isPublished` (boolean), `positionX`, `positionY` (nullable), `createdAt`, `updatedAt`
- Relationships: Belongs to organization/workspace/team, has many key_results (via junction), initiatives, children (hierarchical)
- Indexes: `organizationId`, `workspaceId`, `teamId`, `ownerId`, `parentId`, `pillarId`, `cycleId`, `visibilityLevel`, `isPublished`

**key_results** (KeyResult):
- Columns: `id`, `title`, `description` (text), `ownerId` (FK), `metricType` (enum), `startValue`, `targetValue`, `currentValue` (float), `unit`, `status` (enum), `progress` (float), `visibilityLevel` (enum), `isPublished` (boolean), `checkInCadence` (enum, nullable), `period` (enum, nullable), `startDate`, `endDate` (nullable), `positionX`, `positionY` (nullable), `createdAt`, `updatedAt`
- Relationships: Many-to-many with objectives (via objective_key_results), has many check_ins, kr_integrations
- Indexes: `ownerId`, `visibilityLevel`, `isPublished`

**objective_key_results** (ObjectiveKeyResult - Junction):
- Columns: `id`, `objectiveId` (FK), `keyResultId` (FK), `createdAt`
- Relationships: Links objectives and key results
- Unique: `objectiveId` + `keyResultId`

**role_assignments** (RoleAssignment - RBAC):
- Columns: `id`, `userId` (FK), `role` (enum), `scopeType` (enum), `scopeId` (nullable), `createdAt`, `updatedAt`
- Relationships: Belongs to user
- Unique: `userId` + `role` + `scopeType` + `scopeId`
- Indexes: `userId`, `scopeType` + `scopeId`, `role`

**check_in_requests** (CheckInRequest):
- Columns: `id`, `requesterUserId` (FK), `targetUserId` (FK), `organizationId` (FK), `dueAt`, `status` (enum), `createdAt`, `updatedAt`
- Relationships: Belongs to organization, requester user, target user, has one check_in_response
- Indexes: `requesterUserId`, `targetUserId`, `organizationId`, `status`, `dueAt`

**audit_logs** (AuditLog):
- Columns: `id`, `actorUserId` (FK), `action`, `targetType` (enum), `targetId`, `timestamp`, `metadata` (json), `previousRole`, `newRole` (enum, nullable), `impersonatedUserId` (FK, nullable)
- Relationships: Belongs to actor user, optional impersonated user
- Indexes: `actorUserId`, `targetType` + `targetId`, `action`, `timestamp`

**Legacy Tables (Deprecated):**
- **team_members**: Uses `MemberRole` enum (deprecated in favor of `role_assignments`)
- **workspace_members**: Uses `MemberRole` enum (deprecated)
- **organization_members**: Uses `MemberRole` enum (deprecated)

### 6.4 Migrations

**Migration System:**
- **Prisma Migrate**: Used for database migrations
- **Location**: `services/core-api/prisma/migrations/`
- **Commands**: `npx prisma migrate dev`, `npx prisma migrate deploy`

**Pending Migrations:**
- **None Found**: No unapplied migrations identified

**Migration History:**
- **Baseline Migration**: `20251102100826_baseline/migration.sql` (large baseline migration)
- **Backup**: `prisma/_migrations_backup/` contains backup of baseline

### 6.5 Data quality / tenancy boundaries

**Tenant Isolation:**
- **Organization Scoping**: All tenant-scoped resources have `organizationId` column
- **Enforcement**: `OkrTenantGuard.buildTenantWhereClause()` ensures queries are filtered
- **Superuser**: `organizationId === null` bypasses filters (read-only)

**Optional organizationId:**
- **Objectives**: `organizationId` is nullable (allows org/workspace/team-level OKRs)
- **⚠️ Risk**: OKRs with no `organizationId` may be accessible to all tenants (ensure intentional)

**Foreign Key Constraints:**
- **Cascade Deletes**: Most relationships use `onDelete: Cascade` (deleting org deletes workspaces)
- **Set Null**: Some relationships use `onDelete: SetNull` (deleting team sets `teamId` to null)

**Data Integrity:**
- **Unique Constraints**: Email unique, slug unique, role assignment unique combinations
- **Required Fields**: Most critical fields are required (no nullable unless intentional)

---

[Report continues with sections 7-11 as previously appended...]
