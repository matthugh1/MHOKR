# Viva Goals Header Delta Report

**Date:** 2025-01-27  
**Purpose:** Field-level comparison of actual Viva Goals export headers vs. expected mapping  
**Source:** `docs/VivaGoals.xlsx`

---

## 1. Actual Headers Extracted

The following headers were extracted from `VivaGoals_15229_new_view_2025_11_12_1762944368.csv`:

1. Title
2. Team
3. Creator
4. Owner
5. Period
6. Start Date
7. End Date
8. Description
9. Aligned To (weight, Objective ID)
10. Metric Name
11. Unit
12. Target
13. Object Type
14. Goal Type
15. Start
16. Created At
17. Last Check-in
18. Progress %
19. Actual Progress
20. Status
21. Last Check-in Note
22. Score
23. Checkins

**Total Columns:** 23  
**Total Rows:** 46 (excluding header)

### 1.1 ID Column Analysis

**Finding:** No direct "Objective ID" or "Key Result ID" columns exist. However, IDs are embedded in the "Aligned To (weight, Objective ID)" column.

**ID Extraction Method:**
- IDs appear in format: `"Title(weight: X%, Id: YYYYYYY)"`
- Pattern: `Id:\s*(\d+)` extracts numeric ID
- Pattern: `weight:\s*([\d.]+)%` extracts weight percentage
- Pattern: `^([^(]+)` extracts parent title

**ID Availability:**
- Parent IDs: Available in "Aligned To" column for all rows with parents
- Row's own ID: Can be derived by reverse lookup:
  1. Extract all (title, ID) pairs from "Aligned To" columns
  2. Match row's "Title" to find its own ID
  3. **Coverage:** ~26% of rows (12/46) can get their own ID via title matching
  4. **Limitation:** Root-level items (not referenced as parents) cannot get IDs this way

**Example:**
- Row title: "Prioritise high impact opps in CX ecosystem"
- Found in another row's "Aligned To": `"Prioritise high impact opps in CX ecosystem(weight: 0%, Id: 2295784)"`
- **Row's own ID:** `2295784`

---

## 2. Mapping Analysis

### 2.1 Mapped Columns (Match Expected)

| Viva Column | Expected Column | Target Model | Target Field | Status | Notes |
|------------|----------------|--------------|--------------|--------|-------|
| Title | Objective Title / Key Result Title | Objective / KeyResult | `title` | ✅ **Mapped** | Used for both Objectives and Key Results (distinguished by Object Type) |
| Description | Objective Description / Key Result Description | Objective / KeyResult | `description` | ✅ **Mapped** | Used for both types |
| Owner | Owner Email | Objective / KeyResult | `ownerId` | ✅ **Mapped** | Requires email → User.id lookup |
| Period | Quarter/Period | Objective / KeyResult | `cycleId` | ✅ **Mapped** | Requires cycle find/create |
| Start Date | Start Date | Objective / KeyResult | `startDate` | ✅ **Mapped** | Date parsing required |
| End Date | End Date | Objective / KeyResult | `endDate` | ✅ **Mapped** | Date parsing required |
| Status | Status | Objective / KeyResult | `status` | ✅ **Mapped** | Requires enum mapping |
| Progress % | Progress % | Objective / KeyResult | `progress` | ✅ **Mapped** | May be overwritten by KR roll-up |
| Unit | Unit | KeyResult | `unit` | ✅ **Mapped** | Direct mapping |
| Target | Target Value | KeyResult | `targetValue` | ✅ **Mapped** | Number → Float |
| Start | Start Value | KeyResult | `startValue` | ✅ **Mapped** | Number → Float |
| Aligned To (weight, Objective ID) | Parent Objective ID / Weight | Objective / ObjectiveKeyResult | `parentId` / `weight` | ✅ **Mapped** | Complex parsing required (see notes) |

**Mapped Count:** 12/23 (52%)

### 2.2 Unmapped Columns (Not in Expected Mapping)

