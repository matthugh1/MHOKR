# Current Feature Flags

**Last Updated:** 2025-11-05  
**Total Flags:** 2

---

## 1. `rbacInspector` ✅

### Type
**Per-User Flag** (stored in database)

### Storage
- **Database:** `users.settings.debug.rbacInspectorEnabled` (JSONB)
- **Path:** `settings.debug.rbacInspectorEnabled`
- **Default:** `false`

### Purpose
Enables production-safe "Why can't I...?" permission reasoning tooltips for blocked actions.

### Access Pattern
```typescript
// Frontend Hook
const { rbacInspector } = useFeatureFlags()

// Backend
req.user.features.rbacInspector
```

### Flow
1. **Database:** `users.settings.debug.rbacInspectorEnabled` (JSONB)
2. **Backend Service:** `RBACInspectorService.getInspectorEnabled(userId)`
3. **JWT Strategy:** Exposed as `req.user.features.rbacInspector`
4. **Frontend Hook:** `useFeatureFlags().rbacInspector`

### Toggle Location
- **UI:** `apps/web/src/app/dashboard/settings/people/page.tsx` (User Management drawer)
- **API:** `POST /rbac/inspector/enable` with `{ userId, enabled }`
- **Permission Required:** `manage_users`

### Usage
- `apps/web/src/components/rbac/RbacWhyTooltip.tsx` - Permission reasoning tooltips
- `apps/web/src/components/okr/WhyCantIInspector.tsx` - "Why can't I...?" inspector
- `apps/web/src/app/dashboard/settings/people/page.tsx` - Developer inspector toggle

### Documentation
- `docs/audit/RBAC_INSPECTOR.md`

---

## 2. `okrTreeView` ✅

### Type
**Environment Variable Flag** (build-time)

### Storage
- **Environment Variable:** `NEXT_PUBLIC_OKR_TREE_VIEW`
- **Type:** String (`'true'` = enabled)
- **Default:** `undefined` (disabled)

### Purpose
Enables tree view mode for OKR list (alternative to list view).

### Access Pattern
```typescript
// Frontend Hook
const { okrTreeView } = useFeatureFlags()

// Implementation
process.env.NEXT_PUBLIC_OKR_TREE_VIEW === 'true'
```

### Flow
1. **Environment Variable:** `NEXT_PUBLIC_OKR_TREE_VIEW` (set in `.env` or deployment config)
2. **Frontend Hook:** `useFeatureFlags().okrTreeView`
3. **Usage:** Conditional rendering in `apps/web/src/app/dashboard/okrs/page.tsx`

### Toggle Location
- **Build Configuration:** Set `NEXT_PUBLIC_OKR_TREE_VIEW=true` in environment
- **Deployment:** Configure in deployment environment variables

### Usage
- `apps/web/src/app/dashboard/okrs/page.tsx` - View mode toggle (list vs tree)
  - When enabled: `?view=tree` shows tree view
  - When disabled: Tree view option hidden

### Documentation
- None (environment variable flag)

---

## Summary Table

| Flag Name | Type | Storage | Default | Toggle Method | Permission Required |
|-----------|------|---------|---------|---------------|-------------------|
| `rbacInspector` | Per-User | Database (JSONB) | `false` | UI/API | `manage_users` |
| `okrTreeView` | Global | Environment Variable | `undefined` | Build Config | N/A |

---

## Implementation Details

### Frontend Hook
**File:** `apps/web/src/hooks/useFeatureFlags.ts`

```typescript
export function useFeatureFlags() {
  const { user } = useAuth()

  return {
    rbacInspector: user?.features?.rbacInspector === true,
    okrTreeView: process.env.NEXT_PUBLIC_OKR_TREE_VIEW === 'true',
  }
}
```

### Backend JWT Strategy
**File:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`

```typescript
return {
  ...user,
  features: {
    rbacInspector: rbacInspectorEnabled,
  },
}
```

### Database Schema
**File:** `services/core-api/prisma/schema.prisma`

```prisma
model User {
  settings Json? @default("{}") // User settings including debug flags
}
```

### Migration
**File:** `services/core-api/prisma/migrations/20251103120000_add_user_settings/migration.sql`

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS "users_settings_rbac_inspector_idx" 
ON "users" USING GIN (("settings" -> 'debug' -> 'rbacInspectorEnabled'));
```

---

## Adding New Feature Flags

### Per-User Flag (Database)
1. Update `RBACInspectorService` or create new service
2. Add to `jwt.strategy.ts` `features` object
3. Update `useFeatureFlags()` hook
4. Update `User` interface in `auth.context.tsx`

### Environment Variable Flag (Build-time)
1. Add to `useFeatureFlags()` hook
2. Use `process.env.NEXT_PUBLIC_*` pattern
3. Document in deployment config

---

## Files Reference

- **Frontend Hook:** `apps/web/src/hooks/useFeatureFlags.ts`
- **Backend Service:** `services/core-api/src/modules/rbac/rbac-inspector.service.ts`
- **JWT Strategy:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`
- **Auth Context:** `apps/web/src/contexts/auth.context.tsx`
- **Schema:** `services/core-api/prisma/schema.prisma`



