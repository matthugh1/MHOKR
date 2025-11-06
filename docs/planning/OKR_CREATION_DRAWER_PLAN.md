# OKR Creation Wizard In-Context Plan

## 0. Current Reality (Baseline)

The existing OKR page (`apps/web/src/app/dashboard/okrs/page.tsx`) provides the following foundation:

- **Data Fetching**: Paginated list of Objectives and Key Results from `/okr/overview?page=&pageSize=20`
- **Permission Decoration**: Each objective in the response includes `canEdit` and `canDelete` boolean flags from the backend
- **Key Result Permissions**: Each Key Result includes `canCheckIn` flag indicating if the user can perform check-ins
- **Visibility Enforcement**: Server-side filtering via `canUserSeeObjective()` ensures users only see Objectives they're allowed to access based on tenant isolation and visibility rules (PUBLIC_TENANT, PRIVATE, EXEC_ONLY, whitelist)
- **UI Permission Hiding**: The UI conditionally hides destructive actions (edit, delete buttons) for users who don't have permission, rather than showing disabled controls
- **Key Result Filtering**: Key Results are filtered client-side to remove those the user cannot see, based on backend-provided visibility flags
- **SUPERUSER Read-Only**: SUPERUSER accounts are treated as read-only for all destructive operations; they can view but cannot edit, delete, or create OKRs

The page currently uses modal dialogs (`NewObjectiveModal`, `NewKeyResultModal`) for creation, which are triggered from a "New Objective" button at line 660. These modals are separate from the main page flow and don't provide guided multi-step creation.

## 1. Problem We're Solving

### Current Pain Points

The existing OKR page mixes multiple concerns in a single view:
- **Status display**: Shows OKR execution state (ON_TRACK, AT_RISK, BLOCKED)
- **Review functionality**: Displays check-ins, history, activity timelines
- **Ownership management**: Shows who owns each Objective and Key Result
- **Governance indicators**: Displays cycle locks, publish locks, visibility badges

Creating a new Objective or Key Result in this environment feels **bolted-on**:
- Users click "New Objective" → modal opens → simple form → submit
- No guidance on what makes a "good" OKR
- No structured collection of required metadata (owner, visibility, cycle, alignment)
- Risk of creating incomplete or invalid OKRs (missing Key Results, wrong cycle, incorrect visibility)

### Design Goal

We want a **guided creation experience** that:
- Sits **on top of** the existing OKR page (as a drawer overlay), not bolted into it
- Does **not weaken** our permission model (RBAC, tenant isolation, governance remain enforced)
- Provides **structured steps** that ensure complete, valid OKR creation
- **Does not navigate** to a different route (stays in-context within the OKR page)

## 2. Target UX Pattern

### 2.1 Trigger Button

**Location**: The "New Objective" button remains in its current position (line 660 in `page.tsx`), in the header section above the filter chips.

**Behavior**: 
- When clicked, opens a right-side drawer/panel (not a modal)
- Button visibility is gated by backend permission flags (see Section 3)

### 2.2 Drawer/Panel Anchoring

**Visual Pattern**: Right-side drawer using the existing `Sheet` component from `@/components/ui/sheet.tsx` (same pattern as `ActivityDrawer`)

**Technical Implementation**:
- Uses `Sheet` component with `side="right"` prop
- Full-height side panel (not floating modal)
- Width: `w-full sm:max-w-lg` (matches ActivityDrawer pattern)
- Overlay: Semi-transparent backdrop (`bg-black/80`) that closes drawer on click
- Animation: Slide-in from right with fade-in overlay

**Example Reference**: `apps/web/src/components/ui/ActivityDrawer.tsx` lines 246-254 shows the exact pattern we'll replicate.

### 2.3 Mobile / Narrow Viewport Behavior

**Responsive Design**:
- On mobile (`< 640px`): Drawer takes full width (`w-full`)
- On tablet/desktop (`>= 640px`): Drawer constrained to `max-w-lg` (512px)
- Backdrop overlay remains full-screen on all viewports
- Drawer can be dismissed by:
  - Clicking the X button in header
  - Clicking the backdrop overlay
  - Pressing Escape key

### 2.4 Wizard Flow Steps

The drawer contains a **4-step wizard**:

**STEP A: Objective Basics**
- Title (required, non-empty)
- Description / intent (optional but encouraged)
- Owner selector (defaults to current user, locked if user cannot assign others)
- Cycle / time period selector (dropdown of active cycles)
- Alignment / parent (optional: choose strategic pillar or parent objective)

**STEP B: Visibility & Access**
- Visibility level selector: PUBLIC_TENANT / PRIVATE / EXEC_ONLY
- If PRIVATE or EXEC_ONLY: whitelist user/group selector (multi-select)
- Clear explanation of who will be able to see this OKR

