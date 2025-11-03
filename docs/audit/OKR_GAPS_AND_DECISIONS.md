# OKR Gaps and Decisions

**Generated:** 2025-01-XX  
**Scope:** Identified gaps, contradictions, and decision options

---

## 1. Gaps

### 1.1 Period vs Cycle Relationship

**Gap:** Both `objectives.period` (enum) and `objectives.cycleId` (FK) exist, but their relationship is unclear.

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:200, 191`
- `period` is enum: `MONTHLY | QUARTERLY | ANNUAL | CUSTOM`
- `cycleId` is FK → `cycles.id` (cycles have names like "Q1 2025")
- Frontend doesn't display `period` anywhere in OKR list UI
- Period is used for date range validation in objective creation/update
- **Source:** `services/core-api/src/modules/okr/objective.service.ts:267-284`

**Questions:**
- Can an objective have both period and cycle?
- Do they overlap semantically?
- Is period legacy or used for validation only?

**Decision Options:**

1. **Do Nothing** (current state)
   - Pros: No migration needed, no breaking changes
   - Cons: Confusion remains, unused field in schema

2. **Deprecate Period Field**
   - Remove `period` from objectives (keep in key_results/initiatives if needed)
   - Migrate existing data: set `period` to `CUSTOM` or remove
   - Update validation to use cycle dates instead
   - Pros: Clearer model, removes confusion
   - Cons: Requires migration, may break existing code

3. **Clarify Relationship**
   - Document: Period = validation rule (e.g., quarterly should be ~90 days)
   - Cycle = operational planning period (e.g., "Q1 2025")
   - Keep both but make relationship explicit
   - Pros: No migration, preserves flexibility
   - Cons: Still two concepts to understand

**Minimal Probe:** See SQL probes section for queries to check period vs cycle distribution.

---

### 1.2 Pillar Table Exists but Not Used in UI

**Gap:** `strategic_pillars` table exists, `objectives.pillarId` FK exists, but frontend doesn't use pillars.

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:134-147, 189-190`
- Frontend: `apps/web/src/app/dashboard/okrs/page.tsx:1043, 1080` shows `availablePillars={[]}`
- Reporting endpoint exists: `GET /reports/pillars`
- **Source:** `services/core-api/src/modules/okr/okr-reporting.controller.ts:137-143`

**Questions:**
- Are pillars actually used in production?
- Should they be displayed in UI?
- Are they planned feature not yet implemented?

**Decision Options:**

1. **Do Nothing** (current state)
   - Pros: No changes needed
   - Cons: Confusing schema, unused feature

2. **Remove Pillar Support**
   - Drop `strategic_pillars` table
   - Drop `objectives.pillarId` FK
   - Remove pillar endpoints
   - Pros: Cleaner schema, removes confusion
   - Cons: Breaking change, may lose data

3. **Implement Pillar UI**
   - Add pillar filter to OKR list
   - Add pillar badge to objective rows
   - Wire up `/reports/pillars` endpoint
   - Pros: Completes feature, uses existing schema
   - Cons: Requires frontend work

**Minimal Probe:** See SQL probes section for queries to check pillar usage.

---

### 1.3 Planned Cycle ID Field Missing

**Gap:** Frontend code references `plannedCycleId` but schema doesn't have this field.

**Evidence:**
- Frontend: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:63`
- Schema: NOT FOUND in `services/core-api/prisma/schema.prisma`
- Used in `mapObjectiveToViewModel()` function

**Questions:**
- Is this a vestigial field?
- Was it planned but never implemented?
- Should it be removed from frontend code?

**Decision Options:**

1. **Remove from Frontend**
   - Remove `plannedCycleId` references
   - Clean up `mapObjectiveToViewModel()` function
   - Pros: Removes dead code, no confusion
   - Cons: Requires frontend changes

2. **Add to Schema**
   - Add `plannedCycleId` FK to `objectives` table
   - Implement backend support
   - Pros: Implements planned feature
   - Cons: Requires full-stack work

**Minimal Probe:** Search codebase for all `plannedCycleId` references to determine scope.

---

### 1.4 Visibility Level Deprecation

**Gap:** Schema shows `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` as DEPRECATED but they're still in enum.

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:338-341`
- Comment says: "DEPRECATED: Kept for backward compatibility, treated as PUBLIC_TENANT"
- Backend visibility service may handle these differently

**Questions:**
- Are these values actually in use?
- Should they be removed from enum?
- Are they truly treated as PUBLIC_TENANT everywhere?

**Decision Options:**

