# Multiple Owners Implementation Plan

**Feature:** Support multiple owners for Objectives and Key Results  
**Priority:** Phase 1 - Core OKR Experience  
**Estimated Effort:** 3-5 days

---

## Overview

Currently, Objectives and Key Results have a single `ownerId` field. This feature adds support for multiple owners while maintaining backward compatibility.

---

## Design Decisions

### 1. Backward Compatibility
- **Keep `ownerId` as primary owner** (required field)
- **Add junction tables** for additional owners
- **All existing code continues to work** (uses `ownerId`)
- **New code can use both** `ownerId` and `owners` relation

### 2. Owner Permissions
- **All owners have equal permissions** (no primary/secondary distinction)
- **Any owner can edit/delete** the OKR
- **All owners receive notifications** (overdue check-ins, updates, etc.)

### 3. Data Model
- **ObjectiveOwner** junction table (many-to-many)
- **KeyResultOwner** junction table (many-to-many)
- **Primary owner** (`ownerId`) is automatically included in owners list
- **No duplicate owners** (enforced by unique constraint)

---

## Database Schema

### New Models

```prisma
model ObjectiveOwner {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  objectiveId String
  objective   Objective @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation("ObjectiveOwnerUser", fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  createdBy   String?   // User who added this owner
  creator     User?     @relation("ObjectiveOwnerCreator", fields: [createdBy], references: [id], onDelete: SetNull)

  @@unique([tenantId, objectiveId, userId])
  @@index([tenantId])
  @@index([objectiveId])
  @@index([userId])
  @@map("objective_owners")
}

model KeyResultOwner {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  keyResultId String
  keyResult   KeyResult @relation(fields: [keyResultId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation("KeyResultOwnerUser", fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  createdBy   String?
  creator     User?     @relation("KeyResultOwnerCreator", fields: [createdBy], references: [id], onDelete: SetNull)

  @@unique([tenantId, keyResultId, userId])
  @@index([tenantId])
  @@index([keyResultId])
  @@index([userId])
  @@map("key_result_owners")
}
```

### Updates to Existing Models

**Objective Model:**
```prisma
model Objective {
  // ... existing fields ...
  ownerId           String // Primary owner (required, for backward compatibility)
  owner             User   @relation("ObjectiveOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  owners            ObjectiveOwner[] // Additional owners (junction table)
  // ... rest of fields ...
}
```

**KeyResult Model:**
```prisma
model KeyResult {
  // ... existing fields ...
  ownerId           String // Primary owner (required, for backward compatibility)
  owner             User   @relation("KeyResultOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  owners            KeyResultOwner[] // Additional owners (junction table)
  // ... rest of fields ...
}
```

**User Model:**
```prisma
model User {
  // ... existing fields ...
  objectiveOwnerships ObjectiveOwner[] @relation("ObjectiveOwnerUser")
  keyResultOwnerships KeyResultOwner[] @relation("KeyResultOwnerUser")
  // ... rest of fields ...
}
```

---

## Implementation Steps

### Step 1: Database Schema (Day 1 Morning)
- [ ] Add `ObjectiveOwner` model to schema
- [ ] Add `KeyResultOwner` model to schema
- [ ] Update `Objective` and `KeyResult` models with `owners` relation
- [ ] Update `User` model with ownership relations
- [ ] Create migration file
- [ ] Test migration

### Step 2: Backend Service Layer (Day 1 Afternoon)
- [ ] Create `ObjectiveOwnerService` with methods:
  - `addOwner(objectiveId, userId, tenantId, createdBy)`
  - `removeOwner(objectiveId, userId, tenantId)`
  - `getOwners(objectiveId, tenantId)` - Returns all owners (including primary)
  - `isOwner(objectiveId, userId, tenantId)` - Check if user is owner
- [ ] Create `KeyResultOwnerService` with same methods
- [ ] Update `ObjectiveService` to include `owners` in queries
- [ ] Update `KeyResultService` to include `owners` in queries
- [ ] Update permission checks to consider all owners

### Step 3: API Endpoints (Day 2 Morning)
- [ ] Add endpoints to `ObjectiveController`:
  - `POST /api/objectives/:id/owners` - Add owner
  - `DELETE /api/objectives/:id/owners/:userId` - Remove owner
  - `GET /api/objectives/:id/owners` - List all owners
- [ ] Add endpoints to `KeyResultController`:
  - `POST /api/key-results/:id/owners` - Add owner
  - `DELETE /api/key-results/:id/owners/:userId` - Remove owner
  - `GET /api/key-results/:id/owners` - List all owners
- [ ] Add validation and error handling
- [ ] Add RBAC checks (only owners/admins can add/remove owners)

### Step 4: Permission Updates (Day 2 Afternoon)
- [ ] Update `RBACService` to check all owners (not just `ownerId`)
- [ ] Update `canEditOKR` to check `owners` relation
- [ ] Update `canDeleteOKR` to check `owners` relation
- [ ] Update visibility checks if needed
- [ ] Test permission logic

### Step 5: Frontend Components (Day 3)
- [ ] Create `OwnerSelector` component (multi-select)
- [ ] Update `CreateObjectiveDrawer` to support multiple owners
- [ ] Update `EditObjectiveModal` to support multiple owners
- [ ] Update `CreateKeyResultDrawer` to support multiple owners
- [ ] Update `EditKeyResultDrawer` to support multiple owners
- [ ] Update `ObjectiveCard` to display all owners
- [ ] Update `ObjectiveRow` to display all owners
- [ ] Update `KeyResult` display components

