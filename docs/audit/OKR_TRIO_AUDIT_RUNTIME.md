# OKR Trio Audit - Runtime Notes

**Date:** 2025-01-XX  
**Branch:** `harden/okr-lockdown-v2`  
**Audit Scope:** OKR List view (`apps/web/src/app/dashboard/okrs/page.tsx`) and Tree/Builder view (`apps/web/src/app/dashboard/builder/page.tsx`)

---

## Environment Setup

### Application Ports
- **Web:** http://localhost:5173 (Next.js dev server)
- **API Gateway:** http://localhost:3000 (default NestJS gateway)
- **Core API:** http://localhost:3001 (default NestJS core-api)

### Startup Scripts
- **Full stack:** `npm run dev` (runs all services concurrently)
- **Individual services:**
  - `npm run dev:web` - Web frontend
  - `npm run dev:core-api` - Core API backend
  - `npm run dev:gateway` - API Gateway

### Test Credentials

Based on `DOCKER_LOGIN_CREDENTIALS.md` and `DOCKER_SEED_COMPLETE.md`:

#### SUPERUSER
- **Email:** `admin@test.com`
- **Password:** `admin123`
- **Role:** System-wide admin (read-only for OKRs)

#### TENANT_OWNER
- **Email:** `owner@test.com` or `founder@puzzelcx.local`
- **Password:** `test123`
- **Role:** ORG_ADMIN (TENANT_ADMIN/TENANT_OWNER in RBAC)

#### WORKSPACE_LEAD
- **Email:** `workspace@org1.com` or `teamlead@org1.com`
- **Password:** `test123`
- **Role:** MEMBER (with WORKSPACE_* or TEAM_* roles)

#### CONTRIBUTOR
- **Email:** `member@org1.com` or `member2@org1.com`
- **Password:** `test123`
- **Role:** MEMBER (basic contributor)

---

## Startup Issues

### Known Issues
1. **Console.log statements:** Multiple `console.log` and `console.error` statements found in production code (see Code Review section)
2. **Debug logging:** Extensive debug logging in `okr-overview.controller.ts` (lines 157, 178-189, 206-234)
3. **Feature flag logging:** Debug logging for feature flags in `page.tsx` (lines 82-88)

### Runtime Observations
- Application uses feature flag `okrTreeView` to gate Tree view
- Tree view accessible via `?view=tree` query parameter when flag enabled
- Default view is List view

---

## Dev Inspector Access

**Note:** Dev Inspector is user-flag gated (`user.enableDevInspector`). To enable for testing:
1. Access User Management screen (requires TENANT_ADMIN or SUPERUSER)
2. Enable `enableDevInspector` flag for test user
3. Log in as that user to access Dev Inspector

---

## Database Access

### Docker Database
```bash
docker exec okr-nexus-postgres psql -U okr_user -d okr_nexus
```

### Seed Data
- **Organizations:** 3 (Test Organization 1, Test Organization 2, Puzzel CX)
- **Users:** 12 (including 2 superusers)
- **Workspaces:** 5
- **Objectives:** 8 (in Puzzel CX organization)
- **Key Results:** 7
- **Check-ins:** 4

---

## Next Steps

1. ✅ Runtime environment documented
2. ⏭️ Product review (user journeys, clarity, outcomes)
3. ⏭️ Design review (heuristics, accessibility)
4. ⏭️ Code review (quality, security, performance)
5. ⏭️ Data contract verification
6. ⏭️ Network capture (HAR file)
7. ⏭️ Decision log and backlog creation

