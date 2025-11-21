# Viva Goals Feature Gap Analysis

**Date:** 2025-01-23  
**Purpose:** Comprehensive analysis of Viva Goals export data vs. current application capabilities  
**Export Files Analyzed:**
- `objectives_export_file_15229_163989_Organization_15229_20251120194457.json` (111,554 lines)
- `checkins_export_file_15229_163989_Organization_15229_20251120194301.json` (61,889 lines)
- `comments_export_file_15229_163989_Organization_15229_20251120194254.json`
- `Teams_export_file_15229_163989_Organization_15229_20251120193812.json`
- `Tags_export_file_15229_163989_Organization_15229_20251120193812.json`
- `TimePeriods_export_file_15229_163989_Organization_15229_20251120193812.json`
- `Users_export_file_15229_163989_Organization_15229_20251120193812.json`

---

## Executive Summary

This analysis identifies **critical gaps** and **nice-to-have enhancements** needed to replicate Viva Goals functionality. The application has a solid foundation but is missing several enterprise features that Viva Goals provides.

---

## 1. Core OKR Features

### ✅ **FULLY SUPPORTED**

| Feature | Viva Goals | Current App | Status |
|---------|------------|-------------|--------|
| Objectives & Key Results | ✅ | ✅ | ✅ Complete |
| Hierarchical OKRs (Parent/Children) | ✅ | ✅ | ✅ Complete |
| Owner Assignment | ✅ | ✅ | ✅ Complete |
| Teams Assignment | ✅ | ✅ | ✅ Complete |
| Time Periods | ✅ | ✅ | ✅ Complete |
| Start/End Dates | ✅ | ✅ | ✅ Complete |
| Progress Tracking | ✅ | ✅ | ✅ Complete |
| Status (On Track, At Risk, etc.) | ✅ | ✅ | ✅ Complete |
| Goal Type (Aspirational/Committed) | ✅ | ✅ | ✅ Complete |
| Tags | ✅ | ✅ | ✅ Complete (schema exists) |
| Comments | ✅ | ✅ | ✅ Complete |
| Check-ins | ✅ | ✅ | ✅ Complete |
| Alignment (Parent-Child links) | ✅ | ✅ | ✅ Complete |

---

## 2. CRITICAL GAPS - Missing Features

### 🔴 **HIGH PRIORITY - Core Functionality**

#### 2.1 **Phased Targets / Milestones**
**Viva Goals:** Supports phased targets with intervals (monthly, quarterly) and target values/dates
```json
"Phased Targets": {
  "Interval": "monthly",
  "Phased Targets": [
    {"Target Value": 22.0, "Target Date": "2024-04-01"},
    {"Target Value": 50.0, "Target Date": "2024-07-01"},
    {"Target Value": 73.0, "Target Date": "2024-10-01"},
    {"Target Value": 100.0, "Target Date": "2024-12-31"}
  ]
}
```

**Current App:** ❌ **NOT SUPPORTED**
- No phased target tracking
- No milestone management
- No intermediate goal tracking

**Impact:** High - Many organizations use phased targets for quarterly planning and progress tracking

**Recommendation:** 
- Add `PhasedTarget` model with `targetValue`, `targetDate`, `interval` fields
- Link to Objectives/KeyResults
- Add UI for milestone visualization

---

#### 2.2 **Delegation**
**Viva Goals:** Supports delegating OKRs to other users
```json
"Delegated To": {
  "ID": 12345,
  "Name": "John Doe",
  "Email": "john@example.com"
}
```

**Current App:** ❌ **NOT SUPPORTED**
- No delegation mechanism
- Cannot assign OKR responsibility to someone else while maintaining original owner

**Impact:** Medium-High - Important for organizational flexibility

**Recommendation:**
- Add `delegatedToId` field to Objective/KeyResult models
- Maintain original `ownerId` for audit purposes
- Update permission checks to consider delegated users

---

#### 2.3 **Check-in Owners (Separate from OKR Owners)**
**Viva Goals:** Separate "Check-in Owners" who are responsible for updating check-ins
```json
"Check-in Owners": [
  {
    "ID": 166299,
    "Name": "Cyril Roux",
    "Email": "cyril.leroux@ext.puzzel.com"
  }
]
```

**Current App:** ❌ **NOT SUPPORTED**
- Check-ins are tied to the OKR owner only
- No separate check-in responsibility assignment

**Impact:** Medium - Useful for organizations where OKR owner ≠ person doing updates

**Recommendation:**
- Add `checkInOwnerIds` array field to Objective/KeyResult
- Update check-in permissions to allow check-in owners
- Add UI for managing check-in owners