### Step 6: Import Service Updates (Day 4 Morning)
- [ ] Update `importObjective` to create `ObjectiveOwner` records for additional owners
- [ ] Update `importKeyResult` to create `KeyResultOwner` records for additional owners
- [ ] Ensure primary owner (`ownerId`) is set correctly
- [ ] Test import with Viva Goals data

### Step 7: Testing & Documentation (Day 4 Afternoon - Day 5)
- [ ] Unit tests for owner services
- [ ] Integration tests for API endpoints
- [ ] E2E tests for UI components
- [ ] Test permission checks with multiple owners
- [ ] Test import/export
- [ ] Update API documentation
- [ ] Update user guide

---

## API Design

### Add Owner
```typescript
POST /api/objectives/:id/owners
Body: { userId: string }
Response: { id: string, userId: string, userName: string, userEmail: string, createdAt: string }
```

### Remove Owner
```typescript
DELETE /api/objectives/:id/owners/:userId
Response: { success: true }
```

### List Owners
```typescript
GET /api/objectives/:id/owners
Response: Array<{
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  isPrimary: boolean; // true if userId === objective.ownerId
  createdAt: string;
}>
```

---

## Permission Logic

### Who Can Add/Remove Owners?
- **Current owners** (any owner can add/remove other owners)
- **Team leads** (if OKR belongs to their team)
- **Workspace owners** (if OKR belongs to their workspace)
- **Organization admins** (if OKR belongs to their org)
- **Superusers** (always)

### Who Can Edit/Delete OKR?
- **Any owner** (including primary owner)
- **Team leads** (if OKR belongs to their team)
- **Workspace owners** (if OKR belongs to their workspace)
- **Organization admins** (if OKR belongs to their org)
- **Superusers** (always)

### Can Primary Owner Be Removed?
- **No** - Primary owner (`ownerId`) cannot be removed
- **To change primary owner**: Must update `ownerId` field (separate operation)
- **Or**: Remove primary owner from `owners` junction table, but `ownerId` remains

---

## Migration Strategy

### Data Migration
- **No migration needed** - Existing data works as-is
- **Primary owner** (`ownerId`) is automatically considered an owner
- **New owners** are added via junction table

### Backward Compatibility
- **All existing queries work** - They use `ownerId`
- **New queries can use** `owners` relation for multiple owners
- **Frontend can gradually migrate** to show multiple owners

---

## UI/UX Considerations

### Owner Display
- **Show all owners** in OKR cards/lists
- **Primary owner** can be highlighted (optional)
- **Avatar list** for multiple owners
- **"+N more"** if too many owners

### Owner Selection
- **Multi-select dropdown** for adding owners
- **Search/filter** users when selecting
- **Show current owners** with remove buttons
- **Prevent duplicate owners** (validation)

### Owner Management
- **Settings/Edit modal** to manage owners
- **Remove owner** button (with confirmation)
- **Cannot remove primary owner** (disable button or show message)

---

## Testing Checklist

### Backend Tests
- [ ] Add owner to objective
- [ ] Remove owner from objective
- [ ] List all owners (includes primary)
- [ ] Prevent duplicate owners
- [ ] Permission checks (only owners can add/remove)
- [ ] Cannot remove primary owner
- [ ] Cascade delete (when OKR deleted, owners deleted)
- [ ] Tenant isolation (can't add owner from different tenant)

### Frontend Tests
- [ ] Display multiple owners
- [ ] Add owner via UI
- [ ] Remove owner via UI
- [ ] Validation (no duplicates)
- [ ] Permission checks (hide add/remove if no permission)

### Integration Tests
- [ ] Import with multiple owners
- [ ] Export with multiple owners
- [ ] Permission checks work correctly
- [ ] Notifications sent to all owners

---

## Success Criteria

- [ ] Multiple owners can be assigned to Objectives
- [ ] Multiple owners can be assigned to Key Results
- [ ] All owners have equal permissions
- [ ] Primary owner is always included
- [ ] Backward compatibility maintained
- [ ] UI displays all owners
- [ ] Import/export works correctly
- [ ] Permission checks work correctly
- [ ] No performance degradation

---

## Future Enhancements (Not in Scope)

- Owner roles (primary/secondary)
- Owner permissions (some owners can edit, others can only view)
- Owner notifications preferences
- Owner assignment history/audit

---

## Files to Create/Modify

### New Files
- `services/core-api/src/modules/okr/objective-owner.service.ts`
- `services/core-api/src/modules/okr/key-result-owner.service.ts`
- `apps/web/src/components/okr/OwnerSelector.tsx`
- `apps/web/src/components/okr/OwnerList.tsx`

### Modified Files
- `services/core-api/prisma/schema.prisma`
- `services/core-api/src/modules/okr/objective.service.ts`
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/objective.controller.ts`
- `services/core-api/src/modules/okr/key-result.controller.ts`
- `services/core-api/src/modules/rbac/rbac.service.ts`
- `services/core-api/src/modules/okr/okr-import.service.ts`
- `apps/web/src/components/okr/CreateObjectiveDrawer.tsx`
- `apps/web/src/components/okr/EditObjectiveModal.tsx`
- `apps/web/src/components/okr/ObjectiveCard.tsx`
- `apps/web/src/components/okr/ObjectiveRow.tsx`

---

## Next Steps

1. Review this plan
2. Start with Step 1: Database Schema
3. Implement step by step
4. Test thoroughly
5. Deploy