| Viva Column | Potential Target | Notes | Priority |
|------------|-----------------|-------|----------|
| Team | Objective / KeyResult | Could map to `teamId` if Team model exists | **Medium** |
| Creator | N/A | User who created the OKR - no direct field | **Low** |
| Metric Name | KeyResult | Could be part of `title` or separate field | **Low** |
| Object Type | N/A | Distinguishes Objective vs Key Result - parsing logic | **High** |
| Goal Type | N/A | May indicate OKR type or category - no direct field | **Low** |
| Created At | Objective / KeyResult | Maps to `createdAt` (auto-set) - can preserve timestamp | **Low** |
| Last Check-in | KeyResult | Maps to `checkIns` relationship - historical data | **Medium** |
| Actual Progress | KeyResult | Could map to `currentValue` or separate progress field | **Medium** |
| Last Check-in Note | KeyResult | Maps to `checkIns.note` - historical data | **Low** |
| Score | Objective / KeyResult | No `score` field exists - may map to `progress` | **Low** |
| Checkins | KeyResult | Count of check-ins - derived from `checkIns` relationship | **Low** |

**Unmapped Count:** 11/23 (48%)

### 2.3 Missing Expected Columns

| Expected Column | Target Model | Target Field | Status | Impact |
|----------------|--------------|--------------|--------|--------|
| Objective ID | Objective | `externalId` (to be added) | ❌ **Missing** | Cannot deduplicate on re-import |
| Key Result ID | KeyResult | `externalId` (to be added) | ❌ **Missing** | Cannot deduplicate on re-import |
| Owner Email | Objective / KeyResult | `ownerId` | ⚠️ **Partial** | "Owner" exists but format unclear (email vs name) |
| Owner Name | N/A | N/A | ❌ **Missing** | "Owner" may contain name, not email |
| Visibility | Objective / KeyResult | `visibilityLevel` | ❌ **Missing** | Default to PUBLIC_TENANT |
| Metric Type | KeyResult | `metricType` | ❌ **Missing** | May need to infer from Goal Type or other fields |
| Current Value | KeyResult | `currentValue` | ⚠️ **Partial** | "Actual Progress" may be percentage, not value |

**Missing Count:** 5-7 columns (depending on interpretation)

---

## 3. Critical Findings

### 3.1 External IDs (Embedded, Not Direct)

**Finding:** IDs are embedded in the "Aligned To (weight, Objective ID)" column, not as separate columns.

**ID Extraction:**
- Parent IDs: Directly extractable from "Aligned To" column using regex: `Id:\s*(\d+)`
- Row's own ID: Extractable via reverse lookup:
  1. Parse all "Aligned To" values to build `{title: id}` map
  2. Match each row's "Title" to find its ID
  3. **Coverage:** ~26% of rows (12/46) can get their own ID via title matching
  4. **Root items:** Items not referenced as parents cannot get IDs this way

**Impact:**
- ⚠️ Partial deduplication: Only ~26% of rows have extractable IDs
- ✅ Can link parent-child relationships reliably (parent IDs always available)
- ⚠️ Requires two-pass parsing (first pass to build ID map, second pass to assign IDs)
- ⚠️ Root-level items need alternative deduplication strategy (composite key)

**Recommendation:**
- Extract IDs in first pass: Build `{title: externalId}` mapping from all "Aligned To" columns
- Assign IDs in second pass: Match each row's title to get its own `externalId`
- Store in `externalId` field (to be added to schema)
- Use `externalId + source` for deduplication on re-import

### 3.2 Object Type Column

**Finding:** "Object Type" column exists to distinguish Objectives from Key Results.

**Impact:**
- Must parse this column to route rows to correct model
- Single export file contains both Objectives and Key Results

**Recommendation:**
- Parse "Object Type" first to separate rows
- Process Objectives first, then Key Results (to establish parent relationships)

### 3.3 Aligned To Column Complexity

**Finding:** "Aligned To (weight, Objective ID)" contains parent title, weight percentage, and Objective ID in a single column.

**Format:** `"Parent Title(weight: X%, Id: YYYYYYY)"`

