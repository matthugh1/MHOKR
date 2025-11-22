# Metric Unit and Type Analysis

## JSON Structure Analysis

### Outcome Types Found:
1. **"Metric"** - Has detailed metric information
2. **"Percentage"** - Simple percentage-based goal

### When Outcome Type = "Metric":

The data is nested in `Outcome` object:
```json
"Outcome": {
  "Outcome Type": "Metric",
  "Metric Name": "EBITDA",
  "Metric Unit": "Number",
  "Start": 0.0,
  "Target": 134000000.0,
  "Target Type": "Reach"
}
```

### Metric Units Found:
- **"Number"** - Most common (e.g., EBITDA, CARR, Customers)
- **"Percentage"** - Percentage metrics (e.g., NRR, Uptime, Adoption rates)
- **"Dollar"** - Currency metrics (e.g., ARR, Sales)

### Target Types Found:
- **"Reach"** - Most common (e.g., "Reach 134M EBITDA")
- **"Increase From"** - Increase from baseline (e.g., "Increase CARR from 458M to 556M")
- **"Decrease From"** - Decrease from baseline (e.g., "Decrease vulnerabilities")
- **"Stay Above"** - Maintain above threshold (e.g., "Stay above 1.45 CAC Payback")
- **"Stay Below"** - Maintain below threshold (e.g., "Stay below 60 days")
- **"Find a baseline"** - Establish baseline first

## Current Import Bug

### Problem:
The parser looks for metric data at the top level:
```typescript
metricName: obj['Metric Name'] || null,
unit: obj.Unit || null,
target: this.parseNumber(obj.Target),
start: this.parseNumber(obj.Start),
```

But in JSON, these are nested in `obj.Outcome`:
```typescript
obj.Outcome['Metric Name']
obj.Outcome['Metric Unit']
obj.Outcome.Target
obj.Outcome.Start
```

### Progress Field Interpretation:

When `"Metric Unit": "Number"` or `"Dollar"`:
- `"Progress": 102415000.0` = **Current Value** (102.415M), NOT a percentage
- Progress percentage should be calculated: `(Progress / Target) * 100`

When `"Metric Unit": "Percentage"`:
- `"Progress"` might be the current percentage value OR a percentage of completion
- Need to check if Progress is between 0-100 (likely current value) or >100 (likely completion %)

## Required Fixes

1. **Update Parser Interface**: Extract metric data from `Outcome` object
2. **Map Target Types to MetricType**:
   - "Reach" → `REACH`
   - "Increase From" → `INCREASE`
   - "Decrease From" → `DECREASE`
   - "Stay Above" / "Stay Below" → `MAINTAIN`
3. **Handle Progress Field Correctly**:
   - When unit is "Number" or "Dollar": Treat Progress as currentValue
   - Calculate progress percentage: `(currentValue / targetValue) * 100`
   - When unit is "Percentage": Determine if Progress is currentValue or completion %
4. **Import Metric Name**: Store the actual metric name (e.g., "EBITDA", "CARR (MNOK)") for reference
5. **Import Unit Properly**: Store the unit exactly as specified ("Number", "Percentage", "Dollar")

## Metric Type Mapping

| VivaGoals Target Type | Our MetricType | Notes |
|----------------------|----------------|-------|
| "Reach" | `REACH` | Most common - reach a target value |
| "Increase From" | `INCREASE` | Increase from start to target |
| "Decrease From" | `DECREASE` | Decrease from start to target |
| "Stay Above" | `MAINTAIN` | Maintain above threshold |
| "Stay Below" | `MAINTAIN` | Maintain below threshold |
| "Find a baseline" | `REACH` | Establish baseline first |

## Examples

### Example 1: EBITDA (Number, Reach)
```json
"Progress": 102415000.0,
"Outcome": {
  "Metric Unit": "Number",
  "Start": 0.0,
  "Target": 134000000.0,
  "Target Type": "Reach"
}
```
- `currentValue` = 102415000.0
- `progress` = (102415000 / 134000000) * 100 = 76.43%
- `metricType` = REACH

### Example 2: CARR (Number, Increase From)
```json
"Progress": 500000000.0,
"Outcome": {
  "Metric Unit": "Number",
  "Start": 458000000.0,
  "Target": 556000000.0,
  "Target Type": "Increase From"
}
```
- `currentValue` = 500000000.0
- `progress` = ((500000000 - 458000000) / (556000000 - 458000000)) * 100 = 42.86%
- `metricType` = INCREASE

### Example 3: CAC Payback (Number, Stay Below)
```json
"Progress": 1.40,
"Outcome": {
  "Metric Unit": "Number",
  "Start": 1.45,
  "Target": 1.45,
  "Target Type": "Stay Below"
}
```
- `currentValue` = 1.40
- `progress` = (1.40 / 1.45) * 100 = 96.55% (but should be clamped to 100% if below target)
- `metricType` = MAINTAIN

