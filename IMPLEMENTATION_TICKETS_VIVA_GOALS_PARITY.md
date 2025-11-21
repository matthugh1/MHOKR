# Implementation Tickets: Viva Goals Feature Parity

**Created:** 2025-01-23  
**Priority:** Critical for Enterprise Customers  
**Target:** Full Viva Goals feature parity

---

## Ticket 1: Phased Targets / Milestones

**Priority:** 🔴 CRITICAL  
**Estimated Effort:** 2 weeks  
**Dependencies:** None

### Description
Implement phased targets (milestones) for Objectives and Key Results. Phased targets allow organizations to set intermediate goals with target values and dates (e.g., monthly or quarterly milestones).

### Acceptance Criteria
- [ ] Database schema supports phased targets with intervals (monthly, quarterly, custom)
- [ ] API endpoints for CRUD operations on phased targets
- [ ] UI components for viewing and editing phased targets
- [ ] Progress visualization showing milestones on timeline
- [ ] Import/export support for phased targets
- [ ] Validation: target dates must be within OKR start/end date range
- [ ] Validation: target values must be in correct order (ascending/descending based on metric type)

### Technical Details

**Database Schema:**
```prisma
model PhasedTarget {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  objectiveId   String?
  objective     Objective? @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  keyResultId   String?
  keyResult     KeyResult? @relation(fields: [keyResultId], references: [id], onDelete: Cascade)
  interval      PhasedTargetInterval // MONTHLY, QUARTERLY, CUSTOM
  targetValue   Float
  targetDate    DateTime
  order         Int       // Order of this milestone (1, 2, 3...)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([tenantId])
  @@index([objectiveId])
  @@index([keyResultId])
  @@index([targetDate])
  @@map("phased_targets")
}

enum PhasedTargetInterval {
  MONTHLY
  QUARTERLY
  CUSTOM
}
```

**API Endpoints:**
- `POST /api/objectives/:id/phased-targets` - Create phased target
- `GET /api/objectives/:id/phased-targets` - List phased targets
- `PUT /api/phased-targets/:id` - Update phased target
- `DELETE /api/phased-targets/:id` - Delete phased target
- Same endpoints for Key Results

**UI Components:**
- PhasedTargetTimeline component
- PhasedTargetEditor component
- Milestone indicators on progress charts

### Files to Create/Modify
- `services/core-api/prisma/schema.prisma` - Add PhasedTarget model
- `services/core-api/src/modules/okr/phased-target.service.ts` - New service
- `services/core-api/src/modules/okr/phased-target.controller.ts` - New controller
- `apps/web/src/components/okr/PhasedTargetTimeline.tsx` - New component
- `apps/web/src/components/okr/PhasedTargetEditor.tsx` - New component

---

## Ticket 2: Granular Permissions (View/Edit/Align)

**Priority:** 🔴 CRITICAL  
**Estimated Effort:** 2-3 weeks  
**Dependencies:** Permission service exists

### Description
Implement granular permission controls for OKRs, allowing separate control over View, Edit, and Align permissions. This enables fine-grained access control at the OKR level.

### Acceptance Criteria
- [ ] Database schema supports granular permissions (View/Edit/Align)
- [ ] Permission service checks granular permissions
- [ ] API endpoints for managing OKR permissions
- [ ] UI for setting permissions per OKR
- [ ] Permission inheritance from parent OKRs (optional)
- [ ] Audit logging for permission changes
- [ ] Import/export support for permissions

### Technical Details

**Database Schema:**
```prisma
model OkrPermission {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  entityType    EntityType // OBJECTIVE or KEY_RESULT
  entityId      String
  viewPermission OkrPermissionLevel @default(EVERYBODY)
  editPermission OkrPermissionLevel @default(OWNER_ONLY)
  alignPermission OkrPermissionLevel @default(EVERYBODY)
  // Specific users/teams for custom permissions
  viewUsers     String[]  @default([]) // User IDs
  viewTeams     String[]  @default([]) // Team IDs
  editUsers     String[]  @default([])
  editTeams     String[]  @default([])
  alignUsers    String[]  @default([])
  alignTeams    String[]  @default([])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([tenantId, entityType, entityId])
  @@index([tenantId])
  @@index([entityType, entityId])
  @@map("okr_permissions")
}

enum OkrPermissionLevel {
  EVERYBODY      // All users in tenant
  TEAM_MEMBERS   // Only team members
  OWNER_ONLY     // Only owner
  CUSTOM         // Custom list of users/teams
}
```

