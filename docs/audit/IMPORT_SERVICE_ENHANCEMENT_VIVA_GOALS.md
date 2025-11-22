# Import Service Enhancement: Preserve All Viva Goals Data

**Created:** 2025-01-23  
**Purpose:** Update import service to preserve ALL Viva Goals data, even if features aren't fully implemented yet

---

## Overview

The current import service only preserves a subset of Viva Goals data. This document outlines changes needed to preserve ALL data from Viva Goals exports, storing it either in dedicated fields (when implemented) or in a metadata JSON field (as temporary storage until features are implemented).

---

## Strategy

1. **Immediate:** Store all Viva Goals data in a `metadata` JSON field on Objectives and KeyResults
2. **As Features Are Implemented:** Migrate data from metadata to dedicated fields
3. **Backward Compatible:** Existing imports continue to work

---

## 1. Update Parser Interface

### Current State
The parser already captures most fields but doesn't preserve:
- Phased Targets
- Delegated To
- Check-in Owners
- Granular Permissions
- Progress/Status Configuration
- Alignment weights (partially preserved)
- Activity Date (for check-ins)
- HTML Notes (for check-ins)

### Enhanced Parser Interface

```typescript
export interface ParsedVivaGoalsJSONRow {
  // ... existing fields ...
  
  // NEW: Additional Viva Goals fields
  phasedTargets?: Array<{
    interval: string; // "monthly" | "quarterly" | "custom"
    targets: Array<{
      targetValue: number;
      targetDate: string;
    }>;
  }> | null;
  
  delegatedTo?: {
    id: number;
    name: string;
    email: string;
  } | null;
  
  checkInOwners?: Array<{
    id: number;
    name: string;
    email: string;
  }> | null;
  
  permissions?: {
    view: string; // "Everybody" | "Team Members" | "Owner Only" | "Custom"
    edit: Record<string, any>; // Empty = owner only
    align: string;
  } | null;
  
  progressConfig?: {
    progress: string; // "Update from Children" | "Update Manually"
    status: string; // "Update based on Progress" | "Update Manually"
    dataSource: string | null;
  } | null;
  
  alignment?: Array<{
    id: number;
    title: string;
    weight: number; // Parsed from percentage string
  }> | null;
  
  lastCheckIn?: string | null;
  
  score?: number | null;
  
  // For Key Results
  outcome?: {
    outcomeType: string; // "Metric" | "Percentage"
    metricName?: string;
    metricUnit?: string;
    start?: number;
    target?: number;
    targetType?: string; // "Increase From" | "Decrease From" | "Reach"
  } | null;
}
```

---

## 2. Update Parser Implementation

### Enhanced parseObjectiveRow Method

```typescript
private parseObjectiveRow(obj: VivaGoalsObjective): ParsedVivaGoalsJSONRow {
  // ... existing parsing ...
  
  // Parse Phased Targets
  let phasedTargets = null;
  if (obj['Phased Targets'] && typeof obj['Phased Targets'] === 'object' && !Array.isArray(obj['Phased Targets'])) {
    const pt = obj['Phased Targets'] as any;
    if (pt.Interval && pt['Phased Targets']) {
      phasedTargets = {
        interval: pt.Interval.toLowerCase(),
        targets: pt['Phased Targets'].map((t: any) => ({
          targetValue: t['Target Value'],
          targetDate: t['Target Date'],
        })),
      };
    }
  }
  
  // Parse Delegated To
  const delegatedTo = obj['Delegated To'] && typeof obj['Delegated To'] === 'object' && obj['Delegated To'].ID
    ? {
        id: obj['Delegated To'].ID,
        name: obj['Delegated To'].Name,
        email: obj['Delegated To'].Email,
      }
    : null;
  
  // Parse Check-in Owners
  const checkInOwners = obj['Check-in Owners']?.map(co => ({
    id: co.ID,
    name: co.Name,
    email: co.Email,
  })) || null;
  
  // Parse Permissions
  const permissions = obj.Permissions ? {
    view: obj.Permissions.View || 'Everybody',
    edit: obj.Permissions.Edit || {},
    align: obj.Permissions.Align || 'Everybody',
  } : null;
  
  // Parse Progress and Status Configuration
  const progressConfig = obj['Progress and Status Configuration'] ? {
    progress: obj['Progress and Status Configuration'].Progress || 'Update from Children',
    status: obj['Progress and Status Configuration'].Status || 'Update based on Progress',
    dataSource: obj['Progress and Status Configuration']['Data Source'] || null,
  } : null;
  
  return {
    // ... existing fields ...
    phasedTargets,
    delegatedTo,
    checkInOwners,
    permissions,
    progressConfig,
    lastCheckin: obj['Last Check-in'] || null,
    score: obj.Score ?? null,
    // ... rest of fields ...
  };
}
```

