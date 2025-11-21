# Database Schema Design: Viva Goals Feature Parity

**Created:** 2025-01-23  
**Purpose:** Complete database schema designs for all missing Viva Goals features

---

## 1. Phased Targets / Milestones

### Schema Design

```prisma
model PhasedTarget {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Organization @relation("PhasedTargetTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Link to either Objective or KeyResult (not both)
  objectiveId   String?
  objective     Objective? @relation("ObjectivePhasedTargets", fields: [objectiveId], references: [id], onDelete: Cascade)
  keyResultId   String?
  keyResult     KeyResult? @relation("KeyResultPhasedTargets", fields: [keyResultId], references: [id], onDelete: Cascade)
  
  // Phased target details
  interval      PhasedTargetInterval // MONTHLY, QUARTERLY, CUSTOM
  targetValue   Float
  targetDate    DateTime
  order         Int       // Order of this milestone (1, 2, 3...) for sorting
  description   String?   @db.Text // Optional description for milestone
  
  // Metadata
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdBy     String?
  creator       User?     @relation("PhasedTargetCreator", fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([objectiveId])
  @@index([keyResultId])
  @@index([targetDate])
  @@index([order])
  @@map("phased_targets")
}

enum PhasedTargetInterval {
  MONTHLY
  QUARTERLY
  CUSTOM
}
```

### Updates to Existing Models

**Objective Model:**
```prisma
model Objective {
  // ... existing fields ...
  phasedTargets PhasedTarget[] @relation("ObjectivePhasedTargets")
  // ... rest of fields ...
}
```

**KeyResult Model:**
```prisma
model KeyResult {
  // ... existing fields ...
  phasedTargets PhasedTarget[] @relation("KeyResultPhasedTargets")
  // ... rest of fields ...
}
```

### Migration SQL

```sql
-- Create PhasedTargetInterval enum
CREATE TYPE "PhasedTargetInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'CUSTOM');

-- Create phased_targets table
CREATE TABLE "phased_targets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "keyResultId" TEXT,
    "interval" "PhasedTargetInterval" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "phased_targets_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_objectiveId_fkey" 
    FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_keyResultId_fkey" 
    FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "phased_targets_tenantId_idx" ON "phased_targets"("tenantId");
CREATE INDEX "phased_targets_objectiveId_idx" ON "phased_targets"("objectiveId");
CREATE INDEX "phased_targets_keyResultId_idx" ON "phased_targets"("keyResultId");
CREATE INDEX "phased_targets_targetDate_idx" ON "phased_targets"("targetDate");
CREATE INDEX "phased_targets_order_idx" ON "phased_targets"("order");

-- Add constraint: must have either objectiveId or keyResultId, not both
ALTER TABLE "phased_targets" ADD CONSTRAINT "phased_targets_objective_or_keyresult_check" 
    CHECK (("objectiveId" IS NULL AND "keyResultId" IS NOT NULL) OR 
           ("objectiveId" IS NOT NULL AND "keyResultId" IS NULL));
```

---

## 2. Granular Permissions

### Schema Design

```prisma
model OkrPermission {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Organization @relation("OkrPermissionTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Link to OKR entity
  entityType    EntityType // OBJECTIVE or KEY_RESULT
  entityId      String
  
  // Permission levels
  viewPermission OkrPermissionLevel @default(EVERYBODY)
  editPermission OkrPermissionLevel @default(OWNER_ONLY)
  alignPermission OkrPermissionLevel @default(EVERYBODY)
  
  // Custom permission lists (for CUSTOM level)
  viewUsers     String[]  @default([]) // User IDs
  viewTeams     String[]  @default([]) // Team IDs
  editUsers     String[]  @default([])
  editTeams     String[]  @default([])
  alignUsers    String[]  @default([])
  alignTeams    String[]  @default([])
  
  // Metadata
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdBy     String?
  creator       User?     @relation("OkrPermissionCreator", fields: [createdBy], references: [id], onDelete: SetNull)

  @@unique([tenantId, entityType, entityId])
  @@index([tenantId])
  @@index([entityType, entityId])
  @@map("okr_permissions")
}

enum OkrPermissionLevel {
  EVERYBODY      // All users in tenant
  TEAM_MEMBERS   // Only team members
  OWNER_ONLY     // Only owner (and delegated user)
  CUSTOM         // Custom list of users/teams
}
```