**STEP C: Key Results**
- Repeatable "Add Key Result" block (not separate page)
- Each KR block includes:
  - KR title (required)
  - Target / metric definition (targetValue, startValue, metricType)
  - KR owner (defaults to Objective owner)
  - Update cadence / check-in expectation (optional)
- Minimum requirement: At least one KR before publish
- "Add another Key Result" button adds new KR block inline

**STEP D: Review & Publish**
- Summary view showing:
  - Objective details (title, owner, cycle)
  - Visibility level + who will see it
  - All Key Results (count and titles)
  - Governance warnings if cycle is locked/archived
- Actions:
  - "Save as draft" (if draft mode allowed)
  - "Publish" (creates published OKR)
  - "Cancel" (discards draft, closes drawer)

### 2.5 Cancel / Save Draft / Publish Actions

**Cancel**:
- Discards all entered data
- Closes drawer
- Returns to OKR list view (no changes)

**Save Draft**:
- Saves Objective with `isPublished: false`
- Creates all Key Results as draft
- Closes drawer
- Refreshes OKR list to show new draft Objective

**Publish**:
- Single API call (or sequential calls with rollback) to create Objective + all KRs
- Sets `isPublished: true` on Objective
- Triggers AuditLog entries
- Closes drawer
- Refreshes OKR list via `/okr/overview?page=1&pageSize=20` to show new OKR with correct `canEdit`/`canDelete` flags

## 3. Permission / Governance Rules for Showing the Trigger

### 3.1 Backend Requirement: `canCreateObjective` Flag

**Critical**: The UI **must not guess** whether a user can create OKRs. We require backend support.

**Required Backend Change**: Add `canCreateObjective` boolean flag to the `/okr/overview` response payload, or provide a separate context endpoint that returns creation permissions for the current tenant/workspace scope.

**Implementation**:
- Backend must check RBAC action `create_okr` using existing `canCreateOKRAction()` logic (`services/core-api/src/modules/rbac/rbac.ts:431-464`)
- Backend must check cycle governance: if selected cycle is ARCHIVED or LOCKED, only TENANT_ADMIN/TENANT_OWNER can create
- Flag should be scoped to the current organization context (from `req.user.organizationId`)

**Response Shape**:
```typescript
// Add to /okr/overview response envelope
{
  objectives: [...],
  totalCount: number,
  canCreateObjective: boolean,  // NEW FIELD
  canCreateKeyResult: boolean    // NEW FIELD (optional, for future use)
}
```

### 3.2 UI Rendering Rules

**Show Button Only If**:
- `canCreateObjective === true` from backend response
- Current user has valid organization context (`currentOrganization?.id` exists)

**Hide Button If**:
- `canCreateObjective === false` (backend denied)
- User is SUPERUSER (read-only, cannot create)
- Cycle is ARCHIVED or LOCKED and user is not TENANT_ADMIN (backend will enforce, but UI should hide button)
- User has no organization membership (`currentOrganization` is null/undefined)

**SUPERUSER Special Case**:
- SUPERUSER can see the button (for navigation context / future roles)
- BUT: Any attempt to submit create/publish will result in backend rejection
- UI should show clear message: "SUPERUSER is read-only in this environment" if they somehow trigger the drawer

**Contributors / Team Members**:
- If they cannot create (backend returns `canCreateObjective: false`), button is **not rendered at all**
- We do NOT show disabled controls (follows existing pattern of hiding destructive actions)

### 3.3 Frontend Implementation

**File**: `apps/web/src/app/dashboard/okrs/page.tsx`

**State Addition**:
```typescript
const [canCreateObjective, setCanCreateObjective] = useState<boolean>(false)
```

**Fetch Permission Flag**:
- In `loadOKRs()` function (or separate `loadCreationPermissions()`), extract `canCreateObjective` from `/okr/overview` response
- Store in state
- Use in conditional rendering of "New Objective" button

**Conditional Rendering**:
```typescript
{canCreateObjective && (
  <Button onClick={() => setShowNewObjective(true)}>
    <Plus className="h-4 w-4 mr-2" />
    New Objective
  </Button>
)}
```

## 4. Step-by-Step Flow in the Creation Panel

### STEP A: Objective Basics

**Fields**:

1. **Objective Title** (required)
   - Text input, non-empty validation
   - Character limit: 200 characters (backend constraint)

2. **Description / Intent** (optional but encouraged)
   - Textarea, multi-line
   - Character limit: 5000 characters (backend constraint)
   - Helper text: "Describe what you're trying to achieve and why"

