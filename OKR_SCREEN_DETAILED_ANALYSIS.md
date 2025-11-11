# OKR Screen Detailed Analysis

**Generated:** 2025-01-27  
**Purpose:** Comprehensive analysis of the OKR screen functionality and user support

---

## Executive Summary

The OKR (Objectives & Key Results) screen is the central hub for managing organizational goals, tracking progress, and ensuring alignment across teams. It provides a unified interface for viewing, creating, editing, and monitoring Objectives, Key Results, and Initiatives with sophisticated filtering, permission management, and governance controls.

---

## 1. Core Functionality

### 1.1 Primary Purpose

The OKR screen serves as the **system of record** for CRUD operations on:
- **Objectives**: High-level goals aligned to organizational strategy
- **Key Results**: Measurable outcomes that indicate progress toward objectives
- **Initiatives**: Actionable projects that drive key result achievement

### 1.2 Key Capabilities

#### Viewing & Navigation
- **Dual View Modes**: 
  - **List View** (default): Virtualized list with expandable rows showing objectives and their nested key results/initiatives
  - **Tree View** (feature flag): Hierarchical tree structure showing parent-child relationships
- **Pagination**: Server-side pagination (20 items per page, max 50) with client-side virtualization for performance
- **Real-time Updates**: Live progress tracking, status indicators, and check-in data

#### Filtering & Search
- **Scope Filters**: 
  - **My OKRs**: Personal objectives owned by the user
  - **Team/Workspace OKRs**: Objectives within user's team or workspace
  - **Company OKRs**: All tenant-level objectives (requires tenant-level permissions)
- **Status Filters**: On track, At risk, Blocked, Completed, Cancelled
- **Cycle Filter**: Filter by planning cycle (Q4 2025, Q1 2026, etc.)
- **Visibility Filter**: All, Public, Private
- **Owner Filter**: Filter by specific user (when not in "My OKRs" scope)
- **Pillar Filter**: Filter by strategic pillar
- **Search**: Full-text search across titles, descriptions, and owner names
- **URL Persistence**: All filters persist in URL query parameters for sharing/bookmarking

#### Creation & Management
- **Contextual Creation**: Create objectives, key results, or initiatives from unified drawer
- **Inline Editing**: Edit titles, owners, status, and numeric values directly in the list
- **Activity History**: View complete audit trail of changes, check-ins, and updates
- **Bulk Actions**: Delete objectives (with confirmation), manage multiple items

#### Progress Tracking
- **Visual Progress Bars**: Color-coded progress indicators for objectives and key results
- **Status Badges**: Visual indicators for status (On track, At risk, Blocked, etc.)
- **Check-in Management**: Record progress updates with confidence levels
- **Overdue Indicators**: Highlight key results with overdue check-ins
- **Trend Charts**: Visualize progress over time (lazy-loaded for performance)

---

## 2. User Experience Features

### 2.1 Information Architecture

#### Page Header
- **Title**: "Objectives & Key Results"
- **Subtitle**: "Aligned execution. Live progress. Governance state at a glance."
- **Badges**: 
  - Current viewing timeframe (e.g., "Viewing: Q4 2025")
  - Locked cycle warnings (if applicable)
- **View Toggle**: Switch between List and Tree views (when feature flag enabled)

#### Cycle Health Strip
- Displays health metrics for the selected cycle
- Shows overall progress, at-risk items, and completion rates
- Only visible when a specific cycle is selected

#### Governance Status Bar
- Shows governance state for the selected cycle
- Displays published vs. draft objectives
- Indicates cycle lock status

#### Filter Bar (Two-Row Layout)
**Row 1:**
- Scope selector (My OKRs / Team/Workspace / Company)
- Visibility filter dropdown
- Search input

**Row 2:**
- Status filter chips (All, On track, At risk, Blocked, Completed, Cancelled)
- Cycle selector dropdown
- Owner filter (when not in "My OKRs" scope)

