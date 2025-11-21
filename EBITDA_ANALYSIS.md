# EBITDA Key Result Analysis

## Key Result: "Improve EBITDA to 134M"

### Problem Identified
The Key Result is showing **102,415,000% complete**, which is clearly incorrect. Progress percentages should be between 0-100%.

### Data Analysis

#### From JSON Export (`objectives_export_file_15229_163989_Organization_15229_20251120194457.json`):
- **Title**: "Improve EBITDA to 134M"
- **ID**: 2295722
- **Progress** (stored): `102415000.0` ❌ **This is the problem!**
- **Status**: "On Track"
- **Target Type**: "Reach"
- **Start Value**: `0.0`
- **Target Value**: `134000000.0` (134M)
- **Owner**: Frederic Laziou
- **Period**: Annual 2025 (2025-01-01 to 2025-12-31)

#### From CSV Export (`Vivagoals.csv`):
- **Target**: 134000000 (134M)
- **Start**: 0
- **Latest Check-in** (2025-11-08): Current Value: **102.42 M** (102,420,000)
- **Stored Progress**: 102415000% ❌

### Expected Calculation

For a **REACH** metric type:
```
Progress = (currentValue / targetValue) * 100
Progress = (102,420,000 / 134,000,000) * 100
Progress = 76.43%
```

### Root Cause

1. **Data Mapping Issue**: In VivaGoals JSON export, when `"Metric Unit": "Number"`, the `"Progress"` field contains the **current value** (102415000.0 = 102.415M), NOT a percentage
2. **Import Bug**: The import service incorrectly maps `jsonRow.progress` (which is the current value) to `progressPercent` field:
   - Line 319: `progressPercent: jsonRow.progressPercent ?? jsonRow.progress ?? null`
   - This treats 102415000.0 as a percentage instead of recognizing it as the currentValue
3. **Missing Calculation**: The import should calculate progress percentage from: `(currentValue / targetValue) * 100 = (102415000 / 134000000) * 100 = 76.43%`
4. **UI Display Issue**: The UI displays the incorrectly stored progress value without validation

### Current Values Breakdown

Based on check-ins:
- **Latest Current Value**: ~102,420,000 (102.42M) from check-in on 2025-11-08
- **Target Value**: 134,000,000 (134M)
- **Actual Progress**: ~76.43%
- **Stored Progress**: 102,415,000% ❌

### Historical Check-ins (from JSON):
- 2025-11-08: 102.42 M (On Track)
- 2025-09-11: 72.64 M (Behind)
- 2025-08-19: 59.11 M (Behind)
- 2025-07-11: 50.28 M (Behind)
- 2025-06-16: 37.57 M (Behind)
- 2025-05-19: 28.28 M (Behind)
- 2025-04-08: 23.26 M (On Track)
- 2025-03-12: 15.8 M (Behind)
- 2025-03-09: 8.9 M (Behind)

### Recommendations

1. **✅ UI Fix (COMPLETED)**: Added progress clamping in the UI to ensure displayed progress is always 0-100%
2. **🔧 Import Fix (NEEDED)**: Fix the JSON import to properly handle `"Progress"` field:
   - When `"Metric Unit": "Number"`, treat `"Progress"` as `currentValue`, not `progressPercent`
   - Calculate `progressPercent` from: `(Progress / Target) * 100`
   - Store `currentValue = Progress` and `progress = calculated percentage`
3. **🔧 Data Fix (NEEDED)**: Recalculate progress for this Key Result:
   - `currentValue = 102415000` (from Progress field)
   - `progress = (102415000 / 134000000) * 100 = 76.43%`
4. **🔧 Validation**: Add validation during import to detect when Progress > Target and handle appropriately

### Files Updated (UI Fix)

1. ✅ `apps/web/src/lib/utils.ts` - Added `clampProgress` utility function
2. ✅ `apps/web/src/components/okr/ObjectiveRow.tsx` - Clamp progress display
3. ✅ `apps/web/src/components/okr/ObjectiveCard.tsx` - Clamp progress display
4. ✅ `apps/web/src/components/okr/ProgressBreakdownTooltip.tsx` - Clamp progress
5. ✅ `apps/web/src/components/okr/InlineHistoryPreview.tsx` - Clamp progress
6. ✅ `apps/web/src/components/okr/ProgressSlider.tsx` - Clamp progress display
7. ✅ `apps/web/src/components/okr/ObjectiveProgressTrendChart.tsx` - Clamp progress

### Files to Update (Backend Fix)

1. 🔧 `services/core-api/src/modules/okr/okr-import.service.ts` - Fix JSON import mapping:
   - Line 319: When unit is "Number", treat `jsonRow.progress` as `currentValue`, not `progressPercent`
   - Calculate `progressPercent` from currentValue/targetValue
2. 🔧 Backend: Recalculate progress for this specific Key Result (ID: 2295722)