### Migration SQL

```sql
-- Create OkrPermissionLevel enum
CREATE TYPE "OkrPermissionLevel" AS ENUM ('EVERYBODY', 'TEAM_MEMBERS', 'OWNER_ONLY', 'CUSTOM');

-- Create okr_permissions table
CREATE TABLE "okr_permissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "viewPermission" "OkrPermissionLevel" NOT NULL DEFAULT 'EVERYBODY',
    "editPermission" "OkrPermissionLevel" NOT NULL DEFAULT 'OWNER_ONLY',
    "alignPermission" "OkrPermissionLevel" NOT NULL DEFAULT 'EVERYBODY',
    "viewUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "viewTeams" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editTeams" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alignUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alignTeams" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "okr_permissions_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "okr_permissions" ADD CONSTRAINT "okr_permissions_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "okr_permissions" ADD CONSTRAINT "okr_permissions_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unique constraint
CREATE UNIQUE INDEX "okr_permissions_tenantId_entityType_entityId_key" 
    ON "okr_permissions"("tenantId", "entityType", "entityId");

-- Add indexes
CREATE INDEX "okr_permissions_tenantId_idx" ON "okr_permissions"("tenantId");
CREATE INDEX "okr_permissions_entityType_entityId_idx" ON "okr_permissions"("entityType", "entityId");
```

---

## 3. OKR Delegation

### Schema Design

**Updates to Objective Model:**
```prisma
model Objective {
  // ... existing fields ...
  
  // Delegation fields
  delegatedToId   String?
  delegatedTo     User? @relation("ObjectiveDelegatedTo", fields: [delegatedToId], references: [id], onDelete: SetNull)
  delegatedAt     DateTime?
  delegatedBy     String? // User who delegated
  delegator       User? @relation("ObjectiveDelegator", fields: [delegatedBy], references: [id], onDelete: SetNull)
  
  // ... rest of fields ...
}
```

**Updates to KeyResult Model:**
```prisma
model KeyResult {
  // ... existing fields ...
  
  // Delegation fields
  delegatedToId   String?
  delegatedTo     User? @relation("KeyResultDelegatedTo", fields: [delegatedToId], references: [id], onDelete: SetNull)
  delegatedAt     DateTime?
  delegatedBy     String?
  delegator       User? @relation("KeyResultDelegator", fields: [delegatedBy], references: [id], onDelete: SetNull)
  
  // ... rest of fields ...
}
```

**Updates to User Model:**
```prisma
model User {
  // ... existing fields ...
  
  // Delegation relations
  delegatedObjectives Objective[] @relation("ObjectiveDelegatedTo")
  delegatedKeyResults KeyResult[] @relation("KeyResultDelegatedTo")
  delegatedObjectivesBy Objective[] @relation("ObjectiveDelegator")
  delegatedKeyResultsBy KeyResult[] @relation("KeyResultDelegator")
  
  // ... rest of fields ...
}
```

### Migration SQL

```sql
-- Add delegation fields to objectives
ALTER TABLE "objectives" ADD COLUMN "delegatedToId" TEXT;
ALTER TABLE "objectives" ADD COLUMN "delegatedAt" TIMESTAMP(3);
ALTER TABLE "objectives" ADD COLUMN "delegatedBy" TEXT;

-- Add foreign keys
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_delegatedToId_fkey" 
    FOREIGN KEY ("delegatedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_delegatedBy_fkey" 
    FOREIGN KEY ("delegatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "objectives_delegatedToId_idx" ON "objectives"("delegatedToId");
CREATE INDEX "objectives_delegatedBy_idx" ON "objectives"("delegatedBy");

-- Add delegation fields to key_results
ALTER TABLE "key_results" ADD COLUMN "delegatedToId" TEXT;
ALTER TABLE "key_results" ADD COLUMN "delegatedAt" TIMESTAMP(3);
ALTER TABLE "key_results" ADD COLUMN "delegatedBy" TEXT;

-- Add foreign keys
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_delegatedToId_fkey" 
    FOREIGN KEY ("delegatedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_delegatedBy_fkey" 
    FOREIGN KEY ("delegatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "key_results_delegatedToId_idx" ON "key_results"("delegatedToId");
CREATE INDEX "key_results_delegatedBy_idx" ON "key_results"("delegatedBy");
```

