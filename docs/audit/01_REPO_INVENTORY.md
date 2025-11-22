# Repository Inventory

**Date**: 2025-01-20  
**Auditor**: Automated Audit  
**Status**: Complete

---

## Executive Summary

This is a **monorepo** OKR (Objectives and Key Results) management platform built with a microservices architecture. The codebase is well-structured with clear separation between frontend, backend services, and shared packages. The application implements enterprise-grade tenant isolation, RBAC (Role-Based Access Control), and governance features.

**Tech Stack**: TypeScript, NestJS (backend), Next.js (frontend), PostgreSQL, Prisma ORM, Redis, Keycloak

---

## Repository Structure

### High-Level Map

```
OKR Framework/
├── apps/                    # Frontend applications
│   └── web/                # Next.js 15 frontend application
├── services/                # Backend microservices
│   ├── api-gateway/        # Express.js API gateway (proxy/router)
│   ├── core-api/           # Main NestJS API service
│   ├── ai-service/         # AI/LLM service (OpenAI/Anthropic)
│   └── integration-service/# External integrations (Jira, GitHub, Slack)
├── packages/               # Shared packages (workspace)
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Shared utilities
├── scripts/                # Operational scripts
│   ├── dev/               # Development orchestration
│   ├── seed/              # Database seeding scripts
│   ├── rbac/              # RBAC audit/validation scripts
│   └── [various].ts       # Maintenance scripts
├── docs/                   # Documentation
│   ├── architecture/      # Architecture documentation
│   ├── audit/             # Audit reports (this folder)
│   ├── developer/         # Developer guidelines
│   └── feature-requests/   # Feature planning
├── keycloak/              # Keycloak configuration
├── import/                # Import data files (JSON exports)
└── [root markdown files]  # ⚠️ Many documentation files at root level
```

---

## Tech Stack

### Languages & Frameworks

- **TypeScript 5.3.3** (strict mode enabled)
- **Node.js 20+** (required)
- **NestJS 10.3.0** (backend services)
- **Next.js 15.0.0** (frontend)
- **React 19.0.0** (UI framework)
- **Express.js** (API gateway)

### Databases & Storage

- **PostgreSQL 16** (primary database)
- **Prisma 5.8.1** (ORM)
- **Redis 7** (caching layer)

### Authentication & Security

- **Keycloak 23.0** (identity provider)
- **JWT** (token-based auth)
- **bcrypt** (password hashing)
- **Helmet** (security headers)

### Infrastructure

- **Docker & Docker Compose** (containerisation)
- **npm workspaces** (monorepo management)

### Key Dependencies

**Backend (core-api)**:
- `@nestjs/*` - NestJS framework
- `@prisma/client` - Database client
- `ioredis` - Redis client
- `passport-jwt` - JWT authentication
- `class-validator` - DTO validation
- `@nestjs/swagger` - API documentation

**Frontend (web)**:
- `next` - Next.js framework
- `@tanstack/react-query` - Data fetching
- `axios` - HTTP client
- `zustand` - State management
- `@radix-ui/*` - UI component library
- `tailwindcss` - Styling
- `framer-motion` - Animations

---

## Runtime Components

### 1. API Gateway (`services/api-gateway/`)

**Type**: Express.js proxy/router  
**Port**: 3000 (default)  
**Entry Point**: `src/index.ts`

**Responsibilities**:
- Routes requests to appropriate backend services
- Authentication middleware (JWT verification)
- Rate limiting
- CORS configuration
- Health check endpoint

**Proxies to**:
- Core API (`/api/*` → `core-api:3001`)
- AI Service (`/api/ai/*` → `ai-service:3002`)
- Integration Service (`/api/integrations/*` → `integration-service:3003`)

### 2. Core API (`services/core-api/`)

**Type**: NestJS application  
**Port**: 3001 (default)  
**Entry Point**: `src/main.ts`

