# Viva Goals CSV Import Gap Analysis

**Date:** 2025-01-20  
**Source CSV:** `VivaGoals_15229_new_view_2025_11_20_1763665314.csv`  
**Purpose:** Identify missing features/fields preventing Viva Goals CSV import

---

## Executive Summary

After analyzing the provided Viva Goals CSV export, the following critical gaps prevent import:

1. **❌ Missing Import Infrastructure** - No `externalId`, `source`, `importedAt`, or `importedBy` fields
2. **❌ No Import Endpoint** - No API endpoint to handle CSV import
3. **❌ No CSV Parser** - No service to parse and transform CSV data
4. **⚠️ Owner Name Matching** - CSV uses full names, not emails (requires name→User lookup)
5. **⚠️ Multiple Owners** - CSV supports comma-separated owners, app supports single owner + contributors
6. **⚠️ Deliverable Type** - CSV includes "Deliverable" type (not supported in current schema)
7. **⚠️ Status Mapping** - CSV statuses need mapping to app's OKRStatus enum
8. **⚠️ Metric Type Inference** - CSV doesn't have explicit metric type, must infer from Start/Target

---

## CSV Structure Analysis

### Headers Found (24 columns + empty columns)

1. **Id** - External ID (numeric, e.g., `2295704`) ✅ **Available**
2. **Title** - OKR title ✅ **Maps to `title`**
3. **Team** - Team name(s), semicolon-separated (e.g., `"Puzzel; All Puzzel"`) ⚠️ **Requires Team lookup**
4. **Creator** - Creator name (e.g., `"Frederic Laziou"`) ⚠️ **Requires name→User lookup**
5. **Owner** - Owner name(s), comma-separated (e.g., `"Roland Green"` or `"Ram Sagoo, Roland Green"`) ⚠️ **Requires name→User lookup, handles multiple**
6. **Period** - Period name (e.g., `"Annual 2025"`, `"Q1 2025"`) ✅ **Maps to Cycle**
7. **Start Date** - Start date (e.g., `"2025-01-01"`) ✅ **Maps to `startDate`**
8. **End Date** - End date (e.g., `"2025-12-31"`) ✅ **Maps to `endDate`**
9. **Description** - Description (often empty) ✅ **Maps to `description`**
10. **Aligned To (weight, Objective ID)** - Parent relationship with weight (e.g., `"SP1: Lead with AI(weight: 0%, Id: 2295706)"`) ⚠️ **Requires complex parsing**
11. **Metric Name** - Metric name (e.g., `"Progress"`) ⚠️ **Info only, not mapped**
12. **Unit** - Unit (e.g., `"%"`) ✅ **Maps to `unit`**
13. **Target** - Target value (e.g., `100`) ✅ **Maps to `targetValue`**
14. **Object Type** - Type: `"Objective"`, `"Key result"`, or `"Deliverable"` ⚠️ **Critical for routing**
15. **Goal Type** - Goal type (e.g., `"Aspirational Goal"`) ✅ **Maps to `goalType` enum**
16. **Start** - Start value (e.g., `0`) ✅ **Maps to `startValue`**
17. **Created At** - Creation timestamp (e.g., `"2024-12-09 14:36:20 UTC"`) ⚠️ **Can preserve timestamp**
18. **Last Check-in** - Last check-in date (e.g., `"2025-11-20"`) ⚠️ **Historical data**
19. **Progress %** - Progress percentage (e.g., `64`) ✅ **Maps to `progress`**
20. **Actual Progress** - Actual progress (same as Progress % in most cases) ⚠️ **Used to calculate `currentValue`**
21. **Status** - Status (e.g., `"At Risk"`, `"On Track"`, `"Closed"`, `"Not Started"`, `"Behind"`) ⚠️ **Requires enum mapping**
22. **Last Check-in Note** - Last check-in note ⚠️ **Historical data**
23. **Score** - Score (e.g., `0.8`) ⚠️ **Not mapped (no score field)**
24. **Checkins** - Check-in history (semicolon-separated check-in data) ⚠️ **Historical data**

---

## Critical Gaps Preventing Import

### 1. ❌ Missing Import Tracking Fields

**Current Schema:**
- `Objective` model: **NO** `externalId`, `source`, `importedAt`, `importedBy` fields
- `KeyResult` model: **NO** `externalId`, `source`, `importedAt`, `importedBy` fields