3. **Owner** (required)
   - User selector dropdown
   - Default: Current user (`user.id`)
   - Options: Filtered list of users in same tenant (`availableUsers` filtered by `organizationId`)
   - **Lock Behavior**: If user cannot assign others (RBAC check), field is locked to current user
   - **Validation**: Owner must exist in same tenant (enforce tenant isolation)

4. **Cycle / Time Period** (required)
   - Dropdown selector
   - Options: `activeCycles` array (fetched from `/reports/cycles/active`)
   - Default: First active cycle (or current cycle if exists)
   - **Validation**: Cannot select ARCHIVED cycle unless TENANT_ADMIN
   - **Lock Behavior**: If selected cycle is LOCKED and user is not TENANT_ADMIN, show inline warning: "This cycle is locked. Only tenant administrators can create OKRs in locked cycles."

5. **Alignment / Parent** (optional)
   - Dropdown selector
   - Options: Strategic pillars + parent objectives (need endpoint to fetch available parents)
   - Default: None (top-level objective)
   - Helper text: "Link this objective to a strategic pillar or parent objective"

**Validation Rules**:

- Title must be non-empty
- Owner must be valid user ID in same tenant
- Cycle must be valid cycle ID
- If cycle is ARCHIVED or LOCKED:
  - Check if user is TENANT_ADMIN/TENANT_OWNER (via `permissions.isTenantAdminOrOwner()`)
  - If not admin, show inline error: "You cannot create OKRs in locked or archived cycles"
  - Disable "Next" button until cycle is changed or user has admin role

**Pre-fill Logic**:

- Owner: `user.id` (current user)
- Cycle: First active cycle from `activeCycles` array
- Organization: `currentOrganization.id` (implicit, not shown in form)
- Workspace/Team: Inherit from current filter context (if `filterWorkspaceId` or `filterTeamId` is set)

### STEP B: Visibility & Access

**Fields**:

1. **Visibility Level** (required)
   - Radio group or dropdown
   - Options: PUBLIC_TENANT, PRIVATE, EXEC_ONLY
   - Default: PUBLIC_TENANT
   - **RBAC Restriction**: If user is not TENANT_ADMIN or TENANT_OWNER, restrict options:
     - Check `permissions.isTenantAdminOrOwner(currentOrganization?.id)`
     - If false, only show PUBLIC_TENANT option (hide PRIVATE and EXEC_ONLY)
     - If true, show all options

2. **Whitelist (conditional)** (required if PRIVATE or EXEC_ONLY)
   - Multi-select user picker
   - Only shown if visibility is PRIVATE or EXEC_ONLY
   - Options: Filtered list of users in same tenant
   - Helper text: "Select users who can view this OKR"
   - **Validation**: At least one user must be selected (or owner is automatically included)

**Rules**:

- If caller is not TENANT_ADMIN or TENANT_OWNER:
  - Visibility options are restricted to PUBLIC_TENANT only
  - UI hides PRIVATE and EXEC_ONLY radio buttons
- If PRIVATE or EXEC_ONLY is selected:
  - Backend must validate whitelist assignments using same logic as `canUserSeeObjective()`
  - Whitelist must be stored in Organization `privateWhitelist` or `execOnlyWhitelist` metadata
- SUPERUSER can select anything in UI, but final publish will fail (read-only). Show clear warning.

**UI Feedback**:

- Show preview text: "Who will see this OKR: [list of users/roles]"
- For PUBLIC_TENANT: "All users in your organization"
- For PRIVATE: "Only you, tenant admins, and selected users"
- For EXEC_ONLY: "Only you, tenant admins, and selected users (exec-only visibility)"

### STEP C: Key Results

**Repeatable Block Pattern**:

Each Key Result is an **inline block** (not a separate page). Users can add multiple KRs without leaving the step.

**Fields Per KR Block**:

1. **KR Title** (required)
   - Text input, non-empty validation
   - Character limit: 200 characters

2. **Target / Metric Definition** (required)
   - Fields:
     - `startValue` (number, default: 0)
     - `targetValue` (number, required)
     - `metricType` (dropdown: INCREASE, DECREASE, MAINTAIN, PERCENTAGE, CUSTOM)
     - `unit` (text, optional, e.g., "users", "hours", "%")

3. **KR Owner** (required)
   - User selector dropdown
   - Default: Objective owner (from Step A)
   - Options: Filtered list of users in same tenant
   - **Lock Behavior**: If user cannot assign others, default to Objective owner and lock

4. **Update Cadence / Check-in Expectation** (optional)
   - Text field or dropdown
   - Examples: "Weekly", "Bi-weekly", "Monthly"
   - Helper text: "How often should this KR be updated?"