---

#### 2.4 **Granular Permissions (View/Edit/Align)**
**Viva Goals:** Granular permission control
```json
"Permissions": {
  "View": "Everybody",
  "Edit": {},  // Empty = only owner
  "Align": "Everybody"
}
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Has `visibilityLevel` (PUBLIC_TENANT, PRIVATE, etc.)
- Has permission service but granular Edit/Align controls missing
- No per-OKR permission overrides

**Impact:** High - Enterprise customers need fine-grained access control

**Recommendation:**
- Extend permission model to support View/Edit/Align separately
- Add per-OKR permission overrides
- Update permission service to check granular permissions

---

#### 2.5 **Progress and Status Configuration**
**Viva Goals:** Configurable progress/status update methods
```json
"Progress and Status Configuration": {
  "Progress": "Update from Children",  // or "Update Manually"
  "Status": "Update based on Progress",  // or "Update Manually"
  "Data Source": null  // or integration source
}
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Has `manualProgress` flag on Objective
- No equivalent for Key Results
- No "Data Source" tracking for integrations
- No status update configuration

**Impact:** Medium - Important for organizations using integrations

**Recommendation:**
- Add `progressUpdateMethod` enum (AUTO_FROM_CHILDREN, AUTO_FROM_KRS, MANUAL, DATA_SOURCE)
- Add `statusUpdateMethod` enum (AUTO_FROM_PROGRESS, MANUAL)
- Add `dataSource` field for integration tracking
- Apply to both Objectives and Key Results

---

#### 2.6 **Outcome Configuration for Key Results**
**Viva Goals:** Detailed outcome configuration for Key Results
```json
"Outcome": {
  "Outcome Type": "Metric",  // or "Percentage"
  "Metric Name": "CARR (MNOK)",
  "Metric Unit": "Number",
  "Start": 458000000.0,
  "Target": 556000000.0,
  "Target Type": "Increase From"  // or "Decrease From", "Reach", etc.
}
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Has `metricType` (INCREASE, DECREASE, REACH, MAINTAIN)
- Has `startValue`, `targetValue`, `currentValue`
- Has `unit` field
- Missing: `metricName` (human-readable name)
- Missing: `outcomeType` distinction (Metric vs Percentage)

**Impact:** Low-Medium - Mostly cosmetic but improves UX

**Recommendation:**
- Add `metricName` field to KeyResult
- Add `outcomeType` enum (METRIC, PERCENTAGE)
- Enhance UI to display metric names prominently

---

#### 2.7 **Alignment Weights**
**Viva Goals:** Supports weighted alignment between OKRs
```json
"Alignment": [
  {
    "ID": 1325119,
    "Title": "Parent Objective",
    "Weight": "0.0%"  // Can be weighted
  }
]
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Has `weight` field on `ObjectiveKeyResult` junction table (defaults to 1.0)
- No UI for setting alignment weights
- Weight not exposed in alignment relationships

**Impact:** Medium - Important for organizations with weighted OKR cascading

**Recommendation:**
- Expose weight in alignment API responses
- Add UI for setting alignment weights
- Update progress calculation to use weights

---

#### 2.8 **Score Field**
**Viva Goals:** Has a `Score` field (0.0 in export, purpose unclear)
```json
"Score": 0.0
```

**Current App:** ❌ **NOT SUPPORTED**
- No score field

**Impact:** Low - May be Viva Goals internal metric

**Recommendation:**
- Investigate if score is needed
- If yes, add `score` Float field

---

### 🟡 **MEDIUM PRIORITY - Enhanced Features**

#### 2.9 **Team Hierarchy (Parent Teams)**
**Viva Goals:** Teams can have parent teams
```json
{
  "ID": 42848,
  "Team Name": "Commercial",
  "Parent Team": "All Puzzel",
  "Team Type": "Classic",  // or "Modern"
  "Status": "Active"  // or "Archived"
}
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Teams exist but no parent team relationship
- No team type distinction
- No team status (Active/Archived)

**Impact:** Medium - Important for large organizations with team hierarchies

**Recommendation:**
- Add `parentTeamId` to Team model
- Add `teamType` enum (CLASSIC, MODERN)
- Add `status` enum (ACTIVE, ARCHIVED)

---

#### 2.10 **Multiple Owners**
**Viva Goals:** Supports multiple owners (array)
```json
"Owner": [
  {"ID": 169735, "Name": "Frederic Laziou", "Email": "frederic.laziou@puzzel.com"}
]
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Single `ownerId` field
- Has `ObjectiveContributor` model but not the same as owners