#### Toolbar
- **Attention Badge**: Shows count of items needing attention (overdue check-ins, status downgrades, no updates)
- **Add Button**: Split-button dropdown for creating objectives, key results, or initiatives
- **Cycle Management**: Access to cycle management drawer (tenant admins only)

#### Active Filters Display
- Shows all active filters as removable badges
- "Clear all" button to reset all filters
- Each badge can be individually removed

### 2.2 Objective Row Display

#### Collapsed State
Each objective row shows:
- **Title**: Truncated if long, inline-editable
- **Badges**: 
  - Status badge (color-coded: green=on track, amber=at risk, red=blocked)
  - Publication state (Published/Draft)
  - Cycle badge (e.g., "Q4 2025")
  - Owner avatar and name
  - Pillar badge (if assigned)
- **Progress Bar**: Horizontal bar showing completion percentage
- **Micro-metrics**:
  - Overdue check-ins count
  - Lowest confidence percentage
- **Action Buttons**:
  - "+ KR" (add key result)
  - "+ Initiative" (add initiative)
  - "Edit" (conditional on permissions)
  - Menu (MoreVertical) with:
    - Delete (conditional)
    - View history
- **Expand/Collapse Chevron**: Toggle to show/hide nested content

#### Expanded State
When expanded, shows:
- **Key Results Section**:
  - Each KR displays:
    - Title (inline-editable)
    - Status badge
    - Progress bar with numeric values (e.g., "45 of 100 %")
    - Check-in cadence badge (Weekly, Fortnightly, Monthly)
    - Overdue indicator (if applicable)
    - Last check-in date / Next check-in due
    - "Check in" button (permission-aware)
    - "+ Initiative" button (permission-aware)
    - Trend chart (lazy-loaded)
- **Initiatives Section**:
  - Grouped by status (In progress, Not started, Blocked, Completed)
  - Each initiative shows:
    - Title
    - Status badge
    - Due date (formatted: "Due in X days" or "Overdue")
    - Linked KR indicator (if linked to a key result)
  - Empty state with "Add Initiative" button

### 2.3 Performance Optimizations

- **Virtualization**: Only renders visible rows + buffer (2 rows above/below)
- **Lazy Loading**: Trend charts and insights load on-demand
- **Server-Side Pagination**: Reduces initial load time
- **Intersection Observer**: Efficient scroll detection for virtualized list
- **Memoization**: Expensive computations cached with React.useMemo
- **Bundle Size**: Optimized chunk size (target: ≤180 KB gzipped)

---

## 3. User Type Support

### 3.1 Tenant Administrators / Owners

**Capabilities:**
- ✅ View all tenant-level OKRs (Company scope)
- ✅ Create, edit, and delete any objective (even when published/locked)
- ✅ Manage cycles (create, lock, archive)
- ✅ Override governance locks (publish locks, cycle locks)
- ✅ View governance status and cycle health
- ✅ Request check-ins from other users
- ✅ Access cycle management drawer

**UI Adaptations:**
- "Manage Cycles" button visible in toolbar
- No lock warning modals (can always edit)
- Full access to all filters and scopes
- Governance status bar visible

### 3.2 Team/Workspace Members

**Capabilities:**
- ✅ View team/workspace OKRs (Team/Workspace scope)
- ✅ View own OKRs (My OKRs scope)
- ✅ Create objectives (if `canCreateObjective` flag is true)
- ✅ Edit own objectives (unless published/locked)
- ✅ Add key results and initiatives to own objectives
- ✅ Check in on own key results
- ✅ View activity history

**UI Adaptations:**
- Scope selector shows "My OKRs" and "Team/Workspace OKRs" (if has team/workspace roles)
- "Add" button visible if `canCreateObjective` is true
- Edit/Delete buttons hidden for locked/published objectives
- Lock warning modal shown when attempting to edit locked items

### 3.3 Contributors (Basic Users)