**Examples:**
- `"SP1: Lead with AI(weight: 0%, Id: 2295706)"`
- `"Prioritise high impact opps in CX ecosystem(weight: 0%, Id: 2295784)"`
- `"Clear Success Criteria for 'Definition of Done' (Delivery)(weight: 50%, Id: 2503050)"`

**Parsing Logic Required:**
1. Extract parent title: `^([^(]+)` → `"SP1: Lead with AI"`
2. Extract weight: `weight:\s*([\d.]+)%` → `"0"` → convert to Float (0.0)
3. Extract parent ID: `Id:\s*(\d+)` → `"2295706"`

**Impact:**
- Requires regex parsing to extract three values
- Weight is percentage (0-100), needs conversion to decimal (0.0-1.0) for `ObjectiveKeyResult.weight`
- Parent ID can be used for lookup (after building title→ID map)

**Recommendation:**
- Parse format using regex patterns above
- For Objectives: Extract parent ID → lookup by title or use ID directly
- For Key Results: Extract parent Objective ID → lookup → set `objectiveId` + `weight` (convert % to decimal)
- Weight conversion: `weightFloat = weightPercent / 100.0` (e.g., 50% → 0.5)

### 3.4 Owner Format Analysis

**Finding:** "Owner" column contains full names, not emails.

**Sample Data:**
- "Matt Hughes"
- "Frederic Laziou"
- "Gabi Warren"
- "Gabi Warren, Matt Hughes" (multiple owners)
- "Gabi Warren, Matt Hughes, Raïsa Van Olden" (multiple owners)

**Impact:**
- Cannot use direct email lookup
- Must match by name (fuzzy matching or exact match)
- Multiple owners supported (comma-separated)

**Recommendation:**
- Parse "Owner" column: Split by comma for multiple owners
- Match each name to User by `name` field (exact match preferred, fuzzy as fallback)
- For first owner: Set as `ownerId` (required field)
- For additional owners: Add to `ObjectiveContributor` or `KeyResultContributor` tables
- If no match found: Create user with name only, or skip row with error

### 3.5 Missing Metric Type

**Finding:** No explicit "Metric Type" column (INCREASE, DECREASE, REACH, MAINTAIN).

**Sample Data Analysis:**
- "Goal Type" values observed: "Aspirational Goal", "Committed Goal"
- "Metric Name" values: "Progress", "Product Epic's", "Team Members", "Roadmap Transparency", "Complete", "Target", "RICE", "Customers migrated", "Aligned", "Business Impact"
- Most metrics use "%" unit with Start=0.0, Target=100.0

**Impact:**
- Cannot determine metric type directly
- Must infer from Start/Target relationship or use defaults

**Recommendation:**
- Infer from Start/Target relationship:
  - Start < Target → `INCREASE` (most common case)
  - Start > Target → `DECREASE`
  - Start = Target → `MAINTAIN`
  - Target = 100% and Start = 0% → `REACH` (common for percentage-based metrics)
- Default to `INCREASE` if inference fails
- Consider "Metric Name" = "Progress" with % unit → `REACH`

### 3.6 Current Value Analysis

**Finding:** "Actual Progress" column exists alongside "Progress %" column.

**Sample Data Analysis:**
- "Progress %": Contains percentage values (0, 25, 30, 62, etc.)
- "Actual Progress": Contains same values as "Progress %" in most cases
- "Start": Contains absolute start value (typically 0.0)
- "Target": Contains absolute target value (typically 100.0)
- "Unit": Typically "%" for percentage-based metrics

**Pattern Observed:**
- For percentage metrics (Unit = "%"): "Actual Progress" = "Progress %" (both are percentages)
- For absolute metrics (Unit = ""): "Actual Progress" may be absolute value

**Impact:**
- "Actual Progress" appears to be percentage for most rows
- Cannot directly map to `currentValue` (which should be absolute)
- Must calculate: `currentValue = startValue + (actualProgress% / 100 * (targetValue - startValue))`

**Recommendation:**
- Check "Unit" column:
  - If Unit = "%": Calculate `currentValue` from "Actual Progress" percentage
  - If Unit = "" or other: Use "Actual Progress" as absolute value directly