---

## 4. Check-in Owners

### Schema Design

```prisma
model OkrCheckInOwner {
  id            String    @id @default(cuid())
  tenantId      String
  tenant        Organization @relation("CheckInOwnerTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Link to OKR entity
  entityType    EntityType // OBJECTIVE or KEY_RESULT
  entityId      String
  userId        String
  user          User      @relation("CheckInOwnerUser", fields: [userId], references: [id], onDelete: Cascade)
  
  // Metadata
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

**Updates to User Model:**
```prisma
model User {
  // ... existing fields ...
  checkInOwnerships OkrCheckInOwner[] @relation("CheckInOwnerUser")
  // ... rest of fields ...
}
```

### Migration SQL

```sql
-- Create okr_check_in_owners table
CREATE TABLE "okr_check_in_owners" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "okr_check_in_owners_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "okr_check_in_owners" ADD CONSTRAINT "okr_check_in_owners_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "okr_check_in_owners" ADD CONSTRAINT "okr_check_in_owners_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "okr_check_in_owners" ADD CONSTRAINT "okr_check_in_owners_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unique constraint
CREATE UNIQUE INDEX "okr_check_in_owners_tenantId_entityType_entityId_userId_key" 
    ON "okr_check_in_owners"("tenantId", "entityType", "entityId", "userId");

-- Add indexes
CREATE INDEX "okr_check_in_owners_tenantId_idx" ON "okr_check_in_owners"("tenantId");
CREATE INDEX "okr_check_in_owners_entityType_entityId_idx" ON "okr_check_in_owners"("entityType", "entityId");
CREATE INDEX "okr_check_in_owners_userId_idx" ON "okr_check_in_owners"("userId");
```

---

## 5. Progress and Status Configuration

### Schema Design

**Updates to Objective Model:**
```prisma
model Objective {
  // ... existing fields ...
  
  // Progress and status configuration
  progressUpdateMethod ProgressUpdateMethod @default(AUTO_FROM_CHILDREN)
  statusUpdateMethod   StatusUpdateMethod   @default(AUTO_FROM_PROGRESS)
  dataSource           String?              // Integration source (e.g., "SALESFORCE", "JIRA")
  dataSourceId         String?              // External ID in data source
  lastDataSourceSync   DateTime?
  
  // ... rest of fields ...
}
```

**Updates to KeyResult Model:**
```prisma
model KeyResult {
  // ... existing fields ...
  
  // Progress and status configuration
  progressUpdateMethod ProgressUpdateMethod @default(AUTO_FROM_CHECKINS)
  statusUpdateMethod   StatusUpdateMethod   @default(AUTO_FROM_PROGRESS)
  dataSource           String?
  dataSourceId         String?
  lastDataSourceSync   DateTime?
  
  // ... rest of fields ...
}
```

**New Enums:**
```prisma
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

### Migration SQL