**Key Modules**:
- `auth/` - Authentication & authorisation
- `okr/` - OKR management (objectives, key results, initiatives)
- `rbac/` - Role-Based Access Control
- `permissions/` - Permission system
- `organization/` - Tenant/organisation management
- `user/` - User management
- `workspace/` - Workspace management
- `team/` - Team management
- `activity/` - Activity/audit logging
- `share/` - Share link functionality
- `superuser/` - Superuser utilities

**Database**: PostgreSQL via Prisma  
**Caching**: Redis (optional, for RBAC context)

### 3. AI Service (`services/ai-service/`)

**Type**: NestJS application  
**Port**: 3002 (default)  
**Entry Point**: `src/main.ts`

**Responsibilities**:
- LLM integration (OpenAI, Anthropic)
- AI personas (OKR Coach, Progress Analyst, Cascade Assistant)
- Conversation management

**Dependencies**: Redis for conversation state

### 4. Integration Service (`services/integration-service/`)

**Type**: NestJS application  
**Port**: 3003 (default)  
**Entry Point**: `src/main.ts`

**Responsibilities**:
- External integrations (Jira, GitHub, Slack)
- Webhook handling
- Connector management

### 5. Web Application (`apps/web/`)

**Type**: Next.js 15 application  
**Port**: 5173 (default)  
**Entry Point**: `src/app/layout.tsx`

**Key Features**:
- Dashboard
- OKR management UI
- Analytics
- Visual builder
- Settings
- Documentation pages

**State Management**: Zustand, React Query  
**Styling**: Tailwind CSS  
**UI Components**: Radix UI primitives

---

## Environments & Configuration

### Environment Variables

**Core API** (`services/core-api/.env`):
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `KEYCLOAK_URL` - Keycloak server URL
- `KEYCLOAK_REALM` - Keycloak realm name
- `KEYCLOAK_CLIENT_ID` - Keycloak client ID
- `KEYCLOAK_CLIENT_SECRET` - Keycloak client secret

**API Gateway** (`services/api-gateway/.env`):
- `CORE_API_URL` - Core API service URL
- `AI_SERVICE_URL` - AI service URL
- `INTEGRATION_SERVICE_URL` - Integration service URL
- `JWT_SECRET` - JWT verification secret
- `CORS_ORIGINS` - Allowed CORS origins
- `RATE_LIMIT_TTL` - Rate limit window (seconds)
- `RATE_LIMIT_MAX` - Max requests per window

**AI Service** (`services/ai-service/.env`):
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `AI_DEFAULT_PROVIDER` - Default LLM provider
- `REDIS_URL` - Redis connection string

**Web App** (`apps/web/.env`):
- `NEXT_PUBLIC_API_URL` - API gateway URL
- `NEXTAUTH_URL` - NextAuth base URL
- `NEXTAUTH_SECRET` - NextAuth secret

### Docker Compose

**File**: `docker-compose.yml`

**Services**:
- `postgres` - PostgreSQL 16 (port 5433)
- `redis` - Redis 7 (port 6379)
- `keycloak` - Keycloak 23.0 (port 8080)
- `core-api` - Core API service
- `ai-service` - AI service
- `integration-service` - Integration service
- `api-gateway` - API gateway
- `web` - Web application

**Network**: `okr-network` (bridge)

---

## Key Configuration Files

### Root Level

- `package.json` - Root workspace configuration
- `tsconfig.json` - Root TypeScript config
- `docker-compose.yml` - Docker orchestration
- `.gitignore` - Git ignore rules

### Service-Specific

**Core API**:
- `services/core-api/package.json` - Dependencies
- `services/core-api/tsconfig.json` - TypeScript config
- `services/core-api/nest-cli.json` - NestJS CLI config
- `services/core-api/prisma/schema.prisma` - Database schema
- `services/core-api/prisma/migrations/` - Database migrations

**Web App**:
- `apps/web/package.json` - Dependencies
- `apps/web/tsconfig.json` - TypeScript config
- `apps/web/next.config.js` - Next.js config
- `apps/web/tailwind.config.ts` - Tailwind config
- `apps/web/components.json` - shadcn/ui config

---

## Entry Points

