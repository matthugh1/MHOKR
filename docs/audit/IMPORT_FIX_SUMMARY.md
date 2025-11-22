# VivaGoals JSON Import Fix Summary

## Problem Identified

The JSON import was incorrectly handling the `Progress` field and not properly extracting metric data from the `Outcome` structure.

### Key Issues:
1. **Metric data not extracted from Outcome**: Parser looked for metric data at top level, but it's nested in `Outcome` object
2. **Progress field misinterpreted**: When `"Metric Unit": "Number"` or `"Dollar"`, the `Progress` field contains the **current value**, not a percentage
3. **Target Type not used**: VivaGoals provides explicit `Target Type` (e.g., "Reach", "Increase From") but we were inferring from Start/Target values
4. **Metric Name not imported**: The actual metric name (e.g., "EBITDA", "CARR (MNOK)") wasn't being stored

## Changes Made

### 1. Updated JSON Parser Interface (`viva-goals-json-parser.service.ts`)

**Updated `VivaGoalsObjective` interface:**
- Added full `Outcome` structure with `Metric Name`, `Metric Unit`, `Start`, `Target`, `Target Type`

**Updated `ParsedVivaGoalsJSONRow` interface:**
- Added `targetType` field to store VivaGoals Target Type

**Updated `parseObjectiveRow` method:**
- Extract metric data from `obj.Outcome` when available
- Fall back to top-level fields for backward compatibility
- Store `targetType` for metric type inference

### 2. Updated Import Service (`okr-import.service.ts`)

**Added `determineProgressPercent` method:**
- Correctly interprets `Progress` field based on unit:
  - **Number/Dollar**: Progress is currentValue → calculate percentage
  - **Percentage**: Determine if Progress is currentValue or completion %

**Updated `calculateCurrentValue` method:**
- Accepts `progressValue` parameter (Progress field from JSON)
- When unit is "Number" or "Dollar", uses Progress as currentValue directly
- When unit is "Percentage", handles both cases (currentValue ≤ 100 or completion % > 100)

**Updated `inferMetricType` method:**
- Now accepts `targetType` parameter
- Uses VivaGoals Target Type when available (most accurate):
  - "Reach" / "Find a baseline" → `REACH`
  - "Increase From" → `INCREASE`
  - "Decrease From" → `DECREASE`
  - "Stay Above" / "Stay Below" → `MAINTAIN`
- Falls back to Start/Target inference if targetType not available

**Updated `convertJSONRowToCSVRow` method:**
- Passes `progress` field through to ParsedVivaGoalsRow
- Uses `determineProgressPercent` to calculate correct progress percentage

**Updated `importKeyResult` method:**
- Passes `targetType` to `inferMetricType`
- Passes `progress` field to `calculateCurrentValue`

### 3. Updated CSV Parser Interface (`viva-goals-csv-parser.service.ts`)

**Updated `ParsedVivaGoalsRow` interface:**
- Added optional `progress` field for JSON imports

## Metric Unit Handling

### Units Found in JSON:
- **"Number"** - Most common (e.g., EBITDA: 102415000.0)
- **"Percentage"** - Percentage metrics (e.g., NRR, Uptime)
- **"Dollar"** - Currency metrics (e.g., ARR, Sales)

### Progress Field Interpretation:

| Unit | Progress Field Meaning | Calculation |
|------|----------------------|-------------|
| Number | Current Value | `progress = (Progress / Target) * 100` |
| Dollar | Current Value | `progress = (Progress / Target) * 100` |
| Percentage | Current Value (if ≤100) or Completion % (if >100) | Use directly or calculate based on value |

## Example: EBITDA Key Result

### Before Fix:
```json
"Progress": 102415000.0  → Stored as progressPercent: 102415000%
"Outcome": {
  "Metric Unit": "Number",
  "Target": 134000000.0
}
```
**Result**: Displayed as 102,415,000% complete ❌

### After Fix:
```json
"Progress": 102415000.0  → Recognized as currentValue
"Outcome": {
  "Metric Unit": "Number",
  "Target": 134000000.0,
  "Target Type": "Reach"
}
```
**Result**: 
- `currentValue` = 102415000.0
- `progress` = (102415000 / 134000000) * 100 = 76.43% ✅
- `metricType` = REACH ✅

## Testing Recommendations

1. **Test JSON Import** with various metric units:
   - Number unit (e.g., EBITDA)
   - Dollar unit (e.g., ARR)
   - Percentage unit (e.g., NRR)

2. **Verify Progress Calculation**:
   - Number/Dollar: Progress field should be treated as currentValue
   - Percentage: Handle both currentValue (≤100) and completion % (>100)

3. **Verify Metric Type Mapping**:
   - "Reach" → REACH
   - "Increase From" → INCREASE
   - "Decrease From" → DECREASE
   - "Stay Above/Below" → MAINTAIN

4. **Verify Metric Name Import**:
   - Check that metric names are stored correctly (e.g., "EBITDA", "CARR (MNOK)")

## Files Modified

1. `services/core-api/src/modules/okr/viva-goals-json-parser.service.ts`
2. `services/core-api/src/modules/okr/okr-import.service.ts`
3. `services/core-api/src/modules/okr/viva-goals-csv-parser.service.ts`

## Related Documentation

- `METRIC_UNIT_ANALYSIS.md` - Detailed analysis of metric types and units
- `EBITDA_ANALYSIS.md` - Specific analysis of the EBITDA Key Result issue