**Required:**
```prisma
model Objective {
  // ... existing fields ...
  externalId    String?   // Store CSV "Id" column (e.g., "2295704")
  source        String?   // Store "VIVA_GOALS"
  importedAt    DateTime?
  importedBy    String?   // FK to User
  
  @@unique([tenantId, source, externalId])
  @@index([source, externalId])
}

model KeyResult {
  // ... existing fields ...
  externalId    String?   // Store CSV "Id" column
  source        String?   // Store "VIVA_GOALS"
  importedAt    DateTime?
  importedBy    String?   // FK to User
  
  @@unique([tenantId, source, externalId])
  @@index([source, externalId])
}
```

**Impact:** Cannot deduplicate on re-import, cannot track import source

---

### 2. ❌ No Import Endpoint

**Current State:**
- No `POST /okr/import` endpoint
- No `POST /objectives/import` endpoint
- No `POST /key-results/import` endpoint

**Required:**
- Create import endpoint that accepts CSV file upload
- Validates tenant isolation
- Returns import results (success/failure counts, errors)

**Impact:** No way to receive CSV data

---

### 3. ❌ No CSV Parser Service

**Current State:**
- No CSV parsing service
- No Excel parsing service (if Excel support needed)

**Required:**
- Service to parse CSV rows
- Transform CSV columns to app data model
- Handle data validation and mapping

**Impact:** Cannot process CSV data

---

### 4. ⚠️ Owner Name Matching (Not Email)

**CSV Format:**
- Owner column contains full names: `"Roland Green"`, `"Frederic Laziou"`
- Multiple owners: `"Ram Sagoo, Roland Green"`
- **NOT emails**

**Current App:**
- `ownerId` field requires User.id (FK)
- No direct name→User lookup service

**Required:**
- Name matching service (exact match preferred, fuzzy as fallback)
- Handle multiple owners:
  - First owner → `ownerId`
  - Additional owners → `ObjectiveContributor` or `KeyResultContributor`

**Impact:** Cannot resolve owners without name matching

---

### 5. ⚠️ Multiple Owners Support

**CSV Format:**
- `"Ram Sagoo, Roland Green"` (comma-separated)

**Current App:**
- Single `ownerId` field
- `ObjectiveContributor` / `KeyResultContributor` tables exist for additional contributors

**Required:**
- Parse comma-separated owners
- Set first as `ownerId`
- Add rest as contributors

**Impact:** Need to handle multiple owners correctly

---

### 6. ⚠️ Deliverable Type Not Supported

**CSV Object Types:**
- `"Objective"` ✅ Supported
- `"Key result"` ✅ Supported
- `"Deliverable"` ❌ **Not supported**

**Current App:**
- No `Deliverable` model
- Could map to `Initiative` model (if exists) or skip

**Required:**
- Decide: Skip Deliverables or map to Initiatives
- Update parser to handle "Deliverable" type

**Impact:** Some CSV rows will be skipped or need special handling

---

### 7. ⚠️ Status Mapping Required

**CSV Statuses:**
- `"Not Started"` → Map to `ON_TRACK` or create new status?
- `"On Track"` → `ON_TRACK` ✅
- `"At Risk"` → `AT_RISK` ✅
- `"Behind"` → `AT_RISK` or `OFF_TRACK`?
- `"Closed"` → `COMPLETED` ✅
- `"Postponed"` → `CANCELLED`?

**Current App OKRStatus Enum:**
- `ON_TRACK`, `AT_RISK`, `OFF_TRACK`, `COMPLETED`, `CANCELLED`

**Required:**
- Status mapping function: `mapVivaStatusToOKRStatus(vivaStatus: string): OKRStatus`

**Impact:** Status values need transformation

---

### 8. ⚠️ Metric Type Inference Required

**CSV:**
- No explicit `metricType` column
- Has `Start` and `Target` values

**Current App:**
- `metricType` field is **REQUIRED** (MetricType enum: `INCREASE`, `DECREASE`, `REACH`, `MAINTAIN`)

**Required:**
- Infer from Start/Target relationship:
  - `Start < Target` → `INCREASE`
  - `Start > Target` → `DECREASE`
  - `Start = Target` → `MAINTAIN`
  - `Start = 0, Target = 100, Unit = "%"` → `REACH`

**Impact:** Must calculate metric type

---

### 9. ⚠️ Current Value Calculation

**CSV:**
- `Actual Progress` column (percentage, e.g., `64`)
- `Start` column (absolute, e.g., `0`)
- `Target` column (absolute, e.g., `100`)

**Current App:**
- `currentValue` field is **REQUIRED** (Float, absolute value)

