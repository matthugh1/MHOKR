# Frontend Architecture Overview

## Application Structure

The frontend is a Next.js 14 application with TypeScript, organized into pages, components, hooks, and contexts.

```
apps/web/src/
├── app/                          # Next.js App Router pages
│   ├── dashboard/
│   │   ├── analytics/            # Analytics dashboard page
│   │   ├── okrs/                 # OKRs list/view page
│   │   ├── builder/              # OKR builder/editor
│   │   └── settings/            # Settings pages
│   └── ...
├── components/
│   ├── ui/                       # Shared UI components (design system)
│   ├── protected-route.tsx       # Route guard wrapper
│   └── dashboard-layout.tsx     # Main layout wrapper
├── contexts/                     # React contexts
│   ├── auth.context.tsx          # Authentication state
│   └── workspace.context.tsx     # Workspace/organization state
├── hooks/                        # Custom React hooks
│   ├── usePermissions.ts         # RBAC role checks
│   ├── useTenantPermissions.ts   # Tenant-level permission checks
│   └── useTenantAdmin.ts         # Admin convenience checks
└── lib/                          # Utilities
    ├── api.ts                    # Axios instance with interceptors
    └── date-utils.ts             # Date/period utilities
```

## Page Flow

### Primary User Journey

1. **Dashboard (`/dashboard`)**
   - Overview of user's OKRs, at-risk items, recent activity
   - Quick access to actionable items

2. **Analytics (`/dashboard/analytics`)**
   - Execution health dashboard
   - KPI stat cards (Total Objectives, % On Track, % At Risk, Overdue Check-ins)
   - Strategic Coverage section
   - Execution Risk section (overdue check-ins)
   - Recent Activity feed
   - CSV export (if user has `export_data` permission)

3. **OKRs (`/dashboard/okrs`)**
   - Grid/list view of objectives
   - Filtering by workspace, team, owner, period
   - Each objective card shows status, progress, owner, actions
   - Activity drawer for objective/key result history

4. **Builder (`/dashboard/builder`)**
   - Visual builder for creating/editing OKRs
   - ReactFlow-based graph visualization
   - Form-based editing via slide-out EditPanel
   - **Governed surface:** Consumes `useTenantPermissions()` just like OKRs page
   - Respects publish lock and cycle lock (form fields disabled, lock messaging shown inline)
   - Visually standardized with design system tokens:
     - Main edit panel uses `rounded-xl border border-neutral-200 bg-white p-4 shadow-sm`
     - SectionHeader components for form sections
     - Inline lock callout with neutral styling (`rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-600 shadow-sm`)
   - Part of the 'governed surfaces' group alongside Analytics and OKRs

5. **Activity Drawer** (overlay)
   - Shows activity timeline for selected objective/key result
   - Fetches from `/activity/objectives/:id` or `/activity/key-results/:id`

## Core Hooks

### `useAuth()`

**Location:** `contexts/auth.context.tsx`

**Purpose:** Provides authentication state and user information.

**Returns:**
- `user`: Current user object (id, email, name, organizationId)
- `loading`: Authentication check in progress
- `logout()`: Logout function

**Usage:**
```tsx
const { user, loading } = useAuth()
```

**Note:** Wraps app with `AuthProvider` that validates JWT on mount.

### `useWorkspace()`

**Location:** `contexts/workspace.context.tsx`

**Purpose:** Provides workspace/organization context and available workspaces/teams.

**Returns:**
- `currentOrganization`: Currently selected organization
- `workspaces`: Array of available workspaces
- `teams`: Array of available teams
- `refreshContext()`: Refresh workspace data

**Usage:**
```tsx
const { currentOrganization, workspaces, teams } = useWorkspace()
```

**Note:** Fetches from `/workspaces` and `/teams` endpoints.

### `usePermissions()`

**Location:** `hooks/usePermissions.ts`

**Purpose:** Fetches and provides RBAC role assignments for the current user.

**Returns:**
- `loading`: Loading state
- `isSuperuser`: Whether user is platform superuser
- `canEditOKR()`: Check if user can edit OKRs (role-based)
- `canDeleteOKR()`: Check if user can delete OKRs (role-based)
- `canInviteMembers()`: Check if user can invite members
- `canAdministerTenant()`: Check if user is tenant admin/owner
- `isTenantAdminOrOwner()`: Convenience check for tenant admin/owner

**Usage:**
```tsx
const permissions = usePermissions()
const canEdit = permissions.canEditOKR(organizationId)
```

**Data Source:** Fetches from `/rbac/assignments/me` endpoint.

### `useTenantPermissions()`

**Location:** `hooks/useTenantPermissions.ts`

**Purpose:** Single source of truth for tenant-level permission checks, combining RBAC roles with publish/cycle lock logic.