---

## 3. Add Metadata Field to Schema

### Database Schema Update

```prisma
model Objective {
  // ... existing fields ...
  
  // Metadata JSON field for storing additional Viva Goals data
  // This will be migrated to dedicated fields as features are implemented
  metadata        Json? // Store phased targets, permissions, etc. until features are implemented
  
  // ... rest of fields ...
}

model KeyResult {
  // ... existing fields ...
  
  // Metadata JSON field
  metadata        Json? // Store phased targets, permissions, etc. until features are implemented
  
  // ... rest of fields ...
}

model CheckIn {
  // ... existing fields ...
  
  // Metadata JSON field
  metadata        Json? // Store HTML notes, activity date until features are implemented
  
  // ... rest of fields ...
}
```

### Migration SQL

```sql
-- Add metadata field to objectives
ALTER TABLE "objectives" ADD COLUMN "metadata" JSONB;

-- Add metadata field to key_results
ALTER TABLE "key_results" ADD COLUMN "metadata" JSONB;

-- Add metadata field to check_ins
ALTER TABLE "check_ins" ADD COLUMN "metadata" JSONB;

-- Add indexes for JSON queries (optional, for future use)
CREATE INDEX "objectives_metadata_idx" ON "objectives" USING GIN ("metadata");
CREATE INDEX "key_results_metadata_idx" ON "key_results" USING GIN ("metadata");
CREATE INDEX "check_ins_metadata_idx" ON "check_ins" USING GIN ("metadata");
```

---

## 4. Update Import Service

### Enhanced importObjective Method

```typescript
private async importObjective(
  row: ParsedVivaGoalsRow,
  tenantId: string,
  userId: string,
  externalIdToInternalId: Map<string, string>,
): Promise<any> {
  // ... existing code ...
  
  // Build metadata object with all Viva Goals data not yet in dedicated fields
  const metadata: any = {};
  
  // Store phased targets in metadata (until Ticket 1 is implemented)
  if ((row as any).phasedTargets) {
    metadata.phasedTargets = (row as any).phasedTargets;
  }
  
  // Store delegation in metadata (until Ticket 3 is implemented)
  if ((row as any).delegatedTo) {
    metadata.delegatedTo = (row as any).delegatedTo;
  }
  
  // Store check-in owners in metadata (until Ticket 4 is implemented)
  if ((row as any).checkInOwners) {
    metadata.checkInOwners = (row as any).checkInOwners;
  }
  
  // Store permissions in metadata (until Ticket 2 is implemented)
  if ((row as any).permissions) {
    metadata.permissions = (row as any).permissions;
  }
  
  // Store progress config in metadata (until Ticket 5 is implemented)
  if ((row as any).progressConfig) {
    metadata.progressConfig = (row as any).progressConfig;
  }
  
  // Store score in metadata
  if ((row as any).score !== null && (row as any).score !== undefined) {
    metadata.score = (row as any).score;
  }
  
  // Store last check-in date (will migrate to lastCheckInAt field in Ticket 8)
  if ((row as any).lastCheckin) {
    metadata.lastCheckIn = (row as any).lastCheckin;
  }
  
  const data = {
    // ... existing fields ...
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
  
  // ... rest of import logic ...
}
```

### Enhanced importKeyResult Method