1. **Do Nothing** (current state)
   - Pros: Backward compatibility, no migration
   - Cons: Confusing enum, potential inconsistencies

2. **Remove from Enum**
   - Create migration to change existing values to `PUBLIC_TENANT`
   - Remove deprecated values from enum
   - Update type definitions
   - Pros: Cleaner schema, removes confusion
   - Cons: Requires migration, may break existing code

3. **Document Behavior**
   - Keep enum but document that deprecated values are treated as PUBLIC_TENANT
   - Add validation to prevent new deprecated values
   - Pros: No migration, preserves backward compatibility
   - Cons: Still confusing, technical debt

**Minimal Probe:** See SQL probes section for queries to check visibility level distribution.

---

### 1.5 Legacy Periods Array

**Gap:** Frontend has hardcoded `legacyPeriods` array instead of fetching from backend.

**Evidence:**
- Frontend: `apps/web/src/app/dashboard/okrs/page.tsx:313-318`
- Comment says: "[phase6-polish]: hydrate from backend once periods endpoint exists"
- No backend endpoint found for periods

**Questions:**
- Should periods be fetched from backend?
- Are legacy periods still needed?
- Should this be removed?

**Decision Options:**

1. **Do Nothing** (current state)
   - Pros: No changes needed
   - Cons: Hardcoded data, technical debt

2. **Remove Legacy Periods**
   - Remove `legacyPeriods` array
   - Use only cycles from `/reports/cycles/active`
   - Pros: Cleaner code, single source of truth
   - Cons: May break if cycles endpoint fails

3. **Create Periods Endpoint**
   - Add `/reports/periods` endpoint
   - Return periods from database (if periods table exists)
   - Wire up frontend to use endpoint
   - Pros: Completes feature, dynamic data
   - Cons: Requires backend work, may not be needed

**Minimal Probe:** Check if periods are actually used or if cycles are sufficient.

---

### 1.6 Key Result Visibility Inheritance

**Gap:** Key Results have `visibilityLevel` field but always inherit from parent Objective.

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:236`
- Backend: `services/core-api/src/modules/okr/okr-visibility.service.ts:129-135`
- Frontend: `apps/web/src/hooks/useTenantPermissions.ts:192-214`

**Questions:**
- Should KR visibility be independent?
- Is KR visibility field vestigial?
- Should it be removed from schema?

**Decision Options:**

1. **Do Nothing** (current state)
   - Pros: No changes needed, preserves flexibility
   - Cons: Unused field, confusing schema

2. **Remove KR Visibility Field**
   - Drop `key_results.visibilityLevel` column
   - Always use parent objective visibility
   - Pros: Cleaner schema, removes confusion
   - Cons: Requires migration, loses flexibility

3. **Implement Independent KR Visibility**
   - Use KR visibility field if set, otherwise inherit from parent
   - Update visibility service logic
   - Pros: More flexible, uses existing field
   - Cons: More complex logic, may not be needed

**Minimal Probe:** See SQL probes section for queries to check KR visibility values.

---

### 1.7 Objective-KeyResult Many-to-Many vs UI Expectation

**Gap:** Schema allows many-to-many relationship but UI assumes one-to-many.

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:256-269` (junction table)
- Frontend: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:107-124` (assumes 1-N)

**Questions:**
- Are shared key results across objectives needed?
- Should junction table be removed?
- Is many-to-many planned for future?

**Decision Options:**

1. **Do Nothing** (current state)
   - Pros: Preserves flexibility, no migration
   - Cons: Confusing schema, unused feature

2. **Remove Junction Table**
   - Add `objectiveId` FK directly to `key_results` table
   - Migrate data (if multiple objectives per KR, create copies)
   - Pros: Simpler schema, matches UI expectations
   - Cons: Requires migration, may lose data

3. **Implement Many-to-Many UI**
   - Update UI to show shared key results
   - Update backend queries to handle many-to-many
   - Pros: Uses existing schema, more flexible
   - Cons: Significant UI/backend work

**Minimal Probe:** See SQL probes section for queries to check KR objective relationships.

---

## 2. Decision Options Summary

### 2.1 High Priority (User-Facing Confusion)

1. **Period vs Cycle**: Clarify relationship or deprecate period
2. **Pillar Usage**: Implement UI or remove schema
3. **Legacy Periods**: Remove hardcoded array or create endpoint

### 2.2 Medium Priority (Technical Debt)

1. **Visibility Deprecation**: Remove deprecated enum values or document behavior
2. **KR Visibility**: Remove field or implement independent visibility
3. **Planned Cycle ID**: Remove from frontend or add to schema

### 2.3 Low Priority (Schema Flexibility)

1. **Many-to-Many OKR-KR**: Document as future feature or simplify to 1-N

---

## 3. Minimal Probes

### 3.1 Period vs Cycle Distribution

**SQL Query:**
```sql
-- Check objectives with both period and cycle
SELECT 
  o.period,
  c.name as cycle_name,
  c.status as cycle_status,
  COUNT(*) as count