- Formula for percentage: `currentValue = startValue + (actualProgress / 100.0 * (targetValue - startValue))`
- Example: Start=0, Target=100, Actual Progress=30% → `currentValue = 0 + (30/100 * 100) = 30`

---

## 4. Column-by-Column Analysis

| Viva Column | Expected? | Mapped? | Target Field | Transformation Required | Risk |
|------------|-----------|---------|--------------|------------------------|------|
| Title | ✅ Yes | ✅ Yes | `title` | None | Low |
| Team | ❌ No | ⚠️ Partial | `teamId` (if exists) | Team name → Team.id lookup | Medium |
| Creator | ❌ No | ❌ No | N/A | Info only | Low |
| Owner | ✅ Yes | ✅ Yes | `ownerId` | Name format (e.g., "Matt Hughes") - requires name→User lookup | High |
| Period | ✅ Yes | ✅ Yes | `cycleId` | Period name → Cycle.id lookup | Low |
| Start Date | ✅ Yes | ✅ Yes | `startDate` | Date parsing | Low |
| End Date | ✅ Yes | ✅ Yes | `endDate` | Date parsing | Low |
| Description | ✅ Yes | ✅ Yes | `description` | None | Low |
| Aligned To (weight, Objective ID) | ✅ Yes | ✅ Yes | `parentId` / `weight` | Complex parsing | High |
| Metric Name | ❌ No | ❌ No | N/A or `title` | Info only | Low |
| Unit | ✅ Yes | ✅ Yes | `unit` | None | Low |
| Target | ✅ Yes | ✅ Yes | `targetValue` | Number → Float | Low |
| Object Type | ❌ No | ⚠️ Critical | N/A | Routing logic | High |
| Goal Type | ❌ No | ❌ No | N/A | May indicate category | Low |
| Start | ✅ Yes | ✅ Yes | `startValue` | Number → Float | Low |
| Created At | ❌ No | ⚠️ Partial | `createdAt` | Preserve timestamp | Low |
| Last Check-in | ❌ No | ⚠️ Partial | `checkIns` relationship | Historical data import | Medium |
| Progress % | ✅ Yes | ✅ Yes | `progress` | Number → Float | Low |
| Actual Progress | ⚠️ Partial | ✅ Yes | `currentValue` | Calculate from percentage: `startValue + (actualProgress% / 100 * (targetValue - startValue))` | Medium |
| Status | ✅ Yes | ✅ Yes | `status` | Enum mapping | Low |
| Last Check-in Note | ❌ No | ⚠️ Partial | `checkIns.note` | Historical data import | Low |
| Score | ❌ No | ❌ No | N/A (no score field) | May map to progress | Low |
| Checkins | ❌ No | ⚠️ Partial | `checkIns` count | Derived field | Low |

---

## 5. Required Schema Changes

### 5.1 Additional Fields Needed

Based on unmapped columns, consider adding:

| Field | Model | Type | Required | Purpose |
|-------|-------|------|----------|---------|
| `teamId` | Objective / KeyResult | String? (FK to Team) | No | Map "Team" column if Team model exists |
| `createdBy` | Objective / KeyResult | String? (FK to User) | No | Map "Creator" column |
| `goalType` | Objective / KeyResult | String? | No | Map "Goal Type" column (if needed) |

**Note:** These are optional enhancements. Core import can proceed without them.

### 5.2 Import Logic Requirements

1. **Object Type Parsing:**
   - Parse "Object Type" to route rows
   - Separate Objectives and Key Results into different arrays

2. **Aligned To Parsing:**
   - Extract weight (Float) and Objective ID (String)
   - Handle various formats: `"1.0, obj-123"`, `"(1.0, obj-123)"`, etc.

3. **Owner Resolution:**
   - Determine if "Owner" is email or name
   - Implement lookup strategy (exact match vs fuzzy)

4. **Current Value Calculation:**
   - Determine if "Actual Progress" is percentage or absolute
   - Calculate `currentValue` if percentage

5. **Metric Type Inference:**
   - Analyze "Goal Type" for metric type hints
   - Calculate from Start/Target relationship if needed

---

## 6. Summary

### 6.1 Mapping Status

