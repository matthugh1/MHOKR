# Implementation Plan - Cleanup and Testing

## Goal Description
Improve codebase hygiene and reliability by removing debug artifacts (`console.log`, `jwt-debug.ts`) and establishing a baseline for frontend testing.

## User Review Required
> [!IMPORTANT]
> I will be deleting `apps/web/src/lib/jwt-debug.ts`. If you rely on this for development, please let me know, and I can move it to a `scripts/` folder or add a flag to exclude it from production builds instead.

## Proposed Changes

### 1. Cleanup
#### [DELETE] [jwt-debug.ts](file:///Users/matthewhughes/Documents/App_Folder/OKR Framework/apps/web/src/lib/jwt-debug.ts)
- Remove this file entirely to prevent potential security leaks.

#### [MODIFY] Frontend Files (`apps/web`)
- Remove `console.log` statements from components and hooks.
- Files to check:
    - `src/utils/version.ts`
    - `src/hooks/useUxTiming.ts`
    - `src/hooks/useTenantPermissions.ts`
    - `src/components/okr/EditObjectiveModal.tsx`
    - `src/components/okr/SearchableUserSelect.tsx`
    - `src/app/dashboard/builder/page.tsx`
    - `src/contexts/workspace.context.tsx`
    - `src/app/dashboard/okrs/page.tsx`
    - `src/app/dashboard/settings/teams/page.tsx`
    - `src/app/admin/cycles/page.tsx`
    - `src/app/dashboard/okrs/OKRPageContainer.tsx`
    - `src/app/dashboard/settings/organization/page.tsx`
    - `src/app/dashboard/okrs/components/OKRTreeView.tsx`
    - `src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`

#### [MODIFY] Backend Files (`services/core-api`)
- Replace `console.log` with NestJS `Logger` or remove if unnecessary.
- Files to check:
    - `src/policy/authorisation.service.ts`
    - `src/modules/okr/key-result.controller.ts`
    - `src/modules/okr/objective.controller.ts`
    - `src/modules/okr/okr-cycle.controller.ts`
    - `src/modules/okr/objective.service.ts`
    - `src/modules/okr/okr-reporting.service.ts`
    - `src/common/prisma/prisma.service.ts`
    - `src/modules/okr/okr-overview.controller.ts`
    - `src/modules/auth/auth.service.ts`
    - `src/modules/organization/organization.service.ts`
    - `src/modules/auth/strategies/jwt.strategy.ts`
    - `src/main.ts`
    - `src/modules/rbac/audit.ts`
    - `src/common/redis/redis.service.ts`
    - `src/modules/rbac/rbac.ts`
    - `src/modules/rbac/rbac.decorator.ts`

### 2. Testing
#### [NEW] Frontend Tests
- Create a basic test setup verification.
- Add unit tests for a core component (e.g., `Button` or a simple OKR display component) to ensure the test runner (`jest` + `@testing-library/react`) is working correctly.
- Example: `apps/web/src/components/ui/button.spec.tsx` (if button exists) or `apps/web/src/components/okr/OKRStatusBadge.spec.tsx`.

## Verification Plan
### Automated Tests
- Run `npm run test` in `apps/web` to verify the new frontend tests pass.
- Run `npm run build:web` to ensure removing `jwt-debug.ts` didn't break any imports.
- Run `npm run build:core-api` to ensure backend changes compile.

### Manual Verification
- Briefly check the logs during a local run to ensure they are cleaner.