**Capabilities:**
- ✅ View own OKRs (My OKRs scope)
- ✅ View public tenant OKRs (if has TENANT_VIEWER role)
- ✅ Check in on own key results
- ✅ View activity history
- ❌ Cannot create objectives (unless explicitly granted)
- ❌ Cannot edit published objectives

**UI Adaptations:**
- Scope selector shows only "My OKRs" (and "Company OKRs" if TENANT_VIEWER)
- "Add" button hidden (unless `canCreateObjective` is true)
- Edit buttons hidden for published/locked objectives
- Read-only view for most items

### 3.4 Superusers (System Administrators)

**Capabilities:**
- ✅ View all OKRs across all tenants
- ❌ Cannot create, edit, or delete OKRs (read-only)
- ✅ Can view all cycles and governance state

**UI Adaptations:**
- "Add" button hidden
- All edit/delete actions disabled
- Read-only mode enforced
- Can view all scopes but cannot modify

---

## 4. Permission & Governance System

### 4.1 Permission Checks

The system uses a **two-layer permission model**:

#### Backend (Source of Truth)
- `/okr/overview` endpoint returns `canEdit`, `canDelete`, `canCheckIn` flags per item
- Server-side RBAC checks combined with governance locks
- Visibility filtering enforced server-side (users never see items they can't access)

#### Frontend (UX Optimization)
- `useTenantPermissions` hook provides permission checks for UI state
- Hides buttons/actions user cannot perform
- Shows lock warning modals when user attempts restricted actions
- **Note**: Frontend checks are for UX only; backend enforces actual permissions

### 4.2 Governance Locks

#### Publish Lock
- **Condition**: `objective.isPublished === true`
- **Effect**: Only TENANT_ADMIN/TENANT_OWNER can edit/delete
- **UI**: Shows `PublishLockWarningModal` when non-admin tries to edit
- **Purpose**: Prevents accidental changes to published objectives

#### Cycle Lock
- **Condition**: `cycle.status === 'LOCKED'` or `'ARCHIVED'`
- **Effect**: Only TENANT_ADMIN/TENANT_OWNER can edit/delete objectives in locked cycles
- **UI**: Shows cycle status badge and warning message
- **Purpose**: Prevents changes to objectives in completed/archived cycles

### 4.3 Visibility Levels

Objectives can have different visibility levels:
- **PUBLIC_TENANT**: Visible to all tenant members
- **PRIVATE**: Only visible to owner and admins
- **WORKSPACE_ONLY** (deprecated): Treated as PUBLIC_TENANT
- **TEAM_ONLY** (deprecated): Treated as PUBLIC_TENANT
- **MANAGER_CHAIN** (deprecated): Treated as PUBLIC_TENANT
- **EXEC_ONLY** (deprecated): Treated as PUBLIC_TENANT

**Enforcement**: Server-side visibility filtering ensures users never see items they shouldn't access.

---

## 5. Data Flow & Architecture

### 5.1 Primary Data Source

**Endpoint**: `GET /okr/overview`

**Request Parameters:**
- `tenantId` (required): Current organization ID
- `page` (optional, default: 1): Page number
- `pageSize` (optional, default: 20, max: 50): Items per page
- `cycleId` (optional): Filter by cycle ID
- `status` (optional): Filter by status
- `scope` (optional): 'my' | 'team-workspace' | 'tenant'
- `ownerId` (optional): Filter by owner
- `visibilityLevel` (optional): Filter by visibility
- `pillarId` (optional): Filter by strategic pillar

**Response Structure:**
```typescript
{
  page: number
  pageSize: number
  totalCount: number
  canCreateObjective: boolean
  objectives: Array<{
    objectiveId: string
    title: string
    status: string
    progress: number
    isPublished: boolean
    visibilityLevel: string
    owner: { id, name, email }
    cycle: { id, name, status }
    canEdit: boolean
    canDelete: boolean
    keyResults: Array<{
      keyResultId: string
      title: string
      status: string
      progress: number
      canCheckIn: boolean
      initiatives: Array<{...}>
    }>
    initiatives: Array<{...}>
  }>
}
```

### 5.2 Supporting Endpoints

- `/reports/cycles`: Load all cycles (ACTIVE, DRAFT, ARCHIVED, LOCKED)
- `/reports/check-ins/overdue`: Load overdue check-ins for badges
- `/users`: Load available users for owner filter
- `/pillars`: Load strategic pillars for pillar filter
- `/okr/insights/attention`: Load attention items (overdue check-ins, status downgrades, no updates)
- `/activity/objectives/:id`: Load activity history for objective
- `/activity/key-results/:id`: Load activity history for key result

### 5.3 Mutation Endpoints

- `POST /objectives`: Create objective
- `PATCH /objectives/:id`: Update objective
- `DELETE /objectives/:id`: Delete objective
- `POST /key-results`: Create key result
- `PATCH /key-results/:id`: Update key result
- `POST /key-results/:id/check-in`: Create check-in
- `POST /initiatives`: Create initiative
- `PATCH /initiatives/:id`: Update initiative

---

## 6. Special Features

### 6.1 Attention Drawer

**Purpose**: Highlights OKRs requiring immediate attention

**Content Types:**
1. **Overdue Check-ins**: Key results with check-ins past due date
2. **No Update (14+ days)**: Objectives/key results not updated in 14+ days
3. **Status Downgrade**: Objectives that moved from "On track" to "At risk" or "Blocked"

**Features:**
- Paginated feed (20 items per page)
- Navigate directly to objective/key result
- Request check-in (tenant admins only)
- Telemetry tracking for usage analytics

**Access**: Via "Attention" button in toolbar with badge count

### 6.2 Activity Timeline Drawer

**Purpose**: Shows complete audit trail for objectives and key results

**Content:**
- Check-ins with values and confidence levels
- Status changes (with before/after states)
- Progress updates (with before/after percentages)
- Value changes (current/target value updates)
- Actor information (who made the change)
- Timestamps for all actions

**Access**: Via "View history" menu item on objective row

### 6.3 Inline Editing

**Supported Fields:**
- **Title**: Click to edit inline (objectives and key results)
- **Owner**: Dropdown selector to change owner
- **Status**: Dropdown to change status
- **Numeric Values**: Edit current/target values for key results
- **Publication State**: Toggle between Draft/Published (tenant admins only)

**Benefits:**
- Faster editing workflow
- No modal interruptions
- Immediate visual feedback
- Permission-aware (only shows when user can edit)

### 6.4 Trend Charts

**Types:**
- **Objective Progress Trend**: Shows progress over time
- **Key Result Progress Trend**: Shows value changes over time
- **Key Result Status Trend**: Shows status changes over time
- **Initiative Status Trend**: Shows initiative status changes

**Features:**
- Lazy-loaded (only fetch when visible)
- Interactive tooltips
- Color-coded by status
- Time-series visualization

### 6.5 Cycle Management

**Capabilities** (Tenant Admins only):
- Create new cycles
- Edit cycle dates and names
- Lock cycles (prevents edits)
- Archive cycles
- View cycle health metrics

**Access**: Via "Manage Cycles" button in filter bar

---

## 7. Accessibility & UX Considerations

### 7.1 Accessibility Features

- **ARIA Labels**: All interactive elements have proper ARIA labels
- **Live Regions**: Screen reader announcements for async updates
- **Focus Management**: Proper focus trapping in modals/drawers
- **Keyboard Navigation**: Full keyboard support for all actions
- **Semantic HTML**: Proper use of `<main>`, `<nav>`, `<button>`, etc.
- **Color Contrast**: WCAG-compliant color schemes for badges and status indicators

### 7.2 User Experience Enhancements

- **Loading States**: Skeleton loaders during data fetch
- **Empty States**: Helpful messages when no data found
- **Error Handling**: Clear error messages with actionable guidance
- **Toast Notifications**: Success/error feedback for all mutations
- **URL Persistence**: Filters persist in URL for bookmarking/sharing
- **Telemetry**: Usage tracking for product insights

### 7.3 Performance Optimizations

- **Virtualization**: Only render visible rows
- **Lazy Loading**: Load charts and insights on-demand
- **Memoization**: Cache expensive computations
- **Debouncing**: Search input debounced to reduce API calls
- **Pagination**: Server-side pagination reduces initial load

---

## 8. Integration Points

### 8.1 Context Integration

- **Workspace Context**: Provides current organization, workspaces, teams
- **Auth Context**: Provides current user, permissions, superuser status
- **Permissions Hook**: Provides RBAC checks and governance lock info
- **Feature Flags**: Controls tree view availability

### 8.2 Navigation Integration

- **Dashboard**: Links to OKR screen with filters pre-applied
- **Activity Drawer**: Can navigate to specific objectives/key results
- **Attention Drawer**: Can navigate to items needing attention
- **URL Parameters**: Supports deep linking with filters

### 8.3 Analytics Integration

- **Telemetry Events**:
  - `okr.tree.toggle`: Tree view toggle
  - `scope_toggle`: Scope filter change
  - `cycle_changed`: Cycle selection change
  - `filter_applied`: Filter application
  - `attention_badge_loaded`: Attention count loaded
  - `attention_drawer_opened`: Attention drawer opened

---

## 9. Technical Architecture

### 9.1 Component Hierarchy

```
OKRsPage (Main Page)
├── PageHeader
├── CycleHealthStrip
├── GovernanceStatusBar
├── OKRFilterBar
├── OKRToolbar
├── OKRPageContainer (List View)
│   └── OKRListVirtualised
│       └── ObjectiveRow (per objective)
│           ├── InlineInsightBar (lazy-loaded)
│           ├── KeyResultRow (per KR)
│           └── InitiativeRow (per initiative)
├── OKRTreeContainer (Tree View)
│   └── OKRTreeView
│       └── OKRTreeNode (per node)
└── Modals/Drawers
    ├── OKRCreationDrawer
    ├── EditObjectiveModal
    ├── EditKeyResultDrawer
    ├── NewCheckInModal
    ├── ActivityDrawer
    ├── AttentionDrawer
    └── CycleManagementDrawer
```

### 9.2 State Management

- **Local State**: React useState for UI state (expanded rows, modals, filters)
- **URL State**: useSearchParams for filter persistence
- **Server State**: React Query or manual fetch with useEffect
- **Context State**: Workspace, Auth, Permissions contexts

### 9.3 Data Transformation

- **mapObjectiveData**: Transforms API response to view model
- **mapObjectiveToViewModel**: Adds timeframeKey for filtering
- **Permission Preparation**: Adds canEdit/canDelete/canCheckIn flags

---

## 10. Future Enhancements (Noted in Code)

- **Grid View**: Compact multi-column view for executive scanning (commented out)
- **Sub-objectives**: Tree view support for nested objectives (partially implemented)
- **Bulk Actions**: Select multiple objectives for bulk operations
- **Export**: Export OKRs to CSV/PDF
- **Templates**: Pre-defined OKR templates for common goals
- **AI Insights**: Automated recommendations and risk detection

---

## Conclusion

The OKR screen is a sophisticated, permission-aware interface that supports multiple user types with varying levels of access. It provides comprehensive filtering, real-time progress tracking, and governance controls while maintaining excellent performance through virtualization and lazy loading. The dual-view mode (list/tree) and extensive filtering options make it suitable for both detailed management and high-level overviews.

The system's strength lies in its **two-layer permission model** (backend enforcement + frontend UX optimization) and **governance locks** that prevent accidental changes to published or locked objectives. This ensures data integrity while providing a smooth user experience for authorized actions.