```typescript
private async importKeyResult(
  row: ParsedVivaGoalsRow,
  tenantId: string,
  userId: string,
  externalIdToInternalId: Map<string, string>,
): Promise<any> {
  // ... existing code ...
  
  // Build metadata object
  const metadata: any = {};
  
  // Store phased targets
  if ((row as any).phasedTargets) {
    metadata.phasedTargets = (row as any).phasedTargets;
  }
  
  // Store delegation
  if ((row as any).delegatedTo) {
    metadata.delegatedTo = (row as any).delegatedTo;
  }
  
  // Store check-in owners
  if ((row as any).checkInOwners) {
    metadata.checkInOwners = (row as any).checkInOwners;
  }
  
  // Store permissions
  if ((row as any).permissions) {
    metadata.permissions = (row as any).permissions;
  }
  
  // Store progress config
  if ((row as any).progressConfig) {
    metadata.progressConfig = (row as any).progressConfig;
  }
  
  // Store outcome details (for Ticket 6 enhancement)
  if ((row as any).outcome) {
    metadata.outcome = (row as any).outcome;
  }
  
  // Store metric name (will migrate to metricName field)
  if ((row as any).metricName) {
    metadata.metricName = (row as any).metricName;
  }
  
  // Store score
  if ((row as any).score !== null && (row as any).score !== undefined) {
    metadata.score = (row as any).score;
  }
  
  // Store last check-in date
  if ((row as any).lastCheckin) {
    metadata.lastCheckIn = (row as any).lastCheckin;
  }
  
  const data = {
    // ... existing fields ...
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
  
  // ... rest of import logic ...
}
```

---

## 5. Update Check-in Import

### Enhanced Check-in Import Method

```typescript
/**
 * Import check-ins from JSON
 */
async importCheckInsFromJSON(
  jsonContent: string,
  tenantId: string,
  userId: string,
): Promise<{ imported: number; errors: number }> {
  const checkIns = this.jsonParser.parseCheckIns(jsonContent);
  let imported = 0;
  let errors = 0;
  
  for (const checkIn of checkIns) {
    try {
      // Find Key Result by external ID
      const keyResult = await this.prisma.keyResult.findFirst({
        where: {
          tenantId,
          source: this.SOURCE,
          externalId: String(checkIn['OKR ID']),
        },
      });
      
      if (!keyResult) {
        this.logger.warn(`Key Result ${checkIn['OKR ID']} not found for check-in ${checkIn.ID}`);
        errors++;
        continue;
      }
      
      // Resolve check-in owner
      const checkInOwnerId = await this.resolveUserEmailToUserId(
        checkIn['Check In Owner'].Email,
        tenantId,
      );
      
      if (!checkInOwnerId) {
        this.logger.warn(`User ${checkIn['Check In Owner'].Email} not found for check-in ${checkIn.ID}`);
        errors++;
        continue;
      }
      
      // Parse check-in note
      const note = checkIn['Check In Note']?.['Check In Note'] || null;
      const noteHtml = checkIn['Check In Note']?.['Check In Note HTML'] || null;
      
      // Parse dates
      const checkInDate = checkIn['CheckIn Date'] 
        ? new Date(checkIn['CheckIn Date']) 
        : new Date();
      const activityDate = checkIn['Activity Date'] 
        ? new Date(checkIn['Activity Date']) 
        : null;
      
      // Build metadata
      const metadata: any = {};
      if (noteHtml) {
        metadata.noteHtml = noteHtml; // Will migrate to noteHtml field in Ticket 10
      }
      if (activityDate) {
        metadata.activityDate = activityDate.toISOString(); // Will migrate to activityDate field in Ticket 9
      }
      if (checkIn['Metric Name']) {
        metadata.metricName = checkIn['Metric Name'];
      }
      
      // Create check-in
      await this.prisma.checkIn.create({
        data: {
          keyResultId: keyResult.id,
          userId: checkInOwnerId,
          value: checkIn['Current Value'] || 0,
          confidence: 50, // Default confidence (Viva Goals doesn't export this)
          note: note,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
          createdAt: checkInDate,
        },
      });
      
      // Update lastCheckInAt on Key Result (will use dedicated field in Ticket 8)
      await this.prisma.keyResult.update({
        where: { id: keyResult.id },
        data: {
          metadata: {
            ...(keyResult.metadata as any || {}),
            lastCheckIn: checkInDate.toISOString(),
          },
        },
      });
      
      imported++;
    } catch (error) {
      this.logger.error(`Error importing check-in ${checkIn.ID}: ${error}`);
      errors++;
    }
  }
  
  return { imported, errors };
}
```