```sql
-- Create ProgressUpdateMethod enum
CREATE TYPE "ProgressUpdateMethod" AS ENUM (
    'AUTO_FROM_CHILDREN',
    'AUTO_FROM_KRS',
    'AUTO_FROM_CHECKINS',
    'MANUAL',
    'DATA_SOURCE'
);

-- Create StatusUpdateMethod enum
CREATE TYPE "StatusUpdateMethod" AS ENUM (
    'AUTO_FROM_PROGRESS',
    'MANUAL'
);

-- Add fields to objectives
ALTER TABLE "objectives" ADD COLUMN "progressUpdateMethod" "ProgressUpdateMethod" NOT NULL DEFAULT 'AUTO_FROM_CHILDREN';
ALTER TABLE "objectives" ADD COLUMN "statusUpdateMethod" "StatusUpdateMethod" NOT NULL DEFAULT 'AUTO_FROM_PROGRESS';
ALTER TABLE "objectives" ADD COLUMN "dataSource" TEXT;
ALTER TABLE "objectives" ADD COLUMN "dataSourceId" TEXT;
ALTER TABLE "objectives" ADD COLUMN "lastDataSourceSync" TIMESTAMP(3);

-- Add indexes
CREATE INDEX "objectives_progressUpdateMethod_idx" ON "objectives"("progressUpdateMethod");
CREATE INDEX "objectives_dataSource_idx" ON "objectives"("dataSource");

-- Add fields to key_results
ALTER TABLE "key_results" ADD COLUMN "progressUpdateMethod" "ProgressUpdateMethod" NOT NULL DEFAULT 'AUTO_FROM_CHECKINS';
ALTER TABLE "key_results" ADD COLUMN "statusUpdateMethod" "StatusUpdateMethod" NOT NULL DEFAULT 'AUTO_FROM_PROGRESS';
ALTER TABLE "key_results" ADD COLUMN "dataSource" TEXT;
ALTER TABLE "key_results" ADD COLUMN "dataSourceId" TEXT;
ALTER TABLE "key_results" ADD COLUMN "lastDataSourceSync" TIMESTAMP(3);

-- Add indexes
CREATE INDEX "key_results_progressUpdateMethod_idx" ON "key_results"("progressUpdateMethod");
CREATE INDEX "key_results_dataSource_idx" ON "key_results"("dataSource");
```

---

## 6. Team Hierarchy and Status

### Schema Design

**Updates to Team Model:**
```prisma
model Team {
  // ... existing fields ...
  
  // Hierarchy
  parentTeamId    String?
  parentTeam      Team?   @relation("TeamHierarchy", fields: [parentTeamId], references: [id], onDelete: SetNull)
  childTeams      Team[]  @relation("TeamHierarchy")
  
  // Type and status
  teamType        TeamType @default(CLASSIC)
  status          TeamStatus @default(ACTIVE)
  
  // Owner
  ownerId         String?
  owner           User?   @relation("TeamOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  
  // ... rest of fields ...
}

enum TeamType {
  CLASSIC
  MODERN
}

enum TeamStatus {
  ACTIVE
  ARCHIVED
}
```

### Migration SQL

```sql
-- Create TeamType enum
CREATE TYPE "TeamType" AS ENUM ('CLASSIC', 'MODERN');

-- Create TeamStatus enum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- Add fields to teams
ALTER TABLE "teams" ADD COLUMN "parentTeamId" TEXT;
ALTER TABLE "teams" ADD COLUMN "teamType" "TeamType" NOT NULL DEFAULT 'CLASSIC';
ALTER TABLE "teams" ADD COLUMN "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "teams" ADD COLUMN "ownerId" TEXT;

-- Add foreign keys
ALTER TABLE "teams" ADD CONSTRAINT "teams_parentTeamId_fkey" 
    FOREIGN KEY ("parentTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_ownerId_fkey" 
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "teams_parentTeamId_idx" ON "teams"("parentTeamId");
CREATE INDEX "teams_status_idx" ON "teams"("status");
CREATE INDEX "teams_ownerId_idx" ON "teams"("ownerId");
```

---

## 7. Last Check-in Tracking

### Schema Design

**Updates to Objective Model:**
```prisma
model Objective {
  // ... existing fields ...
  lastCheckInAt   DateTime?
  // ... rest of fields ...
}
```

**Updates to KeyResult Model:**
```prisma
model KeyResult {
  // ... existing fields ...
  lastCheckInAt   DateTime?
  // ... rest of fields ...
}
```

### Migration SQL

