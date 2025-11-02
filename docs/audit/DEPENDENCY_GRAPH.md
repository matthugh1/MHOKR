# Dependency Graph Report
## OKR Nexus Platform

**Date:** 2025-01-XX  
**Auditor:** Architecture Audit Tool  
**Scope:** Dependency overview of each service, identifying deep or circular imports

---

## Summary

**Total Services:** 4 (core-api, ai-service, integration-service, api-gateway)  
**Total Modules (core-api):** 12  
**Circular Dependencies Detected:** 1 (handled with forwardRef)  
**Deep Import Chains:** Several (>3 levels)

---

## Service-Level Dependencies

### Core API Service (`services/core-api`)

**External Dependencies:**
- PostgreSQL (via Prisma ORM)
- Redis (optional, for RBAC caching)
- Keycloak (optional, for SSO)

**Module Dependencies:**    
```
AppModule
├── ConfigModule (global)
├── PrismaModule (common)
├── RedisModule (common)
├── RBACModule (early load for guards)
├── AuthModule
├── UserModule
├── OrganizationModule
├── WorkspaceModule
├── TeamModule
├── OkrModule
│   ├── RBACModule (import)
│   └── ActivityModule (forwardRef - CIRCULAR)
├── ActivityModule
│   ├── RBACModule (import)
│   └── OkrModule (forwardRef - CIRCULAR)
├── LayoutModule
└── SuperuserModule
```

**Circular Dependency:** `OkrModule` ↔ `ActivityModule`
- **Resolution:** Using `forwardRef()` in both modules
- **Reason:** ActivityModule needs ObjectiveService/KeyResultService, OkrModule needs ActivityService
- **Status:** ✅ Properly handled

---

### AI Service (`services/ai-service`)

**External Dependencies:**
- OpenAI API
- Anthropic API
- Redis (optional)

**Module Dependencies:**
```
AppModule
├── ConfigModule (global)
├── RedisModule (common)
├── LlmModule
├── PersonaModule
│   ├── LlmModule (import)
│   └── ToolModule (import)
└── ToolModule
```

**Circular Dependencies:** None

---

### Integration Service (`services/integration-service`)

**External Dependencies:**
- Redis (Bull queue)
- Jira API (scaffolded)
- GitHub API (scaffolded)
- Slack API (scaffolded)

**Module Dependencies:**
```
AppModule
├── ConfigModule (global)
├── BullModule (Redis)
├── JiraModule
├── GitHubModule
├── SlackModule
└── WebhookModule
```

**Circular Dependencies:** None

---

### API Gateway (`services/api-gateway`)

**External Dependencies:**
- Core API (proxy target)
- AI Service (proxy target)
- Integration Service (proxy target)

**Dependencies:**
- Express middleware
- http-proxy-middleware
- CORS, Helmet, Rate Limiting

**Circular Dependencies:** None

---

## Module-Level Dependencies (Core API)

### OKR Module

**Imports:**
- `RBACModule` - for permission checks
- `ActivityModule` (forwardRef) - for activity logging

**Exports:**
- `ObjectiveService`
- `KeyResultService`
- `InitiativeService`
- `OkrProgressService`
- `OkrGovernanceService`
- `OkrReportingService`
- `CheckInRequestService`

**Internal Dependencies:**
- `ObjectiveService` → `RBACService`, `OkrProgressService`, `ActivityService`, `OkrTenantGuard`, `OkrGovernanceService`
- `KeyResultService` → `RBACService`, `OkrProgressService`, `ActivityService`, `OkrTenantGuard`, `OkrGovernanceService`
- `OkrGovernanceService` → `RBACService`, `PrismaService`
- `OkrReportingService` → `PrismaService`, `OkrTenantGuard`
- `CheckInRequestService` → `PrismaService`, `OkrTenantGuard`

**Deep Import Chain:**
```
ObjectiveController
  → ObjectiveService
    → RBACService
      → PrismaService
        → @prisma/client (deep)
    → OkrProgressService
      → PrismaService
    → ActivityService
      → PrismaService
    → OkrGovernanceService
      → RBACService
        → PrismaService
```

**Depth:** 4-5 levels (acceptable)

---

### Activity Module

**Imports:**
- `RBACModule` - for permission checks
- `OkrModule` (forwardRef) - for ObjectiveService/KeyResultService

**Exports:**
- `ActivityService`

**Internal Dependencies:**
- `ActivityService` → `PrismaService`
- `ActivityController` → `ActivityService`, `ObjectiveService`, `KeyResultService`

**Deep Import Chain:**
```
ActivityController
  → ActivityService
    → PrismaService
      → @prisma/client (deep)
  → ObjectiveService (from OkrModule)
    → RBACService
      → PrismaService
```

**Depth:** 4-5 levels (acceptable)

---

### RBAC Module

**Imports:**
- `PrismaModule` - for database access
- `UserService` (from UserModule) - for user lookups

**Exports:**
- `RBACService`
- `RBACGuard`
- `RBACMigrationService`
- `RBACCacheService`
- `ExecWhitelistService`

**Internal Dependencies:**
- `RBACService` → `PrismaService`, `RBACCacheService` (optional)
- `RBACGuard` → `RBACService`
- `RBACCacheService` → `RedisService` (optional)