**Add/Remove Controls**:

- "Add another Key Result" button adds new KR block below current block
- Each KR block has "Remove" button (only if more than one KR exists)
- Minimum requirement: At least one KR before proceeding to Review step

**Validation**:

- At least one KR required
- Each KR must have: title, targetValue, owner
- KR owner must be valid user in same tenant
- If user doesn't have permission to assign someone else as KR owner, default to themselves

**Presentation**:

- Stack KR blocks vertically with spacing
- Each block has light border/background to distinguish it
- Show KR count badge: "Key Results (1/3)" or similar

### STEP D: Review & Publish

**Summary Display**:

1. **Objective Summary**:
   - Title
   - Owner (name/email)
   - Cycle name and status badge
   - Description (if provided)

2. **Visibility Summary**:
   - Visibility level badge
   - List of who will see it (if PRIVATE/EXEC_ONLY, show whitelist)

3. **Key Results Summary**:
   - Count: "X Key Results"
   - List each KR with title, owner, target

4. **Governance Warnings** (if applicable):
   - If cycle is LOCKED: "⚠️ This objective will be created in a locked cycle. Only tenant administrators can modify OKRs in locked cycles."
   - If cycle is ARCHIVED: "⚠️ This cycle is archived. You cannot create OKRs in archived cycles." (should have been blocked in Step A, but show as double-check)
   - If user is SUPERUSER: "⚠️ SUPERUSER accounts are read-only. This action will be blocked."

**Actions**:

1. **Save as Draft**:
   - Creates Objective with `isPublished: false`
   - Creates all Key Results linked to Objective
   - Does NOT trigger publish lock
   - Shows success toast: "Draft saved. You can publish it later."
   - Closes drawer
   - Refreshes OKR list

2. **Publish**:
   - Creates Objective with `isPublished: true`
   - Creates all Key Results linked to Objective
   - Triggers AuditLog entries (see Section 5.1)
   - Shows success toast: "OKR published successfully."
   - Closes drawer
   - Refreshes OKR list via `/okr/overview?page=1&pageSize=20`

3. **Cancel**:
   - Discards all entered data
   - Closes drawer
   - No API calls

**Error Handling**:

- If publish fails due to governance (locked cycle, SUPERUSER, etc.), show error toast with specific message
- If publish fails due to validation (missing fields, invalid owner, etc.), show field-level errors
- If partial failure (Objective created but KR creation fails), show warning: "Objective created, but some Key Results failed. Please edit to add missing KRs."

## 5. Technical / Architectural Notes

### 5.1 Required Backend Changes

#### 5.1.1 `canCreateObjective` Permission Flag

**File**: `services/core-api/src/modules/okr/okr-overview.controller.ts`

**Change**: Add `canCreateObjective` boolean to response envelope

**Implementation**:
```typescript
// In getOverview() method, after fetching objectives
const resourceContext = await buildResourceContextFromOKR(this.prisma, null, {
  organizationId: userOrganizationId,
});

const canCreate = await this.rbacService.canPerformAction(
  requesterUserId,
  'create_okr',
  resourceContext,
);

// Check cycle governance: if selected cycle is LOCKED/ARCHIVED, only admins can create
let canCreateWithCycleLock = canCreate;
if (selectedCycleId) {
  const cycle = await this.prisma.cycle.findUnique({
    where: { id: selectedCycleId },
    select: { status: true },
  });
  if (cycle && (cycle.status === 'LOCKED' || cycle.status === 'ARCHIVED')) {
    // Check if user is TENANT_ADMIN/TENANT_OWNER
    const adminResourceContext = await buildResourceContextFromOKR(this.prisma, null, {
      organizationId: userOrganizationId,
    });
    canCreateWithCycleLock = await this.rbacService.canPerformAction(
      requesterUserId,
      'edit_okr', // Use edit_okr as proxy for admin override
      adminResourceContext,
    );
  }
}

return {
  objectives: [...],
  totalCount: number,
  canCreateObjective: canCreateWithCycleLock,
};
```

#### 5.1.2 Visibility Options Endpoint

**New Endpoint**: `GET /okr/creation-context`

**Purpose**: Return allowed visibility options and allowed owners for the current user/tenant context

**Response**:
```typescript
{
  allowedVisibilityLevels: ['PUBLIC_TENANT', 'PRIVATE', 'EXEC_ONLY'], // or ['PUBLIC_TENANT'] if not admin
  allowedOwners: [{ id: string, name: string, email: string }], // Users in same tenant
  canAssignOthers: boolean, // Whether user can assign owner other than self
  availableCycles: [{ id: string, name: string, status: string }], // Active cycles user can create in
}
```