**Permission Logic:**
- `EVERYBODY`: All users in tenant can perform action
- `TEAM_MEMBERS`: Only users in the same team(s) as the OKR
- `OWNER_ONLY`: Only the owner (and delegated user if applicable)
- `CUSTOM`: Only users/teams in the specific arrays

**API Endpoints:**
- `GET /api/okrs/:type/:id/permissions` - Get permissions
- `PUT /api/okrs/:type/:id/permissions` - Update permissions
- `POST /api/okrs/:type/:id/permissions/test` - Test if user has permission

**Files to Create/Modify:**
- `services/core-api/prisma/schema.prisma` - Add OkrPermission model
- `services/core-api/src/modules/permissions/okr-permission.service.ts` - New service
- `services/core-api/src/modules/permissions/okr-permission.controller.ts` - New controller
- `services/core-api/src/modules/permissions/permission.service.ts` - Update to check granular permissions
- `apps/web/src/components/okr/PermissionSettings.tsx` - New component

---

## Ticket 3: OKR Delegation

**Priority:** 🔴 CRITICAL  
**Estimated Effort:** 1-2 weeks  
**Dependencies:** None

### Description
Allow OKR owners to delegate OKRs to other users while maintaining the original owner for audit purposes. Delegated users have the same permissions as owners.

### Acceptance Criteria
- [ ] Database schema supports delegation
- [ ] API endpoints for delegating/undelegating OKRs
- [ ] UI for delegating OKRs
- [ ] Permission checks consider delegated users
- [ ] Audit trail shows both original owner and delegated user
- [ ] Import/export support for delegation
- [ ] Notification to delegated user when OKR is delegated

### Technical Details

**Database Schema:**
```prisma
// Add to Objective model:
delegatedToId   String?
delegatedTo     User? @relation("ObjectiveDelegatedTo", fields: [delegatedToId], references: [id], onDelete: SetNull)
delegatedAt     DateTime?
delegatedBy     String? // User who delegated
delegator       User? @relation("ObjectiveDelegator", fields: [delegatedBy], references: [id], onDelete: SetNull)

// Add to KeyResult model:
delegatedToId   String?
delegatedTo     User? @relation("KeyResultDelegatedTo", fields: [delegatedToId], references: [id], onDelete: SetNull)
delegatedAt     DateTime?
delegatedBy     String?
delegator       User? @relation("KeyResultDelegator", fields: [delegatedBy], references: [id], onDelete: SetNull)
```

**Permission Logic:**
- Check both `ownerId` and `delegatedToId` when checking ownership
- Display both original owner and delegated user in UI
- Original owner can always undelegate

**API Endpoints:**
- `POST /api/objectives/:id/delegate` - Delegate objective
- `DELETE /api/objectives/:id/delegate` - Undelegate objective
- Same for Key Results

**Files to Create/Modify:**
- `services/core-api/prisma/schema.prisma` - Add delegation fields
- `services/core-api/src/modules/okr/objective.service.ts` - Add delegation methods
- `services/core-api/src/modules/okr/key-result.service.ts` - Add delegation methods
- `services/core-api/src/modules/permissions/permission.service.ts` - Update ownership checks
- `apps/web/src/components/okr/DelegationSettings.tsx` - New component

---

## Ticket 4: Check-in Owners (Separate from OKR Owners)

**Priority:** 🔴 CRITICAL  
**Estimated Effort:** 1-2 weeks  
**Dependencies:** Check-in system exists

### Description
Allow assigning separate "check-in owners" who are responsible for updating check-ins, independent of the OKR owner. This is useful when OKR owner ≠ person doing updates.

### Acceptance Criteria
- [ ] Database schema supports check-in owners
- [ ] API endpoints for managing check-in owners
- [ ] UI for assigning check-in owners
- [ ] Check-in permissions check check-in owners
- [ ] Import/export support for check-in owners
- [ ] Notification to check-in owners for overdue check-ins

