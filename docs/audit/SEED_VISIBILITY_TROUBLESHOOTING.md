# OKR Visibility Troubleshooting Guide

## Issue: Admin1 sees summary stats but no OKRs

**Root Cause:** The default scope filter is set to `'my'`, which only shows OKRs owned by the current user.

### Solution

1. **Change the Scope Filter:**
   - In the OKRs page, look for the scope selector (usually a dropdown/toggle)
   - Options available to TENANT_ADMIN:
     - `My` - Only OKRs you own (will be empty for admin1)
     - `Tenant` - All tenant-level OKRs ✅ **Use this one**
   - Select **"Tenant"** scope

2. **Verify Cycle Selection:**
   - Ensure you're viewing an ACTIVE cycle:
     - Q4 2025 (ACTIVE) - has 6 tenant objectives, ~70% published
     - Q1 2026 (ACTIVE) - has 6 tenant objectives, ~70% published
   - DRAFT cycles (Q2 2026) have 0% published OKRs
   - ARCHIVED cycles (Q3 2026) have 100% published but may be filtered out

3. **Check URL Parameters:**
   - The URL should include: `?scope=tenant`
   - Example: `/dashboard/okrs?scope=tenant&cycleId=<active-cycle-id>`

## What OKRs Exist

### Tenant-Level OKRs (should be visible with Tenant scope)
- **Q4 2025 (ACTIVE):** 6 objectives
  - ~70% published (4-5 objectives)
  - 1 PRIVATE objective (whitelisted for admin1)
  - All owned by `founder@puzzelcx.local`

- **Q1 2026 (ACTIVE):** 6 objectives
  - ~70% published (4-5 objectives)
  - 1 PRIVATE objective (whitelisted for admin1)
  - All owned by `founder@puzzelcx.local`

- **Q2 2026 (DRAFT):** 6 objectives
  - 0% published (all drafts)
  - May not appear in default views

- **Q3 2026 (ARCHIVED):** 6 objectives
  - 100% published
  - May be filtered out by default

### Workspace-Level OKRs
- Each workspace has 3 objectives per cycle (demo size)
- Only visible when scope is `team-workspace` or `tenant`

### Team-Level OKRs
- Each team has 2 objectives per cycle (demo size)
- Only visible when scope is `team-workspace` or `tenant`

## Quick Test Credentials

### See Tenant-Level OKRs:
- **Login:** `admin1@puzzelcx.local` / `changeme`
- **Action:** Change scope to "Tenant"
- **Expected:** ~12-15 tenant objectives across active cycles

### See Owned OKRs:
- **Login:** `founder@puzzelcx.local` / `changeme`
- **Action:** Use default "My" scope
- **Expected:** All OKRs owned by founder

### See Workspace/Team OKRs:
- **Login:** `workspace-lead-sales-1@puzzelcx.local` / `changeme`
- **Action:** Change scope to "Team/Workspace"
- **Expected:** Sales workspace and team OKRs

## Technical Details

### Scope Filter Behavior

1. **`scope=my`** (Default)
   - Filters: `where.ownerId = requesterUserId`
   - Shows: Only OKRs owned by the logged-in user

2. **`scope=team-workspace`**
   - Filters: OKRs in workspaces/teams where user has roles
   - Shows: Team and workspace OKRs user manages/belongs to

3. **`scope=tenant`** (Required for TENANT_ADMIN to see all OKRs)
   - Filters: `where.organizationId = organizationId` (no owner filter)
   - Shows: All tenant-level OKRs (visibility filtering still applies)

### Visibility Filtering

After scope filtering, visibility rules apply:
- **PUBLIC_TENANT:** Visible to all users ✅
- **PRIVATE:** Only visible to:
  - Owner
  - TENANT_OWNER / TENANT_ADMIN
  - Whitelisted users (admin1 and admin2 are whitelisted)

### Seed Data Summary

- **Tenant Objectives:** 6 per cycle × 4 cycles = 24 total
- **Published Rate:** 
  - ACTIVE: 70% (~4 per cycle)
  - DRAFT: 0% (0 per cycle)
  - ARCHIVED: 100% (6 per cycle)
- **Visibility:**
  - PUBLIC_TENANT: 5 per cycle
  - PRIVATE: 1 per cycle (whitelisted)

## Debugging Steps

1. **Check Browser Console:**
   - Open DevTools → Console
   - Look for API calls to `/okr/overview`
   - Check query parameters: `scope`, `cycleId`, `organizationId`

2. **Check Network Tab:**
   - Inspect the `/okr/overview` request
   - Verify `scope=tenant` is in the query string
   - Check response: `{ objectives: [...], totalCount: ... }`

3. **Verify Role Assignments:**
   ```sql
   SELECT * FROM "RoleAssignment" 
   WHERE "userId" = (SELECT id FROM "User" WHERE email = 'admin1@puzzelcx.local');
   ```
   Should show: `TENANT_ADMIN` role for the organization

4. **Check Objectives Exist:**
   ```sql
   SELECT COUNT(*), "isPublished", "visibilityLevel", "cycleId"
   FROM "Objective"
   WHERE "organizationId" = '<org-id>'
   GROUP BY "isPublished", "visibilityLevel", "cycleId";
   ```