**Impact:** Medium - Some organizations prefer shared ownership

**Recommendation:**
- Consider if multiple owners needed vs. owner + contributors
- If needed, create `ObjectiveOwner` junction table similar to Contributors

---

#### 2.11 **Check-in Notes with HTML**
**Viva Goals:** Check-in notes support HTML formatting
```json
"Check In Note": {
  "Check In Note": "Plain text note",
  "Check In Note HTML": "<div>Formatted HTML</div>"
}
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Has `note` field (plain text)
- No HTML support
- No rich text formatting

**Impact:** Low-Medium - Nice-to-have for better formatting

**Recommendation:**
- Add `noteHtml` field to CheckIn model
- Consider rich text editor for check-in notes
- Or use markdown and convert to HTML

---

#### 2.12 **Check-in Activity Date vs Check-in Date**
**Viva Goals:** Separate dates for check-in entry and activity
```json
{
  "CheckIn Date": "2023-11-08 00:00:00",  // When check-in was created
  "Activity Date": "2023-11-08"  // What date the check-in refers to
}
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Only has `createdAt` (when check-in was created)
- No separate activity date

**Impact:** Low - Useful for backdating check-ins

**Recommendation:**
- Add `activityDate` field to CheckIn model
- Default to `createdAt` if not specified

---

#### 2.13 **Last Check-in Date Tracking**
**Viva Goals:** Tracks last check-in date on OKR
```json
"Last Check-in": "2025-10-10"
```

**Current App:** ❌ **NOT SUPPORTED**
- No `lastCheckInAt` field on Objective/KeyResult

**Impact:** Low-Medium - Useful for identifying stale OKRs

**Recommendation:**
- Add `lastCheckInAt` DateTime field
- Update on check-in creation
- Use for "needs attention" filtering

---

#### 2.14 **Team Owners**
**Viva Goals:** Teams have owners (array)
```json
"Team Owners": [
  {"ID": 169735, "Name": "Frederic Laziou", "Email": "frederic.laziou@puzzel.com"}
]
```

**Current App:** ⚠️ **PARTIALLY SUPPORTED**
- Teams exist but no explicit owner field
- Could use TeamMember with role, but not explicit

**Impact:** Medium - Important for team management

**Recommendation:**
- Add `ownerId` or `ownerIds` to Team model
- Or use TeamMember with OWNER role

---

#### 2.15 **User Manager Hierarchy**
**Viva Goals:** Users have manager relationships
```json
{
  "ID": 163989,
  "Name": "Matt Hughes",
  "Manager": {
    "ID": 169735,
    "Name": "Frederic Laziou"
  }
}
```

**Current App:** ✅ **SUPPORTED**
- Has `managerId` on User model
- Supports manager chain

**Status:** ✅ Complete

---

## 3. Data Model Comparison

### Objectives/Key Results Field Mapping

| Viva Goals Field | Current App Field | Status | Notes |
|------------------|-------------------|--------|-------|
| ID | id | ✅ | cuid |
| Title | title | ✅ | |
| Type | N/A (separate models) | ✅ | Objectives and KeyResults are separate models |
| Created By | createdBy | ✅ | |
| Owner | ownerId | ⚠️ | Single owner vs. array in Viva Goals |
| Teams | teamId | ⚠️ | Single team vs. array in Viva Goals |
| Time Period | cycleId | ✅ | |
| Start Date | startDate | ✅ | |
| End Date | endDate | ✅ | |
| Alignment | parentId | ⚠️ | Single parent vs. array with weights |
| Delegated To | ❌ | ❌ | **MISSING** |
| Permissions | visibilityLevel | ⚠️ | Less granular |
| Description | description | ✅ | |
| Tags | tags (via junction) | ✅ | |
| Progress Config | manualProgress | ⚠️ | Less configurable |
| Progress | progress | ✅ | |
| Status | status | ✅ | |
| Outcome | metricType, startValue, targetValue | ⚠️ | Less detailed |
| Phased Targets | ❌ | ❌ | **MISSING** |
| Check-in Owners | ❌ | ❌ | **MISSING** |
| Parent IDs | parentId | ⚠️ | Single vs. array |
| Children | children (relation) | ✅ | |
| Score | ❌ | ❌ | **MISSING** |
| Goal Type | goalType | ✅ | |
| Created At | createdAt | ✅ | |
| Last Check-in | ❌ | ❌ | **MISSING** |

### Check-ins Field Mapping