### Development

```bash
# Start all services
npm run dev

# Individual services
npm run dev:gateway
npm run dev:core-api
npm run dev:ai-service
npm run dev:integration-service
npm run dev:web
```

### Production

```bash
# Build all
npm run build

# Docker Compose
docker-compose up -d
```

### Database

```bash
# Migrations
npm run db:migrate

# Seed
npm run db:seed

# Prisma Studio
npm run db:studio
```

---

## Code Organisation

### Backend (NestJS)

**Pattern**: Module-based architecture

```
services/core-api/src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── modules/                    # Feature modules
│   ├── auth/                  # Authentication
│   ├── okr/                   # OKR management
│   ├── rbac/                  # RBAC system
│   └── ...
├── common/                     # Shared utilities
│   ├── prisma/                # Prisma service & middleware
│   ├── tenant/                # Tenant isolation guards/interceptors
│   └── redis/                 # Redis service
└── policy/                     # Policy engine
```

### Frontend (Next.js)

**Pattern**: App Router (Next.js 15)

```
apps/web/src/
├── app/                       # Next.js app directory
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Home page
│   ├── login/                  # Login page
│   ├── dashboard/             # Dashboard pages
│   │   ├── okrs/              # OKR management
│   │   ├── analytics/         # Analytics
│   │   └── ...
│   └── docs/                  # Documentation pages
├── components/                # React components
│   ├── ui/                    # UI primitives (shadcn/ui)
│   ├── okr/                   # OKR-specific components
│   └── ...
├── hooks/                      # React hooks
├── lib/                        # Utilities & API clients
├── contexts/                   # React contexts
└── store/                      # Zustand stores
```

---

## Database Schema

**ORM**: Prisma  
**Schema File**: `services/core-api/prisma/schema.prisma`

**Key Models**:
- `Organization` - Tenant/organisation
- `User` - User accounts
- `Workspace` - Workspaces (nested under organisations)
- `Team` - Teams (nested under workspaces)
- `Objective` - OKR objectives
- `KeyResult` - Key results
- `Initiative` - Initiatives
- `Cycle` - OKR cycles/periods
- `RoleAssignment` - RBAC role assignments
- `Activity` - Audit/activity log
- `CheckInRequest` - Check-in requests
- `StrategicPillar` - Strategic pillars
- `ShareLink` - Share links

**Migrations**: `services/core-api/prisma/migrations/` (35+ migrations)

---

## Testing

### Test Files

- **Unit Tests**: `*.spec.ts` (Jest)
- **Integration Tests**: `*.integration.spec.ts`
- **E2E Tests**: `test/*.e2e.spec.ts`
- **Smoke Tests**: `test/smoke/*.spec.ts`

### Test Coverage

- Backend: Comprehensive test coverage in `services/core-api/src/modules/`
- Frontend: Limited test coverage (some components have tests)

### Test Commands

```bash
# Backend
cd services/core-api
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run smoke:test        # Smoke tests

# Frontend
cd apps/web
npm run test              # Jest tests
```

---

## Scripts & Tooling

### Operational Scripts (`scripts/`)

- `dev/devctl.ts` - Development orchestration
- `seed/run.ts` - Database seeding
- `import-viva-goals-json.ts` - Viva Goals import
- `audit-tenant-isolation.ts` - Tenant isolation audit
- `rbac/audit-*.ts` - RBAC audit scripts
- `check-commit-message.ts` - Commit message validation
- `check-phase-commit.ts` - Phase commit validation

### Database Scripts (`services/core-api/scripts/`)

- `create-superuser.ts` - Create superuser account
- `reset-superuser-password.ts` - Reset superuser password
- `scripts/db/backfill-cycle-id.ts` - Data migration script
- `verify-rls.ts` - RLS verification

### NPM Scripts (Root)

- `dev` - Start all services in development
- `build` - Build all services
- `db:migrate` - Run database migrations
- `db:seed` - Seed database
- `format` - Format code (Prettier)
- `lint` - Lint code (ESLint)
- `typecheck` - Type check (TypeScript)

