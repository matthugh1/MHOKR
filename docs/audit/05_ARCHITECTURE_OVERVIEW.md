# Architecture & Boundaries Overview

**Date**: 2025-01-20  
**Auditor**: Automated Audit  
**Status**: Complete

---

## Architecture Overview

### System Diagram (Text Description)

```
┌─────────────┐
│   Client    │ (Next.js Frontend)
└──────┬──────┘
       │ HTTP/HTTPS
       ▼
┌─────────────────┐
│  API Gateway    │ (Express.js - Port 3000)
│  - Auth         │
│  - Rate Limit   │
│  - Routing      │
└──────┬──────────┘
       │
       ├──► Core API (NestJS - Port 3001)
       │    ├──► PostgreSQL (Prisma ORM)
       │    └──► Redis (Optional - RBAC Cache)
       │
       ├──► AI Service (NestJS - Port 3002)
       │    └──► Redis (Conversation Memory)
       │
       └──► Integration Service (NestJS - Port 3003)
            ├──► PostgreSQL
            └──► External APIs (Jira, GitHub, Slack)
```

### Domain Boundaries

#### 1. **Authentication & Authorization Domain**
- **Modules**: `auth/`, `rbac/`, `permissions/`
- **Responsibilities**: User authentication, role-based access control, permission checks
- **Boundaries**: ✅ Well-defined, separate from business logic

#### 2. **OKR Management Domain**
- **Modules**: `okr/` (objectives, key results, initiatives)
- **Responsibilities**: CRUD operations, governance, reporting, visibility
- **Boundaries**: ⚠️ Some mixing of concerns (CRUD + reporting + governance)

#### 3. **Tenant/Organization Domain**
- **Modules**: `organization/`, `workspace/`, `team/`
- **Responsibilities**: Multi-tenancy, workspace/team management
- **Boundaries**: ✅ Well-defined

#### 4. **Activity & Audit Domain**
- **Modules**: `activity/`, `audit/`
- **Responsibilities**: Activity logging, audit trails
- **Boundaries**: ✅ Well-defined

#### 5. **Integration Domain**
- **Modules**: `integration-service/`
- **Responsibilities**: External integrations (Jira, GitHub, Slack)
- **Boundaries**: ✅ Separate service, well-isolated

#### 6. **AI Domain**
- **Modules**: `ai-service/`
- **Responsibilities**: LLM integration, AI personas
- **Boundaries**: ✅ Separate service, well-isolated

---

## Cross-Cutting Concerns

### ✅ Well-Implemented

1. **Tenant Isolation**
   - **Location**: `common/prisma/tenant-isolation.middleware.ts`
   - **Implementation**: Prisma middleware + PostgreSQL RLS
   - **Status**: ✅ Centralised and consistent

2. **Authentication**
   - **Location**: `auth/`, `api-gateway/middleware/auth.middleware.ts`
   - **Implementation**: JWT tokens, guards
   - **Status**: ✅ Consistent across services

3. **Logging**
   - **Location**: Various (needs standardisation)
   - **Implementation**: Console.log (needs improvement)
   - **Status**: ⚠️ Inconsistent, needs structured logging

4. **Validation**
   - **Location**: DTOs with class-validator
   - **Implementation**: Global validation pipe
   - **Status**: ✅ Consistent

### ⚠️ Areas for Improvement

1. **Error Handling**
   - **Issue**: Inconsistent error response formats
   - **Recommendation**: Standardise error responses

2. **Logging**
   - **Issue**: Console.log instead of structured logging
   - **Recommendation**: Implement Winston/Pino

3. **Metrics/Monitoring**
   - **Issue**: Limited observability
   - **Recommendation**: Add APM (Application Performance Monitoring)

---

## Domain Boundary Violations

### 1. OKR Service Mixing Concerns

**Issue**: `ObjectiveService` handles multiple responsibilities:
- CRUD operations ✅
- Reporting/analytics ⚠️ (should be in `OkrReportingService`)
- Governance/locks ⚠️ (should be in `OkrGovernanceService`)

**Status**: ✅ Partially addressed - `OkrReportingService` and `OkrGovernanceService` exist, but some logic may still be in `ObjectiveService`

