# UI Metric Type Selection Improvements

## Summary

Updated the UI for selecting metric types to:
1. Use correct MetricType enum values (INCREASE, DECREASE, REACH, MAINTAIN)
2. Remove invalid options (PERCENTAGE, CUSTOM)
3. Add helpful tooltips and descriptions
4. Improve unit input with autocomplete/suggestions
5. Create reusable components for consistency

## Changes Made

### 1. Created New Components

#### `MetricTypeSelector.tsx`
- Reusable component for selecting metric types
- Shows descriptions and examples for each type
- Includes tooltip with detailed information
- Uses correct MetricType enum from `@okr-nexus/types`

**Features:**
- Tooltip with description and examples
- Clear labels: Increase, Decrease, Reach, Maintain
- Examples for each type:
  - **Increase**: "Increase revenue from $1M to $2M"
  - **Decrease**: "Decrease response time from 5s to 2s"
  - **Reach**: "Reach 134M EBITDA"
  - **Maintain**: "Stay above 1.45 CAC Payback"

#### `UnitInput.tsx`
- Enhanced unit input with autocomplete
- Shows common units based on imported data
- Combobox-style dropdown with search
- Common units include:
  - Percentage: `%`, `Percentage`
  - Currency: `$`, `USD`, `EUR`, `GBP`, `NOK`, `MNOK`, `KNOK`, `Dollar`
  - Counts: `users`, `customers`, `accounts`, `deployments`, `reviews`, `cases`
  - Time: `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`
  - Other: `Number`, `score`, `points`, `ratio`, `rate`

### 2. Updated Components

#### `EditKeyResultDrawer.tsx`
- ✅ Replaced Select with `MetricTypeSelector`
- ✅ Replaced Input with `UnitInput`
- ✅ Updated to use `MetricType` from `@okr-nexus/types`
- ✅ Added validation to map invalid metric types to valid ones

#### `OKRCreationDrawer.tsx`
- ✅ Replaced Select with `MetricTypeSelector` (2 places)
- ✅ Replaced Input with `UnitInput` (2 places)
- ✅ Updated `DraftKeyResult` interface to use `MetricType`
- ✅ Updated default values to use `MetricType.INCREASE`
- ✅ Removed invalid metric type options

## Metric Type Mapping

| UI Label | MetricType Enum | Description | Example |
|----------|----------------|-------------|---------|
| Increase | `INCREASE` | Increase from baseline to target | Increase CARR from 458M to 556M |
| Decrease | `DECREASE` | Decrease from baseline to target | Decrease vulnerabilities from 100 to 50 |
| Reach | `REACH` | Reach a specific target (typically from 0) | Reach 134M EBITDA |
| Maintain | `MAINTAIN` | Maintain above/below threshold | Stay above 1.45 CAC Payback |

## Removed Invalid Options

- ❌ **PERCENTAGE** - Not a valid MetricType (use REACH with % unit instead)
- ❌ **CUSTOM** - Not a valid MetricType (use appropriate type based on goal)

## Benefits

1. **Consistency**: All forms now use the same components and enum values
2. **User Guidance**: Tooltips and examples help users select the right metric type
3. **Better UX**: Autocomplete for units makes data entry faster
4. **Type Safety**: Using enum prevents invalid values
5. **Maintainability**: Centralized components make updates easier

## Files Created

- `apps/web/src/components/okr/MetricTypeSelector.tsx`
- `apps/web/src/components/okr/UnitInput.tsx`

## Files Updated

- `apps/web/src/components/okr/EditKeyResultDrawer.tsx`
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`

## Future Enhancements

1. **Metric Name Field**: Add optional field to store imported metric names (e.g., "EBITDA", "CARR (MNOK)")
2. **Unit Presets**: Create unit presets based on metric type (e.g., currency units for financial metrics)
3. **Validation**: Add validation to ensure unit matches metric type expectations
4. **History**: Show recently used units/metric types for quick selection