---

## 6. Update Comments Import

### Enhanced Comments Import

```typescript
/**
 * Import comments from JSON
 */
async importCommentsFromJSON(
  jsonContent: string,
  tenantId: string,
  userId: string,
): Promise<{ imported: number; errors: number }> {
  const comments = this.jsonParser.parseComments(jsonContent);
  let imported = 0;
  let errors = 0;
  
  for (const comment of comments) {
    try {
      // Find OKR (Objective or Key Result) by external ID
      const objective = await this.prisma.objective.findFirst({
        where: {
          tenantId,
          source: this.SOURCE,
          externalId: String(comment['OKR ID']),
        },
      });
      
      const keyResult = objective ? null : await this.prisma.keyResult.findFirst({
        where: {
          tenantId,
          source: this.SOURCE,
          externalId: String(comment['OKR ID']),
        },
      });
      
      if (!objective && !keyResult) {
        this.logger.warn(`OKR ${comment['OKR ID']} not found for comment ${comment.ID}`);
        errors++;
        continue;
      }
      
      // Resolve comment author
      const authorId = await this.resolveUserEmailToUserId(
        comment['Created By'].Email,
        tenantId,
      );
      
      if (!authorId) {
        this.logger.warn(`User ${comment['Created By'].Email} not found for comment ${comment.ID}`);
        errors++;
        continue;
      }
      
      // Create comment (assuming Comment model exists)
      // If Comment model doesn't exist, store in Activity model
      await this.prisma.activity.create({
        data: {
          tenantId,
          entityType: objective ? 'OBJECTIVE' : 'KEY_RESULT',
          entityId: objective ? objective.id : keyResult!.id,
          userId: authorId,
          action: 'COMMENTED',
          metadata: {
            comment: comment.Comment,
            externalId: String(comment.ID),
            createdAt: comment['Created At'],
          },
          createdAt: new Date(comment['Created At']),
        },
      });
      
      imported++;
    } catch (error) {
      this.logger.error(`Error importing comment ${comment.ID}: ${error}`);
      errors++;
    }
  }
  
  return { imported, errors };
}
```

---

## 7. Migration Script: Metadata to Dedicated Fields

### Future Migration Script Template

As features are implemented, create migration scripts to move data from metadata to dedicated fields:

```typescript
/**
 * Migration: Move phased targets from metadata to PhasedTarget table
 * Run after Ticket 1 (Phased Targets) is implemented
 */
async migratePhasedTargetsFromMetadata(tenantId: string) {
  // Get all objectives with phased targets in metadata
  const objectives = await this.prisma.objective.findMany({
    where: {
      tenantId,
      metadata: {
        path: ['phasedTargets'],
        not: null,
      },
    },
  });
  
  for (const objective of objectives) {
    const metadata = objective.metadata as any;
    if (metadata?.phasedTargets) {
      // Create PhasedTarget records
      for (let i = 0; i < metadata.phasedTargets.targets.length; i++) {
        const target = metadata.phasedTargets.targets[i];
        await this.prisma.phasedTarget.create({
          data: {
            tenantId,
            objectiveId: objective.id,
            interval: metadata.phasedTargets.interval.toUpperCase(),
            targetValue: target.targetValue,
            targetDate: new Date(target.targetDate),
            order: i + 1,
          },
        });
      }
      
      // Remove from metadata
      delete metadata.phasedTargets;
      await this.prisma.objective.update({
        where: { id: objective.id },
        data: { metadata },
      });
    }
  }
  
  // Repeat for Key Results...
}
```

---

## 8. Updated Files Checklist

### Files to Modify

- [ ] `services/core-api/src/modules/okr/viva-goals-json-parser.service.ts`
  - Update `ParsedVivaGoalsJSONRow` interface
  - Update `parseObjectiveRow` method
  - Add parsing for phased targets, delegation, etc.