**Recommendation**: Complete migration of reporting and governance logic to dedicated services

### 2. Frontend Page Components

**Issue**: Large page components mix:
- State management
- Data fetching
- Business logic
- Rendering

**Files**: `apps/web/src/app/dashboard/okrs/page.tsx` (1,487 lines)

**Recommendation**: Extract to hooks and smaller components

---

## Integration Interfaces

### ✅ Well-Defined

1. **API Gateway → Services**
   - Clear proxy routes
   - Consistent path rewriting
   - Proper error handling

2. **Frontend → API**
   - Type-safe API client (`lib/api.ts`)
   - Consistent error handling
   - React Query for data fetching

3. **External Integrations**
   - Separate service (`integration-service`)
   - Webhook handling
   - Connector pattern

### ⚠️ Areas for Improvement

1. **Service-to-Service Communication**
   - **Issue**: Direct HTTP calls (no service mesh)
   - **Recommendation**: Consider service mesh for production

2. **Event-Driven Architecture**
   - **Issue**: No event bus/messaging
   - **Recommendation**: Consider adding for async operations

---

## Suggested Target Architecture Principles

### 1. **API Layer Does Not Directly Access DB**
✅ **Current Status**: Controllers delegate to services, services use Prisma
✅ **Compliant**: Architecture follows this principle

### 2. **Services Handle Business Logic**
✅ **Current Status**: Business logic in services
⚠️ **Issue**: Some services are too large
**Recommendation**: Split large services into focused services

### 3. **Cross-Cutting Concerns Are Centralised**
✅ **Current Status**: Tenant isolation, auth, validation are centralised
⚠️ **Issue**: Logging is inconsistent
**Recommendation**: Implement structured logging

### 4. **Domain Boundaries Are Respected**
⚠️ **Current Status**: Some mixing of concerns in OKR domain
**Recommendation**: Complete separation of CRUD, reporting, governance

### 5. **External Integrations Are Isolated**
✅ **Current Status**: Integration service is separate
✅ **Compliant**: Architecture follows this principle

### 6. **Runtime Code Does Not Import Scripts**
✅ **Current Status**: Enforced via static analysis (`scripts/check-no-script-imports.ts`)
✅ **Compliant**: Runtime services must not import or require operational scripts

**Principle**: Cross-boundary interactions between runtime code and operational scripts should occur via stable APIs, background jobs, or dedicated services, not by directly calling script modules. This ensures:
- Clear separation between application code and tooling
- Prevention of script dependencies in production builds
- Maintainability of operational scripts independent of runtime changes

**Enforcement**: The static check (`npm run lint:no-script-imports`) scans all runtime files and fails CI if any script imports are detected.

---

## Architecture Decisions

### ✅ Good Decisions

1. **Monorepo Structure**: Clear separation of concerns
2. **Microservices**: Separate services for different concerns
3. **Prisma ORM**: Type-safe database access
4. **PostgreSQL RLS**: Defense-in-depth for tenant isolation
5. **NestJS Modules**: Clear module boundaries

### ⚠️ Areas for Review

1. **Service Granularity**: Some services may be too large
2. **Caching Strategy**: Redis usage could be expanded
3. **Background Jobs**: Consider job queue for heavy operations
4. **Event-Driven Patterns**: Consider adding event bus

---

## Summary

### Overall Architecture Health

**Rating**: **Good** (8/10)

The architecture demonstrates:
- ✅ Clear separation of concerns (mostly)
- ✅ Well-defined domain boundaries (mostly)
- ✅ Centralised cross-cutting concerns (mostly)
- ✅ Good integration patterns

### Key Recommendations

1. **Complete service separation** (P1)
   - Move all reporting logic to `OkrReportingService`
   - Move all governance logic to `OkrGovernanceService`

2. **Implement structured logging** (P1)
   - Replace console.log with Winston/Pino
   - Centralise logging configuration

3. **Split large services** (P2)
   - Break down large service files
   - Extract focused service classes

4. **Add observability** (P2)
   - Implement APM
   - Add distributed tracing
   - Monitor service health

---

**End of Architecture & Boundaries Overview**