**Required:**
- Calculate `currentValue` from percentage:
  ```
  currentValue = startValue + (actualProgress / 100.0 * (targetValue - startValue))
  ```
- Example: Start=0, Target=100, Actual Progress=64% → `currentValue = 0 + (64/100 * 100) = 64`

**Impact:** Must calculate absolute value from percentage

---

### 10. ⚠️ Aligned To Parsing Complexity

**CSV Format:**
- `"SP1: Lead with AI(weight: 0%, Id: 2295706)"`
- Contains: parent title, weight percentage, parent ID

**Required Parsing:**
- Extract parent title: `^([^(]+)` → `"SP1: Lead with AI"`
- Extract weight: `weight:\s*([\d.]+)%` → `"0"` → convert to decimal `0.0`
- Extract parent ID: `Id:\s*(\d+)` → `"2295706"`

**Current App:**
- Objectives: `parentId` (single FK)
- Key Results: `ObjectiveKeyResult` junction with `weight` (Float, 0.0-1.0)

**Required:**
- Regex parsing service
- Weight conversion: `weightFloat = weightPercent / 100.0` (e.g., 50% → 0.5)
- Parent lookup by `externalId` (if previously imported) or by title

**Impact:** Complex parsing logic needed

---

### 11. ⚠️ Cycle Lookup/Creation

**CSV Format:**
- Period: `"Annual 2025"`, `"Q1 2025"`, `"Q2 2025"`

**Current App:**
- `cycleId` field (FK to Cycle)
- Cycle model exists with name field

**Required:**
- `findOrCreateCycle(periodName: string, tenantId: string, startDate: Date, endDate: Date): Cycle`
- Parse period name to extract cycle info
- Create cycle if doesn't exist

**Impact:** Need cycle lookup/create logic

---

### 12. ⚠️ Team Lookup

**CSV Format:**
- Team: `"Puzzel"`, `"Commercial"`, `"Puzzel; All Puzzel"` (semicolon-separated)

**Current App:**
- `teamId` field (optional FK to Team)

**Required:**
- Team lookup by name (first team if multiple)
- Create team if doesn't exist (optional)

**Impact:** Need team lookup logic

---

## Field Mapping Summary

| CSV Column | App Field | Status | Transformation Required |
|------------|-----------|--------|------------------------|
| Id | `externalId` | ❌ **Missing** | None (direct mapping) |
| Title | `title` | ✅ **Exists** | None |
| Team | `teamId` | ✅ **Exists** | Name→Team lookup |
| Creator | `createdBy` | ✅ **Exists** | Name→User lookup |
| Owner | `ownerId` | ✅ **Exists** | Name→User lookup, handle multiple |
| Period | `cycleId` | ✅ **Exists** | Period name→Cycle lookup/create |
| Start Date | `startDate` | ✅ **Exists** | Date parsing |
| End Date | `endDate` | ✅ **Exists** | Date parsing |
| Description | `description` | ✅ **Exists** | None |
| Aligned To | `parentId` / `weight` | ✅ **Exists** | Complex regex parsing |
| Unit | `unit` | ✅ **Exists** | None |
| Target | `targetValue` | ✅ **Exists** | Number→Float |
| Object Type | N/A | ⚠️ **Routing** | Parse to route rows |
| Goal Type | `goalType` | ✅ **Exists** | Enum mapping |
| Start | `startValue` | ✅ **Exists** | Number→Float |
| Created At | `createdAt` | ✅ **Exists** | Preserve timestamp (optional) |
| Progress % | `progress` | ✅ **Exists** | Number→Float |
| Actual Progress | `currentValue` | ✅ **Exists** | Calculate from percentage |
| Status | `status` | ✅ **Exists** | Enum mapping |
| Metric Type | `metricType` | ✅ **Exists** | **Infer from Start/Target** |
| Source | `source` | ❌ **Missing** | Set to "VIVA_GOALS" |
| Imported At | `importedAt` | ❌ **Missing** | Set to now() |
| Imported By | `importedBy` | ❌ **Missing** | Set to current user |

---

## Implementation Checklist

### Phase 1: Database Schema (Critical)

- [ ] Add `externalId String?` to Objective model
- [ ] Add `source String?` to Objective model
- [ ] Add `importedAt DateTime?` to Objective model
- [ ] Add `importedBy String?` to Objective model (FK to User)
- [ ] Add `externalId String?` to KeyResult model
- [ ] Add `source String?` to KeyResult model
- [ ] Add `importedAt DateTime?` to KeyResult model
- [ ] Add `importedBy String?` to KeyResult model (FK to User)
- [ ] Add `@@unique([tenantId, source, externalId])` constraint on both models
- [ ] Add `@@index([source, externalId])` on both models
- [ ] Create and run migration