**Implementation**: Check RBAC for visibility permissions, filter users by tenant, check cycle governance.

#### 5.1.3 Composite Create Endpoint (Optional)

**Option A**: Use existing endpoints sequentially
- `POST /objectives` → get Objective ID
- For each KR: `POST /key-results` with `objectiveId`

**Option B**: New composite endpoint (recommended for atomicity)
- `POST /objectives/create-with-key-results`
- Body: `{ objective: {...}, keyResults: [...] }`
- Returns: Created Objective with all KRs
- **Rollback**: If any KR creation fails, rollback Objective creation (transaction)

**Recommendation**: Start with Option A (sequential calls) in Phase 2, add Option B in Phase 3 if needed for atomicity.

#### 5.1.4 AuditLog Integration

**File**: `services/core-api/src/modules/okr/objective.service.ts` and `key-result.service.ts`

**Change**: Add AuditLog entries for creation

**Implementation**:
```typescript
// In objective.service.ts create() method, after creating objective
await this.auditLogService.record({
  actorUserId: _userId,
  action: 'objective_created',
  targetType: 'OBJECTIVE',
  targetId: createdObjective.id,
  metadata: {
    title: createdObjective.title,
    organizationId: createdObjective.organizationId,
    cycleId: createdObjective.cycleId,
    isPublished: createdObjective.isPublished,
  },
});

// In key-result.service.ts create() method, after creating KR
await this.auditLogService.record({
  actorUserId: _userId,
  action: 'key_result_created',
  targetType: 'KEY_RESULT',
  targetId: createdKr.id,
  metadata: {
    title: createdKr.title,
    objectiveId: objectiveId,
    organizationId: objective?.organizationId,
  },
});
```

**Note**: AuditLogService already exists at `services/core-api/src/modules/audit/audit-log.service.ts`. Inject it into ObjectiveService and KeyResultService constructors.

#### 5.1.5 Tenant Isolation Enforcement

**Already Implemented**: 
- `OkrTenantGuard.assertCanMutateTenant()` blocks SUPERUSER and users without org
- `OkrTenantGuard.assertSameTenant()` enforces org matching
- Both are called in `objective.service.ts:create()` and `key-result.service.ts:create()`

**No Changes Needed**: Existing tenant isolation is sufficient.

#### 5.1.6 SUPERUSER Write Blocking

**Already Implemented**:
- `OkrTenantGuard.assertCanMutateTenant()` throws if `userOrganizationId === null` (SUPERUSER)
- RBAC `canSuperuser()` returns `false` for `create_okr` action

**No Changes Needed**: Existing SUPERUSER blocking is sufficient.

### 5.2 Frontend Integration

#### 5.2.1 Component Structure

**New Component**: `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`

**Props**:
```typescript
interface OKRCreationDrawerProps {
  isOpen: boolean
  onClose: () => void
  availableUsers: any[]
  activeCycles: Array<{ id: string; name: string; status: string }>
  currentOrganization: { id: string } | null
  onSuccess: () => void // Callback to refresh OKR list
}
```

**State Management**:
```typescript
const [currentStep, setCurrentStep] = useState<'basics' | 'visibility' | 'key-results' | 'review'>('basics')
const [draftObjective, setDraftObjective] = useState<Partial<Objective>>({})
const [draftKRs, setDraftKRs] = useState<Array<Partial<KeyResult>>>([])
const [isSubmitting, setIsSubmitting] = useState(false)
```

#### 5.2.2 Drawer Rendering

**File**: `apps/web/src/app/dashboard/okrs/page.tsx`

**State Addition**:
```typescript
const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
```

**Render Conditionally**:
```typescript
<OKRCreationDrawer
  isOpen={isCreateDrawerOpen}
  onClose={() => setIsCreateDrawerOpen(false)}
  availableUsers={availableUsers}
  activeCycles={activeCycles}
  currentOrganization={currentOrganization}
  onSuccess={() => {
    setIsCreateDrawerOpen(false)
    handleReloadOKRs() // Existing function that calls loadOKRs()
  }}
/>
```

#### 5.2.3 RBAC/Visibility Options Fetching

**In Drawer Component**: Fetch allowed options on mount

**Implementation**:
```typescript
useEffect(() => {
  if (isOpen) {
    // Fetch creation context
    api.get('/okr/creation-context')
      .then(res => {
        setAllowedVisibilityLevels(res.data.allowedVisibilityLevels)
        setAllowedOwners(res.data.allowedOwners)
        setCanAssignOthers(res.data.canAssignOthers)
      })
      .catch(err => {
        console.error('Failed to fetch creation context', err)
        // Fallback: assume PUBLIC_TENANT only, current user as owner
      })
  }
}, [isOpen])
```