| Viva Goals Field | Current App Field | Status | Notes |
|------------------|-------------------|--------|-------|
| ID | id | ✅ | |
| OKR ID | keyResultId | ✅ | |
| CheckIn Date | createdAt | ⚠️ | No separate activity date |
| Activity Date | ❌ | ❌ | **MISSING** |
| Check In Owner | userId | ✅ | |
| Check In Note | note | ⚠️ | No HTML support |
| Check In Note HTML | ❌ | ❌ | **MISSING** |
| Metric Name | N/A | ⚠️ | Could use keyResult.title |
| Status | N/A | ⚠️ | Status is on KeyResult, not CheckIn |
| Current Value | value | ✅ | |

---

## 4. Feature Priority Matrix

### 🔴 **CRITICAL - Must Have for Viva Goals Parity**

1. **Phased Targets** - High usage in Viva Goals exports
2. **Granular Permissions** - Enterprise requirement
3. **Delegation** - Organizational flexibility
4. **Check-in Owners** - Common organizational pattern
5. **Progress/Status Configuration** - Integration support

### 🟡 **IMPORTANT - Should Have**

6. **Alignment Weights** - Weighted cascading
7. **Team Hierarchy** - Large org support
8. **Multiple Owners** - Shared ownership
9. **Last Check-in Tracking** - Stale OKR detection
10. **Team Owners** - Team management

### 🟢 **NICE TO HAVE - Enhancements**

11. **Check-in HTML Notes** - Better formatting
12. **Activity Date** - Backdating support
13. **Score Field** - If needed
14. **Outcome Type Distinction** - UX improvement

---

## 5. Implementation Recommendations

### Phase 1: Critical Features (Weeks 1-4)

1. **Phased Targets**
   - Create `PhasedTarget` model
   - Add API endpoints
   - Build UI components

2. **Granular Permissions**
   - Extend permission model
   - Update permission service
   - Add UI controls

3. **Delegation**
   - Add `delegatedToId` fields
   - Update permission checks
   - Add delegation UI

### Phase 2: Important Features (Weeks 5-8)

4. **Check-in Owners**
   - Add `checkInOwnerIds` fields
   - Update check-in permissions
   - Add UI for managing owners

5. **Progress/Status Configuration**
   - Add configuration fields
   - Update progress calculation logic
   - Add UI for configuration

6. **Alignment Weights**
   - Expose weights in API
   - Add weight UI
   - Update progress calculation

### Phase 3: Enhancements (Weeks 9-12)

7. **Team Hierarchy**
   - Add parent team support
   - Add team type/status
   - Update team management UI

8. **Last Check-in Tracking**
   - Add `lastCheckInAt` field
   - Update on check-in creation
   - Add filtering/UI

9. **Multiple Owners** (if needed)
   - Create owner junction table
   - Update ownership logic
   - Add UI for multiple owners

---

## 6. Data Import Considerations

### Current Import Support

The application has Viva Goals import functionality (`viva-goals-json-parser.service.ts`), but may not handle all fields:

**Fields Likely Not Imported:**
- Phased Targets
- Delegated To
- Check-in Owners
- Granular Permissions
- Alignment Weights
- Activity Date
- HTML Notes

**Recommendation:** Update import service to handle all Viva Goals fields, even if features aren't fully implemented yet (store in metadata/JSON fields).

---

## 7. Summary Statistics

### Export Data Analysis

- **Total Objectives/Key Results:** ~2,000+ (estimated from file size)
- **Total Check-ins:** ~10,000+ (estimated from file size)
- **Total Comments:** ~300+ (from sample)
- **Total Teams:** 12
- **Total Tags:** 10
- **Total Time Periods:** 20+ (2023-2026)
- **Total Users:** 100+ (from sample)

### Feature Coverage

- **Core Features:** ✅ 90% Complete
- **Advanced Features:** ⚠️ 40% Complete
- **Enterprise Features:** ⚠️ 50% Complete

---

## 8. Conclusion

The application has a **solid foundation** with most core OKR functionality implemented. However, to achieve **full Viva Goals parity**, the following critical features need to be added:

1. **Phased Targets** (Critical)
2. **Granular Permissions** (Critical)
3. **Delegation** (Critical)
4. **Check-in Owners** (Important)
5. **Progress/Status Configuration** (Important)

With these additions, the application will be competitive with Viva Goals for enterprise customers.

---

**Next Steps:**
1. Review this analysis with product team
2. Prioritize features based on customer needs
3. Create detailed implementation tickets
4. Update import service to preserve all Viva Goals data
5. Plan phased rollout

