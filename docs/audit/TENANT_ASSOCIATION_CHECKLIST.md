# Tenant Association Fixes - Quick Reference Checklist

**Use this checklist to track implementation progress**

---

## ✅ Database Layer

- [ ] **Backup database** before starting
- [ ] Run migration script: `FIX_TENANT_ASSOCIATION_ISSUES.sql`
- [ ] Verify `objectives.tenantId` is NOT NULL
- [ ] Verify `activities.tenantId` column exists and is NOT NULL
- [ ] Verify `user_layouts.tenantId` column exists and is NOT NULL
- [ ] Verify RLS enabled on `initiatives`, `activities`, `user_layouts`
- [ ] Run verification queries (all should return 0 NULL values)

---

## ✅ Prisma Schema

- [ ] Update `Objective.tenantId` to remove `?` (make required)
- [ ] Add `tenantId` field to `Activity` model
- [ ] Add `tenant` relation to `Activity` model
- [ ] Add `@@index([tenantId])` to `Activity` model
- [ ] Add `tenantId` field to `UserLayout` model
- [ ] Add `tenant` relation to `UserLayout` model
- [ ] Add `@@index([tenantId])` to `UserLayout` model
- [ ] Add `activities` relation to `Organization` model
- [ ] Add `userLayouts` relation to `Organization` model
- [ ] Run `npx prisma generate`
- [ ] Verify no TypeScript compilation errors

---

## ✅ Backend Services

### ActivityService (`activity.service.ts`)

- [ ] Update `createActivity()` to require `tenantId` parameter
- [ ] Update `createActivity()` to set `tenantId` in database
- [ ] Update `getRecentForObjective()` to use direct `tenantId` filter
- [ ] Update `getRecentForKeyResult()` to use direct `tenantId` filter
- [ ] Update `getRecentActivityForUserScope()` to filter by `tenantId`

### All Services Creating Activities

- [ ] `objective.service.ts` - Update all `createActivity()` calls
- [ ] `key-result.service.ts` - Update all `createActivity()` calls
- [ ] `initiative.service.ts` - Update all `createActivity()` calls
- [ ] Any other services - Update all `createActivity()` calls

### LayoutService (`layout.service.ts`)

- [ ] Update `saveUserLayout()` to accept `userTenantId` parameter
- [ ] Add `validateEntityExistsAndGetTenantId()` helper method
- [ ] Update `saveUserLayout()` to set `tenantId` on create/update
- [ ] Update `saveUserLayout()` to validate tenant boundaries
- [ ] Update `getUserLayout()` to filter by `tenantId`
- [ ] Update `deleteUserLayout()` to filter by `tenantId`
- [ ] Update `clearUserLayouts()` to filter by `tenantId`

---

## ✅ Backend Controllers

### LayoutController (`layout.controller.ts`)

- [ ] Update `saveLayout()` endpoint to pass `userTenantId`
- [ ] Update `getLayout()` endpoint to pass `userTenantId`
- [ ] Update `deleteLayout()` endpoint to pass `userTenantId`
- [ ] Update `clearLayouts()` endpoint to pass `userTenantId`

### ActivityController (`activity.controller.ts`)

- [ ] Verify no changes needed (already passes `userOrganizationId`)

---

## ✅ Backend Middleware

- [ ] Add `'activity'` to `tenantScopedModels` in `tenant-isolation.middleware.ts`
- [ ] Add `'userLayout'` to `tenantScopedModels` in `tenant-isolation.middleware.ts`
- [ ] Add `'activity'` to `tenantScopedModels` in `prisma.service.ts`
- [ ] Add `'userLayout'` to `tenantScopedModels` in `prisma.service.ts`

---

## ✅ Frontend

- [ ] Verify Activity type definitions (if any) include `tenantId`
- [ ] Verify UserLayout type definitions (if any) include `tenantId`
- [ ] Test activity API calls (should work without changes)
- [ ] Test layout API calls (should work without changes)
- [ ] Verify no frontend errors in browser console

---

## ✅ Testing

### Unit Tests

- [ ] ActivityService tests updated
- [ ] LayoutService tests updated
- [ ] All tests passing

### Integration Tests

- [ ] Activity creation with tenantId
- [ ] Activity queries with tenant isolation
- [ ] Layout creation with tenantId
- [ ] Layout queries with tenant isolation
- [ ] Cross-tenant access blocked

### Manual Testing

- [ ] Create objective → verify activity has tenantId
- [ ] Create key result → verify activity has tenantId
- [ ] View activities → verify tenant isolation
- [ ] Save layout → verify tenantId set
- [ ] View layouts → verify tenant isolation
- [ ] Superuser → verify can see all (read-only)
- [ ] Cross-tenant access → verify blocked

---

## ✅ Deployment

- [ ] Database backup created
- [ ] Migration tested in staging
- [ ] All code changes reviewed
- [ ] All tests passing
- [ ] Deployment plan approved
- [ ] Deploy to production
- [ ] Verify production deployment
- [ ] Monitor for errors

---

## 📋 Code Change Summary

### Files Modified

**Database**:
- `services/core-api/prisma/migrations/FIX_TENANT_ASSOCIATION_ISSUES.sql` (new)

**Prisma Schema**:
- `services/core-api/prisma/schema.prisma`

**Backend Services**:
- `services/core-api/src/modules/activity/activity.service.ts`
- `services/core-api/src/modules/layout/layout.service.ts`
- `services/core-api/src/modules/okr/objective.service.ts`
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/initiative.service.ts`

**Backend Controllers**:
- `services/core-api/src/modules/layout/layout.controller.ts`

**Backend Middleware**:
- `services/core-api/src/common/prisma/tenant-isolation.middleware.ts`
- `services/core-api/src/common/prisma/prisma.service.ts`

**Frontend**:
- No changes required (backend handles tenant isolation)

---

## 🚨 Critical Notes

1. **Database migration MUST be run first** - Backend code expects new columns
2. **Prisma client MUST be regenerated** - TypeScript types need updates
3. **All activity creation calls MUST be updated** - Will fail without tenantId
4. **Layout service MUST validate tenant boundaries** - Prevents cross-tenant access
5. **Test thoroughly in staging** - Tenant isolation is critical security feature

---

## 📞 Support

If issues arise:
1. Check database migration logs
2. Verify Prisma client regenerated
3. Check backend logs for tenantId errors
4. Verify RLS policies enabled
5. Review implementation plan for details

---

**Last Updated**: 2025-01-XX

