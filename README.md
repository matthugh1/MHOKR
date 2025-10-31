# OKR Framework

Modern OKR platform with governance, reporting, AI-assisted review, and enterprise-grade controls.

## Product Positioning

Built for leadership teams who care about rollout, accountability, auditability, and strategic alignment — not just key result spreadsheets.

## Main Differentiators

### Tenant Isolation with Auditability

Enterprise-grade tenant isolation ensures data security and compliance. All tenant-scoped resources enforce strict boundaries via `OkrTenantGuard`, with comprehensive audit trails tracked through the activity system.

### Governance Model

Our governance model provides controlled rollout and change management:

- **Publish Lock**: Published OKRs are locked from edits (admin override available)
- **Cycle Lock**: Locked/archived cycles prevent modifications
- **Propose-Change Workflow**: Future workflow hook for change proposals

All governance rules are centralized in `OkrGovernanceService` for consistent enforcement.

### Reporting Service

Dedicated reporting architecture separates analytics from CRUD operations:

- **`OkrReportingService`**: Centralized analytics, summaries, pillar coverage, and export functionality
- **`/reports/*` API**: Dedicated reporting endpoints (analytics, CSV export, overdue check-ins)
- **RBAC-Gated Export**: CSV export requires `export_data` permission

### Design System

Dashboard-grade components with permission-aware UI:

- **Shared Components**: `StatCard`, `SectionHeader`, `StatusBadge`, `ActivityItemCard`, `ObjectiveCard`
- **Permission-Aware**: UI adapts based on user permissions via `useTenantPermissions` hook
- **Consistent Tokens**: Standardized Tailwind tokens for spacing, colors, and typography

## Architecture Documentation

- **[Backend Overview](docs/architecture/BACKEND_OVERVIEW.md)** - Service layer architecture, tenant isolation, governance rules
- **[Frontend Overview](docs/architecture/FRONTEND_OVERVIEW.md)** - Page flow, hooks, component architecture
- **[Design System](docs/architecture/DESIGN_SYSTEM.md)** - Component library, tokens, styling standards

## Development

- **[Contributing Guide](CONTRIBUTING.md)** - Branch naming, TODO tags, backend/frontend rules
- **[Coding Standards](CODING_STANDARDS.md)** - Service responsibilities, component usage, styling tokens
- **[Release Checklist](RELEASE_CHECKLIST.md)** - Pre-merge verification and testing requirements

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 7+
- OpenAI or Anthropic API key (for AI features)

### Setup

```bash
# Install dependencies
npm install

# Set up database
cd services/core-api
cp .env.example .env
# Update .env with your database credentials
npx prisma migrate dev
npx prisma db seed  # Optional: Add sample data

# Start services
npm run dev
```

### Access

- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:3000
- **Core API Docs**: http://localhost:3001/api/docs

## Status

This is an internal pre-release platform preparing for design partner demos. The codebase has been refactored for maintainability, scalability, and enterprise readiness.

---

**Note**: This platform is proprietary software. All rights reserved.
