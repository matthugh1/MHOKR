# Coding Standards

This document defines the coding standards and architectural patterns enforced across the OKR Framework platform.

## Backend Standards

### Service Class Responsibilities

All service classes must have a single, well-defined responsibility:

- **`OkrGovernanceService`** = publish lock / cycle lock / lifecycle governance
- **`OkrReportingService`** = reporting, analytics, export, aggregates
- **`OkrTenantGuard`** = tenant isolation and write permission enforcement
- **`ObjectiveService` / `KeyResultService`** = CRUD only (no analytics, no reporting)

### Controller Ownership

Controllers are organized by domain:

- **`/reports/*`** → `OkrReportingController` (all analytics, export, aggregate endpoints)
- **`/activity/*`** → `ActivityController` (all activity timeline endpoints)
- **`/objectives`, `/key-results`** → `ObjectiveController` / `KeyResultController` (CRUD only)

### Data Access Patterns

- **Never expose raw Prisma calls directly from controllers**
- Always go via service layer
- Services handle business logic, controllers handle HTTP concerns only

### Lock Enforcement

- Any new "lock" rule (publish lock, cycle lock, etc.) **must** be centralized in `OkrGovernanceService`
- Do not reimplement lock logic in multiple places
- Lock checks must happen at the service layer, not the controller layer

### Example: Correct Service Pattern

```typescript
// ✅ Correct - Governance service handles locks
@Injectable()
export class ObjectiveService {
  constructor(
    private prisma: PrismaService,
    private governanceService: OkrGovernanceService,
  ) {}

  async update(id: string, data: UpdateObjectiveDto, userOrgId: string) {
    // Check locks via governance service
    await this.governanceService.checkAllLocksForObjective(id, userOrgId);
    
    // Proceed with update
    return this.prisma.objective.update({
      where: { id, organizationId: userOrgId },
      data,
    });
  }
}
```

### Example: Incorrect Service Pattern

```typescript
// ❌ Incorrect - Inline lock checks, analytics mixed with CRUD
@Injectable()
export class ObjectiveService {
  async update(id: string, data: UpdateObjectiveDto, userOrgId: string) {
    const objective = await this.prisma.objective.findUnique({ where: { id } });
    
    // ❌ Inline lock check
    if (objective.isPublished) {
      throw new ForbiddenException('Cannot edit published objective');
    }
    
    return this.prisma.objective.update({ where: { id }, data });
  }
  
  // ❌ Analytics logic in CRUD service
  async getOrgSummary(orgId: string) {
    return this.prisma.objective.aggregate({ /* ... */ });
  }
}
```

## Frontend Standards

### Permission Checks

**Only use** permission methods from `useTenantPermissions`:

- `canEditObjective()`
- `canDeleteObjective()`
- `canEditKeyResult()`
- `canCheckInOnKeyResult()`
- `canExportData()`

Do not implement custom permission logic or inline checks.

### Component Usage

**MUST** use design system components:

- **Status rendering:** `StatusBadge` (never custom status UI)
- **KPI/stat cards:** `StatCard` (never custom metric displays)
- **Section headers:** `SectionHeader` (never custom headers)
- **Activity feeds:** `ActivityItemCard` (never custom activity rows)
- **Objective displays:** `ObjectiveCard` (never custom objective cards)

### Empty States

**MUST** use the neutral card pattern:

```tsx
// ✅ Correct empty state
<div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
  <div className="text-center text-[12px] text-neutral-500">
    No objectives found
  </div>
</div>

// ❌ Incorrect - raw text empty state
<div>No objectives found</div>
```

### Lock UX

**MUST** route lock messaging through `PublishLockWarningModal`:

```tsx
// ✅ Correct
import { PublishLockWarningModal } from '@/components/ui/PublishLockWarningModal';

<PublishLockWarningModal
  isOpen={showLockWarning}
  onClose={() => setShowLockWarning(false)}
  onConfirm={() => {/* proceed with edit */}}
/>

// ❌ Incorrect - custom lock warning
if (objective.isPublished) {
  return <div className="text-red-500">Cannot edit published objective</div>;
}
```

## TODO Tags

**Only allowed TODO tags:**

- `[phase6-polish]` = purely cosmetic / styling uplift / visual refinement
- `[phase7-hardening]` = behavioural alignment, visibility/permission/lock correctness
- `[phase7-performance]` = performance or pagination work for scale

**No other TODO formats are allowed.** If you need to track work that doesn't fit these categories, create a GitHub issue instead.

## Styling Tokens

### Tailwind Classes

Use Tailwind classes consistent with `DESIGN_SYSTEM.md`:

- **Card borders:** `border-neutral-200` (primary), `border-neutral-100` (secondary)
- **Card backgrounds:** `bg-white` (primary), `bg-neutral-50` (secondary/empty states)
- **Card padding:** `p-4` (primary), `p-3` (secondary), `p-6` (large containers)
- **Border radius:** `rounded-xl` (primary cards), `rounded-lg` (secondary cards)
- **Shadows:** `shadow-sm` (standard cards)

### Color Palette

- **Primary text:** `text-neutral-900`
- **Secondary text:** `text-neutral-500`, `text-neutral-800`
- **Status colors:** Use `StatusBadge` component (never custom status colors)

### Spacing

- **Margins:** `mb-2` (section headers), `mb-4` (cards), `mb-8` (large sections)
- **Gaps:** `gap-2` (tight), `gap-3` (standard), `gap-4` (cards in grids)

**Do not invent new greys or spacing scale** unless you update `DESIGN_SYSTEM.md` first.

## TypeScript Standards

- Use strict TypeScript (`strict: true` in `tsconfig.json`)
- Prefer interfaces over types for object shapes
- Use `const` assertions for literal types
- Avoid `any` types (use `unknown` if type is truly unknown)

## Testing Standards

- All new components must have test scaffolds (`*.test.tsx`)
- All new components must have Storybook stubs (`*.stories.tsx`)
- Manual testing required for user-facing changes
- Test with both admin and non-admin users
- Test tenant isolation scenarios

## Documentation Standards

- All new components must be documented in `DESIGN_SYSTEM.md`
- All new backend services must be documented in `BACKEND_OVERVIEW.md`
- All new frontend pages/hooks must be documented in `FRONTEND_OVERVIEW.md`
- JSDoc comments required for public APIs

## Questions?

- Design system: `docs/architecture/DESIGN_SYSTEM.md`
- Backend architecture: `docs/architecture/BACKEND_OVERVIEW.md`
- Frontend architecture: `docs/architecture/FRONTEND_OVERVIEW.md`
- Contributing guide: `CONTRIBUTING.md`