#### 5.2.4 Submission Flow

**Publish Handler**:
```typescript
const handlePublish = async () => {
  setIsSubmitting(true)
  try {
    // Create Objective first
    const objectiveRes = await api.post('/objectives', {
      title: draftObjective.title,
      description: draftObjective.description,
      ownerId: draftObjective.ownerId,
      cycleId: draftObjective.cycleId,
      organizationId: currentOrganization.id,
      visibilityLevel: draftObjective.visibilityLevel,
      isPublished: true,
    })
    
    const objectiveId = objectiveRes.data.id
    
    // Create Key Results sequentially
    for (const kr of draftKRs) {
      await api.post('/key-results', {
        title: kr.title,
        objectiveId: objectiveId,
        ownerId: kr.ownerId,
        targetValue: kr.targetValue,
        startValue: kr.startValue,
        metricType: kr.metricType,
        unit: kr.unit,
      })
    }
    
    // Success: refresh OKR list
    onSuccess()
    toast({ title: 'OKR published successfully' })
  } catch (err: any) {
    if (err.response?.status === 403) {
      toast({ 
        title: 'Permission denied', 
        description: err.response.data.message || 'You do not have permission to create OKRs.',
        variant: 'destructive'
      })
    } else {
      toast({ 
        title: 'Failed to publish OKR', 
        description: err.response?.data?.message || 'Please try again.',
        variant: 'destructive'
      })
    }
  } finally {
    setIsSubmitting(false)
  }
}
```

#### 5.2.5 Data Refresh After Submit

**After successful create**: Call `handleReloadOKRs()` which:
- Resets `currentPage` to 1
- Calls `loadOKRs()` to fetch fresh data from `/okr/overview?page=1&pageSize=20`
- New Objective appears in list with correct `canEdit`/`canDelete` flags from backend

### 5.3 Governance Compatibility

#### 5.3.1 Cycle Lock Enforcement

**UI Enforcement** (Step A):
- If selected cycle is LOCKED/ARCHIVED:
  - Check `permissions.isTenantAdminOrOwner(currentOrganization?.id)`
  - If false, show inline error and disable "Next" button
  - If true, show warning but allow proceed

**API Enforcement** (Backend):
- In `objective.service.ts:create()`, call `okrGovernanceService.checkCycleLockForObjective()` **before** creating
- If cycle is LOCKED/ARCHIVED and user is not admin, throw `ForbiddenException`
- This is **final guard** - UI warnings are UX only, backend is source of truth

#### 5.3.2 Visibility Permission Enforcement

**UI Enforcement** (Step B):
- If user is not TENANT_ADMIN/TENANT_OWNER, hide PRIVATE and EXEC_ONLY options
- Only show PUBLIC_TENANT option

**API Enforcement** (Backend):
- In `objective.service.ts:create()`, validate visibility level:
  - If visibility is PRIVATE or EXEC_ONLY:
    - Check RBAC: user must have TENANT_OWNER or TENANT_ADMIN role
    - If not, throw `ForbiddenException: "Only tenant administrators can create PRIVATE or EXEC_ONLY OKRs"`
- Validate whitelist: all whitelist users must be in same tenant

#### 5.3.3 Key Result Owner Enforcement

**UI Enforcement** (Step C):
- If user cannot assign others, default KR owner to Objective owner and lock field

**API Enforcement** (Backend):
- In `key-result.service.ts:create()`, validate owner:
  - Owner must be in same tenant (already enforced by tenant isolation)
  - Check if creator has permission to assign owner (optional RBAC check, can defer to tenant isolation)

#### 5.3.4 SUPERUSER Write Blocking

**UI Enforcement** (All Steps):
- Show warning in Review step: "SUPERUSER accounts are read-only"

**API Enforcement** (Backend):
- `OkrTenantGuard.assertCanMutateTenant()` throws if `userOrganizationId === null`
- RBAC `canSuperuser()` returns `false` for `create_okr`
- Both are already implemented - no changes needed

#### 5.3.5 Publish Lock Compatibility

**Note**: Publish lock (`isPublished: true`) only applies to **existing** OKRs. New OKRs are created as draft (`isPublished: false`) by default unless user explicitly clicks "Publish".

**No Changes Needed**: Publish lock logic only applies to updates/deletes, not creation.

## 6. Telemetry / Success Criteria

### 6.1 Metrics to Track

**Drawer Interaction Metrics**:
- `okr_drawer_opened`: Count of times drawer is opened
- `okr_drawer_abandoned`: Count of times drawer is closed without submitting (Cancel or backdrop click)
- `okr_drawer_step_viewed`: Track which steps users view (basics, visibility, key-results, review)
- `okr_drawer_step_completed`: Track which steps users complete (click "Next")