FROM objectives o
LEFT JOIN cycles c ON o."cycleId" = c.id
GROUP BY o.period, c.name, c.status
ORDER BY count DESC;
```

**Expected Output:** Distribution showing if objectives use both period and cycle, or if they're mutually exclusive.

**Insight:** Determines if period is vestigial or actively used alongside cycles.

---

### 3.2 Pillar Usage

**SQL Query:**
```sql
-- Check pillar usage
SELECT 
  COUNT(*) as total_objectives,
  COUNT("pillarId") as objectives_with_pillar,
  COUNT(*) - COUNT("pillarId") as objectives_without_pillar
FROM objectives;

-- Check distinct pillars in use
SELECT 
  sp.id,
  sp.name,
  COUNT(o.id) as objective_count
FROM strategic_pillars sp
LEFT JOIN objectives o ON o."pillarId" = sp.id
GROUP BY sp.id, sp.name
ORDER BY objective_count DESC;
```

**Expected Output:** Count of objectives with/without pillars, and list of pillars in use.

**Insight:** Determines if pillars are actively used or can be removed.

---

### 3.3 Visibility Level Distribution

**SQL Query:**
```sql
-- Check visibility level distribution
SELECT 
  "visibilityLevel",
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM objectives) as percentage
FROM objectives
GROUP BY "visibilityLevel"
ORDER BY count DESC;

-- Check deprecated visibility levels
SELECT 
  COUNT(*) as deprecated_count
FROM objectives
WHERE "visibilityLevel" IN ('WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY');
```

**Expected Output:** Distribution of visibility levels, including deprecated ones.

**Insight:** Determines if deprecated visibility levels are in use and need migration.

---

### 3.4 Key Result Visibility vs Inheritance

**SQL Query:**
```sql
-- Check KR visibility vs parent objective visibility
SELECT 
  kr."visibilityLevel" as kr_visibility,
  o."visibilityLevel" as obj_visibility,
  COUNT(*) as count
FROM key_results kr
JOIN objective_key_results okr ON kr.id = okr."keyResultId"
JOIN objectives o ON okr."objectiveId" = o.id
GROUP BY kr."visibilityLevel", o."visibilityLevel"
ORDER BY count DESC;

-- Check if any KRs have different visibility than parent
SELECT 
  COUNT(*) as mismatched_count
FROM key_results kr
JOIN objective_key_results okr ON kr.id = okr."keyResultId"
JOIN objectives o ON okr."objectiveId" = o.id
WHERE kr."visibilityLevel" != o."visibilityLevel";
```

**Expected Output:** Distribution showing if KR visibility matches parent objective visibility.

**Insight:** Determines if KR visibility field is vestigial or actually used.

---

### 3.5 Key Result Objective Relationships

**SQL Query:**
```sql
-- Check KR objective relationships (many-to-many vs one-to-many)
SELECT 
  kr.id,
  kr.title,
  COUNT(okr."objectiveId") as objective_count
FROM key_results kr
JOIN objective_key_results okr ON kr.id = okr."keyResultId"
GROUP BY kr.id, kr.title
HAVING COUNT(okr."objectiveId") > 1
ORDER BY objective_count DESC;

-- Check if any KRs belong to multiple objectives
SELECT 
  COUNT(DISTINCT kr.id) as shared_krs,
  COUNT(DISTINCT okr."keyResultId") as total_krs
FROM key_results kr
JOIN objective_key_results okr ON kr.id = okr."keyResultId"
WHERE (
  SELECT COUNT(*) 
  FROM objective_key_results okr2 
  WHERE okr2."keyResultId" = kr.id
) > 1;
```

**Expected Output:** Count of key results that belong to multiple objectives.

**Insight:** Determines if many-to-many relationship is used or can be simplified to 1-N.

---

## 4. Evidence File References

- Schema: `services/core-api/prisma/schema.prisma`
- Frontend OKR Page: `apps/web/src/app/dashboard/okrs/page.tsx`
- Frontend Container: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx`
- Visibility Service: `services/core-api/src/modules/okr/okr-visibility.service.ts`
- Objective Service: `services/core-api/src/modules/okr/objective.service.ts`

