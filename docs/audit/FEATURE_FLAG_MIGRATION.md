# Feature Flag Migration: Database Consolidation

**Date:** 2025-11-05  
**Goal:** Migrate all feature flags to database storage for consistency

---

## Summary

All feature flags are now stored in the database under `users.settings.features.*` instead of mixing database and environment variables.

---

## Changes Made

### 1. Created Generic Feature Flag Service
- **File:** `services/core-api/src/modules/rbac/feature-flag.service.ts`
- **Purpose:** Centralized service for managing all feature flags
- **Features:**
  - Supports `rbacInspector` and `okrTreeView` flags
  - Backward compatibility with legacy `debug.rbacInspectorEnabled` location
  - Automatic migration from `debug.*` to `features.*` for `rbacInspector`
  - Audit logging for all flag changes

### 2. Updated RBAC Inspector Service
- **File:** `services/core-api/src/modules/rbac/rbac-inspector.service.ts`
- **Changes:** Now delegates to `FeatureFlagService` for flag management
- **Backward Compatible:** Maintains same API surface

### 3. Updated JWT Strategy
- **File:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`
- **Changes:** 
  - Uses `FeatureFlagService` instead of `RBACInspectorService`
  - Loads all feature flags via `getAllFeatureFlags()`
  - Exposes `rbacInspector` and `okrTreeView` in JWT payload

### 4. Updated Frontend Hook
- **File:** `apps/web/src/hooks/useFeatureFlags.ts`
- **Changes:** 
  - Removed `process.env.NEXT_PUBLIC_OKR_TREE_VIEW` check
  - Now reads `okrTreeView` from `user.features.okrTreeView`

### 5. Updated Type Definitions
- **File:** `apps/web/src/contexts/auth.context.tsx`
- **Changes:** Added `okrTreeView?: boolean` to `User.features` interface

### 6. Updated RBAC Module
- **File:** `services/core-api/src/modules/rbac/rbac.module.ts`
- **Changes:** Added `FeatureFlagService` to providers and exports

---

## Database Schema

All feature flags stored under `users.settings.features.*`:

```json
{
  "features": {
    "rbacInspector": true,
    "okrTreeView": false
  },
  "debug": {
    "rbacInspectorEnabled": true  // Legacy, kept for backward compatibility
  }
}
```

---

## Migration Path

### Existing Users
- `rbacInspector`: Automatically migrated from `debug.rbacInspectorEnabled` when toggled
- `okrTreeView`: Defaults to `false` (can be enabled per user)

### New Users
- All flags default to `false`
- Flags stored under `features.*` from the start

---

## Usage

### Backend
```typescript
// Get a single flag
const enabled = await featureFlagService.getFeatureFlag(userId, 'okrTreeView');

// Get all flags
const flags = await featureFlagService.getAllFeatureFlags(userId);

// Set a flag
await featureFlagService.setFeatureFlag(userId, 'okrTreeView', true, actorUserId, organizationId);
```

### Frontend
```typescript
const { rbacInspector, okrTreeView } = useFeatureFlags();
```

---

## Benefits

1. **Consistency:** All flags managed the same way
2. **Per-User Control:** Both flags can be toggled per user
3. **Audit Trail:** All flag changes logged
4. **Type Safety:** TypeScript types for flag names
5. **Scalability:** Easy to add new flags

---

## Next Steps

1. **Add UI Toggle:** Create UI in User Management for `okrTreeView` flag (if needed)
2. **Add API Endpoint:** Create generic endpoint for toggling any flag (if needed)
3. **Remove Environment Variable:** Remove `NEXT_PUBLIC_OKR_TREE_VIEW` from deployment configs

---

## Testing

- [ ] Verify `rbacInspector` still works after migration
- [ ] Verify `okrTreeView` reads from database (defaults to false)
- [ ] Test flag toggle via existing RBAC Inspector endpoint
- [ ] Verify backward compatibility with legacy `debug.rbacInspectorEnabled`