**Creation Success Metrics**:
- `okr_draft_saved`: Count of draft saves (Step D → "Save as draft")
- `okr_published`: Count of successful publishes (Step D → "Publish")
- `okr_publish_failed`: Count of failed publishes with error reason (governance, validation, etc.)

**Timing Metrics**:
- `okr_drawer_time_spent`: Time from drawer open to close (milliseconds)
- `okr_drawer_time_to_publish`: Time from drawer open to successful publish (milliseconds)
- `okr_drawer_step_duration`: Time spent in each step (basics, visibility, key-results, review)

**Governance Block Metrics**:
- `okr_create_blocked_cycle_locked`: Count of attempts blocked due to locked cycle
- `okr_create_blocked_cycle_archived`: Count of attempts blocked due to archived cycle
- `okr_create_blocked_superuser`: Count of SUPERUSER attempts blocked
- `okr_create_blocked_visibility`: Count of attempts blocked due to PRIVATE/EXEC_ONLY permission

**Role Distribution Metrics**:
- `okr_creator_role`: Distribution of creator roles (TENANT_ADMIN, WORKSPACE_LEAD, TEAM_LEAD, CONTRIBUTOR)
- `okr_creator_tenant`: Which tenants are creating OKRs (for multi-tenant analytics)

### 6.2 Instrumentation Implementation

**Frontend Instrumentation**:
- Use existing analytics service (if available) or add console.log calls for now
- Track events in `OKRCreationDrawer.tsx` component:
  - `onOpen`: Track drawer opened
  - `onStepChange`: Track step navigation
  - `onCancel`: Track abandonment
  - `onSubmit`: Track publish/draft save

**Backend Instrumentation**:
- Add metrics to `objective.service.ts:create()`:
  - Success/failure counts
  - Error reason categorization
  - Creator role tracking

**Example Implementation**:
```typescript
// In OKRCreationDrawer.tsx
useEffect(() => {
  if (isOpen) {
    // Track drawer opened
    console.log('[Telemetry] okr_drawer_opened', {
      userId: user?.id,
      organizationId: currentOrganization?.id,
      timestamp: new Date().toISOString(),
    })
  }
}, [isOpen])

const handlePublish = async () => {
  const startTime = Date.now()
  try {
    // ... create logic ...
    const duration = Date.now() - startTime
    console.log('[Telemetry] okr_published', {
      userId: user?.id,
      organizationId: currentOrganization?.id,
      duration,
      krCount: draftKRs.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.log('[Telemetry] okr_publish_failed', {
      userId: user?.id,
      error: err.response?.data?.message,
      reason: categorizeError(err),
      timestamp: new Date().toISOString(),
    })
  }
}
```

### 6.3 Success Criteria Questions

These metrics will help answer:

1. **"Are only admins creating OKRs?"**
   - Track `okr_creator_role` distribution
   - If >80% of creators are TENANT_ADMIN, we may need to improve permissions for non-admins

2. **"Are people creating OKRs into locked cycles and getting blocked?"**
   - Track `okr_create_blocked_cycle_locked` vs `okr_published`
   - If blocked attempts are high, we may need better UI warnings in Step A

3. **"Are Key Results missing owners?"**
   - Track KR creation failures due to missing owner
   - If failures are high, improve Step C validation

4. **"What's the abandon rate?"**
   - Track `okr_drawer_abandoned` vs `okr_drawer_opened`
   - If abandon rate >50%, we may need to simplify the flow

5. **"How long does creation take?"**
   - Track `okr_drawer_time_to_publish`
   - If average time >5 minutes, we may need to simplify or add progress indicators

## 7. Delivery Phases

### Phase 1 – Enable the Drawer (W4.M1)

**Goal**: Add drawer skeleton with Step A (Objective basics) only. No publish yet, just "Save draft locally / Cancel".

**Backend Tasks**:
- Add `canCreateObjective` boolean to `/okr/overview` response payload
- Implement `GET /okr/creation-context` endpoint (or return context in `/okr/overview`)
- Enforce cycle lock check in `objective.service.ts:create()` (if not already enforced)