### Phase 2: API Layer (Critical)

- [ ] Create CSV parser service (`csv-parser.service.ts`)
- [ ] Create import service (`okr-import.service.ts`)
- [ ] Add `POST /okr/import` endpoint
- [ ] Add import DTOs (`ImportObjectiveDto`, `ImportKeyResultDto`)
- [ ] Implement name→User lookup service
- [ ] Implement period→Cycle lookup/create service
- [ ] Implement team lookup service (optional)
- [ ] Add tenant isolation validation

### Phase 3: Data Transformation (Critical)

- [ ] Implement "Aligned To" parsing (regex extraction)
- [ ] Implement status mapping (Viva → OKRStatus)
- [ ] Implement metric type inference (Start/Target → MetricType)
- [ ] Implement current value calculation (percentage → absolute)
- [ ] Implement weight conversion (percentage → decimal)
- [ ] Implement owner name matching (exact + fuzzy)
- [ ] Handle multiple owners (first → ownerId, rest → contributors)
- [ ] Handle "Deliverable" type (skip or map to Initiative)

### Phase 4: UI Layer (Important)

- [ ] Create file upload component
- [ ] Create import preview/mapping UI
- [ ] Create import progress/error display
- [ ] Add import button to OKR page
- [ ] Add import validation feedback

---

## Sample CSV Row Analysis

**Row 1 (Objective):**
```
Id: 2295704
Title: "2025 -- Build the Leading CX Ecosystem in Europe Focusing on Mid-Market and Enterprise"
Team: "Puzzel; All Puzzel"
Creator: "Frederic Laziou"
Owner: "Frederic Laziou"
Period: "Annual 2025"
Start Date: "2025-01-01"
End Date: "2025-12-31"
Aligned To: (empty - root objective)
Object Type: "Objective"
Goal Type: "Aspirational Goal"
Status: "At Risk"
Progress %: 64
```

**Row 5 (Key Result):**
```
Id: 2325365
Title: "Deliver 77m of Expansion booking with 40m coming from AI"
Team: "Commercial"
Creator: "Roland Green"
Owner: "Roland Green"
Period: "Annual 2025"
Start Date: "2025-01-01"
End Date: "2025-12-31"
Aligned To: "Drive expansion leveraging our AI offering(weight: 14.29%, Id: 2295776)"
Metric Name: "Progress"
Unit: "%"
Target: 100
Start: 0
Object Type: "Key result"
Goal Type: "Aspirational Goal"
Status: "On Track"
Progress %: 25
Actual Progress: 25
```

**Transformation Required:**
- Extract parent ID `2295776` from "Aligned To"
- Convert weight `14.29%` → `0.1429`
- Calculate `currentValue = 0 + (25/100 * 100) = 25`
- Infer `metricType = REACH` (Start=0, Target=100, Unit="%")
- Map status `"On Track"` → `ON_TRACK`
- Lookup owner "Roland Green" → User.id
- Lookup parent Objective by externalId `2295776`

---

## Recommendations

### Immediate Actions

1. **Add import tracking fields** to schema (Phase 1)
2. **Create CSV parser service** (Phase 2)
3. **Create import endpoint** (Phase 2)
4. **Implement critical transformations** (Phase 3)

### Risk Mitigation

- **Tenant Isolation:** Ensure import endpoint validates tenant boundaries
- **User Matching:** Implement exact match first, fuzzy match as fallback
- **Deduplication:** Use `externalId + source` for deduplication on re-import
- **Error Handling:** Return detailed errors for failed rows, continue processing valid rows

### Optional Enhancements

- Import historical check-ins (if needed)
- Import creator information (if needed)
- Support Excel format (in addition to CSV)
- Import preview before committing

---

## Conclusion

**Critical Blockers:** 3 (Missing import fields, No import endpoint, No CSV parser)  
**High Priority Gaps:** 5 (Owner matching, Status mapping, Metric type inference, Current value calculation, Aligned To parsing)  
**Medium Priority Gaps:** 4 (Multiple owners, Deliverable handling, Cycle lookup, Team lookup)

**Estimated Effort:** 
- Phase 1 (Schema): 2-4 hours
- Phase 2 (API): 8-16 hours
- Phase 3 (Transformations): 8-12 hours
- Phase 4 (UI): 4-8 hours
- **Total: 22-40 hours**

**Status:** ❌ **Cannot import CSV without implementing Phases 1-3**

