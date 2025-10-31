# Contributing Guide

Thank you for contributing to the OKR Framework platform. This guide outlines our development practices and standards.

## Branch Naming Rules

All feature work must be done on branches. **Do NOT commit directly to `main`.**

Use the following branch naming conventions:

- `feature/*` - New features (e.g., `feature/new-analytics-widget`)
- `fix/*` - Bug fixes (e.g., `fix/csv-export-permission`)
- `refactor/*` - Code refactoring (e.g., `refactor/extract-reporting-service`)
- `chore/*` - Maintenance tasks (e.g., `chore/update-dependencies`)

## Allowed TODO Tags

We enforce strict TODO tag conventions to maintain code quality and prevent technical debt from shipping.

**Allowed TODO tags:**

- `[phase6-polish]` = purely cosmetic / styling uplift / visual refinement
- `[phase7-hardening]` = behavioural alignment, visibility/permission/lock correctness
- `[phase7-performance]` = performance or pagination work for scale

**No other TODO formats are allowed.** If you need to track work that doesn't fit these categories, create a GitHub issue instead.

## Backend Development Rules

### Tenant Isolation

**MUST** use `OkrTenantGuard` for all tenant isolation and write permission enforcement:

```typescript
// ✅ Correct
const whereClause = OkrTenantGuard.buildOrgWhereClause(userOrgId);
const objectives = await prisma.objective.findMany({ where: whereClause });

// ❌ Incorrect - inline tenant filtering
const objectives = await prisma.objective.findMany({
  where: { organizationId: userOrgId }
});
```

### Publish Lock / Cycle Lock Enforcement

**MUST** use `OkrGovernanceService` for all lock enforcement:

```typescript
// ✅ Correct
await this.governanceService.checkAllLocksForObjective(objectiveId, userOrgId);

// ❌ Incorrect - inline lock checks
if (objective.isPublished) {
  throw new ForbiddenException('Cannot edit published objective');
}
```

### Reporting / Analytics

**MUST** live in `OkrReportingService` and be exposed under `/reports/*`:

- Analytics summaries
- CSV exports
- Overdue check-ins
- Pillar coverage
- All aggregate queries

**DO NOT** reintroduce analytics logic into `ObjectiveService` or `KeyResultService`.

### Activity Timeline

**MUST** live in `ActivityController`:

- Objective activity endpoints: `/activity/objectives/:id`
- Key result activity endpoints: `/activity/key-results/:id`

### Service Layer Requirements

- Never expose raw Prisma calls directly from controllers
- Always go via service layer
- Controllers should be thin routing layers only

## Frontend Development Rules

### Permission Checks

**MUST** flow through `useTenantPermissions`:

```typescript
// ✅ Correct
const { canEditObjective, canDeleteObjective } = useTenantPermissions();
if (canEditObjective(objective)) { /* ... */ }

// ❌ Incorrect - inline permission checks
if (user.role === 'admin' || objective.ownerId === user.id) { /* ... */ }
```

### Publish Lock / Cycle Lock UX

**DO NOT** inline publish-lock or cycle-lock conditionals in pages/components.

**MUST** route lock messaging through `PublishLockWarningModal`:

```typescript
// ✅ Correct
import { PublishLockWarningModal } from '@/components/ui/PublishLockWarningModal';

// ❌ Incorrect - custom lock warning UI
if (objective.isPublished) {
  return <div>Cannot edit published objective</div>;
}
```

### Design System Components

**MUST** use existing design-system components:

- `StatCard` - for KPI/metric displays
- `SectionHeader` - for section titles
- `StatusBadge` - for status rendering
- `ActivityItemCard` - for activity feeds and audit history rows
- `ObjectiveCard` - for objective displays

**If you build a new shared visual primitive:**

1. Add it to `/components/ui`
2. Create a matching `*.stories.tsx` stub
3. Create a matching `*.test.tsx` scaffold
4. Document it in `docs/architecture/DESIGN_SYSTEM.md`

## Pull Request Expectations

### Required for All PRs

- All PRs **MUST** update `RELEASE_CHECKLIST.md` if they affect demo flow
- All PRs **MUST** include screenshots for any UI-facing change
- PR description must use the provided template (`.github/pull_request_template.md`)

### Code Quality

- `tsc --noEmit` must pass (no TypeScript errors)
- `npm run lint` must pass (no linting errors)
- All new code must follow existing patterns and architecture

### Testing

- Manual testing required for user-facing changes
- Test with both admin and non-admin users
- Test with published and unpublished OKRs
- Test tenant isolation (users from different orgs)

## Questions?

- Architecture questions: See `docs/architecture/`
- Design system questions: See `docs/architecture/DESIGN_SYSTEM.md`
- Backend patterns: See `docs/architecture/BACKEND_OVERVIEW.md`
- Frontend patterns: See `docs/architecture/FRONTEND_OVERVIEW.md`