---

## Documentation Structure

### Well-Organised

- `docs/architecture/` - Architecture documentation
- `docs/developer/` - Developer guidelines
- `docs/audit/` - Audit reports
- `docs/feature-requests/` - Feature planning

### ⚠️ Issues Identified

**Root-Level Documentation Bloat**:
- 80+ markdown files at repository root
- Many are audit/planning documents that should be in `docs/`
- Examples: `SECURITY_AUDIT_REPORT.md`, `ARCHITECTURE_AUDIT_REPORT.md`, `P0_*.md`, `PHASE*_SUMMARY.md`, etc.

**Recommendation**: Move root-level markdown files to appropriate `docs/` subdirectories.

---

## Code Smells & Structural Issues

### 1. Documentation Organisation

**Issue**: Excessive markdown files at root level  
**Impact**: Low (organisational)  
**Recommendation**: Consolidate into `docs/` structure

### 2. Script Location Inconsistency

**Issue**: Scripts exist in both `scripts/` and `services/core-api/scripts/`  
**Impact**: Low (organisational)  
**Recommendation**: Standardise script locations (see Step 6 audit)

### 3. Import Data Files

**Issue**: Large JSON export files in `import/` directory  
**Files**: `objectives_export_file_*.json` (111K+ lines), `checkins_export_file_*.json` (61K+ lines)  
**Impact**: Medium (repository size, potential secrets)  
**Recommendation**: Move to `.gitignore` or separate data repository

### 4. Test Data in Source

**Issue**: Some test fixtures may be in source directories  
**Impact**: Low (needs verification)  
**Recommendation**: Verify test data is properly isolated

### 5. Build Artifacts

**Issue**: `dist/` directories in services (should be gitignored)  
**Impact**: Low (if properly gitignored)  
**Recommendation**: Verify `.gitignore` excludes build artifacts

---

## Security Considerations

### Authentication

- **JWT-based** authentication (HS256)
- **Keycloak** integration (optional)
- **Password hashing** via bcrypt
- **Superuser** accounts (system-wide access)

### Tenant Isolation

- **Multi-layer** enforcement:
  1. Application layer (service validation)
  2. Prisma middleware (automatic filtering)
  3. PostgreSQL RLS (Row-Level Security)

### Secrets Management

- **Environment variables** for secrets
- **No hardcoded secrets** found in initial scan
- **⚠️ Recommendation**: Verify `.env` files are gitignored

---

## Dependencies

### Dependency Management

- **npm workspaces** for monorepo
- **Shared packages**: `@okr-nexus/types`, `@okr-nexus/utils`
- **Version consistency**: Managed via workspace root

### Dependency Audit Needed

- Review for deprecated packages
- Check for security vulnerabilities
- Identify duplicate dependencies
- See Step 7 audit for detailed analysis

---

## Summary

### Strengths

✅ **Well-structured monorepo** with clear separation  
✅ **Modern tech stack** (TypeScript, NestJS, Next.js)  
✅ **Comprehensive tenant isolation** (multi-layer defense)  
✅ **Good test coverage** (backend)  
✅ **Clear module boundaries** (NestJS modules)  
✅ **Dockerised** for easy deployment

### Areas for Improvement

⚠️ **Documentation organisation** (80+ root-level markdown files)  
⚠️ **Script location consistency** (scripts in multiple locations)  
⚠️ **Import data files** (large JSON files in repo)  
⚠️ **Frontend test coverage** (limited compared to backend)

### Next Steps

1. **Security Review** (Step 2) - Authentication, authorisation, secrets
2. **Scalability Review** (Step 3) - Performance bottlenecks, pagination
3. **Code Quality Audit** (Step 4) - Consistency, duplication, maintainability
4. **Architecture Review** (Step 5) - Domain boundaries, cross-cutting concerns
5. **Scripts & Docs Audit** (Step 6) - Organisation and structure
6. **Dependency Review** (Step 7) - Security, updates, duplicates

---

**End of Repository Inventory**