- [ ] `services/core-api/src/modules/okr/okr-import.service.ts`
  - Update `importObjective` to store metadata
  - Update `importKeyResult` to store metadata
  - Add `importCheckInsFromJSON` method
  - Add `importCommentsFromJSON` method

- [ ] `services/core-api/prisma/schema.prisma`
  - Add `metadata Json?` field to Objective
  - Add `metadata Json?` field to KeyResult
  - Add `metadata Json?` field to CheckIn

- [ ] Create migration file
  - `services/core-api/prisma/migrations/YYYYMMDDHHMMSS_add_metadata_fields/migration.sql`

### New Files to Create

- [ ] `services/core-api/src/modules/okr/migrations/metadata-migration.service.ts`
  - Template for future metadata migrations

---

## 9. Testing

### Test Cases

1. **Import with Phased Targets**
   - Import OKR with phased targets
   - Verify metadata contains phased targets
   - Verify data can be queried

2. **Import with Delegation**
   - Import OKR with delegated user
   - Verify metadata contains delegation info
   - Verify delegated user email is preserved

3. **Import with Check-in Owners**
   - Import OKR with check-in owners
   - Verify metadata contains check-in owners
   - Verify all owners are preserved

4. **Import with Permissions**
   - Import OKR with custom permissions
   - Verify metadata contains permissions
   - Verify permission structure is preserved

5. **Import Check-ins**
   - Import check-ins with HTML notes
   - Import check-ins with activity dates
   - Verify metadata contains all data

6. **Backward Compatibility**
   - Import existing CSV format (should still work)
   - Import without new fields (should not error)

---

## 10. Implementation Order

1. **Week 1:**
   - Add metadata fields to schema
   - Update parser to capture all fields
   - Update import service to store metadata
   - Test with sample Viva Goals export

2. **Week 2:**
   - Add check-in import method
   - Add comments import method
   - Add team import enhancements
   - Add user import enhancements

3. **Week 3:**
   - Create migration templates
   - Write comprehensive tests
   - Document metadata structure
   - Update API to expose metadata (optional)

---

## 11. Metadata Structure Reference

### Objective Metadata Structure

```json
{
  "phasedTargets": {
    "interval": "monthly",
    "targets": [
      { "targetValue": 22.0, "targetDate": "2024-04-01" },
      { "targetValue": 50.0, "targetDate": "2024-07-01" }
    ]
  },
  "delegatedTo": {
    "id": 12345,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "checkInOwners": [
    { "id": 12345, "name": "John Doe", "email": "john@example.com" }
  ],
  "permissions": {
    "view": "Everybody",
    "edit": {},
    "align": "Everybody"
  },
  "progressConfig": {
    "progress": "Update from Children",
    "status": "Update based on Progress",
    "dataSource": null
  },
  "score": 0.0,
  "lastCheckIn": "2025-10-10"
}
```

### Key Result Metadata Structure

```json
{
  "phasedTargets": {
    "interval": "quarterly",
    "targets": [
      { "targetValue": 472000000.0, "targetDate": "2024-04-01" }
    ]
  },
  "delegatedTo": { ... },
  "checkInOwners": [ ... ],
  "permissions": { ... },
  "progressConfig": {
    "progress": "Update Manually",
    "status": "Update Manually",
    "dataSource": null
  },
  "outcome": {
    "outcomeType": "Metric",
    "metricName": "CARR (MNOK)",
    "metricUnit": "Number",
    "start": 458000000.0,
    "target": 556000000.0,
    "targetType": "Increase From"
  },
  "metricName": "CARR (MNOK)",
  "score": 0.0,
  "lastCheckIn": "2025-01-10"
}
```

### Check-in Metadata Structure

```json
{
  "noteHtml": "<div>Formatted HTML note</div>",
  "activityDate": "2023-11-08T00:00:00Z",
  "metricName": "CARR (MNOK)"
}
```

---

## Conclusion

This enhancement ensures that ALL Viva Goals data is preserved during import, even if features aren't fully implemented yet. As features are implemented (via tickets), data can be migrated from metadata to dedicated fields, ensuring no data loss.