### Technical Details

**Database Schema:**
```prisma
// Junction table for check-in owners
model OkrCheckInOwner {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  entityType    EntityType // OBJECTIVE or KEY_RESULT
  entityId      String
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt     DateTime  @default(now())
  createdBy     String
  creator       User      @relation("CheckInOwnerCreator", fields: [createdBy], references: [id], onDelete: SetNull)

  @@unique([tenantId, entityType, entityId, userId])
  @@index([tenantId])
  @@index([entityType, entityId])
  @@index([userId])
  @@map("okr_check_in_owners")
}
```

**Permission Logic:**
- Check-in owners can create/update check-ins for their assigned OKRs
- OKR owners are automatically check-in owners (unless explicitly removed)
- Check-in owners receive overdue check-in notifications

**API Endpoints:**
- `POST /api/okrs/:type/:id/check-in-owners` - Add check-in owner
- `GET /api/okrs/:type/:id/check-in-owners` - List check-in owners
- `DELETE /api/okrs/:type/:id/check-in-owners/:userId` - Remove check-in owner

**Files to Create/Modify:**
- `services/core-api/prisma/schema.prisma` - Add OkrCheckInOwner model
- `services/core-api/src/modules/okr/check-in-owner.service.ts` - New service
- `services/core-api/src/modules/okr/check-in.service.ts` - Update permission checks
- `apps/web/src/components/okr/CheckInOwnerSettings.tsx` - New component

---

## Ticket 5: Progress and Status Configuration

**Priority:** 🔴 CRITICAL  
**Estimated Effort:** 1-2 weeks  
**Dependencies:** Progress calculation logic exists

### Description
Allow configuring how progress and status are updated (auto from children/KRs, manual, or from data source). This is critical for organizations using integrations.

### Acceptance Criteria
- [ ] Database schema supports progress/status configuration
- [ ] API endpoints for updating configuration
- [ ] UI for setting configuration
- [ ] Progress calculation respects configuration
- [ ] Status calculation respects configuration
- [ ] Data source tracking for integrations
- [ ] Import/export support for configuration

### Technical Details

**Database Schema:**
```prisma
// Add to Objective model:
progressUpdateMethod ProgressUpdateMethod @default(AUTO_FROM_CHILDREN)
statusUpdateMethod   StatusUpdateMethod   @default(AUTO_FROM_PROGRESS)
dataSource           String?              // Integration source (e.g., "SALESFORCE", "JIRA")
dataSourceId         String?              // External ID in data source
lastDataSourceSync   DateTime?

// Add to KeyResult model:
progressUpdateMethod ProgressUpdateMethod @default(AUTO_FROM_CHECKINS)
statusUpdateMethod   StatusUpdateMethod   @default(AUTO_FROM_PROGRESS)
dataSource           String?
dataSourceId         String?
lastDataSourceSync   DateTime?

enum ProgressUpdateMethod {
  AUTO_FROM_CHILDREN    // For Objectives: auto-calculate from children
  AUTO_FROM_KRS         // For Objectives: auto-calculate from Key Results
  AUTO_FROM_CHECKINS    // For Key Results: auto-calculate from check-ins
  MANUAL                // Manual updates only
  DATA_SOURCE           // From integration
}

enum StatusUpdateMethod {
  AUTO_FROM_PROGRESS    // Auto-update based on progress thresholds
  MANUAL                // Manual updates only
}
```

**Progress Calculation Logic:**
- `AUTO_FROM_CHILDREN`: Calculate from child objectives (weighted average)
- `AUTO_FROM_KRS`: Calculate from linked Key Results (weighted average)
- `AUTO_FROM_CHECKINS`: Calculate from latest check-in value
- `MANUAL`: Don't auto-calculate, require manual updates
- `DATA_SOURCE`: Pull from integration (requires integration service)

**Status Calculation Logic:**
- `AUTO_FROM_PROGRESS`: Update status based on progress thresholds:
  - 0-50%: ON_TRACK (if on schedule) or AT_RISK (if behind)
  - 50-75%: ON_TRACK or AT_RISK
  - 75-100%: ON_TRACK or COMPLETED