**Deep Import Chain:**
```
RBACService
  → PrismaService
    → @prisma/client (deep)
  → RBACCacheService (optional)
    → RedisService
      → ioredis (deep)
```

**Depth:** 3-4 levels (acceptable)

---

### Auth Module

**Imports:**
- `PrismaModule` - for user validation
- `JwtModule` - for token signing
- `PassportModule` - for JWT strategy

**Exports:**
- `AuthService`
- `JwtAuthGuard`
- `JwtStrategy`

**Internal Dependencies:**
- `AuthService` → `PrismaService`, `JwtService`
- `JwtStrategy` → `AuthService`, `PrismaService`, `JwksVerifier`

**Deep Import Chain:**
```
JwtStrategy
  → AuthService
    → PrismaService
      → @prisma/client (deep)
    → JwtService
      → @nestjs/jwt (deep)
  → PrismaService
  → JwksVerifier
    → jwks-rsa (deep)
```

**Depth:** 3-4 levels (acceptable)

---

## Package Dependencies

### Shared Packages

**`@okr-nexus/types`**
- Used by: All services
- Dependencies: None (pure types)

**`@okr-nexus/utils`**
- Used by: Core API, Frontend
- Dependencies: None (pure utilities)

---

## External Library Dependencies

### Core API

**Critical Dependencies:**
- `@nestjs/common`, `@nestjs/core` - Framework
- `@prisma/client` - ORM
- `passport`, `passport-jwt` - Authentication
- `bcrypt` - Password hashing
- `jwks-rsa` - Keycloak token verification

**Optional Dependencies:**
- `ioredis` - Redis client (if caching enabled)
- `@nestjs/swagger` - API documentation

---

### Frontend (apps/web)

**Critical Dependencies:**
- `next` - Framework
- `react`, `react-dom` - UI library
- `axios` - HTTP client
- `reactflow` - Visual builder
- `tailwindcss` - Styling

**UI Dependencies:**
- `@radix-ui/*` - Component primitives
- `framer-motion` - Animations
- `zustand` - State management (some stores)

---

## Dependency Issues & Risks

### 1. Circular Dependency (Handled)

**Location:** `OkrModule` ↔ `ActivityModule`

**Impact:** Low (properly handled with `forwardRef()`)

**Recommendation:** ✅ No action needed

---

### 2. Deep Import Chains

**Location:** Multiple modules with 4-5 level depth

**Impact:** Low (acceptable for NestJS architecture)

**Recommendation:** ✅ No action needed

---

### 3. Tight Coupling: ActivityModule → OkrModule

**Location:** `ActivityController` directly imports `ObjectiveService` and `KeyResultService`

**Impact:** Medium (creates tight coupling)

**Recommendation:** Consider using events/emitters instead of direct service injection

---

### 4. Missing Dependency Injection Boundaries

**Location:** `OkrTenantGuard` uses static methods (no DI)

**Impact:** Low (intentional design choice)

**Recommendation:** ✅ No action needed (utility class pattern)

---

### 5. Optional Dependencies Not Handled Gracefully

**Location:** `RBACCacheService` is optional but dependency injection doesn't gracefully degrade

**Impact:** Low (works with fallback to in-memory cache)

**Recommendation:** ✅ No action needed (already has fallback)

---

## Service-to-Service Communication

### API Gateway → Core API

**Protocol:** HTTP reverse proxy  
**Authentication:** JWT token forwarded  
**Routes:** `/api/*` → `/` (core-api)

**No Circular Dependencies:** ✅

---

### Core API → AI Service

**Protocol:** HTTP  
**Authentication:** Service-to-service (not implemented yet)  
**Routes:** Not directly called (AI service calls Core API)

**No Circular Dependencies:** ✅

---

### AI Service → Core API

**Protocol:** HTTP  
**Purpose:** Fetch OKR context for AI personas  
**Authentication:** Service-to-service token (if implemented)

**No Circular Dependencies:** ✅

---

### Integration Service → Core API

**Protocol:** HTTP  
**Purpose:** Sync external data (Jira, GitHub, Slack)  
**Authentication:** Service-to-service token (if implemented)

**No Circular Dependencies:** ✅

---

## Database Dependencies

### Prisma Client Generation

**Dependency Chain:**
```
Schema Changes
  → Prisma Migrate
    → Generated Prisma Client
      → All Services using PrismaService
```

**Impact:** Breaking changes in schema affect all services simultaneously

**Recommendation:** ✅ Normal Prisma workflow, no action needed

---

## Summary

### ✅ Healthy Dependencies

1. **Service boundaries** are clear and well-defined
2. **Circular dependencies** are properly handled with `forwardRef()`
3. **Import depth** is acceptable (3-5 levels)
4. **Shared packages** are lightweight and well-scoped

### ⚠️ Areas for Improvement

1. **Tight coupling** between ActivityModule and OkrModule (consider event-driven architecture)
2. **Service-to-service** authentication not implemented (needed for production)
3. **Optional dependencies** could be more gracefully handled (already has fallbacks)

### 🔴 No Critical Issues

No critical circular dependencies or deep import chains that would cause runtime issues.

---

**End of Dependency Graph Report**