**Key Features:**
- Mirrors backend governance rules (`OkrGovernanceService`)
- Checks publish lock (published OKRs → admin-only edit/delete)
- Checks cycle lock (locked/archived cycles → admin-only edit/delete)
- Provides visibility checks (`canSeeObjective`, `canSeeKeyResult`)

**Returns:**
- `canEditObjective(objective)`: Can edit (checks RBAC + publish lock + cycle lock)
- `canDeleteObjective(objective)`: Can delete (checks RBAC + publish lock + cycle lock)
- `canEditKeyResult(keyResult)`: Can edit KR (checks RBAC + publish lock + cycle lock)
- `canDeleteKeyResult(keyResult)`: Can delete KR
- `canSeeObjective(objective)`: Visibility check (currently always true, TODO: align with backend)
- `canSeeKeyResult(keyResult)`: Visibility check
- `canExportData()`: Check for `export_data` action
- `getLockInfoForObjective(objective)`: Returns lock reason and message

**Usage:**
```tsx
const { canEditObjective, getLockInfoForObjective } = useTenantPermissions()

const canEdit = canEditObjective(objective)
if (!canEdit) {
  const lockInfo = getLockInfoForObjective(objective)
  // Show lock warning modal
}
```

**Note:** This hook combines `usePermissions()` with `useAuth()` and `useWorkspace()` to provide comprehensive permission checks that match backend enforcement.

## Data Flow

### Authentication Flow

1. User logs in via Keycloak
2. JWT token stored in localStorage/cookies
3. `AuthProvider` validates token on app mount
4. `useAuth()` provides user state throughout app

### Permission Flow

1. User loads page → `usePermissions()` fetches `/rbac/assignments/me`
2. Roles cached in hook state
3. `useTenantPermissions()` combines roles with governance rules
4. UI conditionally renders edit/delete buttons based on permission checks

### API Calls

- **Base URL:** Configured in `lib/api.ts`
- **Auth:** JWT token added via interceptor
- **Error Handling:** Global error handler for 403/401 redirects

## Component Architecture

### Shared UI Components (`components/ui/`)

Design system components extracted in Phase 10:

- **`StatCard`**: Metric display card (title, value, subtitle)
- **`SectionHeader`**: Section title with optional subtitle
- **`ActivityItemCard`**: Activity feed item card
- **`StatusBadge`**: Objective/key result status indicator
- **`ObjectiveCard`**: Full objective card with progress, actions
- **`ActivityDrawer`**: Slide-out drawer for activity timeline

All components use Phase 9 design tokens (see `DESIGN_SYSTEM.md`).

### Protected Routes

`ProtectedRoute` component wraps pages requiring authentication:
- Checks `useAuth()` for valid user
- Redirects to login if unauthenticated

### Layout

`DashboardLayout` provides:
- Sidebar navigation
- Page header area
- Consistent spacing and structure

## State Management

- **React Context:** Auth and workspace state
- **React Query:** (Optional) For API caching (not currently used extensively)
- **Local State:** Component-level state via `useState`/`useEffect`

## Build Provenance

BuildStamp is mandatory on any page we demo live. It displays build version, environment, and git SHA to ensure stakeholders always know which build they're looking at.

### Where BuildStamp MUST Appear

BuildStamp must be rendered on the following demo surfaces:

1. **Analytics header** (`apps/web/src/app/dashboard/analytics/page.tsx`) - Inline variant, top-right
2. **OKRs header** (`apps/web/src/app/dashboard/okrs/page.tsx`) - Inline variant, top-right
3. **Builder header** (`apps/web/src/app/dashboard/builder/page.tsx`) - Inline variant, top-right with SectionHeader
4. **AI dashboard header** (`apps/web/src/app/dashboard/ai/page.tsx`) - Inline variant, top-right
5. **ActivityDrawer footer** (`apps/web/src/components/ui/ActivityDrawer.tsx`) - Footer variant, centered at bottom

### Usage

```tsx
import { BuildStamp } from '@/components/ui/BuildStamp'

// Inline variant (for headers)
<div className="flex items-start justify-between gap-4">
  <SectionHeader title="Page Title" subtitle="Description" />
  <BuildStamp variant="inline" />
</div>

// Footer variant (for ActivityDrawer)
<BuildStamp variant="footer" />
```

**Do not remove BuildStamp or hide it on demo branches unless explicitly approved.** See `docs/BUILD_INFO.md` for details on updating version/env/SHA.

## TODO: Future Improvements

- [ ] Implement React Query for API caching
- [ ] Add visibility checks aligned with backend rules
- [ ] Add optimistic updates for mutations
- [ ] Implement pagination for large lists