```sql
-- Add lastCheckInAt to objectives
ALTER TABLE "objectives" ADD COLUMN "lastCheckInAt" TIMESTAMP(3);

-- Add lastCheckInAt to key_results
ALTER TABLE "key_results" ADD COLUMN "lastCheckInAt" TIMESTAMP(3);

-- Add indexes
CREATE INDEX "objectives_lastCheckInAt_idx" ON "objectives"("lastCheckInAt");
CREATE INDEX "key_results_lastCheckInAt_idx" ON "key_results"("lastCheckInAt");
```

---

## 8. Check-in Activity Date

### Schema Design

**Updates to CheckIn Model:**
```prisma
model CheckIn {
  // ... existing fields ...
  activityDate    DateTime? // What date the check-in refers to (defaults to createdAt)
  // ... rest of fields ...
}
```

### Migration SQL

```sql
-- Add activityDate to check_ins
ALTER TABLE "check_ins" ADD COLUMN "activityDate" TIMESTAMP(3);

-- Add index
CREATE INDEX "check_ins_activityDate_idx" ON "check_ins"("activityDate");
```

---

## 9. Check-in HTML Notes

### Schema Design

**Updates to CheckIn Model:**
```prisma
model CheckIn {
  // ... existing fields ...
  noteHtml        String?   @db.Text // HTML-formatted note
  // ... rest of fields ...
}
```

### Migration SQL

```sql
-- Add noteHtml to check_ins
ALTER TABLE "check_ins" ADD COLUMN "noteHtml" TEXT;
```

---

## 10. Key Result Metric Name

### Schema Design

**Updates to KeyResult Model:**
```prisma
model KeyResult {
  // ... existing fields ...
  metricName      String? // Human-readable metric name (e.g., "CARR (MNOK)")
  // ... rest of fields ...
}
```

### Migration SQL

```sql
-- Add metricName to key_results
ALTER TABLE "key_results" ADD COLUMN "metricName" TEXT;

-- Add index
CREATE INDEX "key_results_metricName_idx" ON "key_results"("metricName");
```

---

## Complete Migration Order

Execute migrations in this order to avoid dependency issues:

1. **Enums First:**
   - PhasedTargetInterval
   - OkrPermissionLevel
   - ProgressUpdateMethod
   - StatusUpdateMethod
   - TeamType
   - TeamStatus

2. **New Tables:**
   - phased_targets
   - okr_permissions
   - okr_check_in_owners

3. **Add Columns to Existing Tables:**
   - objectives (delegation, progress config, lastCheckInAt)
   - key_results (delegation, progress config, lastCheckInAt, metricName)
   - teams (hierarchy, type, status, owner)
   - check_ins (activityDate, noteHtml)

4. **Add Indexes:**
   - All indexes for new tables
   - All indexes for new columns

---

## Validation Rules

### Phased Targets
- `targetDate` must be within parent OKR's `startDate` and `endDate`
- `targetValue` must be in correct order (ascending for INCREASE, descending for DECREASE)
- Cannot have both `objectiveId` and `keyResultId` set

### Delegation
- `delegatedToId` must be different from `ownerId`
- Cannot delegate to inactive users

### Check-in Owners
- OKR owner is automatically a check-in owner (unless explicitly removed)
- Cannot remove all check-in owners

### Progress Configuration
- `DATA_SOURCE` method requires `dataSource` and `dataSourceId` to be set
- `AUTO_FROM_CHILDREN` only valid for Objectives
- `AUTO_FROM_CHECKINS` only valid for Key Results

### Team Hierarchy
- Cannot create circular parent-child relationships
- Archived teams cannot have active child teams

---

## Rollback Strategy

Each migration should be reversible. Create rollback scripts for:
- Dropping new tables
- Removing new columns
- Dropping new enums
- Removing indexes

Sample rollback for phased targets:
```sql
-- Rollback phased targets
DROP TABLE IF EXISTS "phased_targets";
DROP TYPE IF EXISTS "PhasedTargetInterval";
```