- `MANUAL`: Don't auto-update status

**API Endpoints:**
- `PUT /api/objectives/:id/progress-config` - Update progress configuration
- `PUT /api/key-results/:id/progress-config` - Update progress configuration

**Files to Create/Modify:**
- `services/core-api/prisma/schema.prisma` - Add configuration fields
- `services/core-api/src/modules/okr/objective.service.ts` - Update progress calculation
- `services/core-api/src/modules/okr/key-result.service.ts` - Update progress calculation
- `apps/web/src/components/okr/ProgressConfigSettings.tsx` - New component

---

## Ticket 6: Alignment Weights

**Priority:** 🟡 IMPORTANT  
**Estimated Effort:** 1 week  
**Dependencies:** Alignment system exists

### Description
Expose and allow editing alignment weights between OKRs. Weights are used in weighted progress calculations when multiple OKRs contribute to a parent.

### Acceptance Criteria
- [ ] API exposes weights in alignment relationships
- [ ] UI for setting alignment weights
- [ ] Progress calculation uses weights
- [ ] Import/export support for weights
- [ ] Validation: weights must be >= 0

### Technical Details

**Database Schema:**
- Already exists: `ObjectiveKeyResult.weight` (defaults to 1.0)
- Need to add weight to parent-child Objective relationships

```prisma
// Add to Objective model (already has weight field, but need to ensure it's used)
// Weight is already in schema at line 237
```

**API Changes:**
- Include weight in alignment API responses
- Add endpoint to update weight: `PUT /api/objectives/:id/alignment/:parentId/weight`

**Progress Calculation:**
- Update weighted average calculation to use weights
- Formula: `weighted_progress = Σ(child.progress * child.weight) / Σ(child.weight)`

**Files to Modify:**
- `services/core-api/src/modules/okr/objective.service.ts` - Update progress calculation
- `services/core-api/src/modules/okr/objective.controller.ts` - Add weight endpoint
- `apps/web/src/components/okr/AlignmentWeightEditor.tsx` - New component

---

## Ticket 7: Team Hierarchy and Status

**Priority:** 🟡 IMPORTANT  
**Estimated Effort:** 1 week  
**Dependencies:** Team model exists

### Description
Add support for team hierarchies (parent teams), team types (Classic/Modern), and team status (Active/Archived).

### Acceptance Criteria
- [ ] Database schema supports parent teams
- [ ] Database schema supports team type and status
- [ ] API endpoints for team hierarchy operations
- [ ] UI for managing team hierarchy
- [ ] Filter archived teams from active views
- [ ] Import/export support

### Technical Details

**Database Schema:**
```prisma
// Update Team model:
parentTeamId    String?
parentTeam      Team?   @relation("TeamHierarchy", fields: [parentTeamId], references: [id], onDelete: SetNull)
childTeams      Team[]  @relation("TeamHierarchy")
teamType        TeamType @default(CLASSIC)
status          TeamStatus @default(ACTIVE)
ownerId         String? // Primary team owner
owner           User?   @relation("TeamOwner", fields: [ownerId], references: [id], onDelete: SetNull)

enum TeamType {
  CLASSIC
  MODERN
}

enum TeamStatus {
  ACTIVE
  ARCHIVED
}
```

**API Endpoints:**
- `GET /api/teams/:id/hierarchy` - Get team hierarchy
- `PUT /api/teams/:id/parent` - Update parent team
- `PUT /api/teams/:id/status` - Update team status

**Files to Modify:**
- `services/core-api/prisma/schema.prisma` - Update Team model
- `services/core-api/src/modules/teams/team.service.ts` - Add hierarchy methods
- `apps/web/src/components/teams/TeamHierarchy.tsx` - New component

---

## Ticket 8: Last Check-in Tracking

**Priority:** 🟡 IMPORTANT  
**Estimated Effort:** 3 days  
**Dependencies:** Check-in system exists

### Description
Track the last check-in date on Objectives and Key Results for identifying stale OKRs.

### Acceptance Criteria
- [ ] Database schema tracks last check-in date
- [ ] Update last check-in date on check-in creation
- [ ] API exposes last check-in date
- [ ] UI shows last check-in date
- [ ] Filter/search by last check-in date
- [ ] Import/export support