**Frontend Tasks**:
- Create `OKRCreationDrawer.tsx` component with Sheet/drawer UI
- Implement Step A: Objective basics form (title, description, owner, cycle, alignment)
- Add conditional rendering of "New Objective" button based on `canCreateObjective` flag
- Implement "Cancel" action (discard draft, close drawer)
- Implement "Save draft locally" action (store in localStorage, don't persist to backend yet)
- Add validation for Step A fields (title required, owner valid, cycle valid)

**Acceptance Criteria**:
- "New Objective" button only shows if `canCreateObjective === true`
- Clicking button opens right-side drawer
- Step A form collects all required fields
- Validation prevents proceeding if cycle is locked/archived (unless admin)
- "Cancel" closes drawer and discards data
- "Save draft locally" stores draft in localStorage (for Phase 2)

**Files to Modify**:
- `services/core-api/src/modules/okr/okr-overview.controller.ts` (add `canCreateObjective`)
- `apps/web/src/app/dashboard/okrs/page.tsx` (add drawer state, conditional button)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` (new file)

### Phase 2 – Full Wizard Data Model (W4.M2)

**Goal**: Implement Steps B, C, and D with backend integration. Wire up create calls and refresh.

**Backend Tasks**:
- Add `GET /okr/creation-context` endpoint (if not done in Phase 1) to return allowed visibility options and owners
- Ensure `objective.service.ts:create()` validates visibility permissions (PRIVATE/EXEC_ONLY restricted to admins)
- Ensure `key-result.service.ts:create()` validates KR owner permissions
- Add ActivityService logging for Objective and Key Result creation (if not already present)

**Frontend Tasks**:
- Implement Step B: Visibility & Access form (visibility level, whitelist)
- Implement Step C: Key Results form (repeatable KR blocks, add/remove)
- Implement Step D: Review & Publish summary view
- Wire up "Save as draft" action (POST `/objectives` with `isPublished: false`, then POST `/key-results` for each KR)
- Wire up "Publish" action (POST `/objectives` with `isPublished: true`, then POST `/key-results` for each KR)
- Implement error handling for create failures (show toast with error message)
- Implement success flow (close drawer, refresh OKR list via `handleReloadOKRs()`)
- Fetch allowed visibility options from backend (don't hardcode)
- Fetch allowed owners from backend (filter by tenant)

**Acceptance Criteria**:
- All 4 steps are functional
- Step B hides PRIVATE/EXEC_ONLY if user is not admin
- Step C allows adding multiple KRs inline
- Step D shows summary with governance warnings
- "Save as draft" creates draft Objective + KRs in backend
- "Publish" creates published Objective + KRs in backend
- On success, drawer closes and OKR list refreshes showing new OKR
- On error, toast shows error message and drawer stays open

**Files to Modify**:
- `services/core-api/src/modules/okr/okr-overview.controller.ts` (add creation context endpoint if separate)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` (implement Steps B, C, D)
- `apps/web/src/app/dashboard/okrs/page.tsx` (wire up refresh callback)

### Phase 3 – Governance Hardening + Telemetry (W4.M3)

**Goal**: Enforce locked-cycle / publish lock rules in UI and API. Block SUPERUSER writes. Add AuditLog and instrumentation.

**Backend Tasks**:
- Add AuditLog entries for Objective creation (`objective_created`) and Key Result creation (`key_result_created`)
- Inject `AuditLogService` into `ObjectiveService` and `KeyResultService`
- Add explicit SUPERUSER write blocking in `objective.service.ts:create()` (call `OkrTenantGuard.assertCanMutateTenant()`)
- Add explicit SUPERUSER write blocking in `key-result.service.ts:create()` (already present, verify)
- Ensure cycle lock check in `objective.service.ts:create()` throws `ForbiddenException` if cycle is LOCKED/ARCHIVED and user is not admin
- Add backend telemetry for creation success/failure with role distribution

**Frontend Tasks**:
- Add SUPERUSER warning in Review step (Step D)
- Add governance warnings in Review step (cycle locked, archived)
- Add telemetry instrumentation (drawer opened, step viewed, publish/draft saved, abandon, timing)
- Improve error messages for governance blocks (cycle locked, SUPERUSER, visibility permission)
- Add loading states during submission (disable buttons, show spinner)

**Acceptance Criteria**:
- SUPERUSER cannot successfully publish (backend blocks, UI shows warning)
- Cycle lock warnings appear in Step D if cycle is LOCKED/ARCHIVED
- AuditLog entries are created for all Objective and Key Result creations
- Telemetry events are logged for drawer interactions
- Error messages clearly explain why creation was blocked (governance, permissions, etc.)

**Files to Modify**:
- `services/core-api/src/modules/okr/objective.service.ts` (add AuditLog, verify SUPERUSER blocking)
- `services/core-api/src/modules/okr/key-result.service.ts` (add AuditLog, verify SUPERUSER blocking)
- `services/core-api/src/modules/audit/audit-log.service.ts` (verify AuditLogRecordParams supports needed fields)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` (add warnings, telemetry)

---

**End of Plan**