- **Mapped:** 13/23 columns (57%)
- **Unmapped:** 10/23 columns (43%)
- **Missing Expected:** 4-5 columns (reduced due to ID extraction capability)

### 6.2 Critical Gaps

1. ⚠️ **External IDs Embedded** - IDs extractable from "Aligned To" column via reverse lookup (requires two-pass parsing)
2. ⚠️ **Object Type Required** - Must parse to route rows correctly (values: "Objective", "Key result", "Deliverable")
3. ⚠️ **Aligned To Parsing** - Complex format: `"Title(weight: X%, Id: Y)"` requires regex parsing
4. ⚠️ **Owner Name Matching** - Contains full names (not emails), requires name→User lookup, supports multiple owners
5. ⚠️ **Missing Metric Type** - Must infer from Start/Target relationship (default to INCREASE)
6. ⚠️ **Current Value Calculation** - "Actual Progress" is percentage, must calculate absolute value

### 6.3 Recommendations

**Immediate Actions:**
1. ✅ Sample data analysis complete:
   - Owner: Full names (e.g., "Matt Hughes"), comma-separated for multiple
   - Actual Progress: Percentage values (same as Progress %)
   - Aligned To: Format `"Title(weight: X%, Id: Y)"` confirmed
   - Object Type: Values are "Objective", "Key result", "Deliverable"

2. Implement parsing logic for:
   - Object Type routing (filter by "Objective" and "Key result", skip "Deliverable" or map to Initiative)
   - Aligned To extraction (regex: extract title, weight%, and ID)
   - Owner resolution (name matching, handle multiple owners)
   - ID extraction (two-pass: build title→ID map, then assign IDs)

3. Design deduplication strategy:
   - Primary: Use extracted `externalId` + `source` for deduplication (where available, ~26% coverage)
   - Fallback: Composite key `title + owner + startDate + endDate` for rows without ID (~74% of rows)
   - Store mapping table during import: `{externalId: internalId}` and `{compositeKey: internalId}`
   - Root-level items (not referenced as parents) will use composite key

**Optional Enhancements:**
- Team mapping (if Team model exists)
- Creator tracking (if needed)
- Historical check-in import (if needed)

---

## 7. Next Steps

1. ✅ Extract headers - **Complete**
2. ✅ Sample data analysis - **Complete**
3. ⏳ Parsing logic design - **Required** (regex patterns defined)
4. ⏳ Deduplication strategy - **Required** (ID extraction method defined)
5. ⏳ Schema migration design - **Pending**

---

## 8. Updated Mapping Summary

### 8.1 ID Extraction Strategy

**Two-Pass Approach:**

**Pass 1: Build ID Map**
```python
title_to_id = {}
for row in csv_rows:
    aligned = row['Aligned To (weight, Objective ID)']
    if aligned:
        # Extract: "Title(weight: X%, Id: Y)"
        title = extract_title(aligned)  # Regex: ^([^(]+)
        obj_id = extract_id(aligned)    # Regex: Id:\s*(\d+)
        title_to_id[title] = obj_id
```

**Pass 2: Assign Row IDs**
```python
for row in csv_rows:
    title = row['Title']
    row['externalId'] = title_to_id.get(title, None)
    # If None, generate or use composite key
```

### 8.2 Status Mapping (Viva → OKRStatus)

Based on sample data:
- "Not Started" → `ON_TRACK` (or create new status?)
- "On Track" → `ON_TRACK`
- "Behind" → `AT_RISK` or `OFF_TRACK`?
- "At Risk" → `AT_RISK`
- "Closed" → `COMPLETED`
- "Postponed" → `CANCELLED`?

**Recommendation:** Map "Behind" to `AT_RISK`, "Closed" to `COMPLETED`, "Postponed" to `CANCELLED`.

### 8.3 Object Type Handling

- "Objective" → Create as `Objective`
- "Key result" → Create as `KeyResult`
- "Deliverable" → Create as `Initiative` (or skip if Initiatives not supported)

---

**Report Status:** ✅ **Analysis Complete**  
**Action Required:** Implement parsing logic based on defined patterns