### Technical Details

**Database Schema:**
```prisma
// Add to Objective model:
lastCheckInAt   DateTime?

// Add to KeyResult model:
lastCheckInAt   DateTime?
```

**Update Logic:**
- Update `lastCheckInAt` when check-in is created
- Use `activityDate` from check-in if available, otherwise use `createdAt`

**API:**
- Include `lastCheckInAt` in Objective/KeyResult responses
- Add filter: `?lastCheckInBefore=2024-01-01` for stale OKRs

**Files to Modify:**
- `services/core-api/prisma/schema.prisma` - Add lastCheckInAt fields
- `services/core-api/src/modules/okr/check-in.service.ts` - Update lastCheckInAt
- `apps/web/src/components/okr/LastCheckInBadge.tsx` - New component

---

## Ticket 9: Check-in Activity Date

**Priority:** 🟢 NICE TO HAVE  
**Estimated Effort:** 2 days  
**Dependencies:** Check-in system exists

### Description
Support separate activity date for check-ins (what date the check-in refers to) vs. creation date (when check-in was entered).

### Acceptance Criteria
- [ ] Database schema supports activity date
- [ ] API accepts activity date on check-in creation
- [ ] UI allows setting activity date
- [ ] Default to creation date if not specified
- [ ] Import/export support

### Technical Details

**Database Schema:**
```prisma
// Update CheckIn model:
activityDate    DateTime? // What date the check-in refers to (defaults to createdAt)
```

**API:**
- Accept `activityDate` in check-in creation request
- Default to `createdAt` if not provided

**Files to Modify:**
- `services/core-api/prisma/schema.prisma` - Add activityDate
- `services/core-api/src/modules/okr/check-in.service.ts` - Handle activityDate
- `apps/web/src/components/okr/CheckInForm.tsx` - Add activity date picker

---

## Ticket 10: Check-in HTML Notes

**Priority:** 🟢 NICE TO HAVE  
**Estimated Effort:** 1 week  
**Dependencies:** Check-in system exists

### Description
Support HTML-formatted notes in check-ins for better formatting and rich text.

### Acceptance Criteria
- [ ] Database schema supports HTML notes
- [ ] Rich text editor for check-in notes
- [ ] Convert markdown to HTML (optional)
- [ ] Sanitize HTML for security
- [ ] Import/export support

### Technical Details

**Database Schema:**
```prisma
// Update CheckIn model:
noteHtml        String? @db.Text // HTML-formatted note
```

**Implementation:**
- Use rich text editor (e.g., TipTap, Quill)
- Sanitize HTML on save (use DOMPurify or similar)
- Store both plain text (`note`) and HTML (`noteHtml`)

**Files to Modify:**
- `services/core-api/prisma/schema.prisma` - Add noteHtml
- `apps/web/src/components/okr/CheckInForm.tsx` - Add rich text editor
- `services/core-api/src/modules/okr/check-in.service.ts` - Sanitize HTML

---

## Implementation Timeline

### Phase 1: Critical Features (Weeks 1-4)
- Week 1-2: Ticket 1 (Phased Targets)
- Week 2-3: Ticket 2 (Granular Permissions)
- Week 3-4: Ticket 3 (Delegation) + Ticket 4 (Check-in Owners)

### Phase 2: Important Features (Weeks 5-8)
- Week 5: Ticket 5 (Progress/Status Configuration)
- Week 6: Ticket 6 (Alignment Weights)
- Week 7: Ticket 7 (Team Hierarchy)
- Week 8: Ticket 8 (Last Check-in Tracking)

### Phase 3: Enhancements (Weeks 9-10)
- Week 9: Ticket 9 (Activity Date) + Ticket 10 (HTML Notes)

---

## Testing Requirements

Each ticket must include:
- Unit tests for service methods
- Integration tests for API endpoints
- E2E tests for UI components
- Migration tests for database changes
- Import/export tests for Viva Goals compatibility

---

## Documentation Requirements

Each ticket must include:
- API documentation updates
- Database migration scripts
- User guide updates
- Developer documentation

